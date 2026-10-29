import { expect, it, vi } from 'vitest';
import type { ModuleMount } from '../../core/module';
const view=vi.hoisted(()=>({mountView:vi.fn<ModuleMount>(()=>vi.fn())}));
vi.mock('./view',()=>view);
import { mount } from './workspace';
it('standalone disposal releases signal-owned resources and view exactly once',async()=>{
  const parent=new AbortController(),container=document.createElement('div'),listener=vi.fn(),release=vi.fn();
  view.mountView.mockImplementationOnce(({signal})=>{window.addEventListener('cs02-resource',listener,{signal});return release;});
  const cleanup=mount({container,signal:parent.signal});await vi.dynamicImportSettled();window.dispatchEvent(new Event('cs02-resource'));expect(listener).toHaveBeenCalledOnce();cleanup?.();cleanup?.();window.dispatchEvent(new Event('cs02-resource'));
  expect(listener).toHaveBeenCalledOnce();expect(release).toHaveBeenCalledOnce();expect(parent.signal.aborted).toBe(false);expect(container.children.length).toBe(0);parent.abort();expect(release).toHaveBeenCalledOnce();
});
