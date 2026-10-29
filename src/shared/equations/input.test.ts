import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MathfieldElement } from 'mathlive';
import { createEquationInput, type EquationInput } from './input';

const keyboard = vi.hoisted(() => ({ hide: vi.fn(), show: vi.fn() }));

// Exercise the component's DOM event ordering. Actual MathLive editing and
// keyboard behavior remain covered by the production-browser checks.
vi.mock('mathlive', () => {
  class MockMathfield extends HTMLElement {
    value = '';
    errors: { code: string }[] = [];
    getValue() { return this.value; }
    setValue(value: string) { this.value = value; }
    insert(value: string) { this.value += value; }
  }
  customElements.define('math-field', MockMathfield);
  Object.defineProperty(window, 'mathVirtualKeyboard', {
    configurable: true,
    value: Object.assign(new EventTarget(), { visible: false, hide: keyboard.hide, show: keyboard.show }),
  });
  return { MathfieldElement: MockMathfield, convertLatexToMarkup: () => '', convertLatexToSpeakableText: (latex: string) => latex };
});

const visits: { input: EquationInput; controller: AbortController }[] = [];
afterEach(() => {
  for (const { input, controller } of visits.splice(0)) { input.destroy(); controller.abort(); }
  document.body.replaceChildren(); vi.clearAllMocks();
});
function open() {
  const controller = new AbortController(), onChange = vi.fn();
  const input = createEquationInput({ label: 'Transfer function', value: 's+1', signal: controller.signal, onChange });
  const shell = document.createElement('div'); shell.append(input.element); document.body.append(shell);
  const field = input.element.querySelector<MathfieldElement>('math-field')!;
  visits.push({ input, controller });
  return { input, controller, field, shell, onChange };
}
const keydown = (key: string, modifiers: KeyboardEventInit = {}) => new KeyboardEvent('keydown', { key, bubbles: true, composed: true, cancelable: true, ...modifiers });

describe('equation input keyboard ownership', () => {
  it('blocks Escape before a field default can switch to LaTeX editing mode', () => {
    const { input, field, shell } = open(); field.dataset.editingMode = 'math';
    const nativeDefault = vi.fn(() => { field.dataset.editingMode = 'latex'; });
    const shellShortcut = vi.fn();
    field.addEventListener('keydown', nativeDefault); shell.addEventListener('keydown', shellShortcut);
    const escape = keydown('Escape'); field.dispatchEvent(escape);
    expect(nativeDefault).not.toHaveBeenCalled();
    expect(escape.defaultPrevented).toBe(true);
    expect(shellShortcut).not.toHaveBeenCalled();
    expect(field.dataset.editingMode).toBe('math');
    expect(input.getValue().latex).toBe('s+1');
    expect(keyboard.hide).toHaveBeenCalledOnce();
  });
  it('still lets ordinary typing reach the field and publish its changed draft', () => {
    const { input, field, onChange } = open();
    const nativeTyping = vi.fn((event: KeyboardEvent) => {
      field.value += event.key; field.dispatchEvent(new Event('input', { bubbles: true }));
    });
    field.addEventListener('keydown', nativeTyping);
    const typing = keydown('x'); field.dispatchEvent(typing);
    expect(nativeTyping).toHaveBeenCalledOnce(); expect(typing.defaultPrevented).toBe(false);
    expect(input.getValue().latex).toBe('s+1x');
    expect(onChange).toHaveBeenCalledWith({ latex: 's+1x', empty: false, hasPlaceholders: false, syntaxIssues: [] });
    expect(keyboard.hide).not.toHaveBeenCalled();
  });
  it.each([
    ['f', { ctrlKey: true }, false], ['Home', { metaKey: true }, false], ['a', { ctrlKey: true }, true],
  ] as const)('preserves the native %s shortcut and existing shell propagation', (key, modifiers, reachesShell) => {
    const { field, shell } = open(), nativeDefault = vi.fn(), shellShortcut = vi.fn();
    field.addEventListener('keydown', nativeDefault); shell.addEventListener('keydown', shellShortcut);
    const event = keydown(key, modifiers); field.dispatchEvent(event);
    expect(nativeDefault).toHaveBeenCalledOnce(); expect(event.defaultPrevented).toBe(false);
    expect(shellShortcut).toHaveBeenCalledTimes(reachesShell ? 1 : 0);
    expect(keyboard.hide).not.toHaveBeenCalled();
  });
  it.each(['abort', 'destroy'] as const)('removes the capture handler on %s, even if retained DOM is reused', method => {
    const { input, controller, field, shell } = open(), nativeDefault = vi.fn();
    field.addEventListener('keydown', nativeDefault);
    field.dispatchEvent(keydown('Escape')); expect(keyboard.hide).toHaveBeenCalledOnce();
    if (method === 'abort') controller.abort(); else input.destroy();
    // Retain and reattach references to expose listeners that removal alone
    // would hide; the target listener represents the editor's own behavior.
    input.element.append(field); shell.append(input.element);
    const escape = keydown('Escape'); field.dispatchEvent(escape);
    expect(nativeDefault).toHaveBeenCalledOnce(); expect(escape.defaultPrevented).toBe(false);
    expect(keyboard.hide).toHaveBeenCalledOnce();
  });
});
