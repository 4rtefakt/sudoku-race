import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "../lib/api.js";

/** Charge une ressource ; `reload()` la redemande sans vider l'affichage. */
export function useApi<T>(load: () => Promise<T>, deps: unknown[]): { data: T | null; error: ApiError | null; reload: () => void } {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const seq = useRef(0);
  const run = useCallback(() => {
    const n = ++seq.current;
    load().then(
      (d) => {
        if (n !== seq.current) return;
        setData(d);
        setError(null);
      },
      (e) => {
        if (n !== seq.current) return;
        setError(e instanceof ApiError ? e : new ApiError(0, "network"));
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => {
    setData(null);
    setError(null);
    run();
  }, [run]);
  return { data, error, reload: run };
}
