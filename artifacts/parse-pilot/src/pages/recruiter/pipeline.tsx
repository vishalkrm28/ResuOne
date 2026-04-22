import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { getCandidates, updateCandidateStatus } from "@/lib/recruiter-api";
import { Loader2, Users, ArrowLeft, User, Check, X, Mail, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

type Status = "new" | "invited" | "accepted" | "rejected";

const COLUMNS: {
  key: Status;
  label: string;
  headerBg: string;
  headerText: string;
  dotColor: string;
}[] = [
  {
    key: "new",
    label: "New",
    headerBg: "bg-yellow-50 dark:bg-yellow-900/10 border-yellow-200 dark:border-yellow-800",
    headerText: "text-yellow-700 dark:text-yellow-400",
    dotColor: "bg-yellow-400",
  },
  {
    key: "invited",
    label: "Invited",
    headerBg: "bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800",
    headerText: "text-blue-700 dark:text-blue-400",
    dotColor: "bg-blue-500",
  },
  {
    key: "accepted",
    label: "Accepted",
    headerBg: "bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800",
    headerText: "text-green-700 dark:text-green-400",
    dotColor: "bg-green-500",
  },
  {
    key: "rejected",
    label: "Rejected",
    headerBg: "bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800",
    headerText: "text-red-600 dark:text-red-400",
    dotColor: "bg-red-400",
  },
];

const STATUS_BADGE: Record<string, string> = {
  new:      "bg-yellow-50 text-yellow-700 border-yellow-200",
  invited:  "bg-blue-50 text-blue-700 border-blue-200",
  accepted: "bg-green-50 text-green-800 border-green-200",
  rejected: "bg-red-50 text-red-700 border-red-200",
};

function ScoreBadge({ score }: { score: number | null }) {
  if (score == null) return null;
  const color =
    score >= 80 ? "bg-green-50 text-green-700 border-green-300" :
    score >= 60 ? "bg-yellow-50 text-yellow-700 border-yellow-300" :
                  "bg-red-50 text-red-600 border-red-200";
  return (
    <span className={cn("text-xs font-bold px-2 py-0.5 rounded-full border shrink-0", color)}>
      {Math.round(score)}%
    </span>
  );
}

export default function RecruiterPipeline() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({ queryKey: ["candidates"], queryFn: getCandidates });
  const candidates: any[] = data?.candidates ?? [];

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => updateCandidateStatus(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["candidates"] }),
    onError: () => toast({ title: "Update failed", variant: "destructive" }),
  });

  const grouped: Record<Status, any[]> = { new: [], invited: [], accepted: [], rejected: [] };
  candidates.forEach(c => { grouped[c.status as Status]?.push(c); });

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/40 bg-background/95 backdrop-blur sticky top-0 z-30">
        <div className="max-w-[1400px] mx-auto px-6 h-14 flex items-center gap-4">
          <button
            onClick={() => navigate("/recruiter/dashboard")}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Dashboard
          </button>
          <span className="text-border/60">|</span>
          <span className="font-semibold text-foreground text-sm flex items-center gap-1.5">
            <Users className="w-4 h-4 text-primary" /> Board View
          </span>
          <span className="ml-auto text-xs text-muted-foreground">{candidates.length} candidate{candidates.length !== 1 ? "s" : ""}</span>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-6 py-8">
        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {COLUMNS.map(col => (
              <div key={col.key}>
                {/* Column header — matches exclusive status pill style */}
                <div className={cn(
                  "flex items-center justify-between px-4 py-2.5 rounded-xl border mb-3",
                  col.headerBg,
                )}>
                  <div className="flex items-center gap-2">
                    <span className={cn("w-2 h-2 rounded-full", col.dotColor)} />
                    <span className={cn("text-sm font-bold", col.headerText)}>{col.label}</span>
                  </div>
                  <span className={cn("text-xs font-semibold opacity-70", col.headerText)}>
                    {grouped[col.key].length}
                  </span>
                </div>

                {/* Cards */}
                <div className="space-y-3">
                  {grouped[col.key].length === 0 ? (
                    <div className="border border-dashed border-border/40 rounded-xl p-6 text-center">
                      <p className="text-xs text-muted-foreground">No candidates</p>
                    </div>
                  ) : (
                    grouped[col.key].map(c => (
                      <div
                        key={c.id}
                        className="bg-background border border-border/40 rounded-xl p-4 hover:shadow-md hover:border-primary/20 transition-all cursor-pointer group"
                        onClick={() => navigate(`/candidate/${c.id}`)}
                      >
                        {/* Header row */}
                        <div className="flex items-start gap-2.5 mb-2">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                            <User className="w-3.5 h-3.5 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <p className="font-semibold text-foreground text-sm truncate group-hover:text-primary transition-colors">
                                {c.name}
                              </p>
                              <ScoreBadge score={c.score} />
                            </div>
                            <p className="text-xs text-muted-foreground truncate">{c.email}</p>
                          </div>
                        </div>

                        {c.jobTitle && (
                          <p className="text-xs text-muted-foreground/70 mb-2">
                            {c.jobTitle}{c.company ? ` · ${c.company}` : ""}
                          </p>
                        )}

                        {/* Skills */}
                        {(c.skills ?? []).length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-3">
                            {(c.skills as string[]).slice(0, 2).map((s: string) => (
                              <span key={s} className="text-xs bg-muted/40 text-muted-foreground px-2 py-0.5 rounded-full">{s}</span>
                            ))}
                            {c.skills.length > 2 && (
                              <span className="text-xs text-muted-foreground/60">+{c.skills.length - 2}</span>
                            )}
                          </div>
                        )}

                        {/* Move actions */}
                        <div
                          className="flex gap-1 flex-wrap pt-1 border-t border-border/20 mt-1"
                          onClick={e => e.stopPropagation()}
                        >
                          {COLUMNS.filter(col2 => col2.key !== col.key).map(col2 => (
                            <button
                              key={col2.key}
                              onClick={() => statusMutation.mutate({ id: c.id, status: col2.key })}
                              disabled={statusMutation.isPending}
                              className={cn(
                                "text-xs border rounded-lg px-2 py-0.5 transition-colors",
                                col2.key === "rejected"
                                  ? "text-red-600 border-red-200 hover:bg-red-50"
                                  : col2.key === "accepted"
                                  ? "text-green-700 border-green-200 hover:bg-green-50"
                                  : "text-muted-foreground border-border/40 hover:bg-muted/30 hover:text-foreground",
                              )}
                            >
                              → {col2.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
