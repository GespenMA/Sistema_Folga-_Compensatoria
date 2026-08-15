export type CycleStatus = 'RASCUNHO' | 'ABERTO' | 'FECHADO' | 'REABERTO';
export type SolicitacaoStatus = 'SOLICITADA' | 'APROVADA' | 'REJEITADA' | 'CANCELADA';
export type TipoSolicitacao = 'FOLGA' | 'PLANTAO_PLUS';

export type Position = {
  id: string;
  nome: string;
  codigo: string;
};

export type EmployeeRef = {
  id: string;
  nome: string;
  matricula: string;
  positions: Position;
};

export type ActiveCycle = {
  id: string;
  nome: string;
  data_inicio: string;
  data_fim: string;
  status: CycleStatus;
};

export type FolgaDisponivel = {
  id: string;
  periodo_inicio: string;
  periodo_fim: string;
  quantidade_plantoes: number;
  status: string;
  employees: EmployeeRef;
};

export type FolgaUsufruida = {
  id: string;
  used_at: string | null;
  quantidade_plantoes: number;
  status: string;
  employees: EmployeeRef;
};

export type Solicitacao = {
  id: string;
  valor: number;
  status: SolicitacaoStatus;
  justificativa: string;
  requested_at: string;
  tipo_solicitacao: TipoSolicitacao;
  data_plantao: string | null;
  compensatory_day_id: string | null;
  compensatory_days: { quantidade_plantoes: number } | null;
  employees: Pick<EmployeeRef, 'nome' | 'matricula'> & { positions: Position };
};

export type Budget = {
  orcado: number;
  aprovado: number;
  empenhado: number;
  /** orçado − aprovado: the ceiling for APPROVING a pending request. */
  disponivelParaAprovacao: number;
  /** orçado − aprovado − empenhado: the ceiling for CREATING a new request. */
  disponivelParaLancamento: number;
};

export type ActionResult =
  | { ok: true }
  | { ok: false; message: string; details?: string[] };

/** Position id → current unit price, used to price cards before opening the modal. */
export type PositionValues = Record<string, number>;
