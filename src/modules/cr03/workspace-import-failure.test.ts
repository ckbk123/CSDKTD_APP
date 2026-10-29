import { expect, it, vi } from 'vitest';
vi.mock('./view', () => { throw new Error('import failed'); });
import { mount } from './workspace';
it('shows recoverable feedback after a live import failure', async () => {
  const controller = new AbortController(), container = document.createElement('div'), cleanup = mount({ container, signal: controller.signal }); await vi.dynamicImportSettled();
  expect(container.querySelector('[role="alert"]')?.textContent).toContain('Reset'); controller.abort(); cleanup?.(); expect(container.children.length).toBe(0);
});
