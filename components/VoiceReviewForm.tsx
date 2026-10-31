"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { TESTIMONIAL_BUCKET, VIDEO_TYPES, MAX_RECORDING_MB, validateMediaFile, safeFileName } from "@/lib/recordings";

export default function VoiceReviewForm({studentId}:{studentId:string}) {
 const [review,setReview]=useState("");
 const [video,setVideo]=useState("");
 const [file,setFile]=useState<File|null>(null);
 const [consent,setConsent]=useState(false);
 const [saving,setSaving]=useState(false);
 const [message,setMessage]=useState("");
 const [error,setError]=useState("");
 function pick(f:File|undefined){
  setError("");
  if(!f){setFile(null);return;}
  const problem=validateMediaFile(f,VIDEO_TYPES);
  if(problem){setError(problem.replace("an audio or video recording (MP3, M4A, WAV, MP4, MOV or WebM)","a video (MP4, MOV or WebM)"));setFile(null);return;}
  setFile(f);
 }
 async function submit(e:React.FormEvent) {
  e.preventDefault();setMessage("");setError("");
  if(!review.trim()&&!video.trim()&&!file){setError("Please add a written testimonial or a video.");return;}
  if(video.trim()&&!/^https:\/\/\S+$/i.test(video.trim())){setError("Use a valid HTTPS video link.");return;}
  setSaving(true);
  const supabase=createClient();
  let videoPath:string|null=null;
  if(file){
   videoPath=`${studentId}/${Date.now()}-${safeFileName(file.name)}`;
   const {error:upErr}=await supabase.storage.from(TESTIMONIAL_BUCKET).upload(videoPath,file,{contentType:file.type,upsert:false,cacheControl:"3600"});
   if(upErr){setSaving(false);setError(upErr.message||"Video upload failed. Please try again.");return;}
  }
  const {error:insErr}=await supabase.from("dp_voice_testimonials").insert({
   student_id:studentId,review_text:review.trim()||null,video_url:video.trim()||null,video_path:videoPath,
   allow_public_use:consent,status:"pending"
  });
  setSaving(false);
  if(insErr){setError("Your testimonial could not be submitted. Please try again or contact your instructor.");return;}
  setReview("");setVideo("");setFile(null);setConsent(false);
  setMessage(consent?"Thank you! Your testimonial was submitted for review. It will not be published until it is approved.":"Thank you! Your testimonial was submitted privately. Without your permission it will not be used publicly.");
 }
 return <form onSubmit={submit} className="mt-4 space-y-3">
  <label className="block font-ui text-sm font-semibold text-charcoal">Your experience
   <textarea className="input mt-1 w-full" rows={4} maxLength={3000} value={review} onChange={e=>setReview(e.target.value)} placeholder="What changed in your voice or confidence?" />
  </label>
  <label className="block font-ui text-sm font-semibold text-charcoal">Video testimonial (optional)
   <input className="mt-1 block w-full font-body text-sm" type="file" accept={VIDEO_TYPES.join(",")} onChange={e=>pick(e.target.files?.[0])} />
  </label>
  <p className="font-body text-xs text-charcoal/65">{file?`Selected: ${file.name}. `:""}Record on your phone, up to {MAX_RECORDING_MB} MB. Stored privately; only you and your instructor can view it.</p>
  <label className="block font-ui text-sm font-semibold text-charcoal">Or share a video link (optional)
   <input className="input mt-1 w-full" type="url" placeholder="https://…" value={video} onChange={e=>setVideo(e.target.value)} />
  </label>
  <label className="flex items-start gap-2 font-body text-sm text-charcoal/80">
   <input className="mt-1" type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)} />
   <span>I give Dove Expressions permission to publicly use this testimonial, including my words, voice, image and name, on its website, social media, and promotional materials. This is optional and separate from submitting. Your instructor must still approve it before anything is published. To withdraw permission later, message your instructor.</span>
  </label>
  <button disabled={saving} type="submit" className="btn-primary">{saving?"Submitting…":"Submit for review"}</button>
  {error&&<p role="alert" className="font-body text-sm text-[#7a2c1c]">{error}</p>}
  {message&&<p role="status" className="font-body text-sm text-charcoal/80">{message}</p>}
 </form>;
}
