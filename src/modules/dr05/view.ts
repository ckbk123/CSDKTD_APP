import type { ModuleMount } from '../../core/module';
import { createEquationDisplay, createEquationInput, type EquationInput } from '../../shared/equations/input';
import { readNumericInput } from '../../shared/numeric-input';
import { fmt, matrixTex, polyTex, realize, recurrence, run, tex, transfer, type Experiment, type Method, type Result, type Source } from './math';
import { parseModel } from './parser';
import { trajectoryPlot, type SamplingPlot } from './plot';
import { samplingWindow, type SamplingWindow, type WindowPolicy } from './window';
import './workspace.css';

const element = <K extends keyof HTMLElementTagNameMap>(tag: K, text = '', cls = ''): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag); node.textContent = text; node.className = cls; return node;
};
interface Snapshot {
  source: Source; experiment: Experiment; result: Result; window: SamplingWindow;
  scalar?: ReturnType<typeof transfer>; scalarWarning: string; latex: string; checked: boolean;
}
export const mount: ModuleMount = ({ container, signal: parent }) => {
  const life = new AbortController(), signal = life.signal, root = element('div', '', 'zoh-tool'); container.append(root);
  let disposed = false, timer: number | undefined, plant: EquationInput | undefined, current: Snapshot | undefined;
  let outputDrawing: SamplingPlot | undefined, inputDrawing: SamplingPlot | undefined, selected = 1, inspectionValid = true;
  const cancel = () => { if (timer !== undefined) { window.clearTimeout(timer); timer = undefined; } };
  const cleanup = () => { if (disposed) return; disposed = true; cancel(); parent.removeEventListener('abort', cleanup); life.abort(); plant?.destroy(); root.remove(); };
  parent.addEventListener('abort', cleanup, { once: true }); if (parent.aborted) { cleanup(); return cleanup; }
  try {
    const on = (node: EventTarget, event: string, action: () => void) => node.addEventListener(event, () => { if (!disposed && !signal.aborted) action(); }, { signal });
    const button = (host: HTMLElement, title: string, action: () => void) => { const b = element('button', title, 'button'); b.type = 'button'; on(b, 'click', action); host.append(b); return b; };
    const label = (host: HTMLElement, title: string, control: HTMLElement) => { const l = element('label', title); l.append(control); host.append(l); return l; };
    const number = (host: HTMLElement, title: string, value: string, min: number, max: number, step = 'any') => {
      const node = element('input'); node.type = 'number'; node.value = value; node.min = String(min); node.max = String(max); node.step = step; node.setAttribute('aria-label', title); label(host, title, node); return node;
    };
    const select = (host: HTMLElement, title: string, choices: readonly (readonly [string, string])[], value: string) => {
      const node = element('select'); node.setAttribute('aria-label', title); choices.forEach(([key, text]) => { const o = element('option', text); o.value = key; node.append(o); }); node.value = value; label(host, title, node); return node;
    };
    const read = (input: HTMLInputElement) => readNumericInput(input, input.getAttribute('aria-label') || 'numeric input');
    const equation = (host: HTMLElement, value: string, title: string) => host.append(createEquationDisplay(value, title));
    const depth = (title: string) => { const node = element('details', '', 'zoh-depth'); node.append(element('summary', title)); root.append(node); return node; };
    const workbench = element('div', '', 'zoh-workbench'), visual = element('section', '', 'zoh-visual'), controlsPanel = element('section', '', 'zoh-controls-panel'); root.append(workbench); workbench.append(visual, controlsPanel);
    const notice = element('p', 'Computing the baseline…', 'zoh-notice'); notice.setAttribute('role', 'status');
    const resultHost = element('div'); resultHost.setAttribute('aria-label', 'Sampling workspace');
    const metadata = element('p', '', 'zoh-clock-summary'), modelDisplay = element('div', '', 'zoh-current-model'), feedback = element('p', '', 'zoh-warning');
    feedback.setAttribute('role', 'status');
    const outputPlot = element('div', '', 'zoh-plot'), inputPlot = element('div', '', 'zoh-plot');
    const cursorControls = element('div', '', 'zoh-controls zoh-cursor-controls'), inspect = number(cursorControls, 'Inspect sample k', '1', 0, 30, '1'), cursor = element('input');
    cursor.type = 'range'; cursor.min = '0'; cursor.max = '30'; cursor.step = '1'; cursor.value = '1'; cursor.setAttribute('aria-label', 'Sampling clock cursor'); label(cursorControls, 'Move the sample cursor (arrow keys)', cursor);
    const arithmetic = element('div', '', 'zoh-arithmetic'), inspectionError = element('p', '', 'zoh-warning'); inspectionError.setAttribute('role', 'status');
    visual.append(resultHost); resultHost.append(feedback, outputPlot, inputPlot, cursorControls, metadata, inspectionError, arithmetic, notice);
    resultHost.append(element('p', 'Solid paths join numerical drawing points of the held-input source. A clipped window edge uses linear drawing interpolation, not an exact sample. Filled circles: exact ZOH samples. Hollow squares: interval approximation. Shading marks the selected held interval; cursor movement does not change the model.', 'zoh-small'), modelDisplay);
    const mode = select(controlsPanel, 'Learning mode', [['explore', 'Explore — live clock and response'], ['practice', 'Practice — predict before revealing']], 'explore');
    const primary = element('div', '', 'zoh-controls'); controlsPanel.append(primary);
    const T = number(primary, 'Sample period T (s)', '.1', .0001, 10), periodRange = element('input');
    periodRange.type = 'range'; periodRange.min = '-4'; periodRange.max = '1'; periodRange.step = '.01'; periodRange.value = '-1'; periodRange.setAttribute('aria-label', 'Slide sample period T (log scale)');
    label(primary, 'Slide T in seconds (logarithmic scale)', periodRange);
    const clockBar = element('div', '', 'zoh-controls zoh-clock-bar');
    clockBar.setAttribute('aria-label', 'Live sample period controls'); clockBar.append(T.parentElement!, periodRange.parentElement!);
    resultHost.insertBefore(clockBar, outputPlot);
    const policy = select(primary, 'Time window policy', [['window', 'Fixed physical time window'], ['count', 'Fixed sample count']], 'window');
    const horizon = number(primary, 'Physical time window (s)', '3', .0001, 1190), count = number(primary, 'Number of sample instants', '31', 4, 120, '1');
    const delay = number(primary, 'Input delay m (whole samples)', '0', 0, 12, '1');
    const delayNote = element('p', '', 'zoh-small'); controlsPanel.append(delayNote);
    const input = select(primary, 'Held input sequence', [['step', 'Step: u[k] = A'], ['pulse', 'One-period pulse: u[0] = A'], ['ramp', 'Sampled physical ramp: u[k] = A kT']], 'step');
    const amplitude = number(primary, 'Amplitude A (ramp: units/s)', '1', -10000, 10000);
    const method = select(primary, 'Compare interval approximation', [['forward', 'Forward Euler'], ['backward', 'Backward Euler'], ['trapezoid', 'Trapezoidal integration']], 'forward');
    const inputNote = element('p', '', 'zoh-small'), quick = element('div', '', 'zoh-actions'); controlsPanel.append(inputNote, quick);
    for (const value of [.05, .1, .2]) button(quick, 'T = ' + value + ' s', () => { T.value = String(value); changed(); });
    button(quick, 'Halve T, preserve physical delay', () => {
      try {
        const oldT = read(T), m = read(delay), nextT = oldT / 2, n = policy.value === 'count' ? 2 * (read(count) - 1) + 1 : 4;
        if (!Number.isInteger(m) || m < 0 || m * 2 > 12) throw new Error('Preserving physical delay while halving T needs an integer 2m from 0 to 12. No fractional delay is rounded.');
        samplingWindow(nextT, policy.value as WindowPolicy, n, policy.value === 'window' ? read(horizon) : NaN);
        T.value = String(nextT); delay.value = String(2 * m); if (policy.value === 'count') count.value = String(n); changed();
      } catch (error) { notice.textContent = error instanceof Error ? error.message : 'Unable to preserve the declared physical delay.'; }
    });
    const attempt = element('div', '', 'zoh-attempt'), prediction = number(attempt, 'Your prediction for y[1] (optional)', '', -1e10, 1e10); controlsPanel.append(attempt);
    attempt.append(element('p', 'Right-hand y[1]; tolerance 10⁻⁵ × max(1, |y[1]|). Prediction is optional.', 'zoh-small'));
    const actions = element('div', '', 'zoh-actions'); controlsPanel.append(actions);
    const reveal = button(actions, 'Check sampled model', () => compute(true));
    const setup = depth('Edit the continuous plant, initial state and drawing detail');
    setup.append(element('p', 'Real proper plant order 1–2. Enter the rational plant alone; transport delay belongs in the integer m control. Use decimal coefficients, fractions, visible parentheses and powers 0–2. The phase state is the retained canonical plant state, not automatically its output.', 'zoh-small'));
    plant = createEquationInput({ label: 'Continuous rational plant', value: 'G(s)=\\frac1{s+1}', signal, tools: ['fraction', 'power', 'parentheses'], description: 'Enter a proper real rational plant in s, order one or two.', onChange: () => changed() }); setup.append(plant.element);
    const advanced = element('div', '', 'zoh-controls'); setup.append(advanced);
    const x1 = number(advanced, 'Initial state x₁(0)', '0', -10000, 10000), x2 = number(advanced, 'Initial state x₂(0), order 2 only', '0', -10000, 10000), density = number(advanced, 'Drawing subdivisions per interval', '8', 2, 16, '1');
    const presets = element('div', '', 'zoh-actions'); setup.append(presets);
    function usePreset(latex: string, period: number, m = 0) {
      plant!.setValue(latex); T.value = String(period); delay.value = String(m); input.value = 'step'; amplitude.value = '1'; x1.value = x2.value = '0'; count.value = '31'; horizon.value = String(30 * period); density.value = '8'; method.value = 'forward'; prediction.value = ''; selected = 1; inspect.value = '1'; inspectionValid = true; changed();
    }
    button(presets, 'Baseline T = 0.1 s', () => usePreset('G(s)=\\frac1{s+1}', .1));
    button(presets, 'Worksheet T = 0.2 s', () => usePreset('G(s)=\\frac1{s+1}', .2));
    button(presets, 'Integrator', () => usePreset('G(s)=\\frac1s', .1));
    button(presets, 'Double integrator', () => usePreset('G(s)=\\frac1{s^2}', .1));
    button(presets, 'Delayed 5/s²', () => usePreset('G(s)=\\frac5{s^2}', .2, 1));
    button(presets, 'Oscillator', () => usePreset('G(s)=\\frac1{s^2+1}', .1));
    setup.append(element('p', 'The delayed preset is a separately declared ZOH plant path, not the full original feedback diagram. Integrator/oscillator examples are independent teaching fixtures.', 'zoh-small'));
    const details = depth('Checked matrices, exact ZOH identities and scalar recurrence'), equations = element('div'); details.append(equations);
    const data = depth('All computed sample values and states'), tableHost = element('div', '', 'zoh-table'); data.append(tableHost);
    const limits = depth('Supported domain, timing and calculation limits');
    limits.append(element('p', 'u[k−m] is constant on [kT,(k+1)T); past input is zero. y[k]=Cx[k]+Du[k−m] is the right-hand value at kT. Initial state is separate from the zero-state transfer. Exact ZOH identities use numerical matrices; both endpoint derivatives of an approximation use the same constant held value.', 'zoh-small'),
      element('p', 'Original limits remain: plant order 1–2; 4–120 samples; T=0.0001–10 s; integer delay 0–12; drawing subdivisions 2–16; amplitude/initial states ≤10⁴; output ≤10¹⁰ and state ≤10¹². Matrix exponential norm ≤64, at most 64 terms and 7 squarings. Scalar coefficients require cancellation amplification below10⁸ and determinant residual≤10⁻⁹. Parser:512 characters,20 groups,degree≤6,coefficient≤10⁶,leading denominator≥10⁻⁸. Values round to7 significant digits; curves can miss intersample extrema.', 'zoh-small'));
    function sourceControls() {
      horizon.parentElement!.hidden = policy.value !== 'window'; count.parentElement!.hidden = policy.value !== 'count';
      attempt.hidden = mode.value !== 'practice'; reveal.textContent = mode.value === 'practice' ? 'Reveal sampled model' : 'Check sampled model';
      let t = NaN, m = NaN;
      try { t = read(T); m = read(delay); } catch { /* Invalid drafts have no physical-delay readout. */ }
      if (Number.isFinite(t) && t >= .0001 && t <= 10) periodRange.value = String(Math.log10(t));
      delayNote.textContent = Number.isFinite(t) && t >= .0001 && t <= 10 && Number.isInteger(m) && m >= 0 && m <= 12 ? 'Integer m = ' + m + ' stays fixed during a T edit; physical delay τ=mT = ' + fmt(m * t) + ' s' + (m ? ' therefore changes.' : ' remains zero.') + ' The half-T action doubles m to preserve τ when supported.' : 'Complete T and integer m; fractional delays are never rounded.';
      inputNote.textContent = input.value === 'pulse' ? 'One-period pulse: width=T and signed area=A·T change when T changes. A is its amplitude, not its area.' : input.value === 'ramp' ? 'Physical ramp slope A is in input units/s. The applied signal is the held staircase A(k−m)T, so changing T changes that staircase.' : 'A delayed held step has constant amplitude. With m=0, changing T samples the same physical step-driven source.';
    }
    function clearRendered() {
      outputDrawing = inputDrawing = undefined; outputPlot.replaceChildren(); inputPlot.replaceChildren(); equations.replaceChildren(); tableHost.replaceChildren(); arithmetic.replaceChildren(); modelDisplay.replaceChildren(); feedback.textContent = ''; metadata.textContent = ''; inspectionError.textContent = ''; details.hidden = true; data.hidden = true;
    }
    function changed() {
      if (disposed || signal.aborted) return;
      sourceControls();
      const preservePreview = mode.value === 'explore' && (resultHost.dataset.state === 'preview' || resultHost.dataset.state === 'draft') && !!current;
      if (!preservePreview) { current = undefined; clearRendered(); }
      resultHost.dataset.state = 'draft'; notice.hidden = false; notice.textContent = preservePreview ? 'Draft changed — previous preview shown while the current inputs update.' : mode.value === 'practice' ? 'Draft changed. Output remains hidden until Reveal sampled model.' : 'Updating the current preview…';
      inspect.disabled = cursor.disabled = true;
      if (timer === undefined) timer = window.setTimeout(() => { timer = undefined; compute(false); }, 60);
    }
    function showSample() {
      if (disposed) return;
      let k: number;
      const last = current?.result.samples.length ? current.result.samples.length - 1 : Number(inspect.max);
      try { k = read(inspect); if (!Number.isInteger(k) || k < 0 || k > last) throw new Error('Choose k from 0 to ' + last + '.'); }
      catch (error) { inspectionValid = false; inspectionError.textContent = 'Inspection point: ' + (error instanceof Error ? error.message : 'Choose an integer sample.') + ' The last valid cursor remains selected.'; return; }
      inspectionValid = true; selected = k; cursor.value = String(k); inspectionError.textContent = ''; arithmetic.replaceChildren();
      if (!current || resultHost.dataset.state === 'draft') return;
      const row = current.result.samples[k], onScreen = inputDrawing?.select(k); outputDrawing?.select(k);
      arithmetic.append(element('h4', 'Sample k = ' + k + ', t = ' + fmt(row.t) + ' s'), element('p', 'Held input u[k−m] = ' + fmt(row.held) + (k < current.result.samples.length - 1 ? ' on [' + fmt(row.t) + ', ' + fmt(row.t + current.experiment.T) + ') s.' : '. This final sample has no following full held interval in the computed horizon.'), 'zoh-small'));
      if (!onScreen) arithmetic.append(element('p', 'Selected sample lies beyond the fixed display window. Its true time/value are retained; no marker is clamped to the plot edge.', 'zoh-warning'));
      if (mode.value === 'practice' && !current.checked) return;
      equation(arithmetic, 'x[' + k + ']=' + matrixTex(row.x.map(v => [v])) + ',\\quad u[' + k + '-' + current.experiment.delay + ']=' + tex(row.held), 'State and held delayed input');
      equation(arithmetic, 'y[' + k + ']=' + matrixTex([current.source.C]) + matrixTex(row.x.map(v => [v])) + '+(' + tex(current.source.D) + ')(' + tex(row.held) + ')=' + tex(row.y), 'Output arithmetic');
      if (current.result.comparison) arithmetic.append(element('p', 'Approximation y[' + k + '] = ' + fmt(current.result.comparison[k].y) + '; exact−approximate = ' + fmt(row.y - current.result.comparison[k].y) + '.', 'zoh-small'));
      if (k < current.result.samples.length - 1) equation(arithmetic, 'x[' + (k + 1) + ']=' + matrixTex(current.result.exact.A) + matrixTex(row.x.map(v => [v])) + '+' + matrixTex(current.result.exact.B.map(v => [v])) + '(' + tex(row.held) + ')=' + matrixTex(current.result.samples[k + 1].x.map(v => [v])), 'Simultaneous state update');
    }
    function renderDetails(s: Snapshot) {
      const d = s.result.exact, n = s.source.A.length, augmented = s.source.A.map((row, i) => [...row, s.source.B[i]]).concat([Array(n + 1).fill(0) as number[]]);
      equation(equations, '\\dot{x}=Ax+Bu_h,\\quad y=Cx+Du_h', 'Continuous source equations');
      equation(equations, 'A=' + matrixTex(s.source.A) + ',\\quad B=' + matrixTex(s.source.B.map(v => [v])) + ',\\quad C=' + matrixTex([s.source.C]) + ',\\quad D=' + tex(s.source.D), 'Continuous canonical matrices');
      equation(equations, '\\exp\\left(' + matrixTex(augmented) + 'T\\right)=\\begin{bmatrix}A_d&B_d\\\\0&1\\end{bmatrix}', 'Augmented exponential construction');
      equation(equations, 'A_d=e^{AT}=' + matrixTex(d.A) + ',\\quad B_d=\\int_0^T e^{A\\tau}B\\,d\\tau=' + matrixTex(d.B.map(v => [v])), 'Exact ZOH identity with numerical matrices');
      equations.append(element('p', 'Exact identities for the declared hold; displayed matrices are numerical. The augmented construction works when A is singular and does not divide by A.', 'zoh-small'));
      equation(equations, 'x[k+1]=A_dx[k]+B_du[k-' + s.experiment.delay + '],\\quad y[k]=Cx[k]+Du[k-' + s.experiment.delay + ']', 'Sampled state recurrence');
      if (s.scalar) {
        equation(equations, 'G_d(z)=z^{-' + s.experiment.delay + '}\\left(D+C(zI-A_d)^{-1}B_d\\right)=z^{-' + s.experiment.delay + '}\\frac{' + polyTex(s.scalar.b, 'z') + '}{' + polyTex(s.scalar.a, 'z') + '}', 'Zero-state pulse transfer function');
        equation(equations, recurrence(s.scalar, s.experiment.delay), 'Zero-state scalar recurrence');
      } else equations.append(element('p', s.scalarWarning, 'zoh-warning'));
      equations.append(element('p', 'Descending powers of z; scalar recurrence assumes zero state/history. The selected initial state is propagated separately in the state model.', 'zoh-small'));
      const formula = s.experiment.method === 'forward' ? 'A_a=I+TA,\\quad B_a=TB' : s.experiment.method === 'backward' ? 'A_a=(I-TA)^{-1},\\quad B_a=(I-TA)^{-1}TB' : 'A_a=(I-TA/2)^{-1}(I+TA/2),\\quad B_a=(I-TA/2)^{-1}TB';
      equation(equations, formula, 'Selected interval approximation');
      if (s.result.approx && s.result.comparison) equation(equations, 'A_a=' + matrixTex(s.result.approx.A) + ',\\quad B_a=' + matrixTex(s.result.approx.B.map(v => [v])), 'Approximate interval matrices');
      equations.append(element('p', 'Both endpoint derivatives use the same held value. These are plant-interval approximations, not controller-frequency substitutions. Reported errors cover computed sample instants, not a continuous worst-case bound.', 'zoh-small'));
    }
    function renderTable(s: Snapshot) {
      const table = element('table'), head = element('thead'), tr = element('tr'), body = element('tbody');
      for (const title of ['k', 't (s)', 'Held u[k−m]', 'Exact y[k]', 'Approx. y[k]', 'State x[k]']) { const th = element('th', title); th.scope = 'col'; tr.append(th); } head.append(tr);
      s.result.samples.forEach((row, k) => { const tr = element('tr'); [String(k), fmt(row.t), fmt(row.held), fmt(row.y), s.result.comparison ? fmt(s.result.comparison[k].y) : 'Unavailable', row.x.map(fmt).join(', ')].forEach(text => tr.append(element('td', text))); body.append(tr); });
      table.append(head, body); tableHost.append(table);
    }
    function compute(checked: boolean) {
      if (disposed || signal.aborted) return; cancel(); current = undefined; clearRendered(); notice.hidden = false;
      try {
        const draft = plant!.getValue(); if (draft.empty || draft.hasPlaceholders || draft.syntaxIssues.length) throw new Error('Complete the plant and check its equation notation.');
        const source = realize(parseModel(draft.latex)), w = samplingWindow(read(T), policy.value as WindowPolicy, policy.value === 'count' ? read(count) : 4, policy.value === 'window' ? read(horizon) : NaN);
        const experiment: Experiment = { T: read(T), count: w.count, density: read(density), delay: read(delay), amplitude: read(amplitude), initial: source.A.length === 1 ? [read(x1)] : [read(x1), read(x2)], input: input.value as Experiment['input'], method: method.value as Method };
        const result = run(source, experiment); let scalar: ReturnType<typeof transfer> | undefined, scalarWarning = '';
        try { scalar = transfer(source, result.exact, experiment.T); } catch (error) { scalarWarning = error instanceof Error ? error.message : 'Scalar transfer and recurrence unavailable; the sampled state model remains available.'; }
        const guess = checked && mode.value === 'practice' && (prediction.value || prediction.validity.badInput) ? read(prediction) : NaN;
        if (Number.isFinite(guess) && Math.abs(guess) > 1e10) throw new Error('The prediction must have magnitude at most 10¹⁰.');
        current = { source, experiment, result, window: w, scalar, scalarWarning, latex: draft.latex, checked };
        x2.disabled = source.A.length === 1; resultHost.dataset.state = checked ? 'checked' : mode.value === 'practice' ? 'awaiting-prediction' : 'preview';
        metadata.textContent = w.count + ' sample instants · T=' + fmt(experiment.T) + ' s · visible 0–' + fmt(w.visibleEnd) + ' s · computed 0–' + fmt(w.retainedEnd) + ' s · m=' + experiment.delay + ', τ=' + fmt(experiment.delay * experiment.T) + ' s.';
        inputDrawing = trajectoryPlot(result, 'input', Math.min(selected, result.samples.length - 1), w.visibleEnd); inputPlot.append(inputDrawing.element);
        feedback.textContent = [result.warning, scalarWarning].filter(Boolean).join(' ');
        const outputs = mode.value === 'explore' || checked;
        if (outputs) {
          outputDrawing = trajectoryPlot(result, 'output', Math.min(selected, result.samples.length - 1), w.visibleEnd); outputPlot.append(outputDrawing.element);
          equation(modelDisplay, draft.latex, 'Current continuous plant'); renderTable(current); data.hidden = false;
          if (result.maxError !== undefined) feedback.append(document.createTextNode(' Maximum sampled output difference over computed 0–' + fmt(w.retainedEnd) + ' s: ' + fmt(result.maxError) + '.'));
          if (checked) { renderDetails(current); details.hidden = false; }
        }
        inspect.max = cursor.max = String(result.samples.length - 1); inspect.disabled = cursor.disabled = false;
        selected = Math.min(selected, result.samples.length - 1);
        if (inspectionValid) inspect.value = String(selected); cursor.value = String(selected); showSample();
        notice.textContent = !outputs ? 'Practice: input and clock are visible; output values and checked matrices stay hidden until Reveal.' : checked ? 'Exact ZOH state model computed. ' + (result.comparison ? 'Selected approximation computed. ' : 'Selected approximation unavailable; see feedback. ') + (scalar ? 'Change the clock or input to explore again.' : 'Scalar transfer and recurrence are unavailable for this conditioning; use the state model.') : 'Live preview of the current clock and held-input model. Check sampled model for the derivation.';
        if (checked && mode.value === 'practice') {
          const actual = result.samples[1].y;
          notice.textContent = (Number.isFinite(guess) ? Math.abs(guess - actual) <= 1e-5 * Math.max(1, Math.abs(actual)) ? 'Prediction matched within tolerance. ' : 'Compare your prediction with the state update. ' : '') + 'First sample y[1] = ' + fmt(actual) + '. ' + notice.textContent;
        }
      } catch (error) {
        current = undefined; clearRendered(); resultHost.dataset.state = 'invalid'; inspect.disabled = cursor.disabled = true;
        feedback.textContent = error instanceof Error ? error.message : 'Check the plant and experiment values.'; notice.hidden = true; notice.textContent = '';
      }
    }
    for (const control of [T, policy, horizon, count, delay, input, amplitude, method, x1, x2, density, mode]) { on(control, 'input', changed); on(control, 'change', changed); }
    on(periodRange, 'input', () => { T.value = Number((10 ** readNumericInput(periodRange, 'Sample-period slider exponent')).toPrecision(10)).toString(); changed(); });
    on(inspect, 'input', showSample); on(cursor, 'input', () => { inspect.value = cursor.value; showSample(); });
    on(prediction, 'input', () => { if (mode.value === 'practice') notice.textContent = current?.checked ? 'Prediction edited. Reveal again to check it; the displayed model remains valid.' : 'Prediction edited. The output remains hidden until Reveal.'; });
    for (const [host, drawing] of [[inputPlot, () => inputDrawing], [outputPlot, () => outputDrawing]] as const) host.addEventListener('click', event => {
      if (!current || resultHost.dataset.state === 'draft' || !(event.target instanceof Element) || !event.target.closest('svg')) return;
      const k = drawing()?.nearest(event.clientX); if (k !== undefined) { inspect.value = String(k); showSample(); }
    }, { signal });
    sourceControls(); compute(false); return cleanup;
  } catch (error) { cleanup(); throw error; }
};
