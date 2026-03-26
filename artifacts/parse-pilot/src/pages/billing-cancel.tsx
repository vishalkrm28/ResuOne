import { Link } from "wouter";
import { XCircle, ArrowLeft, Sparkles } from "lucide-react";
import { Button } from "@/components/Button";
import { motion } from "framer-motion";

export default function BillingCancel() {
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
          <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center">
            <XCircle className="w-10 h-10 text-muted-foreground" />
          </div>
        </div>

        {/* Heading */}
        <div className="space-y-2">
          <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm font-medium tracking-wide uppercase">
            <Sparkles className="w-4 h-4 text-violet-500" />
            ParsePilot Pro
          </div>
          <h1 className="text-3xl font-bold tracking-tight">
            No worries
          </h1>
          <p className="text-muted-foreground">
            You cancelled the checkout. Your account hasn't been charged and
            nothing has changed. You can upgrade whenever you're ready.
          </p>
        </div>

        {/* CTA */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <Link href="/dashboard">
            <Button variant="outline" className="gap-2 w-full sm:w-auto">
              <ArrowLeft className="w-4 h-4" />
              Back to Dashboard
            </Button>
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
