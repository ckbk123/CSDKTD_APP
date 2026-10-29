import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EquationInputOptions } from '../../shared/equations/input';
// Flow/lifecycle tests only; browser QA separately checks the real MathLive editor.
vi.mock('../../shared/equations/input', () => ({
  createEquationDisplay: (latex: string, label: string) => { const element = document.createElement('div'); element.textContent = latex; element.setAttribute('aria-label', label); return element; },
  createEquationInput: (options: EquationInputOptions) => {
    const element = document.createElement('div'), input = document.createElement('textarea'); input.setAttribute('aria-label', options.label); input.value = options.value; element.append(input);
    const getValue = () => ({ latex: input.value, empty: !input.value.trim(), hasPlaceholders: input.value.includes('placeholder'), syntaxIssues: [] });
    input.addEventListener('input', () => options.onChange?.(getValue()), { signal: options.signal }); options.signal.addEventListener('abort', () => element.remove(), { once: true });
    return { element, getValue, setValue: (value: string) => { input.value = value; }, focus: () => input.focus(), destroy: () => element.remove() };
  },
}));
import { mount } from './workspace';
const update = (element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement, value: string, event = 'input') => { element.value = value; element.dispatchEvent(new Event(event, { bubbles: true })); };
const labeled = <T extends HTMLElement>(container: HTMLElement, label: string): T => {
  const element = container.querySelector<T>(`[aria-label="${label}"]`); if (!element) throw new Error(`Missing ${label}`); return element;
};
const button = (container: HTMLElement, text: string): HTMLButtonElement => [...container.querySelectorAll('button')].find(b => b.textContent === text)!;
async function open() {
  const container = document.createElement('div'); container.dataset.module = 'CP04'; document.body.append(container); const controller = new AbortController(), cleanup = mount({ container, signal: controller.signal });
  await vi.waitFor(() => expect(container.querySelector('textarea')).not.toBeNull());
  return { container, controller, cleanup, reveal: () => button(container, 'Reveal checked construction').click() };
}
afterEach(() => document.body.replaceChildren());
describe('CP04 construction and lifecycle', () => {
  it('does not rewrite native underflow to zero during a unit change and recovers with valid exponent input', async () => {
    const { container, controller, reveal } = await open(); reveal();
    const cursor = labeled<HTMLInputElement>(container, 'Cursor frequency [rad/s]'); update(cursor, '1e-999');
    update(labeled(container, 'Frequency unit'), 'Hz', 'change');
    expect(cursor.value).toBe('1e-999'); expect(labeled<HTMLSelectElement>(container, 'Frequency unit').value).toBe('rad/s');
    expect(container.querySelector('.bode-verdict')).toBeNull(); expect(container.textContent).toContain('nonzero but too small to represent');
    update(cursor, '1e-2'); update(labeled(container, 'Frequency unit'), 'Hz', 'change');
    expect(labeled<HTMLInputElement>(container, 'Cursor frequency [Hz]').valueAsNumber).toBeCloseTo(.01/(2*Math.PI),14);
    reveal(); expect(container.querySelector('.bode-verdict')).not.toBeNull(); controller.abort();
  });
  it('shows one slope event for scaled coincident factors and accepts a short visual delay', async () => {
    const { container, controller, reveal } = await open();
    update(labeled(container, 'Factor 1 coefficient a₀'), '.1'); update(labeled(container, 'Factor 1 coefficient a₁'), '.3'); update(labeled(container, 'Factor 2 coefficient a₀'), '1'); update(labeled(container, 'Factor 2 coefficient a₁'), '3');
    update(labeled(container, 'Pure delay τ [s]'), '.0000001'); reveal();
    const slopeTable = [...container.querySelectorAll('table')].find(t => t.textContent?.includes('Total slope [dB/dec]'))!;
    expect([...slopeTable.tBodies[0].rows].map(row => row.cells[1].textContent)).toEqual(['0', '-40']); expect(slopeTable.textContent).not.toContain('-20'); expect(container.textContent).toContain('τ=1×10⁻⁷ s'); expect(container.querySelector('.bode-verdict')).not.toBeNull();
    update(labeled(container, 'Upper frequency [rad/s]'), '10000'); update(labeled(container, 'Cursor frequency [rad/s]'), '10000'); expect(container.textContent).toContain('-180.0535'); controller.abort();
  });
  it('draws only the student curve before reveal and diagnoses a normalization offset', async () => {
    const { container, controller, reveal } = await open(); update(labeled(container, 'Your corner for factor 2 [rad/s]'), '2');
    button(container, 'Draw my asymptote').click(); expect(container.textContent).toContain('Your predicted asymptotes'); expect(container.querySelector('.bode-verdict')).toBeNull(); expect(container.querySelectorAll('polyline')).toHaveLength(2);
    reveal(); expect(container.textContent).toContain('shifted by 6.021 dB'); expect(container.textContent).toContain('0.3162278'); expect(container.textContent).toContain('0 < ω < 1'); controller.abort();
  });
  it('preserves frequency and checked values across unit toggles and highlights a factor', async () => {
    const { container, controller, reveal } = await open(); update(labeled(container, 'Your normalization gain magnitude |Kₙ|'), '0.5'); update(labeled(container, 'Your corner for factor 2 [rad/s]'), '2'); reveal();
    expect(container.textContent).toContain('match the asymptotic construction'); update(labeled(container, 'Cursor frequency [rad/s]'), '2'); expect(container.textContent).toContain('0.1581139');
    update(labeled(container, 'Frequency unit'), 'Hz', 'change'); expect((labeled<HTMLInputElement>(container, 'Cursor frequency [Hz]')).valueAsNumber).toBeCloseTo(1 / Math.PI, 14); expect(container.textContent).toContain('0.1581139');
    update(labeled(container, 'Magnitude unit'), 'linear', 'change'); expect(container.textContent).toContain('Magnitude [output / input ratio]'); update(labeled(container, 'Contribution to highlight'), '1', 'change'); expect(container.querySelectorAll('polyline.bode-contribution-line')).toHaveLength(2); controller.abort();
  });
  it('changes the pure delay independently and rejects invalid visual data', async () => {
    const { container, controller, reveal } = await open(); update(labeled(container, 'Example'), 'delay', 'change'); reveal(); expect(container.textContent).toContain('τ=0.5 s'); expect(container.textContent).toContain('-100.2129');
    update(labeled(container, 'Raw gain K'), '', 'input'); expect(container.querySelector('.bode-verdict')).toBeNull(); reveal(); expect(container.textContent).toContain('Complete Raw gain K'); controller.abort();
  });
  it('limits factor count, destroys removed row editors and validates a changed order', async () => {
    const { container, controller, reveal } = await open(); update(labeled(container, 'Factor 1 order'), 'second', 'change'); update(labeled(container, 'Factor 1 coefficient a₁'), '3'); reveal(); expect(container.textContent).toContain('damping ratio');
    button(container, 'Remove factor 1').click(); expect(container.querySelector('textarea[aria-label="Factor 1 coefficient a₀"]')).toBeNull();
    for (let i = 0; i < 5; i++) button(container, 'Add a factor').click(); expect(button(container, 'Add a factor').disabled).toBe(true); expect(container.querySelectorAll('.bode-factor')).toHaveLength(6); controller.abort();
  });
  it('reports a cursor outside the displayed horizon and clears stale results', async () => {
    const { container, controller, reveal } = await open(); reveal(); update(labeled(container, 'Cursor frequency [rad/s]'), '1000'); expect(container.querySelector('.bode-verdict')).toBeNull(); expect(container.textContent).toContain('inside the displayed frequency range');
    update(labeled(container, 'Cursor frequency [rad/s]'), '1e-9999'); reveal(); expect(container.querySelector('.bode-verdict')).toBeNull(); expect(container.textContent).toContain('nonzero but too small to represent');
    update(labeled(container, 'Cursor frequency [rad/s]'), '0e-999'); reveal(); expect(container.textContent).toContain('Frequency must be from'); controller.abort();
  });
  it('keeps a tiny but varying linear response visible instead of flattening it by an absolute axis tolerance', async () => {
    const { container, controller, reveal } = await open(); update(labeled(container, 'Raw gain K'), '.000001');
    for (const id of [1, 2]) { update(labeled(container, `Factor ${id} coefficient a₀`), '1000000'); update(labeled(container, `Factor ${id} coefficient a₁`), '1000000'); }
    update(labeled(container, 'Your normalization gain magnitude |Kₙ|'), '1e-18'); update(labeled(container, 'Magnitude unit'), 'linear', 'change'); reveal();
    const points = container.querySelector('polyline.bode-exact-line')!.getAttribute('points')!.split(' ').map(point => Number(point.split(',')[1]));
    expect(Math.max(...points) - Math.min(...points)).toBeGreaterThan(100); expect(container.textContent).toContain('×10⁻¹⁸'); controller.abort();
  });
  it('cleans up, reopens at baseline and ignores late imports', async () => {
    const first = await open(); update(labeled(first.container, 'Example'), 'quadratic', 'change'); first.reveal(); expect(first.container.querySelectorAll('.bode-factor')).toHaveLength(1); first.controller.abort(); if (typeof first.cleanup === 'function') first.cleanup(); expect(first.container.children.length).toBe(0);
    const second = await open(); expect(second.container.querySelectorAll('.bode-factor')).toHaveLength(2); expect(labeled<HTMLTextAreaElement>(second.container, 'Pure delay τ [s]').value).toBe('0'); second.controller.abort(); if (typeof second.cleanup === 'function') second.cleanup();
    const container = document.createElement('div'), controller = new AbortController(), cleanup = mount({ container, signal: controller.signal }); controller.abort(); if (typeof cleanup === 'function') cleanup(); await Promise.resolve(); await Promise.resolve(); expect(container.children.length).toBe(0);
  });
});
