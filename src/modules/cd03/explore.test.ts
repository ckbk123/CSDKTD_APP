import {afterEach,expect,it,vi} from 'vitest';
import {convertLatexToMarkup,validateLatex} from 'mathlive/ssr';
import type {EquationInputOptions} from '../../shared/equations/input';
const state=vi.hoisted(()=>({fail:false,abort:undefined as undefined|(()=>void),probes:0,aborts:0,releases:0}));
vi.mock('../../shared/equations/input',()=>({
  createEquationDisplay:(latex:string,label:string)=>{const node=document.createElement('div');node.dataset.latex=latex;node.setAttribute('aria-label',label);return node;},
  createEquationInput:(options:EquationInputOptions)=>{
    window.addEventListener('cd03-resource',()=>state.probes++,{signal:options.signal});options.signal.addEventListener('abort',()=>state.aborts++,{once:true});const abort=state.abort;state.abort=undefined;abort?.();if(state.fail)throw new Error('partial editor fixture');
    const element=document.createElement('div'),field=document.createElement('textarea');field.value=options.value;field.setAttribute('aria-label',options.label);element.append(field);const getValue=()=>({latex:field.value,empty:!field.value,hasPlaceholders:false,syntaxIssues:[]});field.addEventListener('input',()=>options.onChange?.(getValue()),{signal:options.signal});
    return{element,getValue,setValue:(value:string)=>{field.value=value;},destroy:()=>{state.releases++;element.remove();},focus:()=>field.focus()};
  }
}));
import {mount} from './view';
import {mount as mountExplore} from './explore';
import * as response from './response';
import * as model from './model';
const visits:(()=>void)[]=[];
afterEach(()=>{visits.splice(0).forEach(dispose=>dispose());document.body.replaceChildren();vi.restoreAllMocks();vi.useRealTimers();vi.unstubAllGlobals();state.fail=false;state.abort=undefined;state.probes=state.aborts=state.releases=0;});
function open(){
  const root=document.createElement('div');root.dataset.module='CD03';document.body.append(root);const parent=new AbortController(),cleanup=mount({container:root,signal:parent.signal});visits.push(()=>{parent.abort();cleanup?.();});
  const active=()=>root.querySelector<HTMLElement>('[data-cd03-mode]:not([hidden])')!;
  const field=(name:string)=>active().querySelector<HTMLInputElement>('input[name="'+name+'"]')!;
  const set=(name:string,value:string)=>{const input=field(name);input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}));};
  const choose=(label:string,value:string)=>{const select=root.querySelector<HTMLSelectElement>('select[aria-label="'+label+'"]')!;select.value=value;select.dispatchEvent(new Event('change',{bubbles:true}));};
  const click=(name:string)=>[...active().querySelectorAll('button')].find(button=>button.textContent===name)!.click();
  return{root,parent,cleanup,active,field,set,choose,click};
}
function geometry(){vi.spyOn(SVGElement.prototype,'getBoundingClientRect').mockImplementation(function(this:SVGElement){const box=this.getAttribute('viewBox')!.split(' ').map(Number);return{left:0,top:0,width:box[2],height:box[3]}as DOMRect;});}
function pointer(target:EventTarget,type:string,id:number,x:number){const event=new MouseEvent(type,{bubbles:true,cancelable:true,button:0,clientX:x,clientY:70});Object.defineProperty(event,'pointerId',{value:id});target.dispatchEvent(event);}
it('opens on the actual proportional baseline with lag off and explicitly inactive draft geometry',()=>{
  const v=open();expect(v.field('lag').checked).toBe(false);expect(v.active().querySelectorAll('figure')).toHaveLength(3);expect(v.active().querySelector('.cd03-live-conclusion')!.textContent).toContain('Kv=2; ramp error=0.5');expect(v.active().querySelector('.cd03-live-conclusion')!.textContent).toContain('overshoot=16.30335%');expect(v.active().querySelector('.cd03-draft-note')!.textContent).toContain('applied accuracy ratio is1');expect(v.active().querySelector('.cd03-corner-host')!.textContent).toContain('Inactive lag draft');
});
it('coalesces changed corners and preserves the independent fail/pass near-zero experiment',()=>{
  vi.useFakeTimers();const v=open(),measure=vi.spyOn(response,'measure');v.click('Enable proposed lag');expect(v.active().querySelector('.cd03-preview-state')!.textContent).toContain('Updating');expect(v.active().querySelector('.cd03-live-conclusion')!.textContent).toContain('Kv=2;');vi.advanceTimersByTime(80);expect(measure).toHaveBeenCalledOnce();expect(v.active().querySelector('.cd03-live-conclusion')!.textContent).toContain('full step targets: failed');expect(v.active().textContent).toContain('overshoot=22.24909%');
  v.click('Move both corners ÷5');vi.advanceTimersByTime(80);expect(v.field('p').valueAsNumber).toBe(.002);expect(v.field('z').valueAsNumber).toBe(.02);expect(v.active().querySelector('.cd03-live-conclusion')!.textContent).toContain('full step targets: met');expect(v.active().textContent).toContain('Kv=20; ramp error=0.05');expect(v.active().textContent).toContain('settling=2.927166s');
});
it('reassesses targets from cached measurements and inspects the exact retained response without redrawing paths',()=>{
  vi.useFakeTimers();const v=open(),measure=vi.spyOn(response,'measure'),builder=vi.spyOn(model,'model'),signal=vi.spyOn(response,'response');v.set('mp','30');v.set('settling','10');vi.advanceTimersByTime(80);expect(measure).not.toHaveBeenCalled();expect(builder).not.toHaveBeenCalled();expect(signal).not.toHaveBeenCalled();
  const drawings=[...v.active().querySelectorAll('svg')],paths=[...v.active().querySelectorAll('path')].map(p=>p.getAttribute('d'));v.field('time').focus();v.set('time','.5');expect(document.activeElement).toBe(v.field('time'));expect([...v.active().querySelectorAll('svg')]).toEqual(drawings);expect([...v.active().querySelectorAll('path')].map(p=>p.getAttribute('d'))).toEqual(paths);const expected=1-Math.exp(-.5)*(Math.cos(Math.sqrt(3)*.5)+Math.sin(Math.sqrt(3)*.5)/Math.sqrt(3));expect(v.active().querySelector('.cd03-live-readout')!.textContent).toContain('proportional y='+Number(expected.toPrecision(7)));expect(measure).not.toHaveBeenCalled();
});
it('keeps both invalid native rate fields and their same elements through Fit and mode visits with zero value assignments',()=>{
  vi.useFakeTimers();const v=open(),native=v.field('p');native.value='';vi.spyOn(native,'validity','get').mockReturnValue({badInput:true}as ValidityState);native.dispatchEvent(new Event('input',{bubbles:true}));vi.advanceTimersByTime(80);const writes=vi.spyOn(native,'value','set');v.click('Fit checked plots');v.choose('Learning mode','practice');v.choose('Learning mode','explore');expect(v.field('p')).toBe(native);expect(native.validity.badInput).toBe(true);expect(writes).not.toHaveBeenCalled();expect(v.active().querySelector('.cd03-live-warning')!.textContent).toContain('finite number');expect(v.active().querySelector('.cd03-live-conclusion')!.textContent).toContain('Kv=2;');
});
it('reconciles the checked cursor after H shrinks while preserving an invalid native time draft',()=>{
  vi.useFakeTimers();const v=open();v.set('time','5');v.set('time','1e-999');const native=v.field('time'),writes=vi.spyOn(native,'value','set');v.set('horizon','1.21');vi.advanceTimersByTime(80);expect(v.field('time')).toBe(native);expect(native.value).toBe('1e-999');expect(writes).not.toHaveBeenCalled();expect(v.field('timeRange').max).toBe('1.21');expect(v.field('timeRange').valueAsNumber).toBeCloseTo(.605,14);expect(v.active().querySelector('.cd03-live-readout')!.textContent).toContain('Checked t=0.605s');expect(v.active().textContent).toContain('settling=not established in H');
});
it('moves the selected corner pair with one pointer owner and restores the complete start on Escape',()=>{
  vi.useFakeTimers();geometry();const v=open();v.click('Enable proposed lag');vi.advanceTimersByTime(80);v.choose('Selected movement','ratio');const host=v.active().querySelector<HTMLElement>('.cd03-explore')!,captured=new Set<number>();host.setPointerCapture=id=>{captured.add(id);};host.hasPointerCapture=id=>captured.has(id);host.releasePointerCapture=id=>{captured.delete(id);};
  const handle=v.active().querySelector('[data-corner-handle]')!,pole=handle.querySelector('circle')!,zero=v.active().querySelector('.cd03-glyph-zero circle')!,xp=Number(pole.getAttribute('cx')),scale=(xp-Number(zero.getAttribute('cx')))/.09,x=xp+(.01-.002)*scale;
  pointer(handle,'pointerdown',7,xp);pointer(window,'pointermove',7,x);vi.advanceTimersByTime(80);expect(v.field('p').valueAsNumber).toBeCloseTo(.002,13);expect(v.field('z').valueAsNumber).toBeCloseTo(.02,13);pointer(v.active().querySelector('[data-corner-handle]')!,'pointerdown',8,x);pointer(window,'pointercancel',8,x);pointer(host,'lostpointercapture',8,x);expect(captured).toEqual(new Set([7]));const escape=new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true});document.body.dispatchEvent(escape);expect(escape.defaultPrevented).toBe(true);expect(v.field('p').value).toBe('.01');expect(v.field('z').value).toBe('.1');expect(captured.size).toBe(0);expect(v.active().querySelector('.cd03-live-conclusion')!.textContent).toContain('full step targets: failed');
});
it('retains complete unstable/boundary poles and explicit unavailable full transients',()=>{
  vi.useFakeTimers();const v=open();v.click('Enable proposed lag');v.set('z','3');vi.advanceTimersByTime(80);expect(v.active().querySelector('.cd03-depth')!.textContent).toContain('Full poles (unstable)');expect(v.active().querySelector('.cd03-live-warning')!.textContent).toContain('unstable');expect(v.active().querySelector('.cd03-live-conclusion')!.textContent).toContain('ramp error=not established');v.set('z','2.02005');vi.advanceTimersByTime(80);expect(v.active().querySelector('.cd03-depth')!.textContent).toContain('Full poles (boundary)');expect(v.active().querySelector('.cd03-live-conclusion')!.textContent).toContain('accuracy: unknown');
});
it('keeps original Practice independent and revokes a changed attempt without discarding its valid mathematical result',()=>{
  const v=open();v.choose('Learning mode','practice');const practice=v.active(),prediction=practice.querySelector<HTMLSelectElement>('[data-control="prediction"]')!;expect(practice.querySelector('svg')).toBeNull();prediction.value='transient';v.click('Check complete design');expect(practice.querySelector('[data-part="prediction"]')!.textContent).toContain('Your prediction agrees');const plot=practice.querySelector('svg');prediction.value='both';prediction.dispatchEvent(new Event('change',{bubbles:true}));expect(practice.querySelector('[data-part="prediction"]')!.textContent).toContain('Prediction edited');expect(practice.querySelector('svg')).toBe(plot);v.choose('Learning mode','explore');expect(v.field('lag').checked).toBe(false);v.choose('Learning mode','practice');expect(v.active()).toBe(practice);expect(prediction.value).toBe('both');
});
it('owns timer/editor/observer cleanup on direct disposal with the parent still active',()=>{
  vi.useFakeTimers();const observe=vi.fn(),disconnect=vi.fn();vi.stubGlobal('ResizeObserver',class{observe=observe;disconnect=disconnect;});const v=open();v.set('p','.02');expect(vi.getTimerCount()).toBe(1);v.cleanup?.();expect(v.parent.signal.aborted).toBe(false);expect(vi.getTimerCount()).toBe(0);expect(v.root.childElementCount).toBe(0);expect(disconnect).toHaveBeenCalledOnce();window.dispatchEvent(new Event('cd03-resource'));expect(state.probes).toBe(0);
});
it('aborts partial editor resources and recovers a focused Retry to the stable mode control',()=>{
  state.fail=true;const v=open();expect(v.active().querySelector('[role="alert"]')!.textContent).toContain('partial editor');window.dispatchEvent(new Event('cd03-resource'));expect(state.probes).toBe(0);expect(v.parent.signal.aborted).toBe(false);state.fail=false;const retry=[...v.active().querySelectorAll('button')].find(b=>b.textContent==='Retry workspace')!;retry.focus();retry.click();expect(v.active().querySelectorAll('figure')).toHaveLength(3);expect(document.activeElement).toBe(v.root.querySelector('select[aria-label="Learning mode"]'));
});
it('disconnects an observer returned after reentrant parent abort without observing detached geometry',()=>{
  const parent=new AbortController(),root=document.createElement('div'),observe=vi.fn(),disconnect=vi.fn();document.body.append(root);vi.stubGlobal('ResizeObserver',class{constructor(){parent.abort();}observe=observe;disconnect=disconnect;});const cleanup=mountExplore({container:root,signal:parent.signal,hooks:{},isActive:()=>true});cleanup();expect(observe).not.toHaveBeenCalled();expect(disconnect).toHaveBeenCalledOnce();expect(root.childElementCount).toBe(0);expect(state.releases).toBe(1);
});
it('typesets the actual current velocity/ratio equations with the installed renderer',()=>{
  const v=open();for(const node of v.active().querySelectorAll<HTMLElement>('[data-latex]')){expect(validateLatex(node.dataset.latex!)).toEqual([]);expect(convertLatexToMarkup(node.dataset.latex!)).not.toContain('ML__error');}
});
it('retains fractional numeric rates without slider quantization and keeps repeated key focus',()=>{
  vi.useFakeTimers();const v=open();v.set('z','.1234567890123');vi.advanceTimersByTime(80);v.choose('Selected movement','z');expect(v.field('z').value).toBe('.1234567890123');expect(v.field('cornerRange').step).toBe('any');expect(Number(v.field('cornerRange').value)).toBeCloseTo(Math.log10(.1234567890123),14);
  const handle=()=>v.active().querySelector<SVGElement>('[data-corner-handle]')!;handle().focus();handle().dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true,cancelable:true}));expect(v.field('z').valueAsNumber).toBeCloseTo(.1244567890123,14);expect(document.activeElement).toBe(handle());handle().dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true,cancelable:true}));expect(v.field('z').valueAsNumber).toBeCloseTo(.1234567890123,14);expect(document.activeElement).toBe(handle());
});
it('keeps original upper rate/ratio bounds available even when the complete loop becomes unstable',()=>{
  vi.useFakeTimers();const v=open();v.click('Enable proposed lag');v.set('p','.005');v.set('z','5');vi.advanceTimersByTime(80);expect(v.active().querySelector('.cd03-draft-note')!.textContent).toContain('z/p=1000');expect(v.active().querySelector('.cd03-depth')!.textContent).toContain('Full poles (unstable)');expect(v.field('z').value).toBe('5');
});
it('suspends pending source work while Practice is active and resumes one bounded calculation',()=>{
  vi.useFakeTimers();const v=open(),measure=vi.spyOn(response,'measure');v.click('Enable proposed lag');v.choose('Learning mode','practice');expect(vi.getTimerCount()).toBe(0);vi.advanceTimersByTime(200);expect(measure).not.toHaveBeenCalled();v.choose('Learning mode','explore');expect(vi.getTimerCount()).toBe(1);vi.advanceTimersByTime(80);expect(measure).toHaveBeenCalledOnce();expect(v.active().querySelector('.cd03-draft-note')!.textContent).toContain('Applied lag z/p=10');
});
it('releases an equation instance returned after reentrant parent abort without allocating an observer',()=>{
  const root=document.createElement('div'),parent=new AbortController(),observe=vi.fn();document.body.append(root);state.abort=()=>parent.abort();vi.stubGlobal('ResizeObserver',class{observe=observe;disconnect=()=>{};});const cleanup=mountExplore({container:root,signal:parent.signal,hooks:{},isActive:()=>true});cleanup();expect(root.childElementCount).toBe(0);expect(state.releases).toBe(1);expect(observe).not.toHaveBeenCalled();window.dispatchEvent(new Event('cd03-resource'));expect(state.probes).toBe(0);
});
