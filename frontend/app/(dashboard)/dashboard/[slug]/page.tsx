import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { apiFetch } from "@/lib/api";
import WorkspaceView from "@/app/components/WorkspaceView";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export default async function WorkspacePage({ params }: PageProps) {
  const { userId, getToken } = await auth();
  if (!userId) return null;

  const { slug } = await params;
  const token = await getToken();

  try {
    // Get all workspaces the user belongs to, then find the one matching slug
    const workspaces = await apiFetch<any[]>("/workspaces", { token });
    const workspace = workspaces?.find((ws: any) => ws.slug === slug);

    if (!workspace) {
      redirect("/dashboard");
    }

    return (
      <WorkspaceView
        workspaceId={workspace.id}
        workspaceName={workspace.name}
        workspaceSlug={workspace.slug}
      />
    );
  } catch {
    redirect("/dashboard");
  }
}
