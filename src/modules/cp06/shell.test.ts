import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../app';

// Real shell/catalogue/lazy workspace plus actual CP06 view; editor rendering is mocked only.
vi.mock('../../shared/equations/example-panel', () => ({ mountExamplePanel: () => undefined }));
vi.mock('../../shared/equations/input', () => ({
  createEquationDisplay: (value: string, label: string) => { const n = document.createElement('div'); n.textContent = value; n.setAttribute('aria-label', label); return n; },
  createEquationInput: ({ label, value, signal, onChange }: { label: string; value: string; signal: AbortSignal; onChange: () => void }) => {
    const element = document.createElement('input'); element.value = value; element.setAttribute('aria-label', label); element.addEventListener('input', onChange, { signal }); const destroy = () => element.remove(); signal.addEventListener('abort', destroy, { once: true });
    return { element, getValue: () => ({ latex: element.value, empty: !element.value.trim(), hasPlaceholders: false, syntaxIssues: [] }), setValue: (next: string) => { element.value = next; }, focus: () => element.focus(), destroy };
  },
}));
describe('CP06 drag Escape ownership with the real shell', () => {
  let root: HTMLDivElement, dispose: (() => void) | undefined;
  beforeEach(() => { vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined); window.history.replaceState(null, '', '#/module/CP06'); root = document.createElement('div'); document.body.append(root); });
  afterEach(() => { dispose?.(); root.remove(); window.history.replaceState(null, '', '#/continuous'); vi.restoreAllMocks(); });
  const button = (label: string) => [...root.querySelectorAll('button')].find(n => n.textContent === label)!;
  const Q = () => root.querySelector('[aria-label="Complete selected characteristic polynomial"]')?.textContent;
  function pointer(target: Element, type: string, x = 280): void { const event = new MouseEvent(type, { bubbles: true, cancelable: true, button: 0, clientX: x, clientY: 204 }); Object.defineProperty(event, 'pointerId', { value: 12 }); target.dispatchEvent(event); }
  async function start() { dispose = createApp(root); await vi.waitFor(() => expect(root.querySelector('.cp-interactive-plane svg')).not.toBeNull()); }
  it('cancels after SVG replacement from stable host focus, preserving hash/model/undo, then allows ordinary Escape', async () => {
    await start(); button('Add zero').click(); const before = Q(), undoEnabled = !button('Undo model edit').disabled;
    const host = root.querySelector<HTMLElement>('.cp-interactive-plane')!; const release = vi.fn(); Object.assign(host, { setPointerCapture: vi.fn(), hasPointerCapture: () => true, releasePointerCapture: release });
    vi.spyOn(SVGElement.prototype, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 480, height: 440 } as DOMRect);
    pointer(host.querySelector('[data-edit-id="pole-2"]')!, 'pointerdown'); expect(document.activeElement).toBe(host); pointer(host, 'pointermove');
    await vi.waitFor(() => expect(host.querySelector('svg')!.dataset.preview).toBe('true'));
    const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }); document.activeElement!.dispatchEvent(escape);
    expect(escape.defaultPrevented).toBe(true); await new Promise(resolve => setTimeout(resolve, 0)); expect(location.hash).toBe('#/module/CP06'); expect(Q()).toBe(before); expect(!button('Undo model edit').disabled).toBe(undoEnabled); expect(release).toHaveBeenCalledExactlyOnceWith(12);
    document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    await vi.waitFor(() => expect(root.querySelector('.cp-interactive-plane')).toBeNull()); expect(location.hash).toBe('#/continuous/plots');
  });
  it('also consumes active-drag Escape if focus was moved to the document body', async () => {
    await start(); const before = Q(), host = root.querySelector<HTMLElement>('.cp-interactive-plane')!;
    vi.spyOn(SVGElement.prototype, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 480, height: 440 } as DOMRect);
    pointer(host.querySelector('[data-edit-id="pole-2"]')!, 'pointerdown'); pointer(host, 'pointermove'); await vi.waitFor(() => expect(host.querySelector('svg')!.dataset.preview).toBe('true'));
    host.blur(); expect(document.activeElement).toBe(document.body);
    const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }); document.activeElement!.dispatchEvent(escape);
    expect(escape.defaultPrevented).toBe(true); expect(location.hash).toBe('#/module/CP06'); expect(Q()).toBe(before); expect(button('Undo model edit').disabled).toBe(true);
  });
});
