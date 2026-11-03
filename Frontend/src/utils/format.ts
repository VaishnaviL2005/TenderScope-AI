import { DASH, toNumber } from "./data";

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });

/** Formats a backend amount as INR. Returns null if the value is not numeric. */
export function formatINR(v: unknown): string | null {
  const n = toNumber(v);
  return n === null ? null : inr.format(n);
}

export function formatDate(v: unknown): string {
  if (v === null || v === undefined || v === "") return DASH;
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

const MONEY = /(cost|price|amount|total|rate|inr|value)/i;
const NOT_MONEY = /(qty|quantity|count|percent|pct|cores|length|currency|unit$|units|status|name|id$|_id|code|sku)/i;
export function isMoneyKey(key: string): boolean {
  return MONEY.test(key) && !NOT_MONEY.test(key);
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}
