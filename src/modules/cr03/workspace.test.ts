import { beforeEach, expect, it, vi } from 'vitest';
import { mount } from './workspace';
const view = vi.hoisted(() => ({ mount: vi.fn(() => vi.fn()) })); vi.mock('./view', () => view);
beforeEach(() => view.mount.mockReset().mockImplementation(() => vi.fn()));
it('ignores a view import that arrives after navigation', async () => {
  const controller = new AbortController(), container = document.createElement('div'), cleanup = mount({ container, signal: controller.signal }); controller.abort(); cleanup?.(); await vi.dynamicImportSettled(); expect(view.mount).not.toHaveBeenCalled(); expect(container.children.length).toBe(0);
});
it('reattaches visible recovery after an active view mount failure', async () => {
  const controller = new AbortController(), container = document.createElement('div'); view.mount.mockImplementationOnce(() => { container.append(document.createElement('section')); throw new Error('failed'); });
  const cleanup = mount({ container, signal: controller.signal }); await vi.dynamicImportSettled(); expect(container.children.length).toBe(1); expect(container.querySelector('[role="alert"]')?.textContent).toContain('Reset'); controller.abort(); cleanup?.();
});
it('does not attach a late failure after abort', async () => {
  const controller = new AbortController(), container = document.createElement('div'); view.mount.mockImplementationOnce(() => { controller.abort(); container.replaceChildren(); throw new Error('late'); });
  const cleanup = mount({ container, signal: controller.signal }); await vi.dynamicImportSettled(); expect(container.children.length).toBe(0); cleanup?.();
});
