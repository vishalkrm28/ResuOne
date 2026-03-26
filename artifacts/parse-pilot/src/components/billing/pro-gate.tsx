import { Lock, Sparkles } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/Button";
import { cn } from "@/lib/utils";

interface ProGateProps {
  /** If true, renders children normally. If false, shows the upgrade wall. */
  isPro: boolean;
  /** Short description of the locked feature shown in the prompt. */
  feature: string;
  /** Optional: render a compact inline lock instead of a full card */
  compact?: boolean;
  children: React.ReactNode;
  className?: string;
}

/**
 * Wraps any feature and renders either the feature (Pro) or an upgrade
 * prompt (Free). The backend also enforces the gate — this is UX only.
 */
export function ProGate({ isPro, feature, compact = false, children, className }: ProGateProps) {
  if (isPro) return <>{children}</>;

  if (compact) {
    return (
      <Link href="/settings">
        <Button
          variant="outline"
          className={cn(
            "gap-2 opacity-70 hover:opacity-100 border-dashed border-violet-400/50 text-violet-600 hover:text-violet-700 hover:border-violet-500 hover:bg-violet-50",
            className,
          )}
          title={`${feature} — upgrade to Pro`}
        >
          <Lock className="w-4 h-4" />
          Pro
        </Button>
      </Link>
    );
  }

  return (
    <div
      className={cn(
        "rounded-2xl border border-dashed border-violet-300 bg-gradient-to-br from-violet-50/60 to-indigo-50/60 p-8 flex flex-col items-center text-center gap-4",
        className,
      )}
    >
      <div className="w-14 h-14 rounded-full bg-gradient-to-br from-violet-100 to-indigo-100 flex items-center justify-center">
        <Lock className="w-6 h-6 text-violet-500" />
      </div>
      <div className="space-y-1.5">
        <h3 className="text-lg font-semibold">{feature}</h3>
        <p className="text-sm text-muted-foreground max-w-xs">
          This feature is included in ParsePilot Pro. Upgrade to unlock it.
        </p>
      </div>
      <Link href="/settings">
        <Button className="gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white border-0 shadow-md">
          <Sparkles className="w-4 h-4" />
          Upgrade to Pro
        </Button>
      </Link>
    </div>
  );
}
