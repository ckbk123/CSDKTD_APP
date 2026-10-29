import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from './workspace';

const view = vi.hoisted(() => ({ mount: vi.fn(), cleanup: vi.fn() }));
vi.mock('./view', () => ({ mount: view.mount }));
beforeEach(() => { view.mount.mockReset().mockReturnValue(view.cleanup); });

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
  it('aborts resources allocated before a mount failure without aborting the parent', async () => {
    const container = document.createElement('div'), parent = new AbortController(), listener = vi.fn();
    let childSignal: AbortSignal | undefined;
    view.mount.mockImplementationOnce(({ container: host, signal }: { container: HTMLElement; signal: AbortSignal }) => {
      childSignal = signal; document.addEventListener('dp02-partial-resource', listener, { signal });
      host.append(document.createElement('section')); throw new Error('Failure after resource allocation');
    });
    const cleanup = mount({ container, signal: parent.signal }); await vi.dynamicImportSettled();
    expect(parent.signal.aborted).toBe(false); expect(childSignal).not.toBe(parent.signal); expect(childSignal?.aborted).toBe(true);
    document.dispatchEvent(new Event('dp02-partial-resource')); expect(listener).not.toHaveBeenCalled();
    expect(container.querySelector('section')).toBeNull(); expect(container.textContent).toContain('Reset the tool to try again');
    expect(view.cleanup).not.toHaveBeenCalled();
    if (typeof cleanup === 'function') { cleanup(); cleanup(); }
    expect(container.childElementCount).toBe(0); parent.abort();
  });
  it('aborts standalone signal resources and releases the loaded view only once', async () => {
    const container = document.createElement('div'), parent = new AbortController(), listener = vi.fn();
    let childSignal: AbortSignal | undefined;
    view.mount.mockImplementationOnce(({ signal }: { signal: AbortSignal }) => {
      childSignal = signal; document.addEventListener('dp02-loaded-resource', listener, { signal }); return view.cleanup;
    });
    const cleanup = mount({ container, signal: parent.signal }); await vi.dynamicImportSettled();
    document.dispatchEvent(new Event('dp02-loaded-resource')); expect(listener).toHaveBeenCalledOnce();
    if (typeof cleanup === 'function') { cleanup(); cleanup(); }
    expect(parent.signal.aborted).toBe(false); expect(childSignal?.aborted).toBe(true);
    document.dispatchEvent(new Event('dp02-loaded-resource')); expect(listener).toHaveBeenCalledOnce();
    parent.abort(); expect(view.cleanup).toHaveBeenCalledOnce(); expect(container.childElementCount).toBe(0);
  });
  it('releases a disposer returned after parent abort during mounting exactly once', async () => {
    const container = document.createElement('div'), parent = new AbortController(); let childSignal: AbortSignal | undefined;
    view.mount.mockImplementationOnce(({ signal }: { signal: AbortSignal }) => { childSignal = signal; parent.abort(); return view.cleanup; });
    const cleanup = mount({ container, signal: parent.signal }); await vi.dynamicImportSettled();
    expect(childSignal?.aborted).toBe(true); expect(view.cleanup).toHaveBeenCalledOnce();
    if (typeof cleanup === 'function') { cleanup(); cleanup(); }
    expect(view.cleanup).toHaveBeenCalledOnce(); expect(container.childElementCount).toBe(0);
  });
});
