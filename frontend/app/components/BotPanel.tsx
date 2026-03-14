"use client";

import { useState, useCallback } from "react";
import ContextTraversal from "./ContextTraversal";

type BotPanelProps = {
  channels: { id: string; name: string }[];
  onClose: () => void;
};

type BotState = "idle" | "traversing" | "responding";

export default function BotPanel({ channels, onClose }: BotPanelProps) {
  const [input, setInput] = useState("");
  const [botState, setBotState] = useState<BotState>("idle");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");

  const handleTraversalComplete = useCallback(() => {
    setBotState("responding");
    setAnswer(
      "Based on the context from all channels, here's what I found: This is a placeholder response. Connect an LLM API to generate real answers based on the channel context."
    );
  }, []);

  function handleAsk() {
    if (!input.trim()) return;
    setQuestion(input.trim());
    setInput("");
    setAnswer("");
    setBotState("traversing");
  }

  function handleReset() {
    setBotState("idle");
    setQuestion("");
    setAnswer("");
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 flex justify-center pointer-events-none">
      <div className="w-full max-w-2xl pointer-events-auto">
        <div className="bg-white border border-[var(--border)] border-b-0 rounded-t-xl shadow-2xl animate-fade-in-up">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-accent text-white font-display text-[10px] flex items-center justify-center">
                n
              </div>
              <span className="text-sm font-semibold">Ask numen</span>
              <span className="text-[10px] text-[var(--text-muted)]">
                Your personal bot
              </span>
            </div>
            <button
              onClick={onClose}
              className="text-[var(--text-muted)] hover:text-foreground transition-colors"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="px-4 py-3 max-h-80 overflow-y-auto">
            {botState === "idle" && !question && (
              <p className="text-sm text-[var(--text-muted)] text-center py-4">
                Ask numen anything about your workspace. It will traverse all
                channel contexts to find the answer.
              </p>
            )}

            {question && (
              <div className="mb-3">
                <div className="flex items-start gap-2">
                  <div className="w-6 h-6 rounded-full bg-accent-light/40 text-accent text-[10px] font-semibold flex items-center justify-center flex-shrink-0 mt-0.5">
                    You
                  </div>
                  <p className="text-sm text-foreground">{question}</p>
                </div>
              </div>
            )}

            {botState === "traversing" && (
              <ContextTraversal
                channels={channels}
                onComplete={handleTraversalComplete}
              />
            )}

            {botState === "responding" && answer && (
              <div className="animate-message-appear">
                <div className="flex items-start gap-2">
                  <div className="w-6 h-6 rounded-full bg-accent text-white font-display text-[10px] flex items-center justify-center flex-shrink-0 mt-0.5">
                    n
                  </div>
                  <div>
                    <p className="text-sm text-foreground">{answer}</p>
                    <button
                      onClick={handleReset}
                      className="mt-2 text-xs text-accent hover:underline"
                    >
                      Ask another question
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="px-4 py-3 border-t border-[var(--border)]">
            <div className="flex items-center gap-2 bg-[var(--bg-alt)] border border-[var(--border)] rounded-lg px-3 py-2">
              <input
                type="text"
                placeholder="Ask numen anything..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAsk()}
                disabled={botState === "traversing"}
                className="flex-1 bg-transparent text-sm focus:outline-none placeholder:text-[var(--text-muted)] disabled:opacity-50"
              />
              <button
                onClick={handleAsk}
                disabled={!input.trim() || botState === "traversing"}
                className="text-accent hover:text-accent/80 transition-colors disabled:opacity-30"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
