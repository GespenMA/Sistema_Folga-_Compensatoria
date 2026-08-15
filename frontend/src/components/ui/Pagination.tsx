import { ChevronLeft, ChevronRight } from 'lucide-react';

export type PaginationProps = {
  page: number;
  totalPages: number;
  rangeStart: number;
  rangeEnd: number;
  total: number;
  /** Plural noun for the info line, e.g. "folgas" / "solicitações". */
  itemLabel: string;
  onPageChange: (page: number) => void;
};

export const Pagination = ({
  page,
  totalPages,
  rangeStart,
  rangeEnd,
  total,
  itemLabel,
  onPageChange,
}: PaginationProps) => {
  if (totalPages <= 1) return null;

  return (
    <nav className="ui-pagination" aria-label={`Paginação de ${itemLabel}`}>
      <span className="ui-pagination__info">
        Mostrando {rangeStart}–{rangeEnd} de {total} {itemLabel}
      </span>
      <div className="ui-pagination__controls">
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          disabled={page === 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft size={14} strokeWidth={2} aria-hidden="true" />
          Anterior
        </button>
        <span className="ui-pagination__page" aria-live="polite">
          {page} / {totalPages}
        </span>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          disabled={page === totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Próxima
          <ChevronRight size={14} strokeWidth={2} aria-hidden="true" />
        </button>
      </div>
    </nav>
  );
};
