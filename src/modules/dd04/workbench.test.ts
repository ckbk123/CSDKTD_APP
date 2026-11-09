import { afterEach, describe, expect, it, vi } from 'vitest';
import { calculate, derive, initialize, type Step } from './math';
import { editFutureError } from './sequence';
import { createWorkbench } from './workbench';
const visits:(()=>void)[]=[];
afterEach(()=>{for(const dispose of visits.splice(0))dispose();vi.restoreAllMocks();document.body.replaceChildren();});
function visit(commits=0){
  const root=document.createElement('div');document.body.append(root);const life=new AbortController();
  const model=derive({kp:4,ki:2,kd:1,period:.1,integral:'trapezoidal',derivative:'backward',tau:.1}),initialMemory=initialize(model,{e0:0,eMinus1:0,i0:0,d0:0});
  let errors:readonly number[]=[1,1,1],memory=initialMemory,committed:Step[]=[];
  for(let i=0;i<commits;i++){const s=calculate(model,memory,errors[i]);memory=s.next;committed.push(s);}
  const edited=vi.fn((k:number,v:number)=>{errors=editFutureError(errors,memory.k,k,v).errors;}),end=vi.fn();
  const bench=createWorkbench({container:root,signal:life.signal,read:()=>({model,initialMemory,errors,memory,committed}),edit:edited,replay:k=>{memory=committed[k-1].old;committed=committed.slice(0,k-1);},beginEdit:()=>{const saved=errors;return()=>{errors=saved;};},endEdit:end});
  visits.push(()=>{bench.destroy();life.abort();});
  const field=(label:string)=>root.querySelector<HTMLInputElement>(`[aria-label="${label}"]`)!;
  const edit=(label:string,value:string)=>{const f=field(label);f.value=value;f.dispatchEvent(new Event('input'));};
  const click=(label:string)=>[...root.querySelectorAll('button')].find(b=>b.textContent===label)!.click();
  return{root,life,bench,field,edit,click,edited,end,state:()=>({errors,memory,committed})};
}
function pointer(target:EventTarget,type:string,id:number,y=80){const e=new MouseEvent(type,{bubbles:true,clientX:140,clientY:y,button:0});Object.defineProperty(e,'pointerId',{value:id});target.dispatchEvent(e);}
describe('DD04 direct input and committed-sample workbench',()=>{
  it('edits only uncommitted input while keeping live controller memory unchanged',()=>{
    const v=visit(1),before=v.state().memory;v.edit('Select input sample k','2');v.edit('Error e[k] to edit','-1');
    expect(v.state().errors).toEqual([1,-1,1]);expect(v.state().memory).toBe(before);expect(v.state().committed).toHaveLength(1);
    v.edit('Select input sample k','1');expect(v.field('Error e[k] to edit').disabled).toBe(true);
    v.field('Error e[k] to edit').value='2';v.field('Error e[k] to edit').dispatchEvent(new Event('input'));expect(v.state().errors[0]).toBe(1);expect(v.root.textContent).toContain('already committed');
  });
  it('inspects actual committed arithmetic without advancing memory and explicitly replays when requested',()=>{
    const v=visit(2),before=v.state().memory;v.edit('Inspect committed sample k','1');expect(v.state().memory).toBe(before);expect(v.root.querySelector('.pid-inspection-values')!.textContent).toContain('u=14.1');
    v.click('Replay from selected sample');expect(v.state().memory.k).toBe(1);expect(v.state().committed).toHaveLength(0);expect(v.field('Committed sample cursor').value).toBe('0');
  });
  it('preserves invalid native input drafts through Fit with zero value assignments',()=>{
    const v=visit();v.edit('Error e[k] to edit','1e-999');const f=v.field('Error e[k] to edit'),writes=vi.spyOn(f,'value','set');v.click('Fit sample views');
    expect(writes).not.toHaveBeenCalled();expect(f.value).toBe('1e-999');expect(v.state().errors[0]).toBe(1);expect(v.root.textContent).toContain('too small');
    v.click('Discard error draft');expect(f.value).toBe('1');
  });
  it('reconciles a replay-shortened inspection while preserving its real badInput draft',()=>{
    const v=visit(2);v.edit('Inspect committed sample k','1');const f=v.field('Inspect committed sample k');f.value='';vi.spyOn(f,'validity','get').mockReturnValue({badInput:true}as ValidityState);f.dispatchEvent(new Event('input'));const writes=vi.spyOn(f,'value','set');
    v.click('Replay from selected sample');expect(writes).not.toHaveBeenCalled();expect(f.validity.badInput).toBe(true);expect(v.field('Committed sample cursor').value).toBe('0');expect(v.root.querySelector('.pid-inspection-error')!.textContent).toContain('Last checked inspection remains k=0');
  });
  it('keeps one pointer owner and restores the source and native controls on body Escape',()=>{
    const v=visit(),host=v.root.querySelector<HTMLElement>('.pid-direct-plots')!,capture=vi.fn(),release=vi.fn();host.setPointerCapture=capture;host.hasPointerCapture=()=>true;host.releasePointerCapture=release;
    vi.spyOn(SVGElement.prototype,'getBoundingClientRect').mockReturnValue({left:0,top:0,width:600,height:220}as DOMRect);
    const handle=v.root.querySelector('[data-error-handle]')!;pointer(handle,'pointerdown',7);pointer(handle,'pointerdown',8);pointer(window,'pointercancel',8);pointer(host,'lostpointercapture',8);pointer(window,'pointermove',7,110-88/3);
    expect(v.state().errors[0]).toBe(.5);expect(v.field('Error e[k] to edit').value).toBe('0.5');expect(capture.mock.calls).toEqual([[7]]);
    const escape=new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true});document.body.dispatchEvent(escape);
    expect(escape.defaultPrevented).toBe(true);expect(v.state().errors[0]).toBe(1);expect(v.field('Error e[k] to edit').value).toBe('1');expect(release).toHaveBeenCalledWith(7);expect(v.end).toHaveBeenCalledOnce();
  });
  it('cancels before fitting rather than fitting the discarded input preview',()=>{
    const v=visit(),host=v.root.querySelector<HTMLElement>('.pid-direct-plots')!;host.setPointerCapture=()=>{};host.hasPointerCapture=()=>false;
    vi.spyOn(SVGElement.prototype,'getBoundingClientRect').mockReturnValue({left:0,top:0,width:600,height:220}as DOMRect);
    pointer(v.root.querySelector('[data-error-handle]')!,'pointerdown',7);pointer(window,'pointermove',7,110-88*4/1.5);expect(v.state().errors[0]).toBe(4);
    v.click('Fit sample views');expect(v.state().errors[0]).toBe(1);expect(v.field('Error e[k] to edit').value).toBe('1');expect(v.root.querySelector('.pid-timeline-y')!.textContent).toBe('1.50-1.5');
  });
  it('releases pointer/listener resources on direct disposal with its parent still active',()=>{
    const v=visit(),host=v.root.querySelector<HTMLElement>('.pid-direct-plots')!,release=vi.fn();host.setPointerCapture=()=>{};host.hasPointerCapture=()=>true;host.releasePointerCapture=release;
    pointer(v.root.querySelector('[data-error-handle]')!,'pointerdown',7);v.bench.destroy();pointer(window,'pointermove',7,0);expect(v.life.signal.aborted).toBe(false);expect(v.edited).not.toHaveBeenCalled();expect(release).toHaveBeenCalledWith(7);expect(v.root.childElementCount).toBe(0);
  });
});
