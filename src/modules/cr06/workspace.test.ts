import { beforeEach, describe, expect, it, vi } from 'vitest';
const stub = vi.hoisted(() => ({ mount: vi.fn(), cleanup: vi.fn() }));
vi.mock('./view', () => ({ mount: stub.mount }));
import { mount } from './workspace';
beforeEach(() => { stub.mount.mockReset(); stub.cleanup.mockReset(); stub.mount.mockReturnValue(stub.cleanup); });
describe('CR06 synchronous lazy lifecycle', () => {
  it('loads the view and cleans it once', async () => {
    const container = document.createElement('div'), controller = new AbortController();
    const cleanup = mount({ container, signal: controller.signal }); expect(typeof cleanup).toBe('function');
    await vi.waitFor(() => expect(stub.mount).toHaveBeenCalledOnce());
    controller.abort(); if (typeof cleanup === 'function') cleanup(); expect(stub.cleanup).toHaveBeenCalledOnce(); expect(container.textContent).toBe('');
  });
  it('discards a view when navigation aborts before import resolution', async () => {
    const container = document.createElement('div'), controller = new AbortController();
    const cleanup = mount({ container, signal: controller.signal }); controller.abort(); if (typeof cleanup === 'function') cleanup();
    await new Promise(resolve => setTimeout(resolve, 0)); expect(stub.mount).not.toHaveBeenCalled(); expect(container.textContent).toBe('');
  });
  it('reattaches visible recovery after an active view failure', async () => {
    stub.mount.mockImplementationOnce(() => { throw new Error('fixture'); });
    const container = document.createElement('div'), controller = new AbortController(), cleanup = mount({ container, signal: controller.signal });
    await vi.waitFor(() => expect(container.textContent).toContain('Reset the example to try again'));
    controller.abort(); if (typeof cleanup === 'function') cleanup(); expect(container.textContent).toBe('');
  });
});
