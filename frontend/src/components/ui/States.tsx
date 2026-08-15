import type { ReactNode } from 'react';
import { Inbox, RotateCcw, TriangleAlert } from 'lucide-react';

export const LoadingState = ({ label = 'Carregando...' }: { label?: string }) => (
  <div className="ui-state" role="status" aria-live="polite">
    <span className="ui-spinner" aria-hidden="true" />
    <p className="ui-state__text">{label}</p>
  </div>
);

export type EmptyStateProps = {
  title?: string;
  children: ReactNode;
  icon?: ReactNode;
  /** `plain` drops the border for empty states already nested inside a card. */
  variant?: 'card' | 'plain';
  action?: ReactNode;
};

export const EmptyState = ({ title, children, icon, variant = 'card', action }: EmptyStateProps) => (
  <div className={`ui-state${variant === 'plain' ? ' ui-state--plain' : ''}`}>
    <span className="ui-state__icon" aria-hidden="true">
      {icon ?? <Inbox size={28} strokeWidth={1.6} />}
    </span>
    {title && <h3 className="ui-state__title">{title}</h3>}
    <p className="ui-state__text">{children}</p>
    {action}
  </div>
);

export type ErrorStateProps = {
  title?: string;
  message: string;
  onRetry?: () => void;
};

/**
 * Distinct from EmptyState on purpose: a failed query must never look like
 * "there is no data", which is what silently swallowing the error produced.
 */
export const ErrorState = ({ title = 'Não foi possível carregar', message, onRetry }: ErrorStateProps) => (
  <div className="ui-state ui-state--error" role="alert">
    <span className="ui-state__icon" aria-hidden="true">
      <TriangleAlert size={28} strokeWidth={1.6} />
    </span>
    <h3 className="ui-state__title">{title}</h3>
    <p className="ui-state__text">{message}</p>
    {onRetry && (
      <button type="button" className="btn btn-secondary" onClick={onRetry}>
        <RotateCcw size={16} strokeWidth={1.9} aria-hidden="true" />
        Tentar novamente
      </button>
    )}
  </div>
);
