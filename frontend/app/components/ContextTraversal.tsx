"use client";

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

type ContextTraversalProps = {
  nodes: TraversalNode[];
  activeIndex: number;
  isComplete: boolean;
};

export default function ContextTraversal({
  nodes,
  activeIndex,
  isComplete,
}: ContextTraversalProps) {
  if (nodes.length === 0) return null;

  function confidenceColor(conf: number) {
    if (conf >= 0.82) return "bg-green-400";
    if (conf >= 0.50) return "bg-amber-400";
    if (conf >= 0.30) return "bg-orange-400";
    return "bg-red-400";
  }

  function borderColor(conf: number) {
    if (conf >= 0.82) return "border-green-300 bg-green-50/50";
    if (conf >= 0.50) return "border-amber-300 bg-amber-50/50";
    if (conf >= 0.30) return "border-orange-300 bg-orange-50/50";
    return "border-red-300 bg-red-50/50";
  }

  return (
    <div className="py-2">
      <p className="text-[10px] text-[var(--text-muted)] mb-2 font-mono flex items-center gap-1.5">
        <svg className="w-3 h-3 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
        Traversing Context Tree — {nodes.length} node{nodes.length !== 1 ? "s" : ""}
      </p>

      <div className="space-y-1.5">
        {nodes.map((node, i) => {
          const isActive = i === activeIndex && !isComplete;
          const isVisited = i < activeIndex || isComplete;
          const ec = node.effective_confidence;

          return (
            <div
              key={node.node_id + "-" + i}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all duration-300 ${
                isActive
                  ? "border-accent bg-accent-light/30 animate-node-pulse shadow-sm"
                  : isVisited
                  ? borderColor(ec)
                  : "border-[var(--border)] bg-white opacity-50"
              }`}
            >
              {/* Node type icon */}
              <div
                className={`w-2 h-2 rounded-full flex-shrink-0 transition-colors duration-300 ${
                  isActive
                    ? "bg-accent"
                    : isVisited
                    ? confidenceColor(ec)
                    : "bg-gray-300"
                }`}
              />

              {/* Label */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span
                    className={`text-sm font-mono truncate transition-colors duration-300 ${
                      isActive || isVisited ? "text-foreground" : "text-[var(--text-muted)]"
                    }`}
                  >
                    {node.label}
                  </span>
                  {node.node_type === "domain" && (
                    <span className="text-[9px] text-purple-500 bg-purple-50 px-1 rounded">domain</span>
                  )}
                </div>
                {isVisited && node.summary && (
                  <p className="text-[10px] text-[var(--text-muted)] truncate mt-0.5">
                    {node.summary}
                  </p>
                )}
              </div>

              {/* Confidence bar */}
              {(isActive || isVisited) && (
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <div className="w-12 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${confidenceColor(ec)}`}
                      style={{ width: `${Math.round(ec * 100)}%` }}
                    />
                  </div>
                  <span className="text-[9px] font-mono text-[var(--text-muted)] w-7 text-right">
                    {Math.round(ec * 100)}%
                  </span>
                </div>
              )}

              {/* Status */}
              {isActive && (
                <span className="text-[10px] text-accent animate-pulse flex-shrink-0">
                  searching...
                </span>
              )}
              {isVisited && (
                <svg className="w-3.5 h-3.5 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
