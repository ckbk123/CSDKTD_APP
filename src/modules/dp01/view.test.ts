import { afterEach, describe, expect, it, vi } from 'vitest';
// These tests exercise module behavior. The actual MathLive editor is checked
// separately in the production browser; this mock supplies only its public API.
vi.mock('../../shared/equations/input', () => ({
  createEquationDisplay: (latex: string, label: string) => {
    const e = document.createElement('div'); e.textContent = latex; e.setAttribute('aria-label', label); return e;
  },
  createEquationInput: (options: { label: string; value: string; signal: AbortSignal; onChange: () => void }) => {
    const element = document.createElement('div'), field = document.createElement('input');
    field.value = options.value; field.setAttribute('aria-label', options.label); element.append(field);
    field.addEventListener('input', options.onChange, { signal: options.signal });
    return { element, getValue: () => ({ latex: field.value, empty: !field.value, hasPlaceholders: false, syntaxIssues: [] }),
      setValue: (value: string) => { field.value = value; }, destroy: () => element.remove() };
  },
}));
import { mount } from './view';

let dispose: (() => void) | undefined;
let controller: AbortController;
function open(): HTMLElement {
  const container = document.createElement('div'); container.dataset.module = 'DP01'; document.body.append(container);
  controller = new AbortController(); const cleanup = mount({ container, signal: controller.signal });
  dispose = typeof cleanup === 'function' ? cleanup : undefined; return container;
}
afterEach(() => { controller?.abort(); dispose?.(); document.body.replaceChildren(); });
function click(root: HTMLElement, label: string): void {
  const button = [...root.querySelectorAll('button')].find(b => b.textContent === label);
  expect(button).toBeDefined(); button!.click();
}
function control(root: HTMLElement, label: string): HTMLInputElement | HTMLSelectElement {
  const wrap = [...root.querySelectorAll('label')].find(l => l.firstChild?.textContent === label);
  return wrap!.querySelector('input,select')!;
}
function change(c: HTMLInputElement | HTMLSelectElement, value: string): void {
  c.value = value; c.dispatchEvent(new Event(c.tagName === 'SELECT' && c.parentElement?.textContent?.startsWith('Initial') ? 'change' : 'input'));
}
describe('DP01 student flow with an equation API stub', () => {
  it('reveals the independently known first step samples and clears stale results', () => {
    const root = open(); click(root, 'Reveal computed sequence');
    const values = [...root.querySelectorAll('tbody tr')].slice(0, 4).map(r => r.lastElementChild!.textContent);
    expect(values).toEqual(['0', '0.2', '0.36', '0.488']);
    change(control(root, 'Amplitude A (ramp: units/s)'), '2');
    expect(root.textContent).toContain('Inputs changed.');
    click(root, 'Reveal computed sequence');
    expect(root.querySelector('tbody tr:nth-child(2) td:last-child')!.textContent).toBe('0.4');
  });
  it('shows alternating history mode, conjugates and repeated boundary growth', () => {
    const root = open(); click(root, 'Mode −0.8'); click(root, 'Reveal computed sequence');
    expect(root.querySelector('tbody tr:nth-child(2) td:last-child')!.textContent).toBe('-0.8');
    expect(root.textContent).toContain('alternates sign');
    click(root, 'Conjugate pair'); click(root, 'Reveal computed sequence');
    expect(root.querySelector('tbody tr:nth-child(3) td:last-child')!.textContent).toBe('-0.64');
    click(root, 'Repeated pole +1'); click(root, 'Reveal computed sequence');
    expect(root.querySelector('tbody tr:nth-child(4) td:last-child')!.textContent).toBe('5');
    expect(root.textContent).toContain('Strict decay is not certified');
  });
  it('reports malformed equations and invalid horizons without stale visible output', () => {
    const root = open(); const field = root.querySelector<HTMLInputElement>('[aria-label="Experiment transfer function"]')!;
    change(field, 'z^2/(z+1)'); click(root, 'Reveal computed sequence');
    expect(root.textContent).toContain('future input'); expect(root.querySelector('table')).toBeNull();
    click(root, 'Baseline step'); change(control(root, 'Number of samples'), '201'); click(root, 'Reveal computed sequence');
    expect(root.textContent).toContain('4 to 200 samples');
  });
  it('accepts custom history, rejects invalid sample inspection and compares modes', () => {
    const root = open(); change(control(root, 'Initial output history'), 'custom');
    change(control(root, 'y[−1]'), '2'); click(root, 'Reveal computed sequence');
    expect(root.querySelector('tbody tr td:last-child')!.textContent).toBe('1.6');
    change(control(root, 'Inspect sample k'), '999'); expect(root.textContent).toContain('Choose a sample index');
    change(control(root, 'Comparison radius r'), '2'); click(root, 'Compare modes'); expect(root.textContent).toContain('Use radius 0–1.5');
  });
  it('reopen starts at the baseline and cleanup removes all owned content', () => {
    const first = open(); click(first, 'Mode −0.8'); controller.abort(); dispose?.();
    expect(first.childElementCount).toBe(0);
    const second = open(); click(second, 'Reveal computed sequence');
    expect(control(second, 'Initial output history').value).toBe('zero');
    expect(second.querySelector('tbody tr:nth-child(2) td:last-child')!.textContent).toBe('0.2');
  });
});
