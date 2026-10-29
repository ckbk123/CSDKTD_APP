import { describe, expect, it, vi } from 'vitest';
import type { ModuleMount } from '../../core/module';
const mock = vi.hoisted(() => ({ mount: vi.fn<ModuleMount>(() => vi.fn()) }));
vi.mock('./view', () => ({ mount: mock.mount }));
import { mount } from './workspace';

describe('DF02 deferred view lifecycle', () => {
  it('owns visible loading content synchronously and removes it after a successful import', async () => {
    mock.mount.mockClear(); const container = document.createElement('section'), controller = new AbortController();
    const dispose = mount({ container, signal: controller.signal });
    expect(container.textContent).toContain('Loading the tracking-error');
    await vi.waitFor(() => expect(mock.mount).toHaveBeenCalledTimes(1));
    expect(container.textContent).not.toContain('Loading'); controller.abort(); if (typeof dispose === 'function') dispose();
    expect(mock.mount.mock.results.at(-1)?.value).toHaveBeenCalledTimes(1);
  });
  it('prevents a late import from mounting after rapid navigation aborts it', async () => {
    mock.mount.mockClear(); const container = document.createElement('section'), controller = new AbortController();
    const dispose = mount({ container, signal: controller.signal }); controller.abort();
    await new Promise(resolve => setTimeout(resolve, 0)); expect(mock.mount).not.toHaveBeenCalled();
    expect(container.childElementCount).toBe(0); if (typeof dispose === 'function') dispose();
  });
  it('cleans explicit disposal before parent abort only once', async () => {
    mock.mount.mockClear(); const container = document.createElement('section'), controller = new AbortController();
    const dispose = mount({ container, signal: controller.signal });
    await vi.waitFor(() => expect(mock.mount).toHaveBeenCalledTimes(1));
    if (typeof dispose === 'function') { dispose(); dispose(); } controller.abort();
    expect(mock.mount.mock.results.at(-1)?.value).toHaveBeenCalledTimes(1);
  });
  it('makes initialization failure visible and removes the owned error on reset/abort', async () => {
    mock.mount.mockImplementationOnce(() => { throw new Error('view failed'); });
    const container = document.createElement('section'), controller = new AbortController(); const dispose = mount({ container, signal: controller.signal });
    await vi.waitFor(() => expect(container.querySelector('[role="alert"]')?.textContent).toContain('Reset the example'));
    expect(container.textContent).not.toContain('Loading'); controller.abort(); if (typeof dispose === 'function') dispose();
    expect(container.childElementCount).toBe(0);
  });
  it('aborts resources registered by a partially failed view while its parent visit remains active', async () => {
    let childSignal: AbortSignal | undefined;
    const resource = vi.fn(), stopped = vi.fn();
    mock.mount.mockImplementationOnce(({ container, signal }) => {
      childSignal = signal;
      window.addEventListener('df02-failed-view-probe', resource, { signal });
      signal.addEventListener('abort', stopped, { once: true });
      container.append(document.createElement('math-field'));
      throw new Error('failed after allocating a resource');
    });
    const container = document.createElement('section'), controller = new AbortController();
    const dispose = mount({ container, signal: controller.signal });
    await vi.waitFor(() => expect(container.querySelector('[role="alert"]')).not.toBeNull());
    expect(controller.signal.aborted).toBe(false);
    expect(childSignal).not.toBe(controller.signal);
    expect(childSignal?.aborted).toBe(true);
    expect(stopped).toHaveBeenCalledTimes(1);
    expect(container.querySelector('math-field')).toBeNull();
    window.dispatchEvent(new Event('df02-failed-view-probe'));
    expect(resource).not.toHaveBeenCalled();
    if (typeof dispose === 'function') dispose();
    controller.abort(); expect(stopped).toHaveBeenCalledTimes(1);
    expect(container.childElementCount).toBe(0);
  });
  it('does nothing for an already aborted visit', () => {
    const controller = new AbortController(); controller.abort(); const container = document.createElement('section');
    expect(mount({ container, signal: controller.signal })).toBeUndefined(); expect(container.childElementCount).toBe(0);
  });
});


it('releases a late disposer exactly once when parent abort happens inside mounting', async () => {
  const container = document.createElement('div'), parent = new AbortController(), release = vi.fn();
  mock.mount.mockImplementationOnce(() => { parent.abort(); return release; });
  const cleanup = mount({ container, signal: parent.signal }); await vi.dynamicImportSettled(); cleanup?.(); cleanup?.();
  expect(release).toHaveBeenCalledOnce(); expect(container.childElementCount).toBe(0);
});
it('permits a reentrant standalone disposer without double release', async () => {
  const container = document.createElement('div'), parent = new AbortController(); let cleanup: ReturnType<typeof mount>;
  const release = vi.fn(() => cleanup?.()); mock.mount.mockImplementationOnce(() => release);
  cleanup = mount({ container, signal: parent.signal }); await vi.dynamicImportSettled(); cleanup?.(); cleanup?.(); parent.abort(); expect(release).toHaveBeenCalledOnce();
});
