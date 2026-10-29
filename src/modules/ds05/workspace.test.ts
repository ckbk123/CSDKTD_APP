import { afterEach, describe, expect, it, vi } from 'vitest';
import { mountDeferred } from './workspace';

const visits: (() => void)[] = [];
afterEach(() => { for (const cleanup of visits.splice(0)) cleanup(); document.body.replaceChildren(); });
function visit(load: Parameters<typeof mountDeferred>[1]) {
  const parent = new AbortController(), container = document.createElement('div'); document.body.append(container);
  const dispose = mountDeferred({ container, signal: parent.signal }, load); visits.push(dispose);
  return { parent, container, dispose };
}
async function settled() { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); }
describe('deferred visit ownership', () => {
  it('owns a synchronous loading node and removes it when ready', async () => {
    let resolve!: (value: Awaited<ReturnType<Parameters<typeof mountDeferred>[1]>>) => void;
    const v = visit(() => new Promise(r => { resolve = r; }));
    expect(v.container.textContent).toContain('Loading discrete Nyquist');
    resolve({ mountView: ({ container }) => { container.append(document.createTextNode('Ready')); } }); await settled();
    expect(v.container.textContent).toBe('Ready');
  });
  it('does not mount a late load after leaving', async () => {
    let resolve!: (value: Awaited<ReturnType<Parameters<typeof mountDeferred>[1]>>) => void;
    const mountView = vi.fn(), v = visit(() => new Promise(r => { resolve = r; })); v.parent.abort();
    resolve({ mountView }); await settled(); expect(mountView).not.toHaveBeenCalled(); expect(v.container.children).toHaveLength(0);
  });
  it('aborts signal-owned resources on a partial view failure while parent stays active', async () => {
    const fired = vi.fn(), released = vi.fn();
    const v = visit(async () => ({ mountView: ({ container, signal }) => {
      window.addEventListener('cp-test', fired, { signal }); signal.addEventListener('abort', released, { once: true });
      container.append(document.createTextNode('Partial content'));
      throw new Error('simulated failure after registering a window listener');
    } }));
    await settled(); window.dispatchEvent(new Event('cp-test'));
    expect(v.parent.signal.aborted).toBe(false); expect(released).toHaveBeenCalledTimes(1); expect(fired).not.toHaveBeenCalled();
    expect(v.container.textContent).toContain('could not load'); expect(v.container.textContent).not.toContain('Partial content');
    v.dispose(); expect(v.container.children).toHaveLength(0);
  });
  it('shows recovery on rejected load and releases a successful cleanup exactly once', async () => {
    const failure = visit(async () => { throw new Error('chunk unavailable'); }); await settled();
    expect(failure.container.querySelector('[role="alert"]')?.textContent).toContain('Reset this tool');
    const cleanup = vi.fn(), success = visit(async () => ({ mountView: () => cleanup })); await settled();
    success.parent.abort(); success.dispose(); expect(cleanup).toHaveBeenCalledTimes(1);
  });
});
