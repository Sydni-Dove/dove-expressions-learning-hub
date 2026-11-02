import { MODULE_1 } from "./module-1";
import { MODULE_2 } from "./module-2";
import { MODULE_3, CORE_STATEMENT } from "./module-3";
import type { TeachingModule } from "./types";

export * from "./types";
export { CORE_STATEMENT };
export const TEACHING_MODULES: TeachingModule[] = [MODULE_1, MODULE_2, MODULE_3];
export const moduleByKey = (key: string) => TEACHING_MODULES.find((m) => m.key === key);
/** The part of a module a student may read once it is assigned. Instructor-only notes are never included. */
export const studentView = (m: TeachingModule) => ({ key: m.key, number: m.number, title: m.title, mainMessage: m.mainMessage, summary: m.summary, estimatedMinutes: m.estimatedMinutes, objectives: m.objectives, scriptures: m.scriptures, content: m.student });
export function wordCount(v: unknown): number { return typeof v === "string" ? v.split(/\s+/).filter(Boolean).length : Array.isArray(v) ? v.reduce((n, x) => n + wordCount(x), 0) : v && typeof v === "object" ? Object.values(v).reduce((n: number, x) => n + wordCount(x), 0) : 0; }
