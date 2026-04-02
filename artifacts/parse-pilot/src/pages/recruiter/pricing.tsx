import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { startRecruiterCheckout } from "@/lib/recruiter-api";
import { CheckCircle2, Users, Zap, Shield, ArrowRight, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const SOLO_FEATURES = [
  "Unlimited candidate pipeline",
  "Interview & test invite emails",
  "Import from CV analyses",
  "CSV bulk import",
  "Kanban pipeline view",
  "Acceptance rate analytics",
  "Timestamped candidate notes",
];

const TEAM_FEATURES = [
  "Everything in Solo",
  "3 recruiter seats",
  "Shared candidate pool",
  "Team analytics dashboard",
  "Priority email support",
  "White-label invite emails",
];

export default function RecruiterPricing() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [selectedPlan, setSelectedPlan] = useState<"solo" | "team" | null>(null);

  const checkoutMutation = useMutation({
    mutationFn: (plan: "solo" | "team") => {
      const base = window.location.origin;
      return startRecruiterCheckout(plan, `${base}/recruiter/dashboard`, `${base}/recruiter/pricing`);
    },
    onSuccess: ({ url }) => { window.location.href = url; },
    onError: (err: any) => toast({ title: "Checkout failed", description: err.message, variant: "destructive" }),
  });

  const handleStart = (plan: "solo" | "team") => {
    setSelectedPlan(plan);
    checkoutMutation.mutate(plan);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <header className="border-b border-border/40 bg-background/95 backdrop-blur sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center">
            <img src="/resuone-logo.png" alt="ResuOne" className="h-8 w-auto object-contain" />
          </Link>
          <Link href="/recruiter/dashboard" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            ← Back to Dashboard
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-16">
        {/* Hero */}
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
            <Users className="w-3.5 h-3.5" /> Recruiter Add-on
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight text-foreground mb-4">
            Turn ResuOne into your full hiring workflow
          </h1>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            Manage candidates, send interview invites, track responses, and import directly from CV analyses — all in one place.
          </p>
        </div>

        {/* Pricing cards */}
        <div className="grid md:grid-cols-2 gap-6 mb-12">
          {/* Solo */}
          <div className="border border-border/40 rounded-2xl p-7 hover:border-primary/30 transition-all">
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <Zap className="w-5 h-5 text-primary" />
                <span className="font-bold text-foreground text-lg">Solo Recruiter</span>
              </div>
              <div className="flex items-end gap-1 mb-1">
                <span className="text-4xl font-extrabold text-foreground">$29.99</span>
                <span className="text-muted-foreground text-sm mb-1">/month</span>
              </div>
              <p className="text-muted-foreground text-sm">For individual recruiters and hiring managers</p>
            </div>

            <ul className="space-y-3 mb-8">
              {SOLO_FEATURES.map(f => (
                <li key={f} className="flex items-start gap-2.5 text-sm text-foreground">
                  <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                  {f}
                </li>
              ))}
            </ul>

            <button onClick={() => handleStart("solo")}
              disabled={checkoutMutation.isPending}
              className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground font-semibold py-3 rounded-xl hover:bg-primary/90 transition-all text-sm disabled:opacity-50">
              {checkoutMutation.isPending && selectedPlan === "solo"
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <ArrowRight className="w-4 h-4" />}
              Start Solo Plan
            </button>
          </div>

          {/* Team */}
          <div className="border-2 border-primary rounded-2xl p-7 relative bg-primary/2">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-full">
              BEST FOR TEAMS
            </div>
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <Users className="w-5 h-5 text-primary" />
                <span className="font-bold text-foreground text-lg">Team</span>
              </div>
              <div className="flex items-end gap-1 mb-1">
                <span className="text-4xl font-extrabold text-foreground">$79</span>
                <span className="text-muted-foreground text-sm mb-1">/month</span>
              </div>
              <p className="text-muted-foreground text-sm">3 seats · shared pipeline · team analytics</p>
            </div>

            <ul className="space-y-3 mb-8">
              {TEAM_FEATURES.map(f => (
                <li key={f} className="flex items-start gap-2.5 text-sm text-foreground">
                  <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                  {f}
                </li>
              ))}
            </ul>

            <button onClick={() => handleStart("team")}
              disabled={checkoutMutation.isPending}
              className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground font-semibold py-3 rounded-xl hover:bg-primary/90 transition-all text-sm disabled:opacity-50">
              {checkoutMutation.isPending && selectedPlan === "team"
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <ArrowRight className="w-4 h-4" />}
              Start Team Plan
            </button>
          </div>
        </div>

        {/* Trust line */}
        <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5"><Shield className="w-4 h-4" /> Cancel any time</span>
          <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4" /> Separate from job seeker Pro</span>
          <span className="flex items-center gap-1.5"><Zap className="w-4 h-4" /> Instant access after payment</span>
        </div>

        {/* White-label callout */}
        <div className="mt-14 border border-border/40 rounded-2xl p-6 text-center">
          <p className="font-semibold text-foreground mb-2">Running an HR agency or staffing firm?</p>
          <p className="text-muted-foreground text-sm mb-4">
            ResuOne Recruiter can be white-labelled with your branding. Invite emails, pipeline, and candidate pages — all under your name.
          </p>
          <Link href="/contact" className="text-primary hover:underline text-sm font-medium">
            Contact us about white-label →
          </Link>
        </div>
      </main>
    </div>
  );
}
