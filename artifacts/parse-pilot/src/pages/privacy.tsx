import { Link } from "wouter";
import { Sparkles, ArrowLeft } from "lucide-react";
import { Footer } from "@/components/layout/footer";

const sections: { title: string; content: React.ReactNode }[] = [
  {
    title: "Data We Collect",
    content: (
      <ul className="list-disc list-inside space-y-2">
        <li>CV / resume content you upload or paste.</li>
        <li>Job descriptions you provide for analysis.</li>
        <li>Account information (email, name via Replit authentication).</li>
        <li>Usage data to understand how the product is used.</li>
      </ul>
    ),
  },
  {
    title: "How We Use Your Data",
    content: (
      <ul className="list-disc list-inside space-y-2">
        <li>To analyse your CV against the job description you provide.</li>
        <li>To generate tailored suggestions, scores, and optimised outputs.</li>
        <li>To improve product performance and reliability over time.</li>
        <li>We do not sell your data to third parties.</li>
      </ul>
    ),
  },
  {
    title: "Data Storage",
    content: (
      <p>
        Your results and application history are stored securely so you can access them later.
        We take reasonable steps to protect data at rest and in transit using industry-standard
        encryption.
      </p>
    ),
  },
  {
    title: "Third Parties",
    content: (
      <>
        <p className="mb-3">We use a small number of trusted third-party services:</p>
        <ul className="list-disc list-inside space-y-2">
          <li>
            <strong className="text-foreground">Stripe</strong> — payment processing. They
            handle all card data; we never store payment details.
          </li>
          <li>
            <strong className="text-foreground">AI providers</strong> — your CV content is
            sent to AI models for analysis and generation. We use reputable providers and do
            not permit them to train on your data.
          </li>
        </ul>
      </>
    ),
  },
  {
    title: "Data Protection",
    content: (
      <p>
        We take reasonable and proportionate steps to protect the data you share with us.
        No system is perfectly secure — please avoid uploading highly sensitive personal
        information beyond what's needed for a job application.
      </p>
    ),
  },
  {
    title: "Your Control",
    content: (
      <ul className="list-disc list-inside space-y-2">
        <li>You choose what to upload — only share what you're comfortable with.</li>
        <li>Avoid including confidential employer data, NDA-covered information, or sensitive personal details beyond a standard CV.</li>
        <li>You can request deletion of your account and data by contacting us.</li>
      </ul>
    ),
  },
  {
    title: "Changes to This Policy",
    content: (
      <p>
        We may update this privacy policy from time to time. We'll indicate the date of the
        most recent revision at the top of this page.
      </p>
    ),
  },
];

export default function Privacy() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Nav */}
      <header className="border-b border-border/40 bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Back to ResuOne
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-primary flex items-center justify-center">
              <Sparkles className="w-3 h-3 text-primary-foreground" />
            </div>
            <span className="font-bold text-sm">ResuOne</span>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 max-w-2xl mx-auto px-6 py-16 w-full">
        <div className="mb-12">
          <p className="text-primary text-sm font-semibold uppercase tracking-wider mb-3">Legal</p>
          <h1 className="text-4xl font-extrabold tracking-tight text-foreground mb-4">
            Privacy Policy
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
          <Link href="/terms" className="hover:text-muted-foreground transition-colors">
            Terms of Service
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
