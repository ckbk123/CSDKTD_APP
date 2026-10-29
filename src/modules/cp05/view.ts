import type { ModuleMount } from '../../core/module';
import type { MathfieldElement } from 'mathlive';
import { createEquationInput, createEquationDisplay, type EquationInput } from '../../shared/equations/input';
import { readNumericInput } from '../../shared/numeric-input';
import { latexR, type Poly } from './exact';
import { parsePolynomial } from './expression';
import { atFrequency, construct, response, type Complex, type Construction, type Point, type Response } from './nyquist';
import { makePlots, type Prediction } from './plotting';
import './workspace.css';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, text = '', cls = ''): HTMLElementTagNameMap[K] { const n = document.createElement(tag); n.textContent = text; if (cls) n.className = cls; return n; }
const fmt = (n: number) => Number(n.toPrecision(8)).toString();
const nf = (n: number) => { const p = fmt(n).split('e'); return p.length > 1 ? `${p[0]}\\times10^{${Number(p[1])}}` : p[0]; };
const complex = (z: Complex) => `${nf(z.re)}${Number(fmt(z.im)) < 0 ? '-' : '+'}${nf(Math.abs(z.im))}j`;
const description = (r: Response) => r.kind === 'undefined' ? r.message : r.phase === null ? `|L|≈${fmt(r.magnitude)}; phase is undefined at a zero (or below numerical resolution); dB tends to−∞.` : `|L|≈${fmt(r.magnitude)}; ${fmt(r.db!)}dB; principal phase≈${fmt(r.phase * 180 / Math.PI)}°.`;

export const mountView: ModuleMount = ({ container, signal }) => {
  const root = el('div', '', 'cp05-tool'), editors: EquationInput[] = [], message = el('p', 'Prepare the contour, predict a mapped point, then reveal the checked curve.', 'cp05-message'); message.setAttribute('role', 'status');
  const workspace = el('section', '', 'cp05-workspace'); workspace.hidden = true;
  let contour: Construction | undefined, active: Point | undefined, revealed = false, mode: 'frequency' | 'sample' = 'frequency', predictions: Prediction[] = [];
  const selected = el('div', '', 'cp05-card'), checked = el('div', '', 'cp05-card'), diagrams = el('div'), limits = el('div', '', 'cp05-card'); checked.hidden = true; limits.hidden = true;
  function invalidate() { contour = undefined; active = undefined; revealed = false; predictions = []; workspace.hidden = true; message.textContent = 'Inputs changed. Prepare a fresh contour and attempt.'; }
  function button(name: string, action: () => void) { const b = el('button', name); b.type = 'button'; b.addEventListener('click', action, { signal }); return b; }
  function editor(label: string, value: string) {
    const input = createEquationInput({ label, value, signal, onChange: invalidate }); editors.push(input); const field = input.element.querySelector<MathfieldElement>('math-field'); if (field) field.smartSuperscript = false;
    input.element.addEventListener('keydown', event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); window.mathVirtualKeyboard.hide(); } }, { capture: true, signal }); return input;
  }
  function parse(input: EquationInput, label: string, allowZero = false): Poly { const d = input.getValue(); if (d.empty || d.hasPlaceholders || d.syntaxIssues.length) throw new Error(`Complete ${label} in the visual editor.`); return parsePolynomial(d.latex, allowZero); }
  function numeric(label: string, value: string) { const wrap = el('label', '', 'cp05-field'), input = el('input'); input.type = 'number'; input.step = 'any'; input.value = value; input.setAttribute('aria-label', label); wrap.append(el('span', label), input); return { wrap, input }; }
  function spanValue() { const n = readNumericInput(span.input, 'mapped half-span'); if (n < .01 || n > 1e6) throw new Error('Mapped half-span must be from0.01 to1,000,000 gain units.'); return n; }
  function omegaValue() { const n = readNumericInput(omega.input, 'Bode frequency'); if (!contour || n < 0 || n > contour.radius) throw new Error('Choose Bode frequency from0 toR rad/s.'); return n; }
  root.append(el('h2', 'Follow a contour into its mapped plane'), el('p', 'Construct L(s)=N(s)/D(s) for the declared negative-unity-feedback loop. This tool maps a complete finite contour; the formal Nyquist stability count belongs to CS04. A positive-frequency sketch alone is not the complete criterion.'));
  const fields = el('div', '', 'cp05-grid'), numerator = editor('Loop numerator N(s)', '4'), denominator = editor('Loop denominator D(s)', '(s+1)(s+2)'); fields.append(numerator.element, denominator.element); root.append(fields);
  const radius = numeric('Contour radius R (s⁻¹)', '10'), epsilon = numeric('Indent radius ε (s⁻¹)', '.1'), span = numeric('Mapped half-span (gain units)', '3'), geometry = el('div', '', 'cp05-grid'); geometry.append(radius.wrap, epsilon.wrap, span.wrap); root.append(geometry);
  radius.input.addEventListener('input', invalidate, { signal }); epsilon.input.addEventListener('input', invalidate, { signal });
  span.input.addEventListener('input', () => { if (contour) refresh(); }, { signal });
  const conventions = el('details', '', 'cp05-card'); conventions.append(el('summary', 'Contour convention and supported inputs'), el('p', 'Real rational proper N/D: denominator degree1–3 and numerator no higher. Enter polynomial sums/products, decimals and visual fractions in separate fields; division inside a polynomial field is by numbers only. Coefficients must be dimensionally consistent with seconds as the time unit. Source real parts use s⁻¹ and imaginary-axis frequency uses rad/s; mapped real/imaginary coordinates are gain units. No sample period or initial history is used.'), el('p', 'The source travels upward from−jR to+jR, detouring into the right half-plane around each imaginary-axis denominator root, then returns along the clockwise outer semicircle. This is a finite approximation to the limiting contour. R:0.01–10,000; ε:10⁻⁵–1 and<R/4, with disjoint indents separated from other roots. Outer-arc/endpoint collisions are rejected. Axis roots outside this finite radius are listed explicitly.'), el('p', 'Input limits:600 characters,240 symbols,24 group levels,15 digits per decimal; primitive integer height≤10,000 and normalized coefficient magnitudes≤10⁶. Exact rational arithmetic≤60 digits. The contour has≤1,200 samples; each axis/indent segment65 and the outer arc129. Bode uses241 positive log samples plusDC and known axis poles/zeros. Numerical denominator threshold10⁻¹⁰ relative to construction scale; zero-phase threshold10⁻¹⁴. Pole coordinates pass residual≤10⁻⁹ and complete coefficient reconstruction≤10⁻⁷. Failures and clipped/unresolved segments are reported, never replaced by finite answers.'), el('p', 'Use complete fraction and power boxes. A space alone is not a numerator, denominator or exponent. Mixed numbers need explicit +; use × for multiplication. Numeric results round to8 significant digits. Phase is principal phase; ±180° are the same negative-real direction.')); root.append(conventions);
  const presets = el('div', '', 'cp05-actions');
  for (const [name, n, d] of [['Baseline loop', '4', '(s+1)(s+2)'], ['First-order variation', '1', 's+1'], ['Origin pole', '1', 's'], ['Repeated origin pole', '1', 's^2'], ['Axis conjugate pair', '1', 's^2+1'], ['Removable original point', 's', 's'], ['Unstable open-loop example', '4', '(s-1)(s+2)']]) presets.append(button(name, () => { numerator.setValue(n); denominator.setValue(d); invalidate(); })); root.append(presets);
  const omega = numeric('Bode frequency ω (rad/s)', '1'), index = numeric('Contour sample index', '0'), cursor = el('input'), cursorLabel = el('label', 'Contour sample cursor (arrow keys)', 'cp05-field'); cursor.type = 'range'; cursor.min = '0'; cursor.max = '0'; cursor.step = '1'; cursor.value = '0'; cursor.setAttribute('aria-label', 'Contour sample cursor'); cursorLabel.append(cursor); index.input.step = '1';
  const local = el('div', '', 'cp05-grid'); local.append(omega.wrap, index.wrap, cursorLabel);
  omega.input.addEventListener('input', () => { mode = 'frequency'; refresh(); }, { signal });
  index.input.addEventListener('input', () => { mode = 'sample'; cursor.value = index.input.value; refresh(); }, { signal });
  cursor.addEventListener('input', () => { mode = 'sample'; index.input.value = cursor.value; refresh(); }, { signal });
  const attempts = el('fieldset', '', 'cp05-card'), guessReal = numeric('Predicted mapped real part', ''), guessImaginary = numeric('Predicted mapped imaginary part', ''); attempts.append(el('legend', 'Place up to three mapped-point predictions before reveal'), guessReal.wrap, guessImaginary.wrap);
  attempts.append(button('Add predicted point', () => {
    try {
      if (!contour || !active) throw new Error('Prepare a contour and choose a source point first.');
      if (predictions.length >= 3) throw new Error('Three predictions are already placed. Clear them to start another set.');
      const re = readNumericInput(guessReal.input, 'predicted real part'), im = readNumericInput(guessImaginary.input, 'predicted imaginary part');
      if (Math.max(Math.abs(re), Math.abs(im)) > 1e6) throw new Error('Predicted coordinate magnitudes must be at most1,000,000.');
      predictions.push({ source: { ...active.source }, guess: { re, im } }); refresh();
    } catch (error) { message.textContent = (error as Error).message; }
  }), button('Clear predictions', () => { predictions = []; guessReal.input.value = ''; guessImaginary.input.value = ''; refresh(); }), el('p', 'Open circles mark your predicted mapped coordinates. After reveal, complex-point tolerance is max(0.001,0.1% of the checked magnitude). Each prediction keeps its source point when the cursor moves.'));
  function prepare() {
    try {
      const candidate = construct(parse(numerator, 'N(s)', true), parse(denominator, 'D(s)'), readNumericInput(radius.input, 'contour radius'), readNumericInput(epsilon.input, 'indent radius')); spanValue();
      contour = candidate; revealed = false; predictions = []; mode = 'frequency'; guessReal.input.value = ''; guessImaginary.input.value = ''; cursor.max = String(candidate.points.length - 1); index.input.max = cursor.max; index.input.min = '0'; omega.input.min = '0'; omega.input.max = String(candidate.radius); workspace.hidden = false; refresh();
    } catch (error) { invalidate(); message.textContent = (error as Error).message; }
  }
  function refresh() {
    if (!contour || signal.aborted) return;
    try {
      const halfSpan = spanValue();
      if (mode === 'frequency') {
        const frequency = omegaValue(), point = atFrequency(contour, frequency); active = point.contourPoint;
        let nearest = 0, distance = Infinity; contour.points.forEach((p, i) => { const d = Math.hypot(p.source.re - active!.source.re, p.source.im - active!.source.im); if (d < distance) { distance = d; nearest = i; } }); index.input.value = String(nearest); cursor.value = String(nearest);
      } else {
        const i = readNumericInput(index.input, 'contour sample index'); if (!Number.isInteger(i) || i < 0 || i >= contour.points.length) throw new Error(`Choose an integer contour sample index from0 to${contour.points.length - 1}.`); active = contour.points[i];
        if (active.kind.endsWith('axis')) omega.input.value = String(Math.abs(active.source.im));
      }
      const frequency = omegaValue(), bode = response(contour.model, { re: 0, im: frequency });
      const kindText = { 'positive-axis': 'positive imaginary axis', 'negative-axis': 'negative imaginary axis', indent: 'right semicircle around an axis root', 'outer-arc': 'closing outer semicircle' }[active.kind];
      selected.replaceChildren(el('h3', 'Selected source point'), createEquationDisplay(`s=${complex(active.source)}`, 'Selected contour coordinates'), el('p', `Contour part: ${kindText}. The sample-index cursor is an approximate location when frequency entry chooses a point between samples.`));
      if (active.source.re > 0) selected.append(el('p', 'This is an off-axis arc point. Its mapped value differs from the separate Bode evaluation at jω.'));
      if (active.kind === 'negative-axis') selected.append(el('p', 'The selected contour is on the negative-frequency trace. The Bode cursor uses the corresponding positive |ω|; real coefficients give conjugate values.'));
      if (!revealed) selected.append(el('p', 'Place a mapped coordinate prediction, then reveal the checked curve.'));
      checked.hidden = !revealed; limits.hidden = !revealed;
      if (revealed) {
        checked.replaceChildren(el('h3', 'Checked mapped point and Bode cursor'));
        if (active.response.kind === 'value') checked.append(createEquationDisplay(`L(s)\\approx${complex(active.response.value)}`, 'Selected mapped coordinates'));
        checked.append(el('p', description(active.response)), createEquationDisplay(`s=j\\omega,\\quad\\omega=${nf(frequency)}\\;\\mathrm{rad/s}`, 'Independent Bode frequency'));
        if (bode.kind === 'value') checked.append(createEquationDisplay(`L(j\\omega)\\approx${complex(bode.value)}`, 'Checked frequency response')); checked.append(el('p', description(bode)));
        for (const [i, prediction] of predictions.entries()) {
          const actual = response(contour.model, prediction.source); checked.append(createEquationDisplay(`s_{${i + 1}}=${complex(prediction.source)},\\quad\\widehat L_{${i + 1}}=${complex(prediction.guess)}`, 'Prediction source and placed point'));
          if (actual.kind === 'value') { const error = Math.hypot(prediction.guess.re - actual.value.re, prediction.guess.im - actual.value.im); checked.append(el('p', `Prediction${i + 1}: ${error <= .001 * Math.max(1, actual.magnitude) ? 'matches' : 'differs'}; complex error≈${fmt(error)} gain units.`)); } else checked.append(el('p', `Prediction${i + 1}: ${actual.message}`));
        }
        renderLimits();
      }
      diagrams.replaceChildren(makePlots(contour, active, frequency, halfSpan, revealed, predictions)); diagrams.hidden = false;
      message.textContent = revealed ? 'The checked finite contour is shown. It is a construction, not a formal Nyquist stability count.' : `${predictions.length} predicted points placed. The source contour is shown; the mapped curve remains hidden.`;
    } catch (error) { active = undefined; checked.hidden = false; checked.replaceChildren(el('p', (error as Error).message)); selected.replaceChildren(el('p', 'Correct the local cursor/window input to continue.')); diagrams.hidden = true; limits.hidden = true; message.textContent = (error as Error).message; }
  }
  function renderLimits() {
    if (!contour) return;
    limits.replaceChildren(el('h3', 'What the finite arcs do and what their limits mean'), createEquationDisplay(`\\lim_{R\\to\\infty}L(Re^{j\\theta})=${latexR(contour.outerLimit)}`, 'Large-radius arc limit'), el('p', contour.decayOrder === null ? 'The loop is identically zero away from original excluded denominator points.' : contour.decayOrder ? `The relative degree is${contour.decayOrder}; the outer mapping decays like R^−${contour.decayOrder}. The actual finite outer arc is plotted, rather than replaced by its limit.` : 'Equal numerator/denominator degree gives a finite feedthrough limit; the finite outer arc is still mapped explicitly.'));
    if (!contour.axisPoles.length) limits.append(el('p', 'No imaginary-axis denominator roots occur for these exact coefficients. No indent is used.'));
    for (const pole of contour.axisPoles) {
      limits.append(createEquationDisplay(pole.frequency === 0 ? 's=0' : `s=${pole.frequency < 0 ? '-' : ''}j\\sqrt{${latexR(pole.square)}}`, 'Exact axis denominator root'), el('p', `Denominator factor order${pole.multiplicity}; numerator order${pole.numeratorOrder === null ? 'identically zero' : pole.numeratorOrder}. ${Math.abs(pole.frequency) > contour.radius ? 'This root lies outside the chosen finite radius.' : 'The right-half-plane indent is included and mapped.'}`));
      if (pole.unboundedOrder) limits.append(el('p', `As ε→0, the indent mapping is unbounded, locally of order ε^−${pole.unboundedOrder}. The picture uses the entered finite ε; clipping does not turn infinity into a finite value.`));
      else { if (pole.extension) limits.append(createEquationDisplay(`L_{\\mathrm{extension}}\\approx${complex(pole.extension)}`, 'Finite removable extension')); limits.append(el('p', 'There is a finite removable extension, but the original N/D is still undefined at the denominator root. No near pole/zero pair is canceled.')); }
    }
    const roots = el('details'); roots.append(el('summary', 'All original denominator roots (numerical)'));
    for (const pole of contour.poles) roots.append(el('p', `${fmt(pole.re)}${Number(fmt(pole.im)) < 0 ? ' − ' : ' + '}${fmt(Math.abs(pole.im))}j; residual${pole.residual.toExponential(2)}.`)); limits.append(roots);
    const unresolved = contour.points.filter(p => p.response.kind === 'undefined').length; if (unresolved) limits.append(el('p', `${unresolved} mapped samples are singular/unresolved and shown as gaps.`));
    limits.append(el('p', 'The closing arc, indentation and negative-frequency trace are part of the contour. No P/N/Z encirclement count or closed-loop stability verdict is inferred from this finite curve.'));
  }
  root.append(button('Prepare contour', prepare), message);
  workspace.append(local, selected, attempts, button('Reveal checked curve', () => { if (!contour) prepare(); if (contour) { revealed = true; refresh(); } }), checked, diagrams, limits); root.append(workspace); container.append(root);
  return () => { editors.forEach(input => input.destroy()); root.remove(); };
};
