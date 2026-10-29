import { beforeEach, expect, it, vi } from 'vitest';
import type { ModuleMount } from '../../core/module';
const view = vi.hoisted(() => ({ mountView: vi.fn<ModuleMount>(() => vi.fn()) }));
vi.mock('./view', () => view);
import { mount } from './workspace';
beforeEach(() => view.mountView.mockReset().mockImplementation(() => vi.fn()));

it('releases partial-mount resources immediately with parent active and recovery visible', async () => {
  const parent = new AbortController(), container = document.createElement('div'), listener = vi.fn(); let child: AbortSignal | undefined;
  view.mountView.mockImplementationOnce(context => { child = context.signal; window.addEventListener('cp04-resource', listener, { signal: context.signal }); context.container.append(document.createElement('button')); throw new Error('partial editor'); });
  const cleanup = mount({ container, signal: parent.signal }); await vi.dynamicImportSettled(); window.dispatchEvent(new Event('cp04-resource'));
  expect(listener).not.toHaveBeenCalled(); expect(child?.aborted).toBe(true); expect(parent.signal.aborted).toBe(false); expect(container.querySelector('button')).toBeNull(); expect(container.querySelector('[role="alert"]')?.textContent).toContain('Reset'); cleanup?.(); expect(container.children.length).toBe(0);
});
it('standalone cleanup owns child resources and releases the view exactly once', async () => {
  const parent = new AbortController(), container = document.createElement('div'), listener = vi.fn(), release = vi.fn();
  view.mountView.mockImplementationOnce(context => { window.addEventListener('cp04-resource', listener, { signal: context.signal }); return release; });
  const cleanup = mount({ container, signal: parent.signal }); await vi.dynamicImportSettled(); window.dispatchEvent(new Event('cp04-resource')); expect(listener).toHaveBeenCalledOnce(); cleanup?.(); cleanup?.(); window.dispatchEvent(new Event('cp04-resource'));
  expect(listener).toHaveBeenCalledOnce(); expect(release).toHaveBeenCalledOnce(); expect(parent.signal.aborted).toBe(false); expect(container.children.length).toBe(0); parent.abort(); expect(release).toHaveBeenCalledOnce();
});
it('releases a late disposer after reentrant parent abort', async () => {
  const parent = new AbortController(), container = document.createElement('div'), release = vi.fn();
  view.mountView.mockImplementationOnce(() => { parent.abort(); return release; }); const cleanup = mount({ container, signal: parent.signal }); await vi.dynamicImportSettled(); expect(release).toHaveBeenCalledOnce(); expect(container.children.length).toBe(0); cleanup?.(); expect(release).toHaveBeenCalledOnce();
});
it('removes pending standalone content and suppresses the deferred view', async () => {
  const parent = new AbortController(), container = document.createElement('div'), cleanup = mount({ container, signal: parent.signal }); cleanup?.(); await vi.dynamicImportSettled(); expect(view.mountView).not.toHaveBeenCalled(); expect(parent.signal.aborted).toBe(false); expect(container.children.length).toBe(0);
});
