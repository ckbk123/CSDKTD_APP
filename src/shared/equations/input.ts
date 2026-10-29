import { MathfieldElement, convertLatexToMarkup, convertLatexToSpeakableText } from 'mathlive';
import 'mathlive/fonts.css';
import 'mathlive/static.css';
import './equations.css';

// Vite emits the imported font CSS and its WOFF2 files as same-origin assets.
// No default CDN/font lookup, remote CAS, sound fetch or speech service is used.
MathfieldElement.fontsDirectory = null;
MathfieldElement.soundsDirectory = null;
MathfieldElement.computeEngine = null;
MathfieldElement.speechEngine = 'local';
window.mathVirtualKeyboard.layouts = [
  {
    label: 'Systems', tooltip: 'Control-system symbols',
    rows: [
      ['s', 'z', 'K', '\\mathrm{j}', '\\omega', '\\zeta', 't', 'k', 'T'],
      ['[7]', '[8]', '[9]', '[+]', '[-]', '[(]', '[)]', '\\frac{#@}{#?}', '#@^{#?}'],
      ['[4]', '[5]', '[6]', '\\times', '\\div', '\\sin', '\\cos', '\\sqrt{#0}', '[backspace]'],
      ['[1]', '[2]', '[3]', '[0]', '[.]', '[=]', '[left]', '[right]', '[hide-keyboard]'],
    ],
  },
  'numeric', 'symbols', 'alphabetic', 'greek',
];

export interface EquationDraft {
  readonly latex: string;
  readonly empty: boolean;
  readonly hasPlaceholders: boolean;
  readonly syntaxIssues: readonly string[];
}

export interface EquationInputOptions {
  readonly label: string;
  readonly value: string;
  readonly signal: AbortSignal;
  readonly onChange?: (draft: EquationDraft) => void;
}

export interface EquationInput {
  readonly element: HTMLElement;
  getValue(): EquationDraft;
  setValue(latex: string): void;
  focus(): void;
  destroy(): void;
}

const displayOnlyMacros = {
  href: { args: 2, def: '#2' },
  htmlData: { args: 2, def: '#2' },
  htmlClass: { args: 2, def: '#2' },
  htmlId: { args: 2, def: '#2' },
  htmlStyle: { args: 2, def: '#2' },
  style: { args: 2, def: '#2' },
  class: { args: 2, def: '#2' },
  cssId: { args: 2, def: '#2' },
};

/** Typesetting only. It does not parse a system, evaluate or verify mathematics. */
export function createEquationDisplay(latex: string, label: string): HTMLElement {
  const output = document.createElement('div');
  output.className = 'equation-display';
  output.setAttribute('role', 'math');
  output.setAttribute('aria-label', `${label}: ${convertLatexToSpeakableText(latex)}`);
  const visual = document.createElement('span');
  visual.setAttribute('aria-hidden', 'true');
  // MathLive-generated markup only: never interpolate raw LaTeX as HTML.
  visual.innerHTML = convertLatexToMarkup(latex, { defaultMode: 'math', macros: displayOnlyMacros });
  output.append(visual);
  return output;
}

/** One caller-owned visual input; removing/destroying it releases the mathfield. */
export function createEquationInput(options: EquationInputOptions): EquationInput {
  const element = document.createElement('div');
  element.className = 'equation-input';
  const label = document.createElement('span');
  label.className = 'equation-label'; label.textContent = options.label;
  const field = new MathfieldElement();
  field.defaultMode = 'math';
  field.smartFence = true;
  field.smartSuperscript = true;
  field.mathVirtualKeyboardPolicy = 'manual';
  field.macros = displayOnlyMacros;
  field.setAttribute('aria-label', options.label);
  field.setAttribute('aria-description', 'Visual equation input. Use the fraction and power buttons, or type with your keyboard.');
  field.value = options.value;
  const tools = document.createElement('div');
  tools.className = 'equation-tools'; tools.setAttribute('role', 'group');
  tools.setAttribute('aria-label', `${options.label} symbols`);
  const issue = document.createElement('p');
  issue.className = 'equation-issue'; issue.setAttribute('role', 'status');
  let destroyed = false;
  let ownsKeyboard = false;
  const listeners = new AbortController();
  // Manual keyboard visibility survives ordinary button focus. Remember the
  // last focused mathfield, without sharing any expression/model state.
  document.addEventListener('focusin', event => {
    const path = event.composedPath();
    if (path.some(node => node instanceof MathfieldElement)) ownsKeyboard = path.includes(field);
  }, { signal: listeners.signal });

  const getValue = (): EquationDraft => {
    const latex = field.getValue('latex');
    return {
      latex,
      empty: !latex.trim(),
      hasPlaceholders: /\\placeholder\b/.test(latex),
      syntaxIssues: field.errors.map(error => error.code),
    };
  };
  function update(notify: boolean): void {
    if (destroyed) return;
    const draft = getValue();
    const message = draft.syntaxIssues.length ? 'Check the equation notation.'
      : draft.empty ? 'Enter an equation.' : draft.hasPlaceholders ? 'Fill in the highlighted boxes.' : '';
    issue.textContent = message; issue.hidden = !message;
    field.setAttribute('aria-invalid', String(draft.syntaxIssues.length > 0));
    if (notify) options.onChange?.(draft);
  }
  function addTool(name: string, text: string, insert: string): void {
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'equation-tool';
    button.textContent = text; button.setAttribute('aria-label', `Insert ${name}`);
    button.title = name;
    if (name === 'fraction') {
      const icon = document.createElement('span'); icon.className = 'equation-fraction-icon';
      icon.setAttribute('aria-hidden', 'true');
      for (const letter of ['a', 'b']) { const row = document.createElement('span'); row.textContent = letter; icon.append(row); }
      button.replaceChildren(icon);
    }
    // Preserve the field selection on pointer use; keyboard activation also works.
    button.addEventListener('pointerdown', event => event.preventDefault(), { signal: listeners.signal });
    button.addEventListener('click', () => {
      field.focus(); field.insert(insert, { format: 'latex', selectionMode: 'placeholder', silenceNotifications: true });
      update(true);
    }, { signal: listeners.signal });
    tools.append(button);
  }
  addTool('fraction', 'a⁄b', '\\frac{#@}{#?}');
  addTool('power', 'xⁿ', '#@^{#?}');
  addTool('square root', '√', '\\sqrt{#0}');
  addTool('subscript', 'xₙ', '#@_{#?}');
  addTool('parentheses', '( )', '\\left(#0\\right)');
  addTool('pi', 'π', '\\pi');
  const keyboard = document.createElement('button');
  keyboard.type = 'button'; keyboard.className = 'equation-tool equation-keyboard';
  keyboard.textContent = 'Math keyboard'; keyboard.setAttribute('aria-label', `Toggle math keyboard for ${options.label}`);
  const syncKeyboard = (): void => keyboard.setAttribute('aria-pressed', String(window.mathVirtualKeyboard.visible));
  keyboard.addEventListener('click', () => {
    const visible = window.mathVirtualKeyboard.visible;
    field.focus(); ownsKeyboard = true;
    if (visible) window.mathVirtualKeyboard.hide(); else window.mathVirtualKeyboard.show();
  }, { signal: listeners.signal });
  window.mathVirtualKeyboard.addEventListener('virtual-keyboard-toggle', syncKeyboard, { signal: listeners.signal });
  syncKeyboard();
  tools.append(keyboard);
  field.addEventListener('input', () => update(true), { signal: listeners.signal });
  field.addEventListener('mount', () => { field.menuItems = []; update(false); }, { signal: listeners.signal });
  // Intercept Escape before MathLive's target handler can enter LaTeX mode.
  element.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    event.preventDefault(); event.stopPropagation(); window.mathVirtualKeyboard.hide();
  }, { capture: true, signal: listeners.signal });
  // Native editing/search shortcuts still reach the field without shell navigation.
  element.addEventListener('keydown', event => {
    if ((event.ctrlKey || event.metaKey) && ['f', 'Home'].includes(event.key)) event.stopPropagation();
  }, { signal: listeners.signal });
  element.append(label, field, tools, issue);

  function destroy(): void {
    if (destroyed) return;
    destroyed = true;
    options.signal.removeEventListener('abort', destroy);
    listeners.abort();
    if (ownsKeyboard) window.mathVirtualKeyboard.hide({ animate: false });
    if (field.contains(document.activeElement) || document.activeElement === field) field.blur();
    field.remove(); element.remove();
  }
  options.signal.addEventListener('abort', destroy, { once: true });
  if (options.signal.aborted) destroy(); else update(false);
  return {
    element, getValue,
    setValue: latex => { if (!destroyed) { field.setValue(latex, { silenceNotifications: true }); update(false); } },
    focus: () => { if (!destroyed) field.focus(); },
    destroy,
  };
}
