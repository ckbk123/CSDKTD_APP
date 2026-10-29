import { afterEach, describe, expect, it, vi } from 'vitest';
// Public equation API stub, not evidence of the real MathLive editor.
vi.mock('../../shared/equations/input', () => ({
  createEquationDisplay: (latex: string, label: string) => { const e = document.createElement('div'); e.textContent = latex; e.setAttribute('aria-label', label); return e; },
  createEquationInput: (options: { label: string; value: string; signal: AbortSignal; onChange: () => void }) => {
    const element = document.createElement('div'), input = document.createElement('input');
    input.setAttribute('aria-label', options.label); input.value = options.value; element.append(input);
    input.addEventListener('input', options.onChange, { signal: options.signal });
    return { element, getValue: () => ({ latex: input.value, empty: !input.value, syntaxIssues: [], hasPlaceholders: false }),
      setValue: (value: string) => { input.value = value; }, destroy: () => element.remove() };
  },
}));
import { mount } from './view';
let controller: AbortController, cleanup: ReturnType<typeof mount>;
const open = (): HTMLElement => {
  const root = document.createElement('div'); root.dataset.module = 'DR05'; document.body.append(root);
  controller = new AbortController(); cleanup = mount({ container: root, signal: controller.signal }); return root;
};
afterEach(() => { controller?.abort(); if (typeof cleanup === 'function') cleanup(); document.body.replaceChildren(); });
const click = (root: HTMLElement, text: string): void => {
  const button = [...root.querySelectorAll('button')].find(e => e.textContent === text); expect(button).toBeDefined(); button!.click();
};
const control = (root: HTMLElement, label: string): HTMLInputElement | HTMLSelectElement => {
  const wrap = [...root.querySelectorAll('label')].find(e => e.firstChild?.textContent === label); expect(wrap).toBeDefined(); return wrap!.querySelector('input,select')!;
};
const change = (input: HTMLInputElement | HTMLSelectElement, value: string): void => { input.value = value; input.dispatchEvent(new Event('input')); };
const outputValues = (root: HTMLElement): string[] => [...root.querySelectorAll('tbody tr')].map(row => row.children[3].textContent!);

describe('DR05 teaching flow with the equation API stub', () => {
  it('reveals independent baseline samples and changed-period results', () => {
    const root = open(); click(root, 'Reveal sampled model');
    expect(outputValues(root).slice(0, 4)).toEqual(['0', '0.09516258', '0.1812692', '0.2591818']);
    change(control(root, 'Sample period T (s)'), '0.2'); expect(root.textContent).toContain('Inputs changed');
    click(root, 'Reveal sampled model'); expect(outputValues(root)[1]).toBe('0.1812692');
  });
  it('keeps samples unchanged when only drawing density changes', () => {
    const root = open(); click(root, 'Reveal sampled model'); const samples = outputValues(root);
    change(control(root, 'Drawing subdivisions per interval'), '16'); click(root, 'Reveal sampled model');
    expect(outputValues(root)).toEqual(samples);
  });
  it('runs singular-A integrators and the separately declared delayed source path', () => {
    const root = open(); click(root, 'Integrator'); click(root, 'Reveal sampled model'); expect(outputValues(root)[3]).toBe('0.3');
    click(root, 'Double integrator'); click(root, 'Reveal sampled model'); expect(outputValues(root)[3]).toBe('0.045');
    click(root, 'Delayed 5/s²'); click(root, 'Reveal sampled model'); expect(outputValues(root).slice(0, 4)).toEqual(['0', '0', '0.1', '0.4']);
  });
  it('reports fractional delay, improper plant and underflow input errors', () => {
    const root = open(); change(control(root, 'Input delay m (whole samples)'), '0.5'); click(root, 'Reveal sampled model'); expect(root.textContent).toContain('Fractional delays');
    change(control(root, 'Input delay m (whole samples)'), '0');
    const field = root.querySelector<HTMLInputElement>('[aria-label="Continuous rational plant"]')!;
    change(field, 's^2/(s+1)'); click(root, 'Reveal sampled model'); expect(root.textContent).toContain('input derivatives');
    click(root, 'Baseline T = 0.1 s'); change(control(root, 'Amplitude A (ramp: units/s)'), '1e-400'); click(root, 'Reveal sampled model'); expect(root.textContent).toContain('too small to represent');
  });
  it('retains exact results when the selected implicit method is singular', () => {
    const root = open(), field = root.querySelector<HTMLInputElement>('[aria-label="Continuous rational plant"]')!;
    change(field, '1/(s-1)'); change(control(root, 'Sample period T (s)'), '1'); change(control(root, 'Number of sample instants'), '4');
    change(control(root, 'Compare interval approximation'), 'backward'); click(root, 'Reveal sampled model');
    expect(root.textContent).toContain('Approximation unavailable'); expect(outputValues(root)[3]).toBe('19.08554');
  });
  it('uses initial state in state/output arithmetic and rejects out-of-range inspection', () => {
    const root = open(); change(control(root, 'Initial state x₁(0)'), '2'); click(root, 'Reveal sampled model');
    expect(outputValues(root)[0]).toBe('2'); expect(outputValues(root)[1]).toBe('1.904837');
    change(control(root, 'Inspect sample k'), '999'); expect(root.textContent).toContain('Choose k from 0');
  });
  it('reopen restores the baseline and cleanup removes owned controls', () => {
    const root = open(); click(root, 'Delayed 5/s²'); controller.abort(); if (typeof cleanup === 'function') cleanup(); expect(root.children.length).toBe(0);
    const next = open(); click(next, 'Reveal sampled model'); expect(control(next, 'Input delay m (whole samples)').value).toBe('0'); expect(outputValues(next)[1]).toBe('0.09516258');
  });
});
