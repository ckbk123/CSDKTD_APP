import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EquationInputOptions } from '../../shared/equations/input';
// Flow tests use a small editor double; real MathLive/drag/font QA is recorded separately.
vi.mock('../../shared/equations/input', () => ({
  createEquationDisplay: (latex: string, label: string) => { const node = document.createElement('div'); node.textContent = latex; node.setAttribute('aria-label', label); return node; },
  createEquationInput: (options: EquationInputOptions) => {
    const element = document.createElement('div'), input = document.createElement('textarea'); input.setAttribute('aria-label', options.label); input.value = options.value; element.append(input);
    const getValue = () => ({ latex: input.value, empty: !input.value.trim(), hasPlaceholders: input.value.includes('placeholder'), syntaxIssues: [] });
    input.addEventListener('input', () => options.onChange?.(getValue()), { signal: options.signal }); options.signal.addEventListener('abort', () => element.remove(), { once: true });
    return { element, getValue, setValue: (value: string) => { input.value = value; }, focus: () => input.focus(), destroy: () => element.remove() };
  },
}));
import { mount } from './workspace';
function labeled<T extends HTMLElement>(container: HTMLElement, label: string): T { const node = container.querySelector<T>(`[aria-label="${label}"]`); if (!node) throw new Error(`Missing ${label}`); return node; }
const button = (container: HTMLElement, text: string): HTMLButtonElement => [...container.querySelectorAll('button')].find(b => b.textContent === text)!;
const update = (input: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement, value: string, event = 'input') => { input.value = value; input.dispatchEvent(new Event(event, { bubbles: true })); };
const toggle = (input: HTMLInputElement, value: boolean) => { input.checked = value; input.dispatchEvent(new Event('change', { bubbles: true })); };
async function open() {
  const container = document.createElement('div'); container.dataset.module = 'CP02'; document.body.append(container); const controller = new AbortController(), cleanup = mount({ container, signal: controller.signal });
  await vi.waitFor(() => expect(container.querySelector('textarea')).not.toBeNull());
  return { container, controller, cleanup, reveal: () => button(container, 'Reveal modes and response').click() };
}
afterEach(() => document.body.replaceChildren());
describe('CP02 exercise and lifecycle', () => {
  it('checks predictions and reveals only computed baseline output', async () => {
    const { container, controller, reveal } = await open(); expect(container.querySelector('polyline')).toBeNull();
    update(labeled(container, 'Predicted original mode family'), 'conjugate', 'change'); update(labeled(container, 'Predicted initial slope'), 'zero', 'change'); update(labeled(container, 'Do the same poles force the same step response?'), 'yes', 'change'); reveal();
    expect(container.textContent).toContain('Mode prediction: correct'); expect(container.textContent).toContain('Initial-slope prediction: correct'); expect(container.textContent).toContain('Same-poles check: revise it.');
    expect(container.textContent).toContain('0.8494256'); expect(container.querySelectorAll('polyline')).toHaveLength(4); controller.abort();
  });
  it('holds a response, locks poles and moves only the zero with fixed DC gain', async () => {
    const { container, controller, reveal } = await open(); update(labeled(container, 'Example'), 'left', 'change'); reveal(); button(container, 'Hold this response for comparison').click();
    toggle(labeled(container, 'Lock denominator while moving the zero'), true); expect(button(container, 'Apply pole coordinates').disabled).toBe(true);
    update(labeled(container, 'Real zero location [s⁻¹]'), '2'); button(container, 'Apply zero location').click();
    expect(labeled<HTMLTextAreaElement>(container, 'Numerator b₁').value).toBe('-2'); expect(labeled<HTMLTextAreaElement>(container, 'Denominator a₀').value).toBe('4');
    expect(container.textContent).toContain('Starts downward'); expect(container.textContent).toContain('Denominator unchanged from held response'); expect(container.querySelector('polyline.modes-held-line')).not.toBeNull();
    update(labeled(container, 'Denominator a₀'), '5'); reveal(); expect(container.textContent).toContain('Unlock it before applying edited denominator'); expect(container.querySelector('polyline')).toBeNull(); controller.abort();
  });
  it('retains original and reduced forms with an exact hidden unstable mode', async () => {
    const { container, controller, reveal } = await open(); update(labeled(container, 'Example'), 'hidden', 'change'); reveal();
    expect(container.textContent).toContain('Original internal dynamics: unstable. Reduced scalar channel: BIBO stable.'); expect(container.textContent).toContain('Exact common factor removed');
    expect(labeled(container, 'Exactly reduced scalar channel').textContent).toContain('s+2'); expect(labeled(container, 'Declared original canonical realization').textContent).toContain('2&-1');
    update(labeled(container, 'Original free mode to overlay'), '1:ordinary', 'change'); expect(container.querySelector('polyline.modes-free-line')).not.toBeNull(); controller.abort();
  });
  it('clears stale results for unsupported math and provides reliable algebra when a trace is ill-conditioned', async () => {
    const { container, controller, reveal } = await open(); reveal(); update(labeled(container, 'Numerator b₁'), '2\\frac12'); expect(container.querySelector('polyline')).toBeNull(); reveal(); expect(container.textContent).toContain('Mixed numbers');
    update(labeled(container, 'Example'), 'hidden', 'change'); update(labeled(container, 'Numerator b₀'), '-\\frac{1000000000000000001}{1000000000000000000}'); reveal();
    expect(container.textContent).toContain('not BIBO stable'); expect(container.textContent).toContain('too close for reliable numerical modal weights'); expect(container.querySelector('polyline')).toBeNull(); controller.abort();
  });
  it('rejects nonzero native underflow and preserves actual zero and decimal exponents', async () => {
    const { container, controller, reveal } = await open(); reveal(); update(labeled(container, 'Time cursor [s]'), '1e-9999'); expect(container.textContent).toContain('nonzero but too small to represent'); expect(container.querySelector('polyline')).toBeNull();
    update(labeled(container, 'Time cursor [s]'), '0e-999'); expect(container.textContent).toContain('Time cursor: 0 s'); update(labeled(container, 'Time cursor [s]'), '1e-2'); expect(container.textContent).toContain('Time cursor: 0.01 s');
    update(labeled(container, 'Pole real part [s⁻¹]'), '1e-9999'); button(container, 'Apply pole coordinates').click(); expect(container.textContent).toContain('nonzero but too small to represent'); expect(labeled<HTMLTextAreaElement>(container, 'Denominator a₁').value).toBe('2'); controller.abort();
  });
  it('keeps the prior model on invalid moves and clears overflowing horizons', async () => {
    const { container, controller, reveal } = await open(); reveal(); update(labeled(container, 'Real zero location [s⁻¹]'), '0'); button(container, 'Apply zero location').click(); expect(container.textContent).toContain('DC preservation needs'); expect(labeled<HTMLTextAreaElement>(container, 'Numerator b₁').value).toBe('0');
    update(labeled(container, 'Pole real part [s⁻¹]'), '6'); update(labeled(container, 'Pole imaginary part [s⁻¹]'), '0'); button(container, 'Apply pole coordinates').click(); expect(container.textContent).toContain('Shorten the horizon'); expect(container.querySelector('polyline')).toBeNull();
    update(labeled(container, 'Time horizon [s]'), '2'); expect(container.querySelector('polyline')).not.toBeNull(); update(labeled(container, 'Time cursor [s]'), '3'); expect(container.textContent).toContain('inside the displayed horizon'); expect(container.querySelector('polyline')).toBeNull(); controller.abort();
  });
  it('applies a conjugate drag only on release and releases capture on abort', async () => {
    const { container, controller, reveal } = await open(); reveal(); const plane = container.querySelector<SVGSVGElement>('.modes-plane-scroll svg')!;
    let captured = false; plane.setPointerCapture = vi.fn(() => { captured = true; }); plane.hasPointerCapture = vi.fn(() => captured); plane.releasePointerCapture = vi.fn(() => { captured = false; }); plane.getBoundingClientRect = () => ({ left: 0, top: 0, width: 560, height: 380 } as DOMRect);
    const pointer = (target: Element, type: string, x = 238, y = 138) => { const event = new MouseEvent(type, { bubbles: true, button: 0, clientX: x, clientY: y }); Object.defineProperty(event, 'pointerId', { value: 1 }); target.dispatchEvent(event); };
    pointer(plane.querySelector('[data-pole="0"]')!, 'pointerdown'); pointer(plane, 'pointermove'); expect(labeled<HTMLTextAreaElement>(container, 'Denominator a₀').value).toBe('4'); expect(container.textContent).toContain('Candidate pole: -2 + 3j'); pointer(plane, 'pointerup');
    expect(labeled<HTMLTextAreaElement>(container, 'Denominator a₀').value).toBe('13'); expect(labeled<HTMLTextAreaElement>(container, 'Denominator a₁').value).toBe('4'); expect(plane.querySelectorAll('[data-pole]')).toHaveLength(2);
    pointer(plane.querySelector('[data-pole="0"]')!, 'pointerdown'); controller.abort(); expect(captured).toBe(false); expect(container.children).toHaveLength(0);
  });
  it('starts fresh on reopen and prevents late imports from touching another visit', async () => {
    const first = await open(); update(labeled(first.container, 'Example'), 'repeated', 'change'); first.reveal(); first.controller.abort(); if (typeof first.cleanup === 'function') first.cleanup(); expect(first.container.children).toHaveLength(0);
    const second = await open(); expect(labeled<HTMLTextAreaElement>(second.container, 'Denominator a₀').value).toBe('4'); expect(second.container.querySelector('polyline')).toBeNull(); second.controller.abort();
    const container = document.createElement('div'), controller = new AbortController(), cleanup = mount({ container, signal: controller.signal }); controller.abort(); if (typeof cleanup === 'function') cleanup(); await Promise.resolve(); await Promise.resolve(); expect(container.children).toHaveLength(0);
  });
});
