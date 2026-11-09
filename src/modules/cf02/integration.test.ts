import{afterEach,describe,expect,it,vi}from'vitest';
vi.mock('../../shared/equations/input',()=>({
  createEquationInput:({label,value,signal,onChange}:{label:string;value:string;signal:AbortSignal;onChange:()=>void})=>{const element=document.createElement('div'),input=document.createElement('input');input.type='text';input.value=value;input.setAttribute('aria-label',label);element.append(input);input.addEventListener('input',onChange,{signal});return{element,getValue:()=>({latex:input.value,empty:!input.value,hasPlaceholders:false,syntaxIssues:[]}),setValue:(s:string)=>{input.value=s;},focus:()=>input.focus(),destroy:()=>element.remove()};},
  createEquationDisplay:(text:string,label:string)=>{const e=document.createElement('div');e.textContent=text;e.setAttribute('aria-label',label);return e;}
}));
import{mount}from'./panels';
let release:(()=>void)|undefined;afterEach(()=>{release?.();release=undefined;vi.useRealTimers();vi.restoreAllMocks();document.body.replaceChildren();});
const field=(name:string)=>[...document.querySelectorAll('label')].find(l=>l.firstChild?.textContent===name)!.querySelector<HTMLInputElement|HTMLSelectElement>('input,select')!;
const mode=(value:string)=>{const e=document.querySelector<HTMLSelectElement>('[aria-label="Learning mode"]')!;e.value=value;e.dispatchEvent(new Event('change'));};
const submit=()=>document.querySelector('form')!.dispatchEvent(new Event('submit',{cancelable:true}));
async function visit(){vi.useFakeTimers();const container=document.createElement('div'),parent=new AbortController();document.body.append(container);release=mount({container,signal:parent.signal})||undefined;await vi.dynamicImportSettled();return{container,parent};}
describe('original error-limit Practice remains independent of live exploration',()=>{
  it('keeps the full original equation exercise and its exact result separate from Explore changes',async()=>{
    await visit();const gain=document.querySelector<HTMLInputElement>('[aria-label="Explore normalized gain g"]')!;gain.value='8';gain.dispatchEvent(new Event('input'));vi.advanceTimersByTime(40);expect(document.querySelector('[aria-label="Checked exact limit or long-time polynomial"]')?.textContent).toContain('\\frac{1}{4}');
    mode('practice');expect(document.querySelector('[aria-label="Numerator N(s)"]')?.getAttribute('value')).not.toBe('8');expect((document.querySelector('[aria-label="Numerator N(s)"]')as HTMLInputElement).value).toBe('4');submit();expect(document.querySelector('[aria-label="Checked exact steady-state error"]')?.textContent).toContain('\\frac{1}{2}');
    const sensor=field('Sensor gain H (dimensionless)');sensor.value='2';sensor.dispatchEvent(new Event('input',{bubbles:true}));const selected=field('Error to predict');selected.value='physical';selected.dispatchEvent(new Event('change',{bubbles:true}));submit();expect(document.querySelector('[aria-label="Exact long-time polynomial part"]')?.textContent).toContain('\\frac{1}{2}t');
    mode('explore');expect(gain.value).toBe('8');expect(document.querySelector('[aria-label="Checked exact limit or long-time polynomial"]')?.textContent).toContain('\\frac{1}{4}');
  });
  it('preserves a same-element native prediction draft through a mode/Fit roundtrip and recovers normally',async()=>{
    await visit();mode('practice');const prediction=field('Predicted behavior');prediction.value='finite';prediction.dispatchEvent(new Event('change',{bubbles:true}));const value=field('Predicted finite error (if chosen)')as HTMLInputElement;value.value='';Object.defineProperty(value,'validity',{configurable:true,value:{badInput:true}});value.dispatchEvent(new Event('input',{bubbles:true}));const writes=vi.spyOn(value,'value','set');mode('explore');[...document.querySelectorAll('button')].find(b=>b.textContent==='Fit checked trace axes')!.click();mode('practice');expect(field('Predicted finite error (if chosen)')).toBe(value);expect(writes).not.toHaveBeenCalled();submit();expect([...document.querySelectorAll('.cf-feedback')].at(-1)?.textContent).toContain('finite');expect(document.querySelector('[aria-label="Checked exact steady-state error"]')).toBeNull();
    writes.mockRestore();Object.defineProperty(value,'validity',{configurable:true,value:{badInput:false}});value.value='.5';value.dispatchEvent(new Event('input',{bubbles:true}));submit();expect([...document.querySelectorAll('.cf-feedback')].at(-1)?.textContent).toContain('prediction agrees');
  });
});
