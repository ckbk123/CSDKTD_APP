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
  it('standalone disposal aborts the child and releases its listener and cleanup once', async () => {
    const fired = vi.fn(), released = vi.fn(); let child!: AbortSignal;
    const v = visit(async () => ({ mountView: ({ signal }) => {
      child = signal; window.addEventListener('cp-standalone', fired, { signal }); return released;
    } }));
    await settled(); v.dispose(); v.dispose(); window.dispatchEvent(new Event('cp-standalone'));
    expect(v.parent.signal.aborted).toBe(false); expect(child.aborted).toBe(true); expect(fired).not.toHaveBeenCalled();
    v.parent.abort(); expect(released).toHaveBeenCalledTimes(1);
    expect(v.container.children).toHaveLength(0);
  });
  it('releases a disposer returned after a reentrant parent abort exactly once', async () => {
    const released = vi.fn(); let parent!: AbortController;
    const v = visit(async () => ({ mountView: ({ signal }) => { parent.abort(); expect(signal.aborted).toBe(true); return released; } })); parent = v.parent;
    await settled(); v.dispose(); expect(released).toHaveBeenCalledTimes(1); expect(v.container.children).toHaveLength(0);
  });
  it('never loads an already aborted visit or mounts after standalone pending disposal', async () => {
    const container = document.createElement('div'), parent = new AbortController(), load = vi.fn(); parent.abort();
    mountDeferred({ container, signal: parent.signal }, load); expect(load).not.toHaveBeenCalled(); expect(container.children).toHaveLength(0);
    let resolve!: (value: Awaited<ReturnType<Parameters<typeof mountDeferred>[1]>>) => void;
    const mounted = vi.fn(), v = visit(() => new Promise(r => { resolve = r; })); v.dispose();
    resolve({ mountView: mounted }); await settled(); expect(mounted).not.toHaveBeenCalled();
  });
  it('owns a synchronous loading node and removes it when ready', async () => {
    let resolve!: (value: Awaited<ReturnType<Parameters<typeof mountDeferred>[1]>>) => void;
    const v = visit(() => new Promise(r => { resolve = r; }));
    expect(v.container.textContent).toContain('Loading time-response');
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
