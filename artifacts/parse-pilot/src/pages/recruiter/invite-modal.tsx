import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { sendInvite, bulkInvite } from "@/lib/recruiter-api";
import { X, Loader2, Send, Calendar, Link as LinkIcon } from "lucide-react";

const DEFAULT_MESSAGE = "We reviewed your profile and would like to invite you to the next step. We look forward to connecting with you.";

interface InviteModalProps {
  candidate?: { id: string; name: string; email: string };
  bulkIds?: string[];
  onClose: () => void;
  onSent: () => void;
}

export function InviteModal({ candidate, bulkIds, onClose, onSent }: InviteModalProps) {
  const isBulk = !!bulkIds && bulkIds.length > 0;
  const [type, setType] = useState<"interview" | "test">("interview");
  const [message, setMessage] = useState(DEFAULT_MESSAGE);
  const [scheduledAt, setScheduledAt] = useState("");
  const [meetingLink, setMeetingLink] = useState("");
  const [recruiterName, setRecruiterName] = useState("");
  const [recruiterOrg, setRecruiterOrg] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      if (isBulk) {
        return bulkInvite({
          candidateIds: bulkIds!, type, message,
          scheduledAt: scheduledAt || null, meetingLink: meetingLink || null,
          recruiterName: recruiterName || undefined, recruiterOrg: recruiterOrg || undefined,
        });
      } else {
        return sendInvite(candidate!.id, {
          type, message, scheduledAt: scheduledAt || null, meetingLink: meetingLink || null,
          recruiterName: recruiterName || undefined, recruiterOrg: recruiterOrg || undefined,
        });
      }
    },
    onSuccess: onSent,
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-background rounded-2xl border border-border/60 shadow-2xl w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/40">
          <div>
            <h2 className="font-bold text-foreground text-base">Send Invite</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isBulk ? `Sending to ${bulkIds!.length} candidates` : `To: ${candidate!.name} · ${candidate!.email}`}
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-muted/40 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Type toggle */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Type</label>
            <div className="grid grid-cols-2 gap-2">
              {(["interview", "test"] as const).map(t => (
                <button key={t} onClick={() => setType(t)}
                  className={`py-2.5 rounded-xl text-sm font-semibold border transition-all ${type === t ? "bg-primary text-primary-foreground border-primary shadow-sm" : "border-border/40 text-muted-foreground hover:border-primary/30 hover:text-foreground"}`}>
                  {t === "interview" ? "Interview" : "Skills Test"}
                </button>
              ))}
            </div>
          </div>

          {/* Recruiter info */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Your Name</label>
              <input value={recruiterName} onChange={e => setRecruiterName(e.target.value)}
                placeholder="Jane Smith"
                className="w-full h-9 px-3 rounded-lg border border-border/60 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Organisation</label>
              <input value={recruiterOrg} onChange={e => setRecruiterOrg(e.target.value)}
                placeholder="Acme Corp"
                className="w-full h-9 px-3 rounded-lg border border-border/60 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
          </div>

          {/* Message */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Message</label>
            <textarea value={message} onChange={e => setMessage(e.target.value)} rows={3}
              className="w-full px-3 py-2.5 rounded-lg border border-border/60 bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>

          {/* Date & link */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                <Calendar className="w-3 h-3" /> Date & Time <span className="font-normal normal-case">(optional)</span>
              </label>
              <input type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-border/60 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                <LinkIcon className="w-3 h-3" /> Meeting Link <span className="font-normal normal-case">(optional)</span>
              </label>
              <input value={meetingLink} onChange={e => setMeetingLink(e.target.value)}
                placeholder="https://meet.google.com/…"
                className="w-full h-9 px-3 rounded-lg border border-border/60 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
          </div>

          {mutation.error && (
            <p className="text-red-500 text-xs">{(mutation.error as Error).message}</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border/40">
          <button onClick={onClose} className="text-sm text-muted-foreground hover:text-foreground px-4 py-2 rounded-lg hover:bg-muted/30 transition-colors">
            Cancel
          </button>
          <button onClick={() => mutation.mutate()} disabled={mutation.isPending || !message.trim()}
            className="flex items-center gap-2 bg-primary text-primary-foreground text-sm font-semibold px-5 py-2 rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50">
            {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Send Invite
          </button>
        </div>
      </div>
    </div>
  );
}
