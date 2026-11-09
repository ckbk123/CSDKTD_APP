import { afterEach, expect, it, vi } from 'vitest';
vi.mock('../../shared/equations/input', () => ({}));
import { mountWithPanels } from './view';
afterEach(() => document.body.replaceChildren());
it('aborts every retained panel before exact-once cleanup and removes DOM even when both releases throw', () => {
  const root = document.createElement('div'), parent = new AbortController(), signals: AbortSignal[] = [], first = vi.fn(() => { expect(signals.every(s => s.aborted)).toBe(true); throw new Error('first release'); }), second = vi.fn(() => { expect(signals.every(s => s.aborted)).toBe(true); throw new Error('second release'); }); document.body.append(root);
  const cleanup = mountWithPanels({ container: root, signal: parent.signal }, { explore: ({ signal }) => { signals.push(signal); return first; }, practice: ({ signal }) => { signals.push(signal); return second; } });
  const mode = root.querySelector('select')!; mode.value = 'practice'; mode.dispatchEvent(new Event('change')); expect(cleanup).toThrow('first release'); expect(root.childElementCount).toBe(0); expect(first).toHaveBeenCalledOnce(); expect(second).toHaveBeenCalledOnce(); cleanup(); parent.abort(); expect(first).toHaveBeenCalledOnce(); expect(second).toHaveBeenCalledOnce();
});
it('adopts a late disposer after reentrant parent abort exactly once', () => {
  const root = document.createElement('div'), parent = new AbortController(), release = vi.fn(); document.body.append(root);
  const cleanup = mountWithPanels({ container: root, signal: parent.signal }, { explore: () => { parent.abort(); return release; }, practice: () => {} }); expect(root.childElementCount).toBe(0); expect(release).toHaveBeenCalledOnce(); cleanup(); expect(release).toHaveBeenCalledOnce();
});
it('does not steal another control focus when Retry is triggered programmatically', () => {
  const root = document.createElement('div'), other = document.createElement('input'), parent = new AbortController(); document.body.append(root, other); let count = 0;
  const cleanup = mountWithPanels({ container: root, signal: parent.signal }, { explore: () => { if (++count === 1) throw new Error('first mount'); }, practice: () => {} }); other.focus(); root.querySelector('button')!.click(); expect(document.activeElement).toBe(other); cleanup();
});
