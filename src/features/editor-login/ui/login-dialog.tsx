import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { loadSession, parseSession, send } from "../../../shared/api";

export function LoginDialog({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const title = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const client = useQueryClient();
  const [password, setPassword] = useState("");
  const session = useQuery({
    queryKey: ["session"],
    queryFn: loadSession,
    retry: false,
  });
  const login = useMutation({
    mutationFn: async () =>
      parseSession(
        await send("/api/login", "POST", { password }, session.data!.csrf),
      ),
    onSuccess: (result) => {
      setPassword("");
      client.setQueryData(["session"], result);
    },
  });
  useEffect(() => {
    const element = dialog.current!;
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    element.showModal();
    return () => {
      element.close();
      document.body.style.overflow = overflow;
      if (previous instanceof HTMLElement && previous.isConnected)
        previous.focus();
    };
  }, []);
  useEffect(() => {
    if (session.data?.admin) onSuccess?.();
    else input.current?.focus();
  }, [session.data, onSuccess]);
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!login.isPending) login.mutate();
  }
  return (
    <dialog
      ref={dialog}
      className="login-dialog"
      aria-labelledby={title}
      aria-describedby={`${title}-description`}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          onClose();
        }
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="login-card">
        <button
          type="button"
          className="icon-button login-close"
          aria-label="Закрыть окно входа"
          onClick={onClose}
        >
          <X size={20} />
        </button>
        <p className="eyebrow">РЕДАКЦИЯ ПОРТАЛА</p>
        <h2 id={title}>Вход в админку</h2>
        <p id={`${title}-description`}>
          Управление медиатекой и календарём событий.
        </p>
        {session.isPending ? (
          <p role="status">Проверяем сессию…</p>
        ) : session.error ? (
          <div role="alert" className="error">
            Не удалось проверить вход.{" "}
            <button
              type="button"
              className="text-link"
              onClick={() => void session.refetch()}
            >
              Повторить
            </button>
          </div>
        ) : session.data.admin ? (
          <p role="status">Открываем редакцию…</p>
        ) : (
          <form onSubmit={submit}>
            <label>
              Пароль администратора
              <input
                ref={input}
                type="password"
                autoComplete="current-password"
                required
                maxLength={200}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
            {login.error && (
              <p role="alert" className="error">
                {login.error.message}
              </p>
            )}
            <button className="button primary" disabled={login.isPending}>
              {login.isPending ? "Входим…" : "Войти"}
            </button>
          </form>
        )}
      </div>
    </dialog>
  );
}
