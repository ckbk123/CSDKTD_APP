import { beforeEach, expect, it, vi } from 'vitest';
import { mount } from './workspace';

const view = vi.hoisted(() => ({ mount: vi.fn(() => vi.fn()) }));
vi.mock('./view', () => view);
beforeEach(() => view.mount.mockReset().mockImplementation(() => vi.fn()));
it('attaches recoverable feedback when view mounting throws after adding partial content', async () => {
  const controller = new AbortController(), container = document.createElement('div');
  document.body.append(container);
  view.mount.mockImplementationOnce(() => {
    container.append(document.createElement('section'));
    throw new Error('View mount failed');
  });
  const cleanup = mount({ container, signal: controller.signal });
  await vi.dynamicImportSettled();
  expect(view.mount).toHaveBeenCalledOnce();
  expect(container.children.length).toBe(1);
  expect(container.querySelector('[role="alert"]')?.isConnected).toBe(true);
  expect(container.textContent).toContain('Reset the workspace to try again.');
  controller.abort(); cleanup?.(); container.remove();
});
it('does not attach mount-failure feedback after the visit has been aborted', async () => {
  const controller = new AbortController(), container = document.createElement('div');
  view.mount.mockImplementationOnce(() => {
    controller.abort(); container.replaceChildren();
    throw new Error('View mount interrupted');
  });
  const cleanup = mount({ container, signal: controller.signal });
  await vi.dynamicImportSettled();
  expect(view.mount).toHaveBeenCalledOnce(); expect(container.children.length).toBe(0);
  cleanup?.();
});
it('does not mount an equation view that arrives after navigation/abort', async () => {
  const controller = new AbortController(), container = document.createElement('div');
  const cleanup = mount({ container, signal: controller.signal });
  controller.abort(); cleanup?.();
  await vi.dynamicImportSettled();
  expect(view.mount).not.toHaveBeenCalled(); expect(container.children.length).toBe(0);
});
