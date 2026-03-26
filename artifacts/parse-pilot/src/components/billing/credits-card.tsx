import { Zap, RefreshCw, Loader2, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/Card";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { useCredits } from "@/hooks/use-credits";
import { format } from "date-fns";

export function CreditsCard() {
  const { credits, loading, error } = useCredits();

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-10">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (error || !credits) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          Could not load credit balance. Please refresh.
        </CardContent>
      </Card>
    );
  }

  const { availableCredits, planAllowance, lifetimeCreditsUsed, billingPeriodEnd, isPro } = credits;
  const pct = planAllowance > 0 ? Math.round((availableCredits / planAllowance) * 100) : 0;
  const low = availableCredits === 0;
  const warn = !low && pct <= 25;

  return (
    <Card className={cn("relative overflow-hidden", low && "border-red-500/30")}>
      <CardContent className="p-6 space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <div className={cn(
              "w-9 h-9 rounded-xl flex items-center justify-center",
              low
                ? "bg-red-500/10"
                : warn
                  ? "bg-amber-500/10"
                  : "bg-violet-500/10",
            )}>
              <Zap className={cn(
                "w-4 h-4",
                low ? "text-red-500" : warn ? "text-amber-500" : "text-violet-500",
              )} />
            </div>
            <div>
              <p className="font-semibold text-sm leading-tight">AI Credits</p>
              <p className="text-xs text-muted-foreground">
                {isPro ? "Resets each billing period" : "Free plan allowance"}
              </p>
            </div>
          </div>

          <div className="text-right">
            <p className={cn(
              "text-2xl font-bold",
              low ? "text-red-500" : warn ? "text-amber-500" : "text-foreground",
            )}>
              {availableCredits}
              <span className="text-sm font-normal text-muted-foreground"> / {planAllowance}</span>
            </p>
            <p className="text-xs text-muted-foreground">remaining</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              low
                ? "bg-red-500"
                : warn
                  ? "bg-amber-500"
                  : "bg-violet-500",
            )}
            style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
          />
        </div>

        {/* Usage stats */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <TrendingUp className="w-3 h-3" />
            {lifetimeCreditsUsed} used lifetime
          </span>
          {isPro && billingPeriodEnd && (
            <span className="flex items-center gap-1">
              <RefreshCw className="w-3 h-3" />
              Resets {format(new Date(billingPeriodEnd), "MMM d, yyyy")}
            </span>
          )}
        </div>

        {/* Credit cost table */}
        <div className="rounded-lg border border-border bg-muted/30 divide-y divide-border text-sm">
          <div className="flex items-center justify-between px-3 py-2">
            <span className="text-muted-foreground">CV optimization</span>
            <span className="font-medium">1 credit</span>
          </div>
          <div className="flex items-center justify-between px-3 py-2">
            <span className="text-muted-foreground">Cover letter</span>
            <span className="font-medium">1 credit</span>
          </div>
          <div className="flex items-center justify-between px-3 py-2">
            <span className="text-muted-foreground">DOCX / PDF export</span>
            <span className="font-medium text-emerald-600">Free</span>
          </div>
        </div>

        {/* Upgrade / low-credits CTA */}
        {low && !isPro && (
          <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-700">
            You've used all your free credits.{" "}
            <Link href="/settings" className="font-semibold underline underline-offset-2 hover:text-red-900">
              Upgrade to Pro
            </Link>{" "}
            for 100 credits per billing period.
          </div>
        )}
        {low && isPro && (
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm text-amber-800">
            You've used all your Pro credits for this billing period.{" "}
            {billingPeriodEnd && (
              <>They reset on {format(new Date(billingPeriodEnd), "MMMM d, yyyy")}.</>
            )}{" "}
            <Link href="/settings" className="font-semibold underline underline-offset-2 hover:text-amber-900">
              Manage billing
            </Link>
          </div>
        )}
        {warn && !low && !isPro && (
          <p className="text-xs text-amber-700">
            Running low.{" "}
            <Link href="/settings" className="font-semibold underline underline-offset-2">
              Upgrade to Pro
            </Link>{" "}
            for 100 credits per month.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
