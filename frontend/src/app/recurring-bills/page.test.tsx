import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@/test/render';
import { RecurringBillsContent } from './page';

const mocks = vi.hoisted(() => ({ remove: vi.fn(), reload: vi.fn(), blocked: false }));
vi.mock('@/components/layout/PageLayout', () => ({ PageLayout: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock('@/hooks/useFinancialToday', () => ({ useFinancialToday: () => '2026-12-01' }));
vi.mock('@/store/authStore', () => ({ useAuthStore: (select: (s: { user: { id: string } }) => unknown) => select({ user: { id: 'owner' } }) }));
vi.mock('@/hooks/useNumberFormat', async () => {
  const { numberFormatMockDefaults } = await import('@/test/number-format-mock');
  return { useNumberFormat: () => ({ ...numberFormatMockDefaults(), defaultCurrency: 'USD', formatCurrency: (n: number) => `$${n}` }) };
});
vi.mock('@/lib/scheduled-transactions', () => ({ scheduledTransactionsApi: { deleteMonthlyBill: (...args: unknown[]) => mocks.remove(...args) } }));
vi.mock('@/hooks/useReportData', () => ({ useReportData: (_fn: unknown, _deps: unknown, options: { requestKey: string }) => ({
  dataKey: options.requestKey, isLoading: false, error: null, reload: mocks.reload,
  data: { currencyCode: 'USD', today: '2026-12-01', total: 240, paid: 0, outstanding: 240, reserved: 0,
    budget: null, missingRates: [], unknownBills: [], trackingStarts: [], candidates: [],
    rows: [{ scheduleId: 'bill', originalDate: '2026-12-22', dueDate: '2026-12-22', name: 'Electricity',
      expectedAmount: 240, paidAmount: 0, status: 'pending', paymentBlocked: mocks.blocked, reserved: false,
      currencyCode: 'USD', revision: 'revision' }],
  },
}) }));

describe('monthly bill deletion', () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.blocked = false; mocks.remove.mockResolvedValue(undefined); });
  it.each([
    ['Delete this month', 'occurrence'], ['End from this month', 'future'],
  ])('confirms %s and sends the selected slot and revision', async (label, scope) => {
    render(<RecurringBillsContent />);
    fireEvent.click(screen.getByRole('button', { name: label }));
    expect(mocks.remove).not.toHaveBeenCalled();
    expect(screen.getByText(/recorded payments are preserved/)).toBeInTheDocument();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Confirm' })); });
    await waitFor(() => expect(mocks.remove).toHaveBeenCalledWith('bill', '2026-12-22', scope, 'revision'));
    expect(mocks.reload).toHaveBeenCalledOnce();
  });
  it('allows cancelling without changing the bill', () => {
    render(<RecurringBillsContent />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete this month' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(mocks.remove).not.toHaveBeenCalled();
  });
  it('does not offer deletion for a claimed payment', () => {
    mocks.blocked = true;
    render(<RecurringBillsContent />);
    expect(screen.queryByRole('button', { name: 'Delete this month' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'End from this month' })).not.toBeInTheDocument();
  });
  it('reports rejection without treating deletion as successful', async () => {
    mocks.remove.mockRejectedValue(new Error('Rejected'));
    render(<RecurringBillsContent />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete this month' }));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Confirm' })); });
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(mocks.reload).not.toHaveBeenCalled();
  });
});
