import { afterEach, describe, expect, it, vi } from 'vitest';
import { mountExplore } from './explore';
import { sampleTraces } from './traces';
vi.mock('./traces', async original => { const actual = await original<typeof import('./traces')>(); return { ...actual, sampleTraces: vi.fn(actual.sampleTraces) }; });
type UI = typeof import('../../shared/equations/input');
const ui: UI = { createEquationDisplay: (value: string, label: string) => { const node = document.createElement('div'); node.setAttribute('aria-label', label); node.textContent = value; return node; }, createEquationInput: () => { throw new Error('Explore uses explicit family controls, not an arbitrary editor.'); } };
const visits: { root: HTMLElement; controller: AbortController; cleanup: () => void }[] = [];
function open() { vi.useFakeTimers(); const root = document.createElement('div'); root.dataset.module = 'CS01'; document.body.append(root); const controller = new AbortController(), cleanup = mountExplore({ container: root, signal: controller.signal }, ui); visits.push({ root, controller, cleanup }); return root; }
const field = <T extends HTMLElement = HTMLInputElement>(root: HTMLElement, label: string) => root.querySelector<T>(`[aria-label="${label}"]`)!;
function edit(root: HTMLElement, label: string, value: string, event = 'input') { const input = field<HTMLInputElement | HTMLSelectElement>(root, label); input.value = value; input.dispatchEvent(new Event(event, { bubbles: true })); }
const click = (root: HTMLElement, label: string) => [...root.querySelectorAll('button')].find(button => button.textContent === label)!.click();
afterEach(() => { visits.splice(0).forEach(visit => { visit.cleanup(); visit.controller.abort(); visit.root.remove(); }); vi.useRealTimers(); vi.clearAllMocks(); vi.restoreAllMocks(); });

describe('CS01 immediate family exploration checkpoint', () => {
  it('opens the actual canonical baseline with all roots, cached curves and three separate verdicts', () => {
    const root = open(); expect(root.querySelectorAll('.cs01-family-plane > svg, .cs01-time-drawing > svg')).toHaveLength(3); expect(root.querySelector('.cs01-live-verdict')!.textContent).toContain('Asymptotic: yes'); expect(root.querySelector('.cs01-live-verdict')!.textContent).toContain('Zero-input: bounded'); expect(root.querySelector('.cs01-live-verdict')!.textContent).toContain('Scalar BIBO: yes'); expect(field(root, 'Checked family A').textContent).toContain('-2&-3'); expect(root.querySelector('.cs01-cursor-readout')!.textContent).toContain('x₁≈0.6004236');
  });
  it('links a hidden state change without changing its exactly reduced scalar channel', () => {
    const root = open(); edit(root, 'Editable realization family', 'hidden', 'change'); expect(root.querySelector('.cs01-live-verdict')!.textContent).toContain('Asymptotic: no'); expect(root.querySelector('.cs01-live-verdict')!.textContent).toContain('Scalar BIBO: yes'); edit(root, 'Selected real part σ (s⁻¹)', '2'); vi.advanceTimersByTime(32); expect(field(root, 'Checked family A').textContent).toContain('2&0'); expect(field(root, 'Exact cancellation and reduced scalar channel').textContent).toContain('s+2'); expect(root.querySelector('.cs01-cursor-readout')!.textContent).toContain('x₁≈7.389056'); edit(root, 'Response to inspect', 'scalar', 'change'); expect(root.querySelector('.cs01-cursor-readout')!.textContent).toContain('regular h(t)≈0.1353353'); expect(root.textContent).toContain('unexcited and unobserved');
  });
  it('moves one common analytic time cursor without reanalyzing or resampling complete traces', () => {
    const root = open(), count = vi.mocked(sampleTraces).mock.calls.length, paths = [...root.querySelectorAll('.cs01-response-line')].map(path => path.getAttribute('d')); edit(root, 'Inspect time t (s)', '.5'); expect(root.querySelector('.cs01-cursor-readout')!.textContent).toContain('x₁≈0.8451819'); expect(root.querySelector('.cs01-cursor-readout')!.textContent).toContain('mode≈0.6065307'); expect(vi.mocked(sampleTraces).mock.calls).toHaveLength(count); expect([...root.querySelectorAll('.cs01-response-line')].map(path => path.getAttribute('d'))).toEqual(paths);
  });
  it('retains a native rejected horizon element and error through Fit and response-view changes', () => {
    const root = open(), input = field<HTMLInputElement>(root, 'Time horizon (s)'); edit(root, 'Time horizon (s)', '1e-999'); vi.advanceTimersByTime(32); const writes = vi.spyOn(input, 'value', 'set'); click(root, 'Fit plots'); edit(root, 'Response to inspect', 'scalar', 'change'); expect(field(root, 'Time horizon (s)')).toBe(input); expect(input.value).toBe('1e-999'); expect(writes).not.toHaveBeenCalled(); expect(root.querySelector('.cs01-check-state')!.textContent).toContain('nonzero but too small'); expect(field(root, 'Original characteristic polynomial').textContent).toBe('\\chi_A(s)=s^{2}+3s+2'); click(root, 'Discard parameter drafts'); expect(input.value).toBe('6');
  });
  it('changes the repeated zero structure rather than classifying only its eigenvalue multiplicity', () => {
    const root = open(); edit(root, 'Editable realization family', 'repeated', 'change'); expect(root.querySelector('.cs01-live-verdict')!.textContent).toContain('Zero-input: bounded'); edit(root, 'Family structure', 'jordan', 'change'); expect(root.querySelector('.cs01-live-verdict')!.textContent).toContain('Zero-input: unstable'); expect(root.querySelector('.cs01-cursor-readout')!.textContent).toContain('x₁≈1'); expect(root.querySelector('.cs01-cursor-readout')!.textContent).toContain('x₂≈1'); expect(field<HTMLInputElement>(root, 'Show generalized mode').checked).toBe(true); expect(root.textContent).toContain('algebraic multiplicity 2');
  });
});
