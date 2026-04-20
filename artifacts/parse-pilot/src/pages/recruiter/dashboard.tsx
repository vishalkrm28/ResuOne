import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import {
  getCandidates, getRecruiterAnalytics, updateCandidateStatus,
  deleteCandidate, sendInvite, bulkInvite, createCandidate, getRecruiterAccess
} from "@/lib/recruiter-api";
import { Loader2, Users, Mail, CheckCircle2, XCircle, Search,
  Trash2, LayoutGrid, BarChart3, Plus, ArrowRight, FileText, Download, UserCog } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { InviteModal } from "./invite-modal";
import { StatusBadge } from "./status-badge";
import { AddCandidateModal } from "./add-candidate-modal";
import { ImportFromAnalysesModal } from "./import-modal";
import { CsvImportModal } from "./csv-import-modal";
import { TeamTab } from "./team-tab";

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
        (filterScore === "<50" && (c.score ?? 0) < 50);
      return matchSearch && matchStatus && matchScore;
    });
  }, [candidates, search, filterStatus, filterScore]);

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => updateCandidateStatus(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["candidates"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteCandidate(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["candidates"] }); qc.invalidateQueries({ queryKey: ["recruiter-analytics"] }); },
    onError: () => toast({ title: "Delete failed", variant: "destructive" }),
  });

  const toggleSelect = (id: string) => {
    setSelected(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  };
  const toggleAll = () => {
    setSelected(prev => prev.size === filtered.length ? new Set() : new Set(filtered.map(c => c.id)));
  };

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
                <LayoutGrid className="w-3.5 h-3.5" /> Pipeline
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
        {activeTab === "pipeline" && <>

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
              <BarChart3 className="w-3.5 h-3.5 text-primary" />
              Acceptance rate: <span className="font-bold text-foreground">{analytics.acceptanceRate}%</span>
              <span className="text-muted-foreground/60">({analytics.invitesAccepted}/{analytics.invitesSent} invites)</span>
            </div>
          </div>
        )}

        {/* Filters + search */}
        <div className="flex flex-wrap gap-3 items-center mb-6">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search name, email, role…"
              className="w-full pl-9 pr-4 h-9 rounded-lg border border-border/60 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="h-9 rounded-lg border border-border/60 bg-background text-sm px-3 focus:outline-none focus:ring-2 focus:ring-primary/30">
            <option value="all">All Status</option>
            <option value="new">New</option>
            <option value="invited">Invited</option>
            <option value="accepted">Accepted</option>
            <option value="rejected">Rejected</option>
          </select>
          <select value={filterScore} onChange={e => setFilterScore(e.target.value)}
            className="h-9 rounded-lg border border-border/60 bg-background text-sm px-3 focus:outline-none focus:ring-2 focus:ring-primary/30">
            <option value="all">All Scores</option>
            <option value="70+">70%+</option>
            <option value="50-70">50–70%</option>
            <option value="<50">Below 50%</option>
          </select>
          {selected.size > 0 && (
            <button onClick={() => setBulkInviteOpen(true)}
              className="flex items-center gap-1.5 bg-primary text-primary-foreground text-xs font-semibold px-3 h-9 rounded-lg hover:bg-primary/90 transition-colors">
              <Mail className="w-3.5 h-3.5" /> Invite Selected ({selected.size})
            </button>
          )}
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-24 border border-dashed border-border/40 rounded-2xl">
            <Users className="w-10 h-10 text-muted-foreground/40 mx-auto mb-4" />
            <p className="text-muted-foreground font-medium mb-2">{candidates.length === 0 ? "No candidates yet" : "No candidates match your filters"}</p>
            {candidates.length === 0 && (
              <button onClick={() => setAddOpen(true)} className="mt-4 flex items-center gap-1.5 text-sm text-primary hover:underline mx-auto">
                <Plus className="w-3.5 h-3.5" /> Add your first candidate
              </button>
            )}
          </div>
        ) : (
          <div className="border border-border/40 rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/40 bg-muted/20">
                  <th className="px-4 py-3 text-left w-8">
                    <input type="checkbox" checked={selected.size === filtered.length && filtered.length > 0}
                      onChange={toggleAll} className="rounded border-border accent-primary" />
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-foreground">Name</th>
                  <th className="px-4 py-3 text-left font-semibold text-foreground">Score</th>
                  <th className="px-4 py-3 text-left font-semibold text-foreground hidden md:table-cell">Top Skills</th>
                  <th className="px-4 py-3 text-left font-semibold text-foreground hidden lg:table-cell">Experience</th>
                  <th className="px-4 py-3 text-left font-semibold text-foreground">Status</th>
                  <th className="px-4 py-3 text-right font-semibold text-foreground">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {filtered.map(c => (
                  <tr key={c.id} className="hover:bg-muted/10 transition-colors group">
                    <td className="px-4 py-3">
                      <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggleSelect(c.id)}
                        className="rounded border-border accent-primary" />
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">{c.name}</div>
                      <div className="text-xs text-muted-foreground">{c.email}</div>
                      {c.jobTitle && <div className="text-xs text-muted-foreground/60">{c.jobTitle}{c.company ? ` · ${c.company}` : ""}</div>}
                    </td>
                    <td className="px-4 py-3">
                      {c.score != null ? (
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                            <div className="h-full rounded-full bg-primary" style={{ width: `${c.score}%` }} />
                          </div>
                          <span className="font-semibold text-foreground text-xs">{Math.round(c.score)}%</span>
                        </div>
                      ) : <span className="text-muted-foreground text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <div className="flex flex-wrap gap-1 max-w-[200px]">
                        {(c.skills ?? []).slice(0, 3).map((s: string) => (
                          <span key={s} className="bg-primary/8 text-primary text-xs px-2 py-0.5 rounded-full border border-primary/15">{s}</span>
                        ))}
                        {(c.skills ?? []).length > 3 && <span className="text-xs text-muted-foreground">+{c.skills.length - 3}</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <span className="text-muted-foreground text-xs line-clamp-2 max-w-[160px]">{c.experience ?? "—"}</span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={c.status} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 justify-end">
                        <button onClick={() => navigate(`/candidate/${c.id}`)}
                          className="text-xs text-muted-foreground hover:text-foreground border border-border/40 rounded-md px-2.5 py-1 hover:bg-muted/30 transition-colors">
                          View Candidate
                        </button>
                        <button onClick={() => setInviteTarget({ id: c.id, name: c.name, email: c.email })}
                          className="text-xs text-primary border border-primary/25 rounded-md px-2.5 py-1 hover:bg-primary/8 transition-colors">
                          Invite
                        </button>
                        <button onClick={() => { if (confirm(`Remove ${c.name}?`)) deleteMutation.mutate(c.id); }}
                          className="text-xs text-muted-foreground hover:text-red-500 p-1 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        </>}
      </main>

      {/* Invite modal (single) */}
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

      {/* Bulk invite modal */}
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

      {addOpen && <AddCandidateModal onClose={() => setAddOpen(false)} onAdded={() => {
        qc.invalidateQueries({ queryKey: ["candidates"] });
        qc.invalidateQueries({ queryKey: ["recruiter-analytics"] });
        setAddOpen(false);
      }} />}

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
