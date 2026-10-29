import { afterEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ created: 0, destroyed: 0, fail: false }));
vi.mock('../../shared/equations/input', () => ({
  createEquationInput: (options: { label: string; value: string; signal: AbortSignal; onChange: () => void }) => {
    if (state.fail) throw Error('Mock equation control failure');
    state.created++;
    const element = document.createElement('div'), input = document.createElement('input'); input.type = 'text'; input.value = options.value; input.setAttribute('aria-label', options.label); element.append(input);
    input.addEventListener('input', options.onChange, { signal: options.signal });
    let destroyed = false;
    return { element, getValue: () => ({ latex: input.value, empty: !input.value, hasPlaceholders: input.value.includes('placeholder'), syntaxIssues: [] }),
      setValue: (value: string) => { input.value = value; }, focus: () => input.focus(), destroy: () => { if (!destroyed) { destroyed = true; state.destroyed++; element.remove(); } } };
  },
  createEquationDisplay: (latex: string, label: string) => { const node = document.createElement('div'); node.setAttribute('aria-label', label); node.textContent = latex; return node; },
}));
import { mount } from './workspace';

const cleanups: (() => void)[] = [];
afterEach(() => { cleanups.splice(0).forEach(fn => fn()); document.body.replaceChildren(); state.fail = false; });
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
});
