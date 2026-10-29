import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ModuleManifest, ModuleMount, ModuleWorkspace } from './module';
import { WorkspaceSession } from './workspace-session';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function manifest(id: string, load: () => Promise<ModuleWorkspace>): ModuleManifest {
  return {
    id,
    title: `Test ${id}`,
    description: 'Synthetic module for lifecycle verification.',
    defaultExample: 'value = 12',
    domain: 'continuous',
    category: 'representation',
    load,
  };
}

function immediate(id: string, mount: ModuleMount): ModuleManifest {
  return manifest(id, async () => ({ mount }));
}

describe('WorkspaceSession', () => {
  let container: HTMLDivElement;
  let session: WorkspaceSession;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.append(container);
    session = new WorkspaceSession();
  });

  afterEach(() => {
    session.close();
    container.remove();
  });

  it('clears a shell error message before retrying a failed import', async () => {
    const failure = new Error('Temporarily offline');
    await expect(session.open(manifest('CR01', async () => { throw failure; }), container)).rejects.toBe(failure);
    container.textContent = 'Workspace could not be loaded. Try again.';
    await session.open(immediate('CR01', ({ container: content }) => {
      expect(content.childNodes).toHaveLength(0);
      content.textContent = 'recovered workspace';
    }), container);
    expect(container.textContent).toBe('recovered workspace');
  });

  it('starts a fresh private state when the same module is opened again', async () => {
    const states: { value: number }[] = [];
    const released: number[] = [];
    const example = immediate('CR01', ({ container: content }) => {
      const state = { value: 12 };
      states.push(state);
      content.textContent = String(state.value);
      return () => { released.push(state.value); };
    });

    expect(await session.open(example, container)).toBe(true);
    states[0].value = 77;
    expect(await session.open(example, container)).toBe(true);
    expect(states).toHaveLength(2);
    expect(states[1]).not.toBe(states[0]);
    expect(states[1].value).toBe(12);
    expect(released).toEqual([77]);
    expect(container.textContent).toBe('12');
  });

  it('aborts first and cleans up exactly once while the old DOM is still valid', async () => {
    const events: string[] = [];
    let liveSignal: AbortSignal | undefined;
    const cleanup = vi.fn();
    const example = immediate('CR01', ({ container: content, signal }) => {
      liveSignal = signal;
      const label = document.createElement('span');
      label.textContent = 'Module controls';
      content.append(label);
      signal.addEventListener('abort', () => { events.push('abort'); });
      return () => {
        events.push('cleanup');
        expect(signal.aborted).toBe(true);
        expect(content.contains(label)).toBe(true);
        expect(label.isConnected).toBe(true);
        cleanup();
      };
    });

    await session.open(example, container);
    session.close();
    session.close();
    expect(liveSignal?.aborted).toBe(true);
    expect(events).toEqual(['abort', 'cleanup']);
    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(container.childNodes).toHaveLength(0);
  });

  it('releases the previous module before mounting a different module', async () => {
    const events: string[] = [];
    const first = immediate('CR01', ({ container: content, signal }) => {
      content.textContent = 'first';
      events.push('mount first');
      signal.addEventListener('abort', () => { events.push('abort first'); });
      return () => {
        expect(content.textContent).toBe('first');
        events.push('unmount first');
      };
    });
    const second = immediate('CR02', ({ container: content, signal }) => {
      expect(content.childNodes).toHaveLength(0);
      expect(signal.aborted).toBe(false);
      content.textContent = 'second';
      events.push('mount second');
    });

    await session.open(first, container);
    await session.open(second, container);
    expect(events).toEqual(['mount first', 'abort first', 'unmount first', 'mount second']);
    expect(container.textContent).toBe('second');
  });

  it('also releases the correct container when a new container is supplied', async () => {
    const next = document.createElement('div');
    document.body.append(next);
    try {
      await session.open(immediate('CR01', ({ container: content }) => {
        content.textContent = 'old';
      }), container);
      await session.open(immediate('CR02', ({ container: content }) => {
        content.textContent = 'new';
      }), next);
      expect(container.childNodes).toHaveLength(0);
      expect(next.textContent).toBe('new');
      session.close();
      expect(next.childNodes).toHaveLength(0);
    } finally {
      next.remove();
    }
  });

  it('never mounts a stale import that resolves after a newer module', async () => {
    const oldImport = deferred<ModuleWorkspace>();
    const staleMount = vi.fn();
    const activeCleanup = vi.fn();
    const oldOpen = session.open(manifest('CR01', () => oldImport.promise), container);

    expect(await session.open(immediate('CR02', ({ container: content }) => {
      content.textContent = 'current module';
      return activeCleanup;
    }), container)).toBe(true);
    oldImport.resolve({ mount: staleMount });

    expect(await oldOpen).toBe(false);
    expect(staleMount).not.toHaveBeenCalled();
    expect(activeCleanup).not.toHaveBeenCalled();
    expect(container.textContent).toBe('current module');
  });

  it('keeps the newest route when several imports finish out of order', async () => {
    const first = deferred<ModuleWorkspace>();
    const second = deferred<ModuleWorkspace>();
    const firstMount = vi.fn();
    const secondMount = vi.fn();
    const firstOpen = session.open(manifest('CR01', () => first.promise), container);
    const secondOpen = session.open(manifest('CR02', () => second.promise), container);

    expect(await session.open(immediate('CR03', ({ container: content }) => {
      content.textContent = 'third';
    }), container)).toBe(true);
    second.resolve({ mount: secondMount });
    first.resolve({ mount: firstMount });

    expect(await secondOpen).toBe(false);
    expect(await firstOpen).toBe(false);
    expect(firstMount).not.toHaveBeenCalled();
    expect(secondMount).not.toHaveBeenCalled();
    expect(container.textContent).toBe('third');
  });

  it('invalidates a pending import when the user leaves the workspace', async () => {
    const pending = deferred<ModuleWorkspace>();
    const mount = vi.fn();
    const opened = session.open(manifest('CR01', () => pending.promise), container);
    session.close();
    pending.resolve({ mount });
    expect(await opened).toBe(false);
    expect(mount).not.toHaveBeenCalled();
    expect(container.childNodes).toHaveLength(0);
  });

  it('ignores a stale import failure without clearing the active workspace', async () => {
    const stale = deferred<ModuleWorkspace>();
    const oldOpen = session.open(manifest('CR01', () => stale.promise), container);
    await session.open(immediate('CR02', ({ container: content }) => {
      content.textContent = 'working';
    }), container);
    stale.reject(new Error('Outdated import failed'));
    expect(await oldOpen).toBe(false);
    expect(container.textContent).toBe('working');
  });

  it('rejects an active import failure and remains reusable', async () => {
    const failure = new Error('Cannot load workspace');
    await expect(session.open(manifest('CR01', async () => { throw failure; }), container))
      .rejects.toBe(failure);
    expect(container.childNodes).toHaveLength(0);
    expect(await session.open(immediate('CR02', ({ container: content }) => {
      content.textContent = 'recovered';
    }), container)).toBe(true);
    expect(container.textContent).toBe('recovered');
  });

  it('aborts and clears a partially mounted module that throws', async () => {
    const failure = new Error('Mount failed');
    let failedSignal: AbortSignal | undefined;
    const example = immediate('CR01', ({ container: content, signal }) => {
      failedSignal = signal;
      content.append(document.createElement('button'));
      throw failure;
    });

    await expect(session.open(example, container)).rejects.toBe(failure);
    expect(failedSignal?.aborted).toBe(true);
    expect(container.childNodes).toHaveLength(0);
    session.close();
  });

  it('contains cleanup errors, reports them once and still clears the old DOM', async () => {
    const failure = new Error('Cleanup failed');
    const onCleanupError = vi.fn();
    session = new WorkspaceSession(onCleanupError);
    let signalAtClose: AbortSignal | undefined;
    await session.open(immediate('CR01', ({ container: content, signal }) => {
      signalAtClose = signal;
      content.textContent = 'old controls';
      return () => { throw failure; };
    }), container);

    expect(() => session.close()).not.toThrow();
    expect(signalAtClose?.aborted).toBe(true);
    expect(container.childNodes).toHaveLength(0);
    expect(onCleanupError).toHaveBeenCalledTimes(1);
    expect(onCleanupError).toHaveBeenCalledWith(failure);
    session.close();
    expect(onCleanupError).toHaveBeenCalledTimes(1);
    expect(await session.open(immediate('CR02', ({ container: content }) => {
      content.textContent = 'still usable';
    }), container)).toBe(true);
    expect(container.textContent).toBe('still usable');
  });

  it('also contains cleanup errors when no reporter was supplied', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    session = new WorkspaceSession();
    await session.open(immediate('CR01', () => () => { throw new Error('Cleanup failed'); }), container);
    expect(() => session.close()).not.toThrow();
    expect(container.childNodes).toHaveLength(0);
  });
});
