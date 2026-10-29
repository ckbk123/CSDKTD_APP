import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from './workspace';
const viewMount = vi.hoisted(() => vi.fn());
vi.mock('./view', () => ({ mount: viewMount }));
const dispose: (() => void)[] = [];
beforeEach(() => { viewMount.mockReset(); });
afterEach(() => { dispose.splice(0).forEach(run => run()); document.body.replaceChildren(); });
function visit(aborted = false) {
  const container = document.createElement('div'); document.body.append(container); const controller = new AbortController(); if (aborted) controller.abort();
  const cleanup = mount({ container, signal: controller.signal });
  dispose.push(() => { controller.abort(); if (typeof cleanup === 'function') cleanup(); });
  return { container, controller, cleanup };
}
describe('DP04 synchronous lazy workspace lifecycle', () => {
  it('returns immediately and releases the browser view exactly once', async () => {
    const release = vi.fn(); viewMount.mockReturnValue(release); const { cleanup, container } = visit();
    expect(typeof cleanup).toBe('function'); expect(viewMount).not.toHaveBeenCalled();
    expect(container.textContent).toContain('Loading root-locus controls');
    await vi.dynamicImportSettled(); expect(viewMount).toHaveBeenCalledTimes(1); expect(container.textContent).not.toContain('Loading');
    if (typeof cleanup === 'function') { cleanup(); cleanup(); } expect(release).toHaveBeenCalledTimes(1);
  });
  it('ignores an import result after abort', async () => { const { controller, container } = visit(); controller.abort(); expect(container.childElementCount).toBe(0); await vi.dynamicImportSettled(); expect(viewMount).not.toHaveBeenCalled(); });
  it('ignores an import result after explicit disposal', async () => { const { cleanup } = visit(); if (typeof cleanup === 'function') cleanup(); await vi.dynamicImportSettled(); expect(viewMount).not.toHaveBeenCalled(); });
  it('does not initialize an already-aborted visit', async () => { const { cleanup } = visit(true); expect(cleanup).toBeUndefined(); await vi.dynamicImportSettled(); expect(viewMount).not.toHaveBeenCalled(); });
  it('shows recoverable initialization feedback instead of a rejected promise', async () => {
    viewMount.mockImplementation(() => { throw new Error('simulated unavailable editor'); }); const { container } = visit(); await vi.dynamicImportSettled();
    expect(container.textContent).toContain('Reset the example'); expect(container.querySelector('[role="status"]')).not.toBeNull();
  });
});


it('aborts signal resources allocated before a partial mount failure', async () => {
  const parent = new AbortController(), container = document.createElement('div'), listener = vi.fn(); let child: AbortSignal | undefined;
  viewMount.mockImplementationOnce(({ signal, container: host }) => { child = signal; host.append(document.createElement('section')); document.addEventListener('dp04-partial', listener, { signal }); throw new Error('partial'); });
  const cleanup = mount({ container, signal: parent.signal }); await vi.dynamicImportSettled();
  expect(child).not.toBe(parent.signal); expect(child?.aborted).toBe(true); expect(parent.signal.aborted).toBe(false);
  document.dispatchEvent(new Event('dp04-partial')); expect(listener).not.toHaveBeenCalled(); expect(container.querySelector('section')).toBeNull(); expect(container.textContent).toContain('Reset the example'); cleanup?.();
});
it('owns standalone resources and tolerates a reentrant disposer exactly once', async () => {
  const parent = new AbortController(), container = document.createElement('div'), listener = vi.fn(); let child: AbortSignal | undefined, cleanup: ReturnType<typeof mount>;
  const release = vi.fn(() => cleanup?.());
  viewMount.mockImplementationOnce(({ signal }) => { child = signal; document.addEventListener('dp04-owned', listener, { signal }); return release; });
  cleanup = mount({ container, signal: parent.signal }); await vi.dynamicImportSettled(); document.dispatchEvent(new Event('dp04-owned')); expect(listener).toHaveBeenCalledOnce();
  cleanup?.(); cleanup?.(); expect(child?.aborted).toBe(true); expect(parent.signal.aborted).toBe(false); document.dispatchEvent(new Event('dp04-owned')); expect(listener).toHaveBeenCalledOnce(); parent.abort(); expect(release).toHaveBeenCalledOnce();
});
it('releases a disposer returned after an abort during mounting', async () => {
  const parent = new AbortController(), container = document.createElement('div'), release = vi.fn();
  viewMount.mockImplementationOnce(() => { parent.abort(); return release; }); const cleanup = mount({ container, signal: parent.signal }); await vi.dynamicImportSettled(); cleanup?.(); cleanup?.();
  expect(release).toHaveBeenCalledOnce(); expect(container.childElementCount).toBe(0);
});
