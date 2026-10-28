"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function VoiceReviewForm({studentId}:{studentId:string}) {
 const [review,setReview]=useState("");
 const [video,setVideo]=useState("");
 const [consent,setConsent]=useState(false);
 const [saving,setSaving]=useState(false);
 const [message,setMessage]=useState("");
 async function submit(e:React.FormEvent) {
  e.preventDefault();setMessage("");
  if(!review.trim()&&!video.trim()){setMessage("Please add a written review or video link.");return;}
  if(video.trim()&&!/^https:\/\/\S+$/i.test(video.trim())){setMessage("Use a valid HTTPS video link.");return;}
  setSaving(true);
  const {error}=await createClient().from("dp_voice_testimonials").insert({
   student_id:studentId,review_text:review.trim()||null,video_url:video.trim()||null,
   allow_public_use:consent,status:"pending"
  });
  setSaving(false);
  if(error){setMessage("Review could not be submitted. Please try again or contact your instructor.");return;}
  setReview("");setVideo("");setConsent(false);setMessage("Thank you! Your review was submitted privately for review.");
 }
 return <form onSubmit={submit} className="mt-4 space-y-3">
  <label className="block font-ui text-sm font-semibold text-charcoal">Your experience
   <textarea className="input mt-1 w-full" rows={4} maxLength={3000} value={review} onChange={e=>setReview(e.target.value)} placeholder="What changed in your voice or confidence?" />
  </label>
  <label className="block font-ui text-sm font-semibold text-charcoal">Video link (optional)
   <input className="input mt-1 w-full" type="url" placeholder="https://…" value={video} onChange={e=>setVideo(e.target.value)} />
  </label>
  <p className="font-body text-xs text-charcoal/65">Record on your phone and paste a shareable video link. Please check that the link is viewable by your instructor. A direct video upload option is not yet available.</p>
  <label className="flex items-start gap-2 font-body text-sm text-charcoal/80">
   <input className="mt-1" type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)} />
   <span>I give Dove Expressions permission to use this review and any submitted recording on its website, social media, and promotional materials. This is optional; my review may be submitted privately without consent.</span>
  </label>
  <button disabled={saving} type="submit" className="btn-primary">{saving?"Submitting…":"Submit my review"}</button>
  {message&&<p role="status" className="font-body text-sm text-charcoal/80">{message}</p>}
 </form>;
}
