import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { getTeamInvite, acceptTeamInvite } from "@/lib/recruiter-api";
import { useAuth } from "@clerk/clerk-react";
import { Link } from "wouter";
import { LogoBrand } from "@/components/brand/logo";
import { Users, CheckCircle2, AlertTriangle, Loader2, ArrowRight, LogIn } from "lucide-react";

export default function TeamJoin() {
  const { token } = useParams<{ token: string }>();
  const [, navigate] = useLocation();
  const { isSignedIn, isLoaded } = useAuth();
  const [joined, setJoined] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["team-invite", token],
    queryFn: () => getTeamInvite(token!),
    enabled: !!token,
    retry: false,
  });

  const acceptMutation = useMutation({
    mutationFn: () => acceptTeamInvite(token!),
    onSuccess: () => setJoined(true),
  });

  // After joining, redirect to recruiter dashboard after 3s
  useEffect(() => {
    if (joined) {
      const t = setTimeout(() => navigate("/recruiter/dashboard"), 3000);
      return () => clearTimeout(t);
    }
  }, [joined, navigate]);

  // Loading states
  if (!isLoaded || isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  // Invite not found
  if (error || !data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <div className="max-w-md w-full text-center">
          <div className="w-14 h-14 rounded-2xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center mx-auto mb-5">
            <AlertTriangle className="w-7 h-7 text-red-500" />
          </div>
          <h1 className="text-xl font-bold text-foreground mb-2">Invite not found</h1>
          <p className="text-muted-foreground text-sm mb-6">
            This invite link may have expired, already been used, or cancelled by the team owner.
          </p>
          <Link href="/" className="text-primary hover:underline text-sm">← Back to ResuOne</Link>
        </div>
      </div>
    );
  }

  // Already used
  if (data.invite?.status !== "pending") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <div className="max-w-md w-full text-center">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center mx-auto mb-5">
            <AlertTriangle className="w-7 h-7 text-amber-500" />
          </div>
          <h1 className="text-xl font-bold text-foreground mb-2">Invite already {data.invite?.status}</h1>
          <p className="text-muted-foreground text-sm mb-6">This invite link has already been used.</p>
          <Link href="/recruiter/dashboard" className="text-primary hover:underline text-sm">Go to Recruiter Dashboard →</Link>
        </div>
      </div>
    );
  }

  // Successfully joined
  if (joined) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-2xl bg-green-50 dark:bg-green-900/20 flex items-center justify-center mx-auto mb-5">
            <CheckCircle2 className="w-8 h-8 text-green-500" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">You're in!</h1>
          <p className="text-muted-foreground text-sm mb-2">
            You've joined <strong>{data.ownerName}'s</strong> recruiter team.
          </p>
          <p className="text-xs text-muted-foreground mb-6">Redirecting to your dashboard…</p>
          <Link href="/recruiter/dashboard" className="inline-flex items-center gap-2 bg-primary text-primary-foreground font-semibold px-5 py-2.5 rounded-xl hover:bg-primary/90 transition-colors text-sm">
            Go to Dashboard <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/40 bg-background/95 backdrop-blur sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center">
          <Link href="/">
            <LogoBrand size="md" />
          </Link>
        </div>
      </header>

      <main className="max-w-md mx-auto px-6 py-20 text-center">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
          <Users className="w-8 h-8 text-primary" />
        </div>

        <h1 className="text-2xl font-extrabold text-foreground mb-3">
          Join {data.ownerName}'s recruiter team
        </h1>
        <p className="text-muted-foreground text-sm mb-8 leading-relaxed">
          You've been invited to collaborate on the recruiting pipeline. Once you accept, you'll share access to the candidate pool, pipeline view, and analytics.
        </p>

        <div className="bg-muted/20 border border-border/40 rounded-2xl p-5 mb-8 text-left space-y-2">
          {["Shared candidate pipeline", "Send interview & test invites", "View analytics & acceptance rates", "Timestamped candidate notes"].map(f => (
            <div key={f} className="flex items-center gap-2.5 text-sm text-foreground">
              <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" /> {f}
            </div>
          ))}
        </div>

        {!isSignedIn ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">You need to sign in to accept this invitation.</p>
            <Link
              href={`/sign-in?redirect_url=${encodeURIComponent(window.location.pathname)}`}
              className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground font-semibold py-3 rounded-xl hover:bg-primary/90 transition-all text-sm"
            >
              <LogIn className="w-4 h-4" /> Sign in to accept
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            <button
              onClick={() => acceptMutation.mutate()}
              disabled={acceptMutation.isPending}
              className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground font-semibold py-3 rounded-xl hover:bg-primary/90 transition-all text-sm disabled:opacity-50"
            >
              {acceptMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Accept invitation
            </button>
            {acceptMutation.isError && (
              <p className="text-xs text-red-500">{(acceptMutation.error as any)?.message}</p>
            )}
            <p className="text-xs text-muted-foreground">Invite sent to {data.invite?.invitedEmail}</p>
          </div>
        )}
      </main>
    </div>
  );
}
