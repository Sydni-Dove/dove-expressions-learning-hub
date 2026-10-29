"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
export type Review={id:string;review_text:string|null;video_url:string|null;video_signed_url?:string|null;allow_public_use:boolean;status:string;created_at:string;published_at:string|null;student_name?:string};
export default function VoiceReviewModeration({reviews}:{reviews:Review[]}) {
 const router=useRouter();const [busy,setBusy]=useState<string|null>(null);const [error,setError]=useState("");
 async function update(id:string,patch:Record<string,unknown>){
  setBusy(id);setError("");
  const {error:e}=await createClient().from("dp_voice_testimonials").update(patch).eq("id",id);
  setBusy(null);if(e){setError(e.message||"Could not update this testimonial.");return;}router.refresh();
 }
 const decide=(id:string,status:"approved"|"declined")=>update(id,{status,reviewed_at:new Date().toISOString()});
 return <div className="space-y-4">{error&&<p role="alert" className="text-sm text-red-700">{error}</p>}
  {reviews.length===0&&<p className="card p-5">No student testimonials submitted yet.</p>}
  {reviews.map(r=><article key={r.id} className="card p-5">
   <div className="flex flex-wrap gap-2 text-xs font-ui text-charcoal/60"><span>{r.student_name||"Student"}</span><span>· {new Date(r.created_at).toLocaleDateString()}</span><span>· {r.status==="declined"?"rejected":r.status}</span><span>· Public-use permission: {r.allow_public_use?"granted":"not granted"}</span>{r.published_at&&<span className="font-semibold text-green-700">· Published</span>}</div>
   {r.review_text&&<p className="mt-3 whitespace-pre-wrap text-sm font-body">{r.review_text}</p>}
   {r.video_signed_url&&<video controls preload="metadata" playsInline src={r.video_signed_url} className="mt-3 w-full max-w-md rounded-xl bg-charcoal"/>}
   {r.video_url&&<a className="mt-3 block break-all text-sm text-burgundy underline" href={r.video_url} target="_blank" rel="noopener noreferrer">Testimonial video link</a>}
   <p className="mt-3 text-xs text-charcoal/60">Approving is internal moderation. Publishing is a separate step and is only possible when the student granted public-use permission.</p>
   <div className="mt-3 flex flex-wrap gap-3">
    <button disabled={busy===r.id||r.status==="approved"} onClick={()=>decide(r.id,"approved")} className="btn-primary">Approve</button>
    <button disabled={busy===r.id||r.status==="declined"} onClick={()=>decide(r.id,"declined")} className="rounded-pill border px-4 py-2 text-sm">Reject</button>
    {r.status==="approved"&&r.allow_public_use&&!r.published_at&&<button disabled={busy===r.id} onClick={()=>update(r.id,{published_at:new Date().toISOString()})} className="btn-secondary">Mark as published</button>}
    {r.published_at&&<button disabled={busy===r.id} onClick={()=>update(r.id,{published_at:null})} className="btn-secondary">Unpublish</button>}
   </div>
  </article>)}
 </div>;
}
