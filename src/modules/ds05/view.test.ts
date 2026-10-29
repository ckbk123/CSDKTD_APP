import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EquationInputOptions } from '../../shared/equations/input';
import { mountView } from './view';

// Caller-owned draft/flow tests only. Interactive MathLive is checked separately in a browser.
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
  const root = document.createElement('div'); root.dataset.module = 'DS05'; document.body.append(root); const controller = new AbortController();
  const cleanup = mountView({ container: root, signal: controller.signal }) as () => void; const v = { root, controller, cleanup }; visits.push(v); return v;
}
function field<T extends HTMLInputElement | HTMLSelectElement>(root: HTMLElement, title: string): T {
  const label = Array.from(root.querySelectorAll('label')).find(label => label.firstChild?.textContent === title), node = label?.querySelector('input,select');
  expect(node, title).toBeDefined(); return node as T;
}
function edit(node: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement, value: string, change = false): void { node.value = value; node.dispatchEvent(new Event(change ? 'change' : 'input', { bubbles: true })); }
function reveal(root: HTMLElement): void { root.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); }
const result = (root: HTMLElement): HTMLElement => root.querySelector('[aria-label="Checked Nyquist result"]')!;
const preset = (root: HTMLElement, value: string): void => edit(field(root, 'Experiment'), value, true);
describe('guided discrete Nyquist workspace', () => {
  it('reveals the baseline contour relation and independently computed root count', () => {
    const { root } = open(); expect(result(root).children).toHaveLength(0); reveal(root);
    expect(result(root).querySelectorAll('.dn-plot-scroll')).toHaveLength(2);
    expect(result(root).querySelector('[aria-label="Guarded numerical winding and predicted outside count"]')!.textContent).toContain('W=0');
    expect(result(root).querySelector('[aria-label="Full retained closed-loop polynomial"]')!.textContent).toContain('z-\\frac{3}{10}');
    expect(result(root).textContent).toContain('Strictly stable retained closed loop');
  });
  it('checks predictions and preserves the sign for stabilization of an outside pole', () => {
    const { root } = open(); preset(root, '1'); edit(field(root, 'Predicted outside open-loop poles P_out'), '1', true);
    edit(field(root, 'Predicted counterclockwise winding W about −1'), '1', true); edit(field(root, 'Predicted outside closed-loop roots Z_out'), '0', true); reveal(root);
    expect(root.querySelector('.dn-feedback')!.textContent).toContain('P_out agrees; W agrees; Z_out agrees');
    expect(result(root).querySelector('[aria-label="Guarded numerical winding and predicted outside count"]')!.textContent).toContain('1-(1)=0');
  });
  it.each(['2', '3', '4', '5', '8', '9', '10', '12'])('computes changed experiment %s', value => {
    const { root } = open(); preset(root, value); reveal(root);
    expect(result(root).querySelectorAll('.dn-plot-scroll')).toHaveLength(2);
    expect(result(root).textContent).toContain('The contour prediction agrees');
  });
  it('keeps a hidden outside mode in the verdict instead of trusting a reduced picture', () => {
    const { root } = open(); preset(root, '8'); reveal(root);
    expect(result(root).textContent).toContain('Cancelled outside roots: 1'); expect(result(root).textContent).toContain('Unstable retained closed loop');
    expect(result(root).querySelector('[aria-label="Guarded numerical winding and predicted outside count"]')!.textContent).toContain('1-(0)=1');
  });
  it.each(['6', '7'])('reports exact boundary experiment %s without asserting an ordinary winding', value => {
    const { root } = open(); preset(root, value); reveal(root);
    expect(result(root).querySelector('[aria-label="Guarded numerical winding and predicted outside count"]')).toBeNull();
    expect(result(root).textContent).toContain('unit circle'); expect(result(root).textContent).toContain('does not turn this unresolved/boundary contour');
  });
  it('does not turn an unresolved sampled curve into a stability-count proof', () => {
    const { root } = open(); preset(root, '11'); reveal(root);
    expect(result(root).textContent).toContain('No winding count is asserted');
    expect(result(root).textContent).toContain('Strictly stable retained closed loop');
    expect(result(root).querySelector('[aria-label="Guarded numerical winding and predicted outside count"]')).toBeNull();
  });
  it('evaluates cardinal/alias points and keeps the previous cursor on an invalid draft', () => {
    const { root } = open(); reveal(root); edit(field(root, 'Contour angle θ (degrees)'), '90');
    expect(result(root).querySelector('[aria-label="Mapped loop cursor"]')!.textContent).toContain('-0.2439024-0.304878');
    const before = result(root).querySelector('[aria-label="Frequency cursor and alias convention"]')!.textContent;
    edit(field(root, 'Contour angle θ (degrees)'), '1e-999');
    expect(result(root).textContent).toContain('previous valid cursor is retained');
    expect(result(root).querySelector('[aria-label="Frequency cursor and alias convention"]')!.textContent).toBe(before);
    edit(field(root, 'Contour angle θ (degrees)'), '360');
    expect(result(root).querySelector('[aria-label="Equivalent signed angular frequency"]')!.textContent).toBe('0');
  });
  it('keeps the source cursor but hides a missing finite mapped point at a pole', () => {
    const { root } = open(); preset(root, '7'); reveal(root);
    expect(result(root).querySelector('[aria-label="Mapped loop cursor"]')).toBeNull(); expect(result(root).textContent).toContain('No finite mapped point');
    const markers = result(root).querySelectorAll('.dn-marker'); expect(markers[0].getAttribute('visibility')).toBe('visible'); expect(markers[1].getAttribute('visibility')).toBe('hidden');
  });
  it('changes T only in physical-frequency labels for a fixed discrete model', () => {
    const { root } = open(); reveal(root); edit(field(root, 'Contour angle θ (degrees)'), '90');
    const before = result(root).querySelector('[aria-label="Mapped loop cursor"]')!.textContent;
    edit(field(root, 'Sample period T (s)'), '.2'); reveal(root); edit(field(root, 'Contour angle θ (degrees)'), '90');
    expect(result(root).querySelector('[aria-label="Mapped loop cursor"]')!.textContent).toBe(before);
    expect(result(root).querySelector('[aria-label="Unwrapped physical angular frequency"]')!.textContent).toBe('7.853982');
  });
  it('labels a clipped critical view without changing the model or counts', () => {
    const { root } = open(); reveal(root);
    const before = result(root).querySelector('[aria-label="Guarded numerical winding and predicted outside count"]')!.textContent;
    edit(field(root, 'Mapped view'), 'critical', true);
    expect(result(root).querySelector('[aria-label="Guarded numerical winding and predicted outside count"]')!.textContent).toBe(before);
    expect(result(root).textContent).toContain('sampled image points lie outside this clipped critical view');
  });
  it('rejects lexical ambiguity and singular direct feedback without stale results', () => {
    const { root } = open(); reveal(root); edit(root.querySelector('textarea')!, 'z2\\frac12'); reveal(root);
    expect(result(root).children).toHaveLength(0); expect(root.querySelector('.dn-feedback')!.textContent).toContain('mixed number');
    edit(root.querySelector('textarea')!, '-z'); reveal(root); expect(root.querySelector('.dn-feedback')!.textContent).toContain('direct feedback loop is singular');
  });
  it.each(['1e-999', '-1e-999', '', '11'])('rejects invalid native gain %s', raw => {
    const { root } = open(); reveal(root); edit(field(root, 'Loop gain K (dimensionless)'), raw); reveal(root);
    expect(result(root).children).toHaveLength(0); expect(root.querySelector('.dn-feedback')!.textContent).toMatch(/nonzero but too small|finite number|between/);
  });
  it('preserves genuine native zero and normal exponent syntax', () => {
    const { root } = open(); preset(root, '9'); edit(field(root, 'Loop gain K (dimensionless)'), '0e-999'); reveal(root);
    expect(result(root).textContent).toContain('Unstable retained closed loop');
    preset(root, '0'); edit(field(root, 'Loop gain K (dimensionless)'), '1e-2'); reveal(root);
    expect(result(root).querySelector('[aria-label="Full retained closed-loop polynomial"]')!.textContent).toContain('159');
  });
  it('aborts old result listeners and starts baseline again on restore/reopen', () => {
    const v = open(); preset(v.root, '2'); reveal(v.root); const oldCursor = field<HTMLInputElement>(v.root, 'Contour angle θ (degrees)');
    Array.from(v.root.querySelectorAll('button')).find(b => b.textContent === 'Restore baseline')!.click();
    expect(result(v.root).children).toHaveLength(0); edit(oldCursor, '90'); expect(result(v.root).children).toHaveLength(0);
    v.controller.abort(); v.cleanup(); const fresh = open(); reveal(fresh.root);
    expect(result(fresh.root).textContent).toContain('Strictly stable retained closed loop'); expect(fresh.root.querySelectorAll('textarea')).toHaveLength(2);
  });
});
