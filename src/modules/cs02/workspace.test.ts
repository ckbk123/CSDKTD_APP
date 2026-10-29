import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ModuleMount } from '../../core/module';
import type { EquationInputOptions } from '../../shared/equations/input';
import { mount } from './workspace';
// Caller state and lifecycle only; real MathLive/browser evidence is separate.
vi.mock('../../shared/equations/input', () => ({
  createEquationDisplay: (latex: string, label: string) => { const node = document.createElement('div'); node.className = 'equation-display'; node.textContent = latex; node.setAttribute('aria-label', label); return node; },
  createEquationInput: (options: EquationInputOptions) => {
    const element = document.createElement('div'), field = document.createElement('textarea'); element.className = 'equation-input'; field.value = options.value; field.setAttribute('aria-label', options.label); element.append(field);
    const getValue = () => ({ latex: field.value, empty: !field.value.trim(), syntaxIssues: [], hasPlaceholders: field.value.includes('placeholder') });
    field.addEventListener('input', () => options.onChange?.(getValue()), { signal: options.signal });
    const destroy = () => element.remove(); options.signal.addEventListener('abort', destroy, { once: true });
    return { element, getValue, setValue: (value: string) => { field.value = value; }, focus: () => field.focus(), destroy };
  },
}));
const visits: { root: HTMLElement; controller: AbortController; dispose: () => void }[] = [];
afterEach(() => { for (const visit of visits.splice(0)) { visit.controller.abort(); visit.dispose(); visit.root.remove(); } });
async function open(immediateAbort = false) {
  const root = document.createElement('div'); root.dataset.module = 'CS02'; document.body.append(root); const controller = new AbortController();
  const dispose = mount({ container: root, signal: controller.signal }) as () => void; const visit = { root, controller, dispose }; visits.push(visit);
  expect(root.childElementCount).toBeGreaterThan(0); if (immediateAbort) controller.abort(); await vi.dynamicImportSettled(); return visit;
}
function click(root: HTMLElement, name: string) { const node = [...root.querySelectorAll('button')].find(button => button.textContent === name); expect(node, name).toBeDefined(); node!.click(); }
function edit(field: HTMLInputElement | HTMLTextAreaElement, value: string) { field.value = value; field.dispatchEvent(new Event('input', { bubbles: true })); }
function control(root: HTMLElement, name: string) { const label = [...root.querySelectorAll('label')].find(node => node.firstChild?.textContent === name); expect(label, name).toBeDefined(); return label!.querySelector('input,select') as HTMLInputElement | HTMLSelectElement; }
function choose(root: HTMLElement, name: string, value: string) { const field = control(root, name); field.value = value; field.dispatchEvent(new Event('input', { bubbles: true })); field.dispatchEvent(new Event('change', { bubbles: true })); return field; }
const polynomial = (root: HTMLElement) => root.querySelectorAll('textarea')[0];
const answer = (root: HTMLElement) => root.querySelectorAll('textarea')[1];

describe('CS02 complete student workspace', () => {
  it('loads a baseline without exposing a scaffold fallback and grades a selected exact cell', async () => {
    const { root } = await open(); expect(root.querySelector('.r-count')).toBeNull(); click(root, 'Reveal derivation');
    expect(root.querySelector('.r-count')!.textContent).toContain('0 RHP root(s), 0 on the imaginary axis, 3 LHP');
    expect(root.querySelector('button[aria-label="Practice row s^1, entry 1"]')!.textContent).toBe('?');
    edit(answer(root), String.raw`\frac{50}{7}`); click(root, 'Check selected entry'); expect(root.textContent).toContain('Your exact entry agrees');
    expect(root.querySelector('[aria-label="Exact selected continued Routh entry"]')!.textContent).toBe(String.raw`r=\frac{50}{7}`);
    edit(answer(root), '7'); expect(root.textContent).toContain('Your entry changed; check again.');
  });
  it('grades a changed root count and clears old results when the selected data changes', async () => {
    const { root } = await open(); click(root, 'Check count and reveal'); expect(root.textContent).toContain('finite number');
    edit(control(root, 'Predicted RHP root count') as HTMLInputElement, '0'); click(root, 'Check count and reveal'); expect(root.textContent).toContain('Your RHP count and row-treatment choice agree.');
    edit(control(root, 'K (coefficient substitution)') as HTMLInputElement, '80'); expect(root.querySelector('.r-count')).toBeNull();
    click(root, 'Check count and reveal'); expect(root.textContent).toContain('original polynomial has 2 RHP');
    edit(control(root, 'Predicted RHP root count') as HTMLInputElement, '2'); expect(root.textContent).toContain('Your count or treatment changed; check again.');
    click(root, 'Check count and reveal'); expect(root.textContent).toContain('Your RHP count and row-treatment choice agree.');
  });
  it('keeps epsilon zero-limit signs distinct from infinity and all-zero rows', async () => {
    const { root } = await open(); click(root, 'Isolated-zero pivot fixture'); edit(control(root, 'Predicted RHP root count') as HTMLInputElement, '2'); choose(root, 'Required row treatment', 'epsilon'); click(root, 'Check count and reveal');
    expect(root.textContent).toContain('isolated zero first entry'); expect(root.textContent).toContain('Your RHP count and row-treatment choice agree.');
    edit(answer(root), '0'); choose(root, 'Sign for small positive epsilon', '-1'); click(root, 'Check selected entry'); expect(root.textContent).toContain('limit is zero, but its sign');
    choose(root, 'Sign for small positive epsilon', '1'); click(root, 'Check selected entry'); expect(root.textContent).toContain('Your one-sided limit and required sign agree.');
    choose(root, 'Routh row', '3'); choose(root, 'Predicted epsilon limit', 'negative-infinity'); expect(answer(root).parentElement!.hidden).toBe(true);
    click(root, 'Check selected entry'); expect(root.textContent).toContain('Your one-sided infinite limit agrees.');
  });
  it('shows the auxiliary derivative and classifies real symmetry separately', async () => {
    const { root } = await open(); click(root, 'All-zero row fixture'); click(root, 'Reveal derivation');
    expect(root.querySelector('.r-count')!.textContent).toContain('0 RHP root(s), 2 on the imaginary axis, 3 LHP');
    expect(root.querySelector('[aria-label="Auxiliary polynomial and its derivative"]')!.textContent).toContain("A(s)=s^{2}+4,\\quad A'(s)=2s");
    expect(root.querySelector('[aria-label="Exact auxiliary roots in inverse seconds"]')!.textContent).toBe(String.raw`s=\pm 2\mathrm{j}`);
    choose(root, 'Routh row', '4'); edit(answer(root), '2'); click(root, 'Check selected entry'); expect(root.textContent).toContain('Your exact entry agrees.');
    click(root, 'Symmetric real roots'); click(root, 'Reveal derivation'); expect(root.querySelector('.r-count')!.textContent).toContain('1 RHP root(s), 0 on the imaginary axis, 1 LHP');
    expect(root.textContent).toContain('1 symmetric real pair(s); 0 imaginary pair(s)');
  });
  it('links source coefficients to cells and exposes exact leading-minor arithmetic', async () => {
    const { root } = await open(); click(root, 'Reveal derivation'); choose(root, 'Highlight coefficient', '2'); expect(root.querySelectorAll('td.r-source')).toHaveLength(1);
    choose(root, 'Exercise view', 'hurwitz'); expect(root.querySelectorAll('td.r-source')).toHaveLength(2); expect(root.querySelectorAll('td.r-leading')).toHaveLength(4);
    expect(control(root, 'Routh row').parentElement!.hidden).toBe(true); expect(control(root, 'Leading minor order').parentElement!.hidden).toBe(false);
    edit(answer(root), '50'); click(root, 'Check selected entry'); expect(root.textContent).toContain('Your exact entry agrees.');
    expect(root.querySelector('[aria-label="Exact determinant row operation"]')!.textContent).toContain('\\frac{1}{7}');
    expect(root.querySelector('[aria-label="Signed product of exact determinant pivots"]')!.textContent).toContain('=50');
    edit(polynomial(root), '-(s^3+7s^2+10s+K)'); click(root, 'Reveal derivation'); expect(root.querySelector('.r-count')!.textContent).toContain('0 RHP root(s)');
  });
  it('reports the original count rather than a migrated-axis epsilon count', async () => {
    const { root } = await open(); click(root, 'Mixed axis and epsilon'); click(root, 'Reveal derivation');
    expect(root.querySelector('.r-count')!.textContent).toContain('3 RHP root(s), 2 on the imaginary axis, 1 LHP');
    expect(root.textContent).toContain('full-table epsilon limit has 5 sign changes'); expect(root.textContent).toContain('original total is 3');
    expect(root.querySelector('[aria-label="Exact origin-symmetric factor and axis-free quotient"]')).not.toBeNull();
  });
  it('handles underflow, genuine zero, native exponent and visual scope errors without stale output', async () => {
    const { root } = await open(); click(root, 'Reveal derivation'); const gain = control(root, 'K (coefficient substitution)') as HTMLInputElement;
    edit(gain, '1e-999'); expect(root.textContent).toContain('nonzero but too small'); expect(root.querySelector('.r-count')).toBeNull();
    edit(gain, '0e-999'); click(root, 'Reveal derivation'); expect(root.querySelector('.r-count')!.textContent).toContain('1 on the imaginary axis');
    edit(gain, '1e-2'); click(root, 'Reveal derivation'); expect(root.textContent).toContain('Strictly Hurwitz: every root');
    edit(polynomial(root), String.raw`s^3+s^2+s+\frac1\;2`); click(root, 'Reveal derivation'); expect(root.textContent).toContain('spacing symbol'); expect(root.querySelector('.r-count')).toBeNull();
    edit(polynomial(root), String.raw`s^3+s^2+s+\frac1{\;2}`); click(root, 'Reveal derivation'); expect(root.textContent).toContain('Strictly Hurwitz: every root');
    edit(polynomial(root), 's^3+1e-2'); click(root, 'Reveal derivation'); expect(root.textContent).toContain('e notation'); expect(root.querySelector('.r-count')).toBeNull();
  });
  it('restores baseline state after abort, disposal and reopen', async () => {
    const first = await open(); click(first.root, 'All-zero row fixture'); click(first.root, 'Reveal derivation'); first.controller.abort(); first.dispose(); first.dispose(); expect(first.root.childElementCount).toBe(0);
    const next = await open(); expect(polynomial(next.root).value).toBe('P(s)=s^3+7s^2+10s+K'); expect(control(next.root, 'K (coefficient substitution)').value).toBe('20');
    expect(answer(next.root).value).toBe(''); expect(next.root.querySelector('.r-count')).toBeNull(); expect(control(next.root, 'Exercise view').value).toBe('routh');
  });
  it('ignores a late view after immediate parent abort', async () => { const { root } = await open(true); expect(root.childElementCount).toBe(0); });
  it('aborts partially allocated resources immediately when the view throws', async () => {
    let child: AbortSignal | undefined, calls = 0; const partial = document.createElement('button');
    vi.resetModules(); vi.doMock('./view', () => ({ mountView: (({ container, signal }) => { child = signal; container.append(partial); partial.addEventListener('click', () => calls++, { signal }); document.addEventListener('cs02-partial', () => calls++, { signal }); throw new Error('Partial mount failure'); }) satisfies ModuleMount }));
    try { const visit = await open(); expect(visit.controller.signal.aborted).toBe(false); expect(child?.aborted).toBe(true); expect(visit.root.textContent).toBe('The exercise could not load. Reset to try again.'); expect(partial.isConnected).toBe(false); partial.click(); document.dispatchEvent(new Event('cs02-partial')); expect(calls).toBe(0); }
    finally { vi.doUnmock('./view'); vi.resetModules(); }
    const recovered = await open(); expect(polynomial(recovered.root).value).toContain('P(s)=');
  });
  it('releases a disposer returned after parent abort during synchronous mounting exactly once', async () => {
    const controller = new AbortController(), release = vi.fn(), root = document.createElement('div'); root.dataset.module = 'CS02'; document.body.append(root);
    vi.resetModules(); vi.doMock('./view', () => ({ mountView: (({ container }) => { controller.abort(); container.append(document.createElement('button')); return release; }) satisfies ModuleMount }));
    try { const dispose = mount({ container: root, signal: controller.signal }) as () => void; visits.push({ root, controller, dispose }); await vi.dynamicImportSettled(); expect(root.childElementCount).toBe(0); expect(release).toHaveBeenCalledTimes(1); dispose(); controller.abort(); expect(release).toHaveBeenCalledTimes(1); }
    finally { vi.doUnmock('./view'); vi.resetModules(); }
  });
});
