import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { authedFetch } from "@/lib/authed-fetch";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Loader2, Star, MapPin, Building2, Lock, Globe, Send, CheckCircle,
  Clock, Briefcase, Search, Filter, Sparkles, ChevronRight, Banknote,
  MessageSquare,
} from "lucide-react";
import { VisaSignalBadge, type VisaSignal } from "@/components/visa/visa-signal-badge";
import { LanguageSignalBadge, type LanguageSignal } from "@/components/language/language-signal-badge";
import { RelocationScoreBadge, type RelocationRecommendation } from "@/components/relocation/relocation-score-badge";
import { cn } from "@/lib/utils";

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
  applicationCount: number;
  sponsorshipSignal?: string | null;
  sponsorshipConfidence?: number | null;
  languageRequirementSignal?: string | null;
  languageConfidence?: number | null;
  relocationScore?: number | null;
  relocationRecommendation?: string | null;
  estimatedMonthlySurplus?: string | null;
  userApplication: { id: string; status: string; stage: string } | null;
  latestAnalysis: { matchScore: number; applyRecommendation: string | null } | null;
  publishedAt: string | null;
  createdAt: string;
}

interface MyApplication {
  id: string;
  jobId: string;
  applicationId: string;
  jobTitle: string | null;
  jobCompany: string | null;
  jobLocation: string | null;
  jobRemote: boolean | null;
  jobStatus: string | null;
  status: string;
  stage: string;
  appliedAt: string;
  updatedAt: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatSalary(min: string | null, max: string | null, currency: string | null) {
  const c = currency ?? "USD";
  if (min && max) return `${Number(min).toLocaleString()}–${Number(max).toLocaleString()} ${c}`;
  if (min) return `From ${Number(min).toLocaleString()} ${c}`;
  if (max) return `Up to ${Number(max).toLocaleString()} ${c}`;
  return null;
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function scoreColor(score: number) {
  if (score >= 70) return "text-green-700";
  if (score >= 45) return "text-amber-600";
  return "text-red-500";
}

// ─── Job Card ─────────────────────────────────────────────────────────────────

function ExclusiveJobCard({ job, onClick }: { job: InternalJob; onClick: () => void }) {
  const salary = formatSalary(job.salaryMin, job.salaryMax, job.currency);
  const alreadyApplied = !!job.userApplication;

  return (
    <Card
      className={cn(
        "transition-all hover:shadow-md cursor-pointer",
        alreadyApplied && "border-purple-200 bg-purple-50/20",
      )}
      onClick={onClick}
    >
      <CardContent className="p-5">
        {/* Badges */}
        <div className="flex items-center gap-2 flex-wrap mb-2">
          <Badge className="bg-purple-100 text-purple-800 border-purple-200 border text-xs gap-1">
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
          {job.sponsorshipSignal && job.sponsorshipSignal !== "unknown" && (
            <VisaSignalBadge signal={job.sponsorshipSignal as VisaSignal} confidence={job.sponsorshipConfidence ?? undefined} />
          )}
          {job.languageRequirementSignal && job.languageRequirementSignal !== "unknown" && (
            <LanguageSignalBadge signal={job.languageRequirementSignal as LanguageSignal} confidence={job.languageConfidence ?? undefined} />
          )}
          {job.relocationRecommendation && job.relocationRecommendation !== "unknown" && (
            <RelocationScoreBadge
              recommendation={job.relocationRecommendation as RelocationRecommendation}
              score={job.relocationScore ?? undefined}
            />
          )}
          {job.latestAnalysis && (
            <span className={cn("text-xs font-bold ml-auto", scoreColor(job.latestAnalysis.matchScore))}>
              {job.latestAnalysis.matchScore}% match
            </span>
          )}
        </div>

        {/* Title + company */}
        <h3 className="font-semibold text-base leading-tight mb-1">{job.title}</h3>
        <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap mb-2">
          <span className="flex items-center gap-1"><Building2 className="w-3.5 h-3.5" />{job.company}</span>
          {job.location && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{job.location}</span>}
          {job.seniority && <span className="capitalize flex items-center gap-1"><Briefcase className="w-3.5 h-3.5" />{job.seniority}</span>}
          {job.employmentType && <span className="capitalize">{job.employmentType.replace("_", " ")}</span>}
        </div>
        {salary && (
          <p className="text-xs font-semibold mb-2 flex items-center gap-1">
            <Banknote className="w-3.5 h-3.5" />{salary}
          </p>
        )}

        {/* Description excerpt */}
        <p className="text-xs text-foreground/70 leading-relaxed line-clamp-2 mb-3">{job.description}</p>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 pt-2 border-t border-border">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {job.applicationCount} applied
            </span>
            {job.publishedAt && (
              <span className="text-xs text-muted-foreground">{timeAgo(job.publishedAt)}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {alreadyApplied ? (
              <span className="flex items-center gap-1 text-xs text-green-700">
                <CheckCircle className="w-3.5 h-3.5" />
                Applied
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs text-purple-600 font-medium">
                <Send className="w-3 h-3" /> Apply
              </span>
            )}
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── My Applications section ──────────────────────────────────────────────────

function MyApplications() {
  const [, navigate] = useLocation();

  const { data: appsData, isLoading } = useQuery<{ applications: MyApplication[] }>({
    queryKey: ["my-internal-applications"],
    queryFn: async () => {
      const res = await authedFetch(`${BASE}/my-internal-applications`);
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Failed");
      return d;
    },
  });

  const apps = appsData?.applications ?? [];

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-8">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading your applications…
      </div>
    );
  }

  if (apps.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground space-y-3">
        <Send className="w-10 h-10 mx-auto opacity-20 text-purple-400" />
        <p className="text-sm">No applications yet</p>
        <p className="text-xs opacity-70">Browse jobs and apply to get started.</p>
      </div>
    );
  }

  const STATUS_COLORS: Record<string, string> = {
    applied: "bg-blue-50 text-blue-700 border-blue-200",
    shortlisted: "bg-purple-50 text-purple-700 border-purple-200",
    interview: "bg-indigo-50 text-indigo-700 border-indigo-200",
    offer: "bg-green-50 text-green-800 border-green-200",
    hired: "bg-green-100 text-green-900 border-green-300",
    rejected: "bg-red-50 text-red-700 border-red-200",
    withdrawn: "bg-gray-100 text-gray-500 border-gray-200",
  };

  return (
    <div className="space-y-3">
      {apps.map((app) => (
        <Card
          key={app.id}
          className="cursor-pointer hover:shadow-md transition-all"
          onClick={() => navigate(`/jobs/exclusive/application/${app.id}`)}
        >
          <CardContent className="p-4 flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm">{app.jobTitle ?? "Unknown Role"}</p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5 flex-wrap">
                {app.jobCompany && <span className="flex items-center gap-1"><Building2 className="w-3 h-3" />{app.jobCompany}</span>}
                {app.jobLocation && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{app.jobLocation}</span>}
                <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{timeAgo(app.appliedAt)}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 capitalize">Stage: {app.stage?.replace("_", " ")}</p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <Badge variant="outline" className={cn("text-xs capitalize", STATUS_COLORS[app.status])}>
                {app.status}
              </Badge>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

type Tab = "browse" | "applied";

export default function ExclusiveJobs() {
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<Tab>("browse");
  const [search, setSearch] = useState("");
  const [filterRemote, setFilterRemote] = useState("all");
  const [filterEmploymentType, setFilterEmploymentType] = useState("all");
  const [filterSeniority, setFilterSeniority] = useState("all");

  // Build query string for filters
  const params = new URLSearchParams();
  if (search) params.set("query", search);
  if (filterRemote === "true") params.set("remote", "true");
  if (filterEmploymentType && filterEmploymentType !== "all") params.set("employmentType", filterEmploymentType);
  if (filterSeniority && filterSeniority !== "all") params.set("seniority", filterSeniority);
  const queryString = params.toString();

  const { data, isLoading, error } = useQuery<{ jobs: InternalJob[]; plan: string }>({
    queryKey: ["internal-jobs", queryString],
    queryFn: async () => {
      const res = await authedFetch(`${BASE}/internal-jobs${queryString ? `?${queryString}` : ""}`);
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Failed");
      return d;
    },
  });

  const jobs = data?.jobs ?? [];
  const plan = data?.plan ?? "free";

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Star className="w-6 h-6 text-purple-600" />
              Resuone Exclusive Jobs
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Handpicked roles posted directly by recruiters on Resuone.
            </p>
          </div>
          <Button variant="outline" size="sm" className="flex items-center gap-2 text-purple-600 border-purple-200"
            onClick={() => navigate("/jobs/exclusive/messages")}>
            <MessageSquare className="w-4 h-4" /> Messages
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-5 border-b border-border">
          {(["browse", "applied"] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors capitalize",
                activeTab === tab
                  ? "border-purple-600 text-purple-700"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {tab === "browse" ? "Browse Jobs" : "My Applications"}
            </button>
          ))}
        </div>

        {/* Pro notice */}
        {plan === "free" && activeTab === "browse" && (
          <div className="mb-5 p-4 rounded-lg bg-purple-50 border border-purple-200 flex items-start gap-3">
            <Lock className="w-4 h-4 text-purple-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-purple-900">Pro plan unlocks exclusive jobs</p>
              <p className="text-xs text-purple-700 mt-0.5">Most listings are visible and open only for Pro+ subscribers.</p>
            </div>
          </div>
        )}

        {/* Browse tab */}
        {activeTab === "browse" && (
          <>
            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3 mb-5">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search title, company, keywords..."
                  className="pl-9"
                />
              </div>
              <Select value={filterRemote} onValueChange={setFilterRemote}>
                <SelectTrigger className="w-36 shrink-0">
                  <SelectValue placeholder="Work type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any</SelectItem>
                  <SelectItem value="true">Remote</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterEmploymentType} onValueChange={setFilterEmploymentType}>
                <SelectTrigger className="w-36 shrink-0">
                  <SelectValue placeholder="Job type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any</SelectItem>
                  <SelectItem value="full_time">Full-time</SelectItem>
                  <SelectItem value="part_time">Part-time</SelectItem>
                  <SelectItem value="contract">Contract</SelectItem>
                  <SelectItem value="freelance">Freelance</SelectItem>
                  <SelectItem value="internship">Internship</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterSeniority} onValueChange={setFilterSeniority}>
                <SelectTrigger className="w-36 shrink-0">
                  <SelectValue placeholder="Level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any</SelectItem>
                  <SelectItem value="junior">Junior</SelectItem>
                  <SelectItem value="mid">Mid-level</SelectItem>
                  <SelectItem value="senior">Senior</SelectItem>
                  <SelectItem value="lead">Lead</SelectItem>
                  <SelectItem value="director">Director</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {isLoading && (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            )}

            {error && (
              <div className="text-center py-16 text-sm text-destructive">
                Failed to load jobs. Please try refreshing.
              </div>
            )}

            {!isLoading && !error && jobs.length === 0 && (
              <div className="text-center py-20 text-muted-foreground space-y-3">
                <Star className="w-12 h-12 mx-auto opacity-20 text-purple-400" />
                <p className="text-sm font-medium">
                  {search || filterRemote || filterEmploymentType || filterSeniority
                    ? "No jobs match your filters"
                    : "No exclusive jobs right now"}
                </p>
                <p className="text-xs opacity-70">
                  {search || filterRemote || filterEmploymentType || filterSeniority
                    ? "Try adjusting your search or filters."
                    : "Recruiters haven't posted any listings yet — check back soon."}
                </p>
              </div>
            )}

            {!isLoading && jobs.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {jobs.map((job) => (
                  <ExclusiveJobCard
                    key={job.id}
                    job={job}
                    onClick={() => navigate(`/jobs/exclusive/${job.id}`)}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* My Applications tab */}
        {activeTab === "applied" && <MyApplications />}
      </div>
    </AppLayout>
  );
}
