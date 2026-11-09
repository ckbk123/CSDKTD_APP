import{afterEach,describe,expect,it,vi}from'vitest';
const rendering=vi.hoisted(()=>({onDisplay:undefined as undefined|(()=>void)}));
vi.mock('../../shared/equations/input',()=>({createEquationDisplay:(value:string,label:string)=>{rendering.onDisplay?.();const e=document.createElement('div');e.textContent=value;e.setAttribute('aria-label',label);return e;}}));
import*as math from'./math';
import{mountExplore}from'./explore';
import{fitSequence,sequenceGeometry}from'./sequence-plot';
import{sequenceBaseline,sequenceTrial}from'./exploration';
let release:(()=>void)|undefined;afterEach(()=>{release?.();release=undefined;rendering.onDisplay=undefined;vi.restoreAllMocks();vi.unstubAllGlobals();document.body.replaceChildren();});
const field=(label:string)=>document.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`)!;
const button=(name:string)=>[...document.querySelectorAll('button')].find(b=>b.textContent===name)!;
const set=(label:string,value:string)=>{const input=field(label);input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}));};
const choose=(label:string,value:string)=>{const select=document.querySelector<HTMLSelectElement>(`select[aria-label="${label}"]`)!;select.value=value;select.dispatchEvent(new Event('change',{bubbles:true}));};
function visit(){const container=document.createElement('div'),parent=new AbortController();document.body.append(container);release=mountExplore({container,signal:parent.signal})||undefined;return{container,parent};}
function pointer(target:EventTarget,type:string,id:number,x=0){const e=new MouseEvent(type,{bubbles:true,button:0,clientX:x});Object.defineProperty(e,'pointerId',{value:id});target.dispatchEvent(e);}
const identity=()=>document.querySelector('[aria-label="Computed builder transform with full precision coefficients"]')!.textContent;
const feedback=()=>document.querySelector('.dr01-message')!.textContent!;

describe('immediate sequence exploration (mocked typesetting; actual browser separately)',()=>{
  it('opens on actual baseline stems and links pole, delay and history to the original samples',()=>{
    visit();expect(document.querySelectorAll('.dr01-stem')).toHaveLength(16);expect(identity()).toContain('0.8');set('Explore geometric pole a','-0.5');set('Sequence gain c','2');set('Explore onset delay d (samples)','2');set('Explore sample k','3');expect(document.body.textContent).toContain('x[k]=-1; zero history -1');
    set('Explore onset delay d (samples)','0');set('Explore geometric pole a','0.8');set('Sequence gain c','1');set('Explore initial x[−1]','2');set('Explore sample k','0');expect(document.body.textContent).toContain('x[k]=2.6; zero history 1');expect(document.body.textContent).toContain('Read old x[-1]=2');
  });
  it('keeps sum/average normalization and full one-third coefficients visible',()=>{
    visit();choose('Explore sequence family','sum');expect(document.body.textContent).toContain('Zero-history sum ≈4');expect(field('Explore geometric pole a').disabled).toBe(true);
    choose('Explore sequence family','average');set('Explore finite length L (samples)','3');expect(identity()).toContain('0.3333333333333333');expect(document.body.textContent).toContain('Zero-history sum ≈1');expect(document.body.textContent).toContain('L taps of weight c/L');
  });
  it('uses cached rows for inspection, Fit and T-only relabelling',()=>{
    visit();const run=vi.spyOn(math,'samples');set('Explore sample k','3');button('Fit sequence axes').click();set('Explore sample period T (s)','0.25');expect(document.body.textContent).toContain('k=3, t=0.75 s');expect(run).not.toHaveBeenCalled();set('Sequence gain c','2');expect(run).toHaveBeenCalledTimes(2);
  });
  it('preserves native badInput source and inspection drafts through Fit and reconciles a shorter checked horizon',()=>{
    visit();set('Explore number of samples','64');set('Explore sample k','63');const k=field('Explore sample k');k.value='';Object.defineProperty(k,'validity',{configurable:true,value:{badInput:true}});k.dispatchEvent(new Event('input'));const kwrites=vi.spyOn(k,'value','set');
    set('Explore number of samples','4');button('Fit sequence axes').click();expect(field('Explore sample k')).toBe(k);expect(kwrites).not.toHaveBeenCalled();expect(field('Inspect computed sample').value).toBe('3');expect(document.body.textContent).toContain('Showing checked sample 3');
    const gain=field('Sequence gain c');set('Sequence gain c','1e-999');const writes=vi.spyOn(gain,'value','set');button('Fit sequence axes').click();choose('Sequence control parameter','delay');expect(writes).not.toHaveBeenCalled();expect(feedback()).toContain('too small');expect(document.querySelectorAll('.dr01-stem')).toHaveLength(4);
    writes.mockRestore();kwrites.mockRestore();Object.defineProperty(k,'validity',{configurable:true,value:{badInput:false}});set('Explore sample k','2');set('Sequence gain c','1');expect(feedback()).toContain('Computed');
  });
  it('owns one delay gesture, restores its complete source on cancel and records one undo on commit',()=>{
    visit();vi.spyOn(SVGElement.prototype,'getBoundingClientRect').mockReturnValue({left:0,width:640,right:640,top:0,bottom:300,height:300,x:0,y:0,toJSON:()=>({})});const g=sequenceGeometry(640,fitSequence(sequenceTrial(sequenceBaseline())));
    let target=document.querySelector('[data-onset]')!;pointer(target,'pointerdown',1,g.x(0));pointer(window,'pointermove',2,g.x(4));expect(field('Explore onset delay d (samples)').value).toBe('0');pointer(window,'pointermove',1,g.x(2));expect(field('Explore onset delay d (samples)').value).toBe('2');
    window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));expect(field('Explore onset delay d (samples)').value).toBe('0');expect(button('Undo source change').disabled).toBe(true);
    target=document.querySelector('[data-onset]')!;pointer(target,'pointerdown',3,g.x(0));pointer(window,'pointermove',3,g.x(2));pointer(window,'pointerup',99);expect(field('Explore onset delay d (samples)').value).toBe('2');pointer(window,'pointerup',3);expect(button('Undo source change').disabled).toBe(false);button('Undo source change').click();expect(field('Explore onset delay d (samples)').value).toBe('0');expect(button('Undo source change').disabled).toBe(true);
  });
  it('rolls a selected pole range gesture back atomically and preserves keyboard onset focus',()=>{
    visit();const slider=field('Selected sequence parameter');pointer(slider,'pointerdown',7);slider.value='-0.5';slider.dispatchEvent(new Event('input'));expect(field('Explore geometric pole a').value).toBe('-0.5');window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));expect(field('Explore geometric pole a').value).toBe('0.8');expect(slider.value).toBe('0.8');expect(identity()).toContain('0.8');
    const target=document.querySelector<SVGElement>('[data-onset]')!;target.focus();target.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));expect(field('Explore onset delay d (samples)').value).toBe('1');expect(document.activeElement).toBe(document.querySelector('[data-onset]'));
  });
  it('cancels a native range gesture when its own pointer capture is lost',()=>{
    visit();const slider=field('Selected sequence parameter');pointer(slider,'pointerdown',7);slider.value='-.5';slider.dispatchEvent(new Event('input'));pointer(slider,'lostpointercapture',99);expect(field('Explore geometric pole a').value).toBe('-0.5');pointer(slider,'lostpointercapture',7);expect(field('Explore geometric pole a').value).toBe('0.8');expect(button('Undo source change').disabled).toBe(true);
  });
  it('consumes active-gesture Escape before an earlier shell listener, then permits ordinary shell Escape',()=>{
    const scope=new AbortController(),shell=vi.fn();window.addEventListener('keydown',shell,{signal:scope.signal});
    try{visit();const slider=field('Selected sequence parameter');pointer(slider,'pointerdown',7);slider.value='-.5';slider.dispatchEvent(new Event('input'));slider.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));expect(shell).not.toHaveBeenCalled();expect(field('Explore geometric pole a').value).toBe('0.8');slider.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));expect(shell).toHaveBeenCalledOnce();}finally{scope.abort();}
  });
  it('quarantines a cancelled native pointer stream until release while fresh keyboard actions remain explicit',()=>{
    visit();const slider=field('Selected sequence parameter');pointer(slider,'pointerdown',7);slider.value='-.5';slider.dispatchEvent(new Event('input'));slider.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));
    slider.value='.2';slider.dispatchEvent(new Event('input'));expect(slider.value).toBe('0.8');expect(field('Explore geometric pole a').value).toBe('0.8');expect(button('Undo source change').disabled).toBe(true);
    slider.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true,cancelable:true}));expect(field('Explore geometric pole a').value).toBe('0.81');slider.value='.2';slider.dispatchEvent(new Event('input'));expect(slider.value).toBe('0.81');
    pointer(window,'pointerup',99);slider.value='.2';slider.dispatchEvent(new Event('input'));expect(slider.value).toBe('0.81');pointer(window,'pointerup',7);slider.value='.2';slider.dispatchEvent(new Event('input'));expect(field('Explore geometric pole a').value).toBe('0.2');
  });
  it('does not publish a native candidate or undo history when its typesetting fails',()=>{
    visit();const initial=identity();rendering.onDisplay=()=>{throw Error('Typesetting failed');};set('Explore geometric pole a','-.5');expect(feedback()).toContain('last accepted');button('Fit sequence axes').click();set('Explore sample k','1');expect(identity()).toBe(initial);expect(document.body.textContent).toContain('x[k]=0.8; zero history 0.8');expect(button('Undo source change').disabled).toBe(true);
    rendering.onDisplay=undefined;set('Explore geometric pole a','-.5');expect(document.body.textContent).toContain('x[k]=-0.5; zero history -0.5');expect(identity()).not.toBe(initial);expect(button('Undo source change').disabled).toBe(false);
  });
  it('retains the starting checked identity on cancellation even if later typesetting would fail',()=>{
    visit();const initial=identity(),slider=field('Selected sequence parameter');pointer(slider,'pointerdown',7);slider.value='-.5';slider.dispatchEvent(new Event('input'));rendering.onDisplay=()=>{throw Error('Typesetting failed');};slider.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));expect(field('Explore geometric pole a').value).toBe('0.8');expect(identity()).toBe(initial);set('Explore sample k','1');expect(document.body.textContent).toContain('x[k]=0.8; zero history 0.8');expect(button('Undo source change').disabled).toBe(true);
  });
  it('rejects finite-length overflow atomically and marks fixed-axis truncation until Fit',()=>{
    visit();choose('Explore sequence family','sum');set('Explore onset delay d (samples)','12');expect(feedback()).toContain('last nonzero');expect(document.querySelector('[data-onset]')?.getAttribute('aria-label')).toContain('delay 0');set('Explore onset delay d (samples)','0');set('Sequence gain c','100');expect(document.body.textContent).toContain('triangles mark truncation');button('Fit sequence axes').click();expect(document.body.textContent).not.toContain('triangles mark truncation');
  });
  it('allocates no observer after initial rendering reentrantly aborts its parent',()=>{
    const observer=vi.fn();vi.stubGlobal('ResizeObserver',observer);const container=document.createElement('div'),parent=new AbortController();document.body.append(container);rendering.onDisplay=()=>parent.abort();release=mountExplore({container,signal:parent.signal})||undefined;expect(observer).not.toHaveBeenCalled();expect(container.children).toHaveLength(0);
  });
  it('disconnects an observer whose constructor aborts the parent without observing a removed view',()=>{
    const container=document.createElement('div'),parent=new AbortController(),observe=vi.fn(),disconnect=vi.fn();document.body.append(container);vi.stubGlobal('ResizeObserver',class{constructor(){parent.abort();}observe=observe;disconnect=disconnect;});release=mountExplore({container,signal:parent.signal})||undefined;expect(observe).not.toHaveBeenCalled();expect(disconnect).toHaveBeenCalledOnce();expect(container.children).toHaveLength(0);
  });
});
