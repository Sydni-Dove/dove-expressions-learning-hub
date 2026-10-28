import { redirect } from "next/navigation";
import { getCurrentUserAndRoles } from "@/lib/roles";
import { getStudentPrograms } from "@/lib/student-programs";
export default async function ProgramLayout({children}:{children:React.ReactNode}) {
 const {user,roles}=await getCurrentUserAndRoles();
 if(!user) redirect("/login");
 const staff=roles.some(r=>["super_admin","faculty","teacher","mentor"].includes(r));
 if(!staff && !(await getStudentPrograms(user.id)).includes("creative")) redirect("/dashboard");
 return <>{children}</>;
}
