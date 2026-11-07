import { DemoPayee } from "../demo-seed-data/payees";

/**
 * Beneficiários e estabelecimentos reais brasileiros.
 * Endereços e telefones com formato válido (E.164 no Brasil: +55...).
 * URLs HTTPS com host real para resolução de favicon/marca.
 */
export const demoPayeesPtBr: DemoPayee[] = [
  // Renda / Receitas
  {
    name: "TechSolutions Brasil Ltda",
    categoryPath: "Salário",
    address: "R. Funchal, 418, Vila Olímpia, São Paulo, SP, 04551-060",
    phone: "+551135201200",
  },
  {
    name: "Cliente Freelance - Consultoria PJ",
    categoryPath: "Freelance & PJ",
  },

  // Moradia & Financiamento
  {
    name: "Caixa Habitação",
    categoryPath: "Moradia > Juros de Financiamento",
    website: "https://www.caixa.gov.br",
    address: "SBS Quadra 4 Lotes 3/4, Asa Sul, Brasília, DF, 70092-900",
    phone: "+558007260101",
  },
  {
    name: "Condomínio Edifício Mirante",
    categoryPath: "Moradia > Aluguel / Condomínio",
    address: "R. Bela Cintra, 1100, Consolação, São Paulo, SP, 01415-000",
    phone: "+551132551020",
  },
  {
    name: "Prefeitura de São Paulo - IPTU",
    categoryPath: "Moradia > IPTU",
    website: "https://prefeitura.sp.gov.br",
    address: "Viaduto do Chá, 15, Centro Histórico, São Paulo, SP, 01002-020",
  },
  {
    name: "Leroy Merlin",
    categoryPath: "Moradia > Manutenção e Reformas",
    website: "https://www.leroymerlin.com.br",
    address: "Av. Marginal Direita do Tietê, 1114, Jaguaré, São Paulo, SP, 05322-000",
    phone: "+551140071380",
  },

  // Contas & Serviços
  {
    name: "Enel Distribuição SP",
    categoryPath: "Contas & Serviços > Energia Elétrica",
    website: "https://www.enel.com.br",
    address: "R. Lourenço Marques, 158, Vila Olímpia, São Paulo, SP, 04547-100",
    phone: "+558007272120",
  },
  {
    name: "Sabesp",
    categoryPath: "Contas & Serviços > Água e Esgoto",
    website: "https://www.sabesp.com.br",
    address: "R. Costa Carvalho, 300, Pinheiros, São Paulo, SP, 05429-900",
    phone: "+558000119911",
  },
  {
    name: "Comgás",
    categoryPath: "Contas & Serviços > Gás Encanado",
    website: "https://www.comgas.com.br",
    address: "R. Treze de Maio, 1642, Bela Vista, São Paulo, SP, 01327-002",
    phone: "+558000110197",
  },
  {
    name: "Vivo Fibra",
    categoryPath: "Contas & Serviços > Internet Fibra",
    website: "https://www.vivo.com.br",
    address: "Av. Engenheiro Luís Carlos Berrini, 1376, Cidade Monções, São Paulo, SP, 04571-000",
    phone: "+558000101515",
  },
  {
    name: "Claro Brasil",
    categoryPath: "Contas & Serviços > Telefonia Celular",
    website: "https://www.claro.com.br",
    address: "R. Henri Dunant, 780, Santo Amaro, São Paulo, SP, 04709-110",
    phone: "+558007010180",
  },

  // Alimentação
  {
    name: "Pão de Açúcar",
    categoryPath: "Alimentação > Supermercado",
    website: "https://www.paodeacucar.com",
    address: "Av. Brigadeiro Luís Antônio, 2014, Bela Vista, São Paulo, SP, 01318-002",
    phone: "+551138860400",
  },
  {
    name: "Carrefour",
    categoryPath: "Alimentação > Supermercado",
    website: "https://www.carrefour.com.br",
    address: "Av. das Nações Unidas, 15187, Chácara Santo Antônio, São Paulo, SP, 04794-000",
    phone: "+551137796000",
  },
  {
    name: "Atacadão",
    categoryPath: "Alimentação > Supermercado",
    website: "https://www.atacadao.com.br",
    address: "Av. Morvan Dias de Figueiredo, 6169, Vila Maria, São Paulo, SP, 02170-901",
    phone: "+551129679000",
  },
  {
    name: "iFood",
    categoryPath: "Alimentação > Delivery & iFood",
    website: "https://www.ifood.com.br",
    address: "Av. dos Autonomistas, 1496, Vila Yara, Osasco, SP, 06020-010",
    phone: "+551130038131",
  },
  {
    name: "Outback Steakhouse",
    categoryPath: "Alimentação > Restaurantes e Bares",
    website: "https://www.outback.com.br",
    address: "Shopping Center Norte, Tv. Casalbuono, 120, Vila Guilherme, São Paulo, SP, 02089-900",
    phone: "+551122214345",
  },
  {
    name: "McDonald's Brasil",
    categoryPath: "Alimentação > Restaurantes e Bares",
    website: "https://www.mcdonalds.com.br",
    address: "Alameda Amazonas, 253, Alphaville Industrial, Barueri, SP, 06454-070",
  },
  {
    name: "Padaria Bella Paulista",
    categoryPath: "Alimentação > Padaria e Lanches",
    website: "https://bellapaulista.com.br",
    address: "R. Haddock Lobo, 354, Cerqueira César, São Paulo, SP, 01414-000",
    phone: "+551132148345",
  },
  {
    name: "Starbucks Brasil",
    categoryPath: "Alimentação > Padaria e Lanches",
    website: "https://www.starbucks.com.br",
    address: "Av. Paulista, 1000, Bela Vista, São Paulo, SP, 01310-100",
  },

  // Transporte
  {
    name: "Posto Ipiranga",
    categoryPath: "Transporte > Combustível",
    website: "https://www.ipiranga.com.br",
    address: "Av. Rebouças, 1200, Pinheiros, São Paulo, SP, 05402-000",
  },
  {
    name: "Posto Shell",
    categoryPath: "Transporte > Combustível",
    website: "https://www.shell.com.br",
    address: "Av. Brigadeiro Faria Lima, 2229, Jardim Paulistano, São Paulo, SP, 01452-000",
  },
  {
    name: "Uber Brasil",
    categoryPath: "Transporte > Uber & 99",
    website: "https://www.uber.com",
    address: "Av. Pres. Juscelino Kubitschek, 1909, Vila Olímpia, São Paulo, SP, 04543-907",
  },
  {
    name: "99 App",
    categoryPath: "Transporte > Uber & 99",
    website: "https://99app.com",
    address: "Av. Guido Caloi, 1000, Jardim São Luís, São Paulo, SP, 05802-140",
  },
  {
    name: "Sem Parar",
    categoryPath: "Transporte > IPVA e Licenciamento",
    website: "https://www.semparar.com.br",
    address: "Av. Marcos Penteado de Ulhôa Rodrigues, 939, Barueri, SP, 06460-040",
    phone: "+551140030111",
  },
  {
    name: "Porto Seguro Seguros",
    categoryPath: "Transporte > Seguro Automotivo",
    website: "https://www.portoseguro.com.br",
    address: "Av. Rio Branco, 1489, Campos Elíseos, São Paulo, SP, 01205-001",
    phone: "+551133376786",
  },

  // Saúde
  {
    name: "Smart Fit",
    categoryPath: "Saúde > Academia",
    website: "https://www.smartfit.com.br",
    address: "Av. Paulista, 664, Bela Vista, São Paulo, SP, 01310-100",
    phone: "+551130030045",
  },
  {
    name: "Drogasil",
    categoryPath: "Saúde > Farmácia e Medicamentos",
    website: "https://www.drogasil.com.br",
    address: "Av. Corifeu de Azevedo Marques, 3097, Vila Lageado, São Paulo, SP, 05339-900",
    phone: "+551130048007",
  },
  {
    name: "Droga Raia",
    categoryPath: "Saúde > Farmácia e Medicamentos",
    website: "https://www.drogaraia.com.br",
    address: "R. da Consolação, 2333, Consolação, São Paulo, SP, 01301-100",
    phone: "+551131238000",
  },
  {
    name: "Bradesco Saúde",
    categoryPath: "Saúde > Plano de Saúde",
    website: "https://www.bradescoseguros.com.br",
    address: "Av. Alphaville, 779, Empresarial 18 do Forte, Barueri, SP, 06472-900",
    phone: "+558007279966",
  },

  // Lazer & Streaming
  {
    name: "Netflix Brasil",
    categoryPath: "Lazer & Entretenimento > Streaming",
    website: "https://www.netflix.com",
    address: "Alameda Xingu, 512, Alphaville Centro Industrial, Barueri, SP, 06455-030",
  },
  {
    name: "Spotify Brasil",
    categoryPath: "Lazer & Entretenimento > Streaming",
    website: "https://www.spotify.com",
    address: "R. Pequetita, 145, Vila Olímpia, São Paulo, SP, 04552-060",
  },
  {
    name: "Cinemark Brasil",
    categoryPath: "Lazer & Entretenimento > Cinema, Shows e Teatro",
    website: "https://www.cinemark.com.br",
    address: "R. Olimpíadas, 360, Vila Olímpia, São Paulo, SP, 04551-000",
    phone: "+551138477700",
  },

  // Compras & E-commerce
  {
    name: "Mercado Livre",
    categoryPath: "Compras > Roupas e Calçados",
    website: "https://www.mercadolivre.com.br",
    address: "Av. das Nações Unidas, 3003, Bonfim, Osasco, SP, 06233-903",
    phone: "+551130030999",
  },
  {
    name: "Amazon Brasil",
    categoryPath: "Compras > Eletrônicos e Informática",
    website: "https://www.amazon.com.br",
    address: "Av. Pres. Juscelino Kubitschek, 2041, Itaim Bibi, São Paulo, SP, 04543-011",
  },
  {
    name: "Magazine Luiza",
    categoryPath: "Compras > Artigos para Casa",
    website: "https://www.magazineluiza.com.br",
    address: "R. Amazonas da Silva, 27, Vila Guilherme, São Paulo, SP, 02051-000",
    phone: "+551135089900",
  },

  // Educação
  {
    name: "Alura Cursos Online",
    categoryPath: "Educação > Cursos e Certificações",
    website: "https://www.alura.com.br",
    address: "R. Vergueiro, 3185, Vila Mariana, São Paulo, SP, 04101-300",
  },

  // Investimentos
  {
    name: "XP Investimentos",
    categoryPath: "Rendimentos & Dividendos",
    website: "https://www.xpi.com.br",
    address: "Av. Chedid Jafet, 75, Vila Olímpia, São Paulo, SP, 04551-065",
    phone: "+551130035465",
  },
];
