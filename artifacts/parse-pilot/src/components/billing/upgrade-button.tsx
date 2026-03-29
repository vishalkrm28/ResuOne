import { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/Button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface UpgradeButtonProps {
  className?: string;
  variant?: "default" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
  label?: string;
}

export function UpgradeButton({
  className,
  variant = "default",
  label = "Get Pro — £14.99/mo",
}: UpgradeButtonProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  async function handleUpgrade() {
    setLoading(true);
    try {
      // Build absolute success/cancel URLs for Stripe to redirect back to
      const appBase = import.meta.env.BASE_URL.replace(/\/$/, "");
      const origin = window.location.origin;
      const successUrl = `${origin}${appBase}/billing/success`;
      const cancelUrl = `${origin}${appBase}/billing/cancel`;

      const response = await fetch(`/api/billing/checkout`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ successUrl, cancelUrl }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error ?? "Could not start checkout");
      }

      const { url } = await response.json();
      // Redirect the whole tab to Stripe Checkout
      window.location.href = url;
    } catch (err) {
      setLoading(false);
      toast({
        title: "Checkout failed",
        description: err instanceof Error ? err.message : "Something went wrong. Please try again.",
        variant: "destructive",
      });
    }
    // Note: don't setLoading(false) on success — the tab navigates away
  }

  return (
    <Button
      onClick={handleUpgrade}
      disabled={loading}
      className={cn(
        "gap-2",
        variant === "default" &&
          "bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white border-0 shadow-md",
        className,
      )}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <Sparkles className="w-4 h-4" />
      )}
      {loading ? "Redirecting to Stripe…" : label}
    </Button>
  );
}
