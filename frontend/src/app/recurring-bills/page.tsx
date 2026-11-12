'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { PageLayout } from '@/components/layout/PageLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { CalendarMonthNav } from '@/components/calendar/CalendarMonthNav';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ReportError } from '@/components/reports/ReportError';
import { MonthlyBillForm } from '@/components/recurring-bills/MonthlyBillForm';
import { MonthlyBillAction } from '@/components/recurring-bills/MonthlyBillAction';
import { MonthlyBudgetForm } from '@/components/recurring-bills/MonthlyBudgetForm';
import { QuickAccountForm } from '@/components/recurring-bills/QuickAccountForm';
import { useReportData } from '@/hooks/useReportData';
import { useFinancialToday } from '@/hooks/useFinancialToday';
import { useNumberFormat } from '@/hooks/useNumberFormat';
import { useDateFormat } from '@/hooks/useDateFormat';
import { scheduledTransactionsApi } from '@/lib/scheduled-transactions';
import { getErrorMessage } from '@/lib/errors';
import { useAuthStore } from '@/store/authStore';
import type { MonthlyBillRow } from '@/types/recurring-bill';

export default function RecurringBillsPage() {
  return <ProtectedRoute><RecurringBillsContent /></ProtectedRoute>;
}

export function RecurringBillsContent() {
  const t = useTranslations('bills.monthly');
  const locale = useLocale();
  const today = useFinancialToday();
  const { formatCurrency, defaultCurrency } = useNumberFormat();
  const { formatDate } = useDateFormat();
  const userId = useAuthStore((s) => s.user?.id);
  const [month, setMonth] = useState(today.slice(0, 7));
  const [dialog, setDialog] = useState<'create' | 'budget' | 'account' | null>(null);
  const [action, setAction] = useState<{ row: MonthlyBillRow; mode: 'amount' | 'pay' } | null>(null);
  const [adopting, setAdopting] = useState<{ id: string; name: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestKey = `${userId}:${month}:${defaultCurrency}:${locale}`;
  const report = useReportData(() => scheduledTransactionsApi.getMonthlyBills(`${month}-01`),
    [requestKey], { requestKey });
  const data = report.dataKey === requestKey && !report.error && !report.isLoading ? report.data : null;
  const modalOpen = dialog !== null || action !== null || adopting !== null;
  const saved = () => { setDialog(null); setAction(null); setError(null); report.reload(); };
  const money = (amount: number | null, code: string) => amount === null ? t('unknown') : formatCurrency(amount, code);
  async function reserve(row: MonthlyBillRow) {
    if (!data || busy) return;
    setBusy(true); setError(null);
    try {
      await scheduledTransactionsApi.reserveMonthlyBill(row.scheduleId, row.originalDate, !row.reserved, row.revision);
      report.reload();
    } catch (cause) { setError(getErrorMessage(cause, t('saveFailed'))); }
    finally { setBusy(false); }
  }
  async function adopt() {
    if (!adopting || busy) return;
    setBusy(true); setError(null);
    try { await scheduledTransactionsApi.adoptMonthlyBill(adopting.id); setAdopting(null); report.reload(); }
    catch (cause) { setError(getErrorMessage(cause, t('saveFailed'))); }
    finally { setBusy(false); }
  }
  return <PageLayout>
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6" aria-busy={report.isLoading || busy}>
      <PageHeader title={t('title')} subtitle={t('intro')} />
      <fieldset disabled={modalOpen || busy} className="flex flex-wrap items-center gap-3">
        <CalendarMonthNav month={month} onMonthChange={setMonth} today={data?.today ?? today} />
        <Button className="w-full sm:ml-auto sm:w-auto" disabled={!data} onClick={() => setDialog('create')}>{t('newBill')}</Button>
        <Button variant="outline" disabled={!data} onClick={() => setDialog('budget')}>{t('budget')}</Button>
        <Button variant="ghost" onClick={report.reload}>{t('refresh')}</Button>
      </fieldset>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {report.error && <ReportError message={getErrorMessage(report.error, t('loadFailed'))} onRetry={report.reload} />}
      {report.isLoading && <p role="status">{t('loading')}</p>}
      {data && <>
        <Card className="p-4 space-y-3">
          <p className="text-sm text-gray-600 dark:text-gray-400">{t('onboarding')}</p>
          <Button variant="outline" size="sm" onClick={() => setDialog('account')}>{t('newAccount')}</Button>
        </Card>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {(['total', 'paid', 'outstanding', 'reserved'] as const).map((key) => <Card key={key} className="p-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">{t(key)}</p>
            <p className="text-lg font-semibold">{money(data[key], data.currencyCode)}</p>
          </Card>)}
          {data.budget && data.budget.amount !== null && <>
            <Card className="p-4"><p className="text-sm text-gray-600 dark:text-gray-400">{t('budget')}</p><p className="text-lg font-semibold">{money(data.budgetConverted, data.currencyCode)}</p></Card>
            <Card className="p-4"><p className="text-sm text-gray-600 dark:text-gray-400">{t('remainder')}</p><p className="text-lg font-semibold">{money(data.remainder, data.currencyCode)}</p></Card>
          </>}
        </div>
        {data.missingRates.map((gap, i) => <p key={`${gap.from}:${gap.date}:${i}`} className="text-sm text-amber-700 dark:text-amber-300">{t('missingRate', { ...gap, date: formatDate(gap.date) })}</p>)}
        {data.unknownBills.length > 0 && <p className="text-sm text-amber-700 dark:text-amber-300">{t('unknownBills', { names: data.unknownBills.join(', ') })}</p>}
        {data.trackingStarts.filter((s) => s.date.slice(0, 7) > month).map((s) => <p key={`${s.name}:${s.date}`} className="text-sm text-gray-600 dark:text-gray-400">{t('historyStarts', { name: s.name, date: formatDate(s.date) })}</p>)}
        {data.rows.length === 0 ? <EmptyState title={t('empty')} description={t('emptyHelp')} /> : <ul className="space-y-3">
          {data.rows.map((row) => <li key={`${row.scheduleId}:${row.originalDate}`}>
            <Card className="flex flex-wrap items-center gap-4 p-4">
              <div className="min-w-0 flex-1 space-y-1">
                <h2 className="font-medium break-words">{row.name}</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">{t('dueOn', { date: formatDate(row.dueDate) })}</p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant={row.status === 'paid' ? 'green' : row.status === 'overdue' || row.status === 'review' ? 'red' : 'gray'}>{t(row.status)}</Badge>
                  {row.reserved && row.status !== 'paid' && <Badge variant="blue">{t('reserved')}</Badge>}
                </div>
                {row.paymentBlocked && row.status !== 'paid' && <p className="text-sm text-amber-700 dark:text-amber-300">{t('blockedPayment')}</p>}
              </div>
              <div className="text-right">
                <p className="font-semibold">{money(row.status === 'paid' ? row.paidAmount : row.expectedAmount, row.currencyCode)}</p>
                {row.status === 'paid' && <p className="text-sm text-gray-600 dark:text-gray-400">{t('expectedWas', { amount: money(row.expectedAmount, row.currencyCode) })}</p>}
                {row.paymentDate && <p className="text-sm text-gray-600 dark:text-gray-400">{t('paidOn', { date: formatDate(row.paymentDate) })}</p>}
              </div>
              {!row.paymentBlocked && <div className="flex w-full flex-wrap gap-2 sm:w-auto">
                <Button size="sm" variant="outline" disabled={busy} onClick={() => setAction({ row, mode: 'amount' })}>{t('editAmount')}</Button>
                <Button size="sm" variant="outline" disabled={busy} onClick={() => void reserve(row)}>{row.reserved ? t('unreserve') : t('reserve')}</Button>
                <Button size="sm" disabled={busy} onClick={() => setAction({ row, mode: 'pay' })}>{t('pay')}</Button>
              </div>}
            </Card>
          </li>)}
        </ul>}
        {data.candidates.length > 0 && <Card className="space-y-3 p-4">
          <h2 className="font-semibold">{t('existingBills')}</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">{t('adoptHelp')}</p>
          {data.candidates.map((candidate) => <div key={candidate.id} className="flex flex-wrap items-center justify-between gap-2">
            <span>{candidate.name}</span><Button size="sm" variant="outline" disabled={busy} onClick={() => setAdopting(candidate)}>{t('adopt')}</Button>
          </div>)}
        </Card>}
      </>}
    </main>
    {dialog === 'create' && <MonthlyBillForm date={`${month}-01`} onClose={() => setDialog(null)} onSaved={saved} />}
    {dialog === 'account' && <QuickAccountForm onClose={() => setDialog(null)} onSaved={saved} />}
    {dialog === 'budget' && data && <MonthlyBudgetForm data={data} onClose={() => setDialog(null)} onSaved={saved} />}
    {action && <MonthlyBillAction {...action} today={data?.today ?? today} onClose={() => setAction(null)} onSaved={saved} />}
    <ConfirmDialog isOpen={!!adopting} title={t('adopt')} message={t('adoptHelp')} onConfirm={adopt} onCancel={() => setAdopting(null)} variant="info" />
  </PageLayout>;
}
