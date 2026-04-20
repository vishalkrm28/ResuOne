import { useState, useEffect, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  getTrackedApp,
  updateStage,
  updateNotes,
  linkAssets,
  updateAppStatus,
  createReminder,
  completeReminder,
  type TrackedApp,
  type TimelineEvent,
  type Reminder,
  type ApplicationStage,
  STAGE_LABELS,
  PIPELINE_STAGES,
  TERMINAL_STAGES,
} from "@/lib/tracker-api";
import {
  ArrowLeft,
  Loader2,
  FileText,
  MailOpen,
  ExternalLink,
  Clock,
  Bell,
  Briefcase,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  Sparkles,
  Save,
  Archive,
  Building2,
  MapPin,
  Mail,
  Calendar,
  Mic,
  Plus,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "wouter";
import {
  generateEmailDraft,
  listEmailDrafts,
  updateDraftStatus,
  type EmailDraft,
  type DraftType,
  type EmailTone,
  DRAFT_TYPE_LABELS,
  DRAFT_TYPE_DESCRIPTIONS,
} from "@/lib/emails-api";
import {
  createInterview,
  listInterviews,
  updateInterview,
  listMockSessions,
  createMockSession,
  type ApplicationInterview,
  type MockSession,
  type InterviewType,
  type SessionType,
  INTERVIEW_TYPE_LABELS,
  SESSION_TYPE_LABELS,
} from "@/lib/mock-interview-api";

const STAGE_COLORS: Record<ApplicationStage, string> = {
  saved: "bg-gray-100 text-gray-700 border-gray-200",
  preparing: "bg-blue-50 text-blue-700 border-blue-200",
  applied: "bg-purple-50 text-purple-700 border-purple-200",
  screening: "bg-yellow-50 text-yellow-700 border-yellow-200",
  interview: "bg-orange-50 text-orange-700 border-orange-200",
  final_round: "bg-pink-50 text-pink-700 border-pink-200",
  offer: "bg-green-50 text-green-700 border-green-200",
  rejected: "bg-red-50 text-red-700 border-red-200",
  withdrawn: "bg-gray-50 text-gray-500 border-gray-200",
};

const EVENT_ICONS: Record<string, React.ReactNode> = {
  application_created: <Briefcase className="w-4 h-4" />,
  stage_changed: <ChevronRight className="w-4 h-4" />,
  assets_linked: <FileText className="w-4 h-4" />,
  interview_prep_generated: <Sparkles className="w-4 h-4" />,
};

const REMINDER_LABELS: Record<string, string> = {
  follow_up: "Follow-up",
  interview: "Interview",
  deadline: "Deadline",
  personal_note: "Personal note",
};

export default function AppDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [app, setApp] = useState<TrackedApp | null>(null);
  const [tailoredCv, setTailoredCv] = useState<{ id: string; versionName: string | null } | null>(null);
  const [coverLetter, setCoverLetter] = useState<{ id: string; jobTitle: string | null; tone: string } | null>(null);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);

  const [notes, setNotes] = useState("");
  const [notesDirty, setNotesDirty] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);
  const [changingStage, setChangingStage] = useState(false);

  const [reminderType, setReminderType] = useState<"follow_up" | "interview" | "deadline" | "personal_note">("follow_up");
  const [reminderDate, setReminderDate] = useState("");
  const [reminderNote, setReminderNote] = useState("");
  const [addingReminder, setAddingReminder] = useState(false);

  // M36: Email drafts
  const [emailDrafts, setEmailDrafts] = useState<EmailDraft[]>([]);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [emailDraftType, setEmailDraftType] = useState<DraftType>("follow_up");
  const [emailTone, setEmailTone] = useState<EmailTone>("professional");
  const [emailExtraContext, setEmailExtraContext] = useState("");
  const [generatingEmail, setGeneratingEmail] = useState(false);
  const [expandedDraft, setExpandedDraft] = useState<string | null>(null);
  const [copiedDraft, setCopiedDraft] = useState<string | null>(null);

  // M36: Interviews
  const [interviews, setInterviews] = useState<ApplicationInterview[]>([]);
  const [showInterviewForm, setShowInterviewForm] = useState(false);
  const [interviewType, setInterviewType] = useState<InterviewType>("general");
  const [interviewTitle, setInterviewTitle] = useState("");
  const [interviewDate, setInterviewDate] = useState("");
  const [interviewLocation, setInterviewLocation] = useState("");
  const [interviewMeetingUrl, setInterviewMeetingUrl] = useState("");
  const [interviewNotes, setInterviewNotes] = useState("");
  const [schedulingInterview, setSchedulingInterview] = useState(false);

  // M36: Mock interview
  const [mockSessions, setMockSessions] = useState<MockSession[]>([]);
  const [showMockForm, setShowMockForm] = useState(false);
  const [mockSessionType, setMockSessionType] = useState<SessionType>("mixed");
  const [mockQuestionCount, setMockQuestionCount] = useState<5 | 8 | 10>(8);
  const [creatingMockSession, setCreatingMockSession] = useState(false);

  const load = useCallback(async () => {
    try {
      const [data, drafts, ivs, mocks] = await Promise.all([
        getTrackedApp(id!),
        listEmailDrafts(id!).catch(() => ({ drafts: [] })),
        listInterviews(id!).catch(() => ({ interviews: [] })),
        listMockSessions(id!).catch(() => ({ sessions: [] })),
      ]);
      setApp(data.app);
      setTailoredCv(data.tailoredCv);
      setCoverLetter(data.coverLetter);
      setTimeline(data.timeline);
      setReminders(data.reminders);
      setNotes(data.app.notes ?? "");
      setEmailDrafts(drafts.drafts.filter((d: EmailDraft) => d.status !== "archived"));
      setInterviews(ivs.interviews);
      setMockSessions(mocks.sessions);
    } catch {
      toast({ variant: "destructive", title: "Failed to load application" });
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function handleStageChange(stage: ApplicationStage) {
    if (!app) return;
    setChangingStage(true);
    try {
      await updateStage(app.id, stage);
      setApp((prev) => prev ? { ...prev, stage, updatedAt: new Date().toISOString() } : prev);
      toast({ title: `Stage: ${STAGE_LABELS[stage]}` });
      load();
    } catch {
      toast({ variant: "destructive", title: "Failed to update stage" });
    } finally {
      setChangingStage(false);
    }
  }

  async function handleSaveNotes() {
    if (!app) return;
    setSavingNotes(true);
    try {
      await updateNotes(app.id, notes);
      setNotesDirty(false);
      toast({ title: "Notes saved" });
    } catch {
      toast({ variant: "destructive", title: "Failed to save notes" });
    } finally {
      setSavingNotes(false);
    }
  }

  async function handleAddReminder() {
    if (!app || !reminderDate) return;
    setAddingReminder(true);
    try {
      const { reminder } = await createReminder(app.id, {
        reminderType,
        reminderAt: new Date(reminderDate).toISOString(),
        reminderNote: reminderNote || null,
      });
      setReminders((prev) => [...prev, reminder]);
      setReminderDate("");
      setReminderNote("");
      toast({ title: "Reminder set" });
    } catch {
      toast({ variant: "destructive", title: "Failed to add reminder" });
    } finally {
      setAddingReminder(false);
    }
  }

  async function handleCompleteReminder(reminderId: string) {
    try {
      await completeReminder(reminderId);
      setReminders((prev) => prev.filter((r) => r.id !== reminderId));
      toast({ title: "Reminder completed" });
    } catch {
      toast({ variant: "destructive", title: "Failed to complete reminder" });
    }
  }

  async function handleArchive() {
    if (!app) return;
    try {
      await updateAppStatus(app.id, "archived");
      toast({ title: "Application archived" });
      navigate("/tracker");
    } catch {
      toast({ variant: "destructive", title: "Failed to archive" });
    }
  }

  async function handleGenerateEmail() {
    if (!app) return;
    setGeneratingEmail(true);
    try {
      const result = await generateEmailDraft({
        applicationId: app.id,
        draftType: emailDraftType,
        tone: emailTone,
        extraContext: emailExtraContext || undefined,
      });
      setEmailDrafts(prev => [result.draft, ...prev]);
      setShowEmailForm(false);
      setEmailExtraContext("");
      setExpandedDraft(result.draft.id);
      toast({ title: "Email draft generated" });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Failed to generate email", description: e.message });
    } finally {
      setGeneratingEmail(false);
    }
  }

  async function handleCopyDraft(draft: EmailDraft) {
    try {
      await navigator.clipboard.writeText(`Subject: ${draft.subject}\n\n${draft.bodyText}`);
      setCopiedDraft(draft.id);
      setTimeout(() => setCopiedDraft(null), 3000);
      if (draft.status === "draft") {
        const updated = await updateDraftStatus(draft.id, "copied");
        setEmailDrafts(prev => prev.map(d => d.id === draft.id ? updated.draft : d));
      }
    } catch {
      toast({ variant: "destructive", title: "Failed to copy" });
    }
  }

  async function handleScheduleInterview() {
    if (!app || !interviewDate || !interviewTitle) return;
    setSchedulingInterview(true);
    try {
      const result = await createInterview({
        applicationId: app.id,
        interviewType,
        title: interviewTitle,
        scheduledAt: new Date(interviewDate).toISOString(),
        location: interviewLocation || undefined,
        meetingUrl: interviewMeetingUrl || undefined,
        notes: interviewNotes || undefined,
      });
      setInterviews(prev => [...prev, result.interview]);
      setShowInterviewForm(false);
      setInterviewTitle("");
      setInterviewDate("");
      setInterviewLocation("");
      setInterviewMeetingUrl("");
      setInterviewNotes("");
      toast({ title: "Interview scheduled" });
      load();
    } catch (e: any) {
      toast({ variant: "destructive", title: "Failed to schedule interview", description: e.message });
    } finally {
      setSchedulingInterview(false);
    }
  }

  async function handleMarkInterviewComplete(iv: ApplicationInterview) {
    try {
      const updated = await updateInterview(iv.id, { status: "completed" });
      setInterviews(prev => prev.map(i => i.id === iv.id ? updated.interview : i));
      toast({ title: "Interview marked complete" });
      load();
    } catch {
      toast({ variant: "destructive", title: "Failed to update interview" });
    }
  }

  async function handleCreateMockSession() {
    if (!app) return;
    setCreatingMockSession(true);
    try {
      const result = await createMockSession({
        applicationId: app.id,
        sessionType: mockSessionType,
        questionCount: mockQuestionCount,
      });
      setShowMockForm(false);
      setMockSessions(prev => [result.session, ...prev]);
      toast({ title: "Mock session created — opening…" });
      navigate(`/mock-interview/${result.session.id}`);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Failed to create session", description: e.message });
    } finally {
      setCreatingMockSession(false);
    }
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!app) {
    return (
      <AppLayout>
        <div className="max-w-3xl mx-auto px-4 py-8 text-center">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-3" />
          <h2 className="text-lg font-semibold">Application not found</h2>
          <Link href="/tracker">
            <Button className="mt-4" variant="outline">Back to pipeline</Button>
          </Link>
        </div>
      </AppLayout>
    );
  }

  const allStages: ApplicationStage[] = [...PIPELINE_STAGES, ...TERMINAL_STAGES];

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div>
          <Link href="/tracker">
            <button className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3 transition-colors">
              <ArrowLeft className="w-4 h-4" />
              Back to pipeline
            </button>
          </Link>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold">{app.applicationTitle}</h1>
              <div className="flex items-center gap-3 mt-1.5 text-sm text-muted-foreground flex-wrap">
                {app.company && (
                  <span className="flex items-center gap-1">
                    <Building2 className="w-3.5 h-3.5" />
                    {app.company}
                  </span>
                )}
                {app.location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" />
                    {app.location}
                  </span>
                )}
                {app.appliedAt && (
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    Applied {new Date(app.appliedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge className={cn("text-sm px-3 py-1", STAGE_COLORS[app.stage])}>
                {STAGE_LABELS[app.stage]}
              </Badge>
              {app.applyUrl && (
                <a href={app.applyUrl} target="_blank" rel="noopener noreferrer">
                  <Button size="sm" variant="outline">
                    <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                    Apply
                  </Button>
                </a>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Main column */}
          <div className="lg:col-span-2 space-y-5">
            {/* Stage control */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Stage</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {allStages.map((s) => (
                    <button
                      key={s}
                      disabled={changingStage}
                      onClick={() => handleStageChange(s)}
                      className={cn(
                        "text-xs px-3 py-1.5 rounded-full border font-medium transition-all",
                        s === app.stage
                          ? STAGE_COLORS[s] + " ring-2 ring-offset-1 ring-current"
                          : "border-border text-muted-foreground hover:bg-accent",
                      )}
                    >
                      {STAGE_LABELS[s]}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Linked assets */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Linked Assets</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {tailoredCv ? (
                  <Link href={`/application/tailored-cvs/${tailoredCv.id}`}>
                    <div className="flex items-center gap-2 p-2.5 rounded-lg border border-blue-200 bg-blue-50 hover:bg-blue-100 transition-colors cursor-pointer">
                      <FileText className="w-4 h-4 text-blue-600" />
                      <span className="text-sm font-medium text-blue-700">
                        {tailoredCv.versionName ?? "Tailored CV"}
                      </span>
                      <ChevronRight className="w-4 h-4 text-blue-400 ml-auto" />
                    </div>
                  </Link>
                ) : (
                  <div className="flex items-center gap-2 p-2.5 rounded-lg border border-dashed border-border text-muted-foreground text-sm">
                    <FileText className="w-4 h-4" />
                    No tailored CV linked
                    <Link href="/application/tailored-cvs" className="ml-auto text-xs text-primary hover:underline">
                      Create one
                    </Link>
                  </div>
                )}
                {coverLetter ? (
                  <Link href={`/application/cover-letters`}>
                    <div className="flex items-center gap-2 p-2.5 rounded-lg border border-purple-200 bg-purple-50 hover:bg-purple-100 transition-colors cursor-pointer">
                      <MailOpen className="w-4 h-4 text-purple-600" />
                      <span className="text-sm font-medium text-purple-700">
                        {coverLetter.jobTitle ?? "Cover Letter"} · {coverLetter.tone}
                      </span>
                      <ChevronRight className="w-4 h-4 text-purple-400 ml-auto" />
                    </div>
                  </Link>
                ) : (
                  <div className="flex items-center gap-2 p-2.5 rounded-lg border border-dashed border-border text-muted-foreground text-sm">
                    <MailOpen className="w-4 h-4" />
                    No cover letter linked
                    <Link href="/application/cover-letters" className="ml-auto text-xs text-primary hover:underline">
                      Create one
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Interview Prep */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  Interview Prep
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Link href={`/tracker/interview-prep/generate?appId=${app.id}`}>
                  <Button variant="outline" className="w-full text-sm">
                    <Sparkles className="w-3.5 h-3.5 mr-2" />
                    Generate Interview Prep
                  </Button>
                </Link>
                <p className="text-xs text-muted-foreground mt-2 text-center">
                  Costs 1 credit · AI-grounded in your CV and this role
                </p>
              </CardContent>
            </Card>

            {/* Email Drafts */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Mail className="w-4 h-4 text-primary" />
                    Email Drafts
                    {emailDrafts.length > 0 && (
                      <span className="text-xs bg-primary/10 text-primary rounded-full px-1.5 py-0.5">{emailDrafts.length}</span>
                    )}
                  </CardTitle>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs gap-1 text-primary"
                    onClick={() => setShowEmailForm(f => !f)}
                  >
                    {showEmailForm ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                    {showEmailForm ? "Cancel" : "Generate"}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {showEmailForm && (
                  <div className="space-y-2 bg-muted/50 rounded-lg p-3 border border-border">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Email type</label>
                        <select
                          value={emailDraftType}
                          onChange={e => setEmailDraftType(e.target.value as DraftType)}
                          className="w-full h-8 text-xs rounded-md border border-input bg-background px-2 focus:outline-none focus:ring-1 focus:ring-ring"
                        >
                          {(Object.keys(DRAFT_TYPE_LABELS) as DraftType[]).map(t => (
                            <option key={t} value={t}>{DRAFT_TYPE_LABELS[t]}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Tone</label>
                        <select
                          value={emailTone}
                          onChange={e => setEmailTone(e.target.value as EmailTone)}
                          className="w-full h-8 text-xs rounded-md border border-input bg-background px-2 focus:outline-none focus:ring-1 focus:ring-ring"
                        >
                          <option value="professional">Professional</option>
                          <option value="warm">Warm</option>
                          <option value="confident">Confident</option>
                          <option value="concise">Concise</option>
                        </select>
                      </div>
                    </div>
                    <Textarea
                      placeholder="Extra context (optional) — e.g. I spoke to the hiring manager at a conference last week"
                      value={emailExtraContext}
                      onChange={e => setEmailExtraContext(e.target.value)}
                      className="text-xs min-h-[60px] resize-none"
                    />
                    <p className="text-xs text-muted-foreground">{DRAFT_TYPE_DESCRIPTIONS[emailDraftType]}</p>
                    <Button
                      size="sm"
                      className="w-full text-xs h-8 gap-1.5"
                      onClick={handleGenerateEmail}
                      disabled={generatingEmail}
                    >
                      {generatingEmail ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                      Generate (1 credit)
                    </Button>
                  </div>
                )}

                {emailDrafts.length === 0 && !showEmailForm && (
                  <p className="text-xs text-muted-foreground text-center py-2">No email drafts yet — generate one to get started</p>
                )}

                {emailDrafts.map(draft => (
                  <div key={draft.id} className="border border-border rounded-lg overflow-hidden">
                    <button
                      className="w-full flex items-center justify-between p-2.5 hover:bg-muted/50 transition-colors"
                      onClick={() => setExpandedDraft(d => d === draft.id ? null : draft.id)}
                    >
                      <div className="flex items-center gap-2 text-left min-w-0">
                        <span className="text-xs font-medium truncate">{DRAFT_TYPE_LABELS[draft.draftType]}</span>
                        <span className="text-[11px] text-muted-foreground capitalize shrink-0">· {draft.tone}</span>
                        {draft.status === "copied" && (
                          <span className="text-[11px] bg-green-50 text-green-600 rounded px-1.5 shrink-0">copied</span>
                        )}
                        {draft.status === "sent" && (
                          <span className="text-[11px] bg-blue-50 text-blue-600 rounded px-1.5 shrink-0">sent</span>
                        )}
                      </div>
                      {expandedDraft === draft.id ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
                    </button>
                    {expandedDraft === draft.id && (
                      <div className="p-3 pt-0 border-t border-border/50 space-y-2">
                        <p className="text-xs font-medium text-muted-foreground">Subject: <span className="text-foreground">{draft.subject}</span></p>
                        <pre className="text-xs text-foreground whitespace-pre-wrap font-sans leading-relaxed max-h-48 overflow-y-auto">{draft.bodyText}</pre>
                        <div className="flex gap-2 pt-1">
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs h-7 gap-1.5"
                            onClick={() => handleCopyDraft(draft)}
                          >
                            {copiedDraft === draft.id ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                            {copiedDraft === draft.id ? "Copied!" : "Copy"}
                          </Button>
                          {draft.status === "draft" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-xs h-7 gap-1.5"
                              onClick={async () => {
                                const updated = await updateDraftStatus(draft.id, "archived");
                                setEmailDrafts(prev => prev.filter(d => d.id !== updated.draft.id));
                                toast({ title: "Draft archived" });
                              }}
                            >
                              Archive
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Interviews */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-primary" />
                    Interviews
                    {interviews.length > 0 && (
                      <span className="text-xs bg-primary/10 text-primary rounded-full px-1.5 py-0.5">{interviews.length}</span>
                    )}
                  </CardTitle>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs gap-1 text-primary"
                    onClick={() => setShowInterviewForm(f => !f)}
                  >
                    {showInterviewForm ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                    {showInterviewForm ? "Cancel" : "Schedule"}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {showInterviewForm && (
                  <div className="space-y-2 bg-muted/50 rounded-lg p-3 border border-border">
                    <Input
                      placeholder="Interview title *"
                      value={interviewTitle}
                      onChange={e => setInterviewTitle(e.target.value)}
                      className="h-8 text-xs"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Type</label>
                        <select
                          value={interviewType}
                          onChange={e => setInterviewType(e.target.value as InterviewType)}
                          className="w-full h-8 text-xs rounded-md border border-input bg-background px-2 focus:outline-none focus:ring-1 focus:ring-ring"
                        >
                          {(Object.keys(INTERVIEW_TYPE_LABELS) as InterviewType[]).map(t => (
                            <option key={t} value={t}>{INTERVIEW_TYPE_LABELS[t]}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Date & time *</label>
                        <Input
                          type="datetime-local"
                          value={interviewDate}
                          onChange={e => setInterviewDate(e.target.value)}
                          className="h-8 text-xs"
                        />
                      </div>
                    </div>
                    <Input
                      placeholder="Location (optional)"
                      value={interviewLocation}
                      onChange={e => setInterviewLocation(e.target.value)}
                      className="h-8 text-xs"
                    />
                    <Input
                      placeholder="Meeting URL (optional)"
                      value={interviewMeetingUrl}
                      onChange={e => setInterviewMeetingUrl(e.target.value)}
                      className="h-8 text-xs"
                    />
                    <Textarea
                      placeholder="Notes (optional)"
                      value={interviewNotes}
                      onChange={e => setInterviewNotes(e.target.value)}
                      className="text-xs min-h-[50px] resize-none"
                    />
                    <Button
                      size="sm"
                      className="w-full text-xs h-8 gap-1.5"
                      onClick={handleScheduleInterview}
                      disabled={schedulingInterview || !interviewTitle || !interviewDate}
                    >
                      {schedulingInterview ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Calendar className="w-3.5 h-3.5" />}
                      Schedule Interview
                    </Button>
                  </div>
                )}

                {interviews.length === 0 && !showInterviewForm && (
                  <p className="text-xs text-muted-foreground text-center py-2">No interviews scheduled</p>
                )}

                {interviews.map(iv => (
                  <div key={iv.id} className="flex items-start gap-2 p-2.5 rounded-lg border border-border">
                    <div className={cn("w-2 h-2 rounded-full mt-1.5 shrink-0", iv.status === "completed" ? "bg-green-500" : iv.status === "cancelled" ? "bg-red-400" : "bg-orange-400")} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium">{iv.title}</p>
                      <p className="text-[11px] text-muted-foreground capitalize">{INTERVIEW_TYPE_LABELS[iv.interviewType]}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {new Date(iv.scheduledAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </p>
                      {iv.location && <p className="text-[11px] text-muted-foreground">{iv.location}</p>}
                      {iv.meetingUrl && (
                        <a href={iv.meetingUrl} target="_blank" rel="noopener noreferrer" className="text-[11px] text-primary hover:underline block truncate">{iv.meetingUrl}</a>
                      )}
                    </div>
                    {iv.status === "scheduled" && (
                      <button
                        onClick={() => handleMarkInterviewComplete(iv)}
                        className="text-green-600 hover:text-green-700 shrink-0"
                        title="Mark complete"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Mock Interviews */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Mic className="w-4 h-4 text-primary" />
                    Mock Interviews
                    {mockSessions.length > 0 && (
                      <span className="text-xs bg-primary/10 text-primary rounded-full px-1.5 py-0.5">{mockSessions.length}</span>
                    )}
                  </CardTitle>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs gap-1 text-primary"
                    onClick={() => setShowMockForm(f => !f)}
                  >
                    {showMockForm ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                    {showMockForm ? "Cancel" : "New session"}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {showMockForm && (
                  <div className="space-y-2 bg-muted/50 rounded-lg p-3 border border-border">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Session type</label>
                        <select
                          value={mockSessionType}
                          onChange={e => setMockSessionType(e.target.value as SessionType)}
                          className="w-full h-8 text-xs rounded-md border border-input bg-background px-2 focus:outline-none focus:ring-1 focus:ring-ring"
                        >
                          {(Object.keys(SESSION_TYPE_LABELS) as SessionType[]).map(t => (
                            <option key={t} value={t}>{SESSION_TYPE_LABELS[t]}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Questions</label>
                        <select
                          value={mockQuestionCount}
                          onChange={e => setMockQuestionCount(Number(e.target.value) as 5 | 8 | 10)}
                          className="w-full h-8 text-xs rounded-md border border-input bg-background px-2 focus:outline-none focus:ring-1 focus:ring-ring"
                        >
                          <option value={5}>5 questions</option>
                          <option value={8}>8 questions</option>
                          <option value={10}>10 questions</option>
                        </select>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      className="w-full text-xs h-8 gap-1.5"
                      onClick={handleCreateMockSession}
                      disabled={creatingMockSession}
                    >
                      {creatingMockSession ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                      Start Mock Interview (1 credit)
                    </Button>
                  </div>
                )}

                {mockSessions.length === 0 && !showMockForm && (
                  <p className="text-xs text-muted-foreground text-center py-2">No mock sessions yet</p>
                )}

                {mockSessions.map(s => (
                  <Link key={s.id} href={`/mock-interview/${s.id}`}>
                    <div className="flex items-center gap-2 p-2.5 rounded-lg border border-border hover:bg-muted/50 transition-colors cursor-pointer">
                      <div className={cn("w-2 h-2 rounded-full shrink-0", s.status === "completed" ? "bg-green-500" : "bg-blue-400")} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium">{s.sessionTitle ?? SESSION_TYPE_LABELS[s.sessionType]}</p>
                        <p className="text-[11px] text-muted-foreground capitalize">{s.status} · {s.questionCount} questions{s.overallScore ? ` · ${s.overallScore}/10` : ""}</p>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    </div>
                  </Link>
                ))}

                {mockSessions.length > 0 && (
                  <Link href="/mock-interview">
                    <p className="text-xs text-primary hover:underline text-center pt-1">View all sessions</p>
                  </Link>
                )}
              </CardContent>
            </Card>

            {/* Notes */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={notes}
                  onChange={(e) => { setNotes(e.target.value); setNotesDirty(true); }}
                  placeholder="Add notes about this application, company research, contact names…"
                  rows={5}
                  className="text-sm resize-none"
                />
                {notesDirty && (
                  <Button
                    size="sm"
                    className="mt-2"
                    onClick={handleSaveNotes}
                    disabled={savingNotes}
                  >
                    {savingNotes ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1.5" />}
                    Save notes
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Timeline */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Timeline</CardTitle>
              </CardHeader>
              <CardContent>
                {timeline.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No events yet</p>
                ) : (
                  <div className="space-y-3">
                    {timeline.map((event) => (
                      <div key={event.id} className="flex gap-3">
                        <div className="flex-shrink-0 w-7 h-7 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                          {EVENT_ICONS[event.eventType] ?? <Clock className="w-3.5 h-3.5" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{event.title}</p>
                          {event.description && (
                            <p className="text-xs text-muted-foreground mt-0.5">{event.description}</p>
                          )}
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            {new Date(event.eventAt).toLocaleDateString("en-GB", {
                              day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
                            })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Side column */}
          <div className="space-y-5">
            {/* Reminders */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Bell className="w-4 h-4 text-primary" />
                  Reminders
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {reminders.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-2">No upcoming reminders</p>
                ) : (
                  <div className="space-y-2">
                    {reminders.map((r) => (
                      <div key={r.id} className="flex items-start gap-2 p-2 rounded-lg bg-muted/50">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium">{REMINDER_LABELS[r.reminderType]}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {new Date(r.reminderAt).toLocaleDateString("en-GB", {
                              day: "numeric", month: "short", year: "numeric",
                            })}
                          </p>
                          {r.reminderNote && (
                            <p className="text-[11px] text-muted-foreground mt-0.5">{r.reminderNote}</p>
                          )}
                        </div>
                        <button
                          onClick={() => handleCompleteReminder(r.id)}
                          className="text-green-600 hover:text-green-700 shrink-0"
                          title="Mark done"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add reminder form */}
                <div className="pt-2 border-t border-border space-y-2">
                  <p className="text-xs font-medium">Add reminder</p>
                  <select
                    value={reminderType}
                    onChange={(e) => setReminderType(e.target.value as typeof reminderType)}
                    className="w-full h-8 text-xs rounded-md border border-input bg-transparent px-2 focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="follow_up">Follow-up</option>
                    <option value="interview">Interview</option>
                    <option value="deadline">Deadline</option>
                    <option value="personal_note">Personal note</option>
                  </select>
                  <Input
                    type="datetime-local"
                    value={reminderDate}
                    onChange={(e) => setReminderDate(e.target.value)}
                    className="h-8 text-xs"
                  />
                  <Input
                    placeholder="Optional note…"
                    value={reminderNote}
                    onChange={(e) => setReminderNote(e.target.value)}
                    className="h-8 text-xs"
                  />
                  <Button
                    size="sm"
                    className="w-full text-xs h-8"
                    onClick={handleAddReminder}
                    disabled={!reminderDate || addingReminder}
                  >
                    {addingReminder ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                    Set Reminder
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Quick actions */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {app.stage !== "applied" && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full text-xs h-8 justify-start"
                    onClick={() => handleStageChange("applied")}
                    disabled={changingStage}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 mr-2 text-purple-500" />
                    Mark as Applied
                  </Button>
                )}
                {app.stage !== "interview" && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full text-xs h-8 justify-start"
                    onClick={() => handleStageChange("interview")}
                    disabled={changingStage}
                  >
                    <Briefcase className="w-3.5 h-3.5 mr-2 text-orange-500" />
                    Move to Interview
                  </Button>
                )}
                {app.stage !== "rejected" && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full text-xs h-8 justify-start text-red-600 hover:text-red-700"
                    onClick={() => handleStageChange("rejected")}
                    disabled={changingStage}
                  >
                    <AlertCircle className="w-3.5 h-3.5 mr-2" />
                    Mark Rejected
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="w-full text-xs h-8 justify-start text-muted-foreground"
                  onClick={handleArchive}
                >
                  <Archive className="w-3.5 h-3.5 mr-2" />
                  Archive Application
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
