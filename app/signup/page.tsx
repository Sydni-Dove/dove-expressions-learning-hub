import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import SignupForm from "@/components/SignupForm";

export default async function SignupPage() {
  const supabase = createClient();

  // dp_policy_documents is publicly readable by design (a guest needs to see the privacy
  // summary before they have an account) -- see 04-database-schema.md and
  // 07-trust-safety-and-consent.md §3. We fetch the current version of each policy the signup
  // flow needs so the checkboxes below are tied to a real, versioned document, not static copy
  // that could silently drift from what's actually recorded as accepted.
  const [{ data: privacyPolicy }, { data: guardianPolicy }] = await Promise.all([
    supabase
      .from("dp_policy_documents")
      .select("id,title,body,version")
      .eq("policy_type", "privacy_policy")
      .is("superseded_by", null)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("dp_policy_documents")
      .select("id,title,body,version")
      .eq("policy_type", "guardian_consent")
      .is("superseded_by", null)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle()
  ]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-soft px-4 py-12">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-8 block text-center font-display text-2xl text-burgundy">
          Dove Expressions
        </Link>
        <div className="card p-8">
          <h1 className="font-display text-2xl text-burgundy">Create your account</h1>
          <p className="mt-1 font-body text-sm text-charcoal/70">
            Start with a free guest account — you'll complete intake and, if you choose, the Spiritual
            Wiring Assessment before a discovery session.
          </p>

          <SignupForm privacyPolicy={privacyPolicy ?? null} guardianPolicy={guardianPolicy ?? null} />

          <p className="mt-6 text-center font-ui text-sm text-charcoal/70">
            Already have an account?{" "}
            <Link href="/login" className="font-semibold text-burgundy underline">
              Log in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
