export interface DemoCategoryItem {
  name: string;
  icon: string | null;
  color: string;
  isIncome?: boolean;
}

export interface DemoExpenseCategoryItem extends DemoCategoryItem {
  subs: string[];
}

export const incomeCategoriesPtBr: DemoCategoryItem[] = [
  { name: "Salário", icon: "💰", color: "#2ECC71", isIncome: true },
  { name: "Freelance & PJ", icon: "💼", color: "#1ABC9C", isIncome: true },
  { name: "Rendimentos & Dividendos", icon: "📈", color: "#3498DB", isIncome: true },
  { name: "Outras Receitas", icon: "💵", color: "#16A085", isIncome: true },
];

export const expenseCategoriesPtBr: DemoExpenseCategoryItem[] = [
  {
    name: "Moradia",
    icon: "🏠",
    color: "#E74C3C",
    subs: [
      "Aluguel / Condomínio",
      "Juros de Financiamento",
      "IPTU",
      "Manutenção e Reformas",
      "Móveis e Utensílios",
    ],
  },
  {
    name: "Alimentação",
    icon: "🍽️",
    color: "#E67E22",
    subs: [
      "Supermercado",
      "Restaurantes e Bares",
      "Delivery & iFood",
      "Padaria e Lanches",
    ],
  },
  {
    name: "Transporte",
    icon: "🚗",
    color: "#3498DB",
    subs: [
      "Combustível",
      "Uber & 99",
      "Seguro Automotivo",
      "IPVA e Licenciamento",
      "Manutenção do Carro",
      "Transporte Público",
    ],
  },
  {
    name: "Contas & Serviços",
    icon: "📄",
    color: "#C0392B",
    subs: [
      "Energia Elétrica",
      "Água e Esgoto",
      "Internet Fibra",
      "Telefonia Celular",
      "Gás Encanado",
    ],
  },
  {
    name: "Saúde",
    icon: "⚕️",
    color: "#27AE60",
    subs: [
      "Plano de Saúde",
      "Farmácia e Medicamentos",
      "Consultas e Exames",
      "Academia",
    ],
  },
  {
    name: "Educação",
    icon: "📚",
    color: "#2980B9",
    subs: [
      "Cursos e Certificações",
      "Livros e Material",
      "Mensalidade Escolar / Pós",
    ],
  },
  {
    name: "Lazer & Entretenimento",
    icon: "🎬",
    color: "#F39C12",
    subs: [
      "Streaming",
      "Cinema, Shows e Teatro",
      "Viagens e Hospedagem",
      "Jogos",
    ],
  },
  {
    name: "Compras",
    icon: "🛍️",
    color: "#9B59B6",
    subs: [
      "Roupas e Calçados",
      "Eletrônicos e Informática",
      "Artigos para Casa",
    ],
  },
  {
    name: "Cuidados Pessoais",
    icon: "💇",
    color: "#8E44AD",
    subs: [
      "Barbearia e Salão",
      "Cosméticos e Higiene",
    ],
  },
  {
    name: "Serviços Financeiros",
    icon: "💳",
    color: "#7F8C8D",
    subs: [
      "Tarifas Bancárias",
      "IOF e Juros",
    ],
  },
  { name: "Presentes & Doações", icon: "🎁", color: "#E91E63", subs: [] },
  { name: "Viagens", icon: "✈️", color: "#00BCD4", subs: [] },
  { name: "Diversos", icon: "📌", color: "#95A5A6", subs: [] },
  { name: "Taxas", icon: null, color: "#7F8C8D", subs: ["Taxa de Rede"] },
];
