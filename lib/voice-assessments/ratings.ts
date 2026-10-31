import { areaByKey } from "@/lib/voice-curriculum";

export const RATING_LABELS: Record<number, string> = { 1: "Just starting", 2: "Beginning to develop", 3: "Developing steadily", 4: "Confident", 5: "Strong" };
export type CheckKind = "baseline" | "progress" | "midpoint" | "final" | "custom";
export interface CheckRow { kind: CheckKind | string; week: number; ratings: Record<string, number | string> | null; created_at?: string }
export interface ComparisonRow { baselineSource: "demo" | "check" | null; areaKey: string; areaTitle: string; baseline: number | null; progress: number | null; midpoint: number | null; final: number | null; latest: number | null; change: number | null }

const num = (v: unknown) => { const n = Number(v); return Number.isInteger(n) && n >= 1 && n <= 5 ? n : null; };
/** One row per skill area in the student's plan: baseline vs progress vs midpoint vs final. If a kind was recorded more than once the most recent wins.
 *  `change` is the latest rating minus the baseline (null until both exist). Only areas that are in the plan are shown. */
/** The Vocal Demo recorded at the consultation is the technical baseline, so nobody re-collects it after purchase. */
export interface DemoRow { ratings: Record<string, number | string> | null }
export function compareRatings(checks: CheckRow[], planAreaKeys: string[], demo: DemoRow | null = null): ComparisonRow[] {
  const ordered = [...checks].sort((a, b) => a.week - b.week || String(a.created_at ?? "").localeCompare(String(b.created_at ?? "")));
  return [...new Set(planAreaKeys)].map((key) => {
    const at = (kind: string) => { let v: number | null = null; for (const c of ordered) if (c.kind === kind) v = num(c.ratings?.[key]) ?? v; return v; };
    const checkBaseline = at("baseline"); const demoBaseline = num(demo?.ratings?.[key]);
    const baseline = checkBaseline ?? demoBaseline; const baselineSource = checkBaseline !== null ? "check" : demoBaseline !== null ? "demo" : null;
    const progress = at("progress"), midpoint = at("midpoint"), final = at("final");
    const latest = final ?? midpoint ?? progress ?? baseline;
    return { baselineSource, areaKey: key, areaTitle: areaByKey(key)?.title ?? key, baseline, progress, midpoint, final, latest, change: baseline !== null && latest !== null && latest !== baseline ? latest - baseline : baseline !== null && latest === baseline ? 0 : null };
  });
}
export const describeChange = (c: number | null) => (c === null ? "—" : c > 0 ? `+${c}` : c === 0 ? "no change" : String(c));
