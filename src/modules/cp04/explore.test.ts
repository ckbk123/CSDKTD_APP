import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EquationInputOptions } from '../../shared/equations/input';
vi.mock('../../shared/equations/input', () => ({
  createEquationDisplay: (value: string, label: string) => { const node = document.createElement('div'); node.textContent = value; node.setAttribute('aria-label', label); return node; },
  createEquationInput: (options: EquationInputOptions) => {
    const element = document.createElement('div'), input = document.createElement('textarea'); input.value = options.value; input.setAttribute('aria-label', options.label); element.append(input);
    const getValue = () => ({ latex: input.value, empty: !input.value.trim(), hasPlaceholders: false, syntaxIssues: [] });
    input.addEventListener('input', () => options.onChange?.(getValue()), { signal: options.signal });
    return { element, getValue, setValue: (v: string) => { input.value = v; }, focus: () => input.focus(), destroy: () => element.remove() };
  },
}));
import { mountView } from './view';
const field = <T extends HTMLElement = HTMLInputElement>(root: HTMLElement, label: string) => root.querySelector<T>(`[aria-label="${label}"]`)!;
const update = (root: HTMLElement, label: string, value: string, event = 'input') => { const input = field<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(root, label); input.value = value; input.dispatchEvent(new Event(event, { bubbles: true })); return input; };
const click = (root: HTMLElement, label: string) => [...root.querySelectorAll('button')].find(b => b.textContent === label)!.click();
function open() { const root = document.createElement('div'); root.dataset.module = 'CP04'; document.body.append(root); const controller = new AbortController(); const cleanup = mountView({ container: root, signal: controller.signal }); return { root, controller, cleanup }; }
function pointer(node: EventTarget, type: string, x = 350, id = 7) { const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, button: 0 }); Object.defineProperty(event, 'pointerId', { value: id }); node.dispatchEvent(event); return event; }
function points(root: HTMLElement, index = 0) { return root.querySelectorAll('polyline.bode-exact-line')[index]?.getAttribute('points'); }
afterEach(() => { vi.useRealTimers(); document.body.replaceChildren(); });

describe('CP04 visual-first linked exploration (DOM, not browser evidence)', () => {
  it('opens computed baseline without a submit and keeps each numeric/range name independent', () => {
    const { root, controller } = open(); expect(root.querySelectorAll('polyline.bode-exact-line')).toHaveLength(2); expect(root.textContent).toContain('|G|=0.3162278, -10 dB, -71.56505°');
    expect(root.querySelector('.bode-live-plots')!.compareDocumentPosition(field(root, 'Actual corner [rad/s]')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(field(root, 'Actual corner [rad/s]').parentElement!.querySelectorAll('input')).toHaveLength(1); expect(field(root, 'Move selected corner (log scale)').parentElement!.querySelectorAll('input')).toHaveLength(1); controller.abort();
  });
  it('moves actual corner 2→3 with visible 2/3 and retained Kn=.5, then undoes', () => {
    const { root, controller } = open(); update(root, 'Selected factor', '1', 'change');
    const original = points(root); update(root, 'Actual corner [rad/s]', '3'); update(root, 'Actual corner [rad/s]', '3', 'change');
    expect(field<HTMLTextAreaElement>(root, 'Selected factor coefficient a₀').value).toBe('2'); expect(field<HTMLTextAreaElement>(root, 'Selected factor coefficient a₁').value).toBe('2/3');
    expect(root.textContent).toContain('normalization gain Kₙ=0.5'); expect(root.textContent).toContain('|G|=0.3354102'); expect(points(root)).not.toBe(original);
    click(root, 'Undo model edit'); expect(field<HTMLTextAreaElement>(root, 'Selected factor coefficient a₁').value).toBe('1'); expect(points(root)).toBe(original); controller.abort();
  });
  it('uses fixed axes for gain translation, delay changes phase only, and Fit clears clipping', () => {
    const { root, controller } = open(); const magnitude = points(root), phase = points(root, 1);
    update(root, 'Delay τ [s]', '.5'); update(root, 'Delay τ [s]', '.5', 'change'); expect(points(root)).toBe(magnitude); expect(points(root, 1)).not.toBe(phase); expect(root.textContent).toContain('-100.2129°');
    update(root, 'Raw gain K (signed)', '1000'); update(root, 'Raw gain K (signed)', '1000', 'change'); expect(points(root)).not.toBe(magnitude); expect(root.querySelector('.bode-warning')!.textContent).toContain('fixed axes');
    click(root, 'Fit axes'); expect(root.querySelector('.bode-warning')!.textContent).not.toContain('fixed axes');
    update(root, 'Raw gain K (signed)', '-1000'); update(root, 'Raw gain K (signed)', '-1000', 'change'); expect(root.textContent).toContain('79.78706°'); controller.abort();
  });
  it('preserves physical cursor/model across units and marks invalid underflow without rewriting it', () => {
    const { root, controller } = open(); const original = points(root), raw = field<HTMLTextAreaElement>(root, 'Selected factor coefficient a₁').value;
    update(root, 'Frequency unit', 'Hz', 'change'); expect(field<HTMLInputElement>(root, 'Cursor frequency [Hz]').valueAsNumber).toBeCloseTo(1 / (2 * Math.PI), 14); expect(points(root)).toBe(original); expect(field<HTMLTextAreaElement>(root, 'Selected factor coefficient a₁').value).toBe(raw);
    update(root, 'Frequency unit', 'rad/s', 'change'); update(root, 'Cursor frequency [rad/s]', '1e-999'); update(root, 'Frequency unit', 'Hz', 'change');
    expect(field<HTMLInputElement>(root, 'Cursor frequency [rad/s]').value).toBe('1e-999'); expect(field<HTMLSelectElement>(root, 'Frequency unit').value).toBe('rad/s'); expect(root.querySelectorAll('polyline')).toHaveLength(0); expect(root.textContent).toContain('nonzero but too small to represent');
    update(root, 'Cursor frequency [rad/s]', '1'); expect(root.querySelectorAll('polyline.bode-exact-line')).toHaveLength(2); controller.abort();
  });
  it('shows raw draft failure, accepts a tiny explicit delay and preserves the full factor domain', () => {
    vi.useFakeTimers(); const { root, controller } = open();
    update(root, 'Raw gain K', ''); vi.advanceTimersByTime(50); expect(root.querySelectorAll('polyline')).toHaveLength(0); expect(root.textContent).toContain('Complete Raw gain K'); expect(root.textContent).not.toContain('normalization gain Kₙ=');
    update(root, 'Raw gain K', '-2'); update(root, 'Pure delay τ [s]', '.000000001'); vi.advanceTimersByTime(50); expect(root.querySelectorAll('polyline.bode-exact-line')).toHaveLength(2);
    update(root, 'Power of s at the origin', '3', 'change'); for (let i = 0; i < 4; i++) click(root, 'Add a factor'); expect(field<HTMLSelectElement>(root, 'Selected factor').options).toHaveLength(6); expect([...root.querySelectorAll('button')].find(b => b.textContent === 'Add a factor')!.disabled).toBe(true);
    for (let i = 0; i < 6; i++) click(root, 'Remove selected factor'); expect(field<HTMLSelectElement>(root, 'Selected factor').disabled).toBe(true); expect(root.querySelectorAll('polyline.bode-exact-line')).toHaveLength(2); controller.abort();
  });
  it('rejects an unsupported derived coefficient atomically and leaves its entered corner visible', () => {
    vi.useFakeTimers(); const { root, controller } = open(); update(root, 'Selected factor coefficient a₀', '.000001'); update(root, 'Selected factor coefficient a₁', '.000001'); vi.advanceTimersByTime(50);
    update(root, 'Actual corner [rad/s]', '2'); expect(field<HTMLInputElement>(root, 'Actual corner [rad/s]').value).toBe('2'); expect(field<HTMLTextAreaElement>(root, 'Selected factor coefficient a₁').value).toBe('.000001'); expect(root.textContent).toContain('supported coefficient bounds'); expect(root.querySelectorAll('polyline')).toHaveLength(0); controller.abort();
  });
  it('updates a continuous range before release, cancels with Escape at the stable focus and drops late work', () => {
    vi.useFakeTimers(); const { root, controller } = open(); const original = points(root);
    update(root, 'Move selected corner (log scale)', '.2'); vi.advanceTimersByTime(20); update(root, 'Move selected corner (log scale)', '.3'); vi.advanceTimersByTime(15); expect(points(root)).not.toBe(original); expect(root.textContent).toContain('Live preview');
    const plots = root.querySelector<HTMLElement>('.bode-live-plots')!; plots.focus(); const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }); document.activeElement!.dispatchEvent(event); expect(event.defaultPrevented).toBe(true); expect(points(root)).toBe(original);
    update(root, 'Move selected corner (log scale)', '.5'); controller.abort(); vi.advanceTimersByTime(100); pointer(window, 'pointerup'); expect(root.children).toHaveLength(0);
  });
  it('links marker pointer/keyboard edits and restores on pointer cancellation', () => {
    vi.useFakeTimers(); const { root, controller } = open(); const original = points(root);
    const image = root.querySelector('svg')!; vi.spyOn(image, 'getBoundingClientRect').mockReturnValue({ left: 0, width: 660 } as DOMRect);
    pointer(root.querySelector('[data-factor="1"]')!, 'pointerdown'); pointer(window, 'pointermove', 420); vi.advanceTimersByTime(40); expect(points(root)).not.toBe(original); pointer(window, 'pointercancel'); expect(points(root)).toBe(original);
    root.querySelector('[data-factor="0"]')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true })); expect(field<HTMLInputElement>(root, 'Actual corner [rad/s]').valueAsNumber).toBeCloseTo(10 ** .02, 11); expect(root.querySelectorAll('.bode-selected-marker')).toHaveLength(2); controller.abort();
  });
  it('starts Practice without Explore answers and revokes a previous matched grade on prediction edits', () => {
    const { root, controller } = open(); update(root, 'Learning mode', 'practice', 'change'); expect(root.querySelectorAll('polyline')).toHaveLength(0); expect(root.textContent).not.toContain('normalization gain Kₙ='); expect(root.querySelector('.bode-verdict')).toBeNull();
    update(root, 'Your corner for factor 2 [rad/s]', '2'); update(root, 'Your normalization gain magnitude |Kₙ|', '.5'); click(root, 'Draw my asymptote'); expect(root.querySelectorAll('polyline')).toHaveLength(2); expect(root.querySelectorAll('.bode-checked-marker')).toHaveLength(0); expect(root.textContent).not.toContain('Exact numerical');
    click(root, 'Reveal checked construction'); expect(root.textContent).toContain('match the asymptotic construction'); update(root, 'Your normalization gain magnitude |Kₙ|', '1'); expect(root.textContent).not.toContain('match the asymptotic construction'); expect(root.querySelectorAll('polyline')).toHaveLength(0); controller.abort();
  });
});
