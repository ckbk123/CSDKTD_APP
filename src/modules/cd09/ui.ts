import type { ModuleMount } from '../../core/module';
import { createEquationDisplay, createEquationInput, type EquationInput } from '../../shared/equations/input';
import { readNumericInput } from '../../shared/numeric-input';
import { designFeedback, designObserver, simulate, type Complex, type Feedback, type Matrix, type Observer, type Options, type Run, type Vector } from './math';
import { parseMatrix, parseTarget } from './parser';
import './style.css';

const INITIAL = [String.raw`A=\begin{bmatrix}0&1\\-2&-3\end{bmatrix}`, String.raw`B=\begin{bmatrix}0\\1\end{bmatrix}`, String.raw`C=\begin{bmatrix}1&0\end{bmatrix}`, 'q(s)=(s+6)(s+7)', 'q(s)=(s+2)(s+4)'] as const;
const element = <K extends keyof HTMLElementTagNameMap>(tag: K, text?: string): HTMLElementTagNameMap[K] => { const e = document.createElement(tag); if (text !== undefined) e.textContent = text; return e; };
const plain = (v: number) => v === 0 ? '0' : Number(v.toPrecision(7)).toString();
const format = (v: number) => plain(v).replace(/e([+-]?\d+)/, (_, power: string) => ` × 10^${Number(power)}`);
const tex = (v: number) => { const [a, b] = plain(v).split('e'); return b === undefined ? a : `${a}\\times10^{${Number(b)}}`; };
const axis = (v: number) => v === 0 ? '0' : Math.abs(v) < .001 || Math.abs(v) >= 10000 ? v.toExponential(1) : Number(v.toPrecision(3)).toString();
const matrix = (a: readonly number[], columns: number) => `\\begin{bmatrix}${a.map((v, i) => tex(v) + (i === a.length - 1 ? '' : (i + 1) % columns ? '&' : '\\\\')).join('')}\\end{bmatrix}`;
const modes = (poles: readonly Complex[]) => poles.map(([re, im]) => `${format(re)}${im ? ` ${im < 0 ? '−' : '+'} j ${format(Math.abs(im))}` : ''}`).join('; ');
const button = (label: string, action: string) => { const b = element('button', label); b.type = 'button'; b.dataset.action = action; return b; };
function svgElement(tag: string, attributes: Record<string, string | number>, text?: string): SVGElement {
  const e = document.createElementNS('http://www.w3.org/2000/svg', tag); Object.entries(attributes).forEach(([k, v]) => e.setAttribute(k, String(v))); if (text !== undefined) e.textContent = text; return e;
}

export const mount: ModuleMount = ({ container, signal }) => {
  const root = element('div'); root.className = 'observer-tool'; container.append(root);
  let observer: Observer, feedback: Feedback | undefined, current: Run, comparison: Run | undefined, applied: Options;
  let secondRow = false, revealed = false, selectedTime = 0, comparisonNote = '';
  const attempts = { l1: '', l2: '' }, editors: EquationInput[] = [];
  const view = element('div'), status = element('p'); status.setAttribute('role', 'status');
  const invalidate = () => { revealed = false; view.replaceChildren(); status.textContent = 'Data changed. Apply the experiment to recompute the observer.'; };
  const intro = element('section'); intro.append(element('h3', 'Estimate two states from one measured output'), element('p', 'Construct observability, predict the observer gain, and compare simulated truth with estimates formed from the measured output and known input. Then connect estimated-state feedback or add measurement noise.'));
  intro.append(createEquationDisplay(String.raw`\dot x=Ax+Bu,\quad y=Cx,\quad y_m=y+n,\quad D=0`, 'Plant truth and single measured output'));
  const editorGrid = element('div'); editorGrid.className = 'observer-inputs';
  for (const [i, label] of ['State matrix A (2 by 2)', 'Input column B (2 by 1)', 'Sensor row C (1 by 2)', 'Observer target polynomial', 'Feedback target polynomial (used when connected)'].entries()) {
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
  const initialControls = element('fieldset'); initialControls.append(element('legend', 'Independent initial state and estimate'));
  const initialRow = element('div'); initialRow.className = 'observer-controls'; initialControls.append(initialRow);
  const x1 = numeric(initialRow, 'True x₁(0)', 'initial1', '1'), x2 = numeric(initialRow, 'True x₂(0)', 'initial2', '0');
  const hat1 = numeric(initialRow, 'Estimate x̂₁(0)', 'estimate1', '0'), hat2 = numeric(initialRow, 'Estimate x̂₂(0)', 'estimate2', '0');
  const experimentControls = element('fieldset'); experimentControls.append(element('legend', 'Input, feedback and measurement experiment'));
  const connectedLabel = element('label', 'Connect estimated-state feedback '), connected = element('input'); connected.type = 'checkbox'; connected.name = 'feedback'; connectedLabel.append(connected); experimentControls.append(connectedLabel);
  const controlRow = element('div'); controlRow.className = 'observer-controls'; experimentControls.append(controlRow);
  const held = numeric(controlRow, 'Known held input u (observer only)', 'heldInput', '0'), reference = numeric(controlRow, 'Held reference r (feedback)', 'reference', '1'); reference.disabled = true;
  const amplitude = numeric(controlRow, 'Noise amplitude (output units)', 'amplitude', '0'), frequency = numeric(controlRow, 'Noise frequency ω (rad/s)', 'frequency', '20'), phase = numeric(controlRow, 'Noise phase (rad)', 'phase', '0');
  const tau = numeric(controlRow, 'Innovation-filter τ (s; 0 = off)', 'tau', '0'), horizon = numeric(controlRow, 'Plot horizon (s)', 'horizon', '5');
  const syncMode = () => { held.disabled = connected.checked; reference.disabled = !connected.checked; };
  for (const controls of [initialControls, experimentControls]) controls.addEventListener('input', () => { syncMode(); invalidate(); }, { signal });
  const actions = element('div'); actions.className = 'observer-actions'; actions.append(button('Apply experiment', 'apply'), button('Try velocity sensor', 'velocity'), button('Try faster observer −12, −14', 'faster'), button('Try conjugate observer −4 ± 3j', 'complex'), button('Try measurement noise', 'noise'), button('Try filtered innovation', 'filter'), button('Try authored unstable-filter example', 'unstable'), button('Restore course model', 'baseline'));
  const limits = element('details'); limits.append(element('summary', 'Supported model, units and numerical limits'),
    element('p', 'Real continuous two-state SISO: A2×2, B2×1, C1×2, D=0, state columns. The observer uses only measured scalar yₘ and known input u; true x is available only for this simulation’s comparisons. Independent initial states/estimates are editable. Matrix cells accept literal decimals or signed numeric fractions. Targets are real monic quadratic polynomials in s, with both coefficients positive. Expanded/factored forms, repeated and conjugate roots work. Visual e/E literals, hidden algebraic braces and mixed-number adjacency are unsupported.'),
    element('p', 'Time is in seconds, noise frequency in rad/s and phase in radians; other units follow the supplied model. Noise is the prescribed deterministic input n(t)=a sin(ωt+φ), not a random/Kalman model. Filtering is applied to the innovation, not to simulated truth. τ>0 adds a state and changes the actual error poles; the filter is initialized from measured innovation at t=0.'),
    element('p', 'Matrix entries ≤1000; target coefficients ≤10,000; gain ≤10⁶; closed two-state entries ≤10⁴. Rank and matching use separately normalized rows, determinant threshold10⁻⁹; actual two-state coefficients require relative error≤10⁻⁹. Initial state/estimate and input/reference/noise controls have magnitude≤100, with nonnegative amplitude/frequency. τ is0 or0.001–10s; horizon0.1–50s; 401 numerical samples, finite response magnitude≤10⁸.'),
    element('p', 'Equations ≤600 characters; target ≤120 tokens, nesting≤12; scalar fraction nesting≤8; literal decimals≤12 fractional places/8 integer digits. Responses use a bounded7/8-state matrix exponential (24 Taylor terms, 30 scaling steps, reduced norm≤0.5, term tolerance10⁻¹⁶). Cubic mode checks use normalized polynomial residual10⁻⁹ and coefficient backward error10⁻⁸; nearly repeated roots can be sensitive. Error stability uses real-part tolerance10⁻⁹ times max(1,mode magnitude). Coarse sampling is warned about; endpoints and sampled RMS are not settling proofs.'));
  intro.append(editorGrid, initialControls, experimentControls, actions, status, limits); root.append(intro, view);

  function plot(title: string, lines: { label: string; values: number[]; style: string }[]): HTMLElement {
    const figure = element('figure'); figure.append(element('figcaption', title));
    const values = lines.flatMap(line => line.values); let low = Math.min(0, ...values), high = Math.max(0, ...values); if (low === high) { low--; high++; }
    const padding = (high - low) * .1; low -= padding; high += padding;
    const duration = applied.horizon, X = (i: number) => 88 + 385 * i / (current.samples.length - 1), Y = (y: number) => 185 - 155 * (y - low) / (high - low);
    const svg = svgElement('svg', { viewBox: '0 0 500 225', role: 'img', 'aria-label': `${title}. ${lines.map(line => line.label).join('; ')}. Time0 to${duration} seconds. Values in the sample table.` });
    svg.append(svgElement('line', { x1: 88, x2: 478, y1: 185, y2: 185, class: 'observer-axis' }), svgElement('line', { x1: 88, x2: 88, y1: 25, y2: 185, class: 'observer-axis' }), svgElement('text', { x: 83, y: 30, 'text-anchor': 'end' }, axis(high)), svgElement('text', { x: 83, y: 185, 'text-anchor': 'end' }, axis(low)), svgElement('text', { x: 88, y: 204 }, '0'), svgElement('text', { x: 465, y: 204 }, format(duration)), svgElement('text', { x: 235, y: 219 }, 'Time t (s)'));
    const index = Math.round(selectedTime / duration * (current.samples.length - 1));
    for (const line of lines) {
      svg.append(svgElement('path', { d: line.values.map((v, i) => `${i ? 'L' : 'M'}${X(i).toFixed(3)},${Y(v).toFixed(3)}`).join(' '), class: line.style }), svgElement('circle', { cx: X(index), cy: Y(line.values[index]), r: 3, class: 'observer-marker' }));
    }
    figure.append(svg, element('p', lines.map(line => line.label).join(' · '))); return figure;
  }
  function render(): void {
    if (signal.aborted) return;
    const active = document.activeElement instanceof HTMLElement && view.contains(document.activeElement) ? document.activeElement : null;
    const action = active?.dataset.action, name = active instanceof HTMLInputElement ? active.name : undefined;
    view.replaceChildren();
    const rowStep = element('section'); rowStep.append(element('h3', '1. Build observability, one row at a time'), createEquationDisplay(`C=${matrix(observer.C, 2)}`, 'First observability row'));
    if (secondRow) rowStep.append(createEquationDisplay(`CA=${matrix(observer.observability.slice(2), 2)},\\quad\\mathcal O=${matrix(observer.observability, 2)}`, 'Second row and complete observability matrix'), element('p', `After separately normalizing both rows: determinant=${format(observer.scaledDet)}. Its magnitude exceeds10⁻⁹, so the declared numerical rank is2.`));
    rowStep.append(button(secondRow ? 'Hide second row' : 'Construct CA and check rank', 'row'));
    const predict = element('section'); predict.append(element('h3', '2. Predict the nominal observer gain'));
    const inputs = element('div'); inputs.className = 'observer-controls'; numeric(inputs, 'Your l₁', 'l1', attempts.l1); numeric(inputs, 'Your l₂', 'l2', attempts.l2);
    const attemptFeedback = element('p'); attemptFeedback.dataset.attemptFeedback = ''; attemptFeedback.setAttribute('role', 'status');
    predict.append(inputs, button('Check my observer gain', 'check'), button(revealed ? 'Hide checked derivation' : 'Reveal checked derivation', 'reveal'), attemptFeedback); view.append(rowStep, predict);
    if (revealed) {
      const derivation = element('section'); derivation.append(element('h3', '3. Match coefficients and verify A−LC'), element('p', 'This is the nominal observer, before adding an innovation filter.'),
        createEquationDisplay(`q_o(s)=s^2+(${tex(observer.target[0])})s+(${tex(observer.target[1])})`, 'Desired observer polynomial'),
        createEquationDisplay(String.raw`CL=\operatorname{tr}(A)+d_1,\quad C\operatorname{adj}(A)L=\det(A)-d_0`, 'Observer coefficient matching'),
        createEquationDisplay(`${matrix(observer.matching, 2)}${matrix(observer.L, 1)}=${matrix(observer.rhs, 1)}`, 'Substituted observer matching equations'),
        createEquationDisplay(`L=${matrix(observer.L, 1)},\\quad A-LC=${matrix(observer.closed, 2)}`, 'Checked observer gain and actual nominal error matrix'),
        createEquationDisplay(`\\det(sI-(A-LC))=s^2+(${tex(observer.actual[0])})s+(${tex(observer.actual[1])})`, 'Actual nominal observer polynomial'),
        element('p', `Actual nominal error modes: ${modes(observer.poles)}. Relative coefficient residual=${format(observer.residual)}.`));
      const estimator = element('section'); estimator.append(element('h3', '4. Use the measured output, not simulated truth'),
        createEquationDisplay(String.raw`y_m=Cx+n,\quad \hat y=C\hat x,\quad \varepsilon=y_m-\hat y,\quad e=x-\hat x`, 'Measurement, innovation and estimation error'),
        createEquationDisplay(applied.filterTau ? String.raw`\tau\dot\nu=\varepsilon-\nu,\quad\dot{\hat x}=A\hat x+Bu+L\nu` : String.raw`\dot{\hat x}=A\hat x+Bu+L\varepsilon,\quad\dot e=(A-LC)e-Ln`, 'Implemented estimator equations'),
        element('p', 'The true state is simulated for comparison. The estimator is driven by the one measured output and known input. Noise is an external prescribed input; a stable homogeneous error model does not imply zero error under persistent noise.'));
      if (applied.filterTau) estimator.append(createEquationDisplay(`M_\\tau=${matrix(current.errorMatrix, 3)}`, 'Actual filtered error and innovation matrix'),
        createEquationDisplay(`p_\\tau(s)=s^3+(${tex(current.errorPolynomial[0])})s^2+(${tex(current.errorPolynomial[1])})s+(${tex(current.errorPolynomial[2])})`, 'Actual three-mode filter polynomial'),
        element('p', `The filter adds a third error state. Its initial value equals measured innovation at t=0. The nominal target pair alone does not describe this filtered experiment. ${comparisonNote}`));
      estimator.append(element('p', `Current error/filter modes: ${modes(current.errorPoles)}. Homogeneous error dynamics: ${current.errorStability} at the declared tolerance.`));
      const connection = element('section'); connection.append(element('h3', '5. Check the complete plant and estimator connection'));
      if (feedback) connection.append(createEquationDisplay(`u=-K\\hat x+Nr,\\quad K=${matrix(feedback.K, 2)},\\quad N=${tex(current.referenceGain)}`, 'Estimated-state feedback and reference gain'),
        createEquationDisplay(`A-BK=${matrix(feedback.closed, 2)}`, 'Actual controller matrix'),
        element('p', feedback.prefilter === null ? `No supported unity-tracking prefilter (${feedback.dcGain === null ? 'DC solve is poorly conditioned' : `DC gain=${format(feedback.dcGain)}`}). This experiment uses N=1 and makes no unity-tracking claim.` : `With exact state estimates and no measurement disturbance, N=${format(feedback.prefilter)} gives ideal constant-reference tracking. Estimator/filter stability and persistent noise still determine whether this experiment converges.`));
      else connection.append(element('p', `Observer-only experiment: the same known constant input u=${format(applied.heldInput)} drives the plant and estimator. Designing an observer alone does not stabilize the plant.`));
      connection.append(element('p', `${feedback ? 'Actual controller' : 'Open plant'} modes: ${modes(current.plantPoles)}. All ${current.allPoles.length} plant/observer/filter homogeneous modes: ${modes(current.allPoles)}.`), element('p', 'The complete spectrum follows from block-triangular dynamics in true-state/error coordinates. Prescribed noise is an external forcing; its simulation oscillator is not counted as a plant or estimator mode.'));
      const simulation = element('section'); simulation.append(element('h3', '6. Compare truth, estimate, innovation and effort'), element('p', `Current experiment: ${applied.filterTau ? `innovation filter τ=${format(applied.filterTau)}s` : 'unfiltered observer'}. ${comparison ? 'Error and effort comparisons include a separate unfiltered run with the same initial states, input/reference and prescribed noise. Each run retains its own plant truth.' : ''} Lines are numerical samples. State-component RMS values are reported separately in their model units; no finite horizon is declared settled.`));
      if (current.coarse || comparison?.coarse) simulation.append(element('p', `Sampling warning: Δt=${format(current.step)}s is coarse relative to a mode or noise frequency. Shorten the horizon to resolve peaks/oscillations. Pole calculations are separate from the sampled curves.`));
      const plots = element('div'); plots.className = 'observer-plots';
      for (const i of [0, 1]) plots.append(plot(`State x${i ? '₂' : '₁'} and estimate (state ${i + 1} units)`, [{ label: 'Dashed: simulated truth', values: current.samples.map(s => s.x[i]), style: 'observer-reference' }, { label: 'Solid: estimate', values: current.samples.map(s => s.estimate[i]), style: 'observer-current' }]));
      plots.append(plot('Output channels (output units)', [{ label: 'Dashed: clean y', values: current.samples.map(s => s.cleanOutput), style: 'observer-reference' }, { label: 'Dotted: measured yₘ', values: current.samples.map(s => s.measuredOutput), style: 'observer-secondary' }, { label: 'Solid: estimated ŷ', values: current.samples.map(s => s.estimatedOutput), style: 'observer-current' }]),
        plot('Innovation and injected signal (output units)', [{ label: 'Dashed: raw innovation ε', values: current.samples.map(s => s.innovation), style: 'observer-reference' }, { label: 'Solid: injected signal ν', values: current.samples.map(s => s.injection), style: 'observer-current' }]));
      for (const i of [0, 1]) plots.append(plot(`Estimation error e${i ? '₂' : '₁'} (state ${i + 1} units)`, [{ label: 'Solid: current experiment', values: current.samples.map(s => s.error[i]), style: 'observer-current' }, ...(comparison ? [{ label: 'Dashed: unfiltered run', values: comparison.samples.map(s => s.error[i]), style: 'observer-reference' }] : [])]));
      plots.append(plot('Control effort u (input units)', [{ label: 'Solid: current experiment', values: current.samples.map(s => s.effort), style: 'observer-current' }, ...(comparison ? [{ label: 'Dashed: unfiltered run', values: comparison.samples.map(s => s.effort), style: 'observer-reference' }] : [])])); simulation.append(plots);
      const inspect = element('div'); inspect.className = 'observer-actions'; numeric(inspect, 'Inspect time (s)', 'inspectTime', String(selectedTime)); inspect.append(button('Inspect nearest sample', 'time')); simulation.append(inspect);
      const index = Math.round(selectedTime / applied.horizon * (current.samples.length - 1)), table = element('table'); table.append(element('caption', `Nearest sample t=${format(current.samples[index].t)}s; 401 points. Values use the model’s signal units.`));
      const header = element('tr'); ['Signal / finite-horizon statistic', 'Current experiment', ...(comparison ? ['Unfiltered run'] : [])].forEach(t => header.append(element('th', t))); table.append(header);
      const rows: [string, (run: Run) => number][] = [
        ['True x₁', r => r.samples[index].x[0]], ['Estimated x̂₁', r => r.samples[index].estimate[0]], ['Error e₁', r => r.samples[index].error[0]], ['True x₂', r => r.samples[index].x[1]], ['Estimated x̂₂', r => r.samples[index].estimate[1]], ['Error e₂', r => r.samples[index].error[1]],
        ['Clean output y', r => r.samples[index].cleanOutput], ['Measured output yₘ', r => r.samples[index].measuredOutput], ['Estimated output ŷ', r => r.samples[index].estimatedOutput], ['Measurement noise n', r => r.samples[index].noise], ['Raw innovation ε', r => r.samples[index].innovation], ['Injected signal ν', r => r.samples[index].injection], ['Control effort u', r => r.samples[index].effort], ['Sample RMS e₁', r => r.rmsError[0]], ['Sample RMS e₂', r => r.rmsError[1]], ['Sample peak |u|', r => r.peakEffort],
      ];
      for (const [label, read] of rows) { const row = element('tr'), heading = element('th', label); heading.scope = 'row'; row.append(heading, element('td', format(read(current)))); if (comparison) row.append(element('td', format(read(comparison)))); table.append(row); }
      const scroll = element('div'); scroll.className = 'observer-sample-table'; scroll.tabIndex = 0; scroll.setAttribute('role', 'region'); scroll.setAttribute('aria-label', 'Observer sample table; scroll horizontally for all columns'); scroll.append(table); simulation.append(scroll);
      view.append(derivation, estimator, connection, simulation);
    }
    if (active && !active.isConnected) {
      const replacement = action ? Array.from(view.querySelectorAll<HTMLButtonElement>('button[data-action]')).find(b => b.dataset.action === action) : Array.from(view.querySelectorAll<HTMLInputElement>('input[name]')).find(i => i.name === name);
      replacement?.focus({ preventScroll: true });
    }
  }
  function apply(): void {
    const drafts = editors.map(e => e.getValue());
    if (drafts.slice(0, connected.checked ? 5 : 4).some(d => d.empty || d.hasPlaceholders || d.syntaxIssues.length)) throw new Error('Complete A, B, C and the required target polynomials; fill boxes and correct notation.');
    const A = parseMatrix(drafts[0].latex, 2, 2, 'A') as unknown as Matrix, B = parseMatrix(drafts[1].latex, 2, 1, 'B') as unknown as Vector, C = parseMatrix(drafts[2].latex, 1, 2, 'C') as unknown as Vector;
    const nextObserver = designObserver(A, C, parseTarget(drafts[3].latex)), nextFeedback = connected.checked ? designFeedback(A, B, C, parseTarget(drafts[4].latex)) : undefined;
    const read = (input: HTMLInputElement, label: string) => readNumericInput(input, label);
    const options: Options = { initial: [read(x1, 'true x₁(0)'), read(x2, 'true x₂(0)')], estimate: [read(hat1, 'initial estimate x̂₁'), read(hat2, 'initial estimate x̂₂')], heldInput: connected.checked ? 0 : read(held, 'known input'), reference: connected.checked ? read(reference, 'reference') : 0, noiseAmplitude: read(amplitude, 'noise amplitude'), noiseFrequency: read(frequency, 'noise frequency'), noisePhase: read(phase, 'noise phase'), filterTau: read(tau, 'filter time'), horizon: read(horizon, 'horizon') };
    const nextRun = simulate(nextObserver, B, options, nextFeedback); let nextComparison: Run | undefined; comparisonNote = '';
    if (options.filterTau) { try { nextComparison = simulate(nextObserver, B, { ...options, filterTau: 0 }, nextFeedback); } catch (error) { comparisonNote = `Unfiltered comparison unavailable: ${error instanceof Error ? error.message : 'check its numerical scale'}`; } }
    observer = nextObserver; feedback = nextFeedback; current = nextRun; comparison = nextComparison; applied = options; secondRow = false; revealed = false; selectedTime = 0; attempts.l1 = ''; attempts.l2 = ''; render(); status.textContent = 'Experiment applied. Construct the second row, then predict the nominal observer gain.';
  }
  root.addEventListener('input', event => { const input = event.target; if (input instanceof HTMLInputElement && (input.name === 'l1' || input.name === 'l2')) attempts[input.name] = input.value; }, { signal });
  root.addEventListener('click', event => {
    const action = (event.target as Element).closest<HTMLButtonElement>('button[data-action]')?.dataset.action; if (!action) return;
    try {
      if (action === 'apply') apply();
      else if (['baseline', 'velocity', 'faster', 'complex', 'noise', 'filter', 'unstable'].includes(action)) {
        if (action === 'baseline') {
          editors.forEach((e, i) => e.setValue(INITIAL[i]));
          for (const [input, value] of [[x1, '1'], [x2, '0'], [hat1, '0'], [hat2, '0'], [held, '0'], [reference, '1'], [amplitude, '0'], [frequency, '20'], [phase, '0'], [tau, '0'], [horizon, '5']] as const) input.value = value;
          connected.checked = false; syncMode();
        }
        if (action === 'velocity') editors[2].setValue(String.raw`C=\begin{bmatrix}0&1\end{bmatrix}`);
        if (action === 'faster') editors[3].setValue('q(s)=(s+12)(s+14)');
        if (action === 'complex') editors[3].setValue('q(s)=(s+4)^2+9');
        if (action === 'noise' || action === 'filter') { amplitude.value = '.05'; frequency.value = '20'; phase.value = '0'; tau.value = action === 'filter' ? '.1' : '0'; }
        if (action === 'unstable') {
          editors[0].setValue(String.raw`A=\begin{bmatrix}1&0\\0&2\end{bmatrix}`); editors[1].setValue(String.raw`B=\begin{bmatrix}1\\1\end{bmatrix}`); editors[2].setValue(String.raw`C=\begin{bmatrix}1&1\end{bmatrix}`); editors[3].setValue(INITIAL[3]); editors[4].setValue(INITIAL[4]);
          for (const [input, value] of [[x1, '.1'], [x2, '0'], [hat1, '0'], [hat2, '0'], [held, '0'], [reference, '1'], [amplitude, '0'], [frequency, '20'], [phase, '0'], [tau, '1'], [horizon, '3']] as const) input.value = value;
          connected.checked = true; syncMode();
        }
        invalidate(); apply();
        if (action === 'unstable') status.textContent = 'Authored variation applied: an unstable plant with stable nominal feedback/observer targets. Inspect all actual modes after adding the innovation filter.';
      } else if (action === 'row') { secondRow = !secondRow; render(); }
      else if (action === 'reveal') { revealed = !revealed; render(); }
      else if (action === 'check') {
        const first = readNumericInput(view.querySelector<HTMLInputElement>('input[name="l1"]')!, 'your l₁'), second = readNumericInput(view.querySelector<HTMLInputElement>('input[name="l2"]')!, 'your l₂');
        const matches = (a: number, b: number) => b === 0 ? a === 0 : Math.abs(a - b) <= 1e-7 * Math.abs(b);
        view.querySelector('[data-attempt-feedback]')!.textContent = matches(first, observer.L[0]) && matches(second, observer.L[1]) ? 'Correct nominal observer gain. Check the actual error modes when a filter is added.' : 'Recheck both coefficient-matching equations and the selected sensor row.';
      } else if (action === 'time') {
        const value = readNumericInput(view.querySelector<HTMLInputElement>('input[name="inspectTime"]')!, 'inspection time');
        if (value < 0 || value > applied.horizon) throw new Error('Inspection time must lie inside the plotted horizon.'); selectedTime = value; render();
      }
    } catch (error) {
      if (action === 'apply' || ['baseline', 'velocity', 'faster', 'complex', 'noise', 'filter', 'unstable'].includes(action)) view.replaceChildren();
      status.textContent = error instanceof Error ? error.message : 'Check the experiment inputs.';
    }
  }, { signal });
  try { apply(); } catch (error) { status.textContent = error instanceof Error ? error.message : 'Check the experiment inputs.'; }
  return () => { editors.forEach(e => e.destroy()); root.remove(); };
};
