"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState(() =>
    !supabase || !isSupabaseConfigured
      ? { text: "Supabase is not configured.", isError: true }
      : { text: "", isError: false },
  );
  const router = useRouter();

  useEffect(() => {
    if (!supabase || !isSupabaseConfigured) {
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      setReady(Boolean(data.session));
      if (!data.session) {
        setMessage({
          text: "This reset link is invalid or has expired. Request a new one.",
          isError: true,
        });
      }
    });
  }, []);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase || password.length < 6 || password !== confirmation) {
      setMessage({
        text:
          password.length < 6
            ? "Password must be at least 6 characters."
            : "Passwords do not match.",
        isError: true,
      });
      return;
    }

    setLoading(true);
    setMessage({ text: "", isError: false });
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setMessage({ text: error.message, isError: true });
    } else {
      setMessage({
        text: "Your password has been updated. Redirecting to sign in...",
        isError: false,
      });
      setTimeout(() => router.push("/login"), 1500);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
        <h1 className="text-2xl font-bold text-gray-900 text-center">
          Set a new password
        </h1>
        <p className="text-gray-500 text-sm text-center mt-2 mb-6">
          Choose a new password for your account.
        </p>

        {ready ? (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                New password
              </label>
              <input
                type="password"
                required
                minLength={6}
                className="w-full p-3 border rounded-lg bg-gray-50 text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Confirm password
              </label>
              <input
                type="password"
                required
                minLength={6}
                className="w-full p-3 border rounded-lg bg-gray-50 text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
              />
            </div>
            {message.text && (
              <div
                className={`p-3 rounded-lg text-sm ${message.isError ? "bg-red-50 text-red-600" : "bg-green-50 text-green-600"}`}
              >
                {message.text}
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {loading ? "Updating..." : "Update password"}
            </button>
          </form>
        ) : (
          message.text && (
            <div
              className={`p-3 rounded-lg text-sm ${message.isError ? "bg-red-50 text-red-600" : "bg-green-50 text-green-600"}`}
            >
              {message.text}
            </div>
          )
        )}
      </div>
    </div>
  );
}
