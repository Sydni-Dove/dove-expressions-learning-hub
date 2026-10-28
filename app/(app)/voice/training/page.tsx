import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getCurrentUserAndRoles } from "@/lib/roles";
import { getStudentPrograms } from "@/lib/student-programs";
import { ArrowLeft, CheckCircle2, CirclePlay, ClipboardList } from "lucide-react";

const lessons = [
 {number:1,phase:"Discover",name:"Initial vocal evaluation",goal:"Establish a starting point for pitch accuracy, range, breathing, tone, and confidence.",practice:"Record a comfortable verse and chorus, then note what feels easy or difficult.",check:"Can identify two vocal strengths and two areas to develop."},
 {number:2,phase:"Foundations",name:"Posture and breath coordination",goal:"Establish relaxed posture and controlled airflow for singing.",practice:"Repeat four gentle 4-count inhalations followed by 6–8 counts of steady unvoiced exhalation. Stop if lightheaded.",check:"Can sustain consistent, comfortable airflow without shoulder tension."},
 {number:3,phase:"Foundations",name:"Healthy warmups and resonance",goal:"Develop a repeatable warmup routine without strain.",practice:"Try gentle humming and lip trills in a comfortable range, then sing short five-note patterns.",check:"Can explain when to reduce volume, take a break, or stop."},
 {number:4,phase:"Pitch",name:"Pitch matching",goal:"Match single notes and simple patterns by listening before singing.",practice:"Match five comfortable keyboard notes, record the attempts, and compare.",check:"Can reproduce short patterns with improved accuracy."},
 {number:5,phase:"Pitch",name:"Range and register transitions",goal:"Explore comfortable low, middle, and upper notes without forcing volume.",practice:"Glide gently through a comfortable range using humming or lip trills.",check:"Can identify where transitions feel easier or harder."},
 {number:6,phase:"Pitch",name:"Agility and intonation",goal:"Improve control of moving phrases while maintaining steady pitch.",practice:"Practice three-note and five-note figures slowly, then gradually increase speed only while accurate.",check:"Can sing a short pattern evenly at a comfortable tempo."},
 {number:7,phase:"Song Work",name:"Select and study a song",goal:"Choose repertoire that matches current skill and coaching goals.",practice:"Mark breath points, entrances, phrase endings, and difficult notes in a selected song.",check:"Can describe the musical and vocal challenges of the song."},
 {number:8,phase:"Song Work",name:"Phrasing, dynamics, and interpretation",goal:"Apply expressive choices that serve the meaning and musical direction.",practice:"Sing one verse twice with intentional phrasing, then compare recordings.",check:"Can explain which expressive choices improved communication."},
 {number:9,phase:"Song Work",name:"Recorded performance and feedback",goal:"Use a recording to identify specific improvements.",practice:"Record a full song section and review pitch, breath, timing, and expression.",check:"Can select one technical and one expressive improvement for the next rehearsal."},
 {number:10,phase:"Leadership",name:"Leading while following direction",goal:"Lead a song confidently while staying within the director's arrangement.",practice:"Practice a lead entrance and cue response without changing designated structure.",check:"Can maintain musical leadership and follow director cues."},
 {number:11,phase:"Leadership",name:"Confidence and congregation engagement",goal:"Practice clear entrances, communication, and steady delivery.",practice:"Perform a section once as rehearsal and once as a simulated live lead.",check:"Can name specific improvements in presence and communication."},
 {number:12,phase:"Review",name:"Final evaluation and next steps",goal:"Compare current singing with the initial recording and plan continued growth.",practice:"Record the original assessment song again and document three changes.",check:"Can choose next goals for ongoing coaching or an audition."}
];
export default async function VoiceTrainingPage(){
 const {user,roles}=await getCurrentUserAndRoles();
 if(!user) redirect("/login");
 const staff=roles.some(r=>["super_admin","faculty","teacher"].includes(r));
 if(!staff&&!(await getStudentPrograms(user.id)).includes("voice")) redirect("/dashboard");
 const supabase=createClient();
 const {data:courses}=await supabase.from("dp_courses").select("id,dp_programs!inner(slug)").eq("dp_programs.slug","vocal-coaching");
 const courseIds=(courses??[]).map(c=>c.id);
 const {data:assignments,error}=courseIds.length ? await supabase.from("dp_assignments").select("id,title,course_id,lesson_id").in("course_id",courseIds) : {data:[],error:null};
 const assignmentIds=(assignments??[]).map(a=>a.id);
 const {data:submissions}=assignmentIds.length ? await supabase.from("dp_submissions").select("assignment_id,status").eq("student_id",user.id).in("assignment_id",assignmentIds).order("submitted_at",{ascending:false}) : {data:[]};
 const done=(assignments??[]).filter(a=>["approved","exempt"].includes(submissions?.find(s=>s.assignment_id===a.id)?.status??"")).length;
 const {data:modules}=courseIds.length ? await supabase.from("dp_modules").select("id").in("course_id",courseIds) : {data:[]};
 const moduleIds=(modules??[]).map(m=>m.id);
 const {data:published}=moduleIds.length ? await supabase.from("dp_lessons").select("id,slug,title").in("module_id",moduleIds) : {data:[]};
 const slugs=["voice-evaluation-goals","voice-breath-posture","voice-resonance-care","voice-pitch-matching","voice-register-transitions","voice-agility-control","voice-song-analysis","voice-phrasing-dynamics","voice-song-feedback","voice-follow-direction","voice-confidence-engagement","voice-final-evaluation"];
 return <div className="space-y-7 pb-16">
  <Link href="/voice" className="inline-flex items-center gap-2 font-ui text-sm font-semibold text-burgundy"><ArrowLeft className="h-4 w-4"/> Voice Home</Link>
  <header className="rounded-3xl bg-[#630000] p-7 text-white sm:p-9"><p className="font-ui text-xs uppercase tracking-[0.2em] text-[#E6A742]">Dove Expressions · Voice Studio</p><h1 className="mt-3 font-display text-3xl text-white sm:text-4xl">Your 12-session vocal development journey</h1><p className="mt-3 max-w-2xl font-body leading-relaxed text-white/80">A guided sequence of technique, practical application, and worship leadership. Your instructor can adjust the pace, repertoire, and exercises to your individual voice.</p></header>
  <div className="rounded-2xl border border-[#630000]/10 bg-[#F2DFD8]/40 p-5"><p className="font-ui text-sm font-semibold text-[#630000]">Your coaching progress: {done} of {assignments?.length??0} assignments complete</p><p className="mt-2 font-body text-sm text-charcoal/75">Follow your assigned practice below. Save your work as you go, submit it for review, and return for feedback. Your instructor chooses which sessions to assign and when; completion reflects approved or exempted practice.</p></div>
  {error&&<p role="alert">Your assigned practice could not be loaded. Please retry later.</p>}
  {staff&&<Link href="/staff/courses" className="btn-secondary">Manage curriculum and personalized assignments</Link>}
  <div className="space-y-4">{lessons.map(l=><article key={l.number} className="overflow-hidden rounded-3xl border border-charcoal/10 bg-white p-5 shadow-sm sm:p-6"><div className="flex flex-wrap items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#630000] font-display text-xl text-white">{l.number}</span><div><p className="font-ui text-xs font-bold uppercase tracking-wide text-[#D96248]">{l.phase}</p><h2 className="font-display text-xl text-[#630000]">{l.name}</h2></div></div><p className="mt-4 font-body text-sm text-charcoal/80">{l.goal}</p><div className="mt-3 space-y-2">{(assignments??[]).filter(a=>a.lesson_id===published?.find(p=>p.slug===slugs[l.number-1])?.id).map(a=><Link key={a.id} href={`/assignments#assignment-${a.id}`} className="block rounded-xl border border-burgundy/15 p-3 font-ui text-sm font-semibold text-burgundy">{a.title} · {submissions?.find(s=>s.assignment_id===a.id)?.status??"Assigned — start practice"}</Link>)}</div><div className="mt-4 grid gap-3 md:grid-cols-2"><div className="rounded-2xl bg-[#F2DFD8]/30 p-4"><div className="flex items-center gap-2 font-ui text-sm font-bold text-[#630000]"><CirclePlay className="h-4 w-4"/>Practice focus</div><p className="mt-2 font-body text-sm text-charcoal/75">{l.practice}</p></div><div className="rounded-2xl bg-[#E6A742]/10 p-4"><div className="flex items-center gap-2 font-ui text-sm font-bold text-[#630000]"><CheckCircle2 className="h-4 w-4"/>Progress checkpoint</div><p className="mt-2 font-body text-sm text-charcoal/75">{l.check}</p></div></div></article>)}</div>
  <div className="rounded-3xl bg-[#1B1717] p-6 text-white"><h2 className="font-display text-2xl text-white">Ready for personalized practice?</h2><p className="mt-2 font-body text-sm text-white/70">Your assigned work, coach feedback, and submissions belong in your private assignments area.</p><Link href="/assignments" className="mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-full bg-white px-5 py-3 font-ui text-sm font-bold text-[#630000]"><ClipboardList className="h-4 w-4"/>View my assignments</Link></div>
 </div>;
}

