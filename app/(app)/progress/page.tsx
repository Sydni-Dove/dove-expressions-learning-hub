import { redirect } from "next/navigation";
import { getCurrentUserAndRoles } from "@/lib/roles";
import { getStudentPrograms } from "@/lib/student-programs";
export default async function ProgressPage() {
 const {user}=await getCurrentUserAndRoles();
 if(!user) redirect("/login");
 const programs=await getStudentPrograms(user.id);
 redirect(programs.includes("voice") && !programs.includes("discipleship") ? "/voice/training" : "/discipleship/journey");
}
