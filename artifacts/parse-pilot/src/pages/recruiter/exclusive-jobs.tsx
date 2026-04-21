import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { authedFetch } from "@/lib/authed-fetch";
import { useToast } from "@/hooks/use-toast";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Loader2, Plus, Briefcase, MapPin, Building2, Users, Eye, Pause, X, Check,
  Star, Globe, Lock, ChevronDown, ChevronUp, PencilLine,
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
  status: string;
  visibility: string;
  applicationCount: number;
  createdAt: string;
}

interface Applicant {
  id: string;
  applicantName: string | null;
  applicantEmail: string | null;
  status: string;
  coverLetter: string | null;
  notes: string | null;
  createdAt: string;
}

// ─── API helpers ──────────────────────────────────────────────────────────────

async function fetchPostedJobs(): Promise<InternalJob[]> {
  const res = await authedFetch(`${BASE}/internal-jobs/posted`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to load");
  return data.jobs ?? [];
}

async function fetchApplicants(jobId: string): Promise<{ applications: Applicant[]; jobTitle: string }> {
  const res = await authedFetch(`${BASE}/internal-jobs/${jobId}/applications`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to load applicants");
  return data;
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: "bg-green-100 text-green-800 border-green-200",
    paused: "bg-yellow-100 text-yellow-800 border-yellow-200",
    closed: "bg-gray-100 text-gray-700 border-gray-200",
    draft: "bg-blue-50 text-blue-700 border-blue-200",
  };
  return (
    <Badge variant="outline" className={cn("capitalize text-xs", map[status] ?? "")}>
      {status}
    </Badge>
  );
}

function AppStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    applied: "bg-blue-50 text-blue-700 border-blue-200",
    shortlisted: "bg-purple-50 text-purple-700 border-purple-200",
    rejected: "bg-red-50 text-red-700 border-red-200",
    hired: "bg-green-100 text-green-800 border-green-200",
  };
  return (
    <Badge variant="outline" className={cn("capitalize text-xs", map[status] ?? "")}>
      {status}
    </Badge>
  );
}

// ─── Post Job Form ────────────────────────────────────────────────────────────

const EMPTY_FORM = {
  title: "", company: "", location: "", country: "", remote: false,
  jobType: "", seniority: "", description: "", requirements: "",
  salaryMin: "", salaryMax: "", currency: "USD", visibility: "pro_only" as "pro_only" | "public",
  status: "active" as "draft" | "active",
};

function PostJobDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  function set(field: keyof typeof EMPTY_FORM, value: unknown) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim() || !form.company.trim() || !form.description.trim()) {
      toast({ variant: "destructive", title: "Title, company and description are required" });
      return;
    }
    setSaving(true);
    try {
      const res = await authedFetch(`${BASE}/internal-jobs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          salaryMin: form.salaryMin ? Number(form.salaryMin) : undefined,
          salaryMax: form.salaryMax ? Number(form.salaryMax) : undefined,
          requirements: form.requirements.split("\n").map((r) => r.trim()).filter(Boolean),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to post");
      toast({ title: "Job posted!", description: `"${data.job.title}" is now live.` });
      setForm(EMPTY_FORM);
      onCreated();
      onClose();
    } catch (err: any) {
      toast({ variant: "destructive", title: err.message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Star className="w-5 h-5 text-purple-600" />
            Post a Resuone Exclusive Job
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Job title *</Label>
              <Input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Senior Engineer" className="mt-1" />
            </div>
            <div>
              <Label>Company *</Label>
              <Input value={form.company} onChange={(e) => set("company", e.target.value)} placeholder="Company name" className="mt-1" />
            </div>
            <div>
              <Label>Location</Label>
              <Input value={form.location} onChange={(e) => set("location", e.target.value)} placeholder="e.g. London" className="mt-1" />
            </div>
            <div>
              <Label>Country</Label>
              <Input value={form.country} onChange={(e) => set("country", e.target.value)} placeholder="e.g. UK" className="mt-1" />
            </div>
            <div>
              <Label>Job type</Label>
              <Select value={form.jobType} onValueChange={(v) => set("jobType", v)}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="full_time">Full-time</SelectItem>
                  <SelectItem value="part_time">Part-time</SelectItem>
                  <SelectItem value="contract">Contract</SelectItem>
                  <SelectItem value="freelance">Freelance</SelectItem>
                  <SelectItem value="internship">Internship</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Seniority</Label>
              <Select value={form.seniority} onValueChange={(v) => set("seniority", v)}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select level" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="junior">Junior</SelectItem>
                  <SelectItem value="mid">Mid-level</SelectItem>
                  <SelectItem value="senior">Senior</SelectItem>
                  <SelectItem value="lead">Lead</SelectItem>
                  <SelectItem value="director">Director</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Salary min</Label>
              <Input type="number" value={form.salaryMin} onChange={(e) => set("salaryMin", e.target.value)} placeholder="e.g. 50000" className="mt-1" />
            </div>
            <div>
              <Label>Salary max</Label>
              <Input type="number" value={form.salaryMax} onChange={(e) => set("salaryMax", e.target.value)} placeholder="e.g. 80000" className="mt-1" />
            </div>
            <div>
              <Label>Currency</Label>
              <Select value={form.currency} onValueChange={(v) => set("currency", v)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="GBP">GBP</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                  <SelectItem value="CAD">CAD</SelectItem>
                  <SelectItem value="AUD">AUD</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Visibility</Label>
              <Select value={form.visibility} onValueChange={(v: "pro_only" | "public") => set("visibility", v)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pro_only">Pro+ users only</SelectItem>
                  <SelectItem value="public">Public (anyone)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="remote"
              checked={form.remote}
              onChange={(e) => set("remote", e.target.checked)}
              className="rounded"
            />
            <Label htmlFor="remote" className="cursor-pointer">Remote / Remote-friendly</Label>
          </div>

          <div>
            <Label>Description * <span className="text-muted-foreground font-normal">(role overview, responsibilities)</span></Label>
            <Textarea
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              rows={6}
              placeholder="Describe the role, responsibilities, and what makes it great..."
              className="mt-1"
            />
          </div>

          <div>
            <Label>Requirements <span className="text-muted-foreground font-normal">(one per line)</span></Label>
            <Textarea
              value={form.requirements}
              onChange={(e) => set("requirements", e.target.value)}
              rows={4}
              placeholder={"5+ years React experience\nTypeScript proficiency\nStrong communication skills"}
              className="mt-1"
            />
          </div>

          <div>
            <Label>Publish as</Label>
            <Select value={form.status} onValueChange={(v: "draft" | "active") => set("status", v)}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Publish now</SelectItem>
                <SelectItem value="draft">Save as draft</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving} className="bg-purple-600 hover:bg-purple-700 text-white">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Star className="w-4 h-4 mr-2" />}
              {form.status === "draft" ? "Save Draft" : "Post Job"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Applicants Sheet ─────────────────────────────────────────────────────────

function ApplicantsSheet({ jobId, onClose }: { jobId: string; onClose: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["internal-applicants", jobId],
    queryFn: () => fetchApplicants(jobId),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ appId, status, notes }: { appId: string; status: string; notes?: string }) => {
      const res = await authedFetch(`${BASE}/internal-jobs/${jobId}/applications/${appId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, notes }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Failed");
      return d;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["internal-applicants", jobId] });
      qc.invalidateQueries({ queryKey: ["internal-posted-jobs"] });
    },
    onError: (err: any) => toast({ variant: "destructive", title: err.message }),
  });

  const apps = data?.applications ?? [];

  return (
    <Sheet open onOpenChange={() => onClose()}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-purple-600" />
            Applicants {data?.jobTitle ? `— ${data.jobTitle}` : ""}
          </SheetTitle>
        </SheetHeader>

        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {!isLoading && apps.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No applicants yet</p>
          </div>
        )}

        <div className="space-y-3">
          {apps.map((app) => (
            <Card key={app.id} className="border">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{app.applicantName ?? "Anonymous"}</p>
                    {app.applicantEmail && (
                      <p className="text-xs text-muted-foreground">{app.applicantEmail}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Applied {new Date(app.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  </div>
                  <AppStatusBadge status={app.status} />
                </div>

                {app.coverLetter && (
                  <button
                    onClick={() => setExpanded(expanded === app.id ? null : app.id)}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mt-2 transition-colors"
                  >
                    {expanded === app.id ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    {expanded === app.id ? "Hide cover letter" : "View cover letter"}
                  </button>
                )}

                {expanded === app.id && app.coverLetter && (
                  <p className="mt-2 text-xs text-foreground/80 leading-relaxed bg-muted/50 rounded-md p-3 whitespace-pre-wrap">
                    {app.coverLetter}
                  </p>
                )}

                {app.notes && (
                  <p className="mt-2 text-xs text-muted-foreground italic border-l-2 border-muted pl-2">{app.notes}</p>
                )}

                <div className="flex gap-1.5 mt-3 flex-wrap">
                  {app.status !== "shortlisted" && (
                    <Button size="sm" variant="outline" className="text-xs h-7 text-purple-700 border-purple-200 hover:bg-purple-50"
                      onClick={() => updateMutation.mutate({ appId: app.id, status: "shortlisted" })}
                      disabled={updateMutation.isPending}
                    >
                      <Check className="w-3 h-3 mr-1" /> Shortlist
                    </Button>
                  )}
                  {app.status !== "hired" && (
                    <Button size="sm" variant="outline" className="text-xs h-7 text-green-700 border-green-200 hover:bg-green-50"
                      onClick={() => updateMutation.mutate({ appId: app.id, status: "hired" })}
                      disabled={updateMutation.isPending}
                    >
                      <Check className="w-3 h-3 mr-1" /> Hire
                    </Button>
                  )}
                  {app.status !== "rejected" && (
                    <Button size="sm" variant="outline" className="text-xs h-7 text-red-700 border-red-200 hover:bg-red-50"
                      onClick={() => updateMutation.mutate({ appId: app.id, status: "rejected" })}
                      disabled={updateMutation.isPending}
                    >
                      <X className="w-3 h-3 mr-1" /> Reject
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function RecruiterExclusiveJobs() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [postOpen, setPostOpen] = useState(false);
  const [viewApplicants, setViewApplicants] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["internal-posted-jobs"],
    queryFn: fetchPostedJobs,
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await authedFetch(`${BASE}/internal-jobs/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Failed");
      return d;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["internal-posted-jobs"] });
      toast({ title: `Job ${vars.status}` });
    },
    onError: (err: any) => toast({ variant: "destructive", title: err.message }),
  });

  const jobs = data ?? [];

  return (
    <AppLayout>
      {viewApplicants && (
        <ApplicantsSheet jobId={viewApplicants} onClose={() => setViewApplicants(null)} />
      )}
      <PostJobDialog
        open={postOpen}
        onClose={() => setPostOpen(false)}
        onCreated={() => qc.invalidateQueries({ queryKey: ["internal-posted-jobs"] })}
      />

      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Star className="w-6 h-6 text-purple-600" />
              Resuone Exclusive Jobs
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Post jobs directly on Resuone — visible exclusively to Pro subscribers.
            </p>
          </div>
          <Button onClick={() => setPostOpen(true)} className="bg-purple-600 hover:bg-purple-700 text-white">
            <Plus className="w-4 h-4 mr-2" />
            Post a Job
          </Button>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {!isLoading && jobs.length === 0 && (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <Star className="w-12 h-12 text-purple-200 mb-4" />
              <h3 className="font-semibold text-lg mb-1">No jobs posted yet</h3>
              <p className="text-sm text-muted-foreground mb-6 max-w-xs">
                Post exclusive jobs that appear only on Resuone — directly to your ideal candidates.
              </p>
              <Button onClick={() => setPostOpen(true)} className="bg-purple-600 hover:bg-purple-700 text-white">
                <Plus className="w-4 h-4 mr-2" />
                Post your first job
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="space-y-4">
          {jobs.map((job) => {
            const salary =
              job.salaryMin && job.salaryMax
                ? `${Number(job.salaryMin).toLocaleString()}–${Number(job.salaryMax).toLocaleString()} ${job.currency ?? ""}`
                : job.salaryMin
                ? `From ${Number(job.salaryMin).toLocaleString()} ${job.currency ?? ""}`
                : null;

            return (
              <Card key={job.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h3 className="font-semibold text-base">{job.title}</h3>
                        <StatusBadge status={job.status} />
                        <Badge variant="outline" className={cn("text-xs", job.visibility === "pro_only" ? "text-purple-700 border-purple-200 bg-purple-50" : "text-gray-600")}>
                          {job.visibility === "pro_only" ? "Pro+ only" : "Public"}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
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
                        {job.remote && (
                          <Badge variant="outline" className="text-xs text-blue-600 border-blue-300">Remote</Badge>
                        )}
                        {salary && <span className="text-xs font-medium">{salary}</span>}
                        {job.jobType && <span className="text-xs capitalize">{job.jobType.replace("_", " ")}</span>}
                        {job.seniority && <span className="text-xs capitalize">{job.seniority}</span>}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Posted {new Date(job.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => setViewApplicants(job.id)}
                        className="flex items-center gap-1.5 text-sm font-medium text-purple-700 hover:text-purple-900 transition-colors"
                      >
                        <Users className="w-4 h-4" />
                        {job.applicationCount} {job.applicationCount === 1 ? "applicant" : "applicants"}
                      </button>
                    </div>
                  </div>

                  <div className="flex gap-2 mt-4 pt-3 border-t border-border">
                    <Button
                      size="sm" variant="outline" className="text-xs h-7"
                      onClick={() => setViewApplicants(job.id)}
                    >
                      <Eye className="w-3 h-3 mr-1" /> View Applicants
                    </Button>
                    {job.status === "active" && (
                      <Button
                        size="sm" variant="outline" className="text-xs h-7 text-yellow-700 border-yellow-200 hover:bg-yellow-50"
                        onClick={() => updateStatus.mutate({ id: job.id, status: "paused" })}
                        disabled={updateStatus.isPending}
                      >
                        <Pause className="w-3 h-3 mr-1" /> Pause
                      </Button>
                    )}
                    {job.status === "paused" && (
                      <Button
                        size="sm" variant="outline" className="text-xs h-7 text-green-700 border-green-200 hover:bg-green-50"
                        onClick={() => updateStatus.mutate({ id: job.id, status: "active" })}
                        disabled={updateStatus.isPending}
                      >
                        <Check className="w-3 h-3 mr-1" /> Reactivate
                      </Button>
                    )}
                    {job.status !== "closed" && (
                      <Button
                        size="sm" variant="outline" className="text-xs h-7 text-red-700 border-red-200 hover:bg-red-50"
                        onClick={() => updateStatus.mutate({ id: job.id, status: "closed" })}
                        disabled={updateStatus.isPending}
                      >
                        <X className="w-3 h-3 mr-1" /> Close
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
}
