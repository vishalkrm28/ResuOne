import { useState, useEffect, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, ArrowRight, CheckCircle2, Loader2, Sparkles,
  ChevronDown, ChevronUp, Lightbulb, Star, AlertCircle, TrendingUp,
  RotateCcw, Flag,
} from "lucide-react";
import {
  getMockSession,
  saveMockAnswer,
  evaluateMockAnswer,
  completeMockSession,
  type MockSession,
  type MockQuestion,
  type MockAnswer,
  type AnswerFeedback,
  SESSION_TYPE_LABELS,
} from "@/lib/mock-interview-api";

export default function MockInterviewSessionPage() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [session, setSession] = useState<MockSession | null>(null);
  const [questions, setQuestions] = useState<MockQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, MockAnswer>>({});
  const [loading, setLoading] = useState(true);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [draftAnswer, setDraftAnswer] = useState("");
  const [saving, setSaving] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [showHints, setShowHints] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);

  useEffect(() => {
    getMockSession(id)
      .then(({ session, questions, answers }) => {
        setSession(session);
        setQuestions(questions);
        const answerMap: Record<string, MockAnswer> = {};
        answers.forEach(a => { answerMap[a.questionId] = a; });
        setAnswers(answerMap);
        const firstUnanswered = questions.findIndex(q => !answerMap[q.id]?.aiFeedback);
        setCurrentIdx(Math.max(0, firstUnanswered === -1 ? questions.length - 1 : firstUnanswered));
      })
      .catch(e => {
        toast({ title: "Failed to load session", description: e.message, variant: "destructive" });
      })
      .finally(() => setLoading(false));
  }, [id]);

  const currentQ = questions[currentIdx];
  const currentAnswer = currentQ ? answers[currentQ.id] : null;

  useEffect(() => {
    if (currentQ) {
      setDraftAnswer(answers[currentQ.id]?.answerText ?? "");
      setShowFeedback(!!answers[currentQ.id]?.aiFeedback);
      setShowHints(false);
    }
  }, [currentIdx, currentQ?.id]);

  async function saveAnswer() {
    if (!currentQ || !draftAnswer.trim() || !session) return;
    setSaving(true);
    try {
      const result = await saveMockAnswer({
        sessionId: session.id,
        questionId: currentQ.id,
        answerText: draftAnswer,
      });
      setAnswers(prev => ({ ...prev, [currentQ.id]: result.answer }));
    } catch (e: any) {
      toast({ title: "Failed to save", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function evaluate() {
    if (!currentQ || !draftAnswer.trim() || !session) return;
    setEvaluating(true);
    try {
      const result = await evaluateMockAnswer({
        sessionId: session.id,
        questionId: currentQ.id,
        answerText: draftAnswer,
      });
      setAnswers(prev => ({ ...prev, [currentQ.id]: result.answer }));
      setShowFeedback(true);
      toast({ title: `Score: ${result.feedback.score}/10`, description: result.feedback.overall_feedback.slice(0, 80) });
    } catch (e: any) {
      toast({ title: "Evaluation failed", description: e.message, variant: "destructive" });
    } finally {
      setEvaluating(false);
    }
  }

  async function completeSession() {
    if (!session) return;
    setCompleting(true);
    try {
      await completeMockSession(session.id);
      toast({ title: "Session completed!", description: "Great practice — check your scores below." });
      const updated = await getMockSession(id);
      setSession(updated.session);
      const map: Record<string, MockAnswer> = {};
      updated.answers.forEach(a => { map[a.questionId] = a; });
      setAnswers(map);
    } catch (e: any) {
      toast({ title: "Failed to complete", description: e.message, variant: "destructive" });
    } finally {
      setCompleting(false);
    }
  }

  const answeredCount = questions.filter(q => !!answers[q.id]?.aiFeedback).length;
  const progress = questions.length > 0 ? Math.round((answeredCount / questions.length) * 100) : 0;
  const allEvaluated = answeredCount === questions.length;
  const avgScore = allEvaluated && questions.length > 0
    ? Math.round(questions.reduce((sum, q) => sum + (answers[q.id]?.score ?? 0), 0) / questions.length * 10) / 10
    : null;

  if (loading) {
    return (
      <AppLayout>
        <div className="flex justify-center items-center py-24">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      </AppLayout>
    );
  }

  if (!session || questions.length === 0) {
    return (
      <AppLayout>
        <div className="max-w-2xl mx-auto py-12 px-4 text-center">
          <AlertCircle className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">Session not found</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => navigate("/mock-interview")}>
            Back to sessions
          </Button>
        </div>
      </AppLayout>
    );
  }

  const feedback: AnswerFeedback | null = (currentAnswer?.aiFeedback && typeof currentAnswer.aiFeedback === "object" && Object.keys(currentAnswer.aiFeedback).length > 0)
    ? currentAnswer.aiFeedback as AnswerFeedback
    : null;

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto py-8 px-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <button onClick={() => navigate("/mock-interview")} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors">
            <ArrowLeft className="w-4 h-4" /> All sessions
          </button>
          {session.status === "active" && allEvaluated && (
            <Button
              size="sm"
              onClick={completeSession}
              disabled={completing}
              className="gap-1.5 bg-green-600 hover:bg-green-700 text-white"
            >
              {completing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Flag className="w-3.5 h-3.5" />}
              Complete session
            </Button>
          )}
        </div>

        <div className="mb-6">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <Badge variant="outline" className="text-xs bg-indigo-50 text-indigo-700">
              {SESSION_TYPE_LABELS[session.sessionType]}
            </Badge>
            <Badge variant="outline" className={`text-xs ${session.status === "completed" ? "bg-green-50 text-green-700" : "bg-blue-50 text-blue-700"}`}>
              {session.status}
            </Badge>
            {avgScore !== null && (
              <span className="text-sm font-semibold text-gray-700 flex items-center gap-1">
                <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" /> Avg {avgScore}/10
              </span>
            )}
          </div>
          <h1 className="text-xl font-bold text-gray-900">{session.sessionTitle ?? "Mock Interview"}</h1>
          {session.applicationTitle && (
            <p className="text-sm text-gray-500 mt-0.5">{session.applicationTitle}{session.company ? ` · ${session.company}` : ""}</p>
          )}
        </div>

        {/* Progress bar */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-gray-500">{answeredCount} of {questions.length} evaluated</span>
            <span className="text-xs text-gray-500">{progress}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Question navigation */}
        <div className="flex gap-1.5 flex-wrap mb-6">
          {questions.map((q, i) => {
            const ans = answers[q.id];
            const hasScore = !!ans?.aiFeedback && typeof ans.aiFeedback === "object" && Object.keys(ans.aiFeedback).length > 0;
            const score = ans?.score;
            return (
              <button
                key={q.id}
                onClick={() => setCurrentIdx(i)}
                className={`w-8 h-8 rounded-full text-xs font-semibold transition-colors border-2 ${
                  i === currentIdx
                    ? "border-indigo-500 bg-indigo-600 text-white"
                    : hasScore
                      ? score !== null && score >= 7
                        ? "border-green-300 bg-green-50 text-green-700"
                        : score !== null && score >= 5
                          ? "border-yellow-300 bg-yellow-50 text-yellow-700"
                          : "border-red-300 bg-red-50 text-red-600"
                      : ans?.answerText
                        ? "border-blue-200 bg-blue-50 text-blue-600"
                        : "border-gray-200 bg-white text-gray-500"
                }`}
                title={`Q${i + 1}${hasScore ? ` · ${score}/10` : ""}`}
              >
                {i + 1}
              </button>
            );
          })}
        </div>

        {/* Current question */}
        {currentQ && (
          <div className="space-y-5">
            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Q{currentIdx + 1} of {questions.length}</span>
                <Badge variant="outline" className="text-xs capitalize bg-gray-50">
                  {currentQ.answerType.replace(/_/g, " ")}
                </Badge>
              </div>
              <p className="text-gray-900 font-medium leading-relaxed">{currentQ.question}</p>

              {currentQ.whyItMatters && (
                <p className="text-xs text-gray-500 mt-3 italic">Why it's asked: {currentQ.whyItMatters}</p>
              )}

              {/* Hints toggle */}
              {currentQ.suggestedPoints && (currentQ.suggestedPoints as string[]).length > 0 && (
                <div className="mt-4">
                  <button
                    onClick={() => setShowHints(h => !h)}
                    className="flex items-center gap-1.5 text-xs text-amber-600 hover:text-amber-700 transition-colors"
                  >
                    <Lightbulb className="w-3.5 h-3.5" />
                    {showHints ? "Hide" : "Show"} suggested points
                    {showHints ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                  {showHints && (
                    <ul className="mt-2 space-y-1">
                      {(currentQ.suggestedPoints as string[]).map((p, i) => (
                        <li key={i} className="text-xs text-gray-600 flex gap-2">
                          <span className="text-amber-500 flex-shrink-0">•</span>{p}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>

            {/* Answer textarea */}
            <div>
              <Textarea
                value={draftAnswer}
                onChange={e => setDraftAnswer(e.target.value)}
                placeholder="Type your answer here..."
                className="min-h-[180px] text-sm resize-none"
                disabled={session.status === "completed"}
              />
              <p className="text-xs text-gray-400 mt-1.5 text-right">{draftAnswer.length} characters</p>
            </div>

            {/* Actions */}
            {session.status === "active" && (
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={evaluate}
                  disabled={evaluating || !draftAnswer.trim()}
                  className="gap-1.5"
                >
                  {evaluating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  {feedback ? "Re-evaluate (1 credit)" : "Get AI Feedback (1 credit)"}
                </Button>
                <Button
                  variant="outline"
                  onClick={saveAnswer}
                  disabled={saving || !draftAnswer.trim()}
                  className="gap-1.5"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Save draft
                </Button>
              </div>
            )}

            {/* Feedback panel */}
            {feedback && (
              <div className="space-y-4">
                <button
                  onClick={() => setShowFeedback(f => !f)}
                  className="flex items-center gap-2 text-sm font-semibold text-gray-700 hover:text-gray-900"
                >
                  <TrendingUp className="w-4 h-4 text-indigo-500" />
                  AI Feedback
                  {showFeedback ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>

                {showFeedback && (
                  <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-5 space-y-4">
                    {/* Score */}
                    <div className="flex items-center gap-3">
                      <div className={`text-3xl font-bold ${feedback.score >= 7 ? "text-green-600" : feedback.score >= 5 ? "text-yellow-600" : "text-red-500"}`}>
                        {feedback.score}<span className="text-base font-normal text-gray-400">/10</span>
                      </div>
                      <p className="text-sm text-gray-700">{feedback.overall_feedback}</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {feedback.strengths.length > 0 && (
                        <FeedbackSection title="Strengths" items={feedback.strengths} color="green" />
                      )}
                      {feedback.weaknesses.length > 0 && (
                        <FeedbackSection title="Weaknesses" items={feedback.weaknesses} color="red" />
                      )}
                      {feedback.missing_points.length > 0 && (
                        <FeedbackSection title="Missing points" items={feedback.missing_points} color="yellow" />
                      )}
                      {feedback.delivery_tips.length > 0 && (
                        <FeedbackSection title="Delivery tips" items={feedback.delivery_tips} color="blue" />
                      )}
                    </div>

                    {feedback.improved_answer && (
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Improved answer</p>
                        <div className="bg-white rounded-lg border border-indigo-100 p-3">
                          <p className="text-sm text-gray-700 whitespace-pre-wrap">{feedback.improved_answer}</p>
                          <button
                            onClick={() => setDraftAnswer(feedback.improved_answer)}
                            className="mt-2 flex items-center gap-1 text-xs text-indigo-500 hover:text-indigo-700 transition-colors"
                          >
                            <RotateCcw className="w-3 h-3" /> Use as new draft
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Navigation */}
            <div className="flex items-center justify-between pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentIdx(i => Math.max(0, i - 1))}
                disabled={currentIdx === 0}
                className="gap-1.5"
              >
                <ArrowLeft className="w-4 h-4" /> Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentIdx(i => Math.min(questions.length - 1, i + 1))}
                disabled={currentIdx === questions.length - 1}
                className="gap-1.5"
              >
                Next <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

function FeedbackSection({ title, items, color }: { title: string; items: string[]; color: "green" | "red" | "yellow" | "blue" }) {
  const colorMap = {
    green: "text-green-700 bg-green-50 border-green-100",
    red: "text-red-700 bg-red-50 border-red-100",
    yellow: "text-yellow-700 bg-yellow-50 border-yellow-100",
    blue: "text-blue-700 bg-blue-50 border-blue-100",
  };
  const dotMap = { green: "bg-green-400", red: "bg-red-400", yellow: "bg-yellow-400", blue: "bg-blue-400" };
  return (
    <div className={`rounded-lg border p-3 ${colorMap[color]}`}>
      <p className="text-xs font-semibold uppercase tracking-wide mb-2">{title}</p>
      <ul className="space-y-1">
        {items.map((item, i) => (
          <li key={i} className="text-xs flex gap-2 items-start">
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5 ${dotMap[color]}`} />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
