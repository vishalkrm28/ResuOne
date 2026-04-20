import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "wouter";
import { getJobRanking, updateJobCandidateStatus } from "@/lib/recruiter-api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Loader2, ArrowLeft, Trophy, Search, Filter, CheckCircle2,
  XCircle, Minus, Building2, MapPin, Users, AlertCircle, TrendingUp
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Verdict badge ────────────────────────────────────────────────────────────

const VERDICT: Record<string, { label: string; cls: string }> = {
  strong_yes: { label: "Strong Yes", cls: "bg-emerald-100 text-emerald-800 border-emerald-300" },
  yes:        { label: "Yes",         cls: "bg-blue-100 text-blue-800 border-blue-300" },
  maybe:      { label: "Maybe",       cls: "bg-amber-100 text-amber-800 border-amber-300" },
  no:         { label: "No",          cls: "bg-red-100 text-red-800 border-red-300" },
};

function VerdictBadge({ value }: { value: string | null }) {
  const cfg = value ? VERDICT[value] ?? VERDICT.maybe : null;
  if (!cfg) return <span className="text-muted-foreground text-xs">—</span>;
  return <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border", cfg.cls)}>{cfg.label}</span>;
}

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

function ScoreBar({ score }: { score: number }) {
  const color = score >= 70 ? "bg-emerald-500" : score >= 50 ? "bg-amber-500" : "bg-red-400";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${score}%` }} />
      </div>
      <span className="text-sm font-bold tabular-nums w-8 text-right">{score}</span>
    </div>
  );
}

// ─── Compare panel ────────────────────────────────────────────────────────────

function ComparePanel({ rows, onClose }: { rows: any[]; onClose: () => void }) {
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Users className="w-5 h-5" /> Candidate Comparison</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 mt-2" style={{ gridTemplateColumns: `repeat(${rows.length}, 1fr)` }}>
          {rows.map((row: any) => {
            const c = row.candidate;
            return (
              <div key={row.id} className="border rounded-xl p-4 space-y-4">
                <div>
                  <p className="font-bold text-base">{c?.fullName ?? "Unknown"}</p>
                  <p className="text-sm text-muted-foreground">{c?.currentTitle ?? "—"}</p>
                </div>

                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">Score</p>
                  <ScoreBar score={row.overallScore} />
                </div>

                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">Verdict</p>
                  <VerdictBadge value={row.interviewRecommendation} />
                </div>

                {(row.matchingSkills as string[])?.length > 0 && (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1.5">Matching Skills</p>
                    <div className="flex flex-wrap gap-1">
                      {(row.matchingSkills as string[]).slice(0, 6).map((s: string) => (
                        <span key={s} className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full px-2 py-0.5">{s}</span>
                      ))}
                    </div>
                  </div>
                )}

                {(row.missingSkills as string[])?.length > 0 && (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1.5">Missing Skills</p>
                    <div className="flex flex-wrap gap-1">
                      {(row.missingSkills as string[]).slice(0, 6).map((s: string) => (
                        <span key={s} className="text-xs bg-red-50 text-red-700 border border-red-200 rounded-full px-2 py-0.5">{s}</span>
                      ))}
                    </div>
                  </div>
                )}

                {(row.strengths as string[])?.length > 0 && (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1.5">Strengths</p>
                    <ul className="space-y-1">
                      {(row.strengths as string[]).slice(0, 3).map((s: string) => (
                        <li key={s} className="text-xs flex items-start gap-1.5"><CheckCircle2 className="w-3 h-3 text-emerald-600 mt-0.5 shrink-0" />{s}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {(row.concerns as string[])?.length > 0 && (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1.5">Concerns</p>
                    <ul className="space-y-1">
                      {(row.concerns as string[]).slice(0, 3).map((s: string) => (
                        <li key={s} className="text-xs flex items-start gap-1.5"><XCircle className="w-3 h-3 text-amber-600 mt-0.5 shrink-0" />{s}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {row.recruiterSummary && (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">Summary</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{row.recruiterSummary}</p>
                  </div>
                )}

                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">Status</p>
                  <StatusBadge status={c?.status ?? "new"} />
                </div>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function RecruiterJobRanking() {
  const { jobId } = useParams<{ jobId: string }>();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [filters, setFilters] = useState({ minScore: "", recommendation: "", status: "", missingSkill: "" });
  const [compareIds, setCompareIds] = useState<Set<string>>(new Set());
  const [compareOpen, setCompareOpen] = useState(false);

  const apiFilters = useMemo(() => ({
    minScore: filters.minScore ? Number(filters.minScore) : undefined,
    recommendation: filters.recommendation || undefined,
    status: filters.status || undefined,
    missingSkill: filters.missingSkill || undefined,
  }), [filters]);

  const { data, isLoading } = useQuery({
    queryKey: ["job-ranking", jobId, apiFilters],
    queryFn: () => getJobRanking(jobId!, apiFilters),
    enabled: !!jobId,
  });

  const job = data?.job;
  const ranking: any[] = data?.ranking ?? [];

  const statusMutation = useMutation({
    mutationFn: ({ cid, status }: { cid: string; status: string }) => updateJobCandidateStatus(jobId!, cid, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["job-ranking", jobId] }),
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const compareRows = ranking.filter(r => compareIds.has(r.id));

  const toggleCompare = (id: string) => {
    setCompareIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < 4) next.add(id);
      else { toast({ title: "Max 4 candidates for comparison" }); return prev; }
      return next;
    });
  };

  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">

        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild className="text-muted-foreground">
            <Link href={`/recruiter/jobs/${jobId}`}><ArrowLeft className="w-4 h-4 mr-1" /> Job Detail</Link>
          </Button>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-2">
              <Trophy className="w-6 h-6 text-primary" /> Candidate Ranking
            </h1>
            {job && (
              <p className="text-muted-foreground mt-1">
                {job.title}{job.company ? ` · ${job.company}` : ""} — {data?.total ?? 0} result{data?.total !== 1 ? "s" : ""}
              </p>
            )}
          </div>
          {compareIds.size >= 2 && (
            <Button onClick={() => setCompareOpen(true)}>
              <Users className="w-4 h-4 mr-2" /> Compare ({compareIds.size})
            </Button>
          )}
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-3 items-end">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Filter className="w-4 h-4" /> Filters:
              </div>
              <div className="flex-1 min-w-[120px] max-w-[160px]">
                <Input
                  type="number" placeholder="Min score" min={0} max={100}
                  value={filters.minScore}
                  onChange={e => setFilters(p => ({ ...p, minScore: e.target.value }))}
                  className="h-8 text-sm"
                />
              </div>
              <Select value={filters.recommendation || "all"} onValueChange={v => setFilters(p => ({ ...p, recommendation: v === "all" ? "" : v }))}>
                <SelectTrigger className="w-[140px] h-8 text-sm"><SelectValue placeholder="Verdict" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All verdicts</SelectItem>
                  <SelectItem value="strong_yes">Strong Yes</SelectItem>
                  <SelectItem value="yes">Yes</SelectItem>
                  <SelectItem value="maybe">Maybe</SelectItem>
                  <SelectItem value="no">No</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filters.status || "all"} onValueChange={v => setFilters(p => ({ ...p, status: v === "all" ? "" : v }))}>
                <SelectTrigger className="w-[130px] h-8 text-sm"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="shortlisted">Shortlisted</SelectItem>
                  <SelectItem value="interview">Interview</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="hired">Hired</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex items-center gap-1.5 flex-1 min-w-[160px] max-w-[240px]">
                <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <Input
                  placeholder="Missing skill…"
                  value={filters.missingSkill}
                  onChange={e => setFilters(p => ({ ...p, missingSkill: e.target.value }))}
                  className="h-8 text-sm"
                />
              </div>
              {(filters.minScore || filters.recommendation || filters.status || filters.missingSkill) && (
                <Button variant="ghost" size="sm" className="h-8" onClick={() => setFilters({ minScore: "", recommendation: "", status: "", missingSkill: "" })}>
                  Clear
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Ranking table */}
        {ranking.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <Trophy className="w-12 h-12 text-muted-foreground opacity-20 mx-auto mb-3" />
              <p className="font-semibold">No ranked results yet</p>
              <p className="text-sm text-muted-foreground mt-1">Upload CVs and run analysis from the job detail page.</p>
              <Button asChild className="mt-4" variant="outline">
                <Link href={`/recruiter/jobs/${jobId}`}>Go to Job Detail</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40">
                      <th className="text-left px-4 py-3 font-semibold text-muted-foreground w-10">#</th>
                      <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Candidate</th>
                      <th className="text-left px-4 py-3 font-semibold text-muted-foreground w-36">Score</th>
                      <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Verdict</th>
                      <th className="text-left px-4 py-3 font-semibold text-muted-foreground w-16 text-center">Missing</th>
                      <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Status</th>
                      <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ranking.map((row: any, i) => {
                      const c = row.candidate;
                      const isCompared = compareIds.has(row.id);
                      return (
                        <tr key={row.id} className={cn("border-b last:border-0 hover:bg-muted/30 transition-colors", isCompared && "bg-primary/5")}>
                          <td className="px-4 py-3 text-center">
                            {row.rankPosition && row.rankPosition <= 3 ? (
                              <span className={cn("inline-flex w-6 h-6 items-center justify-center rounded-full text-xs font-bold",
                                row.rankPosition === 1 ? "bg-yellow-100 text-yellow-800" :
                                row.rankPosition === 2 ? "bg-slate-100 text-slate-700" :
                                "bg-orange-100 text-orange-800"
                              )}>{row.rankPosition}</span>
                            ) : (
                              <span className="text-muted-foreground tabular-nums">{row.rankPosition ?? i + 1}</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-medium">{c?.fullName ?? "Unknown"}</p>
                            <p className="text-xs text-muted-foreground">{c?.currentTitle ?? c?.email ?? c?.fileName ?? "—"}</p>
                          </td>
                          <td className="px-4 py-3">
                            <ScoreBar score={row.overallScore} />
                          </td>
                          <td className="px-4 py-3">
                            <VerdictBadge value={row.interviewRecommendation} />
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={cn("font-medium", (row.missingSkills as string[])?.length > 3 ? "text-red-600" : "text-muted-foreground")}>
                              {(row.missingSkills as string[])?.length ?? 0}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <Select
                              value={c?.status ?? "new"}
                              onValueChange={v => c && statusMutation.mutate({ cid: c.id, status: v })}
                            >
                              <SelectTrigger className="w-[110px] h-7 text-xs border-0 bg-transparent p-0 shadow-none focus:ring-0">
                                <StatusBadge status={c?.status ?? "new"} />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="new">New</SelectItem>
                                <SelectItem value="shortlisted">Shortlisted</SelectItem>
                                <SelectItem value="interview">Interview</SelectItem>
                                <SelectItem value="rejected">Rejected</SelectItem>
                                <SelectItem value="hired">Hired</SelectItem>
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Button
                              variant={isCompared ? "default" : "outline"}
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => toggleCompare(row.id)}
                            >
                              {isCompared ? "✓ Compare" : "Compare"}
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {compareOpen && compareRows.length >= 2 && (
        <ComparePanel rows={compareRows} onClose={() => setCompareOpen(false)} />
      )}
    </div>
  );
}
