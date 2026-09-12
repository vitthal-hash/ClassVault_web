"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sparkles, User, Lock, Eye, EyeOff, Loader2, ArrowRight } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthContext";
import { AuthShowcase } from "@/components/auth/AuthShowcase";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { refresh } = useAuth();

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong.");
        return;
      }
      await refresh();
      router.push("/home");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-canvas">
      <AuthShowcase
        eyebrow="Welcome back"
        headline="Pick up right where your last lecture left off."
        subcopy="Timetables, syllabi, lecture notes, and an AI assistant that actually knows your coursework — all in one workspace."
      />

      <div className="flex-1 flex items-center justify-center px-4 py-10 sm:py-16">
        <div className="w-full max-w-sm">
          <div className="flex lg:hidden items-center justify-center gap-2 mb-8">
            <div className="h-10 w-10 rounded-2xl bg-brand-500 flex items-center justify-center shadow-soft">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <span className="font-display text-2xl font-semibold text-ink dark:text-white">
              Class<span className="text-brand-500">Vault</span>
            </span>
          </div>

          <div className="card p-7 sm:p-8">
            <h1 className="font-display text-2xl font-semibold text-ink dark:text-white mb-1">
              Log in
            </h1>
            <p className="text-sm text-muted mb-7">Welcome back to your academic workspace.</p>

            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <label className="label">Username</label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted pointer-events-none" />
                  <input
                    className="input !pl-10"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="alex"
                    autoComplete="username"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="label">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted pointer-events-none" />
                  <input
                    className="input !pl-10 !pr-10"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted hover:text-ink dark:hover:text-white"
                    tabIndex={-1}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <p className="text-sm text-red-500 bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              <button type="submit" className="btn-primary w-full justify-center" disabled={loading}>
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    Log in <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>
          </div>

          <p className="text-center text-sm text-muted mt-6">
            New here?{" "}
            <Link href="/signup" className="text-brand-500 font-semibold hover:underline">
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}