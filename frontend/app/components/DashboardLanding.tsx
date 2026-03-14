"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useUser, useAuth } from "@clerk/nextjs";
import { apiFetch } from "@/lib/api";

export default function DashboardLanding() {
  const router = useRouter();
  const { user } = useUser();
  const { getToken } = useAuth();
  const [workspaceName, setWorkspaceName] = useState("");
  const [joinSlug, setJoinSlug] = useState("");
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState("");

  function slugify(name: string) {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  }

  async function handleCreate() {
    if (!workspaceName.trim() || !user) return;
    setCreating(true);
    setError("");

    try {
      const token = await getToken();
      const displayName =
        user.fullName || user.primaryEmailAddress?.emailAddress || user.id;
      const created = await apiFetch<any>("/workspaces", {
        method: "POST",
        token,
        body: JSON.stringify({
          name: workspaceName.trim(),
          slug: slugify(workspaceName),
          display_name: displayName,
        }),
      });
      router.push(`/dashboard/${created.slug}`);
    } catch (e: any) {
      setError(e.message || "Failed to create workspace");
    } finally {
      setCreating(false);
    }
  }

  async function handleJoin() {
    if (!joinSlug.trim() || !user) return;
    setJoining(true);
    setError("");

    try {
      const token = await getToken();
      const displayName =
        user.fullName || user.primaryEmailAddress?.emailAddress || user.id;
      const joined = await apiFetch<any>("/workspace/join", {
        method: "POST",
        token,
        body: JSON.stringify({
          slug: joinSlug.trim(),
          display_name: displayName,
        }),
      });
      router.push(`/dashboard/${joined.slug}`);
    } catch (e: any) {
      setError(e.message || "Invalid workspace slug");
    } finally {
      setJoining(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="max-w-2xl w-full">
        <h1 className="text-3xl font-display font-bold text-center mb-2">
          Welcome to numen
        </h1>
        <p className="text-center text-[var(--text-muted)] mb-10">
          Create a workspace or join an existing one to get started.
        </p>

        {error && (
          <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm text-center">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Create workspace card */}
          <div className="border border-[var(--border)] rounded-xl p-6 bg-white">
            <h2 className="text-lg font-semibold mb-1">Create a workspace</h2>
            <p className="text-sm text-[var(--text-muted)] mb-4">
              Start fresh with your team.
            </p>
            <input
              type="text"
              placeholder="Workspace name"
              value={workspaceName}
              onChange={(e) => setWorkspaceName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              className="w-full px-3 py-2 border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent mb-3"
            />
            <button
              onClick={handleCreate}
              disabled={creating || !workspaceName.trim()}
              className="w-full py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {creating ? "Creating..." : "Create workspace"}
            </button>
          </div>

          {/* Join workspace card */}
          <div className="border border-[var(--border)] rounded-xl p-6 bg-white">
            <h2 className="text-lg font-semibold mb-1">Join a workspace</h2>
            <p className="text-sm text-[var(--text-muted)] mb-4">
              Enter a workspace slug from your team.
            </p>
            <input
              type="text"
              placeholder="Workspace slug"
              value={joinSlug}
              onChange={(e) => setJoinSlug(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleJoin()}
              className="w-full px-3 py-2 border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent mb-3 font-mono"
            />
            <button
              onClick={handleJoin}
              disabled={joining || !joinSlug.trim()}
              className="w-full py-2 bg-foreground text-white rounded-lg text-sm font-medium hover:bg-foreground/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {joining ? "Joining..." : "Join workspace"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
