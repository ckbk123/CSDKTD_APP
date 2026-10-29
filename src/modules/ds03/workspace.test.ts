import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EquationInputOptions } from '../../shared/equations/input';
import { mount } from './workspace';
import * as ui from './ui';

// Tests caller-owned drafts and lifecycle only. Interactive MathLive needs browser QA.
vi.mock('../../shared/equations/input', () => ({
  createEquationDisplay: (latex: string, label: string) => {
    const out = document.createElement('div'); out.textContent = latex; out.setAttribute('aria-label', label); return out;
  },
  createEquationInput: (options: EquationInputOptions) => {
    const element = document.createElement('div'), field = document.createElement('textarea');
    field.value = options.value; field.setAttribute('aria-label', options.label); element.append(field);
    const getValue = () => ({ latex: field.value, empty: !field.value.trim(), syntaxIssues: [], hasPlaceholders: field.value.includes('placeholder') });
    field.addEventListener('input', () => options.onChange?.(getValue()), { signal: options.signal });
    const destroy = () => element.remove(); options.signal.addEventListener('abort', destroy, { once: true });
    return { element, getValue, setValue: (value: string) => { field.value = value; }, destroy, focus: () => field.focus() };
  },
}));

const visits: { controller: AbortController; dispose: () => void; container: HTMLElement }[] = [];
afterEach(() => { for (const v of visits.splice(0)) { v.controller.abort(); v.dispose(); v.container.remove(); } vi.restoreAllMocks(); });
async function open(abortImmediately = false) {
  const controller = new AbortController(), container = document.createElement('div'); container.dataset.module = 'DS03'; document.body.append(container);
  const dispose = mount({ container, signal: controller.signal }) as () => void;
  const visit = { controller, container, dispose }; visits.push(visit);
  if (abortImmediately) controller.abort();
  await vi.dynamicImportSettled(); return visit;
}
function click(root: HTMLElement, text: string) {
  const button = Array.from(root.querySelectorAll('button')).find(b => b.textContent === text);
  expect(button, text).toBeDefined(); button!.click();
}
function edit(field: HTMLInputElement | HTMLTextAreaElement, value: string) { field.value = value; field.dispatchEvent(new Event('input', { bubbles: true })); }

describe('DS03 exercise and visit state', () => {
  it('keeps the derivation hidden until checking, then reveals a computed strict interval', async () => {
    const { container } = await open();
    expect(container.textContent).not.toContain('0 < K < 2.5');
    container.querySelector('select')!.value = 'strictly stable';
    click(container, 'Check and reveal'); expect(container.textContent).toContain('Step 1 of 5');
    click(container, 'Next derivation step'); expect(container.textContent).toContain('A = 1.2');
    click(container, 'Reveal all steps'); expect(container.textContent).toContain('0 < K < 2.5');
    click(container, 'Inspect upper endpoint (2.5)');
    expect(container.textContent).toContain('Computed check: at K = 2.5');
    expect(container.textContent).toContain('∞ (z = −1)'); expect(container.textContent).toContain('A is zero or near zero');
    expect(container.textContent).toContain('z2 = -0.5');
  });
  it('computes the changed coefficient experiment and clears stale results on edits/errors', async () => {
    const { container } = await open(); click(container, 'Try 0.1K variation'); click(container, 'Check and reveal'); click(container, 'Reveal all steps');
    expect(container.textContent).toContain('0 < K < 2.222222');
    edit(container.querySelector('textarea')!, 'z^2+K^2'); expect(container.textContent).not.toContain('Step 5 of 5');
    expect(container.querySelectorAll('.ds-root')).toHaveLength(0);
    click(container, 'Check and reveal'); expect(container.textContent).toContain('nonlinear gain terms are unsupported');
    expect(container.querySelectorAll('.ds-root')).toHaveLength(0);
  });
  it('rejects empty/out-of-range gain and unfinished equation drafts', async () => {
    const { container } = await open(); const k = container.querySelector('input')!;
    edit(k, ''); click(container, 'Check and reveal'); expect(container.textContent).toContain('Selected gain K as a finite number');
    edit(k, '101'); click(container, 'Check and reveal'); expect(container.textContent).toContain('finite gain K');
    edit(k, '0'); edit(container.querySelector('textarea')!, ''); click(container, 'Check and reveal'); expect(container.textContent).toContain('Complete the visual polynomial');
  });
  it('exposes the exceptional mapping point and rejects malformed point input', async () => {
    const { container } = await open(); const angle = container.querySelectorAll('input')[1];
    edit(angle, '180'); expect(container.textContent).toContain('w is at infinity');
    edit(angle, ''); expect(container.textContent).toContain('Unit-circle angle θ (degrees) as a finite number');
    edit(container.querySelectorAll('input')[3], '6'); expect(container.textContent).toContain('finite real and imaginary');
  });
  it.each(['1e-999', '-1e-999'])('rejects nonzero native gain underflow %s without revealing zero-gain results', async raw => {
    const { container } = await open(); click(container, 'Check and reveal');
    const gain = container.querySelector('input')!;
    edit(gain, raw);
    expect(container.textContent).toContain('nonzero but too small');
    expect(container.querySelector('[aria-label="Checked derivation"]')!.textContent).toBe('');
    click(container, 'Check and reveal');
    expect(container.textContent).toContain('Selected gain K is nonzero but too small');
    expect(container.querySelector('[aria-label="Checked derivation"]')!.textContent).toBe('');
  });
  it('accepts native zero and exponent gains without changing the visual parser grammar', async () => {
    const { container } = await open(); const gain = container.querySelector('input')!;
    for (const raw of ['0e-999', '-0']) {
      edit(gain, raw); click(container, 'Check and reveal');
      expect(container.querySelector('[aria-label="Checked derivation"]')!.textContent).toContain('at K = 0,');
    }
    edit(gain, '1e-2'); click(container, 'Check and reveal');
    expect(container.querySelector('[aria-label="Checked derivation"]')!.textContent).toContain('at K = 0.01,');
    edit(container.querySelector('textarea')!, 'z^2+1e-2Kz+0.5'); click(container, 'Check and reveal');
    expect(container.querySelector('[aria-label="Checked derivation"]')!.textContent).toBe('');
  });
  it('rejects angle underflow instead of silently mapping it to zero degrees', async () => {
    const { container } = await open(); const angle = container.querySelectorAll('input')[1];
    const previous = container.querySelector('.ds-planes')!.parentElement!.textContent;
    edit(angle, '1e-999');
    expect(container.textContent).toContain('Unit-circle angle θ (degrees) is nonzero but too small');
    expect(container.querySelector('.ds-planes')!.parentElement!.textContent).toBe(previous);
    edit(angle, '0e-999');
    expect(container.textContent).toContain('Selected z = 1; |z| = 1. w = 0.');
  });
  it('rejects coordinate underflow without changing the selected point or inventing infinity', async () => {
    const { container } = await open(); const controls = container.querySelectorAll('input');
    edit(controls[3], '-1');
    const previous = container.querySelector('.ds-planes')!.parentElement!.textContent;
    edit(controls[4], '1e-999');
    expect(container.textContent).toContain('Selected Im z is nonzero but too small');
    expect(container.querySelector('.ds-planes')!.parentElement!.textContent).toBe(previous);
    expect(container.textContent).not.toContain('w is at infinity: z = −1');
    edit(controls[4], '1'); edit(controls[3], '-1e-999');
    expect(container.textContent).toContain('Selected Re z is nonzero but too small');
    edit(controls[3], '1e-2'); edit(controls[4], '0e-999');
    expect(container.textContent).toContain('Selected z = 0.01;');
    expect(container.querySelector('.ds-section [role="status"]')!.textContent).toBe('');
  });
  it('shows the reviewed near-pole value without turning it into a boundary point', async () => {
    const { container } = await open();
    edit(container.querySelectorAll('input')[3], '-1');
    edit(container.querySelectorAll('input')[4], '0.00000001');
    expect(container.textContent).toContain('w = 1 + 200000000j.');
    expect(container.textContent).toContain('outside this view');
  });
  it('checks a prediction and uses the original roots for zero-row cases', async () => {
    const { container } = await open();
    edit(container.querySelector('textarea')!, 'z^2+Kz+1'); edit(container.querySelector('input')!, '0');
    container.querySelector('select')!.value = 'boundary'; click(container, 'Check and reveal'); click(container, 'Reveal all steps');
    expect(container.textContent).toContain('Your prediction agrees'); expect(container.textContent).toContain('auxiliary polynomial');
    expect(container.textContent).toContain('No strictly stable gain');
  });
  it('disposes a loaded visit and restores the baseline on reopening', async () => {
    const a = await open(); click(a.container, 'Try 0.1K variation'); a.controller.abort(); a.dispose();
    expect(a.container.childElementCount).toBe(0);
    const b = await open(); expect(b.container.querySelector('textarea')!.value).toContain('0.2K');
    expect(b.container.textContent).not.toContain('Step 1 of 5');
  });
  it('ignores a local UI import that completes after immediate abort', async () => {
    const { container } = await open(true); expect(container.childElementCount).toBe(0);
  });
  it('aborts resources allocated before a mount failure while its parent remains active', async () => {
    const listener = vi.fn(); let childSignal: AbortSignal | undefined;
    vi.spyOn(ui, 'mountUI').mockImplementationOnce(({ container, signal }) => {
      childSignal = signal; document.addEventListener('ds03-partial-resource', listener, { signal });
      container.append(document.createElement('section'));
      throw new Error('Failure after resource allocation');
    });
    const { container, controller, dispose } = await open();
    expect(controller.signal.aborted).toBe(false); expect(childSignal).not.toBe(controller.signal);
    expect(childSignal?.aborted).toBe(true);
    document.dispatchEvent(new Event('ds03-partial-resource')); expect(listener).not.toHaveBeenCalled();
    expect(container.querySelector('section')).toBeNull();
    expect(container.querySelector('[role="status"]')!.textContent).toContain('Reset the tool to try again');
    dispose(); dispose(); expect(container.childElementCount).toBe(0);
  });
  it('aborts standalone signal resources and calls the loaded disposer only once', async () => {
    const listener = vi.fn(), release = vi.fn(); let childSignal: AbortSignal | undefined;
    vi.spyOn(ui, 'mountUI').mockImplementationOnce(({ signal }) => {
      childSignal = signal; document.addEventListener('ds03-loaded-resource', listener, { signal }); return release;
    });
    const { container, controller, dispose } = await open();
    document.dispatchEvent(new Event('ds03-loaded-resource')); expect(listener).toHaveBeenCalledOnce();
    dispose(); dispose();
    expect(controller.signal.aborted).toBe(false); expect(childSignal?.aborted).toBe(true);
    document.dispatchEvent(new Event('ds03-loaded-resource')); expect(listener).toHaveBeenCalledOnce();
    controller.abort(); expect(release).toHaveBeenCalledOnce(); expect(container.childElementCount).toBe(0);
  });
  it('releases a disposer returned after parent abort during mounting exactly once', async () => {
    const controller = new AbortController(), container = document.createElement('div'), release = vi.fn();
    let childSignal: AbortSignal | undefined;
    vi.spyOn(ui, 'mountUI').mockImplementationOnce(({ signal }) => { childSignal = signal; controller.abort(); return release; });
    const dispose = mount({ container, signal: controller.signal });
    await vi.dynamicImportSettled();
    expect(childSignal?.aborted).toBe(true); expect(release).toHaveBeenCalledOnce();
    if (typeof dispose === 'function') { dispose(); dispose(); }
    expect(release).toHaveBeenCalledOnce(); expect(container.childElementCount).toBe(0);
  });
  it('does not mount after explicit disposal while the import is pending', async () => {
    const controller = new AbortController(), container = document.createElement('div'), mountUI = vi.spyOn(ui, 'mountUI');
    const dispose = mount({ container, signal: controller.signal });
    expect(container.textContent).toContain('Loading the exercise');
    if (typeof dispose === 'function') { dispose(); dispose(); }
    await vi.dynamicImportSettled();
    expect(controller.signal.aborted).toBe(false); expect(mountUI).not.toHaveBeenCalled();
    expect(container.childElementCount).toBe(0); controller.abort();
  });
  it('does not start an already-aborted visit', async () => {
    const controller = new AbortController(), container = document.createElement('div'), mountUI = vi.spyOn(ui, 'mountUI');
    controller.abort(); const dispose = mount({ container, signal: controller.signal });
    await vi.dynamicImportSettled();
    expect(mountUI).not.toHaveBeenCalled(); expect(container.childElementCount).toBe(0);
    if (typeof dispose === 'function') dispose();
  });
  it('preserves focus while stepping with the keyboard and announces the check', async () => {
    const { container } = await open(); click(container, 'Check and reveal');
    const next = () => Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'Next derivation step')!;
    next().focus(); next().click();
    expect(document.activeElement).toBe(next());
    next().click(); next().click(); next().click();
    expect(document.activeElement?.textContent).toBe('Step 5 of 5');
    expect(container.querySelector('[aria-label="Checked derivation"] [role="status"]')?.textContent).toContain('strictly stable');
  });
});
