"use client";
import { useState } from "react";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: "", isError: false });
  const router = useRouter();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isSupabaseConfigured || !supabase) {
      setMessage({
        text: "Supabase is not configured yet. Add your environment variables to enable sign in.",
        isError: true,
      });
      return;
    }

    setLoading(true);
    setMessage({ text: "", isError: false });

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        router.push("/");
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setMessage({ text: "Success! You can now sign in.", isError: false });
      }
    } catch (error: any) {
      setMessage({ text: error.message || "An error occurred", isError: true });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Branch Portal</h1>
          <p className="text-gray-500 text-sm mt-1">
            Sign in to manage your daily reports
          </p>
        </div>

        {!isSupabaseConfigured && (
          <div className="mb-5 rounded-lg bg-yellow-50 border border-yellow-200 p-3 text-sm text-yellow-800">
            Supabase environment variables are missing. The app is running in
            local-safe mode.
          </div>
        )}

        <form onSubmit={handleAuth} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              required
              disabled={!isSupabaseConfigured}
              className="w-full p-3 border rounded-lg bg-gray-50 text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-60"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@branch.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                disabled={!isSupabaseConfigured}
                className="w-full p-3 pr-12 border rounded-lg bg-gray-50 text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-60"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
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
            disabled={loading || !isSupabaseConfigured}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium shadow-sm hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {loading ? "Processing..." : isLogin ? "Sign In" : "Create Account"}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => {
              setIsLogin(!isLogin);
              setMessage({ text: "", isError: false });
            }}
            className="text-sm text-blue-600 hover:underline"
          >
            {isLogin
              ? "Need an account? Sign up"
              : "Already have an account? Sign in"}
          </button>
        </div>
      </div>
    </div>
  );
}
