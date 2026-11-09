import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EquationInputOptions } from '../../shared/equations/input';
const editorState = vi.hoisted(() => ({ fail: false, abort: undefined as undefined | (() => void), resource: vi.fn() }));
vi.mock('../../shared/equations/input', () => ({
  createEquationDisplay: (latex: string, label: string) => { const node = document.createElement('div'); node.textContent = latex; node.setAttribute('aria-label', label); return node; },
  createEquationInput: (options: EquationInputOptions) => {
    const abort = editorState.abort; editorState.abort = undefined; abort?.();
    if (editorState.fail) { window.addEventListener('cp03-editor-probe', editorState.resource, { signal: options.signal }); throw new Error('partial editor'); }
    const element = document.createElement('div'), input = document.createElement('textarea'); input.value = options.value; input.setAttribute('aria-label', options.label); element.append(input);
    const getValue = () => ({ latex: input.value, empty: !input.value.trim(), hasPlaceholders: false, syntaxIssues: [] }); input.addEventListener('input', () => options.onChange?.(getValue()), { signal: options.signal });
    return { element, getValue, setValue: (value: string) => { input.value = value; }, focus: () => input.focus(), destroy: () => element.remove() };
  },
}));
import { mount } from './view';
import * as calculation from './calculation';
const active = (root: HTMLElement) => root.querySelector<HTMLElement>('[data-cp03-panel]:not([hidden])') ?? root;
const field = <T extends HTMLElement = HTMLInputElement>(root: HTMLElement, label: string): T => (label === 'Learning mode' ? root : active(root)).querySelector<T>(`[aria-label="${label}"]`)!;
const set = (root: HTMLElement, label: string, value: string, event = 'input') => { const e = field<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(root, label); e.value = value; e.dispatchEvent(new Event(event, { bubbles: true })); return e; };
const click = (root: HTMLElement, label: string) => [...active(root).querySelectorAll('button')].find(e => e.textContent === label)!.click();
const visits: (() => void)[] = [];
function open() { const root = document.createElement('div'); root.dataset.module = 'CP03'; document.body.append(root); const parent = new AbortController(), dispose = mount({ container: root, signal: parent.signal }); visits.push(() => { parent.abort(); dispose?.(); root.remove(); }); return { root, parent, dispose }; }
function pointer(target: EventTarget, type: string, x: number, y = 100, id = 7) { const e = new MouseEvent(type, { clientX: x, clientY: y, button: 0, bubbles: true, cancelable: true }); Object.defineProperty(e, 'pointerId', { value: id }); target.dispatchEvent(e); }
function rectangles() { vi.spyOn(SVGElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: SVGElement) { const parts = this.getAttribute('viewBox')!.split(' ').map(Number); return { left: 0, top: 0, width: parts[2], height: parts[3] } as DOMRect; }); }
function handle(root: HTMLElement, key: string, plot = 'time') { return active(root).querySelector<SVGElement>(`figure[data-plot="${plot}"] [data-cp03-handle="${key}"]`)!; }
function timeX(root: HTMLElement, t: number) { const width = Number(active(root).querySelector('figure[data-plot="time"] > svg')!.getAttribute('viewBox')!.split(' ')[2]); return 78 + (width - 28 - 78) * (t - 8) / (6 * Math.PI); }
afterEach(() => { visits.splice(0).forEach(dispose => dispose()); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); editorState.fail = false; editorState.abort = undefined; editorState.resource.mockClear(); });

describe('CP03 live measurement workbench — DOM evidence only', () => {
  it('opens computed Explore with waveforms before editable setup and all linked views', () => {
    const { root } = open(); expect(active(root).querySelectorAll('figure')).toHaveLength(4); expect(active(root).textContent).toContain('Calculated |G(jω)|=0.31623');
    expect(active(root).querySelector('.cp03-time-host')!.compareDocumentPosition(field(root, 'Plant G(s)')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(field(root, 'Frequency ω (rad/s)').parentElement!.querySelectorAll('input')).toHaveLength(1); expect(field(root, 'Linked frequency cursor · 0.01–100 rad/s (logarithmic)').parentElement!.querySelectorAll('input')).toHaveLength(1);
  });
  it('coalesces continuous source edits from the first event and doubles physical amplitudes without changing gain', () => {
    vi.useFakeTimers(); const { root } = open(), solver = vi.spyOn(calculation, 'prepare');
    set(root, 'Input amplitude A', '1.5'); vi.advanceTimersByTime(20); set(root, 'Input amplitude A', '2'); vi.advanceTimersByTime(20); expect(solver).toHaveBeenCalledOnce();
    expect(active(root).textContent).toContain('Calculated |G(jω)|=0.31623; output amplitude=0.63246');
    set(root, 'Frequency ω (rad/s)', '2'); vi.advanceTimersByTime(40); expect(active(root).textContent).toContain('Calculated |G(jω)|=0.15811; output amplitude=0.31623');
  });
  it('places a horizontal output peak against the independent baseline lag without solving again', () => {
    vi.useFakeTimers(); const { root } = open(); rectangles(); const solver = vi.spyOn(calculation, 'prepare'), inputPeak = field<HTMLInputElement>(root, 'Input peak tᵤ (s)').valueAsNumber, target = inputPeak + Math.atan(3);
    pointer(handle(root, 'ty'), 'pointerdown', timeX(root, inputPeak)); pointer(window, 'pointermove', timeX(root, target)); vi.advanceTimersByTime(32); pointer(window, 'pointerup', timeX(root, target));
    expect(field<HTMLInputElement>(root, 'Output peak tᵧ (s)').valueAsNumber).toBeCloseTo(target, 12); expect(solver).not.toHaveBeenCalled();
    set(root, 'Output amplitude marker B', String(1 / Math.sqrt(10))); click(root, 'Check marker measurement'); expect(active(root).querySelector('.cp03-grade')?.textContent).toContain('gain 0, phase 0°');
  });
  it('moves B vertically, respects first-pointer ownership and cancels to the prior exact draft', () => {
    vi.useFakeTimers(); const { root } = open(); rectangles(); click(root, 'Window start = 0'); vi.advanceTimersByTime(40); click(root, 'Fit time axes');
    const before = field<HTMLInputElement>(root, 'Output amplitude marker B').value;
    pointer(handle(root, 'B'), 'pointerdown', 640, 90); pointer(window, 'pointermove', 640, 131); vi.advanceTimersByTime(32); expect(field<HTMLInputElement>(root, 'Output amplitude marker B').valueAsNumber).toBeCloseTo(0, 12);
    pointer(handle(root, 'ty'), 'pointerdown', 300, 74, 8); pointer(window, 'pointermove', 400, 70, 8); pointer(window, 'pointerup', 400, 70, 8); pointer(active(root), 'lostpointercapture', 0, 0, 8); pointer(window, 'pointercancel', 0, 0, 8);
    expect(field<HTMLInputElement>(root, 'Output amplitude marker B').valueAsNumber).toBeCloseTo(0, 12); pointer(window, 'pointercancel', 0, 0, 7); expect(field<HTMLInputElement>(root, 'Output amplitude marker B').value).toBe(before);
  });
  it('keeps repeated keyboard frequency edits on the originating phase plot and links every response', () => {
    const { root } = open(); handle(root, 'frequency', 'phase').focus(); const focus = vi.spyOn(SVGElement.prototype, 'focus');
    for (let i = 0; i < 2; i++) { handle(root, 'frequency', 'phase').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true })); expect(document.activeElement).toBe(handle(root, 'frequency', 'phase')); expect(focus).toHaveBeenLastCalledWith({ preventScroll: true }); }
    expect(field<HTMLInputElement>(root, 'Frequency ω (rad/s)').valueAsNumber).toBeCloseTo(10 ** .04, 12); expect(active(root).querySelectorAll('figure')).toHaveLength(4);
  });
  it('preserves native source partial drafts without setter writes through view and mode actions', () => {
    vi.useFakeTimers(); const { root } = open(); const input = field<HTMLInputElement>(root, 'Frequency ω (rad/s)'); input.value = '';
    const validity = vi.spyOn(input, 'validity', 'get').mockReturnValue({ badInput: true } as ValidityState), writes = vi.spyOn(input, 'value', 'set'); input.dispatchEvent(new Event('input', { bubbles: true })); vi.advanceTimersByTime(40);
    click(root, 'Fit time axes'); set(root, 'Learning mode', 'practice', 'change'); set(root, 'Learning mode', 'explore', 'change'); window.dispatchEvent(new Event('blur'));
    expect(field(root, 'Frequency ω (rad/s)')).toBe(input); expect(writes).not.toHaveBeenCalled(); expect(active(root).querySelectorAll('figure')).toHaveLength(0);
    validity.mockRestore(); writes.mockRestore(); set(root, 'Frequency ω (rad/s)', '2'); vi.advanceTimersByTime(40); expect(active(root).textContent).toContain('Calculated |G(jω)|=0.15811');
  });
  it('does not overwrite native partial frequency text while canceling an active frequency drag', () => {
    vi.useFakeTimers(); const { root } = open(); rectangles(); pointer(handle(root, 'frequency', 'phase'), 'pointerdown', 374); pointer(window, 'pointermove', 420); vi.advanceTimersByTime(32);
    const input = field<HTMLInputElement>(root, 'Frequency ω (rad/s)'); input.value = ''; const validity = vi.spyOn(input, 'validity', 'get').mockReturnValue({ badInput: true } as ValidityState), writes = vi.spyOn(input, 'value', 'set'); input.dispatchEvent(new Event('input', { bubbles: true })); vi.advanceTimersByTime(40);
    set(root, 'Learning mode', 'practice', 'change'); set(root, 'Learning mode', 'explore', 'change'); expect(field(root, 'Frequency ω (rad/s)')).toBe(input); expect(writes).not.toHaveBeenCalled(); expect(active(root).querySelectorAll('figure')).toHaveLength(0);
    validity.mockRestore(); writes.mockRestore(); set(root, 'Frequency ω (rad/s)', '2'); vi.advanceTimersByTime(40); expect(active(root).textContent).toContain('Calculated |G(jω)|=0.15811');
  });
  it('preserves partial marker text when an active placement is canceled and then recovers', () => {
    vi.useFakeTimers(); const { root } = open(); rectangles(); pointer(handle(root, 'B'), 'pointerdown', 640, 90); pointer(window, 'pointermove', 640, 110); vi.advanceTimersByTime(32);
    const input = field<HTMLInputElement>(root, 'Output amplitude marker B'); input.value = ''; const validity = vi.spyOn(input, 'validity', 'get').mockReturnValue({ badInput: true } as ValidityState), writes = vi.spyOn(input, 'value', 'set'); input.dispatchEvent(new Event('input', { bubbles: true }));
    set(root, 'Learning mode', 'practice', 'change'); set(root, 'Learning mode', 'explore', 'change'); expect(field(root, 'Output amplitude marker B')).toBe(input); expect(writes).not.toHaveBeenCalled(); expect(active(root).querySelector('.cp03-marker-error')?.textContent).toContain('finite number');
    validity.mockRestore(); writes.mockRestore(); set(root, 'Output amplitude marker B', '.3'); expect(active(root).querySelector('.cp03-measurement')?.textContent).toContain('B/A=0.3');
  });
  it('keeps independent Practice attempts/checked state while hiding only the actual solution before reveal', () => {
    const { root } = open(); const exploration = active(root); set(root, 'Input amplitude A', '2'); click(root, 'Apply experiment');
    set(root, 'Learning mode', 'practice', 'change'); const practice = active(root); expect(exploration.hidden).toBe(true); expect(exploration.inert).toBe(true); expect(practice.querySelectorAll('figure')).toHaveLength(1); expect(practice.querySelector('.cp03-checked')?.textContent).toBe(''); expect(field<HTMLInputElement>(root, 'Input amplitude A').value).toBe('1');
    set(root, 'Output peak tᵧ (s)', String(field<HTMLInputElement>(root, 'Input peak tᵤ (s)').valueAsNumber + Math.atan(3))); set(root, 'Output amplitude marker B', String(1 / Math.sqrt(10))); click(root, 'Reveal calculation and linked plots'); expect(practice.querySelector('.cp03-grade')?.textContent).toContain('gain 0, phase 0°');
    set(root, 'Learning mode', 'explore', 'change'); expect(active(root)).toBe(exploration); expect(field<HTMLInputElement>(root, 'Input amplitude A').value).toBe('2'); set(root, 'Learning mode', 'practice', 'change'); expect(active(root)).toBe(practice); expect(practice.querySelector('.cp03-grade')?.textContent).toContain('gain 0, phase 0°');
    set(root, 'Output amplitude marker B', '.2'); expect(practice.querySelector('.cp03-grade')?.textContent).not.toContain('gain 0, phase 0°'); expect(practice.querySelectorAll('figure')).toHaveLength(4);
  });
  it('keeps unsettled, formal-only and unavailable-actual warnings outside optional depth', () => {
    const { root } = open(); click(root, 'Slow transient'); const qualification = active(root).querySelector('.cp03-qualification')!; expect(qualification.textContent).toContain('Not settled'); expect(qualification.closest('details')).toBeNull();
    click(root, 'Unstable model'); expect(qualification.textContent).toContain('analytic frequency evaluation only'); set(root, 'Plant G(s)', '1/(s-2)'); click(root, 'Apply experiment');
    const material = active(root).querySelector('.cp03-material')!; expect(material.textContent).toContain('numeric reliability bound'); expect(material.closest('details')).toBeNull(); expect(active(root).querySelectorAll('figure')).toHaveLength(4);
  });
  it('retains off-window marker drafts with valid traces/remaining handles and offers an explicit reset', () => {
    vi.useFakeTimers(); const { root } = open(); const oldPeak = field<HTMLInputElement>(root, 'Output peak tᵧ (s)').value;
    set(root, 'Frequency ω (rad/s)', '10'); vi.advanceTimersByTime(40); expect(field<HTMLInputElement>(root, 'Output peak tᵧ (s)').value).toBe(oldPeak); expect(active(root).textContent).toContain('Their drafts are retained'); expect(handle(root, 'B')).not.toBeNull();
    click(root, 'Reset measurement markers'); expect(handle(root, 'tu')).not.toBeNull(); expect(handle(root, 'ty')).not.toBeNull(); expect(active(root).querySelector('.cp03-marker-error')?.textContent).toBe(''); expect(field<HTMLInputElement>(root, 'Output peak tᵧ (s)').value).toBe(field<HTMLInputElement>(root, 'Input peak tᵤ (s)').value);
  });
  it('reports zero/notch phase and selected singularities without fabricating frequency curves', () => {
    const { root } = open(); set(root, 'Plant G(s)', '0'); click(root, 'Apply experiment'); expect(active(root).textContent).toContain('phase and dB are undefined'); expect(active(root).querySelectorAll('figure')).toHaveLength(2);
    set(root, 'Plant G(s)', '1/(s^2+1)'); click(root, 'Apply experiment'); expect(active(root).textContent).toContain('singular'); expect(active(root).querySelectorAll('figure')).toHaveLength(0);
    set(root, 'Frequency ω (rad/s)', '2'); click(root, 'Apply experiment'); expect(active(root).querySelectorAll('figure')).toHaveLength(4); expect(active(root).textContent).toContain('no guaranteed steady-state experiment');
  });
  it('suspends raw validation and releases pending work and observer resources on direct cleanup', () => {
    vi.useFakeTimers(); const disconnect = vi.fn(); vi.stubGlobal('ResizeObserver', class { observe() {} disconnect = disconnect; });
    const { root, parent, dispose } = open(); const solver = vi.spyOn(calculation, 'prepare'); set(root, 'Frequency ω (rad/s)', '2'); set(root, 'Learning mode', 'practice', 'change'); expect(vi.getTimerCount()).toBe(0);
    set(root, 'Learning mode', 'explore', 'change'); expect(vi.getTimerCount()).toBe(1); const calls = solver.mock.calls.length; dispose?.(); vi.advanceTimersByTime(100); expect(solver).toHaveBeenCalledTimes(calls); expect(parent.signal.aborted).toBe(false); expect(root.children).toHaveLength(0); expect(disconnect).toHaveBeenCalledTimes(2);
  });
  it('aborts partial editor resources before recoverable failure and owns late observer allocation', () => {
    editorState.fail = true; const first = open(); window.dispatchEvent(new Event('cp03-editor-probe')); expect(editorState.resource).not.toHaveBeenCalled(); expect(active(first.root).querySelector('[role="alert"]')).not.toBeNull(); expect(first.parent.signal.aborted).toBe(false);
    editorState.fail = false; const disconnect = vi.fn(), observe = vi.fn(); vi.stubGlobal('ResizeObserver', class { disconnect = disconnect; observe = observe; }); const root = document.createElement('div'), parent = new AbortController(); editorState.abort = () => parent.abort(); const dispose = mount({ container: root, signal: parent.signal });
    expect(root.children).toHaveLength(0); expect(disconnect).toHaveBeenCalledOnce(); expect(observe).not.toHaveBeenCalled(); dispose?.(); expect(disconnect).toHaveBeenCalledOnce();
  });
});
