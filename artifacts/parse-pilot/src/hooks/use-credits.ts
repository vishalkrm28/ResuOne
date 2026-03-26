import { useState, useEffect } from "react";

export interface CreditsStatus {
  availableCredits: number;
  lifetimeCreditsUsed: number;
  billingPeriodEnd: string | null;
}

interface UseCreditsResult {
  credits: CreditsStatus | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useCredits(): UseCreditsResult {
  const [credits, setCredits] = useState<CreditsStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    fetch("/api/billing/credits", { credentials: "include" })
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load credits");
        return r.json() as Promise<CreditsStatus>;
      })
      .then((data) => {
        if (!cancelled) {
          setCredits(data);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Unknown error");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [tick]);

  return {
    credits,
    loading,
    error,
    refetch: () => setTick((t) => t + 1),
  };
}
