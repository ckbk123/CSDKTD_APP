import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ mount: vi.fn() }));
vi.mock('./view', () => ({ mount: state.mount }));
import { mount } from './workspace';
beforeEach(() => { state.mount.mockReset(); });
afterEach(() => document.body.replaceChildren());
function start(aborted = false) {
  const container = document.createElement('div'), parent = new AbortController(); document.body.append(container);
  if (aborted) parent.abort();
  const cleanup = mount({ container, signal: parent.signal });
  return { container, parent, cleanup: () => cleanup?.() };
}
describe('CF01 owned lazy-view lifetime', () => {
  it('adds loading synchronously and removes it beside a successful view', async () => {
    state.mount.mockImplementation(({container}) => { container.append(document.createElement('input')); });
    const v = start(); expect(v.container.textContent).toContain('Loading');
    await vi.dynamicImportSettled(); expect(v.container.textContent).not.toContain('Loading');
    expect(v.container.querySelector('input')).not.toBeNull(); v.cleanup();
  });
  it('aborts the child and discards the import after immediate parent abort', async () => {
    const v = start(); v.parent.abort(); await vi.dynamicImportSettled();
    expect(state.mount).not.toHaveBeenCalled(); expect(v.container.childElementCount).toBe(0);
  });
  it('releases signal-owned resources after partial mount failure while parent remains active', async () => {
    let child: AbortSignal | undefined; const pulse = vi.fn();
    state.mount.mockImplementation(({container,signal}) => {
      child=signal; window.addEventListener('cf01-pulse',pulse,{signal});
      const partial=document.createElement('p'); partial.textContent='Partial view'; container.append(partial);
      window.dispatchEvent(new Event('cf01-pulse')); throw new Error('Partial mount failed');
    });
    const v=start(); await vi.dynamicImportSettled();
    expect(pulse).toHaveBeenCalledTimes(1); expect(child!.aborted).toBe(true); expect(v.parent.signal.aborted).toBe(false);
    window.dispatchEvent(new Event('cf01-pulse')); expect(pulse).toHaveBeenCalledTimes(1);
    expect(v.container.textContent).toContain('Reset the tool'); expect(v.container.textContent).not.toContain('Partial view'); expect(v.container.textContent).not.toContain('Loading');
    v.cleanup(); expect(v.container.childElementCount).toBe(0);
  });
  it('disposal without parent abort releases resources and calls view cleanup only once', async () => {
    const pulse=vi.fn(), cleaned=vi.fn(); let child:AbortSignal|undefined;
    state.mount.mockImplementation(({signal})=>{child=signal;window.addEventListener('cf01-pulse',pulse,{signal});return cleaned;});
    const v=start(); await vi.dynamicImportSettled(); v.cleanup(); v.cleanup();
    expect(child!.aborted).toBe(true); expect(v.parent.signal.aborted).toBe(false); expect(cleaned).toHaveBeenCalledTimes(1);
    window.dispatchEvent(new Event('cf01-pulse')); expect(pulse).not.toHaveBeenCalled(); expect(v.container.childElementCount).toBe(0);
  });
  it('does not create a view for an already aborted visit', async () => {
    const v=start(true); await vi.dynamicImportSettled(); expect(state.mount).not.toHaveBeenCalled(); expect(v.container.childElementCount).toBe(0);
  });
});
