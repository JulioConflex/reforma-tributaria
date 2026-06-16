export interface Setor {
  id: string;
  nome: string;
  tipo: "produto" | "servico";
  reducao_aliquota: number;
  is_aplicavel: boolean;
  obs: string;
  // MEI + Simples Nacional metadata
  anexo_simples?: string;           // "I" | "II" | "III" | "IV" | "V" | "FATOR_R"
  mei_permitido?: boolean;
  mei_restricao?: string | null;    // "profissao_regulamentada" | "escala_industrial" | "atividade_vedada"
  mei_conselho?: string | null;     // "CRM" | "OAB" | "CRC" etc.
}

export interface DetalheTributo {
  nome: string;
  aliquota_aplicada: number;
  valor: number;
  base_legal: string;
  formula?: string | null;
}

export interface ResultadoSistema {
  total: number;
  percentual_sobre_valor: number;
  detalhes: DetalheTributo[];
}

export interface ProjecaoAnual {
  ano: number;
  descricao: string;
  total_sistema_novo: number;
  percentual_sobre_valor: number;
  total_sistema_atual: number;
  diferenca: number;
}

export interface RecomendacaoItem {
  titulo: string;
  texto: string;
  icone: string;
  prioridade: "alta" | "media" | "baixa";
}

export interface CenarioFatorR {
  anexo: string;
  aliquota_efetiva: number;
  total: number;
  percentual_sobre_valor: number;
}

export interface FatorRInfo {
  aplicavel: boolean;
  fator_r_calculado?: number | null;
  anexo_usado: string;
  cenario_iii?: CenarioFatorR | null;
  cenario_v?: CenarioFatorR | null;
  folha_minima_para_iii?: number | null;
  mensagem: string;
}

export interface ComparativoRegime {
  regime: string;
  nome: string;
  descricao: string;
  disponivel: boolean;
  motivo_indisponivel?: string | null;
  total_atual?: number | null;
  percentual_atual?: number | null;
  total_novo?: number | null;
  percentual_novo?: number | null;
  diferenca?: number | null;
  diferenca_percentual?: number | null;
  economia_anual_estimada?: number | null;
  irpj_csll_estimado?: number | null;
}

export interface ComparadorResult {
  valor_base: number;
  setor: string;
  uf: string;
  ano: number;
  comparativo: ComparativoRegime[];
  regime_mais_vantajoso: string | null;
  regime_mais_vantajoso_nome: string | null;
  obs: string;
}

export interface IrpjCsllInfo {
  incluido_no_das: boolean;
  estimavel: boolean;
  irpj_estimado?: number | null;
  csll_estimado?: number | null;
  irpj_percentual?: number | null;
  csll_percentual?: number | null;
  adicional_irpj_possivel?: boolean;
  mensagem_leigo: string;
}

export interface PassoMemoria {
  rotulo: string;
  formula: string;
  valor: number;
}

export interface MemoriaCalculo {
  valor_operacao: number;
  regime: string;
  setor_nome: string;
  uf: string;
  ano: number;
  percentual_credito_entrada: number;
  faturamento_mensal?: number | null;
  despesas_mensais?: number | null;
  reducao_setor: number;
  aliquota_icms_uf: number;
  iss_setor: number;
  cbs_percentual: number;
  ibs_percentual: number;
  icms_fator: number;
  iss_fator: number;
  pis_cofins_ativo: boolean;
  passos_irpj_csll: PassoMemoria[];
  observacoes: string[];
}

export interface SimulacaoResult {
  valor_operacao: number;
  regime: string;
  setor_nome: string;
  ano: number;
  uf: string;
  sistema_atual: ResultadoSistema;
  sistema_novo: ResultadoSistema;
  economia_ou_acrescimo: number;
  economia_percentual: number;
  reducao_setor_aplicada: number;
  is_aplicavel: boolean;
  descricao_ano: string;
  alerta?: string;
  narrativa: string;
  recomendacoes: RecomendacaoItem[];
  projecao_2026_2033: ProjecaoAnual[];
  fator_r_info?: FatorRInfo | null;
  mei_incompativel?: boolean;
  mei_motivo?: string | null;
  irpj_csll_info?: IrpjCsllInfo | null;
  memoria_calculo?: MemoriaCalculo | null;
}

export interface MarkupResult {
  custo: number;
  margem_desejada: number;
  preco_venda_sistema_atual: number;
  preco_venda_sistema_novo: number;
  diferenca_preco: number;
  markup_atual: number;
  markup_novo: number;
  carga_tributaria_atual_percentual: number;
  carga_tributaria_nova_percentual: number;
  aliquota_efetiva_nova: number;
  obs_split_payment: string;
}

export const REGIMES = [
  { value: "lucro_presumido", label: "Lucro Presumido" },
  { value: "lucro_real", label: "Lucro Real" },
  { value: "simples_nacional", label: "Simples Nacional" },
  { value: "mei", label: "MEI" },
];

export const UFS = [
  "AC","AL","AM","AP","BA","CE","DF","ES","GO","MA",
  "MG","MS","MT","PA","PB","PE","PI","PR","RJ","RN",
  "RO","RR","RS","SC","SE","SP","TO",
];

export const API = "/api/py";
