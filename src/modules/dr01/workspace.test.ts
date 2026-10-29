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
