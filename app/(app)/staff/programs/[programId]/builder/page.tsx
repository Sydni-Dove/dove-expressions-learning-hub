import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { EmptyState, Pill } from "@/components/ui";
import ProgramEditFields from "@/components/ProgramEditFields";
import CourseForm from "@/components/CourseForm";

export default async function ProgramBuilderPage({ params }: { params: { programId: string } }) {
  const supabase = createClient();
  const programId = params.programId;

  const { data: program } = await supabase.from("dp_programs").select("id,name,description,area_id").eq("id", programId).maybeSingle();

  if (!program) {
    return <EmptyState title="Not available" body="This program doesn't exist, or you don't have an assigned relationship to it." />;
  }

  const { data: courses } = await supabase
    .from("dp_courses")
    .select("id,title,is_published,is_standalone,order_index")
    .eq("program_id", programId)
    .order("order_index");

  return (
    <div className="max-w-3xl space-y-6 pb-16">
      <div>
        <Link href="/staff/programs" className="font-ui text-sm text-charcoal/60 underline">
          ← Programs
        </Link>
        <h1 className="mt-2 font-display text-3xl text-burgundy">{program.name}</h1>
      </div>

      <ProgramEditFields programId={program.id} initialName={program.name} initialDescription={program.description || ""} />

      <div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-xl text-burgundy">Courses</h2>
        </div>
        <div className="mt-3">
          <CourseForm programId={program.id} areaId={program.area_id} />
        </div>
        <div className="mt-4 space-y-3">
          {(courses ?? []).map((c) => (
            <Link key={c.id} href={`/staff/courses/${c.id}/builder`} className="card flex items-center justify-between p-4 hover:border-burgundy/40">
              <span className="font-body text-charcoal">{c.title}</span>
              <div className="flex gap-2">
                {c.is_standalone && <Pill tone="sunrise">standalone</Pill>}
                <Pill tone={c.is_published ? "success" : "neutral"}>{c.is_published ? "published" : "draft"}</Pill>
              </div>
            </Link>
          ))}
          {(!courses || courses.length === 0) && <EmptyState title="No courses yet" body="Add the first course above." />}
        </div>
      </div>
    </div>
  );
}
