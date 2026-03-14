"use client";

import { useState, useEffect } from "react";

type ContextNode = {
  id: string;
  label: string;
  snippet: string;
};

type ContextTraversalProps = {
  channels: { id: string; name: string }[];
  onComplete: () => void;
};

export default function ContextTraversal({
  channels,
  onComplete,
}: ContextTraversalProps) {
  const [activeIndex, setActiveIndex] = useState(-1);
  const [completedIndices, setCompletedIndices] = useState<Set<number>>(
    new Set()
  );

  const nodes: ContextNode[] = channels.map((ch) => ({
    id: ch.id,
    label: `#${ch.name}`,
    snippet: `Reading ${ch.name} context...`,
  }));

  useEffect(() => {
    if (nodes.length === 0) {
      onComplete();
      return;
    }

    let currentIndex = 0;

    function advanceNode() {
      if (currentIndex >= nodes.length) {
        onComplete();
        return;
      }

      setActiveIndex(currentIndex);

      setTimeout(() => {
        setCompletedIndices((prev) => new Set(prev).add(currentIndex));
        currentIndex++;
        advanceNode();
      }, 800);
    }

    const startTimeout = setTimeout(advanceNode, 300);
    return () => clearTimeout(startTimeout);
  }, [nodes.length, onComplete]);

  return (
    <div className="py-3">
      <p className="text-xs text-[var(--text-muted)] mb-3 font-mono">
        Traversing context...
      </p>

      <div className="space-y-2">
        {nodes.map((node, i) => {
          const isActive = i === activeIndex;
          const isCompleted = completedIndices.has(i);
          const isPending = !isActive && !isCompleted;

          return (
            <div key={node.id} className="flex items-center gap-3">
              {/* Connection line */}
              {i > 0 && (
                <div className="absolute ml-[11px] -mt-4 w-0.5 h-2">
                  <div
                    className={`w-full h-full transition-colors duration-300 ${
                      isCompleted || isActive
                        ? "bg-accent"
                        : "bg-gray-200"
                    }`}
                  />
                </div>
              )}

              {/* Node */}
              <div
                className={`relative flex items-center gap-2 px-3 py-2 rounded-lg border transition-all duration-300 ${
                  isActive
                    ? "border-accent bg-accent-light/30 animate-node-pulse"
                    : isCompleted
                    ? "border-accent/30 bg-accent-light/10"
                    : "border-[var(--border)] bg-white"
                }`}
              >
                {/* Status indicator */}
                <div
                  className={`w-2 h-2 rounded-full flex-shrink-0 transition-colors duration-300 ${
                    isActive
                      ? "bg-accent"
                      : isCompleted
                      ? "bg-green-400"
                      : "bg-gray-300"
                  }`}
                />

                <span
                  className={`text-sm font-mono transition-colors duration-300 ${
                    isPending
                      ? "text-[var(--text-muted)]"
                      : "text-foreground"
                  }`}
                >
                  {node.label}
                </span>

                {isActive && (
                  <span className="text-[10px] text-accent ml-2 animate-pulse">
                    reading...
                  </span>
                )}
                {isCompleted && (
                  <svg
                    className="w-3.5 h-3.5 text-green-500 ml-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
