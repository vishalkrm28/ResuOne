import { useState, useCallback, useEffect } from "react";
import {
  Shield, Search, CreditCard, Package, RefreshCw, LogOut,
  CheckCircle, XCircle, Loader2, Trash2, ChevronRight,
  ChevronDown, Users, BarChart3, AlertTriangle, X, FileText, Star,
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
interface Application {
  id: string; jobTitle: string; company: string;
  keywordMatchScore: number | null; status: string | null; createdAt: string;
}
interface Stats {
  totalUsers: number; totalApplications: number;
  totalBulkPasses: number; proUsers: number;
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
  const [tab, setTab] = useState<"users" | "stats">("users");

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
            {(["users", "stats"] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  tab === t ? "bg-zinc-800 text-white" : "text-zinc-400 hover:text-white"
                }`}
              >
                {t === "users" ? <Users className="w-3.5 h-3.5" /> : <BarChart3 className="w-3.5 h-3.5" />}
                {t.charAt(0).toUpperCase() + t.slice(1)}
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
      </div>
    </div>
  );
}

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

  const cards = [
    { label: "Total users", value: stats?.totalUsers ?? 0, color: "text-blue-400" },
    { label: "Pro subscribers", value: stats?.proUsers ?? 0, color: "text-purple-400" },
    { label: "Total CV analyses", value: stats?.totalApplications ?? 0, color: "text-green-400" },
    { label: "Bulk passes sold", value: stats?.totalBulkPasses ?? 0, color: "text-orange-400" },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      {cards.map(c => (
        <div key={c.label} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
          <p className="text-xs text-zinc-400 uppercase tracking-wide">{c.label}</p>
          <p className={`text-3xl font-bold mt-2 ${c.color}`}>{c.value.toLocaleString()}</p>
        </div>
      ))}
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
    ])
      .then(([d, a]: any) => { setDetail(d); setApps(a.applications); })
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
    const [d, a]: any = await Promise.all([
      call(`/_admin/check-user/${user.id}`),
      call(`/_admin/user/${user.id}/applications`),
    ]);
    setDetail(d);
    setApps(a.applications);
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
                <InfoBox label="Subscription" value={detail?.user?.subscriptionStatus ?? "none"} highlight={detail?.user?.subscriptionStatus === "active" ? "green" : undefined} />
                <InfoBox label="CV analyses" value={apps.length.toString()} />
                <InfoBox label="Bulk passes" value={detail?.bulkPasses?.length?.toString() ?? "0"} />
              </div>

              {/* Actions row */}
              <div className="flex flex-wrap gap-2">
                <div className="flex items-center gap-1.5">
                  <input
                    type="number" min="1" max="1000" value={credits}
                    onChange={e => setCredits(e.target.value)}
                    className="w-16 bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <ActionBtn icon={<CreditCard className="w-3.5 h-3.5" />} label="Grant credits" loading={actionLoading === "credits"} onClick={grantCredits} />
                </div>
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
