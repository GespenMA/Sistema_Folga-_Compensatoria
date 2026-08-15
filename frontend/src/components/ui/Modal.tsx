import { useCallback, useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export type ModalTone = 'default' | 'danger' | 'warning' | 'success';
export type ModalSize = 'sm' | 'md' | 'lg';

export type ModalProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  actions?: ReactNode;
  /** Icon rendered to the left of the title (already sized by the caller). */
  icon?: ReactNode;
  tone?: ModalTone;
  size?: ModalSize;
  /** Set false for destructive flows where an accidental click must not discard input. */
  closeOnBackdrop?: boolean;
};

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/**
 * Body scroll is locked while at least one modal is mounted. A shared counter
 * keeps nested/stacked modals from unlocking the page too early.
 */
let lockCount = 0;

const lockBodyScroll = () => {
  lockCount += 1;
  if (lockCount === 1) document.body.style.overflow = 'hidden';
};

const unlockBodyScroll = () => {
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount === 0) document.body.style.overflow = '';
};

export const Modal = ({
  open,
  title,
  onClose,
  children,
  actions,
  icon,
  tone = 'default',
  size = 'md',
  closeOnBackdrop = true,
}: ModalProps) => {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    lockBodyScroll();
    return unlockBodyScroll;
  }, [open]);

  useEffect(() => {
    if (!open) return;
    restoreFocusRef.current = document.activeElement as HTMLElement | null;
    const node = dialogRef.current;
    const first = node?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
    (first ?? node)?.focus();

    return () => {
      restoreFocusRef.current?.focus?.();
    };
  }, [open]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;

      const focusables = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ?? [],
      ).filter((element) => element.offsetParent !== null || element === document.activeElement);

      if (focusables.length === 0) {
        event.preventDefault();
        return;
      }

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;

      if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && (active === first || active === dialogRef.current)) {
        event.preventDefault();
        last.focus();
      }
    },
    [onClose],
  );

  if (!open) return null;

  return createPortal(
    <div
      className="ui-modal-backdrop"
      onMouseDown={(event) => {
        if (closeOnBackdrop && event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className={`ui-modal ui-modal--${size}${tone === 'default' ? '' : ` ui-modal--${tone}`}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
      >
        <header className="ui-modal__header">
          {icon && <span className="ui-modal__icon" aria-hidden="true">{icon}</span>}
          <h2 className="ui-modal__title" id={titleId}>{title}</h2>
          <button type="button" className="ui-modal__close" onClick={onClose} aria-label="Fechar">
            <X size={18} strokeWidth={2} aria-hidden="true" />
          </button>
        </header>

        <div className="ui-modal__body">{children}</div>

        {actions && <footer className="ui-modal__actions">{actions}</footer>}
      </div>
    </div>,
    document.body,
  );
};
