"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface PolicyDoc {
  id: string;
  title: string;
  body: string;
  version: number;
}

export default function SignupForm({
  privacyPolicy,
  guardianPolicy
}: {
  privacyPolicy: PolicyDoc | null;
  guardianPolicy: PolicyDoc | null;
}) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [privacyExpanded, setPrivacyExpanded] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);

  const [isMinor, setIsMinor] = useState(false);
  const [guardianName, setGuardianName] = useState("");
  const [guardianEmail, setGuardianEmail] = useState("");
  const [guardianRelationship, setGuardianRelationship] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!fullName.trim()) {
      setError("Enter your full name so your mentor and teachers know who you are.");
      return;
    }
    if (!email) {
      setError("Enter an email address — this is how you'll log in and receive notifications.");
      return;
    }
    if (password.length < 8) {
      setError("Choose a password of at least 8 characters.");
      return;
    }
    if (privacyPolicy && !privacyAccepted) {
      setError("Please read and accept the Privacy Summary to continue.");
      return;
    }
    if (isMinor && (!guardianName.trim() || !guardianEmail.trim())) {
      setError("A parent or guardian's name and email are required before a minor's account can be activated.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } }
    });

    if (signUpError) {
      setLoading(false);
      setError(signUpError.message);
      return;
    }

    // Everything below assumes signUp() left an active session for the new user (true when
    // email confirmation is off; if it's turned on later, these writes need to move to a
    // post-confirmation step instead — same assumption the original dp_user_roles insert
    // below already relied on).
    if (data.user) {
      await supabase.from("dp_user_roles").insert({ user_id: data.user.id, role: "guest" });

      if (privacyPolicy) {
        await supabase.from("dp_policy_acceptances").insert({ user_id: data.user.id, policy_id: privacyPolicy.id });
      }

      if (isMinor) {
        await supabase.from("dp_guardian_consents").insert({
          minor_user_id: data.user.id,
          guardian_name: guardianName.trim(),
          guardian_email: guardianEmail.trim(),
          guardian_relationship: guardianRelationship.trim() || null,
          policy_id: guardianPolicy?.id ?? null
        });
      }
    }

    setLoading(false);
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="mt-6 text-center">
        <h2 className="font-display text-xl text-burgundy">Check your email</h2>
        <p className="mt-3 font-body text-charcoal/80">
          We sent a confirmation link to <strong>{email}</strong>. Once confirmed, log in to begin your
          intake — you'll choose Discipleship Hub, Creative Studio, or both.
        </p>
        {isMinor && (
          <p className="mt-3 font-body text-sm text-charcoal/70">
            Your account stays limited to public browsing until your parent or guardian confirms consent —
            faculty will follow up with them directly.
          </p>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
      <div>
        <label htmlFor="fullName" className="mb-1 block font-ui text-sm font-semibold text-charcoal">
          Full name
        </label>
        <input
          id="fullName"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="w-full input"
        />
      </div>
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
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full input"
        />
        <p className="mt-1 font-ui text-xs text-charcoal/50">At least 8 characters.</p>
      </div>

      <div className="rounded-card border border-charcoal/15 p-4">
        <label className="flex items-center gap-2 font-ui text-sm text-charcoal">
          <input type="checkbox" checked={isMinor} onChange={(e) => setIsMinor(e.target.checked)} />
          I am under 18 (or the age of majority where I live)
        </label>
        {isMinor && (
          <div className="mt-3 space-y-3 border-t border-charcoal/10 pt-3">
            <p className="font-body text-sm text-charcoal/70">
              {guardianPolicy?.body ??
                "A parent or guardian must consent before your account is activated for anything beyond public browsing."}
            </p>
            <div>
              <label htmlFor="guardianName" className="mb-1 block font-ui text-xs font-semibold text-charcoal">
                Parent/guardian name
              </label>
              <input
                id="guardianName"
                value={guardianName}
                onChange={(e) => setGuardianName(e.target.value)}
                className="w-full input"
              />
            </div>
            <div>
              <label htmlFor="guardianEmail" className="mb-1 block font-ui text-xs font-semibold text-charcoal">
                Parent/guardian email
              </label>
              <input
                id="guardianEmail"
                type="email"
                value={guardianEmail}
                onChange={(e) => setGuardianEmail(e.target.value)}
                className="w-full input"
              />
            </div>
            <div>
              <label htmlFor="guardianRelationship" className="mb-1 block font-ui text-xs font-semibold text-charcoal">
                Relationship to you
              </label>
              <input
                id="guardianRelationship"
                value={guardianRelationship}
                onChange={(e) => setGuardianRelationship(e.target.value)}
                placeholder="e.g. Mother, Father, Legal guardian"
                className="w-full input"
              />
            </div>
            <p className="font-ui text-xs text-charcoal/50">
              Faculty will follow up with your guardian directly to confirm consent before your account moves
              beyond public browsing.
            </p>
          </div>
        )}
      </div>

      {privacyPolicy && (
        <div className="rounded-card border border-charcoal/15 p-4">
          <p className="font-ui text-sm font-semibold text-charcoal">{privacyPolicy.title}</p>
          <button
            type="button"
            onClick={() => setPrivacyExpanded((v) => !v)}
            className="mt-1 font-ui text-xs font-semibold text-burgundy underline"
          >
            {privacyExpanded ? "Hide summary" : "Read the summary"}
          </button>
          {privacyExpanded && (
            <p className="mt-2 whitespace-pre-line font-body text-sm text-charcoal/80">{privacyPolicy.body}</p>
          )}
          <label className="mt-3 flex items-start gap-2 font-ui text-sm text-charcoal">
            <input
              type="checkbox"
              checked={privacyAccepted}
              onChange={(e) => setPrivacyAccepted(e.target.checked)}
              className="mt-0.5"
            />
            I have read and agree to the Privacy Summary (v{privacyPolicy.version})
          </label>
        </div>
      )}

      {error && (
        <p role="alert" className="rounded-lg bg-coral/10 px-3 py-2 font-ui text-sm text-[#7a2c1c]">
          {error}
        </p>
      )}

      <button type="submit" disabled={loading} className="btn-primary w-full">
        {loading ? "Creating account…" : "Create account"}
      </button>
    </form>
  );
}
