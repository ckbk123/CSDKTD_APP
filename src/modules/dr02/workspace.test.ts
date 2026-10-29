import { expect, it, vi } from 'vitest';
import { mount } from './workspace';

const view = vi.hoisted(() => ({ mount: vi.fn(() => vi.fn()) }));
vi.mock('./view', () => view);
it('does not mount an equation view that arrives after navigation/abort', async () => {
  view.mount.mockClear();
  const controller = new AbortController(), container = document.createElement('div');
  const cleanup = mount({ container, signal: controller.signal });
  controller.abort(); cleanup?.();
  await vi.dynamicImportSettled();
  expect(view.mount).not.toHaveBeenCalled(); expect(container.children.length).toBe(0);
});
