import { afterEach, describe, expect, it, vi } from 'vitest';
import { mount } from './workspace';
const view = vi.hoisted(() => ({ mount: vi.fn(), cleanup: vi.fn() }));
vi.mock('./view', () => ({ mount: view.mount }));
afterEach(() => { vi.clearAllMocks(); document.body.replaceChildren(); });
describe('DD04 deferred view lifecycle', () => {
  it('returns synchronously and cleans a loaded view once', async () => {
    const container = document.createElement('div'), controller = new AbortController(); view.mount.mockReturnValue(view.cleanup);
    const cleanup = mount({ container, signal: controller.signal }); expect(cleanup).toBeTypeOf('function');
    await vi.waitFor(() => expect(view.mount).toHaveBeenCalledOnce());
    controller.abort(); if (typeof cleanup === 'function') cleanup(); expect(view.cleanup).toHaveBeenCalledOnce();
  });
  it('never mounts a late view after abort', async () => {
    const container = document.createElement('div'), controller = new AbortController();
    mount({ container, signal: controller.signal }); controller.abort(); await new Promise(resolve => setTimeout(resolve, 0));
    expect(view.mount).not.toHaveBeenCalled(); expect(container.childElementCount).toBe(0);
  });
  it('does not start an already-aborted visit', () => {
    const container = document.createElement('div'), controller = new AbortController(); controller.abort();
    expect(mount({ container, signal: controller.signal })).toBeUndefined(); expect(container.childElementCount).toBe(0);
  });
  it('retains visible recovery feedback if view mounting fails', async () => {
    const container = document.createElement('div'); view.mount.mockImplementationOnce(() => { throw new Error('Synthetic failure'); });
    const cleanup = mount({ container, signal: new AbortController().signal });
    await vi.waitFor(() => expect(container.textContent).toContain('Reset the tool to try again'));
    if (typeof cleanup === 'function') cleanup();
  });
});
