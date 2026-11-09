import { beforeEach, expect, it, vi } from 'vitest';
import type { ModuleMount } from '../../core/module';
const engine = vi.hoisted(() => ({ mount: vi.fn<ModuleMount>() }));
vi.mock('./experiment-view', () => ({ mountExperiment: engine.mount }));
import { mount } from './view';
beforeEach(() => { engine.mount.mockReset().mockImplementation(() => undefined); });
const change = (root: HTMLElement, value: string) => { const mode = root.querySelector<HTMLSelectElement>('[aria-label="Learning mode"]')!; mode.value = value; mode.dispatchEvent(new Event('change')); };
it('calls a disposer returned after synchronous parent abort exactly once', () => {
  const parent = new AbortController(), root = document.createElement('div'), release = vi.fn(); let child: AbortSignal | undefined;
  engine.mount.mockImplementationOnce(context => { child = context.signal; parent.abort(); return release; }); const cleanup = mount({ container: root, signal: parent.signal });
  expect(child?.aborted).toBe(true); expect(release).toHaveBeenCalledOnce(); expect(root.children).toHaveLength(0); cleanup?.(); expect(release).toHaveBeenCalledOnce();
});
it('retains both independent child scopes through mode changes and releases them once on visit disposal', () => {
  const parent = new AbortController(), root = document.createElement('div'), releases = [vi.fn(), vi.fn()], scopes: AbortSignal[] = [];
  engine.mount.mockImplementation(context => { scopes.push(context.signal); return releases[scopes.length - 1]; }); const cleanup = mount({ container: root, signal: parent.signal });
  const exploration = root.querySelector<HTMLElement>('[data-cp03-panel="explore"]')!; change(root, 'practice'); expect(exploration.hidden).toBe(true); expect(exploration.inert).toBe(true); change(root, 'explore'); expect(engine.mount).toHaveBeenCalledTimes(2); expect(scopes.every(scope => !scope.aborted)).toBe(true);
  cleanup?.(); cleanup?.(); expect(scopes.every(scope => scope.aborted)).toBe(true); releases.forEach(release => expect(release).toHaveBeenCalledOnce()); expect(parent.signal.aborted).toBe(false); expect(root.children).toHaveLength(0);
});
it('aborts a failed panel before recovery and retries it without replacing the other visit', () => {
  const parent = new AbortController(), root = document.createElement('div'), listener = vi.fn();
  engine.mount.mockImplementationOnce(context => { window.addEventListener('cp03-panel-failure', listener, { signal: context.signal }); throw new Error('allocation'); }); const cleanup = mount({ container: root, signal: parent.signal }); window.dispatchEvent(new Event('cp03-panel-failure')); expect(listener).not.toHaveBeenCalled(); expect(root.querySelector('[role="alert"]')).not.toBeNull();
  change(root, 'practice'); const practice = root.querySelector('[data-cp03-panel="practice"]'); change(root, 'explore'); expect(engine.mount).toHaveBeenCalledTimes(3); expect(root.querySelector('[data-cp03-panel="practice"]')).toBe(practice); expect(root.querySelector('[role="alert"]')).toBeNull(); cleanup?.();
});
