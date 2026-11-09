import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EquationInputOptions } from '../../shared/equations/input';
import { createApp } from '../../app';
vi.mock('../../shared/equations/example-panel', () => ({ mountExamplePanel: () => undefined }));
vi.mock('../../shared/equations/input', () => ({
  createEquationDisplay: (value: string, label: string) => { const node = document.createElement('div'); node.textContent = value; node.setAttribute('aria-label', label); return node; },
  createEquationInput: (options: EquationInputOptions) => { const element = document.createElement('div'); const getValue = () => ({ latex: options.value, empty: false, syntaxIssues: [], hasPlaceholders: false }); return { element, getValue, setValue: () => {}, focus: () => {}, destroy: () => element.remove() }; },
}));
describe('DP01 comparison cancellation through the real shell', () => {
  let root: HTMLElement, dispose: (() => void) | undefined;
  beforeEach(() => { vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined); window.history.replaceState(null, '', '#/module/DP01'); root = document.createElement('div'); document.body.append(root); });
  afterEach(() => { dispose?.(); root.remove(); vi.restoreAllMocks(); window.history.replaceState(null, '', '#/discrete'); });
  const field = () => root.querySelector<HTMLInputElement>('[aria-label="Shared comparison radius r"]')!;
  function pointer(target: Element, type: string) { const event = new MouseEvent(type, { bubbles: true, cancelable: true, button: 0, clientX: 220, clientY: 109.090909 }); Object.defineProperty(event, 'pointerId', { value: 11 }); target.dispatchEvent(event); }
  async function start() { dispose = createApp(root); await vi.waitFor(() => expect(root.querySelector('.dp01-explore')).not.toBeNull()); [...root.querySelectorAll('button')].find(button => button.textContent === 'Compare modes')!.click(); vi.spyOn(SVGElement.prototype, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 440, height: 350 } as DOMRect); return root.querySelector<HTMLElement>('.dp01-lab .dp01-responsive-plane')!; }
  it.each([false, true])('restores the start before shell navigation with body focus=%s', async bodyFocus => {
    const host = await start(); pointer(host.querySelector('[data-lab-handle="a"]')!, 'pointerdown'); pointer(host, 'pointermove'); await vi.waitFor(() => expect(field().valueAsNumber).toBeCloseTo(.6, 8)); expect(document.activeElement).toBe(host); if (bodyFocus) host.blur();
    const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }); document.activeElement!.dispatchEvent(escape); expect(escape.defaultPrevented).toBe(true); expect(location.hash).toBe('#/module/DP01'); expect(field().value).toBe('0.8');
    document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })); await vi.waitFor(() => expect(root.querySelector('.dp01-lab')).toBeNull()); expect(location.hash).toBe('#/discrete/plots');
  });
});
