import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('../../shared/equations/input',()=>({
 createEquationDisplay:(value:string,label:string)=>{const el=document.createElement('p');el.textContent=`${label}: ${value}`;return el;},
 createEquationInput:(options:{value:string;label:string;onChange:(draft:unknown)=>void;signal:AbortSignal})=>{
  const element=document.createElement('div'),field=document.createElement('textarea');field.value=options.value;field.setAttribute('aria-label',options.label);element.append(field);
  const getValue=()=>({latex:field.value,empty:!field.value,hasPlaceholders:false,syntaxIssues:[]});
  field.addEventListener('input',()=>options.onChange(getValue()),{signal:options.signal});
  return{element,getValue,setValue:(v:string)=>{field.value=v;},destroy:()=>element.remove(),focus:()=>field.focus()};
 }
}));
import { mount } from './view';
afterEach(()=>document.body.replaceChildren());
function visit(){
 const container=document.createElement('div'),controller=new AbortController();container.dataset.module='CF03';document.body.append(container);
 const cleanup=mount({container,signal:controller.signal});
 const click=(name:string)=>container.querySelector<HTMLButtonElement>(`[data-action="${name}"]`)!.click();
 const input=(name:string,value:string)=>{const el=container.querySelector<HTMLInputElement>(`[name="${name}"]`)!;el.value=value;el.dispatchEvent(new Event('input'));};
 const select=(name:string,value:string)=>{const el=container.querySelector<HTMLSelectElement>(`[name="${name}"]`)!;el.value=value;el.dispatchEvent(new Event('change'));};
 return{container,controller,click,input,select,close:()=>{controller.abort();if(cleanup)cleanup();}};
}
describe('CF03 visit state and numeric-feedback integration (mocked equations)',()=>{
 it('checks a genuine ranking reversal and a separate finer quadrature',()=>{
  const v=visit();v.click('ranking');v.select('prediction','A');v.click('reveal');
  expect(v.container.querySelector('.cf-feedback')!.textContent).toContain('Correct. IAE: A');
  v.select('metric','ISE');v.select('prediction','B');v.click('reveal');
  expect(v.container.querySelector('.cf-feedback')!.textContent).toContain('Correct. ISE: B');
  v.click('verify');expect(v.container.querySelector('.cf-verification')!.textContent).toContain('independent composite trapezoid');
  expect(v.container.querySelector('.cf-verification')!.textContent).toContain('Consistent');v.close();
 });
 it('reports near-identical controllers as tied at the chosen comparison tolerance',()=>{
  const v=visit();const field=v.container.querySelectorAll('textarea')[2];field.value='C(s)=4.00001';field.dispatchEvent(new Event('input'));
  v.click('compute');v.select('prediction','tie');v.click('reveal');
  expect(v.container.querySelector('.cf-feedback')!.textContent).toContain('Correct. IAE: tie');
  expect(v.container.querySelector('.cf-reasoning')!.textContent).toContain('0.00001');v.close();
 });
 it('updates already revealed integral reasoning when the selected criterion changes',()=>{
  const v=visit();v.click('reveal');v.select('metric','ITSE');
  expect(v.container.querySelector<HTMLElement>('.cf-answer')!.hidden).toBe(false);
  expect(v.container.querySelector('.cf-reasoning')!.textContent).toContain('Selected finite-horizon integral: ITSE=');v.close();
 });
 it('clears old results on invalid raw horizon input and accepts normal numeric exponents',()=>{
  const v=visit();v.click('reveal');expect(v.container.querySelector<HTMLElement>('.cf-answer')!.hidden).toBe(false);
  v.input('horizon','1e-400');v.click('compute');
  expect(v.container.querySelector('.cf-status')!.textContent).toContain('nonzero but too small');
  expect(v.container.querySelector<HTMLElement>('.cf-answer')!.hidden).toBe(true);
  expect(v.container.querySelector('svg')).toBeNull();
  v.input('horizon','1e1');v.click('compute');expect(v.container.querySelector('.cf-status')!.textContent).toContain('both over 0…10 s');v.close();
 });
 it('preserves a valid inspection plot when a candidate time underflows, and accepts genuine zero',()=>{
  const v=visit(),old=v.container.querySelector('.cf-response')!.innerHTML;
  v.input('time','1e-400');expect(v.container.querySelector('.cf-inspection')!.textContent).toContain('nonzero but too small');
  expect(v.container.querySelector('.cf-response')!.innerHTML).toBe(old);
  v.input('time','0e-400');expect(v.container.querySelector('.cf-inspection')!.textContent).toContain('Simpson panel 1:');v.close();
 });
 it('invalidates changed equations, distinguishes unstable finite runs and restores a fresh visit',()=>{
  const v=visit();v.click('unstable');v.click('reveal');
  expect(v.container.querySelector('.cf-status')!.textContent).toContain('Strict stability is not established');
  const field=v.container.querySelector('textarea')!;field.value=String.raw`\frac{1{+2}}{s+1}`;field.dispatchEvent(new Event('input'));v.click('compute');
  expect(v.container.querySelector('.cf-status')!.textContent).toContain('visible parentheses');
  expect(v.container.querySelector('svg')).toBeNull();v.close();
  const next=visit();expect(next.container.querySelector<HTMLInputElement>('[name="horizon"]')!.value).toBe('10');
  expect(next.container.querySelectorAll('textarea')[1].value).toBe('C(s)=4');expect(next.container.querySelectorAll('textarea')[2].value).toBe('C(s)=8');
  expect(next.container.querySelector<HTMLElement>('.cf-answer')!.hidden).toBe(true);next.close();
 });
});
