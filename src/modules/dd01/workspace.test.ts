import { afterEach,describe,expect,it,vi } from 'vitest';
import type { EquationInputOptions } from '../../shared/equations/input';
// Test double checks exercise flow only. Actual editor/keyboard/fonts require browser QA.
vi.mock('../../shared/equations/input',()=>({
  createEquationDisplay:(latex:string,label:string)=>{const n=document.createElement('div');n.textContent=latex;n.setAttribute('aria-label',label);return n;},
  createEquationInput:(options:EquationInputOptions)=>{
    const element=document.createElement('div'),input=document.createElement('textarea');input.value=options.value;input.setAttribute('aria-label',options.label);element.append(input);
    const getValue=()=>({latex:input.value,empty:!input.value.trim(),hasPlaceholders:input.value.includes('placeholder'),syntaxIssues:[]});
    input.addEventListener('input',()=>options.onChange?.(getValue()),{signal:options.signal});options.signal.addEventListener('abort',()=>element.remove(),{once:true});
    return{element,getValue,setValue:(value:string)=>{input.value=value;},focus:()=>input.focus(),destroy:()=>element.remove()};
  },
}));
import { mount } from './workspace';
const label=<T extends HTMLElement>(host:HTMLElement,text:string):T=>{const node=host.querySelector<T>(`[aria-label="${text}"]`);if(!node)throw new Error(`Missing ${text}`);return node;};
const update=(node:HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement,value:string,event='input')=>{node.value=value;node.dispatchEvent(new Event(event,{bubbles:true}));};
async function open(){const container=document.createElement('div');container.dataset.module='DD01';document.body.append(container);const controller=new AbortController(),cleanup=mount({container,signal:controller.signal});await vi.waitFor(()=>expect(container.querySelector('textarea')).not.toBeNull());return{container,controller,cleanup,reveal:()=>[...container.querySelectorAll('button')].find(b=>b.textContent==='Reveal and test actual loop')!.click()};}
afterEach(()=>document.body.replaceChildren());
describe('DD01 teaching flow and numerical controls',()=>{
  it('starts unrevealed and checks an independent recurrence attempt',async()=>{
    const {container,controller,reveal}=await open();expect(container.querySelector('svg')).toBeNull();
    update(label(container,'Prediction α'),'7/13');update(label(container,'Prediction β₀'),'136/13');update(label(container,'Prediction β₁'),'-8');reveal();
    expect(container.textContent?.match(/Matches/g)).toHaveLength(3);expect(label(container,'Exact primitive integer coefficients').textContent).toContain('136z+(-104)');expect(label(container,'Checked controller recurrence').textContent).toContain('\\frac{136}{13}');expect(container.querySelectorAll('svg')).toHaveLength(2);
    expect(container.textContent).toContain('Classification: stable');expect(container.textContent).toContain('0.84210526');controller.abort();
  });
  it('changes period/method, invalidates old output and recomputes the actual loop',async()=>{
    const {container,controller,reveal}=await open();reveal();update(label(container,'Sample period T (s)'),'.2');expect(container.querySelector('svg')).toBeNull();reveal();expect(label(container,'Exact primitive integer coefficients').textContent).toContain('38z+(-22)');
    update(label(container,'Controller approximation'),'forward','change');update(label(container,'Sample period T (s)'),'.5');reveal();expect(container.textContent).toContain('Classification: unstable');expect(container.textContent).toContain('Stopped before sample');controller.abort();
  });
  it('supports prewarping only for Tustin and retains a derivative-filter example',async()=>{
    const {container,controller,reveal}=await open();const check=container.querySelector<HTMLInputElement>('input[type=checkbox]')!;check.checked=true;check.dispatchEvent(new Event('change'));reveal();expect(container.textContent).toContain('numerical trigonometry');
    update(label(container,'Controller approximation'),'backward','change');expect(check.checked).toBe(false);expect(check.disabled).toBe(true);
    update(label(container,'Controller approximation'),'tustin','change');update(label(container,'Controller example'),'derivative','change');reveal();expect(label(container,'Exact primitive integer coefficients').textContent).toContain('10z+(-10)');controller.abort();
  });
  it('clears computed output on bad scalar drafts and distinguishes incomplete entry',async()=>{
    const {container,controller,reveal}=await open();reveal();update(label(container,'b₁: controller numerator s coefficient'),'2\\frac12');reveal();expect(container.querySelector('svg')).toBeNull();expect(container.textContent).toContain('Mixed numbers');
    update(label(container,'b₁: controller numerator s coefficient'),'');reveal();expect(container.textContent).toContain('Enter b₁');
    update(label(container,'b₁: controller numerator s coefficient'),'\\placeholder{}');reveal();expect(container.textContent).toContain('Complete the highlighted boxes');controller.abort();
  });
  it('rejects invalid native values without converting them to zero',async()=>{
    const {container,controller,reveal}=await open();reveal();update(label(container,'Inspect sample k'),'1e-999');expect(container.textContent).toContain('nonzero but too small');
    update(label(container,'Inspect sample k'),'0e-999');expect(label(container,'Current sample arithmetic').textContent).toContain('u[0]');
    update(label(container,'Inspect frequency ω (rad/s)'),'1e-2');expect(container.textContent).toContain('At ω=0.01');
    update(label(container,'Inspect frequency ω (rad/s)'),'1e-999');expect(container.textContent).toContain('nonzero but too small');
    update(label(container,'Inspect frequency ω (rad/s)'),'0e-999');expect(container.textContent).toContain('At ω=0');
    update(label(container,'Inspect frequency ω (rad/s)'),'1e-7');expect(container.textContent).toContain('0.000001 rad/s');
    update(label(container,'Sample period T (s)'),'1e-999');reveal();expect(container.querySelector('svg')).toBeNull();expect(container.textContent).toContain('nonzero but too small');
    update(label(container,'Sample period T (s)'),'1e-2');reveal();expect(container.querySelector('svg')).not.toBeNull();
    update(label(container,'Sample intervals'),'20.5');reveal();expect(container.textContent).toContain('20–500');controller.abort();
  });
  it('releases obsolete result listeners on recalculation and starts fresh after leaving',async()=>{
    const first=await open();first.reveal();const old=label<HTMLInputElement>(first.container,'Inspect sample k'),oldOutput=old.parentElement!.parentElement!.nextElementSibling!,text=oldOutput.textContent;
    first.reveal();update(old,'1');expect(oldOutput.textContent).toBe(text);
    update(label(first.container,'Controller example'),'pi','change');first.controller.abort();if(typeof first.cleanup==='function')first.cleanup();expect(first.container.childElementCount).toBe(0);
    const second=await open();expect(label<HTMLTextAreaElement>(second.container,'a₀: controller denominator constant').value).toBe('6');expect(second.container.querySelector('svg')).toBeNull();second.controller.abort();
  });
});
