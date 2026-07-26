import {
  CalendarDays,
  ChartNoAxesColumnIncreasing,
  CircleDot,
  CircleStop,
  ClipboardCopy,
  FilePenLine,
  LockKeyhole,
  Pencil,
  Play,
  RotateCcw,
  Trash2,
} from 'lucide-react';

export type CycleStatus = 'RASCUNHO' | 'ABERTO' | 'FECHADO' | 'REABERTO';

export type CycleCardData = {
  id: string;
  nome: string;
  mes: number;
  ano: number;
  data_inicio: string;
  data_fim: string;
  status: CycleStatus;
  created_at: string;
};

export type CycleCardProps = {
  ciclo: CycleCardData;
  onEdit: (cycle: CycleCardData) => void;
  onDelete: (cycle: CycleCardData) => void;
  onCloneBudget: (cycleId: string) => void;
  onOpen: (cycleId: string) => void;
  onClose: (cycleId: string) => void;
  onReopen: (cycleId: string) => void;
};

const formatDate = (value: string) => new Date(value).toLocaleDateString('pt-BR');

const getStatusIcon = (status: CycleStatus) => {
  const iconProps = { size: 18, strokeWidth: 1.8, 'aria-hidden': true };

  switch (status) {
    case 'ABERTO':
      return <CircleDot {...iconProps} />;
    case 'REABERTO':
      return <RotateCcw {...iconProps} />;
    case 'FECHADO':
      return <LockKeyhole {...iconProps} />;
    default:
      return <FilePenLine {...iconProps} />;
  }
};

const getActionIcon = (status: CycleStatus) => {
  const iconProps = { size: 16, strokeWidth: 1.9, 'aria-hidden': true };

  switch (status) {
    case 'RASCUNHO':
      return <Play {...iconProps} />;
    case 'FECHADO':
      return <RotateCcw {...iconProps} />;
    default:
      return <CircleStop {...iconProps} />;
  }
};

export const CycleCard = ({
  ciclo,
  onEdit,
  onDelete,
  onCloneBudget,
  onOpen,
  onClose,
  onReopen,
}: CycleCardProps) => {
  const isDraft = ciclo.status === 'RASCUNHO';
  const isClosed = ciclo.status === 'FECHADO';
  const actionClass = isDraft
    ? 'cycle-card__primary cycle-action--success'
    : isClosed
      ? 'cycle-card__primary cycle-action--warning'
      : 'cycle-card__primary cycle-action--danger';

  return (
    <article className={`blueprint card cycle-card cycle-card--${ciclo.status.toLowerCase()}`}>
      <i className="corner tl" aria-hidden="true" />
      <i className="corner tr" aria-hidden="true" />
      <i className="corner bl" aria-hidden="true" />
      <i className="corner br" aria-hidden="true" />

      <header className="cycle-card__header">
        <div className="cycle-card__title-group">
          <span className="cycle-card__status-icon" aria-hidden="true">
            {getStatusIcon(ciclo.status)}
          </span>
          <h3 className="cycle-card__title" title={ciclo.nome}>{ciclo.nome}</h3>
        </div>
        <span className={`tag cycle-status cycle-status--${ciclo.status.toLowerCase()}`}>
          {ciclo.status}
        </span>
      </header>

      <div className="cycle-card__body">
        <div className="cycle-card__meta-row">
          <CalendarDays className="cycle-card__meta-icon" size={18} strokeWidth={1.8} aria-hidden="true" />
          <div className="cycle-card__meta-content">
            <span className="cycle-card__meta-label">Vigência</span>
            <strong className="cycle-card__meta-value">
              {formatDate(ciclo.data_inicio)} a {formatDate(ciclo.data_fim)}
            </strong>
          </div>
        </div>
        <div className="cycle-card__meta-row">
          <ChartNoAxesColumnIncreasing className="cycle-card__meta-icon" size={18} strokeWidth={1.8} aria-hidden="true" />
          <div className="cycle-card__meta-content">
            <span className="cycle-card__meta-label">Competência</span>
            <strong className="cycle-card__meta-value">Mês {ciclo.mes} / {ciclo.ano}</strong>
          </div>
        </div>
      </div>

      <footer className="cycle-card__footer">
        <div className="cycle-card__secondary-actions" role="group" aria-label={`Ações secundárias para ${ciclo.nome}`}>
          {!isClosed && (
            <button
              className="btn btn-ghost cycle-card__secondary-action"
              type="button"
              onClick={() => onEdit(ciclo)}
              aria-label={`Editar ${ciclo.nome}`}
            >
              <Pencil size={14} strokeWidth={2} aria-hidden="true" />
              Editar
            </button>
          )}
          {isDraft && (
            <button
              className="btn btn-ghost cycle-card__secondary-action cycle-card__secondary-action--danger"
              type="button"
              onClick={() => onDelete(ciclo)}
              aria-label={`Excluir ${ciclo.nome}`}
            >
              <Trash2 size={14} strokeWidth={2} aria-hidden="true" />
              Excluir
            </button>
          )}
        </div>

        <div className="cycle-card__primary-actions">
          {isDraft && (
            <button
              className="btn btn-secondary cycle-card__secondary-cta"
              type="button"
              onClick={() => onCloneBudget(ciclo.id)}
            >
              <ClipboardCopy size={16} strokeWidth={1.9} aria-hidden="true" />
              Clonar regras
            </button>
          )}

          {isDraft && (
            <button className={`btn ${actionClass}`} type="button" onClick={() => onOpen(ciclo.id)}>
              {getActionIcon(ciclo.status)}
              Abrir ciclo
            </button>
          )}

          {(ciclo.status === 'ABERTO' || ciclo.status === 'REABERTO') && (
            <button className={`btn ${actionClass}`} type="button" onClick={() => onClose(ciclo.id)}>
              {getActionIcon(ciclo.status)}
              Encerrar ciclo
            </button>
          )}

          {isClosed && (
            <button className={`btn ${actionClass}`} type="button" onClick={() => onReopen(ciclo.id)}>
              {getActionIcon(ciclo.status)}
              Reabrir ciclo
            </button>
          )}
        </div>
      </footer>
    </article>
  );
};
