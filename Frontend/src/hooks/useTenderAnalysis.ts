import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, describeError, type ErrorInfo } from "../services/api";
import { analyzeTender, extractStatus, getTenderStatus } from "../services/tenderService";
import { isObj, pick } from "../utils/data";
import { statusKind, type StatusKind } from "../utils/status";

/**
 * idle -> analyzing (synchronous POST /analyze) -> completed
 *                          \-> polling (GET /status, only if the POST did not settle it)
 *                                 -> completed | failed | unconfirmed
 * "unconfirmed" = the backend never reported a terminal status in the grace period. It is NOT a failure.
 */
export type AnalysisPhase = "idle" | "analyzing" | "polling" | "completed" | "unconfirmed" | "failed";

const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 600000; // 10 minutes
const MAX_TRANSIENT_ERRORS = 3;
const sleep = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms));

type Trigger = "returned" | "conflict" | "timeout" | "network" | "watch";

/** Consecutive "uploaded"/unrecognised statuses tolerated before polling stops. */
const IDLE_LIMIT: Record<Trigger, number> = {
  returned: 5, // ~15 s grace for the status to catch up after a successful synchronous POST
  conflict: 3,
  timeout: Number.POSITIVE_INFINITY, // still running server-side; a sync backend may only update status at the end
  network: 3,
  watch: 3,
};

interface PollResult {
  kind: StatusKind;
  data: unknown;
}

function failureReason(data: unknown): string | undefined {
  if (!isObj(data)) return undefined;
  const r = pick(data, ["error", "error_message", "failure_reason", "details", "message"]);
  if (r === undefined) return undefined;
  return typeof r === "string" ? r : JSON.stringify(r, null, 2);
}

function isTransient(e: unknown): boolean {
  return e instanceof ApiError && [0, 429, 502, 503, 504].includes(e.status) && e.code !== "POLL_TIMEOUT";
}

export function useTenderAnalysis() {
  const busy = useRef(false); // guards against duplicate analysis submissions
  const alive = useRef(true);
  const [phase, setPhase] = useState<AnalysisPhase>("idle");
  const [error, setError] = useState<ErrorInfo | null>(null);
  const [lastStatus, setLastStatus] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const poll = useCallback(async (id: string, idleLimit: number): Promise<PollResult | null> => {
    const deadline = Date.now() + POLL_TIMEOUT_MS;
    let idle = 0;
    let errors = 0;
    while (alive.current) {
      let data: unknown;
      try {
        data = (await getTenderStatus(id)).data;
        errors = 0;
      } catch (e) {
        if (isTransient(e) && ++errors <= MAX_TRANSIENT_ERRORS) {
          await sleep(POLL_INTERVAL_MS * (errors + 1));
          continue;
        }
        throw e;
      }
      if (!alive.current) return null;
      const status = extractStatus(data);
      setLastStatus(status);
      const kind = statusKind(status);
      if (kind === "completed" || kind === "failed") return { kind, data };
      if (kind === "processing") idle = 0;
      else if (++idle >= idleLimit) return { kind, data };
      if (Date.now() > deadline) {
        throw new ApiError("The analysis has not been reported as finished after 10 minutes of status checks.", 0, "POLL_TIMEOUT");
      }
      await sleep(POLL_INTERVAL_MS);
    }
    return null;
  }, []);

  const settle = useCallback((r: PollResult | null, trigger: Trigger, cause: ErrorInfo | null): boolean => {
    if (!r) return false; // component unmounted
    if (r.kind === "completed") {
      setPhase("completed");
      return true;
    }
    if (r.kind === "failed") {
      setError({ message: "Analysis failed on the backend.", details: failureReason(r.data) });
      setPhase("failed");
      return false;
    }
    // Status is still "uploaded" or unrecognised.
    if ((trigger === "conflict" || trigger === "network") && cause) {
      setError(cause); // the backend refused the request or it never arrived
      setPhase("failed");
      return false;
    }
    setPhase("unconfirmed");
    return false;
  }, []);

  const fail = useCallback((e: unknown) => {
    if (e instanceof ApiError && e.code === "POLL_TIMEOUT") {
      setPhase("unconfirmed");
      return;
    }
    setError(describeError(e));
    setPhase("failed");
  }, []);

  /** Runs the synchronous POST /analyze and uses its response; polls /status only when needed. */
  const run = useCallback(async (id: string): Promise<boolean> => {
    if (busy.current) return false;
    busy.current = true;
    setError(null);
    setLastStatus(null);
    setPhase("analyzing");
    setStartedAt(Date.now());
    try {
      let trigger: Trigger = "returned";
      let cause: ErrorInfo | null = null;
      try {
        const res = await analyzeTender(id);
        if (!alive.current) return false;
        const status = extractStatus(res.data);
        if (status) setLastStatus(status);
        const kind = statusKind(status);
        if (kind === "completed") {
          setPhase("completed");
          return true;
        }
        if (kind === "failed") {
          setError({ message: "Analysis failed on the backend.", details: failureReason(res.data) ?? (res.message || undefined) });
          setPhase("failed");
          return false;
        }
        // No status, "processing" or "uploaded" in the POST response: confirm via GET /status below.
      } catch (e) {
        if (!(e instanceof ApiError)) throw e;
        if (e.status === 409) trigger = "conflict"; // already running / already finished
        else if (e.code === "TIMEOUT") trigger = "timeout"; // client gave up; backend may still be working
        else if (e.code === "NETWORK_ERROR") trigger = "network";
        else throw e; // 404, 413, 415, 422, 429, 500 ...
        cause = describeError(e);
      }
      if (!alive.current) return false;
      setPhase("polling");
      let r: PollResult | null;
      try {
        r = await poll(id, IDLE_LIMIT[trigger]);
      } catch (e) {
        if (trigger === "network" && cause && !(e instanceof ApiError && e.code === "POLL_TIMEOUT")) {
          setError(cause);
          setPhase("failed");
          return false;
        }
        throw e;
      }
      return settle(r, trigger, cause);
    } catch (e) {
      fail(e);
      return false;
    } finally {
      busy.current = false;
    }
  }, [poll, settle, fail]);

  /** Polls only (tender already processing, or re-checking an unconfirmed result). */
  const watch = useCallback(async (id: string): Promise<boolean> => {
    if (busy.current) return false;
    busy.current = true;
    setError(null);
    setPhase("polling");
    setStartedAt(Date.now());
    try {
      return settle(await poll(id, IDLE_LIMIT.watch), "watch", null);
    } catch (e) {
      fail(e);
      return false;
    } finally {
      busy.current = false;
    }
  }, [poll, settle, fail]);

  const reset = useCallback(() => {
    setPhase("idle");
    setError(null);
    setLastStatus(null);
    setStartedAt(null);
  }, []);

  return { phase, error, lastStatus, startedAt, busy: phase === "analyzing" || phase === "polling", run, watch, reset };
}
