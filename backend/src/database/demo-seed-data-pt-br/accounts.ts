import { DemoAccount } from "../demo-seed-data/accounts";

/**
 * Contas no formato brasileiro (BRL / pt-BR):
 * - Conta corrente do dia a dia (Nubank)
 * - Reserva de emergência com rendimento 100% CDI (Inter)
 * - Caixinha para metas/viagens (Nubank)
 * - Cartões de crédito (Nubank Ultravioleta e Itaú Click)
 * - Financiamento imobiliário Caixa (SFH)
 * - Carteira de investimentos B3 (XP Investimentos - Brokerage + Cash)
 * - Carteira de Bitcoin
 */
export const demoAccountsPtBr: DemoAccount[] = [
  {
    key: "chequing",
    type: "CHEQUING",
    name: "Nubank - Conta Principal",
    currency: "BRL",
    openingBalance: 4850.2,
    description: "Conta principal do dia a dia (Pix, pagamentos, salário)",
    institution: "Nubank",
    isFavourite: true,
  },
  {
    key: "savings",
    type: "SAVINGS",
    name: "Reserva de Emergência (CDB 100% CDI)",
    currency: "BRL",
    openingBalance: 25000.0,
    interestRate: 10.75,
    description: "Reserva com liquidez diária equivalente a 6 meses de custos fixos",
    institution: "Banco Inter",
  },
  {
    key: "vacation",
    type: "SAVINGS",
    name: "Caixinha - Férias & Viagens",
    currency: "BRL",
    openingBalance: 4200.0,
    interestRate: 10.0,
    description: "Meta de economia para férias e viagens no final de ano",
    institution: "Nubank",
  },
  {
    key: "visa",
    type: "CREDIT_CARD",
    name: "Nubank Ultravioleta Mastercard",
    currency: "BRL",
    openingBalance: -1840.5,
    creditLimit: 20000,
    interestRate: 14.5,
    description: "Cartão de crédito principal com 1% de cashback rendendo a 200% do CDI",
    institution: "Nubank",
    isFavourite: true,
  },
  {
    key: "mastercard",
    type: "CREDIT_CARD",
    name: "Itaú Click Visa Platinum",
    currency: "BRL",
    openingBalance: -520.3,
    creditLimit: 8000,
    interestRate: 15.0,
    description: "Cartão secundário para compras parceladas e benefícios Visa",
    institution: "Itaú Unibanco",
  },
  {
    key: "mortgage",
    type: "MORTGAGE",
    name: "Financiamento Imobiliário Caixa",
    currency: "BRL",
    openingBalance: -285000.0,
    interestRate: 9.5,
    paymentAmount: 2650.0,
    paymentFrequency: "MONTHLY",
    description: "Apartamento Residencial - Financiamento Caixa (SFH)",
    institution: "Caixa Econômica Federal",
    mortgageType: "CANADIAN_FIXED",
    termMonths: 60,
    amortizationMonths: 360,
    originalPrincipal: 320000.0,
    interestCategoryPath: "Moradia > Juros de Financiamento",
  },
  {
    key: "rrsp",
    type: "INVESTMENT",
    name: "XP Investimentos - Carteira B3",
    currency: "BRL",
    openingBalance: 3500.0,
    description: "Carteira diversificada de ações e fundos imobiliários",
    institution: "XP Investimentos",
    isFavourite: true,
    isInvestmentPair: true,
  },
  {
    key: "crypto",
    type: "CRYPTO",
    name: "Carteira Bitcoin",
    currency: "BTC",
    openingBalance: 0.085,
    description: "Reserva de valor em Bitcoin de longo prazo",
  },
];
