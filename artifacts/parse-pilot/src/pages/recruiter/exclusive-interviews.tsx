import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { authedFetch } from "@/lib/authed-fetch";
import { useToast } from "@/hooks/use-toast";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Video, Building2, Calendar, ChevronRight, CheckCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";

const BASE = import.meta.env.VITE_API_URL ?? "/api";

interface Invite {
  id: string;
  applicationId: string;
  jobId: string;
  inviteTitle: string;
  interviewType: string;
  scheduledAt: string;
  timezone: string | null;
  location: string | null;
  meetingUrl: string | null;
  status: string;
  candidateResponseNote: string | null;
  candidateUserId: string;
  createdAt: string;
  jobTitle: string | null;
  jobCompany: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-50 text-yellow-700 border-yellow-200",
  accepted: "bg-green-50 text-green-700 border-green-200",
  declined: "bg-red-50 text-red-700 border-red-200",
  reschedule_requested: "bg-orange-50 text-orange-700 border-orange-200",
  cancelled: "bg-gray-100 text-gray-600 border-gray-200",
  completed: "bg-blue-50 text-blue-700 border-blue-200",
};

const TYPE_LABELS: Record<string, string> = {
  recruiter_screen: "Recruiter Screen",
  hiring_manager: "Hiring Manager",
  technical: "Technical",
  case_study: "Case Study",
  final_round: "Final Round",
  general: "Interview",
};

export default function RecruiterExclusiveInterviews() {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const { data, isLoading, refetch } = useQuery<{ invites: Invite[] }>({
    queryKey: ["recruiter-all-invites"],
    queryFn: async () => {
      const res = await authedFetch(`${BASE}/internal-job-interviews/recruiter`);
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Failed");
      return d;
    },
  });

  const invites = data?.invites ?? [];
  const upcoming = invites.filter((i) => !["cancelled", "completed"].includes(i.status));
  const past = invites.filter((i) => ["cancelled", "completed"].includes(i.status));

  async function markStatus(id: string, status: "completed" | "cancelled") {
    try {
      const res = await authedFetch(`${BASE}/internal-job-interviews/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Failed");
      refetch();
      toast({ title: `Interview marked as ${status}` });
    } catch (err: any) {
      toast({ variant: "destructive", title: err.message });
    }
  }

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Video className="w-6 h-6 text-purple-600" />
            Interview Schedule
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            All interview invites sent to candidates.
          </p>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {!isLoading && invites.length === 0 && (
          <div className="text-center py-20 text-muted-foreground space-y-3">
            <Video className="w-12 h-12 mx-auto opacity-20 text-purple-400" />
            <p className="text-sm">No interview invites sent yet</p>
            <p className="text-xs opacity-70">Open an applicant's profile to schedule an interview.</p>
          </div>
        )}

        {upcoming.length > 0 && (
          <div className="mb-8">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Upcoming</p>
            <div className="space-y-3">
              {upcoming.map((invite) => (
                <Card key={invite.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <p className="font-semibold text-sm">{invite.inviteTitle}</p>
                        <p className="text-xs text-muted-foreground capitalize">{TYPE_LABELS[invite.interviewType] ?? invite.interviewType}</p>
                        {invite.jobTitle && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <Building2 className="w-3 h-3" /> {invite.jobCompany} — {invite.jobTitle}
                          </p>
                        )}
                      </div>
                      <Badge variant="outline" className={cn("text-xs capitalize shrink-0", STATUS_COLORS[invite.status])}>
                        {invite.status.replace("_", " ")}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                      <Calendar className="w-3.5 h-3.5" />
                      {new Date(invite.scheduledAt).toLocaleString("en-GB", {
                        weekday: "short", day: "numeric", month: "short",
                        hour: "2-digit", minute: "2-digit",
                      })}
                      {invite.timezone ? ` (${invite.timezone})` : ""}
                    </div>
                    {invite.candidateResponseNote && (
                      <p className="text-xs text-muted-foreground italic mb-2">
                        Candidate note: {invite.candidateResponseNote}
                      </p>
                    )}
                    <div className="flex gap-2">
                      {!["completed", "cancelled"].includes(invite.status) && (
                        <>
                          <Button size="sm" variant="outline" className="text-xs h-7 text-green-700 border-green-200"
                            onClick={() => markStatus(invite.id, "completed")}>
                            <CheckCircle className="w-3 h-3 mr-1" /> Mark Complete
                          </Button>
                          <Button size="sm" variant="outline" className="text-xs h-7 text-red-700 border-red-200"
                            onClick={() => markStatus(invite.id, "cancelled")}>
                            <X className="w-3 h-3 mr-1" /> Cancel
                          </Button>
                        </>
                      )}
                      <Button size="sm" variant="ghost" className="text-xs h-7 ml-auto"
                        onClick={() => navigate(`/recruiter/exclusive-jobs/${invite.jobId}/application/${invite.applicationId}`)}>
                        Application <ChevronRight className="w-3 h-3 ml-1" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {past.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Past</p>
            <div className="space-y-3 opacity-70">
              {past.map((invite) => (
                <Card key={invite.id}>
                  <CardContent className="p-4 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">{invite.inviteTitle}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(invite.scheduledAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                        {invite.jobTitle ? ` — ${invite.jobTitle}` : ""}
                      </p>
                    </div>
                    <Badge variant="outline" className={cn("text-xs capitalize", STATUS_COLORS[invite.status])}>
                      {invite.status}
                    </Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
