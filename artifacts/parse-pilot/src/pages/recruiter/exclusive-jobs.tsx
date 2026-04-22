import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { authedFetch } from "@/lib/authed-fetch";
import { useToast } from "@/hooks/use-toast";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Loader2, Plus, Briefcase, MapPin, Building2, Users, Pause, X, Check,
  Star, Globe, Lock, PencilLine, Send, Eye, ChevronRight, Pencil,
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
  employmentType: string | null;
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
  publishedAt: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

// ─── Post Job Form ────────────────────────────────────────────────────────────

const EMPTY_FORM = {
  title: "", company: "", location: "", country: "", remote: false,
  employmentType: "", seniority: "", description: "", requirements: "", preferredSkills: "",
  salaryMin: "", salaryMax: "", currency: "USD", visibility: "pro_only" as "pro_only" | "public",
  publishAs: "active" as "draft" | "active",
};

function jobToForm(job: InternalJob): typeof EMPTY_FORM {
  return {
    title: job.title,
    company: job.company,
    location: job.location ?? "",
    country: job.country ?? "",
    remote: job.remote ?? false,
    employmentType: job.employmentType ?? "",
    seniority: job.seniority ?? "",
    description: job.description,
    requirements: Array.isArray((job as any).requirements) ? (job as any).requirements.join("\n") : "",
    preferredSkills: Array.isArray((job as any).preferredSkills) ? (job as any).preferredSkills.join("\n") : "",
    salaryMin: job.salaryMin ?? "",
    salaryMax: job.salaryMax ?? "",
    currency: job.currency ?? "USD",
    visibility: (job.visibility === "public" ? "public" : "pro_only") as "pro_only" | "public",
    publishAs: "active",
  };
}

function PostJobDialog({
  open, onClose, onCreated, editJob,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  editJob?: InternalJob;
}) {
  const { toast } = useToast();
  const isEdit = !!editJob;
  const [form, setForm] = useState(() => editJob ? jobToForm(editJob) : EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setForm(editJob ? jobToForm(editJob) : EMPTY_FORM);
  }, [open, editJob?.id]);

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
      const payload = {
        title: form.title,
        company: form.company,
        location: form.location || undefined,
        country: form.country || undefined,
        remote: form.remote,
        employmentType: form.employmentType || undefined,
        seniority: form.seniority || undefined,
        description: form.description,
        requirements: form.requirements.split("\n").map((r) => r.trim()).filter(Boolean),
        preferredSkills: form.preferredSkills.split("\n").map((r) => r.trim()).filter(Boolean),
        salaryMin: form.salaryMin ? Number(form.salaryMin) : undefined,
        salaryMax: form.salaryMax ? Number(form.salaryMax) : undefined,
        currency: form.currency,
        visibility: form.visibility,
      };

      if (isEdit) {
        const res = await authedFetch(`${BASE}/internal-jobs/${editJob!.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const d = await res.json();
        if (!res.ok) throw new Error(d.error ?? "Failed to update");
        toast({ title: "Job updated!", description: `"${form.title}" has been saved.` });
      } else {
        // Create as draft first
        const createRes = await authedFetch(`${BASE}/internal-jobs`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const createData = await createRes.json();
        if (!createRes.ok) throw new Error(createData.error ?? "Failed to create");

        const jobId = createData.job.id;

        // If user chose to publish immediately, call publish endpoint
        if (form.publishAs === "active") {
          const publishRes = await authedFetch(`${BASE}/internal-jobs/${jobId}/publish`, {
            method: "POST",
          });
          if (!publishRes.ok) {
            toast({ title: "Saved as draft", description: "Job created but could not be published immediately." });
          } else {
            toast({ title: "Job published!", description: `"${form.title}" is now live.` });
          }
        } else {
          toast({ title: "Draft saved", description: `"${form.title}" saved as draft.` });
        }
      }

      if (!isEdit) setForm(EMPTY_FORM);
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
            {isEdit ? <Pencil className="w-5 h-5 text-purple-600" /> : <Star className="w-5 h-5 text-purple-600" />}
            {isEdit ? `Edit: ${editJob!.title}` : "Post a Resuone Exclusive Job"}
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
              <Label>Employment type</Label>
              <Select value={form.employmentType} onValueChange={(v) => set("employmentType", v)}>
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
            <Label>Preferred skills <span className="text-muted-foreground font-normal">(one per line, nice to have)</span></Label>
            <Textarea
              value={form.preferredSkills}
              onChange={(e) => set("preferredSkills", e.target.value)}
              rows={3}
              placeholder={"GraphQL\nDocker\nKubernetes"}
              className="mt-1"
            />
          </div>

          {!isEdit && (
            <div>
              <Label className="mb-2 block">Publish as</Label>
              <div className="grid grid-cols-2 gap-2">
                {(["active", "draft"] as const).map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => set("publishAs", val)}
                    className={cn(
                      "flex flex-col items-start gap-0.5 rounded-lg border px-4 py-3 text-left text-sm transition-colors",
                      form.publishAs === val
                        ? "border-purple-500 bg-purple-50 text-purple-900"
                        : "border-border bg-background text-foreground hover:border-border/80 hover:bg-muted/40",
                    )}
                  >
                    <span className="font-medium">
                      {val === "active" ? "Publish now" : "Save as draft"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {val === "active" ? "Makes the listing live immediately" : "You can publish it later"}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving} className="bg-purple-600 hover:bg-purple-700 text-white">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : isEdit ? <Pencil className="w-4 h-4 mr-2" /> : <Star className="w-4 h-4 mr-2" />}
              {isEdit ? "Save Changes" : form.publishAs === "draft" ? "Save Draft" : "Publish Job"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

type StatusFilter = "all" | "draft" | "active" | "paused" | "closed";

export default function RecruiterExclusiveJobs() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [, navigate] = useLocation();
  const [postOpen, setPostOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<InternalJob | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const { data, isLoading } = useQuery<{ jobs: InternalJob[] }>({
    queryKey: ["internal-posted-jobs", statusFilter],
    queryFn: async () => {
      const params = statusFilter !== "all" ? `?status=${statusFilter}` : "";
      const res = await authedFetch(`${BASE}/internal-jobs/posted${params}`);
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Failed");
      return d;
    },
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

  const publishJob = useMutation({
    mutationFn: async (id: string) => {
      const res = await authedFetch(`${BASE}/internal-jobs/${id}/publish`, { method: "POST" });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Failed");
      return d;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["internal-posted-jobs"] });
      toast({ title: "Job published!" });
    },
    onError: (err: any) => toast({ variant: "destructive", title: err.message }),
  });

  const jobs = data?.jobs ?? [];

  const STATUS_TABS: { value: StatusFilter; label: string }[] = [
    { value: "all", label: "All" },
    { value: "draft", label: "Drafts" },
    { value: "active", label: "Active" },
    { value: "paused", label: "Paused" },
    { value: "closed", label: "Closed" },
  ];

  return (
    <AppLayout>
      <PostJobDialog
        open={postOpen}
        onClose={() => setPostOpen(false)}
        onCreated={() => qc.invalidateQueries({ queryKey: ["internal-posted-jobs"] })}
      />
      <PostJobDialog
        open={!!editingJob}
        editJob={editingJob ?? undefined}
        onClose={() => setEditingJob(null)}
        onCreated={() => qc.invalidateQueries({ queryKey: ["internal-posted-jobs"] })}
      />

      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Star className="w-6 h-6 text-purple-600" />
              My Job Listings
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Post and manage exclusive jobs visible to Resuone Pro subscribers.
            </p>
          </div>
          <Button onClick={() => setPostOpen(true)} className="bg-purple-600 hover:bg-purple-700 text-white">
            <Plus className="w-4 h-4 mr-2" /> Post a Job
          </Button>
        </div>

        {/* Status tabs */}
        <div className="flex gap-1 mb-6 border-b border-border">
          {STATUS_TABS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setStatusFilter(value)}
              className={cn(
                "px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
                statusFilter === value
                  ? "border-purple-600 text-purple-700"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
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
              <h3 className="font-semibold text-lg mb-1">
                {statusFilter === "all" ? "No jobs posted yet" : `No ${statusFilter} jobs`}
              </h3>
              <p className="text-sm text-muted-foreground mb-6 max-w-xs">
                {statusFilter === "all"
                  ? "Post exclusive jobs that appear only on Resuone — directly to your ideal candidates."
                  : `You have no ${statusFilter} job listings.`}
              </p>
              {statusFilter === "all" && (
                <Button onClick={() => setPostOpen(true)} className="bg-purple-600 hover:bg-purple-700 text-white">
                  <Plus className="w-4 h-4 mr-2" /> Post your first job
                </Button>
              )}
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
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h3 className="font-semibold text-base">{job.title}</h3>
                        <StatusBadge status={job.status} />
                        <Badge variant="outline" className={cn(
                          "text-xs",
                          job.visibility === "pro_only" ? "text-purple-700 border-purple-200 bg-purple-50" : "text-gray-600",
                        )}>
                          {job.visibility === "pro_only" ? <><Lock className="w-3 h-3 mr-1 inline" />Pro+ only</> : <><Globe className="w-3 h-3 mr-1 inline" />Public</>}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1"><Building2 className="w-3.5 h-3.5" />{job.company}</span>
                        {job.location && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{job.location}</span>}
                        {job.remote && <span className="flex items-center gap-1"><Globe className="w-3.5 h-3.5" />Remote</span>}
                        {salary && <span className="font-medium text-foreground/80">{salary}</span>}
                      </div>
                    </div>

                    {/* Application count */}
                    <div className="text-right shrink-0">
                      <p className="text-2xl font-bold text-foreground">{job.applicationCount}</p>
                      <p className="text-xs text-muted-foreground">applicant{job.applicationCount !== 1 ? "s" : ""}</p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Draft — publish button */}
                    {job.status === "draft" && (
                      <Button
                        size="sm"
                        className="text-xs h-7 bg-purple-600 hover:bg-purple-700 text-white"
                        onClick={() => publishJob.mutate(job.id)}
                        disabled={publishJob.isPending}
                      >
                        {publishJob.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Send className="w-3 h-3 mr-1" />}
                        Publish
                      </Button>
                    )}

                    {/* Active — pause */}
                    {job.status === "active" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-7 text-yellow-700 border-yellow-200"
                        onClick={() => updateStatus.mutate({ id: job.id, status: "paused" })}
                        disabled={updateStatus.isPending}
                      >
                        <Pause className="w-3 h-3 mr-1" /> Pause
                      </Button>
                    )}

                    {/* Paused — re-activate */}
                    {job.status === "paused" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-7 text-green-700 border-green-200"
                        onClick={() => updateStatus.mutate({ id: job.id, status: "active" })}
                        disabled={updateStatus.isPending}
                      >
                        <Check className="w-3 h-3 mr-1" /> Re-activate
                      </Button>
                    )}

                    {/* Close */}
                    {["active", "paused"].includes(job.status) && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-7 text-red-700 border-red-200"
                        onClick={() => updateStatus.mutate({ id: job.id, status: "closed" })}
                        disabled={updateStatus.isPending}
                      >
                        <X className="w-3 h-3 mr-1" /> Close
                      </Button>
                    )}

                    {/* Edit */}
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs h-7 text-purple-700 border-purple-200"
                      onClick={() => setEditingJob(job)}
                    >
                      <Pencil className="w-3 h-3 mr-1" /> Edit
                    </Button>

                    {/* View applicants */}
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs h-7 ml-auto"
                      onClick={() => navigate(`/recruiter/exclusive-jobs/${job.id}`)}
                    >
                      <Users className="w-3 h-3 mr-1" /> Applicants
                      {job.applicationCount > 0 && (
                        <Badge className="ml-1.5 bg-purple-600 text-white text-xs h-4 min-w-4 flex items-center justify-center rounded-full px-1">
                          {job.applicationCount}
                        </Badge>
                      )}
                      <ChevronRight className="w-3 h-3 ml-1" />
                    </Button>
                  </div>

                  {/* Draft notice */}
                  {job.status === "draft" && (
                    <div className="mt-3 p-2.5 rounded-md bg-blue-50 border border-blue-200">
                      <p className="text-xs text-blue-700">
                        <strong>Draft</strong> — This job is not visible to candidates yet. Click "Publish" to make it live.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
}
