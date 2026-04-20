import { useState, useCallback } from "react";
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

// ─── Source badge ─────────────────────────────────────────────────────────────

function SourceBadge({ source }: { source: string }) {
  const labels: Record<string, string> = {
    google_jobs_serpapi: "Google Jobs",
    greenhouse: "Greenhouse",
    lever: "Lever",
  };
  const label = labels[source] ?? source;
  return (
    <Badge variant="secondary" className="text-xs">
      {label}
    </Badge>
  );
}

// ─── Salary display ───────────────────────────────────────────────────────────

function SalaryDisplay({ min, max, currency }: { min: string | null; max: string | null; currency: string | null }) {
  if (!min && !max) return null;
  const fmt = (n: string) =>
    parseInt(n, 10).toLocaleString("en", { notation: "compact", compactDisplay: "short" });
  const cur = currency || "";
  const range = min && max ? `${cur}${fmt(min)} – ${cur}${fmt(max)}` : min ? `From ${cur}${fmt(min)}` : `Up to ${cur}${fmt(max!)}`;
  return <span className="text-sm text-green-600 font-medium">{range}</span>;
}

// ─── Job Card ─────────────────────────────────────────────────────────────────

function JobCard({
  job,
  onSave,
  saved,
}: {
  job: DiscoveredJob;
  onSave: (job: DiscoveredJob) => void;
  saved: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const desc = job.description ?? "";
  const shortDesc = desc.slice(0, 250);
  const hasMore = desc.length > 250;

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base leading-snug line-clamp-2">
              {job.title}
            </CardTitle>
            <div className="flex items-center gap-1.5 mt-1 text-sm text-muted-foreground">
              <Building2 className="h-3.5 w-3.5 shrink-0" />
              <span className="font-medium truncate">{job.company || "Unknown company"}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              title={saved ? "Saved" : "Save job"}
              onClick={() => onSave(job)}
              disabled={saved}
            >
              <Bookmark className={`h-4 w-4 ${saved ? "fill-primary text-primary" : ""}`} />
            </Button>
            {job.applyUrl && (
              <Button asChild size="sm" variant="outline">
                <a href={job.applyUrl} target="_blank" rel="noopener noreferrer">
                  Apply <ExternalLink className="ml-1 h-3.5 w-3.5" />
                </a>
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3 pt-0">
        {/* Meta row */}
        <div className="flex flex-wrap items-center gap-2">
          {job.location && (
            <span className="flex items-center gap-1 text-sm text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" />
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
          <SalaryDisplay min={job.salaryMin} max={job.salaryMax} currency={job.currency} />
        </div>

        {/* Skills */}
        {job.skills && job.skills.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {job.skills.slice(0, 6).map((skill) => (
              <Badge key={skill} variant="secondary" className="text-xs">
                {skill}
              </Badge>
            ))}
            {job.skills.length > 6 && (
              <Badge variant="secondary" className="text-xs text-muted-foreground">
                +{job.skills.length - 6} more
              </Badge>
            )}
          </div>
        )}

        {/* Description */}
        {desc && (
          <div className="text-sm text-muted-foreground leading-relaxed">
            <p>{expanded ? desc : shortDesc}{!expanded && hasMore ? "…" : ""}</p>
            {hasMore && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="flex items-center gap-1 text-xs text-primary mt-1 hover:underline"
              >
                {expanded ? (
                  <><ChevronUp className="h-3 w-3" /> Show less</>
                ) : (
                  <><ChevronDown className="h-3 w-3" /> Show more</>
                )}
              </button>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-1 border-t">
          <SourceBadge source={job.source} />
          {job.postedAt && (
            <span className="text-xs text-muted-foreground">
              {formatRelative(job.postedAt)}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
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
      if (savedJobIds.has(job.id)) return;
      try {
        await saveJob({
          jobTitle: job.title,
          company: job.company ?? "",
          location: job.location ?? "",
          applyUrl: job.applyUrl ?? job.companyCareersUrl ?? "",
          jobSnapshot: { source: job.source, description: job.description?.slice(0, 500) ?? "" },
        });
        setSavedJobIds((prev) => new Set([...prev, job.id]));
        toast({ title: "Job saved to tracker" });
      } catch (err: any) {
        toast({ title: "Could not save job", description: err.message, variant: "destructive" });
      }
    },
    [savedJobIds, toast],
  );

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Globe className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">Global Job Discovery</h1>
          </div>
          <p className="text-muted-foreground text-sm">
            Search across Google Jobs, Greenhouse, and Lever in one unified engine.
          </p>
        </div>

        {/* Search form */}
        <Card>
          <CardContent className="pt-5">
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

              <div className="grid grid-cols-2 gap-3">
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
                  <Label className="text-xs text-muted-foreground">City / region (optional)</Label>
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

        {/* Loading state */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm">Searching Google Jobs, Greenhouse & Lever…</p>
          </div>
        )}

        {/* Results */}
        {result && !loading && (
          <div className="space-y-4">
            {/* Result summary */}
            <div className="flex items-center justify-between">
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
                  return (
                    <span key={src}>
                      {labels[src] ?? src}: {count}
                    </span>
                  );
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
                  onSave={handleSave}
                  saved={savedJobIds.has(job.id)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Empty state before search */}
        {!result && !loading && (
          <div className="text-center py-20 text-muted-foreground space-y-3">
            <Globe className="h-12 w-12 mx-auto opacity-20" />
            <p className="text-sm">Search across multiple job boards in one place.</p>
            <p className="text-xs opacity-70">Powered by Google Jobs, Greenhouse ATS & Lever ATS</p>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
