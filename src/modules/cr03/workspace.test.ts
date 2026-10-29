import { beforeEach, expect, it, vi } from 'vitest';
import { mount } from './workspace';
const view = vi.hoisted(() => ({ mount: vi.fn(() => vi.fn()) })); vi.mock('./view', () => view);
beforeEach(() => view.mount.mockReset().mockImplementation(() => vi.fn()));
it('releases an active view cleanup immediately on parent abort exactly once',async()=>{
  const parent=new AbortController(),container=document.createElement('div'),released=vi.fn(),fired=vi.fn();
  view.mount.mockImplementationOnce((...args:unknown[])=>{const signal=(args[0] as {signal:AbortSignal}).signal;document.addEventListener('cr03-parent',fired,{signal});return released;});
  const cleanup=mount({container,signal:parent.signal});await vi.dynamicImportSettled();parent.abort();document.dispatchEvent(new Event('cr03-parent'));cleanup?.();
  expect(released).toHaveBeenCalledTimes(1);expect(fired).not.toHaveBeenCalled();expect(container.children).toHaveLength(0);
});
it('releases a disposer returned after reentrant abort exactly once',async()=>{
  const parent=new AbortController(),container=document.createElement('div'),released=vi.fn();
  view.mount.mockImplementationOnce((...args:unknown[])=>{parent.abort();expect((args[0] as {signal:AbortSignal}).signal.aborted).toBe(true);return released;});
  const cleanup=mount({container,signal:parent.signal});await vi.dynamicImportSettled();cleanup?.();cleanup?.();expect(released).toHaveBeenCalledTimes(1);expect(container.children).toHaveLength(0);
});
it('does not mount after standalone pending disposal while the parent is active',async()=>{
  const parent=new AbortController(),container=document.createElement('div'),cleanup=mount({container,signal:parent.signal});cleanup?.();await vi.dynamicImportSettled();expect(parent.signal.aborted).toBe(false);expect(view.mount).not.toHaveBeenCalled();expect(container.children).toHaveLength(0);
});
it('ignores a view import that arrives after navigation', async () => {
  const controller = new AbortController(), container = document.createElement('div'), cleanup = mount({ container, signal: controller.signal }); controller.abort(); cleanup?.(); await vi.dynamicImportSettled(); expect(view.mount).not.toHaveBeenCalled(); expect(container.children.length).toBe(0);
});
it('reattaches visible recovery after an active view mount failure', async () => {
  const controller = new AbortController(), container = document.createElement('div'); let viewSignal: AbortSignal | undefined;
  const released=vi.fn(),listener=vi.fn();
  view.mount.mockImplementationOnce((...args: unknown[]) => { const context=args[0] as {container:HTMLElement;signal:AbortSignal};viewSignal=context.signal; viewSignal.addEventListener('abort',released,{once:true}); window.addEventListener('cr03-failed-resource',listener,{signal:viewSignal}); context.container.append(document.createElement('section')); throw new Error('failed'); });
  const cleanup = mount({ container, signal: controller.signal }); await vi.dynamicImportSettled(); expect(container.children.length).toBe(1); expect(container.querySelector('[role="alert"]')?.textContent).toContain('Reset'); expect(viewSignal?.aborted).toBe(true); expect(controller.signal.aborted).toBe(false); controller.abort(); cleanup?.();
  window.dispatchEvent(new Event('cr03-failed-resource'));expect(released).toHaveBeenCalledOnce();expect(listener).not.toHaveBeenCalled();
});
it('removes its loading node on parent abort without waiting for disposal', async () => {
  const controller=new AbortController(),container=document.createElement('div'),cleanup=mount({container,signal:controller.signal});
  expect(container.textContent).toContain('Loading realization');controller.abort();expect(container.children.length).toBe(0);await vi.dynamicImportSettled();expect(view.mount).not.toHaveBeenCalled();cleanup?.();
});
it('releases an active view on disposal while keeping the parent usable', async () => {
  const controller=new AbortController(),container=document.createElement('div'),released=vi.fn(),viewCleanup=vi.fn();
  view.mount.mockImplementationOnce((...args:unknown[])=>{(args[0] as {signal:AbortSignal}).signal.addEventListener('abort',released,{once:true});return viewCleanup;});
  const cleanup=mount({container,signal:controller.signal});await vi.dynamicImportSettled();cleanup?.();cleanup?.();expect(released).toHaveBeenCalledOnce();expect(viewCleanup).toHaveBeenCalledOnce();expect(controller.signal.aborted).toBe(false);controller.abort();expect(viewCleanup).toHaveBeenCalledOnce();expect(container.children.length).toBe(0);
});
it('does not initialize an already aborted visit', async () => {
  const controller=new AbortController(),container=document.createElement('div');controller.abort();mount({container,signal:controller.signal});await vi.dynamicImportSettled();expect(view.mount).not.toHaveBeenCalled();expect(container.children.length).toBe(0);
});
it('does not attach a late failure after abort', async () => {
  const controller = new AbortController(), container = document.createElement('div'); view.mount.mockImplementationOnce(() => { controller.abort(); container.replaceChildren(); throw new Error('late'); });
  const cleanup = mount({ container, signal: controller.signal }); await vi.dynamicImportSettled(); expect(container.children.length).toBe(0); cleanup?.();
});
