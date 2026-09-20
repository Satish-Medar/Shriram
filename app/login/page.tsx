"use client";
import { useState } from "react";
import { useRef } from "react";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import HCaptcha from "@hcaptcha/react-hcaptcha";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLogin, setIsLogin] = useState(true);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [message, setMessage] = useState({ text: "", isError: false });
  const captcha = useRef<HCaptcha>(null);
  const captchaSiteKey = process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY;
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

    if (!captchaSiteKey || !captchaToken) {
      setMessage({
        text: "Please complete the CAPTCHA before continuing.",
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
          options: { captchaToken },
        });
        if (error) throw error;
        router.push("/");
      } else {
        const siteUrl =
          process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${siteUrl}/login`,
            captchaToken,
          },
        });
        if (error) throw error;
        setMessage({
          text: data.session
            ? "Account created successfully. You can now sign in."
            : "Account created. Check your email and confirm your account before signing in.",
          isError: false,
        });
      }
    } catch (error: any) {
      const errorMessage =
        error.message === "Invalid login credentials"
          ? "Invalid email or password. If you just created your account, confirm it from the email sent by Supabase first."
          : error.message === "email rate limit exceeded"
            ? "Email sending is temporarily limited. Please try again later, or ask the administrator to configure production SMTP."
            : error.message || "An error occurred";
      setMessage({ text: errorMessage, isError: true });
    } finally {
      captcha.current?.resetCaptcha();
      setCaptchaToken(null);
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isSupabaseConfigured || !supabase) {
      setMessage({
        text: "Supabase is not configured yet. Add your environment variables to enable password reset.",
        isError: true,
      });
      return;
    }

    if (!captchaSiteKey || !captchaToken) {
      setMessage({
        text: "Please complete the CAPTCHA before continuing.",
        isError: true,
      });
      return;
    }

    setLoading(true);
    setMessage({ text: "", isError: false });

    try {
      const siteUrl =
        process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${siteUrl}/reset-password`,
        captchaToken,
      });
      if (error) throw error;
      setMessage({
        text: "If an account exists for this email, a password reset link has been sent.",
        isError: false,
      });
    } catch (error: any) {
      setMessage({ text: error.message || "An error occurred", isError: true });
    } finally {
      captcha.current?.resetCaptcha();
      setCaptchaToken(null);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Branch Portal</h1>
          <p className="text-gray-500 text-sm mt-1">
            {isForgotPassword
              ? "Enter your email to reset your password"
              : "Sign in to manage your daily reports"}
          </p>
        </div>

        {!isSupabaseConfigured && (
          <div className="mb-5 rounded-lg bg-yellow-50 border border-yellow-200 p-3 text-sm text-yellow-800">
            Supabase environment variables are missing. The app is running in
            local-safe mode.
          </div>
        )}

        {!captchaSiteKey && isSupabaseConfigured && (
          <div className="mb-5 rounded-lg bg-yellow-50 border border-yellow-200 p-3 text-sm text-yellow-800">
            CAPTCHA is not configured. Add NEXT_PUBLIC_HCAPTCHA_SITE_KEY to
            enable sign in.
          </div>
        )}

        <form
          onSubmit={isForgotPassword ? handleForgotPassword : handleAuth}
          className="space-y-5"
        >
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
          {!isForgotPassword && (
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
          )}

          {captchaSiteKey && (
            <HCaptcha
              ref={captcha}
              sitekey={captchaSiteKey}
              onVerify={(token) => setCaptchaToken(token)}
              onExpire={() => setCaptchaToken(null)}
              onError={() => setCaptchaToken(null)}
            />
          )}

          {message.text && (
            <div
              className={`p-3 rounded-lg text-sm ${message.isError ? "bg-red-50 text-red-600" : "bg-green-50 text-green-600"}`}
            >
              {message.text}
            </div>
          )}

          <button
            type="submit"
            disabled={
              loading ||
              !isSupabaseConfigured ||
              !captchaSiteKey ||
              !captchaToken
            }
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium shadow-sm hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {loading
              ? "Processing..."
              : isForgotPassword
                ? "Send Reset Link"
                : isLogin
                  ? "Sign In"
                  : "Create Account"}
          </button>
        </form>

        <div className="mt-6 space-y-3 text-center">
          {!isForgotPassword && isLogin && (
            <button
              type="button"
              onClick={() => {
                setIsForgotPassword(true);
                setMessage({ text: "", isError: false });
              }}
              className="block w-full text-sm text-blue-600 hover:underline"
            >
              Forgot password?
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setIsForgotPassword(false);
              setIsLogin(!isLogin);
              setMessage({ text: "", isError: false });
            }}
            className="text-sm text-blue-600 hover:underline"
          >
            {isForgotPassword
              ? "Back to sign in"
              : isLogin
                ? "Need an account? Sign up"
                : "Already have an account? Sign in"}
          </button>
        </div>
      </div>
    </div>
  );
}
