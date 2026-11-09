import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EquationDraft, EquationInputOptions } from '../../shared/equations/input';
import { mount } from './view';
import * as equations from '../../shared/equations/input';

vi.mock('../../shared/equations/input', () => ({
  createEquationDisplay: (latex: string, label: string) => { const node = document.createElement('div'); node.setAttribute('aria-label', label); node.textContent = latex; return node; },
  createEquationInput: (options: EquationInputOptions) => {
    const element = document.createElement('div'), field = document.createElement('textarea'); field.value = options.value; element.append(field);
    const getValue = (): EquationDraft => ({ latex: field.value, empty: !field.value.trim(), hasPlaceholders: false, syntaxIssues: [] });
    field.addEventListener('input', () => options.onChange?.(getValue()), { signal: options.signal });
    return { element, getValue, setValue: (value: string) => { field.value = value; }, focus: () => field.focus(), destroy: () => element.remove() };
  },
}));

const visits: (() => void)[] = [];
afterEach(() => { visits.splice(0).forEach(cleanup => cleanup()); vi.restoreAllMocks(); document.body.replaceChildren(); });
function visit() {
  const container = document.createElement('div'); container.dataset.module = 'DD04'; document.body.append(container);
  const controller = new AbortController(); const cleanup = mount({ container, signal: controller.signal });
  visits.push(() => { controller.abort(); if (typeof cleanup === 'function') cleanup(); });
  const button = (name: string) => container.querySelector<HTMLButtonElement>(`[data-action="${name}"]`)!;
  const numeric = (name: string, value: string) => { const field = container.querySelector<HTMLInputElement>(`[data-number="${name}"]`)!; field.value = value; field.dispatchEvent(new Event('input')); };
  return { container, controller, button, numeric };
}
describe('DD04 read/calculate/commit interface (mocked presentation only)', () => {
  it('starts with actual initialized memory and known inputs without precomputing output answers', () => {
    const v=visit();expect(v.container.querySelector<HTMLElement>('.pid-lesson')!.hidden).toBe(false);
    expect(v.container.querySelectorAll('.pid-timeline-chart:first-child circle')).toHaveLength(7);
    expect(v.container.querySelectorAll('.pid-timeline-chart:last-child circle')).toHaveLength(1);
    expect(v.container.querySelector('.pid-memory')!.textContent).toContain('u[0]0');expect(v.container.querySelector<HTMLElement>('.pid-pending')!.hidden).toBe(true);
    expect(v.container.querySelector('.pid-settings')!.hasAttribute('open')).toBe(false);
  });
  it('links direct future-input edits to the original kernel while keeping commit timing and explicit replay',()=>{
    const v=visit(),edit=(name:string,value:string)=>{const f=v.container.querySelector<HTMLInputElement>(`[aria-label="${name}"]`)!;f.value=value;f.dispatchEvent(new Event('input'));};
    edit('Error e[k] to edit','.5');v.button('calculate').click();expect(v.container.querySelector('.pid-pending')!.textContent).toContain('u[1]=7.05');expect(v.container.querySelector('.pid-memory')!.textContent).toContain('u[0]0');
    v.button('commit').click();edit('Select input sample k','2');edit('Error e[k] to edit','-1');v.button('calculate').click();expect(v.container.querySelector('.pid-pending')!.textContent).toContain('u[2]=-19');v.button('commit').click();
    edit('Inspect committed sample k','1');[...v.container.querySelectorAll('button')].find(b=>b.textContent==='Replay from selected sample')!.click();
    expect(v.container.querySelectorAll('tbody tr')).toHaveLength(0);expect(v.container.querySelector('.pid-memory')!.textContent).toContain('I[0]0');v.button('calculate').click();expect(v.container.querySelector('.pid-pending')!.textContent).toContain('u[1]=7.05');
  });
  it('restores the complete revealed attempt and exact source sequence when an error drag is cancelled',()=>{
    const v=visit();v.button('calculate').click();const source=v.container.querySelector('textarea')!.value,host=v.container.querySelector<HTMLElement>('.pid-direct-plots')!;
    host.setPointerCapture=()=>{};host.hasPointerCapture=()=>false;
    vi.spyOn(SVGElement.prototype,'getBoundingClientRect').mockReturnValue({left:0,top:0,width:600,height:220}as DOMRect);
    const pointer=(target:EventTarget,type:string,id:number,y=80)=>{const event=new MouseEvent(type,{bubbles:true,clientX:140,clientY:y,button:0});Object.defineProperty(event,'pointerId',{value:id});target.dispatchEvent(event);};
    pointer(v.container.querySelector('[data-error-handle]')!,'pointerdown',7);expect(v.button('commit').disabled).toBe(true);pointer(window,'pointermove',7,110-88/3);
    expect(v.container.querySelector<HTMLElement>('.pid-pending')!.hidden).toBe(true);document.body.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));
    expect(v.container.querySelector('textarea')!.value).toBe(source);expect(v.container.querySelector<HTMLElement>('.pid-pending')!.hidden).toBe(false);expect(v.button('commit').disabled).toBe(false);
    v.button('commit').click();expect(v.container.querySelector('.pid-memory')!.textContent).toContain('u[1]14.1');
  });
  it('revokes the old prediction grade without hiding valid arithmetic or committing memory',()=>{
    const v=visit();v.numeric('prediction','14.1');v.button('calculate').click();expect(v.container.querySelector('.pid-pending')!.textContent).toContain('Your prediction matches');
    v.numeric('prediction','0');expect(v.container.querySelector('.pid-pending')!.textContent).not.toContain('Your prediction matches');expect(v.container.querySelector('.pid-pending')!.textContent).toContain('Calculate again');expect(v.container.querySelector('.pid-memory')!.textContent).toContain('u[0]0');
  });
  it('replays the complete filtered controller state rather than only its output',()=>{
    const v=visit(),choice=v.container.querySelector<HTMLSelectElement>('[data-choice="derivative"]')!;choice.value='filtered';choice.dispatchEvent(new Event('change'));
    for(const [name,value]of[['e0','.25'],['em1','-.1'],['i0','2'],['d0','3']])v.numeric(name,value);
    v.button('derive').click();v.button('calculate').click();v.button('commit').click();const first=v.container.querySelector('.pid-memory')!.textContent;
    expect(first).toContain('D[1]5.25');expect(first).toContain('u[1]11.375');v.button('calculate').click();v.button('commit').click();
    const inspect=v.container.querySelector<HTMLInputElement>('[aria-label="Inspect committed sample k"]')!;inspect.value='2';inspect.dispatchEvent(new Event('input'));[...v.container.querySelectorAll('button')].find(b=>b.textContent==='Replay from selected sample')!.click();
    expect(v.container.querySelector('.pid-memory')!.textContent).toBe(first);expect(v.container.querySelectorAll('tbody tr')).toHaveLength(1);v.button('calculate').click();expect(v.container.querySelector('.pid-pending')!.textContent).toContain('u[2]=8.95');
  });
  it('switches positional/incremental inspection without reinitializing memory or recomputing the checked step',()=>{
    const v=visit();v.button('calculate').click();v.button('commit').click();v.button('calculate').click();
    const memory=v.container.querySelector('.pid-memory')!.textContent,form=v.container.querySelector<HTMLSelectElement>('[data-choice="form"]')!,arithmetic=v.container.querySelector('[aria-label="Incremental checked result"]');
    form.value='incremental';form.dispatchEvent(new Event('change'));
    expect(v.container.querySelector('.pid-memory')!.textContent).toBe(memory);expect(v.container.querySelectorAll('tbody tr')).toHaveLength(1);expect(v.container.querySelector('[aria-label="Incremental checked result"]')).toBe(arithmetic);
    expect(v.container.querySelector('[data-primary-result]')!.textContent).toContain('Primary incremental result: u[2]=4.3');expect(v.button('commit').disabled).toBe(false);
  });
  it('aborts partially allocated editor resources when mounting throws with the parent still active',()=>{
    const container=document.createElement('div'),parent=new AbortController(),listener=vi.fn();document.body.append(container);let child:AbortSignal|undefined;
    vi.spyOn(equations,'createEquationInput').mockImplementationOnce(options=>{child=options.signal;window.addEventListener('dd04-partial-editor',listener,{signal:child});throw new Error('partial editor');});
    expect(()=>mount({container,signal:parent.signal})).toThrow('partial editor');expect(parent.signal.aborted).toBe(false);expect(child?.aborted).toBe(true);window.dispatchEvent(new Event('dd04-partial-editor'));expect(listener).not.toHaveBeenCalled();expect(container.childElementCount).toBe(0);
  });
  it('adopts and destroys an editor returned after reentrant parent abort exactly once',()=>{
    const container=document.createElement('div'),parent=new AbortController(),release=vi.fn();document.body.append(container);
    vi.spyOn(equations,'createEquationInput').mockImplementationOnce(()=>{parent.abort();return{element:document.createElement('div'),getValue:()=>({latex:'[1]',empty:false,syntaxIssues:[],hasPlaceholders:false}),setValue:()=>{},focus:()=>{},destroy:release};});
    const cleanup=mount({container,signal:parent.signal});expect(release).toHaveBeenCalledOnce();expect(container.childElementCount).toBe(0);if(typeof cleanup==='function')cleanup();expect(release).toHaveBeenCalledOnce();
  });
  it('rejects e notation from the visual error list before initializing', () => {
    const { container, button } = visit();
    const field = container.querySelector('textarea')!; field.value = '[1e-2]'; field.dispatchEvent(new Event('input'));
    button('derive').click();
    expect(container.querySelector('.pid-message')!.textContent).toContain('visual field');
    expect((container.querySelector('.pid-lesson') as HTMLElement).hidden).toBe(true);
  });
  it('keeps native scientific notation on controller fields', () => {
    const { container, button, numeric } = visit();
    numeric('kp', '1e-2'); numeric('ki', '0'); numeric('kd', '0'); button('derive').click(); button('calculate').click();
    expect(container.querySelector('.pid-pending')!.textContent).toContain('0.01');
    expect((container.querySelector('.pid-lesson') as HTMLElement).hidden).toBe(false);
  });
  it('rejects nonzero native literals that underflow', () => {
    const { container, button, numeric } = visit(); numeric('kp', '1e-999'); button('derive').click();
    expect(container.querySelector('.pid-message')!.textContent).toContain('too small');
    expect((container.querySelector('.pid-lesson') as HTMLElement).hidden).toBe(true);
  });
  it.each(['period', 'e0', 'em1', 'i0', 'tau', 'd0'])('rejects raw underflow in active %s and invalidates the experiment', name => {
    const { container, button, numeric } = visit();
    const derivative = container.querySelector<HTMLSelectElement>('[data-choice="derivative"]')!;
    derivative.value = 'filtered'; derivative.dispatchEvent(new Event('change'));
    button('derive').click(); button('calculate').click();
    numeric(name, '1e-999'); button('derive').click();
    expect(container.querySelector('.pid-message')!.textContent).toContain(`${name} is nonzero but too small`);
    expect(container.querySelector<HTMLElement>('.pid-lesson')!.hidden).toBe(true);
    expect(container.querySelector<HTMLElement>('.pid-pending')!.hidden).toBe(true);
    button('commit').click(); expect(container.querySelectorAll('tbody tr')).toHaveLength(0);
  });
  it('ignores inactive filter and derivative-memory fields instead of validating them', () => {
    const { container, button, numeric } = visit();
    expect(container.querySelector<HTMLInputElement>('[data-number="tau"]')!.disabled).toBe(true);
    expect(container.querySelector<HTMLInputElement>('[data-number="d0"]')!.disabled).toBe(true);
    numeric('tau', '1e-999'); numeric('d0', ''); button('derive').click(); button('calculate').click();
    expect(container.querySelector<HTMLElement>('.pid-lesson')!.hidden).toBe(false);
    expect(container.querySelector('.pid-pending')!.textContent).toContain('u[1]=14.1');
  });
  it('preserves intentional zero exponents in gains, initial memory and prediction', () => {
    const { container, button, numeric } = visit();
    for (const name of ['kp', 'ki', 'kd', 'e0', 'em1', 'i0']) numeric(name, '0e-999');
    button('derive').click(); numeric('prediction', '-0e-999'); button('calculate').click();
    expect(container.querySelector<HTMLElement>('.pid-pending')!.hidden).toBe(false);
    expect(container.querySelector('.pid-pending')!.textContent).toContain('u[1]=0');
    expect(container.querySelector('.pid-pending')!.textContent).toContain('Your prediction matches');
    button('commit').click();
    const cells = container.querySelector('tbody tr')!.querySelectorAll('td');
    expect(Number(cells[6].textContent)).toBe(0); expect(Number(cells[7].textContent)).toBe(0);
  });
  it('rejects an underflowed optional prediction without changing stored memory, then recovers', () => {
    const { container, button, numeric } = visit(); button('derive').click();
    const before = container.querySelector('.pid-memory')!.textContent;
    numeric('prediction', '1e-999'); button('calculate').click();
    expect(container.querySelector('.pid-message')!.textContent).toContain('prediction is nonzero but too small');
    expect(container.querySelector<HTMLElement>('.pid-pending')!.hidden).toBe(true);
    expect(button('commit').disabled).toBe(true); expect(container.querySelector('.pid-memory')!.textContent).toBe(before);
    button('commit').click(); expect(container.querySelectorAll('tbody tr')).toHaveLength(0);
    numeric('prediction', ''); button('calculate').click();
    expect(container.querySelector<HTMLElement>('.pid-pending')!.hidden).toBe(false);
    expect(container.querySelector('.pid-pending')!.textContent).not.toContain('Your prediction');
    numeric('prediction', '1.41e1'); button('calculate').click();
    expect(container.querySelector('.pid-pending')!.textContent).toContain('Your prediction matches');
    button('commit').click(); expect(container.querySelectorAll('tbody tr')).toHaveLength(1);
  });
  it('computes the expected sample from exponent-entered parameters and memory, then restores it on restart', () => {
    const { container, button, numeric } = visit();
    for (const [name, raw] of [['kp', '4e0'], ['ki', '2E0'], ['kd', '1e0'], ['period', '2e-1'], ['e0', '5e-1'], ['em1', '2.5e-1'], ['i0', '2e0']]) numeric(name, raw);
    button('derive').click();
    expect(container.querySelector('.pid-memory')!.textContent).toContain('u[0]5.25');
    numeric('prediction', '8.8e0'); button('calculate').click();
    expect(container.querySelector('.pid-pending')!.textContent).toContain('Your prediction matches');
    button('commit').click();
    const values = [...container.querySelector('tbody tr')!.querySelectorAll('td')].map(cell => Number(cell.textContent));
    expect(values.slice(0, 8)).toEqual([1, .2, 1, 4, 2.3, 2.5, 8.8, 8.8]);
    button('restart').click();
    expect(container.querySelectorAll('tbody tr')).toHaveLength(0);
    expect(container.querySelector('.pid-memory')!.textContent).toContain('u[0]5.25');
    expect(container.querySelector<HTMLInputElement>('[data-number="prediction"]')!.value).toBe('');
  });
  it.each([
    ['kp', '10001', 'Kp must be finite'], ['period', '.0009', 'T must be from'],
    ['e0', '10001', 'e[0] must be finite'], ['i0', '1000001', 'I[0] must be finite'],
    ['tau', '0', 'Filter time constant τ must be from'],
    ['kp', '0'.repeat(161), 'Keep kp within 160 characters'],
  ])('retains local bounds for %s = %s', (name, raw, feedback) => {
    const { container, button, numeric } = visit();
    if (name === 'tau') {
      const derivative = container.querySelector<HTMLSelectElement>('[data-choice="derivative"]')!;
      derivative.value = 'filtered'; derivative.dispatchEvent(new Event('change'));
    }
    numeric(name, raw); button('derive').click();
    expect(container.querySelector('.pid-message')!.textContent).toContain(feedback);
    expect(container.querySelector<HTMLElement>('.pid-lesson')!.hidden).toBe(true);
  });
  it('keeps old memory unchanged until committing a checked sample', () => {
    const { container, button } = visit(); button('derive').click();
    const panel = container.querySelector('.pid-memory')!; const before = panel.textContent;
    button('calculate').click();
    expect(panel.textContent).toBe(before); expect(container.querySelector('.pid-pending')!.textContent).toContain('14.1');
    expect(container.querySelectorAll('tbody tr')).toHaveLength(0);
    expect(button('commit').disabled).toBe(false);
    button('commit').click();
    expect(panel.textContent).toContain('u[1]14.1'); expect(container.querySelectorAll('tbody tr')).toHaveLength(1);
    button('calculate').click(); button('commit').click();
    expect(panel.textContent).toContain('u[2]4.3'); expect(container.querySelectorAll('tbody tr')).toHaveLength(2);
  });
  it('discards the current experiment after changed controller data', () => {
    const { container, button, numeric } = visit(); button('derive').click(); button('calculate').click();
    numeric('period', '0.2');
    expect((container.querySelector('.pid-lesson') as HTMLElement).hidden).toBe(true);
    button('commit').click(); button('derive').click();
    expect(container.querySelector('.pid-derivation')!.textContent).toContain('b₀=9.2');
    button('run').click(); expect(container.querySelector('tbody')!.textContent).toContain('9.2');
  });
  it('uses the edited visual samples rather than the shell preview', () => {
    const { container, button } = visit(); const field = container.querySelector('textarea')!;
    field.value = '[\\frac12,1]'; field.dispatchEvent(new Event('input'));
    button('derive').click(); button('calculate').click();
    expect(container.querySelector('.pid-pending')!.textContent).toContain('7.05');
  });
  it('preserves specified nonzero initial memory and restarts it explicitly', () => {
    const { container, button, numeric } = visit(); numeric('i0', '2.5'); button('derive').click(); button('calculate').click();
    expect(container.querySelector('.pid-pending')!.textContent).toContain('16.6'); button('commit').click(); button('restart').click();
    expect(container.querySelectorAll('tbody tr')).toHaveLength(0); expect(container.querySelector('.pid-memory')!.textContent).toContain('I[0]2.5');
  });
  it('aborts old controls and fresh visits restore baseline input', () => {
    const first = visit(), oldDerive = first.button('derive'), oldLesson = first.container.querySelector<HTMLElement>('.pid-lesson')!;
    first.numeric('kp', '7'); first.controller.abort(); oldDerive.click();
    expect(oldLesson.hidden).toBe(true); expect(first.container.childElementCount).toBe(0);
    const second = visit(); expect(second.container.querySelector<HTMLInputElement>('[data-number="kp"]')!.value).toBe('4');
  });
});
