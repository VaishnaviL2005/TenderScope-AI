import { isObj, pick } from "./data";

export type StatusKind = "completed" | "processing" | "uploaded" | "failed" | "unknown";

const norm = (v: unknown) => String(v ?? "").toLowerCase().trim().replace(/[\s-]+/g, "_");

const COMPLETED = ["completed", "complete", "analyzed", "analysed", "done", "success", "succeeded", "finished", "report_ready"];
const PROCESSING = ["processing", "analyzing", "analysing", "in_progress", "running", "queued", "started", "extracting", "matching", "pricing", "reviewing"];
const UPLOADED = ["uploaded", "pending", "new", "created", "received", "not_started"];
const FAILED = ["failed", "error", "failure", "errored", "cancelled", "canceled"];

export function statusKind(status: unknown): StatusKind {
  const v = norm(status);
  if (COMPLETED.includes(v)) return "completed";
  if (PROCESSING.includes(v)) return "processing";
  if (UPLOADED.includes(v)) return "uploaded";
  if (FAILED.includes(v)) return "failed";
  return "unknown";
}

export const STATUS_STYLES: Record<StatusKind, string> = {
  completed: "bg-teal-50 text-teal-700 ring-teal-600/20",
  processing: "bg-blue-50 text-blue-700 ring-blue-600/20",
  uploaded: "bg-slate-100 text-slate-700 ring-slate-500/20",
  failed: "bg-red-50 text-red-700 ring-red-600/20",
  unknown: "bg-amber-50 text-amber-800 ring-amber-600/20",
};

const READY = ["ok", "ready", "healthy", "up", "connected", "available", "pass", "passed", "true", "success", "online", "loaded", "operational"];
const NOT_READY = ["error", "down", "unhealthy", "failed", "fail", "unavailable", "disconnected", "not_ready", "false", "offline", "degraded", "missing", "not_loaded", "not_configured"];

/** true = ready, false = not ready, null = unknown. */
export function readiness(v: unknown): boolean | null {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") {
    const s = norm(v);
    if (READY.includes(s)) return true;
    if (NOT_READY.includes(s)) return false;
    return null;
  }
  if (isObj(v)) {
    const inner = pick(v, ["status", "ready", "healthy", "ok", "connected", "state", "available"]);
    return inner === undefined ? null : readiness(inner);
  }
  return null;
}

export type Verdict = true | false | "partial" | null;

const V_TRUE = ["match", "matched", "pass", "passed", "compliant", "yes", "ok", "true", "met", "meets", "satisfied", "approved", "exact", "exact_match", "complete", "completed"];
const V_FALSE = ["mismatch", "not_matched", "no_match", "fail", "failed", "non_compliant", "not_compliant", "noncompliant", "no", "false", "not_met", "unmet", "rejected", "does_not_meet"];
const V_PARTIAL = ["partial", "partial_match", "partially_matched", "partially_compliant", "needs_review", "review_required", "warning", "conditional", "pending_review", "incomplete"];

export function verdict(v: unknown): Verdict {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") {
    const s = norm(v);
    if (V_TRUE.includes(s)) return true;
    if (V_FALSE.includes(s)) return false;
    if (V_PARTIAL.includes(s)) return "partial";
  }
  return null;
}
