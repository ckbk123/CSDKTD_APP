import { afterEach, describe, expect, it, vi } from 'vitest';
import { mount } from './workspace';

const view = vi.hoisted(() => ({ mount: vi.fn(), release: vi.fn() }));
vi.mock('./view', () => ({ mountView: view.mount }));
afterEach(() => { vi.clearAllMocks(); document.body.replaceChildren(); });

describe('DR01 delayed browser-view lifecycle', () => {
  it('ignores an aborted visit before its view import completes', async () => {
    const container = document.createElement('div'), controller = new AbortController();
    const dispose = mount({ container, signal: controller.signal });
    controller.abort(); if (dispose) dispose();
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(view.mount).not.toHaveBeenCalled(); expect(container.childElementCount).toBe(0);
  });
  it('mounts synchronously at the entry, then releases the loaded view exactly once', async () => {
    const container = document.createElement('div'), controller = new AbortController();
    view.mount.mockReturnValue(view.release);
    const dispose = mount({ container, signal: controller.signal });
    expect(dispose).toBeTypeOf('function');
    await vi.waitFor(() => expect(view.mount).toHaveBeenCalledOnce());
    expect(view.mount).toHaveBeenCalledWith({ container, signal: controller.signal });
    controller.abort(); if (dispose) { dispose(); dispose(); }
    expect(view.release).toHaveBeenCalledOnce();
  });
  it('does not start an already-aborted visit', () => {
    const container = document.createElement('div'), controller = new AbortController(); controller.abort();
    expect(mount({ container, signal: controller.signal })).toBeUndefined();
    expect(container.childElementCount).toBe(0);
  });
});
