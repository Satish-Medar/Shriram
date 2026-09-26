"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DocumentRegister from "@/components/DocumentRegister";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { AppRole } from "@/lib/appRole";

export default function CustomerFilesPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [userEmail, setUserEmail] = useState("");
  const [role, setRole] = useState<"owner" | "agent" | null>(null);
  const [agentName, setAgentName] = useState<string | undefined>();
  const router = useRouter();

  useEffect(() => {
    const checkSession = async () => {
      if (!isSupabaseConfigured || !supabase) {
        router.replace("/login");
        return;
      }
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        router.replace("/login");
        return;
      }
      setUserEmail(session.user.email ?? "");
      const { data: assignedRole, error: roleError } =
        await supabase.rpc("current_app_role");
      if (roleError) {
        router.replace("/login");
        return;
      }
      if (assignedRole === "report2") {
        router.replace("/");
        return;
      }
      if (assignedRole !== "owner" && assignedRole !== "agent") {
        router.replace("/login");
        return;
      }
      setRole(assignedRole as AppRole & ("owner" | "agent"));
      if (assignedRole === "agent") {
        const { data: assignedAgent } =
          await supabase.rpc("current_agent_name");
        setAgentName(assignedAgent ?? undefined);
      }
      setIsLoading(false);
    };
    void checkSession();
  }, [router]);

  const handleSignOut = async () => {
    await supabase?.auth.signOut();
    router.replace("/login");
  };

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-sm text-slate-500">Loading customer files...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-teal-800">
              Branch portal
            </p>
            <h1 className="mt-1 text-xl font-semibold text-slate-900">
              Customer Files
            </h1>
            <p className="mt-1 text-xs text-slate-500">{userEmail}</p>
          </div>
          <div className="flex items-center gap-2">
            {role === "owner" && (
              <Link
                href="/"
                className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Daily business report
              </Link>
            )}
            <button
              type="button"
              onClick={handleSignOut}
              className="rounded-md bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>
      {role && <DocumentRegister role={role} assignedAgent={agentName} />}
    </main>
  );
}
