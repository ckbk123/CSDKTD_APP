import { afterEach, describe, expect, it, vi } from 'vitest';
const editorState = vi.hoisted(() => ({ fail: false, probes: 0, aborts: 0 }));
// Public equation API stub, not evidence of the real MathLive editor.
vi.mock('../../shared/equations/input', () => ({
  createEquationDisplay: (latex: string, label: string) => { const e = document.createElement('div'); e.textContent = latex; e.setAttribute('aria-label', label); return e; },
  createEquationInput: (options: { label: string; value: string; signal: AbortSignal; onChange: () => void }) => {
    if (editorState.fail) {
      window.addEventListener('dr05-partial-editor-resource', () => editorState.probes++, { signal: options.signal });
      options.signal.addEventListener('abort', () => editorState.aborts++, { once: true });
      throw new Error('Synthetic editor failure after signal-owned resource');
    }
    const element = document.createElement('div'), input = document.createElement('input');
    input.setAttribute('aria-label', options.label); input.value = options.value; element.append(input);
    input.addEventListener('input', options.onChange, { signal: options.signal });
    return { element, getValue: () => ({ latex: input.value, empty: !input.value, syntaxIssues: [], hasPlaceholders: false }),
      setValue: (value: string) => { input.value = value; }, destroy: () => element.remove() };
  },
}));
import { mount } from './view';
import * as mathematics from './math';
let controller: AbortController, cleanup: ReturnType<typeof mount>;
const open = (mode: 'explore' | 'practice' = 'practice', policy: 'window' | 'count' = 'count'): HTMLElement => {
  const root = document.createElement('div'); root.dataset.module = 'DR05'; document.body.append(root);
  controller = new AbortController(); cleanup = mount({ container: root, signal: controller.signal });
  const modeControl = root.querySelector<HTMLSelectElement>('[aria-label="Learning mode"]')!, windowControl = root.querySelector<HTMLSelectElement>('[aria-label="Time window policy"]')!;
  if (modeControl.value !== mode) { modeControl.value = mode; modeControl.dispatchEvent(new Event('input')); }
  if (windowControl.value !== policy) { windowControl.value = policy; windowControl.dispatchEvent(new Event('input')); } return root;
};
afterEach(() => { controller?.abort(); if (typeof cleanup === 'function') cleanup(); document.body.replaceChildren(); vi.useRealTimers(); vi.restoreAllMocks(); editorState.fail = false; editorState.probes = editorState.aborts = 0; });
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
    change(control(root, 'Sample period T (s)'), '0.2'); expect(root.textContent).toContain('Draft changed');
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
  it('guards native underflow in optional prediction and sample inspection', () => {
    const root = open();
    change(control(root, 'Your prediction for y[1] (optional)'), '1e-400'); click(root, 'Reveal sampled model');
    expect(root.textContent).toContain('too small to represent');
    change(control(root, 'Your prediction for y[1] (optional)'), ''); click(root, 'Reveal sampled model');
    change(control(root, 'Inspect sample k'), '1e-400'); expect(root.textContent).toContain('Inspection point:');
    change(control(root, 'Inspect sample k'), '0e-400'); expect(root.textContent).toContain('Sample k = 0');
  });
  it('preserves invalid inspection drafts on Reveal and clamps only validated indices', () => {
    const root = open(); click(root, 'Reveal sampled model');
    const inspect = control(root, 'Inspect sample k');
    change(inspect, '5'); expect(root.textContent).toContain('Sample k = 5');
    change(control(root, 'Sample period T (s)'), '.2');
    for (const raw of ['1e-400', '', '-1', '1.5']) {
      change(inspect, raw); click(root, 'Reveal sampled model');
      expect(inspect.value).toBe(raw);
      expect(root.textContent).not.toContain('Sample k = 0');
      expect(root.textContent).toContain(raw === '1e-400' || raw === '' ? 'Inspection point:' : 'Choose k from 0');
      expect(outputValues(root)[1]).toBe('0.1812692');
      expect(root.querySelectorAll('.zoh-plot svg')).toHaveLength(2);
      expect(root.textContent).toContain('last valid cursor remains selected');
    }
    change(inspect, '20'); change(control(root, 'Number of sample instants'), '4'); click(root, 'Reveal sampled model');
    expect(inspect.value).toBe('3'); expect(root.textContent).toContain('Sample k = 3');
    change(inspect, '0e-400'); click(root, 'Reveal sampled model');
    expect(inspect.value).toBe('0'); expect(root.textContent).toContain('Sample k = 0');
    expect(root.querySelectorAll('.zoh-plot svg')).toHaveLength(2);
  });
  it('does not treat browser-reported bad numeric prediction input as an omitted guess', () => {
    const root = open(), prediction = control(root, 'Your prediction for y[1] (optional)') as HTMLInputElement;
    // Native browsers can retain an invalid visible edit with empty value and
    // badInput=true; setting .value programmatically cannot create that state.
    const validity = vi.spyOn(prediction, 'validity', 'get').mockReturnValue({ badInput: true } as ValidityState);
    click(root, 'Reveal sampled model');
    expect(root.textContent).toContain('as a finite number');
    expect(root.querySelector('[aria-label="Zero-state pulse transfer function"]')).toBeNull();
    validity.mockRestore(); click(root, 'Reveal sampled model');
    expect(outputValues(root)[1]).toBe('0.09516258');
  });
  it('reopen restores the baseline and cleanup removes owned controls', () => {
    const root = open(); click(root, 'Delayed 5/s²'); controller.abort(); if (typeof cleanup === 'function') cleanup(); expect(root.children.length).toBe(0);
    const next = open(); click(next, 'Reveal sampled model'); expect(control(next, 'Input delay m (whole samples)').value).toBe('0'); expect(outputValues(next)[1]).toBe('0.09516258');
  });
  it('omits unreliable scalar equations while retaining the state model and trajectory', () => {
    const root = open(), field = root.querySelector<HTMLInputElement>('[aria-label="Continuous rational plant"]')!;
    change(field, '1/((s-60)(s+.01))'); change(control(root, 'Sample period T (s)'), '1');
    change(control(root, 'Number of sample instants'), '4'); change(control(root, 'Drawing subdivisions per interval'), '16');
    change(control(root, 'Amplitude A (ramp: units/s)'), '1e-70'); click(root, 'Reveal sampled model');
    expect(root.textContent).toContain('Scalar transfer and recurrence unavailable');
    expect(root.querySelector('.zoh-notice[role="status"]')!.textContent).toContain('Scalar transfer and recurrence are unavailable');
    expect(root.querySelector('[aria-label="Zero-state pulse transfer function"]')).toBeNull();
    expect(root.querySelector('[aria-label="Zero-state scalar recurrence"]')).toBeNull();
    expect(root.querySelector('[aria-label="Sampled state recurrence"]')).not.toBeNull();
    expect(outputValues(root)).toHaveLength(4); expect(Number(outputValues(root)[3])).toBeGreaterThan(1e4);
    change(control(root, 'Sample period T (s)'), '.1'); click(root, 'Reveal sampled model');
    expect(root.textContent).not.toContain('Scalar transfer and recurrence unavailable');
    expect(root.querySelector('[aria-label="Zero-state pulse transfer function"]')).not.toBeNull();
  });
});


it('preserves native exponent entry, intentional zero and integer checks through the shared reader', () => {
  const root = open(); change(control(root, 'Sample period T (s)'), '1e-2'); change(control(root, 'Amplitude A (ramp: units/s)'), '0e-999');
  change(control(root, 'Number of sample instants'), '4e0'); click(root, 'Reveal sampled model'); expect(outputValues(root)).toEqual(['0', '0', '0', '0']);
  change(control(root, 'Number of sample instants'), '4.5'); click(root, 'Reveal sampled model'); expect(root.textContent).toContain('integer from 4 to 120'); expect(root.querySelector('[aria-label="Zero-state pulse transfer function"]')).toBeNull();
});

describe('live sampling clock with deliberate Practice', () => {
  it('opens on an actual baseline with separately labelled controls and native axes', () => {
    const root = open('explore', 'window');
    expect(root.querySelector('[aria-label="Sampling workspace"]')?.getAttribute('data-state')).toBe('preview');
    expect(outputValues(root).slice(0, 4)).toEqual(['0', '0.09516258', '0.1812692', '0.2591818']);
    expect(root.querySelectorAll('.zoh-chart')).toHaveLength(2);
    expect(root.querySelectorAll('svg text')).toHaveLength(0);
    expect(root.querySelectorAll('.zoh-y-scale span')).toHaveLength(6);
    const period = control(root, 'Sample period T (s)'), range = root.querySelector('[aria-label="Slide sample period T (log scale)"]')!;
    expect(period.closest('label')).not.toBe(range.closest('label'));
    expect(root.querySelectorAll('[aria-label="Exact ZOH identity with numerical matrices"]')).toHaveLength(0);
    const workspace = root.querySelector('[aria-label="Sampling workspace"]')!, periodBar = root.querySelector('[aria-label="Live sample period controls"]')!;
    const firstPlot = root.querySelector('.zoh-plot')!, secondPlot = root.querySelectorAll('.zoh-plot')[1];
    expect(periodBar.querySelector('[aria-label="Sample period T (s)"]')).not.toBeNull(); expect(periodBar.querySelector('[aria-label="Inspect sample k"]')).toBeNull();
    expect(periodBar.compareDocumentPosition(firstPlot) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(secondPlot.compareDocumentPosition(control(root, 'Inspect sample k')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(firstPlot.compareDocumentPosition(workspace.querySelector('.zoh-notice')!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(root.querySelector('.zoh-visual h3')).toBeNull();
  });
  it('coalesces edits and moves physical clock spacing while retaining the same three-second window', () => {
    vi.useFakeTimers(); const root = open('explore', 'window'), solver = vi.spyOn(mathematics, 'run');
    const before = Number(root.querySelector('.zoh-cursor')?.getAttribute('x1'));
    change(control(root, 'Sample period T (s)'), '.05'); change(control(root, 'Sample period T (s)'), '.2');
    expect(solver).not.toHaveBeenCalled();
    expect(root.textContent).toContain('previous preview');
    const pending = root.querySelector('.zoh-preview-state')!, firstPlot = root.querySelector('.zoh-plot')!;
    expect(pending.textContent).toBe('Updating · previous preview'); expect(pending.nextElementSibling).toBe(firstPlot);
    vi.advanceTimersByTime(59); expect(solver).not.toHaveBeenCalled(); vi.advanceTimersByTime(1);
    expect(solver).toHaveBeenCalledOnce();
    expect(pending.textContent).toBe('Live preview');
    expect(outputValues(root)).toHaveLength(16);
    expect(outputValues(root)[1]).toBe('0.1812692');
    expect(root.querySelector('.zoh-clock-summary')?.textContent).toContain('visible 0–3 s · computed 0–3 s');
    expect(Number(root.querySelector('.zoh-cursor')?.getAttribute('x1')) - 8).toBeCloseTo(2 * (before - 8), 10);
  });
  it('links integer cursor, range and nearest plotted sample without recomputing the model', () => {
    const root = open('explore', 'window'), solver = vi.spyOn(mathematics, 'run');
    const index = control(root, 'Inspect sample k') as HTMLInputElement; index.focus(); change(index, '2');
    expect(document.activeElement).toBe(index); expect(root.textContent).toContain('Sample k = 2, t = 0.2 s');
    const cursor = root.querySelector<HTMLInputElement>('[aria-label="Sampling clock cursor"]')!; change(cursor, '0');
    expect(root.textContent).toContain('Sample k = 0, t = 0 s');
    vi.spyOn(SVGElement.prototype, 'getBoundingClientRect').mockReturnValue({ left: 0, width: 510 } as DOMRect);
    root.querySelector('svg')!.dispatchEvent(new MouseEvent('click', { clientX: 57.4, bubbles: true }));
    expect(index.value).toBe('3'); expect(root.textContent).toContain('Sample k = 3, t = 0.3 s'); expect(solver).not.toHaveBeenCalled();
  });
  it('keeps fixed-m and fixed-physical-delay experiments mathematically distinct', () => {
    vi.useFakeTimers(); const root = open('explore', 'window'); click(root, 'Delayed 5/s²'); vi.advanceTimersByTime(60);
    expect(outputValues(root).slice(0, 4)).toEqual(['0', '0', '0.1', '0.4']); expect(root.textContent).toContain('τ=0.2 s');
    click(root, 'Halve T, preserve physical delay'); vi.advanceTimersByTime(60);
    expect(control(root, 'Input delay m (whole samples)').value).toBe('2'); expect(control(root, 'Sample period T (s)').value).toBe('0.1');
    expect(outputValues(root)).toHaveLength(61); expect(outputValues(root)[4]).toBe('0.1'); expect(outputValues(root)[6]).toBe('0.4'); expect(root.textContent).toContain('τ=0.2 s');
    change(control(root, 'Sample period T (s)'), '.2'); vi.advanceTimersByTime(60);
    expect(control(root, 'Input delay m (whole samples)').value).toBe('2'); expect(root.textContent).toContain('τ=0.4 s');
    change(control(root, 'Input delay m (whole samples)'), '7'); vi.advanceTimersByTime(60); click(root, 'Halve T, preserve physical delay');
    expect(control(root, 'Input delay m (whole samples)').value).toBe('7'); expect(control(root, 'Sample period T (s)').value).toBe('.2'); expect(root.textContent).toContain('integer 2m from 0 to 12');
  });
  it('does not hide the window budget or silently shrink the original fixed-count domain', () => {
    vi.useFakeTimers(); const root = open('explore', 'window');
    change(control(root, 'Sample period T (s)'), '.001'); vi.advanceTimersByTime(60);
    expect(root.textContent).toContain('3001 sample instants'); expect(root.querySelectorAll('.zoh-chart')).toHaveLength(0);
    expect(root.querySelector('.zoh-visual .zoh-warning')!.textContent).toContain('3001 sample instants');
    change(control(root, 'Time window policy'), 'count'); change(control(root, 'Number of sample instants'), '4'); change(control(root, 'Sample period T (s)'), '10'); change(control(root, 'Physical time window (s)'), ''); vi.advanceTimersByTime(60);
    expect(outputValues(root)).toHaveLength(4); expect(root.textContent).toContain('computed 0–30 s');
    change(control(root, 'Sample period T (s)'), '0.0001'); change(control(root, 'Number of sample instants'), '120'); vi.advanceTimersByTime(60);
    expect(outputValues(root)).toHaveLength(120); expect(root.textContent).toContain('computed 0–0.0119 s');
  });
  it('withholds outputs, ranges, errors and matrices in Practice while material warnings remain visible', () => {
    vi.useFakeTimers(); const root = open('explore', 'window');
    change(control(root, 'Learning mode'), 'practice');
    expect(root.querySelectorAll('.zoh-chart')).toHaveLength(0); expect(outputValues(root)).toHaveLength(0);
    change(control(root, 'Time window policy'), 'count'); change(control(root, 'Number of sample instants'), '4');
    change(root.querySelector<HTMLInputElement>('[aria-label="Continuous rational plant"]')!, '1/(s-1)');
    change(control(root, 'Sample period T (s)'), '1'); change(control(root, 'Compare interval approximation'), 'backward'); vi.advanceTimersByTime(60);
    expect(root.querySelectorAll('.zoh-chart')).toHaveLength(1); expect(root.textContent).toContain('Approximation unavailable'); expect(root.textContent).toContain('singular');
    expect(root.querySelector('[aria-label="Output arithmetic"]')).toBeNull(); expect(outputValues(root)).toHaveLength(0); expect(root.textContent).not.toContain('Maximum sampled output difference');
    click(root, 'Reveal sampled model'); expect(outputValues(root)[3]).toBe('19.08554');
    change(control(root, 'Sample period T (s)'), '.5'); expect(outputValues(root)).toHaveLength(0); expect(root.querySelector('[aria-label="Output arithmetic"]')).toBeNull();
  });
  it('revokes old Practice grading without discarding a valid checked response', () => {
    const root = open(); const guess = control(root, 'Your prediction for y[1] (optional)');
    change(guess, '.095162581964'); click(root, 'Reveal sampled model'); expect(root.textContent).toContain('Prediction matched');
    change(guess, '1'); expect(root.textContent).not.toContain('Prediction matched'); expect(root.textContent).toContain('Prediction edited. Reveal again');
    expect(outputValues(root)[1]).toBe('0.09516258'); expect(root.querySelector('[aria-label="Sampling workspace"]')?.getAttribute('data-state')).toBe('checked');
  });
  it('declares pulse/ramp timing and keeps coarse/delay warnings outside optional depth', () => {
    vi.useFakeTimers(); const root = open('practice', 'count');
    change(control(root, 'Held input sequence'), 'pulse'); expect(root.textContent).toContain('width=T and signed area=A·T change');
    change(control(root, 'Held input sequence'), 'ramp'); expect(root.textContent).toContain('held staircase');
    change(control(root, 'Held input sequence'), 'step'); change(control(root, 'Number of sample instants'), '4'); change(control(root, 'Input delay m (whole samples)'), '3');
    change(root.querySelector<HTMLInputElement>('[aria-label="Continuous rational plant"]')!, '1/(s+4)'); change(control(root, 'Sample period T (s)'), '1'); change(control(root, 'Drawing subdivisions per interval'), '2'); vi.advanceTimersByTime(60);
    const warning = [...root.querySelectorAll('.zoh-warning')].find(node => node.textContent?.includes('No full held interval'))!;
    expect(warning).toBeDefined(); expect(warning.textContent).toContain('underresolve'); expect(warning.closest('details')).toBeNull(); expect(outputValues(root)).toHaveLength(0);
  });
  it('retains true off-window samples without clamping their cursor onto the plot edge', () => {
    vi.useFakeTimers(); const root = open('explore', 'window');
    change(control(root, 'Physical time window (s)'), '1'); change(control(root, 'Sample period T (s)'), '.3'); vi.advanceTimersByTime(60);
    expect(outputValues(root)).toHaveLength(5); change(control(root, 'Inspect sample k'), '4');
    expect(root.textContent).toContain('Sample k = 4, t = 1.2 s'); expect(root.textContent).toContain('beyond the fixed display window');
    expect(root.querySelector('.zoh-cursor')?.getAttribute('visibility')).toBe('hidden');
  });
  it('cancels the pending coalesced preview on direct cleanup with the parent still active', () => {
    vi.useFakeTimers(); const root = open('explore', 'window'), solver = vi.spyOn(mathematics, 'run');
    change(control(root, 'Sample period T (s)'), '.2'); expect(vi.getTimerCount()).toBe(1);
    if (typeof cleanup === 'function') cleanup(); expect(controller.signal.aborted).toBe(false); expect(root.children).toHaveLength(0);
    vi.advanceTimersByTime(120); expect(solver).not.toHaveBeenCalled(); expect(vi.getTimerCount()).toBe(0);
  });
  it('aborts a partially mounted editor resource while the parent remains active', () => {
    const root = document.createElement('div'), parent = new AbortController(); editorState.fail = true;
    expect(() => mount({ container: root, signal: parent.signal })).toThrow('Synthetic editor failure');
    expect(parent.signal.aborted).toBe(false); expect(editorState.aborts).toBe(1); expect(root.children).toHaveLength(0);
    window.dispatchEvent(new Event('dr05-partial-editor-resource')); expect(editorState.probes).toBe(0); parent.abort();
  });
});
