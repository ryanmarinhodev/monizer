export interface MonthlyBillRow {
  scheduleId: string;
  originalDate: string;
  dueDate: string;
  name: string;
  accountId: string;
  currencyCode: string;
  expectedAmount: number | null;
  paidAmount: number | null;
  paymentDate: string | null;
  transactionId: string | null;
  status: 'paid' | 'pending' | 'overdue' | 'review';
  reserved: boolean;
  paymentBlocked: boolean;
  revision: string;
}
export interface MonthlyBills {
  month: string;
  today: string;
  currencyCode: string;
  rows: MonthlyBillRow[];
  candidates: Array<{ id: string; name: string }>;
  trackingStarts: Array<{ name: string; date: string }>;
  total: number | null;
  paid: number | null;
  outstanding: number | null;
  reserved: number | null;
  knownSubtotal: number;
  missingRates: Array<{ from: string; to: string; date: string }>;
  unknownBills: string[];
  budget: { amount: number | null; currencyCode: string; revision: number } | null;
  budgetConverted: number | null;
  remainder: number | null;
}
