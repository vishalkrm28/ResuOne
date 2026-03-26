import { useAuth } from "@workspace/replit-auth-web";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import {
  Sparkles,
  FileText,
  Target,
  CheckCircle2,
  Download,
  ArrowRight,
  Shield,
  Zap,
  ChevronDown,
  ChevronUp,
  Star,
  Clock,
  BarChart3,
  PenLine,
  BadgeCheck,
  Crown,
} from "lucide-react";

// ─── Static data ─────────────────────────────────────────────────────────────

const trustBadges = [
  "ATS-compatible output",
  "Zero fabricated experience",
  "Edit before export",
  "PDF & DOCX upload",
  "DOCX & PDF export",
];

const steps = [
  {
    num: "01",
    icon: <FileText className="w-6 h-6" />,
    title: "Upload your current CV",
    body: "Paste your text or upload a PDF or DOCX. We extract every detail — work history, skills, education.",
  },
  {
    num: "02",
    icon: <PenLine className="w-6 h-6" />,
    title: "Paste the job description",
    body: "Copy in the full job posting. The more context you provide, the more targeted the output.",
  },
  {
    num: "03",
    icon: <Sparkles className="w-6 h-6" />,
    title: "Get an optimized resume",
    body: "ParsePilot rewrites and restructures your CV to match the role — using only what you've actually done.",
  },
  {
    num: "04",
    icon: <Download className="w-6 h-6" />,
    title: "Edit and export",
    body: "Review the result, answer any missing-info prompts, then download as DOCX or PDF.",
  },
];

const benefits = [
  {
    icon: <Clock className="w-5 h-5" />,
    title: "Cut tailoring time from hours to minutes",
    body: "Stop rewriting your CV from scratch for each job. Let ParsePilot do the restructuring while you focus on the application.",
  },
  {
    icon: <Target className="w-5 h-5" />,
    title: "Match what employers are actually looking for",
    body: "Keyword analysis shows you exactly which skills are present, which are missing, and where the gaps are.",
  },
  {
    icon: <Zap className="w-5 h-5" />,
    title: "Identify what's missing before they do",
    body: "When information is absent from your CV, ParsePilot asks you to fill it in — instead of guessing or leaving it blank.",
  },
  {
    icon: <BarChart3 className="w-5 h-5" />,
    title: "Apply to more roles, faster",
    body: "One CV becomes many. Each optimized for a different role, company, or seniority level, without the manual grind.",
  },
];

const faqs: { q: string; a: string }[] = [
  {
    q: "Does ParsePilot invent experience I don't have?",
    a: "Never. ParsePilot only uses what's already in your CV. It may reframe or restructure how your experience is presented, but it will never add roles, skills, or achievements that aren't there. This is a hard constraint, not a default setting.",
  },
  {
    q: "How do credits work?",
    a: "Free users get 3 credits to use any time. Each CV optimization or cover letter generation costs 1 credit. Exports are always free. Pro users get 100 credits per billing period, which reset automatically at the start of each new period.",
  },
  {
    q: "Can I cancel during the 7-day trial?",
    a: "Yes, at any time. If you cancel before the trial ends, you won't be charged. You can manage or cancel your subscription from Settings → Billing at any point.",
  },
  {
    q: "Can I edit the generated resume before downloading?",
    a: "Absolutely. After optimization, you'll see the full tailored CV in the editor before exporting. Nothing is final until you say so.",
  },
  {
    q: "Is the output ATS-friendly?",
    a: "Yes. ParsePilot formats the tailored CV with clean structure, standard section headers, and the keywords ATS systems look for. DOCX exports follow formatting conventions that most ATS platforms parse correctly.",
  },
  {
    q: "What file types can I upload?",
    a: "You can upload PDF or DOCX files, or paste your CV text directly. For best results, use a text-based PDF rather than a scanned image.",
  },
];

// ─── Sub-components ──────────────────────────────────────────────────────────

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-border/60 last:border-0">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-4 py-5 text-left text-sm font-medium hover:text-primary transition-colors"
      >
        {q}
        {open ? <ChevronUp className="w-4 h-4 flex-shrink-0 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 flex-shrink-0 text-muted-foreground" />}
      </button>
      {open && (
        <p className="pb-5 text-sm text-muted-foreground leading-relaxed">{a}</p>
      )}
    </div>
  );
}

function MockResultPanel() {
  const matched = ["React", "TypeScript", "Node.js", "REST API", "Agile"];
  const missing = ["Docker", "GraphQL"];
  return (
    <div className="relative w-full max-w-sm mx-auto lg:mx-0 lg:ml-auto">
      {/* Glow */}
      <div className="absolute -inset-4 bg-gradient-to-br from-violet-500/20 to-indigo-500/10 rounded-3xl blur-2xl pointer-events-none" />

      <div className="relative bg-card border border-border rounded-2xl shadow-2xl overflow-hidden text-left">
        {/* Header bar */}
        <div className="bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-3 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-white/40" />
          <div className="w-2 h-2 rounded-full bg-white/40" />
          <div className="w-2 h-2 rounded-full bg-white/40" />
          <span className="ml-2 text-xs text-white/80 font-medium">ParsePilot — Senior Frontend Engineer</span>
        </div>

        <div className="p-5 space-y-4">
          {/* Score */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Keyword match</span>
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-24 rounded-full bg-muted overflow-hidden">
                <div className="h-full w-[87%] rounded-full bg-gradient-to-r from-violet-500 to-indigo-500" />
              </div>
              <span className="text-sm font-bold text-violet-600">87%</span>
            </div>
          </div>

          {/* Matched */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Matched keywords</p>
            <div className="flex flex-wrap gap-1.5">
              {matched.map((k) => (
                <span key={k} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 text-xs font-medium border border-emerald-500/20">
                  <CheckCircle2 className="w-3 h-3" />{k}
                </span>
              ))}
            </div>
          </div>

          {/* Missing */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Missing / add if relevant</p>
            <div className="flex flex-wrap gap-1.5">
              {missing.map((k) => (
                <span key={k} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700 text-xs font-medium border border-amber-500/20">
                  {k}
                </span>
              ))}
            </div>
          </div>

          {/* CV snippet */}
          <div className="border border-border/60 rounded-lg bg-muted/30 p-3 space-y-1.5">
            <p className="text-xs font-semibold text-foreground">Tailored CV — Experience</p>
            <p className="text-xs text-muted-foreground leading-relaxed line-clamp-4">
              Led architecture of a React + TypeScript frontend serving 40k daily active users. Collaborated with backend teams on RESTful API design and Agile sprint planning. Reduced page load time by 34% through code-splitting and lazy loading…
            </p>
            <span className="inline-flex items-center gap-1 text-xs text-violet-600 font-medium">
              <Sparkles className="w-3 h-3" /> AI-tailored from your original CV
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Landing() {
  const { isAuthenticated, isLoading, login } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      setLocation("/dashboard");
    }
  }, [isAuthenticated, isLoading, setLocation]);

  return (
    <div className="min-h-screen bg-background text-foreground">

      {/* ── Nav ─────────────────────────────────────────────────────────── */}
      <nav className="border-b border-border/50 sticky top-0 z-50 bg-background/90 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold tracking-tight">ParsePilot AI</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={login}
              className="hidden sm:block text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Sign in
            </button>
            <button
              onClick={login}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              Try free <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 pt-20 pb-16">
        <div className="flex flex-col lg:flex-row items-center gap-14 lg:gap-20">

          {/* Left — copy */}
          <div className="flex-1 text-center lg:text-left max-w-xl mx-auto lg:mx-0">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/30 bg-primary/5 text-primary text-sm font-medium mb-6">
              <Sparkles className="w-3.5 h-3.5" />
              Free to start — no card required
            </div>

            <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight leading-[1.07] mb-5">
              Stop sending the
              <br />
              <span className="text-primary">same CV</span> to
              <br />
              every job.
            </h1>

            <p className="text-lg text-muted-foreground leading-relaxed mb-8 max-w-lg mx-auto lg:mx-0">
              Upload your CV, paste a job description, and ParsePilot produces a tailored resume with keyword analysis, gap detection, and an optional cover letter — in under a minute.
            </p>

            <div className="flex flex-col sm:flex-row items-center lg:items-start justify-center lg:justify-start gap-3">
              <div className="flex flex-col items-center lg:items-start gap-1 w-full sm:w-auto">
                <button
                  onClick={login}
                  className="flex items-center gap-2 px-7 py-3.5 rounded-xl bg-primary text-primary-foreground font-semibold text-base hover:opacity-90 transition-opacity shadow-md w-full sm:w-auto justify-center"
                >
                  <Sparkles className="w-4 h-4" />
                  Optimize my CV — free
                </button>
                <p className="text-xs text-muted-foreground">Takes 30 seconds · No card needed</p>
              </div>
              <div className="flex flex-col items-center lg:items-start gap-1 w-full sm:w-auto">
                <button
                  onClick={login}
                  className="flex items-center gap-2 px-6 py-3.5 rounded-xl border border-border hover:border-primary/40 font-medium text-sm transition-colors w-full sm:w-auto justify-center"
                >
                  <Star className="w-4 h-4 text-violet-500" />
                  Start 7-day trial — 100 credits free
                </button>
                <p className="text-xs text-muted-foreground">No card charged for 7 days</p>
              </div>
            </div>
          </div>

          {/* Right — mock result */}
          <div className="flex-1 w-full">
            <MockResultPanel />
          </div>
        </div>
      </section>

      {/* ── Trust strip ─────────────────────────────────────────────────── */}
      <div className="border-y border-border/40 bg-muted/20 py-4">
        <div className="max-w-6xl mx-auto px-6 flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
          {trustBadges.map((item) => (
            <div key={item} className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
              <span>{item}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── How it works ─────────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 py-24">
        <div className="text-center mb-16">
          <p className="text-primary text-sm font-semibold uppercase tracking-wider mb-3">How it works</p>
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            From raw CV to tailored application
            <br className="hidden md:block" /> in four steps
          </h2>
          <p className="text-muted-foreground text-lg max-w-lg mx-auto">
            No templates. No filler. Every output is built from your real experience.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map((s, i) => (
            <div key={s.num} className="relative">
              {/* Connector line on desktop */}
              {i < steps.length - 1 && (
                <div className="hidden lg:block absolute top-6 left-[calc(100%+12px)] w-6 border-t border-dashed border-border/60" />
              )}
              <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-4">
                {s.icon}
              </div>
              <div className="text-3xl font-black text-primary/10 leading-none mb-2">{s.num}</div>
              <h3 className="font-semibold mb-2">{s.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Benefits ────────────────────────────────────────────────────── */}
      <section className="bg-muted/20 border-y border-border/40">
        <div className="max-w-6xl mx-auto px-6 py-24">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <p className="text-primary text-sm font-semibold uppercase tracking-wider mb-3">Why ParsePilot</p>
              <h2 className="text-3xl md:text-4xl font-bold mb-6 leading-tight">
                Built for people who apply
                <br />to more than one job
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-8">
                Most candidates send the same generic CV everywhere. ParsePilot makes it practical to tailor each application — without spending hours rewriting it manually.
              </p>

              <div className="flex items-start gap-3 p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5">
                <Shield className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-sm text-emerald-800">Zero fabrication guarantee</p>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    ParsePilot never invents experience. It restructures and highlights what's already there. Every word in the output comes from your original CV.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-5">
              {benefits.map((b) => (
                <div key={b.title} className="bg-card border border-border rounded-xl p-5">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-3">
                    {b.icon}
                  </div>
                  <h3 className="font-semibold text-sm mb-2">{b.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{b.body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Pricing ──────────────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 py-24">
        <div className="text-center mb-14">
          <p className="text-primary text-sm font-semibold uppercase tracking-wider mb-3">Pricing</p>
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Simple, transparent pricing</h2>
          <p className="text-muted-foreground text-lg max-w-md mx-auto">
            Start free. Upgrade when you need more.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-6 max-w-2xl mx-auto">
          {/* Free card */}
          <div className="bg-card border border-border rounded-2xl p-7 flex flex-col">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Free</p>
            <p className="text-4xl font-bold mb-1">$0</p>
            <p className="text-sm text-muted-foreground mb-6">No card required</p>
            <ul className="space-y-2.5 text-sm flex-1 mb-7">
              {[
                "3 CV optimizations included",
                "Full keyword analysis",
                "Missing info questions",
                "No time limit on credits",
              ].map((f) => (
                <li key={f} className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            <button
              onClick={login}
              className="w-full py-2.5 rounded-xl border border-border hover:border-primary/40 text-sm font-semibold transition-colors"
            >
              Optimize my first CV — free
            </button>
          </div>

          {/* Pro card */}
          <div className="relative bg-card border-2 border-violet-500 rounded-2xl p-7 flex flex-col overflow-hidden">
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-violet-500 to-indigo-500" />
            <span className="absolute -top-3 right-5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-xs font-bold px-3 py-1 rounded-full">
              Most popular
            </span>

            <div className="flex items-center gap-2 mb-1">
              <Crown className="w-4 h-4 text-violet-500" />
              <p className="text-xs font-semibold uppercase tracking-wider text-violet-600">Pro</p>
            </div>
            <p className="text-4xl font-bold mb-1">$12<span className="text-lg font-normal text-muted-foreground">/mo</span></p>
            <p className="text-sm text-muted-foreground mb-6">
              <span className="font-semibold text-violet-600">7 days free</span> — cancel any time
            </p>
            <ul className="space-y-2.5 text-sm flex-1 mb-7">
              {[
                "100 credits per billing period",
                "Unlimited applications",
                "Cover letter generation",
                "DOCX & PDF export",
                "Missing info questions",
                "Section suggestions",
              ].map((f) => (
                <li key={f} className="flex items-center gap-2.5">
                  <BadgeCheck className="w-4 h-4 text-violet-500 flex-shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            <button
              onClick={login}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white text-sm font-semibold transition-all shadow-md"
            >
              Start 7-day free trial
            </button>
            <p className="text-center text-xs text-muted-foreground mt-3">
              No charge for 7 days. Cancel any time before trial ends.
            </p>
          </div>
        </div>

        {/* Credits explainer */}
        <div className="mt-8 max-w-2xl mx-auto rounded-xl border border-border/60 bg-muted/30 p-5 text-sm text-muted-foreground text-center">
          <span className="font-medium text-foreground">How credits work:</span>{" "}
          Each CV optimization or cover letter costs 1 credit. DOCX and PDF exports are always free. Pro credits reset at the start of each billing period.
        </div>
      </section>

      {/* ── FAQ ─────────────────────────────────────────────────────────── */}
      <section className="border-t border-border/40 bg-muted/10">
        <div className="max-w-2xl mx-auto px-6 py-24">
          <div className="text-center mb-12">
            <p className="text-primary text-sm font-semibold uppercase tracking-wider mb-3">FAQ</p>
            <h2 className="text-3xl font-bold">Common questions</h2>
          </div>
          <div className="divide-y divide-border/60 rounded-xl border border-border/60 bg-card px-6">
            {faqs.map((faq) => (
              <FaqItem key={faq.q} q={faq.q} a={faq.a} />
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ───────────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-700 px-8 py-14 text-center text-white">
          {/* Background texture */}
          <div className="absolute inset-0 opacity-10 pointer-events-none"
            style={{
              backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
              backgroundSize: "32px 32px",
            }}
          />

          <div className="relative z-10">
            <p className="text-violet-200 text-sm font-semibold uppercase tracking-wider mb-4">Start today</p>
            <h2 className="text-3xl md:text-4xl font-extrabold mb-4 leading-tight">
              Your next interview starts
              <br />with a better CV.
            </h2>
            <p className="text-violet-200 text-lg mb-8 max-w-md mx-auto">
              Free plan takes 30 seconds to set up. Pro trial gives you 7 days to see the difference.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                onClick={login}
                className="flex items-center gap-2 px-8 py-3.5 rounded-xl bg-white text-violet-700 font-bold text-base hover:bg-violet-50 transition-colors shadow-lg"
              >
                <Sparkles className="w-5 h-5" />
                Optimize my CV — free
              </button>
              <button
                onClick={login}
                className="flex items-center gap-2 px-7 py-3.5 rounded-xl border border-white/30 hover:border-white/60 font-semibold text-sm transition-colors"
              >
                <Star className="w-4 h-4" />
                Start Pro trial
              </button>
            </div>

            <p className="mt-5 text-violet-300 text-xs">
              Free plan: no card needed. Pro trial: no charge for 7 days, cancel any time.
            </p>
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer className="border-t border-border/40 py-8">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-primary flex items-center justify-center">
              <Sparkles className="w-3 h-3 text-primary-foreground" />
            </div>
            <span className="font-medium text-foreground">ParsePilot AI</span>
          </div>
          <p>Built for job seekers who take applications seriously.</p>
        </div>
      </footer>
    </div>
  );
}
