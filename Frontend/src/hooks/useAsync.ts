import { useCallback, useEffect, useState } from "react";
import { describeError, type ErrorInfo } from "../services/api";

export interface AsyncState<T> {
  loading: boolean;
  error: ErrorInfo | null;
  data: T | null;
  reload: () => void;
}

export function useAsync<T>(fn: () => Promise<T>, deps: unknown[], enabled = true): AsyncState<T> {
  const [state, setState] = useState<{ loading: boolean; error: ErrorInfo | null; data: T | null }>({
    loading: enabled,
    error: null,
    data: null,
  });
  const [nonce, setNonce] = useState(0);
  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!enabled) {
      setState((s) => ({ ...s, loading: false }));
      return;
    }
    let active = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    fn()
      .then((data) => active && setState({ loading: false, error: null, data }))
      .catch((e) => active && setState({ loading: false, error: describeError(e), data: null }));
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, enabled, nonce]);

  return { ...state, reload };
}
