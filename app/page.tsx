"use client";
import { useEffect, useState } from "react";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import ReportForm from "@/components/ReportForm";

export default function Home() {
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    const client = supabase;

    if (!isSupabaseConfigured || !client) {
      setIsLoading(false);
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

  return (
    <main className="min-h-screen bg-gray-50 pt-6">
      <div className="max-w-2xl mx-auto px-4 mb-6 flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Daily Business Report
          </h1>
          <p className="text-gray-500 text-sm mt-1">{user.email}</p>
        </div>
        <button
          onClick={handleSignOut}
          className="text-sm bg-gray-200 text-gray-700 px-4 py-2 rounded-lg font-medium hover:bg-gray-300 transition-colors"
        >
          Sign Out
        </button>
      </div>

      <ReportForm />
    </main>
  );
}
