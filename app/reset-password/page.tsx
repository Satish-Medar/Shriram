"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: "", isError: false });
  const router = useRouter();

  const handleReset = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!isSupabaseConfigured || !supabase) {
      setMessage({
        text: "Supabase is not configured yet.",
        isError: true,
      });
      return;
    }

    if (password.length < 6) {
      setMessage({
        text: "Password must be at least 6 characters.",
        isError: true,
      });
      return;
    }

    if (password !== confirmPassword) {
      setMessage({ text: "Passwords do not match.", isError: true });
      return;
    }

    setLoading(true);
    setMessage({ text: "", isError: false });

    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setMessage({ text: error.message, isError: true });
      setLoading(false);
      return;
    }

    setMessage({
      text: "Password updated successfully. Redirecting to sign in...",
      isError: false,
    });
    setTimeout(() => router.push("/login"), 1200);
  };

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <section className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Reset Password</h1>
          <p className="text-gray-500 text-sm mt-1">
            Choose a new password for your account
          </p>
        </div>

        <form onSubmit={handleReset} className="space-y-5">
          <PasswordField
            label="New password"
            value={password}
            showPassword={showPassword}
            onChange={setPassword}
            onToggle={() => setShowPassword(!showPassword)}
          />
          <PasswordField
            label="Confirm new password"
            value={confirmPassword}
            showPassword={showConfirmPassword}
            onChange={setConfirmPassword}
            onToggle={() => setShowConfirmPassword(!showConfirmPassword)}
          />

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
            {loading ? "Updating..." : "Update Password"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => router.push("/login")}
          className="mt-6 w-full text-sm text-blue-600 hover:underline"
        >
          Back to sign in
        </button>
      </section>
    </main>
  );
}

function PasswordField({
  label,
  value,
  showPassword,
  onChange,
  onToggle,
}: {
  label: string;
  value: string;
  showPassword: boolean;
  onChange: (value: string) => void;
  onToggle: () => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      <div className="relative">
        <input
          type={showPassword ? "text" : "password"}
          required
          minLength={6}
          className="w-full p-3 pr-12 border rounded-lg bg-gray-50 text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500 outline-none"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="At least 6 characters"
        />
        <button
          type="button"
          onClick={onToggle}
          aria-label={showPassword ? "Hide password" : "Show password"}
          className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
        >
          {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
        </button>
      </div>
    </div>
  );
}
