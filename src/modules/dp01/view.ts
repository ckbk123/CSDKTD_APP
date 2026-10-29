import type { ModuleMount } from '../../core/module';
import { createEquationDisplay, createEquationInput } from '../../shared/equations/input';
import { readNumericInput } from '../../shared/numeric-input';
import { classify, format, freeDecomposition, impulseDecomposition, modalSamples, parseModel, poles, recurrence, simulate, tex, type Excitation, type Model, type Sample } from './math';
import { stemPlot } from './plot';
import './workspace.css';

export const mount: ModuleMount = ({ container, signal }) => {
  const root = document.createElement('div'); root.className = 'dp01';
  container.append(root);
  const el = <K extends keyof HTMLElementTagNameMap>(tag: K, text = '', className = ''): HTMLElementTagNameMap[K] => {
    const e = document.createElement(tag); e.textContent = text; e.className = className; return e;
  };
  const section = (title: string): HTMLElement => {
    const s = el('section', '', 'dp-section'); s.append(el('h3', title)); root.append(s); return s;
  };
  const listen = (target: EventTarget, name: string, fn: () => void): void => target.addEventListener(name, fn, { signal });
  const button = (text: string, fn: () => void): HTMLButtonElement => {
    const b = el('button', text, 'button'); b.type = 'button'; listen(b, 'click', fn); return b;
  };
  const number = (parent: HTMLElement, label: string, value: number, min: number, max: number, step = 'any'): HTMLInputElement => {
    const wrap = el('label', label); const input = el('input');
    input.type = 'number'; input.value = String(value); input.min = String(min); input.max = String(max); input.step = step;
    wrap.append(input); parent.append(wrap); return input;
  };
  const select = (parent: HTMLElement, label: string, choices: [string, string][]): HTMLSelectElement => {
    const wrap = el('label', label); const input = el('select');
    choices.forEach(([value, text]) => { const opt = el('option', text); opt.value = value; input.append(opt); });
    wrap.append(input); parent.append(wrap); return input;
  };
  let model: Model | undefined;
  let rows: Sample[] = [];
  let shown = false;
  const setup = section('1. Choose a sequence experiment');
  setup.append(el('p', 'Edit a real, proper transfer function in z (denominator order 1–2). Use sums, products, fractions and powers 0–2. The original denominator is retained, including cancelled modes.'));
  const presets = el('div', '', 'dp-actions'); setup.append(presets);
  const results = el('div'); results.hidden = true;
  const notice = el('p', 'Make a prediction, then reveal the computed samples.', 'dp-notice'); notice.setAttribute('role', 'status');
  const invalidate = (): void => {
    if (signal.aborted) return;
    shown = false; model = undefined; rows = []; results.hidden = true;
    notice.textContent = 'Inputs changed. Predict, then reveal again.';
  };
  const plant = createEquationInput({ label: 'Experiment transfer function', value: String.raw`G(z)=\frac{0.2}{z-0.8}`, signal, onChange: invalidate });
  setup.append(plant.element);
  const controls = el('div', '', 'dp-controls'); setup.append(controls);
  const input = select(controls, 'Input sequence', [['step', 'Step: u[k] = A'], ['impulse', 'Impulse: u[0] = A only'], ['ramp', 'Physical ramp: u[k] = A kT'], ['free', 'Free: u[k] = 0']]);
  const T = number(controls, 'Sample period T (s)', 0.1, 0.0001, 100);
  const amplitude = number(controls, 'Amplitude A (ramp: units/s)', 1, -10000, 10000);
  const count = number(controls, 'Number of samples', 41, 4, 200, '1');
  const history = select(controls, 'Initial output history', [['zero', 'Zero history'], ['custom', 'Custom history']]);
  const h1 = number(controls, 'y[−1]', 0, -10000, 10000);
  const h2 = number(controls, 'y[−2] (order 2 only)', 0, -10000, 10000);
  h1.disabled = true; h2.disabled = true;
  listen(history, 'change', () => {
    h1.disabled = history.value === 'zero'; h2.disabled = history.value === 'zero';
    invalidate();
  });
  [input, T, amplitude, count, h1, h2].forEach(c => listen(c, 'input', invalidate));
  setup.append(el('p', 'Causal input: u[k] = 0 for k < 0. Histories mean output samples before k = 0. No feedback loop is assumed. A nonzero history adds a free response to the same zero-state transfer function.', 'dp-small'));
  const usePreset = (formula: string, mode: Excitation, v1 = 0, v2 = 0): void => {
    plant.setValue(formula); input.value = mode; T.value = '0.1'; amplitude.value = '1'; count.value = '41';
    h1.value = String(v1); h2.value = String(v2); history.value = v1 || v2 ? 'custom' : 'zero';
    h1.disabled = h2.disabled = history.value === 'zero'; prediction.value = ''; invalidate();
  };
  presets.append(
    button('Baseline step', () => usePreset(String.raw`G(z)=\frac{0.2}{z-0.8}`, 'step')),
    button('Mode +0.8', () => usePreset(String.raw`G(z)=\frac{1}{z-0.8}`, 'free', 1.25)),
    button('Mode −0.8', () => usePreset(String.raw`G(z)=\frac{1}{z+0.8}`, 'free', -1.25)),
    button('Conjugate pair', () => usePreset(String.raw`G(z)=\frac{1}{z^2+0.64}`, 'free', 0, -1.5625)),
    button('Repeated pole +1', () => usePreset(String.raw`G(z)=\frac{1}{(z-1)^2}`, 'free', 1, 0)),
  );
  setup.append(el('p', 'Mode presets are proposed teaching fixtures. The conjugate preset gives 0.8ᵏ cos(kπ/2); the repeated boundary example gives k+2.', 'dp-small'));
  const attempt = section('2. Predict, then check');
  const prediction = select(attempt, 'Do all natural modes decay for arbitrary finite history?', [['', 'Choose a prediction (optional)'], ['yes', 'Yes, all decay'], ['no', 'No, at least one does not decay']]);
  attempt.append(button('Reveal computed sequence', reveal), notice);

  root.append(results);
  results.append(el('h3', '3. Read the samples and reasoning'));
  const feedback = el('p', '', 'dp-notice'); const equations = el('div');
  const plotControls = el('div', '', 'dp-controls');
  const axis = select(plotControls, 'Horizontal axis', [['samples', 'Sample index k'], ['seconds', 'Physical time (s)']]);
  const component = select(plotControls, 'Plot component', [['total', 'Total output + input'], ['parts', 'Forced + free output']]);
  const guide = select(plotControls, 'Between samples', [['none', 'Stems only'], ['held', 'Held drawing guide (dashed)']]);
  const sample = number(plotControls, 'Inspect sample k', 3, 0, 40, '1');
  const plot = el('div', '', 'dp-plot'); plot.tabIndex = 0; plot.setAttribute('aria-label', 'Sequence plot; scroll horizontally on narrow screens'); const arithmetic = el('div');
  const data = el('details'); data.append(el('summary', 'All computed samples (accessible table)')); const tableHost = el('div', '', 'dp-table'); data.append(tableHost);
  results.append(feedback, equations, plotControls, plot, el('p', 'Solid filled stems: total or forced output. Dashed open stems: input or free output. Held stairs, when enabled, are a drawing guide. No continuous plant/hold is specified, so no intersample peak is established.', 'dp-small'), arithmetic, data);

  function updatePlot(): void {
    if (!shown || signal.aborted) return;
    let k: number;
    try { k = readNumericInput(sample, 'Sample index k'); }
    catch (reason) { arithmetic.replaceChildren(el('p', reason instanceof Error ? reason.message : 'Check the sample index.')); return; }
    if (!Number.isInteger(k) || k < 0 || k >= rows.length) {
      arithmetic.replaceChildren(el('p', `Choose a sample index from 0 to ${rows.length - 1}.`)); return;
    }
    const traces = component.value === 'parts'
      ? [{ name: 'Forced output', values: rows.map(r => r.forced) }, { name: 'Free output', values: rows.map(r => r.free), secondary: true }]
      : [{ name: 'Total output', values: rows.map(r => r.y) }, { name: 'Input', values: rows.map(r => r.u), secondary: true }];
    plot.replaceChildren(stemPlot(traces, Number(T.value), axis.value === 'seconds', guide.value === 'held', k));
    const r = rows[k];
    const terms = model!.a.slice(1).map((a, j) => {
      const index = k - j - 1;
      const value = index < 0 ? (history.value === 'zero' ? 0 : Number(index === -1 ? h1.value : h2.value)) : rows[index].y;
      return `(${tex(-a)})(${tex(value)})`;
    }).concat(model!.b.map((b, j) => `(${tex(b)})(${tex(rows[k - j]?.u ?? 0)})`));
    arithmetic.replaceChildren(el('h4', `Sample ${k} at t = ${format(r.t)} s`),
      createEquationDisplay(`y[${k}]=${terms.join('+')}=${tex(r.y)}`, 'Sample recurrence arithmetic'),
      createEquationDisplay(`y[${k}]=y_{forced}[${k}]+y_{free}[${k}]=(${tex(r.forced)})+(${tex(r.free)})`, 'Forced and free components'));
  }
  [axis, component, guide, sample].forEach(c => listen(c, 'input', updatePlot));

  function reveal(): void {
    if (signal.aborted) return;
    shown = false; results.hidden = true;
    try {
      const draft = plant.getValue();
      if (draft.empty || draft.hasPlaceholders || draft.syntaxIssues.length) throw new Error('Complete the transfer function and check its notation before calculating.');
      model = parseModel(draft.latex);
      const period = readNumericInput(T, 'Sample period T (s)');
      rows = simulate(model, { T: period, count: readNumericInput(count, 'Number of samples'), amplitude: readNumericInput(amplitude, 'Amplitude A'), input: input.value as Excitation,
        history: history.value === 'zero' ? [0, 0] : [readNumericInput(h1, 'Output history y[−1]'), readNumericInput(h2, 'Output history y[−2]')] });
      const ps = poles(model);
      const decays = ps.every(p => Math.hypot(p.re, p.im) < 1 - 1e-9);
      const nearBoundary = ps.some(p => Math.abs(Math.hypot(p.re, p.im) - 1) <= 1e-9);
      feedback.textContent = nearBoundary ? 'A pole is on or within 10⁻⁹ of the unit circle. Strict decay is not certified at this tolerance.'
        : `${prediction.value ? (prediction.value === (decays ? 'yes' : 'no') ? 'Prediction matched. ' : 'Revisit your prediction. ') : ''}${decays ? 'All natural modes decay.' : 'At least one natural mode fails to decay.'}`;
      equations.replaceChildren(createEquationDisplay(recurrence(model), 'Normalized causal recurrence'),
        el('p', `Coefficient convention: descending powers of z; normalized denominator [${model.a.map(format).join(', ')}], numerator padded to the same degree [${model.b.map(format).join(', ')}]. In the recurrence these are successive delays.`, 'dp-small'),
        createEquationDisplay('y[k]=y_{free}[k]+\\sum_{m=0}^{k}h[k-m]u[m]', 'Free response plus impulse convolution'),
        el('p', 'h[k] is this model’s zero-history unit-impulse response. The forced component is calculated from the recurrence with zero history. The free component uses your output history with u = 0.'),
        createEquationDisplay(freeDecomposition(model, rows), 'Natural modal decomposition from the initial history'),
        createEquationDisplay(impulseDecomposition(model), 'Modal decomposition of the impulse response'),
        el('p', 'The impulse formula includes its initial samples and a modal tail. δ[k] is 1 at k = 0 and 0 otherwise; 0⁰ = 1. These modes also generate the forced response through the convolution above.', 'dp-small'));
      ps.forEach((p, i) => {
        const r = Math.hypot(p.re, p.im), theta = Math.atan2(p.im, p.re);
        equations.append(createEquationDisplay(`p_{${i + 1}}=${tex(p.re)}${p.im < 0 ? '-' : '+'}${tex(Math.abs(p.im))}j,\\quad |p|=${tex(r)},\\quad\\theta=${tex(theta)}\\;\\mathrm{rad/sample}`, `Pole ${i + 1}`),
          el('p', `${classify(p)}. ${r === 0 ? 'A zero pole is a finite-memory mode; 0⁰ is taken as 1.' : `Principal angular frequency θ/T = ${format(theta / period)} rad/s; alias branches differ by 2π/T.`}`));
      });
      equations.append(el('p', 'A repeated pole also contributes k pᵏ. Thus a repeated unit-circle pole can grow even when a simple unit-circle mode stays bounded. These statements concern denominator/free modes, not a blanket BIBO or internal-stability certificate. Rounded displayed coefficients/formulas use six significant digits; samples use full precision.', 'dp-small'));
      sample.max = String(rows.length - 1); sample.value = String(Math.min(Number(sample.value) || 0, rows.length - 1));
      const table = el('table'); const head = el('thead'); const header = el('tr');
      ['k', 't (s)', 'u[k]', 'Forced', 'Free', 'y[k]'].forEach(text => { const th = el('th', text); th.scope = 'col'; header.append(th); });
      head.append(header); const body = el('tbody');
      rows.forEach(r => { const tr = el('tr'); [r.k, r.t, r.u, r.forced, r.free, r.y].forEach(v => tr.append(el('td', format(v)))); body.append(tr); });
      table.append(head, body); tableHost.replaceChildren(table);
      shown = true; results.hidden = false; notice.textContent = `${rows.length} samples computed. Change the model or history to try another experiment.`;
      updatePlot();
    } catch (error) {
      model = undefined; rows = [];
      notice.textContent = error instanceof Error ? error.message : 'Check the experiment inputs.';
    }
  }

  const lab = section('4. Compare modes at the same radius');
  lab.append(el('p', 'Compare real modes rᵏ cos(kθ), representing a conjugate pair when 0 < θ < π. θ = 0 gives +r; θ = π gives −r. The envelope radius stays fixed while the oscillation changes.'));
  const labControls = el('div', '', 'dp-controls'); lab.append(labControls);
  const radius = number(labControls, 'Comparison radius r', 0.8, 0, 1.5);
  const thetaA = number(labControls, 'Angle A (degrees/sample)', 0, 0, 180);
  const thetaB = number(labControls, 'Angle B (degrees/sample)', 180, 0, 180);
  const labPlot = el('div', '', 'dp-plot'); labPlot.tabIndex = 0; labPlot.setAttribute('aria-label', 'Mode comparison plot; scroll horizontally on narrow screens'); const labText = el('p');
  const compare = (): void => {
    let r: number, a: number, b: number;
    try {
      r = readNumericInput(radius, 'Comparison radius r');
      a = readNumericInput(thetaA, 'Angle A (degrees/sample)');
      b = readNumericInput(thetaB, 'Angle B (degrees/sample)');
    } catch (reason) {
      labPlot.replaceChildren(); labText.textContent = reason instanceof Error ? reason.message : 'Check the comparison inputs.'; return;
    }
    if (![r, a, b].every(Number.isFinite) || r < 0 || r > 1.5 || Math.min(a, b) < 0 || Math.max(a, b) > 180) {
      labPlot.replaceChildren(); labText.textContent = 'Use radius 0–1.5 and angles 0–180 degrees per sample.'; return;
    }
    labPlot.replaceChildren(stemPlot([{ name: 'Mode A (solid)', values: modalSamples(r, a * Math.PI / 180, 32) }, { name: 'Mode B (dashed)', values: modalSamples(r, b * Math.PI / 180, 32), secondary: true }], 1, false, false));
    labText.textContent = `Solid filled: A, θ = ${format(a)}°. Dashed open: B, θ = ${format(b)}°. Both have radius ${format(r)}: ${r < 1 ? 'decaying envelope' : r > 1 ? 'growing envelope' : 'constant single-mode envelope'}. This comparison is normalized to initial modal amplitude 1 and is separate from the transfer-function experiment.`;
  };
  [radius, thetaA, thetaB].forEach(c => listen(c, 'input', () => {
    labPlot.replaceChildren(); labText.textContent = 'Comparison inputs changed. Select Compare modes to draw the new samples.';
  }));
  lab.append(button('Compare modes', compare), labPlot, labText,
    el('p', 'Try 45° and 90° at r = 0.8, then compare 0° with 180°. Sample period is a physical model parameter, never plot resolution. Changing T leaves fixed discrete step/impulse/free samples unchanged, but changes the physical ramp values A kT and time labels.', 'dp-small'));
  root.append(el('p', 'Bounds: 4–200 samples; T = 0.0001–100 s; entered numbers ≤ 10⁶; normalized coefficients ≤ 10⁶; amplitude/history ≤ 10⁴; response magnitude ≤ 10¹⁰. Denominator leading magnitude ≥ 10⁻⁸. The parser accepts at most 512 characters, 20 nested groups and intermediate degree 6. Unsupported forms and excessive responses stop with feedback.', 'dp-small'));
  compare();
  return () => { plant.destroy(); root.remove(); };
};
