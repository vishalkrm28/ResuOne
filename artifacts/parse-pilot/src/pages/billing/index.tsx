import { useState, useEffect, useCallback } from "react";
import {
  CreditCard, Zap, CheckCircle2, XCircle, Loader2,
  TrendingUp, BarChart2, ArrowUpRight, RefreshCw,
} from "lucide-react";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  listPlans,
  getCreditBalance,
  getBillingStatus,
  FEATURE_LABELS,
  type Plan,
  type CreditBalance,
} from "@/lib/billing-api";

const PLAN_COLORS: Record<string, { badge: string; border: string; button: string }> = {
  free: { badge: "bg-gray-100 text-gray-700", border: "border-gray-200", button: "bg-gray-600 hover:bg-gray-700" },
  pro: { badge: "bg-blue-50 text-blue-700", border: "border-blue-200", button: "bg-blue-600 hover:bg-blue-700" },
  recruiter_solo: { badge: "bg-purple-50 text-purple-700", border: "border-purple-200", button: "bg-purple-600 hover:bg-purple-700" },
  recruiter_team: { badge: "bg-green-50 text-green-700", border: "border-green-200", button: "bg-green-600 hover:bg-green-700" },
};

const TX_TYPE_LABELS: Record<string, string> = {
  credits_init: "Initial Credits",
  credits_reset_pro: "Pro Renewal",
  credits_reset_recruiter: "Recruiter Renewal",
  cv_optimization: "CV Analysis",
  cover_letter: "Cover Letter",
  tailored_cv: "Tailored CV",
  interview_prep: "Interview Prep",
  email_draft: "Email Draft",
  mock_interview_session: "Mock Interview",
  mock_interview_evaluate: "Answer Evaluation",
  job_rec_credits_granted: "Job Rec Credits Added",
  job_rec_credit_spent: "Job Recommendation",
  identity_switch: "Identity Switch Penalty",
};

function FeatureRow({ featureKey, value }: { featureKey: string; value: Record<string, unknown> }) {
  const enabled = value.enabled === true;
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
      <span className="text-xs text-muted-foreground">{FEATURE_LABELS[featureKey] ?? featureKey.replace(/_/g, " ")}</span>
      <div className="flex items-center gap-1.5">
        {enabled ? (
          <>
            <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
            {value.limit !== undefined && (
              <span className="text-[11px] text-muted-foreground">up to {String(value.limit)}</span>
            )}
            {value.max_members !== undefined && (
              <span className="text-[11px] text-muted-foreground">{String(value.max_members)} seats</span>
            )}
          </>
        ) : (
          <XCircle className="w-3.5 h-3.5 text-muted-foreground/40" />
        )}
      </div>
    </div>
  );
}

export default function BillingPage() {
  const { toast } = useToast();

  const [plans, setPlans] = useState<Plan[]>([]);
  const [balance, setBalance] = useState<CreditBalance | null>(null);
  const [billingStatus, setBillingStatus] = useState<{
    isPro: boolean;
    isRecruiter: boolean;
    planCode: string;
    subscriptionStatus: string | null;
    subscriptionPriceId: string | null;
    currentPeriodEnd: string | null;
    hasBulkAccess: boolean;
    hasCustomer: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentPlanCode, setCurrentPlanCode] = useState<string>("free");

  const load = useCallback(async () => {
    try {
      const [ps, bal, status] = await Promise.all([
        listPlans(),
        getCreditBalance().catch(() => null),
        getBillingStatus().catch(() => null),
      ]);
      setPlans(ps);
      setBalance(bal);
      setBillingStatus(status);

      // Resolve plan code using multiple signals in priority order:
      // 1. planCode from /billing/status (most accurate — uses resolvePlanCodeForUser)
      // 2. isRecruiter flag (recruiter users without a teamId → solo)
      // 3. isPro flag (active Stripe Pro subscription)
      // 4. Default to "free"
      const code =
        status?.planCode ||
        (status?.isRecruiter ? "recruiter_solo" : null) ||
        (status?.isPro ? "pro" : null) ||
        "free";
      setCurrentPlanCode(code);
    } catch (err) {
      toast({ variant: "destructive", title: "Failed to load billing info" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const currentPlan = plans.find(p => p.code === currentPlanCode);

  const PLAN_CODE_NAMES: Record<string, string> = {
    free: "Free",
    pro: "Pro",
    recruiter_solo: "Recruiter Solo",
    recruiter_team: "Recruiter Team",
  };

  const planDisplayName =
    currentPlan?.name ??
    PLAN_CODE_NAMES[currentPlanCode] ??
    (billingStatus?.isRecruiter ? "Recruiter" : billingStatus?.isPro ? "Pro" : "Free");

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-primary" />
            Billing & Plan
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Manage your subscription, credits, and feature access.</p>
        </div>

        {/* Status summary row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">Current Plan</p>
              <p className="text-lg font-bold">{planDisplayName}</p>
              {billingStatus?.subscriptionStatus && (
                <span className="text-[11px] bg-green-50 text-green-700 px-2 py-0.5 rounded-full capitalize">
                  {billingStatus.subscriptionStatus}
                </span>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">Credits Remaining</p>
              <p className="text-lg font-bold">{balance?.balance ?? "—"}</p>
              {currentPlan && (
                <p className="text-[11px] text-muted-foreground">{currentPlan.includedCredits} included / billing cycle</p>
              )}
              {billingStatus?.isPro && balance !== null && (
                <p className="text-[11px] text-muted-foreground mt-1">
                  Job search: <span className="font-semibold text-foreground">{balance.jobRecCredits}</span> left
                </p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">Credits Used (lifetime)</p>
              <p className="text-lg font-bold">{balance?.lifetimeUsed ?? "—"}</p>
              {billingStatus?.currentPeriodEnd && (
                <p className="text-[11px] text-muted-foreground">
                  Renews {new Date(billingStatus.currentPeriodEnd).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Current plan features */}
        {currentPlan && (
          <Card className="mb-8">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Zap className="w-4 h-4 text-primary" />
                Features on your {currentPlan.name} plan
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
                {currentPlan.entitlements.map(ent => (
                  <FeatureRow key={ent.featureKey} featureKey={ent.featureKey} value={ent.featureValue} />
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Plan comparison */}
        <div className="mb-8">
          <h2 className="text-base font-semibold mb-4">All Plans</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {plans.map(plan => {
              const colors = PLAN_COLORS[plan.code] ?? PLAN_COLORS.free;
              const isCurrent = plan.code === currentPlanCode;
              return (
                <Card key={plan.id} className={cn("relative", isCurrent && `border-2 ${colors.border}`)}>
                  {isCurrent && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-primary text-primary-foreground">
                      Current
                    </span>
                  )}
                  <CardContent className="p-4 space-y-3">
                    <div>
                      <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${colors.badge}`}>
                        {plan.name}
                      </span>
                      <p className="mt-2 text-2xl font-bold">
                        {Number(plan.monthlyPrice) === 0 ? "Free" : `$${plan.monthlyPrice}`}
                        {Number(plan.monthlyPrice) > 0 && <span className="text-sm font-normal text-muted-foreground">/mo</span>}
                      </p>
                      {Number(plan.yearlyPrice) > 0 && (
                        <p className="text-[11px] text-muted-foreground">${plan.yearlyPrice}/yr</p>
                      )}
                    </div>
                    <div className="text-xs space-y-1 text-muted-foreground">
                      <p className="flex items-center gap-1"><Zap className="w-3 h-3" />{plan.includedCredits} credits/mo</p>
                      <p className="flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        Up to {plan.maxTeamMembers} seat{(plan.maxTeamMembers ?? 1) > 1 ? "s" : ""}
                      </p>
                    </div>
                    <div className="space-y-0.5">
                      {plan.entitlements.slice(0, 5).map(ent => (
                        <div key={ent.featureKey} className="flex items-center gap-1.5 text-[11px]">
                          {ent.featureValue.enabled ? (
                            <CheckCircle2 className="w-3 h-3 text-green-600 flex-shrink-0" />
                          ) : (
                            <XCircle className="w-3 h-3 text-muted-foreground/40 flex-shrink-0" />
                          )}
                          <span className={ent.featureValue.enabled ? "text-foreground" : "text-muted-foreground"}>
                            {FEATURE_LABELS[ent.featureKey] ?? ent.featureKey.replace(/_enabled$/, "").replace(/_/g, " ")}
                          </span>
                        </div>
                      ))}
                    </div>
                    {!isCurrent && (
                      <Button
                        size="sm"
                        className={cn("w-full text-xs h-8 gap-1.5 text-white", colors.button)}
                        onClick={() => window.location.href = "/settings#billing"}
                      >
                        <ArrowUpRight className="w-3.5 h-3.5" />
                        {Number(plan.monthlyPrice) < Number(currentPlan?.monthlyPrice ?? 0) ? "Downgrade" : "Upgrade"}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Recent credit transactions */}
        {balance?.recentTransactions && balance.recentTransactions.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <BarChart2 className="w-4 h-4 text-primary" />
                  Recent Credit Activity
                </CardTitle>
                <button onClick={load} className="text-muted-foreground hover:text-foreground">
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-0">
                {balance.recentTransactions.map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                    <div>
                      <p className="text-xs font-medium">{TX_TYPE_LABELS[tx.type] ?? tx.type}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {new Date(tx.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                      </p>
                    </div>
                    <span className={cn(
                      "text-xs font-semibold",
                      tx.creditsDelta > 0 ? "text-green-600" : "text-red-500",
                    )}>
                      {tx.creditsDelta > 0 ? "+" : ""}{tx.creditsDelta}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
