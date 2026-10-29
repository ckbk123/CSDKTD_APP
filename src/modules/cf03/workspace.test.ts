import { afterEach,describe,expect,it,vi } from 'vitest';
const view=vi.hoisted(()=>({mount:vi.fn(),cleanup:vi.fn()}));
vi.mock('./view',()=>({mount:view.mount}));
import { mount } from './workspace';
import type { ModuleMount } from '../../core/module';
afterEach(()=>{document.body.replaceChildren();view.mount.mockReset();view.cleanup.mockReset();});
describe('CF03 lazy-view lifecycle',()=>{
 it('does not start an already aborted visit',async()=>{
  const container=document.createElement('div'),parent=new AbortController();parent.abort();mount({container,signal:parent.signal});
  await vi.dynamicImportSettled();expect(view.mount).not.toHaveBeenCalled();expect(container.children).toHaveLength(0);
 });
 it('aborts resources allocated before a partial mount failure while parent remains active',async()=>{
  const container=document.createElement('div'),parent=new AbortController(),fired=vi.fn();let child!:AbortSignal;
  view.mount.mockImplementation(({container:host,signal}:Parameters<ModuleMount>[0])=>{child=signal;window.addEventListener('cf-partial',fired,{signal});host.append(document.createTextNode('Partial content'));throw new Error('partial');});
  const stop=mount({container,signal:parent.signal});await vi.dynamicImportSettled();window.dispatchEvent(new Event('cf-partial'));
  expect(parent.signal.aborted).toBe(false);expect(child.aborted).toBe(true);expect(fired).not.toHaveBeenCalled();
  expect(container.textContent).toContain('Reset the tool');expect(container.textContent).not.toContain('Partial content');if(stop)stop();
 });
 it('standalone disposal aborts listeners and releases its view once while parent is active',async()=>{
  const container=document.createElement('div'),parent=new AbortController(),fired=vi.fn();let child!:AbortSignal;
  view.mount.mockImplementation(({signal}:Parameters<ModuleMount>[0])=>{child=signal;window.addEventListener('cf-standalone',fired,{signal});return view.cleanup;});
  const stop=mount({container,signal:parent.signal});await vi.dynamicImportSettled();if(stop){stop();stop();}window.dispatchEvent(new Event('cf-standalone'));
  expect(parent.signal.aborted).toBe(false);expect(child.aborted).toBe(true);expect(fired).not.toHaveBeenCalled();parent.abort();expect(view.cleanup).toHaveBeenCalledOnce();expect(container.children).toHaveLength(0);
 });
 it('releases a cleanup returned after reentrant abort exactly once',async()=>{
  const container=document.createElement('div'),parent=new AbortController();view.mount.mockImplementation(({signal}:Parameters<ModuleMount>[0])=>{parent.abort();expect(signal.aborted).toBe(true);return view.cleanup;});
  const stop=mount({container,signal:parent.signal});await vi.dynamicImportSettled();if(stop)stop();expect(view.cleanup).toHaveBeenCalledOnce();expect(container.children).toHaveLength(0);
 });
 it('ignores a lazy import after standalone pending disposal',async()=>{
  const container=document.createElement('div'),parent=new AbortController();const stop=mount({container,signal:parent.signal});if(stop)stop();
  await vi.dynamicImportSettled();expect(parent.signal.aborted).toBe(false);expect(view.mount).not.toHaveBeenCalled();expect(container.children).toHaveLength(0);
 });
 it('cannot mount late after navigation abort',async()=>{
  const container=document.createElement('div'),controller=new AbortController();const cleanup=mount({container,signal:controller.signal});controller.abort();if(cleanup)cleanup();
  await vi.dynamicImportSettled();expect(view.mount).not.toHaveBeenCalled();expect(container.textContent).toBe('');
 });
 it('cleans a completed mount once and preserves useful failure feedback',async()=>{
  const container=document.createElement('div'),controller=new AbortController();view.mount.mockReturnValue(view.cleanup);const cleanup=mount({container,signal:controller.signal});
  await vi.dynamicImportSettled();expect(view.mount).toHaveBeenCalledOnce();if(cleanup){cleanup();cleanup();}expect(view.cleanup).toHaveBeenCalledOnce();
  view.mount.mockImplementation(()=>{throw new Error('fixture view failure');});const other=document.createElement('div');const stop=mount({container:other,signal:new AbortController().signal});
  await vi.dynamicImportSettled();expect(other.textContent).toContain('Reset the tool to retry');if(stop)stop();
 });
});
