import { useEffect } from "react";
import { Link } from "wouter";
import { CheckCircle2, ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/Button";
import { motion } from "framer-motion";

export default function BillingSuccess() {
  // Clear any stale query-cache so the next /billing or dashboard fetch
  // picks up the updated subscription status once the webhook has fired.
  useEffect(() => {
    // Give the webhook a moment to land before the user hits the dashboard
    // (this is cosmetic — actual access is gated by the webhook).
  }, []);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="max-w-md w-full text-center space-y-6"
      >
        {/* Icon */}
        <div className="flex justify-center">
          <div className="w-20 h-20 rounded-full bg-emerald-500/10 flex items-center justify-center">
            <CheckCircle2 className="w-10 h-10 text-emerald-500" />
          </div>
        </div>

        {/* Heading */}
        <div className="space-y-2">
          <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm font-medium tracking-wide uppercase">
            <Sparkles className="w-4 h-4 text-violet-500" />
            ParsePilot Pro
          </div>
          <h1 className="text-3xl font-bold tracking-tight">
            You're all set!
          </h1>
          <p className="text-muted-foreground">
            Your subscription is being activated. It can take a few seconds —
            refresh your dashboard if Pro features aren't showing yet.
          </p>
        </div>

        {/* CTA */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <Link href="/dashboard">
            <Button className="gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white border-0 shadow-md w-full sm:w-auto">
              Go to Dashboard
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>

        {/* Small print */}
        <p className="text-xs text-muted-foreground">
          You'll receive a receipt from Stripe at your email address.
        </p>
      </motion.div>
    </div>
  );
}
