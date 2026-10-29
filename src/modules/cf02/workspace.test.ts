import { afterEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  created: 0, destroyed: 0, fail: false,
  beforeThrow: undefined as ((signal: AbortSignal) => void) | undefined,
  onCreated: undefined as ((signal: AbortSignal) => void) | undefined,
}));
vi.mock('../../shared/equations/input', () => ({
  createEquationInput: (options: { label: string; value: string; signal: AbortSignal; onChange: () => void }) => {
    if (state.fail) { state.beforeThrow?.(options.signal); throw Error('Mock equation control failure'); }
    state.created++;
    const element = document.createElement('div'), input = document.createElement('input'); input.type = 'text'; input.value = options.value; input.setAttribute('aria-label', options.label); element.append(input);
    input.addEventListener('input', options.onChange, { signal: options.signal });
    let destroyed = false;
    const editor = { element, getValue: () => ({ latex: input.value, empty: !input.value, hasPlaceholders: input.value.includes('placeholder'), syntaxIssues: [] }),
      setValue: (value: string) => { input.value = value; }, focus: () => input.focus(), destroy: () => { if (!destroyed) { destroyed = true; state.destroyed++; element.remove(); } } };
    state.onCreated?.(options.signal); return editor;
  },
  createEquationDisplay: (latex: string, label: string) => { const node = document.createElement('div'); node.setAttribute('aria-label', label); node.textContent = latex; return node; },
}));
import { mount } from './workspace';

const cleanups: (() => void)[] = [];
afterEach(() => { cleanups.splice(0).forEach(fn => fn()); document.body.replaceChildren(); state.fail = false; state.beforeThrow = state.onCreated = undefined; });
async function open() {
  const controller = new AbortController(), container = document.createElement('div'); document.body.append(container);
  const cleanup = mount({ container, signal: controller.signal }); cleanups.push(() => { controller.abort(); if (typeof cleanup === 'function') cleanup(); });
  await vi.waitFor(() => expect(container.textContent).not.toContain('Equation controls are loading.'));
  return { controller, container, cleanup };
}
function field(container: HTMLElement, text: string): HTMLInputElement | HTMLSelectElement {
  const direct = container.querySelector(`[aria-label="${text}"]`); if (direct) return direct as HTMLInputElement;
  const label = [...container.querySelectorAll('label')].find(node => node.firstChild?.textContent === text);
  if (!label) throw Error(`No label ${text}`); return label.querySelector('input,select')!;
}
function edit(container: HTMLElement, text: string, value: string) { const node = field(container, text); node.value = value; node.dispatchEvent(new Event('input', { bubbles: true })); node.dispatchEvent(new Event('change', { bubbles: true })); }
function submit(container: HTMLElement) { container.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true })); }
function result(container: HTMLElement) { return container.textContent ?? ''; }

describe('CF02 workspace state and lifecycle (mock editor; real browser separately required)', () => {
  it('reveals a derived baseline and evaluates the prediction', async () => {
    const { container } = await open(); expect(result(container)).not.toContain('Finite limit:');
    edit(container, 'Predicted behavior', 'finite'); submit(container);
    expect(result(container)).toContain('prediction agrees'); expect(result(container)).toContain('Finite limit: 1/2');
    expect(result(container)).toContain('Kv2');
    const derived = container.querySelector('[aria-label="Derived selected error transfer function"]')!;
    const constantHeading = [...container.querySelectorAll('h3')].find(h => h.textContent!.startsWith('5. Interpret'))!;
    expect(derived.compareDocumentPosition(constantHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(container.querySelector('svg[role="img"]')).not.toBeNull();
    edit(container, 'Trace horizon (s)', '.1'); submit(container);
    expect(result(container)).toContain('Finite limit: 1/2');
    expect(result(container)).toContain('The chosen horizon does not yet show close agreement');
  });
  it('invalidates old results, changes source and resets all exercise state', async () => {
    const { container } = await open(); submit(container);
    edit(container, 'Experiment', '2'); expect(result(container)).not.toContain('Finite limit:');
    edit(container, 'Error to predict', 'physical'); submit(container);
    expect(result(container)).toContain('Polynomial growth of degree 1');
    const reset = [...container.querySelectorAll('button')].find(b => b.textContent === 'Restore baseline')!; reset.click();
    expect(field(container, 'Sensor gain H (dimensionless)').value).toBe('1');
    expect(field(container, 'Numerator N(s)').value).toBe('4');
    expect(field(container, 'Error to predict').value).toBe('comparator');
    expect(field(container, 'Predicted behavior').value).toBe('none');
    submit(container); expect(result(container)).toContain('Finite limit: 1/2');
  });
  it('clears checked output for empty, unsupported and nonfinite/underflow input', async () => {
    const { container } = await open(); submit(container);
    edit(container, 'Numerator N(s)', ''); submit(container); expect(result(container)).toContain('Complete the numerator'); expect(container.querySelector('svg')).toBeNull();
    edit(container, 'Numerator N(s)', '4e-2'); submit(container); expect(result(container)).toContain('Other symbols');
    edit(container, 'Numerator N(s)', String.raw`2\frac12`); submit(container); expect(result(container)).toContain('Insert +'); expect(container.querySelector('svg')).toBeNull();
    edit(container, 'Numerator N(s)', String.raw`2+\frac12`); submit(container); expect(result(container)).toContain('Finite limit: 4/5');
    edit(container, 'Numerator N(s)', String.raw`2\times\frac12`); submit(container); expect(result(container)).toContain('Finite limit: 2');
    for (const text of [String.raw`(s+1)2\frac12`, String.raw`s\mathrm{2}\frac12+1`, String.raw`\frac{s2\frac12+1}{3}`]) {
      edit(container, 'Numerator N(s)', text); submit(container); expect(result(container)).toContain('Insert +'); expect(container.querySelector('svg')).toBeNull();
    }
    edit(container, 'Numerator N(s)', String.raw`(s+1)2\times\frac12`); submit(container); expect(result(container)).toContain('Finite limit: 2');
    edit(container, 'Numerator N(s)', String.raw`2s\frac12+1`); submit(container); expect(result(container)).toContain('Finite limit: 2');
    edit(container, 'Numerator N(s)', '2{3+4}'); submit(container); expect(result(container)).toContain('Hidden braces'); expect(container.querySelector('svg')).toBeNull();
    edit(container, 'Numerator N(s)', '2(3+4)'); submit(container); expect(result(container)).toContain('Finite limit: 1/7');
    edit(container, 'Numerator N(s)', '4'); edit(container, 'Amplitude A (normalized units)', '1e-999'); submit(container); expect(result(container)).toContain('too small');
    edit(container, 'Amplitude A (normalized units)', '1e-2'); submit(container); expect(result(container)).toContain('Finite limit: 1/200');
    edit(container, 'Amplitude A (normalized units)', '0e-999'); submit(container); expect(result(container)).toContain('Finite limit: 0');
    edit(container, 'Trace horizon (s)', ''); submit(container); expect(result(container)).toContain('finite number');
    edit(container, 'Trace horizon (s)', '121'); submit(container); expect(result(container)).toContain('between 0.1 and 120');
  });
  it('shows an uncertified verdict and supports disturbance and noise experiments', async () => {
    const { container } = await open(); edit(container, 'Experiment', '5'); submit(container);
    expect(result(container)).toContain('Closed loop: unstable'); expect(result(container)).toContain('No certified steady-state limit');
    edit(container, 'Experiment', '6'); edit(container, 'Error to predict', 'physical'); submit(container); expect(result(container)).toContain('Finite limit: -1');
    edit(container, 'Experiment', '7'); edit(container, 'Error to predict', 'physical'); submit(container); expect(result(container)).toContain('Finite limit: 1');
  });
  it('aborts editors and returns a new baseline on a fresh mount', async () => {
    const first = await open(), before = state.destroyed; edit(first.container, 'Numerator N(s)', '8'); submit(first.container);
    expect(result(first.container)).toContain('Finite limit: 1/4'); first.controller.abort();
    expect(first.container.children.length).toBe(0); expect(state.destroyed - before).toBe(2);
    const second = await open(); expect(field(second.container, 'Numerator N(s)').value).toBe('4'); expect(result(second.container)).not.toContain('Finite limit:');
  });
  it('does not append late controls after immediate navigation away', async () => {
    const controller = new AbortController(), container = document.createElement('div'), before = state.created;
    const cleanup = mount({ container, signal: controller.signal }); controller.abort(); if (typeof cleanup === 'function') cleanup();
    await new Promise(resolve => setTimeout(resolve, 0)); expect(container.children.length).toBe(0); expect(state.created).toBe(before);
  });
  it('reports equation initialization failure and preserves a reset/reopen route', async () => {
    state.fail = true; const { container } = await open();
    expect(result(container)).toContain('could not load'); expect(result(container)).toContain('Reset or reopen');
    expect(container.querySelector('button[type="submit"]')!.hasAttribute('disabled')).toBe(true);
    state.fail = false; const next = await open(); submit(next.container); expect(result(next.container)).toContain('Finite limit: 1/2');
  });
  it('removes native listeners and destroys editors on standalone cleanup without aborting its parent', async () => {
    const visit = await open(), before = state.destroyed;
    const form = visit.container.querySelector('form')!, experiment = field(visit.container, 'Experiment'), sensor = field(visit.container, 'Sensor gain H (dimensionless)');
    const activeSubmit = new Event('submit', { cancelable: true }); form.dispatchEvent(activeSubmit);
    expect(activeSubmit.defaultPrevented).toBe(true);
    if (typeof visit.cleanup === 'function') { visit.cleanup(); visit.cleanup(); }
    expect(visit.controller.signal.aborted).toBe(false); expect(state.destroyed - before).toBe(2);
    sensor.value = '7'; experiment.value = '2'; experiment.dispatchEvent(new Event('change'));
    expect(sensor.value).toBe('7');
    const staleSubmit = new Event('submit', { cancelable: true }); form.dispatchEvent(staleSubmit);
    expect(staleSubmit.defaultPrevented).toBe(false);
    expect(visit.container.childElementCount).toBe(0);
    visit.controller.abort(); expect(state.destroyed - before).toBe(2);
  });
  it.each([1, 2])('aborts resources allocated by failing editor %s while preserving active-parent recovery feedback', async failOn => {
    const listener = vi.fn(); let editorSignal: AbortSignal | undefined;
    const beforeCreated = state.created, beforeDestroyed = state.destroyed;
    state.fail = failOn === 1;
    state.onCreated = () => { state.fail = true; };
    state.beforeThrow = signal => {
      editorSignal = signal; document.addEventListener('cf02-partial-editor-resource', listener, { signal });
    };
    const visit = await open();
    expect(visit.controller.signal.aborted).toBe(false); expect(editorSignal).not.toBe(visit.controller.signal);
    expect(editorSignal?.aborted).toBe(true);
    expect(state.created - beforeCreated).toBe(failOn - 1); expect(state.destroyed - beforeDestroyed).toBe(failOn - 1);
    document.dispatchEvent(new Event('cf02-partial-editor-resource')); expect(listener).not.toHaveBeenCalled();
    expect(result(visit.container)).toContain('Reset or reopen');
    const experiment = field(visit.container, 'Experiment'), sensor = field(visit.container, 'Sensor gain H (dimensionless)');
    sensor.value = '7'; experiment.value = '2'; experiment.dispatchEvent(new Event('change'));
    expect(sensor.value).toBe('7');
    expect([...visit.container.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLButtonElement>('form input,form select,form button')].every(control => control.disabled)).toBe(true);
    if (typeof visit.cleanup === 'function') visit.cleanup();
    expect(visit.container.childElementCount).toBe(0);
    expect(state.destroyed - beforeDestroyed).toBe(failOn - 1);
  });
  it.each([1, 2])('releases an editor returned after parent abort during creation %s without reviving controls', async abortOn => {
    const controller = new AbortController(), container = document.createElement('div'); document.body.append(container);
    const beforeCreated = state.created, beforeDestroyed = state.destroyed;
    let created = 0; const signals: AbortSignal[] = [];
    state.onCreated = signal => { signals.push(signal); if (++created === abortOn) controller.abort(); };
    const cleanup = mount({ container, signal: controller.signal });
    cleanups.push(() => { if (typeof cleanup === 'function') cleanup(); });
    const controls = [...container.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLButtonElement>('form input,form select,form button')];
    expect(controls.length).toBeGreaterThan(0); expect(controls.every(control => control.disabled)).toBe(true);
    await vi.dynamicImportSettled();
    expect(state.created - beforeCreated).toBe(abortOn); expect(state.destroyed - beforeDestroyed).toBe(abortOn);
    expect(signals.every(signal => signal.aborted)).toBe(true); expect(container.childElementCount).toBe(0);
    expect(controls.every(control => control.disabled)).toBe(true);
    if (typeof cleanup === 'function') { cleanup(); cleanup(); }
    expect(state.destroyed - beforeDestroyed).toBe(abortOn);
  });
  it('does not allocate an already-aborted visit', () => {
    const controller = new AbortController(), container = document.createElement('div'), before = state.created; controller.abort();
    expect(mount({ container, signal: controller.signal })).toBeUndefined();
    expect(container.childElementCount).toBe(0); expect(state.created).toBe(before);
  });
});
