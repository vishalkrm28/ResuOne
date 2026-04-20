import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useParams, useLocation } from "wouter";
import { getRecruiterJob, uploadCandidateFiles, analyzeCandidates, rankCandidates } from "@/lib/recruiter-api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Loader2, Upload, ArrowLeft, Play, Trophy,
  CheckCircle2, FileText, Building2, MapPin
} from "lucide-react";
import { cn } from "@/lib/utils";

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, string> = {
    new: "bg-slate-100 text-slate-700",
    shortlisted: "bg-blue-100 text-blue-700",
    interview: "bg-green-100 text-green-700",
    rejected: "bg-red-100 text-red-700",
    hired: "bg-emerald-100 text-emerald-700",
  };
  return <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize", cfg[status] ?? cfg.new)}>{status}</span>;
}

export default function RecruiterJobDetail() {
  const { jobId } = useParams<{ jobId: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [dragging, setDragging] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState<File[]>([]);
  const [analysisStep, setAnalysisStep] = useState<"idle" | "analyzing" | "ranking" | "done">("idle");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["recruiter-job", jobId],
    queryFn: () => getRecruiterJob(jobId!),
    enabled: !!jobId,
  });

  const job = data?.job;
  const candidates: any[] = data?.candidates ?? [];
  const reqs = job?.normalizedRequirements ?? {};

  const uploadMutation = useMutation({
    mutationFn: (files: File[]) => uploadCandidateFiles(jobId!, files),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["recruiter-job", jobId] });
      setUploadingFiles([]);
      toast({
        title: `${res.processed} candidate${res.processed !== 1 ? "s" : ""} uploaded`,
        description: res.results.filter((r: any) => r.status === "error").length > 0
          ? `${res.results.filter((r: any) => r.status === "error").length} file(s) failed.` : undefined,
      });
    },
    onError: (err: any) => toast({ title: "Upload failed", description: err.message, variant: "destructive" }),
  });

  const runAnalysis = useCallback(async () => {
    try {
      setAnalysisStep("analyzing");
      await analyzeCandidates(jobId!);
      setAnalysisStep("ranking");
      await rankCandidates(jobId!);
      setAnalysisStep("done");
      qc.invalidateQueries({ queryKey: ["recruiter-job", jobId] });
      toast({ title: "Analysis complete!", description: "Candidates have been scored and ranked." });
      setTimeout(() => navigate(`/recruiter/jobs/${jobId}/ranking`), 1200);
    } catch (err: any) {
      setAnalysisStep("idle");
      toast({ title: "Analysis failed", description: err.message, variant: "destructive" });
    }
  }, [jobId, qc, navigate, toast]);

  const handleFiles = (files: FileList | File[]) => {
    const arr = Array.from(files).filter(f => /\.(pdf|docx|doc|txt)$/i.test(f.name));
    if (arr.length === 0) { toast({ title: "No valid files", description: "Upload PDF, DOCX, DOC, or TXT files.", variant: "destructive" }); return; }
    setUploadingFiles(arr);
    uploadMutation.mutate(arr);
  };

  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
  );

  if (!job) return (
    <div className="min-h-screen flex items-center justify-center text-muted-foreground">Job not found.</div>
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">

        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild className="text-muted-foreground">
            <Link href="/recruiter/jobs"><ArrowLeft className="w-4 h-4 mr-1" /> Jobs</Link>
          </Button>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">{job.title}</h1>
            <div className="flex flex-wrap items-center gap-3 mt-1.5 text-sm text-muted-foreground">
              {job.company && <span className="flex items-center gap-1"><Building2 className="w-3.5 h-3.5" />{job.company}</span>}
              {job.location && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{job.location}</span>}
              <span>{candidates.length} candidate{candidates.length !== 1 ? "s" : ""} uploaded</span>
            </div>
          </div>
          {candidates.length > 0 && (
            <Button asChild variant="outline">
              <Link href={`/recruiter/jobs/${jobId}/ranking`}><Trophy className="w-4 h-4 mr-2" /> View Ranking</Link>
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Left: upload + analysis */}
          <div className="lg:col-span-2 space-y-5">

            {/* Drop zone */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2"><Upload className="w-4 h-4" /> Upload Candidate CVs</CardTitle>
              </CardHeader>
              <CardContent>
                <div
                  className={cn(
                    "border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors",
                    dragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/60 hover:bg-muted/40"
                  )}
                  onDragOver={e => { e.preventDefault(); setDragging(true); }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={e => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input ref={fileInputRef} type="file" multiple accept=".pdf,.docx,.doc,.txt" className="hidden" onChange={e => e.target.files && handleFiles(e.target.files)} />
                  {uploadMutation.isPending ? (
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 className="w-8 h-8 animate-spin text-primary" />
                      <p className="text-sm font-medium">Extracting & parsing {uploadingFiles.length} CV{uploadingFiles.length !== 1 ? "s" : ""}…</p>
                      <p className="text-xs text-muted-foreground">This may take a minute for large batches.</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-3">
                      <FileText className="w-10 h-10 text-muted-foreground opacity-40" />
                      <div>
                        <p className="font-semibold">Drop CVs here or click to browse</p>
                        <p className="text-sm text-muted-foreground mt-1">PDF, DOCX, DOC, TXT — up to 100 files at once</p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Analyze + rank */}
            {candidates.length > 0 && (
              <Card>
                <CardContent className="p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <p className="font-semibold">Score & Rank All Candidates</p>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Run AI scoring on all {candidates.length} candidate{candidates.length !== 1 ? "s" : ""}, then assign rank positions.
                    </p>
                  </div>
                  <Button
                    onClick={runAnalysis}
                    disabled={analysisStep !== "idle"}
                    className="shrink-0"
                  >
                    {analysisStep === "idle" && <><Play className="w-4 h-4 mr-2" /> Run Analysis</>}
                    {analysisStep === "analyzing" && <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Scoring…</>}
                    {analysisStep === "ranking" && <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Ranking…</>}
                    {analysisStep === "done" && <><CheckCircle2 className="w-4 h-4 mr-2" /> Done!</>}
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Candidates table */}
            {candidates.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2"><Users className="w-4 h-4" /> Uploaded Candidates ({candidates.length})</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y">
                    {candidates.map((c: any) => (
                      <div key={c.id} className="px-5 py-3 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium truncate">{c.fullName ?? c.fileName ?? "Unknown"}</p>
                          <p className="text-xs text-muted-foreground truncate">{c.currentTitle ?? c.email ?? "—"}</p>
                        </div>
                        <StatusBadge status={c.status} />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right: normalized requirements */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-muted-foreground uppercase tracking-widest font-bold">AI Requirements</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                {reqs.seniority_level && (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">Seniority</p>
                    <Badge variant="secondary" className="capitalize">{reqs.seniority_level}</Badge>
                  </div>
                )}
                {reqs.years_experience_required > 0 && (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">Experience</p>
                    <p className="font-medium">{reqs.years_experience_required}+ years</p>
                  </div>
                )}
                {(reqs.must_have_skills as string[])?.length > 0 && (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Must Have</p>
                    <div className="flex flex-wrap gap-1.5">
                      {(reqs.must_have_skills as string[]).map((s: string) => (
                        <span key={s} className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full px-2 py-0.5">{s}</span>
                      ))}
                    </div>
                  </div>
                )}
                {(reqs.nice_to_have_skills as string[])?.length > 0 && (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Nice to Have</p>
                    <div className="flex flex-wrap gap-1.5">
                      {(reqs.nice_to_have_skills as string[]).map((s: string) => (
                        <span key={s} className="text-xs bg-slate-50 text-slate-600 border border-slate-200 rounded-full px-2 py-0.5">{s}</span>
                      ))}
                    </div>
                  </div>
                )}
                {(reqs.required_tools as string[])?.length > 0 && (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Required Tools</p>
                    <div className="flex flex-wrap gap-1.5">
                      {(reqs.required_tools as string[]).map((s: string) => (
                        <span key={s} className="text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-2 py-0.5">{s}</span>
                      ))}
                    </div>
                  </div>
                )}
                {!reqs.seniority_level && !(reqs.must_have_skills as string[])?.length && (
                  <p className="text-muted-foreground text-xs italic">Requirements will appear here after job creation.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
