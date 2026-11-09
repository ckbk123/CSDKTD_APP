import { afterEach, describe, expect, it, vi } from 'vitest';
import { convertLatexToMarkup, validateLatex } from 'mathlive/ssr';
const equationState = vi.hoisted(() => ({ fail:false, probes:0, aborts:0 }));
vi.mock('../../shared/equations/input', () => ({
  createEquationDisplay: (value: string, label: string) => { const el = document.createElement('p'); el.textContent = label + ': ' + value; el.dataset.latex=value; return el; },
  createEquationInput: (options: { value: string; label: string; signal: AbortSignal; onChange: (value: unknown) => void }) => {
    if (equationState.fail) { window.addEventListener('cf01-editor-resource',()=>equationState.probes++,{signal:options.signal});options.signal.addEventListener('abort',()=>equationState.aborts++,{once:true});throw new Error('Synthetic partial editor allocation'); }
    const element = document.createElement('div'), field = document.createElement('textarea'); field.value = options.value; field.setAttribute('aria-label', options.label); element.append(field);
    const getValue = () => ({ latex: field.value, empty: !field.value, hasPlaceholders: false, syntaxIssues: [] });
    field.addEventListener('input', () => options.onChange(getValue()), { signal: options.signal });
    return { element, getValue, setValue: (value: string) => { field.value = value; }, destroy: () => element.remove() };
  },
}));
import { mount } from './view';
import * as measurement from './measure';
import * as response from './response';
const visits: (() => void)[] = [];
afterEach(() => { visits.splice(0).forEach(close => close()); document.body.replaceChildren(); vi.useRealTimers(); vi.restoreAllMocks(); equationState.fail=false; equationState.probes=equationState.aborts=0; });
function visit() {
  const container = document.createElement('div'), controller = new AbortController(); container.dataset.module = 'CF01'; document.body.append(container);
  const cleanup = mount({ container, signal: controller.signal });
  const close = () => { controller.abort(); cleanup?.(); }; visits.push(close);
  const click = (name: string) => container.querySelector<HTMLButtonElement>('[data-action="' + name + '"]')!.click();
  const input = (name: string, value: string) => { const el = container.querySelector<HTMLInputElement>('[name="' + name + '"]')!; el.value = value; el.dispatchEvent(new Event('input')); };
  const select = (name: string, value: string) => { const el = container.querySelector<HTMLSelectElement>('[name="' + name + '"]')!; el.value = value; el.dispatchEvent(new Event('change')); };
  const equation = (value: string) => { const el = container.querySelector('textarea')!; el.value = value; el.dispatchEvent(new Event('input')); };
  return { container, click, input, select, equation, close };
}
describe('CF01 exercise flow (mocked equation UI)', () => {
  it('separates the4s guideline from measured settling and checks the student prediction', () => {
    const v = visit(); expect(v.container.querySelectorAll('svg')).toHaveLength(2);
    v.select('prediction', 'not'); v.click('reveal');
    expect(v.container.querySelector('.cf1-feedback')!.textContent).toContain('Correct.');
    expect(v.container.querySelector('.cf1-table')!.textContent).toContain('4 s (approximate)');
    expect(v.container.querySelector('.cf1-table')!.textContent).toContain('4.038174 s');
  });
  it('adds a slow pole without replacing edited target-pair data and permits a longer horizon', () => {
    const v = visit(), changed = '16/(s^2+4s+16)'; v.equation(changed); v.click('slow'); v.click('reveal');
    expect(v.container.querySelector('textarea')!.value).toBe(changed);
    expect(v.container.querySelector('.cf1-status')!.textContent).toContain('Not established');
    expect(v.container.querySelector('.cf1-reasoning')!.textContent).toContain('-0.2');
    v.input('horizon', '40'); v.click('compute');
    expect(v.container.querySelector('.cf1-status')!.textContent).not.toContain('Not established');
    v.click('remove'); expect(v.container.querySelector<HTMLInputElement>('[name="include-pole"]')!.checked).toBe(false);
  });
  it('clears stale output on native underflow, accepts ordinary exponents and preserves a valid cursor plot', () => {
    const v = visit(), prior = v.container.querySelector('.cf1-response')!.innerHTML;
    v.input('time', '1e-400'); expect(v.container.querySelector('.cf1-inspection')!.textContent).toContain('nonzero but too small');
    expect(v.container.querySelector('.cf1-response')!.innerHTML).toBe(prior);
    v.input('time', '0e-400'); expect(v.container.querySelector('.cf1-inspection')!.textContent).toContain('At t=0 s');
    v.click('reveal'); v.input('horizon', '1e-400'); v.click('compute');
    expect(v.container.querySelector('.cf1-status')!.textContent).toContain('nonzero but too small');
    expect(v.container.querySelectorAll('svg')).toHaveLength(2); expect(v.container.querySelector('.cf1-preview-state')!.textContent).toContain('Unapplied inputs'); expect(v.container.querySelector<HTMLElement>('.cf1-answer')!.hidden).toBe(true);
    v.input('horizon', '1e1'); v.click('compute'); expect(v.container.querySelector('.cf1-status')!.textContent).toContain('0…10 s');
  });
  it('reports visual meaning errors and keeps band/rise edits isolated from old answers', () => {
    const v = visit(); v.click('reveal'); v.equation('4/(s^(2)+2s+4)'); v.click('compute');
    expect(v.container.querySelector('.cf1-status')!.textContent).toContain('power box'); expect(v.container.querySelectorAll('svg')).toHaveLength(2); expect(v.container.querySelector('.cf1-preview-state')!.textContent).toContain('Equation draft');
    v.equation('4/(s^{2}+2s+4)'); v.click('compute'); v.click('reveal'); v.select('band', '5');
    expect(v.container.querySelector<HTMLElement>('.cf1-answer')!.hidden).toBe(true);
    v.select('rise', '0-100'); v.click('compute'); v.click('reveal');
    expect(v.container.querySelector('.cf1-table')!.textContent).toContain('2.644547 s');
    expect(v.container.querySelector('.cf1-table')!.textContent).toContain('1.2092 s');
  });
  it('restores all baseline data and a fresh visit after a zero experiment', () => {
    const v = visit(); v.click('zero'); v.click('reveal');
    expect(v.container.querySelector('.cf1-reasoning')!.textContent).toContain('Added zero at 1');
    v.click('baseline'); expect(v.container.querySelector<HTMLInputElement>('[name="include-zero"]')!.checked).toBe(false);
    expect(v.container.querySelector<HTMLInputElement>('[name="horizon"]')!.value).toBe('10');
    expect(v.container.querySelector<HTMLElement>('.cf1-answer')!.hidden).toBe(true); v.close();
    const next = visit(); expect(next.container.querySelector('textarea')!.value).toContain('s^2+2s+4');
    expect(next.container.querySelector<HTMLInputElement>('[name="pole"]')!.disabled).toBe(true);
  });
});

function pointer(target: Element, type: string, x: number, y: number, id = 7) {
  const event = new MouseEvent(type, { button:0, clientX:x, clientY:y, bubbles:true, cancelable:true }); Object.defineProperty(event,'pointerId',{value:id}); target.dispatchEvent(event);
}
describe('CF01 linked transient workbench', () => {
  it('opens on actual curves with native axes and keeps measured answers/markers behind Reveal', () => {
    const v = visit(), first = v.container.querySelector('.cf1-tool')!.firstElementChild!;
    expect(first.classList.contains('cf1-workbench')).toBe(true);
    expect(v.container.querySelectorAll('.cf1-plot svg')).toHaveLength(2); expect(v.container.querySelectorAll('svg text')).toHaveLength(0);
    expect(v.container.querySelectorAll('.cf1-y-axis span')).toHaveLength(6);
    expect(v.container.querySelector('[data-measurement]')).toBeNull(); expect(v.container.querySelectorAll('.cf1-table tbody tr')).toHaveLength(0);
    expect(v.container.querySelector('.cf1-preview-state')!.nextElementSibling).toBe(v.container.querySelector('.cf1-response'));
    v.click('reveal'); expect(v.container.querySelectorAll('[data-measurement]')).toHaveLength(4); expect(v.container.querySelector('.cf1-table')!.textContent).toContain('4.038174 s');
  });
  it('updates the target region and cached time cursor without repeating modal construction or measurement', () => {
    const v = visit(), measures = vi.spyOn(measurement,'measure'), builds = vi.spyOn(response,'buildResponse'), svg = v.container.querySelector('.cf1-response svg'), paths = [...v.container.querySelectorAll('.cf1-response path')].map(p=>p.getAttribute('d'));
    v.input('overshoot','10'); v.input('settling','3'); v.input('time','1');
    expect(measures).not.toHaveBeenCalled(); expect(builds).not.toHaveBeenCalled(); expect(v.container.querySelector('.cf1-response svg')).toBe(svg);
    expect([...v.container.querySelectorAll('.cf1-response path')].map(p=>p.getAttribute('d'))).toEqual(paths); expect(v.container.querySelector('.cf1-inspection')!.textContent).toContain('full y=0.8494256');
    v.click('reveal'); expect(v.container.querySelector('.cf1-table')!.textContent).toContain('Does not meet target');
  });
  it('coalesces actual pair edits and keeps the previous preview visibly qualified until the latest computation', () => {
    vi.useFakeTimers(); const v=visit(), measures=vi.spyOn(measurement,'measure');
    v.input('frequency','3'); v.input('frequency','4');
    expect(measures).not.toHaveBeenCalled(); const label=v.container.querySelector('.cf1-preview-state')!; expect(label.textContent).toBe('Updating · previous curves');
    expect(label.nextElementSibling).toBe(v.container.querySelector('.cf1-response'));
    vi.advanceTimersByTime(79);expect(measures).not.toHaveBeenCalled();vi.advanceTimersByTime(1);expect(measures).toHaveBeenCalledOnce();
    expect(v.container.querySelector('textarea')!.value).toBe('T(s)=\\frac{16}{s^2+4s+16}'); v.click('reveal'); expect(v.container.querySelector('.cf1-table')!.textContent).toContain('2.019087 s');
    expect(v.container.querySelector('.cf1-inspection')!.textContent).toContain('common final value=1');
  });
  it('rejects an unsupported DC-preserving pair edit atomically while preserving invalid native drafts during view actions', () => {
    vi.useFakeTimers();const v=visit();const original='1000/(s^2+.05s+.0025)';v.equation(original);v.click('compute');
    v.input('frequency','20');vi.advanceTimersByTime(80);expect(v.container.querySelector('.cf1-warning')!.textContent).toContain('Preserving the positive DC gain');
    expect(v.container.querySelector('textarea')!.value).toBe(original);const native=v.container.querySelector<HTMLInputElement>('[name="frequency"]')!, writes=vi.spyOn(native,'value','set');
    v.click('fit');v.input('time','1');expect(writes).not.toHaveBeenCalled();expect(native.value).toBe('20');expect(v.container.querySelector('.cf1-preview-state')!.textContent).toContain('Unapplied inputs');
  });
  it('preserves the complete critical/overdamped numeric family and optional repeated/inverse-response factors', () => {
    vi.useFakeTimers();const v=visit();v.input('damping','1');v.input('frequency','1');vi.advanceTimersByTime(80);v.click('reveal');
    expect(v.container.querySelector('.cf1-table')!.textContent).toContain('5.833922 s');expect(v.container.querySelector('[data-handle^="pair"]')).toBeNull();
    const pole=v.container.querySelector<HTMLInputElement>('[name="include-pole"]')!;pole.checked=true;pole.dispatchEvent(new Event('change'));vi.advanceTimersByTime(80);v.click('reveal');expect(v.container.querySelector('.cf1-table')!.textContent).toContain('7.516604 s');
    v.click('zero');v.input('time','1');expect(v.container.querySelector('.cf1-inspection')!.textContent).toContain('full y=-0.1036383');
    v.click('remove');v.input('damping','3');vi.advanceTimersByTime(80);expect(v.container.querySelector('.cf1-poles')!.textContent).toContain('overdamped');expect(v.container.querySelector('[data-handle^="pair"]')).toBeNull();
  });
  it('keeps insufficient horizons and curve-question data distinct from revealed numerical answers', () => {
    const v=visit();v.input('horizon','1.21');v.click('compute');expect(v.container.querySelector('.cf1-warning')!.textContent).toContain('does not establish settling');expect(v.container.querySelector('[data-measurement]')).toBeNull();
    v.select('prediction','unknown');v.click('reveal');expect(v.container.querySelector('.cf1-feedback')!.textContent).toContain('Correct.');expect(v.container.querySelector('.cf1-table')!.textContent).toContain('Not established');
    v.select('prediction','met');expect(v.container.querySelector('.cf1-feedback')!.textContent).not.toContain('Correct.');expect(v.container.querySelector('.cf1-feedback')!.textContent).toContain('Prediction edited');
    expect(v.container.querySelector<HTMLElement>('.cf1-answer')!.hidden).toBe(false);expect(v.container.querySelectorAll('.cf1-table tbody tr')).toHaveLength(6);
  });
  it('owns one drag pointer, restores the complete checked model on Escape and releases its capture', () => {
    vi.useFakeTimers();const v=visit();vi.spyOn(SVGElement.prototype,'getBoundingClientRect').mockReturnValue({left:0,top:0,width:300,height:300} as DOMRect);
    const host=v.container.querySelector<HTMLElement>('.cf1-poles')!, captured=new Set<number>();Object.assign(host,{setPointerCapture:(id:number)=>captured.add(id),hasPointerCapture:(id:number)=>captured.has(id),releasePointerCapture:(id:number)=>captured.delete(id)});
    const before=v.container.querySelector('textarea')!.value;pointer(host.querySelector('[data-handle="pair-upper"]')!,'pointerdown',93,50);pointer(host,'pointermove',80,60);vi.advanceTimersByTime(80);
    expect(v.container.querySelector('textarea')!.value).not.toBe(before);pointer(host.querySelector('[data-handle="pair-upper"]')!,'pointerdown',70,70,8);pointer(host,'pointercancel',70,70,8);pointer(host,'lostpointercapture',70,70,8);expect(captured).toEqual(new Set([7]));
    document.activeElement!.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));expect(v.container.querySelector('textarea')!.value).toBe(before);expect(captured.size).toBe(0);
    expect(v.container.querySelector<HTMLInputElement>('[name="damping"]')!.value).toBe('0.5');expect(v.container.querySelector('.cf1-status')!.textContent).toContain('Drag cancelled');
  });
  it('rejects a zero dragged through its forbidden gap and keeps the target pair untouched', () => {
    vi.useFakeTimers();const v=visit();v.click('zero');const original=v.container.querySelector('textarea')!.value;
    vi.spyOn(SVGElement.prototype,'getBoundingClientRect').mockReturnValue({left:0,top:0,width:300,height:300} as DOMRect);
    const host=v.container.querySelector<HTMLElement>('.cf1-poles')!;pointer(host.querySelector('[data-handle="zero"]')!,'pointerdown',207,150);pointer(host,'pointermove',150,150);
    expect(v.container.querySelector('.cf1-warning')!.textContent).toContain('forbidden');vi.advanceTimersByTime(100);expect(v.container.querySelector('textarea')!.value).toBe(original);expect(v.container.querySelector<HTMLInputElement>('[name="zero"]')!.value).toBe('-1');v.click('cancel');
  });
  it('does not write a browser-owned invalid time/target draft while fitting the pole view', () => {
    const v=visit(), time=v.container.querySelector<HTMLInputElement>('[name="time"]')!, target=v.container.querySelector<HTMLInputElement>('[name="overshoot"]')!;
    time.value='';const validity=vi.spyOn(time,'validity','get').mockReturnValue({badInput:true} as ValidityState);time.dispatchEvent(new Event('input'));
    v.input('overshoot','1e-999');const timeWrites=vi.spyOn(time,'value','set'),targetWrites=vi.spyOn(target,'value','set');
    v.click('fit');expect(timeWrites).not.toHaveBeenCalled();expect(targetWrites).not.toHaveBeenCalled();expect(time.validity.badInput).toBe(true);expect(v.container.querySelector('.cf1-warning')!.textContent).toContain('nonzero but too small');validity.mockRestore();
  });
  it('releases its pending full calculation on direct disposal with the parent still active', () => {
    vi.useFakeTimers();const container=document.createElement('div'),parent=new AbortController();document.body.append(container);const cleanup=mount({container,signal:parent.signal}),measureSpy=vi.spyOn(measurement,'measure');
    const initialTimers=vi.getTimerCount(),frequency=container.querySelector<HTMLInputElement>('[name="frequency"]')!;frequency.value='4';frequency.dispatchEvent(new Event('input'));expect(vi.getTimerCount()).toBe(initialTimers+1);cleanup?.();expect(vi.getTimerCount()).toBe(initialTimers);expect(parent.signal.aborted).toBe(false);vi.advanceTimersByTime(100);expect(measureSpy).not.toHaveBeenCalled();expect(container.children).toHaveLength(0);expect(vi.getTimerCount()).toBe(0);parent.abort();
  });
});

it('validates the actual generated baseline and scientific-result equations with the installed renderer',()=>{
  const v=visit(),check=()=>{const sources=[...v.container.querySelectorAll<HTMLElement>('[data-latex]')];expect(sources.length).toBeGreaterThan(2);for(const source of sources){expect(validateLatex(source.dataset.latex!)).toEqual([]);expect(convertLatexToMarkup(source.dataset.latex!)).not.toContain('ML__error');}};
  v.click('reveal');check();v.equation('.000000001/(s^2+2s+4)');v.click('compute');v.click('reveal');check();
});
it('aborts a partially allocated editor resource on mount failure while its parent remains active',()=>{
  equationState.fail=true;const root=document.createElement('div'),parent=new AbortController();document.body.append(root);
  expect(()=>mount({container:root,signal:parent.signal})).toThrow('Synthetic partial editor allocation');expect(parent.signal.aborted).toBe(false);expect(equationState.aborts).toBe(1);expect(root.children).toHaveLength(0);
  window.dispatchEvent(new Event('cf01-editor-resource'));expect(equationState.probes).toBe(0);parent.abort();expect(equationState.aborts).toBe(1);
});

it('accumulates keyboard pair movement while coalescing and links revealed measurement shortcuts to cached inspection',()=>{
  vi.useFakeTimers();const v=visit(),handle=v.container.querySelector<HTMLButtonElement>('[data-handle="pair-upper"]')!;handle.focus();
  handle.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true,cancelable:true}));document.activeElement!.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true,cancelable:true}));vi.advanceTimersByTime(80);
  expect(v.container.querySelector('.cf1-poles')!.textContent).toContain('-0.98');v.click('baseline');v.click('reveal');
  const measures=vi.spyOn(measurement,'measure'),button=[...v.container.querySelectorAll('button')].find(n=>n.textContent==='Inspect detected peak')!;button.click();
  expect(Number(v.container.querySelector<HTMLInputElement>('[name="time"]')!.value)).toBeCloseTo(1.8137993642342178,7);expect(measures).not.toHaveBeenCalled();expect(v.container.querySelector('.cf1-table')!.textContent).toContain('4.038174 s');
});

it.each(['underflow','badInput'])('reconciles the checked cursor after a shorter horizon while preserving the %s native draft',kind=>{
  const v=visit(),native=v.container.querySelector<HTMLInputElement>('[name="time"]')!,range=v.container.querySelector<HTMLInputElement>('[name="time-range"]')!;
  expect(native.value).toBe('5');
  native.value=kind==='underflow'?'1e-999':'';
  const validity=kind==='badInput'?vi.spyOn(native,'validity','get').mockReturnValue({badInput:true} as ValidityState):undefined;
  native.dispatchEvent(new Event('input'));const writes=vi.spyOn(native,'value','set'),raw=native.value;
  v.input('horizon','1.21');v.click('compute');
  expect(v.container.querySelector('[name="time"]')).toBe(native);expect(native.value).toBe(raw);expect(writes).not.toHaveBeenCalled();if(validity)expect(native.validity.badInput).toBe(true);
  expect(range.max).toBe('1.21');expect(range.valueAsNumber).toBeCloseTo(.605,14);
  const cursor=v.container.querySelector('.cf1-response .cf1-cursor')!;expect(Number(cursor.getAttribute('x1'))).toBeCloseTo(300,12);expect(cursor.getAttribute('x2')).toBe(cursor.getAttribute('x1'));
  expect(v.container.querySelector('.cf1-inspection')!.textContent).toContain('Last checked cursor: t=0.605 s within the accepted 0–1.21 s horizon.');expect(v.container.querySelector('.cf1-inspection')!.textContent).toContain(kind==='underflow'?'nonzero but too small':'finite number');
  validity?.mockRestore();v.input('time','.5');expect(range.valueAsNumber).toBe(.5);expect(v.container.querySelector('.cf1-inspection')!.textContent).toContain('At t=0.5 s:');expect(v.container.querySelector('.cf1-inspection')!.textContent).not.toContain('Last checked cursor');
});
