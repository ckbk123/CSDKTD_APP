import type { ModuleMount } from '../../core/module';
import { createEquationDisplay, createEquationInput, type EquationDraft } from '../../shared/equations/input';
import { readNumericInput } from '../../shared/numeric-input';
import { parseModel, type Model } from './parser';
import { delayedTransfer, fmt, historyTransfer, matrixTex, polyTex, run, tex, validateModel, zohBaseline, type Comparison, type Result, type StateModel } from './math';
import { modelLatex } from './input';
import { delayDiagram, samplePlot } from './visuals';
import './style.css';

function element<K extends keyof HTMLElementTagNameMap>(tag: K, text = '', className = ''): HTMLElementTagNameMap[K] {
  const out = document.createElement(tag); out.textContent = text; if (className) out.className = className; return out;
}
function paragraph(text: string): HTMLParagraphElement { return element('p', text); }
function card(title: string): HTMLElement { const out = element('section', '', 'dr03-card'); out.append(element('h3', title)); return out; }
function equation(latex: string, label: string): HTMLElement { return createEquationDisplay(latex, label); }
function vector(values: number[]): string { return matrixTex(values.map(v => [v])); }
function transfer(model: Model): string { return '\\frac{' + polyTex(model.b) + '}{' + polyTex(model.a) + '}'; }
function modelBlock(s: StateModel, name: string): HTMLElement {
  const out = element('div', '', 'dr03-matrix');
  if (!s.A.length) { out.append(equation('y[k]=(' + tex(s.D) + ')u[k]', 'No storage: direct gain'), paragraph('No state vector: this realization has zero storage cells.')); return out; }
  out.append(equation('A_' + name + '=' + matrixTex(s.A) + ',\\quad B_' + name + '=' + vector(s.B), name + ' state matrices'),
    equation('C_' + name + '=' + matrixTex([s.C]) + ',\\quad D_' + name + '=' + tex(s.D), name + ' output matrices'));
  return out;
}

export const mount: ModuleMount = ({ container, signal }) => {
  if (signal.aborted) return;
  const root = element('section', '', 'dr03-workspace'); root.dataset.module = 'DR03'; container.append(root);
  const inputsCard = card('1. Enter the discrete model and history'), controls = element('div', '', 'dr03-controls');
  const feedback = paragraph('Choose a scalar state or output, make a prediction, then reveal the construction.');
  feedback.setAttribute('role', 'status'); feedback.className = 'dr03-feedback';
  const results = element('div', '', 'dr03-results'); results.hidden = true;
  const inspection = card('3. Read old memory, then update every cell together'), inspectionBody = element('div');
  inspection.append(inspectionBody);
  let result: Result | undefined, draft: EquationDraft, sourceT: number | null = .1, selected: number | 'y' = 0, disposed = false;
  const report = (text: string, error = false): void => { feedback.textContent = text; feedback.classList.toggle('dr03-error', error); };
  const assessment = paragraph(''), predictionLabel = element('span', 'Predict x1[k+1]');
  assessment.setAttribute('role', 'status'); assessment.className = 'dr03-assessment';
  const next = element('button', 'Next simultaneous update'); next.type = 'button'; next.disabled = true;
  const invalidate = (text = 'Inputs changed. Reveal again to check the new experiment.'): void => {
    result = undefined; results.hidden = true; results.replaceChildren(); inspectionBody.replaceChildren();
    next.disabled = true; assessment.textContent = ''; report(text);
  };
  const safe = (action: () => void): void => {
    if (disposed || signal.aborted) return;
    try { action(); } catch (error) { report(error instanceof Error ? error.message : 'Check the entered model.', true); }
  };
  const watch = (input: HTMLInputElement | HTMLSelectElement, change?: () => void): void => {
    input.addEventListener('input', () => { invalidate(); change?.(); }, { signal });
  };
  const numberControl = (label: string, value: string, min?: number, max?: number, step = 'any'): HTMLInputElement => {
    const box = element('label', '', 'dr03-number'), title = element('span', label), input = element('input');
    input.type = 'number'; input.value = value; input.step = step; input.setAttribute('aria-label', label);
    if (min !== undefined) input.min = String(min); if (max !== undefined) input.max = String(max);
    box.append(title, input); controls.append(box); return input;
  };
  const period = numberControl('Sample period T (s)', '.1', .0001, 10);
  const delay = numberControl('Additional input delay m (samples)', '0', 0, 4, '1');
  const count = numberControl('Sample instants including k=0', '21', 4, 120, '1');
  const amplitude = numberControl('Sequence amplitude A', '1', -1e4, 1e4);
  const sequenceLabel = element('label', '', 'dr03-number'), sequence = element('select');
  sequence.setAttribute('aria-label', 'Future input sequence');
  for (const [value, title] of [['step', 'Step: u[k]=A'], ['pulse', 'One-sample pulse: A at k=0'], ['ramp', 'Ramp: u[k]=A·kT'], ['alternating', 'Alternating: A·(−1)ᵏ']]) {
    const option = element('option', title); option.value = value; sequence.append(option);
  }
  sequenceLabel.append(element('span', 'Future input, k≥0'), sequence); controls.append(sequenceLabel);
  const readDelay = (): number => {
    const value = readNumericInput(delay, 'input delay m');
    if (!Number.isInteger(value) || value < 0 || value > 4) throw new Error('Use an integer input delay from 0 to 4 samples. Fractional delays are never rounded.');
    return value;
  };
  const historyGroup = element('fieldset'), historyControls = element('div', '', 'dr03-history'), pastY: HTMLInputElement[] = [], pastU: HTMLInputElement[] = [];
  historyGroup.append(element('legend', 'Past samples, newest first'), paragraph('Declare y[−1]…y[−n] and u[−1]…u[−(n+m)]. They need not be zero. Hidden unused fields are ignored.'), historyControls);
  const historyNumber = (symbol: string, i: number): HTMLInputElement => {
    const label = element('label', '', 'dr03-number'), input = element('input');
    input.type = 'number'; input.value = '0'; input.step = 'any'; input.min = '-10000'; input.max = '10000';
    const title = symbol + '[−' + (i + 1) + ']'; input.setAttribute('aria-label', title);
    label.append(element('span', title), input); historyControls.append(label); watch(input); return input;
  };
  for (let i = 0; i < 2; i++) pastY.push(historyNumber('y', i));
  for (let i = 0; i < 6; i++) pastU.push(historyNumber('u', i));
  const rowChoice = element('select'); rowChoice.setAttribute('aria-label', 'Equation to inspect');
  const prediction = element('input'); prediction.type = 'number'; prediction.step = 'any'; prediction.setAttribute('aria-label', 'Predicted selected result');
  const cursor = element('input'); cursor.type = 'number'; cursor.value = '0'; cursor.min = '0'; cursor.step = '1'; cursor.setAttribute('aria-label', 'Inspect sample k');
  function setPredictionLabel(): void {
    predictionLabel.textContent = selected === 'y' ? 'Predict y[k]' : 'Predict x' + (selected + 1) + '[k+1]';
  }
  function shape(n: number, m: number): void {
    pastY.forEach((input, i) => { input.parentElement!.hidden = i >= n; });
    pastU.forEach((input, i) => { input.parentElement!.hidden = i >= n + m; });
    const size = 2 * n + m, old = selected;
    rowChoice.replaceChildren();
    const output = element('option', 'Output y[k] = Cₕxₕ[k] + Dₕu[k]'); output.value = 'y'; rowChoice.append(output);
    for (let i = 0; i < size; i++) {
      const label = i < n ? 'y[k−' + (i + 1) + ']' : 'u[k−' + (i - n + 1) + ']';
      const option = element('option', 'Row ' + (i + 1) + ': x' + (i + 1) + '[k] = ' + label); option.value = String(i); rowChoice.append(option);
    }
    selected = typeof old === 'number' && old < size ? old : 'y';
    rowChoice.value = String(selected); setPredictionLabel();
  }
  const source = paragraph(''), regenerate = element('button', 'Regenerate mechanical ZOH model at T');
  regenerate.type = 'button';
  function sourceNote(): void {
    source.textContent = sourceT === null
      ? 'Entered discrete G(z): T labels physical sample time. Changing T alone does not discretize this model.'
      : 'Generated from the declared mechanical source with zero-order hold at T=' + fmt(sourceT) + ' s. Changing T alone keeps these discrete coefficients; use Regenerate to recompute them.';
  }
  const initialModel = zohBaseline(.1).model;
  const plant = createEquationInput({
    label: 'Discrete transfer function G(z), before additional input delay',
    value: modelLatex(initialModel), signal,
    onChange: nextDraft => {
      draft = nextDraft; sourceT = null; sourceNote(); invalidate('Equation changed. Complete it, then reveal the new construction.');
      try { shape(parseModel(draft.latex).a.length - 1, readDelay()); } catch { /* Keep existing history drafts during incomplete edits. */ }
    },
  });
  draft = plant.getValue();
  const readModel = (): Model => {
    draft = plant.getValue();
    if (draft.empty || draft.hasPlaceholders || draft.syntaxIssues.length) throw new Error('Complete G(z) and fill every fraction/power box before solving.');
    return parseModel(draft.latex);
  };
  inputsCard.append(paragraph('Use a proper real rational expression in z with denominator order 0–2; positive powers 0, 1 or 2. Fractions, decimals and visible parentheses are supported. Enter added delays with m below.'),
    plant.element, controls, regenerate, source, historyGroup);
  sourceNote(); shape(2, 0);
  watch(period, () => { sourceNote(); }); watch(count); watch(amplitude); watch(sequence);
  watch(delay, () => { try { shape(readModel().a.length - 1, readDelay()); } catch { /* Reveal reports the invalid draft. */ } });
  const alternate = element('details'), native = element('div', '', 'dr03-coefficients'), nativeOrder = element('select');
  alternate.append(element('summary', 'Alternative: enter recurrence weights'));
  nativeOrder.setAttribute('aria-label', 'Recurrence order n');
  for (let n = 0; n <= 2; n++) { const option = element('option', String(n)); option.value = String(n); nativeOrder.append(option); } nativeOrder.value = '2';
  const nativeOrderLabel = element('label', 'Order n '); nativeOrderLabel.append(nativeOrder); alternate.append(nativeOrderLabel);
  const alpha: HTMLInputElement[] = [], beta: HTMLInputElement[] = [];
  const coefficientControl = (name: string): HTMLInputElement => {
    const label = element('label', '', 'dr03-number'), input = element('input');
    input.type = 'number'; input.step = 'any'; input.setAttribute('aria-label', name); label.append(element('span', name), input); native.append(label); return input;
  };
  for (let i = 1; i <= 2; i++) alpha.push(coefficientControl('Past-output weight α' + i));
  for (let i = 0; i <= 2; i++) beta.push(coefficientControl('Input weight β' + i));
  const nativeShape = (): void => {
    const n = Number(nativeOrder.value);
    alpha.forEach((input, i) => { input.parentElement!.hidden = i >= n; });
    beta.forEach((input, i) => { input.parentElement!.hidden = i > n; });
  };
  const copyWeights = (model: Model): void => {
    nativeOrder.value = String(model.a.length - 1);
    alpha.forEach((input, i) => { input.value = String(-(model.a[i + 1] ?? 0)); });
    beta.forEach((input, i) => { input.value = String(model.b[i] ?? 0); }); nativeShape();
  };
  copyWeights(initialModel);
  const apply = element('button', 'Apply recurrence weights to equation'), copy = element('button', 'Copy equation to recurrence weights');
  apply.type = copy.type = 'button';
  alternate.append(equation('y[k]=\\sum_{j=1}^{n}\\alpha_j y[k-j]+\\sum_{j=0}^{n}\\beta_j u[k-m-j]', 'Recurrence weight convention'),
    paragraph('αj = −aj; βj = bj. Native number fields accept exponent notation. These drafts affect the model only after Apply.'), native, apply, copy);
  inputsCard.append(alternate);
  nativeOrder.addEventListener('input', nativeShape, { signal });
  apply.addEventListener('click', () => safe(() => {
    const n = Number(nativeOrder.value);
    const model = { a: [1, ...alpha.slice(0, n).map((input, i) => -readNumericInput(input, 'α' + (i + 1)))], b: beta.slice(0, n + 1).map((input, i) => readNumericInput(input, 'β' + i)) };
    const latex = modelLatex(model); plant.setValue(latex); draft = plant.getValue(); sourceT = null; sourceNote(); shape(n, readDelay()); invalidate('Recurrence weights applied. Reveal to check the new model and history.');
  }), { signal });
  copy.addEventListener('click', () => safe(() => { copyWeights(readModel()); report('Equation copied to recurrence drafts; the model is unchanged.'); }), { signal });
  regenerate.addEventListener('click', () => safe(() => {
    const T = readNumericInput(period, 'sample period T'), model = zohBaseline(T).model;
    plant.setValue(modelLatex(model)); draft = plant.getValue(); sourceT = T; delay.value = '0';
    [...pastY, ...pastU].forEach(input => { input.value = '0'; }); copyWeights(model); shape(2, 0); sourceNote();
    invalidate('Mechanical source regenerated at T=' + fmt(T) + ' s; input delay and past samples reset to zero. Reveal to compare.');
  }), { signal });

  const attempt = card('2. Predict a row or the current output'), attemptControls = element('div', '', 'dr03-controls');
  const rowLabel = element('label', '', 'dr03-number'); rowLabel.append(element('span', 'Choose an equation'), rowChoice);
  const indexLabel = element('label', '', 'dr03-number'); indexLabel.append(element('span', 'Inspect sample k'), cursor);
  const guessLabel = element('label', '', 'dr03-number'); guessLabel.append(predictionLabel, prediction);
  const reveal = element('button', 'Reveal and check construction'), checkPrediction = element('button', 'Check prediction');
  reveal.type = checkPrediction.type = 'button'; reveal.className = 'dr03-primary';
  attemptControls.append(rowLabel, indexLabel, guessLabel);
  attempt.append(paragraph('Use the old memory x[k] and current input u[k]. Predict one scalar next-state component, or select y[k] for the output before shifting. The selected sample starts at k=0.'),
    attemptControls, reveal, checkPrediction, next, assessment);
  function optionalPrediction(): number | undefined {
    if (!prediction.value.trim() && !prediction.validity.badInput) return undefined;
    return readNumericInput(prediction, 'predicted selected result');
  }
  function inspectIndex(): number {
    const k = readNumericInput(cursor, 'sample index k');
    if (!Number.isInteger(k) || k < 0) throw new Error('Use a nonnegative integer sample index; the typed draft is preserved.');
    if (!result) throw new Error('Reveal a valid experiment first.');
    const bounded = Math.min(k, result.rows.length - 1);
    if (bounded !== k) cursor.value = String(bounded); return bounded;
  }
  function showInspection(): void {
    inspectionBody.replaceChildren(); assessment.textContent = '';
    if (!result) return;
    const k = inspectIndex(), row = result.rows[k], s = result.history;
    const equationRow = selected === 'y' ? s.C : s.A[selected], inputWeight = selected === 'y' ? s.D : s.B[selected];
    const value = selected === 'y' ? row.y : row.next[selected], lhs = selected === 'y' ? 'y[' + k + ']' : 'x_{' + (selected + 1) + '}[' + (k + 1) + ']';
    const selectedEquation = equation(lhs + '=' + matrixTex([equationRow]) + vector(row.x) + '+(' + tex(inputWeight) + ')(' + tex(row.u) + ')=' + tex(value), 'Selected row arithmetic');
    selectedEquation.classList.add('dr03-selected-equation');
    inspectionBody.append(paragraph('k=' + k + ', t=' + fmt(row.t) + ' s: old memory is read once. Every next component below uses that same old vector.'),
      equation('x_h[' + k + ']=' + vector(row.x) + ',\\quad u[' + k + ']=' + tex(row.u), 'Old state and current input'),
      paragraph(selected === 'y' ? 'Selected output equation' : 'Selected state-update row ' + (selected + 1)), selectedEquation,
      equation('y[' + k + ']=' + tex(row.y) + ',\\qquad x_h[' + (k + 1) + ']=' + vector(row.next), 'Output then simultaneous next state'),
      paragraph('Next updates all cells together; it never uses a just-updated cell to compute another row.'));
    results.querySelector('.dr03-diagram')?.replaceChildren(delayDiagram(result, selected));
    results.querySelectorAll('tbody tr').forEach((tr, i) => tr.classList.toggle('dr03-current', i === k));
  }
  function canonicalCard(comparison: Comparison, title: string, suffix: string, m: number): HTMLElement {
    const out = card(title), base = comparison.base;
    out.append(paragraph('Base order ' + base.A.length + '; with the explicit input register, ' + comparison.system.A.length + ' scalar states. Delay cells q1[k+1]=u[k], qj[k+1]=q(j−1)[k]; the base receives qm[k] when m>0.'),
      modelBlock(comparison.system, suffix), equation('x_' + suffix + '[0]=' + vector(comparison.initial), title + ' mapped initial state'));
    const recovered = delayedTransfer(comparison.recovered, m);
    out.append(equation('G_' + suffix + '(z)=z^{-' + m + '}\\left(D_b+\\frac{C_b\\operatorname{adj}(zI-A_b)B_b}{\\det(zI-A_b)}\\right)=' + transfer(recovered), title + ' recovered zero-state transfer function'),
      paragraph('Recovered from the actual numerical base matrices; the factor z⁻ᵐ follows from the displayed delay-shift equations. Coefficient residual ' + fmt(comparison.coefficientResidual) + '; sampled output residual ' + fmt(comparison.outputResidual) + '.'));
    return out;
  }
  function render(): void {
    if (!result) return;
    results.replaceChildren(); results.hidden = false;
    const n = result.model.a.length - 1, m = result.history.A.length - 2 * n;
    const construction = card('Delay outputs become scalar states'), diagram = element('div', '', 'dr03-diagram dr03-scroll');
    diagram.append(delayDiagram(result, selected));
    construction.append(paragraph('History register: n=' + n + ', m=' + m + ', ' + (2 * n + m) + ' scalar unit-delay cells. It stores past outputs and inputs and is generally nonminimal. Direct feedthrough Dₕ=' + fmt(result.history.D) + ' stores no sample.'),
      diagram, modelBlock(result.history, 'h'), equation('x_h[k+1]=A_hx_h[k]+B_hu[k],\\quad y[k]=C_hx_h[k]+D_hu[k]', 'State and output equations'));
    const recurrence = 'y[k]=' + result.model.a.slice(1).map((a, i) => '(' + tex(-a) + ')y[k-' + (i + 1) + ']').concat(result.model.b.map((b, i) => '(' + tex(b) + ')u[k' + (m + i ? '-' + (m + i) : '') + ']')).join('+');
    construction.append(equation(recurrence, 'Independently indexed recurrence'),
      paragraph('The scalar reference is stepped directly from these time indices with the same declared past samples, independently of the state-matrix update.'));
    const recovery = historyTransfer(result.model, m);
    construction.append(equation('\\det(zI-A_h)=z^{' + (n + m) + '}(' + polyTex(result.model.a) + ')', 'History characteristic polynomial'),
      equation('G_h(z)=\\frac{z^{' + n + '}(' + polyTex(result.model.b) + ')}{z^{' + (n + m) + '}(' + polyTex(result.model.a) + ')}=' + transfer(recovery), 'History recovered zero-state channel'),
      paragraph('These structural polynomial identities follow from the shift rows. Common z factors mark redundant history storage; cancellation in a transfer channel does not erase the declared initial memory. The transfer function alone assumes zero initial storage.'));
    if (sourceT !== null) {
      const sourceModel = zohBaseline(sourceT), sourceCard = card('Declared continuous source → zero-order hold');
      sourceCard.append(paragraph('A_c=[[0,1],[−2,−3]], B_c=[0,1]ᵀ, C_c=[1,0], D_c=0. Hold u[k] constant on [kT,(k+1)T); sample y[k] before updating. Source T=' + fmt(sourceT) + ' s.'),
        equation('A_d=e^{A_cT},\\qquad B_d=\\int_0^T e^{A_c\\tau}B_c\\,d\\tau', 'ZOH conversion'),
        modelBlock(sourceModel.discrete, 'd'),
        paragraph('The fixed mechanical source has poles −1 and −2; its modal closed forms generate these numerical matrices. For an arbitrary edited discrete G(z), T is a time label until Regenerate is used.'));
      results.append(sourceCard);
    }
    results.append(construction, inspection);
    if (result.controller && result.observer) {
      const maps = card('Same history, different coordinates');
      if (!n) maps.append(paragraph('This gain has no dynamic base coordinates to transform. Both realizations keep the same ' + m + ' input-delay samples in the same order; no empty coordinate solve is needed.'));
      else maps.append(equation('x_{c,b}[0]=M x_h[0],\\qquad M=' + matrixTex(result.historyMap!), 'History to controller map'),
        equation('x_{o,b}[0]=Sx_{c,b}[0],\\qquad S=' + matrixTex(result.coordinateMap!), 'Controller to observer coordinate map'),
        paragraph('M matches the first n zero-future recurrence outputs after subtracting the forced response from the same m input-delay samples. S satisfies S A_c=A_o S, S B_c=B_o and C_o S=C_c. Copying coordinates without this map generally changes the response. Extra delay cells keep their common declared values.'));
      results.append(maps, canonicalCard(result.controller, 'Controller companion realization', 'c', m), canonicalCard(result.observer, 'Observer companion realization', 'o', m));
    } else {
      const warning = card('Canonical coordinate comparison'); warning.append(paragraph(result.canonicalWarning),
        paragraph('The valid history register, recurrence and sampled comparison remain available. This does not assert that a transfer realization cannot exist; an invertible full-order history/coordinate map is unavailable within the stated bounds.')); results.append(warning);
    }
    const samples = card('Compare the same sample sequence'), plot = element('div', '', 'dr03-scroll dr03-plot'), tableWrap = element('div', '', 'dr03-scroll');
    plot.append(samplePlot(result));
    samples.append(paragraph('Indigo stems: history model. Hollow circles: independent recurrence. Canonical outputs use the mapped initial states shown above. This is a finite sampled check, with no continuous interpolation.'),
      paragraph('Maximum scaled history residual: ' + fmt(result.historyResidual) + '. Comparisons scale each output error by max(1, |reference|).'), plot);
    const table = element('table'), caption = element('caption', 'Sampled input and output, rounded to seven significant digits'), head = element('thead'), headRow = element('tr');
    for (const title of ['k', 'Time kT (s)', 'u[k]', 'History y[k]', 'Recurrence y[k]', 'Controller y[k]', 'Observer y[k]']) headRow.append(element('th', title));
    head.append(headRow); const body = element('tbody');
    result.rows.forEach((row, i) => {
      const tr = element('tr'); tr.dataset.sample = String(i);
      for (const text of [String(i), fmt(row.t), fmt(row.u), fmt(row.y), fmt(result!.reference[i]), result!.controller ? fmt(result!.controller.rows[i].y) : 'Unavailable', result!.observer ? fmt(result!.observer.rows[i].y) : 'Unavailable']) tr.append(element('td', text));
      body.append(tr);
    });
    table.append(caption, head, body); tableWrap.append(table); samples.append(tableWrap); results.append(samples);
  }
  function revealConstruction(): void {
    invalidate('');
    const model = readModel(), n = validateModel(model), m = readDelay(); shape(n, m);
    optionalPrediction();
    const e = { T: readNumericInput(period, 'sample period T'), count: readNumericInput(count, 'sample count'), delay: m, amplitude: readNumericInput(amplitude, 'sequence amplitude'),
      kind: sequence.value as 'step' | 'pulse' | 'ramp' | 'alternating', pastY: pastY.slice(0, n).map((input, i) => readNumericInput(input, 'y[−' + (i + 1) + ']')),
      pastU: pastU.slice(0, n + m).map((input, i) => readNumericInput(input, 'u[−' + (i + 1) + ']')) };
    result = run(model, e); render(); next.disabled = false;
    report(result.canonicalWarning || 'Construction checked against the independently stepped recurrence. Select a row or advance one simultaneous update.');
    showInspection();
  }
  reveal.addEventListener('click', () => safe(revealConstruction), { signal });
  checkPrediction.addEventListener('click', () => safe(() => {
    if (!result) revealConstruction();
    if (!result) return;
    const guess = optionalPrediction();
    if (guess === undefined) throw new Error('Enter a finite prediction for the selected scalar result.');
    const row = result.rows[inspectIndex()], expected = selected === 'y' ? row.y : row.next[selected], tolerance = 1e-7 * Math.max(1, Math.abs(expected));
    assessment.textContent = Math.abs(guess - expected) <= tolerance ? 'Prediction matches within 10⁻⁷·max(1, |result|).' : 'Try again: selected result is ' + fmt(expected) + '; tolerance ' + fmt(tolerance) + '. Read the old memory before shifting.';
  }), { signal });
  prediction.addEventListener('input', () => { assessment.textContent = ''; }, { signal });
  rowChoice.addEventListener('input', () => safe(() => {
    selected = rowChoice.value === 'y' ? 'y' : Number(rowChoice.value); setPredictionLabel(); assessment.textContent = ''; showInspection();
  }), { signal });
  cursor.addEventListener('input', () => safe(showInspection), { signal });
  next.addEventListener('click', () => safe(() => {
    const k = inspectIndex();
    if (result && k < result.rows.length - 1) { cursor.value = String(k + 1); showInspection(); report('Advanced to sample k=' + (k + 1) + '; all memory cells used the same prior vector.'); }
    else report('The final sampled instant is selected. Its next-state preview is shown; increase the sample count to continue the checked sequence.');
  }), { signal });
  const selectCell = (event: Event): void => {
    if (event instanceof KeyboardEvent && event.key !== 'Enter' && event.key !== ' ') return;
    const target = event.target instanceof Element ? event.target.closest('[data-state-index]') : null;
    if (!target || !result) return;
    const keepFocus = target === document.activeElement || target.contains(document.activeElement);
    event.preventDefault();
    safe(() => {
      selected = Number(target.getAttribute('data-state-index')); rowChoice.value = String(selected); setPredictionLabel(); showInspection();
      if (keepFocus) (root.querySelector('[data-state-index="' + selected + '"]') as HTMLElement | null)?.focus();
    });
  };
  root.addEventListener('click', selectCell, { signal }); root.addEventListener('keydown', selectCell, { signal });
  const limits = element('details');
  limits.append(element('summary', 'Conventions, limits and numerical checks'),
    paragraph('Real SISO LTI; no feedback interconnection. Descending monic denominator coefficients [1,a1,a2] and equally padded [b0,b1,b2]. Order 0–2 and added integer input delay 0–4. Each z⁻¹ stores one scalar sample. Time is in seconds; other signals have the user’s consistent units.'),
    paragraph('4–120 sample instants, .0001≤T≤10 s, |input/history|≤10⁴, normalized |coefficient|≤10⁶, nonzero coefficient magnitude≥10⁻³⁰⁰, state/map magnitude≤10¹² and |output|≤10¹⁰. Generated ramp samples and the final next-state preview obey these limits too.'),
    paragraph('Visual input: 512 characters, 20 nested groups, intermediate degree≤6 and magnitude≤10¹²; leading denominator magnitude≥10⁻⁸. Powers are 0–2. Mixed-number adjacency, invisible algebraic grouping, visual e/E, functions, negative powers and improper models are unsupported; use explicit + or ×, visible parentheses and the delay control. Native numeric fields accept ordinary exponent notation.'),
    paragraph('Coefficient algebra uses bounded exact rational normalization of entered decimals before conversion to browser numbers. Matrix/trajectory arithmetic is numerical; small sums round once from exact binary-value products. Nonzero underflow is reported. Displays round to seven significant digits; calculations retain full parsed values.'),
    paragraph('Before comparison, a conservative scalar error estimate checks coefficient/input rounding and its amplification through the order-0–2 recurrence. An estimate above 10⁻⁸×max(1, |output|) withholds the trajectory with accuracy feedback. It can reject an ill-conditioned horizon even when signal magnitudes remain small. The compared state routes are qualified against this scalar reference; this is not interval certification of arbitrary state trajectories.'),
    paragraph('History comparison tolerance10⁻¹⁰; canonical coefficient/similarity residual≤10⁻⁹; finite sampled output residual≤10⁻⁸. Coordinate solves require estimated infinity-norm condition≤10¹⁰. Singular/nonminimal/poorly conditioned maps report unavailable rather than resetting history. A finite horizon is not a proof of global equivalence or stability.'),
    paragraph('Source anchors: course audit DR5, CH7:30–42,50–51; S12:6–11; S15:7–8. This implementation’s changed-data fixtures are independent checks, not newly inspected source diagrams.'));
  root.append(inputsCard, attempt, feedback, results, limits);
  const cleanup = (): void => { if (disposed) return; disposed = true; plant.destroy(); result = undefined; root.remove(); signal.removeEventListener('abort', cleanup); };
  signal.addEventListener('abort', cleanup, { once: true }); return cleanup;
};
