import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import LessonLocked from "@/components/LessonLocked";
import { testimonialState } from "@/components/voice/MyTestimonials";

afterEach(() => cleanup());
describe("closed lesson", () => {
  it("explains what is unlocked and reassures that records stay available", () => {
    render(<LessonLocked title="Lesson six" backHref="/courses/c" neededLessons={6} neededLevel={0} unlockedNow={4} />);
    expect(screen.getByRole("status")).toHaveTextContent("opens once 6 lessons of your package are paid for");
    expect(screen.getByRole("status")).toHaveTextContent("Right now 4 are unlocked");
    expect(screen.getByRole("status")).toHaveTextContent("assignments, feedback and progress stay available");
  });
  it("says so when the package itself has not been purchased", () => {
    render(<LessonLocked title="Advanced" backHref="/courses/c" neededLessons={1} neededLevel={2} unlockedNow={0} />);
    expect(screen.getByRole("status")).toHaveTextContent("part of a coaching package you have not purchased");
  });
});
describe("testimonial state wording", () => {
  it("never claims publication after withdrawal", () => {
    expect(testimonialState({ status: "approved", published_at: "2026-01-01", allow_public_use: false, consent_withdrawn_at: "2026-02-01" })).toMatch(/withdrew/);
    expect(testimonialState({ status: "approved", published_at: "2026-01-01", allow_public_use: true, consent_withdrawn_at: null })).toMatch(/Published/);
  });
});
