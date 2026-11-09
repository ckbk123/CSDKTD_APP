import{afterEach,describe,expect,it,vi}from'vitest';
import type{EquationDraft,EquationInputOptions}from'../../shared/equations/input';
vi.mock('../../shared/equations/input',()=>({
  createEquationInput:(options:EquationInputOptions)=>{const element=document.createElement('div'),input=document.createElement('textarea');input.value=options.value;input.setAttribute('aria-label',options.label);element.append(input);const getValue=():EquationDraft=>({latex:input.value,empty:!input.value,hasPlaceholders:false,syntaxIssues:[]});input.addEventListener('input',()=>options.onChange?.(getValue()),{signal:options.signal});return{element,getValue,setValue:(s:string)=>{input.value=s;},focus:()=>input.focus(),destroy:()=>element.remove()};},
  createEquationDisplay:(s:string,label:string)=>{const e=document.createElement('div');e.textContent=s;e.setAttribute('aria-label',label);return e;}
}));
import{mountView}from'./view';
let release:(()=>void)|undefined;afterEach(()=>{release?.();release=undefined;document.body.replaceChildren();});
function visit(){const container=document.createElement('div'),parent=new AbortController();document.body.append(container);release=mountView({container,signal:parent.signal})||undefined;return{container,parent};}
const button=(text:string)=>[...document.querySelectorAll('button')].find(b=>b.textContent===text)!;
const practiceField=(name:string)=>[...document.querySelectorAll('label')].find(e=>e.firstChild?.textContent===name)!.querySelector('input')!;
const mode=(value:string)=>{const e=document.querySelector<HTMLSelectElement>('[aria-label="Learning mode"]')!;e.value=value;e.dispatchEvent(new Event('change',{bubbles:true}));};
describe('original inverse Practice beside independent sequence exploration',()=>{
  it('retains original predictions, arbitrary transform and histories independently of Explore',()=>{
    visit();const original=document.querySelector<HTMLTextAreaElement>('[aria-label="Zero-history transform X₀(z)"]')!;const source=document.querySelector<HTMLInputElement>('[aria-label="Explore geometric pole a"]')!;source.value='-.5';source.dispatchEvent(new Event('input',{bubbles:true}));expect(original.value).toContain('z-0.8');
    mode('practice');expect(document.querySelector('.dr01-results')?.hasAttribute('hidden')).toBe(true);const h=practiceField('Initial x[−1]');h.value='2';h.dispatchEvent(new Event('input'));button('Reveal and check sequence').click();expect(document.querySelector('tbody tr')?.textContent).toBe('0012.6');
    original.value='1/(1+z^{-2})';original.dispatchEvent(new Event('input'));h.value='0';h.dispatchEvent(new Event('input'));button('Reveal and check sequence').click();expect([...document.querySelectorAll('tbody tr')].slice(0,4).map(e=>e.lastChild?.textContent)).toEqual(['1','0','-1','0']);
    mode('explore');expect(source.value).toBe('-.5');expect(document.querySelector('.dr01-explore')?.textContent).toContain('Retained pole -0.5');mode('practice');expect(original.value).toBe('1/(1+z^{-2})');
  });
  it('retains a native incomplete optional prediction through a mode/Fit roundtrip and rejects it before recovery',()=>{
    visit();mode('practice');const prediction=practiceField('Your x[0]');prediction.value='';Object.defineProperty(prediction,'validity',{configurable:true,value:{badInput:true}});prediction.dispatchEvent(new Event('input'));const writes=vi.spyOn(prediction,'value','set');
    mode('explore');button('Fit sequence axes').click();mode('practice');expect(practiceField('Your x[0]')).toBe(prediction);expect(writes).not.toHaveBeenCalled();button('Reveal and check sequence').click();expect(document.querySelector('.dr01-results')?.hasAttribute('hidden')).toBe(true);expect([...document.querySelectorAll('.dr01-message')].at(-1)?.textContent).toContain('finite');
    writes.mockRestore();Object.defineProperty(prediction,'validity',{configurable:true,value:{badInput:false}});prediction.value='1';prediction.dispatchEvent(new Event('input'));button('Reveal and check sequence').click();expect(document.querySelector('.dr01-results')?.hasAttribute('hidden')).toBe(false);expect(document.body.textContent).toContain('x[0]: matches');
  });
});
