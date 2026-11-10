import { AREAS_1 } from "./areas-1";
import { AREAS_2 } from "./areas-2";
import { AREAS_3 } from "./areas-3";
import { TRACKS, TRACK_META } from "./tracks";
import type { AreaSpec, ExerciseSpec, Level, TrackKey } from "./types";

export * from "./types";
export { TRACK_META };
export const CORE_AREAS: AreaSpec[] = [...AREAS_1, ...AREAS_2, ...AREAS_3];
export const TRACK_AREAS: AreaSpec[] = TRACKS;
export const ALL_AREAS: AreaSpec[] = [...CORE_AREAS, ...TRACK_AREAS];

export const areaByKey = (key: string) => ALL_AREAS.find((a) => a.key === key);

export function allExercises(): (ExerciseSpec & { area: AreaSpec })[] {
  return ALL_AREAS.flatMap((area) => area.exercises.map((e) => ({ ...e, area })));
}

/** Areas a student may be offered: all core areas, plus only the optional tracks they chose. */
export function offeredAreas(selectedTracks: TrackKey[]): AreaSpec[] {
  return ALL_AREAS.filter((a) => !a.track || selectedTracks.includes(a.track));
}

export function exercisesForLevel(area: AreaSpec, level: Level) {
  return area.exercises.filter((e) => e.level === level || e.level === "all");
}
