import{afterEach,describe,expect,it,vi}from'vitest';
const state=vi.hoisted(()=>({live:new Set<HTMLInputElement>(),fail:''}));
vi.mock('../../shared/equations/input',()=>({
  createEquationDisplay:(value:string,label:string)=>{const e=document.createElement('div');e.textContent=value;e.setAttribute('aria-label',label);return e;},
  createEquationInput:({label,value,signal,onChange}:{label:string;value:string;signal:AbortSignal;onChange:()=>void})=>{if(state.fail===label)throw new Error('Partial editor failure');const e=document.createElement('input');e.setAttribute('aria-label',label);e.value=value;state.live.add(e);e.addEventListener('input',onChange,{signal});return{element:e,getValue:()=>({latex:e.value,empty:!e.value.trim(),hasPlaceholders:e.value.includes('\\placeholder'),syntaxIssues:[]}),setValue:(s:string)=>{e.value=s;onChange();},destroy:()=>{state.live.delete(e);e.remove();}};},
}));
import{mount}from'./view';
let clean:(()=>void)|undefined;
afterEach(()=>{clean?.();clean=undefined;document.body.replaceChildren();expect(state.live.size).toBe(0);state.fail='';});
function visit(){const container=document.createElement('div'),parent=new AbortController();document.body.append(container);clean=mount({container,signal:parent.signal})||undefined;return{container,parent};}
const button=(label:string)=>[...document.querySelectorAll('button')].find(e=>e.textContent===label)!;
const field=(label:string)=>document.querySelector(`input[aria-label="${label}"]`) as HTMLInputElement;
const menu=(label:string)=>document.querySelector(`select[aria-label="${label}"]`) as HTMLSelectElement;
function set(label:string,value:string){const e=field(label);e.value=value;e.dispatchEvent(new Event('input',{bubbles:true}));}
function select(label:string,value:string){const e=menu(label);e.value=value;e.dispatchEvent(new Event('change',{bubbles:true}));}
const feedback=()=>document.querySelector('.cr04-feedback')!.textContent!;
const local=()=>document.querySelectorAll('section')[1].textContent!;
const channels=()=>document.querySelectorAll('section')[2].textContent!;
const check=()=>button('Check proposed local change').click();
const apply=()=>button('Apply checked transformation').click();
function propose(value:string){set('Proposed local block or side-path gain',value);check();}
function channel(){button('Reveal and check selected transfer').click();}
function event(type:string,props:Record<string,number|boolean>){const e=new Event(type,{bubbles:true,cancelable:true});for(const[k,v]of Object.entries(props))Object.defineProperty(e,k,{value:v});return e;}
function startDrag(){const svg=document.querySelector('.cr04-canvas-scroll svg') as SVGSVGElement;vi.spyOn(svg,'getBoundingClientRect').mockReturnValue({left:0,top:0,width:1680,height:1020} as DOMRect);const node=svg.querySelector('[data-node-id="g1"]') as SVGGElement;const capture=vi.fn(),release=vi.fn();Object.assign(node,{setPointerCapture:capture,hasPointerCapture:()=>true,releasePointerCapture:release});node.dispatchEvent(event('pointerdown',{button:0,isPrimary:true,pointerId:7,clientX:510,clientY:280}));return{node,capture,release};}

describe('complete block-diagram student flow (mock math; actual browser separately)',()=>{
  it('starts at the nested graph and reveals both independently known scalar channels',()=>{
    visit();expect(state.live.size).toBe(3);expect(menu('Local motif').value).toBe('feedback:e2:g2:h2');expect(channels()).not.toContain('Current signal equations');set('Predicted selected transfer (optional)','1/(s^2+5s+5)');channel();expect(feedback()).toContain('exactly equivalent');expect(channels()).toContain('s^{2}+5s+5');expect(channels()).toContain('s+1');select('Channel to predict','d');expect(channels()).not.toContain('Current signal equations');set('Predicted selected transfer (optional)','(s+1)/(s^2+5s+5)');channel();expect(feedback()).toContain('exactly equivalent');
  });
  it('requires a checked local attempt and refuses a wrong inner reduction',()=>{
    visit();expect(button('Apply checked transformation').disabled).toBe(true);button('Reveal required local gain').click();expect(button('Apply checked transformation').disabled).toBe(true);propose('1');expect(button('Apply checked transformation').disabled).toBe(true);expect(local()).toContain('Tentative candidate');propose('1/(s+4)');expect(button('Apply checked transformation').disabled).toBe(false);apply();expect(menu('Local motif').value).toBe('sum-up:e2:g1:p4');expect(menu('Selected node').querySelector('option[value="h2"]')).toBeNull();
  });
  it('blocks wrong summer compensation that happens to preserve only the reference',()=>{
    visit();propose('1/(s+4)');apply();propose('1');expect(feedback()).toContain('reference channel agrees');expect(feedback()).toContain('disturbance channel changes');expect(local()).toContain('Reference channel: equal');expect(local()).toContain('Disturbance channel: CHANGED');expect(button('Apply checked transformation').disabled).toBe(true);propose('s+1');expect(button('Apply checked transformation').disabled).toBe(false);apply();expect(menu('Local motif').value).toBe('merge-sums:e1:e2:p4');
  });
  it('completes the nested route with both scalar channels retained',()=>{
    visit();for(const value of['1/(s+4)','s+1','1','1/((s+1)(s+4))','1/(s^2+5s+5)']){propose(value);expect(feedback()).toContain('both retained output channels agree');apply();}channel();expect(channels()).toContain('s^{2}+5s+5');expect(channels()).toContain('s+1');expect(document.body.textContent).toContain('Undo snapshots: 5/40');button('Undo last diagram change').click();channel();expect(channels()).toContain('s^{2}+5s+5');
  });
  it('computes the H2=3 experiment and handles signed series/parallel fixtures',()=>{
    visit();button('Load H2=3 variation').click();expect(menu('Selected node').value).toBe('h2');propose('1/(s+5)');expect(feedback()).toContain('agree exactly');channel();expect(channels()).toContain('s^{2}+6s+6');
    button('Load series exercise').click();expect(menu('Rule family').value).toBe('series');propose('1/((s+1)(s+2))');apply();channel();expect(channels()).toContain('s^{2}+3s+2');
    button('Load signed parallel exercise').click();expect(menu('Rule family').value).toBe('parallel');propose('1/((s+1)(s+2))');apply();channel();expect(channels()).toContain('s^{2}+3s+2');expect(channels()).toContain('Disturbance');
  });
  it('offers both compensated pickoff directions and summer downstream',()=>{
    visit();select('Rule family','pickoff-up');select('Local motif','pickoff-up:j:g2:p11');propose('1/(s+2)');expect(feedback()).toContain('agree exactly');apply();button('Load nested example').click();select('Rule family','pickoff-down');select('Local motif','pickoff-down:j:h2');propose('1/2');expect(feedback()).toContain('agree exactly');apply();button('Load nested example').click();propose('1/(s+4)');apply();select('Rule family','sum-down');select('Local motif','sum-down:e2:g2:p4');propose('1/(s+4)');expect(feedback()).toContain('agree exactly');
  });
  it('invalidates a stale checked proposal and applies gain edits only explicitly',()=>{
    visit();propose('1/(s+4)');set('Proposed local block or side-path gain','1');expect(button('Apply checked transformation').disabled).toBe(true);propose('1/(s+4)');set('Selected block gain in s','2/(s+1)');expect(button('Apply checked transformation').disabled).toBe(true);expect(button('Reveal and check selected transfer').disabled).toBe(true);select('Selected node','h2');expect(menu('Selected node').value).toBe('g1');button('Apply selected node edits').click();channel();expect(channels()).toContain('2');expect(channels()).toContain('s^{2}+5s+6');
  });
  it('edits sign/source ports, recovers missing connections and supports undo',()=>{
    visit();select('Selected node','e2');select('Input 3 sign','1');button('Apply selected node edits').click();channel();expect(channels()).toContain('s^{2}+s+1');select('Input 1 source','');button('Apply selected node edits').click();channel();expect(feedback()).toContain('Connect every');expect(channels()).not.toContain('Current signal equations');button('Undo last diagram change').click();channel();expect(channels()).toContain('s^{2}+s+1');
  });
  it('adds/removes structured nodes and ports without retaining stale row listeners',()=>{
    visit();select('Selected node','e2');const old=menu('Input 1 source');button('Add summer input port').click();select('Input 4 source','d');button('Apply selected node edits').click();channel();expect(channels()).toContain('Current signal equations');old.value='r';old.dispatchEvent(new Event('change'));expect(button('Reveal and check selected transfer').disabled).toBe(false);button('Remove input 4').click();button('Apply selected node edits').click();channel();expect(channels()).toContain('Current signal equations');
    button('Add node').click();const added=menu('Selected node').value;expect(added).toMatch(/^n\d+$/);channel();expect(feedback()).toContain('Connect every');button('Undo last diagram change').click();expect([...menu('Selected node').options].some(o=>o.value===added)).toBe(false);
  });
  it('keeps protected sources/output and reports duplicate names or malformed gains',()=>{
    visit();set('Node label','H2');button('Apply selected node edits').click();expect(feedback()).toContain('distinct');button('Discard pending node edits').click();set('Selected block gain in s','\\frac{1}{\\placeholder{}}');button('Apply selected node edits').click();expect(feedback()).toContain('Complete');button('Discard pending node edits').click();select('Selected node','y');expect(button('Delete selected node').disabled).toBe(true);expect(field('Node label').disabled).toBe(true);
  });
  it('rejects native unfinished/underflow positions while preserving the committed model',()=>{
    visit();set('Node x (layout units)','1e-999');button('Apply selected node edits').click();expect(feedback()).toContain('too small');button('Discard pending node edits').click();const x=field('Node x (layout units)');Object.defineProperty(x,'validity',{configurable:true,value:{badInput:true}});x.value='';x.dispatchEvent(new Event('input'));button('Apply selected node edits').click();expect(feedback()).toContain('finite');
  });
  it('keeps channel mathematics invariant under numeric and keyboard moves',()=>{
    visit();set('Node x (layout units)','520');set('Node y (layout units)','270');button('Apply selected node edits').click();channel();expect(channels()).toContain('s^{2}+5s+5');const node=document.querySelector('g[data-node-id="g1"]')!;node.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));expect(field('Node x (layout units)').value).toBe('540');button('Undo last diagram change').click();expect(field('Node x (layout units)').value).toBe('520');channel();expect(channels()).toContain('s^{2}+5s+5');
  });
  it('retains the focused node across repeated arrow moves and a shifted move',()=>{
    visit();const current=()=>document.querySelector<SVGGElement>('.cr04-canvas-scroll g[data-node-id="g1"]')!;
    current().focus();expect(document.activeElement).toBe(current());
    for(const x of['440','460']){
      document.activeElement!.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true,cancelable:true}));
      expect(field('Node x (layout units)').value).toBe(x);expect(document.activeElement).toBe(current());
    }
    document.activeElement!.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',shiftKey:true,bubbles:true,cancelable:true}));
    expect(field('Node y (layout units)').value).toBe('300');expect(document.activeElement).toBe(current());expect(document.body.textContent).toContain('Undo snapshots: 3/40');
  });
  it('does not move focus from editing controls or preset buttons on other redraws',()=>{
    visit();const x=field('Node x (layout units)');x.focus();set('Node x (layout units)','520');
    expect(document.activeElement).toBe(x);button('Apply selected node edits').click();expect(document.activeElement).toBe(x);
    const preset=button('Load H2=3 variation');preset.focus();preset.click();expect(document.activeElement).toBe(preset);
  });
  it('commits exactly one drag snapshot and releases pointer capture',()=>{
    visit();const {capture,release}=startDrag();window.dispatchEvent(event('pointermove',{pointerId:7,clientX:610,clientY:330}));expect(field('Node x (layout units)').value).toBe('520');expect(field('Node y (layout units)').value).toBe('270');window.dispatchEvent(event('pointerup',{pointerId:7}));expect(capture).toHaveBeenCalledWith(7);expect(release).toHaveBeenCalledExactlyOnceWith(7);expect(document.body.textContent).toContain('Undo snapshots: 1/40');button('Undo last diagram change').click();expect(field('Node x (layout units)').value).toBe('420');window.dispatchEvent(event('pointermove',{pointerId:7,clientX:700,clientY:400}));expect(field('Node x (layout units)').value).toBe('420');
  });
  it.each(['blur','pointercancel','escape'])('cancels a drag on %s without changing history',kind=>{
    visit();const {release}=startDrag();window.dispatchEvent(event('pointermove',{pointerId:7,clientX:610,clientY:330}));window.dispatchEvent(kind==='escape'?new KeyboardEvent('keydown',{key:'Escape'}):new Event(kind));expect(field('Node x (layout units)').value).toBe('420');expect(button('Undo last diagram change').disabled).toBe(true);expect(release).toHaveBeenCalledWith(7);
  });
  it('aborts active pointer work and old controls before reopening a fresh baseline',()=>{
    const first=visit();const {release}=startDrag(),old=button('Reveal and check selected transfer');first.parent.abort();window.dispatchEvent(event('pointerup',{pointerId:7}));old.click();expect(first.container.children).toHaveLength(0);expect(release).toHaveBeenCalledWith(7);expect(state.live.size).toBe(0);clean?.();visit();expect(field('Node x (layout units)').value).toBe('420');expect(button('Undo last diagram change').disabled).toBe(true);expect(state.live.size).toBe(3);
  });
  it('cleans a partial inspector initialization with the parent still active',()=>{
    state.fail='Selected block gain in s';const container=document.createElement('div'),parent=new AbortController();document.body.append(container);expect(()=>mount({container,signal:parent.signal})).toThrow('Partial editor');expect(parent.signal.aborted).toBe(false);expect(container.children).toHaveLength(0);expect(state.live.size).toBe(0);
  });
});
