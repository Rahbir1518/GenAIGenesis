import { auth } from "@clerk/nextjs/server";
import { apiFetch } from "@/lib/api";
import DashboardLanding from "@/app/components/DashboardLanding";
import Link from "next/link";

export default async function DashboardPage() {
  const { userId, getToken } = await auth();

  if (!userId) return null;

  const token = await getToken();

  try {
    const workspaces = await apiFetch<any[]>("/workspaces", { token });

    if (!workspaces || workspaces.length === 0) {
      return <DashboardLanding />;
    }

    // Show a workspace picker so users can choose or create more
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-2xl w-full">
          <h1 className="text-3xl font-display font-bold text-center mb-2">
            Your Workspaces
          </h1>
          <p className="text-center text-[var(--text-muted)] mb-8">
            Select a workspace or create a new one.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
            {workspaces.map((ws: any) => (
              <Link
                key={ws.id}
                href={`/dashboard/${ws.slug}`}
                className="block border border-[var(--border)] rounded-xl p-5 bg-white hover:border-accent hover:shadow-md transition-all group"
              >
                <h3 className="font-semibold text-base group-hover:text-accent transition-colors">
                  {ws.name}
                </h3>
                <p className="text-xs text-[var(--text-muted)] mt-1 font-mono">
                  /{ws.slug}
                </p>
              </Link>
            ))}
          </div>

          <div className="border-t border-[var(--border)] pt-6">
            <DashboardLanding />
          </div>
        </div>
      </div>
    );
  } catch {
    return <DashboardLanding />;
  }
}
