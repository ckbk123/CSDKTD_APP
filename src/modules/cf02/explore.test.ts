import{afterEach,describe,expect,it,vi}from'vitest';
const rendering=vi.hoisted(()=>({run:undefined as undefined|(()=>void)}));
vi.mock('../../shared/equations/input',()=>({createEquationDisplay:(text:string,label:string)=>{rendering.run?.();const e=document.createElement('div');e.textContent=text;e.setAttribute('aria-label',label);return e;}}));
import*as math from'./math';
import{mountExplore}from'./explore';
let release:(()=>void)|undefined;afterEach(()=>{release?.();release=undefined;rendering.run=undefined;vi.useRealTimers();vi.restoreAllMocks();vi.unstubAllGlobals();document.body.replaceChildren();});
const field=(label:string)=>document.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`)!;
const button=(label:string)=>[...document.querySelectorAll('button')].find(b=>b.textContent===label)!;
const set=(label:string,value:string)=>{const input=field(label);input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}));};
const select=(label:string,value:string)=>{const input=document.querySelector<HTMLSelectElement>(`select[aria-label="${label}"]`)!;input.value=value;input.dispatchEvent(new Event('change',{bubbles:true}));};
const apply=()=>vi.advanceTimersByTime(40);
function visit(){vi.useFakeTimers();const container=document.createElement('div'),parent=new AbortController();document.body.append(container);release=mountExplore({container,signal:parent.signal})||undefined;return{container,parent};}
function pointer(target:EventTarget,type:string,id:number){const event=new MouseEvent(type,{bubbles:true,button:0});Object.defineProperty(event,'pointerId',{value:id});target.dispatchEvent(event);}
const limit=()=>document.querySelector('[aria-label="Checked exact limit or long-time polynomial"]')!.textContent!;
const feedback=()=>document.querySelector('.cf-feedback')!.textContent!;
describe('live error exploration with original mathematics (mocked typesetting)',()=>{
  it('opens on the actual reference ramp and updates gain, H and selected physical error independently',()=>{
    visit();expect(document.querySelectorAll('.cf-live-plot')).toHaveLength(2);expect(limit()).toContain('\\frac{1}{2}');expect(document.querySelector('[aria-label="Checked selected error channel before type-table interpretation"]')).not.toBeNull();
    set('Explore normalized gain g','8');expect(feedback()).toContain('Updating');expect(limit()).toContain('\\frac{1}{2}');apply();expect(limit()).toContain('\\frac{1}{4}');
    set('Explore normalized gain g','4');set('Explore sensor gain H','2');apply();expect(limit()).toContain('\\frac{1}{4}');const run=vi.spyOn(math,'trace');select('Explore selected error','physical');apply();expect(limit()).toContain('\\frac{1}{2}t');expect(limit()).toContain('\\frac{1}{8}');expect(run).not.toHaveBeenCalled();
  });
  it('keeps full-loop instability separate from a zero-source identity and restores a stable type-two zero',()=>{
    visit();button('2 integrators').click();apply();expect(document.body.textContent).toContain('full closed loop unstable');expect(document.body.textContent).toContain('final-value theorem is not applied');
    set('Explore amplitude A','0e-999');apply();expect(document.body.textContent).toContain('Zero-source identity');expect(document.body.textContent).toContain('full closed loop unstable');
    set('Explore amplitude A','1');const zero=field('Explore numerator zero');zero.checked=true;zero.dispatchEvent(new Event('change',{bubbles:true}));select('Explore input shape','2');apply();expect(document.body.textContent).toContain('full closed loop strictly Hurwitz');expect(limit()).toContain('\\frac{1}{2}');
  });
  it('moves cached markers without redoing curves/solver and reports the nearest original timestamp',()=>{
    visit();const run=vi.spyOn(math,'trace'),curve=document.querySelector('[data-curve="input"]')!,d=curve.getAttribute('d');set('Explore inspection time (s)','1.234');expect(document.body.textContent).toContain('nearest original computed timestamp');expect(document.querySelector('[data-curve="input"]')).toBe(curve);expect(curve.getAttribute('d')).toBe(d);expect(run).not.toHaveBeenCalled();
  });
  it('keeps checked equation identity and keyboard focus through a view-only Fit',()=>{
    visit();const equation=document.querySelector<HTMLElement>('[aria-label="Checked forward path and sensor"]')!;equation.focus();button('Fit checked trace axes').click();expect(document.querySelector('[aria-label="Checked forward path and sensor"]')).toBe(equation);expect(document.activeElement).toBe(equation);
  });
  it('preserves invalid source/time elements through Fit and reconciles a shorter checked horizon separately',()=>{
    visit();set('Explore inspection time (s)','8');const time=field('Explore inspection time (s)');time.value='';Object.defineProperty(time,'validity',{configurable:true,value:{badInput:true}});time.dispatchEvent(new Event('input'));const twrites=vi.spyOn(time,'value','set');set('Explore trace horizon (s)','1');apply();button('Fit checked trace axes').click();expect(field('Explore inspection time (s)')).toBe(time);expect(twrites).not.toHaveBeenCalled();expect(document.body.textContent).toContain('Markers retain checked t=1 s');
    set('Explore normalized gain g','1e-999');const gain=field('Explore normalized gain g'),writes=vi.spyOn(gain,'value','set');button('Fit checked trace axes').click();expect(writes).not.toHaveBeenCalled();expect(feedback()).toContain('too small');expect(limit()).toContain('\\frac{1}{2}');writes.mockRestore();twrites.mockRestore();
    Object.defineProperty(time,'validity',{configurable:true,value:{badInput:false}});set('Explore inspection time (s)','0.5');set('Explore normalized gain g','4');apply();expect(feedback()).toContain('Checked current');
  });
  it('cancels before an earlier shell Escape and quarantines the remaining native pointer stream',()=>{
    const scope=new AbortController(),shell=vi.fn();window.addEventListener('keydown',shell,{signal:scope.signal});
    try{visit();const range=field('Explore gain control');pointer(range,'pointerdown',7);range.value='8';range.dispatchEvent(new Event('input'));apply();expect(limit()).toContain('\\frac{1}{4}');range.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));expect(shell).not.toHaveBeenCalled();expect(limit()).toContain('\\frac{1}{2}');expect(field('Explore normalized gain g').value).toBe('4');
      range.value='12';range.dispatchEvent(new Event('input'));apply();expect(field('Explore normalized gain g').value).toBe('4');pointer(window,'pointerup',99);range.value='12';range.dispatchEvent(new Event('input'));apply();expect(field('Explore normalized gain g').value).toBe('4');pointer(window,'pointerup',7);range.value='8';range.dispatchEvent(new Event('input'));apply();expect(field('Explore normalized gain g').value).toBe('8');range.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));expect(shell).toHaveBeenCalledOnce();
    }finally{scope.abort();}
  });
  it('prepares typesetting before publication and cancels to cached checked content without typesetting again',()=>{
    visit();const initial=limit();rendering.run=()=>{throw Error('typesetting failed');};set('Explore normalized gain g','8');apply();button('Fit checked trace axes').click();set('Explore inspection time (s)','10');expect(limit()).toBe(initial);expect(document.body.textContent).toContain('Selected-error sample 0.499986');expect(feedback()).toContain('last checked');
    rendering.run=undefined;set('Explore normalized gain g','4');apply();const range=field('Explore gain control');pointer(range,'pointerdown',7);range.value='8';range.dispatchEvent(new Event('input'));apply();rendering.run=()=>{throw Error('typesetting failed');};range.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));expect(limit()).toBe(initial);expect(field('Explore normalized gain g').value).toBe('4');
  });
  it('stops pending previews and post-render publication when rendering aborts the parent',()=>{
    const state=visit(),gain=field('Explore normalized gain g');rendering.run=()=>state.parent.abort();set('Explore normalized gain g','8');const writes=vi.spyOn(gain,'value','set');apply();expect(state.container.children).toHaveLength(0);expect(writes).not.toHaveBeenCalled();expect(vi.getTimerCount()).toBe(0);release?.();
  });
  it('coalesces continuous source edits to the latest candidate on the original deadline',()=>{
    visit();const run=vi.spyOn(math,'trace');set('Explore normalized gain g','8');vi.advanceTimersByTime(30);set('Explore normalized gain g','12');vi.advanceTimersByTime(10);expect(run).toHaveBeenCalledOnce();expect(limit()).toContain('\\frac{1}{6}');expect(document.body.textContent).toContain('Checked current source');
  });
  it('withholds a failed new numerical trace while retaining its independent exact certificate and recovery',()=>{
    visit();const run=vi.spyOn(math,'trace').mockImplementationOnce(()=>{throw Error('Transition unavailable');});set('Explore normalized gain g','8');apply();expect(limit()).toContain('\\frac{1}{4}');expect(document.querySelectorAll('.cf-live-plot')).toHaveLength(0);expect(document.body.textContent).toContain('Numerical trace unavailable: Transition unavailable');expect(field('Explore inspection time (s)').disabled).toBe(true);run.mockRestore();set('Explore normalized gain g','4');apply();expect(document.querySelectorAll('.cf-live-plot')).toHaveLength(2);expect(field('Explore inspection time (s)').disabled).toBe(false);
  });
  it('does not observe a removed view when the observer constructor aborts the parent',()=>{
    vi.useFakeTimers();const container=document.createElement('div'),parent=new AbortController(),observe=vi.fn(),disconnect=vi.fn();document.body.append(container);vi.stubGlobal('ResizeObserver',class{constructor(){parent.abort();}observe=observe;disconnect=disconnect;});release=mountExplore({container,signal:parent.signal})||undefined;expect(observe).not.toHaveBeenCalled();expect(disconnect).toHaveBeenCalledOnce();expect(container.children).toHaveLength(0);
  });
});
