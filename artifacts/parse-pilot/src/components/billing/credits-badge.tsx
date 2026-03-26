import { Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCredits } from "@/hooks/use-credits";

/**
 * Compact inline badge showing remaining credits.
 * Use in nav bars, headers, or anywhere space is tight.
 */
export function CreditsBadge({ className }: { className?: string }) {
  const { credits, loading } = useCredits();

  if (loading || !credits) return null;

  const { availableCredits } = credits;
  const low = availableCredits === 0;
  const warn = !low && availableCredits <= 1;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
        low
          ? "border-red-500/30 bg-red-500/10 text-red-600"
          : warn
            ? "border-amber-500/30 bg-amber-500/10 text-amber-700"
            : "border-violet-500/20 bg-violet-500/10 text-violet-700",
        className,
      )}
    >
      <Zap className="w-3 h-3" />
      {availableCredits} credit{availableCredits !== 1 ? "s" : ""}
    </span>
  );
}
