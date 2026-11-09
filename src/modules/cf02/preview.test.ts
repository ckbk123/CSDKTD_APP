import{afterEach,describe,expect,it,vi}from'vitest';
import{createPreview}from'./preview';
afterEach(()=>vi.useRealTimers());
describe('bounded owned latest-preview scheduling',()=>{
  it('publishes the latest input on the original deadline instead of indefinitely debouncing a live drag',()=>{
    vi.useFakeTimers();const parent=new AbortController(),work=vi.fn(),error=vi.fn(),preview=createPreview<number>(parent.signal,work,error);preview.request(1);vi.advanceTimersByTime(30);preview.request(2);vi.advanceTimersByTime(10);expect(work).toHaveBeenCalledExactlyOnceWith(2);expect(preview.pending).toBe(false);expect(error).not.toHaveBeenCalled();preview.dispose();
  });
  it('cancels queued input and cannot reschedule after abort during a preview',()=>{
    vi.useFakeTimers();const parent=new AbortController(),error=vi.fn();let preview:ReturnType<typeof createPreview<number>>;const work=vi.fn(()=>{preview.request(2);parent.abort();preview.request(3);});preview=createPreview(parent.signal,work,error);preview.request(1);vi.runAllTimers();expect(work).toHaveBeenCalledOnce();expect(vi.getTimerCount()).toBe(0);expect(preview.pending).toBe(false);preview.flush();expect(work).toHaveBeenCalledOnce();expect(error).not.toHaveBeenCalled();
  });
  it('routes a live failure once and drops a failure that follows reentrant abort',()=>{
    vi.useFakeTimers();const parent=new AbortController(),error=vi.fn(),preview=createPreview(parent.signal,(value:number)=>{if(value===2)parent.abort();throw Error('trace failure');},error);preview.request(1);preview.flush();expect(error).toHaveBeenCalledOnce();expect(vi.getTimerCount()).toBe(0);preview.request(2);preview.flush();expect(error).toHaveBeenCalledOnce();expect(preview.pending).toBe(false);
  });
});
