"use client";

import { useState, useEffect, useCallback } from "react";
import { useUser } from "@clerk/nextjs";
import { supabase } from "@/lib/supabase";
import Sidebar from "./Sidebar";
import ChatArea from "./ChatArea";
import CreateAgentModal from "./CreateAgentModal";
import BotPanel from "./BotPanel";

type WorkspaceViewProps = {
  workspaceId: string;
  workspaceName: string;
  inviteCode: string;
};

type Channel = {
  id: string;
  name: string;
  agent_id: string | null;
};

type Agent = {
  id: string;
  name: string;
  badge: string;
};

type Member = {
  id: string;
  user_id: string;
  display_name: string;
  role: string;
};

type Message = {
  id: string;
  user_id: string | null;
  display_name: string;
  content: string;
  is_bot: boolean;
  created_at: string;
};

export default function WorkspaceView({
  workspaceId,
  workspaceName,
  inviteCode,
}: WorkspaceViewProps) {
  const { user } = useUser();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [showCreateAgent, setShowCreateAgent] = useState(false);
  const [showBot, setShowBot] = useState(false);

  const fetchData = useCallback(async () => {
    const [channelsRes, agentsRes, membersRes] = await Promise.all([
      supabase
        .from("channels")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("created_at"),
      supabase
        .from("agents")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("created_at"),
      supabase
        .from("workspace_members")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("created_at"),
    ]);

    if (channelsRes.data) {
      setChannels(channelsRes.data);
      if (!activeChannelId && channelsRes.data.length > 0) {
        setActiveChannelId(channelsRes.data[0].id);
      }
    }
    if (agentsRes.data) setAgents(agentsRes.data);
    if (membersRes.data) setMembers(membersRes.data);
  }, [workspaceId, activeChannelId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!activeChannelId) return;

    async function fetchMessages() {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("channel_id", activeChannelId)
        .order("created_at");
      if (data) setMessages(data);
    }

    fetchMessages();
  }, [activeChannelId]);

  const activeChannel = channels.find((ch) => ch.id === activeChannelId);

  const displayName =
    user?.fullName || user?.primaryEmailAddress?.emailAddress || "User";

  return (
    <div className="h-screen flex bg-white">
      <Sidebar
        workspaceName={workspaceName}
        inviteCode={inviteCode}
        channels={channels}
        agents={agents}
        members={members}
        activeChannelId={activeChannelId}
        onSelectChannel={setActiveChannelId}
        onOpenCreateAgent={() => setShowCreateAgent(true)}
        onOpenBot={() => setShowBot(true)}
      />

      {activeChannel && user ? (
        <ChatArea
          channelId={activeChannel.id}
          channelName={activeChannel.name}
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
