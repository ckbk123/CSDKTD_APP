import type { ModuleContext, ModuleMount } from '../../core/module';
import type { EquationDraft } from '../../shared/equations/input';
import { analyze, impulseAt, latexRat, modeAt, num, parseModel, polynomialLatex, stateAt, type Analysis, type Model, type Root } from './math';
import './workspace.css';

const matrix = (rows: readonly (readonly number[])[]): string => `\\begin{bmatrix}${rows.map(row => row.join('&')).join('\\\\')}\\end{bmatrix}`;
const fixtures = [
  { label: 'Baseline: poles −1, −2', a: [[0, 1], [-2, -3]], b: [[0], [1]], c: [[1, 0]], initial: [1, 0] },
  { label: 'Hidden unstable state (proposed)', a: [[1, 0], [0, -2]], b: [[0], [1]], c: [[0, 1]], initial: [1, 1] },
  { label: 'Imaginary pair ±2j (proposed)', a: [[0, 1], [-4, 0]], b: [[0], [1]], c: [[1, 0]], initial: [1, 0] },
  { label: 'Repeated zero, semisimple (proposed)', a: [[0, 0], [0, 0]], b: [[1], [1]], c: [[1, 0]], initial: [1, 1] },
  { label: 'Repeated zero, Jordan block (proposed)', a: [[0, 1], [0, 0]], b: [[0], [1]], c: [[1, 0]], initial: [0, 1] },
  { label: 'Repeated −1, Jordan block (proposed)', a: [[-1, 1], [0, -1]], b: [[0], [1]], c: [[1, 0]], initial: [0, 1] },
] as const;
function el<K extends keyof HTMLElementTagNameMap>(tag: K, text?: string, className?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag); if (text !== undefined) node.textContent = text; if (className) node.className = className; return node;
}
function select(label: string, choices: readonly (readonly [string, string])[]): { element: HTMLLabelElement; input: HTMLSelectElement } {
  const element = el('label', undefined, 'cs-control'); element.append(el('span', label)); const input = el('select');
  for (const [value, name] of choices) { const option = el('option', name); option.value = value; input.append(option); }
  element.append(input); return { element, input };
}
function numeric(label: string, value: number, min: number, max: number): { element: HTMLLabelElement; input: HTMLInputElement } {
  const element = el('label', undefined, 'cs-control'); element.append(el('span', label)); const input = el('input');
  input.type = 'number'; input.value = String(value); input.min = String(min); input.max = String(max); input.step = 'any';
  element.append(input); return { element, input };
}
function finite(input: HTMLInputElement, label: string): number {
  const value = input.valueAsNumber;
  if (!input.value.trim() || !Number.isFinite(value) || value < Number(input.min) || value > Number(input.max)) throw new Error(`${label}: enter a finite number from ${input.min} to ${input.max}.`);
  return value;
}
const formatted = (value: number): string => value === 0 ? '0' : Math.abs(value) < 0.0001 || Math.abs(value) >= 10000 ? value.toExponential(3) : Number(value.toPrecision(6)).toString();
const numberLatex = (value: number): string => formatted(value).replace(/e([+-]?\d+)/, '\\times10^{$1}');
const rootText = (root: Root): string => `${formatted(root.re)}${root.im ? `${root.im < 0 ? ' − ' : ' + '}${formatted(Math.abs(root.im))}j` : ''}`;
function svgNode<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>): SVGElementTagNameMap[K] {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value)); return node;
}
function svgText(svg: SVGSVGElement, x: number, y: number, text: string, anchor = 'middle'): void {
  const node = svgNode('text', { x, y, 'text-anchor': anchor }); node.textContent = text; svg.append(node);
}
function polePlane(roots: readonly Root[], selected: number): SVGSVGElement {
  const svg = svgNode('svg', { viewBox: '0 0 440 310', role: 'img', 'aria-label': 'Computed pole plane; crosses mark poles, circle marks selection' });
  const extent = Math.max(1.25, ...roots.flatMap(root => [Math.abs(root.re) * 1.3, Math.abs(root.im) * 1.3]));
  const px = (x: number): number => 220 + 115 * x / extent, py = (y: number): number => 150 - 115 * y / extent;
  svg.append(svgNode('rect', { x: 105, y: 35, width: 115, height: 230, class: 'cs-left-plane' }));
  svg.append(svgNode('line', { x1: 60, y1: 150, x2: 380, y2: 150, class: 'cs-axis' }), svgNode('line', { x1: 220, y1: 25, x2: 220, y2: 270, class: 'cs-axis' }));
  svgText(svg, 365, 174, 'Re(s) [1/s]'); svgText(svg, 235, 20, 'Im(s) [rad/s]'); svgText(svg, 213, 166, '0', 'end');
  svgText(svg, px(-extent), 174, formatted(-extent)); svgText(svg, px(extent), 138, formatted(extent));
  svgText(svg, 230, py(extent) + 5, formatted(extent), 'start'); svgText(svg, 220, 299, 'Shaded half-plane: Re(s) < 0');
  roots.forEach((r, i) => {
    const x = px(r.re), y = py(r.im);
    svg.append(svgNode('path', { d: `M${x - 5},${y - 5}L${x + 5},${y + 5}M${x - 5},${y + 5}L${x + 5},${y - 5}`, class: 'cs-pole' }));
    if (i === selected) svg.append(svgNode('circle', { cx: x, cy: y, r: 10, class: 'cs-selected' }));
    if (r.multiplicity > 1) svgText(svg, x + 14, y - 11, '×2', 'start');
  });
  if (!roots.length) svgText(svg, 220, 100, 'No poles in this scalar channel');
  return svg;
}
interface Curve { readonly name: string; readonly values: readonly number[]; readonly style: string }
function timePlot(times: readonly number[], curves: readonly Curve[], title: string): HTMLElement {
  const figure = el('figure', undefined, 'cs-figure'); figure.append(el('figcaption', title));
  const svg = svgNode('svg', { viewBox: '0 0 640 290', role: 'img', 'aria-label': title });
  const all = curves.flatMap(curve => [...curve.values]); let low = Math.min(0, ...all), high = Math.max(0, ...all);
  if (high - low < 1e-12) { low -= 1; high += 1; }
  const padding = (high - low) * 0.08; high += padding; low -= padding;
  const px = (t: number): number => 70 + t / times[times.length - 1] * 540, py = (y: number): number => 235 - (y - low) / (high - low) * 195;
  svg.append(svgNode('line', { x1: 70, y1: py(0), x2: 610, y2: py(0), class: 'cs-axis' }), svgNode('line', { x1: 70, y1: 35, x2: 70, y2: 240, class: 'cs-axis' }));
  svgText(svg, 62, 44, formatted(high), 'end'); svgText(svg, 62, 235, formatted(low), 'end'); svgText(svg, 70, 260, '0');
  svgText(svg, 610, 260, formatted(times[times.length - 1])); svgText(svg, 335, 282, 'Time t [s]'); svgText(svg, 72, 20, 'Amplitude [chosen state / output units]', 'start');
  for (const curve of curves) svg.append(svgNode('polyline', { points: curve.values.map((y, i) => `${px(times[i]).toFixed(3)},${py(y).toFixed(3)}`).join(' '), class: `cs-trace ${curve.style}` }));
  figure.append(svg); const legend = el('div', undefined, 'cs-legend');
  for (const curve of curves) legend.append(el('span', curve.name, curve.style)); figure.append(legend); return figure;
}

function mountView({ container, signal }: ModuleContext, { createEquationDisplay, createEquationInput }: typeof import('../../shared/equations/input')): () => void {
  const root = el('div', undefined, 'cs01'); container.append(root);
  root.append(el('h3', 'Compare internal modes with transfer poles'), el('p', 'Predict stability, then reveal the state and scalar-channel tests. All models here are continuous-time SISO systems.'));
  const examples = select('Example', fixtures.map((f, i) => [String(i), f.label])); root.append(examples.element);
  const equations = el('div', undefined, 'cs-equations'); root.append(equations);
  const results = el('div', undefined, 'cs-results'), message = el('p', 'Choose a prediction, then analyze the model.', 'cs-message'); message.setAttribute('role', 'status');
  let drafts: EquationDraft[] = [];
  let resultEvents = new AbortController();
  signal.addEventListener('abort', () => resultEvents.abort(), { once: true });
  const clearResult = (): void => { resultEvents.abort(); resultEvents = new AbortController(); results.replaceChildren(); };
  const dirty = (): void => { if (signal.aborted) return; clearResult(); message.textContent = 'Inputs changed. Analyze again to reveal the new result.'; };
  const fields = ['A (2 × 2)', 'B (2 × 1)', 'C (1 × 2)', 'D (scalar)'].map((label, i) => {
    const f = fixtures[0], value = [matrix(f.a), matrix(f.b), matrix(f.c), '0'][i];
    const field = createEquationInput({ label, value, signal, onChange: draft => { drafts[i] = draft; dirty(); } }); equations.append(field.element); return field;
  });
  drafts = fields.map(f => f.getValue());
  root.append(createEquationDisplay(String.raw`\dot{x}=Ax+Bu,\qquad y=Cx+Du`, 'State and output conventions'));
  const controls = el('div', undefined, 'cs-controls');
  const x1 = numeric('Initial x₁(0)', 1, -100, 100), x2 = numeric('Initial x₂(0)', 0, -100, 100), horizon = numeric('Time horizon [s]', 6, 0.05, 30);
  controls.append(x1.element, x2.element, horizon.element); root.append(controls);
  const assumptions = el('details'); assumptions.append(el('summary', 'Supported inputs and assumptions'));
  assumptions.append(el('p', 'Edit real integers, decimals (up to 9 decimal places), or fractions in the displayed matrices. Each entry has magnitude ≤100 and reduced denominator ≤10⁹; each matrix has at most 512 characters. A is 2 × 2; B and C describe one scalar input/output. D is finite direct feedthrough. Matrix rows act on the column state vector. No feedback loop is implied.'));
  assumptions.append(el('p', 'Time is in seconds; eigenvalues have units s⁻¹ (imaginary frequency in rad/s). State and output units are chosen consistently by the student. Zero-input traces use the selected initial state. Transfer and BIBO statements assume zero initial state. Algebra and cancellation use exact rational entries; roots and exponential traces are numerical approximations. Classification uses exact signs, with no tolerance strip around the imaginary axis.'));
  assumptions.append(el('p', 'Plots use closed-form matrix exponentials, at most 2,049 time points, and at least 24 points per oscillation. Growth is limited to exp(40); shorten the horizon when requested. The plot grid is a display choice, not a controller sample time. A finite trace illustrates the analytic classification and cannot prove stability.')); root.append(assumptions);
  const predictions = el('fieldset', undefined, 'cs-predictions'); predictions.append(el('legend', 'Your prediction'));
  const internalPrediction = select('Zero-input state behavior', [['', 'Choose a prediction'], ['asymptotically stable', 'Every state tends to zero'], ['bounded, not asymptotic', 'Bounded, some states do not decay'], ['unstable', 'Some initial state grows without bound']]);
  const biboPrediction = select('Reduced scalar channel (zero initial state)', [['', 'Choose a prediction'], ['true', 'BIBO stable'], ['false', 'Not BIBO stable']]);
  predictions.append(internalPrediction.element, biboPrediction.element); root.append(predictions);
  const reveal = el('button', 'Analyze and reveal', 'button cs-reveal'); reveal.type = 'button'; root.append(reveal, message, results);

  function render(model: Model, analysis: Analysis, initial: number[], seconds: number): void {
    clearResult();
    const verdict = el('section', undefined, 'cs-verdict'); verdict.append(el('h3', 'Stability statements'));
    const list = el('dl'), entry = (name: string, value: string): void => { list.append(el('dt', name), el('dd', value)); };
    entry('Internal asymptotic stability', analysis.freeClass === 'asymptotically stable' ? 'Yes — every zero-input state decays.' : 'No.');
    entry('Zero-input (Lyapunov) stability', analysis.freeClass === 'unstable' ? 'Unstable — some arbitrarily small initial state grows.' : analysis.freeClass === 'asymptotically stable' ? 'Stable, with decay to zero.' : 'Stable (bounded), but not asymptotic.');
    entry('Scalar zero-state BIBO stability', analysis.bibo ? 'Yes — all uncanceled channel poles lie strictly in the left half-plane (or the channel has no poles).' : 'No — a channel pole is on or to the right of the imaginary axis.'); verdict.append(list, el('p', analysis.reason));
    if (analysis.cancellation.length > 1) verdict.append(el('p', 'Exact channel cancellation removes poles from this transfer. The original realization and its eigenvalues remain in the internal-state test.', 'cs-emphasis'));
    const feedback: string[] = [];
    if (internalPrediction.input.value) feedback.push(`State prediction: ${internalPrediction.input.value === analysis.freeClass ? 'matches' : 'does not match'} the calculation.`);
    if (biboPrediction.input.value) feedback.push(`BIBO prediction: ${biboPrediction.input.value === String(analysis.bibo) ? 'matches' : 'does not match'} the calculation.`);
    if (feedback.length) verdict.append(el('p', feedback.join(' '), 'cs-emphasis')); results.append(verdict);
    const derivation = el('section'); derivation.append(el('h3', 'Derive the scalar channel before reducing'));
    derivation.append(createEquationDisplay(String.raw`G(s)=C(sI-A)^{-1}B+D=\frac{N(s)}{\chi_A(s)}`, 'Original scalar transfer identity'));
    derivation.append(createEquationDisplay(`\\chi_A(s)=\\det(sI-A)=${polynomialLatex(analysis.denominator)}`, 'Characteristic polynomial'));
    derivation.append(createEquationDisplay(`N(s)=${polynomialLatex(analysis.numerator)}`, 'Unreduced numerator'));
    derivation.append(createEquationDisplay(`q(s)=${polynomialLatex(analysis.cancellation)},\\qquad G_{\\mathrm{red}}(s)=\\frac{${polynomialLatex(analysis.reducedNumerator)}}{${polynomialLatex(analysis.reducedDenominator)}}`, 'Exact common factor and reduced transfer'));
    derivation.append(el('p', 'The common factor q uses exact polynomial division over the entered rational numbers. Close pole/zero pairs are retained. A proper finite D term is BIBO stable by itself.'));
    if (analysis.eigenvalues.some(r => r.multiplicity === 2)) derivation.append(el('p', analysis.defective
      ? 'Repeated eigenvalue, algebraic multiplicity 2, eigenspace dimension 1: a Jordan chain adds t·exp(λt). It grows at λ=0, but still decays when λ<0.'
      : 'Repeated eigenvalue, algebraic multiplicity 2, eigenspace dimension 2: A=λI. Both modes are ordinary exp(λt); repetition alone does not imply Jordan growth.'));
    else derivation.append(el('p', 'Each eigenvalue is simple and has a one-dimensional eigenspace over ℂ. A conjugate pair produces real cosine and sine modes.'));
    if (analysis.freeClass === 'bounded, not asymptotic' && !analysis.bibo) derivation.append(el('p', 'Bounded free motion does not imply BIBO stability: an uncanceled integrator grows under a constant input, and a simple imaginary pair grows under a bounded resonant sinusoid.')); results.append(derivation);
    const explorer = el('section'); explorer.append(el('h3', 'Inspect every eigenvalue and the selected mode'));
    const view = select('View', [['original', 'Original state realization'], ['reduced', 'Reduced scalar transfer']]), mode = select('Selected eigenvalue / pole', []);
    const generalized = el('input'); generalized.type = 'checkbox'; const generalizedLabel = el('label', undefined, 'cs-checkbox'); generalizedLabel.append(generalized, el('span', 'Show generalized mode t·exp(λt)'));
    const plotArea = el('div'), modeInfo = el('div'), rootList = el('div'); explorer.append(view.element, rootList, mode.element, generalizedLabel, modeInfo, plotArea); results.append(explorer);
    const showPlots = (): void => {
      if (signal.aborted) return;
      const visibleRoots = view.input.value === 'original' ? analysis.eigenvalues : analysis.poles, selected = Number(mode.input.value) || 0, chosen = visibleRoots[selected];
      generalizedLabel.hidden = !chosen || chosen.multiplicity < 2 || !analysis.defective;
      const useGeneralized = !generalizedLabel.hidden && generalized.checked; modeInfo.replaceChildren(); plotArea.replaceChildren();
      if (chosen) {
        const formula = `${useGeneralized ? 't' : ''}e^{(${numberLatex(chosen.re)})t}${chosen.im ? `\\cos(${numberLatex(Math.abs(chosen.im))}t)` : ''}`;
        modeInfo.append(createEquationDisplay(`m(t)=${formula}`, 'Selected real modal component'));
        modeInfo.append(el('p', chosen.im ? 'This graph shows the real cosine component. Its companion sine component has the same exponential envelope.' : useGeneralized ? 'This generalized component is part of a Jordan chain; an ordinary exponential mode also exists.' : 'This graph has unit modal amplitude. Eigenvector scaling is arbitrary.'));
      } else modeInfo.append(el('p', 'The reduced scalar channel is constant; it has no dynamic poles. Internal modes still belong to the original realization.'));
      const plane = el('figure', undefined, 'cs-figure cs-plane'); plane.append(el('figcaption', view.input.value === 'original' ? 'Original eigenvalues (all states)' : 'Reduced scalar transfer poles'), polePlane(visibleRoots, selected)); plotArea.append(plane);
      try {
        const maxFrequency = Math.max(0, ...analysis.eigenvalues.map(r => Math.abs(r.im))), count = Math.max(241, Math.ceil(seconds * maxFrequency * 24 / (2 * Math.PI)) + 1);
        if (count > 2049) throw new Error('Shorten the horizon to resolve the oscillation within 2,049 plot points.');
        const times = Array.from({ length: count }, (_, i) => seconds * i / (count - 1));
        if (chosen) plotArea.append(timePlot(times, [{ name: 'Selected real mode', values: times.map(t => modeAt(chosen, useGeneralized, t)), style: 'cs-solid' }], 'Selected modal component (numerical)'));
        if (view.input.value === 'original') {
          const states = times.map(t => stateAt(model, initial, t)), c = model.c.map(num);
          plotArea.append(timePlot(times, [
            { name: 'x₁ — solid', values: states.map(x => x[0]), style: 'cs-solid' }, { name: 'x₂ — dashed', values: states.map(x => x[1]), style: 'cs-dashed' },
            { name: 'y — dotted', values: states.map(x => c[0] * x[0] + c[1] * x[1]), style: 'cs-dotted' },
          ], 'Original free response: u(t)=0, chosen x(0)'));
          const end = states[states.length - 1]; plotArea.append(el('p', `At t=${formatted(seconds)} s: x₁=${formatted(end[0])}, x₂=${formatted(end[1])}, y=${formatted(c[0] * end[0] + c[1] * end[1])}. One initial state can miss a mode; classification tests all states.`));
        } else {
          const impulse = times.map(t => impulseAt(analysis, t));
          plotArea.append(timePlot(times, [{ name: 'h(t) for t>0 — solid', values: impulse, style: 'cs-solid' }], 'Scalar impulse response: h(t)=C exp(At) B for t>0'));
          plotArea.append(createEquationDisplay(`h(t)=${latexRat(model.d)}\\delta(t)+Ce^{At}B`, 'Distribution impulse term plus regular response'));
          plotArea.append(el('p', 'The regular impulse trace is for t>0, with zero pre-input state; it ignores the chosen free-response initial state. A D·δ(t) spike is a distribution and is not drawn as a finite-height point.'));
        }
      } catch (error) { plotArea.append(el('p', error instanceof Error ? error.message : 'Cannot plot this horizon.', 'cs-message')); }
    };
    const changeView = (): void => {
      const visibleRoots = view.input.value === 'original' ? analysis.eigenvalues : analysis.poles; mode.input.replaceChildren(); generalized.checked = false;
      const table = el('table'), header = el('tr'); for (const name of ['Eigenvalue / pole [s⁻¹]', 'Algebraic multiplicity']) header.append(el('th', name));
      const head = el('thead'); head.append(header); const body = el('tbody');
      visibleRoots.forEach((r, i) => { const option = el('option', rootText(r)); option.value = String(i); mode.input.append(option); const row = el('tr'); row.append(el('td', rootText(r)), el('td', String(r.multiplicity))); body.append(row); });
      table.append(head, body); rootList.replaceChildren(table); mode.input.disabled = !visibleRoots.length; showPlots();
    };
    view.input.addEventListener('change', changeView, { signal: resultEvents.signal }); mode.input.addEventListener('change', () => { generalized.checked = false; showPlots(); }, { signal: resultEvents.signal });
    generalized.addEventListener('change', showPlots, { signal: resultEvents.signal }); changeView();
  }
  reveal.addEventListener('click', () => {
    if (signal.aborted) return;
    try {
      drafts = fields.map(f => f.getValue()); const invalid = drafts.findIndex(d => d.empty || d.hasPlaceholders || d.syntaxIssues.length);
      if (invalid !== -1) throw new Error(`Complete ${['A', 'B', 'C', 'D'][invalid]} and check its equation notation.`);
      const model = parseModel(drafts[0].latex, drafts[1].latex, drafts[2].latex, drafts[3].latex);
      const initial = [finite(x1.input, 'Initial x₁'), finite(x2.input, 'Initial x₂')], seconds = finite(horizon.input, 'Time horizon');
      render(model, analyze(model), initial, seconds); message.textContent = 'Result revealed. Change the model or initial state to repeat the experiment.';
    } catch (error) { clearResult(); message.textContent = error instanceof Error ? error.message : 'Check the model inputs.'; }
  }, { signal });
  for (const input of [x1.input, x2.input, horizon.input]) input.addEventListener('input', dirty, { signal });
  examples.input.addEventListener('change', () => {
    const f = fixtures[Number(examples.input.value)], values = [matrix(f.a), matrix(f.b), matrix(f.c), '0']; fields.forEach((field, i) => field.setValue(values[i]));
    drafts = fields.map(field => field.getValue()); x1.input.value = String(f.initial[0]); x2.input.value = String(f.initial[1]); horizon.input.value = '6';
    internalPrediction.input.value = ''; biboPrediction.input.value = ''; dirty();
  }, { signal });
  return () => { resultEvents.abort(); for (const field of fields) field.destroy(); root.remove(); };
}

/** Keep the public synchronous entry importable without running a browser editor in Node. */
export const mount: ModuleMount = context => {
  let disposed = false;
  let cleanup: (() => void) | undefined;
  const loading = el('p', 'Loading visual inputs…'); context.container.append(loading);
  void import('../../shared/equations/input').then(ui => {
    if (disposed || context.signal.aborted) return;
    loading.remove(); cleanup = mountView(context, ui);
  }).catch(() => {
    if (!disposed && !context.signal.aborted) loading.textContent = 'Visual inputs could not load. Reset the tool to try again.';
  });
  return () => { disposed = true; cleanup?.(); loading.remove(); };
};
