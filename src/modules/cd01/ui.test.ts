import {afterEach,describe,expect,it,vi} from 'vitest';
import type {EquationDraft} from '../../shared/equations/input';
import {convertLatexToMarkup,validateLatex} from 'mathlive/ssr';
const mocks=vi.hoisted(()=>({editors:[]as{setValue:(s:string)=>void;edit:(s:string)=>void}[],fail:false,probes:0,aborts:0,releases:0,abortOnCreate:undefined as undefined|(()=>void)}));
vi.mock('../../shared/equations/input',()=>({
  createEquationDisplay:(latex:string,label:string)=>{const e=document.createElement('div');e.textContent=latex;e.setAttribute('aria-label',label);e.dataset.latex=latex;return e;},
  createEquationInput:({label,value,signal,onChange}:{label:string;value:string;signal:AbortSignal;onChange:(d:EquationDraft)=>void})=>{
    if(mocks.fail){window.addEventListener('cd01-partial-editor',()=>mocks.probes++,{signal});signal.addEventListener('abort',()=>mocks.aborts++,{once:true});throw new Error('Synthetic partial editor allocation');}
    let text=value;const element=document.createElement('div');element.setAttribute('aria-label',label);
    const getValue=():EquationDraft=>({latex:text,empty:!text,hasPlaceholders:false,syntaxIssues:[]});
    const editor={element,getValue,setValue:(s:string)=>{text=s;},edit:(s:string)=>{text=s;onChange(getValue());},destroy:()=>{mocks.releases++;element.remove();},focus:vi.fn()};const abort=mocks.abortOnCreate;mocks.abortOnCreate=undefined;abort?.();signal.addEventListener('abort',editor.destroy,{once:true});mocks.editors.push(editor);return editor;
  }
}));
import {mount} from './ui';
import * as mathematics from './math';
const cleanups:(()=>void)[]=[];
afterEach(()=>{cleanups.splice(0).forEach(fn=>fn());document.body.replaceChildren();mocks.editors.length=0;mocks.fail=false;mocks.probes=mocks.aborts=mocks.releases=0;mocks.abortOnCreate=undefined;vi.useRealTimers();vi.restoreAllMocks();});
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
    const v=open();expect(v.root.querySelectorAll('figure')).toHaveLength(2);expect(v.root.querySelectorAll('ol li')).toHaveLength(1);
    v.set('predictError','0');v.set('predictEffort','24');v.action('predict').click();expect(v.root.textContent).toContain('Prediction agrees');
    v.action('reveal').focus();v.action('reveal').click();expect(document.activeElement).toBe(v.action('reveal'));expect(v.root.textContent).toContain('All 4 actual modes');expect(v.root.querySelectorAll('figure')).toHaveLength(4);expect(v.row('Derivative effort').cells[1].textContent).toBe('20');expect(v.row('Total effort').cells[1].textContent).toBe('24');
    v.set('inspectTime','1');v.input('inspectTime').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));expect(v.root.textContent).toContain('nearest sample t=1 s');expect(Number(v.row('Output y').cells[1].textContent)).toBeCloseTo(.7232639601893959,6);expect(document.activeElement).not.toBe(document.body);
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
    v.choose('kind','PI');expect(v.root.querySelector('[aria-label="Coefficient-matching identities for the selected structure"]')?.textContent).toContain('d_2');v.action('baseline').click();expect(v.root.querySelector('[aria-label="Coefficient-matching identities for the selected structure"]')?.textContent).toContain('d_3');
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
    const v=open();for(let k=0;k<9;k++){v.choose('reason','structure');v.action('apply').click();}expect(v.root.querySelectorAll('ol li')).toHaveLength(8);v.set('kp','7');v.choose('reason','effort');v.action('apply').click();const next=open();expect(next.input('kp').value).toBe('4');expect(next.root.querySelectorAll('ol li')).toHaveLength(1);expect(next.root.querySelectorAll('figure')).toHaveLength(2);
  });
  it('preserves the valid selected trial when a simpler comparison exceeds its response bound',()=>{
    const v=open();mocks.editors[0].edit(String.raw`G(s)=\frac1{s^2-s-1}`);v.set('kd','4');v.set('horizon','100');v.choose('reason','data');v.action('apply').click();v.action('reveal').click();expect(v.root.textContent).toContain('P comparison unavailable');expect(v.root.textContent).toContain('All 4 actual modes');expect(v.root.textContent).toContain('Classification: stable');expect(v.root.querySelectorAll('figure')).toHaveLength(4);
  });
});

describe('reason-gated controller exploration',()=>{
  it('opens on actual output/effort and keeps exact prediction answers out of trial notes until Reveal',()=>{
    const v=open();expect(v.root.querySelectorAll('.pid-live-visual figure')).toHaveLength(2);expect(v.root.querySelectorAll('svg text')).toHaveLength(0);expect(v.root.querySelectorAll('.pid-y-axis span')).toHaveLength(6);
    const note=v.root.querySelector('ol li')!;expect(note.textContent).not.toContain('Steady error=');expect(note.textContent).not.toContain('sampled peak|u|');expect(v.root.querySelector('.pid-metrics')).toBeNull();
    v.action('reveal').click();expect(v.root.querySelector('ol li')!.textContent).toContain('Steady error=0');expect(v.root.querySelector('ol li')!.textContent).toContain('sampled peak|u|=24');
  });
  it('requires a reason before coalesced previews, records once on Apply, then requires a new reason',()=>{
    vi.useFakeTimers();const v=open(),solver=vi.spyOn(mathematics,'simulate');v.set('kp','5');vi.advanceTimersByTime(100);expect(solver).not.toHaveBeenCalled();expect(v.root.querySelector('.pid-preview-state')!.textContent).toContain('Reason required');
    v.choose('reason','transient');v.set('kp','6');vi.advanceTimersByTime(79);expect(solver).not.toHaveBeenCalled();vi.advanceTimersByTime(1);expect(solver).toHaveBeenCalledTimes(3);expect(v.root.querySelectorAll('ol li')).toHaveLength(1);
    expect(v.root.querySelector('.pid-live-summary')!.textContent).toContain('Preview PID: Kp=6');expect(v.root.querySelector('.pid-preview-state')!.textContent).toContain('Unrecorded preview');
    v.action('apply').click();expect(v.root.querySelectorAll('ol li')).toHaveLength(2);expect((v.root.querySelector('[name="reason"]')as HTMLSelectElement).value).toBe('');
    const calls=solver.mock.calls.length;v.set('kp','7');vi.advanceTimersByTime(100);expect(solver).toHaveBeenCalledTimes(calls);expect(v.root.querySelector('.pid-live-summary')!.textContent).toContain('Applied PID: Kp=6');expect(v.root.querySelectorAll('ol li')).toHaveLength(2);
  });
  it('reassesses requirements using cached runs while maintaining the reason and unapplied state',()=>{
    vi.useFakeTimers();const v=open(),solver=vi.spyOn(mathematics,'simulate'),builder=vi.spyOn(mathematics,'build'),paths=[...v.root.querySelectorAll('.pid-live-visual path')].map(n=>n.getAttribute('d'));
    v.choose('reason','effort');v.set('effortLimit','10');v.set('errorLimit','.02');vi.advanceTimersByTime(80);
    expect(solver).not.toHaveBeenCalled();expect(builder).not.toHaveBeenCalled();expect([...v.root.querySelectorAll('.pid-live-visual path')].map(n=>n.getAttribute('d'))).toEqual(paths);
    expect(v.root.querySelectorAll('ol li')).toHaveLength(1);expect((v.root.querySelector('[name="reason"]')as HTMLSelectElement).value).toBe('effort');expect(v.root.querySelector('.pid-preview-state')!.textContent).toContain('Unrecorded preview');
  });
  it('keeps signed/fractional gains coherent with the continuous knob and explicit range keys',()=>{
    vi.useFakeTimers();const v=open();v.choose('reason','data');v.set('kp','4.25');const slider=v.input('gainSlider');expect(slider.step).toBe('any');expect(slider.min).toBe('-100');expect(slider.max).toBe('100');expect(slider.valueAsNumber).toBe(4.25);
    slider.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true,cancelable:true}));expect(v.input('kp').value).toBe('5.25');
    v.choose('kind','P');v.set('kp','-1');vi.advanceTimersByTime(80);expect(v.root.querySelector('.pid-live-summary')!.textContent).toContain('Preview P: Kp=-1');expect(v.root.querySelector('.pid-preview-state')!.textContent).not.toContain('Rejected');
  });
  it('retains inactive Tf zero and exact original input elements while switching knobs',()=>{
    vi.useFakeTimers();const v=open(),kp=v.input('kp'),tf=v.input('tf');v.choose('reason','structure');v.set('kd','0');v.set('tf','0');vi.advanceTimersByTime(80);v.choose('activeKnob','tf');
    expect(v.input('tf')).toBe(tf);expect(tf.value).toBe('0');expect(v.input('gainSlider').disabled).toBe(true);expect(v.root.querySelector('.pid-knob-note')!.textContent).toContain('inactive');v.action('apply').click();v.action('reveal').click();expect(v.root.textContent).toContain('active PI');expect(v.root.querySelector('[aria-label="Individual active controller contributions"]')!.textContent).toContain('u_D=0');
    v.choose('activeKnob','kp');expect(v.input('kp')).toBe(kp);expect(v.input('tf')).toBe(tf);expect(tf.value).toBe('0');
  });
  it('synchronizes explicit baseline and coefficient-derived filter drafts with the selected slider',()=>{
    const v=open();v.choose('activeKnob','tf');v.set('tf','.2');v.action('baseline').click();expect(v.input('tf').value).toBe('.05');expect(v.input('gainSlider').valueAsNumber).toBeCloseTo(Math.log10(.05),14);
    mocks.editors[1].setValue('(s+20)(s+2)^3');v.action('setFilter').click();expect(v.input('tf').valueAsNumber).toBeCloseTo(1/23,14);expect(v.input('gainSlider').valueAsNumber).toBeCloseTo(Math.log10(1/23),14);
  });
  it('cancels a pending preview truthfully when an immediate Apply rejects its invalid draft',()=>{
    vi.useFakeTimers();const v=open();v.choose('reason','data');v.set('kp','1e-999');expect(v.root.querySelector('.pid-preview-state')!.textContent).toContain('Updating');v.action('apply').click();
    expect(v.root.querySelector('.pid-preview-state')!.textContent).toContain('Rejected draft');expect(v.root.querySelector('.pid-preview-state')!.textContent).not.toContain('Updating');expect(v.root.querySelectorAll('ol li')).toHaveLength(1);vi.advanceTimersByTime(100);expect(v.root.querySelector('.pid-preview-state')!.textContent).toContain('Rejected draft');
  });
  it('preserves an invalid native parameter and its same element through Fit and knob inspection without value writes',()=>{
    vi.useFakeTimers();const v=open(),native=v.input('kp');native.value='';const validity=vi.spyOn(native,'validity','get').mockReturnValue({badInput:true}as ValidityState);native.dispatchEvent(new Event('input',{bubbles:true}));v.choose('reason','data');vi.advanceTimersByTime(80);
    const writes=vi.spyOn(native,'value','set');v.action('fit').click();v.choose('activeKnob','ki');v.choose('activeKnob','kp');expect(v.input('kp')).toBe(native);expect(writes).not.toHaveBeenCalled();expect(native.validity.badInput).toBe(true);expect(v.root.querySelector('.pid-live-warning')!.textContent).toContain('finite number');expect(v.root.querySelectorAll('ol li')).toHaveLength(1);validity.mockRestore();
    v.set('kp','0e-999');vi.advanceTimersByTime(80);expect(v.root.querySelector('.pid-preview-state')!.textContent).toContain('Unrecorded preview');expect(v.input('kp').value).toBe('0e-999');
  });
  it('moves all four cached plot markers to the same nearest sample without simulating or changing paths',()=>{
    const v=open();v.action('reveal').click();const solver=vi.spyOn(mathematics,'simulate'),plots=[...v.root.querySelectorAll('svg')],paths=[...v.root.querySelectorAll('path')].map(n=>n.getAttribute('d'));v.input('inspectTime').focus();v.set('inspectTime','.513');
    expect(v.root.querySelector('.pid-cursor-readout')!.textContent).toContain('nearest computed sample t=0.525 s');expect(v.input('timeCursor').valueAsNumber).toBeCloseTo(.525,14);expect(solver).not.toHaveBeenCalled();expect([...v.root.querySelectorAll('svg')]).toEqual(plots);expect([...v.root.querySelectorAll('path')].map(n=>n.getAttribute('d'))).toEqual(paths);expect(document.activeElement).toBe(v.input('inspectTime'));
    v.set('inspectTime','1');expect(Number(v.row('Output y').cells[1].textContent)).toBeCloseTo(.7232639601893959,6);expect(Number(v.row('Total effort').cells[1].textContent)).toBeCloseTo(1.8964989138990447,6);
  });
  it('reconciles checked nearest-sample geometry after an accepted shorter horizon without replacing an invalid time draft',()=>{
    vi.useFakeTimers();const v=open();v.set('inspectTime','5');const native=v.input('inspectTime');v.set('inspectTime','1e-999');const writes=vi.spyOn(native,'value','set');v.choose('reason','data');v.set('horizon','1.21');vi.advanceTimersByTime(80);
    expect(v.input('inspectTime')).toBe(native);expect(native.value).toBe('1e-999');expect(writes).not.toHaveBeenCalled();expect(v.input('timeCursor').max).toBe('1.21');expect(v.input('timeCursor').valueAsNumber).toBeCloseTo(.605,14);expect(Number(v.root.querySelector('.pid-live-output .pid-cursor')!.getAttribute('x1'))).toBeCloseTo(300,12);expect(v.root.querySelector('.pid-cursor-readout')!.textContent).toContain('nonzero but too small');
    v.action('fit').click();expect(writes).not.toHaveBeenCalled();v.set('inspectTime','.5');expect(v.root.querySelector('.pid-cursor-readout')!.textContent).not.toContain('nonzero but too small');
  });
  it('clears old prediction grading while keeping valid revealed results and curves',()=>{
    const v=open();v.set('predictError','0');v.set('predictEffort','24');v.action('predict').click();expect(v.root.textContent).toContain('Prediction agrees');v.action('reveal').click();v.action('predict').click();const table=v.root.querySelector('.pid-metrics');
    v.set('predictEffort','25');expect(v.root.querySelector('[data-prediction]')!.textContent).toBe('');expect(v.root.querySelector('.pid-metrics')).toBe(table);expect(v.root.querySelectorAll('figure')).toHaveLength(4);
  });
  it('retains a valid selected preview when simpler comparisons hit a declared bound, without recording it early',()=>{
    vi.useFakeTimers();const v=open();mocks.editors[0].edit('G(s)=1/(s^2-s-1)');v.set('kd','4');v.set('horizon','100');v.choose('reason','data');vi.advanceTimersByTime(80);
    expect(v.root.querySelector('.pid-preview-state')!.textContent).toContain('Unrecorded preview');expect(v.root.querySelector('.pid-live-warning')!.textContent).toContain('P comparison unavailable');expect(v.root.querySelectorAll('.pid-live-visual figure')).toHaveLength(2);expect(v.root.querySelectorAll('ol li')).toHaveLength(1);
  });
  it('releases a pending preview on direct cleanup while its parent remains active',()=>{
    vi.useFakeTimers();const root=document.createElement('div'),parent=new AbortController();document.body.append(root);const cleanup=mount({container:root,signal:parent.signal});const reason=root.querySelector<HTMLSelectElement>('[name="reason"]')!,gain=root.querySelector<HTMLInputElement>('[name="kp"]')!,solver=vi.spyOn(mathematics,'simulate'),before=vi.getTimerCount();reason.value='data';reason.dispatchEvent(new Event('input'));gain.value='5';gain.dispatchEvent(new Event('input'));expect(vi.getTimerCount()).toBe(before+1);cleanup?.();expect(parent.signal.aborted).toBe(false);expect(vi.getTimerCount()).toBe(before);vi.advanceTimersByTime(100);expect(solver).not.toHaveBeenCalled();expect(root.childElementCount).toBe(0);parent.abort();
  });
  it('releases a partially allocated equation resource while the parent stays active',()=>{
    mocks.fail=true;const root=document.createElement('div'),parent=new AbortController();document.body.append(root);expect(()=>mount({container:root,signal:parent.signal})).toThrow('Synthetic partial editor allocation');expect(parent.signal.aborted).toBe(false);expect(mocks.aborts).toBe(1);expect(root.childElementCount).toBe(0);window.dispatchEvent(new Event('cd01-partial-editor'));expect(mocks.probes).toBe(0);parent.abort();expect(mocks.aborts).toBe(1);
  });
  it('releases equation instances returned after reentrant parent abort',()=>{
    const root=document.createElement('div'),parent=new AbortController();document.body.append(root);mocks.abortOnCreate=()=>parent.abort();const cleanup=mount({container:root,signal:parent.signal});expect(parent.signal.aborted).toBe(true);expect(root.childElementCount).toBe(0);expect(mocks.releases).toBe(2);cleanup?.();expect(mocks.releases).toBe(2);
  });
  it('renders actual generated controller, matrix and matching equations with the installed typesetter',()=>{
    const v=open(),check=()=>{const nodes=v.root.querySelectorAll<HTMLElement>('[data-latex]');expect(nodes.length).toBeGreaterThan(3);for(const node of nodes){expect(validateLatex(node.dataset.latex!)).toEqual([]);expect(convertLatexToMarkup(node.dataset.latex!)).not.toContain('ML__error');}};v.action('reveal').click();check();v.choose('reason','matching');v.action('derive').click();v.action('reveal').click();check();
  });
});
