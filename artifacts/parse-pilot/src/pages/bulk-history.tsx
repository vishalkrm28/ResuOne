import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { authedFetch } from "@/lib/authed-fetch";
import { AppLayout } from "@/components/layout/app-layout";
import {
  Users,
  ChevronRight,
  Loader2,
  Building2,
  Calendar,
  BarChart2,
  Plus,
  Trophy,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface BulkStatus {
  isPro?: boolean;
  activePass?: { remaining: number } | null;
}

interface BulkSessionSummary {
  id: string;
  jobTitle: string;
  company: string;
  createdAt: string;
  cvCount: number;
  topScore: number | null;
  avgScore: number | null;
}

function ScorePill({ score, label }: { score: number | null; label: string }) {
  if (score === null) return <span className="text-xs text-muted-foreground">—</span>;
  const rounded = Math.round(score);
  const color =
    rounded >= 75 ? "text-emerald-600 bg-emerald-500/10" :
    rounded >= 50 ? "text-amber-600 bg-amber-500/10" :
    "text-red-600 bg-red-500/10";
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full", color)}>
      {rounded}% <span className="font-normal opacity-70">{label}</span>
    </span>
  );
}

export default function BulkHistory() {
  const [, navigate] = useLocation();
  const [sessions, setSessions] = useState<BulkSessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    authedFetch("/api/billing/bulk-status")
      .then((r) => (r.ok ? r.json() : null))
      .then((status: BulkStatus | null) => {
        const hasAccess =
          status?.isPro || (status?.activePass && status.activePass.remaining > 0);
        if (!hasAccess) {
          navigate("/bulk");
          return;
        }
        return authedFetch("/bulk-sessions")
          .then((r) => r.json())
          .then((data) => setSessions(data))
          .catch(() => setError("Failed to load bulk sessions"));
      })
      .catch(() => navigate("/bulk"))
      .finally(() => setLoading(false));
  }, [navigate]);

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Users className="w-4 h-4 text-primary" />
            </div>
            <span className="text-sm font-semibold text-primary uppercase tracking-wider">Bulk Mode</span>
          </div>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight mb-1">Batch analysis history</h1>
              <p className="text-sm text-muted-foreground">
                All your previous bulk screening sessions — click one to see the full ranked results.
              </p>
            </div>
            <Link href="/bulk/session">
              <button className="flex-shrink-0 inline-flex items-center gap-2 text-sm font-semibold bg-primary text-primary-foreground px-4 py-2 rounded-xl hover:opacity-90 transition-opacity">
                <Plus className="w-4 h-4" />
                New batch
              </button>
            </Link>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="text-center py-24 text-muted-foreground">{error}</div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-24 space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mx-auto">
              <Users className="w-7 h-7 text-muted-foreground" />
            </div>
            <div>
              <p className="font-semibold text-foreground">No sessions yet</p>
              <p className="text-sm text-muted-foreground mt-1">Run your first batch analysis to see results here.</p>
            </div>
            <Link href="/bulk/session">
              <button className="inline-flex items-center gap-2 text-sm font-semibold bg-primary text-primary-foreground px-5 py-2.5 rounded-xl hover:opacity-90 transition-opacity mt-2">
                <Plus className="w-4 h-4" />
                Start a batch
              </button>
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {sessions.map((session) => (
              <button
                key={session.id}
                onClick={() => navigate(`/bulk/sessions/${session.id}`)}
                className="w-full text-left rounded-2xl border border-border bg-card p-5 hover:border-primary/30 hover:bg-primary/[0.02] transition-colors group"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <h3 className="font-semibold text-base truncate">{session.jobTitle}</h3>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Building2 className="w-3.5 h-3.5" />
                        {session.company}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {format(new Date(session.createdAt), "d MMM yyyy, HH:mm")}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5" />
                        {session.cvCount} CV{session.cvCount !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="hidden sm:flex flex-col items-end gap-1">
                      <div className="flex items-center gap-1.5">
                        <Trophy className="w-3.5 h-3.5 text-amber-500" />
                        <ScorePill score={session.topScore} label="top" />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <BarChart2 className="w-3.5 h-3.5 text-muted-foreground" />
                        <ScorePill score={session.avgScore} label="avg" />
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
