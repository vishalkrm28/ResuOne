import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { authedFetch } from "@/lib/authed-fetch";
import { useToast } from "@/hooks/use-toast";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  Loader2, ArrowLeft, Building2, User, MessageSquare, Video,
  Clock, CheckCircle, X, Send, Calendar, ChevronRight, AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

const BASE = import.meta.env.VITE_API_URL ?? "/api";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Application {
  id: string;
  jobId: string;
  applicantUserId: string;
  applicantName: string | null;
  applicantEmail: string | null;
  status: string;
  stage: string;
  coverLetter: string | null;
  candidateNotes: string | null;
  recruiterNotes: string | null;
  appliedAt: string;
  updatedAt: string;
}

interface AppEvent {
  id: string;
  actorType: string;
  eventType: string;
  title: string;
  description: string | null;
  createdAt: string;
}

interface Message {
  id: string;
  senderType: string;
  senderUserId: string;
  bodyText: string;
  subject: string | null;
  isRead: boolean;
  createdAt: string;
}

interface Invite {
  id: string;
  inviteTitle: string;
  interviewType: string;
  scheduledAt: string;
  timezone: string | null;
  location: string | null;
  meetingUrl: string | null;
  notes: string | null;
  status: string;
  candidateResponseNote: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_OPTIONS = ["applied", "shortlisted", "rejected", "interview", "offer", "hired"] as const;
const STAGE_OPTIONS = ["submitted", "under_review", "shortlisted", "interview", "final_review", "offer", "hired"] as const;
const STATUS_COLORS: Record<string, string> = {
  applied: "bg-blue-50 text-blue-700 border-blue-200",
  shortlisted: "bg-purple-50 text-purple-700 border-purple-200",
  interview: "bg-indigo-50 text-indigo-700 border-indigo-200",
  offer: "bg-green-50 text-green-800 border-green-200",
  hired: "bg-green-100 text-green-900 border-green-300",
  rejected: "bg-red-50 text-red-700 border-red-200",
  withdrawn: "bg-gray-100 text-gray-600 border-gray-200",
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const hrs = Math.floor(diff / 3600000);
  if (hrs < 1) return "Just now";
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(dateStr).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

// ─── Interview Invite Dialog ──────────────────────────────────────────────────

function InviteDialog({ applicationId, onClose, onCreated }: { applicationId: string; onClose: () => void; onCreated: () => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    inviteTitle: "",
    interviewType: "general",
    scheduledAt: "",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    location: "",
    meetingUrl: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);

  function set(field: string, value: string) { setForm((f) => ({ ...f, [field]: value })); }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!form.inviteTitle || !form.scheduledAt) { toast({ variant: "destructive", title: "Title and date required" }); return; }
    setSaving(true);
    try {
      const res = await authedFetch(`${BASE}/internal-job-interviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationId, ...form, scheduledAt: new Date(form.scheduledAt).toISOString() }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Failed");
      toast({ title: "Interview invite sent!" });
      onCreated();
      onClose();
    } catch (err: any) {
      toast({ variant: "destructive", title: err.message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Send Interview Invite</DialogTitle></DialogHeader>
        <form onSubmit={create} className="space-y-3 pt-2">
          <div>
            <Label>Interview title *</Label>
            <Input value={form.inviteTitle} onChange={(e) => set("inviteTitle", e.target.value)} placeholder="e.g. First round interview" className="mt-1" />
          </div>
          <div>
            <Label>Interview type</Label>
            <Select value={form.interviewType} onValueChange={(v) => set("interviewType", v)}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="recruiter_screen">Recruiter Screen</SelectItem>
                <SelectItem value="hiring_manager">Hiring Manager</SelectItem>
                <SelectItem value="technical">Technical</SelectItem>
                <SelectItem value="case_study">Case Study</SelectItem>
                <SelectItem value="final_round">Final Round</SelectItem>
                <SelectItem value="general">General</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Date & time *</Label>
            <Input type="datetime-local" value={form.scheduledAt} onChange={(e) => set("scheduledAt", e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label>Timezone</Label>
            <Input value={form.timezone} onChange={(e) => set("timezone", e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label>Location / Platform</Label>
            <Input value={form.location} onChange={(e) => set("location", e.target.value)} placeholder="e.g. Google Meet, London office" className="mt-1" />
          </div>
          <div>
            <Label>Meeting URL</Label>
            <Input value={form.meetingUrl} onChange={(e) => set("meetingUrl", e.target.value)} placeholder="https://..." className="mt-1" />
          </div>
          <div>
            <Label>Notes for candidate</Label>
            <Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={3} className="mt-1" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving} className="bg-purple-600 hover:bg-purple-700 text-white">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Video className="w-4 h-4 mr-2" />}
              Send Invite
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function RecruiterExclusiveApplication() {
  const [, params] = useRoute("/recruiter/exclusive-jobs/:jobId/application/:appId");
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const appId = params?.appId ?? "";
  const jobId = params?.jobId ?? "";

  const [inviteOpen, setInviteOpen] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [recruiterNote, setRecruiterNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  // Application detail
  const { data, isLoading } = useQuery<{ application: Application; job: any; events: AppEvent[] }>({
    queryKey: ["recruiter-exclusive-application", appId],
    queryFn: async () => {
      const res = await authedFetch(`${BASE}/internal-applications/${appId}`);
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Failed");
      return d;
    },
    enabled: !!appId,
  });

  // Messages
  const { data: msgData, refetch: refetchMsgs } = useQuery<{ messages: Message[] }>({
    queryKey: ["recruiter-messages", appId],
    queryFn: async () => {
      const res = await authedFetch(`${BASE}/internal-job-messages/${appId}`);
      const d = await res.json();
      if (!res.ok) return { messages: [] };
      return d;
    },
    enabled: !!appId,
  });

  // Invites
  const { data: inviteData, refetch: refetchInvites } = useQuery<{ invites: Invite[] }>({
    queryKey: ["recruiter-invites", appId],
    queryFn: async () => {
      const res = await authedFetch(`${BASE}/internal-job-interviews/application/${appId}`);
      const d = await res.json();
      if (!res.ok) return { invites: [] };
      return d;
    },
    enabled: !!appId,
  });

  async function updateStatus(status: string) {
    setUpdatingStatus(true);
    try {
      const res = await authedFetch(`${BASE}/internal-jobs/${jobId}/applications/${appId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Failed");
      qc.invalidateQueries({ queryKey: ["recruiter-exclusive-application", appId] });
      toast({ title: `Status updated to ${status}` });
    } catch (err: any) {
      toast({ variant: "destructive", title: err.message });
    } finally {
      setUpdatingStatus(false);
    }
  }

  async function markInviteComplete(inviteId: string) {
    try {
      const res = await authedFetch(`${BASE}/internal-job-interviews/${inviteId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "completed" }),
      });
      if (!res.ok) throw new Error("Failed");
      refetchInvites();
      qc.invalidateQueries({ queryKey: ["recruiter-exclusive-application", appId] });
      toast({ title: "Interview round marked as completed" });
    } catch (err: any) {
      toast({ variant: "destructive", title: err.message });
    }
  }

  async function saveNote() {
    setSavingNote(true);
    try {
      const res = await authedFetch(`${BASE}/internal-jobs/${jobId}/applications/${appId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recruiterNotes: recruiterNote }),
      });
      if (!res.ok) throw new Error("Failed");
      qc.invalidateQueries({ queryKey: ["recruiter-exclusive-application", appId] });
      toast({ title: "Note saved" });
    } catch (err: any) {
      toast({ variant: "destructive", title: err.message });
    } finally {
      setSavingNote(false);
    }
  }

  async function sendMessage() {
    if (!newMessage.trim()) return;
    setSendingMessage(true);
    try {
      const res = await authedFetch(`${BASE}/internal-job-messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationId: appId, bodyText: newMessage.trim() }),
      });
      if (!res.ok) throw new Error("Failed");
      setNewMessage("");
      refetchMsgs();
      toast({ title: "Message sent" });
    } catch (err: any) {
      toast({ variant: "destructive", title: err.message });
    } finally {
      setSendingMessage(false);
    }
  }

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  if (!data) {
    return (
      <AppLayout>
        <div className="max-w-3xl mx-auto px-4 py-12 text-center">
          <AlertCircle className="w-10 h-10 text-destructive mx-auto mb-3" />
          <p className="text-sm text-destructive">Application not found</p>
        </div>
      </AppLayout>
    );
  }

  const { application, job, events } = data;
  const messages = msgData?.messages ?? [];
  const invites = inviteData?.invites ?? [];

  return (
    <AppLayout>
      {inviteOpen && (
        <InviteDialog
          applicationId={appId}
          onClose={() => setInviteOpen(false)}
          onCreated={() => { refetchInvites(); qc.invalidateQueries({ queryKey: ["recruiter-exclusive-application", appId] }); }}
        />
      )}

      <div className="max-w-5xl mx-auto px-4 py-8">
        <Button variant="ghost" size="sm" onClick={() => navigate(`/recruiter/exclusive-jobs/${jobId}`)} className="mb-6 text-muted-foreground">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Applicants
        </Button>

        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-9 h-9 rounded-full bg-purple-100 flex items-center justify-center">
                <User className="w-4 h-4 text-purple-600" />
              </div>
              <div>
                <p className="font-bold">{application.applicantName ?? "Anonymous"}</p>
                {application.applicantEmail && (
                  <p className="text-xs text-muted-foreground">{application.applicantEmail}</p>
                )}
              </div>
            </div>
            <p className="text-sm text-muted-foreground">{job?.title} @ {job?.company}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={cn("capitalize", STATUS_COLORS[application.status] ?? "")}>
              {application.status}
            </Badge>
            <Badge variant="outline" className="text-xs capitalize text-muted-foreground">
              {application.stage.replace("_", " ")}
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ── Left — main detail ───────────────────────────── */}
          <div className="lg:col-span-2 space-y-5">
            {/* Cover letter */}
            {application.coverLetter && (
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-base">Cover Letter</CardTitle></CardHeader>
                <CardContent>
                  <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">{application.coverLetter}</p>
                </CardContent>
              </Card>
            )}

            {/* Messages */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-purple-600" /> Messages
                </CardTitle>
              </CardHeader>
              <CardContent>
                {messages.length === 0 && (
                  <p className="text-sm text-muted-foreground py-3 text-center">No messages yet.</p>
                )}
                <div className="space-y-3 mb-4 max-h-64 overflow-y-auto">
                  {[...messages].reverse().map((msg) => {
                    const isMe = msg.senderType === "recruiter";
                    return (
                      <div key={msg.id} className={cn("flex", isMe ? "justify-end" : "justify-start")}>
                        <div className={cn(
                          "max-w-xs px-3 py-2 rounded-xl text-sm",
                          isMe ? "bg-purple-600 text-white" : "bg-muted text-foreground",
                        )}>
                          {msg.subject && <p className="font-semibold text-xs mb-1">{msg.subject}</p>}
                          <p className="leading-relaxed">{msg.bodyText}</p>
                          <p className={cn("text-xs mt-1", isMe ? "text-purple-200" : "text-muted-foreground")}>
                            {timeAgo(msg.createdAt)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex gap-2">
                  <Textarea
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Message the candidate..."
                    rows={2}
                    className="flex-1 resize-none"
                  />
                  <Button onClick={sendMessage} disabled={sendingMessage || !newMessage.trim()} className="self-end bg-purple-600 hover:bg-purple-700 text-white">
                    {sendingMessage ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Interview invites */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Video className="w-4 h-4 text-indigo-600" /> Interviews
                  </CardTitle>
                  <Button size="sm" variant="outline" className="text-xs" onClick={() => setInviteOpen(true)}>
                    <Calendar className="w-3.5 h-3.5 mr-1.5" /> Schedule
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {invites.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2 text-center">No invites sent yet.</p>
                ) : (
                  <div className="space-y-2">
                    {invites.map((invite) => (
                      <div key={invite.id} className="p-3 rounded-lg border text-sm">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-medium flex-1">{invite.inviteTitle}</p>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <Badge
                              variant="outline"
                              className={cn("text-xs capitalize", {
                                "border-green-400 text-green-600 bg-green-50": invite.status === "completed",
                                "border-red-400 text-red-500 bg-red-50": invite.status === "cancelled",
                                "border-blue-400 text-blue-600 bg-blue-50": invite.status === "accepted",
                              })}
                            >
                              {invite.status.replace("_", " ")}
                            </Badge>
                            {!["completed", "cancelled"].includes(invite.status) && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-6 px-2 text-xs text-green-600 border-green-300 hover:bg-green-50 hover:text-green-700"
                                onClick={() => markInviteComplete(invite.id)}
                              >
                                <CheckCircle className="w-3 h-3 mr-1" /> Complete
                              </Button>
                            )}
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {new Date(invite.scheduledAt).toLocaleString("en-GB", {
                            weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                          })}
                        </p>
                        {invite.candidateResponseNote && (
                          <p className="text-xs text-muted-foreground mt-1 italic">Candidate note: {invite.candidateResponseNote}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Event timeline */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="w-4 h-4 text-muted-foreground" /> Timeline
                </CardTitle>
              </CardHeader>
              <CardContent>
                {events.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">No events.</p>
                ) : (
                  <div className="relative pl-6">
                    <div className="absolute left-2 top-0 bottom-0 w-px bg-border" />
                    <div className="space-y-4">
                      {events.map((ev) => (
                        <div key={ev.id} className="relative">
                          <div className="absolute -left-4 w-3 h-3 rounded-full bg-purple-200 border-2 border-purple-500 top-1" />
                          <p className="text-sm font-medium">{ev.title}</p>
                          {ev.description && <p className="text-xs text-muted-foreground">{ev.description}</p>}
                          <p className="text-xs text-muted-foreground capitalize">{ev.actorType} · {timeAgo(ev.createdAt)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ── Right — pipeline controls ────────────────────── */}
          <div className="space-y-4">
            {/* Status controls */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Pipeline Status</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {STATUS_OPTIONS.map((s) => (
                  <Button
                    key={s}
                    size="sm"
                    variant={application.status === s ? "default" : "outline"}
                    className={cn(
                      "w-full text-xs h-8 justify-start capitalize",
                      application.status === s && "bg-purple-600 hover:bg-purple-700 text-white",
                    )}
                    onClick={() => updateStatus(s)}
                    disabled={updatingStatus || application.status === s}
                  >
                    {application.status === s && <CheckCircle className="w-3 h-3 mr-2" />}
                    {s}
                  </Button>
                ))}
              </CardContent>
            </Card>

            {/* Recruiter notes */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Recruiter Notes</CardTitle></CardHeader>
              <CardContent>
                <Textarea
                  defaultValue={application.recruiterNotes ?? ""}
                  onChange={(e) => setRecruiterNote(e.target.value)}
                  rows={5}
                  placeholder="Private notes about this candidate..."
                  className="text-sm"
                />
                <Button size="sm" variant="outline" className="w-full mt-2 text-xs" onClick={saveNote} disabled={savingNote}>
                  {savingNote ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                  Save Notes
                </Button>
              </CardContent>
            </Card>

            {/* Applied date */}
            <Card>
              <CardContent className="p-4 text-sm space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Applied</span>
                  <span>{new Date(application.appliedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Last update</span>
                  <span>{timeAgo(application.updatedAt)}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
