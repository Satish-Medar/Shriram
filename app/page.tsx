"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import ReportForm from "@/components/ReportForm";
import type { AppRole } from "@/lib/appRole";
import type { User } from "@supabase/supabase-js";

export default function Home() {
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const router = useRouter();

  useEffect(() => {
    const client = supabase;

    if (!isSupabaseConfigured || !client) {
      router.replace("/login");
      return;
    }

    const checkUser = async () => {
      const {
        data: { session },
      } = await client.auth.getSession();
      if (!session) {
        router.push("/login");
      } else {
        setUser(session.user);
        const { data: assignedRole } = await client.rpc("current_app_role");
        const resolvedRole = (assignedRole ?? "unassigned") as AppRole;
        setRole(resolvedRole);
        if (resolvedRole === "agent") router.replace("/files");
        if (resolvedRole === "report2") router.replace("/report2");
      }
      setIsLoading(false);
    };

    checkUser();

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        router.push("/login");
      } else {
        setUser(session.user);
        void client.rpc("current_app_role").then(({ data }) => {
          const resolvedRole = (data ?? "unassigned") as AppRole;
          setRole(resolvedRole);
          if (resolvedRole === "agent") router.replace("/files");
          if (resolvedRole === "report2") router.replace("/report2");
        });
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

  const handleSignOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
  };

  if (!isSupabaseConfigured) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-2xl border border-gray-200 p-6 shadow-sm text-center">
          <h1 className="text-xl font-bold text-gray-900">
            Supabase not configured
          </h1>
          <p className="mt-3 text-sm text-gray-600">
            Add your NEXT_PUBLIC_SUPABASE_URL and
            NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY values to continue.
          </p>
        </div>
      </main>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500 font-medium">Loading portal...</p>
      </div>
    );
  }

  if (!user) return null;

  if (role === "unassigned") {
    return (
      <main className="min-h-screen bg-gray-50 p-6">
        <section className="mx-auto mt-16 max-w-lg rounded-lg border border-rose-200 bg-white p-6">
          <h1 className="text-lg font-semibold text-gray-900">
            Access not assigned
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            This account has not been assigned access to the business portal.
          </p>
          <button
            onClick={handleSignOut}
            className="mt-4 rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
          >
            Sign out
          </button>
        </section>
      </main>
    );
  }

  if (role === null || role === "agent" || role === "report2") return null;

  return (
    <main className="min-h-screen bg-gray-50 pt-6">
      <div className="max-w-2xl mx-auto px-4 mb-6 flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Daily Business Report
          </h1>
          <p className="text-gray-500 text-sm mt-1">{user.email}</p>
        </div>
        <div className="flex items-center gap-2">
          {role === "owner" && (
            <>
              <Link
                href="/report2"
                className="text-sm bg-emerald-700 text-white px-4 py-2 rounded-lg font-medium hover:bg-emerald-800 transition-colors"
              >
                Report 2
              </Link>
              <Link
                href="/files"
                className="text-sm bg-teal-800 text-white px-4 py-2 rounded-lg font-medium hover:bg-teal-900 transition-colors"
              >
                Customer Files
              </Link>
            </>
          )}
          <button
            onClick={handleSignOut}
            className="text-sm bg-gray-200 text-gray-700 px-4 py-2 rounded-lg font-medium hover:bg-gray-300 transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>

      <ReportForm />
    </main>
  );
}
