import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EquationDraft, EquationInputOptions } from '../../shared/equations/input';
import { mount } from './view';

const resources = vi.hoisted(() => ({ calls: 0, created: 0, throwAt: 0, signals: [] as AbortSignal[] }));
vi.mock('../../shared/equations/input', () => ({
  createEquationInput: (options: EquationInputOptions) => {
    resources.created++; resources.signals.push(options.signal);
    document.addEventListener('cd07-probe', () => resources.calls++, { signal: options.signal });
    if (resources.created === resources.throwAt) throw new Error('partial editor allocation');
    const element = document.createElement('label'), field = document.createElement('input');
    element.textContent = options.label; field.setAttribute('aria-label', options.label); field.value = options.value; element.append(field);
    const getValue = (): EquationDraft => ({ latex: field.value, empty: !field.value, hasPlaceholders: field.value.includes('placeholder'), syntaxIssues: [] });
    field.addEventListener('input', () => options.onChange?.(getValue()), { signal: options.signal });
    return { element, getValue, setValue: (value: string) => { field.value = value; }, focus: () => field.focus(), destroy: () => element.remove() };
  },
  createEquationDisplay: (latex: string, label: string) => { const div = document.createElement('div'); div.textContent = latex; div.setAttribute('aria-label', label); return div; },
}));
let release: (() => void) | undefined;
const button = (name: string) => [...document.querySelectorAll('button')].find(b => b.textContent === name)!;
const field = (label: string) => [...document.querySelectorAll('input')].find(i => i.getAttribute('aria-label') === label || i.parentElement?.textContent === label)!;
const set = (label: string, value: string) => { const input = field(label); input.value = value; input.dispatchEvent(new Event('input', { bubbles: true })); };
const feedback = () => document.querySelector('[role="status"]')!.textContent!;
function visit(): AbortController {
  const parent = new AbortController(), container = document.createElement('div'); document.body.append(container);
  const result = mount({ container, signal: parent.signal }); release = typeof result === 'function' ? result : undefined; return parent;
}
function reveal(): void { document.querySelector<HTMLInputElement>('[type="checkbox"]')!.click(); button('Check prediction and reveal rule').click(); }
beforeEach(() => { resources.calls = 0; resources.created = 0; resources.throwAt = 0; resources.signals = []; });
afterEach(() => { release?.(); release = undefined; document.body.replaceChildren(); });

describe('temporary exercise flow (mocked editor; not browser evidence)', () => {
  it('requires assumptions, checks a prediction, reveals the form conversion and compares computed responses', () => {
    visit(); expect(button('Check prediction and reveal rule').disabled).toBe(true); expect(document.querySelectorAll('svg')).toHaveLength(1);
    set('Predicted Kp (optional)', '4.8'); reveal(); expect(feedback()).toContain('agrees'); expect(document.body.textContent).toContain('K_i=4.8');
    button('Compare controllers').click(); expect(document.querySelector('table')).not.toBeNull(); expect(document.querySelectorAll('svg')).toHaveLength(3);
    set('Manual Kp (input/output)', '2.4'); set('Manual Ti (s)', '2'); expect(document.querySelector('table')).toBeNull();
    button('Compare controllers').click(); expect(feedback()).toContain('Comparison computed');
    const rows = document.querySelectorAll('tbody tr'); expect(rows[0].children[1].textContent).not.toBe(rows[0].children[2].textContent);
  });
  it('updates from changed data and different marker measurements', () => {
    visit(); button('Changed-data experiment').click(); expect(field('Plant gain K').value).toBe('2'); reveal(); expect(field('Manual Kp (input/output)').value).toBe('1.8');
    set('Zero-intercept marker t₀ (s)', '.75'); set('Plateau-intercept marker t₁ (s)', '4.5'); button('Check prediction and reveal rule').click();
    expect(field('Manual Kp (input/output)').value).toBe('3'); expect(field('Manual Ti (s)').value).toBe('1.5');
  });
  it.each([
    { name: 'exact L/τ = 1 boundary', gain: '1', tau: String.raw`\frac23`, delay: String.raw`\frac23`, lower: 2 / 3, upper: 4 / 3, kp: 1.2 },
    { name: 'regular changed model', gain: '2', tau: '3', delay: '1', lower: 1, upper: 4, kp: 1.8 },
  ])('restores a usable model tangent for $name', model => {
    visit(); set('Plant gain K', model.gain); set('Time constant τ (s)', model.tau); set('Delay L (s)', model.delay);
    button('Use model tangent').click();
    expect(field('Zero-intercept marker t₀ (s)').valueAsNumber).toBe(model.lower);
    expect(field('Plateau-intercept marker t₁ (s)').valueAsNumber).toBe(model.upper);
    expect(feedback()).toContain('Curve updated'); expect(document.querySelectorAll('svg')).toHaveLength(1);
    reveal(); expect(button('Compare controllers').disabled).toBe(false);
    expect(field('Manual Kp (input/output)').valueAsNumber).toBeCloseTo(model.kp, 12);
    button('Compare controllers').click(); expect(feedback()).toContain('Comparison computed'); expect(document.querySelector('table')).not.toBeNull();
  });
  it('uses PI integral time L/0.3 and ignores disabled derivative fields', () => {
    visit(); const select = document.querySelector('select')!; select.value = 'PI'; select.dispatchEvent(new Event('change')); reveal();
    expect(field('Manual Ti (s)').value).toBe('1.6667'); expect(field('Manual Td (s)').disabled).toBe(true);
    set('Manual Td (s)', ''); button('Compare controllers').click(); expect(document.querySelector('table')).not.toBeNull();
  });
  it.each(['', 's+1', '1e-2', String.raw`2\frac12`, String.raw`\placeholder{}`])('clears stale results and recovers from model %s', bad => {
    visit(); reveal(); button('Compare controllers').click(); set('Plant gain K', bad); expect(document.querySelector('table')).toBeNull();
    button('Plot response curve').click(); expect(button('Compare controllers').disabled).toBe(true); expect(document.querySelectorAll('svg')).toHaveLength(0);
    button('Baseline model').click(); button('Check prediction and reveal rule').click(); button('Compare controllers').click(); expect(document.querySelector('table')).not.toBeNull();
  });
  it.each(['1e-999', '', '-1', '501'])('validates native manual gain %s and suppresses old results', bad => {
    visit(); reveal(); button('Compare controllers').click(); set('Manual Kp (input/output)', bad); button('Compare controllers').click();
    expect(document.querySelector('table')).toBeNull(); expect(feedback()).toMatch(/nonzero|finite|must be/);
  });
  it('preserves intentional native zero and normal exponent syntax', () => {
    visit(); reveal(); set('Manual Td (s)', '0e-999'); set('Manual Kp (input/output)', '1e-2'); button('Compare controllers').click();
    expect(feedback()).toContain('Comparison computed'); expect(document.querySelector('table')).not.toBeNull();
  });
  it('reads native number underflow in markers and prediction', () => {
    visit(); set('Zero-intercept marker t₀ (s)', '1e-999'); button('Plot response curve').click(); expect(feedback()).toContain('nonzero');
    button('Baseline model').click(); set('Predicted Kp (optional)', '1e-999'); reveal(); expect(feedback()).toContain('nonzero'); expect(button('Compare controllers').disabled).toBe(true);
  });
  it('rejects an invalid optional numeric draft whose native value is empty', () => {
    visit(); reveal(); button('Compare controllers').click();
    set('Predicted Kp (optional)', '');
    Object.defineProperty(field('Predicted Kp (optional)'), 'validity', { value: { badInput: true } });
    button('Check prediction and reveal rule').click();
    expect(feedback()).toContain('finite'); expect(button('Compare controllers').disabled).toBe(true); expect(document.querySelector('table')).toBeNull();
  });
  it('clears an invalid measurement and can restore the true tangent', () => {
    visit(); set('Plateau-intercept marker t₁ (s)', '.5'); button('Plot response curve').click(); expect(document.querySelector('svg')).toBeNull();
    button('Use model tangent').click(); expect(field('Plateau-intercept marker t₁ (s)').value).toBe('2.5'); expect(document.querySelector('svg')).not.toBeNull();
  });
  it('enforces assumption withdrawal and leaves no reveal/comparison', () => {
    visit(); reveal(); button('Compare controllers').click(); document.querySelector<HTMLInputElement>('[type="checkbox"]')!.click();
    expect(document.querySelector('table')).toBeNull(); expect(button('Check prediction and reveal rule').disabled).toBe(true); expect(button('Compare controllers').disabled).toBe(true);
  });
  it('restores baseline and no attempts/reveal state on a fresh visit', () => {
    visit(); button('Changed-data experiment').click(); reveal(); release?.(); visit();
    expect(field('Plant gain K').value).toBe('1'); expect(field('Delay L (s)').value).toBe(String.raw`\frac{1}{2}`); expect(button('Compare controllers').disabled).toBe(true); expect(field('Predicted Kp (optional)').value).toBe('');
  });
  it('releases child resources on standalone disposal while parent remains live', () => {
    const parent = visit(); document.dispatchEvent(new Event('cd07-probe')); expect(resources.calls).toBe(3); const old = button('Changed-data experiment');
    release?.(); release?.(); expect(parent.signal.aborted).toBe(false); expect(resources.signals.every(s => s.aborted)).toBe(true);
    document.dispatchEvent(new Event('cd07-probe')); old.click(); expect(resources.calls).toBe(3); expect(document.querySelector('.cd07')).toBeNull();
  });
  it('forwards parent abort and does not mount an already-aborted visit', () => {
    const parent = visit(); parent.abort(); expect(resources.signals.every(s => s.aborted)).toBe(true); document.dispatchEvent(new Event('cd07-probe')); expect(resources.calls).toBe(0);
    release?.(); const container = document.createElement('div'); mount({ container, signal: parent.signal }); expect(container.children).toHaveLength(0);
  });
  it('aborts resources allocated by a partially failed mount', () => {
    resources.throwAt = 2; const parent = new AbortController(), container = document.createElement('div');
    expect(() => mount({ container, signal: parent.signal })).toThrow('partial editor allocation'); expect(parent.signal.aborted).toBe(false);
    document.dispatchEvent(new Event('cd07-probe')); expect(resources.calls).toBe(0); expect(container.children).toHaveLength(0); expect(resources.signals.every(s => s.aborted)).toBe(true);
  });
});
