import type { ModuleMount } from '../../core/module';
import { readNumericInput } from '../../shared/numeric-input';
import { createEquationDisplay, createEquationInput, type EquationDraft } from '../../shared/equations/input';
import { BASELINE, commit, forms, latexNumber, numberText as fmt, parseTransfer, preview, sample, type Calculation, type InputKind, type Memory, type Model } from './math';
import './workspace.css';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, text = '', className = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag); node.textContent = text; node.className = className; return node;
}
function numberInput(label: string, value: string): { label: HTMLLabelElement; input: HTMLInputElement } {
  const wrapper = el('label', label), input = el('input');
  input.type = 'number'; input.step = 'any'; input.value = value; input.setAttribute('aria-label', label); wrapper.append(input);
  return { label: wrapper, input };
}
function numeric(input: HTMLInputElement, name: string, limit = 1e6): number {
  const value = readNumericInput(input, name);
  if (Math.abs(value) > limit) throw new Error(`${name} must be a finite number with magnitude at most ${limit.toLocaleString()}.`);
  return value;
}
interface Row { k: number; t: number; u: number; y: number; zero: number }
interface Shift { channel: 'u' | 'y'; delay: number; old: number; next: number; source: string }

export const mount: ModuleMount = ({ container, signal }) => {
  const root = el('div', '', 'dr02');
  const modelSection = el('details', '', 'setup-panel'), settingsSection = el('details', '', 'setup-panel'), stepSection = el('section', '', 'execution'), resultsSection = el('section', '', 'trace');
  modelSection.append(el('summary', 'Edit the transfer function and inspect its conversion'));
  settingsSection.append(el('summary', 'Set the initial delay memory'));
  root.append(stepSection, resultsSection, settingsSection, modelSection); container.append(root);
  const status = el('p', '', 'notice'); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
  root.prepend(status);
  let draft: EquationDraft, model: Model = parseTransfer(BASELINE);
  let memory: Memory, zeroMemory: Memory, calculation: Calculation | undefined;
  let ready = false, modelDirty = false, selected = '', period = .1, amplitude = 1, kind: InputKind = 'held';
  let rows: Row[] = [];
  let inspected = 0, lastWrite: { k: number; shifts: Shift[] } | undefined;
  const historyInputs: { channel: 'y' | 'u'; input: HTMLInputElement }[] = [];
  const on = (node: HTMLElement, event: string, fn: () => void) => node.addEventListener(event, () => { if (!signal.aborted) fn(); }, { signal });
  const button = (text: string, fn: () => void, primary = false) => { const b = el('button', text, primary ? 'primary' : ''); b.type = 'button'; on(b, 'click', fn); return b; };
  const showError = (error: unknown) => { status.textContent = error instanceof Error ? error.message : 'Check the exercise data.'; };
  function invalidate(message: string): void {
    ready = false; calculation = undefined; rows = []; registerView.replaceChildren(); arithmetic.replaceChildren(); plot.replaceChildren(); tableView.replaceChildren(); position.textContent = 'Restart the experiment to use the current settings.';
    selectedDetail.replaceChildren(); shiftView.replaceChildren(); outputPreview.replaceChildren(); traceReadout.replaceChildren(); traceError.textContent = '';
    traceControls.hidden = true; phaseList.replaceChildren(); stepSection.dataset.phase = 'pending';
    previewButton.disabled = true; commitButton.disabled = true; status.textContent = message;
  }
  const currentRecurrence = el('div', '', 'current-recurrence');
  modelSection.append(el('p', 'Edit a scalar transfer function, then divide numerator and denominator by the highest denominator power of z. This exposes one coefficient for each delay.'));
  const equation = createEquationInput({ label: 'Transfer function G(z)', value: BASELINE, signal, onChange: next => {
    draft = next; modelDirty = true; derived.replaceChildren(); currentRecurrence.replaceChildren(); invalidate('Equation changed. Apply the transfer function to rebuild the recurrence and memory slots.');
  } });
  equation.element.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); window.mathVirtualKeyboard.hide(); }
  }, { capture: true, signal });
  draft = equation.getValue();
  const derived = el('div');
  const apply = () => {
    try {
      draft = equation.getValue();
      if (draft.empty || draft.hasPlaceholders || draft.syntaxIssues.length) throw new Error('Complete the equation and check its notation before applying.');
      model = parseTransfer(draft.latex); modelDirty = false;
      renderForms(); buildHistory(); restart();
    } catch (error) { modelDirty = true; derived.replaceChildren(); currentRecurrence.replaceChildren(); invalidate(''); showError(error); }
  };
  const modelActions = el('div', '', 'actions'); modelActions.append(button('Apply transfer function', apply, true));
  const presets: [string, string][] = [
    ['Baseline', BASELINE],
    ['Second-order example', String.raw`G(z)=\frac{0.5z+0.25}{z^2-0.5z+0.125}`],
    ['Three-sample sum', String.raw`G(z)=1+z^{-1}+z^{-2}`],
    ['Future-input example', String.raw`G(z)=\frac{z^2+1}{z+1}`],
  ];
  for (const [label, value] of presets) modelActions.append(button(label, () => { equation.setValue(value); draft = equation.getValue(); apply(); }));
  modelSection.append(equation.element, modelActions, el('p', 'Supported: one fraction of real polynomials in z, sums, products, visible parentheses and integer powers −6…6; at most six delays after normalization. Keep the whole signed exponent inside its power box. Separate a following numeric factor with ×. Enter decimal coefficients such as 0.01. The editor treats e/E as symbols, so e/E numeric input is unsupported. Unknown parameters and functions are unsupported. Coefficients are ordered by increasing delay: a₀, a₁, … and b₀, b₁, ….', 'muted'), derived);
  function renderForms(): void {
    const f = forms(model);
    currentRecurrence.replaceChildren(createEquationDisplay(f.recurrence, 'Active recurrence'));
    derived.replaceChildren(createEquationDisplay(f.z, 'Transfer function in z'), createEquationDisplay(f.delay, 'Transfer function in unit delays'),
      el('p', 'Divide both polynomials by the highest denominator power of z and its leading coefficient, so a₀ = 1. Displayed values are rounded to 9 significant digits; calculation uses the entered coefficients.', 'muted'), createEquationDisplay(f.recurrence, 'Isolated present output'));
  }

  settingsSection.append(el('p', 'The transfer function describes zero initial conditions. Nonzero history adds a separate response without changing G(z). These values fill the delay slots before computing y[0].'));
  const t = numberInput('Sample period T (s)', '0.1'), a = numberInput('Input amplitude / ramp slope', '1');
  const typeLabel = el('label', 'Input for k ≥ 0'), type = el('select'); type.setAttribute('aria-label', 'Input for k ≥ 0');
  for (const [value, label] of [['held', 'Held constant A'], ['impulse', 'Unit-sample pulse Aδ[k]'], ['ramp', 'Physical ramp A·kT']]) { const o = el('option', label); o.value = value; type.append(o); }
  typeLabel.append(type);
  const controls = el('div', '', 'controls experiment-controls'); controls.append(typeLabel, a.label, t.label);
  for (const input of [t.input, a.input, type]) on(input, 'input', () => invalidate('Settings changed. Restart with this history before calculating.'));
  const histories = el('div', '', 'controls'), settingsActions = el('div', '', 'actions');
  settingsActions.append(button('Restart with this history', restart, true), button('Set history to zero', () => { for (const field of historyInputs) field.input.value = '0'; restart(); }), button('Try nonzero memory', () => { for (const field of historyInputs) field.input.value = '0'; if (historyInputs[0]) historyInputs[0].input.value = '1'; restart(); }));
  settingsSection.append(histories, el('p', 'Editing history leaves the transfer function unchanged. Use Restart with this history beside the execution controls to fill every initial slot together.', 'muted'), el('p', 'Timing: k = 0 is the first computed output; t = kT. Held baseline input starts at u[0] = 1, while u[−1] = 0. Thus y[0] = 0 and y[1] ≈ 0.095163. Input/output units are arbitrary but consistent; ramp slope is input units/s. No feedback connection is imposed.', 'muted'));
  function buildHistory(): void {
    histories.replaceChildren(); historyInputs.length = 0;
    for (const channel of ['y', 'u'] as const) {
      const count = (channel === 'y' ? model.a : model.b).length - 1;
      for (let delay = 1; delay <= count; delay++) {
        const control = numberInput(`${channel}[−${delay}] initial memory`, '0');
        historyInputs.push({ channel, input: control.input }); histories.append(control.label);
        on(control.input, 'input', () => invalidate('History changed. Restart to apply it; the transfer function is unchanged.'));
      }
    }
    if (!historyInputs.length) histories.append(el('p', 'This model has no delay memory.', 'muted'));
  }
  function restart(): void {
    try {
      if (modelDirty) throw new Error('Apply the edited transfer function before restarting.');
      const nextPeriod = numeric(t.input, 'Sample period'), nextAmplitude = numeric(a.input, 'Input amplitude');
      const nextKind = type.value as InputKind;
      sample(nextKind, nextAmplitude, 0, nextPeriod);
      const y = historyInputs.filter(f => f.channel === 'y').map(f => numeric(f.input, 'Output history'));
      const u = historyInputs.filter(f => f.channel === 'u').map(f => numeric(f.input, 'Input history'));
      const initial = { k: 0, y, u };
      preview(model, initial, sample(nextKind, nextAmplitude, 0, nextPeriod));
      memory = initial; zeroMemory = { k: 0, y: y.map(() => 0), u: u.map(() => 0) };
      period = nextPeriod; amplitude = nextAmplitude; kind = nextKind; ready = true; rows = []; calculation = undefined; selected = ''; lastWrite = undefined; inspected = 0;
      prediction.input.value = ''; renderStep(); renderRows(); status.textContent = 'Ready at k = 0. Predict the output, reveal the old-value arithmetic, then commit the memory update.';
    } catch (error) { invalidate(''); showError(error); }
  }

  stepSection.append(el('h3', 'Execute one sample through memory'), el('p', 'Select an old value, predict the output, then reveal its products. Commit writes every delay from the same old snapshot.'), currentRecurrence);
  const workbench = el('div', '', 'workbench'), actionPane = el('div', '', 'action-pane'), memoryPane = el('div', '', 'memory-pane');
  stepSection.append(workbench); workbench.append(memoryPane, actionPane);
  const phaseList = el('ol', '', 'phases'), outputPreview = el('div', '', 'output-preview'); phaseList.setAttribute('aria-label', 'Sample execution phases');
  const position = el('p'), registerView = el('div'), prediction = numberInput('Your predicted y[k] (optional)', '');
  const previewButton = button('Reveal arithmetic', () => {
    try {
      calculation = preview(model, memory, sample(kind, amplitude, memory.k, period));
      if (!calculation.terms.some(term => `${term.channel}:${term.delay}` === selected)) { const first = calculation.terms.find(term => term.coefficient !== 0); selected = first ? `${first.channel}:${first.delay}` : ''; }
      renderStep();
      const guess = prediction.input.value.trim();
      status.textContent = guess ? (Math.abs(numeric(prediction.input, 'Prediction', 1e12) - calculation.output) <= 1e-6 * Math.max(1, Math.abs(calculation.output)) ? 'Prediction agrees within 10⁻⁶ relative/absolute tolerance. Commit to shift memory.' : `Compare your prediction with y[${memory.k}] = ${fmt(calculation.output)}. Memory is still unchanged.`) : 'Arithmetic revealed. Memory is still unchanged; commit when you are ready.';
    } catch (error) { showError(error); }
  }, true);
  const commitButton = button('Commit sample & shift memory', () => {
    try {
      if (!ready || !calculation) return;
      const input = sample(kind, amplitude, memory.k, period), output = calculation.output;
      const zero = preview(model, zeroMemory, input).output;
      const next = commit(model, memory, input), nextZero = commit(model, zeroMemory, input);
      lastWrite = { k: memory.k, shifts: shiftsFor(output, input) };
      rows.push({ k: memory.k, t: memory.k * period, u: input, y: output, zero });
      inspected = rows.length - 1;
      memory = next; zeroMemory = nextZero; calculation = undefined; prediction.input.value = ''; selected = '';
      renderStep(); renderRows(); status.textContent = `Committed y[${memory.k - 1}] = ${fmt(output)}. ${memory.k === 128 ? '128-sample limit reached; restart to continue.' : `All delays shifted together. Next sample: k = ${memory.k}.`}`;
    } catch (error) { showError(error); }
  });
  const stepActions = el('div', '', 'actions'); stepActions.append(previewButton, commitButton);
  const arithmetic = el('div'), arithmeticDetails = el('details', '', 'arithmetic-details'), selectedDetail = el('div', '', 'selected-detail'), shiftView = el('div', '', 'shift-view');
  arithmeticDetails.append(el('summary', 'Inspect all products and the full sum'), arithmetic);
  stepSection.insertBefore(phaseList, workbench);
  actionPane.append(controls, prediction.label, stepActions, outputPreview, settingsActions);
  memoryPane.append(el('h4', 'Old values available now'), position, registerView, selectedDetail, shiftView);
  stepSection.append(arithmeticDetails);
  function sourceLabel(channel: 'u' | 'y', delay: number): string { return `${channel}[k${delay ? `−${delay}` : ''}]`; }
  function shiftsFor(output: number, input: number): Shift[] {
    return (['u', 'y'] as const).flatMap(channel => {
      const old = memory[channel];
      return old.map((value, i) => ({ channel, delay: i + 1, old: value, next: i ? old[i - 1] : channel === 'u' ? input : output, source: sourceLabel(channel, i) }));
    });
  }
  function renderShifts(shifts: readonly Shift[], title: string): void {
    shiftView.replaceChildren(el('h4', title));
    if (!shifts.length) { shiftView.append(el('p', 'No delays in this model. Commit records the output sample without storing a delay.', 'muted')); return; }
    const list = el('div', '', 'shift-list');
    for (const shift of shifts) {
      const row = el('div', '', 'shift-row'); row.dataset.destination = `${shift.channel}:${shift.delay}`;
      row.append(el('span', `${sourceLabel(shift.channel, shift.delay)} slot`), el('span', fmt(shift.old), 'old-value'), el('span', '→', 'shift-arrow'), el('strong', fmt(shift.next), 'next-value'), el('span', `from ${shift.source}`, 'muted')); list.append(row);
    }
    shiftView.append(list, el('p', calculation ? 'Preview only: none of these slots has been written. Commit applies every arrow together.' : 'All arrows used the prior snapshot; a newly written slot never fed another write.', 'muted'));
  }
  function selectSource(event: Event): void {
    const target = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('button[data-source]') : null;
    if (!target || !ready) return;
    const host = registerView.contains(target) ? registerView : arithmetic, keepFocus = target === document.activeElement;
    selected = target.dataset.source!; renderStep();
    if (keepFocus) host.querySelector<HTMLButtonElement>(`button[data-source="${selected}"]`)?.focus({ preventScroll: true });
  }
  registerView.addEventListener('click', selectSource, { signal }); arithmetic.addEventListener('click', selectSource, { signal });
  function renderStep(): void {
    if (!ready) return;
    previewButton.disabled = memory.k >= 128; commitButton.disabled = !calculation;
    stepSection.dataset.phase = memory.k >= 128 ? 'complete' : calculation ? 'commit' : 'read';
    phaseList.replaceChildren();
    for (const [i, name] of ['Read old values', 'Reveal the products', 'Commit all delays'].entries()) {
      const active = memory.k < 128 && i === (calculation ? 2 : 0), item = el('li', name, active ? 'active' : calculation && i < 2 ? 'done' : '');
      if (active) item.setAttribute('aria-current', 'step'); phaseList.append(item);
    }
    position.textContent = `Current sample k = ${memory.k}, time ${fmt(memory.k * period)} s. ${calculation ? 'Old memory is frozen until commit.' : 'Output is hidden until reveal.'}`;
    registerView.replaceChildren(); arithmetic.replaceChildren(); selectedDetail.replaceChildren(); outputPreview.replaceChildren(); shiftView.replaceChildren();
    if (memory.k >= 128) {
      position.textContent = '128 samples committed. Restart to run another experiment.';
      if (lastWrite) renderShifts(lastWrite.shifts, `Last simultaneous write: k = ${lastWrite.k} → ${lastWrite.k + 1}`);
      return;
    }
    const current = sample(kind, amplitude, memory.k, period);
    const sources = [
      ...model.b.map((coefficient, delay) => ({ channel: 'u' as const, delay, coefficient, value: delay ? memory.u[delay - 1] : current })),
      ...model.a.slice(1).map((coefficient, i) => ({ channel: 'y' as const, delay: i + 1, coefficient: -coefficient, value: memory.y[i] })),
    ];
    if (!sources.some(term => `${term.channel}:${term.delay}` === selected)) { const first = sources.find(term => term.coefficient !== 0) ?? sources[0]; selected = `${first.channel}:${first.delay}`; }
    const bank = el('div', '', 'registers'); registerView.append(bank);
    function slot(channel: 'u' | 'y', delay: number, value: number, coefficient: number): void {
      const key = `${channel}:${delay}`, cell = el('button', '', `slot${selected === key ? ' selected' : ''}`); cell.type = 'button'; cell.dataset.source = key; cell.dataset.value = String(value);
      cell.setAttribute('aria-pressed', String(selected === key)); cell.setAttribute('aria-label', `Inspect ${sourceLabel(channel, delay)} ${delay ? 'old delay value' : 'current input'}`);
      cell.append(el('span', sourceLabel(channel, delay), 'slot-name'), el('span', delay ? `Old value · delay ${delay}` : 'Current input · no delay', 'muted'), el('strong', fmt(value)), el('span', `× ${fmt(coefficient)}`, 'multiplier'));
      bank.append(cell);
    }
    sources.forEach(term => slot(term.channel, term.delay, term.value, term.coefficient));
    const chosen = sources.find(term => `${term.channel}:${term.delay}` === selected)!;
    selectedDetail.append(el('h4', `${sourceLabel(chosen.channel, chosen.delay)} → multiply → sum`));
    const product = calculation?.terms.find(term => `${term.channel}:${term.delay}` === selected)?.contribution;
    selectedDetail.append(createEquationDisplay(`(${latexNumber(chosen.coefficient)})\\times(${latexNumber(chosen.value)})=${product === undefined ? '?' : latexNumber(product)}`, 'Selected source product'));
    selectedDetail.append(el('p', chosen.channel === 'y' ? 'This is an old output. Its multiplier is −aᵢ from the denominator; the new y[k] is not stored here yet.' : chosen.delay ? 'This input was stored at an earlier sample. It keeps its old value throughout the calculation.' : 'Direct feedthrough uses the current input without a delay.', 'muted'));
    if (calculation) {
      outputPreview.append(createEquationDisplay(`y[${memory.k}]=${latexNumber(calculation.output)}`, 'Revealed output at current sample'), el('p', 'Computed, not committed. The old values above are unchanged.', 'muted'));
      renderShifts(shiftsFor(calculation.output, current), 'Next snapshot · not written yet');
    } else {
      outputPreview.append(el('p', 'Output hidden until Reveal arithmetic.', 'muted'));
      if (lastWrite) renderShifts(lastWrite.shifts, `Last simultaneous write: k = ${lastWrite.k} → ${lastWrite.k + 1}`);
      else shiftView.append(el('p', 'Reveal to preview every write. Commit is the only action that shifts memory.', 'muted'));
    }
    if (!calculation) return;
    arithmetic.append(createEquationDisplay(`y[${memory.k}]=${calculation.terms.map(term => `(${latexNumber(term.coefficient)})(${latexNumber(term.value)})`).join('+')}=${latexNumber(calculation.output)}`, 'Computed from unchanged old samples'));
    const scroll = el('div', '', 'scroll'), table = el('table'), head = el('thead'), hrow = el('tr');
    for (const title of ['Select source', 'Coefficient', 'Old value', 'Contribution']) hrow.append(el('th', title)); head.append(hrow); table.append(head);
    const body = el('tbody');
    for (const term of calculation.terms) {
      const key = `${term.channel}:${term.delay}`, row = el('tr', '', selected === key ? 'selected' : '');
      const td = el('td'), select = el('button', sourceLabel(term.channel, term.delay)); select.type = 'button'; select.dataset.source = key;
      select.setAttribute('aria-pressed', String(selected === key)); td.append(select); row.append(td);
      for (const v of [term.coefficient, term.value, term.contribution]) row.append(el('td', fmt(v)));
      body.append(row);
    }
    table.append(body); scroll.append(table); arithmetic.append(scroll, el('p', 'These products use the old snapshot. Only Commit writes y[k] and u[k] into the first delays and shifts older values toward the next slot.', 'muted'));
  }

  resultsSection.append(el('h3', 'Follow the committed samples'), el('p', 'Each commit adds one sample. Compare supplied history with zero history under the same model and future input. Selecting an earlier sample changes this view only; it never shifts the current registers.'));
  const plot = el('div'), tableView = el('div', '', 'scroll'); tableView.tabIndex = 0; tableView.setAttribute('aria-label', 'Scrollable committed sample table');
  const traceControls = el('div', '', 'controls trace-controls'), traceIndex = numberInput('Inspect committed sample k', '0'), traceSlider = el('input'), traceReadout = el('div', '', 'trace-readout'), traceError = el('p', '', 'muted');
  traceIndex.input.min = '0'; traceIndex.input.step = '1'; traceSlider.type = 'range'; traceSlider.min = '0'; traceSlider.step = '1'; traceSlider.setAttribute('aria-label', 'Committed sample cursor'); traceError.setAttribute('role', 'status');
  const sliderLabel = el('label', 'Move the committed-sample cursor'); sliderLabel.append(traceSlider); traceControls.append(sliderLabel, traceIndex.label);
  const sampleDetails = el('details'); sampleDetails.append(el('summary', 'All committed sample values'), tableView);
  resultsSection.append(plot, traceControls, traceError, traceReadout, sampleDetails, el('p', 'Stems are computed samples, not a continuous trajectory. Arithmetic uses double precision; displayed values have 9 significant digits. A finite run does not establish stability or a limit. Limits: 128 samples; entered and normalized coefficients/history/amplitude ≤ 10⁶ in magnitude; running values ≤ 10¹²; 10⁻⁶ ≤ T ≤ 10⁴ s. No external solver is used.', 'muted'));
  function inspectSample(value: number): void {
    if (!Number.isInteger(value) || value < 0 || value >= rows.length) throw new Error(`Choose a committed sample from 0 to ${rows.length - 1}.`);
    inspected = value; renderRows();
  }
  for (const input of [traceIndex.input, traceSlider]) on(input, 'input', () => {
    try { inspectSample(readNumericInput(input, 'committed sample index')); }
    catch (error) { traceError.textContent = error instanceof Error ? error.message : 'Choose a committed sample.'; }
  });
  function pickSample(event: Event): void {
    if (event instanceof KeyboardEvent && !['Enter', ' '].includes(event.key)) return;
    const target = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-sample]') : null;
    if (!target || !rows.length) return;
    event.preventDefault(); const host = plot.contains(target) ? plot : tableView, keepFocus = target === document.activeElement, value = Number(target.dataset.sample);
    inspectSample(value);
    if (keepFocus) host.querySelector<HTMLElement>(`[data-sample="${value}"]`)?.focus({ preventScroll: true });
  }
  tableView.addEventListener('click', pickSample, { signal }); plot.addEventListener('click', pickSample, { signal });
  function renderRows(): void {
    tableView.replaceChildren(); plot.replaceChildren(); traceReadout.replaceChildren(); traceError.textContent = ''; traceControls.hidden = !rows.length;
    traceIndex.input.disabled = traceSlider.disabled = !rows.length;
    if (rows.length) {
      traceIndex.input.max = traceSlider.max = String(rows.length - 1); traceIndex.input.value = traceSlider.value = String(inspected);
      const selectedRow = rows[inspected];
      traceReadout.append(el('h4', `Committed sample k = ${inspected} · t = ${fmt(selectedRow.t)} s`), createEquationDisplay(`y[${inspected}]=${latexNumber(selectedRow.y)},\\quad y_{0}[${inspected}]=${latexNumber(selectedRow.zero)},\\quad y-y_0=${latexNumber(selectedRow.y - selectedRow.zero)}`, 'Selected committed output and history contribution'));
    } else tableView.append(el('p', 'No committed samples yet.', 'muted'));
    const table = el('table'), head = el('thead'), tr = el('tr');
    for (const text of ['k', 't (s)', 'u[k]', 'y[k]', 'Zero-state y[k]', 'History contribution']) tr.append(el('th', text));
    head.append(tr); table.append(head); const body = el('tbody');
    for (const row of rows) {
      const tr = el('tr', '', row.k === inspected ? 'selected' : ''), cell = el('td'), pick = el('button', String(row.k)); pick.type = 'button'; pick.dataset.sample = String(row.k); pick.setAttribute('aria-label', `Inspect committed sample ${row.k}`); pick.setAttribute('aria-pressed', String(row.k === inspected)); cell.append(pick); tr.append(cell);
      for (const v of [row.t, row.u, row.y, row.zero, row.y - row.zero]) tr.append(el('td', fmt(v))); body.append(tr);
    }
    table.append(body); if (rows.length) tableView.append(table);
    const ns = 'http://www.w3.org/2000/svg', svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 600 220'); svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', 'Computed output sample stems versus sample index k. Values are in the table.');
    const values = rows.flatMap(r => [r.y, r.zero]);
    const low = Math.min(0, ...values); let high = Math.max(0, ...values); if (high === low) high = low + 1; const span = high - low;
    const x = (k: number) => 65 + 510 * k / Math.max(1, rows.length - 1), y = (v: number) => 175 - 140 * (v - low) / span;
    function line(x1: number, y1: number, x2: number, y2: number, dashed = false): void {
      const l = document.createElementNS(ns, 'line');
      for (const [name, v] of Object.entries({ x1, y1, x2, y2 })) l.setAttribute(name, String(v));
      l.setAttribute('stroke', 'currentColor'); l.setAttribute('stroke-width', '1.5'); if (dashed) l.setAttribute('stroke-dasharray', '3 3'); svg.append(l);
    }
    function text(value: string, px: number, py: number): void { const t = document.createElementNS(ns, 'text'); t.textContent = value; t.setAttribute('x', String(px)); t.setAttribute('y', String(py)); svg.append(t); }
    line(65, y(0), 580, y(0)); line(65, 30, 65, 180);
    for (const r of rows) {
      line(x(r.k), y(0), x(r.k), y(r.y));
      const zero = document.createElementNS(ns, 'circle'); zero.setAttribute('cx', String(x(r.k))); zero.setAttribute('cy', String(y(r.zero))); zero.setAttribute('r', '4'); zero.setAttribute('class', 'zero-sample'); svg.append(zero);
      const c = document.createElementNS(ns, 'circle'); c.setAttribute('cx', String(x(r.k))); c.setAttribute('cy', String(y(r.y))); c.setAttribute('r', r.k === inspected ? '6' : '4'); c.setAttribute('class', r.k === inspected ? 'sample-point inspected' : 'sample-point'); c.dataset.sample = String(r.k); c.setAttribute('aria-hidden', 'true'); c.setAttribute('data-description', `Inspect committed sample ${r.k}: output ${fmt(r.y)}`); c.setAttribute('aria-pressed', String(r.k === inspected)); svg.append(c);
      if (r.k) line(x(r.k - 1), y(rows[r.k - 1].zero), x(r.k), y(r.zero), true);
    }
    text('Output y (arbitrary units)', 65, 18); text(Number(high.toPrecision(3)).toString(), 0, 40); text(Number(low.toPrecision(3)).toString(), 0, 178); text('0', 65, 200); if (rows.length > 1) text(`${rows.length - 1}`, 560, 200); text('Sample index k', 240, 216);
    if (!rows.length) text('Reveal, then commit to place the first sample.', 115, 95);
    plot.append(svg, el('p', 'Solid stems and filled points: supplied history. Hollow points and dashed sample connections: zero history. Use the cursor or table buttons to inspect a sample.', 'muted'));
  }
  renderForms(); buildHistory(); restart();
  return () => { equation.destroy(); root.remove(); };
};
