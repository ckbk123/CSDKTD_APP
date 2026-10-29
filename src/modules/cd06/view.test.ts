import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('../../shared/equations/input', () => ({
  createEquationDisplay: (value: string, label: string) => { const e = document.createElement('div'); e.textContent = value; e.setAttribute('aria-label', label); return e; },
  createEquationInput: ({ label, value, signal, onChange }: { label: string; value: string; signal: AbortSignal; onChange: () => void }) => {
    const input = document.createElement('input'); input.setAttribute('aria-label', label); input.value = value; input.addEventListener('input', onChange, { signal });
    return { element: input, getValue: () => ({ latex: input.value, empty: !input.value.trim(), hasPlaceholders: input.value.includes('\\placeholder'), syntaxIssues: [] }), setValue: (s: string) => { input.value = s; onChange(); }, destroy: () => input.remove() };
  },
}));
import { mount } from './view';
let clean: (() => void) | undefined;
afterEach(() => { clean?.(); clean = undefined; document.body.replaceChildren(); });
function visit() { const parent = new AbortController(), container = document.createElement('div'); document.body.append(container); clean = mount({ container, signal: parent.signal }) || undefined; return { container, parent }; }
function field(label: string): HTMLInputElement { return [...document.querySelectorAll('input')].find(e => e.getAttribute('aria-label') === label || e.closest('label')?.firstChild?.textContent === label)!; }
function set(label: string, value: string) { const input = field(label); input.value = value; input.dispatchEvent(new Event('input', { bubbles: true })); }
function button(label: string): HTMLButtonElement { return [...document.querySelectorAll('button')].find(e => e.textContent === label)!; }
const reveal = () => button('Check prediction and reveal lag').click();
const text = () => document.querySelector('.cd06-feedback')!.textContent!;
const table = () => document.querySelector('table')?.textContent || '';
const verify = () => button('Verify full responses').click();

describe('exercise flow with mocked equation controls (not browser evidence)', () => {
  it('starts as a draft, reveals actual lag checks, then checks the full responses', () => {
    visit(); expect(button('Verify full responses').disabled).toBe(true); expect(document.querySelectorAll('svg')).toHaveLength(2);
    set('Predicted required ratio β (optional)', '5'); reveal(); expect(text()).toContain('agrees'); expect(table()).toContain('48.882'); expect(table()).toContain('Response not checked');
    verify(); expect(table()).toContain('21.56'); expect(table()).toContain('7.128'); expect(table()).toContain('Unmet or unresolved'); expect(document.querySelectorAll('svg')).toHaveLength(3);
  });
  it('adds lead using the actual moved crossover and checks every full model', () => {
    visit(); reveal(); button('Add lead for frequency goals').click(); expect(text()).toContain('actual margin 57'); expect(table()).toContain('Lead–lag'); verify();
    expect(table()).toContain('All displayed checks met'); expect(document.querySelectorAll('tbody tr')[6].textContent).toContain('j');
  });
  it('checks manual lead and keeps the complete stable canceled mode', () => {
    visit(); reveal(); button('Check manual lead corners').click(); verify(); expect(table()).toContain('62.9918'); expect(table()).toContain('8.347'); expect(table()).toContain('-2;');
    expect(document.body.textContent).toContain('All 4 poles are retained');
  });
  it('clears stale results on corner changes and keeps the changed ratio at five', () => {
    visit(); reveal(); verify(); button('Move lag corners nearer crossover').click(); expect(document.querySelector('table')).toBeNull(); expect(button('Verify full responses').disabled).toBe(true);
    expect(field('Lag zero zL (rad/s)').value).toBe('.5'); expect(field('Lag pole pL (rad/s)').value).toBe('.1'); reveal(); expect(table()).toContain('37.3507'); verify(); expect(table()).toContain('38.92');
  });
  it('derives a new pole from the error target and rejects an excessive required ratio', () => {
    visit(); set('Maximum unit-ramp error', '.25'); button('Place lag pole for error target').click(); expect(Number(field('Lag pole pL (rad/s)').value)).toBe(.05); reveal(); expect(table()).toContain('0.25 · Pass');
    set('Maximum unit-ramp error', '.0001'); button('Place lag pole for error target').click(); expect(text()).toContain('beyond 50'); expect(document.querySelector('table')).toBeNull();
  });
  it('supports changed plant coefficients, derives their lag pole and verifies a new lead', () => {
    visit(); set('Plant numerator g (s⁻²)', '2'); set('Plant pole parameter a (rad/s)', '3'); set('Proportional gain C0', '6');
    set('Maximum unit-ramp error', '.05'); set('Maximum gain crossover (rad/s)', '5'); set('Lag zero zL (rad/s)', '.2');
    button('Place lag pole for error target').click(); expect(Number(field('Lag pole pL (rad/s)').value)).toBeCloseTo(.04, 12);
    reveal(); expect(table()).toContain('0.05 · Pass'); button('Add lead for frequency goals').click(); verify(); expect(table()).toContain('All displayed checks met');
  });
  it('uses slider input as a real logarithmic corner edit with a typed alternative', () => {
    visit(); reveal(); const slider = field('Slide lag zero zl (rad/s)'); expect(slider.type).toBe('range'); slider.value = String(Math.log10(.5)); slider.dispatchEvent(new Event('input'));
    expect(Number(field('Lag zero zL (rad/s)').value)).toBeCloseTo(.5, 1); expect(document.querySelector('table')).toBeNull(); expect(document.querySelectorAll('svg')).toHaveLength(2);
  });
  it('rejects empty, unsupported and underflowed model drafts without stale tables', () => {
    visit(); reveal(); set('Plant numerator g (s⁻²)', '1e-3'); reveal(); expect(text()).toContain('e/E'); expect(document.querySelector('table')).toBeNull();
    set('Plant numerator g (s⁻²)', ''); reveal(); expect(text()).toContain('Complete');
    set('Plant numerator g (s⁻²)', '1'); set('Lag pole pL (rad/s)', '1e-999'); reveal(); expect(text()).toContain('nonzero'); expect(document.querySelector('table')).toBeNull();
  });
  it('rejects a native badInput optional prediction even when its native value is empty', () => {
    visit(); reveal(); verify(); const input = field('Predicted required ratio β (optional)'); Object.defineProperty(input, 'validity', { value: { badInput: true } }); reveal();
    expect(text()).toContain('finite'); expect(document.querySelector('table')).toBeNull(); expect(button('Verify full responses').disabled).toBe(true);
  });
  it('shows an unstable full lag and withholds final ramp/settling claims', () => {
    visit(); set('Lag zero zL (rad/s)', '10'); set('Lag pole pL (rad/s)', '.2'); reveal(); expect(table()).toContain('Unstable'); expect(table()).toContain('0.716115'); expect(table()).toContain('Unavailable: stability');
    verify(); expect(table()).toContain('grew beyond'); expect(table()).not.toContain('All displayed checks met');
  });
  it('treats short windows as unresolved and preserves numeric validation feedback', () => {
    visit(); reveal(); set('Response horizon (s)', '.5'); verify(); expect(table()).toContain('Unresolved through this horizon');
    set('Maximum observed overshoot (%)', ''); expect(document.querySelector('table')).toBeNull(); expect(text()).toContain('finite'); reveal(); expect(text()).toContain('finite');
  });
  it('removes the previously checked third model when a manual lead draft is invalid', () => {
    visit(); reveal(); button('Check manual lead corners').click(); set('Manual lead pole pD (rad/s)', '1'); button('Check manual lead corners').click();
    expect(text()).toContain('Lead ratio'); expect(table()).not.toContain('Lead–lag'); expect(table()).toContain('Lag');
  });
  it('resets and reopens without carrying controllers, predictions or checked results', () => {
    visit(); reveal(); button('Add lead for frequency goals').click(); verify(); button('Baseline design inputs').click();
    expect(field('Manual lead pole pD (rad/s)').value).toBe('4'); expect(field('Predicted required ratio β (optional)').value).toBe(''); expect(document.querySelector('table')).toBeNull(); expect(button('Verify full responses').disabled).toBe(true);
    clean?.(); document.body.replaceChildren(); visit(); expect(field('Lag pole pL (rad/s)').value).toBe('.02'); expect(document.querySelector('table')).toBeNull();
  });
  it('owns signal listeners and cleanup without retaining a stale live view', () => {
    const { parent, container } = visit(); reveal(); parent.abort(); set('Lag zero zL (rad/s)', '.5'); expect(table()).toContain('48.882');
    clean?.(); clean?.(); expect(container.children).toHaveLength(0);
  });
});
