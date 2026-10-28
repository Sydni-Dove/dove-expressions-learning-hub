"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
type Review={id:string;review_text:string|null;video_url:string|null;allow_public_use:boolean;status:string;created_at:string};
export default function VoiceReviewModeration({reviews}:{reviews:Review[]}) {
 const router=useRouter();const [busy,setBusy]=useState<string|null>(null);const [error,setError]=useState("");
 async function decide(id:string,status:"approved"|"declined"){
  setBusy(id);setError("");
  const {error:e}=await createClient().from("dp_voice_testimonials").update({status,reviewed_at:new Date().toISOString()}).eq("id",id);
  setBusy(null);if(e){setError("Could not update review. Check database permissions.");return;}router.refresh();
 }
 return <div className="space-y-4">{error&&<p role="alert" className="text-sm text-red-700">{error}</p>}
  {reviews.length===0&&<p className="card p-5">No student reviews submitted yet.</p>}
  {reviews.map(r=><article key={r.id} className="card p-5">
   <div className="flex flex-wrap gap-2 text-xs font-ui text-charcoal/60"><span>{new Date(r.created_at).toLocaleDateString()}</span><span>· {r.status}</span><span>· Marketing permission: {r.allow_public_use?"Granted":"Not granted"}</span></div>
   {r.review_text&&<p className="mt-3 whitespace-pre-wrap text-sm font-body">{r.review_text}</p>}
   {r.video_url&&<a className="mt-3 block break-all text-sm text-burgundy underline" href={r.video_url} target="_blank" rel="noopener noreferrer">Review video link</a>}
   <p className="mt-3 text-xs text-charcoal/60">Approval is internal moderation only. It does not publish the review automatically.</p>
   <div className="mt-3 flex gap-3"><button disabled={busy===r.id||r.status==="approved"} onClick={()=>decide(r.id,"approved")} className="btn-primary">Approve</button><button disabled={busy===r.id||r.status==="declined"} onClick={()=>decide(r.id,"declined")} className="rounded-pill border px-4 py-2 text-sm">Decline</button></div>
  </article>)}
 </div>;
}
