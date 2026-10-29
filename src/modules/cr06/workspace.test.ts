import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ModuleContext } from '../../core/module';
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
  it('aborts allocated resources immediately if a partial view mount throws', async () => {
    const target = new EventTarget(), listener = vi.fn(), release = vi.fn();
    let partialSignal: AbortSignal | undefined;
    stub.mount.mockImplementationOnce(({ container, signal }: ModuleContext) => {
      partialSignal = signal; container.append(document.createElement('button'));
      target.addEventListener('probe', listener, { signal }); signal.addEventListener('abort', release, { once: true });
      throw new Error('Partial mount failure');
    });
    const container = document.createElement('div'), unrelated = document.createElement('aside'), controller = new AbortController();
    unrelated.textContent = 'Unrelated'; container.append(unrelated);
    const cleanup = mount({ container, signal: controller.signal });
    await vi.waitFor(() => expect(container.textContent).toContain('Reset the example to try again'));
    expect(partialSignal).not.toBe(controller.signal); expect(partialSignal!.aborted).toBe(true);
    expect(controller.signal.aborted).toBe(false); expect(release).toHaveBeenCalledOnce();
    target.dispatchEvent(new Event('probe')); expect(listener).not.toHaveBeenCalled();
    expect(container.querySelector('button')).toBeNull(); expect(unrelated.parentElement).toBe(container);
    if (typeof cleanup === 'function') { cleanup(); cleanup(); }
    expect(container.children).toHaveLength(1); expect(container.firstChild).toBe(unrelated); expect(release).toHaveBeenCalledOnce();
  });
  it('disposes the child and normal view exactly once without aborting the parent', async () => {
    const container = document.createElement('div'), controller = new AbortController(), cleanup = mount({ container, signal: controller.signal });
    await vi.waitFor(() => expect(stub.mount).toHaveBeenCalledOnce());
    const childSignal = stub.mount.mock.calls[0][0].signal as AbortSignal;
    if (typeof cleanup === 'function') { cleanup(); cleanup(); }
    expect(childSignal.aborted).toBe(true); expect(controller.signal.aborted).toBe(false);
    expect(stub.cleanup).toHaveBeenCalledOnce(); expect(container.children).toHaveLength(0);
    controller.abort(); expect(stub.cleanup).toHaveBeenCalledOnce();
  });
});
