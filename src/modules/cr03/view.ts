import type { ModuleMount } from '../../core/module';
import { createEquationDisplay, createEquationInput, type EquationInput } from '../../shared/equations/input';
import { readNumericInput } from '../../shared/numeric-input';
import { at, BASELINE, canonical, controllability, coordinates, equivalence, formatNumber as fmt, identity, latexNumber as num, matrixLatex, multiply, norm, observability, physical, polynomialLatex, rank, samples, transferLatex, transferOf, validateModel, vector, type Matrix, type Sample, type StateModel, type Transfer } from './math';
import { parseOde, parseTransfer } from './parser';
import './workspace.css';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, text = '', className = ''): HTMLElementTagNameMap[K] { const node = document.createElement(tag); node.textContent = text; node.className = className; return node; }
function numeric(input: HTMLInputElement, label: string, maximum = 1e6): number { const value = readNumericInput(input, label); if (Math.abs(value) > maximum) throw new Error(`${label} must have magnitude at most ${maximum.toLocaleString()}.`); return value; }
function column(values: readonly number[]): number[][] { return values.map(value => [value]); }
function derivative(name: string, order: number): string { return order === 0 ? name : order === 1 ? `${name}'` : order === 2 ? `${name}''` : `${name}^{(${order})}`; }
function linearTerms(values: readonly number[], name: string): string {
  const kept = values.flatMap((value, index) => value ? [{ value, order: values.length - 1 - index }] : []);
  return kept.length ? kept.map(({ value, order }, i) => `${value < 0 ? '-' : i ? '+' : ''}${Math.abs(value) === 1 ? '' : num(Math.abs(value))}${derivative(name, order)}`).join('') : '0';
}
function stateEquations(model: StateModel, name: string): string {
  return model.A.length ? `\\dot{${name}}=${matrixLatex(model.A)}${name}+${matrixLatex(column(model.B))}u,\\qquad y=${matrixLatex([model.C])}${name}+(${num(model.D)})u` : `y=(${num(model.D)})u,\\quad\\text{no dynamic states}`;
}
interface MatrixFields { A: HTMLInputElement[][]; B: HTMLInputElement[][]; C: HTMLInputElement[][]; D: HTMLInputElement }
interface Shown {
  base: StateModel; transformed: StateModel; target: Transfer; canonical: StateModel; initial: number[]; mapped: number[]; command: number;
  original: Sample[]; changed: Sample[]; condition: number; residual: number; outputError: number;
}

export const mount: ModuleMount = ({ container, signal }) => {
  const root = el('div', '', 'cr03'); container.append(root);
  root.innerHTML = `<p class="notice" role="status" aria-live="polite" data-ui="status"></p>
    <section><h3>1. Choose the given representation</h3><div class="controls" data-ui="source-control"></div>
      <div data-ui="tf"></div><div data-ui="ode" hidden></div><div class="actions" data-ui="given-actions"></div>
      <p class="muted">Use real SISO models with 0–4 states. Transfer polynomials descend in s; a proper numerator has no higher degree than its denominator. Visual expressions support numeric fractions, products and integer powers −4…4. Separate mixed-number values with explicit + or ×.</p>
      <div data-ui="given"></div><p class="muted">G(s) describes zero-state input/output behavior. A transfer function does not recover a unique original physical system or its hidden initial state.</p>
    </section>
    <section><h3>2. Build or inspect A, B, C and D</h3>
      <p>For a transfer/ODE given, enter a candidate realization. Input/output-equivalent matrices are accepted; matching one answer's entries is unnecessary. For a matrix given, these cells are the supplied model.</p>
      <div class="controls" data-ui="matrix-controls"></div><div class="matrix-draft" data-ui="matrix-draft"></div>
      <p class="muted">A is square, B is a column, C is a row, D is one scalar. Native cells accept normal exponent notation and reject nonzero underflow. State and coordinate entries have magnitude at most 10⁶; conversion/trajectory limits also apply.</p>
    </section>
    <section><h3>3. Choose coordinates and an initial state</h3>
      <p>The convention is z = T x. Transfer/ODE givens use the constructed canonical x; matrix givens use the supplied x. Applying a new given resets T and the initial state. Enter conversion factors in T when coordinate units differ.</p>
      <div class="actions" data-ui="coordinate-actions"></div><div class="two-columns"><div data-ui="coordinate-grid"></div><div data-ui="initial-grid"></div></div>
      <div class="controls" data-ui="experiment"></div><p class="muted">Time is seconds; input/output use normalized signal units. x(0−) has magnitude at most 100 and u was zero before 0. A constant command (magnitude ≤100) begins at 0; x stays continuous, while D may cause an output jump. Use 0.001–20 s and 2–401 computed points.</p>
      <div class="controls" data-ui="prediction"></div><div class="actions" data-ui="reveal"></div>
    </section>
    <section data-ui="answers" hidden><h3>4. Follow the realization and coordinate map</h3>
      <div data-ui="attempt"></div><div data-ui="construction"></div><div class="actions" data-ui="rows"></div>
      <div class="scroller" tabindex="0" aria-label="Canonical integrator chain" data-ui="chain"></div><div data-ui="row-equation"></div>
      <div class="two-columns"><div data-ui="canonical"></div><div data-ui="physical"></div></div>
      <div data-ui="coordinates"></div><div data-ui="initial-result"></div><div data-ui="qualification"></div>
      <div class="scroller" tabindex="0" aria-label="Selected state trajectory comparison" data-ui="state-plot"></div>
      <div class="scroller" tabindex="0" aria-label="Output trajectory comparison" data-ui="output-plot"></div>
      <details><summary>Inspect computed state and output samples</summary><div class="scroller" tabindex="0" data-ui="table"></div></details>
      <p class="muted">Matrix identities state the coordinate relationship; numeric labels are rounded to 7 significant digits. Transfer equivalence is a numerical cross-polynomial check (10⁻⁸ relative residual). Curves join computed samples; they do not prove equivalence or establish between-sample extrema/stability. State/output magnitudes are bounded by 10¹⁰.</p>
    </section>`;
  const ui = (name: string) => root.querySelector<HTMLElement>(`[data-ui="${name}"]`)!;
  const on = (node: HTMLElement, event: string, callback: () => void) => node.addEventListener(event, () => { if (!signal.aborted) callback(); }, { signal });
  const button = (label: string, callback: () => void, primary = false) => { const node = el('button', label, primary ? 'primary' : ''); node.type = 'button'; on(node, 'click', callback); return node; };
  const feedback = (text: string) => { ui('status').textContent = text; };
  const error = (reason: unknown) => feedback(reason instanceof Error ? reason.message : 'Check the given model and coordinate data.');
  let sourceDirty = true, base: StateModel = BASELINE, target: Transfer = transferOf(BASELINE), canonicalModel: StateModel = BASELINE, shown: Shown | undefined, selected = 0;
  let candidate: MatrixFields, Tfields: HTMLInputElement[][] = [], initialFields: HTMLInputElement[] = [];
  function invalidate(message: string): void { shown = undefined; ui('answers').hidden = true; feedback(message); }
  function control(label: string, value: number, kind: string): { label: HTMLLabelElement; input: HTMLInputElement } {
    const wrapper = el('label', label), input = el('input'); input.type = 'number'; input.step = 'any'; input.value = String(value); input.dataset.edit = kind; input.setAttribute('aria-label', label); wrapper.append(input); return { label: wrapper, input };
  }
  const sourceLabel = el('label', 'Given form'), source = el('select'); source.setAttribute('aria-label', 'Given form'); source.dataset.edit = 'source';
  for (const [value, label] of [['tf', 'Transfer function'], ['ode', 'Linear ODE'], ['matrix', 'State matrices']]) { const option = el('option', label); option.value = value; source.append(option); }
  sourceLabel.append(source); ui('source-control').append(sourceLabel);
  const sourceChanged = () => { sourceDirty = true; ui('given').replaceChildren(); invalidate('Given data changed. Apply the given model before checking a realization or coordinates.'); };
  const tfInput = createEquationInput({ label: 'Given transfer function', value: String.raw`G(s)=\frac1{s^2+3s+2}`, signal, onChange: () => { if (source.value === 'tf') sourceChanged(); } });
  const odeInput = createEquationInput({ label: 'Given linear ODE', value: "y''+3y'+2y=u", signal, onChange: () => { if (source.value === 'ode') sourceChanged(); } });
  for (const input of [tfInput, odeInput]) input.element.addEventListener('keydown', event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); window.mathVirtualKeyboard.hide(); } }, { capture: true, signal });
  ui('tf').append(tfInput.element); ui('ode').append(odeInput.element);
  function readDraft(input: EquationInput): string { const draft = input.getValue(); if (draft.empty || draft.hasPlaceholders || draft.syntaxIssues.length) throw new Error('Complete the given equation and check its notation.'); return draft.latex; }
  function sourcePanels(): void { ui('tf').hidden = source.value !== 'tf'; ui('ode').hidden = source.value !== 'ode'; }

  const sizeLabel = el('label', 'Matrix dimension'), size = el('select'); size.setAttribute('aria-label', 'Matrix dimension'); size.dataset.edit = 'dimension';
  for (let n = 0; n <= 4; n++) { const option = el('option', n ? `${n} states` : 'Static gain (0 states)'); option.value = String(n); size.append(option); }
  sizeLabel.append(size); ui('matrix-controls').append(sizeLabel, button('Use canonical construction', () => {
    try { if (sourceDirty) throw new Error('Apply the given model first.'); renderCandidate(canonicalModel); if (source.value === 'matrix') sourceChanged(); else invalidate('Candidate cells now contain the canonical construction. Inspect the rows, then reveal the derivation.'); } catch (reason) { error(reason); }
  }));
  function grid(host: HTMLElement, name: string, values: Matrix, kind: string): HTMLInputElement[][] {
    const group = el('div'), wrapper = el('div', '', 'scroller'), table = el('table'); wrapper.tabIndex = 0; wrapper.setAttribute('aria-label', `${name} coefficient cells`);
    const result = values.map((row, i) => { const tr = el('tr'); const inputs = row.map((value, j) => { const td = el('td'), field = control(`${name} row ${i + 1} column ${j + 1}`, value, kind); td.append(field.input); tr.append(td); return field.input; }); table.append(tr); return inputs; });
    group.append(el('h4', name), wrapper); host.append(group); wrapper.append(table); return result;
  }
  function renderCandidate(model: StateModel): void {
    const host = ui('matrix-draft'); host.replaceChildren(); size.value = String(model.A.length);
    const A = grid(host, 'A', model.A, 'candidate'), B = grid(host, 'B', column(model.B), 'candidate'), C = grid(host, 'C', model.A.length ? [model.C] : [], 'candidate'), D = control('D direct term', model.D, 'candidate'); host.append(D.label);
    candidate = { A, B, C, D: D.input };
  }
  function readCandidate(): StateModel {
    const matrix = (fields: HTMLInputElement[][]) => fields.map(row => row.map(field => numeric(field, field.getAttribute('aria-label')!)));
    const model = { A: matrix(candidate.A), B: matrix(candidate.B).map(row => row[0]), C: candidate.C.length ? matrix(candidate.C)[0] : [], D: numeric(candidate.D, 'D') };
    validateModel(model); return model;
  }
  function renderT(T: Matrix): void { ui('coordinate-grid').replaceChildren(); Tfields = grid(ui('coordinate-grid'), 'T', T, 'coordinate'); if (!T.length) ui('coordinate-grid').append(el('p', 'A static gain has no state coordinates.')); }
  function renderInitial(n: number): void {
    const host = ui('initial-grid'); host.replaceChildren(el('h4', 'Initial state x(0−)')); initialFields = Array.from({ length: n }, (_, i) => { const field = control(`x${i + 1}(0−)`, 0, 'initial'); host.append(field.label); return field.input; });
    if (!n) host.append(el('p', 'No dynamic initial state.'));
  }
  const command = control('Constant command u (t ≥ 0)', 1, 'experiment'), horizon = control('Plot horizon (s)', 5, 'experiment'), count = control('Computed points', 201, 'experiment'), prediction = control('Predict y(0+)', 0, 'prediction'); prediction.input.value = ''; count.input.step = '1';
  ui('experiment').append(command.label, horizon.label, count.label); ui('prediction').append(prediction.label);
  function apply(): void {
    try {
      if (source.value === 'matrix') { base = readCandidate(); target = transferOf(base); canonicalModel = canonical(target); }
      else { target = source.value === 'ode' ? parseOde(readDraft(odeInput)) : parseTransfer(readDraft(tfInput)); canonicalModel = canonical(target); base = canonicalModel; }
      renderT(identity(base.A.length)); renderInitial(base.A.length); prediction.input.value = ''; selected = 0; sourceDirty = false;
      ui('given').replaceChildren(createEquationDisplay(transferLatex(target), 'Applied zero-state transfer function'), createEquationDisplay(`${linearTerms(target.denominator, 'y')}=${linearTerms(target.numerator, 'u')}`, 'Applied input-output ODE'));
      invalidate('Given model applied. T is identity and the initial state is zero. Build/check the matrices, choose coordinates, predict y(0+), then reveal.');
    } catch (reason) { sourceDirty = true; ui('given').replaceChildren(); invalidate(''); error(reason); }
  }
  function preset(numerator: number[], denominator: number[], ode: string): void {
    source.value = 'tf'; sourcePanels(); target = { numerator, denominator }; tfInput.setValue(transferLatex(target)); odeInput.setValue(ode); renderCandidate(canonical(target)); sourceDirty = true; apply();
  }
  ui('given-actions').append(button('Apply given model', apply, true), button('Baseline', () => preset([1], [1, 3, 2], "y''+3y'+2y=u")), button('Numerator / input-derivative example', () => preset([1, 4], [1, 3, 2], "y''+3y'+2y=u'+4u")), button('Biproper example', () => preset([2, 7, 9], [1, 3, 2], "y''+3y'+2y=2u''+7u'+9u")), button('Hidden mode example', () => {
    source.value = 'matrix'; sourcePanels(); renderCandidate({ A: [[1, 0], [0, -2]], B: [0, 1], C: [1, 1], D: 0 }); sourceDirty = true; apply();
  }));
  function setCoordinates(T: Matrix, message: string): void { if (sourceDirty) throw new Error('Apply the given model first.'); renderT(T); invalidate(message); }
  ui('coordinate-actions').append(button('Identity coordinates', () => { try { setCoordinates(identity(base.A.length), 'Identity coordinates selected. Reveal to compare.'); } catch (reason) { error(reason); } }), button('Shear coordinates', () => {
    try { const T = identity(base.A.length); if (T.length > 1) T[0][1] = 1; else if (T.length) T[0][0] = 2; setCoordinates(T, 'A shear/scaling changes the state coordinates. Predict the output, then reveal.'); } catch (reason) { error(reason); }
  }), button('Output-derivative coordinates', () => { try { const T = physical(base, Array(base.A.length).fill(0) as number[]).T; setCoordinates(T, 'Output-derivative coordinates selected. Input derivatives still come from the same scalar u.'); } catch (reason) { error(reason); } }), button('Nonzero initial state', () => {
    if (initialFields.length) { initialFields[0].value = '1'; invalidate('The first original state starts at one. T must map this initial vector too.'); }
    else invalidate('A static gain has no dynamic initial state.');
  }));
  root.addEventListener('input', event => {
    const node = event.target; if (!(node instanceof HTMLElement) || !node.dataset.edit) return;
    if (node.dataset.edit === 'source') { sourcePanels(); sourceChanged(); }
    else if (node.dataset.edit === 'dimension') { const n = Number(size.value); renderCandidate({ A: identity(n).map(row => row.map(() => 0)), B: Array(n).fill(0) as number[], C: Array(n).fill(0) as number[], D: 0 }); if (source.value === 'matrix') sourceChanged(); else invalidate('Candidate dimension changed. Build its matrices, then reveal the check.'); }
    else if (node.dataset.edit === 'candidate' && source.value === 'matrix') sourceChanged();
    else invalidate('Data changed. Reveal again to recompute and compare the current experiment.');
  }, { signal });

  ui('reveal').append(button('Reveal construction & coordinate check', () => {
    try {
      if (sourceDirty) throw new Error('Apply the given model before revealing.');
      const candidateModel = readCandidate(), initial = initialFields.map(field => numeric(field, field.getAttribute('aria-label')!, 100)), T = Tfields.map(row => row.map(field => numeric(field, field.getAttribute('aria-label')!)));
      const changed = coordinates(base, T, initial), amplitude = numeric(command.input, 'Command', 100), duration = numeric(horizon.input, 'Horizon', 20), total = numeric(count.input, 'Computed points', 401);
      if (!equivalence(transferOf(base), transferOf(changed.model)).matches) throw new Error('The numerical transformed transfer exceeds equivalence tolerance. Rescale the model or use better-conditioned coordinates.');
      const original = samples(base, initial, amplitude, duration, total), altered = samples(changed.model, changed.initial, amplitude, duration, total);
      const outputError = Math.max(...original.map((point, i) => Math.abs(point.output - altered[i].output))), outputScale = Math.max(0, ...original.map(point => Math.abs(point.output)), ...altered.map(point => Math.abs(point.output)));
      if (outputError !== 0 && (outputScale === 0 || outputError / outputScale > 1e-7)) throw new Error('The numerical coordinate comparison exceeds tolerance. Use a shorter horizon or better-conditioned T.');
      shown = { base, transformed: changed.model, target, canonical: canonicalModel, initial, mapped: changed.initial, command: amplitude, original, changed: altered, condition: changed.condition, residual: changed.residual, outputError };
      ui('answers').hidden = false; renderAnswers(candidateModel); renderSelected(); renderTable();
      const expected = at(base, initial, amplitude, 0).output, guess = prediction.input.value.trim() ? numeric(prediction.input, 'Predicted output', 1e10) : undefined;
      feedback(guess === undefined ? 'Construction and coordinate comparison revealed. State values may change; the mapped model retains the output.' : Math.abs(guess - expected) <= 1e-8 * Math.max(1, Math.abs(expected)) ? 'Your initial-output prediction agrees within 10⁻⁸ absolute/relative tolerance.' : `At 0+ the output is approximately ${fmt(expected)}. Include both Cx(0−) and the direct term Du.`);
    } catch (reason) { invalidate(''); error(reason); }
  }, true));
  function renderAnswers(candidateModel: StateModel): void {
    if (!shown) return; const state = shown, n = state.base.A.length, matched = equivalence(state.target, transferOf(candidateModel));
    ui('attempt').replaceChildren(el('p', source.value === 'matrix' ? 'The matrices are the given data. Their characteristic denominator and resolvent numerator produce the transfer above.' : matched.matches ? `Your candidate reproduces the given zero-state transfer within tolerance (relative residual ${fmt(matched.residual)}). This alone does not establish matching internal modes or initial states.` : `The candidate differs from the given transfer (relative coefficient residual ${fmt(matched.residual)}). Compare its rows with the construction below.`));
    const denominator = state.canonical.A.length ? state.target.denominator : [1], padded = Array(denominator.length - state.target.numerator.length).fill(0).concat(state.target.numerator) as number[];
    ui('construction').replaceChildren(el('h4', 'Normalize the denominator and separate the direct term'), createEquationDisplay(`P(s)=${polynomialLatex(denominator)},\\quad Q(s)=${polynomialLatex(state.target.numerator)}`, 'Denominator and numerator coefficients'), createEquationDisplay(`D=${num(state.canonical.D)},\\quad R(s)=Q(s)-DP(s)=${polynomialLatex(padded.map((value, i) => value - state.canonical.D * denominator[i]))}`, 'Direct term and strictly proper remainder'), el('p', 'The shift rows form the integrator chain; the last row contains the negative denominator coefficients in reverse order. C contains the remainder coefficients in ascending powers. D accounts for the same-degree numerator term.'));
    ui('canonical').replaceChildren(el('h4', 'One canonical realization'), createEquationDisplay(stateEquations(state.canonical, '\\xi'), 'Canonical state and output equations'), el('p', 'This is a zero-state construction. A supplied nonminimal model need not have an invertible state map to this canonical realization.'));
    ui('physical').replaceChildren(el('h4', 'Output-derivative coordinates of x'));
    try {
      const derived = physical(state.base, state.initial);
      ui('physical').append(createEquationDisplay(`w=O x,\\quad O=${matrixLatex(derived.T)}`, 'Output-derivative coordinate map'), createEquationDisplay(stateEquations(derived.model, 'w'), 'Physical derivative-corrected state equations'));
      for (let k = 0; k < n; k++) {
        const terms = [{ coefficient: state.base.D, order: k }]; let power = identity(n);
        for (let r = 0; r < k; r++) { terms.push({ coefficient: vector([state.base.C], vector(power, state.base.B))[0], order: k - 1 - r }); power = multiply(power, state.base.A); }
        ui('physical').append(createEquationDisplay(`w_${k + 1}=${derivative('y', k)}${terms.filter(term => term.coefficient !== 0).map(term => `-(${num(term.coefficient)})${derivative('u', term.order)}`).join('')}`, `Modified state w ${k + 1}`));
      }
      ui('physical').append(el('p', 'The subtracted input derivatives are derivatives of the same u. The resulting state equation still has one input.'));
    } catch (reason) { ui('physical').append(el('p', `These output-derivative coordinates are unavailable: ${reason instanceof Error ? reason.message : 'singular map'} The original model and a chosen invertible T remain usable.`)); }
    ui('coordinates').replaceChildren(el('h4', 'Apply the chosen coordinate change'), createEquationDisplay('z=Tx,\\quad A_z=TA_xT^{-1},\\quad B_z=TB_x,\\quad C_z=C_xT^{-1},\\quad D_z=D_x', 'Similarity transformation identities'), createEquationDisplay(stateEquations(state.transformed, 'z'), 'Transformed state and output equations'));
    ui('initial-result').replaceChildren(createEquationDisplay(`x(0^-)=${matrixLatex(column(state.initial))},\\quad z(0^-)=Tx(0^-)=${matrixLatex(column(state.mapped))}`, 'Mapped initial states'), el('p', `At 0+ both outputs are approximately ${fmt(at(state.base, state.initial, state.command, 0).output)}. T must map the initial state as well as A, B and C.`));
    ui('qualification').replaceChildren(el('p', `Coordinate condition ≈ ${fmt(state.condition)}; max algebraic residual ≈ ${fmt(state.residual)}; max sampled output difference ≈ ${fmt(state.outputError)}.`), el('p', `Original controllability rank ${rank(controllability(state.base))}/${n}; observability rank ${rank(observability(state.base))}/${n}, at relative pivot threshold 10⁻¹². Characteristic denominator factors are retained. Transfer agreement alone does not certify internal stability.`));
    if (norm(state.base.A) * state.original[1].t > 1) ui('qualification').append(el('p', 'The plot spacing may hide fast state variation. Reduce the horizon or increase samples before interpreting the connecting lines.', 'notice'));
    ui('rows').replaceChildren(...Array.from({ length: n }, (_, i) => { const node = el('button', `State ${i + 1}`); node.type = 'button'; node.dataset.row = String(i); return node; }));
  }
  root.addEventListener('click', event => { const node = event.target; if (node instanceof HTMLElement && node.dataset.row !== undefined && shown) { selected = Number(node.dataset.row); renderSelected(); } }, { signal });
  function renderSelected(): void {
    if (!shown) return; const n = shown.base.A.length; if (selected >= n) selected = Math.max(0, n - 1);
    root.querySelectorAll<HTMLElement>('[data-row]').forEach(node => node.setAttribute('aria-pressed', String(Number(node.dataset.row) === selected)));
    renderChain(shown.canonical);
    ui('row-equation').replaceChildren();
    if (n) ui('row-equation').append(createEquationDisplay(`\\dot\\xi_${selected + 1}=${shown.canonical.A[selected].map((value, i) => `(${num(value)})\\xi_${i + 1}`).join('+')}+(${num(shown.canonical.B[selected])})u`, 'Selected canonical row equation'));
    if (n) plot('state-plot', shown.original.map(point => point.state[selected]), shown.changed.map(point => point.state[selected]), `State ${selected + 1}: x (solid) and z (dashed)`, 'State coordinate units');
    else ui('state-plot').replaceChildren(el('p', 'There are no dynamic states in this static-gain model.'));
    plot('output-plot', shown.original.map(point => point.output), shown.changed.map(point => point.output), 'Output y: original (solid) and mapped (dashed)', 'Output signal units');
  }
  function renderChain(model: StateModel): void {
    const ns = 'http://www.w3.org/2000/svg', svg = document.createElementNS(ns, 'svg'), n = model.A.length; svg.setAttribute('viewBox', '0 0 640 225'); svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', 'Computed canonical integrator chain. The shift rows connect successive states; denominator feedback enters the last state derivative.');
    const defs = document.createElementNS(ns, 'defs'), marker = document.createElementNS(ns, 'marker'), arrow = document.createElementNS(ns, 'path'); marker.setAttribute('id', 'cr03-integrator-arrow'); marker.setAttribute('viewBox', '0 0 10 10'); marker.setAttribute('refX', '9'); marker.setAttribute('refY', '5'); marker.setAttribute('markerWidth', '7'); marker.setAttribute('markerHeight', '7'); marker.setAttribute('orient', 'auto'); arrow.setAttribute('d', 'M0 0L10 5L0 10Z'); arrow.setAttribute('fill', 'currentColor'); marker.append(arrow); defs.append(marker); svg.append(defs);
    const path = (value: string) => { const node = document.createElementNS(ns, 'path'); node.setAttribute('d', value); node.setAttribute('fill', 'none'); node.setAttribute('stroke', 'currentColor'); node.setAttribute('marker-end', 'url(#cr03-integrator-arrow)'); svg.append(node); };
    const text = (value: string, x: number, y: number) => { const node = document.createElementNS(ns, 'text'); node.textContent = value; node.setAttribute('x', String(x)); node.setAttribute('y', String(y)); svg.append(node); };
    text('u', 10, 105);
    if (!n) { path('M35 100H250 M350 100H590'); text(`D = ${fmt(model.D)}`, 265, 105); text('y', 600, 105); }
    else {
      path('M30 100H75'); text('Σ', 78, 106); let last = 100;
      for (let j = 0; j < n; j++) {
        const stateIndex = n - 1 - j, x = 120 + j * 120; path(`M${last} 100H${x} M${x} 75H${x + 65}V125H${x}Z M${x + 65} 100H${x + 95}`); text('1/s', x + 19, 106); text(`ξ${stateIndex + 1}`, x + 75, 88);
        path(`M${x + 80} 100V${155 + j * 16}H82V112`); text(`(${fmt(model.A[n - 1][stateIndex])}) ξ${stateIndex + 1}`, 112 + j * 120, 155 + j * 16);
        if (stateIndex === selected) { const marker = document.createElementNS(ns, 'circle'); marker.setAttribute('cx', String(x + 32)); marker.setAttribute('cy', '52'); marker.setAttribute('r', '4'); marker.setAttribute('fill', 'currentColor'); svg.append(marker); }
        last = x + 95;
      }
    }
    ui('chain').replaceChildren(svg);
  }
  function plot(destination: string, original: number[], changed: number[], caption: string, units: string): void {
    if (!shown) return; const values = [...original, ...changed]; let low = Math.min(0, ...values), high = Math.max(0, ...values); if (high === low) { low -= 1; high += 1; }
    const ns = 'http://www.w3.org/2000/svg', svg = document.createElementNS(ns, 'svg'); svg.setAttribute('viewBox', '0 0 640 270'); svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', `${caption}. Computed samples are also available in the table.`);
    const axis = (value: number) => fmt(value).replace(/e([+-]?\d+)$/, (_, exponent: string) => `×10^${Number(exponent)}`), highLabel = axis(high), lowLabel = axis(low), margin = Math.max(105, Math.min(180, 14 + 8 * Math.max(highLabel.length, lowLabel.length)));
    const x = (i: number) => margin + (615 - margin) * i / (original.length - 1), y = (value: number) => 225 - 185 * (value - low) / (high - low);
    const path = (value: string, dashed = false) => { const node = document.createElementNS(ns, 'path'); node.setAttribute('d', value); node.setAttribute('fill', 'none'); node.setAttribute('stroke', 'currentColor'); node.setAttribute('stroke-width', '1.6'); if (dashed) node.setAttribute('stroke-dasharray', '7 5'); svg.append(node); };
    path(`M${margin} 30V225H615`); for (const [i, values] of [original, changed].entries()) path(values.map((value, j) => `${j ? 'L' : 'M'}${x(j)} ${y(value)}`).join(' '), i === 1);
    for (const [label, px, py] of [[units, margin, 18], [highLabel, 0, 40], [lowLabel, 0, 225], ['0', margin, 247], [fmt(shown.original[shown.original.length - 1].t), 590, 247], ['Time t (s)', 290, 267]] as const) { const node = document.createElementNS(ns, 'text'); node.textContent = label; node.setAttribute('x', String(px)); node.setAttribute('y', String(py)); svg.append(node); }
    ui(destination).replaceChildren(el('h4', caption), svg);
  }
  function renderTable(): void {
    if (!shown) return; const table = el('table'), head = el('thead'), heading = el('tr'), n = shown.base.A.length;
    for (const text of ['t (s)', ...Array.from({ length: n }, (_, i) => `x${i + 1}`), ...Array.from({ length: n }, (_, i) => `z${i + 1}`), 'Original y', 'Mapped y']) heading.append(el('th', text)); head.append(heading); table.append(head);
    const body = el('tbody'); shown.original.forEach((point, i) => { const row = el('tr'); for (const value of [point.t, ...point.state, ...shown!.changed[i].state, point.output, shown!.changed[i].output]) row.append(el('td', fmt(value))); body.append(row); }); table.append(body); ui('table').replaceChildren(table);
  }
  renderCandidate(BASELINE); apply();
  return () => { tfInput.destroy(); odeInput.destroy(); root.remove(); };
};
