"use client";

import { useState, useRef, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import ContextTraversal from "./ContextTraversal";

type TraversalNode = {
  node_id: string;
  label: string;
  summary: string;
  confidence: number;
  effective_confidence: number;
  similarity: number;
  owner_name: string;
  node_type: string;
  agent_name: string;
};

type Expert = {
  owner_id: string;
  owner_name: string;
  domain: string;
  confidence: number;
  reason: string;
};

type ResultData = {
  type: "answer" | "answer_caveat" | "route" | "who_knows" | "no_context";
  answer?: string;
  confidence?: number;
  caveat?: string;
  source_node?: { id: string; label: string; agent_name: string };
  routed_to?: { id: string; name: string; domain: string };
  suggested_message?: string;
  experts?: Expert[];
  topic?: string;
  question_id?: string;
};

type BotPanelProps = {
  workspaceId: string;
  memberId: string;
  onPing: (message: string) => void;
  onClose: () => void;
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

export default function BotPanel({
  workspaceId,
  memberId,
  onPing,
  onClose,
}: BotPanelProps) {
  const { getToken } = useAuth();
  const [input, setInput] = useState("");
  const [question, setQuestion] = useState("");
  const [status, setStatus] = useState("");
  const [traversalNodes, setTraversalNodes] = useState<TraversalNode[]>([]);
  const [activeTraversalIndex, setActiveTraversalIndex] = useState(-1);
  const [result, setResult] = useState<ResultData | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [respondingTo, setRespondingTo] = useState<string | null>(null);
  const [responseInput, setResponseInput] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  const handleAsk = useCallback(async () => {
    if (!input.trim() || isProcessing) return;

    const q = input.trim();
    setQuestion(q);
    setInput("");
    setResult(null);
    setTraversalNodes([]);
    setActiveTraversalIndex(-1);
    setIsProcessing(true);
    setStatus("Starting...");

    try {
      const token = await getToken();
      abortRef.current = new AbortController();

      const res = await fetch(`${API_BASE}/ask`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          workspace_id: workspaceId,
          question: q,
          asked_by: memberId,
        }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        throw new Error(`API error ${res.status}`);
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      if (!reader) throw new Error("No response body");

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        let eventType = "";
        let eventData = "";

        for (const line of lines) {
          if (line.startsWith("event: ")) {
            eventType = line.slice(7).trim();
          } else if (line.startsWith("data: ")) {
            eventData = line.slice(6).trim();
          } else if (line === "" && eventType && eventData) {
            // Process complete event
            try {
              const data = JSON.parse(eventData);
              handleSSEEvent(eventType, data);
            } catch {
              // Skip malformed events
            }
            eventType = "";
            eventData = "";
          }
        }
      }
    } catch (err: any) {
      if (err.name !== "AbortError") {
        setResult({
          type: "no_context",
          answer: `Error: ${err.message}`,
          confidence: 0,
        });
      }
    } finally {
      setIsProcessing(false);
      setStatus("");
    }
  }, [input, isProcessing, workspaceId, memberId, getToken]);

  function handleSSEEvent(event: string, data: any) {
    switch (event) {
      case "status":
        setStatus(data.message || "Processing...");
        break;
      case "traversal":
        setTraversalNodes((prev) => [...prev, data as TraversalNode]);
        setActiveTraversalIndex(data.index);
        break;
      case "result":
        setResult(data as ResultData);
        setActiveTraversalIndex(-1); // Stop pulsing
        break;
      case "error":
        setResult({
          type: "no_context",
          answer: data.message || "An error occurred",
          confidence: 0,
        });
        break;
    }
  }

  function handleReset() {
    abortRef.current?.abort();
    setQuestion("");
    setResult(null);
    setTraversalNodes([]);
    setActiveTraversalIndex(-1);
    setIsProcessing(false);
    setStatus("");
  }

  async function handlePing(message: string) {
    onPing(message);
    // No need to close — let user continue
  }

  async function handleRespond(questionId: string) {
    if (!responseInput.trim()) return;
    try {
      const token = await getToken();
      await fetch(`${API_BASE}/respond/${questionId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          response_text: responseInput.trim(),
          responder_member_id: memberId,
        }),
      });
      setRespondingTo(null);
      setResponseInput("");
    } catch {
      // Silently fail
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center pointer-events-none">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 pointer-events-auto"
        onClick={onClose}
      />

      <div className="w-full max-w-2xl pointer-events-auto mb-0">
        <div className="bg-[#131127] border border-white/10 border-b-0 rounded-t-xl shadow-2xl animate-fade-in-up max-h-[80vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 flex-shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-accent text-white font-display text-[10px] flex items-center justify-center shadow-sm">
                CB
              </div>
              <span className="text-sm font-semibold">Ask ContextBridge</span>
              <span className="text-[10px] text-[var(--text-muted)]">
                Context Tree Memory
              </span>
            </div>
            <button
              onClick={onClose}
              className="text-[var(--text-muted)] hover:text-foreground transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="px-4 py-3 overflow-y-auto flex-1 min-h-0">
            {/* Idle state */}
            {!question && !isProcessing && (
              <p className="text-sm text-[var(--text-muted)] text-center py-6">
                Ask ContextBridge anything about your workspace. It will traverse
                the Context Tree to find answers or route you to the right person.
              </p>
            )}

            {/* User question */}
            {question && (
              <div className="mb-3">
                <div className="flex items-start gap-2">
                  <div className="w-6 h-6 rounded-full bg-accent/15 text-accent text-[10px] font-semibold flex items-center justify-center flex-shrink-0 mt-0.5">
                    You
                  </div>
                  <p className="text-sm text-foreground">{question}</p>
                </div>
              </div>
            )}

            {/* Status */}
            {isProcessing && status && (
              <div className="flex items-center gap-2 mb-2">
                <div className="w-4 h-4 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
                <span className="text-xs text-[var(--text-muted)] font-mono">{status}</span>
              </div>
            )}

            {/* Traversal */}
            {traversalNodes.length > 0 && (
              <ContextTraversal
                nodes={traversalNodes}
                activeIndex={activeTraversalIndex}
                isComplete={!isProcessing}
              />
            )}

            {/* Result: Direct Answer */}
            {result && (result.type === "answer" || result.type === "answer_caveat") && (
              <div className="animate-message-appear mt-3">
                <div className="flex items-start gap-2">
                  <div className="w-6 h-6 rounded-full bg-accent text-white text-[10px] flex items-center justify-center flex-shrink-0 mt-0.5">
                    CB
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground whitespace-pre-wrap">{result.answer}</p>

                    {/* Caveat */}
                    {result.type === "answer_caveat" && result.caveat && (
                      <div className="mt-2 p-2 bg-amber-400/10 border border-amber-400/30 rounded text-xs text-amber-400">
                        ⚠️ {result.caveat}
                      </div>
                    )}

                    {/* Source info */}
                    <div className="mt-2 flex flex-wrap gap-2">
                      {result.source_node && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded bg-accent/15 text-accent text-xs font-mono">
                          📍 {result.source_node.label}
                        </span>
                      )}
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-mono ${
                        (result.confidence || 0) >= 0.82
                          ? "bg-green-400/10 text-green-400"
                          : "bg-amber-400/10 text-amber-400"
                      }`}>
                        {Math.round((result.confidence || 0) * 100)}% confidence
                      </span>
                    </div>

                    <button
                      onClick={handleReset}
                      className="mt-3 text-xs text-accent hover:underline"
                    >
                      Ask another question
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Result: Route */}
            {result && result.type === "route" && (
              <div className="animate-message-appear mt-3">
                <div className="flex items-start gap-2">
                  <div className="w-6 h-6 rounded-full bg-accent text-white text-[10px] flex items-center justify-center flex-shrink-0 mt-0.5">
                    CB
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-foreground mb-2">
                      I don't have enough confidence to answer this directly. Let me route this to the right person.
                    </p>

                    <div className="p-3 bg-accent/10 border border-accent/30 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-7 h-7 rounded-full bg-accent/20 text-accent text-xs font-semibold flex items-center justify-center">
                          {(result.routed_to?.name || "?").slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-white">{result.routed_to?.name}</p>
                          <p className="text-[10px] text-accent">{result.routed_to?.domain}</p>
                        </div>
                      </div>

                      <button
                        onClick={() => handlePing(result.suggested_message || "")}
                        className="w-full py-1.5 bg-accent text-white rounded text-xs font-medium hover:bg-accent/80 transition-colors"
                      >
                        Ping {result.routed_to?.name}
                      </button>
                    </div>

                    <span className={`inline-flex items-center mt-2 px-2 py-0.5 rounded text-xs font-mono bg-red-400/10 text-red-400`}>
                      {Math.round((result.confidence || 0) * 100)}% confidence
                    </span>

                    <div className="mt-2">
                      <button onClick={handleReset} className="text-xs text-accent hover:underline">
                        Ask another question
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Result: Who Knows */}
            {result && result.type === "who_knows" && (
              <div className="animate-message-appear mt-3">
                <div className="flex items-start gap-2">
                  <div className="w-6 h-6 rounded-full bg-accent text-white text-[10px] flex items-center justify-center flex-shrink-0 mt-0.5">
                    CB
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-foreground mb-2">
                      Here are the top experts on <strong>{result.topic}</strong>:
                    </p>

                    <div className="space-y-2">
                      {(result.experts || []).map((expert, i) => (
                        <div key={i} className="p-2 bg-purple-400/10 border border-purple-400/30 rounded-lg flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-purple-400/15 text-purple-400 text-xs font-bold flex items-center justify-center flex-shrink-0">
                            #{i + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-white">{expert.owner_name}</p>
                            <p className="text-[10px] text-purple-400 truncate">{expert.reason || expert.domain}</p>
                            <span className="text-[10px] text-purple-400 font-mono">
                              {Math.round((expert.confidence || 0) * 100)}% confidence
                            </span>
                          </div>
                          <button
                            onClick={() => handlePing(`Hey ${expert.owner_name}, someone is asking about ${result.topic}`)}
                            className="px-2 py-1 bg-purple-500 text-white rounded text-[10px] font-medium hover:bg-purple-500/80 transition-colors flex-shrink-0"
                          >
                            Ping
                          </button>
                        </div>
                      ))}
                    </div>

                    <button onClick={handleReset} className="mt-3 text-xs text-accent hover:underline">
                      Ask another question
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Result: No Context */}
            {result && result.type === "no_context" && (
              <div className="animate-message-appear mt-3">
                <div className="flex items-start gap-2">
                  <div className="w-6 h-6 rounded-full bg-accent text-white text-[10px] flex items-center justify-center flex-shrink-0 mt-0.5">
                    CB
                  </div>
                  <div>
                    <p className="text-sm text-foreground">{result.answer}</p>
                    <button onClick={handleReset} className="mt-2 text-xs text-accent hover:underline">
                      Ask another question
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="px-4 py-3 border-t border-white/10 flex-shrink-0">
            <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-3 py-2">
              <input
                type="text"
                placeholder="Ask ContextBridge anything..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAsk()}
                disabled={isProcessing}
                className="flex-1 bg-transparent text-sm focus:outline-none placeholder:text-[var(--text-muted)] disabled:opacity-50"
              />
              <button
                onClick={handleAsk}
                disabled={!input.trim() || isProcessing}
                className="text-accent hover:text-accent/80 transition-colors disabled:opacity-30"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
