import { describe, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({ mount: vi.fn(() => vi.fn()) }));
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
  it('does nothing for an already aborted visit', () => {
    const controller = new AbortController(); controller.abort(); const container = document.createElement('section');
    expect(mount({ container, signal: controller.signal })).toBeUndefined(); expect(container.childElementCount).toBe(0);
  });
});
