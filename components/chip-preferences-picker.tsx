"use client";

export interface ChipOption<T extends string> {
  key: T;
  label: string;
}

interface ChipPreferencesPickerProps<T extends string> {
  title: string;
  description: string;
  selected: T[];
  options: readonly ChipOption<T>[];
  onChange: (selected: T[]) => void;
  emptyMessage: string;
  addLabel: string;
  allSelectedMessage: string;
  orderedKeys: readonly T[];
}

function RemoveCrossIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className="h-3.5 w-3.5"
    >
      <path
        d="M4.5 4.5l7 7M11.5 4.5l-7 7"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function getOptionLabel<T extends string>(
  options: readonly ChipOption<T>[],
  key: T,
): string {
  return options.find((option) => option.key === key)?.label ?? key;
}

export function ChipPreferencesPicker<T extends string>({
  title,
  description,
  selected,
  options,
  onChange,
  emptyMessage,
  addLabel,
  allSelectedMessage,
  orderedKeys,
}: ChipPreferencesPickerProps<T>) {
  const selectedSet = new Set(selected);
  const availableOptions = options.filter((option) => !selectedSet.has(option.key));

  const addOption = (key: T) => {
    onChange(orderedKeys.filter((item) => selectedSet.has(item) || item === key));
  };

  const removeOption = (key: T) => {
    onChange(selected.filter((item) => item !== key));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {selected.length > 0 ? (
          <button
            type="button"
            onClick={() => onChange([])}
            className="text-xs text-muted transition hover:text-foreground"
          >
            Clear all
          </button>
        ) : null}
      </div>
      <p className="text-xs text-muted">{description}</p>

      <div className="min-h-11 rounded-xl border border-black/10 bg-black/[0.02] p-2 dark:border-white/15 dark:bg-white/[0.03]">
        {selected.length === 0 ? (
          <p className="px-2 py-1.5 text-xs text-muted">{emptyMessage}</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {selected.map((key) => (
              <span
                key={key}
                className="group inline-flex items-center rounded-full bg-brand/10 text-sm text-foreground dark:bg-brand/20"
              >
                <span className="px-3 py-1">{getOptionLabel(options, key)}</span>
                <button
                  type="button"
                  onClick={() => removeOption(key)}
                  title={`Remove ${getOptionLabel(options, key)}`}
                  aria-label={`Remove ${getOptionLabel(options, key)}`}
                  className="mr-1 inline-flex h-6 w-0 items-center justify-center overflow-hidden rounded-full text-brand opacity-0 transition-all duration-150 hover:bg-brand/15 group-hover:w-6 group-hover:opacity-100 dark:hover:bg-brand/25"
                >
                  <RemoveCrossIcon />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {availableOptions.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted">{addLabel}</p>
          <div className="flex flex-wrap gap-2">
            {availableOptions.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => addOption(key)}
                className="rounded-full border border-black/10 bg-background px-3 py-1 text-sm text-foreground transition hover:border-brand/40 hover:bg-brand/5 dark:border-white/15 dark:hover:border-brand/50 dark:hover:bg-brand/10"
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted">{allSelectedMessage}</p>
      )}
    </div>
  );
}
