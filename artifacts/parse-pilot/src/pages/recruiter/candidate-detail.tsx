import { useState, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getCandidate, updateCandidateStatus,
  getCandidateNotes, addCandidateNote, deleteCandidateNote,
} from "@/lib/recruiter-api";
import {
  Loader2, ArrowLeft, Mail, CheckCircle2, XCircle, Star,
  BarChart3, Briefcase, MessageSquare, Trash2, Send, User,
  Clock, Calendar, CheckCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { InviteModal } from "./invite-modal";
import { cn } from "@/lib/utils";

// ─── Mirrors exclusive STATUS_COLORS ─────────────────────────────────────────
const STATUS_COLORS: Record<string, string> = {
  new:      "bg-yellow-50 text-yellow-700 border-yellow-200",
  invited:  "bg-blue-50 text-blue-700 border-blue-200",
  accepted: "bg-green-50 text-green-800 border-green-200",
  rejected: "bg-red-50 text-red-700 border-red-200",
};

const STAGE_ORDER = ["new", "invited", "accepted", "rejected"] as const;
type Stage = typeof STAGE_ORDER[number];

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const hrs = Math.floor(diff / 3600000);
  if (hrs < 1) return "Just now";
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(dateStr).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export default function CandidateDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [noteText, setNoteText] = useState("");
  const noteInputRef = useRef<HTMLTextAreaElement>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["candidate", id],
    queryFn: () => getCandidate(id),
  });

  const { data: notesData, isLoading: notesLoading } = useQuery({
    queryKey: ["candidate-notes", id],
    queryFn: () => getCandidateNotes(id),
  });
  const notes: any[] = notesData?.notes ?? [];

  const statusMutation = useMutation({
    mutationFn: (status: string) => updateCandidateStatus(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["candidate", id] });
      qc.invalidateQueries({ queryKey: ["candidates"] });
    },
    onError: () => toast({ title: "Update failed", variant: "destructive" }),
  });

  const addNoteMutation = useMutation({
    mutationFn: (text: string) => addCandidateNote(id, text),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["candidate-notes", id] });
      setNoteText("");
    },
    onError: () => toast({ title: "Failed to add note", variant: "destructive" }),
  });

  const deleteNoteMutation = useMutation({
    mutationFn: (noteId: string) => deleteCandidateNote(id, noteId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["candidate-notes", id] }),
    onError: () => toast({ title: "Failed to delete note", variant: "destructive" }),
  });

  const handleAddNote = () => {
    if (!noteText.trim()) return;
    addNoteMutation.mutate(noteText.trim());
  };

  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="w-6 h-6 animate-spin text-primary" />
    </div>
  );

  if (error || !data?.candidate) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <p className="text-muted-foreground mb-4">Candidate not found.</p>
        <button onClick={() => navigate("/recruiter/dashboard")} className="text-primary hover:underline text-sm">← Back to Dashboard</button>
      </div>
    </div>
  );

  const { candidate, invites = [] } = data;
  const skills: string[] = candidate.skills ?? [];
  const parsedCv = candidate.parsedCvJson as any;
  const missingKeywords: string[] = parsedCv?.missing_keywords ?? [];
  const workExp = parsedCv?.work_experience ?? [];
  const scoreBreakdown = candidate.scoringBreakdownJson as any ?? null;

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar — mirrors exclusive-application header */}
      <header className="border-b border-border/40 bg-background/95 backdrop-blur sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/recruiter/dashboard")} className="text-muted-foreground gap-1.5">
            <ArrowLeft className="w-4 h-4" /> Dashboard
          </Button>
          <span className="text-border/60">|</span>
          <span className="font-semibold text-foreground text-sm truncate">{candidate.name}</span>
          <div className="ml-auto">
            <Badge variant="outline" className={cn("capitalize", STATUS_COLORS[candidate.status] ?? "")}>
              {candidate.status}
            </Badge>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="grid lg:grid-cols-3 gap-6">

          {/* ── LEFT — 2/3 main content ─────────────────────────── */}
          <div className="lg:col-span-2 space-y-5">

            {/* Profile card */}
            <Card>
              <CardContent className="pt-5">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <User className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h1 className="text-xl font-extrabold text-foreground mb-0.5">{candidate.name}</h1>
                    <p className="text-sm text-muted-foreground">{candidate.email}</p>
                    {candidate.jobTitle && (
                      <p className="text-sm text-muted-foreground/70 mt-0.5">
                        {candidate.jobTitle}{candidate.company ? ` · ${candidate.company}` : ""}
                      </p>
                    )}
                  </div>
                  {candidate.score != null && (
                    <div className="text-center shrink-0">
                      <div className="text-4xl font-extrabold text-primary leading-none">{Math.round(candidate.score)}%</div>
                      <div className="text-xs text-muted-foreground mt-1">Match Score</div>
                    </div>
                  )}
                </div>

                {candidate.score != null && (
                  <div className="mt-4">
                    <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                      <span>Overall match</span><span>{Math.round(candidate.score)}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${candidate.score}%` }} />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Score breakdown */}
            {scoreBreakdown && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-primary" /> Match Breakdown
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
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
                </CardContent>
              </Card>
            )}

            {/* Skills */}
            {skills.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Skills</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {skills.map(s => (
                      <span key={s} className="bg-primary/8 border border-primary/15 text-primary text-xs font-medium px-3 py-1.5 rounded-full">{s}</span>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Missing keywords */}
            {missingKeywords.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base text-red-600 dark:text-red-400">Missing Keywords</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {missingKeywords.map(k => (
                      <span key={k} className="bg-red-50 border border-red-200 text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400 text-xs font-medium px-3 py-1.5 rounded-full">✕ {k}</span>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Experience */}
            {candidate.experience && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Briefcase className="w-4 h-4 text-primary" /> Experience Summary
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground text-sm leading-relaxed">{candidate.experience}</p>
                </CardContent>
              </Card>
            )}

            {/* Work history */}
            {workExp.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Work History</CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  {workExp.map((job: any, i: number) => (
                    <div key={i} className="border-l-2 border-primary/20 pl-4">
                      <p className="font-semibold text-foreground text-sm">{job.title}</p>
                      <p className="text-muted-foreground text-xs mb-2">{job.company} · {job.start_date} – {job.end_date ?? "Present"}</p>
                      {job.bullets?.slice(0, 2).map((b: string, j: number) => (
                        <p key={j} className="text-muted-foreground text-xs leading-relaxed">• {b}</p>
                      ))}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Invite / interview history — mirrors exclusive's interview card */}
            {invites.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-indigo-600" /> Interview Invites
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {invites.map((inv: any) => (
                    <div
                      key={inv.id}
                      className={cn(
                        "p-3 rounded-lg border space-y-1",
                        inv.status === "completed" ? "bg-green-50 border-green-300" :
                        inv.status === "rejected" ? "bg-gray-50 border-gray-200" : "bg-white",
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium text-sm capitalize">{inv.type?.replace("_", " ") ?? "Interview"}</p>
                        {inv.status === "completed" ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-400">
                            <CheckCircle className="w-3 h-3" /> Completed
                          </span>
                        ) : (
                          <Badge variant="outline" className={cn("text-xs capitalize", STATUS_COLORS[inv.status] ?? "")}>
                            {inv.status}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {new Date(inv.createdAt).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Notes — mirrors exclusive recruiter notes */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-primary" /> Notes
                  {notes.length > 0 && (
                    <span className="ml-auto text-xs font-normal text-muted-foreground">{notes.length} note{notes.length !== 1 ? "s" : ""}</span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {/* Add note */}
                <div className="mb-5">
                  <textarea
                    ref={noteInputRef}
                    value={noteText}
                    onChange={e => setNoteText(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleAddNote(); }}
                    placeholder="Add a private note… (Cmd+Enter to save)"
                    rows={3}
                    className="w-full resize-none rounded-xl border border-border/60 bg-background px-3.5 py-2.5 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                  <div className="flex justify-end mt-2">
                    <Button
                      size="sm"
                      onClick={handleAddNote}
                      disabled={!noteText.trim() || addNoteMutation.isPending}
                    >
                      {addNoteMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Send className="w-3.5 h-3.5 mr-1.5" />}
                      Add Note
                    </Button>
                  </div>
                </div>

                {/* Notes timeline */}
                {notesLoading ? (
                  <div className="flex items-center gap-2 py-4 text-muted-foreground text-sm">
                    <Loader2 className="w-4 h-4 animate-spin" /> Loading…
                  </div>
                ) : notes.length === 0 ? (
                  <div className="text-center py-6">
                    <MessageSquare className="w-8 h-8 text-muted-foreground/20 mx-auto mb-2" />
                    <p className="text-muted-foreground text-sm">No notes yet. Add one above.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {notes.map((note: any) => (
                      <div key={note.id} className="group flex items-start gap-3 p-3.5 rounded-xl bg-muted/15 hover:bg-muted/25 transition-colors">
                        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                          <MessageSquare className="w-3.5 h-3.5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{note.text}</p>
                          <p className="text-xs text-muted-foreground/60 mt-1.5">
                            {new Date(note.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                          </p>
                        </div>
                        <button
                          onClick={() => { if (confirm("Delete this note?")) deleteNoteMutation.mutate(note.id); }}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground/40 hover:text-red-500 p-1 rounded-md"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ── RIGHT — sticky action panel, mirrors exclusive sidebar ─── */}
          <div className="lg:sticky lg:top-20 h-fit space-y-4">

            {/* Pipeline stage selector */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-muted-foreground uppercase tracking-wider font-semibold">Pipeline Stage</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 pt-0">
                {STAGE_ORDER.map(stage => (
                  <button
                    key={stage}
                    onClick={() => statusMutation.mutate(stage)}
                    disabled={statusMutation.isPending}
                    className={cn(
                      "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all border",
                      candidate.status === stage
                        ? cn("border-transparent", STATUS_COLORS[stage])
                        : "border-border/40 text-muted-foreground hover:border-border hover:bg-muted/20",
                    )}
                  >
                    {candidate.status === stage && <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />}
                    <span className="capitalize">{stage}</span>
                  </button>
                ))}
              </CardContent>
            </Card>

            {/* Quick actions */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-muted-foreground uppercase tracking-wider font-semibold">Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 pt-0">
                <Button
                  className="w-full gap-2"
                  onClick={() => setInviteOpen(true)}
                >
                  <Mail className="w-4 h-4" /> Invite to Interview
                </Button>
                <Button
                  variant="outline"
                  className="w-full gap-2 text-yellow-700 border-yellow-300 hover:bg-yellow-50 dark:text-yellow-400 dark:border-yellow-700 dark:hover:bg-yellow-900/20"
                  onClick={() => statusMutation.mutate("invited")}
                  disabled={statusMutation.isPending}
                >
                  <Star className="w-4 h-4" /> Mark Invited
                </Button>
                <Button
                  variant="outline"
                  className="w-full gap-2 text-green-700 border-green-300 hover:bg-green-50"
                  onClick={() => statusMutation.mutate("accepted")}
                  disabled={statusMutation.isPending}
                >
                  <CheckCircle2 className="w-4 h-4" /> Accept
                </Button>
                <Button
                  variant="outline"
                  className="w-full gap-2 text-red-600 border-red-200 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
                  onClick={() => { if (confirm("Reject this candidate?")) statusMutation.mutate("rejected"); }}
                  disabled={statusMutation.isPending}
                >
                  <XCircle className="w-4 h-4" /> Reject
                </Button>
              </CardContent>
            </Card>
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
