import { afterEach,describe,expect,it,vi } from 'vitest';
const view=vi.hoisted(()=>({mount:vi.fn(),cleanup:vi.fn()}));
vi.mock('./view',()=>({mount:view.mount}));
import { mount } from './workspace';
afterEach(()=>{document.body.replaceChildren();view.mount.mockReset();view.cleanup.mockReset();});
describe('CF03 lazy-view lifecycle',()=>{
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
