import { auth } from "@clerk/nextjs/server";
import { apiFetch } from "@/lib/api";
import DashboardLanding from "@/app/components/DashboardLanding";
import WorkspaceView from "@/app/components/WorkspaceView";

export default async function DashboardPage() {
  const { userId, getToken } = await auth();

  if (!userId) return null;

  const token = await getToken();

  try {
    // Backend GET /workspaces returns workspaces the user is a member of
    const workspaces = await apiFetch<any[]>("/workspaces", { token });

    if (!workspaces || workspaces.length === 0) {
      return <DashboardLanding />;
    }

    const workspace = workspaces[0];

    return (
      <WorkspaceView
        workspaceId={workspace.id}
        workspaceName={workspace.name}
        workspaceSlug={workspace.slug}
      />
    );
  } catch {
    // If backend is down or errors, show landing
    return <DashboardLanding />;
  }
}
