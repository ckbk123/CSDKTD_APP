import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('../../shared/equations/input', () => ({
  createEquationDisplay: (value: string) => { const e = document.createElement('div'); e.textContent = value; return e; },
  createEquationInput: ({ label, value, signal, onChange }: { label: string; value: string; signal: AbortSignal; onChange: () => void }) => {
    const element = document.createElement('div'), field = document.createElement('textarea'); field.value = value; field.setAttribute('aria-label', label); element.append(field); field.addEventListener('input', onChange, { signal });
    return { element, setValue: (v: string) => { field.value = v; }, getValue: () => ({ latex: field.value, empty: !field.value, hasPlaceholders: field.value.includes('placeholder'), syntaxIssues: [] }), destroy: () => element.remove() };
  },
}));
import { mount } from './view';
const controllers: AbortController[] = [];
afterEach(() => { controllers.forEach(c => c.abort()); controllers.length = 0; document.body.replaceChildren(); });
function start() {
  const container = document.createElement('div'), controller = new AbortController(); controllers.push(controller); document.body.append(container);
  const cleanup = mount({ container, signal: controller.signal });
  const click = (name: string) => container.querySelector<HTMLButtonElement>(`[data-action="${name}"]`)!.click();
  const part = (name: string) => container.querySelector<HTMLElement>(`[data-part="${name}"]`)!;
  const field = (name: string) => container.querySelector<HTMLInputElement>(`[data-control="${name}"]`)!;
  return { container, controller, cleanup, click, part, field };
}
describe('CD03 complete design flow with mocked equation UI', () => {
  it('starts proportional and keeps disabled draft corners out of the active formula', () => {
    const v = start(); v.click('compute'); expect(v.part('prediction').textContent).toContain('Accuracy: failed. Full step targets: met');
    expect(v.part('reasoning').textContent).toContain('K_v=K_{v,0}=2'); expect(v.part('reasoning').textContent).toContain('Lag is disabled'); expect(v.part('angle').textContent).toContain('angle0°'); expect(v.part('roots').textContent).toContain('stable');
  });
  it('chooses the accuracy ratio and checks the slow full response separately', () => {
    const v = start(); v.click('suggest'); expect(v.field('lag').checked).toBe(true); expect(Number(v.field('z').value)).toBe(.1);
    v.click('compute'); expect(v.part('prediction').textContent).toContain('Accuracy: met. Full step targets: failed'); expect(v.part('table').textContent).toContain('0.05'); expect(v.part('roots').textContent).toContain('Complete full-loop poles');
    v.click('near'); expect(Number(v.field('p').value)).toBeCloseTo(.002); expect(Number(v.field('z').value)).toBeCloseTo(.02); v.click('compute'); expect(v.part('reasoning').textContent).toContain('z/p=10');
  });
  it('reports horizon limits and full-loop instability instead of an unconditional ramp result', () => {
    const v = start(); v.field('horizon').value = '1.21'; v.click('compute'); expect(v.part('table').textContent).toContain('Not established in H');
    v.click('lag'); v.field('z').value = '3'; v.click('compute'); expect(v.part('roots').textContent).toContain('unstable'); expect(v.part('table').textContent).toContain('Not established'); expect(v.part('feedback').textContent).toContain('unstable');
  });
  it('clears stale results for invalid native/model data and preserves plots for a bad cursor', () => {
    const v = start(); v.click('compute'); expect(v.part('response').querySelector('svg')).not.toBeNull();
    v.field('time').value = '1e-400'; v.click('inspect'); expect(v.part('inspection').textContent).toContain('too small'); expect(v.part('response').querySelector('svg')).not.toBeNull();
    v.field('time').value = '0e-400'; v.click('inspect'); expect(v.part('inspection').textContent).toContain('y=0');
    v.field('horizon').value = '1e-400'; v.click('compute'); expect(v.part('feedback').textContent).toContain('too small'); expect(v.part('response').querySelector('svg')).toBeNull(); expect(v.part('table').textContent).toBe('');
    v.click('reset'); const f = v.container.querySelector<HTMLTextAreaElement>('textarea')!; f.value = String.raw`\frac{\placeholder{}}{s}`; f.dispatchEvent(new Event('input', { bubbles: true })); v.click('compute'); expect(v.part('feedback').textContent).toContain('Complete');
  });
  it('restores the baseline on reset and a new visit without carrying state', () => {
    const v = start(); v.click('lag'); v.click('compute'); v.click('reset'); expect(v.field('lag').checked).toBe(false); expect(v.part('table').textContent).toBe('');
    v.controller.abort(); v.cleanup?.(); const next = start(); expect(next.field('k').value).toBe('4'); expect(next.field('lag').checked).toBe(false); expect(next.part('roots').textContent).toBe('');
  });
});
