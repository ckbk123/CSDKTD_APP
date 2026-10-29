import { expect, it, vi } from 'vitest';
import { mount } from './workspace';
const ui = vi.hoisted(() => ({ mount: vi.fn(() => vi.fn()) }));
vi.mock('./ui', () => ui);
it('returns synchronously and ignores disposed or aborted lazy mounts', async () => {
  const container = document.createElement('div'), controller = new AbortController();
  const dispose = mount({ container, signal: controller.signal }); expect(typeof dispose).toBe('function'); expect(container.textContent).toContain('Loading');
  if (typeof dispose === 'function') dispose(); await vi.dynamicImportSettled(); expect(ui.mount).not.toHaveBeenCalled(); expect(container.children.length).toBe(0);
  controller.abort(); mount({ container, signal: controller.signal }); await vi.dynamicImportSettled(); expect(ui.mount).not.toHaveBeenCalled();
});
it('keeps a visible recovery message when the UI fails', async () => {
  ui.mount.mockImplementationOnce(() => { throw new Error('mount failed'); }); const container = document.createElement('div'), controller = new AbortController();
  const dispose = mount({ container, signal: controller.signal }); await vi.dynamicImportSettled(); expect(container.querySelector('[role="alert"]')?.textContent).toContain('Reset the workspace'); if (typeof dispose === 'function') dispose();
});
it('cleans the active implementation', async () => {
  ui.mount.mockClear(); const container = document.createElement('div'), controller = new AbortController(), dispose = mount({ container, signal: controller.signal }); await vi.dynamicImportSettled(); expect(ui.mount).toHaveBeenCalledTimes(1);
  controller.abort(); if (typeof dispose === 'function') dispose(); expect(ui.mount.mock.results[0].value).toHaveBeenCalledTimes(1);
});
