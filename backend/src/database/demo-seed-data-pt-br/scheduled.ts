import { DemoScheduledTransaction } from "../demo-seed-data/scheduled";

/**
 * Transações recorrentes agendadas no Brasil:
 * - Salário mensal
 * - Condomínio e parcela da Caixa
 * - Contas de energia, internet e telefone
 * - Assinaturas de streaming e academia
 */
export const demoScheduledTransactionsPtBr: DemoScheduledTransaction[] = [
  {
    name: "Salário Mensal",
    accountKey: "chequing",
    payeeName: "TechSolutions Brasil Ltda",
    categoryPath: "Salário",
    amount: 8500.0,
    frequency: "MONTHLY",
    dueDayOfMonth: 5,
    autoPost: true,
  },
  {
    name: "Boleto Condomínio Edifício Mirante",
    accountKey: "chequing",
    payeeName: "Condomínio Edifício Mirante",
    categoryPath: "Moradia > Aluguel / Condomínio",
    amount: -850.0,
    frequency: "MONTHLY",
    dueDayOfMonth: 10,
    autoPost: true,
  },
  {
    name: "Prestação Financiamento Caixa (SFH)",
    accountKey: "chequing",
    payeeName: "Caixa Habitação",
    categoryPath: "Moradia > Juros de Financiamento",
    amount: -2650.0,
    frequency: "MONTHLY",
    dueDayOfMonth: 28,
    autoPost: true,
  },
  {
    name: "Conta de Luz Enel SP",
    accountKey: "chequing",
    payeeName: "Enel Distribuição SP",
    categoryPath: "Contas & Serviços > Energia Elétrica",
    amount: -220.0,
    frequency: "MONTHLY",
    dueDayOfMonth: 15,
    autoPost: false,
  },
  {
    name: "Internet Fibra 500 Mega",
    accountKey: "chequing",
    payeeName: "Vivo Fibra",
    categoryPath: "Contas & Serviços > Internet Fibra",
    amount: -149.9,
    frequency: "MONTHLY",
    dueDayOfMonth: 18,
    autoPost: true,
  },
  {
    name: "Mensalidade Academia Smart Fit",
    accountKey: "visa",
    payeeName: "Smart Fit",
    categoryPath: "Saúde > Academia",
    amount: -119.9,
    frequency: "MONTHLY",
    dueDayOfMonth: 1,
    autoPost: true,
  },
  {
    name: "Assinatura Netflix Premium",
    accountKey: "visa",
    payeeName: "Netflix Brasil",
    categoryPath: "Lazer & Entretenimento > Streaming",
    amount: -55.9,
    frequency: "MONTHLY",
    dueDayOfMonth: 22,
    autoPost: true,
  },
  {
    name: "Assinatura Spotify Família",
    accountKey: "visa",
    payeeName: "Spotify Brasil",
    categoryPath: "Lazer & Entretenimento > Streaming",
    amount: -34.9,
    frequency: "MONTHLY",
    dueDayOfMonth: 10,
    autoPost: true,
  },
  {
    name: "Plano Móvel Claro Controle",
    accountKey: "visa",
    payeeName: "Claro Brasil",
    categoryPath: "Contas & Serviços > Telefonia Celular",
    amount: -59.9,
    frequency: "MONTHLY",
    dueDayOfMonth: 20,
    autoPost: true,
  },
];
