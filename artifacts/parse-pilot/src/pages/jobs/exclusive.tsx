import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { authedFetch } from "@/lib/authed-fetch";
import { useToast } from "@/hooks/use-toast";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  Loader2, Star, MapPin, Building2, Lock, Globe, ChevronDown, ChevronUp,
  Send, CheckCircle, Clock, Briefcase, ExternalLink,
} from "lucide-react";
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
  jobType: string | null;
  seniority: string | null;
  description: string;
  requirements: string[];
  salaryMin: string | null;
  salaryMax: string | null;
  currency: string | null;
  visibility: string;
  applicationCount: number;
  userApplicationStatus: string | null;
  createdAt: string;
}

interface MyApplication {
  id: string;
  jobId: string;
  jobTitle: string | null;
  jobCompany: string | null;
  jobLocation: string | null;
  jobRemote: boolean | null;
  jobStatus: string | null;
  status: string;
  coverLetter: string | null;
  createdAt: string;
}

// ─── API ──────────────────────────────────────────────────────────────────────

async function fetchInternalJobs(): Promise<{ jobs: InternalJob[]; plan: string }> {
  const res = await authedFetch(`${BASE}/internal-jobs`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to load jobs");
  return data;
}

async function fetchMyApplications(): Promise<MyApplication[]> {
  const res = await authedFetch(`${BASE}/my-internal-applications`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to load applications");
  return data.applications ?? [];
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

function AppStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    applied: { label: "Applied", cls: "bg-blue-50 text-blue-700 border-blue-200" },
    shortlisted: { label: "Shortlisted", cls: "bg-purple-50 text-purple-700 border-purple-200" },
    rejected: { label: "Not progressed", cls: "bg-red-50 text-red-700 border-red-200" },
    hired: { label: "Hired!", cls: "bg-green-100 text-green-800 border-green-200" },
  };
  const item = map[status] ?? { label: status, cls: "" };
  return <Badge variant="outline" className={cn("text-xs", item.cls)}>{item.label}</Badge>;
}

// ─── Apply Modal ──────────────────────────────────────────────────────────────

function ApplyModal({
  job,
  onClose,
  onApplied,
}: {
  job: InternalJob;
  onClose: () => void;
  onApplied: () => void;
}) {
  const { toast } = useToast();
  const [coverLetter, setCoverLetter] = useState("");
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
        if (res.status === 403 && data.code === "PRO_REQUIRED") {
          toast({
            variant: "destructive",
            title: "Pro plan required",
            description: "Upgrade to Pro to apply to Resuone Exclusive jobs.",
          });
        } else if (res.status === 409) {
          toast({ title: "Already applied", description: "You have already applied to this job." });
        } else {
          throw new Error(data.error ?? "Failed to apply");
        }
        return;
      }
      toast({ title: "Application sent!", description: `You applied to ${job.title} at ${job.company}.` });
      onApplied();
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
          <DialogTitle className="flex items-center gap-2">
            <Send className="w-5 h-5 text-purple-600" />
            Apply to {job.title}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
            <Building2 className="w-4 h-4 text-muted-foreground shrink-0" />
            <div>
              <p className="text-sm font-medium">{job.company}</p>
              {job.location && <p className="text-xs text-muted-foreground">{job.location}</p>}
            </div>
          </div>

          <div>
            <Label>Cover letter <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Textarea
              value={coverLetter}
              onChange={(e) => setCoverLetter(e.target.value)}
              rows={6}
              placeholder="Tell the recruiter why you're a great fit for this role..."
              className="mt-1.5"
            />
            <p className="text-xs text-muted-foreground mt-1.5">
              A tailored cover letter increases your chances significantly.
            </p>
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

// ─── Job Card ─────────────────────────────────────────────────────────────────

function ExclusiveJobCard({
  job,
  onApply,
}: {
  job: InternalJob;
  onApply: (job: InternalJob) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const salary = formatSalary(job.salaryMin, job.salaryMax, job.currency);
  const alreadyApplied = !!job.userApplicationStatus;

  return (
    <Card className={cn("transition-shadow hover:shadow-md", alreadyApplied && "border-purple-200 bg-purple-50/30")}>
      <CardContent className="p-5">
        {/* Header */}
        <div className="flex items-start gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <Badge className="bg-purple-100 text-purple-800 border-purple-200 border text-xs font-semibold gap-1">
                <Star className="w-3 h-3" />
                Resuone Exclusive
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
            <h3 className="font-semibold text-base leading-tight">{job.title}</h3>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-0.5 flex-wrap">
              <span className="flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5" />
                {job.company}
              </span>
              {job.location && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />
                  {job.location}
                </span>
              )}
              {job.seniority && (
                <span className="capitalize flex items-center gap-1">
                  <Briefcase className="w-3.5 h-3.5" />
                  {job.seniority}
                </span>
              )}
              {job.jobType && (
                <span className="capitalize">{job.jobType.replace("_", " ")}</span>
              )}
            </div>
            {salary && (
              <p className="text-xs font-semibold text-foreground/80 mt-1">{salary}</p>
            )}
          </div>
          <div className="text-right shrink-0">
            <p className="text-xs text-muted-foreground">{timeAgo(job.createdAt)}</p>
            <p className="text-xs text-muted-foreground">{job.applicationCount} applied</p>
          </div>
        </div>

        {/* Description preview */}
        <p className={cn("text-xs text-foreground/70 leading-relaxed", !expanded && "line-clamp-3")}>
          {job.description}
        </p>

        {/* Requirements */}
        {expanded && Array.isArray(job.requirements) && job.requirements.length > 0 && (
          <div className="mt-3">
            <p className="text-xs font-semibold text-muted-foreground mb-1.5">Requirements</p>
            <ul className="space-y-1">
              {job.requirements.map((r, i) => (
                <li key={i} className="flex items-start gap-1.5 text-xs text-foreground/80">
                  <span className="text-purple-500 mt-0.5">•</span>
                  {r}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Toggle expand */}
        {job.description.length > 150 && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mt-2 transition-colors"
          >
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            {expanded ? "Show less" : "Show more"}
          </button>
        )}

        {/* Footer */}
        <div className="mt-4 pt-3 border-t border-border flex items-center justify-between gap-3">
          <div>
            {alreadyApplied && job.userApplicationStatus && (
              <div className="flex items-center gap-1.5">
                <CheckCircle className="w-3.5 h-3.5 text-green-600" />
                <AppStatusBadge status={job.userApplicationStatus} />
              </div>
            )}
          </div>
          {alreadyApplied ? (
            <Button size="sm" variant="outline" disabled className="text-xs h-8">
              <CheckCircle className="w-3.5 h-3.5 mr-1.5 text-green-600" />
              Applied
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={() => onApply(job)}
              className="text-xs h-8 bg-purple-600 hover:bg-purple-700 text-white"
            >
              <Send className="w-3.5 h-3.5 mr-1.5" />
              Apply Now
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── My Applications section ──────────────────────────────────────────────────

function MyApplications() {
  const { data: apps, isLoading } = useQuery({
    queryKey: ["my-internal-applications"],
    queryFn: fetchMyApplications,
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading your applications…
      </div>
    );
  }

  if (!apps || apps.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4">
        You haven't applied to any Resuone Exclusive jobs yet.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {apps.map((app) => (
        <div key={app.id} className="flex items-start justify-between gap-3 p-4 rounded-lg border bg-card hover:bg-muted/30 transition-colors">
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm">{app.jobTitle ?? "Unknown Role"}</p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5 flex-wrap">
              {app.jobCompany && (
                <span className="flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5" />
                  {app.jobCompany}
                </span>
              )}
              {app.jobLocation && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />
                  {app.jobLocation}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {timeAgo(app.createdAt)}
              </span>
            </div>
          </div>
          <AppStatusBadge status={app.status} />
        </div>
      ))}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

type Tab = "browse" | "applied";

export default function ExclusiveJobs() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>("browse");
  const [applyJob, setApplyJob] = useState<InternalJob | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["internal-jobs"],
    queryFn: fetchInternalJobs,
  });

  const jobs = data?.jobs ?? [];
  const plan = data?.plan ?? "free";

  function handleApplied() {
    qc.invalidateQueries({ queryKey: ["internal-jobs"] });
    qc.invalidateQueries({ queryKey: ["my-internal-applications"] });
  }

  return (
    <AppLayout>
      {applyJob && (
        <ApplyModal
          job={applyJob}
          onClose={() => setApplyJob(null)}
          onApplied={handleApplied}
        />
      )}

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Star className="w-6 h-6 text-purple-600" />
              Resuone Exclusive Jobs
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Handpicked roles posted directly by recruiters on Resuone — apply in one click.
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-border">
          <button
            onClick={() => setActiveTab("browse")}
            className={cn(
              "px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
              activeTab === "browse"
                ? "border-purple-600 text-purple-700"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            Browse Jobs
          </button>
          <button
            onClick={() => setActiveTab("applied")}
            className={cn(
              "px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
              activeTab === "applied"
                ? "border-purple-600 text-purple-700"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            My Applications
          </button>
        </div>

        {/* Pro-only notice for free users */}
        {plan === "free" && activeTab === "browse" && (
          <div className="mb-6 p-4 rounded-lg bg-purple-50 border border-purple-200 flex items-start gap-3">
            <Lock className="w-4 h-4 text-purple-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-purple-900">Pro plan unlocks exclusive jobs</p>
              <p className="text-xs text-purple-700 mt-0.5">
                Most Resuone Exclusive listings are visible and open to apply only for Pro+ subscribers.
                Upgrade to access the full marketplace.
              </p>
            </div>
          </div>
        )}

        {/* Browse tab */}
        {activeTab === "browse" && (
          <>
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
                <p className="text-sm font-medium">No exclusive jobs right now</p>
                <p className="text-xs opacity-70">
                  Recruiters haven't posted any listings yet — check back soon.
                </p>
              </div>
            )}

            {!isLoading && jobs.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {jobs.map((job) => (
                  <ExclusiveJobCard key={job.id} job={job} onApply={setApplyJob} />
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
