import type { ModuleMount } from '../../core/module';
import { createEquationDisplay, createEquationInput } from '../../shared/equations/input';
import { fmt, matrixTex, polyTex, realize, recurrence, run, tex, transfer, type Experiment, type Method, type Result, type Source } from './math';
import { parseModel } from './parser';
import { trajectoryPlot } from './plot';
import './workspace.css';

export const mount: ModuleMount = ({ container, signal }) => {
  const root = document.createElement('div'); root.className = 'zoh-tool'; container.append(root);
  const element = <K extends keyof HTMLElementTagNameMap>(tag: K, text = '', cls = ''): HTMLElementTagNameMap[K] => {
    const e = document.createElement(tag); e.textContent = text; e.className = cls; return e;
  };
  const on = (target: EventTarget, event: string, action: () => void): void => target.addEventListener(event, action, { signal });
  const section = (title: string): HTMLElement => { const e = element('section'); e.append(element('h3', title)); root.append(e); return e; };
  const button = (text: string, action: () => void): HTMLButtonElement => {
    const e = element('button', text, 'button'); e.type = 'button'; on(e, 'click', action); return e;
  };
  const number = (host: HTMLElement, label: string, value: number | '', min: number, max: number, step = 'any'): HTMLInputElement => {
    const wrap = element('label', label), input = element('input'); input.type = 'number'; input.value = String(value);
    input.min = String(min); input.max = String(max); input.step = step; wrap.append(input); host.append(wrap); return input;
  };
  const select = (host: HTMLElement, label: string, choices: [string, string][]): HTMLSelectElement => {
    const wrap = element('label', label), input = element('select');
    choices.forEach(([value, text]) => { const e = element('option', text); e.value = value; input.append(e); }); wrap.append(input); host.append(wrap); return input;
  };
  const read = (input: HTMLInputElement): number => {
    const raw = input.value, value = input.valueAsNumber;
    if (!raw.trim()) throw new Error('Complete all required numeric controls.');
    if (value === 0 && /[1-9]/.test(raw.split(/[eE]/)[0])) throw new Error('A nonzero numeric input is too small to represent. Rescale it.');
    return value;
  };
  const setup = section('1. Define the continuous plant and hold');
  setup.append(element('p', 'Enter the rational plant alone; use the separate integer-delay control for transport delay. Use decimal coefficients, s, fractions, products and integer powers 0–2. Real proper models of order 1–2 are supported. Inputs and outputs use normalized units, and time is in seconds.'));
  const actions = element('div', '', 'zoh-actions'); setup.append(actions);
  const resultHost = element('div'); resultHost.hidden = true;
  const notice = element('p', 'Predict the first sample, then reveal the sampled model.', 'zoh-notice'); notice.setAttribute('role', 'status');
  let result: Result | undefined, source: Source | undefined, experiment: Experiment | undefined;
  const invalidate = (): void => {
    result = undefined; source = undefined; experiment = undefined; resultHost.hidden = true;
    notice.textContent = 'Inputs changed. Predict and reveal again.';
  };
  const plant = createEquationInput({ label: 'Continuous rational plant', value: String.raw`G(s)=\frac1{s+1}`, signal, onChange: invalidate }); setup.append(plant.element);
  const controls = element('div', '', 'zoh-controls'); setup.append(controls);
  const T = number(controls, 'Sample period T (s)', 0.1, 0.0001, 10);
  const delay = number(controls, 'Input delay m (whole samples)', 0, 0, 12, '1');
  const input = select(controls, 'Held input sequence', [['step', 'Step: u[k] = A'], ['pulse', 'One-period pulse: u[0] = A'], ['ramp', 'Sampled physical ramp: u[k] = A kT']]);
  const amplitude = number(controls, 'Amplitude A (ramp: units/s)', 1, -10000, 10000);
  const x1 = number(controls, 'Initial state x₁(0)', 0, -10000, 10000);
  const x2 = number(controls, 'Initial state x₂(0), order 2 only', 0, -10000, 10000);
  const count = number(controls, 'Number of sample instants', 31, 4, 120, '1');
  const density = number(controls, 'Drawing subdivisions per interval', 8, 2, 16, '1');
  const method = select(controls, 'Compare interval approximation', [['forward', 'Forward Euler'], ['backward', 'Backward Euler'], ['trapezoid', 'Trapezoidal integration']]);
  [T, delay, input, amplitude, x1, x2, count, density, method].forEach(c => on(c, 'input', invalidate));
  setup.append(element('p', 'Clock/hold convention: u[k−m] is constant on [kT,(k+1)T). Input samples before index 0 are zero. The delay is before the plant; τ=mT changes when T changes with m fixed. y[k] is the right-hand value Cx[k]+Du[k−m]. The zero-state transfer function does not include your selected initial state.', 'zoh-small'));
  const usePreset = (latex: string, period: number, m = 0): void => {
    plant.setValue(latex); T.value = String(period); delay.value = String(m); input.value = 'step'; amplitude.value = '1';
    x1.value = x2.value = '0'; count.value = '31'; density.value = '8'; method.value = 'forward'; prediction.value = ''; invalidate();
  };
  actions.append(button('Baseline T = 0.1 s', () => usePreset(String.raw`G(s)=\frac1{s+1}`, 0.1)),
    button('Worksheet T = 0.2 s', () => usePreset(String.raw`G(s)=\frac1{s+1}`, 0.2)),
    button('Integrator', () => usePreset(String.raw`G(s)=\frac1s`, 0.1)),
    button('Double integrator', () => usePreset(String.raw`G(s)=\frac1{s^2}`, 0.1)),
    button('Delayed 5/s²', () => usePreset(String.raw`G(s)=\frac5{s^2}`, 0.2, 1)),
    button('Oscillator', () => usePreset(String.raw`G(s)=\frac1{s^2+1}`, 0.1)));
  setup.append(element('p', 'The delayed preset is the separately declared ZOH plant path, not the full original feedback diagram. Integrator/oscillator examples are independent teaching fixtures.', 'zoh-small'));
  const attempt = section('2. Predict and reveal');
  const prediction = number(attempt, 'Your prediction for y[1] (optional)', '', -1e10, 1e10);
  attempt.append(button('Reveal sampled model', reveal), notice);
  root.append(resultHost); resultHost.append(element('h3', '3. Compare source trajectory and sampled models'));
  const feedback = element('p', '', 'zoh-notice'), equations = element('div');
  const inspect = number(resultHost, 'Inspect sample k', 1, 0, 30, '1');
  const outputPlot = element('div', '', 'zoh-plot'), inputPlot = element('div', '', 'zoh-plot');
  for (const p of [outputPlot, inputPlot]) { p.tabIndex = 0; p.setAttribute('aria-label', 'Sampling plot; scroll horizontally on narrow screens'); }
  const arithmetic = element('div'), data = element('details'), tableHost = element('div', '', 'zoh-table'); data.append(element('summary', 'All sample values and states'), tableHost);
  resultHost.append(feedback, equations, outputPlot, inputPlot,
    element('p', 'Solid curve: continuous source driven by the declared held input. Filled circles: exact ZOH samples. Open squares: selected interval approximation. Separate interval paths retain feedthrough jumps. The drawing uses a finite grid; it does not compute a continuous peak. Changing drawing density leaves sample times and values unchanged.', 'zoh-small'), arithmetic, data);
  on(inspect, 'input', showSample);
  function showSample(): void {
    if (!result || !source || !experiment || signal.aborted) return;
    const k = inspect.valueAsNumber;
    if (!Number.isInteger(k) || k < 0 || k >= result.samples.length) { arithmetic.replaceChildren(element('p', `Choose k from 0 to ${result.samples.length - 1}.`)); return; }
    const row = result.samples[k];
    outputPlot.replaceChildren(trajectoryPlot(result, 'output', k)); inputPlot.replaceChildren(trajectoryPlot(result, 'input', k));
    arithmetic.replaceChildren(element('h4', `Sample k = ${k}, t = ${fmt(row.t)} s`),
      createEquationDisplay(`x[${k}]=${matrixTex(row.x.map(v => [v]))},\\quad u[${k}-${experiment.delay}]=${tex(row.held)}`, 'State and held delayed input'),
      createEquationDisplay(`y[${k}]=${matrixTex([source.C])}${matrixTex(row.x.map(v => [v]))}+(${tex(source.D)})(${tex(row.held)})=${tex(row.y)}`, 'Output arithmetic'));
    if (k < result.samples.length - 1) arithmetic.append(createEquationDisplay(`x[${k + 1}]=${matrixTex(result.exact.A)}${matrixTex(row.x.map(v => [v]))}+${matrixTex(result.exact.B.map(v => [v]))}(${tex(row.held)})=${matrixTex(result.samples[k + 1].x.map(v => [v]))}`, 'Simultaneous state update'));
  }
  function reveal(): void {
    if (signal.aborted) return;
    resultHost.hidden = true;
    try {
      const draft = plant.getValue();
      if (draft.empty || draft.hasPlaceholders || draft.syntaxIssues.length) throw new Error('Complete the plant and check its equation notation.');
      const model = parseModel(draft.latex); source = realize(model);
      experiment = { T: read(T), count: read(count), density: read(density), delay: read(delay), amplitude: read(amplitude), initial: source.A.length === 1 ? [read(x1)] : [read(x1), read(x2)], input: input.value as Experiment['input'], method: method.value as Method };
      result = run(source, experiment);
      const d = result.exact, tf = transfer(source, d), n = source.A.length;
      const augmented = source.A.map((row, i) => [...row, source!.B[i]]).concat([Array(n + 1).fill(0) as number[]]);
      const actual = result.samples[1].y, guess = prediction.valueAsNumber;
      feedback.textContent = `${prediction.value && Number.isFinite(guess) ? (Math.abs(guess - actual) <= 1e-5 * Math.max(1, Math.abs(actual)) ? 'Prediction matched within tolerance. ' : 'Compare your prediction with the state update. ') : ''}First sample y[1] = ${fmt(actual)}. ${result.maxError === undefined ? '' : `Maximum sampled output difference on this horizon: ${fmt(result.maxError)}.`} ${result.warning}`;
      equations.replaceChildren(
        createEquationDisplay(`\\dot{x}=Ax+Bu_h,\\quad y=Cx+Du_h`, 'Continuous source equations'),
        createEquationDisplay(`A=${matrixTex(source.A)},\\quad B=${matrixTex(source.B.map(v => [v]))},\\quad C=${matrixTex([source.C])},\\quad D=${tex(source.D)}`, 'Continuous canonical matrices'),
        createEquationDisplay(`\\exp\\left(${matrixTex(augmented)}T\\right)=\\begin{bmatrix}A_d&B_d\\\\0&1\\end{bmatrix}`, 'Augmented exponential construction'),
        createEquationDisplay(`A_d=e^{AT}=${matrixTex(d.A)},\\quad B_d=\\int_0^T e^{A\\tau}B\\,d\\tau=${matrixTex(d.B.map(v => [v]))}`, 'Exact ZOH identity with numerical matrices'),
        element('p', 'The identities are exact for this hold; the displayed matrices are numerical evaluations. The augmented construction works when A is singular. It does not divide by A.'),
        createEquationDisplay(`x[k+1]=A_dx[k]+B_du[k-${experiment.delay}],\\quad y[k]=Cx[k]+Du[k-${experiment.delay}]`, 'Sampled state recurrence'),
        createEquationDisplay(`G_d(z)=z^{-${experiment.delay}}\\left(D+C(zI-A_d)^{-1}B_d\\right)=z^{-${experiment.delay}}\\frac{${polyTex(tf.b, 'z')}}{${polyTex(tf.a, 'z')}}`, 'Zero-state pulse transfer function'),
        createEquationDisplay(recurrence(tf, experiment.delay), 'Zero-state scalar recurrence'),
        element('p', 'Coefficient order is descending powers of z; recurrence terms are successive delays. The scalar transfer recurrence uses zero state/history; selected initial state is propagated separately in the state model. Initial output samples are determined by that state and the held input.', 'zoh-small'));
      const methodName = method.options[method.selectedIndex].text;
      equations.append(element('h4', `${methodName} comparison`));
      const formula = method.value === 'forward' ? 'A_a=I+TA,\\quad B_a=TB'
        : method.value === 'backward' ? 'A_a=(I-TA)^{-1},\\quad B_a=(I-TA)^{-1}TB'
          : 'A_a=(I-TA/2)^{-1}(I+TA/2),\\quad B_a=(I-TA/2)^{-1}TB';
      equations.append(createEquationDisplay(formula, 'Selected interval approximation'),
        element('p', 'Both endpoint derivatives use the same constant held value from inside this interval. These are numerical plant-interval approximations; they are different from emulating a continuous controller by a frequency substitution. Approximation can change stability and performance. The reported difference covers these sampled outputs on this finite horizon only.', 'zoh-small'));
      if (result.approx && result.comparison) equations.append(createEquationDisplay(`A_a=${matrixTex(result.approx.A)},\\quad B_a=${matrixTex(result.approx.B.map(v => [v]))}`, 'Approximate interval matrices'));
      equations.append(element('p', `Sample clock T = ${fmt(experiment.T)} s. Input delay m = ${experiment.delay}, τ = ${fmt(experiment.delay * experiment.T)} s. ${experiment.count} sample instants span 0–${fmt(result.samples.at(-1)!.t)} s; ${experiment.density} drawing subdivisions per interval.`, 'zoh-small'));
      const table = element('table'), header = element('tr');
      ['k', 't (s)', 'Held u[k−m]', 'Exact y[k]', 'Approx. y[k]', 'State x[k]'].forEach(text => { const e = element('th', text); e.scope = 'col'; header.append(e); });
      const head = element('thead'), body = element('tbody'); head.append(header);
      result.samples.forEach((r, k) => { const row = element('tr'); [String(k), fmt(r.t), fmt(r.held), fmt(r.y), result!.comparison ? fmt(result!.comparison[k].y) : 'Unavailable', r.x.map(fmt).join(', ')].forEach(text => row.append(element('td', text))); body.append(row); });
      table.append(head, body); tableHost.replaceChildren(table);
      inspect.max = String(result.samples.length - 1); inspect.value = String(Math.min(Number(inspect.value) || 0, result.samples.length - 1));
      resultHost.hidden = false; notice.textContent = 'Exact ZOH model and selected comparison computed. Change T, the hold data or drawing density for another experiment.'; showSample();
    } catch (error) {
      result = undefined; source = undefined; experiment = undefined;
      notice.textContent = error instanceof Error ? error.message : 'Check the plant and experiment values.';
    }
  }
  root.append(element('p', 'Bounds: real proper plant order 1–2; 4–120 sample instants; T=0.0001–10 s; integer delay 0–12; drawing subdivisions 2–16; amplitude/initial-state magnitude ≤10⁴; output magnitude ≤10¹⁰ and state magnitude ≤10¹². Augmented interval matrix infinity norm ≤64; at most 64 exponential-series terms and 7 squarings. Parser: 512 characters, 20 nested groups, intermediate degree ≤6, entered/normalized coefficient magnitude ≤10⁶, leading denominator magnitude ≥10⁻⁸. Displays use 7 significant digits; calculation uses floating-point precision.', 'zoh-small'));
  return () => { plant.destroy(); root.remove(); };
};
