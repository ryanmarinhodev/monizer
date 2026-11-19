'use client';

import { useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { CurrencyInput } from '@/components/ui/CurrencyInput';
import { Button } from '@/components/ui/Button';
import { accountsApi } from '@/lib/accounts';
import { getErrorMessage } from '@/lib/errors';
import { entryDecimalPlaces } from '@/lib/format';
import { type AccountType, type Account } from '@/types/account';
import { useNumberFormat } from '@/hooks/useNumberFormat';
import { useReportData } from '@/hooks/useReportData';
import { exchangeRatesApi } from '@/lib/exchange-rates';
import { ReportError } from '@/components/reports/ReportError';

export function QuickAccountForm({ onClose, onSaved }: { onClose: () => void; onSaved: (account: Account) => void }) {
  const t = useTranslations('bills.monthly');
  const { defaultCurrency } = useNumberFormat();
  const [name, setName] = useState('');
  const [accountType, setAccountType] = useState<AccountType>('CHEQUING');
  const [currencyCode, setCurrencyCode] = useState(defaultCurrency);
  const [openingBalance, setOpeningBalance] = useState<number | undefined>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const currencies = useReportData(() => exchangeRatesApi.getCurrencies(), []);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || openingBalance === undefined || !name.trim() || !currencies.data) return;
    setBusy(true); setError(null);
    try {
      const account = await accountsApi.create({ name: name.trim(), accountType, currencyCode, openingBalance });
      onSaved(account);
    } catch (cause) { setError(getErrorMessage(cause, t('saveFailed'))); }
    finally { setBusy(false); }
  }
  return <Modal isOpen title={t('newAccount')} onClose={busy ? undefined : onClose} maxWidth="md">
    <form onSubmit={submit} className="space-y-4">
      <p className="text-sm text-gray-600 dark:text-gray-400">{t('accountHelp')}</p>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {currencies.error ? <ReportError onRetry={currencies.reload} /> : <>
        <Input label={t('name')} value={name} onChange={(e) => setName(e.target.value)} maxLength={100} required disabled={busy} />
        <Select label={t('accountType')} value={accountType} onChange={(e) => setAccountType(e.target.value as AccountType)} disabled={busy}
          options={['CHEQUING', 'SAVINGS', 'CASH'].map((value) => ({ value, label: t(value) }))} />
        <Select label={t('currency')} value={currencyCode} onChange={(e) => setCurrencyCode(e.target.value)} disabled={busy || currencies.isLoading}
          options={(currencies.data ?? []).filter((c) => c.kind !== 'CRYPTO').map((c) => ({ value: c.code, label: c.code }))} />
        <CurrencyInput label={t('openingBalance')} value={openingBalance} onChange={setOpeningBalance} decimalPlaces={entryDecimalPlaces(currencyCode)} required disabled={busy} />
        <p className="text-sm text-gray-600 dark:text-gray-400">{t('balanceHelp')}</p>
      </>}
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" onClick={onClose} disabled={busy}>{t('cancel')}</Button>
        <Button type="submit" isLoading={busy} disabled={openingBalance === undefined || !name.trim() || currencies.isLoading || !!currencies.error}>{t('save')}</Button>
      </div>
    </form>
  </Modal>;
}
