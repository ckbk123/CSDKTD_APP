import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../app';

// Real shell, catalogue, lazy workspace and gain solver; only equation rendering is mocked.
vi.mock('../../shared/equations/example-panel', () => ({ mountExamplePanel: () => undefined }));
vi.mock('../../shared/equations/input', () => ({
  createEquationDisplay: (value: string, label: string) => { const n = document.createElement('div'); n.textContent = value; n.setAttribute('aria-label', label); return n; },
  createEquationInput: ({ label, value, signal, onChange }: { label: string; value: string; signal: AbortSignal; onChange: () => void }) => {
    const element = document.createElement('input'); element.value = value; element.setAttribute('aria-label', label); element.addEventListener('input', onChange, { signal }); const destroy = () => element.remove(); signal.addEventListener('abort', destroy, { once: true });
    return { element, getValue: () => ({ latex: element.value, empty: !element.value.trim(), hasPlaceholders: false, syntaxIssues: [] }), setValue: (next: string) => { element.value = next; }, focus: () => element.focus(), destroy };
  },
}));

describe('CS05 active gain scrub with the real shell', () => {
  let root: HTMLDivElement, dispose: (() => void) | undefined;
  beforeEach(() => { vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined); window.history.replaceState(null, '', '#/module/CS05'); root = document.createElement('div'); document.body.append(root); });
  afterEach(() => { dispose?.(); root.remove(); window.history.replaceState(null, '', '#/continuous'); vi.restoreAllMocks(); });
  const gain = () => root.querySelector('[aria-label="Selected exact gain"]')?.textContent;
  function pointer(target: Element, type: string, x = 350): void { const event = new MouseEvent(type, { bubbles: true, cancelable: true, button: 0, clientX: x, clientY: 40 }); Object.defineProperty(event, 'pointerId', { value: 12 }); target.dispatchEvent(event); }
  async function start() { dispose = createApp(root); await vi.waitFor(() => expect(root.querySelector('.cs05-interactive-strip svg')).not.toBeNull()); vi.spyOn(SVGElement.prototype, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 440, height: 90 } as DOMRect); }
  it('restores an exact prior endpoint after preview replacement from stable focus, then allows navigation Escape', async () => {
    await start(); [...root.querySelectorAll('button')].find(n => n.textContent === 'Irrational boundaries')!.click(); [...root.querySelectorAll('button')].find(n => n.textContent === 'Select endpoint 3')!.click(); const before = gain();
    const host = root.querySelector<HTMLElement>('.cs05-interactive-strip')!, release = vi.fn(); Object.assign(host, { setPointerCapture: vi.fn(), hasPointerCapture: () => true, releasePointerCapture: release });
    pointer(host.querySelector('svg')!, 'pointerdown'); expect(document.activeElement).toBe(host); pointer(host, 'pointermove'); await vi.waitFor(() => expect(gain()).not.toBe(before));
    const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }); document.activeElement!.dispatchEvent(escape);
    expect(escape.defaultPrevented).toBe(true); await new Promise(resolve => setTimeout(resolve, 0)); expect(location.hash).toBe('#/module/CS05'); expect(gain()).toBe(before); expect(root.textContent).toContain('Exact endpoint identity retained'); expect(release).toHaveBeenCalledExactlyOnceWith(12);
    document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })); await vi.waitFor(() => expect(root.querySelector('.cs05-interactive-strip')).toBeNull()); expect(location.hash).toBe('#/continuous/stability');
  });
  it('consumes active-scrub Escape when focus was moved to the document body', async () => {
    await start(); const before = gain(), host = root.querySelector<HTMLElement>('.cs05-interactive-strip')!;
    pointer(host.querySelector('svg')!, 'pointerdown'); pointer(host, 'pointermove'); await vi.waitFor(() => expect(gain()).not.toBe(before)); host.blur(); expect(document.activeElement).toBe(document.body);
    const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }); document.activeElement!.dispatchEvent(escape); expect(escape.defaultPrevented).toBe(true); expect(location.hash).toBe('#/module/CS05'); expect(gain()).toBe(before);
  });
});
