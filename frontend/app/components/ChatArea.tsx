"use client";

import { useState, useRef, useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import { apiFetch } from "@/lib/api";
import ContextTreeVisual from "./ContextTreeVisual";

type Message = {
  id: string;
  sender_id: string | null;
  content: string;
  created_at: string;
  channel: string;
  workspace_members?: { display_name: string } | null;
};

type ChatAreaProps = {
  workspaceId: string;
  channel: string;
  channelName: string;
  messages: Message[];
  currentUserId: string;
  currentDisplayName: string;
  onMessageSent: (msg: Message) => void;
};

export default function ChatArea({
  workspaceId,
  channel,
  channelName,
  messages,
  currentUserId,
  currentDisplayName,
  onMessageSent,
}: ChatAreaProps) {
  const { getToken } = useAuth();
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    if (!input.trim() || sending) return;
    setSending(true);

    try {
      const token = await getToken();
      const msg = await apiFetch<Message>(
        `/workspaces/${workspaceId}/messages`,
        {
          method: "POST",
          token,
          body: JSON.stringify({
            channel,
            content: input.trim(),
          }),
        },
      );
      onMessageSent(msg);
    } catch {
      // fail silently for now
    }

    setInput("");
    setSending(false);
  }

  function formatTime(dateStr: string) {
    return new Date(dateStr).toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function getInitials(name: string) {
    return name
      .split(" ")
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }

  return (
    <div className="flex-1 flex flex-col min-w-0">
      {/* Channel header */}
      <div className="border-b border-white/10 px-5 py-3 flex items-center gap-2 flex-shrink-0">
        <span className="text-[var(--text-muted)] text-sm">#</span>
        <span className="font-semibold text-sm">{channelName}</span>
        {channelName === "general" && (
          <span className="px-2 py-0.5 rounded-full bg-accent/10 text-accent text-[10px] font-medium">
            Context source for all agents
          </span>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-[var(--text-muted)]">
            <p className="text-lg font-semibold mb-1">#{channelName}</p>
            <p className="text-sm">
              This is the start of #{channelName}. Send a message to get
              started.
            </p>
          </div>
        )}
        {messages.map((msg) => {
          const isBot = !msg.sender_id;
          const senderName = msg.workspace_members?.display_name || (isBot ? "numen" : "Unknown");
          const isContextAnswer = msg.content.startsWith("<!-- context-answer -->");
          const isContextPing = msg.content.startsWith("<!-- context-ping -->");

          // Parse traversal data from embedded JSON
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          let traversalNodes: any[] = [];
          const traversalMatch = msg.content.match(/<!-- traversal-data:([\s\S]*?) -->/);
          if (traversalMatch) {
            try {
              traversalNodes = JSON.parse(traversalMatch[1]);
            } catch {
              // Ignore parse errors
            }
          }

          // Render rich context-answer card
          if (isBot && isContextAnswer) {
            const lines = msg.content.split("\n").filter(l => !l.startsWith("<!--"));
            const questionLine = lines.find(l => l.includes("**Q:**")) || "";
            const answerLine = lines.find(l => l.includes("**A:**")) || "";
            const metaLine = lines.find(l => l.includes("Source:") || l.includes("Confidence:")) || "";
            const caveatLine = lines.find(l => l.includes("⚠️")) || "";

            const question = questionLine.replace(/.*\*\*Q:\*\*\s*/, "");
            const answer = answerLine.replace(/.*\*\*A:\*\*\s*/, "");
            const confidenceMatch = metaLine.match(/Confidence:\s*(\d+)%/);
            const confidence = confidenceMatch ? parseInt(confidenceMatch[1]) : 0;
            const sourceMatch = metaLine.match(/Source:\s*([^·]+)/);
            const source = sourceMatch ? sourceMatch[1].trim() : "";
            const caveat = caveatLine.replace(/⚠️\s*/, "").trim();

            return (
              <div key={msg.id} className="animate-message-appear">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-semibold bg-accent text-white font-display">
                    n
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold text-accent">numen</span>
                      <span className="px-1 py-0.5 rounded bg-accent/10 text-accent text-[9px] font-semibold uppercase leading-none">
                        Bot
                      </span>
                      <span className="text-[10px] text-[var(--text-muted)]">
                        {formatTime(msg.created_at)}
                      </span>
                    </div>

                    {/* Traversal Diagram */}
                    {traversalNodes.length > 0 && (
                      <ContextTreeVisual
                        nodes={traversalNodes}
                        activeIndex={-1}
                        isComplete={true}
                        questionText={question}
                      />
                    )}

                    <div className="bg-accent/5 border border-accent/20 rounded-lg p-3 space-y-2">
                      <div className="flex items-start gap-2">
                        <span className="text-accent text-sm mt-0.5">❓</span>
                        <p className="text-sm text-[var(--text-muted)]">{question}</p>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-accent text-sm mt-0.5">💡</span>
                        <p className="text-sm text-foreground whitespace-pre-wrap">{answer}</p>
                      </div>
                      {caveat && (
                        <div className="mt-1 p-2 bg-amber-400/10 border border-amber-400/30 rounded text-xs text-amber-400">
                          ⚠️ {caveat}
                        </div>
                      )}
                      <div className="flex flex-wrap gap-2 pt-1">
                        {source && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded bg-accent/15 text-accent text-xs font-mono">
                            📍 {source}
                          </span>
                        )}
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-mono ${
                          confidence >= 82
                            ? "bg-green-400/10 text-green-400"
                            : confidence >= 50
                            ? "bg-amber-400/10 text-amber-400"
                            : "bg-red-400/10 text-red-400"
                        }`}>
                          {confidence}% confidence
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          }

          // Render rich context-ping card
          if (isBot && isContextPing) {
            const lines = msg.content.split("\n").filter(l => !l.startsWith("<!--"));
            const pingLine = lines.find(l => l.includes("**Ping:**")) || "";
            const questionLine = lines.find(l => l.startsWith("❓")) || "";
            const metaLine = lines.find(l => l.includes("Domain:") || l.includes("Confidence:")) || "";
            const routeReason = lines.find(l => l.includes("Routed because")) || "";

            const pingedName = pingLine.replace(/.*@/, "").trim();
            const questionText = questionLine.replace(/❓\s*/, "").trim();
            const confidenceMatch = metaLine.match(/Confidence:\s*(\d+)%/);
            const confidence = confidenceMatch ? parseInt(confidenceMatch[1]) : 0;
            const domainMatch = metaLine.match(/Domain:\s*([^·]+)/);
            const domain = domainMatch ? domainMatch[1].trim() : "";

            return (
              <div key={msg.id} className="animate-message-appear">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-semibold bg-accent text-white font-display">
                    n
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold text-accent">numen</span>
                      <span className="px-1 py-0.5 rounded bg-accent/10 text-accent text-[9px] font-semibold uppercase leading-none">
                        Bot
                      </span>
                      <span className="text-[10px] text-[var(--text-muted)]">
                        {formatTime(msg.created_at)}
                      </span>
                    </div>

                    {/* Traversal Diagram */}
                    {traversalNodes.length > 0 && (
                      <ContextTreeVisual
                        nodes={traversalNodes}
                        activeIndex={-1}
                        isComplete={true}
                        questionText={questionText}
                      />
                    )}

                    <div className="bg-purple-400/5 border border-purple-400/20 rounded-lg p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">🔔</span>
                        <div>
                          <p className="text-sm font-semibold text-purple-400">
                            Ping: @{pingedName}
                          </p>
                          <p className="text-[10px] text-[var(--text-muted)]">
                            {domain && `${domain} · `}Confidence: {confidence}%
                          </p>
                        </div>
                      </div>
                      <p className="text-sm text-foreground">{questionText}</p>
                      {routeReason && (
                        <p className="text-[10px] text-[var(--text-muted)] italic">{routeReason}</p>
                      )}
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-mono bg-red-400/10 text-red-400`}>
                        {confidence}% confidence — routed to expert
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          }

          // Default message rendering
          return (
            <div key={msg.id} className="animate-message-appear">
              <div className="flex items-start gap-3">
                <div
                  className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-semibold ${
                    isBot
                      ? "bg-accent text-white font-display"
                      : "bg-accent/15 text-accent"
                  }`}
                >
                  {isBot ? "n" : getInitials(senderName)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span
                      className={`text-sm font-semibold ${
                        isBot ? "text-accent" : "text-foreground"
                      }`}
                    >
                      {senderName}
                    </span>
                    {isBot && (
                      <span className="px-1 py-0.5 rounded bg-accent/10 text-accent text-[9px] font-semibold uppercase leading-none">
                        Bot
                      </span>
                    )}
                    <span className="text-[10px] text-[var(--text-muted)]">
                      {formatTime(msg.created_at)}
                    </span>
                  </div>
                  <p className="text-sm text-foreground break-words">
                    {msg.content}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input bar */}
      <div className="border-t border-white/10 px-5 py-3 flex-shrink-0">
        <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-3 py-2">
          <input
            type="text"
            placeholder={`Message #${channelName}...`}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            className="flex-1 bg-transparent text-sm focus:outline-none placeholder:text-[var(--text-muted)]"
          />
          <button
            onClick={handleSend}
            disabled={sending || !input.trim()}
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
  );
}
