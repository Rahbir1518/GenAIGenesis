import { auth } from "@clerk/nextjs/server";
import { supabase } from "@/lib/supabase";
import DashboardLanding from "@/app/components/DashboardLanding";
import WorkspaceView from "@/app/components/WorkspaceView";

export default async function DashboardPage() {
  const { userId } = await auth();

  if (!userId) return null;

  // Find workspaces this user belongs to
  const { data: memberships } = await supabase
    .from("workspace_members")
    .select("workspace_id, workspaces(id, name, invite_code, owner_id)")
    .eq("user_id", userId)
    .limit(1);

  const membership = memberships?.[0];
  const workspace = membership?.workspaces as
    | { id: string; name: string; invite_code: string; owner_id: string }
    | undefined;

  if (!workspace) {
    return <DashboardLanding />;
  }

  return (
    <WorkspaceView
      workspaceId={workspace.id}
      workspaceName={workspace.name}
      inviteCode={workspace.invite_code}
    />
  );
}
