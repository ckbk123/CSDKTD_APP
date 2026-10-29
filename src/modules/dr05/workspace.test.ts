import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ModuleContext } from '../../core/module';
const stub = vi.hoisted(() => ({ mount: vi.fn(), cleanup: vi.fn() }));
vi.mock('./view', () => ({ mount: stub.mount }));
import { mount } from './workspace';

beforeEach(() => {
  stub.mount.mockReset(); stub.cleanup.mockReset(); stub.mount.mockReturnValue(stub.cleanup);
});

describe('DR05 synchronous lazy mount', () => {
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
  it('immediately aborts partial mount resources and keeps unrelated container children', async () => {
    const target = new EventTarget(), listener = vi.fn(), release = vi.fn();
    let partialSignal: AbortSignal | undefined;
    stub.mount.mockImplementationOnce(({ container, signal }: ModuleContext) => {
      partialSignal = signal;
      container.append(document.createElement('button'));
      target.addEventListener('probe', listener, { signal });
      signal.addEventListener('abort', release, { once: true });
      throw new Error('Failed after allocating resources');
    });
    const container = document.createElement('div'), unrelated = document.createElement('aside');
    unrelated.textContent = 'Unrelated'; container.append(unrelated);
    const controller = new AbortController(), cleanup = mount({ container, signal: controller.signal });
    await vi.waitFor(() => expect(container.textContent).toContain('Reset the tool to try again'));
    expect(partialSignal).not.toBe(controller.signal); expect(partialSignal!.aborted).toBe(true);
    expect(controller.signal.aborted).toBe(false); expect(release).toHaveBeenCalledOnce();
    target.dispatchEvent(new Event('probe')); expect(listener).not.toHaveBeenCalled();
    expect(container.querySelector('button')).toBeNull(); expect(unrelated.parentElement).toBe(container);
    if (typeof cleanup === 'function') { cleanup(); cleanup(); }
    expect(container.children).toHaveLength(1); expect(container.firstChild).toBe(unrelated);
    expect(stub.cleanup).not.toHaveBeenCalled(); expect(release).toHaveBeenCalledOnce();
  });
  it('aborts the child on direct disposal and makes repeated cleanup harmless', async () => {
    const container = document.createElement('div'), controller = new AbortController();
    const cleanup = mount({ container, signal: controller.signal });
    await vi.waitFor(() => expect(stub.mount).toHaveBeenCalledOnce());
    const childSignal = stub.mount.mock.calls[0][0].signal as AbortSignal;
    if (typeof cleanup === 'function') { cleanup(); cleanup(); }
    expect(childSignal.aborted).toBe(true); expect(controller.signal.aborted).toBe(false);
    expect(stub.cleanup).toHaveBeenCalledOnce(); expect(container.children).toHaveLength(0);
    controller.abort(); expect(stub.cleanup).toHaveBeenCalledOnce();
  });
});


it('releases a late disposer returned after parent abort during mounting', async () => {
  const container = document.createElement('div'), parent = new AbortController(), release = vi.fn();
  stub.mount.mockImplementationOnce(() => { parent.abort(); return release; });
  const dispose = mount({ container, signal: parent.signal }); await vi.dynamicImportSettled(); dispose?.(); dispose?.();
  expect(release).toHaveBeenCalledOnce(); expect(container.childElementCount).toBe(0);
});
it('cleans a standalone listener and tolerates a reentrant returned disposer', async () => {
  const container = document.createElement('div'), parent = new AbortController(), listener = vi.fn();
  let dispose: ReturnType<typeof mount>, child: AbortSignal | undefined;
  const release = vi.fn(() => dispose?.());
  stub.mount.mockImplementationOnce(({ signal }: ModuleContext) => { child = signal; document.addEventListener('dr05-owned', listener, { signal }); return release; });
  dispose = mount({ container, signal: parent.signal }); await vi.dynamicImportSettled();
  document.dispatchEvent(new Event('dr05-owned')); expect(listener).toHaveBeenCalledOnce(); dispose?.(); dispose?.();
  expect(child?.aborted).toBe(true); expect(parent.signal.aborted).toBe(false);
  document.dispatchEvent(new Event('dr05-owned')); expect(listener).toHaveBeenCalledOnce(); parent.abort(); expect(release).toHaveBeenCalledOnce();
});
