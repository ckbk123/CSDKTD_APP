import { expect, it, vi } from 'vitest';
import type { EquationInputOptions } from '../../shared/equations/input';
const state = vi.hoisted(() => ({ abort: undefined as undefined | (() => void), release: vi.fn(), resource: vi.fn() }));
vi.mock('../../shared/equations/input', () => ({
  createEquationDisplay: () => document.createElement('div'),
  createEquationInput: (options: EquationInputOptions) => { const element = document.createElement('div'); window.addEventListener('cd02-late-practice', state.resource, { signal: options.signal }); state.abort?.(); return { element, getValue: () => ({ latex: options.value, empty: false, hasPlaceholders: false, syntaxIssues: [] }), setValue: vi.fn(), focus: vi.fn(), destroy: state.release }; },
}));
import { mount } from './practice';
it('releases an editor returned after reentrant parent abort without allocating another one', () => {
  const parent = new AbortController(), root = document.createElement('div'); state.abort = () => parent.abort(); const release = mount({ container: root, signal: parent.signal }); expect(root.children).toHaveLength(0); expect(state.release).toHaveBeenCalledOnce(); window.dispatchEvent(new Event('cd02-late-practice')); expect(state.resource).not.toHaveBeenCalled(); release?.(); expect(state.release).toHaveBeenCalledOnce(); state.abort = undefined;
});
