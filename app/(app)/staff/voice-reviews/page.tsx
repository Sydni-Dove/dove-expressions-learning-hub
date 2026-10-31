import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import VoiceReviewModeration from "@/components/VoiceReviewModeration";
import { requireRoles } from "@/lib/roles";
export default async function StaffVoiceReviewsPage(){
 await requireRoles(["faculty","super_admin"]);
 const supabase=createClient();
 const {data:rows,error}=await supabase.from("dp_voice_testimonials")
 .select("id,student_id,review_text,video_url,video_path,allow_public_use,status,created_at,published_at,consent_withdrawn_at")
 .order("created_at",{ascending:false}).limit(100);
 const {data:roster}=await supabase.rpc("dp_program_students",{target_program_slug:"vocal-coaching"});
 const reviews=await Promise.all((rows??[]).map(async r=>{
  const signed=r.video_path?(await supabase.storage.from("voice-testimonials").createSignedUrl(r.video_path,3600)).data?.signedUrl??null:null;
  const who=(roster??[]).find((s:{id:string;full_name:string|null;email:string|null})=>s.id===r.student_id);
  return {...r,video_signed_url:signed,student_name:who?.full_name||who?.email||undefined};
 }));
 return <div className="space-y-6 pb-16">
  <div><Link href="/staff/dashboard" className="link-action text-sm text-charcoal/60">← Staff Dashboard</Link>
  <h1 className="mt-3 font-display text-3xl text-burgundy">Voice testimonials</h1>
  <p className="mt-2 font-body text-sm"><a className="link-action" href="/testimonials" target="_blank" rel="noopener">Open the public page</a>. Only published testimonials appear there, with the first name only.</p>
  <p className="mt-2 font-body text-sm text-charcoal/70">Review student feedback privately. Nothing is published automatically: a testimonial needs your approval and the student’s separate public-use permission.</p></div>
  {error?<p role="alert" className="card p-5 text-sm">Review records are unavailable. The voice testimonials database migration may not be applied yet.</p>:<VoiceReviewModeration reviews={reviews??[]}/>}
 </div>;
}
