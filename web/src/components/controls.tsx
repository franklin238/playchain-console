import { useEffect, useRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const VARIANTS: Record<Variant, string> = {
  // Solid brand red, like the reference's "Hire us".
  primary: "bg-accent text-on-accent hover:bg-accent-hover border-2 border-transparent",
  // Outlined, like the reference's "Ask a question".
  secondary: "border-2 border-fg/85 text-fg hover:bg-white/[0.06]",
  ghost: "border-2 border-transparent text-fg hover:bg-surface-2",
  danger: "bg-danger text-white border-2 border-transparent",
};

export function Button({
  variant = "secondary",
  icon,
  size = "md",
  className = "",
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  icon?: IconName;
  size?: "md" | "lg";
}) {
  // Large buttons are a little smaller on phones, where they would crowd the screen.
  const sizing = size === "lg" ? "px-5 py-2.5 sm:px-7 sm:py-3.5" : "px-4 py-2 sm:px-5 sm:py-2.5";
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-2.5 rounded-lg font-bold uppercase tracking-wide transition-colors disabled:opacity-40 ${sizing} ${VARIANTS[variant]} ${className}`}
      {...rest}
    >
      {icon && <Icon name={icon} className="size-[1.2em]" />}
      {children}
    </button>
  );
}

const ROW = "w-full rounded-xl border border-line bg-surface px-5 py-4";

export function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`${ROW} flex items-center justify-between gap-6 text-left hover:border-line-strong`}
    >
      <span>
        <span className="block font-semibold">{label}</span>
        {description && <span className="mt-1 block text-sm text-muted">{description}</span>}
      </span>
      <span className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${checked ? "bg-accent" : "bg-white/15"}`}>
        <span
          className={`absolute top-1 size-5 rounded-full bg-white transition-transform ${checked ? "translate-x-6" : "translate-x-1"}`}
        />
      </span>
    </button>
  );
}

export function Slider({
  label,
  value,
  onChange,
  min = 0,
  max = 100,
  step = 5,
  format = (v: number) => `${v}`,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  format?: (v: number) => string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const valueRef = useRef(value);
  valueRef.current = value;

  const clamp = (v: number) => Math.min(max, Math.max(min, Math.round(v / step) * step));

  // Left/right from keyboard or gamepad arrive as "navadjust" events.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onAdjust = (e: Event) => {
      const dir = (e as CustomEvent<"left" | "right">).detail;
      onChange(clamp(valueRef.current + (dir === "right" ? step : -step)));
    };
    el.addEventListener("navadjust", onAdjust);
    return () => el.removeEventListener("navadjust", onAdjust);
  });

  const fromPointer = (clientX: number) => {
    const rect = track.current?.getBoundingClientRect();
    if (!rect) return;
    onChange(clamp(min + ((clientX - rect.left) / rect.width) * (max - min)));
  };

  const pct = ((value - min) / (max - min)) * 100;

  return (
    <div
      ref={ref}
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-valuetext={format(value)}
      data-nav-consume="horizontal"
      className={`${ROW} flex items-center gap-5 hover:border-line-strong`}
      onPointerDown={(e) => {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        fromPointer(e.clientX);
      }}
      onPointerMove={(e) => {
        if (e.buttons === 1) fromPointer(e.clientX);
      }}
    >
      <span className="w-32 shrink-0 font-semibold sm:w-40">{label}</span>
      <div ref={track} className="relative h-1.5 flex-1 rounded-full bg-white/15">
        <div className="absolute inset-y-0 left-0 rounded-full bg-accent" style={{ width: `${pct}%` }} />
        <div
          className="absolute top-1/2 size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-accent bg-white"
          style={{ left: `${pct}%` }}
        />
      </div>
      <span className="w-14 shrink-0 text-right tabular-nums text-muted">{format(value)}</span>
    </div>
  );
}

export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: ReactNode }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className={ROW} role="group" aria-label={label}>
      <div className="mb-3 font-semibold">{label}</div>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            aria-pressed={value === o.value}
            onClick={() => onChange(o.value)}
            className={`rounded-lg border-2 px-4 py-2 font-semibold transition-colors ${
              value === o.value ? "border-fg bg-fg text-bg" : "border-line-strong text-fg hover:border-fg/60"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** A row of filter chips (categories, library filters). */
export function FilterChips<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string; count?: number }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={`rounded-lg border-2 px-4 py-2 text-sm font-bold uppercase tracking-wide transition-colors ${
            value === o.value ? "border-fg bg-fg text-bg" : "border-line-strong text-fg hover:border-fg/60"
          }`}
        >
          {o.label}
          {o.count !== undefined && <span className="ml-2 opacity-60">{o.count}</span>}
        </button>
      ))}
    </div>
  );
}

/** Labelled text box. */
export function TextField({
  label,
  value,
  onChange,
  hint,
  placeholder,
  multiline = false,
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  placeholder?: string;
  multiline?: boolean;
  maxLength?: number;
}) {
  const className = "mt-1.5 w-full rounded-lg border-2 border-line-strong bg-bg-2 px-3 py-2.5 text-base text-fg placeholder:text-muted";
  return (
    <label className="block">
      <span className="font-semibold">{label}</span>
      {hint && <span className="ml-2 text-sm text-muted">{hint}</span>}
      {multiline ? (
        <textarea rows={5} value={value} maxLength={maxLength} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className={className} />
      ) : (
        <input type="text" value={value} maxLength={maxLength} placeholder={placeholder} autoComplete="off" spellCheck={false} onChange={(e) => onChange(e.target.value)} className={className} />
      )}
    </label>
  );
}

/** Choose any number of options. */
export function MultiChips<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T[];
  onChange: (value: T[]) => void;
}) {
  return (
    <div role="group" aria-label={label}>
      <div className="mb-1.5 font-semibold">{label}</div>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const on = value.includes(o.value);
          return (
            <button
              key={o.value}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(on ? value.filter((v) => v !== o.value) : [...value, o.value])}
              className={`rounded-lg border-2 px-4 py-2 text-sm font-bold transition-colors ${on ? "border-fg bg-fg text-bg" : "border-line-strong text-fg hover:border-fg/60"}`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function SearchField({
  value,
  onChange,
  placeholder,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  label: string;
}) {
  return (
    <label className="flex w-full max-w-md items-center gap-3 rounded-lg border-2 border-line-strong bg-bg-2 px-4 focus-within:border-fg focus-within:shadow-[0_0_0_6px_rgb(179_27_52/0.35)]">
      <Icon name="search" className="size-[1.2em] shrink-0 text-muted" />
      <span className="sr-only">{label}</span>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        maxLength={80}
        className="w-full bg-transparent py-2.5 text-base text-fg placeholder:text-muted [&::-webkit-search-cancel-button]:hidden"
        style={{ outline: "none", boxShadow: "none" }}
      />
    </label>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="mb-4 text-sm font-bold uppercase tracking-[0.14em] text-muted">{title}</h2>
      <div className="grid gap-3">{children}</div>
    </section>
  );
}
