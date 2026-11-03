import { DASH, humanize, isObj } from "../../utils/data";

/** Renders any backend value faithfully (no invented data). */
export default function ValueView({ value, depth = 0 }: { value: unknown; depth?: number }) {
  if (value === null || value === undefined || (typeof value === "string" && value.trim() === "")) {
    return <span className="text-slate-400">{DASH}</span>;
  }
  if (typeof value === "boolean") return <span>{value ? "Yes" : "No"}</span>;
  if (typeof value === "number" || typeof value === "string") {
    return <span className="whitespace-pre-wrap break-words">{String(value)}</span>;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-slate-400">None</span>;
    if (value.every((v) => !isObj(v) && !Array.isArray(v))) {
      return (
        <ul className="list-disc space-y-0.5 pl-5">
          {value.map((v, i) => <li key={i}><ValueView value={v} depth={depth + 1} /></li>)}
        </ul>
      );
    }
    return (
      <div className="space-y-2">
        {value.map((v, i) => (
          <div key={i} className="rounded-md border border-slate-200 bg-slate-50 p-2">
            <ValueView value={v} depth={depth + 1} />
          </div>
        ))}
      </div>
    );
  }
  if (isObj(value)) {
    if (depth > 4) return <code className="break-all text-xs">{JSON.stringify(value)}</code>;
    const entries = Object.entries(value);
    if (!entries.length) return <span className="text-slate-400">{DASH}</span>;
    return (
      <dl className="grid gap-x-4 gap-y-1.5 sm:grid-cols-[minmax(140px,auto)_1fr]">
        {entries.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500 sm:pt-0.5">{humanize(k)}</dt>
            <dd className="text-sm text-slate-800"><ValueView value={v} depth={depth + 1} /></dd>
          </div>
        ))}
      </dl>
    );
  }
  return <span>{String(value)}</span>;
}
