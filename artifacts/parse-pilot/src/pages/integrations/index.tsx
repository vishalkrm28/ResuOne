import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { Calendar, Mail, Loader2, CheckCircle2, XCircle, Link2, Info } from "lucide-react";
import { getCalendarConnectStatus, getEmailConnectStatus } from "@/lib/notifications-api";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface ConnectionStatus {
  status: string;
  providerEmail: string | null;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
    connected: { label: "Connected", cls: "bg-green-100 text-green-700 border-green-200", icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
    not_connected: { label: "Not connected", cls: "bg-gray-100 text-gray-500 border-gray-200", icon: <XCircle className="w-3.5 h-3.5" /> },
    expired: { label: "Expired", cls: "bg-orange-100 text-orange-700 border-orange-200", icon: <XCircle className="w-3.5 h-3.5" /> },
    error: { label: "Error", cls: "bg-red-100 text-red-700 border-red-200", icon: <XCircle className="w-3.5 h-3.5" /> },
  };
  const cfg = map[status] ?? map.not_connected;
  return (
    <span className={cn("flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border font-medium", cfg.cls)}>
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

function IntegrationCard({
  name,
  icon: Icon,
  iconBg,
  description,
  features,
  status,
  providerEmail,
  comingSoon,
}: {
  name: string;
  icon: React.ElementType;
  iconBg: string;
  description: string;
  features: string[];
  status: string;
  providerEmail?: string | null;
  comingSoon?: boolean;
}) {
  return (
    <div className={cn(
      "rounded-xl border bg-card p-6",
      comingSoon && "opacity-75",
    )}>
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex items-center gap-3">
          <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0", iconBg)}>
            <Icon className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">{name}</h3>
            {providerEmail && (
              <p className="text-xs text-muted-foreground">{providerEmail}</p>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <StatusBadge status={status} />
          {comingSoon && (
            <span className="text-xs text-muted-foreground px-2 py-0.5 bg-muted rounded-full border">
              Coming soon
            </span>
          )}
        </div>
      </div>

      <p className="text-sm text-muted-foreground mb-4">{description}</p>

      <div className="space-y-1.5 mb-5">
        {features.map((f) => (
          <div key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="w-1.5 h-1.5 rounded-full bg-primary/50 flex-shrink-0" />
            {f}
          </div>
        ))}
      </div>

      {!comingSoon && status !== "connected" && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Info className="w-3.5 h-3.5" />
          Contact support to connect your account.
        </div>
      )}
    </div>
  );
}

export default function IntegrationsPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [calendarStatus, setCalendarStatus] = useState<Record<string, ConnectionStatus>>({});
  const [emailStatus, setEmailStatus] = useState<Record<string, ConnectionStatus>>({});

  useEffect(() => {
    Promise.all([
      getCalendarConnectStatus(),
      getEmailConnectStatus(),
    ])
      .then(([cal, email]) => {
        setCalendarStatus(cal);
        setEmailStatus(email);
      })
      .catch(() => toast({ title: "Failed to load integration status", variant: "destructive" }))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Link2 className="w-6 h-6 text-primary" />
            Integrations
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Connect your calendar and email to sync interviews and outbound emails automatically.
          </p>
        </div>

        {/* Calendar integrations */}
        <section className="mb-8">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
            Calendar
          </h2>
          <div className="grid gap-4">
            <IntegrationCard
              name="Google Calendar"
              icon={Calendar}
              iconBg="bg-blue-500"
              description="Sync your scheduled interviews directly to Google Calendar. Get automatic reminders on your phone and desktop."
              features={[
                "Sync interview events to your calendar",
                "Include meeting links and prep notes",
                "Automatic timezone handling",
                "Two-way status updates",
              ]}
              status={calendarStatus.google?.status ?? "not_connected"}
              providerEmail={calendarStatus.google?.providerEmail}
            />
            <IntegrationCard
              name="Outlook Calendar"
              icon={Calendar}
              iconBg="bg-sky-600"
              description="Sync interviews to Microsoft Outlook and Teams calendar. Perfect for corporate environments."
              features={[
                "Microsoft 365 calendar sync",
                "Teams meeting link support",
                "Works with corporate accounts",
              ]}
              status={calendarStatus.outlook?.status ?? "not_connected"}
              providerEmail={calendarStatus.outlook?.providerEmail}
              comingSoon
            />
          </div>
        </section>

        {/* Email integrations */}
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
            Email
          </h2>
          <div className="grid gap-4">
            <IntegrationCard
              name="Gmail"
              icon={Mail}
              iconBg="bg-red-500"
              description="Push email drafts directly to your Gmail drafts folder. Send follow-ups and thank-you notes with one click."
              features={[
                "Push drafts to Gmail automatically",
                "Review and send from your inbox",
                "Track sent status in Resuone",
                "Works with Google Workspace",
              ]}
              status={emailStatus.gmail?.status ?? "not_connected"}
              providerEmail={emailStatus.gmail?.providerEmail}
            />
            <IntegrationCard
              name="Outlook / Exchange"
              icon={Mail}
              iconBg="bg-blue-700"
              description="Create email drafts in Outlook or Exchange. Works with Microsoft 365 and corporate Exchange servers."
              features={[
                "Microsoft 365 email drafts",
                "Exchange server support",
                "Works with corporate email",
              ]}
              status={emailStatus.outlook?.status ?? "not_connected"}
              providerEmail={emailStatus.outlook?.providerEmail}
              comingSoon
            />
          </div>
        </section>
      </div>
    </AppLayout>
  );
}
