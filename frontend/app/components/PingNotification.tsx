"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

type RoutedQuestion = {
  id: string;
  question_text: string;
  created_at: string;
  confidence_score: number;
};

type PingNotificationProps = {
  workspaceId: string;
  memberId: string;
};

export default function PingNotification({
  workspaceId,
  memberId,
}: PingNotificationProps) {
  const { getToken } = useAuth();
  const [questions, setQuestions] = useState<RoutedQuestion[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [responseText, setResponseText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchRouted = useCallback(async () => {
    try {
      const token = await getToken();
      const res = await fetch(
        `${API_BASE}/questions/routed-to-me?workspace_id=${workspaceId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) {
        const data = await res.json();
        setQuestions(data || []);
      }
    } catch {
      // Silently fail
    }
  }, [workspaceId, getToken]);

  useEffect(() => {
    fetchRouted();
    const interval = setInterval(fetchRouted, 10000);
    return () => clearInterval(interval);
  }, [fetchRouted]);

  async function handleSubmit(questionId: string) {
    if (!responseText.trim() || submitting) return;
    setSubmitting(true);
    try {
      const token = await getToken();
      await fetch(`${API_BASE}/respond/${questionId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          response_text: responseText.trim(),
          responder_member_id: memberId,
        }),
      });
      setQuestions((prev) => prev.filter((q) => q.id !== questionId));
      setActiveId(null);
      setResponseText("");
    } catch {
      // Fail silently
    } finally {
      setSubmitting(false);
    }
  }

  if (questions.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm">
      {questions.map((q) => (
        <div
          key={q.id}
          className="bg-[#131127] border border-accent/30 rounded-xl shadow-lg p-3 animate-fade-in-up"
        >
          <div className="flex items-start gap-2 mb-2">
            <div className="w-6 h-6 rounded-full bg-accent/15 text-accent text-[10px] font-bold flex items-center justify-center flex-shrink-0">
              !
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white">
                Someone is asking:
              </p>
              <p className="text-sm text-foreground mt-0.5">{q.question_text}</p>
            </div>
          </div>

          {activeId === q.id ? (
            <div className="mt-2">
              <textarea
                value={responseText}
                onChange={(e) => setResponseText(e.target.value)}
                placeholder="Type your answer — it will be added to the Context Tree..."
                className="w-full px-2 py-1.5 border border-white/10 bg-white/5 rounded text-xs focus:outline-none focus:ring-1 focus:ring-accent resize-none"
                rows={3}
              />
              <div className="flex gap-2 mt-1.5">
                <button
                  onClick={() => handleSubmit(q.id)}
                  disabled={submitting || !responseText.trim()}
                  className="flex-1 py-1 bg-accent text-white rounded text-xs font-medium hover:bg-accent/80 transition-colors disabled:opacity-50"
                >
                  {submitting ? "Sending..." : "Submit Answer"}
                </button>
                <button
                  onClick={() => { setActiveId(null); setResponseText(""); }}
                  className="px-2 py-1 border border-white/10 rounded text-xs hover:bg-white/5"
                >
                  Cancel
                </button>
              </div>
              <p className="text-[9px] text-[var(--text-muted)] mt-1">
                Your answer will be added to the Context Tree automatically
              </p>
            </div>
          ) : (
            <button
              onClick={() => setActiveId(q.id)}
              className="w-full py-1.5 bg-accent/10 border border-accent/30 rounded text-xs text-accent font-medium hover:bg-accent/15 transition-colors"
            >
              Answer this question
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
