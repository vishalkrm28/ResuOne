import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { authedFetch } from "@/lib/authed-fetch";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, MessageSquare, Star, ChevronRight, User } from "lucide-react";

const BASE = import.meta.env.VITE_API_URL ?? "/api";

interface Thread {
  applicationId: string;
  jobId: string;
  jobTitle: string | null;
  jobCompany: string | null;
  lastMessage: { bodyText: string; senderType: string; createdAt: string; recipientUserId: string; isRead: boolean };
  unread: number;
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const hrs = Math.floor(diff / 3600000);
  if (hrs < 1) return "Just now";
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(dateStr).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export default function RecruiterExclusiveMessages() {
  const [, navigate] = useLocation();

  const { data, isLoading } = useQuery<{ threads: Thread[] }>({
    queryKey: ["recruiter-internal-inbox"],
    queryFn: async () => {
      const res = await authedFetch(`${BASE}/internal-job-inbox`);
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Failed");
      return d;
    },
  });

  const threads = data?.threads ?? [];

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <MessageSquare className="w-6 h-6 text-purple-600" />
            Candidate Messages
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            All conversations with candidates about your exclusive job postings.
          </p>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {!isLoading && threads.length === 0 && (
          <div className="text-center py-20 text-muted-foreground space-y-3">
            <MessageSquare className="w-12 h-12 mx-auto opacity-20" />
            <p className="text-sm">No conversations yet</p>
            <p className="text-xs opacity-70">Messages from candidates on your job postings will appear here.</p>
          </div>
        )}

        <div className="space-y-3">
          {threads.map((thread) => (
            <Card
              key={thread.applicationId}
              className={`cursor-pointer hover:shadow-md transition-all ${thread.unread > 0 ? "border-purple-300 bg-purple-50/20" : ""}`}
              onClick={() => navigate(`/recruiter/exclusive-jobs/${thread.jobId}/application/${thread.applicationId}`)}
            >
              <CardContent className="p-4 flex items-start gap-3">
                <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                  <User className="w-4 h-4 text-gray-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="font-semibold text-sm truncate">{thread.jobTitle ?? "Application"}</p>
                    {thread.unread > 0 && (
                      <Badge className="bg-purple-600 text-white text-xs h-5 min-w-5 flex items-center justify-center rounded-full">
                        {thread.unread}
                      </Badge>
                    )}
                  </div>
                  {thread.jobCompany && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
                      <Star className="w-3 h-3 text-purple-500" /> {thread.jobCompany}
                    </p>
                  )}
                  <p className="text-xs text-foreground/70 line-clamp-1">
                    {thread.lastMessage.senderType === "candidate" ? "Candidate: " : "You: "}
                    {thread.lastMessage.bodyText}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-muted-foreground">{timeAgo(thread.lastMessage.createdAt)}</p>
                  <ChevronRight className="w-4 h-4 text-muted-foreground mt-2 ml-auto" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
