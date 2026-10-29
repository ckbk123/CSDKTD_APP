import { beforeEach, expect, it, vi } from 'vitest';
import type { ModuleMount } from '../../core/module';
import { mount } from './workspace';
const view=vi.hoisted(()=>({mount:vi.fn<ModuleMount>(()=>vi.fn())}));vi.mock('./view',()=>view);
beforeEach(()=>view.mount.mockReset().mockImplementation(()=>vi.fn()));
it('suppresses a view import that arrives after navigation',async()=>{
  const controller=new AbortController(),container=document.createElement('div'),cleanup=mount({container,signal:controller.signal});controller.abort();cleanup?.();await vi.dynamicImportSettled();expect(view.mount).not.toHaveBeenCalled();expect(container.children.length).toBe(0);
});
it('attaches recovery feedback after a failed view mount',async()=>{
  const controller=new AbortController(),container=document.createElement('div');view.mount.mockImplementationOnce(context=>{context.container.append(document.createElement('section'));throw new Error('mount failed');});
  const cleanup=mount({container,signal:controller.signal});await vi.dynamicImportSettled();expect(container.children.length).toBe(1);expect(container.querySelector('[role="alert"]')?.textContent).toContain('Reset');controller.abort();cleanup?.();
});
it('does not attach a late failure after abort',async()=>{
  const controller=new AbortController(),container=document.createElement('div');view.mount.mockImplementationOnce(()=>{controller.abort();container.replaceChildren();throw new Error('aborted');});
  const cleanup=mount({container,signal:controller.signal});await vi.dynamicImportSettled();expect(container.children.length).toBe(0);cleanup?.();
});

it('aborts resources allocated before a failed mount while keeping recovery visible',async()=>{
  const controller=new AbortController(),container=document.createElement('div'),listener=vi.fn();let child:AbortSignal|undefined;
  view.mount.mockImplementationOnce(context=>{child=context.signal;window.addEventListener('cr02-resource',listener,{signal:context.signal});throw new Error('partial mount');});
  const cleanup=mount({container,signal:controller.signal});await vi.dynamicImportSettled();
  window.dispatchEvent(new Event('cr02-resource'));expect(listener).not.toHaveBeenCalled();expect(child?.aborted).toBe(true);expect(controller.signal.aborted).toBe(false);
  expect(container.querySelector('[role="alert"]')?.textContent).toContain('Reset');cleanup?.();expect(container.children.length).toBe(0);
});
it('standalone disposal releases child listeners and view exactly once',async()=>{
  const controller=new AbortController(),container=document.createElement('div'),listener=vi.fn(),release=vi.fn();
  view.mount.mockImplementationOnce(context=>{window.addEventListener('cr02-resource',listener,{signal:context.signal});return release;});
  const cleanup=mount({container,signal:controller.signal});await vi.dynamicImportSettled();window.dispatchEvent(new Event('cr02-resource'));expect(listener).toHaveBeenCalledOnce();
  cleanup?.();cleanup?.();window.dispatchEvent(new Event('cr02-resource'));expect(listener).toHaveBeenCalledOnce();expect(release).toHaveBeenCalledOnce();expect(controller.signal.aborted).toBe(false);expect(container.children.length).toBe(0);
  controller.abort();expect(release).toHaveBeenCalledOnce();
});
it('releases a disposer returned after reentrant parent abort',async()=>{
  const controller=new AbortController(),container=document.createElement('div'),release=vi.fn();
  view.mount.mockImplementationOnce(()=>{controller.abort();return release;});const cleanup=mount({container,signal:controller.signal});await vi.dynamicImportSettled();
  expect(release).toHaveBeenCalledOnce();expect(container.children.length).toBe(0);cleanup?.();expect(release).toHaveBeenCalledOnce();
});
it('does not mount an already aborted visit and opens a fresh visit normally',async()=>{
  const controller=new AbortController(),container=document.createElement('div');controller.abort();mount({container,signal:controller.signal});await vi.dynamicImportSettled();expect(view.mount).not.toHaveBeenCalled();
  const fresh=new AbortController(),cleanup=mount({container,signal:fresh.signal});expect(container.textContent).toContain('Loading');await vi.dynamicImportSettled();expect(view.mount).toHaveBeenCalledOnce();expect(container.textContent).not.toContain('Loading');cleanup?.();
});
