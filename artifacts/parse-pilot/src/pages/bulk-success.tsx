import { useLocation } from "wouter";
import { CheckCircle2, ArrowRight, Users } from "lucide-react";
import { AppLayout } from "@/components/layout/app-layout";

export default function BulkSuccess() {
  const [, navigate] = useLocation();

  return (
    <AppLayout>
      <div className="max-w-lg mx-auto text-center py-16">
        <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 className="w-8 h-8 text-emerald-500" />
        </div>

        <h1 className="text-2xl font-extrabold tracking-tight mb-3">
          Your bulk pass is active
        </h1>
        <p className="text-muted-foreground mb-8 leading-relaxed">
          Payment confirmed. Your CV slots are ready to use. Start analyzing candidates
          against a job description right now.
        </p>

        <div className="grid gap-3">
          <button
            onClick={() => navigate("/bulk/session")}
            className="flex items-center justify-center gap-2 w-full px-6 py-3.5 rounded-xl bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity"
          >
            <Users className="w-4 h-4" />
            Start bulk analysis
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => navigate("/")}
            className="flex items-center justify-center gap-2 w-full px-6 py-3 rounded-xl border border-border text-sm font-medium hover:bg-muted/40 transition-colors"
          >
            Back to dashboard
          </button>
        </div>
      </div>
    </AppLayout>
  );
}
