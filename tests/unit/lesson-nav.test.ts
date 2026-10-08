import { describe, it, expect } from "vitest";
import { orderPublishedLessons, computeLessonNeighbors } from "@/lib/lesson-nav";

const modules = [
  { id: "m2", order_index: 2 },
  { id: "m1", order_index: 1 }
];
const lessons = [
  { id: "b2", module_id: "m2", order_index: 2, status: "published" },
  { id: "a2", module_id: "m1", order_index: 2, status: "published" },
  { id: "a1", module_id: "m1", order_index: 1, status: "published" },
  { id: "draft", module_id: "m1", order_index: 3, status: "draft" },
  { id: "b1", module_id: "m2", order_index: 1, status: "published" },
  { id: "orphan", module_id: "gone", order_index: 1, status: "published" }
];

describe("lesson navigation", () => {
  const ordered = orderPublishedLessons(modules, lessons);

  it("orders by module then lesson and skips drafts/orphans", () => {
    expect(ordered.map((l) => l.id)).toEqual(["a1", "a2", "b1", "b2"]);
  });
  it("first lesson has no previous", () => {
    const n = computeLessonNeighbors(ordered, "a1");
    expect(n.previousId).toBeNull();
    expect(n.nextId).toBe("a2");
    expect(n.position).toBe(1);
    expect(n.total).toBe(4);
  });
  it("end of a module goes to the first lesson of the next module", () => {
    const n = computeLessonNeighbors(ordered, "a2");
    expect(n.nextId).toBe("b1");
    expect(computeLessonNeighbors(ordered, "b1").previousId).toBe("a2");
  });
  it("last lesson has no next and is flagged as last", () => {
    const n = computeLessonNeighbors(ordered, "b2");
    expect(n.nextId).toBeNull();
    expect(n.isLast).toBe(true);
  });
  it("a lesson outside the published list (staff previewing a draft) gets no neighbors", () => {
    const n = computeLessonNeighbors(ordered, "draft");
    expect(n.previousId).toBeNull();
    expect(n.nextId).toBeNull();
    expect(n.isLast).toBe(false);
  });
});
