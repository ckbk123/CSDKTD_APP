import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from './workspace';
const view = vi.hoisted(() => ({ mount: vi.fn(), cleanup: vi.fn() }));
vi.mock('./view', () => ({ mount: view.mount }));
beforeEach(() => { view.mount.mockReset().mockReturnValue(view.cleanup); });
afterEach(() => { vi.clearAllMocks(); document.body.replaceChildren(); });
describe('DD01 deferred view lifecycle', () => {
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
  it('aborts partial view resources immediately on failure without aborting its parent', async () => {
    const container = document.createElement('div'), parent = new AbortController(), listener = vi.fn();
    let childSignal: AbortSignal | undefined;
    view.mount.mockImplementationOnce(({ container: host, signal }: { container: HTMLElement; signal: AbortSignal }) => {
      childSignal = signal;
      document.addEventListener('dd01-partial-resource', listener, { signal });
      host.append(document.createElement('section'));
      throw new Error('Failure after resource allocation');
    });
    const cleanup = mount({ container, signal: parent.signal });
    await vi.dynamicImportSettled();
    expect(parent.signal.aborted).toBe(false);
    expect(childSignal).not.toBe(parent.signal);
    expect(childSignal?.aborted).toBe(true);
    document.dispatchEvent(new Event('dd01-partial-resource'));
    expect(listener).not.toHaveBeenCalled();
    expect(container.querySelector('section')).toBeNull();
    expect(container.textContent).toContain('Reset the tool to try again');
    expect(view.cleanup).not.toHaveBeenCalled();
    if (typeof cleanup === 'function') cleanup();
    expect(container.childElementCount).toBe(0);
  });
  it('disposes signal-owned resources without requiring a parent abort and releases only once', async () => {
    const container = document.createElement('div'), parent = new AbortController(), listener = vi.fn();
    let childSignal: AbortSignal | undefined;
    view.mount.mockImplementationOnce(({ signal }: { signal: AbortSignal }) => {
      childSignal = signal;
      document.addEventListener('dd01-loaded-resource', listener, { signal });
      return view.cleanup;
    });
    const cleanup = mount({ container, signal: parent.signal });
    await vi.dynamicImportSettled();
    document.dispatchEvent(new Event('dd01-loaded-resource'));
    expect(listener).toHaveBeenCalledOnce();
    if (typeof cleanup === 'function') { cleanup(); cleanup(); }
    expect(parent.signal.aborted).toBe(false);
    expect(childSignal?.aborted).toBe(true);
    document.dispatchEvent(new Event('dd01-loaded-resource'));
    expect(listener).toHaveBeenCalledOnce();
    expect(view.cleanup).toHaveBeenCalledOnce();
    parent.abort();
    expect(view.cleanup).toHaveBeenCalledOnce();
    expect(container.childElementCount).toBe(0);
  });
});

