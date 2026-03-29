import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { authedFetch } from "@/lib/authed-fetch";
import { AppLayout } from "@/components/layout/app-layout";
import {
  Users,
  ArrowLeft,
  Loader2,
  Trophy,
  Medal,
  ChevronRight,
  Building2,
  Calendar,
  Target,
  TrendingUp,
  TrendingDown,
  Crown,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface SessionApplication {
  id: string;
  keywordMatchScore: number | null;
  parsedCvJson: {
    name?: string | null;
    email?: string | null;
    location?: string | null;
  } | null;
  matchedKeywords: string[];
  missingKeywords: string[];
  status: string;
  createdAt: string;
}

interface BulkSessionDetail {
  session: {
    id: string;
    jobTitle: string;
    company: string;
    createdAt: string;
  };
  applications: SessionApplication[];
}

function scoreColor(score: number) {
  if (score >= 75) return "text-emerald-600";
  if (score >= 50) return "text-amber-500";
  return "text-red-500";
}

function scoreBg(score: number) {
  if (score >= 75) return "bg-emerald-500/10";
  if (score >= 50) return "bg-amber-500/10";
  return "bg-red-500/10";
}

function scoreLabel(score: number) {
  if (score >= 75) return "Strong match";
  if (score >= 50) return "Moderate match";
  return "Weak match";
}

function candidateName(app: SessionApplication, rank: number): string {
  if (app.parsedCvJson?.name) return app.parsedCvJson.name;
  return `Candidate #${rank}`;
}

function TopCandidateCard({
  app,
  rank,
  onClick,
}: {
  app: SessionApplication;
  rank: number;
  onClick: () => void;
}) {
  const score = Math.round(app.keywordMatchScore ?? 0);
  const name = candidateName(app, rank);

  const rankIcon =
    rank === 1 ? <Crown className="w-4 h-4 text-amber-500" /> :
    rank === 2 ? <Trophy className="w-3.5 h-3.5 text-slate-400" /> :
    rank === 3 ? <Medal className="w-3.5 h-3.5 text-amber-700" /> :
    <span className="text-xs font-bold text-muted-foreground">#{rank}</span>;

  return (
    <button
      onClick={onClick}
      className={cn(
        "flex-1 min-w-0 rounded-2xl border p-4 text-left hover:border-primary/40 hover:bg-primary/[0.02] transition-colors group",
        rank === 1
          ? "border-amber-200 bg-amber-50/50 dark:bg-amber-500/5 dark:border-amber-500/20"
          : "border-border bg-card"
      )}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">{rankIcon}</div>
        <div className={cn("w-10 h-10 rounded-full flex flex-col items-center justify-center flex-shrink-0", scoreBg(score))}>
          <span className={cn("text-sm font-extrabold leading-none", scoreColor(score))}>{score}</span>
          <span className={cn("text-[8px] font-semibold uppercase tracking-wide", scoreColor(score))}>%</span>
        </div>
      </div>
      <p className="font-semibold text-sm truncate">{name}</p>
      {app.parsedCvJson?.location && (
        <p className="text-xs text-muted-foreground truncate mt-0.5">{app.parsedCvJson.location}</p>
      )}
      <p className={cn("text-xs font-medium mt-2", scoreColor(score))}>{scoreLabel(score)}</p>
    </button>
  );
}

export default function BulkSessionDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const [data, setData] = useState<BulkSessionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    authedFetch(`/bulk-sessions/${id}`)
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => setError("Failed to load session"))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-32">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  if (error || !data) {
    return (
      <AppLayout>
        <div className="text-center py-32 text-muted-foreground">{error ?? "Session not found"}</div>
      </AppLayout>
    );
  }

  const { session, applications } = data;
  const top5 = applications.slice(0, 5);
  const rest = applications.slice(5);
  const topScore = applications[0]?.keywordMatchScore ?? null;
  const avgScore =
    applications.length > 0
      ? applications.reduce((s, a) => s + (a.keywordMatchScore ?? 0), 0) / applications.length
      : null;

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto">
        {/* Back + header */}
        <button
          onClick={() => navigate("/bulk/history")}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          All sessions
        </button>

        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Users className="w-4 h-4 text-primary" />
            </div>
            <span className="text-sm font-semibold text-primary uppercase tracking-wider">Bulk Session</span>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight">{session.jobTitle}</h1>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5" />
              {session.company}
            </span>
            <span className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              {format(new Date(session.createdAt), "d MMM yyyy, HH:mm")}
            </span>
            <span className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" />
              {applications.length} candidate{applications.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          <div className="rounded-2xl border border-border bg-card p-4 text-center">
            <p className="text-2xl font-extrabold text-foreground">{applications.length}</p>
            <p className="text-xs text-muted-foreground mt-0.5">CVs screened</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-4 text-center">
            <p className={cn("text-2xl font-extrabold", topScore !== null ? scoreColor(Math.round(topScore)) : "text-muted-foreground")}>
              {topScore !== null ? `${Math.round(topScore)}%` : "—"}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">Top score</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-4 text-center">
            <p className={cn("text-2xl font-extrabold", avgScore !== null ? scoreColor(Math.round(avgScore)) : "text-muted-foreground")}>
              {avgScore !== null ? `${Math.round(avgScore)}%` : "—"}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">Avg score</p>
          </div>
        </div>

        {/* Top 5 hero section */}
        {top5.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-3">
              <Trophy className="w-4 h-4 text-amber-500" />
              <h2 className="font-bold text-base">Top candidates</h2>
            </div>
            <div className="flex gap-3 flex-wrap">
              {top5.map((app, i) => (
                <TopCandidateCard
                  key={app.id}
                  app={app}
                  rank={i + 1}
                  onClick={() => navigate(`/applications/${app.id}`)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Full ranked list */}
        <div>
          <h2 className="font-bold text-base mb-3">All candidates — ranked by score</h2>
          <div className="space-y-2">
            {applications.map((app, i) => {
              const score = Math.round(app.keywordMatchScore ?? 0);
              const name = candidateName(app, i + 1);
              const matched = app.matchedKeywords?.length ?? 0;
              const missing = app.missingKeywords?.length ?? 0;
              return (
                <button
                  key={app.id}
                  onClick={() => navigate(`/applications/${app.id}`)}
                  className="w-full text-left rounded-xl border border-border bg-card px-4 py-3 hover:border-primary/30 hover:bg-primary/[0.02] transition-colors group flex items-center gap-4"
                >
                  <span className="text-sm font-bold text-muted-foreground w-7 flex-shrink-0 text-right">
                    #{i + 1}
                  </span>
                  <div className={cn("w-12 h-12 rounded-full flex flex-col items-center justify-center flex-shrink-0", scoreBg(score))}>
                    <span className={cn("text-base font-extrabold leading-none", scoreColor(score))}>{score}</span>
                    <span className={cn("text-[9px] font-semibold uppercase tracking-wide", scoreColor(score))}>%</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{name}</p>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                      {app.parsedCvJson?.location && (
                        <span className="truncate max-w-[120px]">{app.parsedCvJson.location}</span>
                      )}
                      <span className="flex items-center gap-1 text-emerald-600">
                        <TrendingUp className="w-3 h-3" />
                        {matched} matched
                      </span>
                      <span className="flex items-center gap-1 text-red-500">
                        <TrendingDown className="w-3 h-3" />
                        {missing} missing
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={cn("text-xs font-semibold hidden sm:block", scoreColor(score))}>
                      {scoreLabel(score)}
                    </span>
                    <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
