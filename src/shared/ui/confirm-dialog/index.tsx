import { useEffect, useRef } from "react";
export function ConfirmDialog({
  busy,
  onCancel,
  onConfirm,
}: {
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
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
      <h2 id="delete-title">Удалить запись?</h2>
      <p>Запись будет удалена из редакции и с сайта.</p>
      <div className="row-actions">
        <button autoFocus className="button" onClick={onCancel}>
          Отмена
        </button>
        <button className="button danger" disabled={busy} onClick={onConfirm}>
          Удалить
        </button>
      </div>
    </dialog>
  );
}
