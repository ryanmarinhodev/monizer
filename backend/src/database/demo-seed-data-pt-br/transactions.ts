import { demoAccountsPtBr } from "./accounts";
import { getPeriodicRate } from "../../accounts/mortgage-amortization.util";
import {
  DEFAULT_PERIODS_PER_YEAR,
  periodsPerYearForStoredFrequency,
} from "../../accounts/payment-frequency.util";
import { roundToDecimals } from "../../common/round.util";
import {
  DemoSplit,
  DemoTransaction,
  daysBefore,
  formatDate,
  getMonthDate,
  randomBetween,
  seededRandom,
  statusFor,
} from "../demo-seed-data/transactions";

/**
 * Gera 12 meses de transações financeiras brasileiras realistas:
 * - Salário mensal líquido dia 05, 13º salário em duas parcelas, férias e PLR
 * - Financiamento imobiliário Caixa com amortização de principal e juros
 * - Condomínio, IPTU parcelado, contas de consumo (Enel, Sabesp, Vivo Fibra, Comgás)
 * - Compras de supermercado (Pão de Açúcar, Carrefour, Atacadão)
 * - Padaria Bella Paulista, delivery iFood e restaurantes (Outback)
 * - Combustível (Postos Ipiranga/Shell) e corridas de Uber
 * - Assinaturas mensais (Netflix, Spotify, Claro, Smart Fit)
 * - Compras em e-commerce (Mercado Livre, Amazon, Magalu)
 * - Pagamento mensal das faturas dos cartões Nubank e Itaú via transferência
 * - Aportes mensais na XP Investimentos e recebimento de dividendos de FIIs e ações
 * - Transações na carteira de Bitcoin
 */
export function generateTransactionsPtBr(
  referenceDate: Date,
): DemoTransaction[] {
  const transactions: DemoTransaction[] = [];
  const rand = seededRandom(104);

  const startDate = new Date(referenceDate);
  startDate.setMonth(startDate.getMonth() - 12);

  const mortgage = demoAccountsPtBr.find((a) => a.key === "mortgage")!;
  const MORTGAGE_PAYMENT = mortgage.paymentAmount!;
  const mortgageRate = getPeriodicRate(
    mortgage.interestRate!,
    periodsPerYearForStoredFrequency(mortgage.paymentFrequency!) ??
      DEFAULT_PERIODS_PER_YEAR,
    mortgage.mortgageType!,
  );
  let mortgageDebt = Math.abs(mortgage.openingBalance);

  const startYear = startDate.getFullYear();
  const startMonth = startDate.getMonth();

  for (let i = 0; i < 12; i++) {
    const year = startYear + Math.floor((startMonth + i) / 12);
    const month = (startMonth + i) % 12;
    const monthDate = new Date(year, month, 1);
    const isOlderThan2Months =
      monthDate <
      new Date(referenceDate.getFullYear(), referenceDate.getMonth() - 2, 1);
    const isCurrentMonth =
      year === referenceDate.getFullYear() &&
      month === referenceDate.getMonth();

    const clearedStatus = isOlderThan2Months
      ? { status: "RECONCILED" }
      : isCurrentMonth
        ? { status: "UNRECONCILED" }
        : { status: "CLEARED" };

    // === SALÁRIO (Dia 05 de cada mês via Pix/TED) ===
    const salaryDate = getMonthDate(year, month, 5);
    if (salaryDate <= referenceDate && salaryDate >= startDate) {
      transactions.push({
        accountKey: "chequing",
        date: formatDate(salaryDate),
        payeeName: "TechSolutions Brasil Ltda",
        categoryPath: "Salário",
        amount: 8500.0,
        description: "Salário Líquido Mensal - TechSolutions Brasil",
        ...clearedStatus,
      });
    }

    // Férias em Julho (Mês 6 se 0-indexed ou quando month === 6)
    if (month === 6) {
      const feriasDate = getMonthDate(year, month, 1);
      if (feriasDate <= referenceDate && feriasDate >= startDate) {
        transactions.push({
          accountKey: "chequing",
          date: formatDate(feriasDate),
          payeeName: "TechSolutions Brasil Ltda",
          categoryPath: "Salário",
          amount: 11200.0,
          description: "Adiantamento de Férias + 1/3 Constitucional",
          ...clearedStatus,
        });
      }
    }

    // 13º Salário: 1ª Parcela em 30 de Novembro (month === 10)
    if (month === 10) {
      const decimoPrimeiro = getMonthDate(year, month, 30);
      if (decimoPrimeiro <= referenceDate && decimoPrimeiro >= startDate) {
        transactions.push({
          accountKey: "chequing",
          date: formatDate(decimoPrimeiro),
          payeeName: "TechSolutions Brasil Ltda",
          categoryPath: "Salário",
          amount: 4250.0,
          description: "13º Salário - 1ª Parcela",
          ...clearedStatus,
        });
      }
    }

    // 13º Salário: 2ª Parcela em 20 de Dezembro (month === 11)
    if (month === 11) {
      const decimoSegundo = getMonthDate(year, month, 20);
      if (decimoSegundo <= referenceDate && decimoSegundo >= startDate) {
        transactions.push({
          accountKey: "chequing",
          date: formatDate(decimoSegundo),
          payeeName: "TechSolutions Brasil Ltda",
          categoryPath: "Salário",
          amount: 3800.0,
          description: "13º Salário - 2ª Parcela (Líquido de INSS/IRRF)",
          ...clearedStatus,
        });
      }
    }

    // Bônus anual / PLR em Março (month === 2)
    if (month === 2) {
      const plrDate = getMonthDate(year, month, 15);
      if (plrDate <= referenceDate && plrDate >= startDate) {
        transactions.push({
          accountKey: "chequing",
          date: formatDate(plrDate),
          payeeName: "TechSolutions Brasil Ltda",
          categoryPath: "Salário",
          amount: 6000.0,
          description: "Participação nos Lucros e Resultados (PLR)",
          ...clearedStatus,
        });
      }
    }

    // Consultoria Freelance esporádica (meses 1, 5, 8)
    if (month === 1 || month === 5 || month === 8) {
      const freelaDate = getMonthDate(year, month, 22);
      if (freelaDate <= referenceDate && freelaDate >= startDate) {
        transactions.push({
          accountKey: "chequing",
          date: formatDate(freelaDate),
          payeeName: "Cliente Freelance - Consultoria PJ",
          categoryPath: "Freelance & PJ",
          amount: randomBetween(rand, 2800, 3600),
          description: "Consultoria em Arquitetura de Software e Cloud",
          ...clearedStatus,
        });
      }
    }

    // === FINANCIAMENTO IMOBILIÁRIO CAIXA (Dia 28, com Split Amortização + Juros) ===
    const mortgageDate = getMonthDate(year, month, 28);
    if (mortgageDate <= referenceDate && mortgageDate >= startDate) {
      const interest = roundToDecimals(mortgageDebt * mortgageRate, 2);
      const principal = roundToDecimals(MORTGAGE_PAYMENT - interest, 2);
      mortgageDebt = roundToDecimals(mortgageDebt - principal, 2);
      transactions.push({
        accountKey: "chequing",
        date: formatDate(mortgageDate),
        payeeName: "Caixa Habitação",
        categoryPath: "Moradia > Juros de Financiamento",
        amount: -MORTGAGE_PAYMENT,
        description: "Prestação Financiamento Imobiliário Caixa (SFH)",
        isSplit: true,
        splits: [
          {
            transferAccountKey: "mortgage",
            amount: -principal,
            memo: "Amortização de Saldo Devedor",
          },
          {
            categoryPath: "Moradia > Juros de Financiamento",
            amount: -interest,
            memo: "Juros e Taxas de Administração Caixa",
          },
        ],
        ...clearedStatus,
      });
    }

    // === CONDOMÍNIO (Dia 10) ===
    const condoDate = getMonthDate(year, month, 10);
    if (condoDate <= referenceDate && condoDate >= startDate) {
      transactions.push({
        accountKey: "chequing",
        date: formatDate(condoDate),
        payeeName: "Condomínio Edifício Mirante",
        categoryPath: "Moradia > Aluguel / Condomínio",
        amount: -850.0,
        description: "Boleto Condomínio Edifício Mirante",
        ...clearedStatus,
      });
    }

    // === IPTU (Parcelas de Fevereiro a Novembro - meses 1 a 10) ===
    if (month >= 1 && month <= 10) {
      const iptuDate = getMonthDate(year, month, 10);
      if (iptuDate <= referenceDate && iptuDate >= startDate) {
        transactions.push({
          accountKey: "chequing",
          date: formatDate(iptuDate),
          payeeName: "Prefeitura de São Paulo - IPTU",
          categoryPath: "Moradia > IPTU",
          amount: -185.0,
          description: `IPTU Exercício - Parcela 0${month}/10`,
          ...clearedStatus,
        });
      }
    }

    // === CONTAS DE CONSUMO & SERVIÇOS ===
    // Energia Elétrica (Enel SP)
    const enelDate = getMonthDate(year, month, 15);
    if (enelDate <= referenceDate && enelDate >= startDate) {
      const isSummer = month >= 11 || month <= 2; // Ar condicionado no verão brasileiro
      const enelBase = isSummer ? 250 : 190;
      transactions.push({
        accountKey: "chequing",
        date: formatDate(enelDate),
        payeeName: "Enel Distribuição SP",
        categoryPath: "Contas & Serviços > Energia Elétrica",
        amount: -randomBetween(rand, enelBase - 25, enelBase + 30),
        description: "Conta de Energia Elétrica Enel",
        ...clearedStatus,
      });
    }

    // Água e Esgoto (Sabesp)
    const sabespDate = getMonthDate(year, month, 12);
    if (sabespDate <= referenceDate && sabespDate >= startDate) {
      transactions.push({
        accountKey: "chequing",
        date: formatDate(sabespDate),
        payeeName: "Sabesp",
        categoryPath: "Contas & Serviços > Água e Esgoto",
        amount: -randomBetween(rand, 90, 130),
        description: "Conta de Água e Saneamento Sabesp",
        ...clearedStatus,
      });
    }

    // Internet Fibra (Vivo Fibra 500 Mega)
    const vivoDate = getMonthDate(year, month, 18);
    if (vivoDate <= referenceDate && vivoDate >= startDate) {
      transactions.push({
        accountKey: "chequing",
        date: formatDate(vivoDate),
        payeeName: "Vivo Fibra",
        categoryPath: "Contas & Serviços > Internet Fibra",
        amount: -149.9,
        description: "Vivo Fibra 500 Mbps",
        ...clearedStatus,
      });
    }

    // Gás Encanado (Comgás)
    const gasDate = getMonthDate(year, month, 22);
    if (gasDate <= referenceDate && gasDate >= startDate) {
      transactions.push({
        accountKey: "chequing",
        date: formatDate(gasDate),
        payeeName: "Comgás",
        categoryPath: "Contas & Serviços > Gás Encanado",
        amount: -randomBetween(rand, 55, 85),
        description: "Consumo de Gás Encanado Comgás",
        ...clearedStatus,
      });
    }

    // === PAGAMENTO DE FATURA NUBANK (Transferência Conta Corrente -> Cartão Nubank) ===
    const nubankInvoiceDate = getMonthDate(year, month, 25);
    if (nubankInvoiceDate <= referenceDate && nubankInvoiceDate >= startDate) {
      const invoiceAmt = randomBetween(rand, 1800, 2600);
      transactions.push({
        accountKey: "chequing",
        date: formatDate(nubankInvoiceDate),
        payeeName: "Transfer",
        categoryPath: "Salário",
        amount: -invoiceAmt,
        description: "Pagamento de Fatura Nubank Ultravioleta",
        isTransfer: true,
        transferAccountKey: "visa",
        ...clearedStatus,
      });
    }

    // === PAGAMENTO DE FATURA ITAÚ (Transferência Conta Corrente -> Cartão Itaú) ===
    const itauInvoiceDate = getMonthDate(year, month, 10);
    if (itauInvoiceDate <= referenceDate && itauInvoiceDate >= startDate) {
      const itauAmt = randomBetween(rand, 380, 650);
      transactions.push({
        accountKey: "chequing",
        date: formatDate(itauInvoiceDate),
        payeeName: "Transfer",
        categoryPath: "Salário",
        amount: -itauAmt,
        description: "Pagamento Fatura Itaú Click Visa",
        isTransfer: true,
        transferAccountKey: "mastercard",
        ...clearedStatus,
      });
    }

    // === APORTE MENSAL EM INVESTIMENTOS (Transferência Conta Corrente -> XP Cash) ===
    const investDate = getMonthDate(year, month, 8);
    if (investDate <= referenceDate && investDate >= startDate) {
      const investAmt = randomBetween(rand, 1200, 2200);
      transactions.push({
        accountKey: "chequing",
        date: formatDate(investDate),
        payeeName: "Transfer",
        categoryPath: "Salário",
        amount: -investAmt,
        description: "Aporte Mensal XP Investimentos - Pix",
        isTransfer: true,
        transferAccountKey: "rrsp_cash",
        ...clearedStatus,
      });
    }

    // === PROVENTOS / DIVIDENDOS MENSAIS DE FIIs (CSHG Logística e Kinea) ===
    const divFiiDate = getMonthDate(year, month, 15);
    if (divFiiDate <= referenceDate && divFiiDate >= startDate) {
      transactions.push({
        accountKey: "chequing",
        date: formatDate(divFiiDate),
        payeeName: "XP Investimentos",
        categoryPath: "Rendimentos & Dividendos",
        amount: 146.0,
        description: "Rendimento FII (HGLG11 R$ 66,00 + KNIP11 R$ 80,00)",
        ...clearedStatus,
      });
    }

    // === PROVENTOS TRIMESTRAIS (Dividendos/JCP Petrobras e Itaú em meses 1, 4, 7, 10) ===
    if (month % 3 === 1) {
      const divAcoesDate = getMonthDate(year, month, 20);
      if (divAcoesDate <= referenceDate && divAcoesDate >= startDate) {
        transactions.push({
          accountKey: "chequing",
          date: formatDate(divAcoesDate),
          payeeName: "XP Investimentos",
          categoryPath: "Rendimentos & Dividendos",
          amount: randomBetween(rand, 210, 360),
          description: "Dividendos / JCP Trimestral (PETR4 / ITUB4)",
          ...clearedStatus,
        });
      }
    }

    // === ASSINATURAS NO CARTÃO DE CRÉDITO NUBANK ===
    // Academia Smart Fit (dia 01)
    const smartFitDate = getMonthDate(year, month, 1);
    if (smartFitDate <= referenceDate && smartFitDate >= startDate) {
      transactions.push({
        accountKey: "visa",
        date: formatDate(smartFitDate),
        payeeName: "Smart Fit",
        categoryPath: "Saúde > Academia",
        amount: -119.9,
        description: "Mensalidade Plano Black Smart Fit",
        ...clearedStatus,
      });
    }

    // Netflix Premium (dia 22)
    const netflixDate = getMonthDate(year, month, 22);
    if (netflixDate <= referenceDate && netflixDate >= startDate) {
      transactions.push({
        accountKey: "visa",
        date: formatDate(netflixDate),
        payeeName: "Netflix Brasil",
        categoryPath: "Lazer & Entretenimento > Streaming",
        amount: -55.9,
        description: "Assinatura Netflix Premium 4K",
        ...clearedStatus,
      });
    }

    // Spotify Família (dia 10)
    const spotifyDate = getMonthDate(year, month, 10);
    if (spotifyDate <= referenceDate && spotifyDate >= startDate) {
      transactions.push({
        accountKey: "visa",
        date: formatDate(spotifyDate),
        payeeName: "Spotify Brasil",
        categoryPath: "Lazer & Entretenimento > Streaming",
        amount: -34.9,
        description: "Spotify Premium Família",
        ...clearedStatus,
      });
    }

    // Plano de Celular Claro Controle (dia 20)
    const claroDate = getMonthDate(year, month, 20);
    if (claroDate <= referenceDate && claroDate >= startDate) {
      transactions.push({
        accountKey: "visa",
        date: formatDate(claroDate),
        payeeName: "Claro Brasil",
        categoryPath: "Contas & Serviços > Telefonia Celular",
        amount: -59.9,
        description: "Plano Móvel Claro Controle 25GB",
        ...clearedStatus,
      });
    }

    // === ALIMENTAÇÃO - SUPERMERCADO (4x por mês, semanal) ===
    const superDays = [3, 11, 19, 26];
    for (const sDay of superDays) {
      const groceryDate = getMonthDate(year, month, sDay);
      if (groceryDate <= referenceDate && groceryDate >= startDate) {
        const storeIndex = Math.floor(rand() * 3);
        const store = ["Pão de Açúcar", "Carrefour", "Atacadão"][storeIndex];
        const isAtacadao = store === "Atacadão";
        const amt = isAtacadao
          ? randomBetween(rand, 450, 720)
          : randomBetween(rand, 320, 560);

        if (isAtacadao) {
          // Split no Atacadão: alimentos + itens de limpeza/casa
          const foodAmt = Math.round(amt * 0.75 * 100) / 100;
          const houseAmt = Math.round((amt - foodAmt) * 100) / 100;
          transactions.push({
            accountKey: "visa",
            date: formatDate(groceryDate),
            payeeName: store,
            categoryPath: "Alimentação > Supermercado",
            amount: -amt,
            description: "Compras de Mês e Limpeza - Atacadão",
            isSplit: true,
            splits: [
              {
                categoryPath: "Alimentação > Supermercado",
                amount: -foodAmt,
                memo: "Alimentos e Hortifrúti",
              },
              {
                categoryPath: "Compras > Artigos para Casa",
                amount: -houseAmt,
                memo: "Produtos de Limpeza e Utilidades",
              },
            ],
            ...clearedStatus,
          });
        } else {
          transactions.push({
            accountKey: "visa",
            date: formatDate(groceryDate),
            payeeName: store,
            categoryPath: "Alimentação > Supermercado",
            amount: -amt,
            description: `Compras de Supermercado - ${store}`,
            ...clearedStatus,
          });
        }
      }
    }

    // === PADARIA BELLA PAULISTA (Fins de semana: dias 6, 13, 20, 27) ===
    const bakeryDays = [6, 13, 20, 27];
    for (const bDay of bakeryDays) {
      const bDate = getMonthDate(year, month, bDay);
      if (bDate <= referenceDate && bDate >= startDate) {
        transactions.push({
          accountKey: "chequing", // Débito / Pix na padaria
          date: formatDate(bDate),
          payeeName: "Padaria Bella Paulista",
          categoryPath: "Alimentação > Padaria e Lanches",
          amount: -randomBetween(rand, 32, 78),
          description: "Café da manhã e pães artesanais",
          ...clearedStatus,
        });
      }
    }

    // === DELIVERY IFOOD (Fins de semana: dias 4, 12, 21, 28) ===
    const ifoodDays = [4, 12, 21, 28];
    for (const iDay of ifoodDays) {
      const ifoodDate = getMonthDate(year, month, iDay);
      if (ifoodDate <= referenceDate && ifoodDate >= startDate) {
        transactions.push({
          accountKey: "visa",
          date: formatDate(ifoodDate),
          payeeName: "iFood",
          categoryPath: "Alimentação > Delivery & iFood",
          amount: -randomBetween(rand, 48, 125),
          description: "Delivery no jantar - iFood",
          ...clearedStatus,
        });
      }
    }

    // === RESTAURANTES E BARES (dias 8 e 23) ===
    const dineDays = [8, 23];
    for (const dDay of dineDays) {
      const dDate = getMonthDate(year, month, dDay);
      if (dDate <= referenceDate && dDate >= startDate) {
        const place = rand() > 0.4 ? "Outback Steakhouse" : "McDonald's Brasil";
        const amt =
          place === "Outback Steakhouse"
            ? randomBetween(rand, 140, 260)
            : randomBetween(rand, 42, 85);
        transactions.push({
          accountKey: "visa",
          date: formatDate(dDate),
          payeeName: place,
          categoryPath: "Alimentação > Restaurantes e Bares",
          amount: -amt,
          description: `Jantar fora - ${place}`,
          ...clearedStatus,
        });
      }
    }

    // === TRANSPORTE - COMBUSTÍVEL (Posto Ipiranga ou Posto Shell nos dias 7 e 21) ===
    const gasDays = [7, 21];
    for (const gDay of gasDays) {
      const gDate = getMonthDate(year, month, gDay);
      if (gDate <= referenceDate && gDate >= startDate) {
        const station = rand() > 0.5 ? "Posto Ipiranga" : "Posto Shell";
        transactions.push({
          accountKey: "visa",
          date: formatDate(gDate),
          payeeName: station,
          categoryPath: "Transporte > Combustível",
          amount: -randomBetween(rand, 190, 270),
          description: "Abastecimento Gasolina Aditivada",
          ...clearedStatus,
        });
      }
    }

    // === UBER (dias 2, 9, 16, 24) ===
    const uberDays = [2, 9, 16, 24];
    for (const uDay of uberDays) {
      const uDate = getMonthDate(year, month, uDay);
      if (uDate <= referenceDate && uDate >= startDate) {
        transactions.push({
          accountKey: "visa",
          date: formatDate(uDate),
          payeeName: "Uber Brasil",
          categoryPath: "Transporte > Uber & 99",
          amount: -randomBetween(rand, 19, 44),
          description: "Corrida Uber Comfort na cidade",
          ...clearedStatus,
        });
      }
    }

    // IPVA em Janeiro (month === 0)
    if (month === 0) {
      const ipvaDate = getMonthDate(year, month, 16);
      if (ipvaDate <= referenceDate && ipvaDate >= startDate) {
        transactions.push({
          accountKey: "chequing",
          date: formatDate(ipvaDate),
          payeeName: "Sem Parar",
          categoryPath: "Transporte > IPVA e Licenciamento",
          amount: -1650.0,
          description: "IPVA Cota Única com 3% de Desconto",
          ...clearedStatus,
        });
      }
    }

    // Seguro do Carro em Março (month === 2)
    if (month === 2) {
      const seguroDate = getMonthDate(year, month, 24);
      if (seguroDate <= referenceDate && seguroDate >= startDate) {
        transactions.push({
          accountKey: "mastercard", // Cartão Itaú
          date: formatDate(seguroDate),
          payeeName: "Porto Seguro Seguros",
          categoryPath: "Transporte > Seguro Automotivo",
          amount: -2400.0,
          description: "Renovação Anual Seguro Automotivo Porto Seguro",
          ...clearedStatus,
        });
      }
    }

    // === FARMÁCIA (Drogasil ou Droga Raia no dia 17) ===
    const pharmaDate = getMonthDate(year, month, 17);
    if (pharmaDate <= referenceDate && pharmaDate >= startDate) {
      const pharmacy = rand() > 0.5 ? "Drogasil" : "Droga Raia";
      transactions.push({
        accountKey: "visa",
        date: formatDate(pharmaDate),
        payeeName: pharmacy,
        categoryPath: "Saúde > Farmácia e Medicamentos",
        amount: -randomBetween(rand, 45, 165),
        description: `Medicamentos e Higiene - ${pharmacy}`,
        ...clearedStatus,
      });
    }

    // === E-COMMERCE / COMPRAS (Mercado Livre, Amazon, Magalu nos dias 14 e 25) ===
    const shopDays = [14, 25];
    for (const shDay of shopDays) {
      const shDate = getMonthDate(year, month, shDay);
      if (shDate <= referenceDate && shDate >= startDate) {
        const shStore = [
          {
            name: "Mercado Livre",
            cat: "Compras > Roupas e Calçados",
            desc: "Compra de Vestuário Mercado Livre",
          },
          {
            name: "Amazon Brasil",
            cat: "Compras > Eletrônicos e Informática",
            desc: "Cabos e periféricos Amazon Prime",
          },
          {
            name: "Magazine Luiza",
            cat: "Compras > Artigos para Casa",
            desc: "Itens para casa Magazine Luiza",
          },
        ][Math.floor(rand() * 3)];

        transactions.push({
          accountKey: rand() > 0.3 ? "visa" : "mastercard",
          date: formatDate(shDate),
          payeeName: shStore.name,
          categoryPath: shStore.cat,
          amount: -randomBetween(rand, 65, 290),
          description: shStore.desc,
          ...clearedStatus,
        });
      }
    }

    // === PIX PARA AMIGOS (Divisão de almoço/churrasco 2x ao mês nos dias 10 e 24) ===
    const pixDays = [10, 24];
    for (const pDay of pixDays) {
      const pDate = getMonthDate(year, month, pDay);
      if (pDate <= referenceDate && pDate >= startDate) {
        transactions.push({
          accountKey: "chequing",
          date: formatDate(pDate),
          payeeName: "Transfer",
          categoryPath: "Alimentação > Restaurantes e Bares",
          amount: -randomBetween(rand, 35, 85),
          description: "Pix para amigos - Divisão de conta de restaurante",
          ...clearedStatus,
        });
      }
    }
  }

  // Adiciona transações da carteira Bitcoin (em BRL)
  transactions.push(...bitcoinWalletTransactionsPtBr(referenceDate));

  // Ordena por data
  transactions.sort((a, b) => a.date.localeCompare(b.date));

  return transactions;
}

/**
 * Transações da carteira Bitcoin adaptadas para o padrão brasileiro (BRL):
 * - Compra de Bitcoin via Pix da Conta Corrente (R$ 7.000,00)
 * - Café pago em satoshis
 * - Venda parcial com taxa de rede
 */
function bitcoinWalletTransactionsPtBr(referenceDate: Date): DemoTransaction[] {
  const bought = daysBefore(referenceDate, 60);
  const spent = daysBefore(referenceDate, 40);
  const sold = daysBefore(referenceDate, 10);

  return [
    {
      accountKey: "chequing",
      date: formatDate(bought),
      payeeName: "Transfer",
      categoryPath: "",
      amount: -7000.0,
      description: "Compra de Bitcoin via Pix",
      status: statusFor(bought, referenceDate),
      isTransfer: true,
      transferAccountKey: "crypto",
      transferToAmount: 0.0125,
    },
    {
      accountKey: "crypto",
      date: formatDate(spent),
      payeeName: "Starbucks Brasil",
      categoryPath: "Alimentação > Padaria e Lanches",
      amount: -0.000045,
      description: "Café expresso pago com satoshis (Lightning Network)",
      status: statusFor(spent, referenceDate),
    },
    {
      accountKey: "crypto",
      date: formatDate(sold),
      payeeName: "Transfer",
      categoryPath: "",
      amount: -0.005025,
      description: "Venda parcial de Bitcoin",
      status: statusFor(sold, referenceDate),
      isSplit: true,
      splits: [
        {
          transferAccountKey: "chequing",
          amount: -0.005,
          memo: "Crédito da venda em Conta Corrente",
          transferTargetAmount: 2850.0,
        },
        {
          categoryPath: "Taxas > Taxa de Rede",
          amount: -0.000025,
          memo: "Taxa de rede mineradora (blockchain)",
        },
      ],
    },
  ];
}
