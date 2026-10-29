import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ModuleMount } from './core/module';
import { createApp } from './app';
import { APP_AUTHOR, APP_NAME, APP_VERSION } from './brand';

const visit = vi.hoisted(() => ({ mount: vi.fn<ModuleMount>(), cleanup: vi.fn() }));

// Test the shell with real catalogue metadata, without importing mathematical
// workspaces or requiring their eventual plotting APIs to run in jsdom.
vi.mock('./modules/catalog', async importOriginal => {
  const actual = await importOriginal<typeof import('./modules/catalog')>();
  return {
    ...actual,
    findModule: (id: string) => {
      const manifest = actual.findModule(id);
      return manifest ? { ...manifest, load: async () => ({ mount: visit.mount }) } : undefined;
    },
  };
});

describe('application header', () => {
  let root: HTMLDivElement;
  let dispose: (() => void) | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    window.history.replaceState(null, '', '#/continuous');
    root = document.createElement('div');
    document.body.append(root);
    visit.mount.mockImplementation(({ container }) => {
      const content = document.createElement('p');
      content.textContent = 'Fixture exercise';
      container.append(content);
      return visit.cleanup;
    });
  });

  afterEach(() => {
    dispose?.();
    dispose = undefined;
    root.remove();
  });

  function start(hash = '#/continuous'): void {
    window.history.replaceState(null, '', hash);
    dispose = createApp(root);
  }

  function navigate(hash: string): void {
    window.history.replaceState(null, '', hash);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  }

  function search(): HTMLInputElement {
    const input = root.querySelector<HTMLInputElement>('#module-search');
    expect(input).not.toBeNull();
    return input!;
  }

  function enterQuery(value: string): void {
    search().value = value;
    search().dispatchEvent(new Event('input', { bubbles: true }));
  }

  function resultIds(): (string | undefined)[] {
    return Array.from(root.querySelectorAll<HTMLElement>('.module-card'), card => card.dataset.moduleId);
  }

  function submitSearch(): void {
    expect(search().form).not.toBeNull();
    search().form!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  }

  function press(key: string, options: KeyboardEventInit = {}): KeyboardEvent {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...options });
    window.dispatchEvent(event);
    return event;
  }

  it('identifies Control Studio, its version and author across navigation', () => {
    start();
    const header = root.querySelector('.app-header')!;
    const brand = header.querySelector<HTMLAnchorElement>(`a[aria-label="${APP_NAME} home"]`);
    expect(brand).not.toBeNull();
    expect(brand!.textContent).toContain(APP_NAME);
    expect(brand!.querySelector('img')?.alt).toBe('');
    expect(header.textContent).toContain(`v${APP_VERSION} · ${APP_AUTHOR}`);
    expect(document.title).toBe(APP_NAME);

    const input = search();
    navigate('#/module/DR01');
    expect(search()).toBe(input);
    expect(header.isConnected).toBe(true);
    expect(brand!.getAttribute('href')).toBe('#/discrete');
    expect(document.title).toBe(`Z transforms · ${APP_NAME}`);
  });

  it('filters only the current domain and topic, and clears search on navigation', () => {
    start('#/discrete/representation');
    const input = search();
    expect(resultIds()).toHaveLength(5);
    enterQuery('DR01');
    expect(resultIds()).toEqual(['DR01']);
    expect(location.hash).toBe('#/discrete/representation');
    enterQuery('DP01');
    expect(resultIds()).toEqual([]);
    expect(root.textContent).toContain('No matching modules');
    enterQuery('');
    expect(resultIds()).toHaveLength(5);

    enterQuery('DR01');
    navigate('#/discrete/plots');
    expect(search()).toBe(input);
    expect(input.value).toBe('');
    expect(resultIds()).toHaveLength(4);

    navigate('#/discrete');
    enterQuery('DR01');
    expect(resultIds()).toEqual(['DR01']);
    root.querySelector<HTMLAnchorElement>(`a[aria-label="${APP_NAME} home"]`)!.click();
    expect(input.value).toBe('');
    expect(root.querySelector('.results-count')?.textContent).toBe('Topics');
  });

  it('submits a module-page search into its domain and releases that exercise', async () => {
    start('#/module/DR01');
    await vi.waitFor(() => expect(visit.mount).toHaveBeenCalledTimes(1));
    const context = visit.mount.mock.calls[0][0];
    const input = search();
    enterQuery('DP01');
    expect(location.hash).toBe('#/module/DR01');
    expect(context.signal.aborted).toBe(false);

    submitSearch();
    await vi.waitFor(() => expect(resultIds()).toEqual(['DP01']));
    expect(location.hash).toBe('#/discrete');
    expect(search()).toBe(input);
    expect(input.value).toBe('DP01');
    expect(document.activeElement).toBe(input);
    expect(context.signal.aborted).toBe(true);
    expect(visit.cleanup).toHaveBeenCalledTimes(1);
  });

  it('recovers from a missing page through search in the last selected domain', async () => {
    start('#/discrete');
    navigate('#/unknown-page');
    expect(root.textContent).toContain('Page not found');
    enterQuery('DP01');
    submitSearch();

    await vi.waitFor(() => expect(resultIds()).toEqual(['DP01']));
    expect(location.hash).toBe('#/discrete');
    expect(search().value).toBe('DP01');
    expect(document.activeElement).toBe(search());
  });

  it('toggles compact search and supports keyboard focus and dismissal', () => {
    start();
    const toggle = root.querySelector<HTMLButtonElement>('button[aria-label="Open module search"]');
    expect(toggle).not.toBeNull();
    expect(toggle!.getAttribute('aria-expanded')).toBe('false');
    toggle!.click();
    expect(toggle!.getAttribute('aria-expanded')).toBe('true');
    toggle!.click();
    expect(toggle!.getAttribute('aria-expanded')).toBe('false');

    const find = press('f', { ctrlKey: true });
    expect(find.defaultPrevented).toBe(true);
    expect(toggle!.getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement).toBe(search());
    enterQuery('CR01');
    press('Escape');
    expect(search().value).toBe('');
    press('Escape');
    expect(toggle!.getAttribute('aria-expanded')).toBe('false');
  });

  it('leaves consumed module shortcuts alone and otherwise returns to its topic', async () => {
    start('#/module/DR01');
    for (const options of [{ key: 'Escape' }, { key: 'Home', ctrlKey: true }]) {
      const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...options });
      event.preventDefault();
      window.dispatchEvent(event);
      expect(location.hash).toBe('#/module/DR01');
    }

    press('Escape');
    await vi.waitFor(() => expect(root.querySelector('h1')?.textContent).toBe('System Representation'));
    expect(location.hash).toBe('#/discrete/representation');
  });
});
