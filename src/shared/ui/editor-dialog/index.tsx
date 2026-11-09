import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

/** Native modal: focus containment and Escape belong to the browser. */
export function EditorDialog({
  title,
  busy,
  onClose,
  children,
}: {
  title: string;
  busy: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const dialog = ref.current!;
    dialog.showModal();
    const input = dialog.querySelector<HTMLElement>(
      "input:not(:disabled),textarea:not(:disabled)",
    );
    (input ?? dialog.querySelector<HTMLElement>("h2"))?.focus();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = previous;
      if (opener?.isConnected) opener.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="panel editor editor-dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-busy={busy}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          if (!busy) onClose();
        }
      }}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
    >
      <div className="editor-dialog-heading">
        <h2 id={titleId} tabIndex={-1}>
          {title}
        </h2>
        <button
          type="button"
          className="icon-button"
          aria-label="Закрыть редактор"
          disabled={busy}
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </div>
      <div className="editor-dialog-body">
        <fieldset className="editor-dialog-fields" disabled={busy}>
          {children}
        </fieldset>
      </div>
    </dialog>
  );
}
