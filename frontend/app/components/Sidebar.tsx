"use client";

import { useState } from "react";

type Channel = {
  id: string;
  name: string;
  agentId: string | null;
};

type Agent = {
  id: string;
  name: string;
  type: string;
};

type Member = {
  id: string;
  user_id: string;
  display_name: string;
  role: string;
};

type SidebarProps = {
  workspaceName: string;
  inviteCode: string;
  channels: Channel[];
  agents: Agent[];
  members: Member[];
  activeChannelId: string | null;
  onSelectChannel: (channelId: string) => void;
  onOpenCreateAgent: () => void;
  onOpenBot: () => void;
  interruptCount?: number;
};

export default function Sidebar({
  workspaceName,
  inviteCode,
  channels,
  agents,
  members,
  activeChannelId,
  onSelectChannel,
  onOpenCreateAgent,
  onOpenBot,
  interruptCount = 0,
}: SidebarProps) {
  const [showInvite, setShowInvite] = useState(false);
  const [copied, setCopied] = useState(false);

  function copyInviteCode() {
    navigator.clipboard.writeText(inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="w-60 bg-[var(--bg-alt)] border-r border-[var(--border)] flex flex-col h-full flex-shrink-0">
      {/* Workspace header */}
      <div className="px-4 py-3 border-b border-[var(--border)]">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-sm truncate">{workspaceName}</h2>
          <button
            onClick={() => setShowInvite(!showInvite)}
            className="text-xs text-[var(--text-muted)] hover:text-foreground transition-colors"
            title="Invite code"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
          </button>
        </div>
        <p className="text-[10px] text-[var(--text-muted)]">
          {members.length} member{members.length !== 1 ? "s" : ""}
        </p>
        {showInvite && (
          <div className="mt-2 p-2 bg-white rounded-lg border border-[var(--border)] text-xs">
            <p className="text-[var(--text-muted)] mb-1">Workspace slug (share to invite):</p>
            <div className="flex items-center gap-2">
              <code className="font-mono text-accent flex-1">{inviteCode}</code>
              <button
                onClick={copyInviteCode}
                className="text-[10px] text-[var(--text-muted)] hover:text-foreground"
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
        {/* Channels */}
        <div>
          <p className="px-2 text-[10px] font-mono tracking-widest uppercase text-[var(--text-muted)] mb-1">
            Channels
          </p>
          <div className="space-y-0.5">
            {channels.filter(ch => !ch.agentId).map((ch) => (
              <button
                key={ch.id}
                onClick={() => onSelectChannel(ch.id)}
                className={`w-full text-left px-2 py-1 rounded text-sm transition-colors ${
                  activeChannelId === ch.id
                    ? "bg-accent-light/50 text-accent font-semibold"
                    : "text-[var(--text-muted)] hover:bg-gray-100 hover:text-foreground"
                }`}
              >
                # {ch.name}
              </button>
            ))}
          </div>
        </div>

        {/* Agents */}
        <div>
          <div className="flex items-center justify-between px-2 mb-1">
            <p className="text-[10px] font-mono tracking-widest uppercase text-[var(--text-muted)]">
              Agents
            </p>
            <button
              onClick={onOpenCreateAgent}
              className="text-[var(--text-muted)] hover:text-accent transition-colors"
              title="Create agent"
            >
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
            </button>
          </div>
          <div className="space-y-0.5">
            {agents.length === 0 && (
              <p className="px-2 text-xs text-[var(--text-muted)] italic">
                No agents yet
              </p>
            )}
            {agents.map((agent) => {
              const channelId = `agent:${agent.id}`;
              const isActive = activeChannelId === channelId;
              return (
                <button
                  key={agent.id}
                  onClick={() => onSelectChannel(channelId)}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors ${
                    isActive
                      ? "bg-accent-light/50 text-accent font-semibold"
                      : "text-[var(--text-muted)] hover:bg-gray-100 hover:text-foreground"
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full text-[9px] font-semibold flex items-center justify-center flex-shrink-0 ${
                    isActive ? "bg-accent text-white" : "bg-accent/10 text-accent"
                  }`}>
                    {agent.type.slice(0, 2).toUpperCase()}
                  </div>
                  <span className="truncate">{agent.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Members */}
        <div>
          <p className="px-2 text-[10px] font-mono tracking-widest uppercase text-[var(--text-muted)] mb-1">
            Members
          </p>
          <div className="space-y-0.5">
            {members.map((member) => (
              <div
                key={member.id}
                className="flex items-center gap-2 px-2 py-1 text-sm text-[var(--text-muted)]"
              >
                <div className="relative">
                  <div className="w-5 h-5 rounded-full bg-gray-200 text-gray-600 text-[9px] font-semibold flex items-center justify-center">
                    {member.display_name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-green-400 border border-[var(--bg-alt)]" />
                </div>
                <span className="truncate">{member.display_name}</span>
                {member.role === "admin" && (
                  <span className="text-[9px] text-accent bg-accent/10 px-1 rounded">
                    admin
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Interrupt counter + Bot bar */}
      <div className="mx-2 mb-2 space-y-2">
        {interruptCount > 0 && (
          <div className="px-3 py-2 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-[10px] text-green-600 font-mono uppercase">Interrupts Saved</p>
            <p className="text-lg font-bold text-green-700 tabular-nums">{interruptCount}</p>
          </div>
        )}

        <button
          onClick={onOpenBot}
          className="w-full px-3 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg text-sm font-medium hover:from-purple-700 hover:to-blue-700 transition-all flex items-center gap-2 shadow-sm"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
            />
          </svg>
          Ask ContextBridge
        </button>
      </div>
    </div>
  );
}
