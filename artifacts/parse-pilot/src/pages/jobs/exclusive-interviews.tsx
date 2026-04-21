import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { authedFetch } from "@/lib/authed-fetch";
import { useToast } from "@/hooks/use-toast";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Video, Building2, CheckCircle, X, ChevronRight, Calendar } from "lucide-react";
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
  notes: string | null;
  status: string;
  candidateResponseNote: string | null;
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

export default function ExclusiveInterviews() {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const { data, isLoading, refetch } = useQuery<{ invites: Invite[] }>({
    queryKey: ["candidate-invites"],
    queryFn: async () => {
      const res = await authedFetch(`${BASE}/internal-job-interviews/candidate`);
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Failed");
      return d;
    },
  });

  const invites = data?.invites ?? [];
  const upcoming = invites.filter((i) => !["declined", "cancelled", "completed"].includes(i.status));
  const past = invites.filter((i) => ["declined", "cancelled", "completed"].includes(i.status));

  async function respond(id: string, status: "accepted" | "declined" | "reschedule_requested") {
    try {
      const res = await authedFetch(`${BASE}/internal-job-interviews/${id}/respond`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Failed");
      refetch();
      toast({ title: `Interview ${status.replace("_", " ")}` });
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
            Interview Invites
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Interview invites from recruiters for your exclusive job applications.
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
            <p className="text-sm">No interview invites yet</p>
            <p className="text-xs opacity-70">Apply to exclusive jobs and recruiters can invite you to interview here.</p>
          </div>
        )}

        {upcoming.length > 0 && (
          <div className="mb-8">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Upcoming</p>
            <div className="space-y-3">
              {upcoming.map((invite) => (
                <InviteCard key={invite.id} invite={invite} onRespond={respond} onNavigate={navigate} />
              ))}
            </div>
          </div>
        )}

        {past.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Past</p>
            <div className="space-y-3">
              {past.map((invite) => (
                <InviteCard key={invite.id} invite={invite} onRespond={respond} onNavigate={navigate} />
              ))}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

function InviteCard({
  invite,
  onRespond,
  onNavigate,
}: {
  invite: Invite;
  onRespond: (id: string, status: "accepted" | "declined" | "reschedule_requested") => void;
  onNavigate: (path: string) => void;
}) {
  const isPending = invite.status === "pending";

  return (
    <Card className={cn(isPending && "border-indigo-200 bg-indigo-50/20")}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm">{invite.inviteTitle}</p>
            <p className="text-xs text-muted-foreground capitalize">{TYPE_LABELS[invite.interviewType] ?? invite.interviewType}</p>
            {invite.jobTitle && (
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                <Building2 className="w-3 h-3" /> {invite.jobCompany ?? ""} — {invite.jobTitle}
              </p>
            )}
          </div>
          <Badge variant="outline" className={cn("text-xs capitalize shrink-0", STATUS_COLORS[invite.status])}>
            {invite.status.replace("_", " ")}
          </Badge>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
          <Calendar className="w-3.5 h-3.5" />
          <span>
            {new Date(invite.scheduledAt).toLocaleString("en-GB", {
              weekday: "short", day: "numeric", month: "short",
              hour: "2-digit", minute: "2-digit",
            })}
            {invite.timezone ? ` (${invite.timezone})` : ""}
          </span>
        </div>

        {invite.location && <p className="text-xs text-muted-foreground">{invite.location}</p>}
        {invite.meetingUrl && (
          <a href={invite.meetingUrl} target="_blank" rel="noopener noreferrer"
            className="text-xs text-purple-600 hover:underline">Join meeting link</a>
        )}
        {invite.notes && <p className="text-xs text-muted-foreground mt-1 italic">{invite.notes}</p>}

        <div className="flex items-center gap-2 mt-3">
          {isPending && (
            <>
              <Button size="sm" variant="outline" className="text-xs h-7 text-green-700 border-green-200 hover:bg-green-50"
                onClick={() => onRespond(invite.id, "accepted")}>
                <CheckCircle className="w-3 h-3 mr-1" /> Accept
              </Button>
              <Button size="sm" variant="outline" className="text-xs h-7 text-red-700 border-red-200 hover:bg-red-50"
                onClick={() => onRespond(invite.id, "declined")}>
                <X className="w-3 h-3 mr-1" /> Decline
              </Button>
              <Button size="sm" variant="outline" className="text-xs h-7"
                onClick={() => onRespond(invite.id, "reschedule_requested")}>
                Reschedule
              </Button>
            </>
          )}
          <Button size="sm" variant="ghost" className="text-xs h-7 ml-auto"
            onClick={() => onNavigate(`/jobs/exclusive/application/${invite.applicationId}`)}>
            Application <ChevronRight className="w-3 h-3 ml-1" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
