import{describe,expect,it,vi}from'vitest';
import type{ModuleMount}from'../../core/module';
import{mountWithLoader}from'./workspace';
const flush=async()=>{await Promise.resolve();await Promise.resolve();await Promise.resolve();};
describe('tracking-error deferred public lifetime',()=>{
  it('shows synchronous loading and ignores a lazy view after disposal',async()=>{
    const container=document.createElement('div'),parent=new AbortController();let resolve!:(value:{mount:ModuleMount})=>void;const pending=new Promise<{mount:ModuleMount}>(r=>resolve=r),view=vi.fn(),release=mountWithLoader({container,signal:parent.signal},()=>pending);expect(container.textContent).toContain('Loading');release();resolve({mount:view});await flush();expect(view).not.toHaveBeenCalled();expect(container.children).toHaveLength(0);
  });
  it('aborts partially registered resources before recovery with parent still active',async()=>{
    const container=document.createElement('div'),parent=new AbortController(),probe=vi.fn();let child!:AbortSignal;
    const release=mountWithLoader({container,signal:parent.signal},async()=>({mount:({container:host,signal})=>{child=signal;window.addEventListener('cf02-load-probe',probe,{signal});host.append(document.createElement('input'));throw Error('partial');}}));await flush();expect(child.aborted).toBe(true);expect(parent.signal.aborted).toBe(false);window.dispatchEvent(new Event('cf02-load-probe'));expect(probe).not.toHaveBeenCalled();expect(container.querySelector('input')).toBeNull();expect(container.querySelector('[role="alert"]')).not.toBeNull();release();
  });
  it('releases a late disposer once after reentrant abort and rejects an already aborted visit',async()=>{
    const container=document.createElement('div'),parent=new AbortController(),dispose=vi.fn(),release=mountWithLoader({container,signal:parent.signal},async()=>({mount:()=>{parent.abort();return dispose;}}));await flush();release();expect(dispose).toHaveBeenCalledOnce();expect(container.children).toHaveLength(0);const load=vi.fn();mountWithLoader({container,signal:parent.signal},load);expect(load).not.toHaveBeenCalled();expect(container.children).toHaveLength(0);
  });
});
