import { useState, useEffect } from "react";
import { Link } from "wouter";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Mail, Copy, Check, Archive, ExternalLink,
  Loader2, ChevronRight, Plus, Inbox,
} from "lucide-react";
import {
  listEmailDrafts,
  updateDraftStatus,
  type EmailDraft,
  type DraftStatus,
  DRAFT_TYPE_LABELS,
} from "@/lib/emails-api";

const STATUS_STYLES: Record<DraftStatus, string> = {
  draft: "bg-blue-50 text-blue-700 border-blue-200",
  copied: "bg-green-50 text-green-700 border-green-200",
  archived: "bg-gray-100 text-gray-500 border-gray-200",
  gmail_draft: "bg-red-50 text-red-600 border-red-200",
};

const STATUS_LABELS: Record<DraftStatus, string> = {
  draft: "Draft",
  copied: "Copied",
  archived: "Archived",
  gmail_draft: "In Gmail",
};

const DRAFT_TYPE_COLORS: Record<string, string> = {
  follow_up: "bg-purple-50 text-purple-700 border-purple-200",
  thank_you: "bg-amber-50 text-amber-700 border-amber-200",
  networking: "bg-cyan-50 text-cyan-700 border-cyan-200",
  interview_confirmation: "bg-green-50 text-green-700 border-green-200",
};

export default function EmailsPage() {
  const { toast } = useToast();
  const [drafts, setDrafts] = useState<EmailDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    listEmailDrafts()
      .then(r => setDrafts(r.drafts))
      .catch(e => toast({ title: "Failed to load drafts", description: e.message, variant: "destructive" }))
      .finally(() => setLoading(false));
  }, []);

  async function copyDraft(draft: EmailDraft) {
    try {
      await navigator.clipboard.writeText(`Subject: ${draft.subject}\n\n${draft.bodyText}`);
      toast({ title: "Copied to clipboard" });
      if (draft.status === "draft") {
        setActionLoading(draft.id);
        const updated = await updateDraftStatus(draft.id, "copied");
        setDrafts(prev => prev.map(d => d.id === draft.id ? updated.draft : d));
        setActionLoading(null);
      }
    } catch {
      toast({ title: "Failed to copy", variant: "destructive" });
    }
  }

  async function archiveDraft(draft: EmailDraft) {
    setActionLoading(draft.id + "_archive");
    try {
      const updated = await updateDraftStatus(draft.id, "archived");
      setDrafts(prev => prev.map(d => d.id === draft.id ? updated.draft : d));
      toast({ title: "Draft archived" });
    } catch (e: any) {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  }

  const active = drafts.filter(d => d.status !== "archived");
  const archived = drafts.filter(d => d.status === "archived");

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto py-8 px-4">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Email Drafts</h1>
            <p className="text-sm text-gray-500 mt-1">AI-drafted emails linked to your applications</p>
          </div>
          <Link href="/tracker">
            <Button variant="outline" size="sm" className="gap-1.5">
              <Plus className="w-4 h-4" /> Generate via Application
            </Button>
          </Link>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : active.length === 0 && archived.length === 0 ? (
          <div className="text-center py-16">
            <Inbox className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No email drafts yet</p>
            <p className="text-sm text-gray-400 mt-1">Generate drafts from any tracked application</p>
            <Link href="/tracker">
              <Button variant="outline" size="sm" className="mt-4 gap-1.5">
                <ExternalLink className="w-4 h-4" /> Go to Tracker
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {active.length > 0 && (
              <DraftList
                drafts={active}
                expanded={expanded}
                actionLoading={actionLoading}
                onExpand={id => setExpanded(prev => prev === id ? null : id)}
                onCopy={copyDraft}
                onArchive={archiveDraft}
              />
            )}
            {archived.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Archived</p>
                <DraftList
                  drafts={archived}
                  expanded={expanded}
                  actionLoading={actionLoading}
                  onExpand={id => setExpanded(prev => prev === id ? null : id)}
                  onCopy={copyDraft}
                  onArchive={() => {}}
                  isArchived
                />
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

function DraftList({
  drafts, expanded, actionLoading, onExpand, onCopy, onArchive, isArchived,
}: {
  drafts: EmailDraft[];
  expanded: string | null;
  actionLoading: string | null;
  onExpand: (id: string) => void;
  onCopy: (d: EmailDraft) => void;
  onArchive: (d: EmailDraft) => void;
  isArchived?: boolean;
}) {
  return (
    <div className="space-y-3">
      {drafts.map(draft => (
        <div key={draft.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
          <button
            onClick={() => onExpand(draft.id)}
            className="w-full flex items-start gap-3 px-4 py-4 text-left hover:bg-gray-50 transition-colors"
          >
            <div className="mt-0.5">
              <Mail className="w-4 h-4 text-gray-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <Badge variant="outline" className={`text-xs ${DRAFT_TYPE_COLORS[draft.draftType] ?? ""}`}>
                  {DRAFT_TYPE_LABELS[draft.draftType]}
                </Badge>
                <Badge variant="outline" className={`text-xs ${STATUS_STYLES[draft.status]}`}>
                  {STATUS_LABELS[draft.status]}
                </Badge>
                <span className="text-xs text-gray-400 capitalize">{draft.tone}</span>
              </div>
              <p className="text-sm font-medium text-gray-800 truncate">{draft.subject}</p>
              {draft.applicationTitle && (
                <p className="text-xs text-gray-400 mt-0.5 truncate">
                  {draft.applicationTitle}{draft.company ? ` · ${draft.company}` : ""}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-xs text-gray-400 hidden sm:block">
                {new Date(draft.createdAt).toLocaleDateString()}
              </span>
              <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform ${expanded === draft.id ? "rotate-90" : ""}`} />
            </div>
          </button>

          {expanded === draft.id && (
            <div className="border-t border-gray-100 px-4 py-4 space-y-4">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Subject</p>
                <p className="text-sm text-gray-800">{draft.subject}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Body</p>
                <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans bg-gray-50 rounded-lg p-3 border border-gray-100 max-h-72 overflow-y-auto">
                  {draft.bodyText}
                </pre>
              </div>
              {!isArchived && (
                <div className="flex gap-2 flex-wrap">
                  <Button
                    size="sm"
                    onClick={() => onCopy(draft)}
                    disabled={actionLoading === draft.id}
                    className="gap-1.5"
                  >
                    {actionLoading === draft.id
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : draft.status === "copied" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {draft.status === "copied" ? "Copy again" : "Copy to clipboard"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onArchive(draft)}
                    disabled={actionLoading === draft.id + "_archive"}
                    className="gap-1.5 text-gray-600"
                  >
                    {actionLoading === draft.id + "_archive"
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : <Archive className="w-3.5 h-3.5" />}
                    Archive
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
