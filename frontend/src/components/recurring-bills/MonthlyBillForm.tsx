'use client';
import { useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { DateInput } from '@/components/ui/DateInput';
import { CurrencyInput } from '@/components/ui/CurrencyInput';
import { Button } from '@/components/ui/Button';
import { ReportError } from '@/components/reports/ReportError';
import { accountsApi } from '@/lib/accounts';
import { scheduledTransactionsApi } from '@/lib/scheduled-transactions';
import { getErrorMessage } from '@/lib/errors';
import { entryDecimalPlaces } from '@/lib/format';
import { useReportData } from '@/hooks/useReportData';
import { type Account } from '@/types/account';
import { QuickAccountForm } from './QuickAccountForm';

export function MonthlyBillForm({ date, onClose, onSaved }: { date: string; onClose: () => void; onSaved: () => void }) {
  const t = useTranslations('bills.monthly');
  const accounts = useReportData(() => accountsApi.getAll(), []);
  const [createdAccounts, setCreatedAccounts] = useState<Account[]>([]);
  const [accountId, setAccountId] = useState('');
  const [name, setName] = useState('');
  const [amount, setAmount] = useState<number | undefined>();
  const [firstDueDate, setFirstDueDate] = useState(date);
  const [creatingAccount, setCreatingAccount] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const compatible = [...(accounts.data ?? []), ...createdAccounts.filter((a) => !accounts.data?.some((b) => b.id === a.id))]
    .filter((a) => !a.isJoint && !a.isClosed && ['CHEQUING', 'SAVINGS', 'CASH'].includes(a.accountType));
  const selected = compatible.find((a) => a.id === accountId);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!selected || amount === undefined || amount <= 0 || busy || accounts.error || accounts.isLoading) return;
    setBusy(true); setError(null);
    try {
      await scheduledTransactionsApi.createMonthlyBill({ name: name.trim(), amount, firstDueDate, accountId: selected.id });
      onSaved();
    } catch (cause) { setError(getErrorMessage(cause, t('saveFailed'))); }
    finally { setBusy(false); }
  }
  return <>
    <Modal isOpen title={t('newBill')} onClose={busy ? undefined : onClose} maxWidth="md">
      <form onSubmit={submit} className="space-y-4">
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        <Input label={t('name')} value={name} onChange={(e) => setName(e.target.value)} maxLength={100} required disabled={busy} />
        <CurrencyInput label={t('expectedAmount')} value={amount} onChange={setAmount} decimalPlaces={selected ? entryDecimalPlaces(selected.currencyCode) : 4} allowNegative={false} required disabled={busy} />
        <DateInput label={t('firstDueDate')} value={firstDueDate} onDateChange={setFirstDueDate} required disabled={busy} />
        {accounts.error ? <ReportError onRetry={accounts.reload} /> : <>
          {!accounts.isLoading && compatible.length === 0 && <p className="text-sm text-gray-600 dark:text-gray-400">{t('accountHelp')}</p>}
          <Select label={t('account')} value={accountId} onChange={(e) => setAccountId(e.target.value)} required disabled={busy || accounts.isLoading}
            options={[{ value: '', label: t('selectAccount') }, ...compatible.map((a) => ({ value: a.id, label: `${a.name} (${a.currencyCode})` }))]} />
          <Button type="button" variant="outline" onClick={() => setCreatingAccount(true)} disabled={busy || accounts.isLoading}>{t('newAccount')}</Button>
        </>}
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>{t('cancel')}</Button>
          <Button type="submit" isLoading={busy} disabled={!selected || amount === undefined || amount <= 0 || !name.trim() || accounts.isLoading || !!accounts.error}>{t('save')}</Button>
        </div>
      </form>
    </Modal>
    {creatingAccount && <QuickAccountForm onClose={() => setCreatingAccount(false)} onSaved={(account) => {
      setCreatedAccounts((previous) => [...previous, account]); setAccountId(account.id); setCreatingAccount(false);
    }} />}
  </>;
}
