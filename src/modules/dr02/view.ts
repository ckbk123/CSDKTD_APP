import type { ModuleMount } from '../../core/module';
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
  if (!input.value.trim() || !Number.isFinite(input.valueAsNumber) || Math.abs(input.valueAsNumber) > limit) throw new Error(`${name} must be a finite number with magnitude at most ${limit.toLocaleString()}.`);
  if (input.valueAsNumber === 0 && /[1-9]/.test(input.value.split(/[eE]/)[0])) throw new Error(`${name} is too small to represent. Enter zero explicitly or a representable value.`);
  return input.valueAsNumber;
}
interface Row { k: number; t: number; u: number; y: number; zero: number }

export const mount: ModuleMount = ({ container, signal }) => {
  const root = el('div', '', 'dr02');
  const modelSection = el('section'), settingsSection = el('section'), stepSection = el('section'), resultsSection = el('section');
  root.append(modelSection, settingsSection, stepSection, resultsSection); container.append(root);
  const status = el('p', '', 'notice'); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
  root.prepend(status);
  let draft: EquationDraft, model: Model = parseTransfer(BASELINE);
  let memory: Memory, zeroMemory: Memory, calculation: Calculation | undefined;
  let ready = false, modelDirty = false, selected = '', period = .1, amplitude = 1, kind: InputKind = 'held';
  let rows: Row[] = [];
  const historyInputs: { channel: 'y' | 'u'; input: HTMLInputElement }[] = [];
  const on = (node: HTMLElement, event: string, fn: () => void) => node.addEventListener(event, () => { if (!signal.aborted) fn(); }, { signal });
  const button = (text: string, fn: () => void, primary = false) => { const b = el('button', text, primary ? 'primary' : ''); b.type = 'button'; on(b, 'click', fn); return b; };
  const showError = (error: unknown) => { status.textContent = error instanceof Error ? error.message : 'Check the exercise data.'; };
  function invalidate(message: string): void {
    ready = false; calculation = undefined; rows = []; registerView.replaceChildren(); arithmetic.replaceChildren(); plot.replaceChildren(); tableView.replaceChildren(); position.textContent = 'Restart the experiment to use the current settings.';
    previewButton.disabled = true; commitButton.disabled = true; status.textContent = message;
  }
  modelSection.append(el('h3', '1. Convert the transfer function'), el('p', 'Edit a scalar transfer function, then divide numerator and denominator by the highest denominator power of z. This exposes one coefficient for each delay.'));
  const equation = createEquationInput({ label: 'Transfer function G(z)', value: BASELINE, signal, onChange: next => {
    draft = next; modelDirty = true; derived.replaceChildren(); invalidate('Equation changed. Apply the transfer function to rebuild the recurrence and memory slots.');
  } });
  draft = equation.getValue();
  const derived = el('div');
  const apply = () => {
    try {
      draft = equation.getValue();
      if (draft.empty || draft.hasPlaceholders || draft.syntaxIssues.length) throw new Error('Complete the equation and check its notation before applying.');
      model = parseTransfer(draft.latex); modelDirty = false;
      renderForms(); buildHistory(); restart();
    } catch (error) { modelDirty = true; derived.replaceChildren(); invalidate(''); showError(error); }
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
    derived.replaceChildren(createEquationDisplay(f.z, 'Transfer function in z'), createEquationDisplay(f.delay, 'Transfer function in unit delays'),
      el('p', 'Divide both polynomials by the highest denominator power of z and its leading coefficient, so a₀ = 1. Displayed values are rounded to 9 significant digits; calculation uses the entered coefficients.', 'muted'), createEquationDisplay(f.recurrence, 'Isolated present output'));
  }

  settingsSection.append(el('h3', '2. Set input and old memory'), el('p', 'The transfer function describes zero initial conditions. Nonzero history adds a separate response without changing G(z). The registers below are the values available just before computing y[0].'));
  const t = numberInput('Sample period T (s)', '0.1'), a = numberInput('Input amplitude / ramp slope', '1');
  const typeLabel = el('label', 'Input for k ≥ 0'), type = el('select'); type.setAttribute('aria-label', 'Input for k ≥ 0');
  for (const [value, label] of [['held', 'Held constant A'], ['impulse', 'Unit-sample pulse Aδ[k]'], ['ramp', 'Physical ramp A·kT']]) { const o = el('option', label); o.value = value; type.append(o); }
  typeLabel.append(type);
  const controls = el('div', '', 'controls'); controls.append(t.label, a.label, typeLabel);
  for (const input of [t.input, a.input, type]) on(input, 'input', () => invalidate('Settings changed. Restart with this history before calculating.'));
  const histories = el('div', '', 'controls'), settingsActions = el('div', '', 'actions');
  settingsActions.append(button('Restart with this history', restart, true), button('Set history to zero', () => { for (const field of historyInputs) field.input.value = '0'; restart(); }), button('Try nonzero memory', () => { for (const field of historyInputs) field.input.value = '0'; if (historyInputs[0]) historyInputs[0].input.value = '1'; restart(); }));
  settingsSection.append(controls, histories, settingsActions, el('p', 'Timing: k = 0 is the first computed output; t = kT. Held baseline input starts at u[0] = 1, while u[−1] = 0. Thus y[0] = 0 and y[1] ≈ 0.095163. Input/output units are arbitrary but consistent; ramp slope is input units/s. No feedback connection is imposed.', 'muted'));
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
      period = nextPeriod; amplitude = nextAmplitude; kind = nextKind; ready = true; rows = []; calculation = undefined; selected = '';
      prediction.input.value = ''; renderStep(); renderRows(); status.textContent = 'Ready at k = 0. Predict the output, reveal the old-value arithmetic, then commit the memory update.';
    } catch (error) { invalidate(''); showError(error); }
  }

  stepSection.append(el('h3', '3. Read, calculate, then commit'), el('p', 'Each z⁻¹ stores one sample. Read every old slot before shifting any slot. Select an arithmetic term to highlight its source; arrows describe the next simultaneous update.'));
  const position = el('p'), registerView = el('div'), prediction = numberInput('Your predicted y[k] (optional)', '');
  const previewButton = button('Reveal arithmetic', () => {
    try {
      calculation = preview(model, memory, sample(kind, amplitude, memory.k, period));
      const first = calculation.terms.find(term => term.coefficient !== 0); selected = first ? `${first.channel}:${first.delay}` : '';
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
      rows.push({ k: memory.k, t: memory.k * period, u: input, y: output, zero });
      memory = next; zeroMemory = nextZero; calculation = undefined; prediction.input.value = ''; selected = '';
      renderStep(); renderRows(); status.textContent = `Committed y[${memory.k - 1}] = ${fmt(output)}. ${memory.k === 128 ? '128-sample limit reached; restart to continue.' : `All delays shifted together. Next sample: k = ${memory.k}.`}`;
    } catch (error) { showError(error); }
  });
  const stepActions = el('div', '', 'actions'); stepActions.append(previewButton, commitButton);
  const arithmetic = el('div'); stepSection.append(position, registerView, prediction.label, stepActions, arithmetic);
  function renderStep(): void {
    if (!ready) return;
    previewButton.disabled = memory.k >= 128; commitButton.disabled = !calculation;
    position.textContent = `Current sample k = ${memory.k}, time ${fmt(memory.k * period)} s. ${calculation ? 'Old memory is frozen until commit.' : 'Output is hidden until reveal.'}`;
    registerView.replaceChildren(); arithmetic.replaceChildren();
    if (memory.k >= 128) return;
    const current = sample(kind, amplitude, memory.k, period);
    registerView.append(el('p', 'u[k] → input delay chain → b-coefficient taps → Σ → y[k]. Old outputs return through the output delay chain and −a-coefficient taps.', 'muted'));
    const bank = el('div', '', 'registers'); registerView.append(bank);
    function slot(channel: 'u' | 'y', delay: number, value: number, coefficient: number): void {
      const key = `${channel}:${delay}`, cell = el('div', '', `slot${selected === key ? ' selected' : ''}`);
      cell.append(el('span', delay ? `${channel}[k−${delay}] · z⁻¹ slot ${delay}` : 'u[k] · current input'), el('strong', fmt(value)), el('span', `Multiplier: ${fmt(coefficient)}`), el('p', delay ? `After commit: ← ${channel}[k${delay > 1 ? `−${delay - 1}` : ''}]` : 'No delay (direct feedthrough)', 'muted'));
      bank.append(cell);
    }
    model.b.forEach((c, i) => slot('u', i, i ? memory.u[i - 1] : current, c));
    model.a.slice(1).forEach((c, i) => slot('y', i + 1, memory.y[i], -c));
    if (!calculation) return;
    arithmetic.append(createEquationDisplay(`y[${memory.k}]=${calculation.terms.map(term => `(${latexNumber(term.coefficient)})(${latexNumber(term.value)})`).join('+')}=${latexNumber(calculation.output)}`, 'Computed from unchanged old samples'));
    const scroll = el('div', '', 'scroll'), table = el('table'), head = el('thead'), hrow = el('tr');
    for (const title of ['Select source', 'Coefficient', 'Old value', 'Contribution']) hrow.append(el('th', title)); head.append(hrow); table.append(head);
    const body = el('tbody');
    for (const term of calculation.terms) {
      const key = `${term.channel}:${term.delay}`, row = el('tr', '', selected === key ? 'selected' : '');
      const td = el('td'), select = button(`${term.channel}[k${term.delay ? `−${term.delay}` : ''}]`, () => { selected = key; renderStep(); });
      select.setAttribute('aria-pressed', String(selected === key)); td.append(select); row.append(td);
      for (const v of [term.coefficient, term.value, term.contribution]) row.append(el('td', fmt(v)));
      body.append(row);
    }
    table.append(body); scroll.append(table); arithmetic.append(scroll, el('p', 'These products use the old snapshot. Only Commit writes y[k] and u[k] into the first delays and shifts older values toward the next slot.', 'muted'));
  }

  resultsSection.append(el('h3', '4. Compare with zero-state output'), el('p', 'Commit samples to build the sequence. The comparison uses the same transfer function and future input, with every initial memory value set to zero. Their difference is the response caused by the supplied history.'));
  const plot = el('div'), tableView = el('div', '', 'scroll'); tableView.tabIndex = 0; tableView.setAttribute('aria-label', 'Scrollable committed sample table');
  resultsSection.append(plot, tableView, el('p', 'Stems are computed samples, not a continuous trajectory. Arithmetic uses double precision; displayed values have 9 significant digits. A finite run does not establish stability or a limit. Limits: 128 samples; entered and normalized coefficients/history/amplitude ≤ 10⁶ in magnitude; running values ≤ 10¹²; 10⁻⁶ ≤ T ≤ 10⁴ s. No external solver is used.', 'muted'));
  function renderRows(): void {
    tableView.replaceChildren(); plot.replaceChildren();
    if (!rows.length) { tableView.append(el('p', 'No committed samples yet.', 'muted')); return; }
    const table = el('table'), head = el('thead'), tr = el('tr');
    for (const text of ['k', 't (s)', 'u[k]', 'y[k]', 'Zero-state y[k]', 'History contribution']) tr.append(el('th', text));
    head.append(tr); table.append(head); const body = el('tbody');
    for (const row of rows) { const tr = el('tr'); for (const v of [row.k, row.t, row.u, row.y, row.zero, row.y - row.zero]) tr.append(el('td', fmt(v))); body.append(tr); }
    table.append(body); tableView.append(table);
    const ns = 'http://www.w3.org/2000/svg', svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 600 220'); svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', 'Computed output sample stems versus sample index k. Values are in the table.');
    const values = rows.flatMap(r => [r.y, r.zero]);
    const low = Math.min(0, ...values), high = Math.max(0, ...values), span = high - low || 1;
    const x = (k: number) => 65 + 510 * k / Math.max(1, rows.length - 1), y = (v: number) => 175 - 140 * (v - low) / span;
    function line(x1: number, y1: number, x2: number, y2: number, dashed = false): void {
      const l = document.createElementNS(ns, 'line');
      for (const [name, v] of Object.entries({ x1, y1, x2, y2 })) l.setAttribute(name, String(v));
      l.setAttribute('stroke', 'currentColor'); l.setAttribute('stroke-width', '1.5'); if (dashed) l.setAttribute('stroke-dasharray', '3 3'); svg.append(l);
    }
    function text(value: string, px: number, py: number): void { const t = document.createElementNS(ns, 'text'); t.textContent = value; t.setAttribute('x', String(px)); t.setAttribute('y', String(py)); svg.append(t); }
    line(65, y(0), 580, y(0)); line(65, 30, 65, 180);
    for (const r of rows) { line(x(r.k), y(0), x(r.k), y(r.y)); const c = document.createElementNS(ns, 'circle'); c.setAttribute('cx', String(x(r.k))); c.setAttribute('cy', String(y(r.y))); c.setAttribute('r', '3'); c.setAttribute('fill', 'currentColor'); svg.append(c); if (r.k) line(x(r.k - 1), y(rows[r.k - 1].zero), x(r.k), y(r.zero), true); }
    text('Output y (arbitrary units)', 65, 18); text(Number(high.toPrecision(3)).toString(), 0, 40); text(Number(low.toPrecision(3)).toString(), 0, 178); text('0', 65, 200); text(`${rows.length - 1}`, 560, 200); text('Sample index k', 240, 216);
    plot.append(svg, el('p', 'Solid stems: supplied history. Dashed connection: zero-state sample comparison only.', 'muted'));
  }
  renderForms(); buildHistory(); restart();
  return () => { equation.destroy(); root.remove(); };
};
