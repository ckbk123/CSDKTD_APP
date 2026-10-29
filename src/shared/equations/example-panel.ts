import { findEquationExample } from './examples';
import { createEquationDisplay, createEquationInput, type EquationInput } from './input';

/** Shell preview only. Exercise modules use createEquationInput for real inputs. */
export function mountExamplePanel(container: HTMLElement, moduleId: string, fallback: string, signal: AbortSignal): () => void {
  if (signal.aborted) return () => undefined;
  const example = findEquationExample(moduleId);
  const panel = document.createElement('div'); panel.className = 'equation-example';
  const heading = document.createElement('div'); heading.className = 'equation-example-heading';
  const title = document.createElement('h2'); title.className = 'eyebrow'; title.textContent = 'Default example';
  heading.append(title); panel.append(heading);
  if (!example) {
    const text = document.createElement('p'); text.className = 'example-value'; text.textContent = fallback;
    panel.append(text); container.replaceChildren(panel);
    const remove = (): void => { signal.removeEventListener('abort', remove); panel.remove(); };
    signal.addEventListener('abort', remove, { once: true });
    return remove;
  }
  const edit = document.createElement('button'); edit.type = 'button'; edit.className = 'equation-edit';
  edit.textContent = 'Edit equations'; edit.setAttribute('aria-expanded', 'false'); heading.append(edit);
  const help = document.createElement('p'); help.className = 'equation-help'; help.hidden = true;
  help.textContent = 'Use the buttons to build fractions and powers. Arrow keys move between their parts.';
  panel.append(help);
  const body = document.createElement('div'); body.className = 'equation-parts'; panel.append(body);
  const note = document.createElement('p'); note.className = 'equation-preview-note'; note.hidden = true;
  note.textContent = 'Equation preview only. Changes do not update the workspace.';
  panel.append(note);
  const values = example.parts.map(part => part.kind === 'math' ? part.latex : '');
  let inputs: EquationInput[] = [];
  let editing = false;
  let edited = false;
  let disposed = false;

  function render(): void {
    if (disposed || signal.aborted) return;
    if (inputs.length) window.mathVirtualKeyboard?.hide({ animate: false });
    inputs.forEach(input => input.destroy()); inputs = [];
    body.replaceChildren();
    panel.dataset.editing = String(editing);
    edit.textContent = editing ? 'Done editing' : 'Edit equations';
    edit.setAttribute('aria-expanded', String(editing));
    help.hidden = !editing;
    title.textContent = edited ? 'Example input' : 'Default example';
    note.hidden = !editing && !edited;
    example!.parts.forEach((part, index) => {
      if (part.kind === 'text') {
        const text = document.createElement('p'); text.className = 'equation-context'; text.textContent = part.text;
        body.append(text); return;
      }
      if (editing && part.editable) {
        const input = createEquationInput({ label: part.label, value: values[index], signal,
          onChange: draft => { values[index] = draft.latex; edited = true; title.textContent = 'Example input'; } });
        inputs.push(input); body.append(input.element);
      } else {
        const item = document.createElement('div'); item.className = 'equation-part';
        const label = document.createElement('span'); label.className = 'equation-label'; label.textContent = part.label;
        item.append(label, createEquationDisplay(values[index], part.label)); body.append(item);
      }
    });
  }
  function toggle(): void {
    if (disposed || signal.aborted) return;
    editing = !editing; render(); if (editing) inputs[0]?.focus();
  }
  edit.addEventListener('click', toggle, { signal });
  function dispose(): void {
    if (disposed) return;
    disposed = true; signal.removeEventListener('abort', dispose);
    edit.removeEventListener('click', toggle);
    window.mathVirtualKeyboard?.hide({ animate: false });
    inputs.forEach(input => input.destroy()); inputs = []; panel.remove();
  }
  signal.addEventListener('abort', dispose, { once: true });
  if (signal.aborted) dispose(); else { container.replaceChildren(panel); render(); }
  return dispose;
}
