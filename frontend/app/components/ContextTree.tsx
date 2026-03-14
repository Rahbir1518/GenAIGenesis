"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import { apiFetch } from "@/lib/api";

type TreeNode = {
  id: string;
  agent_id: string;
  parent_id: string | null;
  node_type: string;
  label: string;
  summary: string;
  confidence: number;
  effective_confidence: number;
  owner_name: string | null;
  owner_id: string | null;
  source: string;
  updated_at: string;
};

type ContextTreeProps = {
  agentId: string;
  agentName: string;
};

export default function ContextTree({ agentId, agentName }: ContextTreeProps) {
  const { getToken } = useAuth();
  const [nodes, setNodes] = useState<TreeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const fetchNodes = useCallback(async () => {
    try {
      const token = await getToken();
      const data = await apiFetch<TreeNode[]>(`/agents/${agentId}/tree/all`, { token });
      setNodes(data || []);
    } catch {
      // Fail silently
    } finally {
      setLoading(false);
    }
  }, [agentId, getToken]);

  useEffect(() => {
    fetchNodes();
    const interval = setInterval(fetchNodes, 15000);
    return () => clearInterval(interval);
  }, [fetchNodes]);

  // Build tree structure
  const roots = nodes.filter((n) => !n.parent_id);
  const childrenOf = (parentId: string) => nodes.filter((n) => n.parent_id === parentId);

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function timeSince(dateStr: string) {
    const seconds = (Date.now() - new Date(dateStr).getTime()) / 1000;
    if (seconds < 60) return "just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  }

  function confidenceColor(ec: number) {
    if (ec >= 0.82) return "bg-green-400";
    if (ec >= 0.50) return "bg-amber-400";
    if (ec >= 0.30) return "bg-orange-400";
    return "bg-red-400";
  }

  function stalenessClass(ec: number) {
    if (ec < 0.30) return "border-l-red-400";
    if (ec < 0.50) return "border-l-amber-400";
    return "border-l-green-400";
  }

  function renderNode(node: TreeNode, depth: number = 0) {
    const children = childrenOf(node.id);
    const isExpanded = expandedIds.has(node.id);
    const hasChildren = children.length > 0;
    const ec = node.effective_confidence;
    const isHovered = hoveredId === node.id;

    return (
      <div key={node.id} style={{ marginLeft: depth * 12 }}>
        <div
          className={`flex items-start gap-2 px-2 py-1.5 rounded cursor-pointer transition-all hover:bg-gray-50 border-l-2 ${stalenessClass(ec)}`}
          onClick={() => {
            if (hasChildren) toggleExpand(node.id);
            else toggleExpand(node.id);
          }}
          onMouseEnter={() => setHoveredId(node.id)}
          onMouseLeave={() => setHoveredId(null)}
        >
          {/* Expand icon */}
          {hasChildren ? (
            <svg className={`w-3 h-3 text-[var(--text-muted)] flex-shrink-0 mt-1 transition-transform ${isExpanded ? "rotate-90" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          ) : (
            <div className="w-3 flex-shrink-0" />
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium truncate">{node.label}</span>
              {node.node_type === "domain" && (
                <span className="text-[8px] text-purple-500 bg-purple-50 px-1 rounded">D</span>
              )}
              {node.source === "bot_answer" && (
                <span className="text-[8px] text-blue-500 bg-blue-50 px-1 rounded">bot</span>
              )}
            </div>

            {/* Expanded summary */}
            {isExpanded && (
              <p className="text-[10px] text-[var(--text-muted)] mt-1 leading-relaxed">
                {node.summary}
              </p>
            )}

            {/* Hover tooltip: raw vs effective confidence */}
            {isHovered && !isExpanded && (
              <div className="text-[9px] text-[var(--text-muted)] mt-0.5 font-mono">
                raw: {Math.round(node.confidence * 100)}% · effective: {Math.round(ec * 100)}%
              </div>
            )}
          </div>

          {/* Confidence + meta */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <div className="w-8 h-1 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${confidenceColor(ec)}`}
                style={{ width: `${Math.round(ec * 100)}%` }}
              />
            </div>
            <span className="text-[8px] text-[var(--text-muted)] font-mono w-10 text-right">
              {timeSince(node.updated_at)}
            </span>
          </div>
        </div>

        {/* Children */}
        {isExpanded && hasChildren && children.map((child) => renderNode(child, depth + 1))}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-4 text-center text-[var(--text-muted)]">
        <div className="w-5 h-5 border-2 border-accent/30 border-t-accent rounded-full animate-spin mx-auto mb-2" />
        <p className="text-xs">Loading context tree...</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-3 py-2 border-b border-[var(--border)] flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold">{agentName} Context Tree</p>
            <p className="text-[10px] text-[var(--text-muted)]">
              {nodes.length} node{nodes.length !== 1 ? "s" : ""} · {roots.length} domain{roots.length !== 1 ? "s" : ""}
            </p>
          </div>
          <button
            onClick={fetchNodes}
            className="text-[var(--text-muted)] hover:text-foreground transition-colors"
            title="Refresh"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>

        {/* Legend */}
        <div className="flex gap-3 mt-1.5">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-green-400" />
            <span className="text-[8px] text-[var(--text-muted)]">Fresh</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-amber-400" />
            <span className="text-[8px] text-[var(--text-muted)]">Stale</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-red-400" />
            <span className="text-[8px] text-[var(--text-muted)]">Critical</span>
          </div>
        </div>
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {roots.length === 0 ? (
          <div className="text-center text-[var(--text-muted)] py-8">
            <p className="text-sm mb-1">No context yet</p>
            <p className="text-[10px]">
              Send messages in #general to start building the knowledge tree.
            </p>
          </div>
        ) : (
          roots.map((root) => renderNode(root))
        )}
      </div>
    </div>
  );
}
