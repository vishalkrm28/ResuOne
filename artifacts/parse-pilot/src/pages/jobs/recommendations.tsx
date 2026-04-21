import { useState, useEffect, useCallback } from "react";
import { COUNTRY_OPTIONS } from "@/lib/countries";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  getJobRecCredits,
  recommendJobs,
  type JobResult,
  type RecommendResponse,
  type CreditsResponse,
} from "@/lib/jobs-api";
import { authedFetch } from "@/lib/authed-fetch";
import { TailorCvModal } from "@/components/application/tailor-cv-modal";
import {
  MapPin,
  Building2,
  ExternalLink,
  Loader2,
  Sparkles,
  TrendingUp,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  FileText,
  RefreshCcw,
  MailOpen,
  Bookmark,
  BookmarkCheck,
} from "lucide-react";
import { saveJob } from "@/lib/tracker-api";

const BASE = import.meta.env.VITE_API_URL ?? "/api";

interface Application {
  id: string;
  jobTitle: string;
  company: string;
  createdAt: string;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function MatchScoreBar({ score }: { score: number }) {
  const color =
    score >= 70 ? "bg-green-500" : score >= 45 ? "bg-yellow-500" : "bg-red-400";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-sm font-semibold w-10 text-right">{score}%</span>
    </div>
  );
}

function ScoreBadge({ score }: { score: number }) {
  if (score >= 70) return <Badge className="bg-green-100 text-green-800 border-green-200">Strong Match</Badge>;
  if (score >= 45) return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Partial Match</Badge>;
  return <Badge className="bg-red-100 text-red-700 border-red-200">Weak Match</Badge>;
}

function JobCard({
  rec,
  onTailor,
}: {
  rec: JobResult;
  onTailor: (rec: JobResult, mode: "tailor" | "cover-letter") => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const { job } = rec;

  async function handleSaveJob() {
    setSaving(true);
    try {
      const { alreadySaved } = await saveJob({
        externalJobCacheId: job.id ?? null,
        jobTitle: job.title,
        company: job.company ?? null,
        location: job.location ?? null,
        employmentType: job.employment_type ?? null,
        remoteType: job.remote_type ?? null,
        salaryMin: job.salary_min ? Number(job.salary_min) : null,
        salaryMax: job.salary_max ? Number(job.salary_max) : null,
        currency: job.currency ?? null,
        applyUrl: job.apply_url ?? null,
        jobSnapshot: job as unknown as Record<string, unknown>,
      });
      setSaved(true);
      toast({ title: alreadySaved ? "Already saved" : "Job saved to tracker", description: "View it in Saved Jobs." });
    } catch {
      toast({ variant: "destructive", title: "Failed to save job" });
    } finally {
      setSaving(false);
    }
  }

  const salaryText =
    job.salary_min && job.salary_max
      ? `${Number(job.salary_min).toLocaleString()}–${Number(job.salary_max).toLocaleString()} ${job.currency}`
      : job.salary_min
      ? `From ${Number(job.salary_min).toLocaleString()} ${job.currency}`
      : null;

  return (
    <Card className="border border-border hover:shadow-md transition-shadow">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-base text-foreground leading-tight truncate">
              {job.title}
            </h3>
            <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground flex-wrap">
              {job.company && (
                <span className="flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5" />
                  {job.company}
                </span>
              )}
              {job.location && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />
                  {job.location}
                </span>
              )}
              {job.remote_type && (
                <Badge variant="outline" className="text-xs capitalize">
                  {job.remote_type}
                </Badge>
              )}
              {salaryText && (
                <span className="text-xs font-medium text-foreground/80">{salaryText}</span>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            <ScoreBadge score={rec.matchScore} />
          </div>
        </div>

        <div className="mb-3">
          <MatchScoreBar score={rec.matchScore} />
        </div>

        {rec.recommendationSummary && (
          <p className="text-sm text-muted-foreground mb-3 leading-relaxed italic">
            {rec.recommendationSummary}
          </p>
        )}

        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mb-2"
        >
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          {expanded ? "Hide details" : "Show details"}
        </button>

        {expanded && (
          <div className="space-y-3 mt-2">
            {(rec.fitReasons as string[]).length > 0 && (
              <div>
                <p className="text-xs font-semibold text-green-700 mb-1.5">Why it fits</p>
                <ul className="space-y-1">
                  {(rec.fitReasons as string[]).map((r, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-xs text-foreground/80">
                      <span className="text-green-500 mt-0.5">✓</span>
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {(rec.missingRequirements as string[]).length > 0 && (
              <div>
                <p className="text-xs font-semibold text-amber-700 mb-1.5">Gaps to bridge</p>
                <ul className="space-y-1">
                  {(rec.missingRequirements as string[]).map((r, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-xs text-foreground/80">
                      <span className="text-amber-500 mt-0.5">△</span>
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {job.description && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1">About the role</p>
                <p className="text-xs text-foreground/70 leading-relaxed line-clamp-4">
                  {job.description.replace(/<[^>]+>/g, "").trim()}
                </p>
              </div>
            )}
          </div>
        )}

        <div className="mt-3 pt-3 border-t border-border">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground capitalize">
              via {job.source === "adzuna" ? "Adzuna" : "The Muse"}
            </span>
            {job.apply_url && (
              <a
                href={job.apply_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
              >
                Apply now
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
          <div className="flex gap-2 mt-2.5">
            <Button
              size="sm"
              variant="outline"
              className="flex-1 text-xs h-8"
              onClick={() => onTailor(rec, "tailor")}
            >
              <FileText className="w-3.5 h-3.5 mr-1.5" />
              Tailor CV
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="flex-1 text-xs h-8"
              onClick={() => onTailor(rec, "cover-letter")}
            >
              <MailOpen className="w-3.5 h-3.5 mr-1.5" />
              Cover Letter
            </Button>
            <Button
              size="sm"
              variant={saved ? "default" : "outline"}
              className="text-xs h-8 px-3"
              onClick={handleSaveJob}
              disabled={saving || saved}
              title="Save job to tracker"
            >
              {saving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : saved ? (
                <BookmarkCheck className="w-3.5 h-3.5" />
              ) : (
                <Bookmark className="w-3.5 h-3.5" />
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function JobRecommendations() {
  const { toast } = useToast();

  const [creditsInfo, setCreditsInfo] = useState<CreditsResponse | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);

  // Pro users must explicitly select a CV; non-Pro can use "__latest__" as fallback
  const [selectedApp, setSelectedApp] = useState<string>("");
  const [isProUser, setIsProUser] = useState<boolean | null>(null);

  const [preferredLocation, setPreferredLocation] = useState("");
  const [country, setCountry] = useState("gb");
  const [remotePreference, setRemotePreference] = useState("any");
  const [roleType, setRoleType] = useState("");
  const [minScore, setMinScore] = useState(0);

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RecommendResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Tailor CV / Cover Letter modal
  const [modalJob, setModalJob] = useState<JobResult | null>(null);
  const [modalMode, setModalMode] = useState<"tailor" | "cover-letter">("tailor");

  function handleTailor(rec: JobResult, mode: "tailor" | "cover-letter") {
    setModalJob(rec);
    setModalMode(mode);
  }

  // ── Fetch credit info (re-runs when selected CV changes) ──────────────────
  const refreshCredits = useCallback(async (appId?: string | null) => {
    try {
      const data = await getJobRecCredits(appId ?? null);
      setCreditsInfo(data);
      setIsProUser(data.isProUser);
    } catch {
      // non-fatal
    }
  }, []);

  // ── Initial load: applications list + credit info ─────────────────────────
  useEffect(() => {
    refreshCredits(null);

    authedFetch(`${BASE}/applications`)
      .then((r) => (r.ok ? r.json() : {}))
      .then((data) => {
        const apps: Application[] = Array.isArray(data.applications)
          ? data.applications
          : Array.isArray(data)
          ? data
          : [];
        setApplications(apps);
        // Pre-select the most recent app once we know Pro status
        if (apps.length > 0) {
          setSelectedApp(apps[0].id);
        }
      })
      .catch(() => {});
  }, [refreshCredits]);

  // ── Refresh per-CV quota whenever the selected CV changes (Pro only) ──────
  useEffect(() => {
    if (isProUser && selectedApp && selectedApp !== "__latest__") {
      refreshCredits(selectedApp);
    }
  }, [selectedApp, isProUser, refreshCredits]);

  // ── Derived quota values ──────────────────────────────────────────────────
  const proRemaining =
    creditsInfo?.isProUser ? creditsInfo.remainingForCv : null;
  const proRunsUsed =
    creditsInfo?.isProUser ? creditsInfo.runsUsedTodayForCv : null;
  const freeCredits =
    creditsInfo && !creditsInfo.isProUser ? creditsInfo.jobRecCredits : null;

  const cvDailyLimitReached = isProUser === true && proRemaining === 0;
  const noFreeCredits = isProUser === false && freeCredits === 0;
  const proNoCvSelected = isProUser === true && !selectedApp;

  const canSearch =
    !loading &&
    !cvDailyLimitReached &&
    !noFreeCredits &&
    !proNoCvSelected;

  // ── Form submit ───────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSearch) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const appId =
        isProUser
          ? selectedApp // Pro: always pass explicit CV ID
          : selectedApp && selectedApp !== "__latest__"
          ? selectedApp
          : undefined;

      const res = await recommendJobs({
        applicationId: appId,
        preferredLocation: preferredLocation.trim() || undefined,
        country,
        remotePreference: remotePreference !== "any" ? remotePreference : undefined,
        roleType: roleType.trim() || undefined,
      });

      setResult(res);

      // Refresh quota badge from response
      if (res.isProUser) {
        setCreditsInfo({
          isProUser: true,
          dailyLimitPerCv: 10,
          runsUsedTodayForCv: res.runsUsedTodayForCv,
          remainingForCv: res.remainingForCv,
        });
        toast({
          title: `${res.recommendations.length} jobs matched`,
          description: `${res.remainingForCv} of 10 searches remaining for this CV today`,
        });
      } else {
        setCreditsInfo({ isProUser: false, jobRecCredits: res.remainingCredits });
        toast({
          title: `${res.recommendations.length} jobs matched`,
          description: `${res.remainingCredits} search${res.remainingCredits === 1 ? "" : "es"} remaining`,
        });
      }
    } catch (err: any) {
      const raw = err?.message ?? "Something went wrong";
      const msg =
        err?.status === 401 || raw === "Unauthorized"
          ? "Your session has expired. Please refresh the page and sign in again."
          : raw;
      setError(msg);

      if (err?.code === "CV_DAILY_LIMIT_REACHED") {
        toast({ variant: "destructive", title: "Daily limit reached", description: msg });
        setCreditsInfo({
          isProUser: true,
          dailyLimitPerCv: 10,
          runsUsedTodayForCv: 10,
          remainingForCv: 0,
        });
      } else if (err?.code === "NO_JOB_REC_CREDITS") {
        toast({ variant: "destructive", title: "No recommendation credits", description: "Unlock a CV analysis to receive 10 searches." });
      } else {
        toast({ variant: "destructive", title: "Failed to get recommendations", description: msg });
      }
    } finally {
      setLoading(false);
    }
  }

  const filtered = result?.recommendations.filter((r) => r.matchScore >= minScore) ?? [];

  // ── Credit badge text ─────────────────────────────────────────────────────
  function CreditBadge() {
    if (!creditsInfo) return null;

    if (creditsInfo.isProUser) {
      const shown = selectedApp && selectedApp !== "__latest__";
      if (!shown) {
        return (
          <div className="flex items-center gap-2 bg-muted rounded-lg px-3 py-2 text-sm">
            <TrendingUp className="w-4 h-4 text-primary" />
            <span className="text-muted-foreground">10 searches / CV / day</span>
          </div>
        );
      }
      const remaining = creditsInfo.remainingForCv;
      const used = creditsInfo.runsUsedTodayForCv;
      return (
        <div className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${remaining === 0 ? "bg-amber-50 border border-amber-200" : "bg-muted"}`}>
          <TrendingUp className={`w-4 h-4 ${remaining === 0 ? "text-amber-500" : "text-primary"}`} />
          <span className={`font-medium ${remaining === 0 ? "text-amber-700" : ""}`}>{remaining}</span>
          <span className="text-muted-foreground">/ 10 today</span>
          {used > 0 && (
            <span className="text-xs text-muted-foreground">({used} used)</span>
          )}
        </div>
      );
    }

    return (
      <div className="flex items-center gap-2 bg-muted rounded-lg px-3 py-2 text-sm">
        <TrendingUp className="w-4 h-4 text-primary" />
        <span className="font-medium">{creditsInfo.jobRecCredits}</span>
        <span className="text-muted-foreground">searches left</span>
      </div>
    );
  }

  return (
    <AppLayout>
      {modalJob && (
        <TailorCvModal
          applications={applications}
          jobTitle={modalJob.job.title}
          jobCompany={modalJob.job.company}
          externalJobCacheId={modalJob.cacheId}
          onClose={() => setModalJob(null)}
        />
      )}
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-primary" />
              Find Matching Jobs
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              AI-powered recommendations based on your CV and preferences.
              {isProUser && " Each CV gets 10 searches per day."}
            </p>
          </div>
          <CreditBadge />
        </div>

        {/* ── Pro: must select a CV ── */}
        {isProUser && !selectedApp && applications.length > 0 && (
          <div className="mb-6 flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm">
            <FileText className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
            <p className="text-blue-800">
              Select which CV you'd like job recommendations for — each CV has its own independent daily quota of 10 searches.
            </p>
          </div>
        )}

        {/* ── No free credits (non-Pro) ── */}
        {noFreeCredits && (
          <div className="mb-6 flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm">
            <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium text-amber-800">No recommendation searches remaining</p>
              <p className="text-amber-700 mt-0.5">
                Unlock a CV analysis ($6.99) to receive 10 one-time searches, or upgrade to Pro for 10 searches per CV per day.
              </p>
            </div>
          </div>
        )}

        {/* ── Pro CV daily limit reached ── */}
        {cvDailyLimitReached && (
          <div className="mb-6 flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm">
            <RefreshCcw className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium text-amber-800">Daily limit reached for this CV</p>
              <p className="text-amber-700 mt-0.5">
                You've used all 10 searches for this CV today. Try again tomorrow, or switch to a different CV to get another 10 searches.
              </p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <Card className="mb-6">
            <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="w-4 h-4 text-muted-foreground" />
                Choose a CV &amp; Set Preferences
              </CardTitle>
              <Button
                type="submit"
                disabled={!canSearch}
                className="shrink-0"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Finding matching jobs…
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    {isProUser
                      ? proRemaining !== null
                        ? `Find My Jobs (${proRemaining} left today)`
                        : "Find My Jobs"
                      : freeCredits !== null && freeCredits > 0
                      ? `Find My Jobs (${freeCredits} left)`
                      : "Find My Jobs"}
                  </>
                )}
              </Button>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* CV selector — always shown, required label for Pro */}
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium mb-1.5">
                  CV to use
                  {isProUser && (
                    <span className="ml-2 text-xs font-normal text-primary">(each CV has its own daily quota)</span>
                  )}
                  {!isProUser && (
                    <span className="ml-2 text-xs font-normal text-muted-foreground">(optional)</span>
                  )}
                </label>
                <Select
                  value={selectedApp}
                  onValueChange={setSelectedApp}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={applications.length === 0 ? "No CVs found — analyse one first" : "Select a CV…"} />
                  </SelectTrigger>
                  <SelectContent>
                    {!isProUser && (
                      <SelectItem value="__latest__">Most recent CV (auto)</SelectItem>
                    )}
                    {applications.slice(0, 20).map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.jobTitle} @ {a.company}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {isProUser && selectedApp && selectedApp !== "__latest__" && proRemaining !== null && (
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    {proRunsUsed} search{proRunsUsed === 1 ? "" : "es"} used today for this CV ·{" "}
                    <span className={proRemaining === 0 ? "text-amber-600 font-medium" : "text-foreground"}>
                      {proRemaining} remaining
                    </span>
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Preferred location <span className="text-muted-foreground font-normal">(optional)</span>
                </label>
                <Input
                  placeholder="e.g. London, Stockholm"
                  value={preferredLocation}
                  onChange={(e) => setPreferredLocation(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">Country</label>
                <Select value={country} onValueChange={setCountry}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select country" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {COUNTRY_OPTIONS.filter(c => c.code !== "").map((c) => (
                      <SelectItem key={c.code} value={c.code}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">Work arrangement</label>
                <Select value={remotePreference} onValueChange={setRemotePreference}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select arrangement" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any</SelectItem>
                    <SelectItem value="remote">Remote only</SelectItem>
                    <SelectItem value="hybrid">Hybrid</SelectItem>
                    <SelectItem value="onsite">On-site</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Job title <span className="text-muted-foreground font-normal">(optional override)</span>
                </label>
                <Input
                  placeholder="e.g. Senior Product Manager"
                  value={roleType}
                  onChange={(e) => setRoleType(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

        </form>

        {error && (
          <div className="mt-6 flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg text-sm">
            <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {result && (
          <div className="mt-8">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-lg font-semibold">
                  {result.recommendations.length} Jobs Matched
                  {result.candidateName && (
                    <span className="text-muted-foreground font-normal ml-2 text-base">
                      for {result.candidateName}
                    </span>
                  )}
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Searched across {result.totalJobsFetched} live openings ·{" "}
                  {result.targetRoles.slice(0, 3).join(", ")}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground">Min score</label>
                <Select value={String(minScore)} onValueChange={(v) => setMinScore(Number(v))}>
                  <SelectTrigger className="w-24 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">All</SelectItem>
                    <SelectItem value="30">30%+</SelectItem>
                    <SelectItem value="50">50%+</SelectItem>
                    <SelectItem value="70">70%+</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {filtered.length === 0 ? (
              <p className="text-center text-muted-foreground py-8 text-sm">
                No jobs above {minScore}% match. Try lowering the filter.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filtered.map((rec) => (
                  <JobCard key={rec.id} rec={rec} onTailor={handleTailor} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
