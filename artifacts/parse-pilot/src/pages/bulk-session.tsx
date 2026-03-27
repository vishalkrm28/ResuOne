import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { AppLayout } from "@/components/layout/app-layout";
import {
  Users, ArrowRight, Loader2, FilePlus2, CheckCircle2,
  AlertCircle, ChevronRight, Lock, Crown,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface BulkStatus {
  isPro: boolean;
  activePass: {
    id: string;
    tier: string;
    cvLimit: number;
    cvsUsed: number;
    remaining: number;
    status: string;
  } | null;
  totalPassesPurchased: number;
  showProUpsell: boolean;
}

interface CreditStatus {
  availableCredits: number;
  planAllowance: number;
  isPro: boolean;
}

// ─── Slot progress bar ────────────────────────────────────────────────────────

function SlotProgress({ used, limit }: { used: number; limit: number }) {
  const pct = Math.round((used / limit) * 100);
  const remaining = limit - used;
  const isAlmostFull = remaining <= Math.ceil(limit * 0.2);

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="font-semibold text-sm">CV slots used</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {remaining} remaining of {limit} in this pass
          </p>
        </div>
        <span
          className={cn(
            "text-2xl font-extrabold",
            isAlmostFull ? "text-amber-500" : "text-foreground",
          )}
        >
          {used}/{limit}
        </span>
      </div>
      <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            isAlmostFull ? "bg-amber-500" : "bg-primary",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      {isAlmostFull && remaining > 0 && (
        <p className="text-xs text-amber-600 mt-2 flex items-center gap-1.5">
          <AlertCircle className="w-3.5 h-3.5" />
          {remaining} slot{remaining !== 1 ? "s" : ""} left — consider buying more
        </p>
      )}
      {remaining === 0 && (
        <p className="text-xs text-red-600 mt-2 flex items-center gap-1.5">
          <AlertCircle className="w-3.5 h-3.5" />
          All slots used — purchase a new pass to continue
        </p>
      )}
    </div>
  );
}

// ─── How it works ─────────────────────────────────────────────────────────────

function HowItWorks() {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h3 className="font-semibold text-sm mb-4">How bulk analysis works</h3>
      <div className="space-y-4">
        {[
          {
            num: "1",
            title: "Start a new analysis",
            body: "Each CV you analyze uses one slot from your bulk pass. Full results are included — no additional unlock fee.",
          },
          {
            num: "2",
            title: "Upload CV + job description",
            body: "Paste the job description and upload the candidate's CV (PDF or DOCX).",
          },
          {
            num: "3",
            title: "Get the full score + rewrite",
            body: "See the ATS match score, missing keywords, and optimised CV — all included in your bulk pass.",
          },
        ].map((step) => (
          <div key={step.num} className="flex gap-3">
            <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
              {step.num}
            </div>
            <div>
              <p className="text-sm font-semibold">{step.title}</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{step.body}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function BulkSession() {
  const [status, setStatus] = useState<BulkStatus | null>(null);
  const [credits, setCredits] = useState<CreditStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [, navigate] = useLocation();

  useEffect(() => {
    Promise.all([
      fetch("/api/billing/bulk-status", { credentials: "include" })
        .then((r) => (r.ok ? r.json() : null)),
      fetch("/api/billing/credits", { credentials: "include" })
        .then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([s, c]) => {
        setStatus(s);
        setCredits(c);
      })
      .finally(() => setLoading(false));
  }, []);

  const hasAccess =
    status?.isPro ||
    (status?.activePass && status.activePass.remaining > 0);
  const remaining =
    status?.isPro
      ? credits?.availableCredits ?? 0
      : status?.activePass?.remaining ?? 0;
  const limit =
    status?.isPro
      ? credits?.planAllowance ?? 100
      : status?.activePass?.cvLimit ?? 0;
  const used = limit - remaining;

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto">
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
          <h1 className="text-2xl font-extrabold tracking-tight mb-1">
            Bulk analysis session
          </h1>
          <p className="text-sm text-muted-foreground">
            Each CV you analyze uses one slot. Full results are included in your pass.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : !hasAccess ? (
          // No access state
          <div className="text-center py-16">
            <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
              <Lock className="w-6 h-6 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-bold mb-2">No active bulk pass</h2>
            <p className="text-muted-foreground text-sm mb-6 max-w-sm mx-auto">
              Purchase a bulk pass to start analyzing multiple CVs with full results included.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={() => navigate("/bulk")}
                className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-opacity"
              >
                <Users className="w-4 h-4" />
                View bulk pricing
              </button>
              <button
                onClick={() => navigate("/")}
                className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl border border-border text-sm font-medium hover:bg-muted/40 transition-colors"
              >
                Back to dashboard
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Pro badge */}
            {status?.isPro && (
              <div className="flex items-center gap-2 text-sm text-violet-700 bg-violet-500/5 border border-violet-500/20 rounded-xl px-4 py-3">
                <Crown className="w-4 h-4" />
                <span>Pro plan — using credits ({remaining} remaining)</span>
              </div>
            )}

            {/* Slot progress */}
            {!status?.isPro && status?.activePass && (
              <SlotProgress used={used} limit={limit} />
            )}

            {/* Start new analysis CTA */}
            <div className="rounded-2xl border-2 border-primary bg-primary/5 p-6 text-center">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
                <FilePlus2 className="w-5 h-5 text-primary" />
              </div>
              <h3 className="font-bold mb-1.5">Start a new CV analysis</h3>
              <p className="text-sm text-muted-foreground mb-5">
                Upload a CV and paste a job description. Full results are included — no
                additional payment needed.
              </p>
              <button
                onClick={() => navigate("/new")}
                className="inline-flex items-center gap-2 px-7 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-opacity"
              >
                <FilePlus2 className="w-4 h-4" />
                Analyze a CV
                <ArrowRight className="w-4 h-4" />
              </button>
              {remaining > 0 && (
                <p className="text-xs text-muted-foreground mt-3">
                  {remaining} slot{remaining !== 1 ? "s" : ""} remaining in this pass
                </p>
              )}
            </div>

            {/* How it works */}
            <HowItWorks />

            {/* Key reminders */}
            <div className="grid sm:grid-cols-2 gap-3">
              {[
                {
                  icon: CheckCircle2,
                  color: "text-emerald-500",
                  title: "Full results included",
                  body: "No $6.99 unlock fee per CV — it's all included in your bulk pass.",
                },
                {
                  icon: CheckCircle2,
                  color: "text-emerald-500",
                  title: "Export as DOCX or PDF",
                  body: "Download any optimised CV directly — all exports included.",
                },
              ].map((card) => (
                <div key={card.title} className="rounded-xl border border-border bg-card p-4">
                  <card.icon className={cn("w-4 h-4 mb-2", card.color)} />
                  <p className="text-sm font-semibold mb-1">{card.title}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{card.body}</p>
                </div>
              ))}
            </div>

            {/* View all results link */}
            <button
              onClick={() => navigate("/")}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              View all your analyses on the dashboard
              <ChevronRight className="w-4 h-4" />
            </button>

            {/* Buy more link */}
            {!status?.isPro && (
              <div className="pt-2 border-t border-border/40">
                <button
                  onClick={() => navigate("/bulk")}
                  className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Need more slots? Buy another bulk pass
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
