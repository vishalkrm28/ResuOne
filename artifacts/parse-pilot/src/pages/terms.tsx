import { Link } from "wouter";
import { Sparkles, ArrowLeft } from "lucide-react";
import { Footer } from "@/components/layout/footer";

const sections: { title: string; content: React.ReactNode }[] = [
  {
    title: "Introduction",
    content: (
      <p>
        ParsePilot provides AI-assisted resume analysis and optimization tools. By using this
        service, you agree to these terms. If you don't agree, please don't use the service.
      </p>
    ),
  },
  {
    title: "Use of Service",
    content: (
      <ul className="list-disc list-inside space-y-2">
        <li>Use ParsePilot for personal job applications only.</li>
        <li>Do not copy, resell, or exploit the platform or its outputs.</li>
        <li>Do not attempt to reverse-engineer, scrape, or overload the service.</li>
      </ul>
    ),
  },
  {
    title: "No Guarantees",
    content: (
      <>
        <p>
          ParsePilot provides suggestions and analysis only. We don't guarantee any specific
          outcome — including interviews, job offers, or application success.
        </p>
        <p className="mt-3">
          AI-generated content is a starting point. Always review and personalise what's
          produced before submitting it.
        </p>
      </>
    ),
  },
  {
    title: "Your Responsibility",
    content: (
      <ul className="list-disc list-inside space-y-2">
        <li>You are responsible for reviewing all generated content before use.</li>
        <li>Do not include false, misleading, or fabricated information in your applications.</li>
        <li>ParsePilot will never invent experience — but you must verify what's produced.</li>
      </ul>
    ),
  },
  {
    title: "Output & Formatting",
    content: (
      <>
        <p>
          ParsePilot is designed as a CV analysis and optimization tool.
        </p>
        <p className="mt-3">
          While we aim to preserve the structure and clarity of your CV, formatting and layout may
          vary depending on the content and processing. ParsePilot does not guarantee exact
          formatting replication and is not intended to function as a resume builder.
        </p>
        <p className="mt-3">
          Users are responsible for reviewing and finalizing the formatting before using their CV
          for applications.
        </p>
      </>
    ),
  },
  {
    title: "Payments",
    content: (
      <>
        <p>
          One-time unlocks and subscription fees are non-refundable unless required by applicable
          law. Pricing may change over time — we'll communicate any changes in advance.
        </p>
        <p className="mt-3">
          Payments are processed securely by Stripe. ParsePilot does not store your payment card
          details.
        </p>
      </>
    ),
  },
  {
    title: "Plans, Credits & Restrictions",
    content: (
      <>
        <p className="mb-4">
          ParsePilot operates on a credit-based system. Each AI analysis consumes one credit.
          Credits are allocated monthly and do not roll over to the next billing period.
        </p>

        {/* Free Plan */}
        <div className="mb-5">
          <p className="font-semibold text-foreground mb-2">Free Plan</p>
          <ul className="list-disc list-inside space-y-1">
            <li>3 AI analyses per month, reset on the 1st of each month.</li>
            <li>Results are locked behind a one-time $6.99 per-result unlock fee.</li>
            <li>Access to keyword gap preview and ATS score only.</li>
            <li>Bulk Mode is not available on the Free plan.</li>
            <li>Cover letter generation is not available on the Free plan.</li>
          </ul>
        </div>

        {/* Pro Plan */}
        <div className="mb-5">
          <p className="font-semibold text-foreground mb-2">Pro Plan — $14.99/month</p>
          <ul className="list-disc list-inside space-y-1">
            <li>100 AI analyses per month.</li>
            <li>All results fully unlocked — no per-result fees.</li>
            <li>Full access to ATS-optimised CV output, keyword analysis, cover letter generation, and section suggestions.</li>
            <li>Pro is intended for personal use — you may re-analyse your own CV against different job descriptions as many times as you like within your monthly credit allowance.</li>
            <li>Analysing CVs belonging to other individuals is not permitted under the Pro plan. Use Bulk Mode for multi-candidate analysis.</li>
            <li>Unused monthly credits expire at the end of each billing cycle and do not carry over.</li>
            <li>Pro subscription renews automatically each month until cancelled.</li>
            <li>You may cancel at any time; access continues until the end of the current billing period.</li>
            <li>Pro credits cannot be transferred, gifted, or applied to Bulk Mode passes.</li>
          </ul>
        </div>

        {/* Bulk Mode */}
        <div className="mb-5">
          <p className="font-semibold text-foreground mb-2">Bulk Mode — One-Time Passes</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Available in three tiers: 10 CV slots ($19.99), 25 CV slots ($29.99), and 50 CV slots ($39.99).</li>
            <li>Each slot covers one full candidate CV analysis with ATS score, keyword gaps, and optimised CV output.</li>
            <li>No per-result unlock fees apply within a Bulk pass.</li>
            <li>Passes are one-time purchases and do not renew automatically.</li>
            <li>Unused slots within a pass do not expire and remain available until consumed.</li>
            <li>Multiple passes may be purchased and will stack — slots are consumed from the most recently purchased pass first.</li>
            <li>Bulk passes are non-transferable and are tied to the purchasing account.</li>
          </ul>
        </div>

        {/* General */}
        <div>
          <p className="font-semibold text-foreground mb-2">General Credit Restrictions</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Credits and passes are non-refundable once consumed.</li>
            <li>Unused credits or passes are non-refundable upon account deletion.</li>
            <li>ParsePilot reserves the right to adjust plan limits or pricing with advance notice.</li>
          </ul>
        </div>
      </>
    ),
  },
  {
    title: "Limitation of Liability",
    content: (
      <p>
        ParsePilot is not responsible for decisions made based on generated output, or for any
        direct or indirect losses arising from use of the service. Use it as a tool, not as
        professional career advice.
      </p>
    ),
  },
  {
    title: "Changes to These Terms",
    content: (
      <p>
        We may update these terms over time. Continued use of ParsePilot after changes are
        published constitutes acceptance of the revised terms.
      </p>
    ),
  },
];

export default function Terms() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Nav */}
      <header className="border-b border-border/40 bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Back to ParsePilot
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-primary flex items-center justify-center">
              <Sparkles className="w-3 h-3 text-primary-foreground" />
            </div>
            <span className="font-bold text-sm">ParsePilot</span>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 max-w-2xl mx-auto px-6 py-16 w-full">
        <div className="mb-12">
          <p className="text-primary text-sm font-semibold uppercase tracking-wider mb-3">Legal</p>
          <h1 className="text-4xl font-extrabold tracking-tight text-foreground mb-4">
            Terms of Service
          </h1>
          <p className="text-muted-foreground text-sm">Last updated: March 2026</p>
        </div>

        <div className="space-y-10">
          {sections.map((s, i) => (
            <section key={s.title}>
              <h2 className="text-base font-bold text-foreground mb-3 flex items-center gap-3">
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0">
                  {i + 1}
                </span>
                {s.title}
              </h2>
              <div className="text-muted-foreground text-sm leading-relaxed pl-9">
                {s.content}
              </div>
            </section>
          ))}
        </div>

        <div className="mt-16 pt-8 border-t border-border/40 text-xs text-muted-foreground/60 flex gap-4">
          <Link href="/privacy" className="hover:text-muted-foreground transition-colors">
            Privacy Policy
          </Link>
          <Link href="/" className="hover:text-muted-foreground transition-colors">
            Back to home
          </Link>
        </div>
      </main>

      <Footer />
    </div>
  );
}
