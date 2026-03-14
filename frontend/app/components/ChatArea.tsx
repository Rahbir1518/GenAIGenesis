"use client";

import { useState, useRef, useEffect } from "react";
import { supabase } from "@/lib/supabase";

type Message = {
  id: string;
  user_id: string | null;
  display_name: string;
  content: string;
  is_bot: boolean;
  created_at: string;
};

type ChatAreaProps = {
  channelId: string;
  channelName: string;
  messages: Message[];
  currentUserId: string;
  currentDisplayName: string;
  onMessageSent: (msg: Message) => void;
};

export default function ChatArea({
  channelId,
  channelName,
  messages,
  currentUserId,
  currentDisplayName,
  onMessageSent,
}: ChatAreaProps) {
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    if (!input.trim() || sending) return;
    setSending(true);

    const { data, error } = await supabase
      .from("messages")
      .insert({
        channel_id: channelId,
        user_id: currentUserId,
        display_name: currentDisplayName,
        content: input.trim(),
        is_bot: false,
      })
      .select()
      .single();

    if (!error && data) {
      onMessageSent(data);
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
      <div className="border-b border-[var(--border)] px-5 py-3 flex items-center gap-2 flex-shrink-0">
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
        {messages.map((msg) => (
          <div key={msg.id} className="animate-message-appear">
            <div className="flex items-start gap-3">
              <div
                className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-semibold ${
                  msg.is_bot
                    ? "bg-accent text-white font-display"
                    : "bg-accent-light/40 text-accent"
                }`}
              >
                {msg.is_bot ? "n" : getInitials(msg.display_name)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <span
                    className={`text-sm font-semibold ${
                      msg.is_bot ? "text-accent" : "text-foreground"
                    }`}
                  >
                    {msg.display_name}
                  </span>
                  {msg.is_bot && (
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
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input bar */}
      <div className="border-t border-[var(--border)] px-5 py-3 flex-shrink-0">
        <div className="flex items-center gap-2 bg-[var(--bg-alt)] border border-[var(--border)] rounded-lg px-3 py-2">
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
