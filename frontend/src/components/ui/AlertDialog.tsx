import { Ban, CircleAlert, TriangleAlert } from 'lucide-react';
import { Modal } from './Modal';

export type AlertDialogTone = 'danger' | 'warning' | 'info';

export type AlertDialogProps = {
  open: boolean;
  title: string;
  message: string;
  /** Rendered as a list under the message — used to name the items that failed. */
  details?: string[];
  tone?: AlertDialogTone;
  closeText?: string;
  onClose: () => void;
};

const ICONS: Record<AlertDialogTone, typeof CircleAlert> = {
  danger: Ban,
  warning: TriangleAlert,
  info: CircleAlert,
};

/** Replaces alert(): blocking-free, focus-trapped, and able to list per-item errors. */
export const AlertDialog = ({
  open,
  title,
  message,
  details,
  tone = 'danger',
  closeText = 'Entendi',
  onClose,
}: AlertDialogProps) => {
  const Icon = ICONS[tone];

  return (
    <Modal
      open={open}
      title={title}
      onClose={onClose}
      size="sm"
      tone={tone === 'info' ? 'default' : tone}
      icon={<Icon size={20} strokeWidth={1.9} />}
      actions={
        <button type="button" className="btn btn-primary" onClick={onClose}>
          {closeText}
        </button>
      }
    >
      <p className="ui-modal__text">{message}</p>
      {details && details.length > 0 && (
        <ul className="ui-modal__details">
          {details.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
    </Modal>
  );
};
