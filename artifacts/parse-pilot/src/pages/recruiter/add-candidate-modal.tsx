import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { createCandidate } from "@/lib/recruiter-api";
import { X, Loader2, Plus } from "lucide-react";

interface Props { onClose: () => void; onAdded: () => void; }

export function AddCandidateModal({ onClose, onAdded }: Props) {
  const [form, setForm] = useState({ name: "", email: "", jobTitle: "", company: "", experience: "", skills: "", notes: "" });
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const mutation = useMutation({
    mutationFn: () => createCandidate({
      name: form.name, email: form.email, jobTitle: form.jobTitle || undefined,
      company: form.company || undefined, experience: form.experience || undefined,
      skills: form.skills ? form.skills.split(",").map(s => s.trim()).filter(Boolean) : [],
      notes: form.notes || undefined,
    }),
    onSuccess: onAdded,
  });

  const valid = form.name.trim() && form.email.trim().includes("@");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-background rounded-2xl border border-border/60 shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/40">
          <h2 className="font-bold text-foreground text-base">Add Candidate</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-muted/40 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Name *</label>
              <input value={form.name} onChange={e => set("name", e.target.value)} placeholder="Alex Johnson"
                className="w-full h-9 px-3 rounded-lg border border-border/60 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Email *</label>
              <input value={form.email} onChange={e => set("email", e.target.value)} placeholder="alex@example.com"
                className="w-full h-9 px-3 rounded-lg border border-border/60 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Job Title</label>
              <input value={form.jobTitle} onChange={e => set("jobTitle", e.target.value)} placeholder="Software Engineer"
                className="w-full h-9 px-3 rounded-lg border border-border/60 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Company</label>
              <input value={form.company} onChange={e => set("company", e.target.value)} placeholder="Acme Corp"
                className="w-full h-9 px-3 rounded-lg border border-border/60 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Skills (comma-separated)</label>
            <input value={form.skills} onChange={e => set("skills", e.target.value)} placeholder="React, Node.js, TypeScript"
              className="w-full h-9 px-3 rounded-lg border border-border/60 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Experience</label>
            <input value={form.experience} onChange={e => set("experience", e.target.value)} placeholder="5 years in software development"
              className="w-full h-9 px-3 rounded-lg border border-border/60 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Notes</label>
            <textarea value={form.notes} onChange={e => set("notes", e.target.value)} rows={2} placeholder="Internal notes…"
              className="w-full px-3 py-2 rounded-lg border border-border/60 bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          {mutation.error && <p className="text-red-500 text-xs">{(mutation.error as Error).message}</p>}
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border/40">
          <button onClick={onClose} className="text-sm text-muted-foreground hover:text-foreground px-4 py-2 rounded-lg hover:bg-muted/30 transition-colors">Cancel</button>
          <button onClick={() => mutation.mutate()} disabled={mutation.isPending || !valid}
            className="flex items-center gap-2 bg-primary text-primary-foreground text-sm font-semibold px-5 py-2 rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50">
            {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Add Candidate
          </button>
        </div>
      </div>
    </div>
  );
}
