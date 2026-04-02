import { useState } from "react";
import { useParams, useLocation, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getCandidate, updateCandidateStatus } from "@/lib/recruiter-api";
import { Loader2, ArrowLeft, Mail, CheckCircle2, XCircle, Star, Clock, BarChart3, Briefcase } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { InviteModal } from "./invite-modal";
import { StatusBadge } from "./status-badge";

export default function CandidateDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [inviteOpen, setInviteOpen] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["candidate", id],
    queryFn: () => getCandidate(id),
  });

  const statusMutation = useMutation({
    mutationFn: (status: string) => updateCandidateStatus(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["candidate", id] });
      qc.invalidateQueries({ queryKey: ["candidates"] });
    },
    onError: () => toast({ title: "Update failed", variant: "destructive" }),
  });

  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="w-6 h-6 animate-spin text-primary" />
    </div>
  );

  if (error || !data?.candidate) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <p className="text-muted-foreground mb-4">Candidate not found.</p>
        <Link href="/recruiter/dashboard" className="text-primary hover:underline text-sm">← Back to Dashboard</Link>
      </div>
    </div>
  );

  const { candidate, invites = [] } = data;
  const skills: string[] = candidate.skills ?? [];
  const parsedCv = candidate.parsedCvJson as any;
  const missingKeywords: string[] = parsedCv?.missing_keywords ?? [];
  const workExp = parsedCv?.work_experience ?? [];

  // Build score breakdown from parsedCv or synthesize
  const scoreBreakdown = candidate.scoringBreakdownJson as any ?? null;

  const actionButtons = [
    {
      label: "Invite to Interview",
      icon: Mail,
      color: "bg-primary text-primary-foreground hover:bg-primary/90",
      onClick: () => setInviteOpen(true),
    },
    {
      label: "Shortlist",
      icon: Star,
      color: "border border-yellow-300 text-yellow-700 hover:bg-yellow-50 dark:text-yellow-400 dark:border-yellow-700 dark:hover:bg-yellow-900/20",
      onClick: () => statusMutation.mutate("invited"),
    },
    {
      label: "Reject",
      icon: XCircle,
      color: "border border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20",
      onClick: () => { if (confirm("Reject this candidate?")) statusMutation.mutate("rejected"); },
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <header className="border-b border-border/40 bg-background/95 backdrop-blur sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center gap-4">
          <button onClick={() => navigate("/recruiter/dashboard")} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" /> Dashboard
          </button>
          <span className="text-border/60">|</span>
          <span className="font-semibold text-foreground text-sm">{candidate.name}</span>
          <div className="ml-auto"><StatusBadge status={candidate.status} /></div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="grid lg:grid-cols-[1fr_300px] gap-8">
          {/* LEFT: main content */}
          <div className="space-y-6">
            {/* Header card */}
            <div className="border border-border/40 rounded-2xl p-6">
              <div className="flex items-start justify-between gap-4 mb-6">
                <div>
                  <h1 className="text-2xl font-extrabold text-foreground mb-1">{candidate.name}</h1>
                  <p className="text-muted-foreground text-sm">{candidate.email}</p>
                  {candidate.jobTitle && (
                    <p className="text-muted-foreground text-sm mt-0.5">
                      {candidate.jobTitle}{candidate.company ? ` · ${candidate.company}` : ""}
                    </p>
                  )}
                </div>
                {candidate.score != null && (
                  <div className="text-center shrink-0">
                    <div className="text-5xl font-extrabold text-primary leading-none">{Math.round(candidate.score)}%</div>
                    <div className="text-xs text-muted-foreground mt-1">Match Score</div>
                  </div>
                )}
              </div>

              {/* Score bar */}
              {candidate.score != null && (
                <div>
                  <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                    <span>Overall match</span><span>{Math.round(candidate.score)}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${candidate.score}%` }} />
                  </div>
                </div>
              )}
            </div>

            {/* Score breakdown */}
            {scoreBreakdown && (
              <div className="border border-border/40 rounded-2xl p-6">
                <h2 className="font-bold text-foreground mb-4 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-primary" /> See Match Breakdown
                </h2>
                <div className="space-y-3">
                  {Object.entries(scoreBreakdown).map(([key, val]: [string, any]) => {
                    if (typeof val !== "number") return null;
                    const label = key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
                    return (
                      <div key={key}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-muted-foreground capitalize">{label}</span>
                          <span className="font-semibold text-foreground">{Math.round(val)}%</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full bg-primary/70" style={{ width: `${val}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Skills */}
            {skills.length > 0 && (
              <div className="border border-border/40 rounded-2xl p-6">
                <h2 className="font-bold text-foreground mb-4">Skills</h2>
                <div className="flex flex-wrap gap-2">
                  {skills.map(s => (
                    <span key={s} className="bg-primary/8 border border-primary/15 text-primary text-xs font-medium px-3 py-1.5 rounded-full">{s}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Missing keywords */}
            {missingKeywords.length > 0 && (
              <div className="border border-border/40 rounded-2xl p-6">
                <h2 className="font-bold text-foreground mb-4 text-red-600 dark:text-red-400">Missing Keywords</h2>
                <div className="flex flex-wrap gap-2">
                  {missingKeywords.map(k => (
                    <span key={k} className="bg-red-50 border border-red-200 text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400 text-xs font-medium px-3 py-1.5 rounded-full">✕ {k}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Experience */}
            {candidate.experience && (
              <div className="border border-border/40 rounded-2xl p-6">
                <h2 className="font-bold text-foreground mb-3 flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-primary" /> Experience Summary
                </h2>
                <p className="text-muted-foreground text-sm leading-relaxed">{candidate.experience}</p>
              </div>
            )}

            {/* Work history from parsed CV */}
            {workExp.length > 0 && (
              <div className="border border-border/40 rounded-2xl p-6">
                <h2 className="font-bold text-foreground mb-4">Work History</h2>
                <div className="space-y-5">
                  {workExp.map((job: any, i: number) => (
                    <div key={i} className="border-l-2 border-primary/20 pl-4">
                      <p className="font-semibold text-foreground text-sm">{job.title}</p>
                      <p className="text-muted-foreground text-xs mb-2">{job.company} · {job.start_date} – {job.end_date ?? "Present"}</p>
                      {job.bullets?.slice(0, 2).map((b: string, j: number) => (
                        <p key={j} className="text-muted-foreground text-xs leading-relaxed">• {b}</p>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Invite history */}
            {invites.length > 0 && (
              <div className="border border-border/40 rounded-2xl p-6">
                <h2 className="font-bold text-foreground mb-4 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-primary" /> Invite History
                </h2>
                <div className="space-y-3">
                  {invites.map((inv: any) => (
                    <div key={inv.id} className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
                      <div>
                        <span className="text-sm font-medium text-foreground capitalize">{inv.type}</span>
                        <span className="text-xs text-muted-foreground ml-2">{new Date(inv.createdAt).toLocaleDateString()}</span>
                      </div>
                      <StatusBadge status={inv.status} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Notes */}
            {candidate.notes && (
              <div className="border border-border/40 rounded-2xl p-6">
                <h2 className="font-bold text-foreground mb-3">Notes</h2>
                <p className="text-muted-foreground text-sm leading-relaxed whitespace-pre-line">{candidate.notes}</p>
              </div>
            )}
          </div>

          {/* RIGHT: sticky action panel */}
          <div className="lg:sticky lg:top-20 h-fit">
            <div className="border border-border/40 rounded-2xl p-5 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">Actions</p>
              {actionButtons.map(btn => (
                <button key={btn.label} onClick={btn.onClick}
                  disabled={statusMutation.isPending}
                  className={`w-full flex items-center gap-2.5 justify-center py-2.5 rounded-xl text-sm font-semibold transition-all ${btn.color}`}>
                  <btn.icon className="w-4 h-4" />
                  {btn.label}
                </button>
              ))}

              <hr className="border-border/40 my-2" />

              {/* Status override */}
              <div>
                <p className="text-xs text-muted-foreground mb-2">Override status</p>
                <select value={candidate.status} onChange={e => statusMutation.mutate(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border border-border/60 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                  <option value="new">New</option>
                  <option value="invited">Invited</option>
                  <option value="accepted">Accepted</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </main>

      {inviteOpen && (
        <InviteModal
          candidate={{ id: candidate.id, name: candidate.name, email: candidate.email }}
          onClose={() => setInviteOpen(false)}
          onSent={() => {
            qc.invalidateQueries({ queryKey: ["candidate", id] });
            qc.invalidateQueries({ queryKey: ["candidates"] });
            toast({ title: "Invite sent", description: `Email sent to ${candidate.email}` });
            setInviteOpen(false);
          }}
        />
      )}
    </div>
  );
}
