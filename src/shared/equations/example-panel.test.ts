import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EquationDraft, EquationInputOptions } from './input';
import { mountExamplePanel } from './example-panel';
import { findEquationExample } from './examples';

interface MockField {
  readonly field: HTMLTextAreaElement;
  readonly options: EquationInputOptions;
  readonly destroy: ReturnType<typeof vi.fn>;
  readonly focus: ReturnType<typeof vi.fn>;
}

const fields = vi.hoisted(() => ({ created: [] as MockField[] }));

// Exercise the panel's draft/lifecycle contract without importing MathLive or
// asserting its own typesetting and editor internals in jsdom.
vi.mock('./input', () => ({
  createEquationDisplay: (latex: string, label: string) => {
    const display = document.createElement('div');
    display.setAttribute('role', 'math');
    display.setAttribute('aria-label', label);
    display.dataset.latex = latex;
    display.textContent = latex;
    return display;
  },
  createEquationInput: (options: EquationInputOptions) => {
    const element = document.createElement('div');
    element.className = 'mock-equation-input';
    const field = document.createElement('textarea');
    field.setAttribute('aria-label', options.label);
    field.value = options.value;
    element.append(field);
    let destroyed = false;
    const getValue = (): EquationDraft => ({
      latex: field.value, empty: !field.value.trim(), hasPlaceholders: false, syntaxIssues: [],
    });
    const change = () => options.onChange?.(getValue());
    field.addEventListener('input', change);
    const destroy = vi.fn(() => {
      if (destroyed) return;
      destroyed = true;
      options.signal.removeEventListener('abort', destroy);
      field.removeEventListener('input', change);
      element.remove();
    });
    const focus = vi.fn(() => { if (!destroyed) field.focus(); });
    options.signal.addEventListener('abort', destroy, { once: true });
    if (options.signal.aborted) destroy();
    fields.created.push({ field, options, destroy, focus });
    return {
      element, getValue, focus, destroy,
      setValue: (latex: string) => { if (!destroyed) field.value = latex; },
    };
  },
}));

describe('equation example panel', () => {
  const visits: { root: HTMLElement; controller: AbortController; dispose: () => void }[] = [];

  beforeEach(() => { fields.created.length = 0; });
  afterEach(() => {
    for (const visit of visits.splice(0)) {
      visit.dispose(); visit.controller.abort(); visit.root.remove();
    }
  });

  function open(id = 'CD02', fallback = 'Fallback example', alreadyAborted = false) {
    const root = document.createElement('section');
    document.body.append(root);
    const controller = new AbortController();
    if (alreadyAborted) controller.abort();
    const dispose = mountExamplePanel(root, id, fallback, controller.signal);
    const visit = { root, controller, dispose };
    visits.push(visit);
    return visit;
  }

  function toggle(root: HTMLElement): HTMLButtonElement {
    const button = root.querySelector<HTMLButtonElement>('.equation-edit');
    expect(button).not.toBeNull();
    button!.click();
    return button!;
  }

  function displays(root: HTMLElement): string[] {
    return Array.from(root.querySelectorAll<HTMLElement>('[role="math"]'), item => item.dataset.latex!);
  }

  function edit(field: HTMLTextAreaElement, value: string): void {
    field.value = value;
    field.dispatchEvent(new Event('input', { bubbles: true }));
  }

  it('starts with typeset baseline equations and opens labelled inputs only on request', () => {
    const { root } = open();
    const baseline = findEquationExample('CD02')!.parts.filter(part => part.kind === 'math');
    expect(root.querySelector('h2')?.textContent).toBe('Default example');
    expect(displays(root)).toEqual(baseline.map(part => part.latex));
    expect(fields.created).toHaveLength(0);
    expect(root.querySelector<HTMLParagraphElement>('.equation-preview-note')?.hidden).toBe(true);

    const button = toggle(root);
    expect(button.textContent).toBe('Done editing');
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(displays(root)).toHaveLength(0);
    expect(fields.created.map(item => item.options.label)).toEqual(baseline.map(part => part.label));
    expect(fields.created.map(item => item.field.value)).toEqual(baseline.map(part => part.latex));
    expect(fields.created[0].focus).toHaveBeenCalledOnce();
    expect(document.activeElement).toBe(fields.created[0].field);
    expect(root.querySelector<HTMLParagraphElement>('.equation-preview-note')?.hidden).toBe(false);
    expect(root.querySelector('.equation-preview-note')?.textContent)
      .toBe('Equation preview only. Changes do not update the workspace.');
  });

  it('keeps changed drafts after Done and when editing again, without changing immutable baselines', () => {
    const { root } = open();
    const baseline = findEquationExample('CD02')!;
    const originalPlant = baseline.parts[0];
    const changedPlant = String.raw`G(s)=\frac{3}{s(s+4)}`;
    toggle(root);
    const originalInputs = [...fields.created];
    edit(originalInputs[0].field, changedPlant);
    expect(root.querySelector('h2')?.textContent).toBe('Example input');

    const button = toggle(root);
    expect(button.textContent).toBe('Edit equations');
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(displays(root)[0]).toBe(changedPlant);
    expect(root.querySelector<HTMLParagraphElement>('.equation-preview-note')?.hidden).toBe(false);
    for (const input of originalInputs) expect(input.destroy).toHaveBeenCalledOnce();

    toggle(root);
    const reopenedInputs = fields.created.slice(originalInputs.length);
    expect(reopenedInputs[0].field.value).toBe(changedPlant);
    expect(baseline.parts[0]).toBe(originalPlant);
    expect(originalPlant.kind === 'math' && originalPlant.latex).toBe(String.raw`G(s)=\frac{1}{s(s+2)}`);
  });

  it('preserves exercise prose in display and edit modes, including unchanged edit sessions', () => {
    const { root } = open('CP01');
    const prose = 'Unit-step input. Initial state: zero.';
    expect(root.querySelector('.equation-context')?.textContent).toBe(prose);
    toggle(root);
    expect(root.querySelector('.equation-context')?.textContent).toBe(prose);
    toggle(root);
    expect(root.querySelector('.equation-context')?.textContent).toBe(prose);
    expect(root.querySelector('h2')?.textContent).toBe('Default example');
    expect(root.querySelector<HTMLParagraphElement>('.equation-preview-note')?.hidden).toBe(true);
  });

  it('keeps separate panels independent and restores the seed on a fresh visit', () => {
    const first = open();
    const second = open();
    toggle(first.root);
    edit(fields.created[0].field, 'G(s)=5');
    toggle(first.root);
    expect(displays(first.root)[0]).toBe('G(s)=5');
    expect(displays(second.root)[0]).toBe(String.raw`G(s)=\frac{1}{s(s+2)}`);
    expect(second.root.querySelector('h2')?.textContent).toBe('Default example');
    first.dispose();
    const fresh = open();
    expect(displays(fresh.root)).toEqual(displays(second.root));
    expect(fresh.root.querySelector('h2')?.textContent).toBe('Default example');
  });

  it.each(['abort', 'dispose'] as const)('releases active inputs once on %s and leaves no panel DOM', method => {
    const visit = open();
    toggle(visit.root);
    const created = [...fields.created];
    if (method === 'abort') visit.controller.abort(); else visit.dispose();
    expect(visit.root.childElementCount).toBe(0);
    for (const input of created) expect(input.destroy).toHaveBeenCalledOnce();
    visit.dispose(); visit.controller.abort();
    expect(visit.root.childElementCount).toBe(0);
    for (const input of created) expect(input.destroy).toHaveBeenCalledOnce();
  });

  it('does not create new inputs through a retained edit button after disposal', () => {
    const visit = open();
    const button = visit.root.querySelector<HTMLButtonElement>('.equation-edit')!;
    visit.dispose();
    button.click();
    expect(fields.created).toHaveLength(0);
    expect(visit.root.childElementCount).toBe(0);
  });

  it('does not mount a known example after its visit has already been aborted', () => {
    const visit = open('CD02', 'Fallback example', true);
    expect(visit.root.childElementCount).toBe(0);
    expect(fields.created).toHaveLength(0);
  });

  it('shows unknown example fallback as text with no pretend equation editor', () => {
    const fallback = '<script>literal text only</script>';
    const visit = open('UNKNOWN', fallback);
    expect(visit.root.querySelector('.example-value')?.textContent).toBe(fallback);
    expect(visit.root.querySelector('script')).toBeNull();
    expect(visit.root.querySelector('button')).toBeNull();
    expect(fields.created).toHaveLength(0);
    visit.dispose();
    expect(visit.root.childElementCount).toBe(0);
  });

  it('honors visit cancellation for fallback content too', () => {
    const active = open('UNKNOWN');
    active.controller.abort();
    expect(active.root.childElementCount).toBe(0);
    const stale = open('UNKNOWN', 'Fallback', true);
    expect(stale.root.childElementCount).toBe(0);
  });
});
