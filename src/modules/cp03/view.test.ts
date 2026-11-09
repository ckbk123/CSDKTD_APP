import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EquationDraft, EquationInputOptions } from '../../shared/equations/input';

// Test exercise state/validation without treating this as real MathLive evidence.
vi.mock('../../shared/equations/input', () => ({
  createEquationDisplay: (latex: string, label: string) => {
    const e = document.createElement('div'); e.setAttribute('role', 'math'); e.setAttribute('aria-label', label); e.textContent = latex; return e;
  },
  createEquationInput: (options: EquationInputOptions) => {
    const element = document.createElement('div'), field = document.createElement('textarea');
    field.value = options.value; field.setAttribute('aria-label', options.label); element.append(field);
    const getValue = (): EquationDraft => ({ latex: field.value, empty: !field.value, hasPlaceholders: false, syntaxIssues: [] });
    field.addEventListener('input', () => options.onChange?.(getValue()), { signal: options.signal });
    return { element, getValue, setValue: (value: string) => { field.value = value; }, focus: () => field.focus(), destroy: () => element.remove() };
  },
}));
import { mount } from './view';

const cleanup: (() => void)[] = [];
afterEach(() => { cleanup.splice(0).forEach(fn => fn()); vi.useRealTimers(); });
function open() {
  const container = document.createElement('section'); container.dataset.module = 'CP03'; document.body.append(container);
  const controller = new AbortController(), dispose = mount({ container, signal: controller.signal });
  cleanup.push(() => { controller.abort(); if (typeof dispose === 'function') dispose(); container.remove(); });
  const mode = container.querySelector<HTMLSelectElement>('[aria-label="Learning mode"]')!; mode.value = 'practice'; mode.dispatchEvent(new Event('change'));
  const panel = container.querySelector<HTMLElement>('[data-cp03-panel="practice"]')!;
  const button = (text: string) => [...panel.querySelectorAll('button')].find(b => b.textContent === text)!;
  const field = (text: string) => [...panel.querySelectorAll('label')].find(l => l.textContent?.includes(text))!.querySelector('input')!;
  const change = (input: HTMLInputElement | HTMLTextAreaElement, value: string) => { input.value = value; input.dispatchEvent(new Event('input', { bubbles: true })); };
  const apply = () => panel.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  return { container: panel, controller, button, field, change, apply };
}

describe('CP03 exercise flow and ownership', () => {
  it('keeps the checked answer hidden until markers can be placed, then compares them', () => {
    const v = open();
    expect(v.container.textContent).toContain('Stable steady-state experiment');
    expect(v.container.querySelector('.cp03-checked')?.textContent).toBe('');
    v.change(v.field('Output peak'), String(v.field('Input peak').valueAsNumber + Math.atan(3)));
    v.change(v.field('Output amplitude marker'), String(1 / Math.sqrt(10)));
    v.button('Reveal calculation and linked plots').click();
    expect(v.container.textContent).toContain('-71.565');
    expect(v.container.querySelectorAll('figure')).toHaveLength(4);
    expect(v.container.querySelector('.cp03-grade')?.textContent).toContain('gain 0, phase 0°');
  });
  it('invalidates stale results immediately, computes changed data and explains an improper plant', () => {
    const v = open(); v.button('Reveal calculation and linked plots').click();
    v.change(v.field('Frequency ω'), '2');
    expect(v.container.querySelector('figure')).toBeNull();
    v.apply(); v.button('Reveal calculation and linked plots').click();
    expect(v.container.textContent).toContain('-108.43');
    const plant = v.container.querySelector('textarea')!;
    v.change(plant, 's^2/(s+1)'); v.apply();
    expect(v.container.textContent).toContain('improper plant');
    expect(v.container.querySelector('figure')).toBeNull();
  });
  it('rejects visual e/E algebra while computing the equivalent textbook power', () => {
    const v = open(), plant = v.container.querySelector('textarea')!;
    v.change(plant, '1e-2/(s+1)'); v.apply(); expect(v.container.textContent).toContain('e/E notation is algebra');
    expect(v.container.querySelector('figure')).toBeNull();
    v.change(plant, '10^{-2}/(s+1)'); v.apply(); v.button('Reveal calculation and linked plots').click();
    expect(v.container.textContent).toContain('0.0070711');
    v.change(v.field('Frequency ω'), '1e-2'); v.apply();
    expect(v.field('Frequency ω').valueAsNumber).toBe(0.01);
    expect(v.container.querySelector('figure')).not.toBeNull();
  });
  it('requires an explicit operation for mixed numbers and recovers with the displayed sum', () => {
    const v = open(), plant = v.container.querySelector('textarea')!;
    v.change(plant, String.raw`2\frac12/(s+1)`); v.apply();
    expect(v.container.textContent).toContain('Mixed-number adjacency is unsupported'); expect(v.container.querySelector('figure')).toBeNull();
    v.change(plant, String.raw`2+\frac12`); v.apply(); v.button('Reveal calculation and linked plots').click();
    expect(v.container.querySelector('[aria-label="Calculated gain and output amplitude"]')?.textContent).toContain('2.5');
  });
  it('preserves hidden-brace display meaning and rejects wrapped mixed-number bypasses', () => {
    const v = open(), plant = v.container.querySelector('textarea')!;
    v.change(plant, '1{+2}'); v.apply(); v.button('Reveal calculation and linked plots').click();
    expect(v.container.querySelector('[aria-label="Normalized plant and input, rounded coefficients"]')?.textContent).toContain('3');
    v.change(plant, String.raw`2{\frac12}`); v.apply();
    expect(v.container.textContent).toContain('Mixed-number adjacency is unsupported'); expect(v.container.querySelector('figure')).toBeNull();
    v.change(plant, '(-2)^2'); v.apply(); v.button('Reveal calculation and linked plots').click();
    expect(v.container.querySelector('[aria-label="Calculated gain and output amplitude"]')?.textContent).toContain('4');
  });
  it('distinguishes unsettled actual data and unstable analytic evaluation', () => {
    const v = open();
    v.button('Slow transient').click(); expect(v.container.textContent).toContain('Not settled');
    v.button('Unstable model').click(); expect(v.container.textContent).toContain('Unstable model: analytic frequency evaluation only');
    const toggle = v.container.querySelector('input[type="checkbox"]')!;
    toggle.dispatchEvent(new Event('change'));
    expect(v.container.textContent).toContain('need not approach it');
  });
  it('rejects empty numeric values and clears owned content on abort; reopening is fresh', () => {
    const v = open(); v.change(v.field('Input amplitude A'), ''); v.apply();
    expect(v.container.textContent).toContain('Enter input amplitude');
    v.controller.abort(); expect(v.container.childElementCount).toBe(0);
    const next = open(); expect(next.field('Input amplitude A').value).toBe('1');
    expect(next.container.querySelector('.cp03-checked')?.textContent).toBe('');
    v.button('Course baseline')?.click(); expect(next.field('Input amplitude A').value).toBe('1');
  });
  it('rejects nonzero HTML numbers rounded to zero while retaining exact numeric zero', () => {
    const v = open(); v.change(v.field('Window start'), '1e-999'); v.apply();
    expect(v.container.textContent).toContain('nonzero but too small to represent');
    expect(v.container.querySelector('figure')).toBeNull();
    v.change(v.field('Window start'), '0'); v.apply();
    v.change(v.field('Output amplitude marker'), '1e-999');
    expect(v.container.querySelector('.cp03-marker-error')?.textContent).toContain('nonzero but too small');
    expect(v.container.querySelector('figure')).not.toBeNull();
    v.change(v.field('Output amplitude marker'), '0e-999');
    expect(v.container.querySelector('figure')).not.toBeNull();
    expect(v.container.querySelector('.cp03-marker-error')?.textContent).toBe('');
  });
  it('updates all three linked frequency plots without hiding a revealed comparison', () => {
    vi.useFakeTimers();
    const v = open(); v.button('Reveal calculation and linked plots').click();
    const cursor = v.container.querySelector('input[type="range"]') as HTMLInputElement;
    v.change(cursor, '1');
    vi.advanceTimersByTime(40);
    expect(v.field('Frequency ω').value).toBe('10');
    expect(v.container.querySelectorAll('figure')).toHaveLength(4);
    expect(v.container.querySelector('.cp03-frequency-plots')?.textContent).toContain('cursor ω=10 rad/s');
  });
  it('keeps analytic frequency results available when an unstable time trace is too large', () => {
    const v = open(); v.change(v.container.querySelector('textarea')!, '1/(s-2)'); v.apply();
    expect(v.container.textContent).toContain('Unstable model: analytic frequency evaluation only');
    expect((v.container.querySelector('input[type="checkbox"]') as HTMLInputElement).disabled).toBe(true);
    expect(v.container.textContent).toContain('exceeds the numeric reliability bound');
    v.button('Reveal calculation and linked plots').click();
    expect(v.container.querySelectorAll('figure')).toHaveLength(4);
  });
  it('reports an unresolved fast transient rather than presenting an aliased trace', () => {
    const v = open(); v.change(v.container.querySelector('textarea')!, 's^2/(s^2+0.01s+100)');
    v.change(v.field('Frequency ω'), '0.01'); v.change(v.field('Window start'), '0'); v.apply();
    expect(v.container.textContent).toContain('cannot resolve the transient');
    expect((v.container.querySelector('input[type="checkbox"]') as HTMLInputElement).disabled).toBe(true);
    v.button('Reveal calculation and linked plots').click(); expect(v.container.querySelectorAll('figure')).toHaveLength(4);
  });
  it('draws separate Bode and Nyquist curve segments on each side of an off-grid imaginary pole', () => {
    const v = open(); v.change(v.container.querySelector('textarea')!, '1/(s^2+2)'); v.apply();
    v.button('Reveal calculation and linked plots').click();
    for (const figure of v.container.querySelectorAll('.cp03-frequency-plots figure')) expect(figure.querySelectorAll('polyline')).toHaveLength(2);
  });
  it('does not join phase through an off-grid notch while Nyquist can pass continuously through zero', () => {
    const v = open(); v.change(v.container.querySelector('textarea')!, '(s^2+2)/(s^2+2s+3)'); v.apply();
    v.button('Reveal calculation and linked plots').click();
    const plots = v.container.querySelectorAll('.cp03-frequency-plots figure');
    expect(plots[0].querySelectorAll('polyline')).toHaveLength(2);
    expect(plots[1].querySelectorAll('polyline')).toHaveLength(2);
    expect(plots[2].querySelectorAll('polyline')).toHaveLength(1);
  });
});
