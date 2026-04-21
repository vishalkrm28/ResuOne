import { useState, useCallback, useEffect } from "react";
import {
  Shield, Search, CreditCard, Package, RefreshCw, LogOut,
  CheckCircle, XCircle, Loader2, Trash2, ChevronRight,
  ChevronDown, Users, BarChart3, AlertTriangle, X, FileText, Star,
  Mail, DollarSign, Briefcase, Bookmark, LayoutGrid, Sparkles, Building2, Zap,
  Clock, ArrowUpDown, Wrench,
} from "lucide-react";

const STORAGE_KEY = "pp_admin_token";

function useAdminFetch(token: string) {
  return useCallback(
    async (path: string, options: RequestInit = {}) => {
      const res = await fetch(`/api${path}`, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          "x-admin-token": token,
          ...(options.headers ?? {}),
        },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      return data;
    },
    [token],
  );
}

interface Toast { id: number; message: string; type: "success" | "error" }
interface UserRow {
  id: string; email: string | null; firstName: string | null;
  lastName: string | null; subscriptionStatus: string | null; createdAt: string;
}
interface UserDetail {
  user: any; balance: any; bulkPasses: any[];
}
interface EmailDraft {
  id: string; draftType: string; subject: string; tone: string;
  status: string; applicationId: string | null; createdAt: string;
}
interface CreditEvent {
  id: string; type: string; creditsDelta: number;
  metadata: any; createdAt: string;
}
interface RecruiterStats {
  recruiterJobs: number; candidates: number;
}
interface Application {
  id: string; jobTitle: string; company: string;
  keywordMatchScore: number | null; status: string | null; createdAt: string;
}
interface Stats {
  totalUsers: number; totalApplications: number;
  totalBulkPasses: number; totalMessages: number;
  proUsers: number; recruiterSoloUsers: number; recruiterTeamUsers: number;
  mrr: number;
  totalSavedJobs: number; totalTrackedApps: number; totalInterviewPreps: number;
  totalEmailDrafts: number;
  trackerStageBreakdown: Record<string, number>;
  creditBreakdown30d: { type: string; events: number; creditsSpent: number }[];
}

interface TrackerData {
  savedJobs: { id: string; jobTitle: string; company: string | null; createdAt: string }[];
  trackedApps: { id: string; applicationTitle: string; company: string | null; stage: string; status: string; createdAt: string; updatedAt: string }[];
  interviewPreps: { id: string; prepSummary: string | null; createdAt: string }[];
  stageBreakdown: Record<string, number>;
  counts: { savedJobs: number; trackedApps: number; interviewPreps: number };
}

interface ContactMessage {
  id: string; name: string; email: string; message: string;
  userId: string | null; createdAt: string;
}

function ConfirmModal({
  title, message, onConfirm, onCancel, danger,
}: {
  title: string; message: string; onConfirm: () => void;
  onCancel: () => void; danger?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 max-w-sm w-full space-y-4">
        <div className="flex items-start gap-3">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${danger ? "bg-red-500/10" : "bg-zinc-800"}`}>
            <AlertTriangle className={`w-4 h-4 ${danger ? "text-red-400" : "text-zinc-400"}`} />
          </div>
          <div>
            <h3 className="font-semibold text-white">{title}</h3>
            <p className="text-sm text-zinc-400 mt-1">{message}</p>
          </div>
        </div>
        <div className="flex gap-2 pt-2">
          <button
            onClick={onCancel}
            className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg py-2 text-sm transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
              danger ? "bg-red-600 hover:bg-red-700 text-white" : "bg-primary hover:bg-primary/90 text-white"
            }`}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const [token, setToken] = useState(() => localStorage.getItem(STORAGE_KEY) ?? "");
  const [tokenInput, setTokenInput] = useState("");
  const [authed, setAuthed] = useState(() => !!localStorage.getItem(STORAGE_KEY));
  const [tab, setTab] = useState<"users" | "stats" | "messages" | "metrics" | "marketing">("users");

  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirm, setConfirm] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);

  const call = useAdminFetch(token);

  function addToast(message: string, type: "success" | "error") {
    const id = Date.now();
    setToasts(t => [...t, { id, message, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4000);
  }

  function confirmAction(title: string, message: string, onConfirm: () => void) {
    setConfirm({ title, message, onConfirm });
  }

  function handleLogin() {
    const trimmed = tokenInput.trim();
    if (!trimmed) return;
    localStorage.setItem(STORAGE_KEY, trimmed);
    setToken(trimmed);
    setAuthed(true);
  }

  function handleLogout() {
    localStorage.removeItem(STORAGE_KEY);
    setToken(""); setTokenInput(""); setAuthed(false);
  }

  if (!authed) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-2xl p-8 space-y-6">
          <div className="flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Shield className="w-6 h-6 text-primary" />
            </div>
            <div className="text-center">
              <h1 className="text-xl font-semibold text-white">Admin Panel</h1>
              <p className="text-sm text-zinc-400 mt-1">ResuOne</p>
            </div>
          </div>
          <div className="space-y-3">
            <input
              type="password"
              placeholder="Admin token"
              value={tokenInput}
              onChange={e => setTokenInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleLogin()}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <button
              onClick={handleLogin}
              className="w-full bg-primary text-white rounded-lg py-2.5 text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              Sign in
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {confirm && (
        <ConfirmModal
          title={confirm.title}
          message={confirm.message}
          danger
          onConfirm={() => { confirm.onConfirm(); setConfirm(null); }}
          onCancel={() => setConfirm(null)}
        />
      )}

      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm shadow-lg border ${
              t.type === "success"
                ? "bg-green-900/90 border-green-700 text-green-100"
                : "bg-red-900/90 border-red-700 text-red-100"
            }`}
          >
            {t.type === "success" ? <CheckCircle className="w-4 h-4 flex-shrink-0" /> : <XCircle className="w-4 h-4 flex-shrink-0" />}
            {t.message}
          </div>
        ))}
      </div>

      <header className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Shield className="w-4 h-4 text-primary" />
            </div>
            <span className="font-semibold text-sm">Admin Panel</span>
          </div>
          <div className="flex gap-1">
            {([
              { key: "users", icon: <Users className="w-3.5 h-3.5" />, label: "Users" },
              { key: "stats", icon: <BarChart3 className="w-3.5 h-3.5" />, label: "Stats" },
              { key: "metrics", icon: <DollarSign className="w-3.5 h-3.5" />, label: "Metrics" },
              { key: "messages", icon: <Mail className="w-3.5 h-3.5" />, label: "Messages" },
              { key: "marketing", icon: <Zap className="w-3.5 h-3.5" />, label: "Marketing" },
            ] as const).map(({ key, icon, label }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  tab === key ? "bg-zinc-800 text-white" : "text-zinc-400 hover:text-white"
                }`}
              >
                {icon}{label}
              </button>
            ))}
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {tab === "users" && (
          <UsersTab call={call} addToast={addToast} confirmAction={confirmAction} />
        )}
        {tab === "stats" && (
          <StatsTab call={call} />
        )}
        {tab === "messages" && (
          <MessagesTab call={call} addToast={addToast} />
        )}
        {tab === "metrics" && (
          <MetricsTab call={call} />
        )}
        {tab === "marketing" && (
          <MarketingTab call={call} />
        )}
      </div>
    </div>
  );
}

const STAGE_COLORS: Record<string, string> = {
  saved: "bg-zinc-600",
  preparing: "bg-blue-600",
  applied: "bg-purple-600",
  screening: "bg-yellow-500",
  interview: "bg-orange-500",
  final_round: "bg-pink-500",
  offer: "bg-green-500",
  rejected: "bg-red-500",
  withdrawn: "bg-zinc-500",
};

const STAGE_ORDER = ["saved","preparing","applied","screening","interview","final_round","offer","rejected","withdrawn"];

const CREDIT_TYPE_LABELS: Record<string, string> = {
  cv_optimization: "CV Analysis",
  cover_letter: "Cover Letter",
  tailored_cv: "Tailored CV",
  interview_prep: "Interview Prep",
};

function StatsTab({ call }: { call: any }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    call("/_admin/stats")
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [call]);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-zinc-400" /></div>;

  const mainCards = [
    { label: "Total users", value: stats?.totalUsers ?? 0, color: "text-blue-400", fmt: "int" },
    { label: "Pro subscribers", value: stats?.proUsers ?? 0, color: "text-purple-400", fmt: "int" },
    { label: "Total CV analyses", value: stats?.totalApplications ?? 0, color: "text-green-400", fmt: "int" },
    { label: "Bulk passes sold", value: stats?.totalBulkPasses ?? 0, color: "text-orange-400", fmt: "int" },
  ];

  const revenueCards = [
    { label: "MRR (estimated)", value: stats?.mrr ?? 0, color: "text-emerald-400", fmt: "usd" },
    { label: "Recruiter Solo", value: stats?.recruiterSoloUsers ?? 0, color: "text-sky-400", fmt: "int" },
    { label: "Recruiter Team", value: stats?.recruiterTeamUsers ?? 0, color: "text-sky-300", fmt: "int" },
    { label: "Contact messages", value: stats?.totalMessages ?? 0, color: "text-zinc-400", fmt: "int" },
  ];

  const trackerCards = [
    { label: "Saved Jobs", value: stats?.totalSavedJobs ?? 0, color: "text-amber-400", fmt: "int", icon: <Bookmark className="w-3.5 h-3.5" /> },
    { label: "Tracked Applications", value: stats?.totalTrackedApps ?? 0, color: "text-indigo-400", fmt: "int", icon: <LayoutGrid className="w-3.5 h-3.5" /> },
    { label: "Interview Preps", value: stats?.totalInterviewPreps ?? 0, color: "text-violet-400", fmt: "int", icon: <Sparkles className="w-3.5 h-3.5" /> },
    { label: "Email Drafts", value: stats?.totalEmailDrafts ?? 0, color: "text-blue-400", fmt: "int", icon: <Mail className="w-3.5 h-3.5" /> },
  ];

  const fmt = (v: number, f: string) => f === "usd" ? `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : v.toLocaleString();

  const stageBreakdown = stats?.trackerStageBreakdown ?? {};
  const totalTrackedWithStages = Object.values(stageBreakdown).reduce((a, b) => a + b, 0);

  const creditBreakdown = stats?.creditBreakdown30d ?? [];

  return (
    <div className="space-y-8">
      {/* Usage */}
      <div>
        <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Platform Usage</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {mainCards.map(c => (
            <div key={c.label} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
              <p className="text-xs text-zinc-400 uppercase tracking-wide">{c.label}</p>
              <p className={`text-3xl font-bold mt-2 ${c.color}`}>{fmt(c.value, c.fmt)}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Revenue */}
      <div>
        <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <DollarSign className="w-3.5 h-3.5" />Revenue
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {revenueCards.map(c => (
            <div key={c.label} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
              <p className="text-xs text-zinc-400 uppercase tracking-wide">{c.label}</p>
              <p className={`text-3xl font-bold mt-2 ${c.color}`}>{fmt(c.value, c.fmt)}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Job Tracker */}
      <div>
        <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <LayoutGrid className="w-3.5 h-3.5" />Job Tracker
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
          {trackerCards.map(c => (
            <div key={c.label} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
              <p className="text-xs text-zinc-400 uppercase tracking-wide flex items-center gap-1">
                {c.icon}{c.label}
              </p>
              <p className={`text-3xl font-bold mt-2 ${c.color}`}>{fmt(c.value, c.fmt)}</p>
            </div>
          ))}
        </div>

        {/* Pipeline stage breakdown */}
        {totalTrackedWithStages > 0 && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
            <p className="text-xs text-zinc-400 uppercase tracking-wide mb-3">Pipeline Stage Distribution</p>
            <div className="space-y-2">
              {STAGE_ORDER.filter(s => stageBreakdown[s]).map(stage => {
                const n = stageBreakdown[stage] ?? 0;
                const pct = totalTrackedWithStages > 0 ? Math.round((n / totalTrackedWithStages) * 100) : 0;
                return (
                  <div key={stage} className="flex items-center gap-3">
                    <span className="text-xs text-zinc-400 w-24 capitalize flex-shrink-0">{stage.replace(/_/g, " ")}</span>
                    <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${STAGE_COLORS[stage] ?? "bg-zinc-600"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs text-zinc-400 w-8 text-right flex-shrink-0">{n}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Credit usage breakdown (30d) */}
      {creditBreakdown.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <CreditCard className="w-3.5 h-3.5" />Credit Usage (last 30 days)
          </p>
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Feature</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Events</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Credits spent</th>
                </tr>
              </thead>
              <tbody>
                {creditBreakdown.map((row, i) => (
                  <tr key={row.type} className={i < creditBreakdown.length - 1 ? "border-b border-zinc-800/50" : ""}>
                    <td className="px-4 py-3 text-zinc-300">
                      {CREDIT_TYPE_LABELS[row.type] ?? row.type.replace(/_/g, " ")}
                    </td>
                    <td className="px-4 py-3 text-right text-zinc-400">{row.events.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-zinc-300 font-medium">{row.creditsSpent.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function MessagesTab({ call, addToast }: { call: any; addToast: (m: string, t: "success" | "error") => void }) {
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const limit = 50;
  const [offset, setOffset] = useState(0);

  const load = useCallback(() => {
    setLoading(true);
    call(`/_admin/contact-messages?limit=${limit}&offset=${offset}`)
      .then((r: any) => { setMessages(r.messages); setTotal(r.total); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [call, offset]);

  useEffect(() => { load(); }, [load]);

  const deleteMsg = async (id: string) => {
    setDeleting(id);
    try {
      await call(`/_admin/contact-message/${id}`, { method: "DELETE" });
      addToast("Message deleted", "success");
      setMessages(m => m.filter(x => x.id !== id));
      setTotal(t => t - 1);
    } catch {
      addToast("Delete failed", "error");
    } finally {
      setDeleting(null);
    }
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-zinc-400" /></div>;
  if (!messages.length) return (
    <div className="text-center py-16 text-zinc-500">
      <Mail className="w-8 h-8 mx-auto mb-3 opacity-30" />
      <p className="text-sm">No contact messages yet</p>
    </div>
  );

  return (
    <div className="space-y-3">
      <p className="text-xs text-zinc-500">{total} message{total !== 1 ? "s" : ""} total</p>
      {messages.map(msg => (
        <div key={msg.id} className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <div
            className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-zinc-800/50 transition-colors"
            onClick={() => setExpanded(expanded === msg.id ? null : msg.id)}
          >
            <Mail className="w-4 h-4 text-zinc-500 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-white">{msg.name}</span>
                <span className="text-xs text-zinc-500">&lt;{msg.email}&gt;</span>
              </div>
              <p className="text-xs text-zinc-400 truncate mt-0.5">{msg.message}</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-xs text-zinc-600">{new Date(msg.createdAt).toLocaleDateString()}</span>
              <button
                onClick={e => { e.stopPropagation(); deleteMsg(msg.id); }}
                disabled={deleting === msg.id}
                className="p-1 rounded text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-colors"
              >
                {deleting === msg.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              </button>
              {expanded === msg.id ? <ChevronDown className="w-3.5 h-3.5 text-zinc-500" /> : <ChevronRight className="w-3.5 h-3.5 text-zinc-500" />}
            </div>
          </div>
          {expanded === msg.id && (
            <div className="border-t border-zinc-800 px-4 py-3 bg-zinc-800/30 space-y-2">
              <div className="flex gap-4 text-xs text-zinc-500">
                <span><span className="text-zinc-600">From: </span>{msg.name} &lt;{msg.email}&gt;</span>
                <span><span className="text-zinc-600">Sent: </span>{new Date(msg.createdAt).toLocaleString()}</span>
                {msg.userId && <span><span className="text-zinc-600">User ID: </span><span className="font-mono">{msg.userId}</span></span>}
              </div>
              <p className="text-sm text-zinc-300 whitespace-pre-wrap leading-relaxed border-t border-zinc-700 pt-2">{msg.message}</p>
              <a
                href={`mailto:${msg.email}?subject=Re: Your message to ResuOne`}
                className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
              >
                <Mail className="w-3 h-3" /> Reply via email
              </a>
            </div>
          )}
        </div>
      ))}
      {total > limit && (
        <div className="flex justify-center gap-3 pt-2">
          <button disabled={offset === 0} onClick={() => setOffset(o => Math.max(0, o - limit))} className="text-xs text-zinc-400 hover:text-white disabled:opacity-30">← Prev</button>
          <span className="text-xs text-zinc-600">{offset + 1}–{Math.min(offset + limit, total)} of {total}</span>
          <button disabled={offset + limit >= total} onClick={() => setOffset(o => o + limit)} className="text-xs text-zinc-400 hover:text-white disabled:opacity-30">Next →</button>
        </div>
      )}
    </div>
  );
}

function UsersTab({
  call, addToast, confirmAction,
}: {
  call: any;
  addToast: (m: string, t: "success" | "error") => void;
  confirmAction: (title: string, message: string, onConfirm: () => void) => void;
}) {
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  async function fetchUsers(q = search) {
    setLoading(true);
    try {
      const data = await call(`/_admin/users?search=${encodeURIComponent(q)}&limit=50`);
      setUsers(data.users);
    } catch (e: any) {
      addToast(e.message, "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchUsers(""); }, []);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    fetchUsers();
  }

  async function deleteUser(userId: string, email: string | null) {
    confirmAction(
      "Delete user permanently?",
      `This will delete ${email ?? userId} and ALL their data — CVs, bulk passes, credits, subscription history. This cannot be undone.`,
      async () => {
        try {
          await call(`/_admin/user/${userId}`, { method: "DELETE" });
          addToast("User deleted", "success");
          setExpandedId(null);
          setUsers(u => u.filter(x => x.id !== userId));
        } catch (e: any) {
          addToast(e.message, "error");
        }
      },
    );
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          type="text"
          placeholder="Search by email, name, or user ID..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <button
          type="submit"
          disabled={loading}
          className="flex items-center gap-2 bg-primary text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          Search
        </button>
      </form>

      {loading && users.length === 0 ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-zinc-400" /></div>
      ) : (
        <div className="space-y-2">
          {users.length === 0 && (
            <p className="text-sm text-zinc-400 text-center py-8">No users found</p>
          )}
          {users.map(user => (
            <UserRow
              key={user.id}
              user={user}
              expanded={expandedId === user.id}
              onToggle={() => setExpandedId(expandedId === user.id ? null : user.id)}
              onDelete={() => deleteUser(user.id, user.email)}
              call={call}
              addToast={addToast}
              confirmAction={confirmAction}
            />
          ))}
        </div>
      )}

      <UserMigrationTool call={call} addToast={addToast} />
    </div>
  );
}

function UserMigrationTool({ call, addToast }: { call: any; addToast: (m: string, t: "success" | "error") => void }) {
  const [open, setOpen] = useState(false);
  const [oldId, setOldId] = useState("");
  const [newId, setNewId] = useState("");
  const [realEmail, setRealEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  async function run() {
    if (!oldId.trim() || !newId.trim()) {
      addToast("Both user IDs are required", "error");
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const data = await call("/_admin/fix-user-migration", {
        method: "POST",
        body: JSON.stringify({
          old_id: oldId.trim(),
          new_id: newId.trim(),
          ...(realEmail.trim() ? { real_email: realEmail.trim() } : {}),
        }),
      });
      setResult(data.report);
      addToast("Migration completed successfully", "success");
    } catch (e: any) {
      addToast(e.message, "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="border border-zinc-800 rounded-xl overflow-hidden mt-6">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-zinc-800/50 transition-colors"
      >
        <Wrench className="w-4 h-4 text-zinc-500" />
        <span className="text-sm font-medium text-zinc-400">User Migration Tool</span>
        <span className="text-xs text-zinc-600 ml-1">— reassign data from old to new user ID</span>
        <div className="ml-auto">
          {open ? <ChevronDown className="w-4 h-4 text-zinc-500" /> : <ChevronRight className="w-4 h-4 text-zinc-500" />}
        </div>
      </button>
      {open && (
        <div className="border-t border-zinc-800 bg-zinc-900/50 p-4 space-y-4">
          <p className="text-xs text-zinc-500">
            Transfers all data (CV analyses, bulk passes, credits, tracker, email drafts) from an old Clerk user ID to a new one.
            Useful when a user&apos;s Clerk ID changes or accounts are merged. Cannot be undone.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-zinc-500">Old user ID</label>
              <input
                value={oldId} onChange={e => setOldId(e.target.value)}
                placeholder="user_old_..."
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white font-mono placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-zinc-500">New user ID</label>
              <input
                value={newId} onChange={e => setNewId(e.target.value)}
                placeholder="user_new_..."
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white font-mono placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-zinc-500">Restore email (optional)</label>
              <input
                value={realEmail} onChange={e => setRealEmail(e.target.value)}
                placeholder="user@example.com"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
          <button
            onClick={run}
            disabled={loading || !oldId.trim() || !newId.trim()}
            className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowUpDown className="w-3.5 h-3.5" />}
            Run migration
          </button>
          {result && (
            <div className="bg-zinc-800 rounded-lg p-3">
              <p className="text-xs text-green-400 font-semibold mb-1">Migration report:</p>
              <pre className="text-xs text-zinc-400 whitespace-pre-wrap break-all max-h-48 overflow-y-auto">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function UserRow({
  user, expanded, onToggle, onDelete, call, addToast, confirmAction,
}: {
  user: UserRow;
  expanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
  call: any;
  addToast: (m: string, t: "success" | "error") => void;
  confirmAction: (title: string, message: string, onConfirm: () => void) => void;
}) {
  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [apps, setApps] = useState<Application[]>([]);
  const [trackerData, setTrackerData] = useState<TrackerData | null>(null);
  const [emailDrafts, setEmailDrafts] = useState<EmailDraft[]>([]);
  const [creditHistory, setCreditHistory] = useState<CreditEvent[]>([]);
  const [recruiterStats, setRecruiterStats] = useState<RecruiterStats | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [credits, setCredits] = useState("10");
  const [bulkTier, setBulkTier] = useState("25");

  useEffect(() => {
    if (!expanded) return;
    setLoadingDetail(true);
    Promise.all([
      call(`/_admin/check-user/${user.id}`),
      call(`/_admin/user/${user.id}/applications`),
      call(`/_admin/user/${user.id}/tracker`),
      call(`/_admin/user/${user.id}/email-drafts`).catch(() => ({ drafts: [] })),
      call(`/_admin/user/${user.id}/credit-history`).catch(() => ({ events: [] })),
      call(`/_admin/user/${user.id}/recruiter-stats`).catch(() => ({ recruiterJobs: 0, candidates: 0 })),
    ])
      .then(([d, a, t, ed, ch, rs]: any) => {
        setDetail(d);
        setApps(a.applications);
        setTrackerData(t);
        setEmailDrafts(ed.drafts ?? []);
        setCreditHistory(ch.events ?? []);
        setRecruiterStats(rs);
      })
      .catch((e: any) => addToast(e.message, "error"))
      .finally(() => setLoadingDetail(false));
  }, [expanded, user.id]);

  async function doAction(key: string, fn: () => Promise<void>) {
    setActionLoading(key);
    try {
      await fn();
    } catch (e: any) {
      addToast(e.message, "error");
    } finally {
      setActionLoading(null);
    }
  }

  async function refreshDetail() {
    const [d, a, t, ed, ch, rs]: any = await Promise.all([
      call(`/_admin/check-user/${user.id}`),
      call(`/_admin/user/${user.id}/applications`),
      call(`/_admin/user/${user.id}/tracker`),
      call(`/_admin/user/${user.id}/email-drafts`).catch(() => ({ drafts: [] })),
      call(`/_admin/user/${user.id}/credit-history`).catch(() => ({ events: [] })),
      call(`/_admin/user/${user.id}/recruiter-stats`).catch(() => ({ recruiterJobs: 0, candidates: 0 })),
    ]);
    setDetail(d);
    setApps(a.applications);
    setTrackerData(t);
    setEmailDrafts(ed.drafts ?? []);
    setCreditHistory(ch.events ?? []);
    setRecruiterStats(rs);
  }

  async function grantCredits() {
    await doAction("credits", async () => {
      await call("/_admin/seed-credits", {
        method: "POST",
        body: JSON.stringify({ userId: user.id, credits: Number(credits) }),
      });
      addToast(`Granted ${credits} credits`, "success");
      await refreshDetail();
    });
  }

  async function grantBulk() {
    await doAction("bulk", async () => {
      await call("/_admin/seed-bulk", {
        method: "POST",
        body: JSON.stringify({ userId: user.id, tier: bulkTier }),
      });
      addToast(`Granted ${bulkTier}-CV bulk pass`, "success");
      await refreshDetail();
    });
  }

  async function syncStripe() {
    await doAction("stripe", async () => {
      const data = await call("/_admin/sync-stripe", {
        method: "POST",
        body: JSON.stringify({ userId: user.id }),
      });
      addToast(data.message ?? "Stripe synced", "success");
      await refreshDetail();
    });
  }

  const isPro = detail?.user?.subscriptionStatus === "active";
  const recruiterPlan = detail?.user?.recruiterSubscriptionStatus as "solo" | "team" | null | undefined;

  async function togglePro() {
    const revoke = isPro;
    confirmAction(
      revoke ? "Revoke Pro subscription?" : "Grant Pro subscription?",
      revoke
        ? "The user will lose Pro access immediately."
        : "This will grant 1 year of Pro access without Stripe payment.",
      async () => {
        await doAction("pro", async () => {
          const data = await call("/_admin/grant-pro", {
            method: "POST",
            body: JSON.stringify({ userId: user.id, revoke }),
          });
          addToast(data.message ?? "Done", "success");
          await refreshDetail();
        });
      },
    );
  }

  async function toggleRecruiter(plan: "solo" | "team") {
    const isActive = recruiterPlan === plan;
    confirmAction(
      isActive ? `Revoke Recruiter ${plan}?` : `Grant Recruiter ${plan}?`,
      isActive
        ? "The user will lose Recruiter Mode access immediately."
        : `This will grant Recruiter ${plan} access without Stripe payment.`,
      async () => {
        await doAction(`recruiter_${plan}`, async () => {
          const data = await call("/_admin/grant-recruiter", {
            method: "POST",
            body: JSON.stringify({ userId: user.id, plan, revoke: isActive }),
          });
          addToast(data.message ?? "Done", "success");
          await refreshDetail();
        });
      },
    );
  }

  async function deleteApp(appId: string, title: string) {
    confirmAction(
      "Delete this CV analysis?",
      `"${title}" will be permanently deleted.`,
      async () => {
        try {
          await call(`/_admin/application/${appId}`, { method: "DELETE" });
          addToast("Application deleted", "success");
          setApps(a => a.filter(x => x.id !== appId));
        } catch (e: any) {
          addToast(e.message, "error");
        }
      },
    );
  }

  async function revokePass(passId: string) {
    confirmAction(
      "Revoke this bulk pass?",
      "The user will immediately lose access to the remaining CV slots.",
      async () => {
        try {
          await call(`/_admin/bulk-pass/${passId}`, { method: "DELETE" });
          addToast("Bulk pass revoked", "success");
          await refreshDetail();
        } catch (e: any) {
          addToast(e.message, "error");
        }
      },
    );
  }

  const subColor =
    user.subscriptionStatus === "active" ? "text-green-400" :
    user.subscriptionStatus ? "text-yellow-400" : "text-zinc-500";

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
      <div
        onClick={onToggle}
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-zinc-800/50 transition-colors"
      >
        <div className="flex-1 min-w-0 grid grid-cols-3 gap-2 text-sm">
          <span className="truncate text-white font-medium">{user.email ?? "no email"}</span>
          <span className="truncate text-zinc-400 font-mono text-xs">{user.id}</span>
          <span className={`text-xs ${subColor}`}>{user.subscriptionStatus ?? "free"}</span>
        </div>
        <span className="text-xs text-zinc-500 flex-shrink-0">
          {new Date(user.createdAt).toLocaleDateString()}
        </span>
        <button
          onClick={e => { e.stopPropagation(); onDelete(); }}
          className="p-1.5 rounded-md text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors flex-shrink-0"
          title="Delete user"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
        {expanded ? <ChevronDown className="w-4 h-4 text-zinc-400 flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-zinc-400 flex-shrink-0" />}
      </div>

      {expanded && (
        <div className="border-t border-zinc-800 p-4 space-y-5">
          {loadingDetail ? (
            <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-zinc-400" /></div>
          ) : (
            <>
              {/* User info */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <InfoBox label="Credits" value={detail?.balance?.availableCredits?.toString() ?? "0"} highlight={!detail?.balance?.availableCredits ? "red" : "green"} />
                <InfoBox label="Job Rec Credits" value={detail?.balance?.jobRecCredits?.toString() ?? "0"} />
                <InfoBox label="Lifetime Used" value={detail?.balance?.lifetimeCreditsUsed?.toString() ?? "0"} />
                <InfoBox label="Subscription" value={detail?.user?.subscriptionStatus ?? "none"} highlight={detail?.user?.subscriptionStatus === "active" ? "green" : undefined} />
                <InfoBox label="Recruiter" value={recruiterPlan ?? "none"} highlight={recruiterPlan ? "green" : undefined} />
                <InfoBox label="CV analyses" value={apps.length.toString()} />
                <InfoBox label="Bulk passes" value={detail?.bulkPasses?.length?.toString() ?? "0"} />
                <InfoBox label="Email drafts" value={emailDrafts.length.toString()} />
                <InfoBox label="Saved Jobs" value={trackerData?.counts.savedJobs?.toString() ?? "0"} />
                <InfoBox label="Tracked Apps" value={trackerData?.counts.trackedApps?.toString() ?? "0"} />
                <InfoBox label="Interview Preps" value={trackerData?.counts.interviewPreps?.toString() ?? "0"} />
                {recruiterStats && recruiterPlan && (
                  <>
                    <InfoBox label="Recruiter Jobs" value={recruiterStats.recruiterJobs.toString()} highlight={recruiterStats.recruiterJobs > 0 ? "green" : undefined} />
                    <InfoBox label="Candidates" value={recruiterStats.candidates.toString()} highlight={recruiterStats.candidates > 0 ? "green" : undefined} />
                  </>
                )}
              </div>

              {/* Credit allocation panel */}
              <div className="bg-zinc-800/50 border border-zinc-700/60 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium text-white">Credit Balance</span>
                  </div>
                  <span className="text-xs text-zinc-400">
                    Current: <span className={`font-semibold ${(detail?.balance?.availableCredits ?? 0) > 0 ? "text-green-400" : "text-red-400"}`}>
                      {detail?.balance?.availableCredits ?? 0}
                    </span>
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {[10, 50, 100, 250, 500].map(preset => (
                    <button
                      key={preset}
                      onClick={() => setCredits(String(preset))}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                        credits === String(preset)
                          ? "bg-primary text-white"
                          : "bg-zinc-700 hover:bg-zinc-600 text-zinc-300"
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 flex-1">
                    <span className="text-xs text-zinc-500 whitespace-nowrap">Set to:</span>
                    <input
                      type="number" min="0" max="99999" value={credits}
                      onChange={e => setCredits(e.target.value)}
                      className="w-24 bg-zinc-800 border border-zinc-600 rounded-lg px-2.5 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <span className="text-xs text-zinc-500">credits</span>
                  </div>
                  <button
                    onClick={grantCredits}
                    disabled={actionLoading === "credits" || !credits || Number(credits) < 0}
                    className="flex items-center gap-1.5 bg-primary hover:bg-primary/90 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    {actionLoading === "credits" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CreditCard className="w-3.5 h-3.5" />}
                    Set balance
                  </button>
                </div>
              </div>

              {/* Actions row */}
              <div className="flex flex-wrap gap-2">
                <div className="flex items-center gap-1.5">
                  <select
                    value={bulkTier} onChange={e => setBulkTier(e.target.value)}
                    className="bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none"
                  >
                    <option value="10">10 CVs</option>
                    <option value="25">25 CVs</option>
                    <option value="50">50 CVs</option>
                  </select>
                  <ActionBtn icon={<Package className="w-3.5 h-3.5" />} label="Grant bulk pass" loading={actionLoading === "bulk"} onClick={grantBulk} />
                </div>
                <ActionBtn icon={<RefreshCw className="w-3.5 h-3.5" />} label="Sync Stripe" loading={actionLoading === "stripe"} onClick={syncStripe} />
                <button
                  onClick={togglePro}
                  disabled={actionLoading === "pro" || loadingDetail}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors disabled:opacity-50 ${
                    isPro
                      ? "bg-purple-900/40 hover:bg-red-900/40 text-purple-300 hover:text-red-300 border border-purple-700/50 hover:border-red-700/50"
                      : "bg-purple-600 hover:bg-purple-700 text-white"
                  }`}
                >
                  {actionLoading === "pro" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Star className="w-3.5 h-3.5" />}
                  {isPro ? "Revoke Pro" : "Grant Pro"}
                </button>
                {(["solo", "team"] as const).map(plan => {
                  const isActive = recruiterPlan === plan;
                  const loading = actionLoading === `recruiter_${plan}`;
                  return (
                    <button
                      key={plan}
                      onClick={() => toggleRecruiter(plan)}
                      disabled={loading || loadingDetail}
                      title={isActive ? `Revoke Recruiter ${plan}` : `Grant Recruiter ${plan}`}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors disabled:opacity-50 ${
                        isActive
                          ? "bg-sky-900/40 hover:bg-red-900/40 text-sky-300 hover:text-red-300 border border-sky-700/50 hover:border-red-700/50"
                          : "bg-zinc-800 hover:bg-sky-900/30 text-zinc-400 hover:text-sky-300 border border-zinc-700 hover:border-sky-700/50"
                      }`}
                    >
                      {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Briefcase className="w-3.5 h-3.5" />}
                      {isActive ? `Revoke ${plan}` : `R. ${plan}`}
                    </button>
                  );
                })}
              </div>

              {/* Bulk passes */}
              {(detail?.bulkPasses?.length ?? 0) > 0 && (
                <div>
                  <p className="text-xs text-zinc-500 uppercase tracking-wide mb-2">Bulk passes</p>
                  <div className="space-y-1.5">
                    {detail!.bulkPasses.map((p: any) => (
                      <div key={p.id} className="flex items-center justify-between bg-zinc-800 rounded-lg px-3 py-2 text-sm">
                        <span className="text-zinc-300">{p.tier}-CV pass · {p.cvsUsed}/{p.cvLimit} used · <span className={p.status === "paid" ? "text-green-400" : "text-zinc-500"}>{p.status}</span></span>
                        <button
                          onClick={() => revokePass(p.id)}
                          className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1 transition-colors"
                        >
                          <X className="w-3 h-3" /> Revoke
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Applications */}
              {apps.length > 0 && (
                <div>
                  <p className="text-xs text-zinc-500 uppercase tracking-wide mb-2">CV analyses ({apps.length})</p>
                  <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                    {apps.map(app => (
                      <div key={app.id} className="flex items-center gap-2 bg-zinc-800 rounded-lg px-3 py-2">
                        <FileText className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-zinc-300 truncate">{app.jobTitle} @ {app.company}</p>
                          <p className="text-xs text-zinc-500">
                            {new Date(app.createdAt).toLocaleDateString()}
                            {app.keywordMatchScore != null ? ` · ${Math.round(app.keywordMatchScore)}% match` : ""}
                            {app.ipAddress ? <span className="ml-1 font-mono text-zinc-600" title="Client IP"> · {app.ipAddress}</span> : ""}
                          </p>
                        </div>
                        <button
                          onClick={() => deleteApp(app.id, `${app.jobTitle} @ ${app.company}`)}
                          className="p-1 rounded text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors flex-shrink-0"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tracker: stage breakdown */}
              {trackerData && Object.keys(trackerData.stageBreakdown).length > 0 && (
                <div>
                  <p className="text-xs text-zinc-500 uppercase tracking-wide mb-2">Pipeline stages</p>
                  <div className="flex flex-wrap gap-1.5">
                    {STAGE_ORDER.filter(s => trackerData.stageBreakdown[s]).map(stage => (
                      <span key={stage} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs text-white ${STAGE_COLORS[stage] ?? "bg-zinc-600"}`}>
                        {stage.replace(/_/g, " ")} <span className="font-semibold">{trackerData.stageBreakdown[stage]}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Tracker: tracked applications list */}
              {trackerData && trackerData.trackedApps.length > 0 && (
                <div>
                  <p className="text-xs text-zinc-500 uppercase tracking-wide mb-2">Tracked applications ({trackerData.trackedApps.length})</p>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {trackerData.trackedApps.map(app => (
                      <div key={app.id} className="flex items-center gap-2 bg-zinc-800 rounded-lg px-3 py-2">
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${STAGE_COLORS[app.stage] ?? "bg-zinc-600"}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-zinc-300 truncate">{app.applicationTitle}{app.company ? ` @ ${app.company}` : ""}</p>
                          <p className="text-xs text-zinc-500">{app.stage.replace(/_/g, " ")} · {new Date(app.updatedAt).toLocaleDateString()}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tracker: saved jobs */}
              {trackerData && trackerData.savedJobs.length > 0 && (
                <div>
                  <p className="text-xs text-zinc-500 uppercase tracking-wide mb-2">Saved jobs ({trackerData.savedJobs.length})</p>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                    {trackerData.savedJobs.map(job => (
                      <div key={job.id} className="flex items-center gap-2 bg-zinc-800 rounded-lg px-3 py-2">
                        <Bookmark className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-zinc-300 truncate">{job.jobTitle}{job.company ? ` @ ${job.company}` : ""}</p>
                          <p className="text-xs text-zinc-500">{new Date(job.createdAt).toLocaleDateString()}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tracker: interview preps */}
              {trackerData && trackerData.interviewPreps.length > 0 && (
                <div>
                  <p className="text-xs text-zinc-500 uppercase tracking-wide mb-2">Interview preps ({trackerData.interviewPreps.length})</p>
                  <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                    {trackerData.interviewPreps.map(prep => (
                      <div key={prep.id} className="flex items-center gap-2 bg-zinc-800 rounded-lg px-3 py-2">
                        <Sparkles className="w-3.5 h-3.5 text-violet-400 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-zinc-300 truncate">{prep.prepSummary ?? "Interview prep generated"}</p>
                          <p className="text-xs text-zinc-500">{new Date(prep.createdAt).toLocaleDateString()}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Email drafts */}
              {emailDrafts.length > 0 && (
                <div>
                  <p className="text-xs text-zinc-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                    <Mail className="w-3 h-3" /> Email drafts ({emailDrafts.length})
                  </p>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                    {emailDrafts.map(draft => (
                      <div key={draft.id} className="flex items-center gap-2 bg-zinc-800 rounded-lg px-3 py-2">
                        <Mail className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-zinc-300 truncate">{draft.subject}</p>
                          <p className="text-xs text-zinc-500">
                            {draft.draftType.replace(/_/g, " ")} · {draft.tone} · {draft.status} · {new Date(draft.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Credit event history */}
              {creditHistory.length > 0 && (
                <div>
                  <p className="text-xs text-zinc-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                    <Clock className="w-3 h-3" /> Credit history (last 50 events)
                  </p>
                  <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                    {creditHistory.map(ev => (
                      <div key={ev.id} className="flex items-center justify-between bg-zinc-800 rounded-lg px-3 py-2 gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-zinc-300 truncate">{ev.type.replace(/_/g, " ")}</p>
                          <p className="text-xs text-zinc-600">{new Date(ev.createdAt).toLocaleString()}</p>
                        </div>
                        <span className={`text-xs font-mono font-semibold flex-shrink-0 ${ev.creditsDelta >= 0 ? "text-green-400" : "text-red-400"}`}>
                          {ev.creditsDelta >= 0 ? "+" : ""}{ev.creditsDelta}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function InfoBox({ label, value, highlight }: { label: string; value: string; highlight?: "green" | "red" }) {
  return (
    <div className="bg-zinc-800 rounded-lg px-3 py-2.5">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className={`text-sm font-medium mt-0.5 ${highlight === "green" ? "text-green-400" : highlight === "red" ? "text-red-400" : "text-white"}`}>
        {value}
      </p>
    </div>
  );
}

function ActionBtn({
  icon, label, loading, onClick,
}: {
  icon: React.ReactNode; label: string; loading: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="flex items-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white px-3 py-1.5 rounded-lg text-sm transition-colors disabled:opacity-50"
    >
      {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : icon}
      {label}
    </button>
  );
}

// ─── M38 Metrics Tab ──────────────────────────────────────────────────────────

function MetricsTab({ call }: { call: any }) {
  const [metrics, setMetrics] = useState<any>(null);
  const [usage, setUsage] = useState<any>(null);
  const [workspaces, setWorkspaces] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [snapshotting, setSnapshotting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [m, u, ws] = await Promise.all([
        call("/_admin/metrics?days=30"),
        call("/_admin/usage-breakdown?days=30"),
        call("/_admin/workspaces-overview").catch(() => ({ workspaces: [] })),
      ]);
      setMetrics(m);
      setUsage(u);
      setWorkspaces(ws.workspaces ?? []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [call]);

  useEffect(() => { load(); }, [load]);

  async function handleSnapshot() {
    setSnapshotting(true);
    await call("/_admin/snapshot-metrics", { method: "POST" }).catch(() => {});
    setSnapshotting(false);
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-zinc-400" /></div>;
  }

  const kpiCards = [
    { label: "Total Users", value: metrics?.userStats?.totalUsers ?? 0, icon: <Users className="w-4 h-4 text-blue-400" />, color: "text-blue-400" },
    { label: "New Users (30d)", value: metrics?.userStats?.newUsers ?? 0, icon: <Users className="w-4 h-4 text-green-400" />, color: "text-green-400" },
    { label: "Active Subscriptions", value: metrics?.subStats?.activeSubscriptions ?? 0, icon: <CreditCard className="w-4 h-4 text-purple-400" />, color: "text-purple-400" },
    { label: "MRR (estimated)", value: `$${(metrics?.mrr ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, icon: <DollarSign className="w-4 h-4 text-emerald-400" />, color: "text-emerald-400" },
    { label: "Credits Used (30d)", value: metrics?.creditStats?.creditsUsedLast30d ?? 0, icon: <Zap className="w-4 h-4 text-yellow-400" />, color: "text-yellow-400" },
    { label: "Total Workspaces", value: metrics?.wsStats?.totalWorkspaces ?? 0, icon: <Building2 className="w-4 h-4 text-sky-400" />, color: "text-sky-400" },
  ];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Platform Metrics (last 30 days)</h2>
        <div className="flex gap-2">
          <button
            onClick={load}
            className="flex items-center gap-1.5 text-zinc-400 hover:text-white text-sm px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
          <button
            onClick={handleSnapshot}
            disabled={snapshotting}
            className="flex items-center gap-1.5 text-zinc-400 hover:text-white text-sm px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors disabled:opacity-50"
          >
            {snapshotting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BarChart3 className="w-3.5 h-3.5" />}
            Snapshot Today
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {kpiCards.map(card => (
          <div key={card.label} className="bg-zinc-800 rounded-xl p-4 space-y-2">
            {card.icon}
            <p className={`text-xl font-bold ${card.color}`}>{card.value}</p>
            <p className="text-xs text-zinc-500">{card.label}</p>
          </div>
        ))}
      </div>

      {/* Feature usage breakdown */}
      {usage?.byFeature && usage.byFeature.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <Zap className="w-4 h-4 text-yellow-400" /> Feature Usage Breakdown
          </h3>
          <div className="bg-zinc-800 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="border-b border-zinc-700">
                <tr>
                  <th className="text-left px-4 py-2 text-xs text-zinc-400">Feature</th>
                  <th className="text-right px-4 py-2 text-xs text-zinc-400">Events</th>
                  <th className="text-right px-4 py-2 text-xs text-zinc-400">Credits</th>
                  <th className="text-right px-4 py-2 text-xs text-zinc-400">Est. AI Cost</th>
                </tr>
              </thead>
              <tbody>
                {usage.byFeature.map((r: any) => (
                  <tr key={r.featureKey} className="border-b border-zinc-700/50 last:border-0 hover:bg-zinc-700/30">
                    <td className="px-4 py-2 text-zinc-300 capitalize">{String(r.featureKey).replace(/_/g, " ")}</td>
                    <td className="px-4 py-2 text-right text-zinc-300">{r.events}</td>
                    <td className="px-4 py-2 text-right text-yellow-400">{r.creditsSpent}</td>
                    <td className="px-4 py-2 text-right text-zinc-400">${Number(r.estimatedCost).toFixed(4)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recent feature events */}
      {usage?.recent && usage.recent.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-sky-400" /> Recent Feature Events
          </h3>
          <div className="bg-zinc-800 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="border-b border-zinc-700">
                <tr>
                  <th className="text-left px-4 py-2 text-xs text-zinc-400">Feature</th>
                  <th className="text-left px-4 py-2 text-xs text-zinc-400">User</th>
                  <th className="text-right px-4 py-2 text-xs text-zinc-400">Credits</th>
                  <th className="text-right px-4 py-2 text-xs text-zinc-400">When</th>
                </tr>
              </thead>
              <tbody>
                {usage.recent.slice(0, 20).map((e: any) => (
                  <tr key={e.id} className="border-b border-zinc-700/50 last:border-0 hover:bg-zinc-700/30">
                    <td className="px-4 py-2 text-zinc-300 capitalize">{String(e.featureKey).replace(/_/g, " ")}</td>
                    <td className="px-4 py-2 text-zinc-500 text-xs truncate max-w-[120px]">{e.userId ?? "—"}</td>
                    <td className="px-4 py-2 text-right text-yellow-400">{e.creditsUsed ?? 0}</td>
                    <td className="px-4 py-2 text-right text-zinc-500 text-xs">
                      {new Date(e.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Workspaces */}
      {workspaces.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-sky-400" /> Workspaces ({workspaces.length})
          </h3>
          <div className="bg-zinc-800 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="border-b border-zinc-700">
                <tr>
                  <th className="text-left px-4 py-2 text-xs text-zinc-400">Name</th>
                  <th className="text-left px-4 py-2 text-xs text-zinc-400">Slug</th>
                  <th className="text-left px-4 py-2 text-xs text-zinc-400">Plan</th>
                  <th className="text-left px-4 py-2 text-xs text-zinc-400">Type</th>
                  <th className="text-right px-4 py-2 text-xs text-zinc-400">Created</th>
                </tr>
              </thead>
              <tbody>
                {workspaces.map((ws: any) => (
                  <tr key={ws.id} className="border-b border-zinc-700/50 last:border-0 hover:bg-zinc-700/30">
                    <td className="px-4 py-2 text-zinc-300">{ws.name}</td>
                    <td className="px-4 py-2 text-zinc-500 text-xs">/{ws.slug}</td>
                    <td className="px-4 py-2 text-purple-400 text-xs capitalize">{ws.planCode?.replace(/_/g, " ")}</td>
                    <td className="px-4 py-2 text-zinc-400 text-xs capitalize">{ws.workspaceType?.replace(/_/g, " ")}</td>
                    <td className="px-4 py-2 text-right text-zinc-500 text-xs">
                      {new Date(ws.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {usage?.byFeature?.length === 0 && workspaces.length === 0 && (
        <div className="text-center py-12">
          <BarChart3 className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
          <p className="text-zinc-500 text-sm">No feature usage events logged yet.</p>
          <p className="text-zinc-600 text-xs mt-1">Events are recorded as users interact with AI features.</p>
        </div>
      )}
    </div>
  );
}

// ─── Marketing Tab ────────────────────────────────────────────────────────────

interface MarketingStats {
  totals: { leads: number; waitlist: number; funnelEvents: number };
  leadsByType: { leadType: string; c: number | string }[];
  waitlistByType: { userType: string; c: number | string }[];
  topEvents: { eventName: string; c: number | string }[];
  topUtmCampaigns: { utm: string | null; c: number | string }[];
  topLeadSources: { source: string | null; c: number | string }[];
  recentLeads: {
    id: string; email: string; fullName: string | null; leadType: string;
    source: string | null; utmCampaign: string | null; createdAt: string;
  }[];
  recentWaitlist: {
    id: string; email: string; fullName: string | null; userType: string;
    source: string | null; createdAt: string;
  }[];
}

function MarketingTab({ call }: { call: any }) {
  const [data, setData] = useState<MarketingStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    call("/_admin/marketing-stats")
      .then((d: MarketingStats) => { setData(d); setLoading(false); })
      .catch((e: Error) => { setError(e.message); setLoading(false); });
  }, [call]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center py-20 text-zinc-500 text-sm">
        <AlertTriangle className="w-4 h-4 mr-2 text-red-500" /> {error || "Failed to load marketing stats"}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Totals */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total Leads", value: data.totals.leads, icon: <Mail className="w-4 h-4 text-blue-400" /> },
          { label: "Waitlist Signups", value: data.totals.waitlist, icon: <Users className="w-4 h-4 text-purple-400" /> },
          { label: "Funnel Events", value: data.totals.funnelEvents, icon: <Zap className="w-4 h-4 text-yellow-400" /> },
        ].map(({ label, value, icon }) => (
          <div key={label} className="bg-zinc-800 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">{icon}<span className="text-xs text-zinc-400">{label}</span></div>
            <p className="text-2xl font-bold text-white">{value.toLocaleString()}</p>
          </div>
        ))}
      </div>

      {/* Leads by type + Waitlist by type */}
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-zinc-800 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-zinc-300 mb-3">Leads by type</h3>
          <table className="w-full text-sm">
            <tbody>
              {data.leadsByType.map(r => (
                <tr key={r.leadType} className="border-b border-zinc-700 last:border-0">
                  <td className="py-2 text-zinc-300 capitalize">{r.leadType}</td>
                  <td className="py-2 text-right font-mono text-zinc-400">{Number(r.c)}</td>
                </tr>
              ))}
              {data.leadsByType.length === 0 && (
                <tr><td colSpan={2} className="py-4 text-center text-zinc-600 text-xs">No leads yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="bg-zinc-800 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-zinc-300 mb-3">Waitlist by user type</h3>
          <table className="w-full text-sm">
            <tbody>
              {data.waitlistByType.map(r => (
                <tr key={r.userType} className="border-b border-zinc-700 last:border-0">
                  <td className="py-2 text-zinc-300 capitalize">{r.userType}</td>
                  <td className="py-2 text-right font-mono text-zinc-400">{Number(r.c)}</td>
                </tr>
              ))}
              {data.waitlistByType.length === 0 && (
                <tr><td colSpan={2} className="py-4 text-center text-zinc-600 text-xs">No signups yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Top funnel events + UTM campaigns */}
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-zinc-800 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-zinc-300 mb-3">Top funnel events</h3>
          <table className="w-full text-sm">
            <tbody>
              {data.topEvents.map(r => (
                <tr key={r.eventName} className="border-b border-zinc-700 last:border-0">
                  <td className="py-2 text-zinc-300 font-mono text-xs">{r.eventName}</td>
                  <td className="py-2 text-right font-mono text-zinc-400">{Number(r.c)}</td>
                </tr>
              ))}
              {data.topEvents.length === 0 && (
                <tr><td colSpan={2} className="py-4 text-center text-zinc-600 text-xs">No events yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="bg-zinc-800 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-zinc-300 mb-3">Top UTM campaigns</h3>
          <table className="w-full text-sm">
            <tbody>
              {data.topUtmCampaigns.map(r => (
                <tr key={r.utm} className="border-b border-zinc-700 last:border-0">
                  <td className="py-2 text-zinc-300 font-mono text-xs">{r.utm ?? "(none)"}</td>
                  <td className="py-2 text-right font-mono text-zinc-400">{Number(r.c)}</td>
                </tr>
              ))}
              {data.topUtmCampaigns.length === 0 && (
                <tr><td colSpan={2} className="py-4 text-center text-zinc-600 text-xs">No UTM data yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Lead sources */}
      {data.topLeadSources.length > 0 && (
        <div className="bg-zinc-800 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-zinc-300 mb-3">Lead sources</h3>
          <table className="w-full text-sm">
            <tbody>
              {data.topLeadSources.map(r => (
                <tr key={r.source} className="border-b border-zinc-700 last:border-0">
                  <td className="py-2 text-zinc-300">{r.source ?? "(direct)"}</td>
                  <td className="py-2 text-right font-mono text-zinc-400">{Number(r.c)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Recent leads */}
      <div className="bg-zinc-800 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-zinc-300 mb-3">Recent leads</h3>
        {data.recentLeads.length === 0 ? (
          <p className="text-zinc-600 text-xs text-center py-6">No leads captured yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-zinc-700 text-zinc-500 text-left">
                  <th className="pb-2 pr-3">Email</th>
                  <th className="pb-2 pr-3">Name</th>
                  <th className="pb-2 pr-3">Type</th>
                  <th className="pb-2 pr-3">Source</th>
                  <th className="pb-2">Date</th>
                </tr>
              </thead>
              <tbody>
                {data.recentLeads.map(lead => (
                  <tr key={lead.id} className="border-b border-zinc-700/50 last:border-0">
                    <td className="py-2 pr-3 text-zinc-300">{lead.email}</td>
                    <td className="py-2 pr-3 text-zinc-400">{lead.fullName ?? "—"}</td>
                    <td className="py-2 pr-3">
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-zinc-700 text-zinc-300 capitalize">{lead.leadType}</span>
                    </td>
                    <td className="py-2 pr-3 text-zinc-500">{lead.source ?? "—"}</td>
                    <td className="py-2 text-zinc-600">{new Date(lead.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recent waitlist */}
      <div className="bg-zinc-800 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-zinc-300 mb-3">Recent waitlist signups</h3>
        {data.recentWaitlist.length === 0 ? (
          <p className="text-zinc-600 text-xs text-center py-6">No waitlist signups yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-zinc-700 text-zinc-500 text-left">
                  <th className="pb-2 pr-3">Email</th>
                  <th className="pb-2 pr-3">Name</th>
                  <th className="pb-2 pr-3">Type</th>
                  <th className="pb-2">Date</th>
                </tr>
              </thead>
              <tbody>
                {data.recentWaitlist.map(signup => (
                  <tr key={signup.id} className="border-b border-zinc-700/50 last:border-0">
                    <td className="py-2 pr-3 text-zinc-300">{signup.email}</td>
                    <td className="py-2 pr-3 text-zinc-400">{signup.fullName ?? "—"}</td>
                    <td className="py-2 pr-3">
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-zinc-700 text-zinc-300 capitalize">{signup.userType}</span>
                    </td>
                    <td className="py-2 text-zinc-600">{new Date(signup.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
