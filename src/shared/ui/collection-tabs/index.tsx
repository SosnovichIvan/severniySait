export function CollectionTabs({
  label,
  prefix,
  value,
  options,
  onChange,
  disabled = false,
}: {
  label: string;
  prefix: string;
  value: string;
  options: readonly { value: string; label: string }[];
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <div
      className="collection-tabs"
      role="tablist"
      aria-label={label}
      onKeyDown={(event) => {
        if (
          disabled ||
          !options.length ||
          !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)
        )
          return;
        event.preventDefault();
        const index = options.findIndex((option) => option.value === value);
        const next =
          event.key === "Home"
            ? 0
            : event.key === "End"
              ? options.length - 1
              : (index +
                  (event.key === "ArrowRight" ? 1 : -1) +
                  options.length) %
                options.length;
        onChange(options[next].value);
        const buttons =
          event.currentTarget.querySelectorAll<HTMLButtonElement>("button");
        buttons[next].focus();
      }}
    >
      {options.map((option) => (
        <button
          type="button"
          role="tab"
          key={option.value}
          id={`${prefix}-${option.value}`}
          aria-selected={value === option.value}
          aria-controls={`${prefix}-panel`}
          tabIndex={value === option.value ? 0 : -1}
          disabled={disabled}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
