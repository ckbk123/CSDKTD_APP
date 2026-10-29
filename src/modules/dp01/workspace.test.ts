import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const stub = vi.hoisted(() => ({ mount: vi.fn(), cleanup: vi.fn() }));
vi.mock('./view', () => ({ mount: stub.mount }));
import { mount } from './workspace';

beforeEach(() => {
  stub.mount.mockReset(); stub.cleanup.mockReset(); stub.mount.mockReturnValue(stub.cleanup);
});
const visits: (() => void)[] = [];
afterEach(() => { visits.splice(0).forEach(cleanup => cleanup()); });
function visit(aborted = false) {
  const container = document.createElement('div'), parent = new AbortController();
  if (aborted) parent.abort();
  const cleanup = mount({ container, signal: parent.signal });
  visits.push(() => { parent.abort(); if (typeof cleanup === 'function') cleanup(); });
  return { container, parent, cleanup };
}

describe('DP01 synchronous lazy mount', () => {
  it('loads the view and runs its returned cleanup', async () => {
    const container = document.createElement('div'); const controller = new AbortController();
    const cleanup = mount({ container, signal: controller.signal });
    expect(typeof cleanup).toBe('function');
    await vi.waitFor(() => expect(stub.mount).toHaveBeenCalledOnce());
    controller.abort(); if (typeof cleanup === 'function') cleanup();
    expect(stub.cleanup).toHaveBeenCalledOnce();
    expect(container.textContent).toBe('');
  });
  it('never mounts a view if navigation aborts before the import resolves', async () => {
    const container = document.createElement('div'); const controller = new AbortController();
    const cleanup = mount({ container, signal: controller.signal });
    controller.abort(); if (typeof cleanup === 'function') cleanup();
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(stub.mount).not.toHaveBeenCalled();
    expect(container.textContent).toBe('');
  });
  it('reattaches a recovery message when the view throws after loading was removed', async () => {
    stub.mount.mockImplementationOnce(() => { throw new Error('View failed'); });
    const container = document.createElement('div'); const controller = new AbortController();
    const cleanup = mount({ container, signal: controller.signal });
    await vi.waitFor(() => expect(container.textContent).toContain('Reset the tool to try again'));
    controller.abort(); if (typeof cleanup === 'function') cleanup();
    expect(container.textContent).toBe(''); expect(stub.cleanup).not.toHaveBeenCalled();
  });
  it('does not start an already-aborted visit', async () => {
    const current = visit(true);
    expect(current.cleanup).toBeUndefined(); expect(current.container.childElementCount).toBe(0);
    await vi.dynamicImportSettled(); expect(stub.mount).not.toHaveBeenCalled();
  });
  it('aborts partially allocated resources before showing failure feedback', async () => {
    const listener = vi.fn(); let childSignal: AbortSignal | undefined;
    stub.mount.mockImplementationOnce(({ container, signal }: { container: HTMLElement; signal: AbortSignal }) => {
      childSignal = signal;
      document.addEventListener('dp01-partial-resource', listener, { signal });
      container.append(document.createElement('section'));
      throw new Error('Failure after allocating a resource');
    });
    const current = visit(); await vi.dynamicImportSettled();
    expect(current.parent.signal.aborted).toBe(false); expect(childSignal).not.toBe(current.parent.signal);
    expect(childSignal?.aborted).toBe(true);
    document.dispatchEvent(new Event('dp01-partial-resource')); expect(listener).not.toHaveBeenCalled();
    expect(current.container.querySelector('section')).toBeNull();
    expect(current.container.textContent).toContain('Reset the tool to try again');
    expect(stub.cleanup).not.toHaveBeenCalled();
    if (typeof current.cleanup === 'function') current.cleanup();
    expect(current.container.childElementCount).toBe(0);
  });
  it('releases signal-owned listeners on standalone cleanup and disposes only once', async () => {
    const listener = vi.fn(); let childSignal: AbortSignal | undefined;
    stub.mount.mockImplementationOnce(({ signal }: { signal: AbortSignal }) => {
      childSignal = signal;
      document.addEventListener('dp01-loaded-resource', listener, { signal });
      return stub.cleanup;
    });
    const current = visit();
    expect(current.container.textContent).toContain('Loading sequence controls');
    await vi.dynamicImportSettled();
    document.dispatchEvent(new Event('dp01-loaded-resource')); expect(listener).toHaveBeenCalledOnce();
    if (typeof current.cleanup === 'function') { current.cleanup(); current.cleanup(); }
    expect(current.parent.signal.aborted).toBe(false); expect(childSignal?.aborted).toBe(true);
    document.dispatchEvent(new Event('dp01-loaded-resource')); expect(listener).toHaveBeenCalledOnce();
    expect(stub.cleanup).toHaveBeenCalledOnce();
    current.parent.abort(); expect(stub.cleanup).toHaveBeenCalledOnce();
    expect(current.container.childElementCount).toBe(0);
  });
  it('releases a disposer returned after the parent aborts during mounting', async () => {
    const parent = new AbortController(), container = document.createElement('div');
    let childSignal: AbortSignal | undefined;
    stub.mount.mockImplementationOnce(({ signal }: { signal: AbortSignal }) => {
      childSignal = signal; parent.abort(); return stub.cleanup;
    });
    const cleanup = mount({ container, signal: parent.signal });
    await vi.dynamicImportSettled();
    expect(childSignal?.aborted).toBe(true); expect(stub.cleanup).toHaveBeenCalledOnce();
    if (typeof cleanup === 'function') cleanup();
    expect(stub.cleanup).toHaveBeenCalledOnce(); expect(container.childElementCount).toBe(0);
  });
  it('does not show late failure feedback after parent abort during mounting', async () => {
    const parent = new AbortController(), container = document.createElement('div');
    stub.mount.mockImplementationOnce(() => { parent.abort(); throw new Error('Aborted mount'); });
    const cleanup = mount({ container, signal: parent.signal });
    await vi.dynamicImportSettled(); expect(container.childElementCount).toBe(0);
    if (typeof cleanup === 'function') cleanup();
  });
});
