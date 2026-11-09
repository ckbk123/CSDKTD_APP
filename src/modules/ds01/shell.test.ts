import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EquationInputOptions } from '../../shared/equations/input';
import { createApp } from '../../app';
vi.mock('../../shared/equations/example-panel', () => ({ mountExamplePanel: () => undefined }));
vi.mock('../../shared/equations/input', () => ({
  createEquationDisplay: (value: string, label: string) => { const node = document.createElement('div'); node.textContent = value; node.setAttribute('aria-label', label); return node; },
  createEquationInput: (options: EquationInputOptions) => { const element = document.createElement('div'); const getValue = () => ({ latex: options.value, empty: false, syntaxIssues: [], hasPlaceholders: false }); return { element, getValue, setValue: () => {}, focus: () => {}, destroy: () => element.remove() }; },
}));
describe('DS01 cancellation through the real application shell', () => {
  let root: HTMLElement, dispose: (() => void) | undefined;
  beforeEach(() => { vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined); window.history.replaceState(null, '', '#/module/DS01'); root = document.createElement('div'); document.body.append(root); });
  afterEach(() => { dispose?.(); root.remove(); vi.restoreAllMocks(); window.history.replaceState(null, '', '#/discrete'); });
  const model = () => root.querySelector('[aria-label="Checked reduced zero-state input/output transfer function"]')!.textContent;
  function pointer(target: Element, type: string) { const event = new MouseEvent(type, { bubbles: true, cancelable: true, button: 0, clientX: 239.090909, clientY: 134.545455 }); Object.defineProperty(event, 'pointerId', { value: 11 }); target.dispatchEvent(event); }
  async function start() { dispose = createApp(root); await vi.waitFor(() => expect(root.querySelector('.ds01-responsive-plane svg')).not.toBeNull()); vi.spyOn(SVGElement.prototype, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 440, height: 350 } as DOMRect); }
  it('consumes Escape from stable focus after preview replacement and then permits ordinary navigation', async () => {
    await start(); const before = model(), host = root.querySelector<HTMLElement>('.ds01-responsive-plane')!; pointer(host.querySelector('[data-row-handle="1"]')!, 'pointerdown'); pointer(host, 'pointermove'); await vi.waitFor(() => expect(model()).not.toBe(before)); expect(document.activeElement).toBe(host); const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }); document.activeElement!.dispatchEvent(escape); expect(escape.defaultPrevented).toBe(true); expect(location.hash).toBe('#/module/DS01'); expect(model()).toBe(before); expect([...root.querySelectorAll('button')].find(button => button.textContent === 'Undo')!.disabled).toBe(true); document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })); await vi.waitFor(() => expect(root.querySelector('.ds01-responsive-plane')).toBeNull()); expect(location.hash).toBe('#/discrete/stability');
  });
  it('consumes active Escape even if focus has moved to document.body', async () => { await start(); const before = model(), host = root.querySelector<HTMLElement>('.ds01-responsive-plane')!; pointer(host.querySelector('[data-row-handle="1"]')!, 'pointerdown'); pointer(host, 'pointermove'); await vi.waitFor(() => expect(model()).not.toBe(before)); host.blur(); expect(document.activeElement).toBe(document.body); const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }); document.activeElement!.dispatchEvent(escape); expect(escape.defaultPrevented).toBe(true); expect(location.hash).toBe('#/module/DS01'); expect(model()).toBe(before); });
});
