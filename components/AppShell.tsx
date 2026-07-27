"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  BookOpen,
  Palette,
  ClipboardList,
  TrendingUp,
  Radio,
  Wind,
  Target,
  NotebookPen,
  HandHeart,
  MessageCircle,
  Users2,
  Megaphone,
  CalendarDays,
  Library,
  UserCircle,
  Flag,
  HelpCircle,
  ShieldCheck,
  GraduationCap,
  ClipboardCheck,
  FolderKanban,
  LogOut,
  Menu,
  X,
  Compass,
  Map,
  type LucideIcon
} from "lucide-react";
import { studentNavGroups, staffNav } from "@/components/nav-config";
import type { DpRole } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";

const ICONS: Record<string, LucideIcon> = {
  "/dashboard": LayoutDashboard,
  "/discipleship": Compass,
  "/discipleship/journey": Map,
  "/program": BookOpen,
  "/courses": BookOpen,
  "/creative-studio": Palette,
  "/assignments": ClipboardList,
  "/progress": TrendingUp,
  "/live": Radio,
  "/wiring": Wind,
  "/plan": Target,
  "/notes": NotebookPen,
  "/prayer": HandHeart,
  "/messages": MessageCircle,
  "/community": Users2,
  "/announcements": Megaphone,
  "/calendar": CalendarDays,
  "/library": Library,
  "/profile": UserCircle,
  "/report": Flag,
  "/help": HelpCircle,
  "/staff/dashboard": LayoutDashboard,
  "/staff/students": Users2,
  "/staff/programs": FolderKanban,
  "/staff/courses": GraduationCap,
  "/staff/assignments": ClipboardCheck,
  "/staff/live": Radio,
  "/staff/announcements": Megaphone,
  "/staff/reports": ShieldCheck
};

function NavList({
  items,
  pathname,
  onNavigate
}: {
  items: { href: string; label: string }[];
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <ul className="space-y-1">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(item.href + "/");
        const Icon = ICONS[item.href];
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-[44px] items-center gap-3 rounded-pill px-4 py-2.5 font-ui text-sm font-medium transition ${
                active ? "bg-white/15 text-soft shadow-inner" : "text-soft/75 hover:bg-white/10 hover:text-soft"
              }`}
            >
              {Icon && <Icon className="h-4.5 w-4.5 shrink-0" aria-hidden="true" />}
              <span className="truncate">{item.label}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function StudentNavGroups({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <>
      {studentNavGroups.map((group) => (
        <div key={group.label} className="mb-6">
          <p className="mb-2 px-4 font-ui text-xs font-semibold uppercase tracking-wide text-soft/40">{group.label}</p>
          <NavList items={group.items} pathname={pathname} onNavigate={onNavigate} />
        </div>
      ))}
    </>
  );
}

export default function AppShell({
  roles,
  userLabel,
  children
}: {
  roles: DpRole[];
  userLabel: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isStaff = roles.some((r) => ["faculty", "teacher", "mentor", "super_admin"].includes(r));
  const isStudent = roles.some((r) => ["student", "guest"].includes(r)) || !isStaff;

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-soft">
      {/* Desktop sidebar — burgundy, per brand usage (primary nav) */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:flex lg:w-72 lg:flex-col lg:bg-burgundy-gradient">
        <div className="flex h-20 items-center gap-2 px-6">
          <span className="font-display text-xl text-soft">Dove Expressions</span>
        </div>
        <nav aria-label="Primary" className="flex-1 overflow-y-auto px-4 py-4">
          {isStudent && <StudentNavGroups pathname={pathname} />}
          {isStaff && (
            <div className="mb-6">
              <p className="mb-2 px-4 font-ui text-xs font-semibold uppercase tracking-wide text-soft/40">Staff</p>
              <NavList items={staffNav.filter((i) => i.roles.some((r) => roles.includes(r)))} pathname={pathname} />
            </div>
          )}
        </nav>
        <div className="border-t border-white/10 p-4">
          <div className="flex items-center gap-2.5 rounded-2xl bg-white/5 px-3 py-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gold text-burgundy font-ui text-sm font-bold">
              {userLabel.charAt(0).toUpperCase()}
            </div>
            <p className="truncate font-ui text-sm font-semibold text-soft">{userLabel}</p>
          </div>
          <button
            onClick={handleSignOut}
            className="mt-2 flex min-h-[44px] w-full items-center gap-2 rounded-pill px-4 py-2 text-left font-ui text-sm text-soft/60 transition hover:bg-white/10 hover:text-soft"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="flex h-16 items-center justify-between bg-burgundy px-4 lg:hidden">
        <span className="font-display text-lg text-soft">Dove Expressions</span>
        <button
          aria-expanded={mobileOpen}
          aria-controls="mobile-nav-panel"
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          onClick={() => setMobileOpen(true)}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-white/25 text-soft"
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
        </button>
      </header>

      {/* Mobile full-width panel — never overflows the viewport, closes on navigate/backdrop */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-charcoal/50" onClick={() => setMobileOpen(false)} aria-hidden="true" />
          <div
            id="mobile-nav-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
            className="absolute inset-y-0 left-0 flex w-full max-w-full flex-col overflow-y-auto bg-burgundy-gradient"
          >
            <div className="flex h-16 items-center justify-between px-4">
              <span className="font-display text-lg text-soft">Menu</span>
              <button
                aria-label="Close menu"
                onClick={() => setMobileOpen(false)}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-white/25 text-soft"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <nav aria-label="Primary" className="flex-1 px-4 py-4">
              {isStudent && <StudentNavGroups pathname={pathname} onNavigate={() => setMobileOpen(false)} />}
              {isStaff && (
                <div className="mb-6">
                  <p className="mb-2 px-4 font-ui text-xs font-semibold uppercase tracking-wide text-soft/40">Staff</p>
                  <NavList
                    items={staffNav.filter((i) => i.roles.some((r) => roles.includes(r)))}
                    pathname={pathname}
                    onNavigate={() => setMobileOpen(false)}
                  />
                </div>
              )}
            </nav>
            <div className="border-t border-white/10 p-4">
              <p className="truncate px-2 font-ui text-sm font-semibold text-soft">{userLabel}</p>
              <button
                onClick={handleSignOut}
                className="mt-2 flex min-h-[44px] w-full items-center gap-2 rounded-pill px-4 py-2 text-left font-ui text-sm text-soft/60"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="lg:pl-72">
        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-10">{children}</div>
      </main>
    </div>
  );
}
