import { api } from "./api";
import { isObj, pick, toNumber, type Obj } from "../utils/data";
import type { TenderPage, TenderSummary } from "../types/api";

const ID_KEYS = ["tender_id", "id", "uuid"];
const STATUS_KEYS = ["status", "analysis_status", "state"];

export function normalizeTender(raw: unknown): TenderSummary {
  const outer: Obj = isObj(raw) ? raw : {};
  // Some responses wrap the record, e.g. { tender: { ... } }.
  const r: Obj = isObj(outer.tender) && pick(outer, ID_KEYS) === undefined ? outer.tender : outer;
  const id = pick(r, ID_KEYS);
  const status = pick(r, STATUS_KEYS);
  return {
    tender_id: id === undefined ? "" : String(id),
    filename: pick(r, ["filename", "file_name", "original_filename", "original_file_name", "document_name"]) ?? null,
    created_at: pick(r, ["created_at", "uploaded_at", "upload_date", "created", "timestamp"]) ?? null,
    status: status === undefined ? null : String(status),
    raw: r,
  };
}

export function extractStatus(data: unknown): string | null {
  if (typeof data === "string") return data;
  if (isObj(data)) {
    const s = pick(data, STATUS_KEYS) ?? (isObj(data.tender) ? pick(data.tender, STATUS_KEYS) : undefined);
    return s === undefined ? null : String(s);
  }
  return null;
}

function normalizePage(data: unknown, page: number, pageSize: number): TenderPage {
  let list: unknown[] = [];
  let meta: Record<string, any> = {};
  if (Array.isArray(data)) {
    list = data;
  } else if (isObj(data)) {
    meta = isObj(data.pagination) ? { ...data, ...data.pagination } : data;
    const l = pick(data, ["items", "tenders", "results", "records", "data"]);
    list = Array.isArray(l) ? l : [];
  }
  return {
    items: list.map(normalizeTender),
    total: toNumber(pick(meta, ["total", "total_count", "total_items", "count"])),
    page: toNumber(pick(meta, ["page", "current_page"])) ?? page,
    page_size: toNumber(pick(meta, ["page_size", "per_page", "size", "limit"])) ?? pageSize,
    total_pages: toNumber(pick(meta, ["total_pages", "pages", "page_count"])),
  };
}

export const uploadTender = (file: File) => api.uploadTender(file);

export async function listTenders(page = 1, pageSize = 10): Promise<TenderPage> {
  const res = await api.listTenders(page, pageSize);
  return normalizePage(res.data, page, pageSize);
}

/** Walks all pages (bounded) so dashboard statistics reflect real backend data. */
export async function listAllTenders(maxPages = 20): Promise<TenderSummary[]> {
  const size = 50;
  const all: TenderSummary[] = [];
  for (let page = 1; page <= maxPages; page++) {
    const p = await listTenders(page, size);
    all.push(...p.items);
    const done =
      p.items.length < size ||
      (p.total !== null && all.length >= p.total) ||
      (p.total_pages !== null && page >= p.total_pages);
    if (done) break;
  }
  return all;
}

export const getTender = (id: string) => api.getTender(id);
export const analyzeTender = (id: string) => api.analyzeTender(id);
export const getTenderStatus = (id: string) => api.getTenderStatus(id);
