import { useState, useEffect, useRef } from "react";
import { useParams } from "wouter";
import {
  useGetApplication,
  useAnalyzeApplication,
  useGenerateCoverLetter,
  useSaveTailoredCv,
  useSaveCoverLetter,
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
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useBillingStatus } from "@/hooks/use-billing-status";
import { ProGate } from "@/components/billing/pro-gate";

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

// ─── Main component ──────────────────────────────────────────────────────────

type TabId = "cv" | "keywords" | "missing" | "cover" | "suggestions";

export default function ApplicationDetail() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<TabId>("cv");
  const [missingAnswers, setMissingAnswers] = useState<Record<string, string>>({});
  const [coverTone, setCoverTone] = useState<"professional" | "enthusiastic" | "concise">("professional");
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);

  // Editable CV state
  const [editedCv, setEditedCv] = useState<string | null>(null);
  const cvDirty = editedCv !== null;

  // Editable cover letter state
  const [editedCover, setEditedCover] = useState<string | null>(null);
  const coverDirty = editedCover !== null;

  const { status: billingStatus } = useBillingStatus();
  const isPro = billingStatus?.isPro ?? false;

  const { data: app, isLoading, refetch } = useGetApplication(id);
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
    try {
      await analyzeMutation.mutateAsync({
        id,
        data: { confirmedAnswers: answers || {} },
      });
      toast({ title: "Analysis complete", description: "Your CV has been tailored to the job description." });
      setActiveTab("cv");
      refetch();
      if (answers) setMissingAnswers({});
    } catch {
      const msg = "Analysis failed. Please check your connection and try again.";
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

  const needsAnalysis = app.status === "draft" || !app.tailoredCvText;
  const currentCvText = editedCv ?? app.tailoredCvText ?? "";
  const currentCoverText = editedCover ?? app.coverLetterText ?? "";

  // ─── Tabs config ─────────────────────────────────────────────────────────────

  const tabs: { id: TabId; label: string; icon: React.ElementType; count?: number }[] = [
    { id: "cv", label: "Tailored CV", icon: FileText },
    { id: "keywords", label: "Keyword Analysis", icon: LayoutList },
    {
      id: "missing",
      label: "Missing Info",
      icon: MessageSquareWarning,
      count: app.missingInfoQuestions?.length || 0,
    },
    { id: "suggestions", label: "Suggestions", icon: Lightbulb, count: app.sectionSuggestions?.length || 0 },
    { id: "cover", label: "Cover Letter", icon: PenTool },
  ];

  return (
    <AppLayout>
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
          {isPro ? (
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
          ) : (
            <ProGate isPro={false} feature="Export to DOCX / PDF" compact className="flex-1 lg:flex-none" />
          )}
        </div>
      </div>

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
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
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
                        <h3 className="text-xl font-bold mb-2 text-destructive">Analysis Failed</h3>
                        <p className="text-muted-foreground max-w-md">{analyzeError}</p>
                      </div>
                      <Button onClick={() => handleAnalyze()} className="gap-2">
                        <RotateCcw className="w-4 h-4" />
                        Try Again
                      </Button>
                    </CardContent>
                  </Card>
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
                  /* Tailored CV — editable */
                  <Card>
                    <CardContent className="p-0">
                      <div className="bg-muted px-6 py-3 border-b border-border flex justify-between items-center rounded-t-2xl">
                        <span className="text-sm font-semibold text-muted-foreground">
                          Tailored CV{cvDirty && <span className="ml-2 text-amber-600 font-bold">· Unsaved changes</span>}
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
                        <svg className="w-full h-full transform -rotate-90">
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
              <ProGate isPro={isPro} feature="Cover Letter Generation" className="min-h-[300px] justify-center">
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
              </ProGate>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </AppLayout>
  );
}
