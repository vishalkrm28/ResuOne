import { useState, useEffect } from "react";
import { authedFetch } from "@/lib/authed-fetch";
import { AppLayout } from "@/components/layout/app-layout";
import {
  Sparkles, Crown, CheckCircle2, ArrowRight, Zap, Users,
  Star, Info, X, Loader2, ChevronRight, TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@workspace/replit-auth-web";
import { useLocation } from "wouter";

// ─── Types ────────────────────────────────────────────────────────────────────

interface BulkTier {
  id: string;
  cvLimit: number;
  amountDollars: number;
  badge: string | null;
  tagline: string;
  label: string;
}

interface BulkStatus {
  isPro: boolean;
  activePass: {
    id: string;
    tier: string;
    cvLimit: number;
    cvsUsed: number;
    remaining: number;
  } | null;
  totalPassesPurchased: number;
  showProUpsell: boolean;
}

// ─── Tier upsell config ───────────────────────────────────────────────────────

const UPSELL_FROM: Record<string, { targetId: string; savingDollars: number; message: string }> = {
  "10": {
    targetId: "25",
    savingDollars: 10,
    message: "You're analyzing multiple candidates. For just $10 more, you can analyze 25 CVs instead of 10.",
  },
  "25": {
    targetId: "50",
    savingDollars: 10,
    message: "Planning to analyze more profiles? Upgrade to 50 CVs for full flexibility.",
  },
};

// ─── UpsellModal ─────────────────────────────────────────────────────────────

function UpsellModal({
  fromTier,
  toTier,
  onUpgrade,
  onContinue,
  onClose,
  loading,
}: {
  fromTier: BulkTier;
  toTier: BulkTier;
  onUpgrade: () => void;
  onContinue: () => void;
  onClose: () => void;
  loading: boolean;
}) {
  const upsell = UPSELL_FROM[fromTier.id];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-card rounded-2xl border border-border shadow-2xl max-w-md w-full p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
          <TrendingUp className="w-5 h-5 text-primary" />
        </div>

        <h3 className="text-lg font-bold mb-2">One small upgrade, much more capacity</h3>
        <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
          {upsell?.message}
        </p>

        {/* Comparison */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="rounded-xl border border-border bg-muted/30 p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">You selected</p>
            <p className="text-xl font-bold">{fromTier.cvLimit} CVs</p>
            <p className="text-sm font-semibold text-primary">${fromTier.amountDollars}</p>
          </div>
          <div className="rounded-xl border-2 border-primary bg-primary/5 p-4 text-center relative">
            <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs font-semibold px-2.5 py-0.5 rounded-full whitespace-nowrap">
              Recommended
            </span>
            <p className="text-xs text-muted-foreground mb-1">Upgrade to</p>
            <p className="text-xl font-bold">{toTier.cvLimit} CVs</p>
            <p className="text-sm font-semibold text-primary">${toTier.amountDollars}</p>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <button
            onClick={onUpgrade}
            disabled={loading}
            className="flex items-center justify-center gap-2 w-full px-5 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-60"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            Upgrade to {toTier.cvLimit} CVs — ${toTier.amountDollars}
          </button>
          <button
            onClick={onContinue}
            disabled={loading}
            className="flex items-center justify-center gap-2 w-full px-5 py-3 rounded-xl border border-border text-sm font-medium hover:bg-muted/40 transition-colors disabled:opacity-60"
          >
            Continue with {fromTier.cvLimit} CVs
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── ProUpsellBanner ─────────────────────────────────────────────────────────

function ProUpsellBanner({ onUpgrade }: { onUpgrade: () => void }) {
  return (
    <div className="rounded-2xl border border-violet-500/30 bg-gradient-to-r from-violet-500/5 to-indigo-500/5 p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
      <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center flex-shrink-0">
        <Crown className="w-5 h-5 text-violet-500" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm mb-0.5">Analyzing your own CV for multiple roles? Try Pro</p>
        <p className="text-sm text-muted-foreground">
          Pro is designed for job seekers — $14.99/month, 100 analyses of your own CV across many roles.
        </p>
      </div>
      <button
        onClick={onUpgrade}
        className="flex items-center gap-1.5 text-sm font-semibold text-violet-600 hover:text-violet-700 transition-colors whitespace-nowrap flex-shrink-0"
      >
        Start Pro
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}

// ─── ActivePassBanner ─────────────────────────────────────────────────────────

function ActivePassBanner({
  pass,
  onGoToSession,
}: {
  pass: NonNullable<BulkStatus["activePass"]>;
  onGoToSession: () => void;
}) {
  const pct = Math.round((pass.cvsUsed / pass.cvLimit) * 100);
  const isAlmostFull = pass.remaining <= Math.ceil(pass.cvLimit * 0.2);
  const isEmpty = pass.remaining === 0;
  return (
    <div className={cn(
      "rounded-2xl border p-5",
      isEmpty
        ? "border-red-300/40 bg-red-500/5 dark:border-red-900/40"
        : isAlmostFull
        ? "border-amber-400/40 bg-amber-500/5"
        : "border-emerald-500/30 bg-emerald-500/5"
    )}>
      <div className="flex items-start justify-between gap-4 mb-3">
        <div>
          <p className={cn("font-semibold text-sm", isEmpty ? "text-red-600" : isAlmostFull ? "text-amber-700" : "text-emerald-700")}>
            {isEmpty ? "Pass fully used — buy more below ↓" : "Active bulk pass"}
          </p>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isEmpty
              ? `All ${pass.cvLimit} CV slots have been used.`
              : `${pass.remaining} of ${pass.cvLimit} CV slots remaining`}
          </p>
        </div>
        {!isEmpty && (
          <button
            onClick={onGoToSession}
            className={cn(
              "flex items-center gap-1.5 text-sm font-semibold transition-colors whitespace-nowrap",
              isAlmostFull ? "text-amber-700 hover:text-amber-800" : "text-emerald-700 hover:text-emerald-800"
            )}
          >
            Start analyzing
            <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>
      <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", isEmpty ? "bg-red-500" : isAlmostFull ? "bg-amber-500" : "bg-emerald-500")}
          style={{ width: `${pct}%` }}
        />
      </div>
      {isAlmostFull && !isEmpty && (
        <p className="text-xs text-amber-700 mt-2 font-medium">
          Running low — top up your slot balance below to avoid running out mid-batch.
        </p>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function BulkPricing() {
  const [tiers, setTiers] = useState<BulkTier[]>([]);
  const [status, setStatus] = useState<BulkStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);

  const [selectedTier, setSelectedTier] = useState<BulkTier | null>(null);
  const [upsellTier, setUpsellTier] = useState<BulkTier | null>(null);
  const [showUpsell, setShowUpsell] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [, navigate] = useLocation();
  const { user } = useAuth();

  // Load tiers and user's bulk status
  useEffect(() => {
    Promise.all([
      authedFetch("/api/billing/bulk-tiers").then((r) => r.json()),
      authedFetch("/api/billing/bulk-status").then((r) =>
        r.ok ? r.json() : null,
      ),
    ])
      .then(([tiersData, statusData]) => {
        setTiers(tiersData.tiers ?? []);
        setStatus(statusData);
      })
      .catch(() => {})
      .finally(() => setLoadingStatus(false));
  }, []);

  const goToProCheckout = async () => {
    try {
      const base = window.location.origin;
      const res = await authedFetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          successUrl: `${base}/billing/success`,
          cancelUrl: `${base}/bulk`,
        }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch {
      setError("Could not start checkout. Please try again.");
    }
  };

  const startCheckout = async (tier: BulkTier) => {
    setCheckoutLoading(true);
    setError(null);
    try {
      const base = window.location.origin;
      const res = await authedFetch("/api/billing/bulk-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tier: tier.id,
          successUrl: `${base}/bulk/success`,
          cancelUrl: `${base}/bulk`,
        }),
      });
      const data = await res.json();

      // Pro override: no Stripe redirect, go straight to session
      if (data.mode === "pro_credits") {
        navigate("/bulk/session");
        return;
      }

      if (data.url) {
        window.location.href = data.url;
      } else {
        setError(data.error ?? "Could not start checkout. Please try again.");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setCheckoutLoading(false);
    }
  };

  const handleSelectTier = (tier: BulkTier) => {
    const upsell = UPSELL_FROM[tier.id];
    if (upsell) {
      const upgradeTier = tiers.find((t) => t.id === upsell.targetId);
      if (upgradeTier) {
        setSelectedTier(tier);
        setUpsellTier(upgradeTier);
        setShowUpsell(true);
        return;
      }
    }
    startCheckout(tier);
  };

  const tierById = (id: string) => tiers.find((t) => t.id === id);

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Users className="w-4 h-4 text-primary" />
            </div>
            <span className="text-sm font-semibold text-primary uppercase tracking-wider">
              Bulk Mode
            </span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight mb-2">
            Analyze multiple CVs at once
          </h1>
          <p className="text-muted-foreground">
            Buy a batch of full CV analyses — scoring, keyword gaps, and optimised output for
            every candidate. No per-unlock fees.
          </p>
        </div>

        {/* Active pass banner */}
        {status?.activePass && (
          <div className="mb-6">
            <ActivePassBanner
              pass={status.activePass}
              onGoToSession={() => navigate("/bulk/session")}
            />
          </div>
        )}

        {/* Pro upsell banner */}
        {status?.showProUpsell && !status.isPro && (
          <div className="mb-6">
            <ProUpsellBanner onUpgrade={goToProCheckout} />
          </div>
        )}

        {/* Pro override notice */}
        {status?.isPro && (
          <div className="mb-6 flex items-start gap-3 p-4 rounded-xl bg-violet-500/5 border border-violet-500/20 text-sm text-violet-700">
            <Crown className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>
              You're on Pro. Bulk tiers will be charged from your credit balance instead of
              a separate payment. 1 CV = 1 credit.
            </span>
          </div>
        )}

        {/* Anchor: single vs bulk comparison */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-6 p-3 rounded-lg bg-muted/30 border border-border/50">
          <Info className="w-3.5 h-3.5 flex-shrink-0" />
          <span>
            <strong className="text-foreground">Single CV analysis:</strong> $6.99 per unlock ·{" "}
            <strong className="text-foreground">Bulk starts at:</strong> $19 for 10 CVs — better
            value the more you analyze
          </span>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Pricing tiers */}
        {/* Section header when user has an existing pass */}
        {status?.activePass && (
          <div className="mb-4">
            <p className="text-sm font-bold text-foreground">
              {status.activePass.remaining === 0
                ? "Top up — buy a new pass"
                : "Need more capacity? Add another pass"}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Additional passes stack — slots are consumed from the most recently purchased pass first.
            </p>
          </div>
        )}

        {loadingStatus ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid sm:grid-cols-3 gap-4 mb-10">
            {tiers.map((tier) => {
              const isHighlighted = tier.badge === "Most Popular";
              const perCv = (tier.amountDollars / tier.cvLimit).toFixed(2);
              const isCurrentTier = status?.activePass?.tier === tier.id;
              const hasExistingPass = !!status?.activePass;

              return (
                <div
                  key={tier.id}
                  className={cn(
                    "rounded-2xl border bg-card p-5 flex flex-col transition-shadow hover:shadow-md",
                    isHighlighted
                      ? "border-primary shadow-primary/20 shadow-md ring-2 ring-primary"
                      : "border-border",
                  )}
                >
                  {/* Badge row */}
                  <div className="flex items-center gap-2 mb-3 min-h-[20px]">
                    {tier.badge && (
                      <span
                        className={cn(
                          "text-xs font-bold px-2.5 py-0.5 rounded-full whitespace-nowrap",
                          tier.badge === "Most Popular"
                            ? "bg-primary text-primary-foreground"
                            : "bg-amber-500 text-white",
                        )}
                      >
                        {tier.badge === "Most Popular" ? (
                          <span className="flex items-center gap-1">
                            <Star className="w-3 h-3" />
                            {tier.badge}
                          </span>
                        ) : (
                          tier.badge
                        )}
                      </span>
                    )}
                    {isCurrentTier && (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 whitespace-nowrap">
                        Current pass
                      </span>
                    )}
                  </div>

                  {/* Price */}
                  <div className="mb-3">
                    <p className="text-3xl font-extrabold">
                      ${tier.amountDollars}
                      <span className="text-sm font-normal text-muted-foreground ml-1">
                        one-time
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      ${perCv} per CV
                    </p>
                  </div>

                  {/* CV limit */}
                  <p className="text-base font-bold mb-1">
                    {tier.cvLimit} CV slots
                  </p>
                  <p className="text-xs text-muted-foreground mb-5 leading-relaxed">
                    {tier.tagline}
                  </p>

                  {/* Features */}
                  <ul className="space-y-1.5 mb-6 flex-1">
                    {[
                      "Full ATS match score per candidate",
                      "Missing keywords analysis",
                      "ATS-optimised CV output per candidate",
                      "Export as DOCX or PDF",
                    ].map((f) => (
                      <li key={f} className="flex items-center gap-2 text-xs text-muted-foreground">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>

                  <button
                    onClick={() => handleSelectTier(tier)}
                    disabled={checkoutLoading}
                    className={cn(
                      "flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl font-semibold text-sm transition-all disabled:opacity-50",
                      isHighlighted
                        ? "bg-primary text-primary-foreground hover:opacity-90"
                        : "border border-border hover:border-primary/40 hover:bg-primary/5",
                    )}
                  >
                    {checkoutLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        {hasExistingPass ? `Buy ${tier.cvLimit} more slots` : `Get ${tier.cvLimit} CV slots`}
                        <ArrowRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Pro vs Bulk clarification */}
        {!status?.isPro && (
          <div className="rounded-2xl border border-border bg-muted/20 p-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center flex-shrink-0">
                <Crown className="w-5 h-5 text-violet-500" />
              </div>
              <div className="flex-1">
                <p className="font-bold mb-1">Not sure which to choose?</p>
                <div className="grid sm:grid-cols-2 gap-3 mb-4 mt-3">
                  <div className="rounded-xl bg-background border border-border p-4">
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Bulk Mode</p>
                    <p className="text-sm font-semibold mb-1">Multiple candidates</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      You're a recruiter or hiring manager reviewing different people's CVs for one or more roles.
                    </p>
                    <p className="text-xs font-semibold text-primary mt-2">From $19 one-time</p>
                  </div>
                  <div className="rounded-xl bg-violet-500/5 border border-violet-500/20 p-4">
                    <p className="text-xs font-bold uppercase tracking-wider text-violet-500 mb-2">Pro Plan</p>
                    <p className="text-sm font-semibold mb-1">Your own career</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      You're a job seeker tailoring your own CV for many different roles over time.
                    </p>
                    <p className="text-xs font-semibold text-violet-600 mt-2">$14.99/month · 100 analyses</p>
                  </div>
                </div>
                <button
                  onClick={goToProCheckout}
                  className="flex items-center gap-2 text-sm font-semibold text-violet-600 hover:text-violet-700 transition-colors"
                >
                  <Sparkles className="w-4 h-4" />
                  Upgrade to Pro
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Upsell modal */}
      {showUpsell && selectedTier && upsellTier && (
        <UpsellModal
          fromTier={selectedTier}
          toTier={upsellTier}
          loading={checkoutLoading}
          onUpgrade={() => {
            setShowUpsell(false);
            startCheckout(upsellTier);
          }}
          onContinue={() => {
            setShowUpsell(false);
            startCheckout(selectedTier);
          }}
          onClose={() => setShowUpsell(false)}
        />
      )}
    </AppLayout>
  );
}
