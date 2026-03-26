import { useAuth } from "@workspace/replit-auth-web";
import { AppLayout } from "@/components/layout/app-layout";
import { SubscriptionCard } from "@/components/billing/subscription-card";
import { CreditsCard } from "@/components/billing/credits-card";
import { Settings2, User, CreditCard, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

function SectionTitle({
  icon: Icon,
  title,
  description,
}: {
  icon: React.FC<{ className?: string }>;
  title: string;
  description?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 mt-0.5">
        <Icon className="w-4 h-4 text-muted-foreground" />
      </div>
      <div>
        <h2 className="text-base font-semibold leading-tight">{title}</h2>
        {description && (
          <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
        )}
      </div>
    </div>
  );
}

export default function Settings() {
  const { user } = useAuth();

  const displayName =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
    user?.email?.split("@")[0] ||
    "User";

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto space-y-10">
        {/* Page header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
            <Settings2 className="w-5 h-5 text-muted-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
            <p className="text-sm text-muted-foreground">
              Manage your account and subscription
            </p>
          </div>
        </div>

        {/* Account section */}
        <section className="space-y-4">
          <SectionTitle
            icon={User}
            title="Account"
            description="Your profile information from Replit"
          />
          <div className="rounded-xl border border-border bg-card p-5 flex items-center gap-4">
            {user?.profileImageUrl ? (
              <img
                src={user.profileImageUrl}
                alt={displayName}
                className="w-12 h-12 rounded-full object-cover ring-2 ring-border flex-shrink-0"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <span className="text-primary text-lg font-bold">
                  {displayName.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            <div className="min-w-0">
              <p className="font-semibold truncate">{displayName}</p>
              {user?.email && (
                <p className="text-sm text-muted-foreground truncate">{user.email}</p>
              )}
            </div>
          </div>
        </section>

        {/* Billing section */}
        <section className="space-y-4">
          <SectionTitle
            icon={CreditCard}
            title="Subscription"
            description="Upgrade to Pro or manage your existing plan"
          />
          <SubscriptionCard />
        </section>

        {/* Credits section */}
        <section className="space-y-4">
          <SectionTitle
            icon={Zap}
            title="AI Credits"
            description="Credits are used for CV optimization and cover letter generation"
          />
          <CreditsCard />
        </section>
      </div>
    </AppLayout>
  );
}
