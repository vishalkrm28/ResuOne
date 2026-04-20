import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { listRecruiterJobs, createRecruiterJob, deleteRecruiterJob, getRecruiterAccess } from "@/lib/recruiter-api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Briefcase, Trash2, ArrowRight, Building2, MapPin, Lock } from "lucide-react";

export default function RecruiterJobs() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const qc = useQueryClient();

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ title: "", company: "", location: "", rawDescription: "" });
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const { data: accessData } = useQuery({ queryKey: ["recruiter-access"], queryFn: getRecruiterAccess });
  const hasAccess = accessData?.hasAccess ?? false;

  const { data, isLoading } = useQuery({ queryKey: ["recruiter-jobs"], queryFn: listRecruiterJobs, enabled: hasAccess });
  const jobs: any[] = data?.jobs ?? [];

  const createMutation = useMutation({
    mutationFn: createRecruiterJob,
    onSuccess: (job) => {
      qc.invalidateQueries({ queryKey: ["recruiter-jobs"] });
      setCreateOpen(false);
      setForm({ title: "", company: "", location: "", rawDescription: "" });
      toast({ title: "Job created", description: "Candidates can now be uploaded." });
      navigate(`/recruiter/jobs/${job.id}`);
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteRecruiterJob,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["recruiter-jobs"] }); setDeleteTarget(null); },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  if (!hasAccess && accessData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-8">
        <Card className="max-w-sm w-full text-center">
          <CardContent className="pt-8 pb-8 flex flex-col items-center gap-4">
            <Lock className="w-10 h-10 text-muted-foreground" />
            <CardTitle className="text-lg">Recruiter access required</CardTitle>
            <CardDescription>Upgrade to a Recruiter plan to use the Ranking Dashboard.</CardDescription>
            <Button asChild><Link href="/recruiter/pricing">View Plans</Link></Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">Ranking Dashboard</h1>
            <p className="text-muted-foreground mt-1">Upload CVs, score candidates, rank by fit.</p>
          </div>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="w-4 h-4 mr-2" /> New Job
          </Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
        ) : jobs.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-16 flex flex-col items-center gap-4 text-center">
              <Briefcase className="w-12 h-12 text-muted-foreground opacity-30" />
              <div>
                <p className="font-semibold text-lg">No jobs yet</p>
                <p className="text-muted-foreground text-sm mt-1">Create a job, upload CVs, and rank candidates automatically.</p>
              </div>
              <Button onClick={() => setCreateOpen(true)}><Plus className="w-4 h-4 mr-2" /> Create First Job</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {jobs.map((job: any) => (
              <Card key={job.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-5 flex items-center justify-between">
                  <div className="flex items-start gap-4 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <Briefcase className="w-5 h-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{job.title}</p>
                      <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                        {job.company && <span className="flex items-center gap-1"><Building2 className="w-3 h-3" />{job.company}</span>}
                        {job.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{job.location}</span>}
                        <span>{new Date(job.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-4">
                    <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(job.id)} className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                    <Button asChild size="sm">
                      <Link href={`/recruiter/jobs/${job.id}`}>Open <ArrowRight className="w-4 h-4 ml-1" /></Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Create job dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Job</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Job Title *</Label>
              <Input placeholder="e.g. Senior React Developer" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Company</Label>
                <Input placeholder="Acme Corp" value={form.company} onChange={e => setForm(p => ({ ...p, company: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Location</Label>
                <Input placeholder="Remote / London" value={form.location} onChange={e => setForm(p => ({ ...p, location: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Job Description *</Label>
              <Textarea
                rows={8}
                placeholder="Paste the full job description here…"
                value={form.rawDescription}
                onChange={e => setForm(p => ({ ...p, rawDescription: e.target.value }))}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground">AI will extract requirements automatically.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button
              onClick={() => createMutation.mutate(form)}
              disabled={!form.title || form.rawDescription.length < 50 || createMutation.isPending}
            >
              {createMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Create & Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Delete Job?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">This will permanently delete the job and all uploaded candidates. This cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget)} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null} Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
