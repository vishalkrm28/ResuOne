import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { getCandidates, updateCandidateStatus } from "@/lib/recruiter-api";
import { Loader2, Users, BarChart3, ArrowLeft } from "lucide-react";
import { StatusBadge } from "./status-badge";
import { useToast } from "@/hooks/use-toast";

type Status = "new" | "invited" | "accepted" | "rejected";

const COLUMNS: { key: Status; label: string; color: string; bg: string }[] = [
  { key: "new", label: "New", color: "text-yellow-600 dark:text-yellow-400", bg: "bg-yellow-50 dark:bg-yellow-900/10 border-yellow-200 dark:border-yellow-800" },
  { key: "invited", label: "Invited", color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800" },
  { key: "accepted", label: "Accepted", color: "text-green-600 dark:text-green-400", bg: "bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800" },
  { key: "rejected", label: "Rejected", color: "text-red-600 dark:text-red-400", bg: "bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800" },
];

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
          <button onClick={() => navigate("/recruiter/dashboard")} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" /> Dashboard
          </button>
          <span className="font-semibold text-foreground text-sm flex items-center gap-1.5 ml-2">
            <BarChart3 className="w-4 h-4 text-primary" /> Pipeline
          </span>
          <span className="ml-auto text-xs text-muted-foreground">{candidates.length} total candidates</span>
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
                {/* Column header */}
                <div className={`flex items-center justify-between px-4 py-2.5 rounded-xl border mb-3 ${col.bg}`}>
                  <span className={`text-sm font-bold ${col.color}`}>{col.label}</span>
                  <span className={`text-xs font-semibold ${col.color} opacity-70`}>{grouped[col.key].length}</span>
                </div>

                {/* Cards */}
                <div className="space-y-3">
                  {grouped[col.key].length === 0 ? (
                    <div className="border border-dashed border-border/40 rounded-xl p-4 text-center">
                      <p className="text-xs text-muted-foreground">No candidates</p>
                    </div>
                  ) : (
                    grouped[col.key].map(c => (
                      <div key={c.id} className="bg-background border border-border/40 rounded-xl p-4 hover:border-primary/30 hover:shadow-sm transition-all cursor-pointer group"
                        onClick={() => navigate(`/candidate/${c.id}`)}>
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="min-w-0">
                            <p className="font-semibold text-foreground text-sm truncate group-hover:text-primary transition-colors">{c.name}</p>
                            <p className="text-xs text-muted-foreground truncate">{c.email}</p>
                          </div>
                          {c.score != null && (
                            <span className="text-xs font-bold text-primary shrink-0">{Math.round(c.score)}%</span>
                          )}
                        </div>

                        {c.jobTitle && (
                          <p className="text-xs text-muted-foreground/70 mb-2">{c.jobTitle}{c.company ? ` · ${c.company}` : ""}</p>
                        )}

                        {/* Skills pills */}
                        {(c.skills ?? []).length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-3">
                            {(c.skills as string[]).slice(0, 2).map(s => (
                              <span key={s} className="text-xs bg-muted/40 text-muted-foreground px-2 py-0.5 rounded-full">{s}</span>
                            ))}
                            {c.skills.length > 2 && <span className="text-xs text-muted-foreground/60">+{c.skills.length - 2}</span>}
                          </div>
                        )}

                        {/* Move to column buttons */}
                        <div className="flex gap-1 flex-wrap" onClick={e => e.stopPropagation()}>
                          {COLUMNS.filter(col2 => col2.key !== col.key).map(col2 => (
                            <button key={col2.key}
                              onClick={() => statusMutation.mutate({ id: c.id, status: col2.key })}
                              disabled={statusMutation.isPending}
                              className="text-xs text-muted-foreground hover:text-foreground border border-border/30 rounded-md px-2 py-0.5 hover:bg-muted/30 transition-colors">
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
