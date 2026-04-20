import { useState, useEffect } from "react";
import { Link } from "wouter";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Mic, CheckCircle2, Clock, Loader2, LayoutGrid, Plus, Inbox,
} from "lucide-react";
import {
  listMockSessions,
  type MockSession,
  SESSION_TYPE_LABELS,
} from "@/lib/mock-interview-api";

const STATUS_STYLES: Record<string, string> = {
  active: "bg-blue-50 text-blue-700 border-blue-200",
  completed: "bg-green-50 text-green-700 border-green-200",
  archived: "bg-gray-100 text-gray-500 border-gray-200",
};

const SESSION_TYPE_COLORS: Record<string, string> = {
  role_specific: "bg-purple-50 text-purple-700",
  behavioral: "bg-amber-50 text-amber-700",
  technical: "bg-cyan-50 text-cyan-700",
  mixed: "bg-indigo-50 text-indigo-700",
};

export default function MockInterviewListPage() {
  const { toast } = useToast();
  const [sessions, setSessions] = useState<MockSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listMockSessions()
      .then(r => setSessions(r.sessions))
      .catch(e => toast({ title: "Failed to load sessions", description: e.message, variant: "destructive" }))
      .finally(() => setLoading(false));
  }, []);

  const active = sessions.filter(s => s.status === "active");
  const completed = sessions.filter(s => s.status === "completed");

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto py-8 px-4">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Mock Interviews</h1>
            <p className="text-sm text-gray-500 mt-1">Practice sessions with AI feedback on your answers</p>
          </div>
          <Link href="/tracker">
            <Button variant="outline" size="sm" className="gap-1.5">
              <Plus className="w-4 h-4" /> Start via Application
            </Button>
          </Link>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-16">
            <Mic className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No mock interview sessions yet</p>
            <p className="text-sm text-gray-400 mt-1">Start a session from any tracked application</p>
            <Link href="/tracker">
              <Button variant="outline" size="sm" className="mt-4 gap-1.5">
                <LayoutGrid className="w-4 h-4" /> Go to Tracker
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-8">
            {active.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">In Progress</p>
                <SessionList sessions={active} />
              </div>
            )}
            {completed.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Completed</p>
                <SessionList sessions={completed} />
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

function SessionList({ sessions }: { sessions: MockSession[] }) {
  return (
    <div className="space-y-3">
      {sessions.map(session => (
        <Link key={session.id} href={`/mock-interview/${session.id}`}>
          <div className="bg-white border border-gray-200 rounded-xl px-4 py-4 hover:border-indigo-300 hover:shadow-sm transition-all cursor-pointer">
            <div className="flex items-start gap-3">
              <div className="mt-0.5">
                {session.status === "completed"
                  ? <CheckCircle2 className="w-5 h-5 text-green-500" />
                  : <Clock className="w-5 h-5 text-blue-400" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <Badge variant="outline" className={`text-xs ${SESSION_TYPE_COLORS[session.sessionType] ?? ""}`}>
                    {SESSION_TYPE_LABELS[session.sessionType]}
                  </Badge>
                  <Badge variant="outline" className={`text-xs ${STATUS_STYLES[session.status]}`}>
                    {session.status}
                  </Badge>
                </div>
                <p className="text-sm font-medium text-gray-800 truncate">
                  {session.sessionTitle ?? "Mock Interview Session"}
                </p>
                {session.applicationTitle && (
                  <p className="text-xs text-gray-400 mt-0.5 truncate">
                    {session.applicationTitle}{session.company ? ` · ${session.company}` : ""}
                  </p>
                )}
              </div>
              <div className="flex-shrink-0 text-right">
                <p className="text-xs text-gray-400">{new Date(session.createdAt).toLocaleDateString()}</p>
                {session.completedAt && (
                  <p className="text-xs text-green-500 mt-0.5">Completed</p>
                )}
              </div>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
