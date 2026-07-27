"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email || !password) {
      setError("Enter your email and password to continue — both fields are required to sign in.");
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (signInError) {
      setError(
        signInError.message === "Invalid login credentials"
          ? "That email and password combination doesn't match an account. Check for typos, or create an account below."
          : signInError.message
      );
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-soft px-4">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-8 block text-center font-display text-2xl text-burgundy">
          Dove Expressions
        </Link>
        <div className="card p-8">
          <h1 className="font-display text-2xl text-burgundy">Welcome back</h1>
          <p className="mt-1 font-body text-sm text-charcoal/70">Log in to continue your journey.</p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
            <div>
              <label htmlFor="email" className="mb-1 block font-ui text-sm font-semibold text-charcoal">
                Email address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full input"
              />
            </div>
            <div>
              <label htmlFor="password" className="mb-1 block font-ui text-sm font-semibold text-charcoal">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full input"
              />
            </div>

            {error && (
              <p role="alert" className="rounded-lg bg-coral/10 px-3 py-2 font-ui text-sm text-[#7a2c1c]">
                {error}
              </p>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? "Signing in…" : "Log in"}
            </button>
          </form>

          <p className="mt-6 text-center font-ui text-sm text-charcoal/70">
            New here?{" "}
            <Link href="/signup" className="font-semibold text-burgundy underline">
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
