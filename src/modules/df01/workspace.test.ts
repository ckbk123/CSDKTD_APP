import { afterEach, describe, expect, it, vi } from 'vitest';
const view = vi.hoisted(() => ({ mount: vi.fn(), cleanup: vi.fn() }));
vi.mock('./view', () => ({ mount: view.mount }));
import { mount } from './workspace';
afterEach(() => { document.body.replaceChildren(); vi.clearAllMocks(); });
describe('DF01 asynchronous view ownership', () => {
  it('never mounts a view that finishes loading after navigation abort', async () => {
    const container = document.createElement('div'), controller = new AbortController();
    document.body.append(container);
    const cleanup = mount({ container, signal: controller.signal });
    controller.abort(); if (cleanup) cleanup();
    await vi.dynamicImportSettled();
    expect(view.mount).not.toHaveBeenCalled();
    expect(container.textContent).toBe('');
  });
  it('mounts once and disposes once even when cleanup repeats', async () => {
    const container = document.createElement('div'), controller = new AbortController();
    view.mount.mockReturnValue(view.cleanup);
    const cleanup = mount({ container, signal: controller.signal });
    await vi.dynamicImportSettled();
    expect(view.mount).toHaveBeenCalledWith({ container, signal: controller.signal });
    if (cleanup) { cleanup(); cleanup(); }
    expect(view.cleanup).toHaveBeenCalledTimes(1);
  });
});
