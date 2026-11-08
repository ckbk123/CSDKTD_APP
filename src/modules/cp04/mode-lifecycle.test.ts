import { beforeEach, expect, it, vi } from 'vitest';
import type { ModuleMount } from '../../core/module';
const views = vi.hoisted(() => ({ explore: vi.fn<ModuleMount>(), practice: vi.fn<ModuleMount>() }));
vi.mock('./explore', () => ({ mountExplore: views.explore }));
vi.mock('./practice', () => ({ mountView: views.practice }));
import { mountView } from './view';
beforeEach(() => { views.explore.mockReset().mockImplementation(() => undefined); views.practice.mockReset().mockImplementation(() => undefined); });
function change(root: HTMLElement, value: string) { const mode = root.querySelector<HTMLSelectElement>('[aria-label="Learning mode"]')!; mode.value = value; mode.dispatchEvent(new Event('change')); }

it('calls a disposer returned after a synchronous parent abort exactly once', () => {
  const parent = new AbortController(), root = document.createElement('div'), release = vi.fn(); let child: AbortSignal | undefined;
  views.explore.mockImplementation(context => { child = context.signal; parent.abort(); return release; });
  const dispose = mountView({ container: root, signal: parent.signal });
  expect(child?.aborted).toBe(true); expect(release).toHaveBeenCalledOnce(); expect(root.children).toHaveLength(0); dispose?.(); expect(release).toHaveBeenCalledOnce();
});
it('retains independent panel scopes until visit disposal and releases both once', () => {
  const parent = new AbortController(), root = document.createElement('div'), exploreRelease = vi.fn(), practiceRelease = vi.fn(), children: AbortSignal[] = [];
  views.explore.mockImplementation(context => { children.push(context.signal); return exploreRelease; }); views.practice.mockImplementation(context => { children.push(context.signal); return practiceRelease; });
  const dispose = mountView({ container: root, signal: parent.signal }); const explore = root.querySelector<HTMLElement>('[data-cp04-panel="explore"]')!;
  change(root, 'practice'); expect(explore.hidden).toBe(true); expect(explore.inert).toBe(true); expect(children.every(signal => !signal.aborted)).toBe(true);
  change(root, 'explore'); expect(explore.hidden).toBe(false); expect(explore.inert).toBe(false); expect(views.explore).toHaveBeenCalledOnce(); expect(views.practice).toHaveBeenCalledOnce();
  dispose?.(); dispose?.(); expect(children.every(signal => signal.aborted)).toBe(true); expect(exploreRelease).toHaveBeenCalledOnce(); expect(practiceRelease).toHaveBeenCalledOnce(); expect(root.children).toHaveLength(0); expect(parent.signal.aborted).toBe(false);
});
it('aborts failed panel resources and retries only that mode without losing the other panel', () => {
  const parent = new AbortController(), root = document.createElement('div'), resource = vi.fn();
  views.explore.mockImplementationOnce(context => { window.addEventListener('cp04-mode-failure', resource, { signal: context.signal }); throw new Error('allocation'); }).mockImplementation(() => undefined);
  const dispose = mountView({ container: root, signal: parent.signal }); window.dispatchEvent(new Event('cp04-mode-failure')); expect(resource).not.toHaveBeenCalled(); expect(root.querySelector('[role="alert"]')).not.toBeNull();
  change(root, 'practice'); const practice = root.querySelector('[data-cp04-panel="practice"]'); change(root, 'explore'); expect(views.explore).toHaveBeenCalledTimes(2); expect(root.querySelector('[data-cp04-panel="practice"]')).toBe(practice); expect(root.querySelector('[role="alert"]')).toBeNull(); dispose?.();
});
