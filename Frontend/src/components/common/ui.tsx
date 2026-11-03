import type { ReactNode } from "react";
import type { ErrorInfo } from "../../services/api";

const base = "inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500";
export const btn = {
  primary: `${base} bg-navy-800 px-4 py-2 text-sm text-white shadow-sm hover:bg-navy-700`,
  secondary: `${base} border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50`,
  primarySm: `${base} bg-navy-800 px-3 py-1.5 text-xs text-white hover:bg-navy-700`,
  secondarySm: `${base} border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50`,
  ghostSm: `${base} px-3 py-1.5 text-xs text-navy-700 hover:bg-navy-50`,
};

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-navy-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2 print:hidden">{actions}</div>}
    </div>
  );
}

export function Card({ title, subtitle, actions, children, className = "" }: { title?: ReactNode; subtitle?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`print-break rounded-xl border border-slate-200 bg-white shadow-sm print:shadow-none ${className}`}>
      {(title || actions) && (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            {title && <h2 className="text-base font-semibold text-navy-900">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
          </div>
          {actions && <div className="print:hidden">{actions}</div>}
        </header>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 py-2 text-sm text-slate-600" role="status">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-navy-200 border-t-navy-700" />
      {label && <span>{label}</span>}
    </div>
  );
}

export function ErrorAlert({ error, title = "Something went wrong", onRetry }: { error: ErrorInfo; title?: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold">{title}</p>
          <p className="mt-1">{error.message}</p>
          {(error.status || error.code) && (
            <p className="mt-1 font-mono text-xs text-red-700">
              {[error.status ? `HTTP ${error.status}` : null, error.code].filter(Boolean).join(" | ")}
            </p>
          )}
          {error.hint && <p className="mt-1 text-xs text-red-700">{error.hint}</p>}
          {error.details && <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded bg-red-100/60 p-2 text-xs">{error.details}</pre>}
        </div>
        {onRetry && <button className={`${btn.secondarySm} print:hidden`} onClick={onRetry}>Retry</button>}
      </div>
    </div>
  );
}

export function EmptyState({ title, message, action }: { title: string; message?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center">
      <p className="font-semibold text-navy-900">{title}</p>
      {message && <p className="mt-1 text-sm text-slate-500">{message}</p>}
      {action && <div className="mt-4 flex justify-center print:hidden">{action}</div>}
    </div>
  );
}

const NOTICE = {
  info: "border-navy-200 bg-navy-50 text-navy-900",
  warning: "border-amber-300 bg-amber-50 text-amber-900",
  danger: "border-red-300 bg-red-50 text-red-900",
  success: "border-teal-300 bg-teal-50 text-teal-900",
};
export function Notice({ tone = "info", title, children }: { tone?: keyof typeof NOTICE; title?: ReactNode; children?: ReactNode }) {
  return (
    <div className={`rounded-lg border px-4 py-3 text-sm ${NOTICE[tone]}`}>
      {title && <p className="font-semibold">{title}</p>}
      {children && <div className={title ? "mt-1" : ""}>{children}</div>}
    </div>
  );
}

const TONES = {
  teal: "bg-teal-50 text-teal-700 ring-teal-600/20",
  red: "bg-red-50 text-red-700 ring-red-600/20",
  redSolid: "bg-red-600 text-white ring-red-700",
  amber: "bg-amber-50 text-amber-800 ring-amber-600/20",
  slate: "bg-slate-100 text-slate-700 ring-slate-500/20",
  navy: "bg-navy-50 text-navy-800 ring-navy-600/20",
  blue: "bg-blue-50 text-blue-700 ring-blue-600/20",
};
export type BadgeTone = keyof typeof TONES;
export function Badge({ tone = "slate", children }: { tone?: BadgeTone; children: ReactNode }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${TONES[tone]}`}>{children}</span>;
}

export function Collapsible({ title, children, defaultOpen = false }: { title: ReactNode; children: ReactNode; defaultOpen?: boolean }) {
  return (
    <details open={defaultOpen} className="group rounded-lg border border-slate-200 bg-slate-50/60">
      <summary className="cursor-pointer select-none px-4 py-2.5 text-sm font-medium text-navy-800">{title}</summary>
      <div className="border-t border-slate-200 bg-white px-4 py-3">{children}</div>
    </details>
  );
}
