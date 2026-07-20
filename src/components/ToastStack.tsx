export interface Toast {
  id: string;
  folder: string;
  label: string;
}

interface ToastStackProps {
  toasts: Toast[];
  onJumpToFolder: (path: string) => void;
  onDismiss: (id: string) => void;
}

export function ToastStack({
  toasts,
  onJumpToFolder,
  onDismiss,
}: ToastStackProps) {
  if (toasts.length === 0) {
    return null;
  }

  return (
    <div className="toast-stack">
      {toasts.map((toast) => (
        <div key={toast.id} className="toast" role="status">
          <span className="toast__message">
            Nieuwe activiteit in {toast.label}
          </span>
          <button
            type="button"
            className="toast__action"
            onClick={() => onJumpToFolder(toast.folder)}
          >
            Ga naar map
          </button>
          <button
            type="button"
            className="toast__close"
            aria-label="Melding sluiten"
            onClick={() => onDismiss(toast.id)}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
