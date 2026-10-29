import { expect, it, vi } from 'vitest';
import { mount } from './workspace';

vi.mock('./view', () => { throw new Error('View import failed'); });

it('keeps an active import failure visible and recoverable', async () => {
  const controller = new AbortController(), container = document.createElement('div');
  document.body.append(container);
  const cleanup = mount({ container, signal: controller.signal });
  await vi.dynamicImportSettled();
  expect(container.children.length).toBe(1);
  expect(container.querySelector('[role="alert"]')?.isConnected).toBe(true);
  expect(container.textContent).toContain('Reset the workspace to try again.');
  controller.abort(); cleanup?.(); container.remove();
});

it('does not attach an import failure after navigation', async () => {
  const controller = new AbortController(), container = document.createElement('div');
  const cleanup = mount({ container, signal: controller.signal });
  controller.abort(); cleanup?.();
  await vi.dynamicImportSettled();
  expect(container.children.length).toBe(0);
});
