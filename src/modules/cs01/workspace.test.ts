import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EquationInputOptions } from '../../shared/equations/input';

// Lifecycle and exercise-flow tests only. Real MathLive editing/fonts are checked in Chromium.
vi.mock('../../shared/equations/input', () => ({
  createEquationDisplay: (latex: string, label: string) => {
    const element = document.createElement('div'); element.textContent = latex; element.setAttribute('aria-label', label); return element;
  },
  createEquationInput: (options: EquationInputOptions) => {
    const element = document.createElement('div'), input = document.createElement('textarea');
    input.setAttribute('aria-label', options.label); input.value = options.value; element.append(input);
    const getValue = () => ({ latex: input.value, empty: !input.value.trim(), hasPlaceholders: input.value.includes('placeholder'), syntaxIssues: [] });
    input.addEventListener('input', () => options.onChange?.(getValue()), { signal: options.signal });
    options.signal.addEventListener('abort', () => element.remove(), { once: true });
    return { element, getValue, setValue: (latex: string) => { input.value = latex; }, focus: () => input.focus(), destroy: () => element.remove() };
  },
}));
import { mount } from './workspace';

const change = (element: HTMLSelectElement | HTMLInputElement | HTMLTextAreaElement, value: string, event = 'change') => {
  element.value = value; element.dispatchEvent(new Event(event, { bubbles: true }));
};
function labeled<T extends HTMLElement>(container: HTMLElement, text: string): T {
  const label = [...container.querySelectorAll('label')].find(node => node.firstElementChild?.textContent === text);
  if (!label) throw new Error(`Missing label ${text}`); return label.querySelector('input, select') as T;
}
async function open() {
  const container = document.createElement('div'); container.dataset.module = 'CS01'; document.body.append(container);
  const controller = new AbortController(); const cleanup = mount({ container, signal: controller.signal });
  await vi.waitFor(() => expect(container.querySelector('textarea')).not.toBeNull());
  const reveal = () => [...container.querySelectorAll('button')].find(button => button.textContent === 'Analyze and reveal')!.click();
  return { container, controller, cleanup, reveal };
}
afterEach(() => { document.body.replaceChildren(); });

describe('CS01 exercise and visit lifecycle', () => {
  it('requires reveal and compares independent state/BIBO predictions', async () => {
    const { container, controller, cleanup, reveal } = await open();
    expect(container.querySelector('.cs-verdict')).toBeNull();
    change(labeled(container, 'Zero-input state behavior'), 'asymptotically stable');
    change(labeled(container, 'Reduced scalar channel (zero initial state)'), 'false'); reveal();
    expect(container.textContent).toContain('State prediction: matches'); expect(container.textContent).toContain('BIBO prediction: does not match');
    expect(container.textContent).toContain('s^{2}+3s+2'); expect(container.querySelectorAll('svg')).toHaveLength(3);
    controller.abort(); if (typeof cleanup === 'function') cleanup(); expect(container.children.length).toBe(0);
  });
  it('shows hidden original modes and only the retained scalar pole', async () => {
    const { container, reveal, controller } = await open(); change(labeled(container, 'Example'), '1'); reveal();
    expect(container.textContent).toContain('some arbitrarily small initial state grows');
    expect(container.textContent).toContain('Exact channel cancellation'); expect(container.querySelectorAll('tbody tr')).toHaveLength(2);
    change(labeled(container, 'View'), 'reduced');
    expect(container.querySelectorAll('tbody tr')).toHaveLength(1); expect(container.textContent).toContain('Scalar impulse response');
    controller.abort();
  });
  it('invalidates old results and validates malformed mathematical data', async () => {
    const { container, reveal, controller } = await open(); reveal();
    const staleView = labeled<HTMLSelectElement>(container, 'View');
    const d = container.querySelector<HTMLTextAreaElement>('textarea[aria-label="D (scalar)"]')!;
    change(d, '\\frac{1}{0}', 'input'); expect(container.querySelector('.cs-verdict')).toBeNull();
    change(staleView, 'reduced'); expect(container.querySelector('.cs-verdict')).toBeNull(); reveal();
    expect(container.textContent).toContain('denominator cannot be zero');
    change(d, '', 'input'); reveal(); expect(container.textContent).toContain('Complete D'); controller.abort();
  });
  it.each([
    ['Initial x₁(0)', 'Initial x₁', '1e-999'],
    ['Initial x₂(0)', 'Initial x₂', '-1e-999'],
    ['Time horizon [s]', 'Time horizon', '1e-999'],
  ])('rejects nonzero native underflow in %s and clears stale controls/results', async (label, feedback, raw) => {
    const { container, reveal, controller, cleanup } = await open(); reveal();
    const staleView = labeled<HTMLSelectElement>(container, 'View');
    change(labeled<HTMLInputElement>(container, label), raw, 'input');
    expect(container.querySelector('.cs-verdict')).toBeNull();
    change(staleView, 'reduced'); reveal();
    expect(container.querySelector('.cs-message')!.textContent).toContain(`${feedback} is nonzero but too small to represent`);
    expect(container.querySelector('.cs-verdict')).toBeNull(); expect(container.querySelector('svg')).toBeNull();
    controller.abort(); if (typeof cleanup === 'function') cleanup();
  });
  it.each(['0', '0e-999', '-0'])('preserves intentional native zero %s in the initial state', async raw => {
    const { container, reveal, controller, cleanup } = await open();
    change(labeled<HTMLInputElement>(container, 'Initial x₁(0)'), raw, 'input');
    change(labeled<HTMLInputElement>(container, 'Initial x₂(0)'), raw, 'input'); reveal();
    expect(container.querySelector('.cs-verdict')).not.toBeNull();
    expect(container.textContent).toContain('At t=6 s: x₁=0, x₂=0, y=0.');
    expect(labeled<HTMLInputElement>(container, 'Initial x₁(0)').value).toBe(raw);
    controller.abort(); if (typeof cleanup === 'function') cleanup();
  });
  it('retains representable native exponents and computes the independently known −2 eigenmode', async () => {
    const { container, reveal, controller, cleanup } = await open();
    change(labeled<HTMLInputElement>(container, 'Initial x₁(0)'), '1e-2', 'input');
    change(labeled<HTMLInputElement>(container, 'Initial x₂(0)'), '-2e-2', 'input');
    change(labeled<HTMLInputElement>(container, 'Time horizon [s]'), '1e-1', 'input'); reveal();
    // [0.01, -0.02] is an eigenvector of the baseline A for λ=-2.
    // At t=.1: x₁=.01 exp(-.2), x₂=-.02 exp(-.2), and y=x₁.
    expect(container.querySelector('.cs-verdict')).not.toBeNull();
    expect(container.textContent).toContain('At t=0.1 s: x₁=0.00818731, x₂=-0.0163746, y=0.00818731.');
    controller.abort(); if (typeof cleanup === 'function') cleanup();
  });
  it.each([
    ['Initial x₁(0)', '1.01e2', 'Initial x₁: enter a finite number from -100 to 100.'],
    ['Initial x₂(0)', '-1.01e2', 'Initial x₂: enter a finite number from -100 to 100.'],
    ['Time horizon [s]', '1e-2', 'Time horizon: enter a finite number from 0.05 to 30.'],
    ['Time horizon [s]', '3.1e1', 'Time horizon: enter a finite number from 0.05 to 30.'],
  ])('retains local bounds for %s=%s', async (label, raw, feedback) => {
    const { container, reveal, controller, cleanup } = await open();
    change(labeled<HTMLInputElement>(container, label), raw, 'input'); reveal();
    expect(container.querySelector('.cs-message')!.textContent).toBe(feedback);
    expect(container.querySelector('.cs-verdict')).toBeNull();
    controller.abort(); if (typeof cleanup === 'function') cleanup();
  });
  it('keeps classification when a plotting horizon exceeds resource limits', async () => {
    const { container, reveal, controller } = await open();
    const a = container.querySelector<HTMLTextAreaElement>('textarea[aria-label="A (2 × 2)"]')!;
    change(a, '\\begin{bmatrix}100&0\\\\0&1\\end{bmatrix}', 'input'); reveal();
    expect(container.textContent).toContain('Internal asymptotic stability'); expect(container.textContent).toContain('Shorten the horizon'); controller.abort();
  });
  it('returns to the baseline after cleanup/reopen and ignores aborted late imports', async () => {
    const first = await open(); change(labeled(first.container, 'Example'), '4'); first.reveal();
    expect(first.container.textContent).toContain('Jordan chain'); first.controller.abort(); if (typeof first.cleanup === 'function') first.cleanup();
    const next = await open(); expect(labeled<HTMLSelectElement>(next.container, 'Example').value).toBe('0'); next.reveal();
    expect(next.container.textContent).toContain('every zero-input state decays'); next.controller.abort(); if (typeof next.cleanup === 'function') next.cleanup();
    const container = document.createElement('div'), controller = new AbortController();
    const cleanup = mount({ container, signal: controller.signal }); controller.abort(); if (typeof cleanup === 'function') cleanup();
    await Promise.resolve(); await Promise.resolve(); expect(container.children.length).toBe(0);
  });
});
