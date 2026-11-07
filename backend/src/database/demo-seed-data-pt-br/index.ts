import { demoAccountsPtBr } from "./accounts";
import { demoInstitutionsPtBr } from "./institutions";
import { demoPayeesPtBr } from "./payees";
import { demoPreferencesPtBr } from "./preferences";
import { demoReportsPtBr } from "./reports";
import { demoScheduledTransactionsPtBr } from "./scheduled";
import { demoSecuritiesPtBr } from "./securities";
import { generateTransactionsPtBr } from "./transactions";
import {
  incomeCategoriesPtBr,
  expenseCategoriesPtBr,
} from "./categories";

export {
  demoAccountsPtBr,
  demoInstitutionsPtBr,
  demoPayeesPtBr,
  demoPreferencesPtBr,
  demoReportsPtBr,
  demoScheduledTransactionsPtBr,
  demoSecuritiesPtBr,
  generateTransactionsPtBr,
  incomeCategoriesPtBr,
  expenseCategoriesPtBr,
};

export const demoDatasetPtBr = {
  locale: "pt-BR" as const,
  accounts: demoAccountsPtBr,
  institutions: demoInstitutionsPtBr,
  payees: demoPayeesPtBr,
  preferences: demoPreferencesPtBr,
  reports: demoReportsPtBr,
  scheduledTransactions: demoScheduledTransactionsPtBr,
  securities: demoSecuritiesPtBr,
  incomeCategories: incomeCategoriesPtBr,
  expenseCategories: expenseCategoriesPtBr,
  generateTransactions: generateTransactionsPtBr,
  cryptoFiat: "BRL",
  cryptoLevel: 550_000,
};
