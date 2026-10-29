import type { ModuleMount } from '../../core/module';
import { createEquationDisplay, createEquationInput, type EquationInput } from '../../shared/equations/input';
import { readNumericInput } from '../../shared/numeric-input';
import { design, response, type Matrix, type Model, type Sample, type Vector } from './math';
import { parseMatrix, parseTarget } from './parser';
import './style.css';

const INITIAL = [String.raw`A=\begin{bmatrix}0&1\\-2&-3\end{bmatrix}`, String.raw`B=\begin{bmatrix}0\\1\end{bmatrix}`, String.raw`C=\begin{bmatrix}1&0\end{bmatrix}`, 'q(s)=(s+2)(s+4)'] as const;
function node<K extends keyof HTMLElementTagNameMap>(tag: K, text?: string): HTMLElementTagNameMap[K] { const e = document.createElement(tag); if (text !== undefined) e.textContent = text; return e; }
function svgNode(tag: string, attributes: Record<string, number | string>, text?: string) { const e = document.createElementNS('http://www.w3.org/2000/svg', tag); Object.entries(attributes).forEach(([k, v]) => e.setAttribute(k, String(v))); if (text) e.textContent = text; return e; }
const plain = (v: number): string => v === 0 ? '0' : Number(v.toPrecision(7)).toString();
const format = (v: number): string => plain(v).replace(/e([+-]?\d+)/, (_, exponent: string) => ` × 10^${Number(exponent)}`);
const axisFormat = (v: number): string => v === 0 ? '0' : Math.abs(v) < .001 || Math.abs(v) >= 10000 ? v.toExponential(1) : Number(v.toPrecision(3)).toString();
function tex(v: number): string { const parts = plain(v).split('e'); return parts.length === 1 ? parts[0] : `${parts[0]}\\times10^{${Number(parts[1])}}`; }
const matrixTex = (a: readonly number[], columns: number) => `\\begin{bmatrix}${a.map((v, i) => `${tex(v)}${i === a.length - 1 ? '' : (i + 1) % columns ? '&' : '\\\\'}`).join('')}\\end{bmatrix}`;
function button(label: string, action: string): HTMLButtonElement { const e = node('button', label); e.type = 'button'; e.dataset.action = action; return e; }
const matches = (a: number, b: number) => b === 0 ? a === 0 : Math.abs(a - b) <= 1e-7 * Math.abs(b);

export const mount: ModuleMount = ({ container, signal }) => {
  const root = node('div'); root.className = 'feedback-tool';
  const intro = node('section'); intro.append(node('h3', 'Place the poles, then correct the reference'), node('p', 'Build the controllability columns and match the desired polynomial. Compare the same feedback gain with N = 1 and the calculated static prefilter. A two-state model still has one input and one output.'));
  intro.append(createEquationDisplay(String.raw`\dot{x}=Ax+Bu,\quad y=Cx,\quad u=-Kx+Nr,\quad D=0`, 'Model and negative-feedback convention'));
  const editorGrid = node('div'); editorGrid.className = 'feedback-inputs';
  const editors: EquationInput[] = [];
  const message = node('p'); message.setAttribute('role', 'status');
  const view = node('div');
  const invalidate = () => { revealed = false; view.replaceChildren(); message.textContent = 'Data changed. Apply the model to recompute the exercise.'; };
  for (const [i, label] of ['State matrix A (2 by 2)', 'Input column B (2 by 1)', 'Output row C (1 by 2)', 'Desired characteristic polynomial q(s)'].entries()) {
    const editor = createEquationInput({ label, value: INITIAL[i], signal, onChange: invalidate }); editors.push(editor); editorGrid.append(editor.element);
    // Escape closes this editor's keyboard before MathLive can switch modes.
    // Preserve the visual math mode used by the local parser and Restore action.
    editor.element.addEventListener('keydown', event => {
      if (event.key !== 'Escape') return;
      event.preventDefault(); event.stopPropagation();
      editor.element.querySelector<HTMLButtonElement>('button[aria-pressed="true"]')?.click();
    }, { capture: true, signal });
  }
  const controls = node('div'); controls.className = 'feedback-controls';
  function numeric(parent: HTMLElement, label: string, name: string, value: string, placeholder?: string): HTMLInputElement {
    const wrap = node('label', label), input = node('input'); input.type = 'number'; input.step = 'any'; input.name = name; input.value = value; input.setAttribute('aria-label', label); if (placeholder) input.placeholder = placeholder;
    wrap.append(input); parent.append(wrap); return input;
  }
  const x1 = numeric(controls, 'Initial x₁(0)', 'initial1', '0'), x2 = numeric(controls, 'Initial x₂(0)', 'initial2', '0');
  const reference = numeric(controls, 'Held reference r', 'reference', '1'), horizon = numeric(controls, 'Plot horizon (s)', 'horizon', '5');
  controls.addEventListener('input', invalidate, { signal });
  const actions = node('div'); actions.className = 'feedback-actions'; actions.append(button('Apply model', 'apply'), button('Try targets −1, −5', 'variation'), button('Try conjugate targets −2 ± 3j', 'complex'), button('Try velocity output', 'velocity'), button('Restore mechanical example', 'baseline'));
  const limits = node('details'); limits.append(node('summary', 'Supported model, units and tolerances'), node('p', 'Real continuous two-state SISO model: A is 2×2, B is 2×1, C is 1×2, x is a column and D=0. Both states are assumed available for feedback; C defines the output, not a state estimator. Matrices contain literal decimals or signed numeric fractions; no general scalar algebra or e/E scientific notation in visual inputs. Desired q(s) is a real monic quadratic with strictly stable roots; expanded and factored forms, repeated and conjugate targets work. Use explicit + or × before numeric fractions in the target polynomial; hidden algebraic braces and mixed-number adjacency are rejected.'),
    node('p', 'Time is in seconds; state, reference, output and effort units follow the model you supply. Matrix entries ≤1000; target coefficients ≤10,000; gain ≤10⁶; closed matrix entries ≤10⁴. Rank uses the determinant after independently normalizing both controllability columns, with threshold 10⁻⁹. Matching equations use normalized rows; each actual coefficient must match its positive target with relative error ≤10⁻⁹. A zero or poorly conditioned DC channel has no reliable static prefilter. Initial states/reference ≤100; horizon 0.1–50 s; 401 numerical samples. No finite horizon is asserted to be settled.'),
    node('p', 'Equation length ≤600 characters; target ≤120 tokens, nesting ≤12; literal decimals ≤12 places, ≤8 integer digits; scalar fraction nesting ≤8. Response uses a bounded augmented numerical matrix exponential (scaling ≤30, Taylor ≤24 terms with 10⁻¹⁶ term tolerance). Nonfinite/oversized results and poor conditioning receive feedback. The original full two-state model is retained even if its selected output hides a mode.'));
  intro.append(editorGrid, controls, actions, message, limits); root.append(intro, view); container.append(root);
  let result: ReturnType<typeof design>, raw: Sample[] = [], corrected: Sample[] | null = null;
  let heldReference = 1, selectedTime = 0, revealed = false, columns = 1;
  const attempts = { k1: '', k2: '', n: '', none: false };
  function chart(label: string, select: (s: Sample) => number): HTMLElement {
    const figure = node('figure'); figure.append(node('figcaption', label));
    const series = [...raw.map(select), ...(corrected?.map(select) ?? []), ...(label.startsWith('Output') ? [heldReference] : [])];
    let low = Math.min(0, ...series), high = Math.max(0, ...series); if (high === low) { low -= 1; high += 1; }
    const padding = (high - low) * .1; low -= padding; high += padding;
    const duration = raw.at(-1)!.t, X = (t: number) => 88 + 385 * t / duration, Y = (y: number) => 185 - 155 * (y - low) / (high - low);
    const svg = svgNode('svg', { viewBox: '0 0 500 225', role: 'img', 'aria-label': `${label}; t from 0 to ${duration} seconds. ${corrected ? 'Solid: calculated prefilter; dashed: N=1.' : 'Dashed: N=1 only; no supported static prefilter is available.'} Values are available in the sample table.` });
    svg.append(svgNode('line', { x1: 88, y1: 185, x2: 478, y2: 185, class: 'feedback-axis' }), svgNode('line', { x1: 88, y1: 25, x2: 88, y2: 185, class: 'feedback-axis' }), svgNode('text', { x: 83, y: 30, 'text-anchor': 'end' }, axisFormat(high)), svgNode('text', { x: 83, y: 185, 'text-anchor': 'end' }, axisFormat(low)), svgNode('text', { x: 88, y: 204 }, '0'), svgNode('text', { x: 465, y: 204 }, format(duration)), svgNode('text', { x: 235, y: 222 }, 'Time t (s)'));
    const path = (samples: Sample[], className: string) => svgNode('path', { d: samples.map((s, i) => `${i ? 'L' : 'M'}${X(s.t).toFixed(3)},${Y(select(s)).toFixed(3)}`).join(' '), class: className });
    if (label.startsWith('Output')) svg.append(svgNode('line', { x1: 88, x2: 473, y1: Y(heldReference), y2: Y(heldReference), class: 'feedback-reference' }));
    svg.append(path(raw, 'feedback-raw')); if (corrected) svg.append(path(corrected, 'feedback-corrected'));
    const index = Math.round(selectedTime / duration * (raw.length - 1));
    for (const samples of corrected ? [raw, corrected] : [raw]) svg.append(svgNode('circle', { cx: X(samples[index].t), cy: Y(select(samples[index])), r: 3, class: 'feedback-marker' }));
    const scroll = node('div'); scroll.className = 'feedback-plot-scroll'; scroll.tabIndex = 0; scroll.setAttribute('role', 'region'); scroll.setAttribute('aria-label', `${label} plot; scroll horizontally to read the full axes`); scroll.append(svg);
    figure.append(scroll); return figure;
  }
  function render(): void {
    if (signal.aborted) return;
    const active = document.activeElement instanceof HTMLElement && view.contains(document.activeElement) ? document.activeElement : null;
    const action = active?.dataset.action, name = active instanceof HTMLInputElement ? active.name : undefined;
    view.replaceChildren();
    const rankStep = node('section'); rankStep.append(node('h3', '1. Build controllability, one column at a time'), createEquationDisplay(`B=${matrixTex(result.model.B, 1)}`, 'First controllability column'));
    if (columns === 2) rankStep.append(createEquationDisplay(`AB=${matrixTex(result.AB, 1)},\\quad\\mathcal{C}=[B\\;AB]=${matrixTex(result.controllability, 2)}`, 'Full controllability matrix'), node('p', `After independently normalizing the columns: determinant = ${format(result.scaledDet)}. Its magnitude exceeds 10⁻⁹, so the declared numerical rank is 2.`));
    rankStep.append(button(columns === 1 ? 'Construct AB and check rank' : 'Hide second column', 'column'));
    const attempt = node('section'); attempt.append(node('h3', '2. Predict the feedback and tracking gains'));
    const row = node('div'); row.className = 'feedback-controls';
    numeric(row, 'Your k₁', 'k1', attempts.k1); numeric(row, 'Your k₂', 'k2', attempts.k2); numeric(row, 'Your N', 'n', attempts.n);
    const noLabel = node('label', 'No supported static prefilter '), none = node('input'); none.type = 'checkbox'; none.name = 'none'; none.checked = attempts.none; noLabel.append(none); row.append(noLabel);
    attempt.append(row, button('Check my gains', 'check'), button(revealed ? 'Hide checked derivation' : 'Reveal checked derivation', 'reveal'));
    const attemptMessage = node('p'); attemptMessage.dataset.attemptFeedback = ''; attemptMessage.setAttribute('role', 'status'); attempt.append(attemptMessage); view.append(rankStep, attempt);
    if (revealed) {
      const derivation = node('section'); derivation.append(node('h3', '3. Match the polynomial and verify the actual matrix'), createEquationDisplay(`q(s)=s^2+(${tex(result.desired[0])})s+(${tex(result.desired[1])})`, 'Desired characteristic polynomial'),
        createEquationDisplay(String.raw`KB=\operatorname{tr}(A)+d_1,\quad K\operatorname{adj}(A)B=\det(A)-d_0`, 'Two coefficient-matching equations'),
        createEquationDisplay(`${matrixTex(result.matching, 2)}${matrixTex(result.K, 1)}=${matrixTex(result.rhs, 1)}`, 'Matching equations with solved gain'), createEquationDisplay(`K=${matrixTex(result.K, 2)},\\quad A-BK=${matrixTex(result.closed, 2)}`, 'Checked feedback gain and full closed matrix'),
        createEquationDisplay(`\\det(sI-(A-BK))=s^2+(${tex(result.actual[0])})s+(${tex(result.actual[1])})`, 'Actual characteristic polynomial'), node('p', `Actual eigenvalues (computed from A−BK): ${result.poles.map(([re, im]) => `${format(re)}${im ? ` ${im < 0 ? '−' : '+'} j ${format(Math.abs(im))}` : ''}`).join('; ')}. Relative coefficient residual = ${format(result.residual)}.`));
      const tracking = node('section'); tracking.append(node('h3', '4. Correct the reference gain'), createEquationDisplay(String.raw`y_\infty=-C(A-BK)^{-1}BNr,\quad N=-\frac{1}{C(A-BK)^{-1}B}`, 'Static tracking derivation'), node('p', `With N=1, the DC reference-to-output gain is ${format(result.dcGain)}. ${result.trackingNote}`));
      if (result.prefilter !== null) tracking.append(createEquationDisplay(`N=${tex(result.prefilter)},\\quad y_\\infty=${tex(result.dcGain * result.prefilter)}r`, 'Checked scalar prefilter'));
      tracking.append(node('p', 'The prefilter changes the reference channel, not A−BK or its poles. Correct pole placement alone does not guarantee unity reference tracking. The DC statement assumes the stable model, a constant reference and time tending to infinity.'));
      const simulation = node('section'); simulation.append(node('h3', '5. Compare states, output and control effort'), node('p', `${corrected ? 'Solid indigo: calculated prefilter. Dashed slate: N=1. Both cases use the same original model, feedback gain and initial state.' : 'Dashed slate: N=1 only. No reliable static prefilter is available for this output; the feedback and all states are still shown.'} Output dotted line: held reference. Curves are numerical samples; endpoint values are not a declaration of settling.`));
      const step = raw.at(-1)!.t / (raw.length - 1), fastestRate = Math.max(...result.poles.map(([re, im]) => Math.hypot(re, im)));
      if (step * fastestRate > .25) simulation.append(node('p', `Sampling warning: Δt=${format(step)} s is coarse relative to the fastest mode. Curves may miss peaks or oscillations. Shorten the horizon toward ${format(.25 * (raw.length - 1) / fastestRate)} s or inspect numerical values; the pole calculation is separate from this sampled illustration.`));
      const plots = node('div'); plots.className = 'feedback-plots'; plots.append(chart('Output y(t)', s => s.output), chart('Control effort u(t)', s => s.effort), chart('State x₁(t)', s => s.state[0]), chart('State x₂(t)', s => s.state[1])); simulation.append(plots);
      const select = node('div'); select.className = 'feedback-actions'; numeric(select, 'Inspect time (s)', 'inspectTime', String(selectedTime)); select.append(button('Inspect nearest sample', 'time')); simulation.append(select);
      const index = Math.round(selectedTime / raw.at(-1)!.t * (raw.length - 1)), table = node('table'); table.append(node('caption', `Nearest sampled time: ${format(raw[index].t)} s (401 points).`));
      const header = node('tr'); ['Reference gain', 'x₁', 'x₂', 'y', 'u'].forEach(t => header.append(node('th', t))); table.append(header);
      for (const [label, samples] of [['N = 1', raw], [`N = ${format(result.prefilter ?? 1)}`, corrected]] as const) if (samples) { const tr = node('tr'), p = samples[index]; [label, ...p.state.map(format), format(p.output), format(p.effort)].forEach(t => tr.append(node('td', t))); table.append(tr); }
      const tableScroll = node('div'); tableScroll.className = 'feedback-sample-table'; tableScroll.tabIndex = 0; tableScroll.setAttribute('role', 'region'); tableScroll.setAttribute('aria-label', 'Response sample table; scroll horizontally for all columns'); tableScroll.append(table);
      simulation.append(tableScroll); view.append(derivation, tracking, simulation);
    }
    if (active && !active.isConnected) {
      const replacement = action ? Array.from(view.querySelectorAll<HTMLButtonElement>('button[data-action]')).find(b => b.dataset.action === action) : Array.from(view.querySelectorAll<HTMLInputElement>('input[name]')).find(i => i.name === name);
      replacement?.focus({ preventScroll: true });
    }
  }
  function apply(): void {
    const values = editors.map(e => e.getValue());
    if (values.some(v => v.empty || v.hasPlaceholders || v.syntaxIssues.length)) throw new Error('Complete all four visual equations and correct their notation.');
    const model: Model = { A: parseMatrix(values[0].latex, 2, 2, 'A') as unknown as Matrix, B: parseMatrix(values[1].latex, 2, 1, 'B') as unknown as Vector, C: parseMatrix(values[2].latex, 1, 2, 'C') as unknown as Vector };
    const candidate = design(model, parseTarget(values[3].latex)), initial: Vector = [readNumericInput(x1, 'initial x₁'), readNumericInput(x2, 'initial x₂')], r = readNumericInput(reference, 'reference'), time = readNumericInput(horizon, 'plot horizon');
    const nextRaw = response(candidate, 1, initial, r, time), nextCorrected = candidate.prefilter === null ? null : response(candidate, candidate.prefilter, initial, r, time);
    result = candidate; raw = nextRaw; corrected = nextCorrected; heldReference = r; selectedTime = 0; revealed = false; columns = 1;
    attempts.k1 = ''; attempts.k2 = ''; attempts.n = ''; attempts.none = false; render(); message.textContent = 'Model applied. Construct the second column, then predict the gains.';
  }
  root.addEventListener('input', event => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) return;
    if (input.name === 'k1' || input.name === 'k2' || input.name === 'n') attempts[input.name] = input.value;
    if (input.name === 'none') attempts.none = input.checked;
  }, { signal });
  root.addEventListener('click', event => {
    const action = (event.target as Element).closest<HTMLButtonElement>('button[data-action]')?.dataset.action; if (!action) return;
    try {
      if (action === 'apply') apply();
      else if (['baseline', 'variation', 'complex', 'velocity'].includes(action)) {
        if (action === 'baseline') { editors.forEach((e, i) => e.setValue(INITIAL[i])); x1.value = '0'; x2.value = '0'; reference.value = '1'; horizon.value = '5'; }
        if (action === 'variation') editors[3].setValue('q(s)=(s+1)(s+5)');
        if (action === 'complex') editors[3].setValue('q(s)=(s+2)^2+9');
        if (action === 'velocity') editors[2].setValue(String.raw`C=\begin{bmatrix}0&1\end{bmatrix}`);
        invalidate(); apply();
      } else if (action === 'column') { columns = columns === 1 ? 2 : 1; render(); }
      else if (action === 'reveal') { revealed = !revealed; render(); }
      else if (action === 'check') {
        const read = (name: string) => readNumericInput(view.querySelector<HTMLInputElement>(`input[name="${name}"]`)!, `your ${name}`);
        const feedbackOkay = matches(read('k1'), result.K[0]) && matches(read('k2'), result.K[1]);
        const prefilterOkay = result.prefilter === null ? attempts.none : !attempts.none && matches(read('n'), result.prefilter);
        view.querySelector('[data-attempt-feedback]')!.textContent = feedbackOkay && prefilterOkay ? 'Correct feedback and tracking conclusion.' : 'Recheck both matching equations and the DC reference gain. A pole match does not imply N=1.';
      } else if (action === 'time') {
        const input = view.querySelector<HTMLInputElement>('input[name="inspectTime"]')!, value = readNumericInput(input, 'inspection time');
        if (value < 0 || value > raw.at(-1)!.t) throw new Error('Inspection time must lie inside the plotted horizon.'); selectedTime = value; render();
      }
    } catch (error) {
      if (action === 'apply' || ['baseline', 'variation', 'complex', 'velocity'].includes(action)) view.replaceChildren();
      message.textContent = error instanceof Error ? error.message : 'Check the inputs.';
    }
  }, { signal });
  try { apply(); } catch (error) { message.textContent = error instanceof Error ? error.message : 'Check the model.'; }
  return () => { editors.forEach(e => e.destroy()); root.remove(); };
};
