"use client";

import { useState, useEffect, useCallback } from "react";
import { useUser, useAuth } from "@clerk/nextjs";
import { apiFetch } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import Sidebar from "./Sidebar";
import ChatArea from "./ChatArea";
import CreateAgentModal from "./CreateAgentModal";
import BotPanel from "./BotPanel";
import ContextTree from "./ContextTree";
import PingNotification from "./PingNotification";

type WorkspaceViewProps = {
  workspaceId: string;
  workspaceName: string;
  workspaceSlug: string;
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

type Message = {
  id: string;
  sender_id: string | null;
  content: string;
  created_at: string;
  channel: string;
  workspace_members?: { display_name: string } | null;
};

export default function WorkspaceView({
  workspaceId,
  workspaceName,
  workspaceSlug,
}: WorkspaceViewProps) {
  const { user } = useUser();
  const { getToken } = useAuth();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [activeChannel, setActiveChannel] = useState("general");
  const [messages, setMessages] = useState<Message[]>([]);
  const [showCreateAgent, setShowCreateAgent] = useState(false);
  const [showBot, setShowBot] = useState(false);
  const [interruptCount, setInterruptCount] = useState(0);
  const [currentMemberId, setCurrentMemberId] = useState<string>("");

  // Currently selected agent for tree view
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    const token = await getToken();
    try {
      const [agentsData, membersData, messagesData] = await Promise.all([
        apiFetch<Agent[]>(`/workspaces/${workspaceId}/agents`, { token }),
        apiFetch<Member[]>(`/workspaces/${workspaceId}/members`, { token }),
        apiFetch<Message[]>(
          `/workspaces/${workspaceId}/messages?channel=${activeChannel}`,
          { token },
        ),
      ]);
      setAgents(agentsData || []);
      setMembers(membersData || []);
      setMessages((messagesData || []).reverse());

      // Find current user's member ID
      if (user && membersData) {
        const me = membersData.find((m) => m.user_id === user.id);
        if (me) setCurrentMemberId(me.id);
      }
    } catch {
      // Backend may be down
    }
  }, [workspaceId, activeChannel, getToken, user]);

  // Fetch interrupt count
  const fetchInterrupts = useCallback(async () => {
    try {
      const token = await getToken();
      const data = await apiFetch<{ interrupts_saved: number }>(
        `/workspaces/${workspaceId}/interrupt-count`,
        { token },
      );
      setInterruptCount(data?.interrupts_saved || 0);
    } catch { /* silently fail */ }
  }, [workspaceId, getToken]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    fetchInterrupts();
    const interval = setInterval(fetchInterrupts, 15000);
    return () => clearInterval(interval);
  }, [fetchInterrupts]);

  // Supabase Realtime for messages
  useEffect(() => {
    const channel = supabase
      .channel(`messages:${workspaceId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `workspace_id=eq.${workspaceId}`,
        },
        async (payload) => {
          const newMsg = payload.new as Message;
          if (newMsg.channel === activeChannel) {
            setMessages((prev) => {
              if (prev.some((m) => m.id === newMsg.id)) return prev;
              return [...prev, newMsg];
            });
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [workspaceId, activeChannel]);

  // Build channels list
  const channels = [
    { id: "general", name: "general", agentId: null },
    ...agents.map((a) => ({
      id: `agent:${a.id}`,
      name: a.name,
      agentId: a.id,
    })),
  ];

  const displayName =
    user?.fullName || user?.primaryEmailAddress?.emailAddress || "User";

  // Determine if we're viewing an agent channel
  const activeAgent = agents.find(
    (a) => activeChannel === `agent:${a.id}`,
  );

  function handleChannelSelect(channelId: string) {
    setActiveChannel(channelId);
    const agentMatch = agents.find((a) => channelId === `agent:${a.id}`);
    setSelectedAgentId(agentMatch ? agentMatch.id : null);
  }

  function handlePing(message: string) {
    // Send the ping message to #general and to the active agent channel
    handleSendPingMessage(message);
  }

  async function handleSendPingMessage(message: string) {
    try {
      const token = await getToken();
      // Always post to #general
      await apiFetch(`/workspaces/${workspaceId}/messages`, {
        method: "POST",
        token,
        body: JSON.stringify({
          channel: "general",
          content: message,
        }),
      });
      // Also post to the active agent channel if viewing one
      if (activeAgent) {
        await apiFetch(`/workspaces/${workspaceId}/messages`, {
          method: "POST",
          token,
          body: JSON.stringify({
            channel: `agent:${activeAgent.id}`,
            content: `<!-- context-ping -->\n🔔 **Ping:** ${message}`,
          }),
        });
      }
    } catch { /* fail silently */ }
  }

  return (
    <div className="h-screen flex bg-background">
      <Sidebar
        workspaceName={workspaceName}
        inviteCode={workspaceSlug}
        channels={channels}
        agents={agents}
        members={members}
        activeChannelId={activeChannel}
        onSelectChannel={handleChannelSelect}
        onOpenCreateAgent={() => setShowCreateAgent(true)}
        onOpenBot={() => setShowBot(true)}
        interruptCount={interruptCount}
      />

      {/* Main content area */}
      <div className="flex-1 flex min-w-0">
        {/* Chat area */}
        {user ? (
          <ChatArea
            workspaceId={workspaceId}
            channelName={
              channels.find((c) => c.id === activeChannel)?.name || "general"
            }
            channel={activeChannel}
            messages={messages}
            currentUserId={user.id}
            currentDisplayName={displayName}
            onMessageSent={(msg) => setMessages((prev) => [...prev, msg])}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-[var(--text-muted)]">
            <p className="text-sm">Select a channel to start chatting</p>
          </div>
        )}

        {/* Context Tree panel — visible when viewing an agent channel */}
        {activeAgent && (
          <div className="w-72 border-l border-white/10 flex-shrink-0 bg-white/5">
            <ContextTree
              agentId={activeAgent.id}
              agentName={activeAgent.name}
            />
          </div>
        )}

        {/* Right panel — stats (visible when on general) */}
        {!activeAgent && (
          <div className="w-56 border-l border-white/10 flex-shrink-0 bg-white/5 p-4 hidden lg:block">
            <h3 className="text-xs font-mono tracking-widest uppercase text-[var(--text-muted)] mb-4">
              Live Stats
            </h3>

            {/* Interrupt Counter */}
            <div className="bg-white/5 rounded-lg border border-white/10 p-3 mb-3">
              <p className="text-[10px] text-[var(--text-muted)] font-mono uppercase mb-1">
                Interrupts Saved
              </p>
              <p className="text-2xl font-bold text-accent tabular-nums">
                {interruptCount}
              </p>
              <p className="text-[9px] text-[var(--text-muted)] mt-1">
                Questions auto-answered by the bot
              </p>
            </div>

            {/* Agent count */}
            <div className="bg-white/5 rounded-lg border border-white/10 p-3 mb-3">
              <p className="text-[10px] text-[var(--text-muted)] font-mono uppercase mb-1">
                Active Agents
              </p>
              <p className="text-2xl font-bold text-foreground tabular-nums">
                {agents.length}
              </p>
            </div>

            {/* Members */}
            <div className="bg-white/5 rounded-lg border border-white/10 p-3">
              <p className="text-[10px] text-[var(--text-muted)] font-mono uppercase mb-1">
                Team Members
              </p>
              <p className="text-2xl font-bold text-foreground tabular-nums">
                {members.length}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {showCreateAgent && (
        <CreateAgentModal
          workspaceId={workspaceId}
          onClose={() => setShowCreateAgent(false)}
          onCreated={fetchData}
        />
      )}

      {showBot && currentMemberId && (
        <BotPanel
          workspaceId={workspaceId}
          memberId={currentMemberId}
          onPing={handlePing}
          onClose={() => setShowBot(false)}
        />
      )}

      {/* Ping Notifications */}
      {currentMemberId && (
        <PingNotification
          workspaceId={workspaceId}
          memberId={currentMemberId}
        />
      )}
    </div>
  );
}
