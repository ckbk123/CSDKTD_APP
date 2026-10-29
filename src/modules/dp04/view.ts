import type { ModuleMount } from '../../core/module';
import { createEquationDisplay, createEquationInput, type EquationDraft } from '../../shared/equations/input';
import { readNumericInput } from '../../shared/numeric-input';
import { parseModel } from './input';
import { ANGLE_TOLERANCE, CIRCLE_TOLERANCE, MIN_NONZERO, asymptotes, breakPoints, collisionGains, diskClass, inverseMode, magnitude, modalSamples, phase, poles, realSegments, rootsAt, testPoint, trace, zero, type Complex, type Model, type PointTest, type Segment } from './math';
import { complexText, intervalText, numberText as n, polynomialTex as polynomial } from './format';
import { locusPlot, modePlot } from './plots';
import './style.css';

interface Exercise { model: Model; period: number; maximum: number; range: number; intervals: number; segments: readonly Segment[]; revealed: boolean; path?: ReturnType<typeof trace>; plottedPoint: Complex | null; candidate: PointTest | null }

export const mount: ModuleMount = ({ container, signal }) => {
  const root = document.createElement('div'); root.className = 'rl-tool';
  root.innerHTML = `
    <section class="rl-card">
      <h3>1. Set the fixed loop factor</h3>
      <p>Use negative feedback: 1 + K L₀(z) = 0, with K ≥ 0 and L₀ = B/D. This lesson keeps the entire quadratic characteristic polynomial, including common factors.</p>
      <div class="rl-presets" role="group" aria-label="Root-locus experiments">
        <button type="button" data-preset="baseline">Baseline zero −0.2</button><button type="button" data-preset="changed">Move zero to −0.5</button><button type="button" data-preset="constant">Constant numerator</button><button type="button" data-preset="negative">Negative fixed factor</button><button type="button" data-preset="common">Retain a common factor</button>
      </div>
      <div class="rl-editor"></div>
      <p class="rl-help">Enter the fixed factor without K or a function-name label. Use a fraction of real polynomials in z, or products of such factors: decimals, fractions, visible parentheses and literal powers 0–2. Use explicit + or × before an adjacent fraction. Sums of rational functions and e/E symbols are unsupported here; native numeric fields accept scientific notation.</p>
      <div class="rl-controls">
        <label>Gain window Kmax<input type="number" data-number="maximum" value="4" min="0.01" max="100" step="any"></label>
        <label>Selected gain K<input type="number" data-number="gain" value="1" min="0" max="100" step="any"></label>
        <label>Sample period T (s)<input type="number" data-number="period" value="0.1" min="0.001" max="10" step="any"></label>
        <label>Plot half-range (z units)<input type="number" data-number="range" value="3" min="1.25" max="20" step="any"></label>
        <label>Modal intervals N<input type="number" data-number="intervals" value="12" min="4" max="30" step="1"></label>
      </div>
      <button type="button" class="rl-primary" data-action="build">Build the construction exercise</button>
      <p class="rl-message" role="status" aria-live="polite">Build the pole/zero view, predict the real-axis segments, then reveal the branches.</p>
    </section>
    <section class="rl-card rl-quiz" hidden>
      <h3>2. Predict the real-axis segments</h3>
      <div class="rl-model"></div><div class="rl-preview"></div>
      <p>Choose every open interval that belongs to the K ≥ 0 locus. Count real poles and zeros to its right, including multiplicity, and account for the sign of the fixed numerator. Leave all unchecked if none belongs.</p>
      <fieldset class="rl-intervals"><legend>Your predicted intervals</legend><div class="rl-choices"></div></fieldset>
      <button type="button" class="rl-primary" data-action="reveal">Check segments and reveal branches</button>
    </section>
    <div class="rl-results" hidden>
      <section class="rl-card"><h3>3. Read the construction</h3><div class="rl-construction"></div></section>
      <section class="rl-card">
        <h3>4. Move the gain cursor</h3><label>Gain cursor K<input type="range" data-number="cursor" value="1" min="0" max="4" step="any"></label><p class="rl-cursor-value"></p>
        <div class="rl-overlays" role="group" aria-label="Construction overlays">
          <label><input type="checkbox" data-overlay="segments" checked>Real-axis segments</label><label><input type="checkbox" data-overlay="asymptotes" checked>Asymptotes</label><label><input type="checkbox" data-overlay="breaks" checked>Break candidates</label><label><input type="checkbox" data-overlay="branches" checked>Sampled branches</label><label><input type="checkbox" data-overlay="vectors" checked>Candidate vectors</label>
        </div><div class="rl-plot"></div><div class="rl-selected"></div>
      </section>
      <section class="rl-card">
        <h3>5. Test a candidate through angle and magnitude</h3>
        <p>Coordinates change the tested point only when you press Test. An invalid candidate keeps the previous plotted point, whose coordinates remain in the plot caption.</p>
        <div class="rl-controls"><label>Candidate real coordinate<input type="number" data-number="pointReal" value="0" min="-50" max="50" step="any"></label><label>Candidate imaginary coordinate<input type="number" data-number="pointImag" value="0.447213595499958" min="-50" max="50" step="any"></label></div>
        <div class="rl-actions"><button type="button" data-action="point">Test candidate point</button><button type="button" data-action="usePoint" disabled>Use the matching gain</button></div>
        <div class="rl-point-feedback" role="status" aria-live="polite">Test a point to draw its vectors.</div>
      </section>
      <section class="rl-card"><h3>6. Interpret the selected root modes</h3><div class="rl-modes"></div></section>
    </div>
    <details class="rl-card"><summary>Supported domain, conventions and tolerances</summary>
      <p>D(z) has degree two and is normalized to z²+a₁z+a₀; B(z)=b₁z+b₀ is nonzero. Every normalized coefficient has magnitude ≤100; the largest numerator coefficient is at least 0.0001. Open poles and the finite zero have radius ≤20. Both characteristic roots are retained without cancellation.</p>
      <p>Visual source: ≤512 characters, 128 expanded tokens, eight visible grouping/fraction levels; intermediate degree ≤4 and coefficient magnitude ≤10¹². Nonzero literal/product/quotient underflow is rejected. Polynomial arithmetic and roots are numerical approximations. Native gain window .01–100, K from zero to that window, T .001–10 s, plot half-range 1.25–20, N integer 4–30 and candidate coordinates within ±50.</p>
      <p>Nonzero normalized coefficients, selected K and candidate components must have magnitude at least 10⁻¹⁰⁰; exact zero is supported. Smaller nonzero inputs require rescaling. Scaled root residual tolerance 10⁻¹⁰; unit-circle band ±10⁻⁹; candidate angle tolerance 10⁻⁷ rad plus scaled imaginary-gain tolerance 10⁻⁸. Branch curves contain 241 gain samples plus supported collision gains in the window. A finite trace does not prove the entire stable-gain region; enter matching coefficients manually in DS04 for that exercise.</p>
      <p>Unit root-mode samples are Re(zᵏ), starting at amplitude 1. They are not a closed-loop step response. Conjugate roots share a real cosine basis; repeated nonzero roots can add k·zᵏ terms. Repeated zero roots can have a finite transient depending on realization and initial conditions. Modal roots support radius ≤20000 and amplitudes ≤10¹⁵⁰; tiny decaying tails may round to zero. The inverse frequency uses the principal branch and samples alone do not select a unique continuous frequency.</p>
    </details>`;
  container.append(root);
  const get = <T extends HTMLElement>(selector: string): T => root.querySelector<T>(selector)!;
  const input = (name: string) => get<HTMLInputElement>(`[data-number="${name}"]`);
  const action = (name: string) => get<HTMLButtonElement>(`[data-action="${name}"]`);
  const message = get('.rl-message'), quiz = get('.rl-quiz'), results = get('.rl-results');
  let draft: EquationDraft, exercise: Exercise | undefined, displayedGain = 1;
  const say = (parent: HTMLElement, text: string, tag = 'p') => { const node = document.createElement(tag); node.textContent = text; parent.append(node); return node; };
  const equation = (parent: HTMLElement, latex: string, label: string) => parent.append(createEquationDisplay(latex, label));
  const table = (headers: readonly string[], rows: readonly (readonly string[])[], label: string): HTMLElement => {
    const wrap = document.createElement('div'); wrap.className = 'rl-scroll'; wrap.tabIndex = 0; wrap.setAttribute('role', 'region'); wrap.setAttribute('aria-label', `${label}, scroll horizontally if needed`);
    const node = document.createElement('table'), head = document.createElement('thead'), headRow = document.createElement('tr'), body = document.createElement('tbody');
    for (const text of headers) say(headRow, text, 'th'); head.append(headRow);
    for (const row of rows) { const item = document.createElement('tr'); for (const text of row) say(item, text, 'td'); body.append(item); }
    node.append(head, body); wrap.append(node); return wrap;
  };
  const numeric = (name: string, label: string) => readNumericInput(input(name), label);
  const gainValue = (maximum: number) => { const gain = numeric('gain', 'selected gain K'); if (gain < 0 || gain > maximum) throw new Error(`Select K from 0 to the current window ${n(maximum)}.`); if (gain !== 0 && gain < MIN_NONZERO) throw new Error('Use 0 explicitly or a selected gain of at least 10⁻¹⁰⁰. Rescale smaller nonzero gains.'); return gain; };
  const invalidate = () => {
    if (signal.aborted) return;
    exercise = undefined; quiz.hidden = true; results.hidden = true; action('usePoint').disabled = true;
    message.textContent = 'Inputs changed. Build a new construction exercise.';
  };
  const editor = createEquationInput({ label: 'Fixed loop factor L₀(z), without K', value: String.raw`\frac{z+0.2}{z(z-1)}`, signal, onChange: next => { draft = next; invalidate(); } });
  get('.rl-editor').append(editor.element); draft = editor.getValue();

  function renderPlot(): void {
    if (!exercise) return;
    const overlay = (name: string) => get<HTMLInputElement>(`[data-overlay="${name}"]`).checked;
    get('.rl-plot').replaceChildren(locusPlot(exercise.model, { range: exercise.range, branches: exercise.path?.branches, selected: rootsAt(exercise.model, displayedGain), candidate: exercise.plottedPoint, segments: overlay('segments'), asymptotes: overlay('asymptotes'), breaks: overlay('breaks'), vectors: overlay('vectors'), showBranches: overlay('branches') }));
  }
  function renderSelected(): void {
    if (!exercise?.revealed) return;
    const selected = rootsAt(exercise.model, displayedGain), area = get('.rl-selected'); area.replaceChildren();
    get('.rl-cursor-value').textContent = `Current K = ${n(displayedGain)}. The Selected gain K field in step 1 is the numeric alternative.`;
    say(area, `Displayed gain K = ${n(displayedGain)}; both unreduced roots are listed, including multiplicity.`, 'h4');
    equation(area, `P_K(z)\\approx ${polynomial(selected.coefficients)},\\quad P_K(z)=D(z)+KB(z)`, 'Selected unreduced characteristic polynomial');
    area.append(table(['Branch', 'Root z ≈', '|z| ≈', 'Scaled residual', 'σ = ln|z|/T (s⁻¹)', 'Principal ω (rad/s)'], selected.roots.map((point, index) => {
      const inverse = inverseMode(point, exercise!.period);
      return [String(index + 1), complexText(point), n(magnitude(point)), n(selected.residuals[index]), inverse ? n(inverse.sigma) : 'No finite inverse at z=0', inverse ? n(inverse.omega) : 'Undefined'];
    }), 'Entire selected characteristic root set'));
    const kind = diskClass(selected.roots);
    say(area, kind === 'inside' ? `Numerically inside: both radii are below 1 − ${n(CIRCLE_TOLERANCE)}. This checks the selected full characteristic set, not an entire gain interval.`
      : kind === 'outside' ? `Outside: at least one radius exceeds 1 + ${n(CIRCLE_TOLERANCE)}. A negative real part is not a discrete stability test.`
        : `Boundary or numerically near-boundary: at least one radius is within ${n(CIRCLE_TOLERANCE)} of 1. Strict disk stability is not certified here; repeated boundary roots can grow.`);
    if (selected.nearRepeated) say(area, 'The two roots are numerically close or repeated at this scale. Both rows are retained. Exactly repeated nonzero roots can add k·zᵏ terms; zero-root transients need their own initial-condition model. These unit-basis plots do not determine the full response.');
    const modes = get('.rl-modes'); modes.replaceChildren();
    equation(modes, String.raw`x_i[k]=\operatorname{Re}(z_i^k),\quad x_i[0]=1,\quad t_k=kT`, 'Unit-amplitude real root-mode basis');
    say(modes, `These are root-mode illustrations, not the closed-loop forced output. Conjugate roots give the same real cosine basis. Principal inverse σ+jω is only one logarithm branch; T = ${n(exercise.period)} s.`);
    const plots = document.createElement('div'); plots.className = 'rl-mode-grid';
    const samples = selected.roots.map((point, index) => {
      const values = modalSamples(point, exercise!.intervals); plots.append(modePlot(values, exercise!.period, index + 1)); return values;
    });
    modes.append(plots, table(['k', 't=kT (s)', 'Branch 1 Re(zᵏ)', 'Branch 2 Re(zᵏ)'], Array.from({ length: Math.min(6, exercise.intervals + 1) }, (_, index) => [String(index), n(index * exercise!.period), n(samples[0][index]), n(samples[1][index])]), 'First root-mode samples'));
    renderPlot();
  }
  function construction(choices: readonly boolean[]): void {
    if (!exercise) return;
    const area = get('.rl-construction'), m = exercise.model; area.replaceChildren();
    const fixed = m.b1 === 0 ? m.b0 : m.b1, asym = asymptotes(m);
    say(area, `The fixed leading numerator coefficient is ${n(fixed)}. Its phase is ${fixed < 0 ? '180°' : '0°'}: valid real intervals have an ${fixed < 0 ? 'even' : 'odd'} count to the right. Endpoints at poles/zeros are handled separately.`);
    area.append(table(['Open interval', 'Real poles + zeros to right', 'On K ≥ 0 locus', 'Your checked answer'], exercise.segments.map((segment, index) => [intervalText(segment, exercise!.segments), String(segment.rightCount), segment.onLocus ? 'Yes' : 'No', choices[index] ? 'Yes' : 'No']), 'Real-axis construction check'));
    equation(area, String.raw`c=\frac{\sum p_i-\sum z_i}{n-m},\quad\phi_q=\frac{(2q+1)\pi-\arg(c_B)}{n-m}`, 'Asymptote centroid and angles with fixed coefficient phase');
    say(area, `Centroid ≈ ${n(asym.centroid)}; asymptote directions ${asym.angles.map(angle => `${n(angle * 180 / Math.PI)}°`).join(', ')}. K remains nonnegative; a negative fixed factor changes these directions.`);
    equation(area, String.raw`K(z)=-\frac{D(z)}{B(z)},\quad D'B-DB'=b_1z^2+2b_0z+(a_1b_0-a_0b_1)=0`, 'Stationary real-gain candidate equation');
    const points = breakPoints(m);
    area.append(table(['Real candidate z ≈', 'K ≈', 'Admissibility'], points.map(point => [n(point.position), point.gain === null ? 'Undefined' : n(point.gain), point.reason === 'singular' ? 'B≈0: common/singular point, no ordinary magnitude break test' : point.reason === 'negative' ? 'Excluded: negative K' : point.reason === 'endpoint' ? 'K=0 endpoint' : point.gain! < MIN_NONZERO ? 'Positive K; below supported numerical scale' : point.gain! > exercise!.maximum ? 'Positive K; beyond current gain window' : 'Positive K in current window']), 'Break-point candidates'));
    if (!points.length) say(area, 'There are no real stationary-gain candidates for this model.');
    const collisions = collisionGains(m);
    say(area, `Unreduced branch-meeting gains from the characteristic discriminant: ${collisions.length ? collisions.map(n).join(', ') : 'none at K ≥ 0'}. This also retains fixed/moving-root intersections where D/B is undefined.`);
    equation(area, String.raw`A_K=a_1+Kb_1,\quad C_K=a_0+Kb_0,\quad z_{\pm}=\frac{-A_K\pm\sqrt{A_K^2-4C_K}}{2}`, 'Continuous quadratic characteristic branches');
    say(area, 'The square-root branches continue through collisions; roots are not independently re-sorted at each sample. At a collision the labels are a continuous convention, not distinguishable physical modes. The numerical trace is finite and does not prove a full stable-gain interval.');
  }
  function updateGain(): void {
    if (!exercise?.revealed || signal.aborted) return;
    try {
      displayedGain = gainValue(exercise.maximum); input('cursor').value = String(displayedGain);
      renderSelected(); results.hidden = false; message.textContent = `Displayed K = ${n(displayedGain)}. Inspect every root and its radius.`;
    } catch (error) { results.hidden = true; message.textContent = (error as Error).message; }
  }
  action('build').addEventListener('click', () => {
    if (signal.aborted) return;
    invalidate();
    try {
      if (draft.empty || draft.hasPlaceholders || draft.syntaxIssues.length) throw new Error('Complete the loop expression and every highlighted equation box.');
      const model = parseModel(draft.latex), maximum = numeric('maximum', 'gain window Kmax'), period = numeric('period', 'sample period T'), range = numeric('range', 'plot half-range'), intervals = numeric('intervals', 'modal intervals N');
      if (maximum < 0.01 || maximum > 100) throw new Error('Use Kmax from 0.01 to 100.');
      if (period < 0.001 || period > 10) throw new Error('Use T from 0.001 to 10 seconds.');
      if (range < 1.25 || range > 20) throw new Error('Use a plot half-range from 1.25 to 20.');
      if (!Number.isInteger(intervals) || intervals < 4 || intervals > 30) throw new Error('Use an integer modal horizon N from 4 to 30.');
      displayedGain = gainValue(maximum);
      exercise = { model, maximum, period, range, intervals, segments: realSegments(model), revealed: false, plottedPoint: null, candidate: null };
      input('cursor').max = String(maximum); input('cursor').value = String(displayedGain);
      const area = get('.rl-model'); area.replaceChildren();
      equation(area, `L_0(z)\\approx\\frac{${polynomial([model.b1, model.b0])}}{${polynomial([1, model.a1, model.a0])}}`, 'Numerically normalized fixed loop factor');
      say(area, `Open poles: ${poles(model).map(complexText).join('; ')}. ${zero(model) ? `Finite zero: ${complexText(zero(model)!)}` : 'No finite zero.'} Coefficient order is descending powers; the denominator is monic. No factor has been canceled.`);
      get('.rl-preview').hidden = false; get('.rl-preview').replaceChildren(locusPlot(model, { range }));
      const options = get('.rl-choices'); options.replaceChildren();
      exercise.segments.forEach((segment, index) => { const label = document.createElement('label'), checkbox = document.createElement('input'); label.className = 'rl-choice'; checkbox.type = 'checkbox'; checkbox.dataset.interval = String(index); label.append(checkbox, document.createTextNode(intervalText(segment, exercise!.segments))); options.append(label); });
      quiz.hidden = false; get('.rl-point-feedback').textContent = 'Test a point to draw its vectors.';
      message.textContent = 'Pole/zero view built. Predict the real-axis intervals, then check and reveal.';
    } catch (error) { exercise = undefined; message.textContent = (error as Error).message; }
  }, { signal });
  action('reveal').addEventListener('click', () => {
    if (!exercise || signal.aborted) return;
    try {
      displayedGain = gainValue(exercise.maximum);
      const choices = [...root.querySelectorAll<HTMLInputElement>('[data-interval]')].map(field => field.checked);
      exercise.path = trace(exercise.model, exercise.maximum); exercise.revealed = true;
      construction(choices); renderSelected(); results.hidden = false;
      get('.rl-preview').hidden = true;
      message.textContent = `${choices.every((choice, index) => choice === exercise!.segments[index].onLocus) ? 'Correct interval prediction.' : 'Revisit your interval prediction.'} The construction table explains each interval; all selected roots are now visible.`;
    } catch (error) { results.hidden = true; message.textContent = (error as Error).message; }
  }, { signal });
  action('point').addEventListener('click', () => {
    if (!exercise?.revealed || signal.aborted) return;
    const area = get('.rl-point-feedback'); area.replaceChildren(); exercise.candidate = null; action('usePoint').disabled = true;
    try {
      const point = { re: numeric('pointReal', 'candidate real coordinate'), im: numeric('pointImag', 'candidate imaginary coordinate') }, result = testPoint(exercise.model, point);
      if (result.kind !== 'regular') {
        say(area, result.kind === 'pole' ? 'This is a K=0 open-loop pole endpoint; the ordinary angle ratio is undefined. Select K=0 to inspect every endpoint root.'
          : result.kind === 'zero' ? 'B is zero here: there is no finite magnitude gain at this point.'
            : result.kind === 'common' ? 'D and B both evaluate to zero at this precision. An exact common root is fixed for every K; a 0/0 ratio cannot choose a unique gain. Factors are retained.' : 'The point is too close to a singular pole/zero for the declared angle/magnitude tolerance.');
        say(area, 'The previous valid plotted point is retained.'); return;
      }
      exercise.plottedPoint = point; exercise.candidate = result;
      equation(area, String.raw`\arg L_0=\arg c_B+\sum\arg(z-z_i)-\sum\arg(z-p_i),\quad K_{\mathrm{mag}}=\left|\frac{D(z)}{B(z)}\right|`, 'Vector angle and magnitude conditions');
      const vectors = poles(exercise.model).map((source, index) => {
        const vector = { re: point.re - source.re, im: point.im - source.im };
        return [`Pole p${index + 1}`, complexText(source), n(magnitude(vector)), `${n(phase(vector) * 180 / Math.PI)}°`, 'Subtract angle'];
      });
      const finiteZero = zero(exercise.model);
      if (finiteZero) { const vector = { re: point.re - finiteZero.re, im: point.im - finiteZero.im }; vectors.push(['Zero', complexText(finiteZero), n(magnitude(vector)), `${n(phase(vector) * 180 / Math.PI)}°`, 'Add angle']); }
      const coefficient = exercise.model.b1 === 0 ? exercise.model.b0 : exercise.model.b1;
      vectors.push(['Fixed coefficient', n(coefficient), '—', coefficient < 0 ? '180°' : '0°', 'Add phase']);
      area.append(table(['Vector source', 'Source coordinate', 'Vector length ≈', 'Vector angle ≈', 'Contribution'], vectors, 'Candidate angle-vector contributions'));
      say(area, `Tested point ${complexText(point)}. Vector angle total ≈ ${n(result.vectorTotal! * 180 / Math.PI)}°; principal loop phase ≈ ${n(result.angle! * 180 / Math.PI)}°; distance to an odd multiple of 180° ≈ ${n(result.angleError!)} rad.`);
      say(area, `Direct −D/B ≈ ${complexText(result.gain!)}; magnitude-only gain ≈ ${n(result.magnitudeGain!)}. A magnitude alone does not put a point on the locus.`);
      say(area, result.onLocus ? `Angle and real positive gain conditions agree within ${n(ANGLE_TOLERANCE)} rad and scaled imaginary-gain tolerance 10⁻⁸.` : 'The positive-real gain/angle conditions fail at this point.');
      const inWindow = result.onLocus && result.gain!.re >= MIN_NONZERO && result.gain!.re <= exercise.maximum;
      action('usePoint').disabled = !inWindow;
      if (result.onLocus && !inWindow) say(area, result.gain!.re < MIN_NONZERO ? 'This positive gain is below the supported numerical scale. Rescale the fixed loop factor.' : 'This positive gain is outside the current gain window. Change the window within its supported bounds and rebuild; it is not clipped silently.');
      renderPlot();
    } catch (error) { say(area, (error as Error).message); say(area, 'The previous valid plotted point is retained.'); }
  }, { signal });
  action('usePoint').addEventListener('click', () => {
    if (!exercise?.candidate?.onLocus || signal.aborted) return;
    const gain = exercise.candidate.gain!.re; if (gain < MIN_NONZERO || gain > exercise.maximum) return;
    input('gain').value = String(gain); updateGain();
  }, { signal });
  input('gain').addEventListener('input', updateGain, { signal });
  input('cursor').addEventListener('input', () => { input('gain').value = input('cursor').value; updateGain(); }, { signal });
  for (const name of ['maximum', 'period', 'range', 'intervals']) input(name).addEventListener('input', invalidate, { signal });
  for (const field of root.querySelectorAll<HTMLInputElement>('[data-overlay]')) field.addEventListener('change', () => { if (exercise?.revealed) renderPlot(); }, { signal });
  for (const name of ['pointReal', 'pointImag']) input(name).addEventListener('input', () => { if (exercise) { exercise.candidate = null; action('usePoint').disabled = true; get('.rl-point-feedback').textContent = 'Coordinates changed. Test them to apply; the previous plotted point is retained.'; } }, { signal });
  const presets: Readonly<Record<string, string>> = { baseline: String.raw`\frac{z+0.2}{z(z-1)}`, changed: String.raw`\frac{z+0.5}{z(z-1)}`, constant: String.raw`\frac{1}{z(z-1)}`, negative: String.raw`-\frac{1}{z(z-1)}`, common: String.raw`\frac{z-2}{(z-2)(z+0.5)}` };
  for (const button of root.querySelectorAll<HTMLButtonElement>('[data-preset]')) button.addEventListener('click', () => {
    editor.setValue(presets[button.dataset.preset!]); draft = editor.getValue();
    for (const [name, value] of Object.entries({ maximum: 4, gain: 1, period: 0.1, range: 3, intervals: 12, pointReal: 0, pointImag: Math.sqrt(0.2) })) input(name).value = String(value);
    invalidate(); message.textContent = 'Experiment loaded. Build it, predict the intervals and reveal.';
  }, { signal });
  return () => { editor.destroy(); root.remove(); };
};
