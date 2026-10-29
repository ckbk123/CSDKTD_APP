import { expect, it, vi } from 'vitest';
import { mount } from './workspace';

const implementation = vi.hoisted(() => ({ mount: vi.fn(() => vi.fn()) }));
vi.mock('./ui', () => implementation);
it('does not mount after cleanup or abort wins the editor import', async () => {
  const container = document.createElement('div'), signal = new AbortController();
  const cleanup = mount({ container, signal: signal.signal });
  expect(typeof cleanup).toBe('function');
  expect(container.textContent).toContain('Loading Jury exercise');
  if (typeof cleanup === 'function') cleanup();
  expect(container.children.length).toBe(0);
  await vi.dynamicImportSettled(); expect(implementation.mount).not.toHaveBeenCalled();
  const controller = new AbortController(); controller.abort();
  mount({ container, signal: controller.signal }); await vi.dynamicImportSettled(); expect(implementation.mount).not.toHaveBeenCalled();
});
it('mounts once for a live visit and cleans its implementation', async () => {
  implementation.mount.mockClear();
  const container = document.createElement('div'), controller = new AbortController();
  const cleanup = mount({ container, signal: controller.signal });
  await vi.dynamicImportSettled(); expect(implementation.mount).toHaveBeenCalledTimes(1);
  controller.abort(); if (typeof cleanup === 'function') cleanup();
  expect(implementation.mount.mock.results[0].value).toHaveBeenCalledTimes(1);
});
it('shows a useful loading failure instead of leaving a blank workspace', async () => {
  implementation.mount.mockImplementationOnce(() => { throw new Error('Failed to load'); });
  const container = document.createElement('div'), controller = new AbortController();
  const cleanup = mount({ container, signal: controller.signal });
  await vi.dynamicImportSettled();
  expect(container.querySelector('[role="alert"]')?.textContent).toContain('Reset the workspace');
  if (typeof cleanup === 'function') cleanup();
  expect(container.children.length).toBe(0);
});
