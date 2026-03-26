import { useState } from "react";
import {
  CheckCircle2,
  XCircle,
  Lock,
  Sparkles,
  Loader2,
  FileText,
  FileDown,
  PenTool,
  ChevronDown,
  ChevronUp,
  BarChart2,
} from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/Card";
import { Button } from "@/components/Button";
import { Textarea } from "@/components/ui/textarea";
import { BlurredLockedSection } from "./blurred-locked-section";
import { UnlockButton } from "@/components/billing/unlock-button";
import { UpgradeButton } from "@/components/billing/upgrade-button";
import { UpgradeCTACard } from "./upgrade-cta-card";

// ─── Types ────────────────────────────────────────────────────────────────────

interface FreePreview {
  summaryPreview: string;
  firstBullet: string;
  lockedSectionsCount: number;
}

interface ScoringComponentResult {
  rawScore: number;
  maxScore: number;
  matched: number;
  total: number;
}

interface ScoringBreakdownLike {
  totalScore: number;
  scoreBand: string;
  scoreBandLabel: string;
  requiredKeywords: ScoringComponentResult;
  preferredKeywords: ScoringComponentResult;
  responsibilities: ScoringComponentResult;
  seniority: ScoringComponentResult;
  industry: ScoringComponentResult;
  detectedIndustry: string;
}

interface ApplicationLike {
  keywordMatchScore?: number | null;
  matchedKeywords?: string[];
  missingKeywords?: string[];
  missingInfoQuestions?: string[];
  sectionSuggestions?: string[];
  scoringBreakdownJson?: ScoringBreakdownLike | null;
  status: string;
}

interface FreeResultsViewProps {
  app: ApplicationLike;
  freePreview: FreePreview;
  applicationId: string;
  /** Called to (re-)analyze. Pass answers object for missing info context. */
  onReanalyze: (answers?: Record<string, string>) => void;
  isAnalyzing: boolean;
}

// ─── Conversion constants ─────────────────────────────────────────────────────

/**
 * Number of matched keywords shown in full — these confirm the AI understood
 * the CV and demonstrate value freely.
 */
const FREE_MATCHED_KEYWORDS = 7;

/**
 * Number of missing keywords shown in full — just enough to prove the AI
 * found real gaps. The rest are locked, creating a concrete reason to unlock.
 *
 * A/B test candidate: try 2 vs 3 vs 5.
 * Hypothesis: 3 is the sweet spot — enough to feel credible, not enough to act on.
 */
const FREE_MISSING_KEYWORDS = 3;

const TRUST_SIGNALS = [
  "No fake experience added",
  "ATS-friendly formatting",
  "Edit before export",
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function ScoreCircle({ score }: { score: number }) {
  const color =
    score >= 80
      ? "text-emerald-500"
      : score >= 60
        ? "text-amber-500"
        : "text-destructive";

  return (
    <div className="relative w-28 h-28 shrink-0">
      <svg className="w-full h-full -rotate-90" aria-hidden="true">
        <circle
          cx="56" cy="56" r="48"
          stroke="currentColor" strokeWidth="8" fill="transparent"
          className="text-muted opacity-20"
        />
        <circle
          cx="56" cy="56" r="48"
          stroke="currentColor" strokeWidth="8" fill="transparent"
          strokeDasharray={302}
          strokeDashoffset={302 - (302 * score) / 100}
          className={cn("transition-all duration-1000 ease-out", color)}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn("text-3xl font-bold leading-none", color)}>{score}%</span>
        <span className="text-[9px] uppercase font-bold tracking-wider text-muted-foreground mt-0.5">Match</span>
      </div>
    </div>
  );
}

function KeywordChip({
  text,
  variant,
}: {
  text: string;
  variant: "matched" | "missing";
}) {
  return (
    <span
      className={cn(
        "px-2.5 py-1 rounded-lg text-xs font-medium border",
        variant === "matched"
          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
          : "bg-red-50 text-red-700 border-red-200",
      )}
    >
      {text}
    </span>
  );
}

function LockedBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-muted text-muted-foreground border border-border px-2 py-0.5 rounded-full">
      <Lock className="w-2.5 h-2.5" aria-hidden="true" />
      {children}
    </span>
  );
}

/**
 * The locked keyword pill — shows how many more keywords are hidden.
 * Acts as a mini-CTA trigger placed directly in the keyword flow.
 */
function LockedKeywordCount({ count }: { count: number }) {
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border border-dashed border-red-300 bg-red-50/60 text-red-700 select-none">
      <Lock className="w-2.5 h-2.5 shrink-0" aria-hidden="true" />
      +{count} more hidden
    </span>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

/**
 * Full-page conversion experience shown to free users after analysis.
 *
 * Layout (scrollable):
 *   Status header (above fold, with inline unlock button)
 *   1. Match Score + partial keywords → INLINE CTA-0 (after locked missing keywords)
 *   2. CTA-1: compact banner
 *   3. AI Insights
 *   4. Optimized Summary (gradient-faded)
 *   5. Experience Rewrite (1 bullet + blurred)
 *   6. Cover Letter Teaser (blurred, Pro badge) — placed BEFORE CTA-2 to inflate value stack
 *   7. CTA-2: detailed unlock block (result-specific copy)
 *   8. CTA-3: dark bottom banner
 *   9. Missing Info (answerable, drives re-analysis)
 *
 * KEY CONVERSION DECISIONS:
 * - Missing keywords are locked at > FREE_MISSING_KEYWORDS. This converts the
 *   keyword list from a free DIY checklist into an incomplete checklist that
 *   requires payment to act on fully.
 * - An inline CTA-0 appears directly below the locked keyword count, at the
 *   moment of highest engagement (the user just saw their gaps).
 * - Cover letter teaser is placed BEFORE the purchase block to maximise the
 *   perceived value stack at the point of decision.
 *
 * Security: all premium content (tailoredCvText, coverLetterText) is stripped
 * server-side. This component only renders what the server intentionally sent.
 */
export function FreeResultsView({
  app,
  freePreview,
  applicationId,
  onReanalyze,
  isAnalyzing,
}: FreeResultsViewProps) {
  const [missingAnswers, setMissingAnswers] = useState<Record<string, string>>({});
  // Auto-expand when there are 1–3 questions so the "AI found gaps" signal is immediately visible
  const [showMissingInfo, setShowMissingInfo] = useState(
    () => (app.missingInfoQuestions?.length ?? 0) > 0 && (app.missingInfoQuestions?.length ?? 0) <= 3,
  );

  const score = app.keywordMatchScore ?? 0;
  const matched = app.matchedKeywords ?? [];
  const missing = app.missingKeywords ?? [];
  const questions = app.missingInfoQuestions ?? [];
  const suggestions = app.sectionSuggestions ?? [];

  // How many missing keywords are hidden (the information gap)
  const hiddenMissingCount = Math.max(0, missing.length - FREE_MISSING_KEYWORDS);

  // Prefer suggestions for insights; fall back to question labels
  const insights = suggestions.length > 0 ? suggestions.slice(0, 3) : questions.slice(0, 3);

  // Result-specific CTA-2 bullets — use actual keyword data to feel concrete
  const topMissingForCopy = missing.slice(0, 2);
  const unlockIncludes: { icon: React.ElementType; text: string }[] = [
    {
      icon: FileText,
      text:
        topMissingForCopy.length > 0
          ? `Full rewrite with ${topMissingForCopy.join(", ")}${hiddenMissingCount > 0 ? ` and ${hiddenMissingCount} more keywords` : ""} woven in`
          : `Full optimized resume — every section rewritten`,
    },
    { icon: FileDown, text: "Download as DOCX or PDF, ready to send" },
    { icon: PenTool, text: "Copy, edit, and apply — no extra steps" },
  ];

  const scoreLabel =
    score >= 80
      ? "Strong match — your CV is well aligned with this role."
      : score >= 60
        ? "Partial match — the rewrite closes the remaining gaps."
        : "Low match — the full rewrite significantly improves your chances.";

  // ── Analyzing overlay ──────────────────────────────────────────────────────
  if (isAnalyzing) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4 text-center">
        <Sparkles className="w-10 h-10 text-primary animate-pulse" />
        <h3 className="text-xl font-bold">Optimizing your CV…</h3>
        <p className="text-muted-foreground text-sm max-w-sm">
          The AI is rewriting your resume to match this role. This takes around 15–30 seconds.
        </p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >

      {/* ══ STATUS HEADER ════════════════════════════════════════════════════ */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" aria-hidden="true" />
            <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wide">
              Analysis complete
            </span>
          </div>
          <h2 className="text-xl font-bold text-foreground leading-snug">
            Your rewritten resume is ready
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {freePreview.lockedSectionsCount + 1} section{freePreview.lockedSectionsCount !== 0 ? "s" : ""} optimized for this role — unlock to access the full output.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <UnlockButton
            applicationId={applicationId}
            label="Unlock — $4"
            className="h-9 px-4 text-xs font-semibold"
          />
        </div>
      </div>

      {/* ══ SECTION 1: Match Score + Keywords ═══════════════════════════════ */}
      <Card>
        <CardContent className="p-6 space-y-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
            {/* Score circle */}
            <ScoreCircle score={score} />

            {/* Score label */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">{scoreLabel}</p>
              {score < 80 && (
                <p className="text-xs text-muted-foreground mt-1">
                  The full rewrite uses your existing experience to close these gaps — without adding anything that isn't true.
                </p>
              )}
              {score < 85 && missing.length > 0 && (
                <p className="text-xs font-medium text-violet-600 mt-2">
                  The rewrite works in {Math.min(missing.length, 5)} missing keyword{Math.min(missing.length, 5) !== 1 ? "s" : ""} — your effective match score improves when recruiters see the optimized version.
                </p>
              )}
            </div>
          </div>

          {/* Matched keywords — shown fully (confirms value, not actionable by itself) */}
          {matched.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1.5">
                <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                Already in your CV ({matched.length})
              </p>
              <div className="flex flex-wrap gap-1.5">
                {matched.slice(0, FREE_MATCHED_KEYWORDS).map((kw) => (
                  <KeywordChip key={kw} text={kw} variant="matched" />
                ))}
                {matched.length > FREE_MATCHED_KEYWORDS && (
                  <span className="text-xs text-muted-foreground self-center">
                    +{matched.length - FREE_MATCHED_KEYWORDS} more
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Missing keywords — LOCKED beyond 3 to create information gap */}
          {missing.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1.5">
                <XCircle className="w-3 h-3 text-destructive" />
                Missing from your CV ({missing.length} total)
              </p>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {/* Show first 3 freely */}
                {missing.slice(0, FREE_MISSING_KEYWORDS).map((kw) => (
                  <KeywordChip key={kw} text={kw} variant="missing" />
                ))}
                {/* Lock the rest */}
                {hiddenMissingCount > 0 && (
                  <LockedKeywordCount count={hiddenMissingCount} />
                )}
              </div>

              {/* CTA-0: inline trigger placed at moment of maximum keyword interest */}
              {hiddenMissingCount > 0 ? (
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 mt-1 pt-3 border-t border-border/60">
                  <p className="text-xs text-foreground/80 flex-1">
                    <span className="font-semibold">
                      {hiddenMissingCount} more keyword{hiddenMissingCount !== 1 ? "s" : ""} are locked.
                    </span>{" "}
                    The full rewrite addresses all {missing.length} gaps using your existing experience.
                  </p>
                  <UnlockButton
                    applicationId={applicationId}
                    label={`Unlock all ${missing.length} keywords — $4`}
                    className="shrink-0 h-8 px-4 text-xs font-semibold whitespace-nowrap"
                  />
                </div>
              ) : (
                <p className="text-[11px] text-muted-foreground">
                  These are used by ATS filters for this role. The full rewrite works them into your existing experience.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ══ SECTION 1b: Score Breakdown ══════════════════════════════════════ */}
      {app.scoringBreakdownJson && (
        <Card>
          <CardContent className="p-5">
            <h3 className="font-semibold text-sm mb-1 flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-blue-500" />
              Score Breakdown
            </h3>
            <p className="text-xs text-muted-foreground mb-4">
              Detected industry:{" "}
              <span className="font-medium text-foreground">
                {app.scoringBreakdownJson.detectedIndustry}
              </span>
            </p>
            <div className="space-y-3">
              {(
                [
                  { label: "Required Keywords", weight: "45%", comp: app.scoringBreakdownJson.requiredKeywords },
                  { label: "Responsibilities", weight: "20%", comp: app.scoringBreakdownJson.responsibilities },
                  { label: "Preferred Keywords", weight: "15%", comp: app.scoringBreakdownJson.preferredKeywords },
                  { label: "Seniority", weight: "10%", comp: app.scoringBreakdownJson.seniority },
                  { label: "Industry", weight: "10%", comp: app.scoringBreakdownJson.industry },
                ] as const
              ).map(({ label, weight, comp }) => {
                const pct = comp.maxScore > 0 ? Math.round((comp.rawScore / comp.maxScore) * 100) : 0;
                return (
                  <div key={label}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium">{label}</span>
                      <span className="text-[10px] text-muted-foreground tabular-nums">
                        {comp.matched}/{comp.total} · <span className="font-semibold">{weight}</span>
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all duration-700",
                          pct >= 70 ? "bg-emerald-500" : pct >= 40 ? "bg-amber-500" : "bg-destructive",
                        )}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ══ CTA-1: Compact banner ════════════════════════════════════════════ */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-5 py-4 rounded-xl bg-gradient-to-r from-violet-50 to-indigo-50/60 border border-violet-200/80">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">Your optimized resume is ready</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Unlock this result for $4 — no subscription required
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <UnlockButton
            applicationId={applicationId}
            label="Unlock — $4"
            className="h-8 px-4 text-xs font-semibold"
          />
          <UpgradeButton
            label="Go Pro"
            className="h-8 px-4 text-xs font-semibold"
          />
        </div>
      </div>

      {/* ══ SECTION 2: AI Insights ══════════════════════════════════════════ */}
      {insights.length > 0 && (
        <Card>
          <CardContent className="p-6">
            <h3 className="text-sm font-bold text-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-violet-500" />
              What the AI found in your CV
            </h3>
            <div className="space-y-3">
              {insights.map((insight, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-violet-100 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-[9px] font-bold text-violet-600">{i + 1}</span>
                  </div>
                  <p className="text-sm text-foreground/90 leading-relaxed">{insight}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ══ SECTION 3: Optimized Summary Preview ════════════════════════════ */}
      {freePreview.summaryPreview && (
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <div className="bg-muted px-5 py-3 border-b border-border flex justify-between items-center rounded-t-2xl">
              <span className="text-sm font-semibold text-foreground">
                Professional Summary — AI Optimized
              </span>
              <LockedBadge>Full summary locked</LockedBadge>
            </div>
            <div className="relative px-5 pt-4 pb-0">
              <p className="font-mono text-sm leading-relaxed text-foreground">
                {freePreview.summaryPreview}
              </p>
              {/* Gradient fade into blur */}
              <div
                className="absolute bottom-0 left-0 right-0 h-10 pointer-events-none"
                style={{ background: "linear-gradient(to bottom, transparent, hsl(var(--card)))" }}
                aria-hidden="true"
              />
            </div>
            <BlurredLockedSection lineCount={3} lineWidths={["100%", "88%", "70%"]} />
          </CardContent>
        </Card>
      )}

      {/* ══ SECTION 4: Experience Rewrite Preview ═══════════════════════════ */}
      {freePreview.firstBullet && (
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <div className="bg-muted px-5 py-3 border-b border-border flex justify-between items-center rounded-t-2xl">
              <span className="text-sm font-semibold text-foreground">Experience Rewrite</span>
              <LockedBadge>Full rewrite locked</LockedBadge>
            </div>
            <div className="px-5 pt-4 pb-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2.5">
                Work Experience — First Rewritten Bullet
              </p>
              <div className="flex items-start gap-2.5 bg-emerald-50/60 border border-emerald-200/60 rounded-xl px-4 py-3">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" aria-hidden="true" />
                <p className="text-sm text-foreground leading-relaxed font-medium">
                  {freePreview.firstBullet}
                </p>
              </div>
              <p className="text-[11px] text-muted-foreground mt-2">
                {freePreview.lockedSectionsCount} more section{freePreview.lockedSectionsCount !== 1 ? "s" : ""} rewritten — locked
              </p>
            </div>
            <BlurredLockedSection lineCount={5} lineWidths={["100%", "84%", "92%", "75%", "88%"]} />
          </CardContent>
        </Card>
      )}

      {/* ══ SECTION 5: Cover Letter Teaser ══════════════════════════════════
           Placed BEFORE CTA-2 to inflate the perceived value stack at the
           point of decision. Cover letter is a Pro-only feature.         */}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="bg-muted px-5 py-3 border-b border-border flex justify-between items-center rounded-t-2xl">
            <span className="text-sm font-semibold text-foreground">Cover Letter</span>
            <span className="text-[10px] font-semibold text-violet-600 bg-violet-50 border border-violet-200 px-2.5 py-0.5 rounded-full">
              Pro feature
            </span>
          </div>
          <div className="px-5 pt-4 pb-2">
            <p className="text-xs text-muted-foreground mb-3">
              A personalized letter written around your rewritten CV and this job description. Three tone options: professional, enthusiastic, concise.
            </p>
          </div>
          <BlurredLockedSection lineCount={6} lineWidths={["100%", "92%", "85%", "100%", "78%", "60%"]} />
        </CardContent>
      </Card>

      {/* ══ CTA-2: Detailed conversion block ════════════════════════════════
           Includes are result-specific — uses actual keyword data for copy.  */}
      <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-border/60 text-center">
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
            {freePreview.lockedSectionsCount + 1} section{freePreview.lockedSectionsCount !== 0 ? "s" : ""} rewritten &amp; waiting
          </p>
          <h3 className="text-lg font-bold text-foreground leading-snug">
            Get the complete rewrite, tailored for this role
          </h3>
        </div>

        {/* Primary: $4 one-time unlock */}
        <div className="px-6 py-5">
          <div className="flex items-baseline justify-between mb-3">
            <span className="text-sm font-bold text-foreground">Unlock this result</span>
            <span className="text-xl font-bold text-foreground">
              $4{" "}
              <span className="text-xs font-normal text-muted-foreground">one-time</span>
            </span>
          </div>

          <ul className="space-y-2 mb-4">
            {unlockIncludes.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-2.5 text-sm text-foreground/85">
                <Icon className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                {text}
              </li>
            ))}
          </ul>

          <UnlockButton
            applicationId={applicationId}
            label="Unlock now — $4"
            className="w-full h-11 text-sm font-semibold"
          />

          {/* Trust signals */}
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-3">
            {TRUST_SIGNALS.map((t) => (
              <span key={t} className="text-[11px] text-muted-foreground flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                {t}
              </span>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground text-center mt-2">
            No subscription · No recurring charge · Instant access
          </p>
        </div>

        {/* Secondary: Pro */}
        <div className="px-6 pb-5 pt-4 border-t border-border/60 bg-muted/30">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold text-foreground">
                ParsePilot Pro — $12/mo
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Unlimited results · Cover letters · Better for multiple applications
              </p>
            </div>
            <UpgradeButton
              label="Go Pro →"
              className="shrink-0 h-8 px-3 text-[11px]"
            />
          </div>
          <p className="text-[9px] text-muted-foreground mt-1.5">
            Cancel anytime · No long-term commitment
          </p>
        </div>
      </div>

      {/* ══ CTA-3: Dark bottom banner ════════════════════════════════════════ */}
      <UpgradeCTACard
        dark
        headline="Your tailored resume is ready to use"
        description="Start Pro for unlimited results and cover letters — or unlock just this one for $4."
        variant="bottom"
        ctaLabel="Get Pro — $12/mo"
        applicationId={applicationId}
      />

      {/* ══ SECTION 6: Missing Info — drives re-analysis ════════════════════ */}
      {questions.length > 0 && (
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <button
            className="w-full flex items-center justify-between px-5 py-4 text-left"
            onClick={() => setShowMissingInfo((v) => !v)}
            aria-expanded={showMissingInfo}
          >
            <div>
              <p className="text-sm font-semibold text-foreground">
                Improve your match score
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Answer {questions.length} question{questions.length !== 1 ? "s" : ""} to give the AI more context — then re-analyze
              </p>
            </div>
            {showMissingInfo ? (
              <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />
            ) : (
              <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
            )}
          </button>

          {showMissingInfo && (
            <div className="border-t border-border px-5 pb-5 pt-4 space-y-4">
              <p className="text-xs text-muted-foreground">
                Only answer questions where you have relevant experience. Leave others blank — the AI won't invent anything.
              </p>
              {questions.map((q, i) => (
                <div key={i}>
                  <label className="block text-sm font-medium text-foreground mb-1.5">{q}</label>
                  <Textarea
                    placeholder="Describe your experience if relevant, otherwise leave blank…"
                    value={missingAnswers[q] ?? ""}
                    onChange={(e) =>
                      setMissingAnswers((prev) => ({ ...prev, [q]: e.target.value }))
                    }
                    className="min-h-[80px] text-sm"
                  />
                </div>
              ))}
              <Button
                className="w-full h-11 gap-2"
                onClick={() => onReanalyze(missingAnswers)}
                disabled={isAnalyzing}
              >
                {isAnalyzing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                Re-analyze with New Context
              </Button>
              <p className="text-[10px] text-muted-foreground text-center">
                Uses 1 credit · Your existing answers are carried forward
              </p>
            </div>
          )}
        </div>
      )}

    </motion.div>
  );
}
