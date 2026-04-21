import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { authedFetch } from "@/lib/authed-fetch";
import { useToast } from "@/hooks/use-toast";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Loader2, ArrowLeft, Users, User, MapPin, Building2, Check, X, ChevronRight,
  MessageSquare, Star, AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

const BASE = import.meta.env.VITE_API_URL ?? "/api";

interface Application {
  id: string;
  applicantUserId: string;
  applicantName: string | null;
  applicantEmail: string | null;
  status: string;
  stage: string;
  coverLetter: string | null;
  recruiterNotes: string | null;
  appliedAt: string;
  updatedAt: string;
}

const STATUS_COLORS: Record<string, string> = {
  applied: "bg-blue-50 text-blue-700 border-blue-200",
  shortlisted: "bg-purple-50 text-purple-700 border-purple-200",
  interview: "bg-indigo-50 text-indigo-700 border-indigo-200",
  offer: "bg-green-50 text-green-800 border-green-200",
  hired: "bg-green-100 text-green-900 border-green-300",
  rejected: "bg-red-50 text-red-700 border-red-200",
  withdrawn: "bg-gray-100 text-gray-500 border-gray-200",
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default function RecruiterExclusiveJobApplicants() {
  const [, params] = useRoute("/recruiter/exclusive-jobs/:jobId");
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const jobId = params?.jobId ?? "";

  const { data, isLoading } = useQuery<{ applications: Application[]; jobTitle: string }>({
    queryKey: ["exclusive-job-applicants", jobId],
    queryFn: async () => {
      const res = await authedFetch(`${BASE}/internal-jobs/${jobId}/applications`);
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Failed");
      return d;
    },
    enabled: !!jobId,
  });

  const updateStatus = useMutation({
    mutationFn: async ({ appId, status }: { appId: string; status: string }) => {
      const res = await authedFetch(`${BASE}/internal-jobs/${jobId}/applications/${appId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Failed");
      return d;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["exclusive-job-applicants", jobId] }),
    onError: (err: any) => toast({ variant: "destructive", title: err.message }),
  });

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  const apps = data?.applications ?? [];
  const jobTitle = data?.jobTitle ?? "Job";

  // Group by status for a quick summary
  const summary: Record<string, number> = {};
  for (const app of apps) {
    summary[app.status] = (summary[app.status] ?? 0) + 1;
  }

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Button variant="ghost" size="sm" onClick={() => navigate("/recruiter/exclusive-jobs")} className="mb-6 text-muted-foreground">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Jobs
        </Button>

        <div className="flex items-start justify-between flex-wrap gap-4 mb-6">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Users className="w-5 h-5 text-purple-600" /> Applicants
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">{jobTitle}</p>
          </div>
          <p className="text-sm text-muted-foreground">
            {apps.length} applicant{apps.length !== 1 ? "s" : ""}
          </p>
        </div>

        {/* Quick summary */}
        {apps.length > 0 && (
          <div className="flex gap-2 flex-wrap mb-6">
            {Object.entries(summary).map(([status, count]) => (
              <div key={status} className={cn("flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium", STATUS_COLORS[status])}>
                <span className="capitalize">{status}</span>
                <span className="font-bold">{count}</span>
              </div>
            ))}
          </div>
        )}

        {apps.length === 0 && (
          <div className="text-center py-20 text-muted-foreground space-y-3">
            <Users className="w-12 h-12 mx-auto opacity-20 text-purple-400" />
            <p className="text-sm">No applicants yet</p>
            <p className="text-xs opacity-70">Applications will appear here as candidates apply.</p>
          </div>
        )}

        <div className="space-y-3">
          {apps.map((app) => (
            <Card key={app.id} className="hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => navigate(`/recruiter/exclusive-jobs/${jobId}/application/${app.id}`)}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-full bg-purple-100 flex items-center justify-center shrink-0">
                    <User className="w-4 h-4 text-purple-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <p className="font-semibold text-sm">{app.applicantName ?? "Anonymous"}</p>
                      <Badge variant="outline" className={cn("text-xs capitalize", STATUS_COLORS[app.status])}>
                        {app.status}
                      </Badge>
                    </div>
                    {app.applicantEmail && (
                      <p className="text-xs text-muted-foreground">{app.applicantEmail}</p>
                    )}
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                      <span className="capitalize">Stage: {app.stage.replace("_", " ")}</span>
                      <span>Applied {timeAgo(app.appliedAt)}</span>
                    </div>
                    {app.coverLetter && (
                      <p className="text-xs text-foreground/60 mt-1 line-clamp-1 italic">
                        "{app.coverLetter.slice(0, 100)}{app.coverLetter.length > 100 ? "..." : ""}"
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {app.status === "applied" && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs h-7 text-purple-700 border-purple-200 hover:bg-purple-50"
                          onClick={(e) => { e.stopPropagation(); updateStatus.mutate({ appId: app.id, status: "shortlisted" }); }}
                          disabled={updateStatus.isPending}
                        >
                          <Check className="w-3 h-3 mr-1" /> Shortlist
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs h-7 text-red-700 border-red-200 hover:bg-red-50"
                          onClick={(e) => { e.stopPropagation(); updateStatus.mutate({ appId: app.id, status: "rejected" }); }}
                          disabled={updateStatus.isPending}
                        >
                          <X className="w-3 h-3 mr-1" /> Reject
                        </Button>
                      </>
                    )}
                    <ChevronRight className="w-4 h-4 text-muted-foreground ml-1" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
