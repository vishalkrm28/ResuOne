import { useState } from "react";
import { Link } from "wouter";
import { Footer } from "@/components/layout/footer";
import { LogoBrand } from "@/components/brand/logo";
import {
  ChevronDown,
  ChevronUp,
  MessageCircle,
  FileText,
  CreditCard,
  Users,
  Zap,
  ArrowRight,
  Mail,
} from "lucide-react";

// ─── Data ────────────────────────────────────────────────────────────────────

const sections = [
  {
    id: "getting-started",
    icon: <Zap className="w-5 h-5" />,
    title: "Getting Started",
    items: [
      {
        q: "How do I analyze my CV?",
        a: "Sign in, then click 'New Analysis'. Upload your CV as a PDF or DOCX (or paste the text directly), paste in the job description, and hit Analyze. Your match score and keyword gaps appear in seconds.",
      },
      {
        q: "Do I need to create an account?",
        a: "You can try one analysis without an account using your IP allowance. To save your results and run more analyses, sign in with Google, Apple, or email.",
      },
      {
        q: "What file formats does ResuOne accept?",
        a: "PDF and DOCX uploads are supported, as well as plain text paste. Most standard CV formats work correctly.",
      },
      {
        q: "How long does an analysis take?",
        a: "Usually 10–20 seconds. If it takes longer, check your connection and try refreshing.",
      },
    ],
  },
  {
    id: "cv-analysis",
    icon: <FileText className="w-5 h-5" />,
    title: "CV Analysis",
    items: [
      {
        q: "What does the match score mean?",
        a: "It's a percentage that reflects how closely your CV aligns with the specific job description — based on keywords, experience framing, and requirements coverage. A higher score means better keyword alignment.",
      },
      {
        q: "Will ResuOne add experience I don't have?",
        a: "Never. ResuOne only uses what's in your original CV. It restructures and sharpens how your real experience is presented — it never invents roles, skills, or achievements.",
      },
      {
        q: "Can I edit the CV before downloading?",
        a: "Yes. After unlocking, the full tailored CV opens in an editor. Review and adjust anything before exporting.",
      },
      {
        q: "What's included in the free analysis?",
        a: "The match score, missing keywords list, and a partial preview of the optimised output are always free. The complete rewritten CV and cover letter require a one-time $6.99 unlock.",
      },
      {
        q: "Is the output ATS-friendly?",
        a: "Yes. ResuOne uses standard section headers and the exact keyword language ATS systems filter for. DOCX exports follow formatting conventions most parsers handle correctly.",
      },
    ],
  },
  {
    id: "billing",
    icon: <CreditCard className="w-5 h-5" />,
    title: "Billing",
    items: [
      {
        q: "How does the $6.99 unlock work?",
        a: "After analysis you see a preview. Pay $6.99 once for that result and the full optimised CV, cover letter, and export unlock immediately. No subscription. No recurring charge. The result is yours permanently.",
      },
      {
        q: "What does the Pro plan include?",
        a: "Pro gives you 100 credits per month at $14.99. Each CV optimisation or cover letter costs 1 credit. Exports are always free. Credits reset at the start of each billing period.",
      },
      {
        q: "Can I cancel my Pro subscription?",
        a: "Yes, any time from Settings → Billing. You won't be charged for the next period after cancelling, and you keep access until the end of the current period.",
      },
      {
        q: "What payment methods are accepted?",
        a: "All major credit and debit cards are accepted via Stripe. Apple Pay and Google Pay are also supported on supported browsers.",
      },
      {
        q: "Do unused Pro credits roll over?",
        a: "No. Pro credits reset at the start of each billing period. If you apply frequently, make sure to use your credits before they reset.",
      },
    ],
  },
  {
    id: "recruiter",
    icon: <Users className="w-5 h-5" />,
    title: "Recruiter Mode",
    items: [
      {
        q: "What is Recruiter Mode?",
        a: "Recruiter Mode lets you screen multiple candidates against a job description. Upload candidate CVs, get match scores for each, then invite shortlisted candidates by email — all from one dashboard.",
      },
      {
        q: "What's the difference between Solo and Team plans?",
        a: "Solo ($29.99/mo) is for individual recruiters. Team ($79/mo) includes 3 seats — an owner plus 2 members — who all share the same candidate pipeline and pool.",
      },
      {
        q: "How do I invite a team member?",
        a: "From your Recruiter Dashboard, go to the Team tab and enter your colleague's email address. They'll receive an invite link to join your team.",
      },
      {
        q: "Can I remove a team member?",
        a: "Yes. Team owners can remove members from the Team tab at any time. Members can also leave the team themselves.",
      },
      {
        q: "How does the candidate invite work?",
        a: "From the candidate pipeline, click Invite on any candidate. Enter a message and send — ResuOne emails the candidate on your behalf. You can track who has accepted, declined, or not yet responded.",
      },
      {
        q: "Does Recruiter Mode cancel my Pro subscription?",
        a: "No. Recruiter Mode and Pro are separate add-ons. You can hold a Pro subscription and a Recruiter plan at the same time.",
      },
    ],
  },
];

// ─── Sub-components ──────────────────────────────────────────────────────────

function HelpItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-border/60 last:border-0">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-4 py-4 text-left text-sm font-medium hover:text-primary transition-colors"
      >
        <span>{q}</span>
        {open ? (
          <ChevronUp className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
        )}
      </button>
      {open && (
        <p className="pb-4 text-sm text-muted-foreground leading-relaxed">{a}</p>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function HelpPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">

      {/* Nav */}
      <nav className="border-b border-border/50 sticky top-0 z-50 bg-background/90 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/">
            <LogoBrand size="md" />
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              ← Back to home
            </Link>
          </div>
        </div>
      </nav>

      {/* Header */}
      <div className="max-w-3xl mx-auto px-6 pt-16 pb-10 text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 text-primary mb-6">
          <MessageCircle className="w-6 h-6" />
        </div>
        <h1 className="text-4xl font-extrabold mb-4">Help Centre</h1>
        <p className="text-lg text-muted-foreground">
          Answers to common questions about ResuOne. Can't find what you need?{" "}
          <a href="mailto:help@resuone.com" className="text-primary hover:underline font-medium">
            Email us
          </a>
          .
        </p>
      </div>

      {/* Quick nav */}
      <div className="max-w-3xl mx-auto px-6 mb-10">
        <div className="grid sm:grid-cols-4 gap-3">
          {sections.map((s) => (
            <button
              key={s.id}
              onClick={() => {
                const el = document.getElementById(s.id);
                if (el) {
                  const offset = 80;
                  const top = el.getBoundingClientRect().top + window.scrollY - offset;
                  window.scrollTo({ top, behavior: "smooth" });
                }
              }}
              className="flex items-center gap-2.5 p-3.5 rounded-xl border border-border/60 bg-card hover:border-primary/40 hover:bg-muted/30 transition-colors text-sm font-medium text-left"
            >
              <span className="text-primary">{s.icon}</span>
              {s.title}
            </button>
          ))}
        </div>
      </div>

      {/* Sections */}
      <div className="max-w-3xl mx-auto px-6 pb-20 space-y-12">
        {sections.map((section) => (
          <div key={section.id} id={section.id}>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                {section.icon}
              </div>
              <h2 className="text-xl font-bold">{section.title}</h2>
            </div>
            <div className="rounded-xl border border-border/60 bg-card px-6 divide-y divide-border/60">
              {section.items.map((item) => (
                <HelpItem key={item.q} q={item.q} a={item.a} />
              ))}
            </div>
          </div>
        ))}

        {/* Contact block */}
        <div className="rounded-2xl border border-border/60 bg-muted/20 p-8 text-center">
          <Mail className="w-8 h-8 text-primary mx-auto mb-4" />
          <h3 className="text-xl font-bold mb-2">Still need help?</h3>
          <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
            Our support team is here. Email us and we'll get back to you as soon as we can.
          </p>
          <a
            href="mailto:help@resuone.com"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-opacity"
          >
            <Mail className="w-4 h-4" />
            help@resuone.com
            <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      </div>

      <Footer />
    </div>
  );
}
