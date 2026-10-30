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
function visit() { const container = document.createElement('div'), parent = new AbortController(); document.body.append(container); clean = mount({ container, signal: parent.signal }) || undefined; return { container, parent }; }
function field(label: string): HTMLInputElement { return [...document.querySelectorAll('input')].find(e => e.getAttribute('aria-label') === label || e.closest('label')?.firstChild?.textContent === label)!; }
function set(label: string, value: string) { const e = field(label); e.value = value; e.dispatchEvent(new Event('input', { bubbles: true })); }
function button(label: string): HTMLButtonElement { return [...document.querySelectorAll('button')].find(e => e.textContent === label)!; }
const lead = () => button('Check prediction and reveal lead').click();
const lag = () => button('Check prediction and add lag').click();
const verify = () => button('Verify full models').click();
const feedback = () => document.querySelector('.cd04-feedback')!.textContent!;
const table = () => document.querySelector('table')?.textContent || '';

describe('staged allocation flow (mocked equations, not browser evidence)', () => {
  it('keeps full metrics when the plotted time window changes', () => {
    visit(); lead(); lag(); verify(); const before = table(); set('Response plot window (s)', '1'); verify();
    expect(table()).toBe(before); expect(document.body.textContent).toContain('first 1 s'); expect(document.body.textContent).toContain('full 80 s observation horizon');
  });
  it('reveals lead from the accepted plant and preserves all three modes', () => {
    visit(); expect(button('Verify full models').disabled).toBe(true); set('Predicted lead gain K (optional)', '12'); lead();
    expect(feedback()).toContain('agrees'); expect(Number(field('Lag pole pL (rad/s)').value)).toBeCloseTo(.1 / 3.75, 12); verify();
    expect(table()).toContain('0.375 · Fails'); expect(table()).toContain('7.924'); expect(table()).toContain('-4;'); expect(document.querySelectorAll('svg')).toHaveLength(3);
  });
  it('shows the combined overshoot failure, then verifies a slower-corner refinement', () => {
    visit(); lead(); set('Predicted required ratio β (optional)', '3.75'); lag(); expect(feedback()).toContain('agrees'); verify();
    expect(table()).toContain('11.055'); expect(feedback()).toContain('Overshoot fails after adding lag');
    button('Try lag zero 0.02 with the same required ratio').click(); expect(table()).not.toContain('CombinedUn');
    expect(Number(field('Lag pole pL (rad/s)').value)).toBeCloseTo(.02 / 3.75, 12); lag(); verify();
    expect(feedback()).toContain('All displayed checks'); expect(table()).toContain('8.568'); expect(table()).toContain('0.1 · Pass');
    expect(document.body.textContent).toContain('all 4 branches');
  });
  it('recalculates when the lead pole changes instead of carrying a previous lag', () => {
    visit(); lead(); lag(); button('Change lead pole to −8').click(); expect(document.querySelector('table')).toBeNull(); expect(button('Check prediction and add lag').disabled).toBe(true);
    set('Predicted lead gain K (optional)', '16'); lead(); expect(feedback()).toContain('agrees'); expect(Number(field('Lag pole pL (rad/s)').value)).toBeCloseTo(.03, 12); lag(); expect(table()).toContain('0.1 · Pass');
  });
  it('handles changed plant data and explains a remaining entry-deadline failure', () => {
    visit(); set('Plant numerator g (s⁻²)', '2'); set('Plant pole parameter a (rad/s)', '3'); set('Chosen lead pole pD (rad/s)', '8'); set('Maximum unit-ramp error', '.05');
    lead(); lag(); verify(); expect(table()).toContain('0.05 · Pass'); expect(table()).toContain('9.195'); expect(feedback()).toContain('deadline fails');
  });
  it('keeps requested time-spec limits on the full model and prioritizes a failed lead transient', () => {
    visit(); const mode = document.querySelector('select')!; mode.value = 'specs'; mode.dispatchEvent(new Event('change'));
    expect(field('Target decay σ (s⁻¹)').disabled).toBe(true); expect(field('Requested pair overshoot (%)').disabled).toBe(false);
    lead(); verify(); expect(table()).toContain('Observed overshoot ≤ 4.32139%'); expect(feedback()).toContain('Lead overshoot fails');
  });
  it('rejects invalid native empty drafts for both optional predictions', () => {
    visit(); lead(); lag(); Object.defineProperty(field('Predicted lead gain K (optional)'), 'validity', { value: { badInput: true } }); lead();
    expect(feedback()).toContain('finite'); expect(document.querySelector('table')).toBeNull(); expect(button('Verify full models').disabled).toBe(true);
    clean?.(); document.body.replaceChildren(); visit(); lead(); lag(); Object.defineProperty(field('Predicted required ratio β (optional)'), 'validity', { value: { badInput: true } }); lag();
    expect(feedback()).toContain('finite'); expect([...document.querySelectorAll('thead th')].map(e => e.textContent)).toEqual(['Complete-model check', 'Baseline C0', 'Lead']);
  });
  it('rejects unsupported/incomplete equations and numeric underflow without stale checks', () => {
    visit(); lead(); set('Plant numerator g (s⁻²)', 's'); lead(); expect(feedback()).toContain('Symbols'); expect(document.querySelector('table')).toBeNull();
    set('Plant numerator g (s⁻²)', '\\frac{1}{\\placeholder{}}'); lead(); expect(feedback()).toContain('Complete');
    set('Plant numerator g (s⁻²)', '1'); set('Chosen lead pole pD (rad/s)', '1e-999'); lead(); expect(feedback()).toContain('nonzero');
  });
  it('does not retain a checked combined model when a lag draft is malformed', () => {
    visit(); lead(); lag(); verify(); set('Lag pole pL (rad/s)', '1e-999'); lag(); expect(feedback()).toContain('nonzero');
    expect([...document.querySelectorAll('thead th')].map(e => e.textContent)).toEqual(['Complete-model check', 'Baseline C0', 'Lead']);
  });
  it('reports an unstable combined model and growing response without a final-error claim', () => {
    visit(); lead(); set('Lag zero zL (rad/s)', '10'); set('Lag pole pL (rad/s)', '.2'); lag(); verify();
    expect(table()).toContain('Unstable'); expect(table()).toContain('Unavailable: not strictly stable'); expect(feedback()).toContain('grew');
  });
  it('separates unresolved short observation from a computed steady-state error', () => {
    visit(); lead(); lag(); set('Response horizon (s)', '.5'); verify(); expect(table()).toContain('Unresolved through this horizon'); expect(table()).toContain('0.1 · Pass'); expect(feedback()).toContain('horizon');
  });
  it('applies exact typed lag placement and offers a keyboard slider alternative', () => {
    visit(); lead(); set('Maximum unit-ramp error', '.2'); button('Place lag pole for error target').click(); expect(Number(field('Lag pole pL (rad/s)').value)).toBeCloseTo(.1 / 1.875, 12);
    const s = field('Slide lag zero zL (rad/s)'); s.value = String(Math.log10(.2)); s.dispatchEvent(new Event('input'));
    expect(Number(field('Lag zero zL (rad/s)').value)).toBeCloseTo(.2, 2); lag(); expect(table()).toContain('Combined');
  });
  it('keeps invalid requirement feedback visible and recovers after a valid edit', () => {
    visit(); lead(); set('Additional maximum overshoot (%)', ''); expect(document.querySelector('table')).toBeNull(); expect(feedback()).toContain('finite');
    set('Additional maximum overshoot (%)', '10'); verify(); expect(table()).toContain('7.924');
  });
  it('resets and reopens to baseline with no checked design or predictions', () => {
    visit(); lead(); lag(); verify(); button('Baseline design inputs').click(); expect(field('Chosen lead pole pD (rad/s)').value).toBe('6'); expect(field('Predicted lead gain K (optional)').value).toBe(''); expect(document.querySelector('table')).toBeNull(); expect(button('Verify full models').disabled).toBe(true);
    clean?.(); document.body.replaceChildren(); visit(); expect(field('Lag zero zL (rad/s)').value).toBe('.1'); expect(document.querySelector('table')).toBeNull();
  });
  it('aborts caller-owned listeners and releases the view once', () => {
    const { container, parent } = visit(); lead(); parent.abort(); set('Chosen lead pole pD (rad/s)', '8'); expect(table()).toContain('0.375'); clean?.(); clean?.(); expect(container.children).toHaveLength(0);
  });
});
