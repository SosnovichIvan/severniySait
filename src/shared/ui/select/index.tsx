import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Check, ChevronDown } from "lucide-react";

type Option = { value: string; label: string };
export function Select({
  label,
  value,
  options,
  onChange,
  disabled = false,
}: {
  label: string;
  value: string;
  options: readonly Option[];
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const search = useRef({ text: "", time: 0 });
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const selected = options.findIndex((option) => option.value === value);
  const active = Math.min(highlight, Math.max(0, options.length - 1));
  function expand() {
    setHighlight(Math.max(0, selected));
    setOpen(true);
  }
  function choose(index: number) {
    onChange(options[index].value);
    setOpen(false);
    trigger.current!.focus();
  }
  useEffect(() => {
    if (!open) return;
    function outside(event: globalThis.PointerEvent) {
      if (!root.current!.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  useEffect(() => {
    if (open)
      root
        .current!.querySelector(`[data-option-index="${active}"]`)
        ?.scrollIntoView({ block: "nearest" });
  }, [open, active]);
  function keyboard(event: KeyboardEvent<HTMLButtonElement>) {
    if (!options.length || disabled) return;
    if (event.key === "Escape" || event.key === "Tab") {
      setOpen(false);
      return;
    }
    if (["Enter", " "].includes(event.key)) {
      event.preventDefault();
      if (open) choose(active);
      else expand();
      return;
    }
    if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      setOpen(true);
      if (event.key === "Home") setHighlight(0);
      else if (event.key === "End") setHighlight(options.length - 1);
      else if (!open) setHighlight(Math.max(0, selected));
      else
        setHighlight(
          (active + (event.key === "ArrowDown" ? 1 : -1) + options.length) %
            options.length,
        );
      return;
    }
    if (
      event.key.length === 1 &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey
    ) {
      const text =
        (open && Date.now() - search.current.time < 700
          ? search.current.text
          : "") + event.key.toLocaleLowerCase("ru");
      search.current = { text, time: Date.now() };
      const match = options.findIndex((option) =>
        option.label.toLocaleLowerCase("ru").startsWith(text),
      );
      if (match >= 0) {
        event.preventDefault();
        setHighlight(match);
        setOpen(true);
      }
    }
  }
  return (
    <div
      ref={root}
      className="select-field"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <label id={`${id}-label`} htmlFor={`${id}-trigger`}>
        {label}
      </label>
      <button
        ref={trigger}
        id={`${id}-trigger`}
        type="button"
        className="select-trigger"
        role="combobox"
        aria-labelledby={`${id}-label`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-activedescendant={open ? `${id}-option-${active}` : undefined}
        disabled={disabled || !options.length}
        onClick={() => {
          if (open) setOpen(false);
          else expand();
        }}
        onKeyDown={keyboard}
      >
        <span className="select-value">
          {options[selected]?.label ?? "Выберите"}
        </span>
        <ChevronDown size={18} className="select-chevron" aria-hidden="true" />
      </button>
      <ul
        id={`${id}-list`}
        className="select-menu"
        hidden={!open}
        role="listbox"
        aria-labelledby={`${id}-label`}
      >
        {options.map((option, index) => (
          <li
            id={`${id}-option-${index}`}
            key={option.value}
            role="option"
            aria-selected={option.value === value}
            data-option-index={index}
            data-value={option.value}
            data-highlighted={index === active}
            onPointerMove={() => setHighlight(index)}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => choose(index)}
          >
            <span>{option.label}</span>
            <Check size={17} aria-hidden="true" className="select-check" />
          </li>
        ))}
      </ul>
    </div>
  );
}
