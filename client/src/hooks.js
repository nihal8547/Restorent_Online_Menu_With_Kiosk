import { useEffect, useRef, useState, useCallback } from "react";

// Debounce a fast-changing value (e.g. a search box) so downstream filtering
// runs less often. Returns the value after it has been stable for `delay` ms.
export function useDebounce(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

// Coalesce a burst of calls into a single trailing call. Handy for realtime
// socket events that would otherwise trigger many rapid refetches.
export function useCoalescedCallback(fn, delay = 400) {
  const fnRef = useRef(fn);
  useEffect(() => {
    fnRef.current = fn;
  }, [fn]);
  const timer = useRef(null);
  return useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => fnRef.current?.(), delay);
  }, [delay]);
}
