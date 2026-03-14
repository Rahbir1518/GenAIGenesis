"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

type CreateAgentModalProps = {
  workspaceId: string;
  onClose: () => void;
  onCreated: () => void;
};

const BADGE_OPTIONS = [
  { value: "sales", label: "Sales" },
  { value: "eng", label: "Engineering" },
  { value: "support", label: "Support" },
  { value: "marketing", label: "Marketing" },
  { value: "custom", label: "Custom" },
];

export default function CreateAgentModal({
  workspaceId,
  onClose,
  onCreated,
}: CreateAgentModalProps) {
  const [name, setName] = useState("");
  const [badge, setBadge] = useState("sales");
  const [customBadge, setCustomBadge] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  async function handleCreate() {
    const finalBadge = badge === "custom" ? customBadge.trim() : badge;
    if (!name.trim() || !finalBadge) return;
    setCreating(true);
    setError("");

    // Create agent
    const { data: agent, error: agentError } = await supabase
      .from("agents")
      .insert({
        workspace_id: workspaceId,
        name: name.trim(),
        badge: finalBadge,
      })
      .select()
      .single();

    if (agentError || !agent) {
      setError(agentError?.message || "Failed to create agent");
      setCreating(false);
      return;
    }

    // Create corresponding channel
    const { error: channelError } = await supabase.from("channels").insert({
      workspace_id: workspaceId,
      name: finalBadge,
      agent_id: agent.id,
    });

    if (channelError) {
      setError(channelError.message);
      setCreating(false);
      return;
    }

    setCreating(false);
    onCreated();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-xl border border-[var(--border)] shadow-xl w-full max-w-md p-6 animate-fade-in-up">
        <h2 className="text-lg font-semibold mb-1">Create an Agent</h2>
        <p className="text-sm text-[var(--text-muted)] mb-4">
          Agents read #general for context and get their own channel.
        </p>

        {error && (
          <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded text-red-700 text-xs">
            {error}
          </div>
        )}

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">
              Agent name
            </label>
            <input
              type="text"
              placeholder="e.g. Sales Agent"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">
              Badge / Type
            </label>
            <select
              value={badge}
              onChange={(e) => setBadge(e.target.value)}
              className="w-full px-3 py-2 border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent bg-white"
            >
              {BADGE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {badge === "custom" && (
            <div>
              <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">
                Custom badge name
              </label>
              <input
                type="text"
                placeholder="e.g. design"
                value={customBadge}
                onChange={(e) => setCustomBadge(e.target.value)}
                className="w-full px-3 py-2 border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent font-mono"
              />
            </div>
          )}
        </div>

        <div className="flex gap-2 mt-5">
          <button
            onClick={onClose}
            className="flex-1 py-2 border border-[var(--border)] rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={
              creating ||
              !name.trim() ||
              (badge === "custom" && !customBadge.trim())
            }
            className="flex-1 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {creating ? "Creating..." : "Create agent"}
          </button>
        </div>
      </div>
    </div>
  );
}
