"use client";

import { useEffect, useRef, useMemo } from "react";

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
  parent_id?: string | null;
  parent_label?: string | null;
  depth?: number;
};

type ContextTreeVisualProps = {
  nodes: TraversalNode[];
  activeIndex: number;
  isComplete: boolean;
  questionText?: string;
};

/* ── Layout constants ─────────────────────────────────────────── */
const NODE_W = 160;
const NODE_H = 56;
const LEVEL_GAP_Y = 80;
const NODE_GAP_X = 24;
const ROOT_Y = 30;
const SVG_PAD = 32;

/* ── Colour helpers ───────────────────────────────────────────── */
function confidenceColor(c: number) {
  if (c >= 0.82) return "#34d399";
  if (c >= 0.5) return "#fbbf24";
  if (c >= 0.3) return "#fb923c";
  return "#f87171";
}

function glowColor(c: number) {
  if (c >= 0.82) return "rgba(52,211,153,0.45)";
  if (c >= 0.5) return "rgba(251,191,36,0.35)";
  if (c >= 0.3) return "rgba(251,146,60,0.30)";
  return "rgba(248,113,113,0.30)";
}

/* ── Build tree layout ────────────────────────────────────────── */
type LayoutNode = {
  id: string;
  label: string;
  summary: string;
  ec: number;
  similarity: number;
  nodeType: string;
  ownerName: string;
  parentId: string | null;
  x: number;
  y: number;
  visitIndex: number; // -1 = root, >=0 = traversal order
};

function buildLayout(
  nodes: TraversalNode[],
  questionText: string,
): { layoutNodes: LayoutNode[]; edges: [string, string][]; width: number; height: number } {
  if (nodes.length === 0) return { layoutNodes: [], edges: [], width: 300, height: 100 };

  const layoutNodes: LayoutNode[] = [];
  const edges: [string, string][] = [];

  // Root = the user's question
  const rootId = "__root__";
  layoutNodes.push({
    id: rootId,
    label: questionText || "Query",
    summary: "",
    ec: 1,
    similarity: 1,
    nodeType: "root",
    ownerName: "",
    parentId: null,
    x: 0,
    y: ROOT_Y,
    visitIndex: -1,
  });

  // Group nodes by their parent_label (domain level)
  const domainMap = new Map<string, TraversalNode[]>();
  const noDomainNodes: TraversalNode[] = [];

  for (const n of nodes) {
    const domainKey = n.parent_label || n.agent_name || "Context";
    if (n.node_type === "domain") {
      // Domain nodes themselves are first-level
      if (!domainMap.has(n.label)) domainMap.set(n.label, []);
    } else if (n.parent_label) {
      if (!domainMap.has(n.parent_label)) domainMap.set(n.parent_label, []);
      domainMap.get(n.parent_label)!.push(n);
    } else {
      noDomainNodes.push(n);
    }
  }

  // If no natural domains found, group all under a single "Context" domain
  if (domainMap.size === 0 && noDomainNodes.length > 0) {
    domainMap.set("Context", noDomainNodes);
  } else if (noDomainNodes.length > 0) {
    // Add orphans to first domain or create an "Other" domain
    const firstKey = domainMap.keys().next().value!;
    const existing = domainMap.get(firstKey) || [];
    domainMap.set(firstKey, [...existing, ...noDomainNodes]);
  }

  // Also add domain-type nodes as children if they appear in the traversal
  for (const n of nodes) {
    if (n.node_type === "domain") {
      const children = domainMap.get(n.label) || [];
      // Make sure we don't already have this domain registered
      if (!children.some((c) => c.node_id === n.node_id)) {
        // Domain node itself is a traversal node, we'll represent it
      }
    }
  }

  const domainKeys = Array.from(domainMap.keys());
  const totalDomains = domainKeys.length;

  // Calculate each domain's subtree width (max of domain node vs its children)
  const domainWidths: number[] = domainKeys.map((key) => {
    const children = domainMap.get(key) || [];
    const childCount = children.length;
    if (childCount <= 1) return NODE_W;
    return childCount * NODE_W + (childCount - 1) * NODE_GAP_X;
  });

  const totalTreeWidth = domainWidths.reduce((sum, w) => sum + w, 0) + (totalDomains - 1) * NODE_GAP_X;
  let cursorX = -totalTreeWidth / 2;

  const domainNodeIds = new Map<string, string>();

  for (let di = 0; di < totalDomains; di++) {
    const domainLabel = domainKeys[di];
    const domainNodeId = `__domain_${di}__`;
    domainNodeIds.set(domainLabel, domainNodeId);

    const subtreeWidth = domainWidths[di];
    const domainCenterX = cursorX + subtreeWidth / 2;
    cursorX += subtreeWidth + NODE_GAP_X;

    // Check if this domain itself is in the traversal list
    const domainTraversalNode = nodes.find(
      (n) => n.node_type === "domain" && n.label === domainLabel,
    );
    const visitIdx = domainTraversalNode ? nodes.indexOf(domainTraversalNode) : -1;

    layoutNodes.push({
      id: domainNodeId,
      label: domainLabel,
      summary: domainTraversalNode?.summary || `Domain: ${domainLabel}`,
      ec: domainTraversalNode?.effective_confidence || 0.5,
      similarity: domainTraversalNode?.similarity || 0,
      nodeType: "domain",
      ownerName: "",
      parentId: rootId,
      x: domainCenterX,
      y: ROOT_Y + LEVEL_GAP_Y,
      visitIndex: visitIdx,
    });
    edges.push([rootId, domainNodeId]);
  }

  // Lay out leaf nodes (level 2) under each domain
  let maxY = ROOT_Y + LEVEL_GAP_Y;

  for (let di = 0; di < totalDomains; di++) {
    const domainLabel = domainKeys[di];
    const children = domainMap.get(domainLabel) || [];
    const parentNodeId = domainNodeIds.get(domainLabel)!;
    const parentX = layoutNodes.find((n) => n.id === parentNodeId)!.x;

    const childCount = children.length;
    if (childCount === 0) continue;

    const childTotalWidth = childCount * NODE_W + (childCount - 1) * NODE_GAP_X;
    const childStartX = parentX - childTotalWidth / 2 + NODE_W / 2;
    const childY = ROOT_Y + LEVEL_GAP_Y * 2;
    maxY = Math.max(maxY, childY);

    for (let ci = 0; ci < childCount; ci++) {
      const child = children[ci];
      const childNodeId = child.node_id;
      const visitIdx = nodes.indexOf(child);

      layoutNodes.push({
        id: childNodeId,
        label: child.label,
        summary: child.summary,
        ec: child.effective_confidence,
        similarity: child.similarity,
        nodeType: child.node_type,
        ownerName: child.owner_name,
        parentId: parentNodeId,
        x: childStartX + ci * (NODE_W + NODE_GAP_X),
        y: childY,
        visitIndex: visitIdx,
      });
      edges.push([parentNodeId, childNodeId]);
    }
  }

  // Calculate SVG dimensions
  const allX = layoutNodes.map((n) => n.x);
  const minX = Math.min(...allX) - NODE_W / 2 - SVG_PAD;
  const maxX = Math.max(...allX) + NODE_W / 2 + SVG_PAD;

  // Normalize coordinates so minX → SVG_PAD
  const offsetX = -minX + SVG_PAD;
  for (const n of layoutNodes) {
    n.x += offsetX;
  }

  return {
    layoutNodes,
    edges,
    width: maxX - minX + SVG_PAD,
    height: maxY + NODE_H + SVG_PAD * 2,
  };
}

/* ── Component ────────────────────────────────────────────────── */
export default function ContextTreeVisual({
  nodes,
  activeIndex,
  isComplete,
  questionText,
}: ContextTreeVisualProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const { layoutNodes, edges, width, height } = useMemo(
    () => buildLayout(nodes, questionText || "Query"),
    [nodes, questionText],
  );

  // Auto-scroll to keep active node visible
  useEffect(() => {
    if (containerRef.current && activeIndex >= 0) {
      containerRef.current.scrollTo({
        top: containerRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [activeIndex, nodes.length]);

  if (nodes.length === 0) return null;

  const nodeMap = new Map(layoutNodes.map((n) => [n.id, n]));

  return (
    <div className="py-2">
      {/* Header */}
      <p className="text-[10px] text-[var(--text-muted)] mb-2 font-mono flex items-center gap-1.5">
        <svg className="w-3 h-3 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
        Traversing Context Tree — {nodes.length} node{nodes.length !== 1 ? "s" : ""}
      </p>

      {/* SVG Tree */}
      <div
        ref={containerRef}
        className="overflow-x-auto overflow-y-auto rounded-lg border border-white/10 bg-[#0a0918]/80 backdrop-blur-sm"
        style={{ maxHeight: 320 }}
      >
        <svg
          width={Math.max(width, 300)}
          height={Math.max(height, 200)}
          viewBox={`0 0 ${Math.max(width, 300)} ${Math.max(height, 200)}`}
          className="block"
        >
          <defs>
            {/* Glow filters for different states */}
            <filter id="glow-active" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="6" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="glow-found" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="10" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            {/* Gradient for edges */}
            <linearGradient id="edge-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="rgba(37,99,235,0.6)" />
              <stop offset="100%" stopColor="rgba(37,99,235,0.15)" />
            </linearGradient>
            <linearGradient id="edge-active" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="rgba(37,99,235,1)" />
              <stop offset="100%" stopColor="rgba(37,99,235,0.5)" />
            </linearGradient>
            <linearGradient id="edge-visited" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="rgba(52,211,153,0.7)" />
              <stop offset="100%" stopColor="rgba(52,211,153,0.2)" />
            </linearGradient>
          </defs>

          {/* Render edges */}
          {edges.map(([fromId, toId], i) => {
            const from = nodeMap.get(fromId);
            const to = nodeMap.get(toId);
            if (!from || !to) return null;

            const x1 = from.x;
            const y1 = from.y + NODE_H / 2;
            const x2 = to.x;
            const y2 = to.y - NODE_H / 2;
            const midY = (y1 + y2) / 2;

            // Determine edge state
            const toVisitIdx = to.visitIndex;
            const isEdgeActive = toVisitIdx === activeIndex && !isComplete;
            const isEdgeVisited = toVisitIdx >= 0 && (toVisitIdx < activeIndex || isComplete);
            const isEdgeReachable = toVisitIdx >= 0 && toVisitIdx <= (nodes.length - 1);

            let strokeUrl = "url(#edge-gradient)";
            let strokeWidth = 1.5;
            let opacity = 0.3;
            if (isEdgeActive) {
              strokeUrl = "url(#edge-active)";
              strokeWidth = 2.5;
              opacity = 1;
            } else if (isEdgeVisited) {
              strokeUrl = "url(#edge-visited)";
              strokeWidth = 2;
              opacity = 0.9;
            } else if (isEdgeReachable) {
              opacity = 0.5;
            }
            // Root edges are always somewhat visible
            if (fromId === "__root__") {
              opacity = Math.max(opacity, 0.5);
            }

            return (
              <path
                key={`edge-${i}`}
                d={`M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`}
                fill="none"
                stroke={strokeUrl}
                strokeWidth={strokeWidth}
                opacity={opacity}
                strokeLinecap="round"
                className={isEdgeActive ? "animate-tree-line-draw" : isEdgeVisited ? "animate-tree-line-visited" : ""}
                style={{
                  strokeDasharray: isEdgeActive ? 200 : "none",
                  strokeDashoffset: 0,
                  transition: "opacity 0.4s ease, stroke-width 0.3s ease",
                }}
              />
            );
          })}

          {/* Render nodes */}
          {layoutNodes.map((node) => {
            const isRoot = node.id === "__root__";
            const visitIdx = node.visitIndex;
            const isActive = !isRoot && visitIdx === activeIndex && !isComplete;
            const isVisited = !isRoot && visitIdx >= 0 && (visitIdx < activeIndex || isComplete);
            const isFoundNode = isComplete && visitIdx === 0; // best match
            const isReachable = isRoot || visitIdx >= 0;

            const nx = node.x - NODE_W / 2;
            const ny = node.y - NODE_H / 2;

            let borderColor = "rgba(255,255,255,0.08)";
            let bgColor = "rgba(255,255,255,0.03)";
            let textOpacity = 0.4;

            if (isRoot) {
              borderColor = "rgba(37,99,235,0.5)";
              bgColor = "rgba(37,99,235,0.12)";
              textOpacity = 1;
            } else if (isActive) {
              borderColor = "rgba(37,99,235,0.8)";
              bgColor = "rgba(37,99,235,0.15)";
              textOpacity = 1;
            } else if (isFoundNode) {
              borderColor = confidenceColor(node.ec);
              bgColor = glowColor(node.ec);
              textOpacity = 1;
            } else if (isVisited) {
              borderColor = `${confidenceColor(node.ec)}88`;
              bgColor = `${glowColor(node.ec)}`;
              textOpacity = 0.95;
            } else if (isReachable) {
              textOpacity = 0.5;
              borderColor = "rgba(255,255,255,0.1)";
              bgColor = "rgba(255,255,255,0.04)";
            }

            const filter = isActive
              ? "url(#glow-active)"
              : isFoundNode
              ? "url(#glow-found)"
              : "none";

            return (
              <g
                key={node.id}
                className={
                  isActive
                    ? "animate-tree-node-active"
                    : isVisited && !isRoot
                    ? "animate-tree-node-appear"
                    : ""
                }
                style={{ opacity: textOpacity }}
              >
                {/* Node background */}
                <rect
                  x={nx}
                  y={ny}
                  width={NODE_W}
                  height={NODE_H}
                  rx={12}
                  fill={bgColor}
                  stroke={borderColor}
                  strokeWidth={isActive || isFoundNode ? 2 : 1}
                  filter={filter}
                  style={{ transition: "all 0.4s ease" }}
                />

                {/* Node type badge */}
                {node.nodeType === "domain" && (
                  <g>
                    <rect
                      x={nx + 6}
                      y={ny + 6}
                      width={14}
                      height={14}
                      rx={3}
                      fill="rgba(168,85,247,0.2)"
                      stroke="rgba(168,85,247,0.4)"
                      strokeWidth={0.5}
                    />
                    <text
                      x={nx + 13}
                      y={ny + 16}
                      textAnchor="middle"
                      fontSize={8}
                      fontWeight={600}
                      fill="#a855f7"
                    >
                      D
                    </text>
                  </g>
                )}

                {isRoot && (
                  <g>
                    <rect
                      x={nx + 6}
                      y={ny + 6}
                      width={14}
                      height={14}
                      rx={3}
                      fill="rgba(37,99,235,0.25)"
                      stroke="rgba(37,99,235,0.5)"
                      strokeWidth={0.5}
                    />
                    <text
                      x={nx + 13}
                      y={ny + 16}
                      textAnchor="middle"
                      fontSize={8}
                      fill="#2563eb"
                    >
                      ?
                    </text>
                  </g>
                )}

                {/* Label */}
                <text
                  x={nx + (node.nodeType === "domain" || isRoot ? 26 : 10)}
                  y={ny + 18}
                  fontSize={11}
                  fontWeight={600}
                  fill="white"
                  opacity={textOpacity}
                  style={{ fontFamily: "var(--font-mono, monospace)" }}
                >
                  {node.label.length > 16 ? node.label.slice(0, 15) + "…" : node.label}
                </text>

                {/* Confidence bar */}
                {!isRoot && isReachable && (
                  <g>
                    <rect
                      x={nx + 10}
                      y={ny + NODE_H - 18}
                      width={NODE_W - 20}
                      height={4}
                      rx={2}
                      fill="rgba(255,255,255,0.07)"
                    />
                    <rect
                      x={nx + 10}
                      y={ny + NODE_H - 18}
                      width={Math.max(0, (NODE_W - 20) * node.ec)}
                      height={4}
                      rx={2}
                      fill={confidenceColor(node.ec)}
                      opacity={isVisited || isActive ? 0.9 : 0.4}
                      style={{ transition: "width 0.5s ease, opacity 0.3s ease" }}
                    />
                    {/* Confidence % text */}
                    <text
                      x={nx + NODE_W - 10}
                      y={ny + NODE_H - 22}
                      textAnchor="end"
                      fontSize={8}
                      fill={confidenceColor(node.ec)}
                      opacity={isVisited || isActive ? 0.8 : 0.3}
                      style={{ fontFamily: "var(--font-mono, monospace)" }}
                    >
                      {Math.round(node.ec * 100)}%
                    </text>
                  </g>
                )}

                {/* Summary text (only for visited nodes) */}
                {!isRoot && isVisited && node.summary && (
                  <text
                    x={nx + 10}
                    y={ny + 32}
                    fontSize={8}
                    fill="rgba(156,163,175,0.7)"
                    style={{ fontFamily: "var(--font-sans, sans-serif)" }}
                  >
                    {node.summary.length > 22 ? node.summary.slice(0, 21) + "…" : node.summary}
                  </text>
                )}

                {/* Active searching indicator */}
                {isActive && (
                  <g>
                    <circle
                      cx={nx + NODE_W - 16}
                      cy={ny + 14}
                      r={4}
                      fill="#2563eb"
                      className="animate-pulse"
                    />
                    <text
                      x={nx + 10}
                      y={ny + 32}
                      fontSize={8}
                      fill="#2563eb"
                      className="animate-pulse"
                      style={{ fontFamily: "var(--font-mono, monospace)" }}
                    >
                      searching…
                    </text>
                  </g>
                )}

                {/* Visited checkmark */}
                {isVisited && !isFoundNode && (
                  <g transform={`translate(${nx + NODE_W - 20}, ${ny + 8})`}>
                    <circle cx={5} cy={5} r={6} fill="rgba(52,211,153,0.15)" />
                    <path
                      d="M3 5.5L5 7.5L8 3.5"
                      stroke="#34d399"
                      strokeWidth={1.5}
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </g>
                )}

                {/* Found node — star icon */}
                {isFoundNode && (
                  <g transform={`translate(${nx + NODE_W - 22}, ${ny + 6})`}>
                    <circle
                      cx={6}
                      cy={6}
                      r={8}
                      fill="rgba(52,211,153,0.2)"
                      stroke="rgba(52,211,153,0.6)"
                      strokeWidth={1}
                      className="animate-tree-found-pulse"
                    />
                    <text
                      x={6}
                      y={10}
                      textAnchor="middle"
                      fontSize={10}
                    >
                      ✓
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
