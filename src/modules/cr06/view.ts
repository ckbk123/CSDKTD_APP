import type { ModuleMount } from '../../core/module';
import { createEquationDisplay, createEquationInput } from '../../shared/equations/input';
import { readNumericInput } from '../../shared/numeric-input';
import { derivative, fmt, matrixTex, polynomialTex, run, tex, validateModel, type Experiment, type Model, type Result } from './math';
import { matrixInput, parseMatrix } from './parser';
import { channelDiagram, diagram, responsePlot } from './visuals';
import './workspace.css';

export const mount: ModuleMount = ({ container, signal }) => {
  const root = document.createElement('div'); root.className = 'state-tool'; container.append(root);
  const el = <K extends keyof HTMLElementTagNameMap>(tag: K, text = '', cls = ''): HTMLElementTagNameMap[K] => { const e = document.createElement(tag); e.textContent = text; e.className = cls; return e; };
  const on = (e: EventTarget, event: string, action: EventListener): void => e.addEventListener(event, action, { signal });
  const section = (title: string): HTMLElement => { const s = el('section'); s.append(el('h3', title)); root.append(s); return s; };
  const button = (title: string, action: () => void): HTMLButtonElement => { const b = el('button', title, 'button'); b.type = 'button'; on(b, 'click', action); return b; };
  const numeric = (host: HTMLElement, title: string, value: number | '', min = -1e4, max = 1e4, step = 'any'): HTMLInputElement => {
    const label = el('label', title), input = el('input'); input.type = 'number'; input.value = String(value); input.min = String(min); input.max = String(max); input.step = step; label.append(input); host.append(label); return input;
  };
  const read = (input: HTMLInputElement): number => readNumericInput(input, input.parentElement?.firstChild?.textContent ?? 'the control');
  const failMessage = (error: unknown): void => { notice.textContent = error instanceof Error ? error.message : 'Check the model and controls.'; };
  let selected = 0, model: Model | undefined, experiment: Experiment | undefined, result: Result | undefined;
  const invalidate = (): void => { model = undefined; experiment = undefined; result = undefined; diagramSection.hidden = true; resultSection.hidden = true; notice.textContent = 'Data changed. Build the diagram or reveal again.'; };
  const setup = section('1. Build a state model');
  setup.append(el('p', 'Each integrator output is one state. Enter a real continuous SISO model with one or two states. Matrix rows describe signed gain paths into derivative summers; the output relation is algebraic. Time is in seconds; state, input and output units are normalized.'));
  const actions = el('div', '', 'state-actions'); setup.append(actions);
  const dimensionLabel = el('label', 'State dimension n'), dimension = el('select');
  for (const n of [1, 2]) { const o = el('option', String(n)); o.value = String(n); dimension.append(o); } dimension.value = '2'; dimensionLabel.append(dimension); setup.append(dimensionLabel);
  const matrices = el('div', '', 'state-matrices'); setup.append(matrices);
  const fields = [
    createEquationInput({ label: 'State matrix A', value: 'A=\\begin{bmatrix}0&1\\\\-2&-3\\end{bmatrix}', signal, onChange: invalidate }),
    createEquationInput({ label: 'Input column B', value: 'B=\\begin{bmatrix}0\\\\1\\end{bmatrix}', signal, onChange: invalidate }),
    createEquationInput({ label: 'Output row C', value: 'C=\\begin{bmatrix}1&0\\end{bmatrix}', signal, onChange: invalidate }),
    createEquationInput({ label: 'Feedthrough D', value: 'D=0', signal, onChange: invalidate }),
  ];
  fields.forEach(f => matrices.append(f.element));
  setup.append(el('p', 'Edit matrix cells with arrow keys, fractions and ordinary numbers. Use explicit + or × before fractions, and visible parentheses for grouping. Entry grammar: decimal constants, fractions, sums/products and parentheses. No variables, powers, functions or visual e/E notation in entries. The numeric helper below accepts native numeric exponents.', 'state-small'));
  const helper = el('details'); helper.append(el('summary', 'Numeric matrix entry helper'));
  const entryHost = el('div', '', 'state-controls'); helper.append(entryHost);
  let cells: HTMLInputElement[][][] = [];
  const shapes = (): [number, number][] => { const n = Number(dimension.value); return [[n, n], [n, 1], [1, n], [1, 1]]; };
  const fillHelper = (m: Model): void => {
    entryHost.replaceChildren(); cells = [];
    [m.A, m.B.map(v => [v]), [m.C], [[m.D]]].forEach((matrix, k) => cells.push(matrix.map((row, i) => row.map((value, j) => numeric(entryHost, ['A', 'B', 'C', 'D'][k] + ' entry ' + (i + 1) + ',' + (j + 1), value)))));
  };
  helper.append(button('Copy current equations into numeric entries', () => { try { fillHelper(readModel()); notice.textContent = 'Current entries copied. Edit values and apply them to the equations.'; } catch (error) { failMessage(error); } }),
    button('Apply numeric entries to equations', () => {
      try {
        const latex = cells.map(matrix => matrixInput(matrix.map(row => row.map(read))));
        fields.forEach((f, k) => f.setValue(['A', 'B', 'C', 'D'][k] + '=' + latex[k])); invalidate();
      } catch (error) { invalidate(); failMessage(error); }
    }));
  setup.append(helper);
  const controls = el('div', '', 'state-controls'); setup.append(controls);
  const input = numeric(controls, 'Constant input U for t ≥ 0', 1), horizon = numeric(controls, 'Horizon (s)', 5, .01, 10), count = numeric(controls, 'Drawing points', 101, 21, 401, '1');
  const initials = el('div', '', 'state-controls'); setup.append(initials);
  const xA = [numeric(initials, 'Initial A: x₁(0)', 0), numeric(initials, 'Initial A: x₂(0)', 0)];
  const xB = [numeric(initials, 'Initial B: x₁(0)', 1), numeric(initials, 'Initial B: x₂(0)', 0)];
  [input, horizon, count, ...xA, ...xB].forEach(e => on(e, 'input', invalidate));
  const applyPreset = (m: Model, a: number[], b: number[]): void => {
    dimension.value = String(m.A.length); selected = 0;
    [m.A, m.B.map(v => [v]), [m.C], [[m.D]]].forEach((v, k) => fields[k].setValue(['A', 'B', 'C', 'D'][k] + '=' + matrixInput(v)));
    xA.forEach((e, i) => { e.value = String(a[i] ?? 0); e.parentElement!.hidden = i >= m.A.length; });
    xB.forEach((e, i) => { e.value = String(b[i] ?? 0); e.parentElement!.hidden = i >= m.A.length; });
    fillHelper(m); input.value = '1'; horizon.value = '5'; count.value = '101'; prediction.value = ''; invalidate();
  };
  const mechanical: Model = { A: [[0, 1], [-2, -3]], B: [0, 1], C: [1, 0], D: 0 };
  actions.append(button('Mechanical chain', () => applyPreset(mechanical, [0, 0], [1, 0])),
    button('Hidden unstable state', () => applyPreset({ A: [[1, 0], [0, -2]], B: [0, 1], C: [0, 1], D: 0 }, [0, 0], [1, 0])),
    button('Two integrators', () => applyPreset({ A: [[0, 1], [0, 0]], B: [0, 1], C: [1, 0], D: 0 }, [0, 0], [1, 0])),
    button('Oscillator', () => applyPreset({ A: [[0, 1], [-1, 0]], B: [0, 1], C: [1, 0], D: 0 }, [0, 0], [1, 0])));
  on(dimension, 'change', () => applyPreset(dimension.value === '1' ? { A: [[-1]], B: [1], C: [1], D: 0 } : mechanical, [0, 0], [1, 0]));
  const attempt = section('2. Trace an integrator and predict');
  attempt.append(el('p', 'Build the diagram from the matrices, then select an integrator to trace its incoming derivative equation. Predict that derivative at t=0 for initial A and the chosen constant input.'));
  const prediction = numeric(attempt, 'Prediction for selected derivative at t=0 (optional)', '', -1e10, 1e10);
  attempt.append(el('p', 'Prediction tolerance: absolute error ≤10⁻⁵ × max(1, |computed derivative|).', 'state-small'));
  const notice = el('p', 'Build the diagram, predict, then reveal the state response.', 'state-notice'); notice.setAttribute('role', 'status');
  on(prediction, 'input', () => { notice.textContent = 'Prediction changed. Reveal again to check it against the selected state.'; });
  const attemptActions = el('div', '', 'state-actions'); attemptActions.append(button('Build integrator diagram', build), button('Reveal state response', reveal)); attempt.append(attemptActions, notice);
  const diagramSection = section('3. States are integrator outputs'); diagramSection.hidden = true;
  const diagramHost = el('div', '', 'state-scroll'); diagramHost.tabIndex = 0;
  const stateButtons = el('div', '', 'state-actions'), selectedEquation = el('div'); diagramSection.append(stateButtons, diagramHost, selectedEquation);
  diagramSection.append(el('p', 'Branch labels x₁ and x₂ are taps from the corresponding integrator outputs. Signed gain boxes feed derivative summers. The separate output summer has no memory and adds no state. A higher-order transfer block may contain several states and must first be realized; do not count rectangles or summers.', 'state-small'));
  const resultSection = section('4. Separate free and forced response'); resultSection.hidden = true;
  const summary = el('div'), inspect = numeric(resultSection, 'Inspect drawing point k', 20, 0, 100, '1'), inspected = el('div');
  const statePlot = el('div', '', 'state-scroll'), outputPlot = el('div', '', 'state-scroll');
  [statePlot, outputPlot].forEach(e => { e.tabIndex = 0; e.setAttribute('aria-label', 'Response plot; scroll horizontally on narrow screens'); });
  const tableDetails = el('details'), tableHost = el('div', '', 'state-scroll'); tableDetails.append(el('summary', 'All numerical state and output samples'), tableHost);
  resultSection.append(summary, statePlot, outputPlot, el('p', 'Solid accent: total A. Long dashed: total B. Dotted: free A. Dash-dot: shared forced response. Curves join finite computed points; they do not locate continuous extrema. Selecting an integrator changes the state plot. The output plot keeps the same channel.', 'state-small'), inspected, tableDetails);
  on(inspect, 'input', showPoint);
  on(diagramSection, 'click', event => { const target = (event.target as Element).closest('[data-state]'); if (target) choose(Number(target.getAttribute('data-state'))); });
  on(diagramHost, 'keydown', event => {
    const key = event as KeyboardEvent, target = (key.target as Element).closest('[data-state]');
    if (target && ['Enter', ' '].includes(key.key)) { key.preventDefault(); choose(Number(target.getAttribute('data-state'))); }
  });

  function readModel(): Model {
    const matrices = fields.map((field, i) => {
      const draft = field.getValue(), name = ['A', 'B', 'C', 'D'][i];
      if (draft.empty || draft.hasPlaceholders || draft.syntaxIssues.length) throw new Error('Complete ' + name + ' and check its notation.');
      return parseMatrix(draft.latex, shapes()[i][0], shapes()[i][1], name);
    });
    const m = { A: matrices[0], B: matrices[1].map(row => row[0]), C: matrices[2][0], D: matrices[3][0][0] }; validateModel(m); return m;
  }
  function rowEquation(i: number): string {
    return '\\dot{x}_{' + (i + 1) + '}=' + model!.A[i].map((v, j) => '(' + tex(v) + ')x_{' + (j + 1) + '}').concat(['(' + tex(model!.B[i]) + ')u']).join('+');
  }
  function choose(i: number): void {
    if (!model || !Number.isInteger(i) || i < 0 || i >= model.A.length) return;
    selected = i;
    diagramHost.querySelectorAll('g[data-state]').forEach(g => {
      const match = Number(g.getAttribute('data-state')) === selected;
      if (g.getAttribute('role') === 'button') g.setAttribute('aria-pressed', String(match)); else g.classList.toggle('state-selected', match);
    });
    stateButtons.querySelectorAll('button').forEach((b, j) => b.setAttribute('aria-pressed', String(j === selected)));
    selectedEquation.replaceChildren(createEquationDisplay(rowEquation(i), 'Selected integrator derivative'), createEquationDisplay('y=' + model.C.map((v, j) => '(' + tex(v) + ')x_{' + (j + 1) + '}').concat(['(' + tex(model.D) + ')u']).join('+'), 'Algebraic output equation'));
    if (result) showPoint();
  }
  function build(): void {
    try {
      resultSection.hidden = true; result = undefined; experiment = undefined; model = readModel(); selected = Math.min(selected, model.A.length - 1);
      diagramHost.replaceChildren(diagram(model, selected)); stateButtons.replaceChildren();
      model.A.forEach((_, i) => { const b = el('button', 'Select state x' + (i + 1), 'button'); b.type = 'button'; b.setAttribute('data-state', String(i)); stateButtons.append(b); });
      diagramSection.hidden = false; choose(selected); notice.textContent = model.A.length + ' integrator outputs define ' + model.A.length + ' states. Select one and trace its row.';
    } catch (error) { invalidate(); failMessage(error); }
  }
  function reveal(): void {
    build(); if (!model) return;
    try {
      experiment = { horizon: read(horizon), count: read(count), input: read(input), initial1: xA.slice(0, model.A.length).map(read), initial2: xB.slice(0, model.A.length).map(read) };
      result = run(model, experiment); const actual = derivative(model, experiment.initial1, experiment.input)[selected];
      const predictionText = prediction.value || prediction.validity.badInput ? (Math.abs(read(prediction) - actual) <= 1e-5 * Math.max(1, Math.abs(actual)) ? 'Prediction matched. ' : 'Compare your prediction with the derivative arithmetic. ') : '';
      const t = result.transfer;
      summary.replaceChildren(
        createEquationDisplay('x_A(0)=' + matrixTex(experiment.initial1.map(v => [v])) + ',\\quad x_B(0)=' + matrixTex(experiment.initial2.map(v => [v])) + ',\\quad U=' + tex(experiment.input), 'Compared initial states and shared constant input'),
        createEquationDisplay('\\dot{x}_A(0)=' + matrixTex(model.A) + matrixTex(experiment.initial1.map(v => [v])) + '+' + matrixTex(model.B.map(v => [v])) + '(' + tex(experiment.input) + ')=' + matrixTex(derivative(model, experiment.initial1, experiment.input).map(v => [v])), 'Initial derivative arithmetic'),
        createEquationDisplay('\\Phi(t)=e^{At},\\quad x_f(t)=\\Phi(t)x(0),\\quad x_u(t)=\\int_0^t e^{A(t-\\tau)}B U\\,d\\tau,\\quad x(t)=x_f(t)+x_u(t)', 'Free and forced state solution'),
        createEquationDisplay('\\exp\\left(' + matrixTex(model.A.map((row, i) => [...row, model!.B[i]]).concat([Array(model.A.length + 1).fill(0) as number[]])) + 't\\right)=\\begin{bmatrix}\\Phi(t)&H(t)\\\\0&1\\end{bmatrix},\\quad x_u(t)=H(t)U', 'Singular-safe input integral'),
        el('p', 'These are exact continuous-time identities for constant U; matrices and curves are numerical evaluations. No inverse of A is needed. Both experiments use the same U, so xᵤ and the zero-state output are identical.'),
        createEquationDisplay('\\Delta x(t)=\\Phi(t)(x_B(0)-x_A(0)),\\quad y_f=Cx_f,\\quad y_u=Cx_u+DU', 'Initial-state comparison and output decomposition'),
        createEquationDisplay('\\dot{x}_{' + (selected + 1) + '}(0)=' + tex(actual), 'Derivative checked at reveal'),
        createEquationDisplay('\\det(sI-A)\\approx ' + polynomialTex(t.denominator), 'Original characteristic polynomial'),
        createEquationDisplay('\\lambda(A)\\approx ' + result.modes.map(v => tex(v.real) + (v.imag ? (v.imag > 0 ? '+' : '-') + tex(Math.abs(v.imag)) + '\\mathrm{j}' : '')).join(',\\quad '), 'All original state modes'),
        createEquationDisplay('G(s)=D+C(sI-A)^{-1}B\\approx\\frac{' + polynomialTex(t.numerator) + '}{' + polynomialTex(t.denominator) + '}', 'Unreduced zero-state transfer channel'));
      if (t.cancellations) summary.append(createEquationDisplay('G_{\\mathrm{channel}}(s)\\approx\\frac{' + polynomialTex(t.reducedNumerator) + '}{' + polynomialTex(t.reducedDenominator) + '}', 'Reduced channel with original states retained'));
      summary.append(el('p', t.cancellations ? t.cancellations + ' dynamic factor(s) cancel in this zero-state channel. Every original mode and state remains in the diagram and response. A reduced channel cannot establish internal stability.' : 'No exact common factor was removed. Near cancellations are retained. Every original state/mode remains visible.', 'state-small'));
      summary.append(el('p', 'Entered constants first become numerical matrix values. Channel reduction cancels exact common factors of those stored values; displayed coefficients are rounded. Coefficient order is descending powers of s. The exponential is evaluated numerically.', 'state-small'));
      const collapsed = el('div', '', 'state-scroll'); collapsed.append(channelDiagram(model.A.length, t.reducedDenominator.length - 1));
      summary.append(collapsed, el('p', 'A single transfer rectangle describes this zero-state input/output channel. The integrator realization retains the original states, including their initial conditions and hidden modes. Count integrator outputs, rather than graphical rectangles.', 'state-small'));
      notice.textContent = predictionText + 'Derivative checked for x' + (selected + 1) + ' at t=0: ' + fmt(actual) + '. ' + result.warning;
      const table = el('table'), head = el('thead'), hr = el('tr'), body = el('tbody');
      ['t (s)', 'Free A states', 'Free B states', 'Shared forced states', 'Total A states', 'Total B states', 'Free A output', 'Forced output', 'Total A output', 'Total B output'].forEach(s => { const h = el('th', s); h.scope = 'col'; hr.append(h); }); head.append(hr);
      result.points.forEach(p => { const tr = el('tr'); [fmt(p.t), ...[p.free1, p.free2, p.forced, p.total1, p.total2].map(x => x.map(fmt).join(', ')), ...[p.yFree1, p.yForced, p.y1, p.y2].map(fmt)].forEach(s => tr.append(el('td', s))); body.append(tr); }); table.append(head, body); tableHost.replaceChildren(table);
      inspect.max = String(result.points.length - 1);
      try {
        const k = read(inspect);
        if (Number.isInteger(k) && k >= 0) inspect.value = String(Math.min(k, result.points.length - 1));
      } catch { /* Preserve the draft for localized showPoint feedback. */ }
      statePlot.replaceChildren(); outputPlot.replaceChildren(); resultSection.hidden = false; showPoint();
    } catch (error) { result = undefined; experiment = undefined; resultSection.hidden = true; failMessage(error); }
  }
  function showPoint(): void {
    if (!result || !experiment || !model || signal.aborted) return;
    let k: number;
    try { k = read(inspect); }
    catch (error) { inspected.replaceChildren(el('p', 'Inspection point: ' + (error instanceof Error ? error.message : 'Enter a valid index.'))); return; }
    if (!Number.isInteger(k) || k < 0 || k >= result.points.length) { inspected.replaceChildren(el('p', 'Choose a drawing point from 0 to ' + (result.points.length - 1) + '.')); return; }
    const p = result.points[k], vector = (v: number[]): string => matrixTex(v.map(x => [x]));
    inspected.replaceChildren(el('h4', 't = ' + fmt(p.t) + ' s; selected x' + (selected + 1)),
      createEquationDisplay('\\Phi(t)=' + matrixTex(p.phi) + ',\\quad H(t)=' + vector(p.integral), 'Transition matrix and input integral'),
      createEquationDisplay('x_{f,A}=' + vector(p.free1) + ',\\quad x_{f,B}=' + vector(p.free2) + ',\\quad x_u=' + vector(p.forced), 'Free states and common forced states'),
      createEquationDisplay('x_A=' + vector(p.total1) + ',\\quad x_B=' + vector(p.total2) + ',\\quad\\Delta x=' + vector(p.difference), 'Total states and initial-state difference'),
      createEquationDisplay('y_A=(' + tex(p.yFree1) + ')+(' + tex(p.yForced) + ')=' + tex(p.y1) + ',\\quad y_B=(' + tex(p.yFree2) + ')+(' + tex(p.yForced) + ')=' + tex(p.y2), 'Output superposition'));
    statePlot.replaceChildren(responsePlot(result, selected, k)); outputPlot.replaceChildren(responsePlot(result, 'output', k));
  }
  fillHelper(mechanical);
  root.append(el('p', 'Bounds: real SISO n=1–2; model/input/initial magnitudes ≤10⁴; horizon .01–10 s; 21–401 drawing points; free/forced/total state and output magnitudes ≤10¹⁰. Per entry: 160 characters, nesting 12, intermediate magnitude ≤10⁸; matrix text ≤1,200 characters. Channel algebra: degree ≤2 and rational numerators/denominators ≤8192 bits; nonzero characteristic/channel coefficient and discriminant magnitudes 10⁻³⁰⁰–10³⁰⁰. Exponential: infinity norm ≤64, at most 64 Taylor terms and 7 squarings. Display 7 significant digits; trajectories use floating point. Constant U for t≥0, with no externally connected feedback.', 'state-small'));
  return () => { fields.forEach(f => f.destroy()); root.remove(); };
};
