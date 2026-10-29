import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('../../shared/equations/input', () => ({
  createEquationDisplay: (value: string) => { const el = document.createElement('div'); el.dataset.equation = value; el.textContent = value; return el; },
  createEquationInput: ({ label, value, signal, onChange }: { label: string; value: string; signal: AbortSignal; onChange: (d: { latex: string }) => void }) => {
    const element = document.createElement('div'), field = document.createElement('textarea'); field.setAttribute('aria-label', label); field.value = value; element.append(field);
    field.addEventListener('input', () => onChange({ latex: field.value }), { signal });
    return { element, getValue: () => ({ latex: field.value, empty: !field.value, hasPlaceholders: field.value.includes('placeholder'), syntaxIssues: [] }), destroy: () => element.remove() };
  },
}));
import { mount } from './view';
const lifetimes: AbortController[] = [];
afterEach(() => { lifetimes.forEach(c => c.abort()); lifetimes.length = 0; document.body.replaceChildren(); });
function start() {
  const container = document.createElement('div'), parent = new AbortController(); document.body.append(container); lifetimes.push(parent);
  const cleanup = mount({ container, signal: parent.signal });
  const part = (name: string) => container.querySelector<HTMLElement>(`[data-part="${name}"]`)!;
  const click = (action: string) => container.querySelector<HTMLButtonElement>(`[data-action="${action}"]`)!.click();
  return { container, parent, cleanup, part, click };
}
function reveal(v: ReturnType<typeof start>) { v.click('enumerate'); v.click('determinants'); v.click('result'); }
describe('CR05 exercise flow with mocked equation view', () => {
  it('requires determinant reasoning before revealing and computes changed/reset data', () => {
    const v = start(); v.click('result'); expect(v.part('feedback').textContent).toContain('Build'); expect(v.part('result').children).toHaveLength(0);
    reveal(v); expect(v.part('result').textContent).toContain('s^{2}+5s+5'); expect(v.part('numeric').textContent).toContain('0.2');
    v.click('changed'); expect(v.part('result').children).toHaveLength(0); reveal(v); expect(v.part('result').textContent).toContain('s^{2}+6s+6');
    v.click('baseline'); expect(v.part('result').children).toHaveLength(0); reveal(v); expect(v.part('numeric').textContent).toContain('0.2');
  });
  it('lets students trace loops and highlights the shared nodes of an invalid pair', () => {
    const v = start(); const edge = (id: string) => v.container.querySelector<HTMLButtonElement>(`[data-action="edge"][data-edge="${id}"]`)!.click();
    for (const id of ['b2', 'b3', 'b5']) edge(id); v.click('loop'); v.click('clear');
    for (const id of ['b3', 'b4']) edge(id); v.click('loop');
    for (const c of v.part('attempts').querySelectorAll<HTMLInputElement>('input[type="checkbox"]')) { c.checked = true; c.dispatchEvent(new Event('change', { bubbles: true })); }
    v.click('touch'); expect(v.part('touch-feedback').textContent).toContain('touch at x, y'); expect(v.part('touch-feedback').textContent).toContain('excluded'); expect(v.part('graph').querySelectorAll('.cr05-node.chosen')).toHaveLength(2);
  });
  it('clears stale results on invalid gain/model edits and rejects unapplied names', () => {
    const v = start(); reveal(v); const field = v.container.querySelector<HTMLTextAreaElement>('[aria-label="b2 signed gain"]')!;
    field.value = String.raw`\frac1{0}`; field.dispatchEvent(new Event('input', { bubbles: true }));
    expect(v.part('result').children).toHaveLength(0); expect(v.part('graph').querySelector('svg')).toBeNull();
    v.click('apply'); expect(v.part('feedback').textContent).toContain('Singular');
    v.click('baseline'); const names = v.container.querySelector<HTMLInputElement>('[data-control="nodes"]')!; names.value = 'r,a,y'; names.dispatchEvent(new Event('input', { bubbles: true })); v.click('apply'); expect(v.part('feedback').textContent).toContain('Update');
  });
  it('keeps the formal result and clears a failed numeric point when native input underflows', () => {
    const v = start(); reveal(v); const sigma = v.container.querySelector<HTMLInputElement>('[data-control="sigma"]')!;
    sigma.value = '1e-400'; v.click('numeric'); expect(v.part('numeric').textContent).toContain('too small'); expect(v.part('result').textContent).toContain('Exact elimination');
    sigma.value = '0e-400'; v.click('numeric'); expect(v.part('numeric').textContent).toContain('0.2');
    sigma.value = '1e-1'; v.click('numeric'); expect(v.part('numeric').textContent).toContain('At s = 0.1');
  });
  it('shows all disjoint triple products and distinct cofactors in the proposed fixture', () => {
    const v = start(); v.click('disjoint'); reveal(v);
    expect(v.part('determinants').textContent).toContain('3-loop terms: subtract'); expect(v.part('determinants').textContent).toContain('No loop touches this path'); expect(v.part('numeric').textContent).toContain('Mason = 6');
  });
  it('distinguishes incomplete boxes and preserves the diagram when exact equations are singular', () => {
    const v = start(); const set = (id: string, value: string) => { const field = v.container.querySelector<HTMLTextAreaElement>(`[aria-label="${id} signed gain"]`)!; field.value = value; field.dispatchEvent(new Event('input', { bubbles: true })); };
    set('b2', String.raw`\frac{\placeholder{}}{1}`); v.click('apply'); expect(v.part('feedback').textContent).toContain('Complete the fraction');
    v.click('disjoint'); set('b6', '1'); v.click('apply'); v.click('enumerate'); expect(v.part('feedback').textContent).toContain('singular'); expect(v.part('result').textContent).toBe(''); expect(v.part('graph').querySelector('svg')).not.toBeNull();
  });
  it('releases the visit and reopens with fresh baseline state', () => {
    const v = start(); v.click('disjoint'); reveal(v); v.parent.abort(); v.cleanup?.(); expect(v.container.childElementCount).toBe(0);
    const next = start(); expect(next.part('source-note').textContent).toContain('Course nested loops'); expect(next.part('result').children).toHaveLength(0); expect(next.container.querySelectorAll('textarea')).toHaveLength(5);
  });
});
