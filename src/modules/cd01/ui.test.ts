import {afterEach,describe,expect,it,vi} from 'vitest';
import type {EquationDraft} from '../../shared/equations/input';
const mocks=vi.hoisted(()=>({editors:[]as{setValue:(s:string)=>void;edit:(s:string)=>void}[]}));
vi.mock('../../shared/equations/input',()=>({
  createEquationDisplay:(latex:string,label:string)=>{const e=document.createElement('div');e.textContent=latex;e.setAttribute('aria-label',label);return e;},
  createEquationInput:({label,value,signal,onChange}:{label:string;value:string;signal:AbortSignal;onChange:(d:EquationDraft)=>void})=>{
    let text=value;const element=document.createElement('div');element.setAttribute('aria-label',label);
    const getValue=():EquationDraft=>({latex:text,empty:!text,hasPlaceholders:false,syntaxIssues:[]});
    const editor={element,getValue,setValue:(s:string)=>{text=s;},edit:(s:string)=>{text=s;onChange(getValue());},destroy:()=>element.remove(),focus:vi.fn()};signal.addEventListener('abort',editor.destroy,{once:true});mocks.editors.push(editor);return editor;
  }
}));
import {mount} from './ui';
const cleanups:(()=>void)[]=[];
afterEach(()=>{cleanups.splice(0).forEach(fn=>fn());document.body.replaceChildren();mocks.editors.length=0;});
function open(){
  const root=document.createElement('div');root.dataset.module='CD01';document.body.append(root);const c=new AbortController(),dispose=mount({container:root,signal:c.signal});cleanups.push(()=>{c.abort();if(typeof dispose==='function')dispose();});
  const action=(name:string)=>root.querySelector<HTMLButtonElement>(`button[data-action="${name}"]`)!;
  const input=(name:string)=>root.querySelector<HTMLInputElement>(`input[name="${name}"]`)!;
  const set=(name:string,value:string)=>{const e=input(name);e.value=value;e.dispatchEvent(new Event('input',{bubbles:true}));};
  const choose=(name:string,value:string)=>{const e=root.querySelector<HTMLSelectElement>(`select[name="${name}"]`)!;e.value=value;e.dispatchEvent(new Event('input',{bubbles:true}));};
  const row=(name:string)=>[...root.querySelectorAll('tr')].find(r=>r.firstElementChild?.textContent===name)!;
  return{root,action,input,set,choose,row};
}
describe('reasoned linear controller teaching flow',()=>{
  it('checks the baseline prediction, complete modes, contributions and sample inspector',()=>{
    const v=open();expect(v.root.querySelectorAll('figure')).toHaveLength(0);expect(v.root.querySelectorAll('ol li')).toHaveLength(1);
    v.set('predictError','0');v.set('predictEffort','24');v.action('predict').click();expect(v.root.textContent).toContain('Prediction agrees');
    v.action('reveal').focus();v.action('reveal').click();expect(document.activeElement).toBe(v.action('reveal'));expect(v.root.textContent).toContain('All 4 actual modes');expect(v.root.querySelectorAll('figure')).toHaveLength(4);expect(v.row('Derivative effort').cells[1].textContent).toBe('20');expect(v.row('Total effort').cells[1].textContent).toBe('24');
    v.set('inspectTime','1');v.input('inspectTime').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));expect(v.root.textContent).toContain('nearest sample t=1s');expect(Number(v.row('Output y').cells[1].textContent)).toBeCloseTo(.7232639601893959,6);expect(document.activeElement).not.toBe(document.body);
    expect(v.root.querySelector('.pid-metrics')?.textContent).toContain('0.3333333');
  });
  it('requires and records a chosen reason before changed gains apply',()=>{
    const v=open();v.set('kp','5');v.action('apply').click();expect(v.root.textContent).toContain('Choose a reason before');expect(v.root.querySelectorAll('ol li')).toHaveLength(1);
    v.choose('reason','transient');v.action('apply').click();expect(v.root.querySelectorAll('ol li')).toHaveLength(2);expect(v.root.querySelector('ol li')?.textContent).toContain('Change overshoot');expect(v.root.querySelector('select[name="reason"]')?.textContent).toContain('Choose a reason');
  });
  it('derives a changed authored PID target and shows desired versus actual checks',()=>{
    const v=open();v.choose('reason','matching');v.action('derive').click();expect(Number(v.input('kp').value)).toBeCloseTo(8.26,10);expect(Number(v.input('ki').value)).toBeCloseTo(6.8,10);expect(Number(v.input('kd').value)).toBeCloseTo(2.187,10);
    v.action('reveal').click();expect(v.root.textContent).toContain('Desired versus actual');expect(v.root.textContent).toContain('All 4 actual modes');expect(Number(v.row('Total effort').cells[1].textContent)).toBeCloseTo(52,8);expect(v.root.textContent).toContain('exceeds the limit in the plotted samples');
  });
  it('rejects incompatible fixed coefficients and converts a target into a filter draft',()=>{
    const v=open();v.choose('kind','PI');mocks.editors[1].setValue('(s+2)^3');v.choose('reason','matching');v.action('derive').click();expect(v.root.textContent).toContain('leaves it fixed');expect(v.root.querySelectorAll('ol li')).toHaveLength(1);
    v.action('target').click();v.action('derive').click();expect(Number(v.input('kp').value)).toBeCloseTo(1,10);expect(Number(v.input('ki').value)).toBeCloseTo(1,10);
    v.choose('kind','PID');mocks.editors[1].setValue('(s+20)(s+2)^3');v.action('setFilter').click();expect(Number(v.input('tf').value)).toBeCloseTo(1/23,12);expect(v.root.textContent).toContain('Filter draft set');
  });
  it('keeps inactive terms and Kp=0 standard notation honest',()=>{
    const v=open();v.choose('kind','PI');v.set('ki','0');v.choose('reason','structure');v.action('apply').click();v.action('reveal').click();expect(v.root.textContent).toContain('active P');expect(v.root.textContent).toContain('All 2 actual modes');expect(v.root.querySelector('[aria-label="Individual active controller contributions"]')?.textContent).toContain('u_D=0');
    v.set('kp','0e-999');v.set('ki','2');v.choose('reason','accuracy');v.action('apply').click();v.action('reveal').click();expect(v.root.textContent).toContain('Kp=0');expect(v.root.textContent).toContain('standard form factored by Kp is unavailable');
  });
  it('uses the native reader and rejects invalid plant/target drafts with useful recovery',()=>{
    const v=open();v.set('kp','1e-999');v.choose('reason','data');v.action('apply').click();expect(v.root.textContent).toContain('too small to represent');
    v.action('baseline').click();v.choose('reason','data');v.action('apply').click();mocks.editors[0].edit('');v.choose('reason','data');v.action('apply').click();expect(v.root.textContent).toContain('Complete the plant');
    v.action('baseline').click();v.set('horizon','0');v.action('apply').click();expect(v.root.textContent).toContain('horizon');
  });
  it('uses changed initial memories in the actual individual terms',()=>{
    const v=open();v.set('y0','.2');v.set('v0','-.3');v.set('i0','.4');v.set('f0','.1');v.set('reference','.5');v.choose('reason','data');v.action('apply').click();v.action('reveal').click();expect(Number(v.row('Proportional effort').cells[1].textContent)).toBeCloseTo(1.2,8);expect(Number(v.row('Integral effort').cells[1].textContent)).toBeCloseTo(.8,8);expect(Number(v.row('Derivative effort').cells[1].textContent)).toBeCloseTo(4,8);expect(Number(v.row('Total effort').cells[1].textContent)).toBeCloseTo(6,8);
  });
  it('caps temporary notes and starts the next mount from the course baseline',()=>{
    const v=open();for(let k=0;k<9;k++){v.choose('reason','structure');v.action('apply').click();}expect(v.root.querySelectorAll('ol li')).toHaveLength(8);v.set('kp','7');v.choose('reason','effort');v.action('apply').click();const next=open();expect(next.input('kp').value).toBe('4');expect(next.root.querySelectorAll('ol li')).toHaveLength(1);expect(next.root.querySelectorAll('figure')).toHaveLength(0);
  });
  it('preserves the valid selected trial when a simpler comparison exceeds its response bound',()=>{
    const v=open();mocks.editors[0].edit(String.raw`G(s)=\frac1{s^2-s-1}`);v.set('kd','4');v.set('horizon','100');v.choose('reason','data');v.action('apply').click();v.action('reveal').click();expect(v.root.textContent).toContain('P comparison unavailable');expect(v.root.textContent).toContain('All 4 actual modes');expect(v.root.textContent).toContain('Classification: stable');expect(v.root.querySelectorAll('figure')).toHaveLength(4);
  });
});
