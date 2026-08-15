import type { ReactNode } from 'react';
import { CircleCheck, Info, TriangleAlert } from 'lucide-react';

export type CalloutTone = 'info' | 'warning' | 'danger' | 'success';

export type CalloutProps = {
  tone?: CalloutTone;
  title?: string;
  children: ReactNode;
  /** Secondary line separated by a dashed rule — the "what to do next" hint. */
  hint?: ReactNode;
  showIcon?: boolean;
};

const ICONS: Record<CalloutTone, typeof Info> = {
  info: Info,
  warning: TriangleAlert,
  danger: TriangleAlert,
  success: CircleCheck,
};

/** The single inline-message shape for the app: info, warning, danger, success. */
export const Callout = ({ tone = 'info', title, children, hint, showIcon = true }: CalloutProps) => {
  const Icon = ICONS[tone];

  return (
    <div className={`ui-callout ui-callout--${tone}`}>
      {showIcon && <Icon className="ui-callout__icon" size={20} strokeWidth={1.9} aria-hidden="true" />}
      <div className="ui-callout__content">
        {title && <strong className="ui-callout__title">{title}</strong>}
        {children}
        {hint && <div className="ui-callout__hint">{hint}</div>}
      </div>
    </div>
  );
};
