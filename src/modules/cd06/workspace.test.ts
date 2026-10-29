import { describe, expect, it, vi } from 'vitest';
import type { ModuleMount } from '../../core/module';
import { mountWithLoader } from './workspace';
const flush = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };
function deferred<T>() { let resolve!: (v: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { promise, resolve }; }

describe('deferred entry lifetime', () => {
  it('adds a synchronous loading node and suppresses a late view after disposal', async () => {
    const container = document.createElement('div'), signal = new AbortController().signal, load = deferred<{ mount: ModuleMount }>(), view = vi.fn();
    const dispose = mountWithLoader({ container, signal }, () => load.promise);
    expect(container.textContent).toContain('Loading'); dispose(); load.resolve({ mount: view }); await flush();
    expect(view).not.toHaveBeenCalled(); expect(container.children).toHaveLength(0);
  });
  it('aborts a partial view resource before showing failure feedback with parent still active', async () => {
    const container = document.createElement('div'), parent = new AbortController(); let child!: AbortSignal, calls = 0;
    const dispose = mountWithLoader({ container, signal: parent.signal }, async () => ({ mount: ({ signal, container: host }) => {
      child = signal; document.addEventListener('cd06-failed-probe', () => calls++, { signal }); host.append(document.createElement('input')); throw new Error('partial view');
    } }));
    await flush(); expect(parent.signal.aborted).toBe(false); expect(child.aborted).toBe(true); document.dispatchEvent(new Event('cd06-failed-probe')); expect(calls).toBe(0);
    expect(container.querySelector('input')).toBeNull(); expect(container.querySelector('[role="alert"]')).not.toBeNull(); dispose(); expect(container.children).toHaveLength(0);
  });
  it('releases returned cleanup once after reentrant parent abort', async () => {
    const container = document.createElement('div'), parent = new AbortController(), release = vi.fn();
    const dispose = mountWithLoader({ container, signal: parent.signal }, async () => ({ mount: () => { parent.abort(); return release; } }));
    await flush(); dispose(); expect(release).toHaveBeenCalledTimes(1); expect(container.children).toHaveLength(0);
  });
  it('disposes a live view on explicit cleanup and repeated parent abort', async () => {
    const container = document.createElement('div'), parent = new AbortController(), release = vi.fn(); let child!: AbortSignal;
    const dispose = mountWithLoader({ container, signal: parent.signal }, async () => ({ mount: ({ signal }) => { child = signal; return release; } }));
    await flush(); dispose(); expect(child.aborted).toBe(true); parent.abort(); dispose(); expect(release).toHaveBeenCalledTimes(1);
  });
  it('reports a rejected import and cleans the error node', async () => {
    const container = document.createElement('div'), parent = new AbortController();
    const dispose = mountWithLoader({ container, signal: parent.signal }, () => Promise.reject(new Error('load failure')));
    await flush(); expect(container.textContent).toContain('Reset'); dispose(); expect(container.children).toHaveLength(0);
  });
  it('does not load an already-aborted visit', () => {
    const container = document.createElement('div'), parent = new AbortController(), load = vi.fn(); parent.abort();
    mountWithLoader({ container, signal: parent.signal }, load); expect(load).not.toHaveBeenCalled(); expect(container.children).toHaveLength(0);
  });
});
