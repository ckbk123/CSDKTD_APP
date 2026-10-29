import type { ModuleMount } from '../../core/module';
import { createEquationInput, createEquationDisplay, type EquationInput, type EquationDraft } from '../../shared/equations/input';
import { readNumericInput } from '../../shared/numeric-input';
import { parseMatrix } from './input';
import { design, dampingTargets, realTargets, simulate, type Design, type M2, type V2, type Trace } from './math';
import { label, poleMap, stems } from './plots';
import './workspace.css';

function node<K extends keyof HTMLElementTagNameMap>(tag: K, text = '', className = ''): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag); element.textContent = text; element.className = className; return element;
}
function numeric(name: string, value: string, min?: number, max?: number, step = 'any') {
  const wrapper = node('label', '', 'dd06-field'), input = node('input'); input.type = 'number'; input.value = value; input.step = step;
  if (min !== undefined) input.min = String(min); if (max !== undefined) input.max = String(max);
  wrapper.append(node('span', name), input); return { wrapper, input };
}
function choice(name: string, options: readonly (readonly [string, string])[], value: string) {
  const wrapper = node('label', '', 'dd06-field'), input = node('select');
  options.forEach(([key, title]) => { const option = node('option', title); option.value = key; input.append(option); });
  input.value = value; wrapper.append(node('span', name), input); return { wrapper, input };
}
function read(input: HTMLInputElement, name: string, min: number, max: number, integer = false): number {
  if (input.value.length > 80) throw new Error(`Keep ${name} within 80 characters.`);
  const value = readNumericInput(input, name);
  if (value < min || value > max || integer && !Number.isInteger(value)) throw new Error(`Enter ${name} ${integer ? 'as an integer ' : ''}between ${min} and ${max}.`);
  return value;
}
const tex = (value: number) => label(value).replace(/e([+-]?\d+)/, (_, exponent: string) => String.raw`\times10^{${Number(exponent)}}`);
const matrixTex = (matrix: readonly (readonly number[])[]) => String.raw`\begin{bmatrix}${matrix.map(row => row.map(tex).join('&')).join(String.raw`\\`)}\end{bmatrix}`;
function equation(source: string, name: string) { const element = createEquationDisplay(source, name); element.tabIndex = 0; return element; }
const sources = {
  A: String.raw`A=\begin{bmatrix}0&1\\-2&-3\end{bmatrix}`,
  B: String.raw`B=\begin{bmatrix}0\\1\end{bmatrix}`,
  C: String.raw`C=\begin{bmatrix}1&0\end{bmatrix}`,
} as const;

export const mount: ModuleMount = ({ container, signal }) => {
  if (signal.aborted) return;
  const lifetime = new AbortController(), editors: EquationInput[] = [], root = node('div', '', 'dd06-tool');
  let disposed = false, viewController: AbortController | undefined;
  // Register before constructing editors: a partial mount must release resources.
  function cleanup(): void {
    if (disposed) return; disposed = true; signal.removeEventListener('abort', cleanup);
    viewController?.abort(); lifetime.abort(); editors.forEach(editor => editor.destroy()); root.remove();
  }
  signal.addEventListener('abort', cleanup, { once: true });
  root.append(node('p', 'Choose a sampled state-feedback design, predict controllability and tracking, then check the actual modes and sampled output/control effort.'));
  const form = node('form', '', 'dd06-card'); form.noValidate = true; form.append(node('h3', '1. Define the continuous plant and targets'));
  const view = node('div', '', 'dd06-view'), message = node('p', '', 'dd06-message'); message.setAttribute('role', 'alert'); message.hidden = true;
  const invalidate = () => { if (disposed) return; viewController?.abort(); view.replaceChildren(); message.hidden = false; message.textContent = 'Inputs changed. Apply the design to recompute its model and checks.'; };
  function matrixInput(name: 'A' | 'B' | 'C', title: string, rows: number, columns: number) {
    let draft: EquationDraft;
    const editor = createEquationInput({ label: title, value: sources[name], signal: lifetime.signal, onChange: next => { draft = next; invalidate(); } });
    editors.push(editor); editor.element.dataset.dd06Matrix = name; form.append(editor.element);
    const get = () => {
      draft = editor.getValue();
      if (draft.empty || draft.hasPlaceholders || draft.syntaxIssues.length) throw new Error(`Complete matrix ${name} and check its notation before applying.`);
      return parseMatrix(draft.latex, rows, columns, name);
    };
    return { editor, get };
  }
  const A = matrixInput('A', 'Continuous state matrix A (2×2)', 2, 2), B = matrixInput('B', 'Continuous input matrix B (2×1)', 2, 1), C = matrixInput('C', 'Output matrix C (1×2)', 1, 2);
  form.append(equation(String.raw`\dot{x}=Ax+Bu,\quad y=Cx,\quad D=0`, 'Continuous SISO state model'));
  form.append(node('p', 'Two normalized state coordinates, one scalar input/output; D=0. Both state coordinates are assumed available for feedback; C selects the tracked output. ZOH holds u[k] over [kT,(k+1)T). The baseline output is the first state: C=[1,0]. Matrix cells accept signed decimals or numeric fractions.', 'dd06-note'));
  const T = numeric('Sample period T (s)', '0.1', 0.001, 2), targetMode = choice('Target specification', [['real', 'Two real discrete poles'], ['damping', 'Continuous damping and natural frequency']], 'real');
  const p1 = numeric('First discrete pole', '0.7', -2, 2), p2 = numeric('Second discrete pole', '0.8', -2, 2), zeta = numeric('Damping ratio ζ', '0.5', 0, 3), wn = numeric('Natural frequency ωn (rad/s)', '8', 0.01, 100);
  const x1 = numeric('Initial state x₁[0] (units)', '0', -100, 100), x2 = numeric('Initial state x₂[0] (units)', '0', -100, 100), reference = numeric('Constant reference r (units)', '1', -10, 10), horizon = numeric('Final sample index N', '80', 10, 2000, '1');
  const fields = node('div', '', 'dd06-fields');
  [T, targetMode, p1, p2, zeta, wn, x1, x2, reference, horizon].forEach(field => fields.append(field.wrapper)); form.append(fields);
  function syncMode() { const continuous = targetMode.input.value === 'damping'; [p1, p2].forEach(field => { field.wrapper.hidden = continuous; field.input.disabled = continuous; }); [zeta, wn].forEach(field => { field.wrapper.hidden = !continuous; field.input.disabled = !continuous; }); }
  targetMode.input.addEventListener('change', syncMode, { signal: lifetime.signal }); syncMode();
  form.append(node('p', 'Changing T recomputes Ad/Bd from this continuous plant and redesigns Kd/Nd. Entered discrete poles stay fixed in the first mode; ζ and ωn stay fixed and are remapped in the second mode.', 'dd06-note'));
  const actions = node('div', '', 'dd06-actions'), apply = node('button', 'Apply design', 'dd06-primary'); apply.type = 'submit'; actions.append(apply);
  const presets: readonly [string, () => void][] = [
    ['Course baseline', () => {}],
    ['Double integrator', () => A.editor.setValue(String.raw`A=\begin{bmatrix}0&1\\0&0\end{bmatrix}`)],
    ['Uncontrollable input', () => B.editor.setValue(String.raw`B=\begin{bmatrix}0\\0\end{bmatrix}`)],
    ['Velocity output: DC=0', () => { C.editor.setValue(String.raw`C=\begin{bmatrix}0&1\end{bmatrix}`); x1.input.value = '1'; }],
    ['Damping targets', () => { targetMode.input.value = 'damping'; }],
    ['Unstable target', () => { p1.input.value = '1.2'; }],
  ];
  presets.forEach(([title, change]) => {
    const button = node('button', title); button.type = 'button'; button.addEventListener('click', () => {
      A.editor.setValue(sources.A); B.editor.setValue(sources.B); C.editor.setValue(sources.C);
      T.input.value = '0.1'; targetMode.input.value = 'real'; p1.input.value = '0.7'; p2.input.value = '0.8'; zeta.input.value = '0.5'; wn.input.value = '8'; x1.input.value = '0'; x2.input.value = '0'; reference.input.value = '1'; horizon.input.value = '80';
      change(); syncMode(); render();
    }, { signal: lifetime.signal }); actions.append(button);
  });
  form.append(actions, message);
  const limits = node('details', '', 'dd06-card'); limits.append(node('summary', 'Supported model, timing and numerical limits'));
  limits.append(node('p', 'Continuous-time real A2×2, B2×1, C1×2; D=0, one scalar input/output. Ideal full-state feedback uses the available true state; no observer is inferred from C. State coordinates are normalized units; A entries are per second, B entries per input unit per second, C maps to output units. Reference/output units agree. Initial state coordinates are −100…100; constant reference −10…10. Every visit/reset starts from the baseline.'));
  limits.append(node('p', 'Matrix entries are zero or have magnitude 10⁻¹²…100. Visual bmatrix/pmatrix/matrix templates accept optional matching A=/B=/C= labels, signed decimals and numeric fractions, including compact and nested fractions. No cell arithmetic, powers, mixed numbers, e/E or symbolic entries. Matrix text≤600 characters, cell≤140, decimal mantissas≤24 digits, nesting≤16. Native controls have their separate numeric exponent grammar and an 80-character limit.'));
  limits.append(node('p', 'T=0.001…2 s. ZOH is a floating-point augmented exponential, with matrix/time infinity norm≤40, scaled norm≤.5 and at most 32 series terms plus squaring. No inverse of continuous A is used. Computed model, gain, equilibrium and signal magnitudes must stay≤10⁸. These guards are resource/conditioning limits, not certified error bounds.'));
  limits.append(node('p', 'Controllability uses normalized-column determinant tolerance 10⁻¹⁰ and a sampled zero-input scale 10⁻¹². Feedback and tracking residuals must be≤10⁻⁸. Schur values within10⁻⁹ times coefficient scale are boundary/uncertain. The DC solve needs reciprocal condition>10⁻¹² and nonvanishing output alignment at10⁻¹⁰. A formal tracking multiplier does not establish convergence for unstable/boundary modes.'));
  limits.append(node('p', 'Entered real poles lie in −2…2; mapped targets use ζ=0…3, ωn=0.01…100 rad/s and decay≤20 per sample. Angle aliasing is labeled. The original CH9 problem parameters are variations of this declared model; their uninspected source diagrams are not reconstructed here.'));
  limits.append(node('p', 'A conservative forward roundoff allowance follows both states, output and effort. The trace stops before an allowance exceeds 10⁻⁸×max(1, |value|), even if the magnitude/growth limits have not been reached. This numerical support check can withhold ill-conditioned tails; it never removes small modes. Only the reliable computed prefix is shown.' ));
  limits.append(node('p', 'At each k read x[k], compute y[k]=Cx[k] and u[k]=−Kd x[k]+Nd r, then update x[k+1]=Ad x[k]+Bd u[k]. N is 10…2000, with unstable-mode growth bounded by k log|pole|≤20. Plots draw at most about 161 regular positions; all computed samples remain inspectable. Overshoot and a 2% band suffix of at least 10 samples describe only the computed window. They are not proofs of global peak or settling time.'));
  root.append(form, view, limits); container.append(root);
  fields.addEventListener('input', invalidate, { signal: lifetime.signal });
  form.addEventListener('submit', event => { event.preventDefault(); render(); }, { signal: lifetime.signal });
  function render(): void {
    if (disposed) return;
    viewController?.abort(); viewController = new AbortController(); const local = viewController.signal;
    view.replaceChildren(); message.hidden = true; message.textContent = '';
    try {
      const period = read(T.input, 'sample period T in seconds', 0.001, 2), initial: V2 = [read(x1.input, 'initial x₁', -100, 100), read(x2.input, 'initial x₂', -100, 100)];
      const r = read(reference.input, 'constant reference', -10, 10), count = read(horizon.input, 'final sample index N', 10, 2000, true);
      const targets = targetMode.input.value === 'real' ? realTargets(read(p1.input, 'first discrete pole', -2, 2), read(p2.input, 'second discrete pole', -2, 2)) : targetMode.input.value === 'damping' ? dampingTargets(read(zeta.input, 'damping ratio', 0, 3), read(wn.input, 'natural frequency in rad/s', 0.01, 100), period) : undefined;
      if (!targets) throw new Error('Choose a supported target specification.');
      const result = design({ A: A.get() as unknown as M2, B: B.get().map(row => row[0]) as unknown as V2, C: C.get()[0] as unknown as V2, T: period }, targets);
      prediction(result, initial, r, count, local);
    } catch (error) { message.textContent = (error as Error).message; message.hidden = false; }
  }
  function prediction(result: Design, initial: V2, r: number, count: number, local: AbortSignal): void {
    const card = node('section', '', 'dd06-card'); card.append(node('h3', '2. Inspect the sampled model and predict'));
    card.append(equation(String.raw`A_d=e^{AT},\quad B_d=\int_0^T e^{A\tau}B\,d\tau`, 'Zero-order-hold model identities'));
    card.append(equation(String.raw`A_d\approx${matrixTex(result.model.Ad)},\quad B_d\approx${matrixTex(result.model.Bd.map(value => [value]))}`, 'Computed ZOH state and input matrices'));
    card.append(equation(String.raw`p_d(z)=z^2-(${tex(result.targets.sum)})z+(${tex(result.targets.product)}),\quad T=${tex(result.model.T)}\,\mathrm{s}`, 'Desired characteristic polynomial and sample period'));
    card.append(node('p', result.targets.description, 'dd06-note')); if (result.targets.aliasWarning) card.append(node('p', result.targets.aliasWarning, 'dd06-message'));
    const controlGuess = choice('Does sampled controllability pass?', [['', 'Choose a prediction'], ['yes', 'Yes: sampled controllability rank 2'], ['no', 'No: sampled controllability is deficient']], '');
    const trackGuess = choice('Is unity step tracking established?', [['', 'Choose a prediction'], ['yes', 'Yes: stable modes and a valid multiplier'], ['no', 'No such tracking conclusion is established']], '');
    const estimate = numeric('Optional Nd estimate', ''); estimate.input.disabled = true;
    const guesses = node('div', '', 'dd06-fields'); guesses.append(controlGuess.wrapper, trackGuess.wrapper, estimate.wrapper);
    const feedback = node('p', '', 'dd06-message'); feedback.setAttribute('role', 'status');
    const checked = node('div', '', 'dd06-checked'), reveal = node('button', 'Reveal feedback and sampled experiment', 'dd06-primary'); reveal.type = 'button'; let revealed = false;
    const compare = () => {
      feedback.textContent = ''; let guess: number | undefined;
      try { if (trackGuess.input.value === 'yes' && estimate.input.value.trim()) guess = read(estimate.input, 'reference multiplier estimate', -1e8, 1e8); }
      catch (error) { feedback.textContent = (error as Error).message; return false; }
      if (!controlGuess.input.value && !trackGuess.input.value) { if (revealed) feedback.textContent = 'Choose predictions to compare them with the computed checks.'; return true; }
      const canPlace = result.model.rank === 2, canTrack = Boolean(result.tracking?.available && result.tracking.certified);
      const answers = [[controlGuess.input.value, canPlace, 'Controllability'], [trackGuess.input.value, canTrack, 'Tracking']] as const;
      answers.forEach(([answer, expected, name]) => { if (answer) feedback.textContent += `${name} prediction ${(answer === 'yes') === expected ? 'agrees with' : 'differs from'} the computed checks. `; });
      if (guess !== undefined && result.tracking?.available) feedback.textContent += Math.abs(guess - result.tracking.N) <= Math.max(1e-8, 0.01 * Math.abs(result.tracking.N)) ? 'Nd estimate agrees within 1% (absolute floor 10⁻⁸).' : `The computed multiplier is ${label(result.tracking.N)}.`;
      return true;
    };
    trackGuess.input.addEventListener('change', () => { estimate.input.disabled = trackGuess.input.value !== 'yes'; if (revealed) compare(); }, { signal: local });
    controlGuess.input.addEventListener('change', () => { if (revealed) compare(); }, { signal: local }); estimate.input.addEventListener('input', () => { if (revealed) compare(); }, { signal: local });
    reveal.addEventListener('click', () => {
      if (!compare()) return;
      try { derive(result, initial, r, count, checked, local); revealed = true; reveal.disabled = true; reveal.textContent = 'Design revealed'; compare(); }
      catch (error) { checked.replaceChildren(); feedback.textContent = `The design could not be displayed: ${(error as Error).message}`; }
    }, { signal: local });
    card.append(guesses, reveal, feedback, checked); view.append(card);
  }
  function derive(result: Design, initial: V2, referenceValue: number, count: number, target: HTMLElement, local: AbortSignal): void {
    const { model, feedback, tracking } = result;
    target.append(node('h3', '3. Check controllability and match coefficients'));
    target.append(equation(String.raw`\mathcal C_d=[B_d\quad A_dB_d]\approx${matrixTex(model.W)}`, 'Sampled controllability columns'));
    target.append(node('p', `Numerical rank ${model.rank} of 2. Normalized column determinant=${label(model.scaledDeterminant)}; full rank requires more than 10⁻¹⁰ after the zero-input check.`, 'dd06-note'));
    if (!feedback) { target.append(node('p', result.issue, 'dd06-message')); return; }
    target.append(equation(String.raw`\operatorname{tr}(A_d-B_dK_d)=\operatorname{tr}A_d-K_dB_d,\quad\det(A_d-B_dK_d)=\det A_d-K_d\operatorname{adj}(A_d)B_d`, 'Two-state coefficient identities'));
    target.append(equation(String.raw`${matrixTex(feedback.coefficientMatrix)}\begin{bmatrix}k_1\\k_2\end{bmatrix}\approx${matrixTex(feedback.coefficientRhs.map(value => [value]))},\quad K_d\approx${matrixTex([feedback.K])}`, 'Coefficient matching and feedback gain'));
    const table = node('table'), heading = node('tr'); ['Coefficient in z²+a₁z+a₀', 'Desired', 'Actual'].forEach(text => heading.append(node('th', text))); const head = node('thead'); head.append(heading); table.append(head);
    const body = node('tbody'); [['a₁', -result.targets.sum, -feedback.sum], ['a₀', result.targets.product, feedback.product]].forEach(([name, desired, actual]) => { const row = node('tr'); row.append(node('td', String(name)), node('td', label(Number(desired))), node('td', label(Number(actual)))); body.append(row); }); table.append(body);
    const scroll = node('div', '', 'dd06-scroll'); scroll.tabIndex = 0; scroll.append(table); target.append(scroll, node('p', `Scaled coefficient residual=${label(feedback.residual)} (required≤10⁻⁸).`, 'dd06-note'));
    target.append(equation(String.raw`A_{cl}=A_d-B_dK_d\approx${matrixTex(feedback.closed)}`, 'Actual closed-loop state matrix'));
    const rootTex = feedback.poles.map(pole => String.raw`${tex(pole.re)}${pole.im < 0 ? '-' : '+'}${tex(Math.abs(pole.im))}\mathrm{j}`).join(String.raw`,\;`);
    target.append(equation(String.raw`\operatorname{eig}(A_{cl})\approx\{${rootTex}\}`, 'All actual closed-loop poles'), poleMap(result.targets.poles, feedback.poles));
    target.append(node('p', feedback.stability === 'stable' ? 'All retained closed-loop modes pass the strict Schur test at the declared numerical tolerance.' : feedback.stability === 'unstable' ? 'At least one retained mode fails strict Schur stability. A formal DC multiplier cannot establish convergent tracking.' : 'A Schur condition is on or too near the unit-circle boundary. Strict stability and convergent tracking are not established.', 'dd06-message'));
    target.append(equation(String.raw`1-s+p\approx${tex(feedback.conditions[0])},\quad1+s+p\approx${tex(feedback.conditions[1])},\quad1-p\approx${tex(feedback.conditions[2])}`, 'Schur conditions for z squared minus s z plus p'));
    target.append(node('h3', '4. Set the reference multiplier'));
    target.append(equation(String.raw`u[k]=-K_dx[k]+N_dr[k],\quad N_d=\frac{1}{C(I-A_{cl})^{-1}B_d}`, 'Negative feedback and ideal-model reference multiplier'));
    if (tracking?.available) {
      target.append(equation(String.raw`C(I-A_{cl})^{-1}B_d\approx${tex(tracking.dc)},\quad N_d\approx${tex(tracking.N)},\quad x_{\infty}/r\approx${matrixTex(tracking.equilibrium.map(value => [value]))}`, 'Computed DC gain, multiplier and equilibrium'));
      target.append(node('p', `Unit-reference equilibrium residual=${label(tracking.residual)}. ${tracking.certified ? 'For this ideal model and constant reference, strict retained-mode stability gives y[k]→r from any supported finite initial state.' : 'This is a formal equilibrium multiplier; the retained-mode test does not establish that the trajectory converges to it.'}`, 'dd06-note'));
    } else target.append(node('p', tracking?.reason ?? 'No reference multiplier is available.', 'dd06-message'));
    target.append(node('h3', '5. Inspect sampled output, states and held effort'));
    target.append(node('p', 'At k: read x[k], compute y[k] and u[k], then update x[k+1]. The calculated input is held until the next sample. All plots below use the complete two-state model.', 'dd06-note'));
    try { response(result, simulate(result, initial, referenceValue, count), target, local); }
    catch (error) { target.append(node('p', (error as Error).message, 'dd06-message')); }
  }
  function response(result: Design, trace: Trace, target: HTMLElement, local: AbortSignal): void {
    if (trace.warning) target.append(node('p', trace.warning, 'dd06-message'));
    if (!trace.samples.length) return;
    const last = trace.samples.at(-1)!, inspector = numeric('Inspect sample k', String(last.k), 0, last.k, '1'), range = numeric('Linked sample cursor', String(last.k), 0, last.k, '1'); range.input.type = 'range';
    const controls = node('div', '', 'dd06-fields'); controls.append(inspector.wrapper, range.wrapper);
    const pointError = node('p', '', 'dd06-message'); pointError.setAttribute('role', 'status'); pointError.hidden = true;
    const point = node('p', '', 'dd06-readout'); point.setAttribute('role', 'status');
    const upper = stems(trace.samples, [{ key: 'r', name: 'Reference r', style: 'open' }, { key: 'y', name: 'Output y', style: 'filled' }], 'Reference and output samples', 'Output/reference (units)');
    const effort = stems(trace.samples, [{ key: 'u', name: 'Held input u', style: 'filled' }], 'Control effort samples', 'Input effort (units)');
    const states = stems(trace.samples, [{ key: 'x1', name: 'State x₁', style: 'open' }, { key: 'x2', name: 'State x₂', style: 'filled' }], 'State coordinate samples', 'State coordinates (units)');
    const show = (k: number) => { const sample = trace.samples[k]; [upper, effort, states].forEach(plot => plot.select(k)); point.textContent = `k=${k}, t=${label(sample.t)} s · x₁=${label(sample.x1)}, x₂=${label(sample.x2)}, r=${label(sample.r)}, y=${label(sample.y)}, u=${label(sample.u)}, error=${label(sample.error)} (normalized units)`; };
    inspector.input.addEventListener('input', () => { try { const k = read(inspector.input, 'sample index k', 0, last.k, true); range.input.value = String(k); show(k); pointError.hidden = true; } catch (error) { pointError.textContent = (error as Error).message; pointError.hidden = false; } }, { signal: local });
    range.input.addEventListener('input', () => { const k = read(range.input, 'sample index k', 0, last.k, true); inspector.input.value = String(k); show(k); pointError.hidden = true; }, { signal: local }); show(last.k);
    const stateDetails = node('details'); stateDetails.append(node('summary', 'State coordinate samples'), states.element);
    target.append(controls, pointError, point, upper.element, effort.element, stateDetails);
    target.append(node('p', `Computed k=0…${last.k} of requested 0…${trace.requested}; T=${label(result.model.T)} s. Maximum sampled |u|=${label(trace.maxEffort)} input units; last error=${label(last.error)} output units.`, 'dd06-note'));
    if (trace.overshoot !== undefined) target.append(node('p', `Observed overshoot in this window=${label(trace.overshoot)}%. ${trace.bandEntry === undefined ? 'No 2% in-band suffix of at least 10 samples was observed; extend the window if appropriate.' : `Observed 2% band suffix begins at t=${label(trace.bandEntry)} s and lasts at least 10 samples.`} These sampled-window measures do not prove a global peak or settling time.`, 'dd06-note'));
  }
  render(); return cleanup;
};
