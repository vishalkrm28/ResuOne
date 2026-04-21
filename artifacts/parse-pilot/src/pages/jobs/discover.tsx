import { useState, useEffect } from "react";
import { COUNTRY_OPTIONS } from "@/lib/countries";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { authedFetch } from "@/lib/authed-fetch";
import { TailorCvModal } from "@/components/application/tailor-cv-modal";
import {
  MapPin,
  Building2,
  ExternalLink,
  Loader2,
  Globe,
  Sparkles,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Bookmark,
  BookmarkCheck,
  FileText,
  MailOpen,
  RefreshCcw,
} from "lucide-react";
import { saveJob } from "@/lib/tracker-api";

const BASE = import.meta.env.VITE_API_URL ?? "/api";

// ─── Types ────────────────────────────────────────────────────────────────────

interface DiscoveredJob {
  id: string;
  source: string;
  sourceType: string;
  title: string;
  company: string | null;
  location: string | null;
  country: string | null;
  remote: boolean | null;
  employmentType: string | null;
  seniority: string | null;
  salaryMin: string | null;
  salaryMax: string | null;
  currency: string | null;
  description: string | null;
  applyUrl: string | null;
  companyCareersUrl: string | null;
  postedAt: string | null;
  skills: string[] | null;
  metadata: Record<string, unknown>;
}

interface MatchInfo {
  matchScore: number;
  fitReasons: string[];
  missingRequirements: string[];
  recommendationSummary: string;
}

interface DiscoverResponse {
  jobs: DiscoveredJob[];
  total: number;
  cached: boolean;
  aiRanked: boolean;
  matchData: Record<string, MatchInfo>;
  sourceBreakdown: { google_jobs?: number; greenhouse?: number };
  errors?: string[];
}

interface Application {
  id: string;
  jobTitle: string;
  company: string;
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

function sourceLabel(source: string) {
  const map: Record<string, string> = {
    google_jobs_serpapi: "Google Jobs",
    greenhouse: "Greenhouse",
    lever: "Lever",
  };
  return map[source] ?? source;
}

function formatRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const d = Math.floor(ms / 86_400_000);
  if (d === 0) return "Today";
  if (d === 1) return "Yesterday";
  if (d < 7) return `${d} days ago`;
  if (d < 30) return `${Math.floor(d / 7)}w ago`;
  return `${Math.floor(d / 30)}mo ago`;
}

// ─── Job Card ─────────────────────────────────────────────────────────────────

function JobCard({
  job,
  match,
  applications,
  onTailor,
  saved,
  saving,
  onSave,
}: {
  job: DiscoveredJob;
  match: MatchInfo | null;
  applications: Application[];
  onTailor: (job: DiscoveredJob, mode: "tailor" | "cover-letter") => void;
  saved: boolean;
  saving: boolean;
  onSave: (job: DiscoveredJob) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const { toast } = useToast();

  const salaryText =
    job.salaryMin && job.salaryMax
      ? `${Number(job.salaryMin).toLocaleString()}–${Number(job.salaryMax).toLocaleString()} ${job.currency ?? ""}`
      : job.salaryMin
      ? `From ${Number(job.salaryMin).toLocaleString()} ${job.currency ?? ""}`
      : null;

  const cleanDesc = job.description
    ? job.description.replace(/<[^>]+>/g, "").trim()
    : null;

  return (
    <Card className="border border-border hover:shadow-md transition-shadow">
      <CardContent className="p-5">
        {/* Title + badge row */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-base text-foreground leading-tight line-clamp-2">
              {job.title}
            </h3>
            <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground flex-wrap">
              {job.company && (
                <span className="flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5 shrink-0" />
                  {job.company}
                </span>
              )}
              {job.location && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 shrink-0" />
                  {job.location}
                </span>
              )}
              {job.remote && (
                <Badge variant="outline" className="text-xs text-blue-600 border-blue-300">
                  Remote
                </Badge>
              )}
              {job.employmentType && (
                <Badge variant="outline" className="text-xs capitalize">
                  {job.employmentType}
                </Badge>
              )}
              {salaryText && (
                <span className="text-xs font-medium text-foreground/80">{salaryText}</span>
              )}
            </div>
          </div>
          {match && (
            <div className="shrink-0">
              <ScoreBadge score={match.matchScore} />
            </div>
          )}
        </div>

        {/* Match score bar */}
        {match && (
          <div className="mb-3">
            <MatchScoreBar score={match.matchScore} />
          </div>
        )}

        {/* AI summary */}
        {match?.recommendationSummary && (
          <p className="text-sm text-muted-foreground mb-3 leading-relaxed italic">
            {match.recommendationSummary}
          </p>
        )}

        {/* Expand toggle */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mb-2"
        >
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          {expanded ? "Hide details" : "Show details"}
        </button>

        {expanded && (
          <div className="space-y-3 mt-2">
            {match && (match.fitReasons ?? []).length > 0 && (
              <div>
                <p className="text-xs font-semibold text-green-700 mb-1.5">Why it fits</p>
                <ul className="space-y-1">
                  {match.fitReasons.map((r, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-xs text-foreground/80">
                      <span className="text-green-500 mt-0.5">✓</span>
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {match && (match.missingRequirements ?? []).length > 0 && (
              <div>
                <p className="text-xs font-semibold text-amber-700 mb-1.5">Gaps to bridge</p>
                <ul className="space-y-1">
                  {match.missingRequirements.map((r, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-xs text-foreground/80">
                      <span className="text-amber-500 mt-0.5">△</span>
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {!match && job.skills && job.skills.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1.5">Skills</p>
                <div className="flex flex-wrap gap-1.5">
                  {job.skills.map((skill) => (
                    <Badge key={skill} variant="secondary" className="text-xs">
                      {skill}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            {cleanDesc && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1">About the role</p>
                <p className="text-xs text-foreground/70 leading-relaxed line-clamp-4">
                  {cleanDesc}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="mt-3 pt-3 border-t border-border">
          <div className="flex items-center justify-between gap-2 flex-wrap mb-2.5">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>via {sourceLabel(job.source)}</span>
              {job.postedAt && (
                <>
                  <span>·</span>
                  <span>{formatRelative(job.postedAt)}</span>
                </>
              )}
            </div>
            {job.applyUrl && (
              <a
                href={job.applyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
              >
                Apply now
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>

          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="flex-1 text-xs h-8"
              onClick={() => onTailor(job, "tailor")}
              disabled={applications.length === 0}
              title={applications.length === 0 ? "Analyse a CV first" : "Tailor your CV for this role"}
            >
              <FileText className="w-3.5 h-3.5 mr-1.5" />
              Tailor CV
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="flex-1 text-xs h-8"
              onClick={() => onTailor(job, "cover-letter")}
              disabled={applications.length === 0}
              title={applications.length === 0 ? "Analyse a CV first" : "Generate a cover letter"}
            >
              <MailOpen className="w-3.5 h-3.5 mr-1.5" />
              Cover Letter
            </Button>
            <Button
              size="sm"
              variant={saved ? "default" : "outline"}
              className="text-xs h-8 px-3"
              onClick={() => onSave(job)}
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

export default function GlobalJobDiscover() {
  const { toast } = useToast();

  const [applications, setApplications] = useState<Application[]>([]);
  const [selectedApp, setSelectedApp] = useState<string>("");
  const [preferredLocation, setPreferredLocation] = useState("");
  const [country, setCountry] = useState("");
  const [remotePreference, setRemotePreference] = useState("any");
  const [roleOverride, setRoleOverride] = useState("");
  const [minScore, setMinScore] = useState(0);

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DiscoverResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [savedJobIds, setSavedJobIds] = useState<Set<string>>(new Set());
  const [savingJobId, setSavingJobId] = useState<string | null>(null);
  const [modalJob, setModalJob] = useState<DiscoveredJob | null>(null);

  useEffect(() => {
    authedFetch(`${BASE}/applications`)
      .then((r) => (r.ok ? r.json() : {}))
      .then((data) => {
        const apps: Application[] = Array.isArray(data.applications)
          ? data.applications
          : Array.isArray(data)
          ? data
          : [];
        setApplications(apps);
        if (apps.length > 0) setSelectedApp(apps[0].id);
      })
      .catch(() => {});
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const app = applications.find((a) => a.id === selectedApp);
    const query = roleOverride.trim() || (app ? app.jobTitle : "");
    if (!query) {
      toast({ title: "Select a CV or enter a job title", variant: "destructive" });
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await authedFetch(`${BASE}/jobs/discover`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          country,
          location: preferredLocation.trim() || "",
          remoteOnly: remotePreference === "remote",
          aiRanking: true,
          applicationId: selectedApp || undefined,
          skipCache: false,
          limit: 50,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }

      const data: DiscoverResponse = await res.json();
      setResult(data);

      toast({
        title: `${data.jobs.length} jobs found`,
        description: data.aiRanked ? "AI-ranked by match with your CV" : "Sorted by relevance",
      });
    } catch (err: any) {
      const msg = err?.message ?? "Something went wrong";
      setError(msg);
      toast({ title: "Search failed", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(job: DiscoveredJob) {
    if (savedJobIds.has(job.id) || savingJobId === job.id) return;
    setSavingJobId(job.id);
    try {
      const { alreadySaved } = await saveJob({
        discoveredJobId: job.id,
        jobTitle: job.title,
        company: job.company ?? null,
        location: job.location ?? null,
        employmentType: job.employmentType ?? null,
        remoteType: job.remote ? "remote" : null,
        salaryMin: job.salaryMin ? Number(job.salaryMin) : null,
        salaryMax: job.salaryMax ? Number(job.salaryMax) : null,
        currency: job.currency ?? null,
        applyUrl: job.applyUrl ?? job.companyCareersUrl ?? null,
        jobSnapshot: job as unknown as Record<string, unknown>,
      });
      setSavedJobIds((prev) => new Set([...prev, job.id]));
      toast({ title: alreadySaved ? "Already saved" : "Job saved to tracker", description: "View it in Saved Jobs." });
    } catch (err: any) {
      toast({ title: "Could not save job", description: err.message, variant: "destructive" });
    } finally {
      setSavingJobId(null);
    }
  }

  function handleTailor(job: DiscoveredJob, mode: "tailor" | "cover-letter") {
    setModalJob(job);
  }

  const scored = result
    ? result.jobs
        .map((j) => ({ job: j, match: result.matchData?.[j.id] ?? null }))
        .filter(({ match }) => !match || match.matchScore >= minScore)
    : [];

  return (
    <AppLayout>
      {modalJob && (
        <TailorCvModal
          applications={applications}
          jobTitle={modalJob.title}
          jobCompany={modalJob.company ?? undefined}
          externalJobCacheId={modalJob.id}
          defaultApplicationId={selectedApp || undefined}
          onClose={() => setModalJob(null)}
        />
      )}

      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Globe className="w-6 h-6 text-primary" />
              Global Job Discovery
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              AI-powered matching across Google Jobs and Greenhouse ATS — driven by your CV.
            </p>
          </div>
        </div>

        {/* No CVs warning */}
        {applications.length === 0 && (
          <div className="mb-6 flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm">
            <FileText className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
            <p className="text-blue-800">
              Analyse a CV first — your CV is used to find and rank matching jobs across the globe.
            </p>
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
                disabled={loading || applications.length === 0}
                className="shrink-0"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Searching…
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Find My Jobs
                  </>
                )}
              </Button>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* CV selector */}
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium mb-1.5">CV to use</label>
                <Select value={selectedApp} onValueChange={setSelectedApp}>
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        applications.length === 0
                          ? "No CVs found — analyse one first"
                          : "Select a CV…"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {applications.slice(0, 20).map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.jobTitle} @ {a.company}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Preferred location */}
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Preferred location <span className="text-muted-foreground font-normal">(optional)</span>
                </label>
                <Input
                  placeholder="e.g. London, New York"
                  value={preferredLocation}
                  onChange={(e) => setPreferredLocation(e.target.value)}
                />
              </div>

              {/* Country */}
              <div>
                <label className="block text-sm font-medium mb-1.5">Country</label>
                <Select
                  value={country === "" ? "all" : country}
                  onValueChange={(v) => setCountry(v === "all" ? "" : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select country" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {COUNTRY_OPTIONS.map((c) => (
                      <SelectItem key={c.code === "" ? "all" : c.code} value={c.code === "" ? "all" : c.code}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Work arrangement */}
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

              {/* Job title override */}
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Job title <span className="text-muted-foreground font-normal">(optional override)</span>
                </label>
                <Input
                  placeholder="e.g. Senior Product Manager"
                  value={roleOverride}
                  onChange={(e) => setRoleOverride(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

        </form>

        {/* Error */}
        {error && (
          <div className="mt-6 flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg text-sm">
            <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {/* Results */}
        {result && !loading && (
          <div className="mt-8">
            <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
              <div>
                <h2 className="text-lg font-semibold">
                  {result.jobs.length} Jobs Found
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
                  {result.aiRanked && (
                    <span className="inline-flex items-center gap-1 text-primary font-medium">
                      <Sparkles className="w-3 h-3" /> AI-ranked by CV match
                    </span>
                  )}
                  {result.cached && (
                    <span className="inline-flex items-center gap-1">
                      <RefreshCcw className="w-3 h-3" /> Cached results
                    </span>
                  )}
                  <span>
                    {[
                      result.sourceBreakdown.google_jobs ? `Google: ${result.sourceBreakdown.google_jobs}` : null,
                      result.sourceBreakdown.greenhouse ? `Greenhouse: ${result.sourceBreakdown.greenhouse}` : null,
                    ].filter(Boolean).join(" · ")}
                  </span>
                </p>
              </div>

              {result.aiRanked && (
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
              )}
            </div>

            {scored.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground space-y-2">
                <AlertCircle className="h-8 w-8 mx-auto opacity-50" />
                <p className="text-sm">
                  {result.aiRanked
                    ? `No jobs above ${minScore}% match. Try lowering the filter.`
                    : "No jobs found. Try adjusting your preferences."}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {scored.map(({ job, match }) => (
                  <JobCard
                    key={job.id}
                    job={job}
                    match={match}
                    applications={applications}
                    onTailor={handleTailor}
                    saved={savedJobIds.has(job.id)}
                    saving={savingJobId === job.id}
                    onSave={handleSave}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Empty state */}
        {!result && !loading && (
          <div className="text-center py-20 text-muted-foreground space-y-3 mt-8">
            <Globe className="h-12 w-12 mx-auto opacity-20" />
            <p className="text-sm">Select a CV and click Find My Jobs to discover matching roles globally.</p>
            <p className="text-xs opacity-70">Powered by Google Jobs &amp; Greenhouse ATS</p>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
