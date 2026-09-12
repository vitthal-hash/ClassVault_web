"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  User,
  IdCard,
  Lock,
  Mail,
  Eye,
  EyeOff,
  Loader2,
  ArrowRight,
  ArrowLeft,
  Check,
  X,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "@/lib/auth/AuthContext";
import { AuthShowcase } from "@/components/auth/AuthShowcase";

const RESEND_COOLDOWN = 30;

export default function SignupPage() {
  const [step, setStep] = useState<"details" | "otp">("details");

  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [otp, setOtp] = useState("");
  const [cooldown, setCooldown] = useState(0);

  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const otpInputRef = useRef<HTMLInputElement>(null);

  const router = useRouter();
  const { refresh } = useAuth();

  const passwordLongEnough = password.length >= 6;
  const passwordsMatch = confirm.length > 0 && password === confirm;

  useEffect(() => {
    if (step === "otp") otpInputRef.current?.focus();
  }, [step]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = window.setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => window.clearTimeout(t);
  }, [cooldown]);

  const submitDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/signup/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password, displayName }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong.");
        return;
      }
      setInfo(`We've sent a 6-digit code to ${data.email}.`);
      setStep("otp");
      setCooldown(RESEND_COOLDOWN);
    } finally {
      setLoading(false);
    }
  };

  const submitOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (otp.trim().length !== 6) {
      setError("Enter the 6-digit code from your email.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/signup/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp: otp.trim() }),
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

  const resend = async () => {
    if (cooldown > 0) return;
    setError(null);
    setInfo(null);
    try {
      const res = await fetch("/api/auth/signup/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Couldn't resend the code.");
        return;
      }
      setInfo("A new code is on its way.");
      setCooldown(RESEND_COOLDOWN);
    } catch {
      setError("Couldn't resend the code. Check your connection and try again.");
    }
  };

  return (
    <div className="min-h-screen flex bg-canvas">
      <AuthShowcase
        eyebrow="Get started"
        headline="A clear desk for a clear mind, from day one of semester."
        subcopy="Build your timetable, keep every syllabus and lecture in one place, and let the AI assistant handle the revision grunt work."
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
            {step === "details" ? (
              <>
                <h1 className="font-display text-2xl font-semibold text-ink dark:text-white mb-1">
                  Create your workspace
                </h1>
                <p className="text-sm text-muted mb-7">A clear desk for a clear mind.</p>

                <form onSubmit={submitDetails} className="space-y-4">
                  <div>
                    <label className="label">Display name</label>
                    <div className="relative">
                      <IdCard className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted pointer-events-none" />
                      <input
                        className="input !pl-10"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="Alex"
                      />
                    </div>
                  </div>
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
                    <label className="label">Email</label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted pointer-events-none" />
                      <input
                        className="input !pl-10"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="alex@college.edu"
                        autoComplete="email"
                        required
                      />
                    </div>
                    <p className="mt-1.5 text-xs text-muted">We'll send a 6-digit code here to verify it's you.</p>
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
                        placeholder="At least 6 characters"
                        autoComplete="new-password"
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
                    {password.length > 0 && (
                      <p
                        className={`mt-1.5 text-xs flex items-center gap-1 ${
                          passwordLongEnough ? "text-emerald-500" : "text-muted"
                        }`}
                      >
                        {passwordLongEnough ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                        At least 6 characters
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="label">Confirm password</label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted pointer-events-none" />
                      <input
                        className="input !pl-10"
                        type={showPassword ? "text" : "password"}
                        value={confirm}
                        onChange={(e) => setConfirm(e.target.value)}
                        placeholder="••••••••"
                        autoComplete="new-password"
                        required
                      />
                    </div>
                    {confirm.length > 0 && (
                      <p
                        className={`mt-1.5 text-xs flex items-center gap-1 ${
                          passwordsMatch ? "text-emerald-500" : "text-red-500"
                        }`}
                      >
                        {passwordsMatch ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                        {passwordsMatch ? "Passwords match" : "Doesn't match yet"}
                      </p>
                    )}
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
                        Send verification code <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </button>
                </form>
              </>
            ) : (
              <>
                <button
                  onClick={() => {
                    setStep("details");
                    setOtp("");
                    setError(null);
                    setInfo(null);
                  }}
                  className="flex items-center gap-1 text-xs font-semibold text-muted hover:text-ink dark:hover:text-white mb-5"
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> Back
                </button>

                <div className="h-11 w-11 rounded-2xl bg-brand-50 dark:bg-brand-500/15 flex items-center justify-center mb-4">
                  <ShieldCheck className="h-5 w-5 text-brand-500" />
                </div>
                <h1 className="font-display text-2xl font-semibold text-ink dark:text-white mb-1">
                  Check your email
                </h1>
                <p className="text-sm text-muted mb-7">
                  Enter the 6-digit code we sent to <span className="text-ink dark:text-white font-medium">{email}</span>.
                </p>

                <form onSubmit={submitOtp} className="space-y-4">
                  <div>
                    <label className="label">Verification code</label>
                    <input
                      ref={otpInputRef}
                      className="input text-center text-2xl font-semibold tracking-[0.5em]"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      placeholder="······"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      required
                    />
                  </div>

                  {info && !error && (
                    <p className="text-sm text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20 rounded-lg px-3 py-2">
                      {info}
                    </p>
                  )}
                  {error && (
                    <p className="text-sm text-red-500 bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 rounded-lg px-3 py-2">
                      {error}
                    </p>
                  )}

                  <button
                    type="submit"
                    className="btn-primary w-full justify-center"
                    disabled={loading || otp.length !== 6}
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Verify &amp; create account</>}
                  </button>

                  <button
                    type="button"
                    onClick={resend}
                    disabled={cooldown > 0}
                    className="w-full text-center text-sm font-semibold text-brand-500 disabled:text-muted disabled:cursor-not-allowed hover:underline"
                  >
                    {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
                  </button>
                </form>
              </>
            )}
          </div>

          <p className="text-center text-sm text-muted mt-6">
            Already have an account?{" "}
            <Link href="/login" className="text-brand-500 font-semibold hover:underline">
              Log in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
