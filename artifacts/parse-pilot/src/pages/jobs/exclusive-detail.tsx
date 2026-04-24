import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { authedFetch } from "@/lib/authed-fetch";
import { useToast } from "@/hooks/use-toast";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import {
  Loader2, Star, MapPin, Building2, Globe, Lock, ArrowLeft, Send,
  CheckCircle, Sparkles, FileText, MailOpen, ChevronRight, AlertTriangle,
  TrendingUp, AlertCircle, Briefcase, Banknote, Clock, Navigation,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { RelocationScoreBadge, type RelocationRecommendation } from "@/components/relocation/relocation-score-badge";

const BASE = import.meta.env.VITE_API_URL ?? "/api";

// ─── Types ────────────────────────────────────────────────────────────────────

interface InternalJob {
  id: string;
  title: string;
  company: string;
  location: string | null;
  country: string | null;
  remote: boolean | null;
  employmentType: string | null;
  seniority: string | null;
  description: string;
  requirements: string[];
  preferredSkills: string[];
  salaryMin: string | null;
  salaryMax: string | null;
  currency: string | null;
  visibility: string;
  status: string;
  applicationCount: number;
  publishedAt: string | null;
  createdAt: string;
}

interface Analysis {
  id: string;
  matchScore: number;
  fitReasons: string[];
  missingRequirements: string[];
  strengths: string[];
  concerns: string[];
  recommendationSummary: string;
  coverLetterSuggestion: string | null;
  applyRecommendation: string | null;
  createdAt: string;
}

interface Application {
  id: string;
  status: string;
  stage: string;
  appliedAt: string;
}

interface DetailResponse {
  job: InternalJob;
  applicationCount: number;
  userApplication: Application | null;
  latestAnalysis: Analysis | null;
  plan: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatSalary(min: string | null, max: string | null, currency: string | null) {
  const c = currency ?? "USD";
  if (min && max) return `${Number(min).toLocaleString()}–${Number(max).toLocaleString()} ${c}`;
  if (min) return `From ${Number(min).toLocaleString()} ${c}`;
  if (max) return `Up to ${Number(max).toLocaleString()} ${c}`;
  return null;
}

function scoreColor(score: number) {
  if (score >= 70) return "text-green-700";
  if (score >= 45) return "text-amber-600";
  return "text-red-600";
}

function scoreBarColor(score: number) {
  if (score >= 70) return "bg-green-500";
  if (score >= 45) return "bg-amber-400";
  return "bg-red-400";
}

function recommendationLabel(rec: string | null) {
  if (!rec) return null;
  return {
    apply_now: { label: "Apply Now", color: "text-green-700 bg-green-50 border-green-200" },
    tailor_first: { label: "Tailor CV First", color: "text-amber-700 bg-amber-50 border-amber-200" },
    skip: { label: "Not a Strong Fit", color: "text-red-700 bg-red-50 border-red-200" },
  }[rec] ?? null;
}

// ─── Relocation Fit Card ──────────────────────────────────────────────────────

interface RelocationResult {
  relocationScore: number;
  relocationRecommendation: string;
  estimatedMonthlySurplus: number | null;
  aiSummary: { summary: string; mainUpside: string; mainRisk: string; candidateAdvice: string; confidenceNote: string };
  riskFlags: string[];
  positiveFactors: string[];
  fromCache?: boolean;
}

function RelocationFitCard({
  jobId,
}: {
  jobId: string;
}) {
  const { toast } = useToast();
  const [data, setData] = useState<RelocationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  async function handleCheck() {
    setLoading(true);
    try {
      const res = await authedFetch(`${BASE}/relocation/analyze-job`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ internalJobId: jobId, lifestyle: "moderate" }),
      });
      const d = await res.json();
      if (!res.ok) {
        if (d.code === "NO_CV") {
          toast({ variant: "destructive", title: "No CV found", description: "Analyse a CV first to get relocation scoring." });
        } else {
          throw new Error(d.error ?? "Relocation analysis failed");
        }
        return;
      }
      setData(d.result);
      setExpanded(true);
    } catch (err: any) {
      toast({ variant: "destructive", title: err.message ?? "Relocation check failed" });
    } finally {
      setLoading(false);
    }
  }

  const surplus = data?.estimatedMonthlySurplus;

  return (
    <Card className="border-blue-200 bg-blue-50/20">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Navigation className="w-4 h-4 text-blue-600" />
            Relocation Fit
          </CardTitle>
          {data && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {expanded ? "Hide" : "Show"} details
            </button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {!data && (
          <Button
            variant="outline"
            size="sm"
            className="w-full text-xs border-blue-200 text-blue-700 hover:bg-blue-50"
            onClick={handleCheck}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" />
            ) : (
              <Navigation className="w-3.5 h-3.5 mr-2" />
            )}
            {loading ? "Analysing relocation fit…" : "Check Relocation Fit"}
          </Button>
        )}

        {data && (
          <>
            <div className="flex items-center justify-between gap-2">
              <RelocationScoreBadge
                recommendation={data.relocationRecommendation as RelocationRecommendation}
                score={data.relocationScore}
              />
              {surplus !== null && (
                <span className={cn("text-xs font-medium", surplus > 0 ? "text-green-700" : "text-red-600")}>
                  {surplus > 0 ? "+" : ""}${Math.round(Math.abs(surplus)).toLocaleString()}/mo est.
                </span>
              )}
            </div>

            {expanded && (
              <div className="space-y-2.5 pt-1 text-xs">
                <p className="text-foreground/80 leading-relaxed">{data.aiSummary.summary}</p>
                {data.aiSummary.mainUpside && (
                  <div className="flex items-start gap-1.5 text-green-700">
                    <CheckCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    {data.aiSummary.mainUpside}
                  </div>
                )}
                {data.aiSummary.mainRisk && (
                  <div className="flex items-start gap-1.5 text-amber-700">
                    <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    {data.aiSummary.mainRisk}
                  </div>
                )}
                {data.aiSummary.candidateAdvice && (
                  <p className="text-muted-foreground italic">{data.aiSummary.candidateAdvice}</p>
                )}
                <button
                  onClick={handleCheck}
                  disabled={loading}
                  className="text-xs text-blue-600 hover:underline"
                >
                  {loading ? "Refreshing…" : "Refresh"}
                </button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Apply Modal ──────────────────────────────────────────────────────────────

function ApplyModal({
  job,
  suggestion,
  onClose,
  onApplied,
}: {
  job: InternalJob;
  suggestion?: string | null;
  onClose: () => void;
  onApplied: (appId: string) => void;
}) {
  const { toast } = useToast();
  const [coverLetter, setCoverLetter] = useState(suggestion ?? "");
  const [submitting, setSubmitting] = useState(false);

  async function handleApply() {
    setSubmitting(true);
    try {
      const res = await authedFetch(`${BASE}/internal-jobs/${job.id}/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coverLetter: coverLetter.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 403) toast({ variant: "destructive", title: "Pro plan required", description: "Upgrade to apply to exclusive jobs." });
        else if (res.status === 409) toast({ title: "Already applied", description: "Your application exists." });
        else throw new Error(data.error ?? "Failed");
        return;
      }
      toast({ title: "Application submitted!", description: `Applied to ${job.title}` });
      onApplied(data.application.id);
      onClose();
    } catch (err: any) {
      toast({ variant: "destructive", title: err.message });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Apply to {job.title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="p-3 rounded-lg bg-muted/50 text-sm">
            <p className="font-medium">{job.company}</p>
            {job.location && <p className="text-muted-foreground">{job.location}</p>}
          </div>
          <div>
            <Label>Cover letter <span className="text-muted-foreground">(optional)</span></Label>
            <Textarea
              value={coverLetter}
              onChange={(e) => setCoverLetter(e.target.value)}
              rows={7}
              placeholder="Tell the recruiter why you're a great fit..."
              className="mt-1.5"
            />
            {suggestion && (
              <p className="text-xs text-muted-foreground mt-1">Pre-filled from AI analysis — edit as needed.</p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleApply} disabled={submitting} className="bg-purple-600 hover:bg-purple-700 text-white">
            {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
            Submit Application
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Analysis Panel ───────────────────────────────────────────────────────────

function AnalysisPanel({
  analysis,
  onRefresh,
  refreshing,
}: {
  analysis: Analysis;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  const recLabel = recommendationLabel(analysis.applyRecommendation);
  return (
    <Card className="border-purple-200 bg-purple-50/30">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-600" />
            AI Fit Analysis
          </CardTitle>
          <button onClick={onRefresh} disabled={refreshing} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            {refreshing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Refresh"}
          </button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Score */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-sm font-medium">Match score</span>
            <span className={cn("text-2xl font-bold", scoreColor(analysis.matchScore))}>
              {analysis.matchScore}%
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={cn("h-2 rounded-full transition-all", scoreBarColor(analysis.matchScore))}
              style={{ width: `${analysis.matchScore}%` }}
            />
          </div>
        </div>

        {/* Recommendation */}
        {recLabel && (
          <div className={cn("flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium", recLabel.color)}>
            {analysis.applyRecommendation === "apply_now" && <CheckCircle className="w-4 h-4" />}
            {analysis.applyRecommendation === "tailor_first" && <AlertTriangle className="w-4 h-4" />}
            {analysis.applyRecommendation === "skip" && <AlertCircle className="w-4 h-4" />}
            Recommendation: {recLabel.label}
          </div>
        )}

        {/* Summary */}
        {analysis.recommendationSummary && (
          <p className="text-sm text-foreground/80 leading-relaxed">{analysis.recommendationSummary}</p>
        )}

        {/* Strengths */}
        {Array.isArray(analysis.strengths) && analysis.strengths.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-green-700 mb-1.5 flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5" /> Strengths
            </p>
            <ul className="space-y-1">
              {(analysis.strengths as string[]).map((s, i) => (
                <li key={i} className="flex items-start gap-1.5 text-xs text-foreground/80">
                  <span className="text-green-500 mt-0.5">✓</span> {s}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Gaps */}
        {Array.isArray(analysis.missingRequirements) && (analysis.missingRequirements as string[]).length > 0 && (
          <div>
            <p className="text-xs font-semibold text-amber-700 mb-1.5 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" /> Gaps to address
            </p>
            <ul className="space-y-1">
              {(analysis.missingRequirements as string[]).map((g, i) => (
                <li key={i} className="flex items-start gap-1.5 text-xs text-foreground/80">
                  <span className="text-amber-500 mt-0.5">△</span> {g}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Concerns */}
        {Array.isArray(analysis.concerns) && (analysis.concerns as string[]).length > 0 && (
          <div>
            <p className="text-xs font-semibold text-red-700 mb-1.5 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" /> Recruiter concerns
            </p>
            <ul className="space-y-1">
              {(analysis.concerns as string[]).map((c, i) => (
                <li key={i} className="flex items-start gap-1.5 text-xs text-foreground/80">
                  <span className="text-red-400 mt-0.5">!</span> {c}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ExclusiveJobDetail() {
  const [, params] = useRoute("/jobs/exclusive/:id");
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const jobId = params?.id ?? "";

  const [applyOpen, setApplyOpen] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  const { data, isLoading, error } = useQuery<DetailResponse>({
    queryKey: ["exclusive-job-detail", jobId],
    queryFn: async () => {
      const res = await authedFetch(`${BASE}/internal-jobs/${jobId}`);
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Failed to load");
      return d;
    },
    enabled: !!jobId,
  });

  async function handleAnalyze() {
    setAnalyzing(true);
    try {
      const res = await authedFetch(`${BASE}/internal-jobs/${jobId}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ forceRefresh: !!data?.latestAnalysis }),
      });
      const d = await res.json();
      if (!res.ok) {
        if (d.code === "NO_CV") {
          toast({ variant: "destructive", title: "No CV found", description: "Analyse a CV first to get fit analysis." });
        } else {
          throw new Error(d.error ?? "Analysis failed");
        }
        return;
      }
      qc.invalidateQueries({ queryKey: ["exclusive-job-detail", jobId] });
      toast({ title: "Analysis complete!" });
    } catch (err: any) {
      toast({ variant: "destructive", title: err.message });
    } finally {
      setAnalyzing(false);
    }
  }

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  if (error || !data) {
    return (
      <AppLayout>
        <div className="max-w-3xl mx-auto px-4 py-12 text-center">
          <AlertCircle className="w-10 h-10 text-destructive mx-auto mb-3" />
          <p className="text-sm text-destructive">{(error as Error)?.message ?? "Job not found"}</p>
          <Button variant="ghost" size="sm" className="mt-4 text-muted-foreground" onClick={() => navigate("/jobs/exclusive")}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Jobs
          </Button>
        </div>
      </AppLayout>
    );
  }

  const { job, userApplication, latestAnalysis, plan } = data;
  const salary = formatSalary(job.salaryMin, job.salaryMax, job.currency);
  const alreadyApplied = !!userApplication;
  const isProUser = plan === "pro" || plan === "recruiter";

  return (
    <AppLayout>
      {applyOpen && (
        <ApplyModal
          job={job}
          suggestion={latestAnalysis?.coverLetterSuggestion}
          onClose={() => setApplyOpen(false)}
          onApplied={(appId) => {
            qc.invalidateQueries({ queryKey: ["exclusive-job-detail", jobId] });
            navigate(`/jobs/exclusive/application/${appId}`);
          }}
        />
      )}

      <div className="max-w-5xl mx-auto px-4 py-8">
        <Button variant="ghost" size="sm" onClick={() => navigate("/jobs/exclusive")} className="mb-6 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Jobs
        </Button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ── Left column — job detail ─────────────────────────── */}
          <div className="lg:col-span-2 space-y-6">
            {/* Header */}
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-2">
                <Badge className="bg-purple-100 text-purple-800 border border-purple-200 gap-1 text-xs">
                  <Star className="w-3 h-3" /> Resuone Exclusive
                </Badge>
                {job.visibility === "pro_only" && (
                  <Badge variant="outline" className="text-xs text-purple-600 border-purple-200">
                    <Lock className="w-3 h-3 mr-1" /> Pro+
                  </Badge>
                )}
                {job.remote && (
                  <Badge variant="outline" className="text-xs text-blue-600 border-blue-300">
                    <Globe className="w-3 h-3 mr-1" /> Remote
                  </Badge>
                )}
              </div>
              <h1 className="text-2xl font-bold mb-1">{job.title}</h1>
              <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
                <span className="flex items-center gap-1"><Building2 className="w-4 h-4" />{job.company}</span>
                {job.location && <span className="flex items-center gap-1"><MapPin className="w-4 h-4" />{job.location}</span>}
                {job.seniority && <span className="flex items-center gap-1 capitalize"><Briefcase className="w-4 h-4" />{job.seniority}</span>}
                {job.employmentType && <span className="capitalize">{job.employmentType.replace("_", " ")}</span>}
                {salary && <span className="flex items-center gap-1 font-semibold"><Banknote className="w-4 h-4" />{salary}</span>}
                <span className="flex items-center gap-1"><Clock className="w-4 h-4" />{data.applicationCount} applied</span>
              </div>
            </div>

            {/* Application status banner */}
            {alreadyApplied && (
              <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-600 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-green-800">Application submitted</p>
                  <p className="text-xs text-green-700">Status: <span className="capitalize font-medium">{userApplication.status}</span> · Stage: <span className="capitalize">{userApplication.stage.replace("_", " ")}</span></p>
                </div>
                <Button size="sm" variant="outline" onClick={() => navigate(`/jobs/exclusive/application/${userApplication.id}`)}>
                  View <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            )}

            {/* Description */}
            <Card>
              <CardHeader><CardTitle className="text-base">About the role</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">{job.description}</p>
              </CardContent>
            </Card>

            {/* Requirements */}
            {Array.isArray(job.requirements) && job.requirements.length > 0 && (
              <Card>
                <CardHeader><CardTitle className="text-base">Requirements</CardTitle></CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {(job.requirements as string[]).map((r, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <span className="text-purple-500 mt-0.5 shrink-0">•</span>{r}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Preferred skills */}
            {Array.isArray(job.preferredSkills) && (job.preferredSkills as string[]).length > 0 && (
              <Card>
                <CardHeader><CardTitle className="text-base">Nice to have</CardTitle></CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {(job.preferredSkills as string[]).map((s, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">{s}</Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* ── Right column — actions + analysis ───────────────── */}
          <div className="space-y-4">
            {/* Action buttons */}
            <Card>
              <CardContent className="p-4 space-y-2.5">
                {!alreadyApplied && (
                  <>
                    <Button
                      className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                      onClick={() => setApplyOpen(true)}
                      disabled={!isProUser && job.visibility === "pro_only"}
                    >
                      <Send className="w-4 h-4 mr-2" /> Apply Now
                    </Button>
                    {!isProUser && job.visibility === "pro_only" && (
                      <p className="text-xs text-center text-muted-foreground">Pro plan required to apply</p>
                    )}
                  </>
                )}

                <Button
                  className="w-full"
                  variant="outline"
                  onClick={handleAnalyze}
                  disabled={analyzing}
                >
                  {analyzing ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Sparkles className="w-4 h-4 mr-2" />
                  )}
                  {latestAnalysis ? "Refresh Analysis" : "Analyze My Fit"}
                </Button>

                <Button
                  className="w-full"
                  variant="outline"
                  onClick={() => navigate("/application/tailored-cvs")}
                >
                  <FileText className="w-4 h-4 mr-2" /> Tailored CVs
                </Button>

                <Button
                  className="w-full"
                  variant="outline"
                  onClick={() => navigate("/application/cover-letters")}
                >
                  <MailOpen className="w-4 h-4 mr-2" /> Cover Letters
                </Button>
              </CardContent>
            </Card>

            {/* Analysis panel */}
            {latestAnalysis && (
              <AnalysisPanel
                analysis={latestAnalysis}
                onRefresh={handleAnalyze}
                refreshing={analyzing}
              />
            )}

            {/* No analysis yet prompt */}
            {!latestAnalysis && !analyzing && (
              <div className="text-center p-6 rounded-lg border border-dashed text-muted-foreground">
                <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-40 text-purple-400" />
                <p className="text-sm font-medium">Get your AI fit score</p>
                <p className="text-xs mt-1">Click "Analyze My Fit" to see how well you match this role.</p>
              </div>
            )}

            {/* Relocation fit */}
            <RelocationFitCard jobId={jobId} />
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
