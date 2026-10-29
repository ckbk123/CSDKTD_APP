import { afterEach,describe,expect,it,vi } from 'vitest';
import type { EquationInputOptions } from '../../shared/equations/input';
// Exercise flow double only; actual fonts/fractions/keyboard are verified separately in a browser.
vi.mock('../../shared/equations/input',()=>({
  createEquationDisplay:(latex:string,label:string)=>{const n=document.createElement('div');n.textContent=latex;n.setAttribute('aria-label',label);return n;},
  createEquationInput:(options:EquationInputOptions)=>{const element=document.createElement('div'),input=document.createElement('textarea');input.value=options.value;input.setAttribute('aria-label',options.label);element.append(input);
    const getValue=()=>({latex:input.value,empty:!input.value.trim(),hasPlaceholders:input.value.includes('placeholder'),syntaxIssues:[]});
    input.addEventListener('input',()=>options.onChange?.(getValue()),{signal:options.signal});options.signal.addEventListener('abort',()=>element.remove(),{once:true});return{element,getValue,setValue:(value:string)=>{input.value=value;},focus:()=>input.focus(),destroy:()=>element.remove()};},
}));
import { mount } from './workspace';
const labeled=<T extends HTMLElement>(host:HTMLElement,text:string):T=>{const n=host.querySelector<T>(`[aria-label="${text}"]`);if(!n)throw new Error('Missing '+text);return n;};
const button=(host:HTMLElement,text:string)=>[...host.querySelectorAll('button')].find(n=>n.textContent===text)!;
const update=(node:HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement,value:string,event='input')=>{node.value=value;node.dispatchEvent(new Event(event,{bubbles:true}));};
async function open(){const container=document.createElement('div');container.dataset.module='CF04';document.body.append(container);const controller=new AbortController(),cleanup=mount({container,signal:controller.signal});await vi.waitFor(()=>expect(container.querySelector('textarea')).not.toBeNull());return{container,controller,cleanup,reveal:()=>button(container,'Reveal frequency specifications').click()};}
afterEach(()=>document.body.replaceChildren());
describe('CF04 channels, change/hold experiments and bounded native controls',()=>{
  it('keeps results hidden until reveal and checks all channel predictions',async()=>{
    const {container,controller,reveal}=await open();expect(container.querySelector('svg')).toBeNull();
    update(labeled(container,'Channel for gain/phase margins'),'L','change');update(labeled(container,'Channel for resonance/bandwidth'),'T','change');update(labeled(container,'Change only τz/τp: what happens to Kv?'),'same','change');reveal();
    expect(container.textContent).toContain('Margin channel: correct');expect(container.textContent).toContain('Response channel: correct');expect(container.textContent).toContain('Kv prediction: correct');
    expect(container.textContent).toContain('51.827292');expect(labeled(container,'Unity-gain equation').textContent).toContain('+(4)x+(-16)');expect(container.textContent).toContain('Gain margin: infinite');expect(container.querySelectorAll('svg')).toHaveLength(3);controller.abort();
  });
  it('holds the baseline and compares the course lead without changing Kv',async()=>{
    const {container,controller,reveal}=await open();reveal();button(container,'Hold this result for comparison').click();update(labeled(container,'Frequency example'),'lead','change');expect(container.querySelector('svg')).toBeNull();reveal();
    expect(container.textContent).toContain('64.471221');expect(container.textContent).toContain('Held comparison');const table=[...container.querySelectorAll('table')].find(t=>t.textContent?.includes('Model'))!;
    expect(table.textContent).toContain('Held51.8272922');expect(table.textContent).toContain('Current64.4712212');expect(container.querySelector('.cf04-held')).not.toBeNull();controller.abort();
  });
  it('selects T resonance/bandwidth and L gain crossing markers',async()=>{
    const {container,controller,reveal}=await open();reveal();update(labeled(container,'Inspect a crossing or peak'),'r0','change');expect(labeled<HTMLSelectElement>(container,'Displayed transfer channel').value).toBe('T');expect(labeled<HTMLInputElement>(container,'Frequency cursor ω (rad/s)').valueAsNumber).toBeCloseTo(Math.sqrt(2),9);expect(container.textContent).toContain('T(jω) at');
    update(labeled(container,'Inspect a crossing or peak'),'g0','change');expect(labeled<HTMLSelectElement>(container,'Displayed transfer channel').value).toBe('L');expect(container.textContent).toContain('L(jω) at');controller.abort();
  });
  it('does not assign stable performance to boundary or unstable lag',async()=>{
    const {container,controller,reveal}=await open();for(const example of['boundary','unstable']){update(labeled(container,'Frequency example'),example,'change');reveal();expect(container.textContent).toContain('undefined as stable performance');expect(container.textContent).not.toContain('Global closed-loop peak');}
    update(labeled(container,'Frequency example'),'boundary','change');reveal();update(labeled(container,'Displayed transfer channel'),'T','change');update(labeled(container,'Frequency cursor ω (rad/s)'),'1');expect(container.textContent).toContain('singular');expect(container.querySelectorAll('svg')).toHaveLength(3);controller.abort();
  });
  it('rejects unsupported/incomplete math and clears stale results',async()=>{
    const {container,controller,reveal}=await open();reveal();update(labeled(container,'Controller DC gain K'),'2\\frac12');reveal();expect(container.querySelector('svg')).toBeNull();expect(container.textContent).toContain('Mixed numbers');
    update(labeled(container,'Controller DC gain K'),'');reveal();expect(container.textContent).toContain('Enter Controller DC gain');update(labeled(container,'Controller DC gain K'),'\\placeholder{}');reveal();expect(container.textContent).toContain('Complete the highlighted');controller.abort();
  });
  it('distinguishes native underflow, actual zero, exponent notation and window bounds',async()=>{
    const {container,controller,reveal}=await open();reveal();update(labeled(container,'Frequency cursor ω (rad/s)'),'1e-999');expect(container.textContent).toContain('nonzero but too small');expect(container.querySelector('svg')).toBeNull();
    update(labeled(container,'Frequency cursor ω (rad/s)'),'0e-999');expect(container.textContent).toContain('pole at DC');expect(container.querySelector('svg')).not.toBeNull();
    update(labeled(container,'Displayed transfer channel'),'T','change');expect(container.textContent).toContain('magnitude=1');update(labeled(container,'Frequency cursor ω (rad/s)'),'1e-2');expect(container.textContent).toContain('ω=0.01');
    update(labeled(container,'Window minimum ω (rad/s)'),'100');expect(container.querySelector('svg')).toBeNull();expect(container.textContent).toContain('increasing frequency window');
    update(labeled(container,'Window minimum ω (rad/s)'),'.01');update(labeled(container,'Nyquist half-width'),'0');expect(container.textContent).toContain('0.25–1000');controller.abort();
  });
  it('clicks a Bode plot with a numeric alternative and cleans old result listeners',async()=>{
    const {container,controller,reveal}=await open();reveal();const svg=container.querySelector<SVGSVGElement>('svg[data-bode]')!;svg.getBoundingClientRect=()=>({left:0,top:0,width:720,height:310} as DOMRect);
    svg.dispatchEvent(new MouseEvent('pointerdown',{bubbles:true,clientX:380,clientY:100}));expect(labeled<HTMLInputElement>(container,'Frequency cursor ω (rad/s)').valueAsNumber).toBeCloseTo(1,10);
    const wide=container.querySelector<SVGSVGElement>('svg[data-bode]')!;wide.getBoundingClientRect=()=>({left:0,top:0,width:900,height:310} as DOMRect);
    wide.dispatchEvent(new MouseEvent('pointerdown',{bubbles:true,clientX:628,clientY:100}));expect(labeled<HTMLInputElement>(container,'Frequency cursor ω (rad/s)').valueAsNumber).toBeCloseTo(10,10);
    const old=labeled<HTMLInputElement>(container,'Frequency cursor ω (rad/s)');reveal();update(old,'9');expect(labeled<HTMLInputElement>(container,'Frequency cursor ω (rad/s)').value).toBe('1');controller.abort();
  });
  it('restores a fresh baseline on reopen and removes held visit state',async()=>{
    const first=await open();first.reveal();button(first.container,'Hold this result for comparison').click();first.controller.abort();if(typeof first.cleanup==='function')first.cleanup();expect(first.container.childElementCount).toBe(0);
    const second=await open();expect(second.container.querySelector('svg')).toBeNull();expect(labeled<HTMLSelectElement>(second.container,'Frequency example').value).toBe('baseline');second.reveal();expect(second.container.textContent).not.toContain('Held comparison');second.controller.abort();
  });
});
