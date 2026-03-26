import { useEffect, useState } from "react";

export interface BillingStatus {
  isPro: boolean;
  subscriptionStatus: string | null;
  currentPeriodEnd: string | null;
  hasCustomer: boolean;
}

interface UseBillingStatusResult {
  status: BillingStatus | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

let _cache: BillingStatus | null = null;
let _cacheTime = 0;
const CACHE_TTL = 30_000; // 30 s — fresh enough for UI gating

export function useBillingStatus(): UseBillingStatusResult {
  const [status, setStatus] = useState<BillingStatus | null>(_cache);
  const [loading, setLoading] = useState(!_cache);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const now = Date.now();
    if (_cache && now - _cacheTime < CACHE_TTL) {
      setStatus(_cache);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch("/api/billing/status", { credentials: "include" })
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load billing status");
        return r.json() as Promise<BillingStatus>;
      })
      .then((data) => {
        if (cancelled) return;
        _cache = data;
        _cacheTime = Date.now();
        setStatus(data);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Unknown error");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [tick]);

  return { status, loading, error, refetch: () => { _cache = null; setTick((t) => t + 1); } };
}
