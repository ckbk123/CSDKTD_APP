import type { ModuleMount } from '../../core/module';
import { createEquationDisplay, createEquationInput, type EquationInput } from '../../shared/equations/input';
import { readNumericInput } from '../../shared/numeric-input';
import { forcedTerms, fraction, freeTerms, inputTransform, polynomial, termsLatex } from './analytic';
import { centeredInitial, excitation, initialState, initialTransformNumerator, makeModel, outputCoefficients, type InputKind, type Model } from './model';
import { parsePolynomial } from './parser';
import { numeric, responsePlot } from './plot';
import { decimal, div, exactText, neg, toNumber, ZERO, type Rational } from './rational';
import { impulseAreas, sample, trace, type Point, type Side } from './response';
import './style.css';

const presets = [
  { label: 'Baseline — unit step', n: '1', d: '(s+1)(s+2)', direct: '0', kind: 'step', x1: '0', x2: '0', h: '10' },
  { label: 'Changed poles and gain', n: '2', d: '(s+1)(s+3)', direct: '0', kind: 'step', x1: '0', x2: '0', h: '10' },
  { label: 'Nonzero initial state — free response', n: '1', d: '(s+1)(s+2)', direct: '0', kind: 'free', x1: '1', x2: '0', h: '10' },
  { label: 'Repeated pole', n: '1', d: '(s+1)^2', direct: '0', kind: 'step', x1: '0', x2: '0', h: '10' },
  { label: 'Damped oscillation', n: '1', d: 's^2+2s+5', direct: '0', kind: 'step', x1: '0', x2: '0', h: '10' },
  { label: 'Undamped oscillation', n: '4', d: 's^2+4', direct: '0', kind: 'step', x1: '0', x2: '0', h: '10' },
  { label: 'Integrator — no step settlement', n: '1', d: 's', direct: '0', kind: 'step', x1: '0', x2: '0', h: '10' },
  { label: 'Double integrator', n: '1', d: 's^2', direct: '0', kind: 'ramp', x1: '0', x2: '0', h: '5' },
  { label: 'Direct path — impulse interpretation', n: '1', d: 's+1', direct: '2', kind: 'impulse', x1: '0', x2: '0', h: '5' },
  { label: 'Direct path — finite pulse', n: '1', d: 's+1', direct: '2', kind: 'pulse', x1: '0', x2: '0', h: '5' },
  { label: 'Unstable mode', n: '1', d: 's-1', direct: '0', kind: 'step', x1: '0', x2: '0', h: '5' },
] as const;
const element = <K extends keyof HTMLElementTagNameMap>(tag: K, text?: string, className?: string): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag); if (text !== undefined) node.textContent = text; if (className) node.className = className; return node;
};
const paragraph = (parent: HTMLElement, text: string, note = false): void => { parent.append(element('p', text, note ? 'cp-note' : undefined)); };
const card = (parent: HTMLElement, title: string): HTMLElement => {
  const node = element('section', undefined, 'cp-card'); node.append(element('h3', title)); parent.append(node); return node;
};
const label = (parent: HTMLElement, title: string, control: HTMLElement): void => { const node = element('label', title); node.append(control); parent.append(node); };
const select = (parent: HTMLElement, title: string, entries: readonly (readonly [string, string])[], value: string): HTMLSelectElement => {
  const node = element('select'); for (const [key, text] of entries) { const option = element('option', text); option.value = key; node.append(option); }
  node.value = value; label(parent, title, node); return node;
};
const number = (parent: HTMLElement, title: string, value: string, min: string, max: string): HTMLInputElement => {
  const node = element('input'); node.type = 'number'; node.step = 'any'; node.value = value; node.min = min; node.max = max; label(parent, title, node); return node;
};
function exactNumber(input: HTMLInputElement, title: string): Rational { readNumericInput(input, title); return decimal(input.value, true); }
function parsed(input: EquationInput, title: string) {
  const draft = input.getValue();
  if (draft.empty || draft.hasPlaceholders || draft.syntaxIssues.length) throw new Error(`Complete ${title} using the visual equation controls.`);
  return parsePolynomial(draft.latex);
}
function display(parent: HTMLElement, latex: string, title: string): void { parent.append(createEquationDisplay(latex, title)); }
function table(parent: HTMLElement, caption: string, headings: string[], rows: string[][]): void {
  const scroll = element('div', undefined, 'cp-table-scroll'); scroll.tabIndex = 0; scroll.setAttribute('role', 'region'); scroll.setAttribute('aria-label', caption);
  const node = element('table'); node.append(element('caption', caption));
  const head = element('thead'), header = element('tr'); for (const title of headings) { const cell = element('th', title); cell.scope = 'col'; header.append(cell); } head.append(header); node.append(head);
  const body = element('tbody'); for (const row of rows) { const tr = element('tr'); row.forEach(text => tr.append(element('td', text))); body.append(tr); } node.append(body); scroll.append(node); parent.append(scroll);
}
const vector = (values: readonly Rational[]): string => `\\begin{bmatrix}${values.map(fraction).join('\\\\')}\\end{bmatrix}`;

export const mountView: ModuleMount = ({ container: root, signal }) => {
  const editors: EquationInput[] = []; let resultEvents: AbortController | undefined, disposed = false;
  const stopResult = (): void => { resultEvents?.abort(); resultEvents = undefined; };
  function dispose(): void { if (disposed) return; disposed = true; stopResult(); for (const editor of editors) editor.destroy(); }
  signal.addEventListener('abort', dispose, { once: true });
  if (signal.aborted) { dispose(); return dispose; }
  paragraph(root, 'Predict a response value, then separate the free and forced motion. Change the model, excitation or initial state and compare the new result.');
  const form = element('form'); form.noValidate = true; root.append(form);
  const setup = card(form, '1. Choose the model and excitation');
  const preset = select(setup, 'Experiment', [...presets.map((p, i) => [String(i), p.label] as const), ['custom', 'Custom inputs']], '0');
  paragraph(setup, 'G(s) = N(s)/D(s) + dₚ. Enter real polynomials in s, using visible parentheses, fractions and powers up to 2. The denominator has order 1 or 2; the numerator must be proper.', true);
  const equations = element('div', undefined, 'cp-equations'); setup.append(equations);
  const controls = element('div', undefined, 'cp-controls'); setup.append(controls);
  const parallel = number(controls, 'Parallel direct gain dₚ', '0', '-10', '10');
  const kind = select(controls, 'Input shape', [['step', 'Step — u = A'], ['ramp', 'Ramp — u = A t'], ['impulse', 'Ideal impulse — area A'], ['pulse', 'Rectangular pulse — area A'], ['free', 'Free response — u = 0']], 'step');
  const amplitude = number(controls, 'Amplitude / slope / area A', '1', '-10', '10');
  const width = number(controls, 'Pulse width W (s)', '.1', '.001', '10');
  const horizon = number(controls, 'Trace horizon (s)', '10', '.1', '60');
  const inputNote = element('p', undefined, 'cp-note'); setup.append(inputNote);
  const initial = card(form, '2. Set the initial state');
  paragraph(initial, 'Initial values are the phase states at 0−. They describe the dynamic realization, rather than automatically meaning y(0) and y′(0). An ideal impulse changes the forced state at 0; the free state still starts from these values.');
  const icControls = element('div', undefined, 'cp-controls'); initial.append(icControls);
  const x1 = number(icControls, 'Initial x₁ = w(0−)', '0', '-10', '10');
  const x2 = number(icControls, 'Initial x₂ = w′(0−), order 2 only', '0', '-10', '10');
  paragraph(initial, 'Realization: w′ + a₀w = u (order 1), or w″ + a₁w′ + a₀w = u (order 2). Output y = b₀w + b₁w′ + d u; order 1 omits b₁w′. Time is seconds. For denominator order m, w has input-units·sᵐ and w′ has input-units·sᵐ⁻¹; output units are normalized.', true);
  const attempt = card(form, '3. Predict, then reveal');
  const predictionControls = element('div', undefined, 'cp-controls'); attempt.append(predictionControls);
  const predictionTime = number(predictionControls, 'Prediction time (s), right-hand value', '1', '0', '60');
  const guess = number(predictionControls, 'Predicted total y (normalized units)', '.2', '-10000000000', '10000000000');
  const compare = element('input'); compare.type = 'checkbox'; label(attempt, 'Compare my numerical prediction (optional)', compare);
  paragraph(attempt, 'Before revealing, sketch the expected shape on paper: initial value or jump, growing or decaying modes, and a possible long-time value. The numerical prediction is checked at the chosen time, to 10⁻⁴ × max(1, |y|).', true);
  const actions = element('div', undefined, 'cp-actions'); attempt.append(actions);
  const reveal = element('button', 'Compute and reveal'); reveal.type = 'submit';
  const reset = element('button', 'Restore baseline'); reset.type = 'button'; actions.append(reveal, reset);
  const feedback = element('p', 'Make a prediction, then compute the response.', 'cp-feedback'); feedback.setAttribute('role', 'status'); root.append(feedback);
  const results = element('div'); results.setAttribute('aria-label', 'Checked response'); root.append(results);
  let represented: { m: Model; x: readonly Rational[]; target: HTMLElement } | undefined;
  const representation = select(initial, 'Coordinate view (preserves the initial state)', [['phase', 'Phase state x = [w, w′]'], ['centered', 'Centered state z = [w, w′ + αw]']], 'phase');
  function clearResults(): void { stopResult(); represented = undefined; results.replaceChildren(); }
  function changed(event?: Event): void {
    if (disposed || signal.aborted || event?.target === representation) return;
    clearResults(); feedback.textContent = 'Inputs changed. Predict and compute the new response.';
    if (event && event.target !== preset) preset.value = 'custom';
  }
  function sourceControls(): void {
    width.disabled = kind.value !== 'pulse'; amplitude.disabled = kind.value === 'free';
    inputNote.textContent = kind.value === 'step' ? 'A is input units. The input begins at t = 0; a direct term can make y jump.'
      : kind.value === 'ramp' ? 'A is input units/s. A ramp can produce polynomial output growth, even with stable dynamics.'
        : kind.value === 'impulse' ? 'A is signed area in input-units·s. A delta is a distribution: its area is reported separately from the ordinary curve. No finite peak height is assigned.'
          : kind.value === 'pulse' ? 'A is signed area in input-units·s. Height = A/W; the rectangular input acts on [0, W). Shrinking W at fixed area approximates an impulse away from the endpoints.'
            : 'Input is exactly zero. Only the initial state produces motion; amplitude and pulse width are inactive.';
  }
  let numerator: EquationInput, denominator: EquationInput;
  numerator = createEquationInput({ label: 'Numerator N(s)', value: '1', signal, onChange: () => changed() }); editors.push(numerator); equations.append(numerator.element);
  denominator = createEquationInput({ label: 'Denominator D(s)', value: '(s+1)(s+2)', signal, onChange: () => changed() }); editors.push(denominator); equations.append(denominator.element);
  function loadPreset(index: number): void {
    const p = presets[index]; if (!p) return;
    numerator.setValue(p.n); denominator.setValue(p.d); parallel.value = p.direct; kind.value = p.kind;
    x1.value = p.x1; x2.value = p.x2; amplitude.value = '1'; width.value = '.1'; horizon.value = p.h;
    predictionTime.value = '1'; guess.value = '.2'; compare.checked = false; representation.value = 'phase'; sourceControls(); changed();
  }
  preset.addEventListener('change', () => { if (preset.value !== 'custom') loadPreset(Number(preset.value)); }, { signal });
  reset.addEventListener('click', () => { preset.value = '0'; loadPreset(0); }, { signal });
  kind.addEventListener('change', sourceControls, { signal });
  form.addEventListener('input', changed, { signal }); form.addEventListener('change', changed, { signal });
  representation.addEventListener('change', () => { if (represented) renderRepresentation(represented.m, represented.x, represented.target); }, { signal });
  sourceControls();

  function renderRepresentation(m: Model, x: readonly Rational[], target: HTMLElement): void {
    target.replaceChildren();
    const centered = representation.value === 'centered', coords = centered ? centeredInitial(m, x) : x, c = outputCoefficients(m, centered);
    if (m.order === 1) {
      display(target, `\\dot w=${fraction(neg(m.a0))}w+u,\\quad y=${fraction(c[0])}w+${fraction(m.direct)}u`, 'First-order state realization');
      display(target, `w(0^-)=${fraction(x[0])}`, 'Preserved initial state');
      paragraph(target, 'There is one state; both coordinate views coincide. The order-2 initial field is inactive.');
    } else {
      const name = centered ? 'z' : 'x';
      const matrix = centered ? `${fraction(neg(m.alpha))}&1\\\\${fraction(m.delta)}&${fraction(neg(m.alpha))}` : `0&1\\\\${fraction(neg(m.a0))}&${fraction(neg(m.a1))}`;
      display(target, `\\dot{${name}}=\\begin{bmatrix}${matrix}\\end{bmatrix}${name}+\\begin{bmatrix}0\\\\1\\end{bmatrix}u,\\quad y=\\begin{bmatrix}${c.map(fraction).join('&')}\\end{bmatrix}${name}+${fraction(m.direct)}u`, 'State dynamics and output');
      display(target, `${name}(0^-)=${vector(coords)}`, 'Preserved initial state in chosen coordinates');
      if (centered) display(target, `\\alpha=${fraction(m.alpha)},\\quad z=\\begin{bmatrix}1&0\\\\${fraction(m.alpha)}&1\\end{bmatrix}x`, 'Coordinate transformation');
      paragraph(target, centered ? 'Only the coordinates change. The phase initial values, input and all response curves stay the same.' : 'x = [w, w′]ᵀ. Change to centered coordinates to see the same physical initial state in a different basis.', true);
    }
  }
  form.addEventListener('submit', event => {
    event.preventDefault(); if (disposed || signal.aborted) return;
    clearResults();
    try {
      const m = makeModel(parsed(numerator, 'the numerator'), parsed(denominator, 'the denominator'), exactNumber(parallel, 'Parallel direct gain'));
      const input = excitation(kind.value as InputKind, kind.value === 'free' ? ZERO : exactNumber(amplitude, 'Amplitude / slope / area'), kind.value === 'pulse' ? exactNumber(width, 'Pulse width') : decimal('.1'));
      const x = initialState(m, m.order === 1 ? [exactNumber(x1, 'Initial x₁')] : [exactNumber(x1, 'Initial x₁'), exactNumber(x2, 'Initial x₂')]);
      const h = readNumericInput(horizon, 'Trace horizon'), t = readNumericInput(predictionTime, 'Prediction time');
      if (t < 0 || t > h) throw new Error('Prediction time must be between zero and the requested horizon.');
      const predicted = compare.checked ? readNumericInput(guess, 'Predicted total y') : undefined;
      if (predicted !== undefined && Math.abs(predicted) > 1e10) throw new Error('The prediction must have magnitude at most 10¹⁰.');
      const run = trace(m, input, x, h), free = freeTerms(m, x), forced = forcedTerms(m, input), areas = impulseAreas(m, input);
      resultEvents = new AbortController(); const local = resultEvents.signal;
      const derivation = card(results, '4. Connect the model, initial state and transform');
      display(derivation, `G(s)=${fraction(m.parallel)}+\\frac{${polynomial(m.numerator)}}{${polynomial(m.denominator)}}=${fraction(m.direct)}+\\frac{${polynomial(m.b)}}{${polynomial(m.denominator)}}`, 'Normalized transfer and direct-path decomposition');
      paragraph(derivation, 'Coefficients are displayed in descending powers. The monic denominator and strict remainder define the retained phase realization, even when transfer poles cancel. Transfer functions describe zero initial state; free motion is added separately.');
      const repTarget = element('div'); derivation.append(repTarget); represented = { m, x, target: repTarget }; renderRepresentation(m, x, repTarget);
      display(derivation, `Y_{\\rm free}(s)=\\frac{${polynomial(initialTransformNumerator(m, x))}}{${polynomial(m.denominator)}},\\quad U(s)=${inputTransform(input)}`, 'Initial-condition and input transforms');
      display(derivation, 'Y(s)=Y_{\\rm free}(s)+G(s)U(s)', 'Superposition in the unilateral Laplace transform');
      const analytic = card(results, '5. Read the computed response terms');
      display(analytic, `y_{\\rm free}(t)=${termsLatex(free)}`, 'Exact free response terms');
      if (input.kind === 'pulse') {
        display(analytic, `W=${fraction(input.width)},\\quad A=${fraction(input.amplitude)},\\quad A/W=${fraction(div(input.amplitude, input.width))}`, 'Pulse width, signed area and height');
        display(analytic, `\\phi(t)=${termsLatex(forced)}`, 'Height-scaled full step response');
        display(analytic, `y_{\\rm forced}(t)=\\phi(t)-H(t-${fraction(input.width)})\\phi(t-${fraction(input.width)})`, 'Delayed-step pulse response');
        paragraph(analytic, 'H is the unit step. At W use the left side before subtracting the delayed value at zero, and the right side after subtracting it. This includes the ordinary direct-path jump.');
      } else display(analytic, `y_{\\rm forced,reg}(t)=${termsLatex(forced)}`, 'Exact regular forced response terms');
      display(analytic, 'y_{\\rm total,reg}(t)=y_{\\rm free}(t)+y_{\\rm forced,reg}(t)', 'Superposition of ordinary response components');
      if (input.kind === 'impulse') {
        display(analytic, `u(t)=${fraction(areas.input)}\\delta(t),\\quad y_{\\rm singular}(t)=${fraction(areas.output)}\\delta(t)`, 'Ideal input and direct output impulse areas');
        paragraph(analytic, `Signed impulse areas: input ${exactText(areas.input)} input-units·s; output ${exactText(areas.output)} output-units·s. The curve contains only the regular response. The arrow is an area symbol, not a finite peak. At 0− the forced state is zero; at 0+ its last phase state has jumped by A.`);
      }
      paragraph(analytic, 'These are exact identities for the entered rational coefficients. Exponential and trigonometric values and the curves are numerical approximations. Radical frequencies remain exact; repeated roots use their polynomial-times-exponential limit. The formulas apply for t ≥ 0, with one-sided values at input jumps.', true);
      const plots = card(results, '6. Compare free, forced and total motion');
      const legend = element('div', undefined, 'cp-legend'); legend.append(element('span', 'Free — dashed'), element('span', 'Forced — dotted'), element('span', 'Total — solid')); plots.append(legend);
      const outputPlot = responsePlot(run.points, false, 'Free, forced and total ordinary output', input.kind === 'impulse' && areas.output.n ? exactText(areas.output) : undefined);
      const inputPlot = responsePlot(run.points, true, 'Active input on its own scale', input.kind === 'impulse' && areas.input.n ? exactText(areas.input) : undefined);
      plots.append(outputPlot.element, inputPlot.element);
      paragraph(plots, 'Separate input and output scales keep a narrow pulse readable. Scroll a plot horizontally on a small screen. The cursor values below are computed directly at the requested time and side, without interpolating across jumps.', true);
      if (run.truncated) paragraph(plots, `Trace stopped early: ${run.reason}`);
      if (run.resolutionLimited) paragraph(plots, 'The 20,000 base-interval budget was reached. Fast modes may be under-resolved; shorten the horizon. The analytic terms remain separate from the sampled curve.');
      if (run.pulseEndsAfterHorizon) paragraph(plots, 'The pulse ends after this horizon. Increase the horizon to inspect its turn-off and the subsequent response.');
      const end = run.points.at(-1)!;
      const cursorSection = card(results, '7. Inspect a time and a side');
      const cursorControls = element('div', undefined, 'cp-controls'); cursorSection.append(cursorControls);
      const cursor = number(cursorControls, 'Cursor time (s)', String(Math.min(t, end.t)), '0', String(end.t));
      const side = select(cursorControls, 'One-sided value', [['right', 'Right — at / just after the time'], ['left', 'Left — just before the time']], 'right');
      const slider = element('input'); slider.type = 'range'; slider.min = '0'; slider.max = String(end.t); slider.step = 'any'; slider.value = cursor.value;
      label(cursorSection, 'Move time cursor (arrow keys supported)', slider);
      const cursorFeedback = element('p'); cursorFeedback.setAttribute('role', 'status'); cursorSection.append(cursorFeedback);
      const cursorValues = element('div'); cursorSection.append(cursorValues);
      function drawCursor(): void {
        try {
          const time = readNumericInput(cursor, 'Cursor time'); if (time < 0 || time > end.t) throw new Error(`Cursor time must be between 0 and ${numeric(end.t)} seconds in the retained trace.`);
          const p = sample(m, input, x, time, side.value as Side); slider.value = String(time); outputPlot.cursor(time); inputPlot.cursor(time); cursorValues.replaceChildren();
          const row = (p: Point): string[] => [numeric(p.t) + (p.side === 'left' ? '−' : '+'), numeric(p.input), numeric(p.free), numeric(p.forced), numeric(p.total)];
          table(cursorValues, 'Computed cursor values; ordinary parts only', ['t (s)', 'u', 'y free', 'y forced', 'y total'], [row(p)]);
          table(cursorValues, 'Phase-state components at the cursor', ['State', 'Free', 'Forced', 'Total'], p.freeState.map((v, i) => [`x${i + 1}`, numeric(v), numeric(p.forcedState[i]), numeric(v + p.forcedState[i])]));
          cursorFeedback.textContent = `Superposition residual y total − y free − y forced ≈ ${numeric(p.total - p.free - p.forced)}. Left and right differ only at 0 and the pulse end W; an ideal delta still has no pointwise finite value.`;
        } catch (error) { cursorValues.replaceChildren(); cursorFeedback.textContent = error instanceof Error ? error.message : 'Unable to inspect this time.'; }
      }
      cursor.addEventListener('input', drawCursor, { signal: local }); side.addEventListener('change', drawCursor, { signal: local });
      slider.addEventListener('input', () => { try { cursor.value = String(readNumericInput(slider, 'Time slider')); drawCursor(); } catch (error) { cursorValues.replaceChildren(); cursorFeedback.textContent = String(error); } }, { signal: local });
      drawCursor();
      const interpretation = card(results, '8. Check the long-time interpretation');
      paragraph(interpretation, `Retained denominator modes: ${m.behavior === 'stable' ? 'strictly stable' : m.behavior === 'integrator' ? 'one origin integrator' : m.behavior === 'double-integrator' ? 'double origin integrator' : m.behavior === 'oscillator' ? 'undamped oscillation' : 'unstable'}. A finite or flat portion of a trace is not a settling certificate.`);
      if (m.behavior === 'stable') {
        const asymptote = input.kind === 'step' || input.kind === 'ramp' ? forced.polynomial : [];
        display(interpretation, `y_{\\rm total}(t)-\\left(${polynomial(asymptote, 't')}\\right)\\longrightarrow0`, 'Exact asymptotic polynomial for stable retained dynamics');
        paragraph(interpretation, asymptote.slice(1).some(c => c.n) ? 'The nonzero polynomial slope means there is no finite final value. Stable modes alone do not make a ramp response settle.' : 'All retained transient modes decay. The remaining constant, or zero, is the final ordinary output value.');
        const expected = asymptote.reduceRight((sum, coefficient) => sum * end.t + toNumber(coefficient, true), 0);
        paragraph(interpretation, `At the retained endpoint ${numeric(end.t)} s: y ≈ ${numeric(end.total)}, asymptotic polynomial ≈ ${numeric(expected)}, difference ≈ ${numeric(end.total - expected)}.`, true);
        if (Math.abs(end.total - expected) > .01 * Math.max(1, Math.abs(expected))) paragraph(interpretation, 'The endpoint is still more than 1% of max(1, |asymptotic value|) away from that polynomial. Increase the horizon. This comparison is a horizon heuristic, not a settling-time calculation.');
      } else paragraph(interpretation, 'No general settling claim is made for this retained realization. Inspect the computed polynomial/exponential/oscillatory terms: particular inputs, initial states or output cancellations may remove a mode. Integrators can grow; oscillators can persist; unstable modes can exceed the plotting range.');
      if (t > end.t) feedback.textContent = 'The trace stopped before your prediction time. Inspect an earlier cursor time; no prediction comparison was made.';
      else if (predicted !== undefined) {
        const actual = sample(m, input, x, t).total, agrees = Math.abs(predicted - actual) <= 1e-4 * Math.max(1, Math.abs(actual));
        feedback.textContent = `${agrees ? 'Your prediction agrees' : 'Compare your prediction'}: at ${numeric(t)} s on the right, ordinary y ≈ ${numeric(actual)}; prediction ${numeric(predicted)}. Tolerance: 10⁻⁴ × max(1, |y|).`;
      } else feedback.textContent = 'Response revealed. Try a changed model, a different source or nonzero initial state and predict again.';
    } catch (error) { clearResults(); feedback.textContent = error instanceof Error ? error.message : 'Unable to compute this bounded exercise. Check the inputs.'; }
  }, { signal });

  const limits = element('details'); limits.append(element('summary', 'Supported domain, timing and calculation limits')); root.append(limits);
  paragraph(limits, 'Real continuous-time SISO LTI models only; no feedback loop is assumed here. Proper rational numerator/denominator of order at most 2, denominator order 1–2. Leading coefficient is normalized; a biproper numerator is divided to extract direct gain. Phase realization and its initial state are retained through cancellations. Ideal differentiation (improper transfer) is rejected because distributions cannot be represented by this ordinary state model.');
  paragraph(limits, 'Visual input accepts bounded decimals, visible parentheses, explicit/implicit products, numeric fractions, and integer powers 0–2. Mixed-number adjacency, hidden groups, unsupported symbols, e/E notation and ambiguous bare powers are rejected with guidance. Use fraction/power buttons; students need no programming syntax. Limits: 400 expression characters, 160 primaries, nesting 12, intermediate coefficient magnitude 10⁹, exact fractions at most 4096 bits.');
  paragraph(limits, 'After normalization: |a₀| ≤ 100, |a₁| ≤ 20, strict-remainder |bᵢ| ≤ 50, parallel and effective |d| ≤ 10. Normalized coefficient fraction denominators ≤ 10⁹. Initial phase states and amplitude/area: −10 to 10. Pulse width .001–10 s; horizon .1–60 s. Causal inputs begin at 0; pulse support [0,W); initial state is at 0−. Left/right cursor selects ordinary limits, never a finite ideal-delta value.');
  paragraph(limits, 'Analytic terms use exact rational arithmetic and exact radicals. Numerical state transitions use floating-point scaling and a bounded series (at most four augmented states, 24 scalings, 32 terms). Traces have 600–20,000 base intervals plus pulse/jump points (at most 20,024); transitions are cached locally with finite limits. Any state or signal component above 10¹⁰ stops the trace with feedback. Sampling can miss fast features at its cap; a finite horizon cannot prove settlement. No sample period is assumed for this continuous-time exercise.');
  return dispose;
};
