import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EquationInputOptions } from '../../shared/equations/input';
import { locus, numericRoots, solveRegions } from './gains';
import { mountView } from './view';
vi.mock('./gains', async original => { const actual = await original<typeof import('./gains')>(); return { ...actual, solveRegions: vi.fn(actual.solveRegions), locus: vi.fn(actual.locus), numericRoots: vi.fn(actual.numericRoots) }; });
vi.mock('../../shared/equations/input', () => ({
  createEquationDisplay: (value: string, label: string) => { const n = document.createElement('div'); n.textContent = value; n.setAttribute('aria-label', label); return n; },
  createEquationInput: (options: EquationInputOptions) => {
    const element = document.createElement('div'), field = document.createElement('textarea'); field.value = options.value; field.setAttribute('aria-label', options.label); element.append(field);
    const getValue = () => ({ latex: field.value, empty: !field.value.trim(), hasPlaceholders: field.value.includes('placeholder'), syntaxIssues: [] });
    field.addEventListener('input', () => options.onChange?.(getValue()), { signal: options.signal });
    const destroy = () => element.remove(); options.signal.addEventListener('abort', destroy, { once: true });
    return { element, getValue, setValue: (value: string) => { field.value = value; }, destroy, focus: () => field.focus() };
  },
}));
const visits: { root: HTMLElement; controller: AbortController; cleanup: () => void }[] = [];
function open() { const root = document.createElement('div'); root.dataset.module = 'CS05'; document.body.append(root); const controller = new AbortController(), cleanup = mountView({ container: root, signal: controller.signal }) || (() => {}); const v = { root, controller, cleanup }; visits.push(v); return v; }
function field<T extends HTMLElement = HTMLInputElement>(root: HTMLElement, label: string): T { return root.querySelector<T>(`[aria-label="${label}"]`)!; }
function press(root: HTMLElement, label: string) { const b = [...root.querySelectorAll('button')].find(n => n.textContent === label); expect(b).toBeDefined(); b!.click(); }
function input(root: HTMLElement, label: string, value: string) { const n = field<HTMLInputElement>(root, label); n.value = value; n.dispatchEvent(new Event('input', { bubbles: true })); }
const gainText = (root: HTMLElement) => field(root, 'Selected exact gain').textContent;
function frames() { let next = 1; const pending = new Map<number, FrameRequestCallback>(); vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => { const id = next++; pending.set(id, callback); return id; })); const cancel = vi.fn((id: number) => pending.delete(id)); vi.stubGlobal('cancelAnimationFrame', cancel); return { pending, cancel, flush: () => { const callbacks = [...pending.values()]; pending.clear(); callbacks.forEach(callback => callback(0)); } }; }
function pointer(target: Element, type: string, x = 220): void { const event = new MouseEvent(type, { bubbles: true, cancelable: true, button: 0, clientX: x, clientY: 40 }); Object.defineProperty(event, 'pointerId', { value: 9 }); target.dispatchEvent(event); }
function plotBounds() { vi.spyOn(SVGElement.prototype, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 440, height: 90 } as DOMRect); }
afterEach(() => { for (const v of visits.splice(0)) { v.controller.abort(); v.cleanup(); v.root.remove(); } vi.clearAllMocks(); vi.unstubAllGlobals(); });

describe('CS05 immediate exact-gain exploration', () => {
  it('opens with the exact baseline interval, both diagrams and every selected root', () => {
    const { root } = open(); expect(root.querySelectorAll('.cs05-responsive-plane > svg, .cs05-interactive-strip > svg')).toHaveLength(2); expect(field(root, 'Complete exact stable gain set').textContent).toBe('K\\in(0,70)'); expect(root.querySelectorAll('.cs05-inspector li')).toHaveLength(3); expect(gainText(root)).toBe('K=20');
    expect(root.textContent).toContain('Strictly stable · every exact inequality is positive');
  });
  it('reuses the exact region and finite trace while gain changes, keeping axes fixed', () => {
    const { root } = open(), solves = vi.mocked(solveRegions).mock.calls.length, traces = vi.mocked(locus).mock.calls.length;
    const paths = [...root.querySelectorAll('.cs05-responsive-plane .cs05-branch')].map(n => n.getAttribute('d')), ticks = [...root.querySelectorAll('.cs05-responsive-plane text')].map(n => n.textContent);
    input(root, 'Numeric gain K', '80'); expect(root.textContent).toContain('Not strictly stable ·'); expect(root.querySelectorAll('.cs05-inspector li')).toHaveLength(3);
    input(root, 'Numeric gain K', '10000'); expect(root.textContent).toContain('Some selected roots are outside this view');
    expect(vi.mocked(solveRegions).mock.calls).toHaveLength(solves); expect(vi.mocked(locus).mock.calls).toHaveLength(traces); expect([...root.querySelectorAll('.cs05-responsive-plane .cs05-branch')].map(n => n.getAttribute('d'))).toEqual(paths); expect([...root.querySelectorAll('.cs05-responsive-plane text')].map(n => n.textContent)).toEqual(ticks);
  });
  it('selects the exact crossing and keeps all three baseline roots', () => {
    const { root } = open(); press(root, 'Select endpoint 2'); expect(gainText(root)).toBe('K=70'); expect(root.textContent).toContain('Not strictly stable ·'); expect(root.textContent).toContain('Exact endpoint identity retained'); expect(root.textContent).toContain('3.162278'); expect(root.textContent).toContain('-7');
  });
  it('preserves exact surd identity across a view-only range change and an unchanged rational-gain action', () => {
    const { root } = open(); press(root, 'Irrational boundaries'); press(root, 'Select endpoint 3'); const endpoint = gainText(root), solves = vi.mocked(solveRegions).mock.calls.length;
    expect(endpoint).toContain('sqrt'); expect(root.textContent).toContain('Not strictly stable ·'); input(root, 'Locus maximum gain', '5'); press(root, 'Apply view range'); expect(gainText(root)).toBe(endpoint); expect(vi.mocked(solveRegions).mock.calls).toHaveLength(solves);
    press(root, 'Apply rational gain'); expect(gainText(root)).toBe(endpoint); input(root, 'Numeric gain K', '.5'); expect(gainText(root)).toBe('K=\\frac{1}{2}'); expect(root.textContent).not.toContain('Exact endpoint identity retained'); expect(root.textContent).toContain('Strictly stable ·');
  });
  it('retains multiple/unbounded ranges, negative numerator and zero numerator support', () => {
    const { root } = open(); press(root, 'Two stable ranges'); expect(field(root, 'Complete exact stable gain set').textContent).toContain('(\\frac{1}{3},1)\\cup(3,\\infty)');
    press(root, 'Stable from zero'); input(root, 'Numeric gain K', '0'); expect(field(root, 'Complete exact stable gain set').textContent).toBe('K\\in[0,2)'); expect(root.textContent).toContain('Strictly stable ·'); input(root, 'Numeric gain K', '3'); expect(root.textContent).toContain('Not strictly stable ·');
    input(root, 'Fixed numerator N(s)', '0'); input(root, 'Fixed denominator D(s)', 's+1'); press(root, 'Apply model'); expect(field(root, 'Complete exact stable gain set').textContent).toBe('K\\in[0,\\infty)'); expect(root.querySelectorAll('.cs05-inspector li')).toHaveLength(1);
  });
  it('rejects nonzero numeric underflow and invalid models with an honest last-checked visual', () => {
    const { root } = open(), before = gainText(root); input(root, 'Numeric gain K', '1e-999'); expect(gainText(root)).toBe(before); expect(root.textContent).toContain('last checked result is retained');
    input(root, 'Fixed numerator N(s)', 's^3'); press(root, 'Apply model'); expect(root.textContent).toContain('last checked model'); expect(field(root, 'Complete exact stable gain set').textContent).toBe('K\\in(0,70)'); expect(field<HTMLInputElement>(root, 'Numeric gain K').disabled).toBe(true);
    press(root, 'Discard model draft'); expect(field<HTMLInputElement>(root, 'Numeric gain K').disabled).toBe(false); input(root, 'Numeric gain K', '0e-999'); expect(gainText(root)).toBe('K=0');
  });
  it('keeps fine range cursors nonzero and separates range validation from the cached region', () => {
    const { root } = open(), solves = vi.mocked(solveRegions).mock.calls.length; input(root, 'Locus maximum gain', '1e-999'); press(root, 'Apply view range'); expect(root.textContent).toContain('nonzero but too small');
    input(root, 'Locus maximum gain', '.00123456789123'); press(root, 'Apply view range'); input(root, 'Live gain cursor', '.00000123456789123'); expect(gainText(root)).not.toBe('K=0'); expect(root.textContent).toContain('Strictly stable ·'); expect(vi.mocked(solveRegions).mock.calls).toHaveLength(solves);
  });
  it('gives Practice a fresh hidden-answer attempt while preserving the Explore model', () => {
    const { root } = open(); press(root, 'Changed cubic'); press(root, 'Practice'); const practice = root.querySelector<HTMLElement>('[data-learning-mode="practice"]')!;
    expect(practice.querySelector('svg')).toBeNull(); expect(practice.querySelector<HTMLElement>('.cs05-output')!.hidden).toBe(true); press(practice, 'Derive intervals and reveal'); expect(practice.textContent).toContain('K\\in(0,70)');
    press(root, 'Explore'); const explore = root.querySelector<HTMLElement>('[data-learning-mode="explore"]')!; expect(field(explore, 'Complete exact stable gain set').textContent).toBe('K\\in(0,48)');
  });
  it('coalesces a gain scrub, keeps all roots/axes, then restores the exact prior gain on Escape from stable focus', () => {
    const animation = frames(), { root } = open(); plotBounds(); const host = root.querySelector<HTMLElement>('.cs05-interactive-strip')!, ticks = [...root.querySelectorAll('.cs05-responsive-plane text')].map(n => n.textContent), solves = vi.mocked(solveRegions).mock.calls.length, traces = vi.mocked(locus).mock.calls.length, roots = vi.mocked(numericRoots).mock.calls.length;
    pointer(host.querySelector('svg')!, 'pointerdown'); pointer(host, 'pointermove', 300); pointer(host, 'pointermove', 350); expect(animation.pending.size).toBe(1); animation.flush();
    expect(vi.mocked(numericRoots).mock.calls).toHaveLength(roots + 1); expect(root.textContent).toContain('Not strictly stable ·'); expect(root.querySelectorAll('.cs05-inspector li')).toHaveLength(3); expect(document.activeElement).toBe(host);
    expect([...root.querySelectorAll('.cs05-responsive-plane text')].map(n => n.textContent)).toEqual(ticks); expect(vi.mocked(solveRegions).mock.calls).toHaveLength(solves); expect(vi.mocked(locus).mock.calls).toHaveLength(traces);
    const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }); document.activeElement!.dispatchEvent(escape); expect(escape.defaultPrevented).toBe(true); expect(gainText(root)).toBe('K=20'); expect(root.textContent).toContain('Gain drag cancelled'); expect(animation.pending.size).toBe(0);
  });
  it('selects exact strip endpoints on click and keeps a clicked surd thumb exact until it actually moves', () => {
    frames(); const { root } = open(); plotBounds(); const host = root.querySelector<HTMLElement>('.cs05-interactive-strip')!;
    pointer(host.querySelector('[data-endpoint="1"]')!, 'pointerdown', 292); pointer(host, 'pointerup', 292); expect(gainText(root)).toBe('K=70'); expect(root.textContent).toContain('Exact endpoint identity retained');
    press(root, 'Irrational boundaries'); press(root, 'Select endpoint 3'); const before = gainText(root); pointer(host.querySelector('.cs05-gain-handle')!, 'pointerdown', 42); pointer(host, 'pointerup', 42); expect(gainText(root)).toBe(before); expect(root.textContent).toContain('Not strictly stable ·');
  });
  it('treats manually edited computed notation as a draft instead of borrowing endpoint identity', () => {
    const { root } = open(); press(root, 'Irrational boundaries'); press(root, 'Select endpoint 3'); const exact = gainText(root), editor = field<HTMLTextAreaElement>(root, 'Exact rational gain K');
    input(root, 'Exact rational gain K', editor.value); press(root, 'Apply rational gain'); expect(gainText(root)).toBe(exact); expect(root.textContent).toContain('last checked result is retained');
    input(root, 'Exact rational gain K', String.raw`\frac12`); press(root, 'Apply rational gain'); expect(gainText(root)).toBe('K=\\frac{1}{2}'); expect(root.textContent).not.toContain('Exact endpoint identity retained');
  });
  it('retains the exact selected gain across a model edit without claiming it is a boundary of the new model', () => {
    const { root } = open(); press(root, 'Irrational boundaries'); press(root, 'Select endpoint 3'); const before = gainText(root);
    input(root, 'Fixed numerator N(s)', '1'); input(root, 'Fixed denominator D(s)', 's+1'); press(root, 'Apply model');
    expect(gainText(root)).toBe(before); expect(field(root, 'Complete exact stable gain set').textContent).toBe('K\\in[0,\\infty)'); expect(root.textContent).toContain('Strictly stable ·'); expect(root.textContent).toContain('Exact algebraic gain retained from the earlier model'); expect(root.textContent).not.toContain('Exact endpoint identity retained');
  });
  it('keeps a common full characteristic mode instead of cancelling it in the root list', () => {
    const { root } = open(); input(root, 'Fixed numerator N(s)', 's+1'); input(root, 'Fixed denominator D(s)', '(s+1)(s+2)'); press(root, 'Apply model'); input(root, 'Numeric gain K', '50');
    const values = [...root.querySelectorAll('.cs05-inspector li')].map(node => node.textContent); expect(values).toHaveLength(2); expect(values.some(value => value?.includes(': -1 + j0'))).toBe(true); expect(values.some(value => value?.includes(': -52 + j0'))).toBe(true); expect(root.textContent).toContain('Strictly stable ·');
  });
  it('owns pending animation/resize resources and cancels a scrub when the measured plot width changes', () => {
    const animation = frames(); let resized: ResizeObserverCallback; const disconnect = vi.fn(); vi.stubGlobal('ResizeObserver', class { constructor(callback: ResizeObserverCallback) { resized = callback; } observe() {} disconnect = disconnect; });
    const { root, cleanup, controller } = open(); plotBounds(); const host = root.querySelector<HTMLElement>('.cs05-interactive-strip')!, solves = vi.mocked(solveRegions).mock.calls.length, traces = vi.mocked(locus).mock.calls.length, roots = vi.mocked(numericRoots).mock.calls.length;
    resized!([{ contentRect: { width: 276 } } as ResizeObserverEntry], {} as ResizeObserver); expect(vi.mocked(numericRoots).mock.calls).toHaveLength(roots); expect(root.querySelector('.cs05-responsive-plane svg')!.getAttribute('style')).toContain('--cs05-plot-font');
    pointer(host.querySelector('svg')!, 'pointerdown'); pointer(host, 'pointermove', 350); animation.flush(); resized!([{ contentRect: { width: 300 } } as ResizeObserverEntry], {} as ResizeObserver); expect(gainText(root)).toBe('K=20'); expect(root.textContent).toContain('Gain drag cancelled');
    pointer(host.querySelector('svg')!, 'pointerdown'); pointer(host, 'pointermove', 350); const late = [...animation.pending.values()][0]; cleanup(); expect(controller.signal.aborted).toBe(false); expect(disconnect).toHaveBeenCalledOnce(); late(0); resized!([{ contentRect: { width: 500 } } as ResizeObserverEntry], {} as ResizeObserver);
    expect(root.children).toHaveLength(0); expect(vi.mocked(solveRegions).mock.calls).toHaveLength(solves); expect(vi.mocked(locus).mock.calls).toHaveLength(traces);
  });
  it('clears a revealed Practice grade when a prediction changes', () => {
    const { root } = open(); press(root, 'Practice'); const practice = root.querySelector<HTMLElement>('[data-learning-mode="practice"]')!; input(practice, 'Your selected-gain prediction', 'Strictly stable'); press(practice, 'Derive intervals and reveal'); expect(practice.textContent).toContain('Gain prediction matches');
    input(practice, 'Your selected-gain prediction', 'Not strictly stable'); expect(practice.textContent).toContain('Gain prediction differs'); expect(practice.textContent).not.toContain('Gain prediction matches');
    input(practice, 'Your number of stable intervals', '1e-999'); expect(practice.textContent).not.toContain('Gain prediction differs'); expect(practice.textContent).toContain('nonzero but too small');
  });
});
