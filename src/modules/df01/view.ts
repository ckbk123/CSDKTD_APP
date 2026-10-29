import type { ModuleMount } from '../../core/module';
import { createEquationDisplay, createEquationInput, type EquationDraft } from '../../shared/equations/input';
import { analyze, format as f, parseTransfer, polynomialLatex, type Result } from './math';
import './style.css';

const svgNS = 'http://www.w3.org/2000/svg';
function graph(r: Result, selected: number, reveal: boolean): SVGSVGElement {
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('viewBox', '0 0 820 320'); svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', `Computed unit-step stems, samples 0 through ${r.N}. Horizontal axis sample k and time in seconds; vertical axis output y. Use the sample inspector for values.`);
  const make = (tag: string, attrs: Record<string, string | number>, text?: string) => {
    const node = document.createElementNS(svgNS, tag);
    Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, String(v)));
    if (text !== undefined) node.textContent = text;
    svg.append(node); return node;
  };
  const lo = Math.min(0, ...r.samples, r.finalValue - r.bandWidth);
  const hi = Math.max(0, ...r.samples, r.finalValue + r.bandWidth);
  const span = hi - lo || 1, bottom = lo - .12 * span, top = hi + .15 * span;
  const X = (k: number) => 72 + k / r.N * 720;
  const Y = (v: number) => 245 - (v - bottom) / (top - bottom) * 225;
  const bandTop = Math.max(r.finalValue - r.bandWidth, r.finalValue + r.bandWidth);
  make('rect', { x: X(0), y: Y(bandTop), width: 720, height: Y(r.finalValue - r.bandWidth) - Y(bandTop), class: 'df-band' });
  for (let i = 0; i <= 4; i++) {
    const v = bottom + (top - bottom) * i / 4;
    make('line', { x1: 72, x2: 792, y1: Y(v), y2: Y(v), class: 'df-gridline' });
    make('text', { x: 64, y: Y(v) + 4, 'text-anchor': 'end' }, f(v));
  }
  make('line', { x1: 72, x2: 792, y1: Y(0), y2: Y(0), class: 'df-axis' });
  make('line', { x1: 72, x2: 72, y1: 20, y2: 245, class: 'df-axis' });
  make('line', { x1: 72, x2: 792, y1: Y(r.finalValue), y2: Y(r.finalValue), class: 'df-final' });
  r.samples.forEach((v, k) => {
    make('line', { x1: X(k), x2: X(k), y1: Y(0), y2: Y(v), class: 'df-stem' });
    make('circle', { cx: X(k), cy: Y(v), r: r.N > 150 ? 1.5 : 2.5, class: 'df-dot' });
  });
  const marker = (k: number, text: string, className: string) => {
    make('line', { x1: X(k), x2: X(k), y1: 20, y2: 245, class: className });
    make('circle', { cx: X(k), cy: Y(r.samples[k]), r: 6, class: 'df-ring' });
    make('text', { x: Math.min(720, Math.max(90, X(k))), y: className === 'df-selected' ? 34 : 15, 'text-anchor': 'middle' }, text);
  };
  marker(selected, `inspect k=${selected}`, 'df-selected');
  if (reveal) {
    marker(r.peak, `largest k=${r.peak}`, 'df-marker');
    if (r.settling !== null) marker(r.settling, `settles k=${r.settling}`, 'df-marker');
  }
  for (let i = 0; i <= 4; i++) {
    const k = Math.round(r.N * i / 4);
    make('text', { x: X(k), y: 266, 'text-anchor': 'middle' }, String(k));
    make('text', { x: X(k), y: 285, 'text-anchor': 'middle' }, f(k * r.T));
  }
  make('text', { x: 12, y: 15 }, 'y[k]');
  make('text', { x: 8, y: 266 }, 'k');
  make('text', { x: 8, y: 285 }, 't (s)');
  make('text', { x: 432, y: 311, 'text-anchor': 'middle' }, `Stems: discrete samples · dashed: final value · shaded: ${r.band * 100}% band`);
  return svg;
}
const matrix = (rows: number[][]) => `\\begin{bmatrix}${rows.map(row => row.map(f).join('&')).join('\\\\')}\\end{bmatrix}`;

export const mount: ModuleMount = ({ container, signal }) => {
  const root = document.createElement('div'); root.className = 'df-tool';
  root.innerHTML = `
    <section class="df-card"><h3>1. Set the sampled system</h3>
      <p>Unit step from k = 0; zero state and zero input/output history before k = 0. The first output is y[0], including direct feedthrough. This is the entered input-to-output channel, with no added feedback.</p>
      <div class="df-equation"></div>
      <p class="df-muted">One fraction of real polynomials in z, degree 1 or 2 in the denominator; numerator degree no larger. Decimal coefficients, products, parentheses and powers 0–2. Every denominator pole must be strictly inside the unit circle. No cancellation is used to hide modes.</p>
      <div class="df-controls">
        <label>Sample period T (s)<input name="period" type="number" min="0.000001" max="1000" step="any" value="0.1"></label>
        <label>Last sample index N<input name="horizon" type="number" min="2" max="500" step="1" value="60"></label>
        <label>Settling band<select name="band"><option value="0.02">2% of |final value|</option><option value="0.05">5% of |final value|</option></select></label>
      </div>
      <div class="df-actions"><button type="button" class="button" data-action="plot">Plot response</button><button type="button" class="button" data-action="oscillatory">Oscillatory experiment</button><button type="button" class="button" data-action="slow">Short-horizon experiment</button><button type="button" class="button" data-action="baseline">Baseline inputs</button></div>
      <p class="df-status" role="status" aria-live="polite"></p>
    </section>
    <section class="df-card"><h3>2. Read the samples and make a prediction</h3>
      <p>Find the largest plotted output in the direction of the final value (a downward extremum for negative gain). For settling, find the first sample after which the response stays in the band. A first entry alone is insufficient.</p>
      <div class="df-plot"></div>
      <div class="df-controls">
        <label>Inspect sample k<input name="inspect" type="number" min="0" max="60" step="1" value="0"></label>
        <label>Your largest-sample index<input name="peak" type="number" min="0" max="500" step="1" placeholder="e.g. 12"></label>
        <label>Your first settling index<input name="settling" type="number" min="0" max="500" step="1" placeholder="e.g. 18"></label>
      </div>
      <label class="df-check"><input name="unestablished" type="checkbox"> I think settling is not established by this horizon</label>
      <p class="df-inspector" aria-live="polite"></p>
      <div class="df-actions"><button type="button" class="button" data-action="reveal">Check predictions and reveal reasoning</button></div>
      <p class="df-feedback" role="status"></p>
      <p class="df-muted">The plot contains only samples. No continuous plant or hold is supplied, so it cannot establish a continuous intersample peak. Changing T changes seconds, not the sequence of this fixed discrete model.</p>
    </section>
    <section class="df-card df-answer" hidden><h3>3. Check the result and its assumptions</h3><div class="df-summary"></div><div class="df-reasoning"></div></section>
    <details class="df-card"><summary>Supported limits and numerical meaning</summary><p>Real SISO LTI proper transfer functions, order 1–2; no unstable or unit-circle denominator poles, no reduction by cancellation. Coefficient magnitudes at most 10⁶, leading denominator magnitude at least 10⁻¹⁰; |final value| from 10⁻⁹ to 10⁶. T from 10⁻⁶ to 1000 s, integer N from 2 to 500. One visual expression, at most 512 characters. Zero prehistory only. Unit input/output scales are inherited from the entered model.</p><p>Displayed decimal results are numerical approximations. Recurrence/state agreement uses relative tolerance 10⁻⁸. Settling includes a conservative bound on every future homogeneous-error sample using a contracting block of the error-state matrix (at most 4096 powers), with roundoff margin 10⁻¹⁰ times the response scale. If the bound does not fit inside the band, settling is “not established”; extend the horizon. This is stronger than testing only the final plotted point. Near-boundary numerical cases may remain unestablished.</p></details>`;
  container.append(root);
  const get = <T extends Element>(selector: string) => root.querySelector<T>(selector)!;
  const number = (name: string) => get<HTMLInputElement>(`[name="${name}"]`);
  const status = get<HTMLElement>('.df-status'), plot = get<HTMLElement>('.df-plot');
  const answer = get<HTMLElement>('.df-answer'), feedback = get<HTMLElement>('.df-feedback');
  let draft: EquationDraft;
  let result: Result | undefined;
  let revealed = false;
  const field = createEquationInput({ label: 'System transfer function G(z)', value: String.raw`G(z)=\frac{0.2}{z-0.8}`, signal,
    onChange: next => { draft = next; invalidate(); } });
  get('.df-equation').append(field.element); draft = field.getValue();
  function invalidate(): void {
    result = undefined; revealed = false; answer.hidden = true; feedback.textContent = '';
    plot.textContent = 'Inputs changed. Plot the response to use the new values.';
    get('.df-inspector').textContent = '';
    status.textContent = 'Inputs changed. Choose Plot response to recompute.';
  }
  function inspect(): void {
    if (!result || signal.aborted) return;
    const k = Number(number('inspect').value);
    if (number('inspect').value === '' || !Number.isInteger(k) || k < 0 || k > result.N) {
      get('.df-inspector').textContent = `Enter an integer sample index from 0 to ${result.N}.`; return;
    }
    plot.replaceChildren(graph(result, k, revealed));
    get('.df-inspector').textContent = `k = ${k}; t = ${f(k * result.T)} s; recurrence y[k] = ${f(result.samples[k])}; state y[k] = ${f(result.stateSamples[k])}; distance from final value = ${f(Math.abs(result.samples[k] - result.finalValue))}. ${Math.abs(result.samples[k] - result.finalValue) <= result.bandWidth ? 'Inside' : 'Outside'} the ${result.band * 100}% band.`;
  }
  function compute(): void {
    if (signal.aborted) return;
    answer.hidden = true; feedback.textContent = ''; revealed = false;
    try {
      draft = field.getValue();
      if (draft.empty || draft.hasPlaceholders || draft.syntaxIssues.length) throw new Error('Complete the transfer-function equation and check its notation.');
      if (!number('period').value || !number('horizon').value) throw new Error('Enter both T and the last sample index N.');
      result = analyze(parseTransfer(draft.latex), Number(number('period').value), Number(number('horizon').value), Number(get<HTMLSelectElement>('[name="band"]').value));
      number('inspect').max = String(result.N); number('inspect').value = '0';
      status.textContent = `Computed ${result.N + 1} samples (k = 0…${result.N}); time 0…${f(result.N * result.T)} s. Make your prediction, then reveal the check.`;
      inspect();
    } catch (error) {
      result = undefined; plot.textContent = 'No response computed for these inputs.';
      get('.df-inspector').textContent = '';
      status.textContent = error instanceof Error ? error.message : 'Check the inputs.';
    }
  }
  function preset(kind: string): void {
    field.setValue(kind === 'oscillatory' ? String.raw`G(z)=\frac{1.25}{z^{2}+0.25}` : kind === 'slow' ? String.raw`G(z)=\frac{0.01}{z-0.99}` : String.raw`G(z)=\frac{0.2}{z-0.8}`);
    draft = field.getValue(); number('period').value = '0.1'; number('horizon').value = kind === 'oscillatory' ? '40' : kind === 'slow' ? '20' : '60';
    get<HTMLSelectElement>('[name="band"]').value = '0.02';
    number('peak').value = ''; number('settling').value = ''; number('unestablished').checked = false;
    compute();
  }
  function reveal(): void {
    if (!result) { status.textContent = 'Plot a valid response before checking predictions.'; return; }
    const r = result;
    const validAttempt = (name: string) => number(name).value !== '' && Number.isInteger(Number(number(name).value)) && Number(number(name).value) >= 0 && Number(number(name).value) <= r.N;
    const peakFeedback = !validAttempt('peak') ? `Enter a largest-sample index from 0 to ${r.N} to compare.`
      : Number(number('peak').value) === r.peak ? 'Largest plotted sample: correct (first occurrence if tied).' : `Largest plotted sample: check k = ${r.peak}.`;
    const settlingFeedback = number('unestablished').checked ? r.settling === null ? 'Correct: settling is not established.' : `Settling is established at k = ${r.settling}.`
      : !validAttempt('settling') ? `Enter a settling index from 0 to ${r.N}, or select “not established”.`
      : r.settling === null ? 'Settling is not established; extend N to test the tail.' : Number(number('settling').value) === r.settling ? 'Settling index: correct.' : `Settling index: check k = ${r.settling}, including every subsequent sample.`;
    feedback.textContent = `${peakFeedback} ${settlingFeedback}`;
    revealed = true; answer.hidden = false;
    const summary = get('.df-summary'); summary.replaceChildren();
    const p = (text: string) => { const el = document.createElement('p'); el.textContent = text; summary.append(el); };
    p(`Final value G(1) = ${f(r.finalValue)}; band [${f(r.finalValue - r.bandWidth)}, ${f(r.finalValue + r.bandWidth)}]. Largest plotted sample: k = ${r.peak}, t = ${f(r.peak * r.T)} s, y = ${f(r.samples[r.peak])}. Observed overshoot in the final-value direction = ${f(r.overshoot)}%.`);
    p(r.peakEstablished ? 'The tail bound also establishes this directional sampled peak globally (earliest occurrence shown).'
      : 'This is the largest plotted sample. A finite global peak is not established; a monotone response can approach its final value without attaining it.');
    p(r.settling === null ? `Settling: not established by N = ${r.N}. Extend the horizon; the final plotted sample is not a settling-time answer.`
      : `First settling sample kₛ = ${r.settling}; tₛ = kₛT = ${r.settling} × ${f(r.T)} = ${f(r.settling * r.T)} s. The band includes its boundary; a small roundoff margin is reserved.`);
    p(`All unplotted errors are bounded ${r.tailBound === null ? 'by no established contraction within the work limit' : `by ${f(r.tailBound)}`}; band half-width = ${f(r.bandWidth)}. Maximum denominator-pole radius = ${f(r.radius)}. State/recurrence maximum difference = ${f(r.residual)}.`);
    const reasoning = get('.df-reasoning'); reasoning.replaceChildren();
    const equation = (latex: string, label: string) => reasoning.append(createEquationDisplay(latex, label));
    equation(`G(z)=\\frac{${polynomialLatex(r.b, 'z')}}{${polynomialLatex(r.a, 'z')}}`, 'Normalized transfer function, descending powers');
    const terms = (coeff: number[], symbol: string, start: number) => coeff.slice(start).map((v, j) => `${j ? '+' : ''}(${f(v)})${symbol}[k${j + start ? `-${j + start}` : ''}]`).join('');
    equation(`y[k]=${terms(r.b, 'u', 0)}${r.a.slice(1).map((v, i) => `-(${f(v)})y[k-${i + 1}]`).join('')}`, 'Output recurrence from denominator times output equals numerator times input');
    equation(`x[k+1]=${matrix(r.A)}x[k]+${matrix(r.B.map(v => [v]))}u[k]`, 'Controllable state update');
    equation(`y[k]=${matrix([r.C])}x[k]+(${f(r.D)})u[k],\\quad x[0]=0`, 'Output is read before state update');
    equation(`y_\\infty=G(1)=\\frac{${f(r.b.reduce((s, v) => s + v, 0))}}{${f(r.a.reduce((s, v) => s + v, 0))}}=${f(r.finalValue)}`, 'Final value from stable unit-step transfer');
    equation(`|y[k]-y_\\infty|\\le ${f(r.bandWidth)}\\quad\\text{for every } k\\ge k_s,\\qquad t_s=k_sT`, 'Settling convention');
    const note = document.createElement('p'); note.textContent = 'Coefficients above are in descending powers of z. The recurrence and state realization are stepped independently with identical zero prehistory; x stores the internal delay values. Output y[k] is read first, then all state entries update together. Stable unreduced poles justify the final-value limit. A sampled maximum does not establish a continuous peak.';
    reasoning.append(note); inspect();
  }
  ['period', 'horizon', 'band'].forEach(name => get(`[name="${name}"]`).addEventListener('input', invalidate, { signal }));
  number('inspect').addEventListener('input', inspect, { signal });
  root.querySelectorAll<HTMLButtonElement>('[data-action]').forEach(button => button.addEventListener('click', () => {
    const action = button.dataset.action!;
    if (action === 'plot') compute(); else if (action === 'reveal') reveal(); else preset(action);
  }, { signal }));
  compute();
  return () => { result = undefined; field.destroy(); root.remove(); };
};
