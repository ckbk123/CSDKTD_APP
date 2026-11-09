import { afterEach, describe, expect, it, vi } from 'vitest';
import { validateLatex } from 'mathlive/ssr';
import type { EquationInputOptions } from '../../shared/equations/input';
const state = vi.hoisted(() => ({ fail: false, make: undefined as ((o: EquationInputOptions) => void) | undefined, latex: [] as string[], destroyed: [] as string[] }));
vi.mock('../../shared/equations/input', () => ({
  createEquationDisplay: (latex: string, label: string) => { if (state.fail) throw new Error('Synthetic typesetting failure'); state.latex.push(latex); const e = document.createElement('div'); e.textContent = latex; e.setAttribute('aria-label', label); return e; },
  createEquationInput: (o: EquationInputOptions) => { const element = document.createElement('textarea'); element.value = o.value; element.setAttribute('aria-label', o.label); const getValue = () => ({ latex: element.value, empty: !element.value, hasPlaceholders: false, syntaxIssues: [] }); element.addEventListener('input', () => o.onChange?.(getValue()), { signal: o.signal }); state.make?.(o); return { element, getValue, setValue: (v: string) => { element.value = v; }, focus: () => element.focus(), destroy: () => { state.destroyed.push(o.label); element.remove(); } }; }
}));
import { mountExplore } from './explore';
import { mount } from './view';
import * as math from './math';
const stops: (() => void)[] = [];
afterEach(() => { state.fail = false; state.make = undefined; stops.splice(0).forEach(stop => stop()); state.latex.length = state.destroyed.length = 0; vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); document.body.replaceChildren(); });
function visit(panel = false) { const container = document.createElement('div'); container.dataset.module = 'CR03'; document.body.append(container); const life = new AbortController(), release = (panel ? mount : mountExplore)({ container, signal: life.signal }); stops.push(() => { life.abort(); release?.(); }); return { container, life, release }; }
function field<T extends HTMLElement = HTMLInputElement>(c: HTMLElement, label: string) { return c.querySelector<T>(`[aria-label="${label}"]`)!; }
function input(c: HTMLElement, label: string, value: string, event = 'input') { const node = field<HTMLInputElement>(c, label); node.value = value; node.dispatchEvent(new Event(event, { bubbles: true })); return node; }
function click(c: HTMLElement, label: string) { [...c.querySelectorAll('button')].find(b => b.textContent === label)!.click(); }
function pointer(target: EventTarget, type: string, id = 7, x = 0, y = 0) { const event = new MouseEvent(type, { bubbles: true, cancelable: true, button: 0, clientX: x, clientY: y }); Object.defineProperty(event, 'pointerId', { value: id }); target.dispatchEvent(event); }
function bad(input: HTMLInputElement) { input.value = ''; Object.defineProperty(input, 'validity', { configurable: true, get: () => ({ badInput: true }) }); input.dispatchEvent(new Event('input', { bubbles: true })); const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!, writes = vi.fn(); Object.defineProperty(input, 'value', { configurable: true, get() { return descriptor.get!.call(this); }, set(v) { writes(v); descriptor.set!.call(this, v); } }); return writes; }
const checked = (c: HTMLElement) => field(c, 'Checked coordinate transformation').textContent;
describe('CR03 tangible coordinate exploration', () => {
  it('opens with real baseline output/state and cached endpoint-inclusive inspection', () => {
    const { container: c } = visit(); expect(c.querySelectorAll('.cr03-plot > svg')).toHaveLength(2); const evaluate = vi.spyOn(math, 'samples');
    input(c, 'Computed sample index k', '200'); expect(c.querySelector('.cr03-sample')!.textContent).toContain('t=5 s'); expect(c.querySelector('.cr03-sample')!.textContent).toContain('0.4932848');
    click(c, 'Fit checked trajectories'); input(c, 'Selected state component', '1', 'change'); expect(evaluate).not.toHaveBeenCalled();
  });
  it('shows independently derived constant z1 after mapped initial state and family edits', () => {
    vi.useFakeTimers(); const { container: c } = visit(); input(c, 'Explore x1(0−)', '1'); input(c, 'Explore x2(0−)', '-1'); click(c, 'Apply experiment');
    input(c, 'Coordinate scale s', '2'); input(c, 'Coordinate shear h', '1'); expect(c.querySelector('.cr03-live')!.textContent).toContain('Updating'); vi.advanceTimersByTime(80);
    input(c, 'Computed sample index k', '40'); expect(c.querySelector('.cr03-sample')!.textContent).toContain('z=[1, -0.06766764]'); expect(c.querySelector('.cr03-sample')!.textContent).toContain('y original=0.5676676, mapped=0.5676676');
    expect(checked(c)).toContain('2&1'); expect(validateLatex(checked(c)!)).toEqual([]);
  });
  it('retains exact native badInput elements through Fit, selection, modes and shorter sample count', () => {
    const { container: c } = visit(true), cursor = field(c, 'Computed sample index k'); input(c, 'Computed sample index k', '200'); const writes = bad(cursor);
    click(c, 'Fit checked trajectories'); input(c, 'Selected state component', '1', 'change'); input(c, 'Explore computed points', '2'); click(c, 'Apply experiment');
    expect(c.querySelector('.cr03-sample')!.textContent).toContain('k=1/1'); expect(field(c, 'Computed sample range').value).toBe('1'); expect(writes).not.toHaveBeenCalled(); expect(c.querySelector('.cr03-live')!.textContent).toContain('number');
    input(c, 'Learning mode', 'practice', 'change'); input(c, 'Learning mode', 'explore', 'change'); expect(field(c, 'Computed sample index k')).toBe(cursor); expect(writes).not.toHaveBeenCalled();
    Reflect.deleteProperty(cursor, 'validity'); input(c, 'Computed sample index k', '0'); expect(c.querySelector('.cr03-sample')!.textContent).toContain('k=0/1');
  });
  it('preserves raw invalid family and general-T native drafts during view-only actions', () => {
    const { container: c } = visit(), scale = field(c, 'Coordinate scale s'), writes = bad(scale), matrix = field(c, 'Explore T draft row 1 column 1'); const matrixWrites = bad(matrix);
    click(c, 'Apply general T'); click(c, 'Fit checked trajectories'); input(c, 'Computed sample index k', '10'); expect(writes).not.toHaveBeenCalled(); expect(matrixWrites).not.toHaveBeenCalled(); expect(checked(c)).toContain('1&0'); expect(c.querySelector('.cr03-live')!.textContent).toContain('number');
  });
  it('supports arbitrary matrix dimensions including static, scalar and coupled fourth-order paths', () => {
    const { container: c } = visit(); input(c, 'Explore given form', 'matrix', 'change'); input(c, 'Explore matrix dimension', '0', 'change'); input(c, 'Explore D row 1 column 1', '3'); input(c, 'Explore constant command u', '2'); click(c, 'Apply experiment'); click(c, 'Apply Explore given model'); expect(c.querySelector('.cr03-sample')!.textContent).toContain('mapped=6'); expect(c.querySelector('[data-handle]')).toBeNull();
    input(c, 'Explore matrix dimension', '1', 'change'); input(c, 'Explore A row 1 column 1', '-2'); input(c, 'Explore B row 1 column 1', '1'); input(c, 'Explore C row 1 column 1', '3'); input(c, 'Explore D row 1 column 1', '.5'); click(c, 'Apply Explore given model'); expect(c.querySelector('.cr03-sample')!.textContent).toContain('mapped=1'); expect(c.querySelector('[data-plane]')).toBeNull();
    input(c, 'Explore matrix dimension', '4', 'change'); for (let i = 1; i <= 4; i++) input(c, `Explore A row ${i} column ${i}`, String(-i)); input(c, 'Explore A row 1 column 4', '1'); input(c, 'Explore C row 1 column 1', '1'); click(c, 'Apply Explore given model'); expect(c.textContent).toContain('all states and coupling'); expect(field(c, 'First coordinate i').querySelectorAll('option')).toHaveLength(4);
    input(c, 'First coordinate i', '3', 'change'); expect(checked(c)).toContain('1&0&0&0');
  });
  it('keeps the accepted model and history coherent if preparing a new displayed result fails', () => {
    vi.useFakeTimers(); const { container: c } = visit(), prior = checked(c); state.fail = true; input(c, 'Coordinate shear h', '1'); vi.advanceTimersByTime(80); state.fail = false; click(c, 'Fit checked trajectories'); expect(checked(c)).toBe(prior); expect([...c.querySelectorAll('button')].find(b => b.textContent === 'Undo coordinate change')!.disabled).toBe(true);
  });
  it('consumes active Escape before an earlier shell listener, owns one pointer and quarantines the old native stream', () => {
    vi.useFakeTimers(); const shell = vi.fn(); window.addEventListener('keydown', shell); const { container: c } = visit(), slider = field(c, 'Coordinate shear range'), captures = new Set<number>(); slider.setPointerCapture = id => { captures.add(id); }; slider.hasPointerCapture = id => captures.has(id); slider.releasePointerCapture = id => { captures.delete(id); };
    pointer(slider, 'pointerdown'); slider.value = '1'; slider.dispatchEvent(new Event('input')); vi.advanceTimersByTime(80); expect(checked(c)).toContain('1&1'); pointer(slider, 'pointerdown', 8); pointer(window, 'pointercancel', 8); pointer(slider, 'lostpointercapture', 8); expect(captures.has(7)).toBe(true);
    state.fail = true; document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })); state.fail = false; expect(checked(c)).toContain('1&0'); expect(shell).not.toHaveBeenCalled(); expect(captures.size).toBe(0);
    slider.value = '1.5'; slider.dispatchEvent(new Event('input')); vi.advanceTimersByTime(80); expect(checked(c)).toContain('1&0'); pointer(window, 'pointerup'); slider.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true })); vi.advanceTimersByTime(80); expect(checked(c)).toContain('0.1'); document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); expect(shell).toHaveBeenCalled(); window.removeEventListener('keydown', shell);
  });
  it('commits a gesture once, preserves focus through repeated handle keys, and Undo restores the starting checked map', () => {
    vi.useFakeTimers(); const { container: c } = visit(), slider = field(c, 'Coordinate shear range'); pointer(slider, 'pointerdown'); slider.value = '.7'; slider.dispatchEvent(new Event('input')); vi.advanceTimersByTime(80); slider.value = '1.3'; slider.dispatchEvent(new Event('input')); vi.advanceTimersByTime(80); pointer(window, 'pointerup'); click(c, 'Undo coordinate change'); expect(checked(c)).toContain('1&0');
    const handle = c.querySelector<SVGElement>('[data-handle="shear"]')!; handle.focus(); handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true })); vi.advanceTimersByTime(80); expect(document.activeElement?.getAttribute('data-handle')).toBe('shear'); document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true })); vi.advanceTimersByTime(80); expect(checked(c)).toContain('0.2');
  });
  it('keeps a new native badInput draft entered during a preview through cancellation without setter writes', () => {
    vi.useFakeTimers(); const { container: c } = visit(), slider = field(c, 'Coordinate shear range'); pointer(slider, 'pointerdown'); slider.value = '1'; slider.dispatchEvent(new Event('input')); vi.advanceTimersByTime(80);
    const native = field(c, 'Coordinate shear h'), writes = bad(native); document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })); expect(writes).not.toHaveBeenCalled(); expect(field(c, 'Coordinate shear h')).toBe(native); expect(checked(c)).toContain('1&0'); expect(c.querySelector('.cr03-live')!.textContent).toContain('number');
  });
  it('moves the inverse-basis handle in actual equal-unit geometry while capture stays on its stable owner', () => {
    vi.useFakeTimers(); const { container: c } = visit(), plane = c.querySelector<SVGSVGElement>('[data-plane="x"]')!, owner = c.querySelector<HTMLElement>('.cr03-planes')!, captures = new Set<number>();
    owner.setPointerCapture = id => { captures.add(id); }; owner.hasPointerCapture = id => captures.has(id); owner.releasePointerCapture = id => { captures.delete(id); };
    const box = plane.getAttribute('viewBox')!.split(' ').map(Number), left = Number(plane.dataset.left), top = Number(plane.dataset.top), size = Number(plane.dataset.size), bound = Number(plane.dataset.bound);
    const bounds = () => ({ left: 0, top: 0, width: box[2], height: box[3] } as DOMRect); plane.getBoundingClientRect = bounds;
    pointer(plane.querySelector('[data-handle="shear"]')!, 'pointerdown'); pointer(window, 'pointermove', 7, left + size / 2 - size / (2 * bound), top + size / 2 - 2 * size / (2 * bound)); vi.advanceTimersByTime(80);
    expect(field(c, 'Coordinate scale s').value).toBe('2'); expect(field(c, 'Coordinate shear h').value).toBe('1'); expect(captures.has(7)).toBe(true); expect(checked(c)).toContain('2&1'); window.dispatchEvent(new Event('blur')); expect(captures.size).toBe(0); expect(checked(c)).toContain('1&0');
  });
  it('retains full numeric coordinate precision, synchronizes Identity and typesets tiny direct terms by their displayed meaning', () => {
    vi.useFakeTimers(); const { container: c } = visit(); input(c, 'Coordinate scale s', '1.2345678901234567'); vi.advanceTimersByTime(80); expect(field(c, 'Coordinate scale s').value).toBe('1.2345678901234567'); click(c, 'Copy checked T to draft cells'); expect(field(c, 'Explore T draft row 1 column 1').value).toBe('1.2345678901234567'); click(c, 'Identity coordinates'); expect(field(c, 'Coordinate scale s').value).toBe('1');
    input(c, 'Explore given form', 'matrix', 'change'); input(c, 'Explore matrix dimension', '0', 'change'); input(c, 'Explore D row 1 column 1', '1e-200'); click(c, 'Apply Explore given model'); expect(field(c, 'Checked x output matrices').textContent).toContain('\\times10^{-200}'); for (const latex of state.latex) expect(validateLatex(latex)).toEqual([]);
  });
  it('withholds original cancellation-contaminated trajectories and recovers at a shorter horizon', () => {
    const { container: c } = visit(); input(c, 'Explore constant command u', '0'); click(c, 'Apply experiment'); input(c, 'Explore given form', 'matrix', 'change'); for (const [label, v] of [['Explore A row 1 column 1', '0'], ['Explore A row 1 column 2', '1'], ['Explore A row 2 column 1', '-1'], ['Explore A row 2 column 2', '8.125']] ) input(c, label, v); click(c, 'Apply Explore given model'); input(c, 'Explore x1(0−)', '1.1'); input(c, 'Explore x2(0−)', '.1375'); click(c, 'Apply experiment'); expect(c.querySelector('.cr03-live')!.textContent).toContain('condition'); input(c, 'Explore horizon H (s)', '1'); click(c, 'Apply experiment'); input(c, 'Computed sample index k', '200'); expect(c.querySelector('.cr03-sample')!.textContent).toContain('1.246463');
  });
  it('rejects a later invalid gesture candidate and restores the starting checked map without an Undo entry', () => {
    vi.useFakeTimers(); const { container: c } = visit(); input(c, 'Explore constant command u', '0'); click(c, 'Apply experiment'); input(c, 'Explore given form', 'matrix', 'change'); input(c, 'Explore A row 1 column 2', '900000'); click(c, 'Apply Explore given model');
    const slider = field(c, 'Coordinate scale range'); pointer(slider, 'pointerdown'); slider.value = '1.01'; slider.dispatchEvent(new Event('input')); vi.advanceTimersByTime(80); expect(checked(c)).toContain('1.01'); slider.value = '2'; slider.dispatchEvent(new Event('input')); vi.advanceTimersByTime(80); expect(c.querySelector('.cr03-live')!.textContent).toContain('numerical range'); pointer(window, 'pointerup'); expect(checked(c)).toContain('1&0'); expect([...c.querySelectorAll('button')].find(b => b.textContent === 'Undo coordinate change')!.disabled).toBe(true);
  });
  it('preserves independent Practice prediction drafts and revokes old grading on edits', () => {
    const { container: c } = visit(true); input(c, 'Learning mode', 'practice', 'change'); const prediction = field(c, 'Predict y(0+)'); input(c, 'Predict y(0+)', '0'); click(c, 'Reveal construction & coordinate check'); const practice = c.querySelector('.cr03')!; expect(practice.textContent).toContain('prediction agrees'); const writes = bad(prediction); click(c, 'Reveal construction & coordinate check'); expect(practice.textContent).not.toContain('prediction agrees'); expect(practice.textContent).toContain('number'); input(c, 'Learning mode', 'explore', 'change'); input(c, 'Learning mode', 'practice', 'change'); expect(field(c, 'Predict y(0+)')).toBe(prediction); expect(writes).not.toHaveBeenCalled();
  });
  it('cleans failed partial and reentrant editor allocation and observer-constructor abort', () => {
    const c = document.createElement('div'), life = new AbortController(); let calls = 0; state.make = () => { if (++calls === 2) throw new Error('partial allocation'); }; expect(() => mountExplore({ container: c, signal: life.signal })).toThrow('partial'); expect(c.children).toHaveLength(0); expect(state.destroyed).toContain('Explore transfer function'); expect(life.signal.aborted).toBe(false);
    state.make = () => life.abort(); expect(() => mountExplore({ container: c, signal: life.signal })).toThrow('closed'); expect(c.children).toHaveLength(0);
    state.make = undefined; const other = new AbortController(), disconnect = vi.fn(), observe = vi.fn(); vi.stubGlobal('ResizeObserver', class { constructor() { other.abort(); } disconnect = disconnect; observe = observe; }); mountExplore({ container: c, signal: other.signal }); expect(observe).not.toHaveBeenCalled(); expect(disconnect).toHaveBeenCalled(); expect(c.children).toHaveLength(0);
  });
  it('owns pending preview work on direct disposal and starts fresh on reset/reopen', () => {
    vi.useFakeTimers(); const x = visit(); input(x.container, 'Coordinate shear h', '1'); x.release?.(); expect(vi.getTimerCount()).toBe(0); vi.advanceTimersByTime(100); expect(x.container.children).toHaveLength(0); const y = visit(); expect(field(y.container, 'Coordinate shear h').value).toBe('0'); for (const latex of state.latex) expect(validateLatex(latex)).toEqual([]);
  });
});
