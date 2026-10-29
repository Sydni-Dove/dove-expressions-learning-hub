import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, cleanup } from "@testing-library/react";
import GoalProgressForm from "@/components/voice/GoalProgressForm";
import { AssignPlanForm } from "@/components/voice/ResourceAdmin";
import { groupBySkill, isWeeklyPlan, linkHost, ratingTrend, safeLink } from "@/lib/voice-resources";

const mocks = vi.hoisted(() => ({ insert: vi.fn(), rpc: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ rpc: mocks.rpc, from: () => ({ insert: mocks.insert }) }) }));
beforeEach(() => { cleanup(); vi.clearAllMocks(); mocks.insert.mockResolvedValue({ error: null }); mocks.rpc.mockResolvedValue({ error: null }); });

describe("resource helpers", () => {
  it("only links https URLs", () => {
    expect(safeLink("https://youtu.be/x")).toBe("https://youtu.be/x");
    for (const bad of ["http://x.com", "javascript:alert(1)", "data:text/html,hi", "", null, undefined, "https://a b"]) expect(safeLink(bad as string)).toBeNull();
    expect(linkHost("https://www.youtube.com/watch?v=1")).toBe("youtube.com");
  });
  it("groups active exercises by skill and hides empty skills", () => {
    const skills = [{ id: "s2", slug: "b", name: "B", sort_order: 2 }, { id: "s1", slug: "a", name: "A", sort_order: 1 }, { id: "s3", slug: "c", name: "C", sort_order: 3 }];
    const ex = [{ id: "1", skill_id: "s2", title: "Z", instructions: null, video_url: null, source_name: null, minutes: null }, { id: "2", skill_id: "s2", title: "Y", instructions: null, video_url: null, source_name: null, minutes: null }, { id: "3", skill_id: "s1", title: "Hidden", instructions: null, video_url: null, source_name: null, minutes: null, is_active: false }];
    const g = groupBySkill(skills, ex);
    expect(g.map(x => x.skill.name)).toEqual(["B"]);
    expect(g[0].exercises.map(e => e.title)).toEqual(["Y", "Z"]);
  });
  it("identifies weekly plans and rating direction", () => {
    expect(isWeeklyPlan({ practice_items: [{}] })).toBe(true);
    expect(isWeeklyPlan({ practice_items: [] })).toBe(false);
    expect(isWeeklyPlan({})).toBe(false);
    expect(ratingTrend([{ rating: 2, created_at: "2026-01-01" }, { rating: 4, created_at: "2026-02-01" }, { rating: null, created_at: "2026-03-01" }])).toEqual({ latest: 4, change: 2, count: 2 });
    expect(ratingTrend([]).latest).toBeNull();
  });
});

describe("goal progress form", () => {
  it("saves a note and rating as the student", async () => {
    render(<GoalProgressForm goalId="g1" authorId="u1" />);
    fireEvent.change(screen.getByLabelText(/How is this going/), { target: { value: "Better today" } });
    fireEvent.click(screen.getByRole("radio", { name: /Rating 4/ }));
    fireEvent.click(screen.getByRole("button", { name: "Save progress" }));
    await waitFor(() => expect(mocks.insert).toHaveBeenCalledWith({ goal_id: "g1", author_id: "u1", note: "Better today", rating: 4 }));
    expect(await screen.findByRole("status")).toHaveTextContent("Progress saved");
  });
  it("requires a note or rating", async () => {
    render(<GoalProgressForm goalId="g1" authorId="u1" />);
    fireEvent.click(screen.getByRole("button", { name: "Save progress" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Add a note or choose a rating");
    expect(mocks.insert).not.toHaveBeenCalled();
  });
});

describe("assign weekly plan", () => {
  const students = [{ id: "s1", full_name: "Ada", email: null }];
  const exercises = [{ id: "e1", skill_id: "k", title: "Lip trills", instructions: null, video_url: null, source_name: null, minutes: 5, is_active: true }, { id: "e2", skill_id: "k", title: "Hiss", instructions: null, video_url: null, source_name: null, minutes: null, is_active: true }];
  const templates = [{ id: "t1", title: "Foundations", is_active: true, items: [{ exercise_id: "e2" }, { exercise_id: "gone" }] }];
  it("assigns chosen exercises with per-student notes through the plan function", async () => {
    render(<AssignPlanForm students={students} exercises={exercises} templates={templates} />);
    fireEvent.change(screen.getByLabelText("Student"), { target: { value: "s1" } });
    fireEvent.change(screen.getByLabelText("Plan title"), { target: { value: "Week 1" } });
    fireEvent.click(screen.getByLabelText("Lip trills"));
    fireEvent.change(screen.getByLabelText("Note for Lip trills"), { target: { value: "Slowly" } });
    fireEvent.click(screen.getByRole("button", { name: "Assign plan" }));
    await waitFor(() => expect(mocks.rpc).toHaveBeenCalled());
    expect(mocks.rpc.mock.calls[0][0]).toBe("dp_assign_weekly_plan");
    expect(mocks.rpc.mock.calls[0][1]).toMatchObject({ student: "s1", plan_title: "Week 1", items: [{ exercise_id: "e1", note: "Slowly" }] });
  });
  it("prefills from a template, skipping exercises that no longer exist, and blocks empty plans", async () => {
    render(<AssignPlanForm students={students} exercises={exercises} templates={templates} />);
    fireEvent.change(screen.getByLabelText(/Start from a template/), { target: { value: "t1" } });
    expect(screen.getByLabelText("Hiss")).toBeChecked();
    expect(screen.getByLabelText("Lip trills")).not.toBeChecked();
    fireEvent.click(screen.getByLabelText("Hiss"));
    fireEvent.click(screen.getByRole("button", { name: "Assign plan" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Choose a student");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
