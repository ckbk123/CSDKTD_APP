import type { ModuleContext } from '../../core/module';
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
    expect(view.mount).toHaveBeenCalledWith({ container, signal: expect.any(AbortSignal) });
    expect(view.mount.mock.calls[0][0].signal).not.toBe(controller.signal);
    if (cleanup) { cleanup(); cleanup(); }
    expect(view.cleanup).toHaveBeenCalledTimes(1);
  });
});

describe('DF01 integration disposal ownership', () => {
  it('releases resources on standalone cleanup and permits reentrant cleanup only once', async () => {
    const container = document.createElement('div'), parent = new AbortController(), listener = vi.fn();
    let dispose: ReturnType<typeof mount>, child: AbortSignal | undefined;
    const release = vi.fn(() => dispose?.());
    view.mount.mockImplementationOnce(({ signal }: ModuleContext) => { child = signal; document.addEventListener('df01-owned', listener, { signal }); return release; });
    dispose = mount({ container, signal: parent.signal }); await vi.dynamicImportSettled();
    document.dispatchEvent(new Event('df01-owned')); expect(listener).toHaveBeenCalledOnce();
    dispose?.(); dispose?.(); expect(parent.signal.aborted).toBe(false); expect(child?.aborted).toBe(true);
    document.dispatchEvent(new Event('df01-owned')); expect(listener).toHaveBeenCalledOnce(); parent.abort(); expect(release).toHaveBeenCalledOnce();
  });
  it('immediately releases a disposer returned after abort during mounting', async () => {
    const container = document.createElement('div'), parent = new AbortController(), release = vi.fn();
    view.mount.mockImplementationOnce(() => { parent.abort(); return release; });
    const dispose = mount({ container, signal: parent.signal }); await vi.dynamicImportSettled(); dispose?.(); dispose?.();
    expect(release).toHaveBeenCalledOnce(); expect(container.childElementCount).toBe(0);
  });
  it('aborts a signal-owned listener allocated before a view throws', async () => {
    const container = document.createElement('div'), parent = new AbortController(), listener = vi.fn();
    view.mount.mockImplementationOnce(({ signal }: ModuleContext) => { document.addEventListener('df01-partial', listener, { signal }); throw new Error('partial'); });
    const dispose = mount({ container, signal: parent.signal }); await vi.dynamicImportSettled();
    document.dispatchEvent(new Event('df01-partial')); expect(listener).not.toHaveBeenCalled(); expect(parent.signal.aborted).toBe(false);
    expect(container.textContent).toContain('Reset the tool'); dispose?.();
  });
});
