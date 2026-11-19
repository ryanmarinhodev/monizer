'use client';
import { useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Modal } from '@/components/ui/Modal';
import { CurrencyInput } from '@/components/ui/CurrencyInput';
import { Button } from '@/components/ui/Button';
import { scheduledTransactionsApi } from '@/lib/scheduled-transactions';
import { getErrorMessage } from '@/lib/errors';
import { entryDecimalPlaces } from '@/lib/format';
import type { MonthlyBills } from '@/types/recurring-bill';

export function MonthlyBudgetForm({ data, onClose, onSaved }: { data: MonthlyBills; onClose: () => void; onSaved: () => void }) {
  const t = useTranslations('bills.monthly');
  const [amount, setAmount] = useState<number | undefined>(data.budget?.amount === null ? undefined : data.budget?.amount);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const currencyCode = data.budget?.currencyCode ?? data.currencyCode;
  async function save(remove: boolean) {
    if (busy || (!remove && (amount === undefined || amount < 0))) return;
    setBusy(true); setError(null);
    try {
      if (remove) await scheduledTransactionsApi.removeMonthlyBillBudget(data.month, data.budget?.revision ?? 0);
      else await scheduledTransactionsApi.saveMonthlyBillBudget(data.month, amount!, data.budget?.revision ?? 0);
      onSaved();
    } catch (cause) { setError(getErrorMessage(cause, t('saveFailed'))); }
    finally { setBusy(false); }
  }
  function submit(event: FormEvent) { event.preventDefault(); void save(false); }
  return <Modal isOpen title={t('budget')} onClose={busy ? undefined : onClose} maxWidth="md">
    <form onSubmit={submit} className="space-y-4">
      <p className="text-sm text-gray-600 dark:text-gray-400">{t('budgetHelp')}</p>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <CurrencyInput label={t('budget')} prefix={currencyCode} value={amount} onChange={setAmount} decimalPlaces={entryDecimalPlaces(currencyCode)} allowNegative={false} required disabled={busy} />
      <div className="flex flex-wrap justify-end gap-2">
        {data.budget && data.budget.amount !== null && <Button type="button" variant="danger" disabled={busy} onClick={() => void save(true)}>{t('remove')}</Button>}
        <Button type="button" variant="outline" disabled={busy} onClick={onClose}>{t('cancel')}</Button>
        <Button type="submit" isLoading={busy} disabled={amount === undefined || amount < 0}>{t('save')}</Button>
      </div>
    </form>
  </Modal>;
}
