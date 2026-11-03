import { useCallback, useEffect, useState } from "react";
import { ApiError, describeError, getHealth } from "../services/api";
import { isObj, pick } from "../utils/data";
import { readiness } from "../utils/status";

export interface HealthState {
  loading: boolean;
  reachable: boolean | null;
  degraded: boolean;
  data: any;
  message: string | null;
  error: string | null;
  checkedAt: Date | null;
}

export function useHealth(intervalMs = 30000) {
  const [state, setState] = useState<HealthState>({
    loading: true, reachable: null, degraded: false, data: null, message: null, error: null, checkedAt: null,
  });

  const check = useCallback(async () => {
    try {
      const res = await getHealth();
      const overall = isObj(res.data) ? readiness(pick(res.data, ["status", "overall_status", "health"])) : null;
      setState({ loading: false, reachable: true, degraded: overall === false, data: res.data, message: res.message || null, error: null, checkedAt: new Date() });
    } catch (e) {
      const reachable = e instanceof ApiError && e.status > 0; // got an HTTP answer, e.g. 503
      setState({ loading: false, reachable, degraded: reachable, data: null, message: null, error: describeError(e).message, checkedAt: new Date() });
    }
  }, []);

  useEffect(() => {
    check();
    const t = window.setInterval(check, intervalMs);
    return () => window.clearInterval(t);
  }, [check, intervalMs]);

  return { ...state, refresh: check };
}
