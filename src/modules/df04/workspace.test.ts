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
describe('DF04 synchronous lazy workspace lifecycle', () => {
  it('returns immediately and releases the browser view exactly once', async () => {
    const release = vi.fn(); viewMount.mockReturnValue(release); const { cleanup, container } = visit();
    expect(typeof cleanup).toBe('function'); expect(viewMount).not.toHaveBeenCalled();
    expect(container.textContent).toContain('Loading sample-period controls');
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
  it('aborts partial initialization resources while keeping the visit recoverable', async () => {
    const partialCleanup = vi.fn(); let childSignal: AbortSignal | undefined;
    viewMount.mockImplementation(({ container, signal }: { container: HTMLElement; signal: AbortSignal }) => {
      childSignal = signal; const partial = document.createElement('span'); partial.textContent = 'partial controls'; container.append(partial);
      signal.addEventListener('abort', partialCleanup, { once: true });
      throw new Error('failure after editor initialization');
    });
    const { container, controller, cleanup } = visit(); await vi.dynamicImportSettled();
    expect(childSignal?.aborted).toBe(true); expect(controller.signal.aborted).toBe(false); expect(partialCleanup).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain('Reset the example'); expect(container.textContent).not.toContain('partial controls');
    controller.abort(); if (typeof cleanup === 'function') cleanup(); expect(partialCleanup).toHaveBeenCalledTimes(1);
  });
});
