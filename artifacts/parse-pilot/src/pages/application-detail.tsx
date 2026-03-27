import { useState, useEffect, useRef } from "react";
import { useParams, useSearch, useLocation } from "wouter";
import {
  useGetApplication,
  useAnalyzeApplication,
  useGenerateCoverLetter,
  useSaveTailoredCv,
  useSaveCoverLetter,
  ApiError,
} from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent } from "@/components/Card";
import { Button } from "@/components/Button";
import { Badge } from "@/components/Badge";
import { Textarea } from "@/components/Textarea";
import {
  Loader2,
  Sparkles,
  CheckCircle2,
  XCircle,
  Download,
  FileText,
  LayoutList,
  MessageSquareWarning,
  PenTool,
  Lightbulb,
  Save,
  RotateCcw,
  AlertTriangle,
  Lock,
  BarChart2,
  ArrowLeft,
  Users,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useBillingStatus } from "@/hooks/use-billing-status";
import { LockedPreviewCard } from "@/components/results/locked-preview-card";
import { BlurredLockedSection } from "@/components/results/blurred-locked-section";
import { UpgradeCTACard } from "@/components/results/upgrade-cta-card";
import { UpgradeButton } from "@/components/billing/upgrade-button";
import { UnlockButton } from "@/components/billing/unlock-button";
import { FreeResultsView } from "@/components/results/free-results-view";

// ─── Analysis progress steps shown during loading ─────────────────────────────

const ANALYSIS_STEPS = [
  { label: "Parsing job description…", duration: 3000 },
  { label: "Identifying keyword gaps…", duration: 4000 },
  { label: "Rewriting CV for ATS…", duration: 99999 },
];

function AnalysisProgress() {
  const [stepIdx, setStepIdx] = useState(0);

  useEffect(() => {
    let elapsed = 0;
    const advance = () => {
      if (stepIdx < ANALYSIS_STEPS.length - 1) {
        elapsed += ANALYSIS_STEPS[stepIdx].duration;
        const t = setTimeout(() => setStepIdx((s) => Math.min(s + 1, ANALYSIS_STEPS.length - 1)), elapsed);
        return t;
      }
    };
    const t = advance();
    return () => clearTimeout(t);
  }, [stepIdx]);

  return (
    <div className="flex flex-col items-center py-20 gap-8">
      <div className="relative w-24 h-24">
        <div className="absolute inset-0 rounded-full border-4 border-primary/20" />
        <div className="absolute inset-0 rounded-full border-4 border-t-primary animate-spin" />
        <div className="absolute inset-0 flex items-center justify-center">
          <Sparkles className="w-10 h-10 text-primary" />
        </div>
      </div>
      <div className="text-center">
        <h3 className="text-xl font-bold mb-1">AI is optimizing your CV</h3>
        <p className="text-muted-foreground text-sm">This typically takes 20–40 seconds</p>
      </div>
      <div className="flex flex-col gap-2 w-full max-w-xs">
        {ANALYSIS_STEPS.map((step, idx) => {
          const done = idx < stepIdx;
          const active = idx === stepIdx;
          return (
            <div
              key={step.label}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-medium transition-all duration-500",
                done && "bg-emerald-50 border-emerald-200 text-emerald-700",
                active && "bg-primary/5 border-primary/30 text-foreground",
                !done && !active && "text-muted-foreground border-border",
              )}
            >
              {done ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              ) : active ? (
                <Loader2 className="w-4 h-4 shrink-0 animate-spin text-primary" />
              ) : (
                <div className="w-4 h-4 shrink-0 rounded-full border-2 border-muted-foreground/30" />
              )}
              {step.label}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Free preview type (extra field added by server-side gating) ─────────────

interface FreePreview {
  summaryPreview: string;
  firstBullet: string;
  lockedSectionsCount: number;
}

// ─── Locked cover letter section — shown in cover tab for free users ──────────

function LockedCoverLetterSection() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Left column: controls greyed out */}
      <div className="lg:col-span-1 space-y-4">
        <Card>
          <CardContent className="p-6 space-y-5">
            <div>
              <h3 className="font-bold text-lg mb-1">Cover Letter</h3>
              <p className="text-sm text-muted-foreground">
                Pro generates a personalized letter matched to your tailored CV and this job description.
              </p>
            </div>

            <div className="space-y-2 opacity-40 pointer-events-none select-none" aria-hidden="true">
              {(["professional", "enthusiastic", "concise"] as const).map((t) => (
                <label key={t} className="flex items-center gap-3 p-3 rounded-lg border border-border">
                  <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/40" />
                  <div>
                    <span className="capitalize font-medium text-sm block">{t}</span>
                    <span className="text-xs text-muted-foreground">
                      {t === "professional" && "Formal, polished, measured"}
                      {t === "enthusiastic" && "Warm, energetic, excited"}
                      {t === "concise" && "Brief, direct, 3 paragraphs"}
                    </span>
                  </div>
                </label>
              ))}
            </div>

            <Button
              className="w-full h-11 opacity-50 cursor-not-allowed"
              disabled
              aria-disabled="true"
              aria-label="Generate cover letter — available on ParsePilot Pro"
            >
              <Lock className="w-4 h-4 mr-2" />
              Generate Letter
            </Button>
          </CardContent>
        </Card>

        {/* CTA placement 2 — cover letter upgrade (left column) */}
        <UpgradeCTACard
          headline="Generate a cover letter"
          variant="cover"
          ctaLabel="Get Pro — $14.99/mo"
        />
      </div>

      {/* Right column: teaser + blurred preview */}
      <div className="lg:col-span-2">
        <Card className="overflow-hidden h-full min-h-[400px]">
          <div className="bg-muted px-4 py-3 border-b border-border flex justify-between items-center rounded-t-2xl">
            <span className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
              <Lock className="w-3.5 h-3.5" aria-hidden="true" />
              Cover Letter — Pro feature
            </span>
          </div>

          {/* Visible teaser — 1–2 lines of what a cover letter would open with */}
          <div className="px-6 pt-5 pb-0 font-serif text-sm space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Generated letter preview
            </p>
            <p className="text-foreground/60 leading-relaxed italic select-none">
              Dear Hiring Manager,
            </p>
            <p className="text-foreground/50 leading-relaxed italic select-none line-clamp-2">
              I am writing to express my strong interest in this role. Having spent{" "}
              <span className="blur-[3px]">several years building expertise in the exact areas</span>{" "}
              outlined in the job description…
            </p>
          </div>

          {/* Blurred rest of the letter */}
          <BlurredLockedSection
            lineCount={12}
            lineWidths={["88%", "100%", "75%", "100%", "92%", "80%", "100%", "68%", "95%", "82%", "100%", "55%"]}
          />
        </Card>
      </div>
    </div>
  );
}

// ─── Locked export bar — shown below header for free users ───────────────────

function LockedExportBar() {
  return (
    <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
      {/* Disabled export buttons — intentionally disabled, not broken */}
      <div className="flex gap-2">
        <Button
          variant="outline"
          className="gap-2 bg-card opacity-40 cursor-not-allowed"
          disabled
          aria-disabled="true"
          aria-label="Export CV as DOCX — available on ParsePilot Pro"
          title="Export to DOCX — available on ParsePilot Pro"
        >
          <Download className="w-4 h-4" />
          CV.docx
        </Button>
        <Button
          variant="outline"
          className="gap-2 bg-card opacity-40 cursor-not-allowed"
          disabled
          aria-disabled="true"
          aria-label="Export CV as PDF — available on ParsePilot Pro"
          title="Export to PDF — available on ParsePilot Pro"
        >
          <Download className="w-4 h-4" />
          CV.pdf
        </Button>
      </div>
      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
        <Lock className="w-3 h-3 text-violet-500 shrink-0" aria-hidden="true" />
        Export available on ParsePilot Pro
      </p>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

type TabId = "cv" | "keywords" | "missing" | "cover" | "suggestions";

export default function ApplicationDetail() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const search = useSearch();
  const [, navigate] = useLocation();
  const fromBulk = new URLSearchParams(search).get("from") === "bulk";

  const [activeTab, setActiveTab] = useState<TabId>("cv");
  const [missingAnswers, setMissingAnswers] = useState<Record<string, string>>({});
  const [coverTone, setCoverTone] = useState<"professional" | "enthusiastic" | "concise">("professional");
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [analyzeErrorCode, setAnalyzeErrorCode] = useState<string | null>(null);

  // Identity warning — shown when the server detects a different person's CV
  const [identityWarning, setIdentityWarning] = useState<{
    show: boolean;
    isAboveLimit: boolean;
    distinctCount: number;
  } | null>(null);

  // Editable CV state (Pro only — server rejects saves from free users)
  const [editedCv, setEditedCv] = useState<string | null>(null);
  const cvDirty = editedCv !== null;

  // Editable cover letter state (Pro only)
  const [editedCover, setEditedCover] = useState<string | null>(null);
  const coverDirty = editedCover !== null;

  const { status: billingStatus } = useBillingStatus();
  const isPro = billingStatus?.isPro ?? false;

  const { data: app, isLoading, refetch } = useGetApplication(id);

  // Extra fields added by the server-side content gate — not in the generated type
  const freePreview = (app as any)?.freePreview as FreePreview | null | undefined;
  // True when this user purchased a one-time unlock for this specific result
  const isUnlockedResult = ((app as any)?.isUnlockedResult as boolean) ?? false;

  const analyzeMutation = useAnalyzeApplication();
  const coverLetterMutation = useGenerateCoverLetter();
  const saveCvMutation = useSaveTailoredCv();
  const saveCoverMutation = useSaveCoverLetter();

  // Sync editable CV text from server when app loads / refetches
  const prevTailoredCvRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (app?.tailoredCvText !== prevTailoredCvRef.current) {
      prevTailoredCvRef.current = app?.tailoredCvText;
      setEditedCv(null); // clear local edits on fresh load
    }
  }, [app?.tailoredCvText]);

  const prevCoverRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (app?.coverLetterText !== prevCoverRef.current) {
      prevCoverRef.current = app?.coverLetterText;
      setEditedCover(null);
    }
  }, [app?.coverLetterText]);

  // ─── Handlers ───────────────────────────────────────────────────────────────

  const handleAnalyze = async (answers?: Record<string, string>) => {
    setAnalyzeError(null);
    setAnalyzeErrorCode(null);
    setIdentityWarning(null);
    try {
      const result = await analyzeMutation.mutateAsync({
        id,
        data: { confirmedAnswers: answers || {} },
      });

      // Check for identity warning from server (different person's CV detected)
      const raw = result as any;
      if (raw?.identityWarning === true) {
        setIdentityWarning({
          show: true,
          isAboveLimit: raw.identityAboveLimit === true,
          distinctCount: typeof raw.distinctIdentityCount === "number" ? raw.distinctIdentityCount : 2,
        });
      }

      toast({ title: "Analysis complete", description: "Your CV has been tailored to the job description." });
      setActiveTab("cv");
      refetch();
      if (answers) setMissingAnswers({});
    } catch (err) {
      let msg = "Analysis failed. Please check your connection and try again.";
      let code: string | null = null;

      if (err instanceof ApiError) {
        const data = err.data as any;
        code = data?.code ?? null;

        if (err.status === 402 && code === "CREDITS_EXHAUSTED") {
          msg = "You've run out of optimization credits. Upgrade to Pro to keep going.";
        } else if (err.status === 503) {
          msg = "The AI service is temporarily unavailable. Please try again shortly.";
        } else if (data?.error && typeof data.error === "string") {
          msg = data.error;
        }
      }

      setAnalyzeErrorCode(code);
      setAnalyzeError(msg);
      toast({ variant: "destructive", title: "Analysis failed", description: msg });
    }
  };

  const handleGenerateCoverLetter = async () => {
    try {
      await coverLetterMutation.mutateAsync({ id, data: { tone: coverTone } });
      toast({ title: "Cover letter generated", description: "Review and edit your new cover letter below." });
      refetch();
    } catch {
      toast({ variant: "destructive", title: "Generation failed", description: "Please try again." });
    }
  };

  const handleSaveCv = async () => {
    if (!editedCv) return;
    try {
      await saveCvMutation.mutateAsync({ id, data: { tailoredCvText: editedCv } });
      toast({ title: "Saved", description: "Your tailored CV has been saved." });
      setEditedCv(null);
      refetch();
    } catch {
      toast({ variant: "destructive", title: "Save failed", description: "Please try again." });
    }
  };

  const handleSaveCoverLetter = async () => {
    if (!editedCover) return;
    try {
      await saveCoverMutation.mutateAsync({ id, data: { coverLetterText: editedCover } });
      toast({ title: "Saved", description: "Your cover letter has been saved." });
      setEditedCover(null);
      refetch();
    } catch {
      toast({ variant: "destructive", title: "Save failed", description: "Please try again." });
    }
  };

  // ─── Loading skeleton ────────────────────────────────────────────────────────

  if (isLoading || !app) {
    return (
      <AppLayout>
        <div className="flex h-full items-center justify-center min-h-[60vh]">
          <Loader2 className="w-10 h-10 text-primary animate-spin" />
        </div>
      </AppLayout>
    );
  }

  // A free user who has run analysis will have status=analyzed but tailoredCvText=null
  // because the server strips it. Distinguish this from "never analyzed".
  // isUnlockedResult means they paid for a one-time unlock — treat same as Pro for this result.
  const isLockedForFree = !isPro && !isUnlockedResult && app.status === "analyzed" && !app.tailoredCvText && !!freePreview;
  const needsAnalysis = app.status === "draft" || (!app.tailoredCvText && !isLockedForFree);
  const currentCvText = editedCv ?? app.tailoredCvText ?? "";
  const currentCoverText = editedCover ?? app.coverLetterText ?? "";

  // ─── Tabs config ─────────────────────────────────────────────────────────────

  const tabs: { id: TabId; label: string; icon: React.ElementType; count?: number; locked?: boolean }[] = [
    { id: "cv", label: "Tailored CV", icon: FileText },
    { id: "keywords", label: "Keyword Analysis", icon: LayoutList },
    {
      id: "missing",
      label: "Missing Info",
      icon: MessageSquareWarning,
      count: app.missingInfoQuestions?.length || 0,
    },
    { id: "suggestions", label: "Suggestions", icon: Lightbulb, count: app.sectionSuggestions?.length || 0 },
    { id: "cover", label: "Cover Letter", icon: PenTool, locked: !isPro && !(isUnlockedResult && !!app.coverLetterText) },
  ];

  return (
    <AppLayout>
      {/* ── Back to bulk results ─────────────────────────────────────────── */}
      {fromBulk && (
        <button
          onClick={() => navigate("/bulk/session")}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6 group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          <Users className="w-3.5 h-3.5" />
          Back to batch results
        </button>
      )}

      {/* ── Page Header ─────────────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">{app.jobTitle}</h1>
            <Badge variant={app.status as any} className="uppercase">
              {app.status}
            </Badge>
          </div>
          <p className="text-muted-foreground text-lg flex items-center gap-2">
            at <span className="font-semibold text-foreground">{app.company}</span>
          </p>
        </div>

        <div className="flex flex-col items-start lg:items-end gap-2 w-full lg:w-auto">
          <div className="flex flex-wrap gap-2 w-full lg:w-auto">
            {/* Re-analyze always accessible */}
            <Button
              variant="outline"
              className="flex-1 lg:flex-none gap-2 bg-card"
              onClick={() => handleAnalyze()}
              disabled={analyzeMutation.isPending}
            >
              {analyzeMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RotateCcw className="w-4 h-4" />
              )}
              {needsAnalysis ? "Run Analysis" : "Re-analyze"}
            </Button>

            {/* Export — Pro or unlocked users get active buttons, others get disabled + CTA */}
            {(isPro || isUnlockedResult) ? (
              <>
                <Button
                  variant="outline"
                  className="flex-1 lg:flex-none gap-2 bg-card"
                  onClick={() => window.open(`/api/export/application/${id}/docx`, "_blank")}
                  disabled={needsAnalysis}
                  title="Download tailored CV as DOCX"
                >
                  <Download className="w-4 h-4" />
                  CV.docx
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 lg:flex-none gap-2 bg-card"
                  onClick={() => window.open(`/api/export/application/${id}/pdf`, "_blank")}
                  disabled={needsAnalysis}
                  title="Print or save tailored CV as PDF"
                >
                  <Download className="w-4 h-4" />
                  CV.pdf
                </Button>
              </>
            ) : null}
          </div>

          {/* CTA placement 3 — export area (free users without unlock only) */}
          {!isPro && !isUnlockedResult && <LockedExportBar />}
        </div>
      </div>

      {/* ── Identity mismatch warning ─────────────────────────────────── */}
      <AnimatePresence>
        {identityWarning?.show && (
          <motion.div
            initial={{ opacity: 0, height: 0, marginBottom: 0 }}
            animate={{ opacity: 1, height: "auto", marginBottom: 24 }}
            exit={{ opacity: 0, height: 0, marginBottom: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 px-4 py-3.5 rounded-xl bg-amber-50 border border-amber-200 dark:bg-amber-950/30 dark:border-amber-800/60">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5 sm:mt-0" aria-hidden="true" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
                  {identityWarning.isAboveLimit
                    ? "This account is being used for multiple candidates"
                    : "This looks like a different person's CV"}
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5 leading-relaxed">
                  {identityWarning.isAboveLimit
                    ? `Pro is designed for one person's career — analyzing your own CV for multiple roles. For reviewing ${identityWarning.distinctCount}+ candidates, Bulk Mode is the right tool.`
                    : "Pro is for tracking your own career across multiple job applications. For analyzing CVs of different candidates, use Bulk Mode instead."}
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <a
                  href="/bulk"
                  className="text-xs font-semibold text-amber-800 dark:text-amber-200 underline underline-offset-2 hover:no-underline whitespace-nowrap"
                >
                  Go to Bulk Mode
                </a>
                <button
                  onClick={() => setIdentityWarning(null)}
                  className="text-xs text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-200 font-medium"
                  aria-label="Dismiss identity warning"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {isLockedForFree && freePreview ? (
        <FreeResultsView
          app={app}
          freePreview={freePreview}
          applicationId={id!}
          onReanalyze={handleAnalyze}
          isAnalyzing={analyzeMutation.isPending}
        />
      ) : (
        <>
      {/* ── Tab Bar ─────────────────────────────────────────────────────── */}
      <div className="flex space-x-1 border-b border-border mb-8 overflow-x-auto pb-[1px]">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "relative flex items-center gap-2 px-4 py-3 text-sm font-semibold transition-colors whitespace-nowrap",
                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground",
              )}
              aria-current={isActive ? "page" : undefined}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              {tab.locked && (
                <Lock
                  className="w-3 h-3 text-violet-400 ml-0.5"
                  aria-label="Pro feature"
                />
              )}
              {!!tab.count && (
                <span className="ml-1 bg-accent text-accent-foreground w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold">
                  {tab.count}
                </span>
              )}
              {isActive && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
                  initial={false}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* ── Tab Content ─────────────────────────────────────────────────── */}
      <div className="min-h-[500px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {/* ── TAB: CV ──────────────────────────────────────────────── */}
            {activeTab === "cv" && (
              <>
                {analyzeMutation.isPending ? (
                  <Card>
                    <CardContent className="p-0">
                      <AnalysisProgress />
                    </CardContent>
                  </Card>
                ) : analyzeError && needsAnalysis ? (
                  /* Persistent error state */
                  <Card className="border-destructive/30 bg-destructive/5">
                    <CardContent className="p-12 flex flex-col items-center text-center gap-6">
                      <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
                        <AlertTriangle className="w-8 h-8 text-destructive" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold mb-2 text-destructive">
                          {analyzeErrorCode === "CREDITS_EXHAUSTED" ? "No credits remaining" : "Analysis Failed"}
                        </h3>
                        <p className="text-muted-foreground max-w-md">{analyzeError}</p>
                      </div>
                      {analyzeErrorCode === "CREDITS_EXHAUSTED" ? (
                        <UpgradeButton label="Get Pro — $14.99/mo" />
                      ) : (
                        <Button onClick={() => handleAnalyze()} className="gap-2">
                          <RotateCcw className="w-4 h-4" />
                          Try Again
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                ) : isLockedForFree && freePreview ? (
                  /* CTA placement 1 — free user after analysis: locked preview card + dual CTA */
                  <LockedPreviewCard preview={freePreview} applicationId={id!} />
                ) : needsAnalysis ? (
                  /* Empty state — no analysis yet */
                  <Card className="border-dashed border-2 bg-transparent text-center p-12">
                    <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
                      <Sparkles className="w-10 h-10 text-primary" />
                    </div>
                    <h3 className="text-2xl font-bold mb-3">Ready to Optimize</h3>
                    <p className="text-muted-foreground mb-8 max-w-md mx-auto text-lg">
                      ParsePilot AI will parse the job description, identify keyword gaps, and rewrite your CV to
                      maximize ATS compatibility — without inventing any experience.
                    </p>
                    <Button size="lg" onClick={() => handleAnalyze()} className="gap-2 h-14 px-8 text-lg">
                      <Sparkles className="w-5 h-5" />
                      Run AI Optimization
                    </Button>
                  </Card>
                ) : (
                  /* Pro user — tailored CV fully editable */
                  <Card>
                    <CardContent className="p-0">
                      <div className="bg-muted px-6 py-3 border-b border-border flex justify-between items-center rounded-t-2xl">
                        <span className="text-sm font-semibold text-muted-foreground">
                          Tailored CV
                          {cvDirty && <span className="ml-2 text-amber-600 font-bold">· Unsaved changes</span>}
                        </span>
                        <div className="flex gap-2">
                          {cvDirty && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditedCv(null)}
                              className="text-muted-foreground"
                            >
                              Discard
                            </Button>
                          )}
                          {cvDirty && (
                            <Button
                              size="sm"
                              onClick={handleSaveCv}
                              disabled={saveCvMutation.isPending}
                              className="gap-1.5"
                            >
                              {saveCvMutation.isPending ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <Save className="w-3 h-3" />
                              )}
                              Save
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigator.clipboard.writeText(currentCvText)}
                          >
                            Copy
                          </Button>
                        </div>
                      </div>
                      <Textarea
                        value={currentCvText}
                        onChange={(e) => {
                          if (e.target.value !== app.tailoredCvText) {
                            setEditedCv(e.target.value);
                          } else {
                            setEditedCv(null);
                          }
                        }}
                        className="min-h-[600px] border-0 rounded-none rounded-b-2xl focus-visible:ring-0 resize-none font-mono text-sm p-6"
                        placeholder="Tailored CV will appear here after analysis…"
                      />
                    </CardContent>
                  </Card>
                )}
              </>
            )}

            {/* ── TAB: KEYWORDS ────────────────────────────────────────── */}
            {activeTab === "keywords" && (
              <>
                {analyzeMutation.isPending ? (
                  <Card>
                    <CardContent className="p-0">
                      <AnalysisProgress />
                    </CardContent>
                  </Card>
                ) : !app.keywordMatchScore ? (
                  <div className="text-center py-20 text-muted-foreground space-y-4">
                    <LayoutList className="w-12 h-12 mx-auto opacity-20" />
                    <p>Run analysis first to see keyword match results.</p>
                    <Button onClick={() => handleAnalyze()} className="gap-2">
                      <Sparkles className="w-4 h-4" />
                      Run Analysis
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Score circle */}
                    <Card className="md:col-span-1 flex flex-col items-center justify-center p-8 text-center">
                      <div className="relative w-40 h-40 flex items-center justify-center mb-4">
                        <svg className="w-full h-full transform -rotate-90" aria-hidden="true">
                          <circle
                            cx="80"
                            cy="80"
                            r="70"
                            stroke="currentColor"
                            strokeWidth="12"
                            fill="transparent"
                            className="text-muted opacity-20"
                          />
                          <circle
                            cx="80"
                            cy="80"
                            r="70"
                            stroke="currentColor"
                            strokeWidth="12"
                            fill="transparent"
                            strokeDasharray={440}
                            strokeDashoffset={440 - (440 * app.keywordMatchScore) / 100}
                            className={cn(
                              "transition-all duration-1000 ease-out",
                              app.keywordMatchScore >= 80
                                ? "text-emerald-500"
                                : app.keywordMatchScore >= 60
                                  ? "text-amber-500"
                                  : "text-destructive",
                            )}
                          />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <span className="text-4xl font-bold">{app.keywordMatchScore}%</span>
                          <span className="text-xs uppercase font-bold tracking-wider text-muted-foreground mt-1">
                            Match
                          </span>
                        </div>
                      </div>
                      <h3 className="font-bold text-xl mb-2">ATS Compatibility</h3>
                      <p className="text-sm text-muted-foreground">
                        {app.keywordMatchScore >= 80
                          ? "Strong match — your CV is well aligned with the job description."
                          : app.keywordMatchScore >= 60
                            ? "Moderate match — answer missing info questions to improve your score."
                            : "Low match — review missing keywords and provide additional context."}
                      </p>
                    </Card>

                    <div className="md:col-span-2 space-y-6">
                      <Card>
                        <CardContent className="p-6">
                          <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                            Matched Keywords ({app.matchedKeywords.length})
                          </h3>
                          <div className="flex flex-wrap gap-2">
                            {app.matchedKeywords.length > 0 ? (
                              app.matchedKeywords.map((kw) => (
                                <span
                                  key={kw}
                                  className="px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-sm font-medium"
                                >
                                  {kw}
                                </span>
                              ))
                            ) : (
                              <span className="text-sm text-muted-foreground">None found.</span>
                            )}
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardContent className="p-6">
                          <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                            <XCircle className="w-5 h-5 text-destructive" />
                            Missing Keywords ({app.missingKeywords.length})
                          </h3>
                          <div className="flex flex-wrap gap-2 mb-4">
                            {app.missingKeywords.length > 0 ? (
                              app.missingKeywords.map((kw) => (
                                <span
                                  key={kw}
                                  className="px-3 py-1.5 bg-destructive/10 text-destructive border border-destructive/20 rounded-lg text-sm font-medium"
                                >
                                  {kw}
                                </span>
                              ))
                            ) : (
                              <span className="text-sm text-muted-foreground">
                                No major keywords missing.
                              </span>
                            )}
                          </div>
                          {app.missingKeywords.length > 0 && (
                            <p className="text-sm text-muted-foreground bg-muted p-4 rounded-xl border border-border">
                              Go to the <strong>Missing Info</strong> tab to provide context around these keywords.
                              ParsePilot AI will weave them into your CV without inventing anything.
                            </p>
                          )}
                        </CardContent>
                      </Card>

                      {/* Score Breakdown */}
                      {app.scoringBreakdownJson && (
                        <Card>
                          <CardContent className="p-6">
                            <h3 className="font-bold text-lg mb-1 flex items-center gap-2">
                              <BarChart2 className="w-5 h-5 text-blue-500" />
                              Score Breakdown
                            </h3>
                            <p className="text-sm text-muted-foreground mb-4">
                              Detected industry:{" "}
                              <span className="font-medium text-foreground">
                                {app.scoringBreakdownJson.detectedIndustry}
                              </span>
                            </p>
                            <div className="space-y-4">
                              {(
                                [
                                  {
                                    label: "Required Keywords",
                                    weight: "45%",
                                    comp: app.scoringBreakdownJson.requiredKeywords,
                                  },
                                  {
                                    label: "Responsibilities",
                                    weight: "20%",
                                    comp: app.scoringBreakdownJson.responsibilities,
                                  },
                                  {
                                    label: "Preferred Keywords",
                                    weight: "15%",
                                    comp: app.scoringBreakdownJson.preferredKeywords,
                                  },
                                  {
                                    label: "Seniority",
                                    weight: "10%",
                                    comp: app.scoringBreakdownJson.seniority,
                                  },
                                  {
                                    label: "Industry",
                                    weight: "10%",
                                    comp: app.scoringBreakdownJson.industry,
                                  },
                                ] as const
                              ).map(({ label, weight, comp }) => {
                                const pct =
                                  comp.maxScore > 0
                                    ? Math.round((comp.rawScore / comp.maxScore) * 100)
                                    : 0;
                                return (
                                  <div key={label}>
                                    <div className="flex items-center justify-between mb-1.5">
                                      <span className="text-sm font-medium">{label}</span>
                                      <span className="text-xs text-muted-foreground tabular-nums">
                                        {comp.matched}/{comp.total} matched · <span className="font-semibold">{weight}</span>
                                      </span>
                                    </div>
                                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                                      <div
                                        className={cn(
                                          "h-full rounded-full transition-all duration-700",
                                          pct >= 70
                                            ? "bg-emerald-500"
                                            : pct >= 40
                                              ? "bg-amber-500"
                                              : "bg-destructive",
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
                    </div>
                  </div>
                )}
              </>
            )}

            {/* ── TAB: MISSING INFO ─────────────────────────────────────── */}
            {activeTab === "missing" && (
              <>
                {analyzeMutation.isPending ? (
                  <Card>
                    <CardContent className="p-0">
                      <AnalysisProgress />
                    </CardContent>
                  </Card>
                ) : !app.missingInfoQuestions || app.missingInfoQuestions.length === 0 ? (
                  <Card className="text-center p-16">
                    <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
                    <h3 className="text-2xl font-bold mb-2">No Missing Information</h3>
                    <p className="text-muted-foreground text-lg">
                      Your CV already contains all the necessary context required by this job description.
                    </p>
                  </Card>
                ) : (
                  <div className="max-w-3xl">
                    <div className="mb-6">
                      <h3 className="text-2xl font-bold mb-2">Clarification Required</h3>
                      <p className="text-muted-foreground">
                        To address missing keywords without inventing facts, ParsePilot AI needs you to confirm your
                        experience. Answer any relevant fields and re-run the analysis.
                      </p>
                    </div>
                    <div className="space-y-6">
                      {app.missingInfoQuestions.map((q, idx) => (
                        <Card key={idx} className="border-l-4 border-l-accent overflow-hidden">
                          <CardContent className="p-6">
                            <label className="block text-base font-semibold text-foreground mb-3">{q}</label>
                            <Textarea
                              placeholder="Provide details if you have this experience, otherwise leave blank…"
                              value={missingAnswers[q] || ""}
                              onChange={(e) =>
                                setMissingAnswers((prev) => ({ ...prev, [q]: e.target.value }))
                              }
                              className="min-h-[100px]"
                            />
                          </CardContent>
                        </Card>
                      ))}
                      <Button
                        size="lg"
                        onClick={() => handleAnalyze(missingAnswers)}
                        disabled={analyzeMutation.isPending}
                        className="w-full h-14 text-lg"
                      >
                        {analyzeMutation.isPending ? (
                          <Loader2 className="w-5 h-5 animate-spin mr-2" />
                        ) : (
                          <Sparkles className="w-5 h-5 mr-2" />
                        )}
                        Re-Analyze with New Context
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* ── TAB: SUGGESTIONS ─────────────────────────────────────── */}
            {activeTab === "suggestions" && (
              <>
                {analyzeMutation.isPending ? (
                  <Card>
                    <CardContent className="p-0">
                      <AnalysisProgress />
                    </CardContent>
                  </Card>
                ) : !app.sectionSuggestions || app.sectionSuggestions.length === 0 ? (
                  <div className="text-center py-20 text-muted-foreground space-y-4">
                    <Lightbulb className="w-12 h-12 mx-auto opacity-20" />
                    {needsAnalysis ? (
                      <>
                        <p>Run analysis first to see structural suggestions for your CV.</p>
                        <Button onClick={() => handleAnalyze()} className="gap-2">
                          <Sparkles className="w-4 h-4" />
                          Run Analysis
                        </Button>
                      </>
                    ) : (
                      <p>No structural suggestions — your CV layout is already strong for this role.</p>
                    )}
                  </div>
                ) : (
                  <div className="max-w-3xl space-y-4">
                    <div className="mb-6">
                      <h3 className="text-2xl font-bold mb-2">Structural Suggestions</h3>
                      <p className="text-muted-foreground">
                        These are AI-generated recommendations based exclusively on your existing CV content — no
                        fabricated experience.
                      </p>
                    </div>
                    {app.sectionSuggestions.map((suggestion, idx) => (
                      <Card key={idx} className="border-l-4 border-l-primary/40">
                        <CardContent className="p-5 flex gap-4">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                            <Lightbulb className="w-4 h-4 text-primary" />
                          </div>
                          <p className="text-sm text-foreground leading-relaxed">{suggestion}</p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* ── TAB: COVER LETTER ────────────────────────────────────── */}
            {activeTab === "cover" && (
              <>
                {/* CTA placement 2 — cover letter tab gating
                 *  • Pro user              → full UI with generate + edit
                 *  • Unlock user + existing cover letter → read-only view + export
                 *  • Free / no unlock      → locked upgrade card
                 */}
                {(!isPro && !(isUnlockedResult && app.coverLetterText)) ? (
                  <LockedCoverLetterSection />
                ) : (isUnlockedResult && !isPro) ? (
                  /* ── Read-only cover letter for one-time unlock users ── */
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-1">
                      <Card>
                        <CardContent className="p-6 space-y-4">
                          <div>
                            <h3 className="font-bold text-lg mb-1">Cover Letter</h3>
                            <p className="text-sm text-muted-foreground">
                              Included with your one-time unlock — copy or export below.
                            </p>
                          </div>
                          <div className="rounded-lg bg-muted/50 border border-border p-3 space-y-1">
                            <p className="text-sm font-medium text-foreground">Want to regenerate?</p>
                            <p className="text-xs text-muted-foreground">
                              Regenerating cover letters with different tones requires Pro.
                            </p>
                          </div>
                          <UpgradeButton label="Get Pro — $14.99/mo" className="w-full" />
                          <p className="text-center text-[11px] text-muted-foreground">
                            Cancel anytime · No long-term commitment
                          </p>
                        </CardContent>
                      </Card>
                    </div>
                    <div className="lg:col-span-2">
                      <Card className="h-full min-h-[500px] flex flex-col">
                        <div className="bg-muted px-4 py-3 border-b border-border flex flex-wrap justify-between items-center gap-2 rounded-t-2xl">
                          <span className="text-sm font-semibold text-muted-foreground">Cover Letter</span>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="gap-1.5"
                              onClick={() => navigator.clipboard.writeText(app.coverLetterText ?? "")}
                            >
                              Copy
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="gap-1.5"
                              onClick={() => window.open(`/api/export/application/${id}/docx?type=cover`, "_blank")}
                            >
                              <Download className="w-3.5 h-3.5" />.docx
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="gap-1.5"
                              onClick={() => window.open(`/api/export/application/${id}/pdf?type=cover`, "_blank")}
                            >
                              <Download className="w-3.5 h-3.5" />.pdf
                            </Button>
                          </div>
                        </div>
                        <div className="flex-1 p-5 overflow-auto">
                          <pre className="text-sm font-mono whitespace-pre-wrap leading-relaxed">
                            {app.coverLetterText}
                          </pre>
                        </div>
                      </Card>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Controls */}
                    <div className="lg:col-span-1 space-y-6">
                      <Card>
                        <CardContent className="p-6 space-y-6">
                          <div>
                            <h3 className="font-bold text-lg mb-2">Tone</h3>
                            <div className="space-y-2">
                              {(["professional", "enthusiastic", "concise"] as const).map((t) => (
                                <label
                                  key={t}
                                  className="flex items-center gap-3 p-3 rounded-lg border border-border cursor-pointer hover:bg-secondary transition-colors"
                                >
                                  <input
                                    type="radio"
                                    name="tone"
                                    checked={coverTone === t}
                                    onChange={() => setCoverTone(t)}
                                    className="w-4 h-4 text-primary focus:ring-primary"
                                  />
                                  <div>
                                    <span className="capitalize font-medium text-sm block">{t}</span>
                                    <span className="text-xs text-muted-foreground">
                                      {t === "professional" && "Formal, polished, measured"}
                                      {t === "enthusiastic" && "Warm, energetic, excited"}
                                      {t === "concise" && "Brief, direct, 3 paragraphs"}
                                    </span>
                                  </div>
                                </label>
                              ))}
                            </div>
                          </div>

                          <Button
                            className="w-full h-12"
                            onClick={handleGenerateCoverLetter}
                            disabled={coverLetterMutation.isPending || !app.tailoredCvText}
                          >
                            {coverLetterMutation.isPending ? (
                              <Loader2 className="w-5 h-5 animate-spin mr-2" />
                            ) : (
                              <PenTool className="w-5 h-5 mr-2" />
                            )}
                            {app.coverLetterText ? "Regenerate" : "Generate Letter"}
                          </Button>

                          {!app.tailoredCvText && (
                            <p className="text-xs text-destructive text-center font-medium">
                              Run CV analysis first before generating a cover letter.
                            </p>
                          )}
                        </CardContent>
                      </Card>
                    </div>

                    {/* Cover letter output — editable */}
                    <div className="lg:col-span-2">
                      <Card className="h-full min-h-[500px] flex flex-col">
                        <div className="bg-muted px-4 py-3 border-b border-border flex flex-wrap justify-between items-center gap-2 rounded-t-2xl">
                          <span className="text-sm font-semibold text-muted-foreground">
                            Cover Letter
                            {coverDirty && (
                              <span className="ml-2 text-amber-600 font-bold">· Unsaved changes</span>
                            )}
                          </span>
                          <div className="flex flex-wrap gap-2">
                            {coverDirty && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setEditedCover(null)}
                                className="text-muted-foreground"
                              >
                                Discard
                              </Button>
                            )}
                            {coverDirty && (
                              <Button
                                size="sm"
                                onClick={handleSaveCoverLetter}
                                disabled={saveCoverMutation.isPending}
                                className="gap-1.5"
                              >
                                {saveCoverMutation.isPending ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <Save className="w-3 h-3" />
                                )}
                                Save
                              </Button>
                            )}
                            {app.coverLetterText && !coverDirty && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="gap-1.5"
                                  onClick={() => navigator.clipboard.writeText(currentCoverText)}
                                >
                                  Copy
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="gap-1.5"
                                  onClick={() => window.open(`/api/export/application/${id}/docx?type=cover`, "_blank")}
                                >
                                  <Download className="w-3.5 h-3.5" />
                                  .docx
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="gap-1.5"
                                  onClick={() => window.open(`/api/export/application/${id}/pdf?type=cover`, "_blank")}
                                >
                                  <Download className="w-3.5 h-3.5" />
                                  .pdf
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                        {coverLetterMutation.isPending ? (
                          <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8">
                            <Loader2 className="w-10 h-10 text-primary animate-spin" />
                            <p className="text-muted-foreground text-sm">Writing your cover letter…</p>
                          </div>
                        ) : app.coverLetterText || editedCover ? (
                          <Textarea
                            value={currentCoverText}
                            onChange={(e) => {
                              if (e.target.value !== app.coverLetterText) {
                                setEditedCover(e.target.value);
                              } else {
                                setEditedCover(null);
                              }
                            }}
                            className="flex-1 border-0 rounded-none rounded-b-2xl focus-visible:ring-0 resize-none font-serif text-base p-8 leading-relaxed"
                          />
                        ) : (
                          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-12 text-center">
                            <PenTool className="w-12 h-12 mb-4 opacity-20" />
                            <p>
                              Choose your preferred tone and click Generate to create a cover letter based on your
                              tailored CV.
                            </p>
                          </div>
                        )}
                      </Card>
                    </div>
                  </div>
                )}
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

        </>
      )}
    </AppLayout>
  );
}
