import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EquationInputOptions } from '../../shared/equations/input';
import { mount } from './workspace';

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
afterEach(() => { for (const v of visits.splice(0)) { v.controller.abort(); v.dispose(); v.container.remove(); } });
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
    edit(k, ''); click(container, 'Check and reveal'); expect(container.textContent).toContain('finite gain K');
    edit(k, '101'); click(container, 'Check and reveal'); expect(container.textContent).toContain('finite gain K');
    edit(k, '0'); edit(container.querySelector('textarea')!, ''); click(container, 'Check and reveal'); expect(container.textContent).toContain('Complete the visual polynomial');
  });
  it('exposes the exceptional mapping point and rejects malformed point input', async () => {
    const { container } = await open(); const angle = container.querySelectorAll('input')[1];
    edit(angle, '180'); expect(container.textContent).toContain('w is at infinity');
    edit(angle, ''); expect(container.textContent).toContain('Choose an angle');
    edit(container.querySelectorAll('input')[3], '6'); expect(container.textContent).toContain('finite real and imaginary');
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
