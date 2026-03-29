import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@workspace/replit-auth-web";
import { useListApplications, useDeleteApplication, getListApplicationsQueryKey } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent } from "@/components/Card";
import { Button } from "@/components/Button";
import { Badge } from "@/components/Badge";
import { Link } from "wouter";
import {
  Plus,
  FileText,
  ArrowRight,
  Loader2,
  Sparkles,
  Trash2,
  Building2,
  Calendar,
  TrendingUp,
  AlertTriangle,
  Lock,
  User,
  LayersIcon,
  Users,
} from "lucide-react";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useBillingStatus } from "@/hooks/use-billing-status";
import { CreditsBadge } from "@/components/billing/credits-badge";
import { authedFetch } from "@/lib/authed-fetch";

interface BulkSession {
  id: string;
  jobTitle: string;
  company: string;
  createdAt: string;
  cvCount: number;
  topScore: number | null;
  avgScore: number | null;
}

const statusConfig = {
  draft: { label: "Draft", className: "bg-muted text-muted-foreground border-muted-foreground/20" },
  analyzed: { label: "Analyzed", className: "bg-primary/10 text-primary border-primary/20" },
  exported: { label: "Exported", className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
} as const;

function ScorePill({ score }: { score: number }) {
  return (
    <span
      className={cn(
        "flex items-center gap-1.5 font-medium",
        score >= 80 ? "text-emerald-600" : score >= 60 ? "text-amber-500" : "text-destructive",
      )}
    >
      <TrendingUp className="w-3.5 h-3.5" />
      {Math.round(score)}% match
    </span>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { status: billingStatus } = useBillingStatus();
  const isPro = billingStatus?.isPro ?? false;

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmDeleteBulkId, setConfirmDeleteBulkId] = useState<string | null>(null);
  const [deletingBulkId, setDeletingBulkId] = useState<string | null>(null);
  const [bulkSessions, setBulkSessions] = useState<BulkSession[]>([]);
  const [bulkLoading, setBulkLoading] = useState(false);

  const { data: applications, isLoading: appsLoading } = useListApplications(
    { userId: user?.id ?? "" },
    { query: { enabled: !!user?.id } },
  );

  const fetchBulkSessions = () => {
    if (!user?.id) return;
    setBulkLoading(true);
    authedFetch("/api/bulk-sessions")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: BulkSession[]) => setBulkSessions(Array.isArray(data) ? data : []))
      .catch(() => setBulkSessions([]))
      .finally(() => setBulkLoading(false));
  };

  useEffect(() => { fetchBulkSessions(); }, [user?.id]);

  const handleBulkDeleteClick = (e: React.MouseEvent, sessionId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (confirmDeleteBulkId === sessionId) {
      setDeletingBulkId(sessionId);
      authedFetch(`/api/bulk-sessions/${sessionId}`, { method: "DELETE" })
        .then((r) => {
          if (r.ok) {
            toast({ title: "Batch deleted" });
            fetchBulkSessions();
          } else {
            toast({ title: "Failed to delete batch", variant: "destructive" });
          }
        })
        .catch(() => toast({ title: "Failed to delete batch", variant: "destructive" }))
        .finally(() => {
          setDeletingBulkId(null);
          setConfirmDeleteBulkId(null);
        });
    } else {
      setConfirmDeleteBulkId(sessionId);
      setTimeout(() => setConfirmDeleteBulkId((cur) => (cur === sessionId ? null : cur)), 4000);
    }
  };

  const deleteMutation = useDeleteApplication({
    mutation: {
      onSuccess: () => {
        toast({ title: "Application deleted" });
        setConfirmDeleteId(null);
        queryClient.invalidateQueries({
          queryKey: getListApplicationsQueryKey({ userId: user?.id ?? "" }),
        });
      },
      onError: () => {
        toast({ title: "Failed to delete", variant: "destructive" });
        setConfirmDeleteId(null);
      },
    },
  });

  // Only show standalone (non-bulk) applications in the main list.
  // Bulk-linked applications are visible inside the bulk session detail page.
  const standaloneApps = (applications ?? []).filter((a) => !(a as any).bulkSessionId);

  const analyzed = standaloneApps.filter((a) => a.status !== "draft").length;
  const allScores = standaloneApps
    .filter((a) => a.keywordMatchScore != null)
    .map((a) => a.keywordMatchScore as number);
  const avgScore =
    allScores.length > 0 ? Math.round(allScores.reduce((s, v) => s + v, 0) / allScores.length) : null;

  const handleDeleteClick = (e: React.MouseEvent, appId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (confirmDeleteId === appId) {
      deleteMutation.mutate({ id: appId });
    } else {
      setConfirmDeleteId(appId);
      setTimeout(() => setConfirmDeleteId((cur) => (cur === appId ? null : cur)), 4000);
    }
  };

  const isLoading = appsLoading || bulkLoading;

  // Unified feed: merge standalone apps + bulk sessions, newest first
  type FeedItem =
    | { kind: "app"; data: (typeof standaloneApps)[0]; sortDate: Date }
    | { kind: "bulk"; data: BulkSession; sortDate: Date };

  const feed: FeedItem[] = [
    ...standaloneApps.map((a) => ({
      kind: "app" as const,
      data: a,
      sortDate: new Date(a.createdAt),
    })),
    ...bulkSessions.map((s) => ({
      kind: "bulk" as const,
      data: s,
      sortDate: new Date(s.createdAt),
    })),
  ].sort((a, b) => b.sortDate.getTime() - a.sortDate.getTime());

  const totalItems = standaloneApps.length + bulkSessions.length;

  return (
    <AppLayout>
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Applications</h1>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-muted-foreground">Your CV history, newest first.</p>
            <CreditsBadge />
          </div>
        </div>
        {!isPro && applications && applications.length >= 1 ? (
          <Link href="/settings">
            <Button size="lg" className="gap-2 flex-shrink-0 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white border-0 shadow-md">
              <Sparkles className="w-4 h-4" />
              Upgrade for More
            </Button>
          </Link>
        ) : (
          <Link href="/new">
            <Button size="lg" className="gap-2 flex-shrink-0">
              <Plus className="w-4 h-4" />
              New Application
            </Button>
          </Link>
        )}
      </div>

      {/* Free-tier upgrade banner */}
      {!isPro && applications && applications.length >= 1 && (
        <div className="flex items-center gap-3 rounded-xl border border-violet-200 bg-gradient-to-r from-violet-50 to-indigo-50 px-4 py-3 mb-6 text-sm">
          <Lock className="w-4 h-4 text-violet-500 flex-shrink-0" />
          <span className="text-violet-800">
            <span className="font-semibold">Free plan:</span> 1 application included.{" "}
            <Link href="/settings" className="underline underline-offset-2 font-semibold hover:text-violet-900">
              Upgrade to Pro
            </Link>{" "}
            for unlimited applications, exports, and cover letters.
          </span>
        </div>
      )}

      {/* Stats */}
      {(standaloneApps.length > 0 || bulkSessions.length > 0) && !isLoading && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
          <div className="bg-card border border-card-border rounded-xl p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1 font-medium">Total</p>
            <p className="text-2xl font-bold">{totalItems}</p>
          </div>
          <div className="bg-card border border-card-border rounded-xl p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1 font-medium">Analyzed</p>
            <p className="text-2xl font-bold text-primary">{analyzed + bulkSessions.length}</p>
          </div>
          {avgScore !== null && (
            <div className="bg-card border border-card-border rounded-xl p-4 col-span-2 sm:col-span-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1 font-medium">Avg Match</p>
              <div className="flex items-baseline gap-1">
                <p
                  className={cn(
                    "text-2xl font-bold",
                    avgScore >= 80 ? "text-emerald-600" : avgScore >= 60 ? "text-amber-500" : "text-destructive",
                  )}
                >
                  {avgScore}
                </p>
                <p className="text-sm text-muted-foreground">%</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Feed */}
      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="w-8 h-8 animate-spin text-primary/50" />
        </div>
      ) : feed.length === 0 ? (
        <div className="border-2 border-dashed border-border rounded-2xl p-16 text-center">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-5">
            <FileText className="w-7 h-7 text-primary" />
          </div>
          <h3 className="text-xl font-semibold mb-2">No applications yet</h3>
          <p className="text-muted-foreground mb-6 max-w-sm mx-auto text-sm">
            Create your first application by uploading your CV and pasting a job description.
          </p>
          <Link href="/new">
            <Button size="lg" className="gap-2">
              <Sparkles className="w-4 h-4" />
              Optimize a CV
            </Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence initial={false}>
            {feed.map((item, i) => (
              <motion.div
                key={item.kind === "app" ? `app-${item.data.id}` : `bulk-${item.data.id}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20, height: 0, marginBottom: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                {item.kind === "bulk" ? (
                  <BulkSessionCard
                    session={item.data}
                    confirmDeleteId={confirmDeleteBulkId}
                    isDeleting={deletingBulkId === item.data.id}
                    onDeleteClick={handleBulkDeleteClick}
                    onCancelDelete={() => setConfirmDeleteBulkId(null)}
                  />
                ) : (
                  <AppCard
                    app={item.data}
                    confirmDeleteId={confirmDeleteId}
                    isDeleting={deleteMutation.isPending && confirmDeleteId === item.data.id}
                    onDeleteClick={handleDeleteClick}
                    onCancelDelete={() => setConfirmDeleteId(null)}
                  />
                )}
              </motion.div>
            ))}
          </AnimatePresence>

          <p className="text-xs text-center text-muted-foreground/60 pt-2">
            {feed.length} item{feed.length !== 1 ? "s" : ""}
          </p>
        </div>
      )}
    </AppLayout>
  );
}

// ─── Bulk session card ─────────────────────────────────────────────────────────

interface BulkSessionCardProps {
  session: BulkSession;
  confirmDeleteId: string | null;
  isDeleting: boolean;
  onDeleteClick: (e: React.MouseEvent, id: string) => void;
  onCancelDelete: () => void;
}

function BulkSessionCard({ session, confirmDeleteId, isDeleting, onDeleteClick, onCancelDelete }: BulkSessionCardProps) {
  const avg = session.avgScore != null ? Math.round(Number(session.avgScore)) : null;
  const top = session.topScore != null ? Math.round(Number(session.topScore)) : null;
  const isConfirming = confirmDeleteId === session.id;

  return (
    <Card className={cn(
      "group transition-colors",
      isConfirming
        ? "border-destructive/40 bg-destructive/5"
        : "hover:border-indigo-300 border-indigo-100 bg-indigo-50/30",
    )}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <Link href={`/bulk/sessions/${session.id}`} className="flex-1 min-w-0">
            {/* Title row */}
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h3 className="font-semibold text-base truncate">{session.jobTitle}</h3>
              <Badge className="text-xs border bg-indigo-100 text-indigo-700 border-indigo-200 flex items-center gap-1">
                <LayersIcon className="w-3 h-3" />
                Batch Analysis
              </Badge>
            </div>

            {/* Meta row */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" />
                <span className="font-medium text-foreground/80">{session.cvCount} CV{session.cvCount !== 1 ? "s" : ""}</span>
              </span>
              <span className="flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5" />
                {session.company}
              </span>
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                {format(new Date(session.createdAt), "MMM d, yyyy")}
              </span>
              {top != null && <ScorePill score={top} />}
              {avg != null && top !== avg && (
                <span className="text-muted-foreground/70 text-xs">avg {avg}%</span>
              )}
            </div>
          </Link>

          <div className="flex items-center gap-2 flex-shrink-0">
            {isConfirming ? (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-destructive font-medium flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Delete batch?
                </span>
                <button
                  onClick={(e) => onDeleteClick(e, session.id)}
                  disabled={isDeleting}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors"
                >
                  {isDeleting ? <Loader2 className="w-3 h-3 animate-spin" /> : "Confirm"}
                </button>
                <button
                  onClick={(e) => { e.preventDefault(); onCancelDelete(); }}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={(e) => onDeleteClick(e, session.id)}
                className="p-2 rounded-lg text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100"
                title="Delete batch"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}

            <Link href={`/bulk/sessions/${session.id}`}>
              <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-indigo-600 bg-indigo-100 hover:bg-indigo-200 transition-colors">
                Open
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Individual application card ───────────────────────────────────────────────

interface AppCardProps {
  app: {
    id: string;
    jobTitle: string;
    company: string;
    status: string;
    createdAt: string;
    keywordMatchScore?: number | null;
    parsedCvJson?: unknown;
  };
  confirmDeleteId: string | null;
  isDeleting: boolean;
  onDeleteClick: (e: React.MouseEvent, id: string) => void;
  onCancelDelete: () => void;
}

function AppCard({ app, confirmDeleteId, isDeleting, onDeleteClick, onCancelDelete }: AppCardProps) {
  const status = statusConfig[app.status as keyof typeof statusConfig] ?? statusConfig.draft;
  const isConfirmingDelete = confirmDeleteId === app.id;

  return (
    <Card
      className={cn(
        "group transition-colors",
        isConfirmingDelete ? "border-destructive/40 bg-destructive/5" : "hover:border-primary/30",
      )}
    >
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h3 className="font-semibold text-base truncate">{app.jobTitle}</h3>
              <Badge className={`text-xs border ${status.className}`}>{status.label}</Badge>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              {(app.parsedCvJson as any)?.name && (
                <span className="flex items-center gap-1.5 font-medium text-foreground/80">
                  <User className="w-3.5 h-3.5" />
                  {(app.parsedCvJson as any).name}
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5" />
                {app.company}
              </span>
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                {format(new Date(app.createdAt), "MMM d, yyyy")}
              </span>
              {app.keywordMatchScore != null && <ScorePill score={app.keywordMatchScore} />}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {isConfirmingDelete ? (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-destructive font-medium flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Delete?
                </span>
                <button
                  onClick={(e) => onDeleteClick(e, app.id)}
                  disabled={isDeleting}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors"
                >
                  {isDeleting ? <Loader2 className="w-3 h-3 animate-spin" /> : "Confirm"}
                </button>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    onCancelDelete();
                  }}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={(e) => onDeleteClick(e, app.id)}
                className="p-2 rounded-lg text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100"
                title="Delete application"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}

            <Link href={`/applications/${app.id}`}>
              <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-primary bg-primary/10 hover:bg-primary/20 transition-colors">
                Open
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
