"use client";

import { useState, useEffect, useCallback } from "react";
import { useUser, useAuth } from "@clerk/nextjs";
import { apiFetch } from "@/lib/api";
import Sidebar from "./Sidebar";
import ChatArea from "./ChatArea";
import CreateAgentModal from "./CreateAgentModal";
import BotPanel from "./BotPanel";

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
      // Backend returns newest-first; reverse for chat display
      setMessages((messagesData || []).reverse());
    } catch {
      // Backend may be down — fail silently for now
    }
  }, [workspaceId, activeChannel, getToken]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Build a list of "channels" from agents + the default #general
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

  return (
    <div className="h-screen flex bg-white">
      <Sidebar
        workspaceName={workspaceName}
        inviteCode={workspaceSlug}
        channels={channels}
        agents={agents}
        members={members}
        activeChannelId={activeChannel}
        onSelectChannel={setActiveChannel}
        onOpenCreateAgent={() => setShowCreateAgent(true)}
        onOpenBot={() => setShowBot(true)}
      />

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

      {showCreateAgent && (
        <CreateAgentModal
          workspaceId={workspaceId}
          onClose={() => setShowCreateAgent(false)}
          onCreated={fetchData}
        />
      )}

      {showBot && (
        <BotPanel
          channels={channels}
          onClose={() => setShowBot(false)}
        />
      )}
    </div>
  );
}
