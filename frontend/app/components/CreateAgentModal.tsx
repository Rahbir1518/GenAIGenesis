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
  { value: "sales", label: "Sales", desc: "Extracts customer-facing knowledge" },
  { value: "engineering", label: "Engineering", desc: "Extracts technical knowledge" },
  { value: "custom", label: "Custom", desc: "General knowledge extraction" },
];

export default function CreateAgentModal({
  workspaceId,
  onClose,
  onCreated,
}: CreateAgentModalProps) {
  const { getToken } = useAuth();
  const [name, setName] = useState("");
  const [type, setType] = useState("engineering");
  const [creating, setCreating] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(false);
  const [error, setError] = useState("");

  async function handleCreate() {
    if (!name.trim()) return;
    setCreating(true);
    setError("");

    try {
      const token = await getToken();
      const agent = await apiFetch<any>(`/workspaces/${workspaceId}/agents`, {
        method: "POST",
        token,
        body: JSON.stringify({
          type,
          name: name.trim(),
          extraction_prompt: `Extract knowledge relevant to ${type} from messages.`,
        }),
      });

      // Trigger bootstrap scan
      setBootstrapping(true);
      try {
        await apiFetch(`/agents/${agent.id}/bootstrap`, {
          method: "POST",
          token,
        });
      } catch {
        // Bootstrap is optional — agent still works
      }

      onCreated();
      onClose();
    } catch (e: any) {
      setError(e.message || "Failed to create agent");
    } finally {
      setCreating(false);
      setBootstrapping(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-xl border border-[var(--border)] shadow-xl w-full max-w-md p-6 animate-fade-in-up">
        <h2 className="text-lg font-semibold mb-1">Create an Agent</h2>
        <p className="text-sm text-[var(--text-muted)] mb-4">
          Agents read #general for context and build a Knowledge Tree automatically.
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
              placeholder="e.g. Engineering Agent"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-2">
              Type
            </label>
            <div className="grid grid-cols-3 gap-2">
              {TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setType(opt.value)}
                  className={`p-2 rounded-lg border text-left transition-all ${
                    type === opt.value
                      ? "border-accent bg-accent-light/30 ring-1 ring-accent/20"
                      : "border-[var(--border)] hover:border-gray-300"
                  }`}
                >
                  <p className={`text-xs font-semibold ${type === opt.value ? "text-accent" : "text-foreground"}`}>
                    {opt.label}
                  </p>
                  <p className="text-[9px] text-[var(--text-muted)] mt-0.5">{opt.desc}</p>
                </button>
              ))}
            </div>
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
            {bootstrapping
              ? "Building tree..."
              : creating
              ? "Creating..."
              : "Create agent"}
          </button>
        </div>

        {bootstrapping && (
          <div className="mt-3 flex items-center gap-2 text-xs text-[var(--text-muted)]">
            <div className="w-3 h-3 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
            Scanning existing messages to build initial Context Tree...
          </div>
        )}
      </div>
    </div>
  );
}
