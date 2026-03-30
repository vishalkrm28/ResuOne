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
