import { useEffect, useState } from "react";
import { useParams } from "wouter";
import { getInvitePublic, respondToInvite } from "@/lib/recruiter-api";
import { Loader2, CheckCircle2, XCircle, Calendar, Link as LinkIcon, Sparkles } from "lucide-react";

type Phase = "loading" | "view" | "submitting" | "accepted" | "declined" | "error";

export default function InviteResponse() {
  const { id } = useParams<{ id: string }>();
  const [phase, setPhase] = useState<Phase>("loading");
  const [invite, setInvite] = useState<any>(null);
  const [candidate, setCandidate] = useState<any>(null);
  const [errMsg, setErrMsg] = useState("");

  useEffect(() => {
    getInvitePublic(id)
      .then(({ invite, candidate }) => { setInvite(invite); setCandidate(candidate); setPhase("view"); })
      .catch(() => { setErrMsg("This invite link is invalid or has expired."); setPhase("error"); });
  }, [id]);

  async function respond(action: "accept" | "decline") {
    setPhase("submitting");
    try {
      await respondToInvite(id, action, invite.token);
      setPhase(action === "accept" ? "accepted" : "declined");
    } catch {
      setErrMsg("Something went wrong. Please try again.");
      setPhase("error");
    }
  }

  const typeLabel = invite?.type === "test" ? "Skills Test" : "Interview";
  const dateStr = invite?.scheduledAt
    ? new Date(invite.scheduledAt).toLocaleString("en-GB", { dateStyle: "full", timeStyle: "short" })
    : null;

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 py-12">
      {/* Brand */}
      <div className="flex items-center gap-2 mb-10">
        <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
          <Sparkles className="w-4 h-4 text-primary-foreground" />
        </div>
        <span className="font-bold text-foreground text-base">ParsePilot</span>
      </div>

      <div className="w-full max-w-md">
        {phase === "loading" && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        )}

        {phase === "error" && (
          <div className="text-center border border-border/40 rounded-2xl p-8">
            <XCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <p className="text-foreground font-semibold mb-2">Invite unavailable</p>
            <p className="text-muted-foreground text-sm">{errMsg}</p>
          </div>
        )}

        {phase === "view" && invite && (
          <>
            {/* Already responded */}
            {(invite.status === "accepted" || invite.status === "rejected") ? (
              <div className="text-center border border-border/40 rounded-2xl p-8">
                <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto mb-4" />
                <p className="text-foreground font-semibold mb-2">Already responded</p>
                <p className="text-muted-foreground text-sm">You have already {invite.status === "accepted" ? "accepted" : "declined"} this invite.</p>
              </div>
            ) : (
              <div className="border border-border/40 rounded-2xl overflow-hidden">
                {/* Header */}
                <div className="bg-primary/5 border-b border-border/40 px-6 py-5">
                  <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-1">
                    {invite.recruiterOrg ? `${invite.recruiterName} · ${invite.recruiterOrg}` : invite.recruiterName}
                  </p>
                  <h1 className="text-xl font-extrabold text-foreground">
                    You've been invited to a {typeLabel}
                  </h1>
                  {candidate?.name && (
                    <p className="text-muted-foreground text-sm mt-1">Hi {candidate.name.split(" ")[0]},</p>
                  )}
                </div>

                {/* Details */}
                <div className="px-6 py-5 space-y-4">
                  {invite.message && (
                    <p className="text-muted-foreground text-sm leading-relaxed">{invite.message}</p>
                  )}

                  <div className="bg-muted/20 rounded-xl border border-border/40 p-4 space-y-2.5 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground w-20 shrink-0">Type</span>
                      <span className="font-semibold text-foreground">{typeLabel}</span>
                    </div>
                    {dateStr && (
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground w-20 shrink-0">Date</span>
                        <span className="font-semibold text-foreground flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-primary" /> {dateStr}
                        </span>
                      </div>
                    )}
                    {invite.meetingLink && (
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground w-20 shrink-0">Link</span>
                        <a href={invite.meetingLink} target="_blank" rel="noopener noreferrer"
                          className="text-primary hover:underline flex items-center gap-1 text-sm truncate">
                          <LinkIcon className="w-3.5 h-3.5 shrink-0" />
                          {invite.meetingLink}
                        </a>
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="px-6 py-5 border-t border-border/40 flex gap-3">
                  <button onClick={() => respond("accept")}
                    className="flex-1 flex items-center justify-center gap-2 bg-primary text-primary-foreground font-semibold py-3 rounded-xl hover:bg-primary/90 transition-all text-sm">
                    <CheckCircle2 className="w-4 h-4" /> Accept Invite
                  </button>
                  <button onClick={() => respond("decline")}
                    className="flex-1 flex items-center justify-center gap-2 border border-border/60 text-muted-foreground font-semibold py-3 rounded-xl hover:bg-muted/20 transition-all text-sm">
                    <XCircle className="w-4 h-4" /> Decline
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {phase === "submitting" && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        )}

        {phase === "accepted" && (
          <div className="text-center border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/10 rounded-2xl p-8">
            <CheckCircle2 className="w-14 h-14 text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-extrabold text-foreground mb-2">You're confirmed!</h2>
            <p className="text-muted-foreground text-sm mb-4">
              You have accepted the {typeLabel.toLowerCase()} invitation from {invite?.recruiterName}.
            </p>
            {dateStr && <p className="text-sm font-medium text-foreground mb-2">📅 {dateStr}</p>}
            {invite?.meetingLink && (
              <a href={invite.meetingLink} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-primary hover:underline text-sm mt-2">
                <LinkIcon className="w-3.5 h-3.5" /> Open meeting link
              </a>
            )}
          </div>
        )}

        {phase === "declined" && (
          <div className="text-center border border-border/40 rounded-2xl p-8">
            <XCircle className="w-14 h-14 text-muted-foreground/40 mx-auto mb-4" />
            <h2 className="text-xl font-extrabold text-foreground mb-2">Invite declined</h2>
            <p className="text-muted-foreground text-sm">Your response has been recorded. Thank you for letting us know.</p>
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground/40 mt-12">Powered by ParsePilot</p>
    </div>
  );
}
