import type { ModuleMount } from '../../core/module';
import type { EquationInput, EquationDraft } from '../../shared/equations/input';
import { readNumericInput } from '../../shared/numeric-input';
import { analyseLimit, constants, errorNumerator, makeModel, trace, type Channel, type ErrorSignal, type Limit, type Model } from './math';
import { parseLinearExact } from './parser';
import { decimal, exactText, toNumber, type Rational } from './rational';
import { errorPlot, evaluate, fraction, numeric, polynomial } from './view';
import './style.css';

const presets = [
  { label: 'Baseline: type 1, unity sensor', numerator: '4', pole: 's+2', n: 1, h: '1', source: 'reference', q: 1 },
  { label: 'Changed gain: numerator 8', numerator: '8', pole: 's+2', n: 1, h: '1', source: 'reference', q: 1 },
  { label: 'Nonunity sensor: H = 2', numerator: '4', pole: 's+2', n: 1, h: '2', source: 'reference', q: 1 },
  { label: 'Type 0: step reference', numerator: '4', pole: 's+2', n: 0, h: '1', source: 'reference', q: 0 },
  { label: 'Stable type 2: parabolic reference', numerator: '4(s+1)', pole: 's+2', n: 2, h: '1', source: 'reference', q: 2 },
  { label: 'Unstable type 2: remove the zero', numerator: '4', pole: 's+2', n: 2, h: '1', source: 'reference', q: 2 },
  { label: 'Plant-input disturbance: step', numerator: '4', pole: 's+2', n: 1, h: '1', source: 'disturbance', q: 0 },
  { label: 'Sensor noise: step', numerator: '4', pole: 's+2', n: 1, h: '1', source: 'noise', q: 0 },
] as const;

export const mount: ModuleMount = ({ container, signal }) => {
  const root = document.createElement('div'); root.dataset.module = 'CF02'; container.append(root);
  let disposed = false, equations: typeof import('../../shared/equations/input') | undefined;
  let numerator: EquationInput | undefined, pole: EquationInput | undefined;
  const element = <K extends keyof HTMLElementTagNameMap>(tag: K, text?: string, className?: string): HTMLElementTagNameMap[K] => {
    const node = document.createElement(tag); if (text) node.textContent = text; if (className) node.className = className; return node;
  };
  const paragraph = (parent: HTMLElement, text: string, note = false): void => { parent.append(element('p', text, note ? 'cf-note' : undefined)); };
  const card = (parent: HTMLElement, title: string): HTMLElement => { const section = element('section', undefined, 'cf-card'); section.append(element('h3', title)); parent.append(section); return section; };
  const label = (parent: HTMLElement, title: string, control: HTMLElement): void => { const node = element('label', title); node.append(control); parent.append(node); };
  const select = (parent: HTMLElement, title: string, entries: readonly (readonly [string, string])[], value: string): HTMLSelectElement => {
    const node = element('select'); for (const [key, text] of entries) { const option = element('option', text); option.value = key; node.append(option); } node.value = value; label(parent, title, node); return node;
  };
  const number = (parent: HTMLElement, title: string, value: string, min: string, max: string): HTMLInputElement => {
    const node = element('input'); node.type = 'number'; node.step = 'any'; node.value = value; node.min = min; node.max = max; label(parent, title, node); return node;
  };
  const display = (parent: HTMLElement, latex: string, title: string): void => { if (equations) parent.append(equations.createEquationDisplay(latex, title)); };
  const table = (parent: HTMLElement, caption: string, headings: string[], rows: string[][]): void => {
    const scroll = element('div', undefined, 'cf-table-scroll'); scroll.tabIndex = 0; scroll.setAttribute('role', 'region'); scroll.setAttribute('aria-label', caption);
    const node = element('table'); node.append(element('caption', caption));
    const head = element('thead'), header = element('tr'); for (const title of headings) { const cell = element('th', title); cell.scope = 'col'; header.append(cell); } head.append(header); node.append(head);
    const body = element('tbody'); for (const row of rows) { const tr = element('tr'); row.forEach(text => tr.append(element('td', text))); body.append(tr); } node.append(body); scroll.append(node); parent.append(scroll);
  };

  paragraph(root, 'Predict an error, derive its transfer function, then compare the checked limit with a time trace. One scalar source acts at a time.');
  const form = element('form'); form.noValidate = true; root.append(form);
  const setup = card(form, '1. Set the loop and excitation');
  const preset = select(setup, 'Experiment', presets.map((p, i) => [String(i), p.label]), '0');
  paragraph(setup, 'Forward path P(s) = N(s) / [sⁿ F(s)]. Enter N and the finite pole factor F as linear polynomials; choose the origin integrators separately.', true);
  const equationGrid = element('div', undefined, 'cf-grid'); setup.append(equationGrid);
  const loading = element('p', 'Loading equation controls…'); equationGrid.append(loading);
  const controls = element('div', undefined, 'cf-controls'); setup.append(controls);
  const integrators = select(controls, 'Origin integrators n', [['0', '0 — type 0'], ['1', '1 — type 1'], ['2', '2 — type 2']], '1');
  const sensor = number(controls, 'Sensor gain H (dimensionless)', '1', '.1', '10');
  const source = select(controls, 'Active source', [['reference', 'Reference r'], ['disturbance', 'Plant-input disturbance d'], ['noise', 'Sensor noise ν after H']], 'reference');
  const order = select(controls, 'Input shape', [['0', 'Step: A'], ['1', 'Ramp: A t'], ['2', 'Parabolic: A t² / 2']], '1');
  const amplitude = number(controls, 'Amplitude A (normalized units)', '1', '-10', '10');
  const horizon = number(controls, 'Trace horizon (s)', '10', '.1', '120');
  const chosen = select(controls, 'Error to predict', [['comparator', 'Comparator e_c = r − H y − ν'], ['physical', 'Physical tracking e_t = r − y']], 'comparator');
  paragraph(setup, 'Negative feedback; y = P(e_c + d), e_c = r − H y − ν. Inactive sources and all initial states are zero. Time is in seconds; signals use normalized units. For a ramp A is units/s, and for a parabola units/s².', true);

  const attempt = card(form, '2. Make a prediction');
  const attempts = element('div', undefined, 'cf-controls'); attempt.append(attempts);
  const prediction = select(attempts, 'Predicted behavior', [['none', 'Choose a prediction (optional)'], ['zero', 'Tends to zero'], ['finite', 'Tends to a nonzero finite value'], ['growth', 'Polynomial error growth'], ['uncertified', 'No certified limit: loop not strictly stable']], 'none');
  const predictedValue = number(attempts, 'Predicted finite error (if chosen)', '.5', '-1000000000000', '1000000000000');
  const actions = element('div', undefined, 'cf-actions'); attempt.append(actions);
  const reveal = element('button', 'Derive and reveal'); reveal.type = 'submit'; reveal.disabled = true;
  const reset = element('button', 'Restore baseline'); reset.type = 'button'; actions.append(reveal, reset);
  const feedback = element('p', 'Equation controls are loading.', 'cf-feedback'); feedback.setAttribute('role', 'status'); root.append(feedback);
  const results = element('div'); root.append(results);
  const nativeControls = Array.from(form.querySelectorAll('input,select,button')) as (HTMLInputElement | HTMLSelectElement | HTMLButtonElement)[];
  nativeControls.forEach(control => { control.disabled = true; });

  function changed(): void {
    if (disposed || signal.aborted) return;
    results.replaceChildren(); feedback.textContent = 'Inputs changed. Make a prediction and derive the new result.';
  }
  function loadPreset(index: number): void {
    const p = presets[index]; numerator?.setValue(p.numerator); pole?.setValue(p.pole); integrators.value = String(p.n);
    sensor.value = p.h; source.value = p.source; order.value = String(p.q); amplitude.value = '1'; horizon.value = '10';
    chosen.value = 'comparator'; prediction.value = 'none'; predictedValue.value = '.5'; changed();
  }
  preset.addEventListener('change', () => loadPreset(Number(preset.value)), { signal });
  reset.addEventListener('click', () => { preset.value = '0'; loadPreset(0); }, { signal });
  form.addEventListener('input', changed, { signal }); form.addEventListener('change', changed, { signal });
  function parsed(input: EquationInput, name: string) {
    const draft: EquationDraft = input.getValue();
    if (draft.empty || draft.hasPlaceholders || draft.syntaxIssues.length) throw new Error(`Complete ${name} using the visual equation controls.`);
    return parseLinearExact(draft.latex);
  }
  function numericExact(input: HTMLInputElement, title: string): Rational { readNumericInput(input, title); return decimal(input.value, true); }
  function resultDescription(value: Limit): string {
    return value.kind === 'finite' ? `Finite limit: ${exactText(value.value)}${value.value.d !== 1n ? ` (≈ ${numeric(toNumber(value.value, true))})` : ''}`
      : value.kind === 'growth' ? `Polynomial growth of degree ${value.degree}; no finite steady-state error.` : 'No certified steady-state limit.';
  }
  function predictionFeedback(value: Limit): string {
    if (prediction.value === 'none') return 'Result revealed. Try a changed-data experiment and predict again.';
    const actual = value.kind === 'finite' ? value.value.n ? 'finite' : 'zero' : value.kind;
    if (prediction.value !== actual) return `Revisit your prediction. ${resultDescription(value)}`;
    if (prediction.value === 'finite' && value.kind === 'finite') {
      const guessed = readNumericInput(predictedValue, 'the predicted finite error'), expected = toNumber(value.value, true);
      return Math.abs(guessed - expected) <= 1e-6 * Math.max(1, Math.abs(expected)) ? 'Your finite-limit prediction agrees within 10⁻⁶ relative/absolute tolerance.' : `The behavior agrees; compare your number with the checked value ${exactText(value.value)}.`;
    }
    return 'Your predicted behavior agrees with the checked result.';
  }
  function derivation(m: Model, channel: Channel, error: ErrorSignal, q: number, amp: Rational, value: Limit): void {
    const section = card(results, '3. Derive the signal before using a type table');
    paragraph(section, 'Write P = N/D with D = sⁿF after normalizing the finite pole factor.');
    display(section, `P(s)=\\frac{${polynomial(m.numerator)}}{${polynomial(m.denominator)}}\\,,\\quad H=${fraction(m.h)}`, 'Normalized forward path and sensor');
    section.append(element('p', `Type ${m.integrators}: ${m.integrators} uncancelled origin integrator${m.integrators === 1 ? '' : 's'} in H P.`, 'cf-type'));
    const variable = channel === 'reference' ? 'R' : channel === 'disturbance' ? 'D_d' : 'V';
    const errorName = error === 'comparator' ? 'E_c' : 'E_t';
    paragraph(section, `Selected source: ${channel === 'noise' ? 'sensor noise after H' : channel === 'disturbance' ? 'disturbance added at plant input' : 'reference'}. Selected error: ${error === 'comparator' ? 'comparator' : 'physical tracking'}.`);
    display(section, 'Q(s)=D(s)+H N(s)', 'Closed-loop characteristic denominator');
    display(section, `${errorName}(s)/${variable}(s)=\\frac{${polynomial(errorNumerator(m, channel, error))}}{${polynomial(m.closed)}}=\\frac{B(s)}{Q(s)}`, 'Derived selected error transfer function');
    paragraph(section, channel === 'reference' ? error === 'comparator' ? 'The comparator channel is D/Q.' : 'The physical tracking channel is [D+(H−1)N]/Q.' : channel === 'disturbance' ? error === 'comparator' ? 'The disturbance comparator channel is −HN/Q.' : 'The disturbance physical error channel is −N/Q.' : error === 'comparator' ? 'The noise comparator channel is −D/Q.' : 'The noise physical error channel is N/Q.');
    display(section, `X(s)=\\frac{${fraction(amp)}}{s^{${q + 1}}}\\,,\\quad s${errorName}(s)=\\frac{${fraction(amp)}B(s)}{${q ? `s^{${q}}` : ''}Q(s)}`, 'Input transform and candidate final-value expression');
    if (value.kind !== 'uncertified') paragraph(section, value.zeroOrder === null ? 'The selected zero-input/channel identity gives zero with zero initial conditions.' : `B(s) has ${value.zeroOrder} factor${value.zeroOrder === 1 ? '' : 's'} of s at the origin. The input contributes ${q} remaining origin factor${q === 1 ? '' : 's'} in sE(s). Exact coefficients determine this cancellation.`, true);
    const certificate = card(results, '4. Check final-value conditions');
    display(certificate, `Q(s)=${polynomial(m.closed)}`, 'Full closed-loop polynomial');
    if (m.stability.degree === 3) {
      display(certificate, `a_2a_1-a_3a_0=${fraction(m.stability.determinant!)}`, 'Cubic Hurwitz determinant');
      paragraph(certificate, 'For this cubic, all coefficients must be positive and a₂a₁ > a₃a₀. Equality leaves an imaginary-axis pair.');
    } else paragraph(certificate, `This degree-${m.stability.degree} polynomial has strictly positive coefficients, which certify a Hurwitz polynomial at degree one or two.`);
    paragraph(certificate, m.stability.kind === 'stable' ? 'Closed loop: strictly Hurwitz. A finite final value also requires cancellation of all remaining origin poles in sE(s).' : m.stability.kind === 'boundary' ? 'Closed loop: stability boundary. The final-value theorem is not applied.' : 'Closed loop: unstable. The final-value theorem is not applied.');
    paragraph(certificate, 'The full characteristic polynomial is checked before transfer-function cancellations. A finite trace is not a stability proof.', true);
    const constantSection = card(results, '5. Interpret type and error constants');
    display(constantSection, 'K_p=\\lim_{s\\to0}HP\\,,\\quad K_v=\\lim_{s\\to0}sHP\\,,\\quad K_a=\\lim_{s\\to0}s^2HP', 'Definitions of static error constants');
    const ks = constants(m);
    table(constantSection, 'Constants for the sensor loop H P', ['Constant', 'Value'], ks.map((k, i) => [['Kp', 'Kv', 'Ka'][i], k.kind === 'infinite' ? '∞' : exactText(k.value!)]));
    table(constantSection, 'Reference comparator-error table (requires strict closed-loop stability)', ['Input', 'Unit-input e_c limit'], [['Step', '1 / (1 + Kp)'], ['Ramp', '1 / Kv'], ['Parabolic t²/2', '1 / Ka']]);
    paragraph(constantSection, 'Interpret 1/∞ as 0. For nonzero A, a zero denominator means unbounded polynomial error in this stable family. Multiply by A for a nonunit excitation.');
    paragraph(constantSection, 'These constants describe reference comparator error. Use the derived channel for disturbances, sensor noise and physical tracking with H ≠ 1. The table does not override an unstable-loop verdict.', true);
    const checked = card(results, '6. Checked error and trace');
    paragraph(checked, resultDescription(value));
    if (value.kind === 'uncertified') paragraph(checked, value.reason);
    else if (value.kind === 'finite') display(checked, `\\lim_{t\\to\\infty}${error === 'comparator' ? 'e_c' : 'e_t'}(t)=${fraction(value.value)}`, 'Checked exact steady-state error');
    else { display(checked, `${error === 'comparator' ? 'e_c' : 'e_t'}(t)\\sim ${polynomial(value.polynomial, 't')}`, 'Exact long-time polynomial part'); paragraph(checked, 'The displayed polynomial is the full nondecaying part; the strictly stable transient decays to zero. No finite final value exists.'); }
    const run = trace(m, channel, q, amp, readNumericInput(horizon, 'the trace horizon'));
    const legend = element('div', undefined, 'cf-legend'); legend.append(element('span', 'Comparator e_c — solid'), element('span', 'Physical e_t — dashed')); checked.append(legend, errorPlot(run.points));
    paragraph(checked, 'Numerical zero-state response. Both errors coincide for a reference with H = 1. Horizontal scrolling keeps plot labels readable on small screens.', true);
    if (run.truncated) paragraph(checked, 'Trace stopped before the requested horizon: a state or signal exceeded 10¹² in magnitude. No limit is inferred from the truncated curve.');
    if (run.resolutionLimited) paragraph(checked, 'The 40,000-interval sample budget was reached. Fast modes may be unresolved; reduce the horizon. The analytical certificate is separate.');
    if (run.points.length) {
      const end = run.points.at(-1)!;
      const rows = [...new Set([0, .25, .5, .75, 1].map(f => Math.round((run.points.length - 1) * f)))].map(i => { const p = run.points[i]; return [numeric(p.t), numeric(p.input), numeric(p.output), numeric(p.comparator), numeric(p.physical)]; });
      table(checked, 'Sampled values (normalized signal units)', ['t (s)', 'Active input', 'y', 'e_c', 'e_t'], rows);
      if (value.kind !== 'uncertified') {
        const expected = evaluate(value.polynomial, end.t), measured = end[error];
        paragraph(checked, `At t = ${numeric(end.t)} s: selected error ≈ ${numeric(measured)}; asymptotic ${value.kind === 'finite' ? 'value' : 'polynomial'} ≈ ${numeric(expected)}; difference ≈ ${numeric(measured - expected)}.`);
      }
    }
    paragraph(checked, 'A short horizon can leave a large transient. Increase it and compare the endpoint with the analytical result; endpoint agreement alone does not certify a limit.', true);
  }
  form.addEventListener('submit', event => {
    event.preventDefault(); if (disposed || signal.aborted || !numerator || !pole || !equations) return;
    results.replaceChildren();
    try {
      const m = makeModel(parsed(numerator, 'the numerator N(s)'), parsed(pole, 'the finite pole factor F(s)'), Number(integrators.value), numericExact(sensor, 'the sensor gain'));
      const amp = numericExact(amplitude, 'the amplitude'), q = Number(order.value), channel = source.value as Channel, error = chosen.value as ErrorSignal;
      const time = readNumericInput(horizon, 'the trace horizon'); if (time < .1 || time > 120) throw new Error('Plot horizon must be between 0.1 and 120 seconds.');
      const value = analyseLimit(m, channel, error, q, amp), message = predictionFeedback(value);
      derivation(m, channel, error, q, amp, value); feedback.textContent = message;
    } catch (error) { results.replaceChildren(); feedback.textContent = error instanceof Error ? error.message : 'Unable to compute this bounded exercise. Check the inputs.'; }
  }, { signal });

  const domain = element('details'); domain.append(element('summary', 'Supported models, assumptions and numerical limits')); root.append(domain);
  paragraph(domain, 'Real SISO LTI P(s) = (b₁s+b₀) / [sⁿ(s+a)], n = 0, 1 or 2. After normalizing the finite pole factor: 0.1 ≤ a ≤ 10 s⁻¹; b₀ > 0; b₁ ≥ 0. Gain is b₀ for a constant numerator and b₁ otherwise, bounded 0.05–50. A numerator zero, if present, is at −b₀/b₁ with rate 0.05–10 s⁻¹. H is a positive constant 0.1–10. No delays, higher powers, RHP zeros or arbitrary transfer functions.');
  paragraph(domain, 'Amplitudes: −10 to 10, horizon: 0.1–120 s. Editable polynomials support decimals, signed visible parentheses, sums/products and numeric fractions, at most degree one. Use an explicit + or × between numeric factors or before a constant-times-fraction-containing group; mixed-number adjacency and hidden arithmetic grouping are rejected. Numeric/single-symbol font styles are accepted; font wrappers cannot group arithmetic. Visual e/E is a symbol, so scientific shortcuts are rejected there; native number fields accept scientific notation. Coefficients are stored in ascending powers internally.');
  paragraph(domain, 'Exact bounded rational arithmetic decides coefficient zeros, type and Hurwitz conditions (4096 bits per numerator/denominator, 400 input characters, 160 operations, nesting 12, intermediate coefficient magnitude ≤ 10¹²). A separately labeled floating-point trace uses a real companion realization and polynomial-input states, at most six states, a bounded scaling/Taylor transition, 600–40,000 intervals and a 10¹² state/signal cap. Very slow transients, near-boundary models and unresolved fast modes require care; the trace is not a proof.');
  paragraph(domain, 'The teaching scope follows Ch5:8–13, S07 and S03:5,13 in the course audit. Presets and analytical regression fixtures are independently derived examples; the original decks have not been newly inspected.', true);

  void import('../../shared/equations/input').then(api => {
    if (disposed || signal.aborted) return; equations = api;
    numerator = api.createEquationInput({ label: 'Numerator N(s)', value: '4', signal, onChange: changed });
    pole = api.createEquationInput({ label: 'Finite pole factor F(s)', value: 's+2', signal, onChange: changed });
    equationGrid.replaceChildren(numerator.element, pole.element); nativeControls.forEach(control => { control.disabled = false; }); feedback.textContent = 'Baseline ready. Predict the unit-ramp comparator error, then reveal.';
  }).catch(() => {
    numerator?.destroy(); pole?.destroy();
    if (!disposed && !signal.aborted) { loading.textContent = 'Equation controls could not load. Reset or reopen this tool to retry.'; feedback.textContent = 'Equation controls unavailable; no result was computed.'; }
  });
  const cleanup = (): void => { if (disposed) return; disposed = true; signal.removeEventListener('abort', cleanup); numerator?.destroy(); pole?.destroy(); root.remove(); };
  signal.addEventListener('abort', cleanup, { once: true }); if (signal.aborted) cleanup();
  return cleanup;
};
