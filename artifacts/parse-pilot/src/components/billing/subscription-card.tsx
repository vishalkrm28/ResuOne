import { useEffect, useState } from "react";
import { authedFetch } from "@/lib/authed-fetch";
import { Sparkles, Crown, Calendar, Loader2, CheckCircle2, Circle, AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { UpgradeButton } from "./upgrade-button";
import { ManageBillingButton } from "./manage-billing-button";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

interface BillingStatus {
  isPro: boolean;
  subscriptionStatus: string | null;
  subscriptionPriceId: string | null;
  currentPeriodEnd: string | null;
  hasCustomer: boolean;
}

const FREE_FEATURES = [
  "Upload & parse your CV",
  "Paste job descriptions",
  "AI keyword analysis",
  "1 saved application",
];

const PRO_FEATURES = [
  "Everything in Free",
  "ATS-optimised tailored CVs",
  "Missing info questions",
  "Section suggestions",
  "Cover letter generation",
  "DOCX & PDF export",
  "Unlimited applications",
];

function PlanFeature({ text, included }: { text: string; included: boolean }) {
  return (
    <li className={cn("flex items-center gap-2.5 text-sm", included ? "text-foreground" : "text-muted-foreground")}>
      {included ? (
        <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
      ) : (
        <Circle className="w-4 h-4 text-muted-foreground/30 flex-shrink-0" />
      )}
      {text}
    </li>
  );
}

export function SubscriptionCard() {
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelConfirm, setCancelConfirm] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    authedFetch("/api/billing/status")
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load billing status");
        return r.json() as Promise<BillingStatus>;
      })
      .then(setStatus)
      .catch((err) => setError(err instanceof Error ? err.message : "Unknown error"))
      .finally(() => setLoading(false));
  }, []);

  async function handleCancelSubscription() {
    setCancelling(true);
    try {
      const res = await authedFetch("/api/billing/cancel-subscription", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to cancel");
      setStatus((s) => s ? { ...s, subscriptionStatus: "canceled" } : s);
      setCancelConfirm(false);
      toast({ title: "Subscription cancelled", description: "You'll keep Pro access until your billing period ends." });
    } catch (err) {
      toast({ title: "Could not cancel", description: err instanceof Error ? err.message : "Please try again.", variant: "destructive" });
    } finally {
      setCancelling(false);
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (error || !status) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Could not load billing information. Please refresh the page.
        </CardContent>
      </Card>
    );
  }

  const { isPro, subscriptionStatus, currentPeriodEnd } = status;

  const statusLabel: Record<string, string> = {
    active: "Active",
    trialing: "Trial",
    past_due: "Past Due",
    canceled: "Cancelled",
    incomplete: "Incomplete",
    paused: "Paused",
  };

  const statusColors: Record<string, string> = {
    active: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
    trialing: "bg-blue-500/10 text-blue-600 border-blue-500/20",
    past_due: "bg-amber-500/10 text-amber-600 border-amber-500/20",
    canceled: "bg-muted text-muted-foreground border-muted-foreground/20",
    incomplete: "bg-muted text-muted-foreground border-muted-foreground/20",
    paused: "bg-muted text-muted-foreground border-muted-foreground/20",
  };

  return (
    <div className="grid gap-5 sm:grid-cols-2">
      {/* ── Free plan card ─────────────────────────── */}
      <Card className={cn(!isPro && "ring-2 ring-primary")}>
        <CardContent className="p-6 flex flex-col gap-5">
          {!isPro && (
            <span className="self-start bg-primary text-primary-foreground text-xs font-semibold px-3 py-0.5 rounded-full">
              Current plan
            </span>
          )}

          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                Free
              </p>
              <p className="text-3xl font-bold">$0</p>
              <p className="text-sm text-muted-foreground mt-0.5">forever</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-muted-foreground" />
            </div>
          </div>

          <ul className="space-y-2.5">
            {FREE_FEATURES.map((f) => (
              <PlanFeature key={f} text={f} included={true} />
            ))}
          </ul>

          <div className="mt-auto pt-2">
            {!isPro ? (
              <p className="text-xs text-muted-foreground text-center">Your current plan</p>
            ) : (
              <p className="text-xs text-muted-foreground text-center">Included in your Pro plan</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Pro plan card ──────────────────────────── */}
      <Card className={cn(isPro && "ring-2 ring-violet-500")}>
        <CardContent className="p-6 flex flex-col gap-5">
          {isPro && (
            <span className="self-start bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-xs font-semibold px-3 py-0.5 rounded-full">
              Current plan
            </span>
          )}

          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-violet-500 mb-1">
                Pro
              </p>
              <p className="text-3xl font-bold">$14.99</p>
              <p className="text-sm text-muted-foreground mt-0.5">per month</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/10 to-indigo-500/10 flex items-center justify-center">
              <Crown className="w-5 h-5 text-violet-500" />
            </div>
          </div>

          <ul className="space-y-2.5">
            {PRO_FEATURES.map((f) => (
              <PlanFeature key={f} text={f} included={true} />
            ))}
          </ul>

          {/* Status + billing date */}
          {isPro && (
            <div className="space-y-2 pt-1">
              {subscriptionStatus && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Status:</span>
                  <Badge
                    className={cn(
                      "text-xs border",
                      statusColors[subscriptionStatus] ?? statusColors.canceled,
                    )}
                  >
                    {statusLabel[subscriptionStatus] ?? subscriptionStatus}
                  </Badge>
                </div>
              )}
              {currentPeriodEnd && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>
                    {subscriptionStatus === "canceled"
                      ? "Access until"
                      : subscriptionStatus === "trialing"
                        ? "Trial ends"
                        : "Renews"}{" "}
                    <span className="font-medium text-foreground">
                      {format(new Date(currentPeriodEnd), "MMMM d, yyyy")}
                    </span>
                  </span>
                </div>
              )}
              {subscriptionStatus === "trialing" && (
                <p className="text-xs text-muted-foreground rounded-md border border-amber-500/20 bg-amber-500/5 px-3 py-2 leading-relaxed">
                  You will be charged automatically when your trial ends unless you cancel before then.
                </p>
              )}
            </div>
          )}

          <div className="mt-auto pt-2 space-y-2">
            {isPro ? (
              <>
                <ManageBillingButton className="w-full" />
                {subscriptionStatus !== "canceled" && (
                  <>
                    {!cancelConfirm ? (
                      <button
                        onClick={() => setCancelConfirm(true)}
                        className="w-full text-xs text-muted-foreground hover:text-destructive transition-colors py-1.5 underline-offset-2 hover:underline"
                      >
                        Cancel subscription
                      </button>
                    ) : (
                      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 space-y-2">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
                          <p className="text-xs text-foreground leading-snug">
                            You'll keep Pro access until your billing period ends. This cannot be undone.
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setCancelConfirm(false)}
                            disabled={cancelling}
                            className="flex-1 text-xs py-1.5 px-3 rounded-md border border-border hover:bg-muted transition-colors disabled:opacity-50"
                          >
                            Keep plan
                          </button>
                          <button
                            onClick={handleCancelSubscription}
                            disabled={cancelling}
                            className="flex-1 text-xs py-1.5 px-3 rounded-md bg-destructive text-destructive-foreground hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-1"
                          >
                            {cancelling ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                            {cancelling ? "Cancelling…" : "Yes, cancel"}
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </>
            ) : (
              <UpgradeButton className="w-full" />
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
