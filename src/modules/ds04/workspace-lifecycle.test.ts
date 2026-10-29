import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ModuleContext } from '../../core/module';
import { mount } from './workspace';
const view = vi.hoisted(() => ({ mount: vi.fn() }));
vi.mock('./ui', () => ({ mountUI: view.mount }));
beforeEach(() => view.mount.mockReset());
describe('DS04 integration view ownership', () => {
  it('aborts resources allocated before a partial mount throws and shows attached recovery feedback', async () => {
    const container = document.createElement('div'), parent = new AbortController(), listener = vi.fn(); let child: AbortSignal | undefined;
    view.mount.mockImplementationOnce(({ container: host, signal }: ModuleContext) => { child = signal; document.addEventListener('ds04-partial', listener, { signal }); host.append(document.createElement('section')); throw new Error('partial'); });
    const cleanup = mount({ container, signal: parent.signal }); expect(container.textContent).toContain('Loading'); await vi.dynamicImportSettled();
    expect(parent.signal.aborted).toBe(false); expect(child).not.toBe(parent.signal); expect(child?.aborted).toBe(true);
    document.dispatchEvent(new Event('ds04-partial')); expect(listener).not.toHaveBeenCalled(); expect(container.querySelector('section')).toBeNull(); expect(container.textContent).toContain('Reset to try again'); cleanup?.(); cleanup?.(); expect(container.childElementCount).toBe(0);
  });
  it('cleans standalone signal listeners and permits a reentrant disposer exactly once', async () => {
    const container = document.createElement('div'), parent = new AbortController(), listener = vi.fn(); let child: AbortSignal | undefined, cleanup: ReturnType<typeof mount>;
    const release = vi.fn(() => cleanup?.());
    view.mount.mockImplementationOnce(({ signal }: ModuleContext) => { child = signal; document.addEventListener('ds04-owned', listener, { signal }); return release; });
    cleanup = mount({ container, signal: parent.signal }); await vi.dynamicImportSettled(); document.dispatchEvent(new Event('ds04-owned')); expect(listener).toHaveBeenCalledOnce();
    cleanup?.(); cleanup?.(); expect(parent.signal.aborted).toBe(false); expect(child?.aborted).toBe(true); document.dispatchEvent(new Event('ds04-owned')); expect(listener).toHaveBeenCalledOnce(); parent.abort(); expect(release).toHaveBeenCalledOnce();
  });
  it('releases a disposer returned after an abort during mounting', async () => {
    const container = document.createElement('div'), parent = new AbortController(), release = vi.fn();
    view.mount.mockImplementationOnce(() => { parent.abort(); return release; }); const cleanup = mount({ container, signal: parent.signal }); await vi.dynamicImportSettled(); cleanup?.(); cleanup?.();
    expect(release).toHaveBeenCalledOnce(); expect(container.childElementCount).toBe(0);
  });
  it('ignores late imports after standalone disposal and already aborted visits', async () => {
    const container = document.createElement('div'), parent = new AbortController(); const cleanup = mount({ container, signal: parent.signal }); cleanup?.(); parent.abort();
    expect(mount({ container, signal: parent.signal })).toBeUndefined(); await vi.dynamicImportSettled(); expect(view.mount).not.toHaveBeenCalled(); expect(container.childElementCount).toBe(0);
  });
});
