import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import {
  getCandidates, getRecruiterAnalytics, updateCandidateStatus,
  deleteCandidate, sendInvite, bulkInvite, createCandidate, getRecruiterAccess
} from "@/lib/recruiter-api";
import {
  Loader2, Users, Mail, CheckCircle2, XCircle, Search,
  Trash2, LayoutGrid, BarChart3, Plus, Download, FileText,
  UserCog, User, ChevronRight, Star, BarChart2,
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { InviteModal } from "./invite-modal";
import { AddCandidateModal } from "./add-candidate-modal";
import { ImportFromAnalysesModal } from "./import-modal";
import { CsvImportModal } from "./csv-import-modal";
import { TeamTab } from "./team-tab";
import { cn } from "@/lib/utils";

// ─── Status colours (mirror exclusive-job-applicants) ─────────────────────────
const STATUS_COLORS: Record<string, string> = {
  new:      "bg-yellow-50 text-yellow-700 border-yellow-200",
  invited:  "bg-blue-50 text-blue-700 border-blue-200",
  accepted: "bg-green-50 text-green-800 border-green-200",
  rejected: "bg-red-50 text-red-700 border-red-200",
};

// ─── Score badge (mirror exclusive ScoreBadge) ────────────────────────────────
function ScoreBadge({ score }: { score: number | null }) {
  if (score == null) return null;
  const color =
    score >= 80 ? "bg-green-50 text-green-700 border-green-300" :
    score >= 60 ? "bg-yellow-50 text-yellow-700 border-yellow-300" :
                  "bg-red-50 text-red-600 border-red-200";
  return (
    <span className={cn("text-xs font-bold px-2 py-0.5 rounded-full border", color)}>
      {Math.round(score)}% match
    </span>
  );
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default function RecruiterDashboard() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [activeTab, setActiveTab] = useState<"pipeline" | "team">("pipeline");
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterScore, setFilterScore] = useState<string>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [inviteTarget, setInviteTarget] = useState<{ id: string; name: string; email: string } | null>(null);
  const [bulkInviteOpen, setBulkInviteOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [csvImportOpen, setCsvImportOpen] = useState(false);
  const [analysesImportOpen, setAnalysesImportOpen] = useState(false);

  const { data: accessData } = useQuery({ queryKey: ["recruiter-access"], queryFn: getRecruiterAccess });
  const hasAccess = accessData?.hasAccess ?? false;

  const { data: analytics } = useQuery({ queryKey: ["recruiter-analytics"], queryFn: getRecruiterAnalytics });
  const { data, isLoading } = useQuery({ queryKey: ["candidates"], queryFn: getCandidates });
  const candidates: any[] = data?.candidates ?? [];

  const filtered = useMemo(() => {
    return candidates.filter(c => {
      const matchSearch = !search || c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.email.toLowerCase().includes(search.toLowerCase()) ||
        (c.jobTitle ?? "").toLowerCase().includes(search.toLowerCase());
      const matchStatus = filterStatus === "all" || c.status === filterStatus;
      const matchScore = filterScore === "all" ||
        (filterScore === "70+" && (c.score ?? 0) >= 70) ||
        (filterScore === "50-70" && (c.score ?? 0) >= 50 && (c.score ?? 0) < 70) ||
        (filterScore === "lt50" && (c.score ?? 0) < 50);
      return matchSearch && matchStatus && matchScore;
    });
  }, [candidates, search, filterStatus, filterScore]);

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => updateCandidateStatus(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["candidates"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteCandidate(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["candidates"] });
      qc.invalidateQueries({ queryKey: ["recruiter-analytics"] });
    },
    onError: () => toast({ title: "Delete failed", variant: "destructive" }),
  });

  const toggleSelect = (id: string) => {
    setSelected(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  };
  const toggleAll = () => {
    setSelected(prev => prev.size === filtered.length ? new Set() : new Set(filtered.map(c => c.id)));
  };

  // Quick summary counts
  const summary: Record<string, number> = {};
  for (const c of candidates) { summary[c.status] = (summary[c.status] ?? 0) + 1; }

  const kpis = [
    { label: "Total Candidates", value: analytics?.total ?? 0, icon: Users, color: "text-foreground" },
    { label: "Invited", value: analytics?.invited ?? 0, icon: Mail, color: "text-blue-500" },
    { label: "Accepted", value: analytics?.accepted ?? 0, icon: CheckCircle2, color: "text-green-500" },
    { label: "Rejected", value: analytics?.rejected ?? 0, icon: XCircle, color: "text-red-500" },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <header className="border-b border-border/40 bg-background/95 backdrop-blur sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between gap-4">
          <Link href="/" className="font-bold text-foreground text-base shrink-0">← ResuOne</Link>

          {/* Tab switcher */}
          <div className="flex items-center gap-1 bg-muted/40 rounded-lg p-1">
            <button
              onClick={() => setActiveTab("pipeline")}
              className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-md transition-all ${activeTab === "pipeline" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              <Users className="w-3.5 h-3.5" /> Pipeline
            </button>
            <button
              onClick={() => setActiveTab("team")}
              className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-md transition-all ${activeTab === "team" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              <UserCog className="w-3.5 h-3.5" /> Team
              {accessData?.plan === "team" && (
                <span className="bg-primary/15 text-primary text-[10px] font-bold px-1.5 py-0.5 rounded-full">Team</span>
              )}
            </button>
          </div>

          {activeTab === "pipeline" && (
            <div className="flex items-center gap-2 flex-wrap">
              <Link href="/recruiter/pipeline" className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors border border-border/40 rounded-lg px-3 py-1.5">
                <LayoutGrid className="w-3.5 h-3.5" /> Board View
              </Link>
              <Link href="/recruiter/jobs" className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors border border-primary/40 rounded-lg px-3 py-1.5 bg-primary/5">
                <BarChart3 className="w-3.5 h-3.5 text-primary" /> Ranking
              </Link>
              <button onClick={() => setAnalysesImportOpen(true)} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-border/40 rounded-lg px-3 py-1.5 hover:border-primary/30 transition-colors">
                <Download className="w-3.5 h-3.5" /> From Analyses
              </button>
              <button onClick={() => setCsvImportOpen(true)} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-border/40 rounded-lg px-3 py-1.5 hover:border-primary/30 transition-colors">
                <FileText className="w-3.5 h-3.5" /> CSV Import
              </button>
              <button onClick={() => setAddOpen(true)} className="flex items-center gap-1.5 bg-primary text-primary-foreground text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-primary/90 transition-colors">
                <Plus className="w-3.5 h-3.5" /> Add Candidate
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Paywall banner */}
        {accessData !== undefined && !hasAccess && (
          <div className="mb-8 rounded-2xl border-2 border-primary/30 bg-gradient-to-r from-primary/5 to-violet-500/5 p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex-1">
              <p className="font-bold text-foreground text-lg mb-1">Activate Recruiter Mode</p>
              <p className="text-muted-foreground text-sm">
                Manage your hiring pipeline, send interview invites, import CVs, and track candidates — all in one place.
              </p>
            </div>
            <Link href="/recruiter/pricing">
              <button className="shrink-0 flex items-center gap-2 bg-primary text-primary-foreground font-semibold px-5 py-2.5 rounded-xl hover:bg-primary/90 transition-colors text-sm">
                View Recruiter Plans →
              </button>
            </Link>
          </div>
        )}

        {/* Team tab */}
        {activeTab === "team" && accessData !== undefined && (
          <TeamTab accessData={{ hasAccess: accessData.hasAccess ?? false, plan: accessData.plan ?? null, isTeamOwner: accessData.isTeamOwner ?? false, isMember: accessData.isMember ?? false, teamOwnerId: accessData.teamOwnerId }} />
        )}

        {/* Pipeline tab */}
        {activeTab === "pipeline" && (
          <>
            {/* KPI Strip */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              {kpis.map(k => (
                <div key={k.label} className="bg-muted/20 rounded-xl border border-border/40 p-5">
                  <div className="flex items-center gap-2 mb-1">
                    <k.icon className={`w-4 h-4 ${k.color}`} />
                    <span className="text-xs text-muted-foreground">{k.label}</span>
                  </div>
                  <p className="text-3xl font-extrabold text-foreground">{k.value}</p>
                </div>
              ))}
            </div>

            {/* Acceptance rate pill */}
            {analytics && analytics.invitesSent > 0 && (
              <div className="mb-6 flex items-center gap-3">
                <div className="inline-flex items-center gap-2 text-sm text-muted-foreground border border-border/40 rounded-full px-4 py-1.5">
                  <BarChart2 className="w-3.5 h-3.5 text-primary" />
                  Acceptance rate: <span className="font-bold text-foreground">{analytics.acceptanceRate}%</span>
                  <span className="text-muted-foreground/60">({analytics.invitesAccepted}/{analytics.invitesSent} invites)</span>
                </div>
              </div>
            )}

            {/* Status summary pills */}
            {candidates.length > 0 && (
              <div className="flex gap-2 flex-wrap mb-5">
                {Object.entries(summary).map(([status, count]) => (
                  <button
                    key={status}
                    onClick={() => setFilterStatus(filterStatus === status ? "all" : status)}
                    className={cn(
                      "flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium transition-all",
                      STATUS_COLORS[status],
                      filterStatus === status ? "ring-2 ring-offset-1 ring-primary/30" : "hover:opacity-80",
                    )}
                  >
                    <span className="capitalize">{status}</span>
                    <span className="font-bold">{count}</span>
                  </button>
                ))}
                {filterStatus !== "all" && (
                  <button onClick={() => setFilterStatus("all")} className="text-xs text-muted-foreground hover:text-foreground px-2">
                    Clear
                  </button>
                )}
              </div>
            )}

            {/* Filters + search */}
            <div className="flex flex-wrap gap-3 items-center mb-5">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search name, email, role…"
                  className="w-full pl-9 pr-4 h-9 rounded-lg border border-border/60 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <Select value={filterScore} onValueChange={setFilterScore}>
                <SelectTrigger className="h-9 w-36">
                  <SelectValue placeholder="All Scores" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Scores</SelectItem>
                  <SelectItem value="70+">70%+</SelectItem>
                  <SelectItem value="50-70">50–70%</SelectItem>
                  <SelectItem value="lt50">Below 50%</SelectItem>
                </SelectContent>
              </Select>
              {selected.size > 0 && (
                <div className="flex items-center gap-2">
                  <button onClick={toggleAll} className="text-xs text-muted-foreground hover:text-foreground border border-border/40 rounded-lg px-3 h-9">
                    {selected.size === filtered.length ? "Deselect all" : `Select all (${filtered.length})`}
                  </button>
                  <button onClick={() => setBulkInviteOpen(true)}
                    className="flex items-center gap-1.5 bg-primary text-primary-foreground text-xs font-semibold px-3 h-9 rounded-lg hover:bg-primary/90 transition-colors">
                    <Mail className="w-3.5 h-3.5" /> Invite Selected ({selected.size})
                  </button>
                </div>
              )}
            </div>

            {/* Ranked note if any have scores */}
            {filtered.some(c => c.score != null) && (
              <p className="text-xs text-muted-foreground mb-3 flex items-center gap-1.5">
                <Star className="w-3.5 h-3.5 text-primary/60" />
                Score badge reflects CV–role match
              </p>
            )}

            {/* Candidate cards */}
            {isLoading ? (
              <div className="flex items-center justify-center py-24">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-24 border border-dashed border-border/40 rounded-2xl">
                <Users className="w-10 h-10 text-muted-foreground/40 mx-auto mb-4" />
                <p className="text-muted-foreground font-medium mb-2">
                  {candidates.length === 0 ? "No candidates yet" : "No candidates match your filters"}
                </p>
                {candidates.length === 0 && (
                  <button onClick={() => setAddOpen(true)} className="mt-4 flex items-center gap-1.5 text-sm text-primary hover:underline mx-auto">
                    <Plus className="w-3.5 h-3.5" /> Add your first candidate
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {filtered.map(c => (
                  <div
                    key={c.id}
                    className="bg-background border border-border/40 rounded-2xl p-4 hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => navigate(`/candidate/${c.id}`)}
                  >
                    <div className="flex items-start gap-3">
                      {/* Select checkbox */}
                      <div onClick={e => { e.stopPropagation(); toggleSelect(c.id); }} className="pt-0.5 shrink-0">
                        <input
                          type="checkbox"
                          checked={selected.has(c.id)}
                          onChange={() => toggleSelect(c.id)}
                          className="rounded border-border accent-primary w-4 h-4"
                        />
                      </div>

                      {/* Avatar */}
                      <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <User className="w-4 h-4 text-primary" />
                      </div>

                      {/* Main content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                          <p className="font-semibold text-sm text-foreground">{c.name}</p>
                          <Badge variant="outline" className={cn("text-xs capitalize", STATUS_COLORS[c.status] ?? "")}>
                            {c.status}
                          </Badge>
                          <ScoreBadge score={c.score} />
                        </div>
                        <p className="text-xs text-muted-foreground">{c.email}</p>
                        {c.jobTitle && (
                          <p className="text-xs text-muted-foreground/70 mt-0.5">
                            {c.jobTitle}{c.company ? ` · ${c.company}` : ""}
                          </p>
                        )}
                        {(c.skills ?? []).length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {(c.skills as string[]).slice(0, 4).map((s: string) => (
                              <span key={s} className="text-xs bg-muted/40 text-muted-foreground px-2 py-0.5 rounded-full">{s}</span>
                            ))}
                            {c.skills.length > 4 && <span className="text-xs text-muted-foreground/60">+{c.skills.length - 4}</span>}
                          </div>
                        )}
                        {c.createdAt && (
                          <p className="text-xs text-muted-foreground/50 mt-1">{timeAgo(c.createdAt)}</p>
                        )}
                      </div>

                      {/* Actions */}
                      <div
                        className="flex items-center gap-1.5 shrink-0"
                        onClick={e => e.stopPropagation()}
                      >
                        <button
                          onClick={() => setInviteTarget({ id: c.id, name: c.name, email: c.email })}
                          className="text-xs text-primary border border-primary/25 rounded-lg px-2.5 py-1.5 hover:bg-primary/8 transition-colors"
                        >
                          <Mail className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => { if (confirm(`Remove ${c.name}?`)) deleteMutation.mutate(c.id); }}
                          className="text-xs text-muted-foreground hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        <ChevronRight className="w-4 h-4 text-muted-foreground ml-1" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>

      {inviteTarget && (
        <InviteModal
          candidate={inviteTarget}
          onClose={() => setInviteTarget(null)}
          onSent={() => {
            qc.invalidateQueries({ queryKey: ["candidates"] });
            qc.invalidateQueries({ queryKey: ["recruiter-analytics"] });
            toast({ title: "Invite sent", description: `Email sent to ${inviteTarget.email}` });
            setInviteTarget(null);
          }}
        />
      )}

      {bulkInviteOpen && (
        <InviteModal
          bulkIds={Array.from(selected)}
          onClose={() => setBulkInviteOpen(false)}
          onSent={() => {
            qc.invalidateQueries({ queryKey: ["candidates"] });
            qc.invalidateQueries({ queryKey: ["recruiter-analytics"] });
            toast({ title: "Invites sent", description: `${selected.size} invites sent` });
            setSelected(new Set());
            setBulkInviteOpen(false);
          }}
        />
      )}

      {addOpen && (
        <AddCandidateModal
          onClose={() => setAddOpen(false)}
          onAdded={() => {
            qc.invalidateQueries({ queryKey: ["candidates"] });
            qc.invalidateQueries({ queryKey: ["recruiter-analytics"] });
            setAddOpen(false);
          }}
        />
      )}

      {csvImportOpen && (
        <CsvImportModal
          onClose={() => setCsvImportOpen(false)}
          onImported={(count) => {
            qc.invalidateQueries({ queryKey: ["candidates"] });
            qc.invalidateQueries({ queryKey: ["recruiter-analytics"] });
            toast({ title: `${count} candidates imported`, description: "Added from CSV file" });
            setCsvImportOpen(false);
          }}
        />
      )}

      {analysesImportOpen && (
        <ImportFromAnalysesModal
          onClose={() => setAnalysesImportOpen(false)}
          onImported={(count) => {
            qc.invalidateQueries({ queryKey: ["candidates"] });
            qc.invalidateQueries({ queryKey: ["recruiter-analytics"] });
            toast({ title: `${count} candidates imported`, description: "Imported from your CV analyses" });
            setAnalysesImportOpen(false);
          }}
        />
      )}
    </div>
  );
}
