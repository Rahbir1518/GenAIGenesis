"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useUser, useAuth, UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { apiFetch } from "@/lib/api";

export default function DashboardLanding({ embedded }: { embedded?: boolean }) {
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

  const content = (
    <>
      <h1 className="text-3xl font-display font-bold text-center mb-2">
        {embedded ? "Create or join a workspace" : "Welcome to numen"}
      </h1>
      <p className="text-center text-[var(--text-muted)] mb-10">
        {embedded
          ? "Or select one of your existing workspaces above."
          : "Create a workspace or join an existing one to get started."}
      </p>

      {error && (
        <div className="mb-6 p-3 bg-red-400/10 border border-red-400/30 rounded-lg text-red-400 text-sm text-center">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Create workspace card */}
        <div className="border border-white/10 rounded-xl p-6 bg-white/5">
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
            className="w-full px-3 py-2 border border-white/10 bg-white/5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent mb-3"
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
        <div className="border border-white/10 rounded-xl p-6 bg-white/5">
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
            className="w-full px-3 py-2 border border-white/10 bg-white/5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent mb-3 font-mono"
          />
          <button
            onClick={handleJoin}
            disabled={joining || !joinSlug.trim()}
            className="w-full py-2 bg-white/10 text-white border border-white/20 rounded-lg text-sm font-medium hover:bg-white/15 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {joining ? "Joining..." : "Join workspace"}
          </button>
        </div>
      </div>
    </>
  );

  if (embedded) {
    return <div className="max-w-2xl w-full mx-auto mt-8">{content}</div>;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="p-4 px-6 flex items-center justify-between shrink-0">
        <Link href="/" className="font-display font-bold text-lg tracking-[0.3em] text-white hover:text-white/80 transition-colors">
          numen
        </Link>
        <UserButton />
      </div>
      <div className="flex-1 flex items-center justify-center p-6 -mt-16">
        <div className="max-w-2xl w-full">{content}</div>
      </div>
    </div>
  );
}
