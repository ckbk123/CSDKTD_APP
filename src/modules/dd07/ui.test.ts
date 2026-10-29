import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EquationDraft } from '../../shared/equations/input';
const mocks = vi.hoisted(()=>({editors:[] as { setValue:(s:string)=>void; edit:(s:string)=>void; destroy:()=>void }[]}));
vi.mock('../../shared/equations/input',()=>({
  createEquationDisplay:(latex:string,label:string)=>{const e=document.createElement('p');e.textContent=latex;e.setAttribute('aria-label',label);return e;},
  createEquationInput:({value,label,signal,onChange}:{value:string;label:string;signal:AbortSignal;onChange:(d:EquationDraft)=>void})=>{
    let text=value;const element=document.createElement('div');element.setAttribute('aria-label',label);
    const draft=():EquationDraft=>({latex:text,empty:!text,hasPlaceholders:false,syntaxIssues:[]});
    const editor={element,getValue:draft,setValue:(s:string)=>{text=s;},edit:(s:string)=>{text=s;onChange(draft());},focus:vi.fn(),destroy:vi.fn(()=>element.remove())};
    signal.addEventListener('abort',editor.destroy,{once:true});mocks.editors.push(editor);return editor;
  }
}));
import {mount} from './ui';
const cleanups:(()=>void)[]=[];
afterEach(()=>{cleanups.splice(0).forEach(fn=>fn());document.body.replaceChildren();mocks.editors.length=0;});
function open(){
  const host=document.createElement('div');host.dataset.module='DD07';document.body.append(host);const c=new AbortController(),dispose=mount({container:host,signal:c.signal});cleanups.push(()=>{c.abort();if(typeof dispose==='function')dispose();});
  const action=(name:string)=>host.querySelector<HTMLButtonElement>(`button[data-action="${name}"]`)!;
  const input=(name:string)=>host.querySelector<HTMLInputElement>(`input[name="${name}"]`)!;
  const set=(name:string,value:string)=>{const field=input(name);field.value=value;field.dispatchEvent(new Event('input',{bubbles:true}));};
  const select=(name:string,value:string)=>{const field=host.querySelector<HTMLSelectElement>(`select[name="${name}"]`)!;field.value=value;field.dispatchEvent(new Event('input',{bubbles:true}));field.dispatchEvent(new Event('change',{bubbles:true}));};
  const row=(name:string)=>Array.from(host.querySelectorAll('tr')).find(r=>r.firstElementChild?.textContent===name)!;
  return{host,action,input,set,select,row};
}
describe('sampled observer exercise controls and lifecycle',()=>{
  it('walks through rows, gain prediction, actual modes and the sample table',()=>{
    const v=open();expect(v.host.querySelectorAll('svg')).toHaveLength(0);expect(v.input('reference').disabled).toBe(true);v.action('row').click();expect(v.host.textContent).toContain('numerical rank2');
    v.set('l1','1.0235681711139415');v.set('l2','1.4989840706820907');v.action('check').click();expect(v.host.textContent).toContain('Candidate actual modes');
    v.action('reveal').focus();v.action('reveal').click();expect(document.activeElement).toBe(v.action('reveal'));expect(v.host.querySelectorAll('svg')).toHaveLength(7);expect(v.row('Estimated x̂₁').cells[1].textContent).toBe('0');expect(v.row('Error e₁').cells[1].textContent).toBe('1');
    v.set('inspectSample','10');v.input('inspectSample').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));expect(v.host.querySelector('caption')?.textContent).toContain('k=10, t=1s');expect(Number(v.row('True x₁').cells[1].textContent)).toBeCloseTo(2*Math.exp(-1)-Math.exp(-2),8);
    v.select('axis','seconds');expect(v.host.querySelector('svg')?.getAttribute('aria-label')).toContain('Seconds t');
  });
  it('checks rounded gain without changing the solver and invalidates stale attempt feedback',()=>{
    const v=open();v.action('quote').click();expect(v.host.textContent).toContain('Differs from the full-precision predictor gain');expect(v.host.textContent).toContain('Coefficient differences from target');
    v.set('l1','0');expect(v.host.querySelector('[data-attempt-feedback]')?.textContent).toBe('');
    v.set('l1','1e-999');v.action('check').click();expect(v.host.textContent).toContain('too small to represent');
  });
  it('exposes current correction at the initial sample and keeps prior values distinct',()=>{
    const v=open();v.select('timing','current');expect(v.host.textContent).toContain('Data changed');v.action('apply').click();v.action('reveal').click();expect(v.host.textContent).toContain('Do not substitute L_d for M');expect(v.row('Prior p₁').cells[1].textContent).toBe('0');expect(v.row('Estimated x̂₁').cells[1].textContent).not.toBe('0');expect(v.row('Read innovation ε').cells[1].textContent).toBe('1');
  });
  it('connects feedback with complete modes and handles changed sensor DC tracking',()=>{
    const v=open();v.set('initial1','0');v.input('feedback').checked=true;v.input('feedback').dispatchEvent(new Event('input',{bubbles:true}));expect(v.input('heldInput').disabled).toBe(true);v.action('apply').click();v.action('reveal').click();expect(v.host.textContent).toContain('All 4 plant/observer');expect(v.host.textContent).toContain('N corrects ideal');
    v.action('velocity').click();v.action('reveal').click();expect(v.host.textContent).toContain('No supported unity-tracking prefilter');
  });
  it('keeps source rounded matrices separate and changes period according to mode',()=>{
    const v=open();v.action('rounded').click();v.action('reveal').click();expect(v.host.textContent).toContain('not reinspected');expect(v.host.textContent).toContain('Direct discrete mode');expect(v.host.textContent).toContain('-0.83745424');
    const before=v.host.querySelector('[aria-label="Checked predictor gain and error matrix"]')?.textContent;v.set('period','.2');v.action('apply').click();v.action('reveal').click();expect(v.host.querySelector('[aria-label="Checked predictor gain and error matrix"]')?.textContent).toBe(before);
    v.action('baseline').click();v.set('period','.2');v.action('apply').click();v.action('reveal').click();expect(v.host.textContent).toContain('Period edits recompute');expect(v.host.querySelector('[aria-label="Checked predictor gain and error matrix"]')?.textContent).not.toBe(before);
  });
  it('validates native underflow, horizon integers and noise aliasing with recovery',()=>{
    const v=open();v.action('reveal').click();v.set('amplitude','1e-999');v.action('apply').click();expect(v.host.textContent).toContain('too small to represent');expect(v.host.querySelectorAll('svg')).toHaveLength(0);
    v.set('amplitude','0e-999');v.set('frequency','1e-2');v.action('apply').click();expect(v.host.textContent).toContain('Experiment applied');v.set('steps','1.5');v.action('apply').click();expect(v.host.textContent).toContain('integer horizon');
    v.action('baseline').click();v.set('amplitude','.1');v.set('frequency','100');v.action('apply').click();v.action('reveal').click();expect(v.host.textContent).toContain('Noise sampling warning');
  });
  it('rejects visual rank/notation loss and starts each visit fresh',()=>{
    const v=open();mocks.editors[2].edit(String.raw`C=\begin{bmatrix}0&0\end{bmatrix}`);v.action('apply').click();expect(v.host.textContent).toContain('rank is below');v.action('baseline').click();mocks.editors[3].edit('');v.action('apply').click();expect(v.host.textContent).toContain('Complete the model');
    v.action('baseline').click();v.set('initial1','2');v.action('apply').click();v.action('reveal').click();expect(v.row('True x₁').cells[1].textContent).toBe('2');const other=open();expect(other.input('initial1').value).toBe('1');expect(other.host.querySelectorAll('svg')).toHaveLength(0);
  });
});
