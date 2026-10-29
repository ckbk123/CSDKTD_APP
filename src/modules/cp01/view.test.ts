import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EquationInputOptions } from '../../shared/equations/input';
import { mountView } from './view';

// Caller-owned drafts/lifecycle only. These stand-ins are not editor/browser evidence.
vi.mock('../../shared/equations/input', () => ({
  createEquationDisplay: (latex: string, title: string) => { const node = document.createElement('div'); node.setAttribute('aria-label', title); node.textContent = latex; return node; },
  createEquationInput: (options: EquationInputOptions) => {
    const element = document.createElement('div'), field = document.createElement('textarea'); field.value = options.value; field.setAttribute('aria-label', options.label); element.append(field);
    const getValue = () => ({ latex: field.value, empty: !field.value.trim(), syntaxIssues: [], hasPlaceholders: field.value.includes('placeholder') });
    field.addEventListener('input', () => options.onChange?.(getValue()), { signal: options.signal });
    const destroy = () => element.remove(); options.signal.addEventListener('abort', destroy, { once: true });
    return { element, getValue, setValue: (value: string) => { field.value = value; }, destroy, focus: () => field.focus() };
  },
}));
const visits: { root: HTMLElement; controller: AbortController; cleanup: () => void }[] = [];
afterEach(() => { for (const v of visits.splice(0)) { v.controller.abort(); v.cleanup(); v.root.remove(); } });
function open() {
  const root = document.createElement('div'); root.dataset.module = 'CP01'; document.body.append(root); const controller = new AbortController();
  const cleanup = mountView({ container: root, signal: controller.signal }) as () => void;
  const v = { root, controller, cleanup }; visits.push(v); return v;
}
function field<T extends HTMLInputElement | HTMLSelectElement>(root: HTMLElement, title: string): T {
  const labels = Array.from(root.querySelectorAll('label')); const node = labels.find(label => label.firstChild?.textContent === title)?.querySelector('input,select');
  expect(node, title).toBeDefined(); return node as T;
}
function edit(node: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement, value: string, change = false): void { node.value = value; node.dispatchEvent(new Event(change ? 'change' : 'input', { bubbles: true })); }
function reveal(root: HTMLElement): void { root.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); }
function result(root: HTMLElement): HTMLElement { return root.querySelector('[aria-label="Checked response"]')!; }
function preset(root: HTMLElement, value: string): void { edit(field(root, 'Experiment'), value, true); }
describe('complete response exercise flow', () => {
  it('reveals computed baseline terms and direct cursor value only on request', () => {
    const { root } = open(); expect(result(root).children).toHaveLength(0); reveal(root);
    expect(result(root).textContent).toContain('e^{-t}'); expect(result(root).textContent).toContain('0.1997882');
    expect(result(root).querySelectorAll('.cp-plot-scroll')).toHaveLength(2);
    expect(root.textContent).toContain('strictly stable');
  });
  it('compares an actual attempt and computes changed data', () => {
    const { root } = open(); field<HTMLInputElement>(root, 'Compare my numerical prediction (optional)').checked = true; reveal(root);
    expect(root.querySelector('.cp-feedback')?.textContent).toContain('Compare your prediction');
    edit(field(root, 'Predicted total y (normalized units)'), '.1997882'); reveal(root);
    expect(root.querySelector('.cp-feedback')?.textContent).toContain('Your prediction agrees');
    preset(root, '1'); reveal(root); expect(result(root).textContent).toContain('0.3153829');
  });
  it('preserves both initial state and checked trajectories across coordinate views', () => {
    const { root } = open(); preset(root, '2'); reveal(root);
    const paths = Array.from(result(root).querySelectorAll('path.cp-curve')).map(p => p.getAttribute('d'));
    const original = result(root).querySelector('[aria-label="Computed cursor values; ordinary parts only"]')!.textContent;
    edit(field(root, 'Coordinate view (preserves the initial state)'), 'centered', true);
    expect(result(root).textContent).toContain('\\frac{3}{2}');
    expect(field<HTMLInputElement>(root, 'Initial x₁ = w(0−)').value).toBe('1');
    expect(result(root).querySelector('[aria-label="Computed cursor values; ordinary parts only"]')!.textContent).toBe(original);
    expect(Array.from(result(root).querySelectorAll('path.cp-curve')).map(p => p.getAttribute('d'))).toEqual(paths);
  });
  it('handles an ideal direct impulse by signed area without a finite peak', () => {
    const { root } = open(); preset(root, '8'); reveal(root);
    expect(result(root).textContent).toContain('output 2 output-units·s');
    expect(result(root).querySelectorAll('path.cp-impulse')).toHaveLength(2);
    edit(field(root, 'Cursor time (s)'), '0');
    const table = result(root).querySelector('[aria-label="Computed cursor values; ordinary parts only"]')!;
    expect(table.textContent).toContain('0+0011');
    edit(field(root, 'One-sided value'), 'left', true); expect(table.isConnected).toBe(false);
    expect(result(root).querySelector('[aria-label="Computed cursor values; ordinary parts only"]')!.textContent).toContain('0−0000');
  });
  it('shows pulse width/area/height and one-sided turn-off values', () => {
    const { root } = open(); preset(root, '9'); reveal(root);
    expect(result(root).textContent).toContain('A/W=10');
    edit(field(root, 'Cursor time (s)'), '.1');
    expect(result(root).querySelector('[aria-label="Computed cursor values; ordinary parts only"]')!.textContent).toContain('0.9516258');
    edit(field(root, 'One-sided value'), 'left', true);
    expect(result(root).querySelector('[aria-label="Computed cursor values; ordinary parts only"]')!.textContent).toContain('20.95163');
  });
  it.each(['3', '4', '5', '6', '7', '10'])('computes the declared mode experiment %s', value => {
    const { root } = open(); preset(root, value); reveal(root);
    expect(result(root).querySelectorAll('.cp-plot-scroll')).toHaveLength(2);
    expect(root.querySelector('.cp-feedback')?.textContent).toContain('Response revealed');
  });
  it('clears old answers on invalid equations and rejects mixed-number ambiguity', () => {
    const { root } = open(); reveal(root);
    edit(root.querySelector('textarea')!, 's2\\frac12'); expect(result(root).children).toHaveLength(0); reveal(root);
    expect(result(root).children).toHaveLength(0); expect(root.querySelector('.cp-feedback')?.textContent).toContain('mixed');
    edit(root.querySelector('textarea')!, 's^2'); edit(root.querySelectorAll('textarea')[1], 's+1'); reveal(root);
    expect(root.querySelector('.cp-feedback')?.textContent).toContain('proper');
  });
  it.each(['1e-999', '-1e-999', ''])('rejects native amplitude draft %s without stale results', raw => {
    const { root } = open(); reveal(root); edit(field(root, 'Amplitude / slope / area A'), raw); reveal(root);
    expect(result(root).children).toHaveLength(0); expect(root.querySelector('.cp-feedback')?.textContent).toMatch(/nonzero but too small|finite number/);
  });
  it('validates the cursor locally and preserves the checked model', () => {
    const { root } = open(); reveal(root); edit(field(root, 'Cursor time (s)'), '1e-999');
    expect(result(root).textContent).toContain('nonzero but too small'); expect(result(root).querySelectorAll('.cp-plot-scroll')).toHaveLength(2);
    expect(result(root).querySelector('[aria-label="Computed cursor values; ordinary parts only"]')).toBeNull();
    edit(field(root, 'Cursor time (s)'), '1'); expect(result(root).textContent).toContain('0.1997882');
  });
  it('reports early truncation and insufficient pulse horizon without inventing a limit', () => {
    const { root } = open(); preset(root, '10'); edit(field(root, 'Trace horizon (s)'), '60'); reveal(root);
    expect(result(root).textContent).toContain('Trace stopped early'); expect(result(root).textContent).toContain('No general settling claim');
    preset(root, '9'); edit(field(root, 'Pulse width W (s)'), '10'); reveal(root); expect(result(root).textContent).toContain('pulse ends after this horizon');
  });
  it('restore and a fresh visit return to baseline with no old listener updates', () => {
    const v = open(); preset(v.root, '1'); reveal(v.root); const oldCursor = field<HTMLInputElement>(v.root, 'Cursor time (s)');
    const reset = Array.from(v.root.querySelectorAll('button')).find(b => b.textContent === 'Restore baseline')!; reset.click();
    expect(result(v.root).children).toHaveLength(0); expect(v.root.querySelector('textarea')!.value).toBe('1');
    edit(oldCursor, '2'); expect(result(v.root).children).toHaveLength(0);
    v.controller.abort(); v.cleanup(); const fresh = open(); reveal(fresh.root); expect(result(fresh.root).textContent).toContain('0.1997882');
    edit(field(v.root, 'Trace horizon (s)'), '5'); expect(result(fresh.root).textContent).toContain('0.1997882');
  });
});
