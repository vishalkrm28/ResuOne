import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { authedFetch } from "@/lib/authed-fetch";
import { useToast } from "@/hooks/use-toast";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Loader2, ArrowLeft, Building2, MapPin, CheckCircle, Clock, Send,
  MessageSquare, Video, AlertCircle, ChevronRight, FileText, X,
} from "lucide-react";
import { cn } from "@/lib/utils";

const BASE = import.meta.env.VITE_API_URL ?? "/api";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Application {
  id: string;
  jobId: string;
  status: string;
  stage: string;
  candidateNotes: string | null;
  coverLetter: string | null;
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
  senderUserId: string;
  senderType: string;
  recipientUserId: string;
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
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(dateStr).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function InviteStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "bg-yellow-50 text-yellow-700 border-yellow-200",
    accepted: "bg-green-50 text-green-700 border-green-200",
    declined: "bg-red-50 text-red-700 border-red-200",
    reschedule_requested: "bg-orange-50 text-orange-700 border-orange-200",
    cancelled: "bg-gray-100 text-gray-600 border-gray-200",
    completed: "bg-blue-50 text-blue-700 border-blue-200",
  };
  return (
    <Badge variant="outline" className={cn("text-xs capitalize", map[status] ?? "")}>
      {status.replace("_", " ")}
    </Badge>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ExclusiveApplicationDetail() {
  const [, params] = useRoute("/jobs/exclusive/application/:id");
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const appId = params?.id ?? "";

  const [newMessage, setNewMessage] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [respondingTo, setRespondingTo] = useState<string | null>(null);

  // Application detail
  const { data, isLoading } = useQuery<{ application: Application; job: any; events: AppEvent[] }>({
    queryKey: ["exclusive-application", appId],
    queryFn: async () => {
      const res = await authedFetch(`${BASE}/internal-applications/${appId}`);
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Failed");
      return d;
    },
    enabled: !!appId,
  });

  // Messages
  const { data: msgData, refetch: refetchMessages } = useQuery<{ messages: Message[] }>({
    queryKey: ["exclusive-messages", appId],
    queryFn: async () => {
      const res = await authedFetch(`${BASE}/internal-job-messages/${appId}`);
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      return d;
    },
    enabled: !!appId,
  });

  // Invites
  const { data: inviteData, refetch: refetchInvites } = useQuery<{ invites: Invite[] }>({
    queryKey: ["exclusive-invites", appId],
    queryFn: async () => {
      const res = await authedFetch(`${BASE}/internal-job-interviews/application/${appId}`);
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      return d;
    },
    enabled: !!appId,
  });

  async function sendMessage() {
    if (!newMessage.trim()) return;
    setSendingMessage(true);
    try {
      const res = await authedFetch(`${BASE}/internal-job-messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationId: appId, bodyText: newMessage.trim() }),
      });
      if (!res.ok) throw new Error("Failed to send");
      setNewMessage("");
      refetchMessages();
      toast({ title: "Message sent" });
    } catch (err: any) {
      toast({ variant: "destructive", title: err.message });
    } finally {
      setSendingMessage(false);
    }
  }

  async function saveNote() {
    setSavingNote(true);
    try {
      const res = await authedFetch(`${BASE}/internal-applications/${appId}/note`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidateNotes: noteText }),
      });
      if (!res.ok) throw new Error("Failed");
      qc.invalidateQueries({ queryKey: ["exclusive-application", appId] });
      toast({ title: "Note saved" });
    } catch (err: any) {
      toast({ variant: "destructive", title: err.message });
    } finally {
      setSavingNote(false);
    }
  }

  async function withdraw() {
    if (!confirm("Are you sure you want to withdraw this application?")) return;
    setWithdrawing(true);
    try {
      const res = await authedFetch(`${BASE}/internal-applications/${appId}/withdraw`, { method: "POST" });
      if (!res.ok) throw new Error("Failed");
      qc.invalidateQueries({ queryKey: ["exclusive-application", appId] });
      toast({ title: "Application withdrawn" });
    } catch (err: any) {
      toast({ variant: "destructive", title: err.message });
    } finally {
      setWithdrawing(false);
    }
  }

  async function respondToInvite(inviteId: string, status: "accepted" | "declined" | "reschedule_requested", note?: string) {
    try {
      const res = await authedFetch(`${BASE}/internal-job-interviews/${inviteId}/respond`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, candidateResponseNote: note }),
      });
      if (!res.ok) throw new Error("Failed");
      refetchInvites();
      toast({ title: `Interview ${status.replace("_", " ")}` });
      setRespondingTo(null);
    } catch (err: any) {
      toast({ variant: "destructive", title: err.message });
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
  const canWithdraw = !["withdrawn", "hired"].includes(application.status);

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Button variant="ghost" size="sm" onClick={() => navigate("/jobs/exclusive")} className="mb-6 text-muted-foreground">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Jobs
        </Button>

        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-4 mb-6">
          <div>
            <h1 className="text-xl font-bold">{job?.title ?? "Application"}</h1>
            <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
              {job?.company && <span className="flex items-center gap-1"><Building2 className="w-3.5 h-3.5" />{job.company}</span>}
              {job?.location && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{job.location}</span>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={cn("capitalize", STATUS_COLORS[application.status])}>
              {application.status}
            </Badge>
            <Badge variant="outline" className="text-xs capitalize text-muted-foreground">
              Stage: {application.stage.replace("_", " ")}
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ── Left — main content ────────────────────────────── */}
          <div className="lg:col-span-2 space-y-6">
            {/* Interview invites */}
            {invites.length > 0 && (
              <Card className="border-indigo-200 bg-indigo-50/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Video className="w-4 h-4 text-indigo-600" /> Interview Invites
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {invites.map((invite) => (
                    <div key={invite.id} className="p-3 rounded-lg border bg-white space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-medium text-sm">{invite.inviteTitle}</p>
                          <p className="text-xs text-muted-foreground capitalize">{invite.interviewType.replace("_", " ")}</p>
                          <p className="text-xs text-foreground/70 mt-0.5">
                            {new Date(invite.scheduledAt).toLocaleString("en-GB", {
                              weekday: "short", day: "numeric", month: "short", year: "numeric",
                              hour: "2-digit", minute: "2-digit",
                            })}
                            {invite.timezone ? ` (${invite.timezone})` : ""}
                          </p>
                          {invite.location && <p className="text-xs text-muted-foreground">{invite.location}</p>}
                          {invite.meetingUrl && (
                            <a href={invite.meetingUrl} target="_blank" rel="noopener noreferrer"
                              className="text-xs text-purple-600 hover:underline">Join meeting</a>
                          )}
                        </div>
                        <InviteStatusBadge status={invite.status} />
                      </div>
                      {invite.notes && <p className="text-xs text-muted-foreground italic">{invite.notes}</p>}
                      {invite.status === "pending" && (
                        <div className="flex gap-2 pt-1">
                          <Button size="sm" variant="outline" className="text-xs h-7 text-green-700 border-green-200"
                            onClick={() => respondToInvite(invite.id, "accepted")}>
                            <CheckCircle className="w-3 h-3 mr-1" /> Accept
                          </Button>
                          <Button size="sm" variant="outline" className="text-xs h-7 text-red-700 border-red-200"
                            onClick={() => respondToInvite(invite.id, "declined")}>
                            <X className="w-3 h-3 mr-1" /> Decline
                          </Button>
                          <Button size="sm" variant="outline" className="text-xs h-7 text-orange-700 border-orange-200"
                            onClick={() => respondToInvite(invite.id, "reschedule_requested")}>
                            Reschedule
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
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
                  <p className="text-sm text-muted-foreground py-4 text-center">No messages yet. Start the conversation.</p>
                )}
                <div className="space-y-3 mb-4 max-h-72 overflow-y-auto">
                  {[...messages].reverse().map((msg) => {
                    const isMe = msg.senderType === "candidate";
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
                    placeholder="Type a message to the recruiter..."
                    rows={2}
                    className="flex-1 resize-none"
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                  />
                  <Button onClick={sendMessage} disabled={sendingMessage || !newMessage.trim()} className="self-end bg-purple-600 hover:bg-purple-700 text-white">
                    {sendingMessage ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </Button>
                </div>
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
                  <p className="text-sm text-muted-foreground py-2">No events yet.</p>
                ) : (
                  <div className="relative pl-6">
                    <div className="absolute left-2 top-0 bottom-0 w-px bg-border" />
                    <div className="space-y-4">
                      {events.map((ev) => (
                        <div key={ev.id} className="relative">
                          <div className="absolute -left-4 w-3 h-3 rounded-full bg-purple-200 border-2 border-purple-500 top-1" />
                          <p className="text-sm font-medium">{ev.title}</p>
                          {ev.description && <p className="text-xs text-muted-foreground mt-0.5">{ev.description}</p>}
                          <p className="text-xs text-muted-foreground mt-0.5 capitalize">
                            {ev.actorType} · {timeAgo(ev.createdAt)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ── Right — sidebar ────────────────────────────────── */}
          <div className="space-y-4">
            {/* Applied date */}
            <Card>
              <CardContent className="p-4 space-y-2 text-sm">
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

            {/* Candidate notes */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <FileText className="w-4 h-4" /> My Notes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  defaultValue={application.candidateNotes ?? ""}
                  onChange={(e) => setNoteText(e.target.value)}
                  rows={4}
                  placeholder="Private notes about this application..."
                  className="text-sm"
                />
                <Button size="sm" variant="outline" className="w-full mt-2 text-xs" onClick={saveNote} disabled={savingNote}>
                  {savingNote ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                  Save Note
                </Button>
              </CardContent>
            </Card>

            {/* Withdraw */}
            {canWithdraw && (
              <Button variant="outline" size="sm" className="w-full text-xs text-red-600 border-red-200 hover:bg-red-50"
                onClick={withdraw} disabled={withdrawing}>
                {withdrawing ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <X className="w-3.5 h-3.5 mr-1.5" />}
                Withdraw Application
              </Button>
            )}

            {/* View job */}
            <Button variant="outline" size="sm" className="w-full text-xs"
              onClick={() => navigate(`/jobs/exclusive/${application.jobId}`)}>
              <ChevronRight className="w-3.5 h-3.5 mr-1.5" /> View Job Posting
            </Button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
