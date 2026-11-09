import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { ModuleContext } from '../../core/module';
const mounts = vi.hoisted(() => ({ explore: vi.fn<(c: ModuleContext) => void | (() => void)>(), practice: vi.fn<(c: ModuleContext) => void | (() => void)>() }));
vi.mock('./explore', () => ({ mountExplore: mounts.explore })); vi.mock('./practice', () => ({ mountPractice: mounts.practice }));
import { mount } from './view';
beforeEach(() => { mounts.explore.mockReset().mockImplementation(() => {}); mounts.practice.mockReset().mockImplementation(() => {}); });
afterEach(() => { document.body.replaceChildren(); vi.restoreAllMocks(); });
function start(life = new AbortController()) { const container = document.createElement('div'); document.body.append(container); const done = mount({ container, signal: life.signal }); return { container, life, done }; }
function mode(c: HTMLElement, value: string) { const s = c.querySelector('select')!; s.value = value; s.dispatchEvent(new Event('change')); }
it('retains the same independent actual draft elements, suspends only work, and does not steal external focus', () => {
  const paused = vi.fn(); mounts.explore.mockImplementation(({ container, signal }) => { const input = document.createElement('input'); input.value = 'original draft'; container.append(input); container.addEventListener('cr03-deactivate', paused, { signal }); });
  const { container: c, done } = start(), input = c.querySelector('input')!; input.value = 'retained'; mode(c, 'practice'); expect(input.parentElement!.hidden).toBe(true); expect(input.parentElement!.inert).toBe(true); mode(c, 'explore'); expect(c.querySelector('input')).toBe(input); expect(input.value).toBe('retained'); expect(paused).toHaveBeenCalledOnce(); done?.();
});
it('aborts partial resources before recovery and restores Retry focus only when owned', () => {
  const resource = vi.fn(), signals: AbortSignal[] = []; mounts.explore.mockImplementationOnce(({ signal }) => { signals.push(signal); window.addEventListener('cr03-partial-review', resource, { signal }); throw new Error('partial'); });
  const { container: c, life, done } = start(); window.dispatchEvent(new Event('cr03-partial-review')); expect(resource).not.toHaveBeenCalled(); expect(signals[0].aborted).toBe(true); expect(life.signal.aborted).toBe(false);
  const old = c.querySelector('button')!; old.focus(); old.click(); expect(document.activeElement).toBe(c.querySelector('select')); expect(mounts.explore).toHaveBeenCalledTimes(2); old.click(); expect(mounts.explore).toHaveBeenCalledTimes(2); done?.();
});
it('keeps externally focused controls focused after a programmatic successful Retry', () => {
  mounts.explore.mockImplementationOnce(() => { throw new Error('partial'); }); const { container: c, done } = start(), outside = document.createElement('button'); document.body.append(outside); outside.focus(); c.querySelector('button')!.click(); expect(document.activeElement).toBe(outside); done?.();
});
it('aborts all child scopes before releasing every throwing resource exactly once', () => {
  const signals: AbortSignal[] = [], released: string[] = []; const make = (name: string) => ({ signal }: ModuleContext) => { signals.push(signal); return () => { expect(signals.every(s => s.aborted)).toBe(true); released.push(name); throw new Error(name); }; };
  mounts.explore.mockImplementation(make('first')); mounts.practice.mockImplementation(make('second')); const { container: c, done } = start(); mode(c, 'practice'); expect(() => done?.()).toThrow('first'); expect(released).toEqual(['first', 'second']); done?.(); expect(c.children).toHaveLength(0);
});
it('releases a disposer returned after reentrant abort and ignores already aborted visits', () => {
  const life = new AbortController(), release = vi.fn(); mounts.explore.mockImplementation(() => { life.abort(); return release; }); const x = start(life); x.done?.(); expect(release).toHaveBeenCalledOnce(); expect(x.container.children).toHaveLength(0); const y = start(life); expect(mounts.explore).toHaveBeenCalledOnce(); expect(y.container.children).toHaveLength(0);
});
