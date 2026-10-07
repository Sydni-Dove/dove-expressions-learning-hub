export interface NavModule {
  id: string;
  order_index: number;
}

export interface NavLesson {
  id: string;
  module_id: string;
  order_index: number;
  status: string;
}

export interface LessonNeighbors {
  position: number;
  total: number;
  previousId: string | null;
  nextId: string | null;
  isLast: boolean;
}

/**
 * Published lessons in course order: module order first, then lesson order within
 * the module. Drafts/scheduled lessons are skipped so Previous/Next never lead a
 * student to a lesson they cannot open.
 */
export function orderPublishedLessons(modules: NavModule[], lessons: NavLesson[]): NavLesson[] {
  const moduleOrder = new Map(modules.map((m) => [m.id, m.order_index]));
  return lessons
    .filter((l) => l.status === "published" && moduleOrder.has(l.module_id))
    .sort((a, b) => {
      const mo = (moduleOrder.get(a.module_id) ?? 0) - (moduleOrder.get(b.module_id) ?? 0);
      return mo !== 0 ? mo : a.order_index - b.order_index;
    });
}

export function computeLessonNeighbors(ordered: NavLesson[], currentId: string): LessonNeighbors {
  const idx = ordered.findIndex((l) => l.id === currentId);
  // A lesson that isn't in the published list (e.g. staff previewing a draft) has no neighbors.
  if (idx === -1) {
    return { position: 1, total: ordered.length || 1, previousId: null, nextId: null, isLast: false };
  }
  return {
    position: idx + 1,
    total: ordered.length,
    previousId: idx > 0 ? ordered[idx - 1].id : null,
    nextId: idx < ordered.length - 1 ? ordered[idx + 1].id : null,
    isLast: idx === ordered.length - 1
  };
}
