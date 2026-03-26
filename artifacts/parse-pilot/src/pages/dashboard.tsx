import { useState } from "react";
import { useAuth } from "@workspace/replit-auth-web";
import { useListApplications, useDeleteApplication } from "@workspace/api-client-react";
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
} from "lucide-react";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useBillingStatus } from "@/hooks/use-billing-status";

const statusConfig = {
  draft: { label: "Draft", className: "bg-muted text-muted-foreground border-muted-foreground/20" },
  analyzed: { label: "Analyzed", className: "bg-primary/10 text-primary border-primary/20" },
  exported: { label: "Exported", className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
} as const;

export default function Dashboard() {
  const { user } = useAuth();
  const { toast } = useToast();

  const { status: billingStatus } = useBillingStatus();
  const isPro = billingStatus?.isPro ?? false;

  // Two-step delete: first click → sets confirmDeleteId; second click → deletes
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const { data: applications, isLoading } = useListApplications(
    { userId: user?.id ?? "" },
    { query: { enabled: !!user?.id } },
  );

  const deleteMutation = useDeleteApplication({
    mutation: {
      onSuccess: () => {
        toast({ title: "Application deleted" });
        setConfirmDeleteId(null);
      },
      onError: () => {
        toast({ title: "Failed to delete", variant: "destructive" });
        setConfirmDeleteId(null);
      },
    },
  });

  const analyzed = applications?.filter((a) => a.status !== "draft").length ?? 0;
  const avgScore =
    applications && applications.length > 0
      ? Math.round(
          applications
            .filter((a) => a.keywordMatchScore != null)
            .reduce((sum, a) => sum + (a.keywordMatchScore ?? 0), 0) /
            Math.max(1, applications.filter((a) => a.keywordMatchScore != null).length),
        )
      : null;

  const handleDeleteClick = (e: React.MouseEvent, appId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (confirmDeleteId === appId) {
      deleteMutation.mutate({ id: appId });
    } else {
      setConfirmDeleteId(appId);
      // Auto-reset after 4 seconds if no second click
      setTimeout(() => setConfirmDeleteId((cur) => (cur === appId ? null : cur)), 4000);
    }
  };

  return (
    <AppLayout>
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Applications</h1>
          <p className="mt-1 text-muted-foreground">Your tailored CV history, newest first.</p>
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
      {applications && applications.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
          <div className="bg-card border border-card-border rounded-xl p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1 font-medium">Total</p>
            <p className="text-2xl font-bold">{applications.length}</p>
          </div>
          <div className="bg-card border border-card-border rounded-xl p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1 font-medium">Analyzed</p>
            <p className="text-2xl font-bold text-primary">{analyzed}</p>
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

      {/* Applications list */}
      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="w-8 h-8 animate-spin text-primary/50" />
        </div>
      ) : !applications || applications.length === 0 ? (
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
            {applications.map((app, i) => {
              const status = statusConfig[app.status as keyof typeof statusConfig] ?? statusConfig.draft;
              const isConfirmingDelete = confirmDeleteId === app.id;
              const isDeleting = deleteMutation.isPending && confirmDeleteId === app.id;

              return (
                <motion.div
                  key={app.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20, height: 0, marginBottom: 0 }}
                  transition={{ delay: i * 0.04 }}
                >
                  <Card
                    className={cn(
                      "group transition-colors",
                      isConfirmingDelete
                        ? "border-destructive/40 bg-destructive/5"
                        : "hover:border-primary/30",
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
                            <span className="flex items-center gap-1.5">
                              <Building2 className="w-3.5 h-3.5" />
                              {app.company}
                            </span>
                            <span className="flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5" />
                              {format(new Date(app.createdAt), "MMM d, yyyy")}
                            </span>
                            {app.keywordMatchScore != null && (
                              <span
                                className={cn(
                                  "flex items-center gap-1.5 font-medium",
                                  app.keywordMatchScore >= 80
                                    ? "text-emerald-600"
                                    : app.keywordMatchScore >= 60
                                      ? "text-amber-500"
                                      : "text-destructive",
                                )}
                              >
                                <TrendingUp className="w-3.5 h-3.5" />
                                {Math.round(app.keywordMatchScore)}% match
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          {/* Two-step delete confirmation */}
                          {isConfirmingDelete ? (
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs text-destructive font-medium flex items-center gap-1">
                                <AlertTriangle className="w-3.5 h-3.5" />
                                Delete?
                              </span>
                              <button
                                onClick={(e) => handleDeleteClick(e, app.id)}
                                disabled={isDeleting}
                                className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors"
                              >
                                {isDeleting ? <Loader2 className="w-3 h-3 animate-spin" /> : "Confirm"}
                              </button>
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  setConfirmDeleteId(null);
                                }}
                                className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:bg-muted transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={(e) => handleDeleteClick(e, app.id)}
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
                </motion.div>
              );
            })}
          </AnimatePresence>

          <p className="text-xs text-center text-muted-foreground/60 pt-2">
            {applications.length} application{applications.length !== 1 ? "s" : ""}
          </p>
        </div>
      )}
    </AppLayout>
  );
}
