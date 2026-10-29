import { describe, expect, it, vi } from 'vitest';
import type { ModuleMount } from '../../core/module';
const mock = vi.hoisted(() => ({ mount: vi.fn<ModuleMount>(() => vi.fn()) }));
vi.mock('./view', () => ({ mount: mock.mount }));
import { mount } from './workspace';
describe('DD06 deferred view ownership', () => {
  it('adds synchronous loading content and cleans the successful view once', async () => {
    mock.mount.mockClear(); const controller = new AbortController(), container = document.createElement('section');
    const dispose = mount({ container, signal: controller.signal }); expect(container.textContent).toContain('Loading the state-feedback');
    await vi.waitFor(() => expect(mock.mount).toHaveBeenCalledTimes(1)); expect(container.textContent).not.toContain('Loading');
    if (typeof dispose === 'function') { dispose(); dispose(); } controller.abort(); expect(mock.mount.mock.results.at(-1)?.value).toHaveBeenCalledTimes(1);
  });
  it('ignores a late import after navigation aborts the visit', async () => {
    mock.mount.mockClear(); const controller = new AbortController(), container = document.createElement('section'); const dispose = mount({ container, signal: controller.signal }); controller.abort();
    await new Promise(resolve => setTimeout(resolve, 0)); expect(mock.mount).not.toHaveBeenCalled(); expect(container.childElementCount).toBe(0); if (typeof dispose === 'function') dispose();
  });
  it('aborts partial-view resources before recovery while the parent remains active', async () => {
    let child: AbortSignal | undefined; const resource = vi.fn();
    mock.mount.mockImplementationOnce(({ container, signal }) => { child = signal; window.addEventListener('dd06-failed-view-probe', resource, { signal }); container.append(document.createElement('math-field')); throw new Error('failed after resource allocation'); });
    const controller = new AbortController(), container = document.createElement('section'), dispose = mount({ container, signal: controller.signal });
    await vi.waitFor(() => expect(container.querySelector('[role="alert"]')?.textContent).toContain('Reset the example'));
    expect(controller.signal.aborted).toBe(false); expect(child).not.toBe(controller.signal); expect(child?.aborted).toBe(true); expect(container.querySelector('math-field')).toBeNull();
    window.dispatchEvent(new Event('dd06-failed-view-probe')); expect(resource).not.toHaveBeenCalled(); controller.abort(); if (typeof dispose === 'function') dispose(); expect(container.childElementCount).toBe(0);
  });
  it('does nothing for an already aborted visit', () => {
    const controller = new AbortController(); controller.abort(); const container = document.createElement('section'); expect(mount({ container, signal: controller.signal })).toBeUndefined(); expect(container.childElementCount).toBe(0);
  });
});


it('releases a disposer returned after an abort during mounting only once',async()=>{
 const parent=new AbortController(),container=document.createElement('div'),release=vi.fn();mock.mount.mockImplementationOnce(()=>{parent.abort();return release;});
 const cleanup=mount({container,signal:parent.signal});await vi.dynamicImportSettled();cleanup?.();cleanup?.();expect(release).toHaveBeenCalledOnce();
});
