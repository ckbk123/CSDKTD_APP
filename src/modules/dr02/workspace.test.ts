import { beforeEach, expect, it, vi } from 'vitest';
import { mount } from './workspace';

const view = vi.hoisted(() => ({ mount: vi.fn(() => vi.fn()) }));
vi.mock('./view', () => view);
beforeEach(() => view.mount.mockReset().mockImplementation(() => vi.fn()));
it('attaches recoverable feedback when view mounting throws after adding partial content', async () => {
  const controller = new AbortController(), container = document.createElement('div');
  const released = vi.fn(), leakedListener = vi.fn(); let viewSignal: AbortSignal | undefined;
  document.body.append(container);
  view.mount.mockImplementationOnce((...args: unknown[]) => {
    viewSignal = (args[0] as {signal:AbortSignal}).signal;
    viewSignal.addEventListener('abort', released, {once:true});
    window.addEventListener('dr02-failed-mount-resource', leakedListener, {signal:viewSignal});
    container.append(document.createElement('section'));
    throw new Error('View mount failed');
  });
  const cleanup = mount({ container, signal: controller.signal });
  await vi.dynamicImportSettled();
  expect(view.mount).toHaveBeenCalledOnce();
  expect(container.children.length).toBe(1);
  expect(container.querySelector('[role="alert"]')?.isConnected).toBe(true);
  expect(container.textContent).toContain('Reset the workspace to try again.');
  expect(viewSignal?.aborted).toBe(true); expect(controller.signal.aborted).toBe(false); expect(released).toHaveBeenCalledOnce();
  window.dispatchEvent(new Event('dr02-failed-mount-resource')); expect(leakedListener).not.toHaveBeenCalled();
  controller.abort(); cleanup?.(); container.remove();
});
it('disposal releases view resources even when the parent has not yet aborted', async () => {
  const controller=new AbortController(),container=document.createElement('div'), released=vi.fn(), viewCleanup=vi.fn();
  view.mount.mockImplementationOnce((...args:unknown[])=>{(args[0] as {signal:AbortSignal}).signal.addEventListener('abort',released,{once:true});return viewCleanup;});
  const cleanup=mount({container,signal:controller.signal}); expect(container.textContent).toContain('Loading difference-equation');
  await vi.dynamicImportSettled(); cleanup?.(); expect(released).toHaveBeenCalledOnce(); expect(viewCleanup).toHaveBeenCalledOnce(); expect(controller.signal.aborted).toBe(false); expect(container.children.length).toBe(0);
});
it('parent abort removes the loading node without waiting for explicit disposal', async () => {
  const controller=new AbortController(),container=document.createElement('div'),cleanup=mount({container,signal:controller.signal});
  expect(container.children.length).toBe(1); controller.abort(); expect(container.children.length).toBe(0); await vi.dynamicImportSettled();expect(view.mount).not.toHaveBeenCalled();cleanup?.();
});
it('does not initialize an already aborted visit', async () => {
  const controller=new AbortController(),container=document.createElement('div');controller.abort();mount({container,signal:controller.signal});await vi.dynamicImportSettled();expect(container.children.length).toBe(0);expect(view.mount).not.toHaveBeenCalled();
});
it('does not attach mount-failure feedback after the visit has been aborted', async () => {
  const controller = new AbortController(), container = document.createElement('div');
  view.mount.mockImplementationOnce(() => {
    controller.abort(); container.replaceChildren();
    throw new Error('View mount interrupted');
  });
  const cleanup = mount({ container, signal: controller.signal });
  await vi.dynamicImportSettled();
  expect(view.mount).toHaveBeenCalledOnce(); expect(container.children.length).toBe(0);
  cleanup?.();
});
it('does not mount an equation view that arrives after navigation/abort', async () => {
  const controller = new AbortController(), container = document.createElement('div');
  const cleanup = mount({ container, signal: controller.signal });
  controller.abort(); cleanup?.();
  await vi.dynamicImportSettled();
  expect(view.mount).not.toHaveBeenCalled(); expect(container.children.length).toBe(0);
});


it('cleans standalone signal listeners and handles a reentrant disposer exactly once', async () => {
  const container = document.createElement('div'), parent = new AbortController(), listener = vi.fn();
  let dispose: ReturnType<typeof mount>, child: AbortSignal | undefined;
  const release = vi.fn(() => dispose?.());
  view.mount.mockImplementationOnce((...args: unknown[]) => { child = (args[0] as { signal: AbortSignal }).signal; document.addEventListener('dr02-owned', listener, { signal: child }); return release; });
  dispose = mount({ container, signal: parent.signal }); await vi.dynamicImportSettled();
  document.dispatchEvent(new Event('dr02-owned')); expect(listener).toHaveBeenCalledOnce();
  dispose?.(); dispose?.(); expect(child?.aborted).toBe(true); expect(parent.signal.aborted).toBe(false);
  document.dispatchEvent(new Event('dr02-owned')); expect(listener).toHaveBeenCalledOnce(); parent.abort(); expect(release).toHaveBeenCalledOnce();
});
it('releases a disposer returned after parent abort during mounting', async () => {
  const container = document.createElement('div'), parent = new AbortController(), release = vi.fn();
  view.mount.mockImplementationOnce(() => { parent.abort(); return release; });
  const dispose = mount({ container, signal: parent.signal }); await vi.dynamicImportSettled(); dispose?.(); dispose?.();
  expect(release).toHaveBeenCalledOnce(); expect(container.childElementCount).toBe(0);
});
