import { beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ user: true, course: true, access: true, settings: true }));
vi.mock('@/lib/supabase/server', () => ({ createClient: () => ({
  auth: { getUser: async () => ({ data: { user: state.user ? { id: 'u' } : null } }) },
  from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: state.course ? { id: 'c', title: 'How to Make an App with AI' } : null }) }) }) })
}) }));
vi.mock('@/lib/course-access', () => ({
  getCourseSettingsRaw: async () => state.settings ? { access_mode: 'enrolled', lesson_style: 'practical' } : null,
  canAccessCourse: async () => state.access
}));
import { GET } from '@/app/(app)/courses/[courseId]/worksheets/app-objective/route';
beforeEach(() => Object.assign(state, { user: true, course: true, access: true, settings: true }));
const get = () => GET(new Request('http://localhost/courses/c/worksheets/app-objective'), { params: { courseId: 'c' } });
it('requires sign-in', async () => { state.user = false; expect((await get()).status).toBe(401); });
it('denies a non-enrolled student', async () => { state.access = false; expect((await get()).status).toBe(403); });
it('fails closed when course settings are unavailable', async () => { state.settings = false; expect((await get()).status).toBe(503); });
it('returns a private downloadable worksheet for an authorized learner', async () => {
  const response = await get();
  expect(response.status).toBe(200);
  expect(response.headers.get('Cache-Control')).toBe('private, no-store');
  expect(response.headers.get('Content-Disposition')).toContain('app-objective-worksheet.txt');
  expect(await response.text()).toContain('What would I need to see working');
});
