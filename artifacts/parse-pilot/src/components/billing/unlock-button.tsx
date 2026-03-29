import { useState } from "react";
import { Zap, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/Button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface UnlockButtonProps {
  applicationId: string;
  className?: string;
  label?: string;
}

/**
 * Initiates a one-time $4 Stripe Checkout to unlock a single result.
 * On success, Stripe redirects to /billing/unlock-success.
 * Access is granted by the webhook — NOT by the redirect page.
 *
 * Handles ALREADY_UNLOCKED (409) gracefully: prompts a page reload
 * rather than showing a generic error, since the webhook may have
 * already fired between the user's last page load and this click.
 */
export function UnlockButton({
  applicationId,
  className,
  label = "Unlock this result — £6.99",
}: UnlockButtonProps) {
  const [loading, setLoading] = useState(false);
  const [alreadyUnlocked, setAlreadyUnlocked] = useState(false);
  const { toast } = useToast();

  async function handleUnlock() {
    setLoading(true);
    try {
      const appBase = import.meta.env.BASE_URL.replace(/\/$/, "");
      const origin = window.location.origin;
      const successUrl = `${origin}${appBase}/billing/unlock-success`;
      const cancelUrl = `${origin}${appBase}/applications/${applicationId}`;

      const response = await fetch(`/api/billing/unlock`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationId, successUrl, cancelUrl }),
      });

      if (response.status === 409) {
        // Webhook already processed — the result is already unlocked.
        // The page just hasn't refreshed yet. Prompt a reload.
        setAlreadyUnlocked(true);
        setLoading(false);
        toast({
          title: "Already unlocked",
          description: "This result is already unlocked. Refreshing the page now.",
        });
        setTimeout(() => window.location.reload(), 1500);
        return;
      }

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error ?? "Could not start checkout");
      }

      const { url } = await response.json();
      window.location.href = url;
    } catch (err) {
      setLoading(false);
      toast({
        title: "Checkout failed",
        description: err instanceof Error ? err.message : "Something went wrong. Please try again.",
        variant: "destructive",
      });
    }
  }

  if (alreadyUnlocked) {
    return (
      <Button
        onClick={() => window.location.reload()}
        className={cn(
          "gap-2 bg-emerald-500 hover:bg-emerald-600 text-white border-0",
          className,
        )}
      >
        <RefreshCw className="w-4 h-4" />
        Refresh to see your result
      </Button>
    );
  }

  return (
    <Button
      onClick={handleUnlock}
      disabled={loading}
      className={cn(
        "gap-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white border-0 shadow-md",
        className,
      )}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <Zap className="w-4 h-4" />
      )}
      {loading ? "Redirecting to Stripe…" : label}
    </Button>
  );
}
