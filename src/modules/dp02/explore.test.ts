import {afterEach,describe,expect,it,vi} from 'vitest';
import type {EquationDraft,EquationInputOptions} from '../../shared/equations/input';
import {mount} from './explore';
import {mount as mountModes} from './view';
import {coordinates,explorationPlanes,worldPoint,sizePlots} from './exploration-plots';

vi.mock('../../shared/equations/input',()=>({
  createEquationDisplay:(latex:string,label:string)=>{const el=document.createElement('div');el.textContent=latex;el.setAttribute('aria-label',label);return el;},
  createEquationInput:(options:EquationInputOptions)=>{
    const element=document.createElement('div'),field=document.createElement('textarea');field.value=options.value;element.append(field);
    const getValue=():EquationDraft=>({latex:field.value,empty:!field.value.trim(),syntaxIssues:[],hasPlaceholders:false});
    field.addEventListener('input',()=>options.onChange?.(getValue()),{signal:options.signal});
    return {element,getValue,setValue:(value:string)=>{field.value=value;},focus:()=>field.focus(),destroy:()=>element.remove()};
  }
}));
const visits:(()=>void)[]=[];
afterEach(()=>{visits.splice(0).forEach(fn=>fn());vi.useRealTimers();vi.restoreAllMocks();vi.unstubAllGlobals();document.body.replaceChildren();});
function visit(){
  vi.useFakeTimers();const root=document.createElement('div');root.dataset.module='DP02';document.body.append(root);const parent=new AbortController(),cleanup=mount({container:root,signal:parent.signal})||(()=>{});
  visits.push(()=>{cleanup();parent.abort();});
  const field=(name:string)=>root.querySelector<HTMLInputElement>(`[data-field="${name}"]`)!;
  const edit=(name:string,value:string)=>{field(name).value=value;field(name).dispatchEvent(new Event('input',{bubbles:true}));};
  const button=(label:string)=>[...root.querySelectorAll('button')].find(n=>n.textContent===label)!;
  const text=()=>root.querySelector('.dp-live-readout')!.textContent!;
  return {root,parent,cleanup,field,edit,button,text,flush:()=>vi.advanceTimersByTime(32)};
}
function pointer(target:Element,type:string,x=146,y=84,id=7){const event=new MouseEvent(type,{bubbles:true,cancelable:true,button:0,clientX:x,clientY:y});Object.defineProperty(event,'pointerId',{value:id});target.dispatchEvent(event);}
function fixedRects(){vi.spyOn(Element.prototype,'getBoundingClientRect').mockImplementation(function(this:Element){return {x:0,y:0,left:0,top:0,right:400,bottom:360,width:400,height:360,toJSON(){return {};}};});}

describe('DP02 direct pole and period exploration',()=>{
  it('opens with independently expected baseline data, linked planes and real samples',()=>{
    const v=visit();expect(v.root.querySelectorAll('svg')).toHaveLength(3);
    expect(v.text()).toContain('r ≈ 0.818730753');expect(v.text()).toContain('θ ≈ 0.3');
    v.edit('sample','1');expect(v.root.querySelector('.dp-sample-readout')!.textContent).toContain('x[k] ≈ 0.78216336');
    expect(v.root.querySelector('.dp-alias-readout')!.textContent).toContain('65.8319');
    expect(v.root.textContent).toContain('not a complete plant');
  });
  it('coalesces continued input without postponing updates until the gesture ends',()=>{
    const v=visit();v.edit('period','.2');vi.advanceTimersByTime(20);v.edit('period','.3');
    expect(vi.getTimerCount()).toBe(1);expect(v.text()).toContain('T = 0.1 s');expect(v.root.querySelector('.dp-message')!.textContent).toContain('previous checked');
    vi.advanceTimersByTime(12);expect(v.text()).toContain('r ≈ 0.548811636');
    v.edit('period','.4');v.flush();expect(v.text()).toContain('r ≈ 0.449328964');expect(vi.getTimerCount()).toBe(0);
  });
  it('keeps reference and plane axes fixed as T changes, and links the selected actual sample',()=>{
    const v=visit(),ticks=[...v.root.querySelectorAll('[data-plane] text')].map(e=>e.textContent);
    v.edit('period','.2');v.flush();expect(v.text()).toContain('r ≈ 0.670320046');expect(v.text()).toContain('rref ≈ 0.818730753');
    expect([...v.root.querySelectorAll('[data-plane] text')].map(e=>e.textContent)).toEqual(ticks);
    v.edit('sample','1');expect(v.root.querySelector('.dp-sample-readout')!.textContent).toContain('x[k] ≈ 0.55323901');
    expect(v.root.querySelector('.dp-sample-readout')!.textContent).toContain('t = 0.2 s');
  });
  it('retains checked data and invalid numeric feedback across later edits and view-only actions',()=>{
    const v=visit();v.edit('sigma','1e-999');expect(v.text()).toContain('Checked s = -2 + 3j');
    expect(v.root.querySelector('.dp-message')!.textContent).toContain('σ is nonzero but too small');
    const select=v.root.querySelector<HTMLSelectElement>('[data-field="branch"]')!;select.value='1';select.dispatchEvent(new Event('change'));
    expect(v.root.querySelector('.dp-message')!.textContent).toContain('σ is nonzero but too small');
    v.edit('period','.2');v.flush();expect(v.text()).toContain('T = 0.1 s');expect(v.root.querySelector('.dp-message')!.textContent).toContain('σ is nonzero but too small');
    v.edit('sigma','0e-999');v.flush();expect(v.text()).toContain('r ≈ 1;');expect(v.text()).toContain('near-boundary');
  });
  it('preserves invalid sample text and last valid point while changing model or inverse view',()=>{
    const v=visit();v.edit('sample','3');const prior=v.root.querySelector('.dp-sample-readout')!.textContent;v.edit('sample','');
    expect(v.root.querySelector('.dp-sample-readout')!.textContent).toBe(prior);expect(v.field('sample').value).toBe('');
    v.edit('period','.2');v.flush();expect(v.field('sample').value).toBe('');expect(v.field('sample-range').value).toBe('3');
    expect(v.root.querySelector('.dp-inspection-error')!.textContent).toContain('sample k');
  });
  it('retains the original numeric domain beyond the initial editing viewport',()=>{
    const v=visit();v.edit('sigma','-200');v.edit('omega','300');v.edit('period','.001');v.edit('reference','.001');v.edit('count','4');v.flush();
    expect(v.text()).toContain('Checked s = -200 + 300j');expect(v.text()).toContain('r ≈ 0.818730753');
    expect(v.root.querySelector('.dp-window-note')!.textContent).toContain('outside the fixed view');
    v.button('Fit plots').click();expect(v.root.querySelectorAll('[data-pole-handle]')).toHaveLength(2);expect(v.root.querySelector('.dp-window-note')!.textContent).not.toContain('outside');
  });
  it('keeps inverse branch selection separate from the mapped pole and preserves negative-real decay',()=>{
    const v=visit(),before=v.text(),select=v.root.querySelector<HTMLSelectElement>('[data-field="branch"]')!;
    select.value='1';select.dispatchEvent(new Event('change'));expect(v.text()).toBe(before);expect(v.root.querySelector('.dp-inverse-readout')!.textContent).toContain('65.8319');
    v.button('Alternating decay: z = −0.8').click();v.edit('sample','3');expect(v.root.querySelector('.dp-sample-readout')!.textContent).toContain('x[k] ≈ -0.512');expect(v.text()).toContain('This mode decays');
  });
  it('restores the same signed handle after repeated arrows, including a collapsed conjugate',()=>{
    const v=visit();let handle=v.root.querySelector<SVGElement>('[data-pole-handle="-1"]')!;handle.focus();
    handle.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowUp',bubbles:true}));
    document.activeElement!.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowUp',bubbles:true}));
    expect(v.field('omega').value).toBe('2.98');expect((document.activeElement as SVGElement).dataset.poleHandle).toBe('-1');
    v.edit('omega','.01');v.flush();handle=v.root.querySelector<SVGElement>('[data-pole-handle="-1"]')!;handle.focus();handle.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowUp',bubbles:true}));
    expect(v.field('omega').value).toBe('0');expect((document.activeElement as SVGElement).dataset.poleHandle).toBe('1');
  });
  it('cancels a live drag from the actual stable focus without leaking Escape to navigation',()=>{
    fixedRects();const v=visit(),host=v.root.querySelector('.dp-live-planes')!,nav=vi.fn();window.addEventListener('keydown',nav);
    try{
      pointer(v.root.querySelector('[data-pole-handle="1"]')!,'pointerdown');pointer(host,'pointermove',173,111);v.flush();
      expect(v.field('sigma').value).toBe('-1');expect(v.field('omega').value).toBe('2');expect(document.activeElement).toBe(host);
      document.activeElement!.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));
      expect(v.field('sigma').value).toBe('-2');expect(v.field('omega').value).toBe('3');expect(nav).not.toHaveBeenCalled();expect(v.button('Cancel pole drag').disabled).toBe(true);
    }finally{window.removeEventListener('keydown',nav);}
  });
  it('commits the latest drag on release and ignores the following lost capture',()=>{
    fixedRects();const v=visit(),host=v.root.querySelector('.dp-live-planes')!;pointer(v.root.querySelector('[data-pole-handle="1"]')!,'pointerdown');pointer(host,'pointermove',173,111);pointer(host,'pointerup',173,111);pointer(host,'lostpointercapture');
    expect(v.field('sigma').value).toBe('-1');expect(v.text()).toContain('r ≈ 0.904837418');v.flush();expect(v.field('sigma').value).toBe('-1');
  });
  it('keeps the first pointer and cancel baseline when another pointer contacts the plot',()=>{
    fixedRects();const v=visit(),host=v.root.querySelector('.dp-live-planes')!,captured=new Set<number>();
    Object.defineProperties(host,{setPointerCapture:{value:(id:number)=>captured.add(id)},hasPointerCapture:{value:(id:number)=>captured.has(id)},releasePointerCapture:{value:(id:number)=>captured.delete(id)}});
    pointer(v.root.querySelector('[data-pole-handle="1"]')!,'pointerdown');pointer(host,'pointermove',173,111);v.flush();
    pointer(v.root.querySelector('[data-pole-handle="1"]')!,'pointerdown',173,111,8);pointer(host,'pointermove',200,165,8);pointer(host,'pointercancel',200,165,8);pointer(host,'lostpointercapture',200,165,8);
    expect(captured).toEqual(new Set([7]));expect(v.field('sigma').value).toBe('-1');expect(v.button('Cancel pole drag').disabled).toBe(false);
    document.activeElement!.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));
    expect(v.field('sigma').value).toBe('-2');expect(v.field('omega').value).toBe('3');expect(captured.size).toBe(0);
  });
  it('releases pending preview, observer and window listeners on direct disposal with parent active',()=>{
    let active=false;vi.stubGlobal('ResizeObserver',class{observe(){active=true;}disconnect(){active=false;}});
    const v=visit();v.edit('period','.2');expect(vi.getTimerCount()).toBe(1);expect(active).toBe(true);v.cleanup();v.cleanup();
    expect(v.parent.signal.aborted).toBe(false);expect(vi.getTimerCount()).toBe(0);expect(active).toBe(false);v.flush();expect(v.root.childElementCount).toBe(0);
    const escape=new KeyboardEvent('keydown',{key:'Escape',cancelable:true,bubbles:true});window.dispatchEvent(escape);expect(escape.defaultPrevented).toBe(false);
  });
  it('keeps the original hidden-answer Practice independent from the explored model',()=>{
    vi.useFakeTimers();const root=document.createElement('div'),parent=new AbortController();root.dataset.module='DP02';document.body.append(root);const cleanup=mountModes({container:root,signal:parent.signal})||(()=>{});visits.push(()=>{cleanup();parent.abort();});
    const explore=root.querySelector<HTMLElement>('[data-learning-mode="explore"]')!,practice=root.querySelector<HTMLElement>('[data-learning-mode="practice"]')!;
    const period=explore.querySelector<HTMLInputElement>('[data-field="period"]')!;period.value='.2';period.dispatchEvent(new Event('input'));vi.advanceTimersByTime(32);
    [...root.querySelectorAll('button')].find(n=>n.textContent==='Practice')!.click();
    expect(explore.hidden).toBe(true);expect(practice.hidden).toBe(false);expect(practice.querySelector<HTMLElement>('.dp-results')!.hidden).toBe(true);expect(practice.querySelectorAll('svg')).toHaveLength(0);
    expect(practice.querySelector<HTMLInputElement>('[data-field="period"]')!.value).toBe('0.1');
    const prediction=practice.querySelector<HTMLSelectElement>('[data-field="prediction"]')!;prediction.value='unchanged';practice.querySelector<HTMLButtonElement>('[data-action="reveal"]')!.click();expect(practice.querySelector<HTMLElement>('.dp-results')!.hidden).toBe(false);expect(practice.querySelector('.dp-message')!.textContent).toContain('Correct prediction');
    prediction.value='inward';prediction.dispatchEvent(new Event('change'));expect(practice.querySelector('.dp-message')!.textContent).not.toContain('Correct prediction');
    [...root.querySelectorAll('button')].find(n=>n.textContent==='Explore')!.click();expect(Number(period.value)).toBe(.2);expect(explore.querySelector('.dp-live-readout')!.textContent).toContain('r ≈ 0.670320046');
    cleanup();expect(parent.signal.aborted).toBe(false);expect(root.childElementCount).toBe(0);
  });
});

describe('DP02 fixed equal plane geometry',()=>{
  it('maps independent world coordinates and equal distances in both directions',()=>{
    expect(coordinates({real:2,imag:1},5)).toEqual({x:254,y:138});expect(worldPoint(254,138,5)).toEqual({real:2,imag:1});
    const root=explorationPlanes({real:-2,imag:3},.1,.1,{real:-2,imag:3},{s:5,z:1.2});
    expect(root.querySelector('[data-plane="s"]')!.getAttribute('viewBox')).toBe('0 0 400 360');
    expect(root.querySelector('[data-plane="s"]')!.getAttribute('role')).toBe('group');
    expect(root.querySelectorAll('.dp-reference').length).toBe(2);
  });
  it('keeps world geometry while rendering 12px text and 44px hit targets at half width',()=>{
    const root=explorationPlanes({real:-2,imag:3},.1,.1,{real:-2,imag:3},{s:5,z:1.2}),svg=root.querySelector<SVGSVGElement>('[data-plane="s"]')!,before=svg.querySelector('.dp-cross')!.getAttribute('d');
    vi.spyOn(svg,'getBoundingClientRect').mockReturnValue({x:0,y:0,left:0,top:0,right:200,bottom:180,width:200,height:180,toJSON(){return {};}});sizePlots(root);
    expect(svg.querySelector<SVGTextElement>('text')!.style.fontSize).toBe('24px');expect(Number(svg.querySelector('[data-hit]')!.getAttribute('r'))).toBe(44);expect(svg.querySelector('.dp-cross')!.getAttribute('d')).toBe(before);
  });
});
