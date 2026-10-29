import { beforeEach, describe, expect, it, vi } from 'vitest';
const stub = vi.hoisted(() => ({ mountView: vi.fn(), cleanup: vi.fn() }));
vi.mock('./view', () => ({ mountView: stub.mountView }));
import { mount } from './workspace';
beforeEach(() => { stub.mountView.mockReset(); stub.cleanup.mockReset(); stub.mountView.mockReturnValue(stub.cleanup); });
describe('CR01 guarded lazy workspace', () => {
  it('owns immediate loading DOM and disposes successful view exactly once', async () => {
    const container = document.createElement('div'), controller = new AbortController(), cleanup = mount({ container, signal: controller.signal });
    expect(container.textContent).toContain('Loading polynomial');
    await vi.waitFor(() => expect(stub.mountView).toHaveBeenCalledOnce()); expect(container.textContent).not.toContain('Loading polynomial');
    controller.abort(); if (typeof cleanup === 'function') cleanup(); expect(stub.cleanup).toHaveBeenCalledOnce(); expect(container.children.length).toBe(0);
  });
  it('ignores late import completion after navigation abort', async () => {
    const container = document.createElement('div'), controller = new AbortController(), cleanup = mount({ container, signal: controller.signal });
    controller.abort(); if (typeof cleanup === 'function') cleanup(); await new Promise(resolve => setTimeout(resolve, 0));
    expect(stub.mountView).not.toHaveBeenCalled(); expect(container.children.length).toBe(0);
  });
  it('aborts partial view resources before displaying attached recovery', async () => {
    const event = new EventTarget(), listener = vi.fn(); let childSignal: AbortSignal | undefined;
    stub.mountView.mockImplementationOnce(({ signal }: { signal: AbortSignal }) => { childSignal = signal; event.addEventListener('test', listener, { signal }); throw new Error('Partial mount'); });
    const container = document.createElement('div'), controller = new AbortController(), cleanup = mount({ container, signal: controller.signal });
    await vi.waitFor(() => expect(container.textContent).toContain('could not open')); expect(controller.signal.aborted).toBe(false); expect(childSignal!.aborted).toBe(true);
    event.dispatchEvent(new Event('test')); expect(listener).not.toHaveBeenCalled(); expect(container.querySelector('[role="alert"]')).not.toBeNull();
    controller.abort(); if (typeof cleanup === 'function') cleanup(); expect(container.children.length).toBe(0);
  });
});
