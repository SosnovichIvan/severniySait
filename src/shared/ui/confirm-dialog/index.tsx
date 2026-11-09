import { useEffect, useRef } from "react";
export function ConfirmDialog({
  busy,
  onCancel,
  onConfirm,
  title = "Удалить запись?",
  description = "Запись будет удалена из редакции и с сайта.",
  confirmLabel = "Удалить",
}: {
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  title?: string;
  description?: string;
  confirmLabel?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current!.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className="panel delete-dialog"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="delete-title"
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
    >
      <h2 id="delete-title">{title}</h2>
      <p>{description}</p>
      <div className="row-actions">
        <button autoFocus className="button" onClick={onCancel}>
          Отмена
        </button>
        <button className="button danger" disabled={busy} onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
