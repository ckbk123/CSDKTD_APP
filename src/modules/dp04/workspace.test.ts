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
    const release = vi.fn(); viewMount.mockReturnValue(release); const { cleanup } = visit();
    expect(typeof cleanup).toBe('function'); expect(viewMount).not.toHaveBeenCalled();
    await vi.dynamicImportSettled(); expect(viewMount).toHaveBeenCalledTimes(1);
    if (typeof cleanup === 'function') { cleanup(); cleanup(); } expect(release).toHaveBeenCalledTimes(1);
  });
  it('ignores an import result after abort', async () => { const { controller } = visit(); controller.abort(); await vi.dynamicImportSettled(); expect(viewMount).not.toHaveBeenCalled(); });
  it('ignores an import result after explicit disposal', async () => { const { cleanup } = visit(); if (typeof cleanup === 'function') cleanup(); await vi.dynamicImportSettled(); expect(viewMount).not.toHaveBeenCalled(); });
  it('does not initialize an already-aborted visit', async () => { const { cleanup } = visit(true); expect(cleanup).toBeUndefined(); await vi.dynamicImportSettled(); expect(viewMount).not.toHaveBeenCalled(); });
  it('shows recoverable initialization feedback instead of a rejected promise', async () => {
    viewMount.mockImplementation(() => { throw new Error('simulated unavailable editor'); }); const { container } = visit(); await vi.dynamicImportSettled();
    expect(container.textContent).toContain('Reset the example'); expect(container.querySelector('[role="status"]')).not.toBeNull();
  });
});
