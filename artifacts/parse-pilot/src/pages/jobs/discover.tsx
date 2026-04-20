import { useState, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { authedFetch } from "@/lib/authed-fetch";
import { COUNTRY_OPTIONS } from "@/lib/countries";
import { TailorCvModal } from "@/components/application/tailor-cv-modal";
import {
  MapPin,
  Building2,
  ExternalLink,
  Loader2,
  Globe,
  Search,
  Sparkles,
  RefreshCcw,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Bookmark,
  BookmarkCheck,
  FileText,
  MailOpen,
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

interface DiscoverResponse {
  jobs: DiscoveredJob[];
  total: number;
  cached: boolean;
  aiRanked: boolean;
  sourceBreakdown: Record<string, number>;
  errors?: string[];
}

interface Application {
  id: string;
  jobTitle: string;
  company: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const d = Math.floor(ms / 86_400_000);
  if (d === 0) return "Today";
  if (d === 1) return "Yesterday";
  if (d < 7) return `${d} days ago`;
  if (d < 30) return `${Math.floor(d / 7)}w ago`;
  return `${Math.floor(d / 30)}mo ago`;
}

function sourceLabel(source: string) {
  const map: Record<string, string> = {
    google_jobs_serpapi: "Google Jobs",
    greenhouse: "Greenhouse",
    lever: "Lever",
  };
  return map[source] ?? source;
}

// ─── Job Card ─────────────────────────────────────────────────────────────────

function JobCard({
  job,
  applications,
  onTailor,
  saved,
  saving,
  onSave,
}: {
  job: DiscoveredJob;
  applications: Application[];
  onTailor: (job: DiscoveredJob, mode: "tailor" | "cover-letter") => void;
  saved: boolean;
  saving: boolean;
  onSave: (job: DiscoveredJob) => void;
}) {
  const [expanded, setExpanded] = useState(false);

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
        {/* Title + meta row */}
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
              {job.seniority && (
                <Badge variant="outline" className="text-xs capitalize">
                  {job.seniority}
                </Badge>
              )}
              {salaryText && (
                <span className="text-xs font-medium text-foreground/80">{salaryText}</span>
              )}
            </div>
          </div>
        </div>

        {/* Expandable details */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mb-2"
        >
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          {expanded ? "Hide details" : "Show details"}
        </button>

        {expanded && (
          <div className="space-y-3 mt-2">
            {job.skills && job.skills.length > 0 && (
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
                <p className="text-xs text-foreground/70 leading-relaxed line-clamp-6">
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

          {/* Action buttons */}
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

  const [query, setQuery] = useState("");
  const [country, setCountry] = useState("");
  const [location, setLocation] = useState("");
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [aiRanking, setAiRanking] = useState(false);

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DiscoverResponse | null>(null);

  const [savedJobIds, setSavedJobIds] = useState<Set<string>>(new Set());
  const [savingJobId, setSavingJobId] = useState<string | null>(null);

  const [applications, setApplications] = useState<Application[]>([]);
  const [selectedAppId, setSelectedAppId] = useState<string>("");
  const [modalJob, setModalJob] = useState<DiscoveredJob | null>(null);
  const [modalMode, setModalMode] = useState<"tailor" | "cover-letter">("tailor"); // captured for future use

  // Fetch user applications for Tailor CV / Cover Letter modal
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
        if (apps.length > 0) setSelectedAppId(apps[0].id);
      })
      .catch(() => {});
  }, []);

  const handleSearch = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!query.trim()) {
        toast({ title: "Enter a search query", variant: "destructive" });
        return;
      }

      setLoading(true);
      setResult(null);

      try {
        const res = await authedFetch(`${BASE}/jobs/discover`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: query.trim(),
            country,
            location,
            remoteOnly,
            aiRanking,
            limit: 50,
          }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Unknown error" }));
          throw new Error(err.error ?? `HTTP ${res.status}`);
        }

        const data: DiscoverResponse = await res.json();
        setResult(data);

        if (data.errors?.length) {
          toast({
            title: "Some sources had issues",
            description: data.errors.join(" | "),
            variant: "destructive",
          });
        }
      } catch (err: any) {
        toast({ title: "Search failed", description: err.message, variant: "destructive" });
      } finally {
        setLoading(false);
      }
    },
    [query, country, location, remoteOnly, aiRanking, toast],
  );

  const handleSave = useCallback(
    async (job: DiscoveredJob) => {
      if (savedJobIds.has(job.id) || savingJobId === job.id) return;
      setSavingJobId(job.id);
      try {
        const { alreadySaved } = await saveJob({
          externalJobCacheId: job.id,
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
    },
    [savedJobIds, savingJobId, toast],
  );

  function handleTailor(job: DiscoveredJob, mode: "tailor" | "cover-letter") {
    setModalJob(job);
    setModalMode(mode);
  }

  return (
    <AppLayout>
      {modalJob && (
        <TailorCvModal
          applications={applications}
          jobTitle={modalJob.title}
          jobCompany={modalJob.company ?? undefined}
          externalJobCacheId={modalJob.id}
          defaultApplicationId={selectedAppId || undefined}
          onClose={() => setModalJob(null)}
        />
      )}

      <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Globe className="h-6 w-6 text-primary" />
              Global Job Discovery
            </h1>
            <p className="text-muted-foreground text-sm">
              Search across Google Jobs, Greenhouse, and Lever in one unified engine.
            </p>
          </div>
        </div>

        {/* Search form */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Search className="w-4 h-4 text-muted-foreground" />
              Search Jobs
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-0">
            <form onSubmit={handleSearch} className="space-y-4">
              <div className="flex gap-2">
                <div className="flex-1">
                  <Input
                    placeholder='e.g. "software engineer", "product manager react"'
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    disabled={loading}
                    className="w-full"
                  />
                </div>
                <Button type="submit" disabled={loading || !query.trim()}>
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <><Search className="h-4 w-4 mr-1.5" />Search</>
                  )}
                </Button>
              </div>

              {applications.length > 0 && (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">CV to tailor with</Label>
                  <select
                    value={selectedAppId}
                    onChange={(e) => setSelectedAppId(e.target.value)}
                    disabled={loading}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    {applications.slice(0, 20).map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.jobTitle} @ {a.company}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Country</Label>
                  <select
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    disabled={loading}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    {COUNTRY_OPTIONS.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">City / region</Label>
                  <Input
                    placeholder="e.g. Stockholm, London"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <Switch
                    id="remote-toggle"
                    checked={remoteOnly}
                    onCheckedChange={setRemoteOnly}
                    disabled={loading}
                  />
                  <Label htmlFor="remote-toggle" className="text-sm cursor-pointer">
                    Remote only
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    id="ai-toggle"
                    checked={aiRanking}
                    onCheckedChange={setAiRanking}
                    disabled={loading}
                  />
                  <Label htmlFor="ai-toggle" className="text-sm cursor-pointer flex items-center gap-1">
                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                    AI ranking
                  </Label>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm">Searching Google Jobs, Greenhouse &amp; Lever…</p>
          </div>
        )}

        {/* Results */}
        {result && !loading && (
          <div className="space-y-4">
            {/* Result summary bar */}
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium">
                  {result.jobs.length} results
                  {result.total > result.jobs.length && (
                    <span className="text-muted-foreground"> (of {result.total} found)</span>
                  )}
                </span>
                {result.cached && (
                  <Badge variant="secondary" className="text-xs">
                    <RefreshCcw className="h-3 w-3 mr-1" />Cached
                  </Badge>
                )}
                {result.aiRanked && (
                  <Badge className="text-xs bg-primary/10 text-primary border border-primary/20">
                    <Sparkles className="h-3 w-3 mr-1" />AI Ranked
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {Object.entries(result.sourceBreakdown).map(([src, count]) => {
                  const labels: Record<string, string> = {
                    google_jobs: "Google",
                    greenhouse: "Greenhouse",
                    lever: "Lever",
                  };
                  if (!count) return null;
                  return <span key={src}>{labels[src] ?? src}: {count}</span>;
                })}
              </div>
            </div>

            {/* No results */}
            {result.jobs.length === 0 && (
              <div className="text-center py-16 text-muted-foreground space-y-2">
                <AlertCircle className="h-8 w-8 mx-auto opacity-50" />
                <p className="text-sm">No jobs found. Try a different query or remove filters.</p>
              </div>
            )}

            {/* Job cards */}
            <div className="space-y-3">
              {result.jobs.map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  applications={applications}
                  onTailor={handleTailor}
                  saved={savedJobIds.has(job.id)}
                  saving={savingJobId === job.id}
                  onSave={handleSave}
                />
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {!result && !loading && (
          <div className="text-center py-20 text-muted-foreground space-y-3">
            <Globe className="h-12 w-12 mx-auto opacity-20" />
            <p className="text-sm">Search across multiple job boards in one place.</p>
            <p className="text-xs opacity-70">Powered by Google Jobs, Greenhouse ATS &amp; Lever ATS</p>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
