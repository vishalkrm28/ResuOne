import { useState, useCallback } from "react";
import { Shield, Search, CreditCard, Package, RefreshCw, LogOut, CheckCircle, XCircle, Loader2, ChevronDown, ChevronUp } from "lucide-react";

const STORAGE_KEY = "pp_admin_token";

interface UserState {
  user: {
    id: string;
    email: string;
    stripeCustomerId: string | null;
    stripeSubscriptionId: string | null;
    subscriptionStatus: string | null;
    subscriptionPriceId: string | null;
    currentPeriodEnd: string | null;
    createdAt: string;
  } | null;
  balance: { availableCredits: number } | null;
  bulkPasses: Array<{
    id: number;
    tier: string;
    cvLimit: number;
    cvsUsed: number;
    status: string;
    createdAt: string;
  }>;
}

interface Toast {
  id: number;
  message: string;
  type: "success" | "error";
}

function useAdminFetch(token: string) {
  const call = useCallback(
    async (path: string, options: RequestInit = {}) => {
      const res = await fetch(path, {
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
  return call;
}

export default function AdminPage() {
  const [token, setToken] = useState(() => localStorage.getItem(STORAGE_KEY) ?? "");
  const [tokenInput, setTokenInput] = useState("");
  const [authed, setAuthed] = useState(() => !!localStorage.getItem(STORAGE_KEY));

  const [userId, setUserId] = useState("");
  const [userState, setUserState] = useState<UserState | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [expanded, setExpanded] = useState(true);

  const [grantCredits, setGrantCredits] = useState("10");
  const [bulkTier, setBulkTier] = useState("25");

  const call = useAdminFetch(token);

  function addToast(message: string, type: "success" | "error") {
    const id = Date.now();
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
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
    setToken("");
    setTokenInput("");
    setAuthed(false);
    setUserState(null);
    setUserId("");
  }

  async function lookupUser() {
    if (!userId.trim()) return;
    setLoading("lookup");
    try {
      const data = await call(`/api/_admin/check-user/${userId.trim()}`);
      setUserState(data);
      setExpanded(true);
    } catch (e: any) {
      addToast(e.message, "error");
    } finally {
      setLoading(null);
    }
  }

  async function doGrantCredits() {
    if (!userId.trim()) return;
    setLoading("credits");
    try {
      await call("/api/_admin/seed-credits", {
        method: "POST",
        body: JSON.stringify({ userId: userId.trim(), credits: Number(grantCredits) }),
      });
      addToast(`Granted ${grantCredits} credits`, "success");
      await lookupUser();
    } catch (e: any) {
      addToast(e.message, "error");
    } finally {
      setLoading(null);
    }
  }

  async function doGrantBulk() {
    if (!userId.trim()) return;
    setLoading("bulk");
    try {
      await call("/api/_admin/seed-bulk", {
        method: "POST",
        body: JSON.stringify({ userId: userId.trim(), tier: bulkTier }),
      });
      addToast(`Granted bulk pass (${bulkTier} CVs)`, "success");
      await lookupUser();
    } catch (e: any) {
      addToast(e.message, "error");
    } finally {
      setLoading(null);
    }
  }

  async function doSyncStripe() {
    if (!userId.trim()) return;
    setLoading("stripe");
    try {
      const data = await call("/api/_admin/sync-stripe", {
        method: "POST",
        body: JSON.stringify({ userId: userId.trim() }),
      });
      addToast(data.message ?? "Stripe synced", "success");
      await lookupUser();
    } catch (e: any) {
      addToast(e.message, "error");
    } finally {
      setLoading(null);
    }
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
              <p className="text-sm text-zinc-400 mt-1">ParsePilot AI</p>
            </div>
          </div>
          <div className="space-y-3">
            <input
              type="password"
              placeholder="Admin token"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
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

  const sub = userState?.user;
  const balance = userState?.balance;
  const passes = userState?.bulkPasses ?? [];

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Toasts */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm shadow-lg border ${
              t.type === "success"
                ? "bg-green-900/90 border-green-700 text-green-100"
                : "bg-red-900/90 border-red-700 text-red-100"
            }`}
          >
            {t.type === "success" ? (
              <CheckCircle className="w-4 h-4 flex-shrink-0" />
            ) : (
              <XCircle className="w-4 h-4 flex-shrink-0" />
            )}
            {t.message}
          </div>
        ))}
      </div>

      {/* Header */}
      <header className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Shield className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h1 className="text-base font-semibold">Admin Panel</h1>
            <p className="text-xs text-zinc-400">ParsePilot AI</p>
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

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        {/* User lookup */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4">
          <h2 className="text-sm font-medium text-zinc-300">Look up user</h2>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="user_xxxxxxxxxxxxxxxxxxxx"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && lookupUser()}
              className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-primary font-mono"
            />
            <button
              onClick={lookupUser}
              disabled={loading === "lookup"}
              className="flex items-center gap-2 bg-primary text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {loading === "lookup" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
              Look up
            </button>
          </div>
          <p className="text-xs text-zinc-500">Find the user ID in Clerk Dashboard → Users → click user</p>
        </div>

        {/* User info */}
        {userState && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
            <button
              onClick={() => setExpanded(!expanded)}
              className="w-full flex items-center justify-between px-6 py-4 text-sm font-medium text-zinc-300 hover:text-white transition-colors"
            >
              <span>User details</span>
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {expanded && (
              <div className="border-t border-zinc-800 p-6 space-y-4">
                {!sub ? (
                  <p className="text-sm text-zinc-400">User not found in database</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <InfoRow label="Email" value={sub.email ?? "—"} />
                    <InfoRow label="User ID" value={sub.id} mono />
                    <InfoRow
                      label="Credits"
                      value={balance?.availableCredits?.toString() ?? "0"}
                      highlight={balance?.availableCredits === 0 ? "red" : "green"}
                    />
                    <InfoRow
                      label="Subscription"
                      value={sub.subscriptionStatus ?? "none"}
                      highlight={sub.subscriptionStatus === "active" ? "green" : "zinc"}
                    />
                    <InfoRow label="Stripe customer" value={sub.stripeCustomerId ?? "—"} mono />
                    <InfoRow
                      label="Period end"
                      value={
                        sub.currentPeriodEnd
                          ? new Date(sub.currentPeriodEnd).toLocaleDateString()
                          : "—"
                      }
                    />
                    <InfoRow
                      label="Joined"
                      value={new Date(sub.createdAt).toLocaleDateString()}
                    />
                  </div>
                )}

                {passes.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <p className="text-xs text-zinc-400 font-medium uppercase tracking-wide">Bulk passes</p>
                    {passes.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between bg-zinc-800 rounded-lg px-4 py-2.5 text-sm"
                      >
                        <span className="text-zinc-300">
                          {p.tier}-CV pass
                        </span>
                        <span className="text-zinc-400">
                          {p.cvsUsed} / {p.cvLimit} used ·{" "}
                          <span
                            className={
                              p.status === "paid" ? "text-green-400" : "text-zinc-500"
                            }
                          >
                            {p.status}
                          </span>
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Actions — only shown once a user is loaded */}
        {userId && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Grant credits */}
            <ActionCard
              icon={<CreditCard className="w-4 h-4" />}
              title="Grant credits"
              loading={loading === "credits"}
              onAction={doGrantCredits}
              actionLabel="Grant"
            >
              <input
                type="number"
                min="1"
                max="1000"
                value={grantCredits}
                onChange={(e) => setGrantCredits(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </ActionCard>

            {/* Grant bulk pass */}
            <ActionCard
              icon={<Package className="w-4 h-4" />}
              title="Grant bulk pass"
              loading={loading === "bulk"}
              onAction={doGrantBulk}
              actionLabel="Grant"
            >
              <select
                value={bulkTier}
                onChange={(e) => setBulkTier(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="10">10 CVs</option>
                <option value="25">25 CVs</option>
                <option value="50">50 CVs</option>
              </select>
            </ActionCard>

            {/* Sync Stripe */}
            <ActionCard
              icon={<RefreshCw className="w-4 h-4" />}
              title="Sync Stripe"
              loading={loading === "stripe"}
              onAction={doSyncStripe}
              actionLabel="Sync now"
            >
              <p className="text-xs text-zinc-400 leading-relaxed">
                Re-fetches subscription status from Stripe and updates the database.
              </p>
            </ActionCard>
          </div>
        )}
      </div>
    </div>
  );
}

function InfoRow({
  label,
  value,
  mono,
  highlight,
}: {
  label: string;
  value: string;
  mono?: boolean;
  highlight?: "green" | "red" | "zinc";
}) {
  const valueClass =
    highlight === "green"
      ? "text-green-400"
      : highlight === "red"
        ? "text-red-400"
        : mono
          ? "text-zinc-300 font-mono text-xs truncate"
          : "text-zinc-300";

  return (
    <div className="space-y-1">
      <p className="text-xs text-zinc-500 uppercase tracking-wide">{label}</p>
      <p className={`text-sm ${valueClass}`}>{value}</p>
    </div>
  );
}

function ActionCard({
  icon,
  title,
  children,
  loading,
  onAction,
  actionLabel,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  loading: boolean;
  onAction: () => void;
  actionLabel: string;
}) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4 flex flex-col">
      <div className="flex items-center gap-2 text-zinc-300">
        {icon}
        <span className="text-sm font-medium">{title}</span>
      </div>
      <div className="flex-1">{children}</div>
      <button
        onClick={onAction}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-50 transition-colors"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
        {actionLabel}
      </button>
    </div>
  );
}
