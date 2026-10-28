import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import VoiceReviewModeration from "@/components/VoiceReviewModeration";
import { requireRoles } from "@/lib/roles";
export default async function StaffVoiceReviewsPage(){
 await requireRoles(["faculty","super_admin"]);
 const supabase=createClient();
 const {data:reviews,error}=await supabase.from("dp_voice_testimonials")
 .select("id,review_text,video_url,allow_public_use,status,created_at")
 .order("created_at",{ascending:false}).limit(100);
 return <div className="space-y-6 pb-16">
  <div><Link href="/staff/dashboard" className="text-sm underline text-charcoal/60">← Staff Dashboard</Link>
  <h1 className="mt-3 font-display text-3xl text-burgundy">Voice testimonials</h1>
  <p className="mt-2 font-body text-sm text-charcoal/70">Review student feedback privately. Only publish a review outside this page when marketing consent was granted.</p></div>
  {error?<p role="alert" className="card p-5 text-sm">Review records are unavailable. Apply the voice testimonials database migration before using this page.</p>:<VoiceReviewModeration reviews={reviews??[]}/>}
 </div>;
}
