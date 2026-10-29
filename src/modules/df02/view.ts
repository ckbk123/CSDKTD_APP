import type { ModuleMount } from '../../core/module';
import { createEquationDisplay, createEquationInput, type EquationDraft } from '../../shared/equations/input';
import { readNumericInput } from '../../shared/numeric-input';
import { analyze, referenceFactors, type Analysis, type Basis, type Channel, type Limit, type Reference } from './math';
import { parseForward } from './parser';
import { label, stemPlot } from './plots';
import { decimal, div, equal, factorsAtOne, mul, number, plus, q, scale, times, type Poly, type Q } from './rational';
import './workspace.css';

function node<K extends keyof HTMLElementTagNameMap>(tag: K, text = '', className = ''): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag); element.textContent = text; element.className = className; return element;
}
function numeric(name: string, value: string, min?: number, max?: number, step = 'any') {
  const wrapper = node('label', '', 'df02-field'), input = node('input'); input.type = 'number'; input.value = value; input.step = step;
  if (min !== undefined) input.min = String(min); if (max !== undefined) input.max = String(max);
  wrapper.append(node('span', name), input); return { wrapper, input };
}
function choice(name: string, items: readonly (readonly [string, string])[], value: string) {
  const wrapper = node('label', '', 'df02-field'), input = node('select');
  items.forEach(([key, title]) => { const option = node('option', title); option.value = key; input.append(option); });
  input.value = value; wrapper.append(node('span', name), input); return { wrapper, input };
}
function read(input: HTMLInputElement, name: string, min = -Infinity, max = Infinity, integer = false): number {
  if (input.value.length > 80) throw new Error(`Keep ${name} within 80 characters.`);
  const value = readNumericInput(input, name);
  if (value < min || value > max || integer && !Number.isInteger(value)) throw new Error(`Enter ${name} ${integer ? 'as an integer ' : ''}between ${min} and ${max}.`);
  return value;
}
const tex = (value: Q): string => value.d === 1n ? String(value.n) : `${value.n < 0n ? '-' : ''}\\frac{${value.n < 0n ? -value.n : value.n}}{${value.d}}`;
function polynomial(p: Poly): string {
  return p.map((a, i) => {
    if (!a.n) return '';
    const magnitude = q(a.n < 0n ? -a.n : a.n, a.d);
    const coefficient = i && equal(magnitude, q(1)) ? '' : tex(magnitude);
    return `${a.n < 0n ? '-' : '+'}${coefficient}${i ? i === 1 ? 'z' : `z^{${i}}` : ''}`;
  }).reverse().join('').replace(/^\+/, '') || '0';
}
function equation(source: string, name: string): HTMLElement {
  const result = createEquationDisplay(source, name); result.tabIndex = 0; return result;
}
const limitTex = (a: Limit) => a.kind === 'finite' ? tex(a.value) : `${a.value.n < 0n ? '-' : ''}\\infty`;
const referenceName = (reference: Reference, basis: Basis) => reference === 'step' ? '1' : reference === 'ramp' ? basis === 'physical' ? 'kT' : 'k' : basis === 'physical' ? '(kT)^2/2' : 'k^2/2';

export const mount: ModuleMount = ({ container, signal }) => {
  if (signal.aborted) return;
  const lifetime = new AbortController(); let viewController: AbortController | undefined, disposed = false;
  // Forward abort before constructing an editor that can allocate and then fail.
  const forwardAbort = () => lifetime.abort();
  signal.addEventListener('abort', forwardAbort, { once: true });
  const root = node('div', '', 'df02-tool'), form = node('form', '', 'df02-card'), view = node('div', '', 'df02-view'); form.noValidate = true;
  root.append(node('p', 'Compare a ramp in sample index with a ramp in physical time. Inspect the error stems, make a prediction, then derive the limit and check the conditions that justify it.', 'df02-intro'));
  form.append(node('h3', '1. Define the reference loop'));
  let draft: EquationDraft;
  const message = node('p', '', 'df02-message'); message.setAttribute('role', 'alert'); message.hidden = true;
  const invalidate = () => {
    if (disposed) return;
    viewController?.abort(); view.replaceChildren(); message.hidden = false;
    message.textContent = 'Inputs changed. Apply the experiment to recompute its samples and limits.';
  };
  const editor = createEquationInput({ label: 'Forward path L(z)', value: String.raw`L(z)=\frac{0.1}{z-1}`, signal: lifetime.signal, onChange: next => { draft = next; invalidate(); } });
  form.append(editor.element, node('p', 'Negative feedback: e_c[k]=r[k]−h y[k], y=L e_c. The actual return ratio is hL. Tracking error e_t=r−y is shown separately from the comparator error.', 'df02-note'));
  const T = numeric('Sample period T (s)', '0.1', 0.001, 10), h = numeric('Sensor gain h', '1', 0.01, 10), N = numeric('Final sample index N', '80', 10, 1000, '1');
  const reference = choice('Reference shape', [['step', 'Unit step'], ['ramp', 'Unit ramp'], ['parabola', 'Unit parabola']], 'ramp');
  const basis = choice('Reference normalization', [['physical', 'Physical time: kT'], ['sequence', 'Sample index: k']], 'physical');
  const channel = choice('Error to inspect and predict', [['tracking', 'Tracking error r−y'], ['comparator', 'Comparator error r−hy']], 'tracking');
  const fields = node('div', '', 'df02-fields'); fields.append(T.wrapper, h.wrapper, N.wrapper, reference.wrapper, basis.wrapper, channel.wrapper); form.append(fields);
  [T.input, h.input, N.input, reference.input, basis.input, channel.input].forEach(input => input.addEventListener('input', invalidate, { signal: lifetime.signal }));
  const apply = node('button', 'Apply experiment', 'df02-primary'); apply.type = 'submit';
  const actions = node('div', '', 'df02-actions'); actions.append(apply);
  const presets = [
    ['Course baseline', String.raw`\frac{0.1}{z-1}`, '1', 'ramp'],
    ['Static gain', String.raw`\frac12`, '1', 'step'],
    ['Two poles at z=1', String.raw`\frac{0.2(z-0.8)}{(z-1)^2}`, '1', 'parabola'],
    ['Sensor h=2', String.raw`\frac{0.1}{z-1}`, '2', 'ramp'],
    ['Changed loop gain', String.raw`\frac{2}{z-0.5}`, '1', 'step'],
  ] as const;
  presets.forEach(([name, source, sensor, shape]) => {
    const button = node('button', name); button.type = 'button'; button.addEventListener('click', () => {
      editor.setValue(source); draft = editor.getValue(); T.input.value = '0.1'; h.input.value = sensor; N.input.value = '80'; reference.input.value = shape; basis.input.value = 'physical'; channel.input.value = 'tracking'; render();
    }, { signal: lifetime.signal }); actions.append(button);
  });
  form.append(actions, message);
  const limits = node('details', '', 'df02-card df02-limits'); limits.append(node('summary', 'Supported models and conventions'));
  limits.append(node('p', 'Proper real rational polynomials in z through degree two; decimals/fractions, sums, products, visible parentheses and polynomial powers −2…2. Powers of the number 10 accept integer exponents −12…12. Optional L(z), G(z) or F(z) prefix. No other variables, functions or symbolic parameters. Fractions/powers retain their visible argument scope; invisible formatting groups do not add parentheses. Mixed numbers require explicit + or ×. Visual e/E literals are rejected; native number controls use numeric exponent notation.'));
  limits.append(node('p', 'Bounds: 300 input characters, 160 tokens, 20 nesting levels, intermediate degree eight, 24 decimal digits and 2048-bit reduced exact fractions. Expanded coefficients ≤10000; nonzero normalized coefficients between 10⁻¹² and 10⁶. Internal polynomial arrays use ascending powers. Native controls are limited to 80 characters; exact T/h mantissas to 24 digits. T=0.001–10 s, h=0.01–10 and N=10–1000.'));
  limits.append(node('p', 'All history is zero before k=0. The current feedback equation is solved simultaneously when L has direct feedthrough; a singular equation is rejected. h is dimensionless and r/y use compatible arbitrary signal units. Physical ramps have rate 1 unit/s and parabolas acceleration 1 unit/s²; sequence versions use k instead of kT. T labels the entered discrete model: changing T does not derive a new sampled plant.'));
  limits.append(node('p', 'Exact decimal/fraction arithmetic determines factors at z=1 and the degree-one/two Schur inequalities. The unreduced closed-loop denominator is retained for a sufficient validity test, even if an external channel cancels a mode. This test can withhold a limit that a reduced scalar error alone would possess; it does not certify an unspecified hidden realization.'));
  limits.append(node('p', 'Stems are floating-point zero-history responses, after exact scalar cancellation in each external channel. Values beyond 10⁸, unstable growth k log|pole|>20 and numerical channel stability conditions within 10⁻¹² of zero stop or suppress a trace with feedback. These are numerical guards, not certified error bounds. Pole labels and decimal readouts are rounded. At most 1001 samples are computed; plots draw at most about 121 regular sample positions plus the selected point. No intersample hold model is assumed.'));
  root.append(form, view, limits); container.append(root); draft = editor.getValue();

  function render(): void {
    if (disposed) return;
    viewController?.abort(); viewController = new AbortController(); const local = viewController.signal;
    view.replaceChildren(); message.textContent = ''; message.hidden = true;
    try {
      if (draft.empty || draft.hasPlaceholders || draft.syntaxIssues.length) throw new Error('Complete the forward-path equation and check its notation before applying.');
      read(T.input, 'sample period T in seconds', 0.001, 10); read(h.input, 'sensor gain h', 0.01, 10);
      const a = analyze(parseForward(draft.latex), decimal(T.input.value, true), decimal(h.input.value, true), reference.input.value as Reference, basis.input.value as Basis, read(N.input, 'final sample index N', 10, 1000, true));
      const selected = channel.input.value as Channel;
      if (!['tracking', 'comparator'].includes(selected)) throw new Error('Choose a supported error channel.');
      experimentView(a, selected, local);
    } catch (error) { message.textContent = error instanceof Error ? error.message : 'The experiment could not be evaluated.'; message.hidden = false; }
  }
  function experimentView(a: Analysis, selected: Channel, local: AbortSignal): void {
    const card = node('section', '', 'df02-card'); card.append(node('h3', '2. Inspect the samples and predict'));
    card.append(equation(String.raw`r[k]=${referenceName(a.reference, a.basis)},\quad T=${tex(a.period)}\,\mathrm{s},\quad h=${tex(a.sensor)}`, 'Selected reference, period and sensor'));
    const channelName = selected === 'tracking' ? 'Tracking error e_t=r−y' : 'Comparator error e_c=r−hy';
    card.append(node('p', channelName, 'df02-badge'));
    if (a.traceWarning) card.append(node('p', a.traceWarning, 'df02-message'));
    if (a.samples.length) {
      const last = a.samples.at(-1)!, inspector = numeric('Inspect sample k', String(last.k), 0, last.k, '1');
      const range = numeric('Linked sample cursor', String(last.k), 0, last.k, '1'); range.input.type = 'range';
      const controls = node('div', '', 'df02-fields'); controls.append(inspector.wrapper, range.wrapper); card.append(controls);
      const pointError = node('p', '', 'df02-message'); pointError.setAttribute('role', 'status'); pointError.hidden = true;
      const point = node('p', '', 'df02-sample'); point.setAttribute('role', 'status');
      const upper = stemPlot(a.samples, [{ key: 'r', name: 'Reference r · open/dashed', className: 'df02-reference' }, { key: 'y', name: 'Output y · filled/solid', className: 'df02-output' }], 'Reference and output samples');
      const lower = stemPlot(a.samples, [{ key: selected, name: channelName, className: 'df02-error' }], 'Selected error samples');
      const show = (k: number) => { const s = a.samples[k]; upper.select(k); lower.select(k); point.textContent = `k=${s.k}, t=${label(s.t)} s · r=${label(s.r)}, y=${label(s.y)}, e_c=${label(s.comparator)}, e_t=${label(s.tracking)} signal units`; };
      inspector.input.addEventListener('input', () => {
        try { const k = read(inspector.input, 'sample index k', 0, last.k, true); range.input.value = String(k); show(k); pointError.hidden = true; }
        catch (error) { pointError.textContent = (error as Error).message; pointError.hidden = false; }
      }, { signal: local });
      range.input.addEventListener('input', () => { const k = read(range.input, 'sample index k', 0, last.k, true); inspector.input.value = String(k); show(k); pointError.hidden = true; }, { signal: local });
      show(last.k); card.append(pointError, point, upper.element, lower.element);
      card.append(node('p', `Computed k=0…${last.k} of requested 0…${a.requestedSamples}. The finite stem window illustrates the sequence; the limit below comes from its analytic conditions.`, 'df02-note'));
    }
    const prediction = choice('Predict the limit assessment', [['', 'Choose a prediction'], ['finite', 'Finite limit can be certified'], ['divergent', 'No finite error: polynomial growth'], ['not-certified', 'Retained-loop condition fails']], '');
    const estimate = numeric('Optional finite-error estimate', ''); estimate.input.disabled = true;
    const guesses = node('div', '', 'df02-fields'); guesses.append(prediction.wrapper, estimate.wrapper);
    const feedback = node('p', '', 'df02-message'); feedback.setAttribute('role', 'status');
    const reveal = node('button', 'Reveal limit and assumptions', 'df02-primary'); reveal.type = 'button';
    const checked = node('div', '', 'df02-checked'); let revealed = false;
    function compare(): boolean {
      feedback.textContent = '';
      let guess: number | undefined;
      try { if (prediction.input.value === 'finite' && estimate.input.value.trim()) guess = read(estimate.input, 'finite-error estimate'); }
      catch (error) { feedback.textContent = (error as Error).message; return false; }
      if (!prediction.input.value) { if (revealed) feedback.textContent = 'Choose a prediction to compare it with the derived assessment.'; return true; }
      const result = a.errors[selected];
      feedback.textContent = prediction.input.value === result.outcome ? 'The chosen category agrees with the derived assessment.' : 'The derived assessment differs from the prediction; use the factors and conditions below to explain why.';
      if (guess !== undefined && result.outcome === 'finite') {
        const expected = number(result.limit.value), tolerance = Math.max(1e-9, 0.01 * Math.abs(expected));
        feedback.textContent += Math.abs(guess - expected) <= tolerance ? ' The finite estimate agrees within 1% (absolute floor 10⁻⁹ signal units).' : ` The certified finite value is ${label(expected)} signal units.`;
      }
      return true;
    }
    prediction.input.addEventListener('change', () => { estimate.input.disabled = prediction.input.value !== 'finite'; if (revealed) compare(); }, { signal: local });
    estimate.input.addEventListener('input', () => { if (revealed) compare(); }, { signal: local });
    reveal.addEventListener('click', () => {
      if (!compare()) return;
      try { derive(a, selected, checked); revealed = true; reveal.disabled = true; reveal.textContent = 'Limit revealed'; compare(); }
      catch (error) { checked.replaceChildren(); feedback.textContent = error instanceof Error ? error.message : 'The calculation could not be displayed. Simplify the coefficients and retry.'; }
    }, { signal: local });
    card.append(guesses, reveal, feedback, checked); view.append(card);
  }
  function derive(a: Analysis, selected: Channel, target: HTMLElement): void {
    const result = a.errors[selected], symbol = selected === 'tracking' ? 'E_t' : 'E_c';
    target.append(node('h3', '3. Derive the error and justify its limit'));
    const raw = plus(a.forward.denominator, scale(a.forward.numerator, a.sensor));
    target.append(equation(String.raw`L(z)=\frac{${polynomial(a.forward.numerator)}}{${polynomial(a.forward.denominator)}},\quad C(z)=D(z)+hN(z)=${polynomial(raw)}`, 'Forward path and original characteristic polynomial'));
    target.append(equation(String.raw`\frac{Y}{R}=\frac{N}{D+hN},\quad \frac{E_c}{R}=\frac{D}{D+hN},\quad \frac{E_t}{R}=\frac{D+(h-1)N}{D+hN}`, 'Reference to output, comparator and tracking channels'));
    target.append(equation(String.raw`e_t=\left(1-\frac1h\right)r+\frac1h e_c`, 'Sensor relation between the two errors'));
    const ref = referenceFactors(a.reference, a.basis, a.period), prefix = equal(ref.multiplier, q(1)) ? '' : String.raw`${tex(ref.multiplier)}\cdot `;
    target.append(equation(String.raw`R(z)=${prefix}\frac{${a.reference === 'parabola' ? 'z(z+1)' : 'z'}}{${a.reference === 'parabola' ? '2' : ''}(z-1)^{${ref.order + 1}}},\quad ${symbol}(z)=\frac{${polynomial(result.numerator)}}{${polynomial(a.closed)}}R(z)`, 'Reference transform and normalized selected error channel'));
    target.append(node('p', 'Every retained pole of C must be strictly inside the unit circle for this tool to certify the final-value reasoning. The inequalities use the monic polynomial and exact entered fractions; displayed poles are numerical approximations.', 'df02-note'));
    const monic = a.closed.length === 3 ? String.raw`z^2+a_1z+a_0=${polynomial(a.closed)},\quad a_1=${tex(a.closed[1])},\quad a_0=${tex(a.closed[0])}` : a.closed.length === 2 ? String.raw`z+a_0=${polynomial(a.closed)},\quad a_0=${tex(a.closed[0])}` : '1';
    target.append(equation(String.raw`C_m(z)=${monic}`, 'Monic retained characteristic polynomial'));
    target.append(node('p', a.stable ? 'All retained closed-loop poles are strictly inside the unit circle.' : 'The retained-loop stability condition fails. An algebraic limit alone does not certify the sequence final value.', 'df02-badge'));
    target.append(node('p', `Approximate retained poles: ${a.poles.length ? a.poles.map(p => `${label(p.re)}${p.im < 0 ? '−' : '+'}${label(Math.abs(p.im))}j`).join(', ') : 'no dynamic poles'}.`));
    if (a.conditions.length) {
      const list = node('ul', '', 'df02-conditions');
      a.conditions.forEach(c => { const item = node('li'); item.append(equation(String.raw`${c.label.replace(/a₀/g, 'a_0').replace(/a₁/g, 'a_1').replace(/−/g, '-')}=${tex(c.value)}`, 'Exact Schur condition'), node('span', c.value.n > 0n ? 'positive ✓' : c.value.n === 0n ? 'zero: strict condition fails' : 'negative: condition fails')); list.append(item); }); target.append(list);
    }
    const numerator = scale(times(result.numerator, ref.factor), ref.multiplier);
    let denominator = a.closed;
    for (let i = 0; i < ref.order; i++) denominator = times(denominator, [q(-1), q(1)]);
    const nf = factorsAtOne(numerator), df = factorsAtOne(denominator);
    const factored = (order: number, remainder: Poly) => {
      const factor = order ? String.raw`(z-1)^{${order}}\,` : '';
      return String.raw`${factor}\left(${polynomial(remainder)}\right)`;
    };
    target.append(equation(nf.order === Infinity ? String.raw`\frac{z-1}{z}${symbol}(z)=0` : String.raw`\frac{z-1}{z}${symbol}(z)=\frac{${factored(nf.order, nf.remainder)}}{${factored(df.order, df.remainder)}}`, 'Final-value expression with factors at z equals one'));
    const factors = node('p', '', 'df02-factors'); factors.append(node('span', nf.order === Infinity ? 'Numerator is identically zero' : `Numerator: ${nf.order} factor(s) of z−1`), node('span', `Denominator: ${df.order} factor(s) of z−1`)); target.append(factors);
    if (result.outcome === 'finite') {
      target.append(equation(String.raw`e_{\infty}=${tex(result.limit.value)}`, 'Certified finite error'));
      target.append(node('p', 'After canceling the shown factors, no pole at z=1 remains in the final-value expression. The retained-loop conditions establish this finite limit.'));
      const endpoint = a.samples.at(-1);
      if (endpoint) target.append(node('p', `At k=${endpoint.k}, the sampled error is ${label(endpoint[selected])}; its distance from the analytic limit is ${label(Math.abs(endpoint[selected] - number(result.limit.value)))} signal units. A longer window may be needed to see the approach.`, 'df02-note'));
    } else if (result.outcome === 'divergent') {
      target.append(node('p', 'No finite steady-state error: uncanceled reference factors at z=1 produce polynomial growth.'));
      target.append(equation(String.raw`e[k]\sim ${tex(result.leading)}k^{${result.growthDegree}}\quad(k\to\infty)`, 'Asymptotic sampled error growth'));
    } else {
      target.append(node('p', 'Final value not certified by the retained-loop test. The following is only the formal algebraic limit; an unstable or canceled retained mode must not be called a valid steady-state experiment.'));
      target.append(equation(String.raw`\lim_{z\to1^+}\frac{z-1}{z}${symbol}(z)=${limitTex(result.limit)}`, 'Formal candidate, not a certified sequence final value'));
    }
    target.append(node('h4', `System type ${a.type} and comparator-error constants`));
    target.append(node('p', 'Type counts net uncanceled poles of L at z=1. These constants use the actual return ratio hL. For h=1, tracking and comparator errors coincide; otherwise use the sensor relation above.'));
    const constants = node('div', '', 'df02-constants');
    const entries: [string, Limit, string][] = [
      [String.raw`K_p=\lim_{z\to1}hL(z)`, a.constants.position, 'dimensionless'],
      [String.raw`K_{v,\mathrm{seq}}=\lim_{z\to1}(z-1)hL(z)`, a.constants.velocitySequence, 'sample-index ramp normalization'],
      [String.raw`K_{v,\mathrm{phys}}=K_{v,\mathrm{seq}}/T`, a.constants.velocityPhysical, 's⁻¹; physical unit ramp'],
      [String.raw`K_{a,\mathrm{seq}}=\lim_{z\to1}(z-1)^2hL(z)`, a.constants.accelerationSequence, 'sample-index parabola normalization'],
      [String.raw`K_{a,\mathrm{phys}}=K_{a,\mathrm{seq}}/T^2`, a.constants.accelerationPhysical, 's⁻²; physical unit parabola'],
    ];
    entries.forEach(([definition, value, unit]) => { const row = node('div'); row.append(equation(String.raw`${definition}=${limitTex(value)}`, unit), node('p', unit, 'df02-note')); constants.append(row); }); target.append(constants);
    target.append(node('h4', 'Keep a target of 100 in its declared normalization'));
    target.append(equation(String.raw`K_{v,\mathrm{phys}}=100\,\mathrm{s}^{-1}\ \Longleftrightarrow\ K_{v,\mathrm{seq}}=100T=${tex(mul(q(100), a.period))}`, 'Physical target converted to sample-index normalization'));
    target.append(equation(String.raw`K_{v,\mathrm{seq}}=100\ \Longleftrightarrow\ K_{v,\mathrm{phys}}=100/T=${tex(div(q(100), a.period))}\,\mathrm{s}^{-1}`, 'Sample-index target converted to physical normalization'));
    target.append(node('p', 'A printed lag-design target Kᵥ*=100 needs its source normalization before comparison. Matching a constant also requires the closed-loop validity check; this tool does not infer a continuous-time definition or design a compensator.', 'df02-note'));
  }
  function cleanup(): void {
    if (disposed) return; disposed = true;
    signal.removeEventListener('abort', cleanup); signal.removeEventListener('abort', forwardAbort);
    viewController?.abort(); lifetime.abort(); editor.destroy(); root.remove();
  }
  form.addEventListener('submit', event => { event.preventDefault(); render(); }, { signal: lifetime.signal });
  signal.addEventListener('abort', cleanup, { once: true }); render(); return cleanup;
};
