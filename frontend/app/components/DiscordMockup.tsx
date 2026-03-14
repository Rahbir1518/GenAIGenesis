"use client";

import { useState, useEffect, useRef } from "react";

type Phase = "idle" | "typing" | "sent" | "bot-typing" | "bot-response" | "fade-out";

const conversations = [
  {
    user: "Sarah Chen",
    initials: "SC",
    color: "bg-blue-100",
    time: "10:42 AM",
    question: "Does our API support batch uploads over 10k rows?",
    answer:
      "Yes. The /v2/bulk-import endpoint supports up to 50k rows per request with streaming.",
    source: "src/api/bulk.ts",
    confidence: "94%",
  },
  {
    user: "James Okafor",
    initials: "JO",
    color: "bg-purple-100",
    time: "11:15 AM",
    question: "What's the rate limit on the analytics endpoint?",
    answer:
      "The /v1/analytics endpoint allows 200 requests per minute per API key, with burst support up to 50 concurrent.",
    source: "src/api/analytics.ts",
    confidence: "97%",
  },
  {
    user: "Priya Sharma",
    initials: "PS",
    color: "bg-emerald-100",
    time: "2:08 PM",
    question: "Can we customize the webhook payload format?",
    answer:
      "Yes. Pass a template parameter to /v2/webhooks/configure with a JSON schema. Supports Handlebars syntax.",
    source: "src/webhooks/config.ts",
    confidence: "91%",
  },
  {
    user: "Alex Rivera",
    initials: "AR",
    color: "bg-orange-100",
    time: "3:34 PM",
    question: "How does the SDK handle token refresh automatically?",
    answer:
      "The SDK intercepts 401 responses, calls /auth/refresh with the stored refresh token, retries the original request transparently.",
    source: "src/auth/refresh.ts",
    confidence: "96%",
  },
];

export default function DiscordMockup({ className = "" }: { className?: string }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [index, setIndex] = useState(0);
  const [typedChars, setTypedChars] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const convo = conversations[index];

  // Typewriter effect
  useEffect(() => {
    if (phase !== "typing") return;

    const len = convo.question.length;
    intervalRef.current = setInterval(() => {
      setTypedChars((prev) => {
        if (prev >= len) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          setPhase("sent");
          return prev;
        }
        return prev + 1;
      });
    }, 30);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [phase, convo.question.length]);

  // Phase timing orchestration
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;

    switch (phase) {
      case "idle":
        timeout = setTimeout(() => {
          setTypedChars(0);
          setPhase("typing");
        }, 500);
        break;
      case "sent":
        timeout = setTimeout(() => setPhase("bot-typing"), 300);
        break;
      case "bot-typing":
        timeout = setTimeout(() => setPhase("bot-response"), 1200);
        break;
      case "bot-response":
        timeout = setTimeout(() => setPhase("fade-out"), 2500);
        break;
      case "fade-out":
        timeout = setTimeout(() => {
          setIndex((prev) => (prev + 1) % conversations.length);
          setPhase("idle");
        }, 400);
        break;
    }

    return () => clearTimeout(timeout);
  }, [phase]);

  const showUserMessage = phase === "sent" || phase === "bot-typing" || phase === "bot-response" || phase === "fade-out";
  const showBotTyping = phase === "bot-typing";
  const showBotResponse = phase === "bot-response" || phase === "fade-out";
  const isFading = phase === "fade-out";

  return (
    <div className={`animate-fade-in-up-delay-1 ${className}`}>
      <div className="border border-gray-200 rounded-lg overflow-hidden shadow-lg">
        {/* Header bar */}
        <div className="bg-gray-900 px-4 py-2.5 flex items-center gap-2">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-400" />
            <div className="w-3 h-3 rounded-full bg-yellow-400" />
            <div className="w-3 h-3 rounded-full bg-green-400" />
          </div>
          <span className="ml-2 font-display text-xs tracking-[0.2em] text-gray-400">
            numen
          </span>
        </div>

        {/* Body: server sidebar + channels sidebar + main */}
        <div className="flex bg-white text-sm">
          {/* Server sidebar */}
          <div className="w-12 bg-gray-100 border-r border-gray-200 flex flex-col items-center py-3 gap-2 flex-shrink-0">
            {/* numen server (active) */}
            <div className="w-9 h-9 rounded-2xl bg-accent text-white font-display text-xs flex items-center justify-center cursor-default">
              n
            </div>
            {/* Divider */}
            <div className="w-6 h-0.5 bg-gray-300 rounded-full" />
            {/* Other servers */}
            <div className="w-9 h-9 rounded-full bg-gray-300 text-gray-500 text-[10px] font-semibold flex items-center justify-center cursor-default">
              AC
            </div>
            <div className="w-9 h-9 rounded-full bg-gray-300 text-gray-500 text-[10px] font-semibold flex items-center justify-center cursor-default">
              DT
            </div>
            <div className="w-9 h-9 rounded-full bg-gray-300 text-gray-500 text-[10px] font-semibold flex items-center justify-center cursor-default">
              OS
            </div>
          </div>

          {/* Channels sidebar */}
          <div className="w-40 bg-gray-50 border-r border-gray-200 p-3 flex-shrink-0">
            <p className="font-mono text-[10px] tracking-widest uppercase text-gray-400 mb-2">
              Channels
            </p>
            <div className="space-y-0.5 text-xs text-gray-500">
              <p className="px-2 py-1 rounded cursor-default"># general</p>
              <p className="px-2 py-1 rounded bg-accent-light/50 text-accent font-semibold cursor-default">
                # ask-numen
              </p>
              <p className="px-2 py-1 rounded cursor-default"># engineering</p>
              <p className="px-2 py-1 rounded cursor-default"># product</p>
            </div>
          </div>

          {/* Main chat area */}
          <div className="flex-1 flex flex-col min-h-[280px]">
            {/* Channel header */}
            <div className="border-b border-gray-200 px-4 py-2 flex items-center gap-1.5">
              <span className="text-gray-400 text-xs">#</span>
              <span className="font-semibold text-sm text-foreground">
                ask-numen
              </span>
            </div>

            {/* Messages */}
            <div className="flex-1 p-4 space-y-4">
              <div
                className={`transition-all duration-400 ${isFading ? "opacity-0 translate-y-2" : "opacity-100 translate-y-0"}`}
              >
                {/* User message */}
                {showUserMessage && (
                  <div className="mb-4 animate-message-appear">
                    <div className="flex items-center gap-2 mb-1">
                      <div
                        className={`w-6 h-6 rounded-full ${convo.color} text-accent text-[10px] font-semibold flex items-center justify-center`}
                      >
                        {convo.initials}
                      </div>
                      <span className="text-sm font-semibold text-foreground">
                        {convo.user}
                      </span>
                      <span className="text-[10px] text-gray-400">
                        {convo.time}
                      </span>
                    </div>
                    <p className="pl-8 text-sm text-foreground">
                      {convo.question}
                    </p>
                  </div>
                )}

                {/* Bot typing indicator */}
                {showBotTyping && (
                  <div className="flex items-center gap-2 pl-0 animate-message-appear">
                    <div className="w-6 h-6 rounded-full bg-accent text-white font-display text-[10px] flex items-center justify-center">
                      n
                    </div>
                    <span className="text-sm text-accent font-semibold">numen</span>
                    <span className="text-xs text-gray-400">is typing</span>
                    <span className="flex gap-0.5 ml-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce-dot-1" />
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce-dot-2" />
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce-dot-3" />
                    </span>
                  </div>
                )}

                {/* Bot response */}
                {showBotResponse && (
                  <div className="animate-message-appear">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-6 h-6 rounded-full bg-accent text-white font-display text-[10px] flex items-center justify-center">
                        n
                      </div>
                      <span className="text-sm font-semibold text-accent">
                        numen
                      </span>
                      <span className="px-1 py-0.5 rounded bg-accent/10 text-accent text-[9px] font-semibold uppercase leading-none">
                        Bot
                      </span>
                      <span className="text-[10px] text-gray-400">
                        {convo.time}
                      </span>
                    </div>
                    <div className="pl-8">
                      <p className="text-sm text-foreground">{convo.answer}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <span className="inline-flex items-center px-2 py-0.5 rounded bg-accent-light text-accent text-xs font-mono">
                          {convo.source}
                        </span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded bg-green-50 text-green-700 text-xs font-mono">
                          {convo.confidence} confidence
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Input bar */}
            <div className="border-t border-gray-200 px-4 py-3 flex items-center gap-2">
              {phase === "typing" ? (
                <>
                  <span className="text-sm text-foreground">
                    {convo.question.slice(0, typedChars)}
                  </span>
                  <span className="w-0.5 h-4 bg-accent animate-cursor" />
                </>
              ) : (
                <>
                  <span className="text-sm text-gray-400">
                    Ask numen anything...
                  </span>
                  <span className="w-0.5 h-4 bg-accent animate-cursor" />
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
