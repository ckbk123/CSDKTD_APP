import { afterEach, describe, expect, it, vi } from 'vitest';
import { mount } from './workspace';
import type { ModuleContext } from '../../core/module';

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
    const context = view.mount.mock.calls[0][0] as ModuleContext;
    expect(container.contains(context.container)).toBe(true);
    expect(context.signal.aborted).toBe(false);
    controller.abort(); if (dispose) { dispose(); dispose(); }
    expect(view.release).toHaveBeenCalledOnce();
    expect(context.signal.aborted).toBe(true);
    expect(container.childElementCount).toBe(0);
  });
  it('keeps recoverable feedback attached and aborts partial work if the view throws', async () => {
    const container = document.createElement('div'), controller = new AbortController(), aborted = vi.fn();
    view.mount.mockImplementationOnce(({ container: host, signal }: ModuleContext) => {
      host.append(document.createTextNode('partial exercise'));
      signal.addEventListener('abort', aborted, { once: true });
      throw new Error('Synthetic view failure');
    });
    const dispose = mount({ container, signal: controller.signal });
    await vi.waitFor(() => expect(container.textContent).toContain('Reset the tool to try again'));
    expect(container.textContent).not.toContain('partial exercise');
    expect(aborted).toHaveBeenCalledOnce();
    controller.abort(); dispose?.();
    expect(container.childElementCount).toBe(0);
  });
  it('does not start an already-aborted visit', () => {
    const container = document.createElement('div'), controller = new AbortController(); controller.abort();
    expect(mount({ container, signal: controller.signal })).toBeUndefined();
    expect(container.childElementCount).toBe(0);
  });
});


describe('DR01 integration disposal ownership', () => {
  it('releases resources on standalone cleanup and permits reentrant cleanup only once', async () => {
    const container = document.createElement('div'), parent = new AbortController(), listener = vi.fn();
    let dispose: ReturnType<typeof mount>, child: AbortSignal | undefined;
    const release = vi.fn(() => dispose?.());
    view.mount.mockImplementationOnce(({ signal }: ModuleContext) => { child = signal; document.addEventListener('dr01-owned', listener, { signal }); return release; });
    dispose = mount({ container, signal: parent.signal }); await vi.dynamicImportSettled();
    document.dispatchEvent(new Event('dr01-owned')); expect(listener).toHaveBeenCalledOnce();
    dispose?.(); dispose?.(); expect(parent.signal.aborted).toBe(false); expect(child?.aborted).toBe(true);
    document.dispatchEvent(new Event('dr01-owned')); expect(listener).toHaveBeenCalledOnce(); parent.abort(); expect(release).toHaveBeenCalledOnce();
  });
  it('immediately releases a disposer returned after abort during mounting', async () => {
    const container = document.createElement('div'), parent = new AbortController(), release = vi.fn();
    view.mount.mockImplementationOnce(() => { parent.abort(); return release; });
    const dispose = mount({ container, signal: parent.signal }); await vi.dynamicImportSettled(); dispose?.(); dispose?.();
    expect(release).toHaveBeenCalledOnce(); expect(container.childElementCount).toBe(0);
  });
  it('aborts a signal-owned listener allocated before a view throws', async () => {
    const container = document.createElement('div'), parent = new AbortController(), listener = vi.fn();
    view.mount.mockImplementationOnce(({ signal }: ModuleContext) => { document.addEventListener('dr01-partial', listener, { signal }); throw new Error('partial'); });
    const dispose = mount({ container, signal: parent.signal }); await vi.dynamicImportSettled();
    document.dispatchEvent(new Event('dr01-partial')); expect(listener).not.toHaveBeenCalled(); expect(parent.signal.aborted).toBe(false);
    expect(container.textContent).toContain('Reset the tool'); dispose?.();
  });
});
