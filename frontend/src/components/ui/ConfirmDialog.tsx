import { useEffect, useState } from 'react';
import { CircleAlert, TriangleAlert } from 'lucide-react';
import { Modal, type ModalTone } from './Modal';

export type ConfirmDialogProps = {
  open: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  tone?: Extract<ModalTone, 'default' | 'danger' | 'warning'>;
  busy?: boolean;
  /** When set, a required free-text reason is collected and passed to onConfirm. */
  reason?: {
    label: string;
    placeholder?: string;
    minLength?: number;
    maxLength?: number;
  };
  onConfirm: (reason: string) => void;
  onCancel: () => void;
};

/**
 * Replaces window.confirm and window.prompt: same decision, but focus-trapped,
 * dismissible with Esc, and able to validate the reason before it reaches the DB.
 */
export const ConfirmDialog = ({
  open,
  title,
  message,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  tone = 'default',
  busy = false,
  reason,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) => {
  const [value, setValue] = useState('');
  const minLength = reason?.minLength ?? 0;
  const maxLength = reason?.maxLength ?? 500;
  const tooShort = Boolean(reason) && value.trim().length < minLength;

  useEffect(() => {
    if (open) setValue('');
  }, [open]);

  const confirmClass =
    tone === 'danger' ? 'btn btn-danger' : tone === 'warning' ? 'btn btn-primary' : 'btn btn-primary';

  return (
    <Modal
      open={open}
      title={title}
      onClose={onCancel}
      size="sm"
      tone={tone}
      closeOnBackdrop={!reason}
      icon={
        tone === 'danger' ? (
          <TriangleAlert size={20} strokeWidth={1.9} />
        ) : (
          <CircleAlert size={20} strokeWidth={1.9} />
        )
      }
      actions={
        <>
          <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={busy}>
            {cancelText}
          </button>
          <button
            type="button"
            className={confirmClass}
            onClick={() => onConfirm(value.trim())}
            disabled={busy || tooShort}
          >
            {busy ? 'Processando...' : confirmText}
          </button>
        </>
      }
    >
      <p className="ui-modal__text">{message}</p>

      {reason && (
        <div className="field">
          <label htmlFor="confirm-dialog-reason">{reason.label}</label>
          <textarea
            id="confirm-dialog-reason"
            className="input"
            rows={3}
            value={value}
            maxLength={maxLength}
            placeholder={reason.placeholder}
            onChange={(event) => setValue(event.target.value)}
          />
          <div className={`ui-field-counter${tooShort ? ' ui-field-counter--invalid' : ''}`}>
            {tooShort
              ? `Mínimo de ${minLength} caracteres (${value.trim().length})`
              : `${value.trim().length} / ${maxLength}`}
          </div>
        </div>
      )}
    </Modal>
  );
};
