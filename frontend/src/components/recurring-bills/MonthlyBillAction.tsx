'use client';
import { useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Modal } from '@/components/ui/Modal';
import { DateInput } from '@/components/ui/DateInput';
import { CurrencyInput } from '@/components/ui/CurrencyInput';
import { Button } from '@/components/ui/Button';
import { scheduledTransactionsApi } from '@/lib/scheduled-transactions';
import { getErrorMessage } from '@/lib/errors';
import { entryDecimalPlaces } from '@/lib/format';
import { useDateFormat } from '@/hooks/useDateFormat';
import type { MonthlyBillRow } from '@/types/recurring-bill';

export function MonthlyBillAction({ row, mode, today, onClose, onSaved }: {
  row: MonthlyBillRow; mode: 'amount' | 'pay'; today: string; onClose: () => void; onSaved: () => void;
}) {
  const t = useTranslations('bills.monthly');
  const { formatDate } = useDateFormat();
  const [amount, setAmount] = useState<number | undefined>(row.expectedAmount === null ? undefined : row.expectedAmount);
  const [paymentDate, setPaymentDate] = useState(today);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || amount === undefined || amount <= 0) return;
    setBusy(true); setError(null);
    try {
      if (mode === 'pay') await scheduledTransactionsApi.payMonthlyBill(row.scheduleId, row.originalDate, amount, paymentDate, row.revision);
      else await scheduledTransactionsApi.setMonthlyBillAmount(row.scheduleId, row.originalDate, amount, row.revision);
      onSaved();
    } catch (cause) { setError(getErrorMessage(cause, t('saveFailed'))); }
    finally { setBusy(false); }
  }
  return <Modal isOpen title={mode === 'pay' ? t('pay') : t('editAmount')} onClose={busy ? undefined : onClose} maxWidth="md">
    <form onSubmit={submit} className="space-y-4">
      <p>{t('occurrence', { name: row.name, date: formatDate(row.dueDate) })}</p>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <CurrencyInput label={mode === 'pay' ? t('paidAmount') : t('expectedAmount')} prefix={row.currencyCode}
        value={amount} onChange={setAmount} decimalPlaces={entryDecimalPlaces(row.currencyCode)} required allowNegative={false} disabled={busy} />
      {mode === 'pay' && <>
        <DateInput label={t('paymentDate')} value={paymentDate} onDateChange={setPaymentDate} required disabled={busy} />
        <p className="text-sm text-gray-600 dark:text-gray-400">{t('paymentHelp')}</p>
      </>}
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" onClick={onClose} disabled={busy}>{t('cancel')}</Button>
        <Button type="submit" isLoading={busy} disabled={amount === undefined || amount <= 0}>{mode === 'pay' ? t('pay') : t('save')}</Button>
      </div>
    </form>
  </Modal>;
}
