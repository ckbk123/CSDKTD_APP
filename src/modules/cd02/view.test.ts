import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EquationInputOptions } from '../../shared/equations/input';
import { mount } from './view';
const resources = vi.hoisted(() => ({ calls: 0, created: 0, throwAt: 0, signals: [] as AbortSignal[] }));
vi.mock('../../shared/equations/input', () => ({
  createEquationInput: (options: EquationInputOptions) => {
    resources.created++; resources.signals.push(options.signal);
    document.addEventListener('cd02-probe', () => resources.calls++, { signal: options.signal });
    if (resources.created === resources.throwAt) throw new Error('partial editor allocation');
    const element = document.createElement('label'), field = document.createElement('input'); element.textContent = options.label; field.setAttribute('aria-label', options.label); field.value = options.value; element.append(field);
    const getValue = () => ({ latex: field.value, empty: !field.value, hasPlaceholders: field.value.includes('placeholder'), syntaxIssues: [] });
    field.addEventListener('input', () => options.onChange?.(getValue()), { signal: options.signal });
    return { element, getValue, setValue: (v: string) => { field.value = v; }, focus: () => field.focus(), destroy: () => element.remove() };
  },
  createEquationDisplay: (latex: string, label: string) => { const d = document.createElement('div'); d.textContent = latex; d.setAttribute('aria-label', label); return d; },
}));
let release: (() => void) | undefined;
const button = (name: string) => [...document.querySelectorAll('button')].find(b => b.textContent === name)!;
const input = (name: string) => [...document.querySelectorAll('input')].find(i => i.getAttribute('aria-label') === name || i.parentElement?.textContent === name)!;
const set = (name: string, value: string) => { const i = input(name); i.value = value; i.dispatchEvent(new Event('input', { bubbles: true })); };
const message = () => document.querySelector('[role="status"]')!.textContent!;
function visit(): AbortController { const parent = new AbortController(), container = document.createElement('div'); document.body.append(container); const result = mount({ container, signal: parent.signal }); release = typeof result === 'function' ? result : undefined; return parent; }
const reveal = () => button('Check prediction and reveal design').click();
const check = () => button('Verify full compensated model').click();
beforeEach(() => { resources.created = 0; resources.throwAt = 0; resources.calls = 0; resources.signals = []; });
afterEach(() => { release?.(); release = undefined; document.body.replaceChildren(); });

describe('lead exercise flow (mocked editors, not browser evidence)', () => {
  it('stages the prediction, complete pole/zero design, all branches and full-order checks', () => {
    visit(); expect(button('Verify full compensated model').disabled).toBe(true); expect(document.querySelector('svg')).toBeNull();
    set('Predicted controller gain K (optional)', '12'); reveal(); expect(message()).toContain('agrees'); expect(document.body.textContent).toContain('A third pole remains at −4');
    check(); const rows = document.querySelectorAll('tbody tr'); expect(rows).toHaveLength(4); expect(rows[0].textContent).toContain('all three modes');
    expect(parseFloat(rows[1].children[1].textContent!)).toBeCloseTo(7.925, 2); expect(rows[3].children[1].textContent).toBe('0.375'); expect(document.querySelectorAll('svg')).toHaveLength(3);
  });
  it('recomputes the changed compensator pole and invalidates old answers', () => {
    visit(); reveal(); check(); button('Change pole to −8').click(); expect(document.querySelector('table')).toBeNull(); expect(button('Verify full compensated model').disabled).toBe(true);
    set('Predicted controller gain K (optional)', '16'); reveal(); expect(message()).toContain('agrees'); expect(document.body.textContent).toContain('A third pole remains at −6'); check();
    expect(document.querySelector('tbody tr:last-child')!.textContent).toContain('0.333333');
  });
  it('applies requested time-spec limits to full-model verification and ignores disabled pole entries', () => {
    visit(); const mode = document.querySelector('select')!; mode.value = 'specs'; mode.dispatchEvent(new Event('change'));
    set('Requested overshoot (%)', '5'); set('Approximate 2% settling target (s)', '2'); set('Target decay σ (1/s)', ''); set('Target imaginary part ω (rad/s)', ''); reveal(); check();
    expect(document.querySelector('table')).not.toBeNull(); expect(document.querySelector('tbody tr:nth-child(2)')!.textContent).toContain('Overshoot ≤ 5%'); expect(document.querySelector('tbody tr:nth-child(2)')!.textContent).toContain('Fails limit');
  });
  it.each(['', 's+1', '1e-2', String.raw`2\frac12`, String.raw`\placeholder{}`])('clears invalid model %s and recovers with preset', bad => {
    visit(); reveal(); check(); set('Plant numerator g', bad); reveal(); expect(document.querySelector('table')).toBeNull(); expect(button('Verify full compensated model').disabled).toBe(true);
    button('Baseline design inputs').click(); reveal(); check(); expect(document.querySelector('table')).not.toBeNull();
  });
  it('explains the third-pole failure instead of retaining a good target-pair plot', () => {
    visit(); reveal(); check(); set('Target decay σ (1/s)', '4'); reveal(); expect(message()).toContain('remaining closed-loop pole'); expect(document.querySelectorAll('svg')).toHaveLength(0);
  });
  it('rejects native underflow and preserves intentional zero requirements/native exponents', () => {
    visit(); set('Compensator pole distance p (1/s)', '1e-999'); reveal(); expect(message()).toContain('nonzero');
    button('Baseline design inputs').click(); set('Compensator pole distance p (1/s)', '6e0'); reveal(); set('Maximum unit-ramp error', '0e-999'); check();
    expect(document.querySelector('table')).not.toBeNull(); expect(document.querySelector('tbody tr:last-child')!.textContent).toContain('Fails limit');
  });
  it('rejects prediction underflow and recovers', () => {
    visit(); set('Predicted controller gain K (optional)', '1e-999'); reveal(); expect(message()).toContain('nonzero'); expect(button('Verify full compensated model').disabled).toBe(true);
    set('Predicted controller gain K (optional)', '12'); reveal(); expect(message()).toContain('agrees');
    set('Predicted controller gain K (optional)', '');
    Object.defineProperty(input('Predicted controller gain K (optional)'), 'validity', { value: { badInput: true } });
    reveal(); expect(message()).toContain('finite'); expect(button('Verify full compensated model').disabled).toBe(true);
  });
  it('hides old verification on horizon/limits changes and reports an unresolved short run', () => {
    visit(); reveal(); check(); set('Response horizon (s)', '.5'); expect(document.querySelector('table')).toBeNull(); check(); expect(document.querySelector('table')!.textContent).toContain('Unresolved in horizon');
  });
  it('starts a fresh visit at baseline with no prediction/results', () => {
    visit(); button('Change pole to −8').click(); set('Predicted controller gain K (optional)', '16'); reveal(); check(); release?.(); visit(); expect(input('Compensator pole distance p (1/s)').value).toBe('6'); expect(input('Predicted controller gain K (optional)').value).toBe(''); expect(button('Verify full compensated model').disabled).toBe(true);
  });
  it('releases document resources on standalone disposal without parent abort', () => {
    const parent = visit(); document.dispatchEvent(new Event('cd02-probe')); expect(resources.calls).toBe(2); const old = button('Change pole to −8'); release?.(); release?.(); document.dispatchEvent(new Event('cd02-probe')); old.click(); expect(parent.signal.aborted).toBe(false); expect(resources.calls).toBe(2); expect(resources.signals.every(s => s.aborted)).toBe(true); expect(document.querySelector('.cd02')).toBeNull();
  });
  it('forwards parent abort and ignores an already-aborted visit', () => {
    const parent = visit(); parent.abort(); document.dispatchEvent(new Event('cd02-probe')); expect(resources.calls).toBe(0); release?.(); const c = document.createElement('div'); mount({ container: c, signal: parent.signal }); expect(c.children).toHaveLength(0);
  });
  it('aborts partially allocated resources on mount failure', () => {
    resources.throwAt = 2; const parent = new AbortController(), container = document.createElement('div'); expect(() => mount({ container, signal: parent.signal })).toThrow('partial editor allocation'); expect(parent.signal.aborted).toBe(false); document.dispatchEvent(new Event('cd02-probe')); expect(resources.calls).toBe(0); expect(container.children).toHaveLength(0);
  });
});
