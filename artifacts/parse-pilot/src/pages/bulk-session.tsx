import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@workspace/replit-auth-web";
import {
  useUploadCv,
  useCreateApplication,
  analyzeApplication,
} from "@workspace/api-client-react";
import type { AnalysisResult } from "@workspace/api-client-react";
import { useDropzone } from "react-dropzone";
import { AppLayout } from "@/components/layout/app-layout";
import {
  Users,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  Lock,
  Crown,
  UploadCloud,
  X,
  Play,
  FileText,
  Clock,
  ArrowLeft,
  Target,
  TrendingUp,
  TrendingDown,
  ChevronDown,
  ChevronUp,
  BarChart2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

const SESSION_KEY = "bulk_completed_results";

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

type CvItemStatus = "pending" | "uploading" | "creating" | "analyzing" | "done" | "error";

interface CvQueueItem {
  id: string;
  file: File;
  status: CvItemStatus;
  applicationId?: string;
  errorMessage?: string;
}

interface CompletedResult {
  applicationId: string;
  fileName: string;
  score: number;
  matchedCount: number;
  missingCount: number;
  jobTitle: string;
  company: string;
}

type PageView = "session" | "results";

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
        <span className={cn("text-2xl font-extrabold", isAlmostFull ? "text-amber-500" : "text-foreground")}>
          {used}/{limit}
        </span>
      </div>
      <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", isAlmostFull ? "bg-amber-500" : "bg-primary")}
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

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: CvItemStatus }) {
  const map: Record<CvItemStatus, { label: string; className: string; icon: React.ReactNode }> = {
    pending: {
      label: "Pending",
      className: "bg-muted text-muted-foreground",
      icon: <Clock className="w-3 h-3" />,
    },
    uploading: {
      label: "Uploading…",
      className: "bg-blue-500/10 text-blue-600",
      icon: <Loader2 className="w-3 h-3 animate-spin" />,
    },
    creating: {
      label: "Saving…",
      className: "bg-blue-500/10 text-blue-600",
      icon: <Loader2 className="w-3 h-3 animate-spin" />,
    },
    analyzing: {
      label: "Analysing…",
      className: "bg-violet-500/10 text-violet-600",
      icon: <Loader2 className="w-3 h-3 animate-spin" />,
    },
    done: {
      label: "Done",
      className: "bg-emerald-500/10 text-emerald-600",
      icon: <CheckCircle2 className="w-3 h-3" />,
    },
    error: {
      label: "Failed",
      className: "bg-red-500/10 text-red-600",
      icon: <AlertCircle className="w-3 h-3" />,
    },
  };
  const { label, className, icon } = map[status];
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full", className)}>
      {icon}
      {label}
    </span>
  );
}

// ─── Score ring ────────────────────────────────────────────────────────────────

function ScoreRing({ score }: { score: number }) {
  const color =
    score >= 75 ? "text-emerald-600" :
    score >= 50 ? "text-amber-500" :
    "text-red-500";
  const bg =
    score >= 75 ? "bg-emerald-500/10" :
    score >= 50 ? "bg-amber-500/10" :
    "bg-red-500/10";

  return (
    <div className={cn("w-14 h-14 rounded-full flex flex-col items-center justify-center flex-shrink-0", bg)}>
      <span className={cn("text-lg font-extrabold leading-none", color)}>{score}</span>
      <span className={cn("text-[9px] font-semibold uppercase tracking-wide", color)}>score</span>
    </div>
  );
}

// ─── Score label ───────────────────────────────────────────────────────────────

function ScoreLabel({ score }: { score: number }) {
  if (score >= 75) return <span className="text-xs font-semibold text-emerald-600">Strong match</span>;
  if (score >= 50) return <span className="text-xs font-semibold text-amber-600">Moderate match</span>;
  return <span className="text-xs font-semibold text-red-600">Weak match</span>;
}

// ─── Results list view ────────────────────────────────────────────────────────

interface ResultsViewProps {
  results: CompletedResult[];
  onBack: () => void;
  onViewDetail: (applicationId: string) => void;
}

function ResultsView({ results, onBack, onViewDetail }: ResultsViewProps) {
  const sorted = [...results].sort((a, b) => b.score - a.score);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="space-y-5">
      {/* Header row */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to session
        </button>
      </div>

      <div>
        <h2 className="text-xl font-extrabold tracking-tight mb-0.5">Batch results</h2>
        <p className="text-sm text-muted-foreground">
          {sorted.length} candidate{sorted.length !== 1 ? "s" : ""} analysed — ranked by match score
        </p>
      </div>

      {/* Summary bar */}
      <div className="grid grid-cols-3 gap-3">
        {[
          {
            icon: <BarChart2 className="w-4 h-4 text-primary" />,
            label: "Avg score",
            value: `${Math.round(sorted.reduce((s, r) => s + r.score, 0) / sorted.length)}`,
          },
          {
            icon: <TrendingUp className="w-4 h-4 text-emerald-600" />,
            label: "Strong matches",
            value: `${sorted.filter((r) => r.score >= 75).length}`,
          },
          {
            icon: <TrendingDown className="w-4 h-4 text-red-500" />,
            label: "Weak matches",
            value: `${sorted.filter((r) => r.score < 50).length}`,
          },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl border border-border bg-card p-3.5 flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5 text-muted-foreground">{stat.icon}</div>
            <p className="text-xl font-extrabold">{stat.value}</p>
            <p className="text-xs text-muted-foreground">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Ranked list */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <ul className="divide-y divide-border/60">
          {sorted.map((result, idx) => {
            const isExpanded = expandedId === result.applicationId;
            return (
              <li key={result.applicationId} className="hover:bg-muted/30 transition-colors">
                {/* Main row */}
                <div className="flex items-center gap-4 px-5 py-4">
                  {/* Rank badge */}
                  <span className="text-xs font-bold text-muted-foreground w-5 text-center flex-shrink-0">
                    #{idx + 1}
                  </span>

                  {/* Score ring */}
                  <ScoreRing score={result.score} />

                  {/* File info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{result.fileName}</p>
                    <div className="flex items-center gap-3 mt-0.5">
                      <ScoreLabel score={result.score} />
                      <span className="text-muted-foreground text-xs">·</span>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Target className="w-3 h-3" />
                        {result.matchedCount} matched
                      </span>
                      <span className="text-muted-foreground text-xs">·</span>
                      <span className="text-xs text-muted-foreground">
                        {result.missingCount} missing
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => onViewDetail(result.applicationId)}
                      className="text-xs font-semibold text-primary hover:underline hidden sm:block"
                    >
                      View full analysis
                    </button>
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : result.applicationId)}
                      className="p-1 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
                      aria-label={isExpanded ? "Collapse" : "Expand"}
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="px-5 pb-4 pt-0 border-t border-border/40 bg-muted/20">
                    <div className="flex flex-col sm:flex-row gap-3 pt-3">
                      <div className="flex-1">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Role</p>
                        <p className="text-sm">{result.jobTitle}{result.company !== "—" ? ` · ${result.company}` : ""}</p>
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Keywords</p>
                        <p className="text-sm">{result.matchedCount} matched · {result.missingCount} missing</p>
                      </div>
                      <button
                        onClick={() => onViewDetail(result.applicationId)}
                        className="self-end inline-flex items-center gap-2 text-sm font-semibold bg-primary text-primary-foreground px-4 py-2 rounded-xl hover:opacity-90 transition-opacity"
                      >
                        View full analysis
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      {/* Run another batch */}
      <div className="pt-2 border-t border-border/40">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Run another batch
        </button>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function BulkSession() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const [status, setStatus] = useState<BulkStatus | null>(null);
  const [credits, setCredits] = useState<CreditStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const [jobTitle, setJobTitle] = useState("");
  const [company, setCompany] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [queue, setQueue] = useState<CvQueueItem[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const [view, setView] = useState<PageView>("session");
  const [completedResults, setCompletedResults] = useState<CompletedResult[]>([]);

  const uploadMutation = useUploadCv();
  const createMutation = useCreateApplication();
  const isRunningRef = useRef(false);

  // Restore completed results from sessionStorage on mount
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(SESSION_KEY);
      if (stored) {
        const parsed: CompletedResult[] = JSON.parse(stored);
        if (parsed.length > 0) {
          setCompletedResults(parsed);
          setView("results");
        }
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    Promise.all([
      fetch("/api/billing/bulk-status", { credentials: "include" }).then((r) => (r.ok ? r.json() : null)),
      fetch("/api/billing/credits", { credentials: "include" }).then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([s, c]) => { setStatus(s); setCredits(c); })
      .finally(() => setLoading(false));
  }, []);

  const hasAccess = status?.isPro || (status?.activePass && status.activePass.remaining > 0);
  const remaining = status?.isPro ? (credits?.availableCredits ?? 0) : (status?.activePass?.remaining ?? 0);
  const limit = status?.isPro ? (credits?.planAllowance ?? 100) : (status?.activePass?.cvLimit ?? 0);
  const used = limit - remaining;

  // ── Dropzone (multiple files) ─────────────────────────────────────────────

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newItems: CvQueueItem[] = acceptedFiles.map((file) => ({
      id: `${file.name}-${Date.now()}-${Math.random()}`,
      file,
      status: "pending",
    }));
    setQueue((prev) => [...prev, ...newItems]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
      "application/msword": [".doc"],
      "text/plain": [".txt"],
    },
    multiple: true,
  });

  const removeItem = (id: string) => {
    setQueue((prev) => prev.filter((item) => item.id !== id));
  };

  const updateItem = (id: string, patch: Partial<CvQueueItem>) => {
    setQueue((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const addCompletedResult = (result: CompletedResult) => {
    setCompletedResults((prev) => {
      const next = [...prev, result];
      try {
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  // ── Process queue ─────────────────────────────────────────────────────────

  const processSingle = async (item: CvQueueItem): Promise<void> => {
    if (!user?.id) return;

    try {
      updateItem(item.id, { status: "uploading" });
      const uploadResult = await uploadMutation.mutateAsync({ data: { file: item.file } });

      updateItem(item.id, { status: "creating" });
      const app = await createMutation.mutateAsync({
        data: {
          userId: user.id,
          jobTitle: jobTitle.trim() || "Bulk Analysis",
          company: company.trim() || "—",
          jobDescription: jobDescription.trim(),
          originalCvText: uploadResult.extractedText,
          parsedCvJson: uploadResult.parsedCv ?? undefined,
        },
      });

      updateItem(item.id, { status: "analyzing", applicationId: app.id });
      const result: AnalysisResult = await analyzeApplication(app.id, {}, { credentials: "include" });

      updateItem(item.id, { status: "done", applicationId: app.id });

      addCompletedResult({
        applicationId: app.id,
        fileName: item.file.name,
        score: Math.round(result.keywordMatchScore),
        matchedCount: result.matchedKeywords.length,
        missingCount: result.missingKeywords.length,
        jobTitle: jobTitle.trim() || "Bulk Analysis",
        company: company.trim() || "—",
      });
    } catch (err: unknown) {
      const body = (err as any)?.response?.data as { error?: string } | undefined;
      updateItem(item.id, {
        status: "error",
        errorMessage: body?.error ?? (err instanceof Error ? err.message : "Unknown error"),
      });
    }
  };

  const runAll = async () => {
    if (isRunningRef.current) return;
    if (!jobDescription.trim()) {
      toast({ variant: "destructive", title: "Job description required", description: "Paste the job description before running." });
      return;
    }

    const pending = queue.filter((i) => i.status === "pending" || i.status === "error");
    if (pending.length === 0) {
      toast({ title: "Nothing to run", description: "All CVs have already been processed." });
      return;
    }

    isRunningRef.current = true;
    setIsRunning(true);

    for (const item of pending) {
      if (!isRunningRef.current) break;
      await processSingle(item);
    }

    isRunningRef.current = false;
    setIsRunning(false);

    // Auto-switch to results view if anything completed
    setCompletedResults((current) => {
      if (current.length > 0) {
        setView("results");
      }
      toast({ title: "Batch complete", description: `${current.length} CV${current.length !== 1 ? "s" : ""} analysed.` });
      return current;
    });
  };

  const startNewSession = () => {
    setView("session");
    setQueue([]);
    setJobTitle("");
    setCompany("");
    setJobDescription("");
    setCompletedResults([]);
    try { sessionStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
  };

  const handleViewDetail = (applicationId: string) => {
    navigate(`/applications/${applicationId}?from=bulk`);
  };

  const pendingCount = queue.filter((i) => i.status === "pending").length;
  const errorCount = queue.filter((i) => i.status === "error").length;
  const doneCount = queue.filter((i) => i.status === "done").length;
  const runnableCount = pendingCount + errorCount;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Users className="w-4 h-4 text-primary" />
            </div>
            <span className="text-sm font-semibold text-primary uppercase tracking-wider">Bulk Mode</span>
          </div>
          {view === "session" ? (
            <>
              <h1 className="text-2xl font-extrabold tracking-tight mb-1">Batch CV analysis</h1>
              <p className="text-sm text-muted-foreground">
                Drop all candidate CVs at once. Each uses one slot and gets a full ATS analysis.
              </p>
            </>
          ) : (
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-extrabold tracking-tight">Batch CV analysis</h1>
              <button
                onClick={startNewSession}
                className="inline-flex items-center gap-2 text-sm font-semibold bg-primary text-primary-foreground px-4 py-2 rounded-xl hover:opacity-90 transition-opacity"
              >
                <Play className="w-3.5 h-3.5" />
                New batch
              </button>
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : !hasAccess ? (
          <div className="text-center py-16">
            <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
              <Lock className="w-6 h-6 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-bold mb-2">No active bulk pass</h2>
            <p className="text-muted-foreground text-sm mb-6 max-w-sm mx-auto">
              Purchase a bulk pass to start analyzing multiple CVs.
            </p>
            <button
              onClick={() => navigate("/bulk")}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-opacity"
            >
              <Users className="w-4 h-4" />
              View bulk pricing
            </button>
          </div>
        ) : view === "results" ? (
          <ResultsView
            results={completedResults}
            onBack={() => setView("session")}
            onViewDetail={handleViewDetail}
          />
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
            {!status?.isPro && status?.activePass && <SlotProgress used={used} limit={limit} />}

            {/* Previous results banner */}
            {completedResults.length > 0 && (
              <button
                onClick={() => setView("results")}
                className="w-full flex items-center justify-between rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm hover:bg-primary/10 transition-colors"
              >
                <span className="flex items-center gap-2 font-semibold text-primary">
                  <CheckCircle2 className="w-4 h-4" />
                  {completedResults.length} result{completedResults.length !== 1 ? "s" : ""} from previous batch
                </span>
                <ChevronRight className="w-4 h-4 text-primary" />
              </button>
            )}

            {/* Job details */}
            <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
              <p className="font-semibold text-sm">Role details <span className="text-muted-foreground font-normal">(shared across all CVs)</span></p>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1.5">Job title</label>
                  <input
                    type="text"
                    value={jobTitle}
                    onChange={(e) => setJobTitle(e.target.value)}
                    placeholder="e.g. Senior Software Engineer"
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1.5">Company</label>
                  <input
                    type="text"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    placeholder="e.g. Acme Corp"
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1.5">
                  Job description <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  placeholder="Paste the full job description here…"
                  rows={6}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
                />
              </div>
            </div>

            {/* Multi-file dropzone */}
            <div
              {...getRootProps()}
              className={cn(
                "rounded-2xl border-2 border-dashed p-8 text-center cursor-pointer transition-colors",
                isDragActive
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50 hover:bg-muted/30",
              )}
            >
              <input {...getInputProps()} />
              <UploadCloud className={cn("w-8 h-8 mx-auto mb-3", isDragActive ? "text-primary" : "text-muted-foreground")} />
              {isDragActive ? (
                <p className="text-sm font-semibold text-primary">Drop the CVs here…</p>
              ) : (
                <>
                  <p className="text-sm font-semibold text-foreground mb-1">Drop all candidate CVs here</p>
                  <p className="text-xs text-muted-foreground">PDF, DOCX, DOC or TXT — select multiple files at once</p>
                </>
              )}
            </div>

            {/* CV queue */}
            {queue.length > 0 && (
              <div className="rounded-2xl border border-border bg-card overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-border/60">
                  <p className="text-sm font-semibold">
                    {queue.length} CV{queue.length !== 1 ? "s" : ""} queued
                    {doneCount > 0 && <span className="text-muted-foreground font-normal"> · {doneCount} done</span>}
                  </p>
                  {runnableCount > 0 && !isRunning && (
                    <button
                      onClick={runAll}
                      disabled={!jobDescription.trim()}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold bg-primary text-primary-foreground px-3 py-1.5 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-40"
                    >
                      <Play className="w-3.5 h-3.5" />
                      Analyse {runnableCount} CV{runnableCount !== 1 ? "s" : ""}
                    </button>
                  )}
                  {isRunning && (
                    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Processing…
                    </span>
                  )}
                </div>

                <ul className="divide-y divide-border/60">
                  {queue.map((item) => (
                    <li key={item.id} className="flex items-center gap-3 px-5 py-3.5">
                      <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.file.name}</p>
                        {item.errorMessage && (
                          <p className="text-xs text-red-600 mt-0.5 truncate">{item.errorMessage}</p>
                        )}
                      </div>
                      <StatusBadge status={item.status} />
                      {(item.status === "pending" || item.status === "error") && !isRunning && (
                        <button
                          onClick={() => removeItem(item.id)}
                          className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0 ml-1"
                          aria-label="Remove"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>

                {/* Run button at bottom when queue is long */}
                {runnableCount > 0 && !isRunning && queue.length > 3 && (
                  <div className="px-5 py-3.5 border-t border-border/60 bg-muted/20">
                    <button
                      onClick={runAll}
                      disabled={!jobDescription.trim()}
                      className="w-full inline-flex items-center justify-center gap-2 text-sm font-semibold bg-primary text-primary-foreground px-4 py-2.5 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-40"
                    >
                      <Play className="w-4 h-4" />
                      Analyse {runnableCount} CV{runnableCount !== 1 ? "s" : ""}
                    </button>
                    {!jobDescription.trim() && (
                      <p className="text-xs text-muted-foreground text-center mt-2">Add a job description above to continue</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Empty state prompt */}
            {queue.length === 0 && (
              <p className="text-center text-xs text-muted-foreground py-2">
                Drop CVs above and paste a job description to get started.
              </p>
            )}

            {/* Buy more / dashboard links */}
            <div className="flex flex-col sm:flex-row gap-4 pt-2 border-t border-border/40 text-sm text-muted-foreground">
              <button
                onClick={() => navigate("/")}
                className="flex items-center gap-1.5 hover:text-foreground transition-colors"
              >
                View all analyses on dashboard
                <ChevronRight className="w-4 h-4" />
              </button>
              {!status?.isPro && (
                <button
                  onClick={() => navigate("/bulk")}
                  className="flex items-center gap-1.5 hover:text-foreground transition-colors"
                >
                  Need more slots? Buy another pass
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
