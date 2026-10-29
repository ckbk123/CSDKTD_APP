import { beforeEach, describe, expect, it, vi } from 'vitest';
const stub = vi.hoisted(() => ({ mount: vi.fn(), cleanup: vi.fn() }));
vi.mock('./view', () => ({ mount: stub.mount }));
import { mount } from './workspace';

beforeEach(() => {
  stub.mount.mockReset(); stub.cleanup.mockReset(); stub.mount.mockReturnValue(stub.cleanup);
});

describe('DR05 synchronous lazy mount', () => {
  it('loads the view and runs its returned cleanup', async () => {
    const container = document.createElement('div'); const controller = new AbortController();
    const cleanup = mount({ container, signal: controller.signal });
    expect(typeof cleanup).toBe('function');
    await vi.waitFor(() => expect(stub.mount).toHaveBeenCalledOnce());
    controller.abort(); if (typeof cleanup === 'function') cleanup();
    expect(stub.cleanup).toHaveBeenCalledOnce();
    expect(container.textContent).toBe('');
  });
  it('never mounts a view if navigation aborts before the import resolves', async () => {
    const container = document.createElement('div'); const controller = new AbortController();
    const cleanup = mount({ container, signal: controller.signal });
    controller.abort(); if (typeof cleanup === 'function') cleanup();
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(stub.mount).not.toHaveBeenCalled();
    expect(container.textContent).toBe('');
  });
  it('reattaches a recovery message when the view throws after loading was removed', async () => {
    stub.mount.mockImplementationOnce(() => { throw new Error('View failed'); });
    const container = document.createElement('div'); const controller = new AbortController();
    const cleanup = mount({ container, signal: controller.signal });
    await vi.waitFor(() => expect(container.textContent).toContain('Reset the tool to try again'));
    controller.abort(); if (typeof cleanup === 'function') cleanup();
    expect(container.textContent).toBe(''); expect(stub.cleanup).not.toHaveBeenCalled();
  });
});
