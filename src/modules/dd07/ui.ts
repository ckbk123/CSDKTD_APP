import type { ModuleMount } from '../../core/module';
import { createEquationDisplay, createEquationInput, type EquationInput } from '../../shared/equations/input';
import { readNumericInput } from '../../shared/numeric-input';
import { characteristic, designFeedback, designObserver, quadratic, simulate, validatePeriod, zoh, type Complex, type Feedback, type Matrix, type Observer, type Options, type Run, type Vector } from './math';
import { parseMatrix, parseTarget } from './parser';
import './style.css';

const INITIAL = [String.raw`A=\begin{bmatrix}0&1\\-2&-3\end{bmatrix}`, String.raw`B=\begin{bmatrix}0\\1\end{bmatrix}`, String.raw`C=\begin{bmatrix}1&0\end{bmatrix}`, 'q(z)=(z-0.3)(z-0.4)', 'q(z)=(z-0.7)(z-0.8)'] as const;
const element = <K extends keyof HTMLElementTagNameMap>(tag: K, text?: string): HTMLElementTagNameMap[K] => { const e = document.createElement(tag); if (text !== undefined) e.textContent = text; return e; };
const plain = (v: number) => v === 0 ? '0' : Number(v.toPrecision(9)).toString();
const format = (v: number) => plain(v).replace(/e([+-]?\d+)/, (_, p: string) => ` × 10^${Number(p)}`);
const tex = (v: number) => { const [a, b] = plain(v).split('e'); return b === undefined ? a : `${a}\\times10^{${Number(b)}}`; };
const axis = (v: number) => v === 0 ? '0' : Math.abs(v) < .001 || Math.abs(v) >= 10000 ? v.toExponential(1) : Number(v.toPrecision(3)).toString();
const matrix = (a: readonly number[], columns: number) => `\\begin{bmatrix}${a.map((v, i) => tex(v) + (i === a.length - 1 ? '' : (i + 1) % columns ? '&' : '\\\\')).join('')}\\end{bmatrix}`;
const modes = (poles: readonly Complex[]) => poles.map(([re, im]) => `${format(re)}${im ? ` ${im < 0 ? '−' : '+'} j ${format(Math.abs(im))}` : ''}`).join('; ');
const button = (label: string, action: string) => { const b = element('button', label); b.type = 'button'; b.dataset.action = action; return b; };
function svgElement(tag: string, attributes: Record<string, string | number>, text?: string): SVGElement {
  const e = document.createElementNS('http://www.w3.org/2000/svg', tag); Object.entries(attributes).forEach(([k, v]) => e.setAttribute(k, String(v))); if (text !== undefined) e.textContent = text; return e;
}

export const mount: ModuleMount = ({ container, signal }) => {
  const root = element('div'); root.className = 'sampled-observer-tool'; container.append(root);
  let observer: Observer, feedback: Feedback | undefined, run: Run, applied: Options, modelNote = '';
  let secondRow = false, revealed = false, selected = 0;
  const attempts = { l1: '', l2: '' }, editors: EquationInput[] = [];
  const view = element('div'), status = element('p'); status.setAttribute('role', 'status');
  const invalidate = () => { revealed = false; view.replaceChildren(); status.textContent = 'Data changed. Apply to recompute the sampled model and observer.'; };
  const intro = element('section'); intro.append(element('h3', 'Read one output, estimate two sampled states'), element('p', 'Construct observability and predict the discrete gain. Follow the read/correct/control/advance order, then compare states, estimates, innovation and effort in samples or seconds.'));
  intro.append(createEquationDisplay(String.raw`x[k+1]=A_dx[k]+B_du[k],\quad y_m[k]=Cx[k]+n[k],\quad D=0`, 'Sampled plant truth and single measured output'));
  function choice(parent: HTMLElement, label: string, name: string, items: [string, string][]): HTMLSelectElement {
    const wrap = element('label', label), select = element('select'); select.name = name; select.setAttribute('aria-label', label);
    items.forEach(([value, text]) => { const option = element('option', text); option.value = value; select.append(option); }); wrap.append(select); parent.append(wrap); return select;
  }
  const modelControls = element('div'); modelControls.className = 'sampled-observer-controls';
  const modelKind = choice(modelControls, 'Model interpretation', 'modelKind', [['zoh', 'Continuous A/B → exact ZOH model'], ['direct', 'Entered A/B are already discrete A_d/B_d']]);
  const timing = choice(modelControls, 'Observer timing', 'timing', [['predictor', 'Predictor estimate before reading y[k]'], ['current', 'Current estimate after correcting with y[k]']]);
  const editorGrid = element('div'); editorGrid.className = 'sampled-observer-inputs';
  for (const [i, label] of ['Model matrix A (2 by 2)', 'Input column B (2 by 1)', 'Sensor row C (1 by 2)', 'Observer target polynomial in z', 'Feedback target polynomial in z (used when connected)'].entries()) {
    const editor = createEquationInput({ label, value: INITIAL[i], signal, onChange: invalidate });
    editor.element.addEventListener('keydown', event => {
      if (event.key !== 'Escape') return;
      event.preventDefault(); event.stopPropagation(); editor.element.querySelector<HTMLButtonElement>('button[aria-pressed="true"]')?.click();
    }, { capture: true, signal });
    editors.push(editor); editorGrid.append(editor.element);
  }
  function numeric(parent: HTMLElement, label: string, name: string, value: string): HTMLInputElement {
    const wrap = element('label', label), input = element('input'); input.type = 'number'; input.step = 'any'; input.name = name; input.value = value; input.setAttribute('aria-label', label); wrap.append(input); parent.append(wrap); return input;
  }
  const sampleControls = element('div'); sampleControls.className = 'sampled-observer-controls';
  const period = numeric(sampleControls, 'Sample period T (s)', 'period', '.1'), steps = numeric(sampleControls, 'Horizon (sample steps)', 'steps', '100'); steps.step = '1';
  const initialControls = element('fieldset'); initialControls.append(element('legend', 'Independent true state and prior estimate at k=0'));
  const initialRow = element('div'); initialRow.className = 'sampled-observer-controls'; initialControls.append(initialRow);
  const x1 = numeric(initialRow, 'True x₁[0]', 'initial1', '1'), x2 = numeric(initialRow, 'True x₂[0]', 'initial2', '0');
  const prior1 = numeric(initialRow, 'Prior p₁[0]', 'prior1', '0'), prior2 = numeric(initialRow, 'Prior p₂[0]', 'prior2', '0');
  const experiment = element('fieldset'); experiment.append(element('legend', 'Input, estimated-state feedback and measured noise'));
  const connectedLabel = element('label', 'Connect estimated-state feedback '), connected = element('input'); connected.type = 'checkbox'; connected.name = 'feedback'; connectedLabel.append(connected); experiment.append(connectedLabel);
  const controlRow = element('div'); controlRow.className = 'sampled-observer-controls'; experiment.append(controlRow);
  const held = numeric(controlRow, 'Known held u[k] (observer only)', 'heldInput', '0'), reference = numeric(controlRow, 'Held reference r[k] (feedback)', 'reference', '1');
  const amplitude = numeric(controlRow, 'Noise amplitude (output units)', 'amplitude', '0'), frequency = numeric(controlRow, 'Noise frequency ω (rad/s)', 'frequency', '20'), phase = numeric(controlRow, 'Noise phase (rad)', 'phase', '0');
  const syncMode = () => { held.disabled = connected.checked; reference.disabled = !connected.checked; }; syncMode();
  for (const controls of [modelControls, sampleControls, initialControls, experiment]) controls.addEventListener('input', () => { syncMode(); invalidate(); }, { signal });
  const actions = element('div'); actions.className = 'sampled-observer-actions'; actions.append(button('Apply experiment', 'apply'), button('Try velocity sensor', 'velocity'), button('Try targets 0.1, 0.2', 'faster'), button('Try conjugate targets 0.4 ± 0.3j', 'complex'), button('Try sampled measurement noise', 'noise'), button('Load rounded CH9 model', 'rounded'), button('Restore course ZOH model', 'baseline'));
  const limits = element('details'); limits.append(element('summary', 'Supported model, timing, units and limits'),
    element('p', 'Two real states, one scalar input/output, D=0, state columns. A/B fields are continuous matrices in ZOH mode and discrete matrices in direct mode; C is unchanged. Matrix cells accept decimals or signed numeric fractions. Targets are real monic Schur quadratics in z, including repeated/conjugate/zero targets; margin >10⁻⁹ for |d₀|<1 and 1±d₁+d₀>0. Expanded/factored forms work. Visual e/E, hidden grouping and mixed-number adjacency are unsupported.'),
    element('p', 'Default B=[0;1] is the declared held-input/feedback extension of the metadata’s mechanical model. ZOH assumes u[k] held on [kT,(k+1)T). Changing T recomputes A_d/B_d and redesigns fixed z-targets. Direct mode never rediscretizes entered matrices; T changes the seconds/noise clock. Current timing interprets initial p[0] as a prior, not an already corrected estimate. No current output feedthrough is present.'),
    element('p', 'T=0.0001–10s; horizon1–1000 integer steps, all samples retained. Initial state/prior and input/reference/noise controls magnitude≤100; amplitude/frequency nonnegative. Noise n[k]=a sin(ωkT+φ) is prescribed, not a random/Kalman model. Other signal units follow the entered model. State RMS values stay separate; sample peaks/RMS and a finite horizon do not prove settling. No between-sample trajectory is inferred.'),
    element('p', 'Matrix entries≤1000, targets≤10,000, gains≤10⁶, closed entries≤10⁴, response≤10⁸. Rank/solves normalize each row and use determinant threshold10⁻⁹. Actual monic coefficient differences divided by max(1,|target coefficient|)≤10⁻¹⁰. Near-zero/repeated modes remain numerical. ZOH uses a3×3 augmented exponential including singular A, ≤24 Taylor terms/scaling steps, reduced norm≤0.5, term tolerance10⁻¹⁶ and relative determinant check10⁻⁹. Bad conditioning/overflow/underflow rejects explicitly.'),
    element('p', 'Equation length≤600, target≤120 tokens/nesting12, scalar nesting8, decimals≤8 integer/12 fractional digits. The current conversion solves A_d M=L_d; singular/poorly conditioned A_d can support predictor timing while current conversion is unavailable. N is supported only for a well-conditioned nonzero model DC gain with magnitude≤10⁶.'));
  intro.append(modelControls, editorGrid, sampleControls, initialControls, experiment, actions, status, limits); root.append(intro, view);

  function plot(title: string, lines: { label: string; values: number[]; style: string }[], seconds: boolean): HTMLElement {
    const figure = element('figure'); figure.append(element('figcaption', title));
    const values = lines.flatMap(line => line.values); let low = Math.min(0, ...values), high = Math.max(0, ...values); if (low === high) { low--; high++; }
    const padding = (high - low) * .1; low -= padding; high += padding;
    const X = (i: number) => 88 + 385 * i / applied.steps, Y = (y: number) => 185 - 155 * (y - low) / (high - low), duration = seconds ? applied.steps * applied.period : applied.steps;
    const svg = svgElement('svg', { viewBox: '0 0 500 225', role: 'img', 'aria-label': `${title}. Discrete sample markers. ${lines.map(l => l.label).join('; ')}. ${seconds ? 'Seconds t' : 'Sample k'} from 0 to ${duration}. Numeric values below.` });
    svg.append(svgElement('line', { x1: 88, x2: 478, y1: Y(0), y2: Y(0), class: 'sampled-observer-axis' }), svgElement('line', { x1: 88, x2: 88, y1: 25, y2: 185, class: 'sampled-observer-axis' }), svgElement('text', { x: 83, y: 30, 'text-anchor': 'end' }, axis(high)), svgElement('text', { x: 83, y: 185, 'text-anchor': 'end' }, axis(low)), svgElement('text', { x: 88, y: 204 }, '0'), svgElement('text', { x: 478, y: 204, 'text-anchor': 'end' }, format(duration)), svgElement('text', { x: 230, y: 219 }, seconds ? 'Time t (s)' : 'Sample k'));
    for (const line of lines) {
      svg.append(svgElement('path', { d: line.values.map((v, i) => `M${X(i).toFixed(3)},${Y(0).toFixed(3)}V${Y(v).toFixed(3)}`).join(' '), class: line.style }));
      line.values.forEach((v, i) => svg.append(svgElement('circle', { cx: X(i), cy: Y(v), r: i === selected ? 4 : 2, class: line.style })));
    }
    const scroll = element('div'); scroll.className = 'sampled-observer-plot-scroll'; scroll.tabIndex = 0; scroll.setAttribute('role', 'region'); scroll.setAttribute('aria-label', `${title} plot; scroll horizontally for the full axes`); scroll.append(svg);
    figure.append(scroll, element('p', lines.map(l => l.label).join(' · '))); return figure;
  }
  let axisSeconds = false;
  function render(): void {
    if (signal.aborted) return;
    const active = document.activeElement instanceof HTMLElement && view.contains(document.activeElement) ? document.activeElement : null;
    const action = active?.dataset.action, name = active instanceof HTMLInputElement || active instanceof HTMLSelectElement ? active.name : undefined;
    view.replaceChildren();
    const model = element('section'); model.append(element('h3', '1. Establish the sampled model'), element('p', modelNote), createEquationDisplay(`A_d=${matrix(observer.A, 2)},\\quad B_d=${matrix(discreteB, 1)},\\quad C=${matrix(observer.C, 2)},\\quad T=${tex(applied.period)}\\;\\mathrm{s}`, 'Actual full-precision sampled model, shown rounded to nine significant digits'));
    const rowStep = element('section'); rowStep.append(element('h3', '2. Build observability, one row at a time'), createEquationDisplay(`C=${matrix(observer.C, 2)}`, 'First observability row'));
    if (secondRow) rowStep.append(createEquationDisplay(`CA_d=${matrix(observer.observability.slice(2), 2)},\\quad\\mathcal O=${matrix(observer.observability, 2)}`, 'Second row and complete sampled observability matrix'), element('p', `Separately normalized-row determinant=${format(observer.scaledDet)}. Magnitude exceeds10⁻⁹: numerical rank2.`));
    rowStep.append(button(secondRow ? 'Hide second row' : 'Construct CA_d and check rank', 'row'));
    const predict = element('section'); predict.append(element('h3', '3. Predict the predictor gain L_d'));
    const inputs = element('div'); inputs.className = 'sampled-observer-controls'; numeric(inputs, 'Your l₁', 'l1', attempts.l1); numeric(inputs, 'Your l₂', 'l2', attempts.l2);
    const attemptFeedback = element('div'); attemptFeedback.dataset.attemptFeedback = ''; attemptFeedback.setAttribute('role', 'status');
    predict.append(inputs, button('Check my predictor gain', 'check'), button('Check quoted S15 rounded gain', 'quote'), button(revealed ? 'Hide checked derivation' : 'Reveal checked derivation', 'reveal'), element('p', 'Quoted S15 gain [1.023568;1.498984] belongs to the common ZOH baseline. Checking it here uses your current model; a rounded gain can have different actual roots.'), attemptFeedback); view.append(model, rowStep, predict);
    if (revealed) {
      const derivation = element('section'); derivation.append(element('h3', '4. Match coefficients and verify actual modes'),
        createEquationDisplay(`q_o(z)=z^2+(${tex(observer.target[0])})z+(${tex(observer.target[1])})`, 'Desired discrete observer polynomial'),
        createEquationDisplay(String.raw`CL_d=\operatorname{tr}(A_d)+d_1,\quad C\operatorname{adj}(A_d)L_d=\det(A_d)-d_0`, 'Sampled observer coefficient matching'),
        createEquationDisplay(`${matrix(observer.matching, 2)}${matrix(observer.L, 1)}=${matrix(observer.rhs, 1)}`, 'Substituted matching equations'),
        createEquationDisplay(`L_d=${matrix(observer.L, 1)},\\quad A_d-L_dC=${matrix(observer.closed, 2)}`, 'Checked predictor gain and error matrix'),
        createEquationDisplay(`\\det(zI-(A_d-L_dC))=z^2+(${tex(observer.actual[0])})z+(${tex(observer.actual[1])})`, 'Actual predictor error polynomial'), element('p', `Actual error modes: ${modes(run.errorPoles)}. Scaled monic coefficient residual=${format(observer.residual)}. Each target is strictly inside the unit circle at the declared Schur margin.`));
      const order = element('section'); order.append(element('h3', '5. Read, correct, control and advance'), createEquationDisplay(String.raw`\varepsilon[k]=y_m[k]-Cp[k],\quad e[k]=x[k]-\hat x[k]`, 'Measured innovation and displayed estimation error'));
      if (run.correction) order.append(
        element('p', 'Current timing: first read y_m[k], then correct the prior p[k] to form x̂[k]. Compute u[k] from that corrected estimate, advance the true plant with that u[k], then predict p[k+1]. The k=0 estimate already includes the first measurement; the initial input is a prior.'),
        createEquationDisplay(String.raw`\hat x[k]=p[k]+M\varepsilon[k],\quad p[k+1]=A_d\hat x[k]+B_du[k],\quad A_dM=L_d`, 'Current correction and next prediction'),
        createEquationDisplay(`M=${matrix(run.correction.M, 1)},\\quad A_d(I-MC)=${matrix(run.errorMatrix, 2)}`, 'Current gain and prior-error matrix'),
        createEquationDisplay(`(I-MC)A_d=${matrix(run.correctedErrorMatrix, 2)}`, 'Corrected-error matrix'), element('p', `Prior and corrected error matrices have the same target modes; they differ as state maps. Gain-conversion residual=${format(run.correction.residual)}. Do not substitute L_d for M.`));
      else order.append(element('p', 'Predictor timing: x̂[k]=p[k] is available before reading y_m[k]. Read innovation, compute u[k] from p[k], advance plant, and use this sample’s measured innovation only in p[k+1]. The estimate at k=0 equals the supplied prior.'),
        createEquationDisplay(String.raw`\hat x[k]=p[k],\quad p[k+1]=A_dp[k]+B_du[k]+L_d\varepsilon[k]`, 'Predictor update'), createEquationDisplay(String.raw`e[k+1]=(A_d-L_dC)e[k]-L_dn[k]`, 'Predictor estimation error recurrence'));
      order.append(element('p', 'Only the scalar measured output and known applied input drive the estimator. True state is simulated separately for comparison. Persistent measurement noise can leave error even with Schur error modes.'));
      const connection = element('section'); connection.append(element('h3', '6. Check estimated-state feedback'));
      if (feedback) connection.append(createEquationDisplay(`u[k]=-K_d\\hat x[k]+Nr[k],\\quad K_d=${matrix(feedback.K, 2)},\\quad N=${tex(run.referenceGain)}`, 'Estimated-state negative feedback and reference gain'), createEquationDisplay(`A_d-B_dK_d=${matrix(feedback.closed, 2)}`, 'Actual controller matrix'),
        element('p', feedback.prefilter === null ? `No supported unity-tracking prefilter (DC gain ${feedback.dcGain === null ? 'solve unavailable' : format(feedback.dcGain)}). N=1 is used without a unity-tracking claim.` : 'N corrects ideal constant-reference tracking when the model is exact, the estimate converges and measurement disturbance vanishes. It does not remove persistent noise.'));
      else connection.append(element('p', `Observer-only: known constant input u[k]=${format(applied.heldInput)} drives plant and estimator. An observer alone does not stabilize an unstable plant.`));
      connection.append(element('p', `${feedback ? 'Controller' : 'Open plant'} modes: ${modes(run.plantPoles)}. All 4 plant/observer homogeneous modes: ${modes(run.allPoles)}.`), element('p', 'In true-state/prior-error coordinates the combined dynamics are block triangular. The selected timing changes the coupling, while these complete diagonal spectra remain visible. Prescribed noise is an external input.'));
      const simulation = element('section'); simulation.append(element('h3', '7. Compare discrete signals'), element('p', `Timing: ${applied.timing}. All ${applied.steps + 1} samples are computed by the declared recurrence. Stems/markers show sample values only; there is no interpolation claim. State RMS values are reported separately in model units.`));
      if (run.aliasedNoise) simulation.append(element('p', 'Noise sampling warning: ωT≥π. These samples alias a continuous sinusoid; they do not recover its between-sample waveform.'));
      const axisControl = choice(simulation, 'Horizontal axis', 'axis', [['samples', 'Sample index k'], ['seconds', 'Time t (s)']]); axisControl.value = axisSeconds ? 'seconds' : 'samples';
      const plots = element('div'); plots.className = 'sampled-observer-plots';
      for (const i of [0, 1]) plots.append(plot(`State x${i ? '₂' : '₁'} and estimate (state ${i + 1} units)`, [{ label: 'Dashed/open: simulated truth', values: run.samples.map(s => s.x[i]), style: 'sampled-observer-reference' }, { label: 'Solid: selected estimate', values: run.samples.map(s => s.estimate[i]), style: 'sampled-observer-current' }], axisSeconds));
      plots.append(plot('Output channels (output units)', [{ label: 'Dashed/open: clean y', values: run.samples.map(s => s.cleanOutput), style: 'sampled-observer-reference' }, { label: 'Dotted: measured yₘ', values: run.samples.map(s => s.measuredOutput), style: 'sampled-observer-secondary' }, { label: 'Solid: estimated ŷ', values: run.samples.map(s => s.estimatedOutput), style: 'sampled-observer-current' }], axisSeconds), plot('Read innovation ε (output units)', [{ label: 'Solid: yₘ−Cp before correction', values: run.samples.map(s => s.innovation), style: 'sampled-observer-current' }], axisSeconds));
      for (const i of [0, 1]) plots.append(plot(`Estimation error e${i ? '₂' : '₁'} (state ${i + 1} units)`, [{ label: 'Solid: displayed estimate error', values: run.samples.map(s => s.error[i]), style: 'sampled-observer-current' }], axisSeconds));
      plots.append(plot('Applied control u[k] (input units)', [{ label: 'Solid: held on next sample interval', values: run.samples.map(s => s.effort), style: 'sampled-observer-current' }], axisSeconds)); simulation.append(plots);
      const inspect = element('div'); inspect.className = 'sampled-observer-actions'; const sampleInput = numeric(inspect, 'Inspect sample k', 'inspectSample', String(selected)); sampleInput.step = '1'; inspect.append(button('Inspect sample', 'sample')); simulation.append(inspect);
      const table = element('table'); table.append(element('caption', `Sample k=${selected}, t=${format(run.samples[selected].t)}s; T=${format(applied.period)}s. Values in the model’s signal units.`));
      const header = element('tr'); ['Signal / finite-horizon statistic', 'Current experiment'].forEach(t => header.append(element('th', t))); table.append(header);
      const s = run.samples[selected], rows: [string, number][] = [['True x₁',s.x[0]],['Prior p₁',s.prior[0]],['Estimated x̂₁',s.estimate[0]],['Error e₁',s.error[0]],['True x₂',s.x[1]],['Prior p₂',s.prior[1]],['Estimated x̂₂',s.estimate[1]],['Error e₂',s.error[1]],['Prior error x₁−p₁',s.priorError[0]],['Prior error x₂−p₂',s.priorError[1]],['Clean output y',s.cleanOutput],['Measured output yₘ',s.measuredOutput],['Estimated output ŷ',s.estimatedOutput],['Measurement noise n',s.noise],['Read innovation ε',s.innovation],['Control effort u',s.effort],['Sample RMS e₁',run.rmsError[0]],['Sample RMS e₂',run.rmsError[1]],['Sample peak |u|',run.peakEffort]];
      for (const [label, value] of rows) { const row = element('tr'), heading = element('th', label); heading.scope = 'row'; row.append(heading, element('td', format(value))); table.append(row); }
      const scroll = element('div'); scroll.className = 'sampled-observer-sample-table'; scroll.tabIndex = 0; scroll.setAttribute('role', 'region'); scroll.setAttribute('aria-label', 'Sampled observer numeric table; scroll horizontally'); scroll.append(table); simulation.append(scroll);
      view.append(derivation, order, connection, simulation);
    }
    if (active && !active.isConnected) {
      const replacement = action ? Array.from(view.querySelectorAll<HTMLButtonElement>('button[data-action]')).find(b => b.dataset.action === action) : Array.from(view.querySelectorAll<HTMLInputElement | HTMLSelectElement>('input[name],select[name]')).find(i => i.name === name);
      replacement?.focus({ preventScroll: true });
    }
  }
  let discreteB: Vector;
  function apply(): void {
    const drafts = editors.map(e => e.getValue());
    if (drafts.slice(0, connected.checked ? 5 : 4).some(d => d.empty || d.hasPlaceholders || d.syntaxIssues.length)) throw new Error('Complete the model matrices and required target fields, including all boxes and notation.');
    const A = parseMatrix(drafts[0].latex, 2, 2, 'A') as unknown as Matrix, B = parseMatrix(drafts[1].latex, 2, 1, 'B') as unknown as Vector, C = parseMatrix(drafts[2].latex, 1, 2, 'C') as unknown as Vector;
    const T = readNumericInput(period, 'sample period'); validatePeriod(T);
    const model = modelKind.value === 'zoh' ? zoh(A, B, T) : { A, B };
    const o = designObserver(model.A, C, parseTarget(drafts[3].latex)), f = connected.checked ? designFeedback(model.A, model.B, C, parseTarget(drafts[4].latex)) : undefined;
    const read = (input: HTMLInputElement, label: string) => readNumericInput(input, label);
    const options: Options = { initial: [read(x1, 'true x₁[0]'), read(x2, 'true x₂[0]')], prior: [read(prior1, 'initial prior p₁'), read(prior2, 'initial prior p₂')], heldInput: connected.checked ? 0 : read(held, 'known input'), reference: connected.checked ? read(reference, 'reference') : 0, noiseAmplitude: read(amplitude, 'noise amplitude'), noiseFrequency: read(frequency, 'noise frequency'), noisePhase: read(phase, 'noise phase'), period: T, steps: read(steps, 'sample horizon'), timing: timing.value as Options['timing'] };
    const nextRun = simulate(o, model.B, options, f);
    observer = o; feedback = f; run = nextRun; applied = options; discreteB = model.B;
    modelNote = modelKind.value === 'zoh' ? 'Continuous A/B converted using one ZOH with the entered T. Full computed precision drives the design; displayed matrices are rounded. Period edits recompute the model and redesign fixed z-targets.' : 'Direct discrete mode: entered A/B are A_d/B_d and are not discretized again. Printed rounded source data remain the data being solved; T labels time/noise sampling only.';
    secondRow = false; revealed = false; selected = 0; attempts.l1 = ''; attempts.l2 = ''; render(); status.textContent = 'Experiment applied. Build observability, predict L_d, then reveal and inspect the chosen timing.';
  }
  function checkCandidate(): void {
    const first = readNumericInput(view.querySelector<HTMLInputElement>('input[name="l1"]')!, 'your l₁'), second = readNumericInput(view.querySelector<HTMLInputElement>('input[name="l2"]')!, 'your l₂');
    if (Math.abs(first) > 1e6 || Math.abs(second) > 1e6) throw new Error('Candidate gain entries must have magnitude≤10⁶.');
    const [a,b,c,d] = observer.A, [c1,c2] = observer.C, closed: Matrix = [a-first*c1,b-first*c2,c-second*c1,d-second*c2], actual = characteristic(closed);
    const matches = (x: number, y: number) => y === 0 ? x === 0 : Math.abs(x-y) <= 1e-7*Math.abs(y), result = view.querySelector('[data-attempt-feedback]')!;
    result.replaceChildren(element('p', matches(first,observer.L[0]) && matches(second,observer.L[1]) ? 'Matches the full-precision predictor gain at relative tolerance10⁻⁷.' : 'Differs from the full-precision predictor gain at relative tolerance10⁻⁷. Check matching and rounding.'), createEquationDisplay(`A_d-L_{\\mathrm{candidate}}C=${matrix(closed,2)}`, 'Candidate actual predictor error matrix'), element('p', `Candidate actual modes: ${modes(quadratic(actual))}. Coefficient differences from target: ${actual.map((v,i)=>format(v-observer.target[i])).join('; ')}. This check does not change the applied observer.`));
  }
  function baseline(): void {
    editors.forEach((e, i) => e.setValue(INITIAL[i]));
    for (const [input,value] of [[x1,'1'],[x2,'0'],[prior1,'0'],[prior2,'0'],[held,'0'],[reference,'1'],[period,'.1'],[steps,'100'],[amplitude,'0'],[frequency,'20'],[phase,'0']] as const) input.value=value;
    modelKind.value='zoh';timing.value='predictor';connected.checked=false;axisSeconds=false;syncMode();
  }
  root.addEventListener('input', event => { const input=event.target; if(input instanceof HTMLInputElement && (input.name==='l1'||input.name==='l2')) { attempts[input.name]=input.value; view.querySelector('[data-attempt-feedback]')?.replaceChildren(); } }, {signal});
  view.addEventListener('change', event => { const select=event.target; if(select instanceof HTMLSelectElement && select.name==='axis'){axisSeconds=select.value==='seconds';render();} }, {signal});
  root.addEventListener('click', event => {
    const action=(event.target as Element).closest<HTMLButtonElement>('button[data-action]')?.dataset.action;if(!action)return;
    const variations=['baseline','velocity','faster','complex','noise','rounded'];
    try {
      if(action==='apply')apply();
      else if(variations.includes(action)){
        if(action==='baseline'||action==='rounded')baseline();
        if(action==='velocity')editors[2].setValue(String.raw`C=\begin{bmatrix}0&1\end{bmatrix}`);
        if(action==='faster')editors[3].setValue('q(z)=(z-0.1)(z-0.2)');
        if(action==='complex')editors[3].setValue('q(z)=(z-0.4)^2+0.09');
        if(action==='noise'){amplitude.value='.05';frequency.value='20';}
        if(action==='rounded'){
          modelKind.value='direct';editors[0].setValue(String.raw`A=\begin{bmatrix}.967&.148\\-.297&.522\end{bmatrix}`);editors[1].setValue(String.raw`B=\begin{bmatrix}.231\\.264\end{bmatrix}`);editors[2].setValue(String.raw`C=\begin{bmatrix}1&3\end{bmatrix}`);editors[3].setValue('q(z)=(z-0.13)(z-0.36)');
        }
        invalidate();apply();if(action==='rounded')status.textContent='Rounded CH9:57 source matrices applied as given discrete data. The audit-derived gain is a computation from printed numbers; later solution slides were not reinspected.';
      } else if(action==='row'){secondRow=!secondRow;render();}
      else if(action==='reveal'){revealed=!revealed;render();}
      else if(action==='check')checkCandidate();
      else if(action==='quote'){attempts.l1='1.023568';attempts.l2='1.498984';render();checkCandidate();}
      else if(action==='sample'){
        const value=readNumericInput(view.querySelector<HTMLInputElement>('input[name="inspectSample"]')!,'inspection sample');if(!Number.isInteger(value)||value<0||value>applied.steps)throw new Error('Inspection sample must be an integer inside the horizon.');selected=value;render();
      }
    }catch(error){if(action==='apply'||variations.includes(action))view.replaceChildren();status.textContent=error instanceof Error?error.message:'Check sampled observer inputs.';}
  }, {signal});
  view.addEventListener('keydown',event=>{if(event.key==='Enter'&&(event.target as HTMLInputElement).name==='inspectSample'){event.preventDefault();view.querySelector<HTMLButtonElement>('button[data-action="sample"]')?.click();}}, {signal});
  try{apply();}catch(error){status.textContent=error instanceof Error?error.message:'Check the model.';}
  return()=>{editors.forEach(e=>e.destroy());root.remove();};
};
