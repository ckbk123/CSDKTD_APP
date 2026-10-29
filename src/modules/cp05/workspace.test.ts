import { beforeEach, describe, expect, it, vi } from 'vitest';
const stub = vi.hoisted(() => ({ mountView: vi.fn(), cleanup: vi.fn() }));
vi.mock('./view', () => ({ mountView: stub.mountView }));
import { mount } from './workspace';
beforeEach(() => { stub.mountView.mockReset(); stub.cleanup.mockReset(); stub.mountView.mockReturnValue(stub.cleanup); });
describe('CP05 guarded lazy workspace', () => {
  it('aborts standalone resources while parent stays active and releases cleanup once',async()=>{
    const parent=new AbortController(),container=document.createElement('div'),fired=vi.fn();let child!:AbortSignal;
    stub.mountView.mockImplementationOnce(({signal}:{signal:AbortSignal})=>{child=signal;document.addEventListener('cp05-owned',fired,{signal});return stub.cleanup;});
    const cleanup=mount({container,signal:parent.signal});await vi.dynamicImportSettled();if(typeof cleanup==='function'){cleanup();cleanup();}document.dispatchEvent(new Event('cp05-owned'));
    expect(parent.signal.aborted).toBe(false);expect(child.aborted).toBe(true);expect(fired).not.toHaveBeenCalled();parent.abort();expect(stub.cleanup).toHaveBeenCalledTimes(1);
  });
  it('does not mount a pending import after direct disposal',async()=>{
    const parent=new AbortController(),container=document.createElement('div'),cleanup=mount({container,signal:parent.signal});if(typeof cleanup==='function')cleanup();await vi.dynamicImportSettled();expect(stub.mountView).not.toHaveBeenCalled();expect(parent.signal.aborted).toBe(false);expect(container.children).toHaveLength(0);
  });
  it('never mounts an already aborted visit',async()=>{
    const parent=new AbortController(),container=document.createElement('div');parent.abort();mount({container,signal:parent.signal});await vi.dynamicImportSettled();expect(stub.mountView).not.toHaveBeenCalled();expect(container.children).toHaveLength(0);
  });
  it('owns immediate loading DOM and disposes successful view exactly once', async () => {
    const container = document.createElement('div'), controller = new AbortController(), cleanup = mount({ container, signal: controller.signal });
    expect(container.textContent).toContain('Loading Nyquist');
    await vi.waitFor(() => expect(stub.mountView).toHaveBeenCalledOnce()); expect(container.textContent).not.toContain('Loading Nyquist');
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
  it('runs a late disposer returned after abort during mount exactly once', async () => {
    const container = document.createElement('div'), controller = new AbortController();
    stub.mountView.mockImplementationOnce(() => { controller.abort(); return stub.cleanup; });
    const cleanup = mount({ container, signal: controller.signal }); await vi.waitFor(() => expect(stub.cleanup).toHaveBeenCalledOnce());
    if (typeof cleanup === 'function') cleanup(); expect(stub.cleanup).toHaveBeenCalledOnce(); expect(container.children.length).toBe(0);
  });
  it('removes its host even if a view disposer throws', async () => {
    const container = document.createElement('div'), controller = new AbortController();
    const cleanup = mount({ container, signal: controller.signal }); await vi.waitFor(() => expect(stub.mountView).toHaveBeenCalledOnce());
    stub.cleanup.mockImplementationOnce(() => { throw new Error('Cleanup failure'); });
    expect(() => { if (typeof cleanup === 'function') cleanup(); }).toThrow('Cleanup failure'); expect(container.children.length).toBe(0);
    if (typeof cleanup === 'function') cleanup(); expect(stub.cleanup).toHaveBeenCalledOnce();
  });
});
