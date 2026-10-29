import { describe, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({ mount: vi.fn(() => vi.fn()) }));
vi.mock('./view', () => ({ mount: mock.mount }));
import { mount } from './workspace';

describe('CP03 deferred browser view', () => {
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
});
