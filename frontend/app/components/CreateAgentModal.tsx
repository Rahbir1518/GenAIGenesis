"use client";

import { useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { apiFetch } from "@/lib/api";

type CreateAgentModalProps = {
  workspaceId: string;
  onClose: () => void;
  onCreated: () => void;
};

const TYPE_OPTIONS = [
  { value: "sales", label: "Sales" },
  { value: "engineering", label: "Engineering" },
  { value: "custom", label: "Custom" },
];

export default function CreateAgentModal({
  workspaceId,
  onClose,
  onCreated,
}: CreateAgentModalProps) {
  const { getToken } = useAuth();
  const [name, setName] = useState("");
  const [type, setType] = useState("sales");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  async function handleCreate() {
    if (!name.trim()) return;
    setCreating(true);
    setError("");

    try {
      const token = await getToken();
      await apiFetch(`/workspaces/${workspaceId}/agents`, {
        method: "POST",
        token,
        body: JSON.stringify({
          type,
          name: name.trim(),
          extraction_prompt: `Extract knowledge relevant to ${type} from messages.`,
        }),
      });
      onCreated();
      onClose();
    } catch (e: any) {
      setError(e.message || "Failed to create agent");
    } finally {
      setCreating(false);
    }
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
              Type
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full px-3 py-2 border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent bg-white"
            >
              {TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
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
            disabled={creating || !name.trim()}
            className="flex-1 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {creating ? "Creating..." : "Create agent"}
          </button>
        </div>
      </div>
    </div>
  );
}
