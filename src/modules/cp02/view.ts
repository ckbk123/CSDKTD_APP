import type { ModuleMount } from '../../core/module';
import { createEquationDisplay, createEquationInput, type EquationInput } from '../../shared/equations/input';
import { readNumericInput } from '../../shared/numeric-input';
import { latexRat, mul, neg, num, polynomialLatex, sub, type Root } from './algebra';
import { baseline, decompose, initialDescription, inspect, movePole, moveZero, parseModel, sameDenominator, stepAt, termAt, type Model, type Term, type StepSolution } from './math';
import './workspace.css';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, text?: string, className?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag); if (text !== undefined) node.textContent = text; if (className) node.className = className; return node;
}
function select(label: string, choices: readonly (readonly [string, string])[]) {
  const element = el('label', undefined, 'modes-control'), input = el('select'); input.setAttribute('aria-label', label);
  choices.forEach(([value, text]) => { const option = el('option', text); option.value = value; input.append(option); }); element.append(el('span', label), input); return { element, input };
}
function numeric(label: string, value: number, min: number, max: number) {
  const element = el('label', undefined, 'modes-control'), input = el('input'); input.type = 'number'; input.step = 'any'; input.value = String(value); input.min = String(min); input.max = String(max); input.setAttribute('aria-label', label); element.append(el('span', label), input); return { element, input };
}
function checkbox(label: string, value: boolean) {
  const element = el('label', undefined, 'modes-check'), input = el('input'); input.type = 'checkbox'; input.checked = value; input.setAttribute('aria-label', label); element.append(input, document.createTextNode(label)); return { element, input };
}
function button(text: string) { const node = el('button', text, 'button'); node.type = 'button'; return node; }
function fmt(value: number): string {
  if (!value) return '0';
  if (Math.abs(value) >= 1e-4 && Math.abs(value) < 1e5) return Number(value.toPrecision(7)).toString();
  const [mantissa, power] = value.toExponential(4).split('e'), superscript: Record<string, string> = { '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };
  return `${Number(mantissa)}×10${String(Number(power)).split('').map(c => superscript[c]).join('')}`;
}
const tex = (value: number): string => Number(value.toPrecision(10)).toString().replace(/e([+-]?\d+)/, '\\times10^{$1}');
const rootText = (p: Root): string => `${fmt(p.re)}${p.im ? ` ${p.im > 0 ? '+' : '−'} ${fmt(Math.abs(p.im))}j` : ''}${p.multiplicity === 2 ? ' (double)' : ''}`;
function termLatex(t: Term): string {
  return `${tex(t.coefficient)}${t.power ? `t${t.power > 1 ? `^{${t.power}}` : ''}` : ''}${t.rate ? `e^{${tex(t.rate)}t}` : ''}${t.frequency ? `\\${t.wave}(${tex(t.frequency)}t)` : ''}`;
}
function table(headers: readonly string[], rows: readonly (readonly string[])[]): HTMLElement {
  const wrap = el('div', undefined, 'modes-table-scroll'), table = el('table'), head = el('thead'), heading = el('tr'), body = el('tbody');
  headers.forEach(text => { const cell = el('th', text); cell.scope = 'col'; heading.append(cell); }); head.append(heading);
  rows.forEach(row => { const line = el('tr'); row.forEach(text => line.append(el('td', text))); body.append(line); }); table.append(head, body); wrap.append(table); return wrap;
}
const ns = 'http://www.w3.org/2000/svg';
function svg<K extends keyof SVGElementTagNameMap>(tag: K, attributes: Record<string, string | number>, text?: string): SVGElementTagNameMap[K] {
  const node = document.createElementNS(ns, tag); Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, String(value))); if (text) node.textContent = text; return node;
}
interface Curve { name: string; values: number[]; style: string }
function plot(times: number[], curves: Curve[]): HTMLElement {
  const wrap = el('figure', undefined, 'modes-plot'), caption = el('figcaption', 'Zero-state unit-step output and weighted components'), scroll = el('div', undefined, 'modes-plot-scroll');
  const canvas = svg('svg', { viewBox: '0 0 760 350', role: 'img', 'aria-label': 'Computed step response versus time in seconds' });
  const values = curves.flatMap(c => c.values); if (values.some(v => !Number.isFinite(v))) throw new Error('Numerical response overflowed. Shorten the horizon.');
  let low = Math.min(0, ...values), high = Math.max(0, ...values); const range = high - low, pad = range ? range * .07 : Math.max(Math.abs(high) * .1, 1); low -= pad; high += pad;
  const x = (t: number) => 78 + t / times[times.length - 1] * 650, y = (v: number) => 292 - (v - low) / (high - low) * 260;
  for (let i = 0; i <= 4; i++) {
    const t = times[times.length - 1] * i / 4, v = low + (high - low) * i / 4;
    canvas.append(svg('line', { x1: 78, x2: 728, y1: y(v), y2: y(v), class: 'modes-grid' }), svg('text', { x: 70, y: y(v) + 4, 'text-anchor': 'end' }, fmt(v)), svg('text', { x: x(t), y: 315, 'text-anchor': 'middle' }, fmt(t)));
  }
  canvas.append(svg('line', { x1: 78, x2: 728, y1: y(0), y2: y(0), class: 'modes-axis' }), svg('text', { x: 400, y: 342, 'text-anchor': 'middle' }, 'Time t [s]'), svg('text', { x: 78, y: 18 }, 'Output / unit input'));
  curves.forEach(curve => canvas.append(svg('polyline', { class: curve.style, points: curve.values.map((v, i) => `${x(times[i]).toFixed(3)},${y(v).toFixed(3)}`).join(' '), fill: 'none' })));
  scroll.append(canvas); const legend = el('ul', undefined, 'modes-legend'); curves.forEach(c => legend.append(el('li', c.name, c.style))); wrap.append(caption, scroll, legend); return wrap;
}

export const mountView: ModuleMount = ({ container, signal }) => {
  if (signal.aborted) return;
  const root = el('div', undefined, 'modes-workspace'); container.append(root);
  let model = baseline(), checked = false, dirty = false, held: { model: Model; solution: StepSolution } | undefined;
  let fields: EquationInput[] = [];
  let drag: { pointer: number; type: 'pole' | 'zero'; index: number; real: number; imaginary: number } | undefined;
  const message = el('p', 'Choose predictions, then reveal the computed modes and response.', 'modes-message'); message.setAttribute('role', 'status'); message.setAttribute('aria-live', 'polite');
  const results = el('div', undefined, 'modes-results'), overview = el('div', undefined, 'modes-overview');
  root.append(el('p', 'Move poles to change the available time modes. Lock the denominator, then move a real numerator zero to change their weights and the initial direction. Input is a unit step; initial state is zero.'));
  const presets = select('Example', [['baseline', 'Baseline: conjugate poles, no finite zero'], ['left', 'Same poles, zero at −2'], ['right', 'Same poles, zero at +2'], ['real', 'Distinct real poles −1, −2'], ['repeated', 'Repeated pole −1'], ['hidden', 'Canceled unstable pole +1'], ['origin', 'One integrator'], ['double', 'Double integrator']]); root.append(presets.element);
  const coefficientArea = el('div', undefined, 'modes-coefficients');
  const invalidate = (): void => { if (signal.aborted) return; cancelDrag(); dirty = true; checked = false; results.replaceChildren(); overview.replaceChildren(); planeStatus.textContent = 'Unapplied coefficient edits. Reveal to validate and update the pole plane.'; message.textContent = 'Inputs changed. Reveal again before using the pole/zero controls.'; };
  fields = ['Denominator a₁', 'Denominator a₀', 'Numerator b₁', 'Numerator b₀'].map((label, i) => createEquationInput({ label, value: ['2', '4', '0', '4'][i], signal, onChange: invalidate })); fields.forEach(field => coefficientArea.append(field.element));
  root.append(createEquationDisplay('G(s)=\\frac{b_1s+b_0}{s^2+a_1s+a_0},\\quad U(s)=\\frac1s,\\quad x(0)=0', 'Editable coefficient convention'), coefficientArea);
  root.append(el('p', 'Enter one signed number or simple numeric fraction in each box. Mixed numbers and arithmetic expressions are unsupported; enter their numeric value. Symbols such as e are algebra, so use decimal values here.'));
  const prediction = el('fieldset', undefined, 'modes-card'); prediction.append(el('legend', 'Predict before revealing'));
  const family = select('Predicted original mode family', [['', 'Choose a family'], ['real', 'Two distinct real exponentials'], ['repeated', 'Repeated real pole: exponential and t·exponential'], ['conjugate', 'Conjugate pair: damped/growing sine and cosine']]);
  const direction = select('Predicted initial slope', [['', 'Choose the slope'], ['positive', 'Positive'], ['negative', 'Negative'], ['zero', 'Zero (horizontal tangent)']]);
  const misconception = select('Do the same poles force the same step response?', [['', 'Choose an answer'], ['yes', 'Yes'], ['no', 'No: zeros and gain change modal weights']]); prediction.append(family.element, direction.element, misconception.element);
  const reveal = button('Reveal modes and response'); reveal.classList.add('modes-primary'); prediction.append(reveal); root.append(prediction, message, overview);
  const planePanel = el('section', undefined, 'modes-card'); planePanel.append(el('h3', 'Pole and zero plane'));
  const lock = checkbox('Lock denominator while moving the zero', false), preserveDc = checkbox('Preserve DC gain when moving the zero', true); planePanel.append(lock.element, preserveDc.element);
  const planeStatus = el('p', 'Crosses are poles; the open circle is a real numerator zero. Drag a marker and release to apply.'); planeStatus.setAttribute('role', 'status');
  const planeScroll = el('div', undefined, 'modes-plane-scroll'), plane = svg('svg', { viewBox: '0 0 560 380', role: 'img', 'aria-label': 'Draggable pole-zero plane in inverse seconds' });
  const px = (r: number) => 280 + r * 21, py = (i: number) => 180 - i * 14, marks = svg('g', {}), ghost = svg('g', { class: 'modes-ghost' });
  for (const v of [-10, -5, 0, 5, 10]) plane.append(svg('line', { x1: px(v), x2: px(v), y1: 40, y2: 320, class: 'modes-grid' }), svg('line', { x1: 70, x2: 490, y1: py(v), y2: py(v), class: 'modes-grid' }), svg('text', { x: px(v), y: 341, 'text-anchor': 'middle' }, String(v)), svg('text', { x: 57, y: py(v) + 4, 'text-anchor': 'end' }, String(v)));
  plane.append(svg('line', { x1: 70, x2: 490, y1: 180, y2: 180, class: 'modes-axis' }), svg('line', { x1: 280, x2: 280, y1: 40, y2: 320, class: 'modes-axis' }), svg('text', { x: 280, y: 370, 'text-anchor': 'middle' }, 'Real part [s⁻¹]'), svg('text', { x: 70, y: 22 }, 'Imaginary part [s⁻¹]'), marks, ghost); planeScroll.append(plane); planePanel.append(planeStatus, planeScroll);
  const poleChoice = select('Pole to move', [['0', 'Pole 1'], ['1', 'Pole 2']]), real = numeric('Pole real part [s⁻¹]', -1, -10, 10), imaginary = numeric('Pole imaginary part [s⁻¹]', Math.sqrt(3), -10, 10), applyPole = button('Apply pole coordinates');
  const zeroLocation = numeric('Real zero location [s⁻¹]', -2, -10, 10), applyZero = button('Apply zero location'), coordinates = el('div', undefined, 'modes-controls'); coordinates.append(poleChoice.element, real.element, imaginary.element, applyPole, zeroLocation.element, applyZero); planePanel.append(coordinates);
  planePanel.append(el('p', 'Conjugate poles move together. Set the imaginary part to zero to form a repeated real pole; enter a nonzero imaginary part to form a pair. Real poles can move independently. Coordinates round to 9 decimal places; dragging snaps to 0.01 s⁻¹ and the real axis. The numeric controls provide the same operations by keyboard.')); root.append(planePanel);
  const display = el('div', undefined, 'modes-controls'), horizon = numeric('Time horizon [s]', 8, .1, 20), cursor = numeric('Time cursor [s]', 1, 0, 20), free = select('Original free mode to overlay', [['none', 'None']]);
  const components = checkbox('Show weighted output components', true), hold = button('Hold this response for comparison'), clear = button('Clear held response'); display.append(horizon.element, cursor.element, free.element, components.element, hold, clear); root.append(display, results);
  const limits = el('details'); limits.append(el('summary', 'Model, stability and numerical limits'), el('p', 'This is a real, continuous SISO transfer with a monic quadratic denominator and linear/constant numerator, zero initial state and unit-step input. There is no feedback loop. Coefficients have consistent time units: s has units s⁻¹. The original retained realization is A=[[0,1],[−a₀,−a₁]], B=[0;1], C=[b₀,b₁], D=0. Internal stability labels refer to this declared realization; arbitrary hidden physical states cannot be inferred from a transfer function.'), el('p', 'Coefficient magnitudes ≤100; |a₁|≤20; at most 9 decimal places or simple fractions with ≤24 digits per argument and reduced denominator ≤10¹⁸. Up to 8 outer groups/signs, 100 normalized/512 raw characters. Nested fractions, mixed numbers, powers, functions and arithmetic expressions are unsupported. Each nonzero pole real/imaginary component and finite zero location has magnitude 0.001–10 s⁻¹; pole magnitude ≤10 s⁻¹; distinct pole separation ≥10⁻⁶ s⁻¹. Exact zero and repeated roots are supported. A zero scalar channel has no visible output modes.'), el('p', 'Cancellation is exact rational polynomial division; numerical closeness never removes a mode. Uncanceled real pole/zero separation below 10⁻⁹ times max(1, |pole|) is reported as unreliable for modal weights. Responses use closed-form numerical evaluation, rounded display and 401–1201 time samples. Samples illustrate the curve, not a proof of all extrema or settling. Horizon is 0.1–20 s; growth is limited to exp(40). A finite trace does not prove stability or convergence. Shorten the horizon for unstable examples. Plots and tables scroll locally on narrow screens.')); root.append(limits);

  limits.append(el('p', 'Near t=0, the full response uses 24 terms of a convergent series instead of subtracting nearly equal modal values. This preserves its initial slope and curvature. The series is used when t·max(1, |a₁|, √|a₀|)<0.05; other times use the closed-form response.'));
  function error(error: unknown): void { message.textContent = error instanceof Error ? error.message : 'Check the model inputs.'; }
  function readModel(): Model {
    const entries = fields.map(field => { const d = field.getValue(); if (d.empty || d.hasPlaceholders || d.syntaxIssues.length) throw new Error('Complete every coefficient with valid numeric notation.'); return d.latex; });
    const next = parseModel(entries[0], entries[1], entries[2], entries[3]);
    if (lock.input.checked && !sameDenominator(next, model)) throw new Error('The denominator is locked. Unlock it before applying edited denominator coefficients.');
    return next;
  }
  function setModel(next: Model): void { model = next; dirty = false; [model.a1, model.a0, model.b1, model.b0].forEach((value, i) => fields[i].setValue(latexRat(value))); syncPlane(); }
  function drawCross(group: SVGGElement, r: number, i: number, attributes: Record<string, string | number> = {}): void {
    const cross = svg('g', { class: 'modes-pole', ...attributes }); cross.append(svg('path', { d: `M${px(r) - 6},${py(i) - 6}l12,12m0,-12l-12,12` }), svg('circle', { cx: px(r), cy: py(i), r: 13, class: 'modes-hit' })); group.append(cross);
  }
  function syncPlane(): void {
    const a = inspect(model); marks.replaceChildren();
    a.poles.forEach((p, i) => { drawCross(marks, p.re, p.im, { 'data-pole': i }); marks.append(svg('text', { x: px(p.re) + 14, y: py(p.im) - 10 }, `p${i + 1}${p.multiplicity === 2 ? ' ×2' : ''}`)); });
    if (a.zero) marks.append(svg('circle', { cx: px(num(a.zero)), cy: py(0), r: 8, class: 'modes-zero', 'data-zero': 'true' }));
    const options = a.poles.map((p, i) => [String(i), `Pole ${i + 1}: ${rootText(p)}`]); const previous = poleChoice.input.value;
    poleChoice.input.replaceChildren(...options.map(([value, text]) => { const o = el('option', text); o.value = value; return o; })); poleChoice.input.value = options.some(o => o[0] === previous) ? previous : '0'; syncCoordinates();
    const choice = free.input.value; free.input.replaceChildren(el('option', 'None')); free.input.options[0].value = 'none';
    a.poles.filter(p => p.im >= 0).forEach((p, i) => { const names = p.im ? ['cos', 'sin'] : p.multiplicity === 2 ? ['ordinary', 'generalized'] : ['ordinary']; names.forEach(name => { const o = el('option', `${rootText(p)}: ${name} free mode`); o.value = `${i}:${name}`; free.input.append(o); }); });
    free.input.value = [...free.input.options].some(o => o.value === choice) ? choice : 'none';
    planeStatus.textContent = `Original poles: ${a.poles.map(rootText).join('; ')}. ${a.zero ? `Finite zero: ${fmt(num(a.zero))} s⁻¹.` : model.b0.n ? 'Constant numerator: no finite zero.' : 'Zero channel: every output component vanishes.'}`;
  }
  function syncCoordinates(): void { const p = inspect(model).poles[Number(poleChoice.input.value) || 0]; real.input.value = String(p.re); imaginary.input.value = String(p.im); const z = inspect(model).zero; if (z) zeroLocation.input.value = String(num(z)); }
  function requireApplied(): void { if (dirty) throw new Error('Reveal to validate the coefficient edits before moving poles or zeros.'); }
  function commit(next: Model): void { setModel(next); if (checked) render(); else { overview.replaceChildren(); results.replaceChildren(); message.textContent = 'Model updated. Choose predictions and reveal to inspect its response.'; } }
  function renderOverview(): void {
    const a = inspect(model); overview.replaceChildren(); overview.append(createEquationDisplay(`G_{\\mathrm{original}}(s)=\\frac{${polynomialLatex(a.numerator)}}{${polynomialLatex(a.denominator)}}`, 'Original transfer function'), createEquationDisplay(`A=\\begin{bmatrix}0&1\\\\${latexRat(neg(model.a0))}&${latexRat(neg(model.a1))}\\end{bmatrix},\\ B=\\begin{bmatrix}0\\\\1\\end{bmatrix},\\ C=\\begin{bmatrix}${latexRat(model.b0)}&${latexRat(model.b1)}\\end{bmatrix},\\ D=0`, 'Declared original canonical realization'));
    overview.append(createEquationDisplay(`G_{\\mathrm{reduced}}(s)=\\frac{${polynomialLatex(a.reducedNumerator)}}{${polynomialLatex(a.reducedDenominator)}}`, 'Exactly reduced scalar channel'));
    overview.append(el('p', a.common.length > 1 ? `Exact common factor removed from the scalar channel; original modes remain in the declared realization.` : 'No exact pole/zero cancellation.'), createEquationDisplay(`q(s)=${polynomialLatex(a.common)}`, 'Exact common polynomial factor'), el('p', `Original internal dynamics: ${a.internal}. Reduced scalar channel: ${a.bibo ? 'BIBO stable' : 'not BIBO stable'}.`, 'modes-stability'));
    if (a.common.length > 1) overview.append(el('p', 'A canceled pole can be hidden from zero-state input/output response. Its internal mode remains relevant to initial conditions in the retained canonical state model. A stable reduced channel does not certify internal stability.'));
    overview.append(el('p', `Original poles: ${a.poles.map(rootText).join('; ')}. Reduced channel poles: ${a.reducedPoles.map(rootText).join('; ') || 'none'}.`));
    const slope = num(model.b1), expectedDirection = slope > 0 ? 'positive' : slope < 0 ? 'negative' : 'zero', curvature = sub(model.b0, mul(model.a1, model.b1));
    overview.append(el('p', `Mode prediction: ${family.input.value ? family.input.value === a.kind ? 'correct' : 'revise it' : 'not selected'}; checked family: ${a.kind}. Initial-slope prediction: ${direction.input.value ? direction.input.value === expectedDirection ? 'correct' : 'revise it' : 'not selected'}. ${initialDescription(model)}`), createEquationDisplay(`y(0^+)=0,\\quad y'(0^+)=${latexRat(model.b1)},\\quad y''(0^+)=${latexRat(curvature)}`, 'Initial output, slope and curvature'), el('p', `Same-poles check: ${misconception.input.value === 'no' ? 'correct.' : misconception.input.value === 'yes' ? 'revise it.' : 'not selected.'} Poles set the possible mode shapes; zeros and gain set their output weights. The −2/+2 zero presets keep poles and DC gain fixed but reverse the initial slope.`));
  }
  function render(): void {
    if (!checked || signal.aborted) return;
    renderOverview(); results.replaceChildren();
    try {
      const h = readNumericInput(horizon.input, 'time horizon'), c = readNumericInput(cursor.input, 'time cursor');
      if (h < .1 || h > 20) throw new Error('Use a time horizon from 0.1 to 20 s.'); if (c < 0 || c > h) throw new Error('Place the time cursor inside the displayed horizon.');
      const s = decompose(model), a = inspect(model), samples = Math.min(1201, Math.max(401, Math.ceil(h * Math.max(...a.poles.map(p => Math.abs(p.im))) * 32 / (2 * Math.PI)) + 1)), times = Array.from({ length: samples }, (_, i) => h * i / (samples - 1));
      const curves: Curve[] = [{ name: 'Full step output — solid', values: times.map(t => stepAt(s, t)), style: 'modes-full-line' }];
      if (components.input.checked) s.terms.forEach((term, i) => curves.push({ name: `${term.name} — component ${i + 1}`, values: times.map(t => termAt(t, term)), style: `modes-component modes-term-${i}` }));
      if (held) curves.push({ name: 'Held response — dotted', values: times.map(t => stepAt(held!.solution, t)), style: 'modes-held-line' });
      if (free.input.value !== 'none') { const [index, basis] = free.input.value.split(':'), p = a.poles.filter(p => p.im >= 0)[Number(index)]; const term: Term = { name: 'Unit free mode', coefficient: 1, rate: p.re, frequency: Math.abs(p.im), power: basis === 'generalized' ? 1 : 0, wave: basis === 'sin' ? 'sin' : 'cos' }; curves.push({ name: `Original unit free mode (${basis}) — dash-dot`, values: times.map(t => termAt(t, term)), style: 'modes-free-line' }); }
      const decomposition = el('section', undefined, 'modes-card'); decomposition.append(el('h3', 'Weighted output modes'));
      if (!s.terms.length) decomposition.append(el('p', 'The scalar channel is zero. The zero-state output is identically zero.'));
      s.terms.forEach((term, i) => decomposition.append(createEquationDisplay(`y_${i + 1}(t)\\approx ${termLatex(term)}`, `${term.name}, numerical weight ${fmt(term.coefficient)}`)));
      decomposition.append(el('p', 'The full output is the sum of these terms. Constant particular terms are not automatically a final value. Free-mode overlays use unit amplitude and describe the declared original state dynamics, separately from the zero-state weighted output.'));
      results.append(decomposition, plot(times, curves));
      const rows = [['Full output y(t)', fmt(stepAt(s, c))], ...s.terms.map(t => [t.name, fmt(termAt(c, t))])]; if (held) rows.push(['Held output', fmt(stepAt(held.solution, c))], ['Current − held output', fmt(stepAt(s, c) - stepAt(held.solution, c))]);
      results.append(el('h3', `Time cursor: ${fmt(c)} s`), table(['Quantity', 'Numerical value'], rows), el('p', `${samples} samples over 0–${fmt(h)} s. Values and curves are numerical approximations; cancellation above is exact rational algebra.`));
      if (held) results.append(el('p', `${sameDenominator(model, held.model) ? 'Denominator unchanged from held response: the same poles can produce a different output.' : 'The held response has a different denominator.'} Held comparisons last only for this visit.`));
      message.textContent = 'Computed modes and response revealed. Move poles/zero or adjust the time cursor to explore.';
    } catch (e) { results.replaceChildren(); error(e); }
  }
  reveal.addEventListener('click', () => { try { const next = readModel(); setModel(next); checked = true; render(); } catch (e) { checked = false; results.replaceChildren(); overview.replaceChildren(); error(e); } }, { signal });
  [family.input, direction.input, misconception.input].forEach(control => control.addEventListener('change', () => { if (checked) renderOverview(); }, { signal }));
  poleChoice.input.addEventListener('change', syncCoordinates, { signal });
  applyPole.addEventListener('click', () => { try { requireApplied(); if (lock.input.checked) throw new Error('The denominator is locked. Unlock it to move poles.'); commit(movePole(model, Number(poleChoice.input.value), readNumericInput(real.input, 'pole real part'), readNumericInput(imaginary.input, 'pole imaginary part'))); } catch (e) { error(e); } }, { signal });
  applyZero.addEventListener('click', () => { try { requireApplied(); commit(moveZero(model, readNumericInput(zeroLocation.input, 'zero location'), preserveDc.input.checked)); } catch (e) { error(e); } }, { signal });
  lock.input.addEventListener('change', () => { [poleChoice.input, real.input, imaginary.input, applyPole].forEach(control => { control.disabled = lock.input.checked; }); }, { signal });
  [horizon.input, cursor.input].forEach(control => control.addEventListener('input', render, { signal })); [free.input, components.input].forEach(control => control.addEventListener('change', render, { signal }));
  hold.addEventListener('click', () => { try { requireApplied(); held = { model, solution: decompose(model) }; if (checked) render(); message.textContent = 'Current response held. Change a zero and reveal/compare; the denominator is checked against this reference.'; } catch (e) { error(e); } }, { signal });
  clear.addEventListener('click', () => { held = undefined; if (checked) render(); }, { signal });
  presets.input.addEventListener('change', () => {
    window.mathVirtualKeyboard?.hide({ animate: false }); cancelDrag(); checked = false; overview.replaceChildren(); results.replaceChildren();
    const key = presets.input.value, values = key === 'left' ? ['2','4','2','4'] : key === 'right' ? ['2','4','-2','4'] : key === 'real' ? ['3','2','0','2'] : key === 'repeated' ? ['2','1','0','1'] : key === 'hidden' ? ['1','-2','1','-1'] : key === 'origin' ? ['1','0','0','1'] : key === 'double' ? ['0','0','0','1'] : ['2','4','0','4'];
    setModel(parseModel(...values as [string, string, string, string])); message.textContent = 'Example loaded. Choose predictions and reveal to compare.';
  }, { signal });
  function cancelDrag(): void { if (drag && plane.hasPointerCapture?.(drag.pointer)) plane.releasePointerCapture(drag.pointer); drag = undefined; ghost.replaceChildren(); }
  plane.addEventListener('pointerdown', event => {
    if (event.button !== 0) return; const target = event.target instanceof Element ? event.target.closest('[data-pole],[data-zero]') : null; if (!target) return;
    try { requireApplied(); const type = target.hasAttribute('data-zero') ? 'zero' : 'pole'; if (type === 'pole' && lock.input.checked) throw new Error('The denominator is locked. Unlock it to drag poles.');
      const index = Number(target.getAttribute('data-pole') || 0), a = inspect(model), point = type === 'pole' ? a.poles[index] : { re: num(a.zero!), im: 0 };
      drag = { pointer: event.pointerId, type, index, real: point.re, imaginary: point.im }; plane.setPointerCapture(event.pointerId); event.preventDefault();
    } catch (e) { error(e); }
  }, { signal });
  plane.addEventListener('pointermove', event => {
    if (!drag || drag.pointer !== event.pointerId) return; const bounds = plane.getBoundingClientRect();
    const r = ((event.clientX - bounds.left) / bounds.width * 560 - 280) / 21, i = (180 - (event.clientY - bounds.top) / bounds.height * 380) / 14;
    drag.real = Math.round(Math.max(-10, Math.min(10, r)) * 100) / 100; drag.imaginary = drag.type === 'zero' || Math.abs(i) < .05 ? 0 : Math.round(Math.max(-10, Math.min(10, i)) * 100) / 100;
    ghost.replaceChildren(); if (drag.type === 'zero') ghost.append(svg('circle', { cx: px(drag.real), cy: py(0), r: 8, class: 'modes-zero' })); else { drawCross(ghost, drag.real, drag.imaginary); if (drag.imaginary) drawCross(ghost, drag.real, -drag.imaginary); }
    planeStatus.textContent = `Candidate ${drag.type}: ${fmt(drag.real)}${drag.imaginary ? ` + ${fmt(drag.imaginary)}j` : ''} s⁻¹. Release to validate and calculate; solid markers still show the applied model.`;
  }, { signal });
  plane.addEventListener('pointerup', event => { if (!drag || drag.pointer !== event.pointerId) return; const candidate = drag; cancelDrag(); try { const next = candidate.type === 'pole' ? movePole(model, candidate.index, candidate.real, candidate.imaginary) : moveZero(model, candidate.real, preserveDc.input.checked); commit(next); } catch (e) { syncPlane(); error(e); } }, { signal });
  plane.addEventListener('pointercancel', () => { cancelDrag(); syncPlane(); }, { signal });
  plane.addEventListener('lostpointercapture', () => { if (drag) { drag = undefined; ghost.replaceChildren(); syncPlane(); } }, { signal });
  syncPlane();
  const cleanup = (): void => { cancelDrag(); fields.forEach(field => field.destroy()); root.remove(); signal.removeEventListener('abort', cleanup); };
  signal.addEventListener('abort', cleanup, { once: true }); return cleanup;
};
