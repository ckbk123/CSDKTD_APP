import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../app';
vi.mock('../../shared/equations/example-panel', () => ({ mountExamplePanel: () => undefined }));
vi.mock('../../shared/equations/input', () => ({
  createEquationDisplay: (value: string, label: string) => { const node = document.createElement('div'); node.textContent = value; node.setAttribute('aria-label', label); return node; },
  createEquationInput: () => { throw new Error('These real-shell tests remain in family Explore.'); },
}));
describe('CS01 pointer cancellation through the real shell', () => {
  let root: HTMLElement, dispose: (() => void) | undefined;
  beforeEach(() => { vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined); window.history.replaceState(null, '', '#/module/CS01'); root = document.createElement('div'); document.body.append(root); });
  afterEach(() => { dispose?.(); root.remove(); vi.restoreAllMocks(); window.history.replaceState(null, '', '#/continuous'); });
  const model = () => root.querySelector('[aria-label="Original characteristic polynomial"]')!.textContent;
  function pointer(target: Element, type: string) { const event = new MouseEvent(type, { bubbles: true, cancelable: true, button: 0, clientX: 194.074074, clientY: 160 }); Object.defineProperty(event, 'pointerId', { value: 11 }); target.dispatchEvent(event); }
  async function start() { dispose = createApp(root); await vi.waitFor(() => expect(root.querySelector('.cs01-family-plane svg')).not.toBeNull()); vi.spyOn(SVGElement.prototype, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 440, height: 350 } as DOMRect); }
  it('consumes active Escape from stable host focus after replacement, preserving hash/model/undo, then permits ordinary navigation', async () => {
    await start(); const before = model(), host = root.querySelector<HTMLElement>('.cs01-family-plane')!; pointer(host.querySelector('[data-family-handle="first"]')!, 'pointerdown'); pointer(host, 'pointermove'); await vi.waitFor(() => expect(model()).not.toBe(before)); expect(document.activeElement).toBe(host); const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }); document.activeElement!.dispatchEvent(escape); expect(escape.defaultPrevented).toBe(true); expect(location.hash).toBe('#/module/CS01'); expect(model()).toBe(before); expect([...root.querySelectorAll('button')].find(button => button.textContent === 'Undo model edit')!.disabled).toBe(true); document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })); await vi.waitFor(() => expect(root.querySelector('.cs01-family-plane')).toBeNull()); expect(location.hash).toBe('#/continuous/stability');
  });
  it('also consumes active Escape if focus was moved to the document body', async () => { await start(); const before = model(), host = root.querySelector<HTMLElement>('.cs01-family-plane')!; pointer(host.querySelector('[data-family-handle="first"]')!, 'pointerdown'); pointer(host, 'pointermove'); await vi.waitFor(() => expect(model()).not.toBe(before)); host.blur(); expect(document.activeElement).toBe(document.body); const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }); document.activeElement!.dispatchEvent(escape); expect(escape.defaultPrevented).toBe(true); expect(location.hash).toBe('#/module/CS01'); expect(model()).toBe(before); });
});
