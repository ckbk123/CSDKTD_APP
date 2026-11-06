import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EquationInputOptions } from '../../shared/equations/input';
import { trace } from './continuation';
import { mountView } from './view';
const state = vi.hoisted(() => ({ count: 0, failAt: 0, releases: 0, failDisplay: false }));
vi.mock('./continuation', async original => { const actual = await original<typeof import('./continuation')>(); return { ...actual, trace: vi.fn(actual.trace) }; });
vi.mock('../../shared/equations/input', () => ({
  createEquationDisplay: (latex: string, label: string) => { if (state.failDisplay) { state.failDisplay = false; throw new Error('Synthetic readout failure'); } const n = document.createElement('div'); n.setAttribute('aria-label', label); n.dataset.latex = latex; n.textContent = latex; return n; },
  createEquationInput: (options: EquationInputOptions) => {
    state.count++; if (state.failAt === state.count) throw new Error('Synthetic partial editor failure');
    const element = document.createElement('div'), field = document.createElement('textarea'); field.value = options.value; field.setAttribute('aria-label', options.label); element.append(field);
    const getValue = () => ({ latex: field.value, empty: !field.value.trim(), hasPlaceholders: field.value.includes('placeholder'), syntaxIssues: [] });
    field.addEventListener('input', () => options.onChange?.(getValue()), { signal: options.signal }); let disposed = false;
    const destroy = () => { if (disposed) return; disposed = true; state.releases++; element.remove(); };
    options.signal.addEventListener('abort', destroy, { once: true });
    return { element, getValue, setValue: (value: string) => { field.value = value; }, focus: () => field.focus(), destroy };
  },
}));
const visits: { root: HTMLElement; controller: AbortController; cleanup: () => void }[] = [];
function visit() { const root = document.createElement('div'); root.dataset.module = 'CP06'; document.body.append(root); const controller = new AbortController(), cleanup = mountView({ container: root, signal: controller.signal }) || (() => {}); const v = { root, controller, cleanup }; visits.push(v); return v; }
function field<T extends HTMLElement = HTMLInputElement>(root: HTMLElement, label: string): T { return root.querySelector(`[aria-label="${label}"]`)! as T; }
function press(root: HTMLElement, label: string): void { const b = [...root.querySelectorAll('button')].find(b => b.textContent === label); expect(b).toBeDefined(); b!.click(); }
function input(root: HTMLElement, label: string, value: string): void { const n = field<HTMLInputElement>(root, label); n.value = value; n.dispatchEvent(new Event('input', { bubbles: true })); }
function choose(root: HTMLElement, label: string, value: string): void { const n = field<HTMLSelectElement>(root, label); n.value = value; n.dispatchEvent(new Event('change', { bubbles: true })); }
const Q = (root: HTMLElement) => field(root, 'Complete selected characteristic polynomial').getAttribute('data-latex');
function pointer(target: Element, type: string, x = 300, y = 204): void { const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 }); Object.defineProperty(event, 'pointerId', { value: 9 }); target.dispatchEvent(event); }
afterEach(() => { for (const v of visits.splice(0)) { v.controller.abort(); v.cleanup(); v.root.remove(); } vi.useRealTimers(); vi.clearAllMocks(); vi.unstubAllGlobals(); state.count = state.failAt = state.releases = 0; state.failDisplay = false; });

describe('CP06 immediate exploration and intentional practice', () => {
  it('opens a checked baseline visual and separates a fresh hidden-answer practice attempt', () => {
    const { root } = visit(); expect(root.querySelector('svg')).not.toBeNull(); expect(Q(root)).toBe('Q(s,70)=s^{3}+7s^{2}+10s+70');
    expect(root.querySelector('[data-learning-mode="practice"]')!.children).toHaveLength(0);
    press(root, 'Practice'); const practice = root.querySelector<HTMLElement>('[data-learning-mode="practice"]')!;
    expect(practice.hidden).toBe(false); expect(practice.querySelector('svg')).toBeNull(); expect(practice.querySelector('[aria-label="Complete selected characteristic polynomial"]')).toBeNull();
    press(practice, 'Construct and check'); expect(practice.querySelector('svg')).not.toBeNull();
    press(root, 'Explore'); expect(practice.hidden).toBe(true); expect(Q(root)).toContain('s^{3}+7s^{2}+10s+70');
  });
  it('moves the selected gain with all roots while reusing the existing trace and fixed axes', () => {
    const { root } = visit(), calls = vi.mocked(trace).mock.calls.length, ticks = [...root.querySelectorAll('.cp-tick')].map(n => n.textContent), paths = [...root.querySelectorAll('.cp-branch')].map(n => n.getAttribute('d'));
    input(root, 'Live gain cursor', '10'); expect(Q(root)).toBe('Q(s,10)=s^{3}+7s^{2}+10s+10');
    expect(vi.mocked(trace).mock.calls).toHaveLength(calls); expect([...root.querySelectorAll('.cp-branch')].map(n => n.getAttribute('d'))).toEqual(paths); expect([...root.querySelectorAll('.cp-tick')].map(n => n.textContent)).toEqual(ticks);
    expect(root.querySelectorAll('.cp-selected')).toHaveLength(3);
  });
  it('adds/removes a zero, synchronizes equations and undoes a checked model edit', () => {
    const { root } = visit(); press(root, 'Add zero'); expect(field<HTMLTextAreaElement>(root, 'Numerator polynomial N(s)').value).toBe('s+1'); expect(field<HTMLSelectElement>(root, 'Selected plant factor').value).toBe('zero-0');
    input(root, 'Factor real coordinate (s⁻¹)', '-3'); press(root, 'Apply coordinates'); expect(field<HTMLTextAreaElement>(root, 'Numerator polynomial N(s)').value).toBe('s+3');
    press(root, 'Undo model edit'); expect(field<HTMLTextAreaElement>(root, 'Numerator polynomial N(s)').value).toBe('s+1'); choose(root, 'Selected plant factor', 'zero-0'); press(root, 'Remove selected group'); expect(field<HTMLTextAreaElement>(root, 'Numerator polynomial N(s)').value).toBe('1');
  });
  it('provides a smaller experiment for adding a pole without expanding the order contract', () => {
    const { root } = visit(); expect([...root.querySelectorAll('button')].find(b => b.textContent === 'Add pole')!.disabled).toBe(true);
    press(root, 'Try two poles'); press(root, 'Add pole'); expect(field<HTMLTextAreaElement>(root, 'Denominator polynomial D(s)').value).toBe('s^{3}+3s^{2}+2s');
    expect([...root.querySelectorAll('button')].find(b => b.textContent === 'Add pole')!.disabled).toBe(true);
  });
  it('preserves the checked visual with an explicit stale/invalid draft and restores it on discard', () => {
    const { root } = visit(), before = Q(root); input(root, 'Numerator polynomial N(s)', 'bad'); expect(root.textContent).toContain('plot shows the last checked model');
    press(root, 'Apply equations'); expect(Q(root)).toBe(before); expect(root.textContent).toContain('last checked model remains visible'); expect(field<HTMLInputElement>(root, 'Live gain cursor').disabled).toBe(true);
    press(root, 'Discard equation edits'); expect(field<HTMLTextAreaElement>(root, 'Numerator polynomial N(s)').value).toBe('1'); expect(field<HTMLInputElement>(root, 'Live gain cursor').disabled).toBe(false);
  });
  it('rejects invalid gain and candidate values without presenting their results as current', () => {
    const { root } = visit(), before = Q(root); input(root, 'Selected gain K or Kp', '1e-999'); expect(Q(root)).toBe(before); expect(root.textContent).toContain('last checked model retained');
    input(root, 'Candidate real part (s⁻¹)', '101'); press(root, 'Test candidate'); expect(Q(root)).toBe(before); expect(root.textContent).toContain('last checked model remains visible');
  });
  it('edits plant factors under fixed Ki and preserves the full derived PI model', () => {
    const { root } = visit(); press(root, 'Fixed-Ki PI example'); expect(Q(root)).toBe(String.raw`Q(s,\frac{27}{20})=s^{3}+2s^{2}+\frac{27}{20}s+\frac{27}{10}`);
    choose(root, 'Selected plant factor', 'pole-0'); input(root, 'Factor real coordinate (s⁻¹)', '-3'); press(root, 'Apply coordinates');
    expect(Q(root)).toContain(String.raw`s^{3}+3s^{2}+\frac{27}{20}s+\frac{27}{10}`); expect(root.textContent).toContain('plant factor, not an independently editable effective PI factor');
  });
  it('does not validate a hidden irrelevant Ki draft after switching back to gain mode', () => {
    const { root } = visit(); press(root, 'Fixed-Ki PI example'); input(root, 'Fixed Ki (Kp per second)', ''); choose(root, 'Varying parameter', 'gain'); press(root, 'Apply equations');
    expect(Q(root)).toBe(String.raw`Q(s,\frac{27}{20})=s^{2}+2s+\frac{27}{20}`); expect(field<HTMLInputElement>(root, 'Live gain cursor').disabled).toBe(false);
  });
  it('shows retained fixed modes after equation edits', () => {
    const { root } = visit(); input(root, 'Numerator polynomial N(s)', 's-1'); input(root, 'Denominator polynomial D(s)', '(s-1)(s+2)'); press(root, 'Apply equations'); expect(root.textContent).toContain('Retained common-factor modes: 1'); expect(root.textContent).toContain('right half-plane');
  });
  it('accepts and selects original roots beyond the drag window without altering or losing them', () => {
    const { root } = visit(); input(root, 'Denominator polynomial D(s)', 's+200'); press(root, 'Apply equations'); expect(Q(root)).toBe('Q(s,70)=s+270');
    expect(field<HTMLInputElement>(root, 'Factor real coordinate (s⁻¹)').value).toBe('-200'); expect(root.textContent).toContain('outside the ±100 coordinate-edit window');
    choose(root, 'Selected plant factor', 'pole-0'); press(root, 'Fit plot'); expect(Q(root)).toBe('Q(s,70)=s+270');
    input(root, 'Factor real coordinate (s⁻¹)', '-101'); press(root, 'Apply coordinates'); expect(Q(root)).toBe('Q(s,70)=s+270'); expect(root.textContent).toContain('last checked model remains visible');
    input(root, 'Selected gain K or Kp', '71'); expect(Q(root)).toBe('Q(s,71)=s+271');
    input(root, 'Factor real coordinate (s⁻¹)', '-99'); press(root, 'Apply coordinates'); expect(Q(root)).toBe('Q(s,71)=s+170');
    press(root, 'Undo model edit'); expect(Q(root)).toBe('Q(s,71)=s+271'); expect(field<HTMLInputElement>(root, 'Factor real coordinate (s⁻¹)').value).toBe('-200');
  });
  it('does not publish new mathematics or partial visuals if readout construction fails', () => {
    const { root } = visit(), before = Q(root), beforePaths = [...root.querySelectorAll('.cp-branch')].map(n => n.getAttribute('d'));
    input(root, 'Denominator polynomial D(s)', 's+200'); state.failDisplay = true; press(root, 'Apply equations');
    expect(Q(root)).toBe(before); expect([...root.querySelectorAll('.cp-branch')].map(n => n.getAttribute('d'))).toEqual(beforePaths);
    press(root, 'Discard equation edits'); expect(field<HTMLTextAreaElement>(root, 'Denominator polynomial D(s)').value).toBe('s^{3}+7s^{2}+10s');
    input(root, 'Selected gain K or Kp', '10'); expect(Q(root)).toBe('Q(s,10)=s^{3}+7s^{2}+10s+10');
    expect([...root.querySelectorAll('button')].find(b => b.textContent === 'Undo model edit')!.disabled).toBe(true);
  });
  it('rejects tiny nonzero cursor/native gain rather than silently changing it to zero', () => {
    const { root } = visit(), before = Q(root); input(root, 'Live gain cursor', '0.0000000001'); expect(Q(root)).toBe(before); expect(root.textContent).toContain('it was not changed to zero');
    input(root, 'Selected gain K or Kp', '0.0000000001'); expect(Q(root)).toBe(before);
    input(root, 'Live gain cursor', '0.000000001'); expect(Q(root)).toBe(String.raw`Q(s,\frac{1}{1000000000})=s^{3}+7s^{2}+10s+\frac{1}{1000000000}`);
  });
  it('keeps boundary failures in feedback and moves a negative conjugate handle in the pressed direction', () => {
    const { root } = visit(); input(root, 'Denominator polynomial D(s)', 's+100'); press(root, 'Apply equations'); const before = Q(root);
    const marker = root.querySelector('[data-edit-id="pole-0"]')!; marker.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true })); expect(Q(root)).toBe(before); expect(root.textContent).toContain('within ±100');
    input(root, 'Denominator polynomial D(s)', 's^2+2s+5'); press(root, 'Apply equations');
    const negative = [...root.querySelectorAll<SVGGElement>('[data-edit-id="pole-0"]')].find(n => Number(n.dataset.editIm) < 0)!;
    negative.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true })); expect(Number(field<HTMLInputElement>(root, 'Factor imaginary coordinate (rad/s)').value)).toBeCloseTo(1.99, 9);
    expect(field<HTMLTextAreaElement>(root, 'Denominator polynomial D(s)').value).toBe(String.raw`s^{2}+2s+\frac{49601}{10000}`);
    expect(Number((document.activeElement as SVGElement).dataset.editIm)).toBeLessThan(0);
    document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true }));
    expect(Number(field<HTMLInputElement>(root, 'Factor imaginary coordinate (rad/s)').value)).toBeCloseTo(1.98, 9);
  });
  it('previews a drag on fixed axes and cancels without changing the checked model', () => {
    vi.useFakeTimers(); const { root } = visit(), before = Q(root), svg = root.querySelector('svg')!;
    vi.spyOn(SVGElement.prototype, 'getBoundingClientRect').mockReturnValue({ x: 0, y: 0, left: 0, top: 0, width: 480, height: 440, right: 480, bottom: 440, toJSON() {} });
    const ticks = [...root.querySelectorAll('.cp-tick')].map(n => n.textContent), marker = svg.querySelector('[data-edit-id="pole-2"]')!, host = root.querySelector('.cp-interactive-plane')!;
    pointer(marker, 'pointerdown'); pointer(host, 'pointermove', 280); vi.advanceTimersByTime(80);
    expect(root.querySelector('svg')!.dataset.preview).toBe('true'); expect([...root.querySelectorAll('.cp-tick')].map(n => n.textContent)).toEqual(ticks);
    const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }); host.dispatchEvent(escape); expect(escape.defaultPrevented).toBe(true); expect(Q(root)).toBe(before); expect(root.querySelector('svg')!.dataset.preview).toBe('false');
    expect([...root.querySelectorAll('button')].find(b => b.textContent === 'Undo model edit')!.disabled).toBe(true);
  });
  it('commits one drag edit and undo restores the exact pre-drag polynomial', () => {
    vi.useFakeTimers(); const { root } = visit(), before = Q(root);
    vi.spyOn(SVGElement.prototype, 'getBoundingClientRect').mockReturnValue({ x: 0, y: 0, left: 0, top: 0, width: 480, height: 440, right: 480, bottom: 440, toJSON() {} });
    const host = root.querySelector('.cp-interactive-plane')!, marker = root.querySelector('[data-edit-id="pole-2"]')!;
    pointer(marker, 'pointerdown'); pointer(host, 'pointermove', 280); vi.advanceTimersByTime(80); pointer(host, 'pointerup', 280);
    expect(Q(root)).not.toBe(before); expect(root.querySelector('svg')!.dataset.preview).toBe('false'); press(root, 'Undo model edit'); expect(Q(root)).toBe(before);
  });
  it('cancels queued preview work on leaving or switching to Practice', () => {
    vi.useFakeTimers(); const { root, controller, cleanup } = visit(), marker = root.querySelector('[data-edit-id="pole-2"]')!, host = root.querySelector('.cp-interactive-plane')!;
    vi.spyOn(SVGElement.prototype, 'getBoundingClientRect').mockReturnValue({ x: 0, y: 0, left: 0, top: 0, width: 480, height: 440, right: 480, bottom: 440, toJSON() {} });
    pointer(marker, 'pointerdown'); pointer(host, 'pointermove', 280); press(root, 'Practice'); const calls = vi.mocked(trace).mock.calls.length; vi.advanceTimersByTime(100); expect(vi.mocked(trace).mock.calls).toHaveLength(calls);
    controller.abort(); cleanup(); vi.runAllTimers(); expect(root.children).toHaveLength(0); expect(state.releases).toBe(4);
  });
  it('adapts to the measured plot width without retracing and owns resize/window resources on direct disposal', () => {
    let resized: ResizeObserverCallback; const disconnect = vi.fn(), observe = vi.fn();
    vi.stubGlobal('ResizeObserver', class { constructor(callback: ResizeObserverCallback) { resized = callback; } observe = observe; disconnect = disconnect; });
    const removeListener = vi.spyOn(window, 'removeEventListener'), { root, cleanup, controller } = visit(), before = Q(root), calls = vi.mocked(trace).mock.calls.length;
    resized!([{ contentRect: { width: 276 } } as ResizeObserverEntry], {} as ResizeObserver);
    expect(root.querySelector('svg')!.style.getPropertyValue('--cp-plane-font')).toBe(`${12 * 480 / 276}px`); expect(Q(root)).toBe(before); expect(vi.mocked(trace).mock.calls).toHaveLength(calls);
    cleanup(); cleanup(); expect(controller.signal.aborted).toBe(false); expect(disconnect).toHaveBeenCalledOnce(); expect(observe).toHaveBeenCalledOnce(); expect(removeListener).toHaveBeenCalledWith('keydown', expect.any(Function), true);
    resized!([{ contentRect: { width: 500 } } as ResizeObserverEntry], {} as ResizeObserver); expect(root.children).toHaveLength(0); expect(vi.mocked(trace).mock.calls).toHaveLength(calls);
  });
  it('cancels an active preview safely if its measured plot width changes', () => {
    vi.useFakeTimers(); let resized: ResizeObserverCallback;
    vi.stubGlobal('ResizeObserver', class { constructor(callback: ResizeObserverCallback) { resized = callback; } observe() {} disconnect() {} });
    const { root } = visit(), before = Q(root), host = root.querySelector('.cp-interactive-plane')!;
    vi.spyOn(SVGElement.prototype, 'getBoundingClientRect').mockReturnValue({ x: 0, y: 0, left: 0, top: 0, width: 480, height: 440, right: 480, bottom: 440, toJSON() {} });
    pointer(root.querySelector('[data-edit-id="pole-2"]')!, 'pointerdown'); expect(document.activeElement).toBe(host); pointer(host, 'pointermove', 280); vi.advanceTimersByTime(80); expect(root.querySelector('svg')!.dataset.preview).toBe('true');
    const calls = vi.mocked(trace).mock.calls.length; resized!([{ contentRect: { width: 276 } } as ResizeObserverEntry], {} as ResizeObserver);
    expect(Q(root)).toBe(before); expect(root.querySelector('svg')!.dataset.preview).toBe('false'); expect(root.textContent).toContain('Drag cancelled because the plot resized'); expect(vi.mocked(trace).mock.calls).toHaveLength(calls);
  });
  it('releases an editor created before partial mount failure with the parent still active', () => {
    state.failAt = 2; const root = document.createElement('div'), parent = new AbortController(); expect(() => mountView({ container: root, signal: parent.signal })).toThrow('Synthetic'); expect(parent.signal.aborted).toBe(false); expect(state.releases).toBe(1); expect(root.children).toHaveLength(0);
  });
});
