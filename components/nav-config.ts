import type { DpRole } from "@/lib/types";

export interface NavItem {
  href: string;
  label: string;
  roles: DpRole[];
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

// Student navigation, grouped so we're never showing 15+ flat top-level items.
export const studentNavGroups: NavGroup[] = [
  {
    label: "Learn",
    items: [
      { href: "/dashboard", label: "Dashboard", roles: ["student", "guest"] },
      { href: "/discipleship", label: "Discipleship", roles: ["student"] },
      { href: "/program", label: "My Program", roles: ["student"] },
      { href: "/courses", label: "Courses", roles: ["student"] },
      { href: "/creative-studio", label: "Creative Studio", roles: ["student"] },
      { href: "/assignments", label: "Assignments", roles: ["student"] },
      { href: "/live", label: "Live Sessions", roles: ["student"] }
    ]
  },
  {
    label: "Grow",
    items: [
      { href: "/discipleship/journey", label: "My Journey", roles: ["student"] },
      { href: "/wiring", label: "Spiritual Wiring", roles: ["student"] },
      { href: "/plan", label: "Discipleship Plan", roles: ["student"] },
      { href: "/notes", label: "Notes & Journal", roles: ["student"] },
      { href: "/prayer", label: "Prayer", roles: ["student"] }
    ]
  },
  {
    label: "Connect",
    items: [
      { href: "/messages", label: "Messages", roles: ["student"] },
      { href: "/community", label: "Community", roles: ["student"] },
      { href: "/announcements", label: "Announcements", roles: ["student"] },
      { href: "/calendar", label: "Calendar", roles: ["student"] }
    ]
  },
  {
    label: "Library",
    items: [{ href: "/library", label: "Library", roles: ["student"] }]
  },
  {
    label: "Account",
    items: [
      { href: "/profile", label: "Profile", roles: ["student"] },
      { href: "/report", label: "Report a concern", roles: ["student"] },
      { href: "/help", label: "Help", roles: ["student"] }
    ]
  }
];

export const staffNav: NavItem[] = [
  { href: "/staff/dashboard", label: "Dashboard", roles: ["faculty", "teacher", "mentor", "super_admin"] },
  { href: "/staff/students", label: "Students", roles: ["faculty", "teacher", "mentor", "super_admin"] },
  { href: "/staff/programs", label: "Programs", roles: ["faculty", "super_admin"] },
  { href: "/staff/courses", label: "Courses", roles: ["faculty", "teacher", "super_admin"] },
  { href: "/staff/assignments", label: "Assignments", roles: ["faculty", "teacher", "mentor", "super_admin"] },
  { href: "/staff/live", label: "Live Sessions", roles: ["faculty", "teacher", "super_admin"] },
  { href: "/staff/announcements", label: "Announcements", roles: ["faculty", "super_admin"] },
  { href: "/staff/reports", label: "Reports", roles: ["faculty", "super_admin"] }
];
