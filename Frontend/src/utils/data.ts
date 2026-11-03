export type Obj = Record<string, any>;
export const DASH = "\u2014";

export function isObj(v: unknown): v is Obj {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function isEmpty(v: unknown): boolean {
  if (v === null || v === undefined) return true;
  if (typeof v === "string") return v.trim() === "";
  if (Array.isArray(v)) return v.length === 0;
  if (isObj(v)) return Object.keys(v).length === 0;
  return false;
}

/** First key from `keys` that exists on obj with a non-empty value. */
export function pickKey(obj: unknown, keys: string[]): string | undefined {
  if (!isObj(obj)) return undefined;
  return keys.find((k) => Object.prototype.hasOwnProperty.call(obj, k) && !isEmpty(obj[k]));
}

export function pick(obj: unknown, keys: string[]): any {
  const k = pickKey(obj, keys);
  return k === undefined ? undefined : (obj as Obj)[k];
}

export function pickFrom(sources: unknown[], keys: string[]): any {
  for (const s of sources) {
    const v = pick(s, keys);
    if (v !== undefined) return v;
  }
  return undefined;
}

export function toArray(v: unknown): any[] {
  if (Array.isArray(v)) return v;
  if (isEmpty(v)) return [];
  return [v];
}

/** Concatenate the values of several keys (each may be a list or single value). */
export function collect(obj: unknown, keys: string[]): any[] {
  if (!isObj(obj)) return [];
  return keys.flatMap((k) => toArray(obj[k]));
}

export function toNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v.replace(/[,\s\u20B9]/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function humanize(key: string): string {
  return key
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Copy of obj without the given keys and without empty values. */
export function omit(obj: unknown, keys: string[]): Obj {
  if (!isObj(obj)) return {};
  const drop = new Set(keys);
  return Object.fromEntries(Object.entries(obj).filter(([k, v]) => !drop.has(k) && !isEmpty(v)));
}

export function shortText(v: unknown, max = 90): string {
  if (v === null || v === undefined) return DASH;
  if (typeof v === "string") return v.length > max ? v.slice(0, max) + "..." : v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  const s = JSON.stringify(v);
  return s.length > max ? s.slice(0, max) + "..." : s;
}
