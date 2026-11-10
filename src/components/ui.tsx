import type { ReactNode } from "react";

export function Section({ title, children, right }: { title: string; children: ReactNode; right?: ReactNode }) {
  return (
    <div className="border-b border-ink-700/70 px-4 py-3">
      <div className="mb-2.5 flex items-center justify-between">
        <h3 className="font-display text-[13px] font-medium text-ink-200">{title}</h3>
        {right}
      </div>
      <div className="space-y-2.5">{children}</div>
    </div>
  );
}

export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  suffix = "",
  fmt,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  suffix?: string;
  fmt?: (v: number) => string;
}) {
  return (
    <label className="block">
      <div className="mb-1 flex justify-between text-xs text-ink-300">
        <span>{label}</span>
        <span className="tabular-nums text-ink-200">{fmt ? fmt(value) : `${Math.round(value * 100) / 100}${suffix}`}</span>
      </div>
      <input type="range" className="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} />
    </label>
  );
}

export function Btn({
  children,
  onClick,
  variant = "ghost",
  className = "",
  title,
  disabled,
  active,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "ghost" | "primary" | "soft" | "danger";
  className?: string;
  title?: string;
  disabled?: boolean;
  active?: boolean;
}) {
  const v = {
    ghost: "text-ink-200 hover:bg-ink-700 hover:text-ink-100",
    soft: "bg-ink-700 text-ink-100 hover:bg-ink-600",
    primary: "bg-accent text-on-accent font-semibold hover:bg-accent-deep",
    danger: "text-red-300 hover:bg-red-500/15",
  }[variant];
  return (
    <button
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs transition-[background-color,color,transform] duration-150 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40 ${v} ${
        active ? "!bg-accent-soft !text-accent ring-1 ring-accent/40" : ""
      } ${className}`}
    >
      {children}
    </button>
  );
}

export function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!value)} className="flex w-full items-center justify-between text-xs text-ink-200">
      <span>{label}</span>
      <span className={`relative h-4 w-7 rounded-full transition-colors ${value ? "bg-accent" : "bg-ink-600"}`}>
        <span className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all ${value ? "left-3.5" : "left-0.5"}`} />
      </span>
    </button>
  );
}

export function Seg<T extends string | number>({ value, options, onChange }: { value: T; options: { v: T; label: ReactNode; title?: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex rounded-md bg-ink-800 p-0.5 ring-1 ring-ink-700/60">
      {options.map((o) => (
        <button
          key={String(o.v)}
          title={o.title}
          onClick={() => onChange(o.v)}
          className={`flex flex-1 items-center justify-center rounded px-2 py-1 text-xs transition-colors ${value === o.v ? "bg-ink-600 text-ink-100 shadow-sm" : "text-ink-300 hover:text-ink-100"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function ColorInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <label className="relative block h-7 w-9 shrink-0 cursor-pointer overflow-hidden rounded-md ring-1 ring-ink-600" style={{ background: value }}>
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" />
    </label>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="px-4 py-6 text-center text-xs leading-relaxed text-ink-400">{children}</p>;
}
