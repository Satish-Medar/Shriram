"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Report2Form from "@/components/Report2Form";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { AppRole } from "@/lib/appRole";

export default function Report2Page() {
  const [isLoading, setIsLoading] = useState(true);
  const [role, setRole] = useState<AppRole | null>(null);
  const [userEmail, setUserEmail] = useState("");
  const router = useRouter();

  useEffect(() => {
    let isCurrent = true;
    const checkAccess = async () => {
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
      const { data: assignedRole, error } =
        await supabase.rpc("current_app_role");
      if (!isCurrent) return;
      if (error || (assignedRole !== "owner" && assignedRole !== "report2")) {
        router.replace(assignedRole === "agent" ? "/files" : "/");
        return;
      }
      setRole(assignedRole as AppRole);
      setUserEmail(session.user.email ?? "");
      setIsLoading(false);
    };
    void checkAccess();
    return () => {
      isCurrent = false;
    };
  }, [router]);

  const handleSignOut = async () => {
    await supabase?.auth.signOut();
    router.replace("/login");
  };

  if (isLoading || !role) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-sm text-slate-500">Checking access...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-4 px-4 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-teal-800">
              Branch portal
            </p>
            <h1 className="mt-1 text-xl font-semibold text-slate-900">
              Report 2
            </h1>
            <p className="mt-1 text-xs text-slate-500">{userEmail}</p>
          </div>
          <div className="flex items-center gap-2">
            {role === "owner" && (
              <Link
                href="/"
                className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Report 1
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
      <Report2Form />
    </main>
  );
}
