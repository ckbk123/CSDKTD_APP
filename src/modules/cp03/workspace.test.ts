import { describe, expect, it, vi } from 'vitest';
import type { ModuleMount } from '../../core/module';
const mock = vi.hoisted(() => ({ mount: vi.fn<ModuleMount>(() => vi.fn()) }));
vi.mock('./view', () => ({ mount: mock.mount }));
import { mount } from './workspace';

describe('CP03 deferred browser view', () => {
  it('aborts partial view resources immediately while recovery remains visible', async () => {
    const parent = new AbortController(), container = document.createElement('div'), listener = vi.fn(); let child: AbortSignal | undefined;
    mock.mount.mockImplementationOnce(context => { child = context.signal; window.addEventListener('cp03-resource', listener, { signal: context.signal }); context.container.append(document.createElement('button')); throw new Error('partial mount'); });
    const cleanup = mount({ container, signal: parent.signal }); await vi.dynamicImportSettled(); window.dispatchEvent(new Event('cp03-resource'));
    expect(listener).not.toHaveBeenCalled(); expect(child?.aborted).toBe(true); expect(parent.signal.aborted).toBe(false); expect(container.querySelector('button')).toBeNull(); expect(container.querySelector('[role="alert"]')).not.toBeNull(); cleanup?.();
  });
  it('standalone disposal owns native listeners and is idempotent', async () => {
    const parent = new AbortController(), container = document.createElement('div'), listener = vi.fn(), release = vi.fn();
    mock.mount.mockImplementationOnce(context => { window.addEventListener('cp03-resource', listener, { signal: context.signal }); return release; });
    const cleanup = mount({ container, signal: parent.signal }); await vi.dynamicImportSettled(); window.dispatchEvent(new Event('cp03-resource')); expect(listener).toHaveBeenCalledOnce(); cleanup?.(); cleanup?.(); window.dispatchEvent(new Event('cp03-resource'));
    expect(listener).toHaveBeenCalledOnce(); expect(release).toHaveBeenCalledOnce(); expect(parent.signal.aborted).toBe(false); expect(container.children.length).toBe(0); parent.abort(); expect(release).toHaveBeenCalledOnce();
  });
  it('releases a disposer returned after reentrant abort without late content', async () => {
    const parent = new AbortController(), container = document.createElement('div'), release = vi.fn();
    mock.mount.mockImplementationOnce(() => { parent.abort(); return release; });
    const cleanup = mount({ container, signal: parent.signal }); await vi.dynamicImportSettled(); expect(release).toHaveBeenCalledOnce(); expect(container.children.length).toBe(0); cleanup?.(); expect(release).toHaveBeenCalledOnce();
  });
  it('never mounts after rapid navigation aborts a pending view import', async () => {
    mock.mount.mockClear();
    const container = document.createElement('section'), controller = new AbortController();
    const dispose = mount({ container, signal: controller.signal }); controller.abort();
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(mock.mount).not.toHaveBeenCalled(); expect(container.childElementCount).toBe(0);
    if (typeof dispose === 'function') dispose();
  });
  it('provides synchronous cleanup and disposes an already mounted view only once', async () => {
    mock.mount.mockClear();
    const container = document.createElement('section'), controller = new AbortController();
    const dispose = mount({ container, signal: controller.signal });
    expect(dispose).toBeTypeOf('function');
    await vi.waitFor(() => expect(mock.mount).toHaveBeenCalledTimes(1));
    controller.abort(); if (typeof dispose === 'function') dispose();
    expect(mock.mount.mock.results.at(-1)?.value).toHaveBeenCalledTimes(1);
  });
  it('does not create content for an already aborted mount', () => {
    const controller = new AbortController(); controller.abort();
    const container = document.createElement('section'); mount({ container, signal: controller.signal });
    expect(container.childElementCount).toBe(0);
  });
  it('keeps a failed browser view load visible and recoverable by reset', async () => {
    mock.mount.mockImplementationOnce(() => { throw new Error('view initialization failed'); });
    const container = document.createElement('section'), controller = new AbortController();
    const dispose = mount({ container, signal: controller.signal });
    await vi.waitFor(() => expect(container.querySelector('[role="alert"]')?.textContent).toContain('Reset the tool'));
    controller.abort(); if (typeof dispose === 'function') dispose(); expect(container.childElementCount).toBe(0);
  });
});
