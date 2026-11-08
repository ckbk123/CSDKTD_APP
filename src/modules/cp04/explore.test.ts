import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EquationInputOptions } from '../../shared/equations/input';
import { readFileSync } from 'node:fs';
const partial = vi.hoisted(() => ({ count: 0, failAt: 0, abort: undefined as undefined | (() => void), listener: vi.fn() }));
vi.mock('../../shared/equations/input', () => ({
  createEquationDisplay: (value: string, label: string) => { const node = document.createElement('div'); node.textContent = value; node.setAttribute('aria-label', label); return node; },
  createEquationInput: (options: EquationInputOptions) => {
    partial.count++;
    const abort = partial.abort; partial.abort = undefined; abort?.();
    if (partial.count === partial.failAt) { window.addEventListener('cp04-partial', partial.listener, { signal: options.signal }); throw new Error('partial editor failure'); }
    const element = document.createElement('div'), input = document.createElement('textarea'); input.value = options.value; input.setAttribute('aria-label', options.label); element.append(input);
    const getValue = () => ({ latex: input.value, empty: !input.value.trim(), hasPlaceholders: false, syntaxIssues: [] });
    input.addEventListener('input', () => options.onChange?.(getValue()), { signal: options.signal });
    return { element, getValue, setValue: (v: string) => { input.value = v; }, focus: () => input.focus(), destroy: () => element.remove() };
  },
}));
import { mountView } from './view';
const active = (root: HTMLElement): HTMLElement => root.querySelector<HTMLElement>('[data-cp04-panel]:not([hidden])') ?? root;
const field = <T extends HTMLElement = HTMLInputElement>(root: HTMLElement, label: string) => (label === 'Learning mode' ? root : active(root)).querySelector<T>(`[aria-label="${label}"]`)!;
const update = (root: HTMLElement, label: string, value: string, event = 'input') => { const input = field<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(root, label); input.value = value; input.dispatchEvent(new Event(event, { bubbles: true })); return input; };
const click = (root: HTMLElement, label: string) => [...active(root).querySelectorAll('button')].find(b => b.textContent === label)!.click();
function open() { const root = document.createElement('div'); root.dataset.module = 'CP04'; document.body.append(root); const controller = new AbortController(); const cleanup = mountView({ container: root, signal: controller.signal }); return { root, controller, cleanup }; }
function pointer(node: EventTarget, type: string, x = 350, id = 7) { const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, button: 0 }); Object.defineProperty(event, 'pointerId', { value: id }); node.dispatchEvent(event); return event; }
function points(root: HTMLElement, index = 0) { return active(root).querySelectorAll('polyline.bode-exact-line')[index]?.getAttribute('points'); }
afterEach(() => { partial.failAt = 0; partial.abort = undefined; partial.listener.mockClear(); vi.useRealTimers(); vi.unstubAllGlobals(); document.body.replaceChildren(); });

describe('CP04 visual-first linked exploration (DOM, not browser evidence)', () => {
  it('opens computed baseline without a submit and keeps each numeric/range name independent', () => {
    const { root, controller } = open(); expect(active(root).querySelectorAll('polyline.bode-exact-line')).toHaveLength(2); expect(active(root).textContent).toContain('|G|=0.3162278, -10 dB, -71.56505°');
    expect(active(root).querySelector('.bode-live-plots')!.compareDocumentPosition(field(root, 'Actual corner [rad/s]')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(field(root, 'Actual corner [rad/s]').parentElement!.querySelectorAll('input')).toHaveLength(1); expect(field(root, 'Move selected corner (log scale)').parentElement!.querySelectorAll('input')).toHaveLength(1); controller.abort();
  });
  it('honors hidden semantics over flex/grid styles for first-order damping and inactive modes', () => {
    const style = document.createElement('style'); style.textContent = readFileSync('src/modules/cp04/workspace.css', 'utf8'); document.head.append(style);
    const { root, controller } = open(); const exploration = active(root), damping = field(root, 'Damping ratio ζ').parentElement!;
    expect(damping.hidden).toBe(true); expect(getComputedStyle(damping).display).toBe('none');
    update(root, 'Example', 'quadratic', 'change'); expect(damping.hidden).toBe(false); expect(getComputedStyle(damping).display).toBe('flex');
    update(root, 'Learning mode', 'practice', 'change'); expect(exploration.hidden).toBe(true); expect(getComputedStyle(exploration).display).toBe('none');
    controller.abort(); style.remove();
  });
  it('moves actual corner 2→3 with visible 2/3 and retained Kn=.5, then undoes', () => {
    const { root, controller } = open(); update(root, 'Selected factor', '1', 'change');
    const original = points(root); update(root, 'Actual corner [rad/s]', '3'); field(root, 'Actual corner [rad/s]').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })); expect(active(root).textContent).toContain('model edit committed');
    expect(field<HTMLTextAreaElement>(root, 'Selected factor coefficient a₀').value).toBe('2'); expect(field<HTMLTextAreaElement>(root, 'Selected factor coefficient a₁').value).toBe('2/3');
    expect(active(root).textContent).toContain('normalization gain Kₙ=0.5'); expect(active(root).textContent).toContain('|G|=0.3354102'); expect(points(root)).not.toBe(original);
    click(root, 'Undo model edit'); expect(field<HTMLTextAreaElement>(root, 'Selected factor coefficient a₁').value).toBe('1'); expect(points(root)).toBe(original); controller.abort();
  });
  it('settles a preceding native control kind before editing another without a change event', () => {
    const { root, controller } = open(); update(root, 'Selected factor', '1', 'change');
    update(root, 'Actual corner [rad/s]', '3'); update(root, 'Raw gain K (signed)', '2'); field(root, 'Raw gain K (signed)').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(field<HTMLInputElement>(root, 'Actual corner [rad/s]').valueAsNumber).toBeCloseTo(3, 14); expect(field<HTMLTextAreaElement>(root, 'Selected factor coefficient a₁').value).toBe('2/3'); expect(field<HTMLTextAreaElement>(root, 'Raw gain K').value).toBe('2'); expect(active(root).textContent).toContain('|G|=0.6708204');
    click(root, 'Undo model edit'); expect(field<HTMLInputElement>(root, 'Actual corner [rad/s]').valueAsNumber).toBeCloseTo(3, 14); expect(field<HTMLInputElement>(root, 'Raw gain K (signed)').valueAsNumber).toBe(1); expect(active(root).textContent).toContain('|G|=0.3354102'); controller.abort();
  });
  it('uses fixed axes for gain translation, delay changes phase only, and Fit clears clipping', () => {
    const { root, controller } = open(); const magnitude = points(root), phase = points(root, 1);
    update(root, 'Delay τ [s]', '.5'); update(root, 'Delay τ [s]', '.5', 'change'); expect(points(root)).toBe(magnitude); expect(points(root, 1)).not.toBe(phase); expect(active(root).textContent).toContain('-100.2129°');
    update(root, 'Raw gain K (signed)', '1000'); update(root, 'Raw gain K (signed)', '1000', 'change'); expect(points(root)).not.toBe(magnitude); expect(active(root).querySelector('.bode-warning')!.textContent).toContain('fixed axes');
    click(root, 'Fit axes'); expect(active(root).querySelector('.bode-warning')!.textContent).not.toContain('fixed axes');
    update(root, 'Raw gain K (signed)', '-1000'); update(root, 'Raw gain K (signed)', '-1000', 'change'); expect(active(root).textContent).toContain('79.78706°'); controller.abort();
  });
  it('preserves physical cursor/model across units and marks invalid underflow without rewriting it', () => {
    const { root, controller } = open(); const original = points(root), raw = field<HTMLTextAreaElement>(root, 'Selected factor coefficient a₁').value;
    update(root, 'Frequency unit', 'Hz', 'change'); expect(field<HTMLInputElement>(root, 'Cursor frequency [Hz]').valueAsNumber).toBeCloseTo(1 / (2 * Math.PI), 14); expect(points(root)).toBe(original); expect(field<HTMLTextAreaElement>(root, 'Selected factor coefficient a₁').value).toBe(raw);
    update(root, 'Frequency unit', 'rad/s', 'change'); update(root, 'Cursor frequency [rad/s]', '1e-999'); update(root, 'Frequency unit', 'Hz', 'change');
    expect(field<HTMLInputElement>(root, 'Cursor frequency [rad/s]').value).toBe('1e-999'); expect(field<HTMLSelectElement>(root, 'Frequency unit').value).toBe('rad/s'); expect(active(root).querySelectorAll('polyline')).toHaveLength(0); expect(active(root).textContent).toContain('nonzero but too small to represent');
    update(root, 'Cursor frequency [rad/s]', '1'); expect(active(root).querySelectorAll('polyline.bode-exact-line')).toHaveLength(2); controller.abort();
  });
  it('shows raw draft failure, accepts a tiny explicit delay and preserves the full factor domain', () => {
    vi.useFakeTimers(); const { root, controller } = open();
    update(root, 'Raw gain K', ''); vi.advanceTimersByTime(50); expect(active(root).querySelectorAll('polyline')).toHaveLength(0); expect(active(root).textContent).toContain('Complete Raw gain K'); expect(active(root).textContent).not.toContain('normalization gain Kₙ=');
    update(root, 'Raw gain K', '-2'); update(root, 'Pure delay τ [s]', '.000000001'); vi.advanceTimersByTime(50); expect(active(root).querySelectorAll('polyline.bode-exact-line')).toHaveLength(2);
    update(root, 'Power of s at the origin', '3', 'change'); for (let i = 0; i < 4; i++) click(root, 'Add a factor'); expect(field<HTMLSelectElement>(root, 'Selected factor').options).toHaveLength(6); expect([...active(root).querySelectorAll('button')].find(b => b.textContent === 'Add a factor')!.disabled).toBe(true);
    for (let i = 0; i < 6; i++) click(root, 'Remove selected factor'); expect(field<HTMLSelectElement>(root, 'Selected factor').disabled).toBe(true); expect(active(root).querySelectorAll('polyline.bode-exact-line')).toHaveLength(2); controller.abort();
  });
  it('rejects an unsupported derived coefficient atomically and leaves its entered corner visible', () => {
    vi.useFakeTimers(); const { root, controller } = open(); update(root, 'Selected factor coefficient a₀', '.000001'); update(root, 'Selected factor coefficient a₁', '.000001'); vi.advanceTimersByTime(50);
    update(root, 'Actual corner [rad/s]', '2'); expect(field<HTMLInputElement>(root, 'Actual corner [rad/s]').value).toBe('2'); expect(field<HTMLTextAreaElement>(root, 'Selected factor coefficient a₁').value).toBe('.000001'); expect(active(root).textContent).toContain('supported coefficient bounds'); expect(active(root).querySelectorAll('polyline')).toHaveLength(0); controller.abort();
  });
  it('keeps an invalid native model draft blocked when view-only controls change', () => {
    const { root, controller } = open(); update(root, 'Raw gain K (signed)', '0'); expect(active(root).querySelectorAll('polyline')).toHaveLength(0);
    update(root, 'Contribution to highlight', 'all', 'change'); expect(active(root).querySelectorAll('polyline')).toHaveLength(0); expect(field<HTMLInputElement>(root, 'Raw gain K (signed)').value).toBe('0'); expect(active(root).textContent).toContain('Correct Raw gain K');
    update(root, 'Raw gain K (signed)', '2'); update(root, 'Raw gain K (signed)', '2', 'change'); expect(active(root).textContent).toContain('|G|=0.6324555'); controller.abort();
  });
  it('keeps source-slot selection atomic when a display failure rejects add/remove/undo', () => {
    const { root, controller } = open(); update(root, 'Selected factor', '1', 'change'); update(root, 'Actual corner [rad/s]', '3'); update(root, 'Actual corner [rad/s]', '3', 'change');
    update(root, 'Cursor frequency [rad/s]', '1000'); click(root, 'Add a factor'); click(root, 'Remove selected factor'); click(root, 'Undo model edit');
    expect(field<HTMLSelectElement>(root, 'Selected factor').value).toBe('1'); expect(field<HTMLTextAreaElement>(root, 'Selected factor coefficient a₀').value).toBe('2'); expect(field<HTMLTextAreaElement>(root, 'Selected factor coefficient a₁').value).toBe('2/3');
    update(root, 'Cursor frequency [rad/s]', '1'); expect(active(root).textContent).toContain('|G|=0.3354102'); click(root, 'Undo model edit'); expect(field<HTMLTextAreaElement>(root, 'Selected factor coefficient a₁').value).toBe('1'); controller.abort();
  });
  it('updates a continuous range before release, cancels with Escape at the stable focus and drops late work', () => {
    vi.useFakeTimers(); const { root, controller } = open(); const original = points(root);
    update(root, 'Move selected corner (log scale)', '.2'); vi.advanceTimersByTime(20); update(root, 'Move selected corner (log scale)', '.3'); vi.advanceTimersByTime(15); expect(points(root)).not.toBe(original); expect(active(root).textContent).toContain('Live preview');
    const plots = active(root).querySelector<HTMLElement>('.bode-live-plots')!; plots.focus(); const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }); document.activeElement!.dispatchEvent(event); expect(event.defaultPrevented).toBe(true); expect(points(root)).toBe(original);
    update(root, 'Move selected corner (log scale)', '.5'); controller.abort(); vi.advanceTimersByTime(100); pointer(window, 'pointerup'); expect(root.children).toHaveLength(0);
  });
  it('links marker pointer/keyboard edits and restores on pointer cancellation', () => {
    vi.useFakeTimers(); const { root, controller } = open(); const original = points(root);
    pointer(active(root).querySelector('[data-factor="1"]')!, 'pointerdown'); vi.spyOn(active(root).querySelector('svg')!, 'getBoundingClientRect').mockReturnValue({ left: 0, width: 660 } as DOMRect);
    pointer(window, 'pointermove', 420); vi.advanceTimersByTime(40); expect(points(root)).not.toBe(original); pointer(window, 'pointercancel'); expect(points(root)).toBe(original);
    active(root).querySelector('[data-factor="0"]')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true })); expect(field<HTMLInputElement>(root, 'Actual corner [rad/s]').valueAsNumber).toBeCloseTo(10 ** .02, 11); expect(active(root).querySelectorAll('.bode-selected-marker')).toHaveLength(2); controller.abort();
  });
  it('retains the first pointer owner and ignores unrelated capture/move/up/cancel IDs', () => {
    vi.useFakeTimers(); const { root, controller } = open(); const original = points(root), plots = active(root).querySelector<HTMLElement>('.bode-live-plots')!;
    const capture = vi.fn(); plots.setPointerCapture = capture; plots.hasPointerCapture = () => false;
    vi.spyOn(SVGElement.prototype, 'getBoundingClientRect').mockReturnValue({ left: 0, width: 660 } as DOMRect);
    pointer(active(root).querySelector('[data-factor="0"]')!, 'pointerdown', 350, 7); pointer(window, 'pointermove', 420, 7); vi.advanceTimersByTime(40);
    const preview = points(root); expect(preview).not.toBe(original);
    pointer(active(root).querySelector('[data-factor="1"]')!, 'pointerdown', 420, 8); pointer(plots, 'lostpointercapture', 420, 8); pointer(window, 'pointermove', 500, 8); pointer(window, 'pointerup', 500, 8); pointer(window, 'pointercancel', 500, 8); vi.advanceTimersByTime(40);
    expect(capture.mock.calls).toEqual([[7]]); expect(points(root)).toBe(preview); expect(field<HTMLSelectElement>(root, 'Selected factor').value).toBe('0');
    pointer(window, 'pointercancel', 420, 7); expect(points(root)).toBe(original); controller.abort();
  });
  it('retains the originating phase handle and avoids scrolling across repeated keyboard edits', () => {
    const { root, controller } = open(); const phaseHandle = () => active(root).querySelector<SVGElement>('svg[aria-label="Phase response"] [data-factor="1"]')!;
    phaseHandle().focus(); const focus = vi.spyOn(SVGElement.prototype, 'focus');
    for (let i = 0; i < 2; i++) {
      phaseHandle().dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true })); expect(document.activeElement).toBe(phaseHandle()); expect(focus).toHaveBeenLastCalledWith({ preventScroll: true });
    }
    expect(field<HTMLInputElement>(root, 'Actual corner [rad/s]').valueAsNumber).toBeCloseTo(2 * 10 ** .04, 11); focus.mockRestore(); controller.abort();
  });
  it('starts Practice without Explore answers and revokes a previous matched grade on prediction edits', () => {
    const { root, controller } = open(); update(root, 'Learning mode', 'practice', 'change'); expect(active(root).querySelectorAll('polyline')).toHaveLength(0); expect(active(root).textContent).not.toContain('normalization gain Kₙ='); expect(active(root).querySelector('.bode-verdict')).toBeNull();
    update(root, 'Your corner for factor 2 [rad/s]', '2'); update(root, 'Your normalization gain magnitude |Kₙ|', '.5'); click(root, 'Draw my asymptote'); expect(active(root).querySelectorAll('polyline')).toHaveLength(2); expect(active(root).querySelectorAll('.bode-checked-marker')).toHaveLength(0); expect(active(root).textContent).not.toContain('Exact numerical');
    click(root, 'Reveal checked construction'); expect(active(root).textContent).toContain('match the asymptotic construction'); update(root, 'Your normalization gain magnitude |Kₙ|', '1'); expect(active(root).textContent).not.toContain('match the asymptotic construction'); expect(active(root).querySelectorAll('polyline')).toHaveLength(0); controller.abort();
  });
  it('retains complete independent mode visits, view units, checked attempts, drafts and undo', () => {
    const { root, controller } = open(); update(root, 'Selected factor', '1', 'change'); update(root, 'Actual corner [rad/s]', '3'); field(root, 'Actual corner [rad/s]').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    update(root, 'Frequency unit', 'Hz', 'change'); update(root, 'Magnitude unit', 'linear', 'change'); const exploration = active(root), explorePoints = points(root); const rawDetails = exploration.querySelectorAll('details')[1]; rawDetails.open = true;
    update(root, 'Learning mode', 'practice', 'change'); expect(exploration.hidden).toBe(true); expect(exploration.inert).toBe(true); expect(active(root).textContent).not.toContain('|G|=0.3354102'); expect(field<HTMLTextAreaElement>(root, 'Raw gain K').value).toBe('1');
    const practice = active(root), guess = field<HTMLInputElement>(root, 'Your normalization gain magnitude |Kₙ|'); update(root, 'Your corner for factor 2 [rad/s]', '2'); update(root, 'Your normalization gain magnitude |Kₙ|', '.5'); click(root, 'Reveal checked construction'); expect(practice.textContent).toContain('match the asymptotic construction');
    update(root, 'Learning mode', 'explore', 'change'); expect(active(root)).toBe(exploration); expect(practice.hidden).toBe(true); expect(field<HTMLSelectElement>(root, 'Frequency unit').value).toBe('Hz'); expect(field<HTMLSelectElement>(root, 'Magnitude unit').value).toBe('linear'); expect(rawDetails.open).toBe(true); expect(points(root)).toBe(explorePoints);
    click(root, 'Undo model edit'); expect(field<HTMLTextAreaElement>(root, 'Selected factor coefficient a₁').value).toBe('1');
    update(root, 'Learning mode', 'practice', 'change'); expect(field(root, 'Your normalization gain magnitude |Kₙ|')).toBe(guess); expect(guess.value).toBe('.5'); expect(practice.textContent).toContain('match the asymptotic construction');
    update(root, 'Cursor frequency [rad/s]', '1e-999'); expect(active(root).querySelectorAll('polyline')).toHaveLength(0); update(root, 'Learning mode', 'explore', 'change'); update(root, 'Learning mode', 'practice', 'change'); expect(field<HTMLInputElement>(root, 'Cursor frequency [rad/s]').value).toBe('1e-999'); expect(practice.textContent).toContain('nonzero but too small to represent'); controller.abort();
  });
  it('suspends timers and pointer work while retaining a pending raw draft for reactivation', () => {
    vi.useFakeTimers(); const { root, controller } = open(); const exploration = active(root);
    update(root, 'Raw gain K', '1/2'); expect(vi.getTimerCount()).toBe(1); update(root, 'Learning mode', 'practice', 'change'); expect(vi.getTimerCount()).toBe(0); vi.advanceTimersByTime(100); expect(exploration.querySelectorAll('polyline')).toHaveLength(0);
    const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }); window.dispatchEvent(event); expect(event.defaultPrevented).toBe(false);
    update(root, 'Learning mode', 'explore', 'change'); expect(field<HTMLTextAreaElement>(root, 'Raw gain K').value).toBe('1/2'); vi.advanceTimersByTime(40); expect(active(root).textContent).toContain('|G|=0.1581139');
    controller.abort(); expect(vi.getTimerCount()).toBe(0); expect(root.children).toHaveLength(0);
  });
  it('settles a valid typed edit on mode leave, retains invalid native drafts and cancels an unfinished range', () => {
    vi.useFakeTimers(); const { root, controller } = open(); update(root, 'Actual corner [rad/s]', '3'); update(root, 'Learning mode', 'practice', 'change'); update(root, 'Learning mode', 'explore', 'change');
    expect(field<HTMLInputElement>(root, 'Actual corner [rad/s]').valueAsNumber).toBe(3); click(root, 'Undo model edit'); expect(field<HTMLInputElement>(root, 'Actual corner [rad/s]').valueAsNumber).toBe(1);
    update(root, 'Raw gain K (signed)', '0'); const invalid = field(root, 'Raw gain K (signed)'); update(root, 'Learning mode', 'practice', 'change'); update(root, 'Learning mode', 'explore', 'change');
    expect(field(root, 'Raw gain K (signed)')).toBe(invalid); expect((invalid as HTMLInputElement).value).toBe('0'); expect(active(root).querySelectorAll('polyline')).toHaveLength(0);
    update(root, 'Raw gain K (signed)', '1'); field(root, 'Raw gain K (signed)').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    update(root, 'Move selected corner (log scale)', '.5'); update(root, 'Learning mode', 'practice', 'change'); expect(vi.getTimerCount()).toBe(0); update(root, 'Learning mode', 'explore', 'change'); expect(field<HTMLInputElement>(root, 'Actual corner [rad/s]').valueAsNumber).toBe(1); controller.abort();
  });
  it('aborts a partially created editor before displaying recoverable failure', () => {
    partial.failAt = partial.count + 2; const { root, controller, cleanup } = open(); window.dispatchEvent(new Event('cp04-partial'));
    expect(partial.listener).not.toHaveBeenCalled(); expect(controller.signal.aborted).toBe(false); expect(active(root).querySelector('[role="alert"]')?.textContent).toContain('Reset'); expect(active(root).querySelector('textarea')).toBeNull(); cleanup?.(); expect(root.children).toHaveLength(0);
  });
  it('releases an observer allocated after reentrant parent abort during a nonthrowing editor mount', () => {
    const controller = new AbortController(), root = document.createElement('div'), disconnect = vi.fn(), observe = vi.fn();
    vi.stubGlobal('ResizeObserver', class { disconnect = disconnect; observe = observe; }); partial.abort = () => controller.abort();
    const cleanup = mountView({ container: root, signal: controller.signal }); expect(root.children).toHaveLength(0); expect(disconnect).toHaveBeenCalledOnce(); expect(observe).not.toHaveBeenCalled(); cleanup?.(); expect(disconnect).toHaveBeenCalledOnce();
  });
  it('owns adaptive plot observation and cancels a pending gesture on resize', () => {
    vi.useFakeTimers(); let callback: (() => void) | undefined; const disconnect = vi.fn();
    vi.stubGlobal('ResizeObserver', class { constructor(cb: () => void) { callback = cb; } observe() {} disconnect = disconnect; });
    const { root, controller } = open(); const plots = active(root).querySelector<HTMLElement>('.bode-live-plots')!; const original = field<HTMLInputElement>(root, 'Actual corner [rad/s]').value;
    update(root, 'Move selected corner (log scale)', '.5'); vi.spyOn(plots, 'getBoundingClientRect').mockReturnValue({ width: 305 } as DOMRect); callback?.(); vi.advanceTimersByTime(100);
    expect(field<HTMLInputElement>(root, 'Actual corner [rad/s]').value).toBe(original); expect(active(root).querySelector('svg')!.getAttribute('viewBox')).toBe('0 0 305 270');
    controller.abort(); expect(disconnect).toHaveBeenCalledOnce(); callback?.(); expect(root.children).toHaveLength(0);
  });
});
