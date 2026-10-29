import { afterEach, describe, expect, it, vi } from 'vitest';
import { mount } from './workspace';

const view = vi.hoisted(() => ({ mount: vi.fn(), cleanup: vi.fn() }));
vi.mock('./view', () => ({ mount: view.mount }));

afterEach(() => { vi.clearAllMocks(); document.body.replaceChildren(); });

describe('DP02 deferred browser view lifecycle', () => {
  it('returns synchronously and cleans the loaded view exactly once', async () => {
    const container = document.createElement('div'); document.body.append(container);
    const controller = new AbortController();
    view.mount.mockReturnValue(view.cleanup);
    const cleanup = mount({ container, signal: controller.signal });
    expect(cleanup).toBeTypeOf('function');
    await vi.waitFor(() => expect(view.mount).toHaveBeenCalledOnce());
    expect(container.textContent).not.toContain('Loading');
    controller.abort(); if (typeof cleanup === 'function') cleanup();
    expect(view.cleanup).toHaveBeenCalledOnce();
  });
  it('ignores a view import that resolves after abort', async () => {
    const container = document.createElement('div'); document.body.append(container);
    const controller = new AbortController();
    mount({ container, signal: controller.signal }); controller.abort();
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(view.mount).not.toHaveBeenCalled();
    expect(container.childElementCount).toBe(0);
  });
  it('ignores late imports after explicit cleanup even without abort', async () => {
    const container = document.createElement('div');
    const cleanup = mount({ container, signal: new AbortController().signal });
    if (typeof cleanup === 'function') cleanup();
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(view.mount).not.toHaveBeenCalled();
    expect(container.childElementCount).toBe(0);
  });
  it('does not start an already-aborted visit', () => {
    const container = document.createElement('div'); const controller = new AbortController(); controller.abort();
    expect(mount({ container, signal: controller.signal })).toBeUndefined();
    expect(container.childElementCount).toBe(0);
  });
  it('shows recoverable feedback if the browser view cannot initialize', async () => {
    const container = document.createElement('div');
    view.mount.mockImplementationOnce(() => { throw new Error('Synthetic view failure'); });
    const cleanup = mount({ container, signal: new AbortController().signal });
    await vi.waitFor(() => expect(container.textContent).toContain('Reset the tool to try again'));
    if (typeof cleanup === 'function') cleanup();
  });
});
