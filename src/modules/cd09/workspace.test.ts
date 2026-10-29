import { expect, it, vi } from 'vitest';
import { mount } from './workspace';
import type { ModuleMount } from '../../core/module';
const ui = vi.hoisted(() => ({ mount: vi.fn<ModuleMount>(() => vi.fn()) }));
vi.mock('./ui', () => ui);
it('releases a disposer returned after reentrant parent abort', async () => {
  const parent=new AbortController(),container=document.createElement('div'),release=vi.fn();ui.mount.mockImplementationOnce(()=>{parent.abort();return release;});
  const dispose=mount({container,signal:parent.signal});await vi.dynamicImportSettled();expect(release).toHaveBeenCalledOnce();expect(container.children.length).toBe(0);dispose?.();expect(release).toHaveBeenCalledOnce();
});
it('returns synchronously and ignores disposed or aborted lazy mounts', async () => {
  const container = document.createElement('div'), controller = new AbortController();
  const dispose = mount({ container, signal: controller.signal }); expect(typeof dispose).toBe('function'); expect(container.textContent).toContain('Loading');
  if (typeof dispose === 'function') dispose(); await vi.dynamicImportSettled(); expect(ui.mount).not.toHaveBeenCalled(); expect(container.children.length).toBe(0);
  controller.abort(); mount({ container, signal: controller.signal }); await vi.dynamicImportSettled(); expect(ui.mount).not.toHaveBeenCalled();
});
it('keeps a visible recovery message when the UI fails', async () => {
  const resource = vi.fn(); let child: AbortSignal | undefined;
  ui.mount.mockImplementationOnce(({ container, signal }) => { child = signal; window.addEventListener('keydown', resource, { signal }); container.append(document.createElement('math-field')); throw new Error('mount failed'); });
  const container = document.createElement('div'), controller = new AbortController();
  const dispose = mount({ container, signal: controller.signal }); await vi.dynamicImportSettled();
  expect(controller.signal.aborted).toBe(false); expect(child?.aborted).toBe(true);
  window.dispatchEvent(new KeyboardEvent('keydown')); expect(resource).not.toHaveBeenCalled(); expect(container.querySelector('math-field')).toBeNull();
  expect(container.querySelector('[role="alert"]')?.textContent).toContain('Reset the workspace'); if (typeof dispose === 'function') dispose();
});
it('cleans the active implementation', async () => {
  ui.mount.mockClear(); const container = document.createElement('div'), controller = new AbortController(), dispose = mount({ container, signal: controller.signal }); await vi.dynamicImportSettled(); expect(ui.mount).toHaveBeenCalledTimes(1);
  controller.abort(); if (typeof dispose === 'function') dispose(); expect(ui.mount.mock.results[0].value).toHaveBeenCalledTimes(1);
});
it('aborts owned resources on direct disposal while the parent remains active', async () => {
  const resource = vi.fn(), release = vi.fn(); let child: AbortSignal | undefined;
  ui.mount.mockImplementationOnce(({ signal }) => { child = signal; window.addEventListener('keydown', resource, { signal }); return release; });
  const container = document.createElement('div'), controller = new AbortController(), dispose = mount({ container, signal: controller.signal }); await vi.dynamicImportSettled();
  window.dispatchEvent(new KeyboardEvent('keydown')); expect(resource).toHaveBeenCalledTimes(1);
  if (typeof dispose === 'function') { dispose(); dispose(); }
  expect(controller.signal.aborted).toBe(false); expect(child?.aborted).toBe(true); expect(release).toHaveBeenCalledTimes(1); expect(container.children.length).toBe(0);
  window.dispatchEvent(new KeyboardEvent('keydown')); expect(resource).toHaveBeenCalledTimes(1);
});
