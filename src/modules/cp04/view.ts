import type { ModuleMount } from '../../core/module';
import { createEquationDisplay, createEquationInput, type EquationDraft, type EquationInput } from '../../shared/equations/input';
import { baseline, dbToLinear, diagnosePrediction, factorAt, frequency, frequencyGrid, fromAngular, normalize, parseReal, predictionAt, responseAt, slopeIntervals, toAngular, type Factor, type FrequencyUnit, type Model, type Prediction } from './math';
import './workspace.css';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, text?: string, className?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag); if (text !== undefined) node.textContent = text; if (className) node.className = className; return node;
}
function select(label: string, choices: readonly (readonly [string, string])[]) {
  const element = el('label', undefined, 'bode-control'), caption = el('span', label), input = el('select'); input.setAttribute('aria-label', label);
  choices.forEach(([value, text]) => { const option = el('option', text); option.value = value; input.append(option); }); element.append(caption, input); return { element, input, caption };
}
function numeric(label: string, value: number, min: number, max: number) {
  const element = el('label', undefined, 'bode-control'), caption = el('span', label), input = el('input');
  input.type = 'number'; input.step = 'any'; input.value = String(value); input.min = String(min); input.max = String(max); input.setAttribute('aria-label', label); element.append(caption, input); return { element, input, caption };
}
function finite(input: HTMLInputElement, label: string): number {
  const value = input.valueAsNumber; if (!input.value.trim() || !Number.isFinite(value)) throw new Error(`${label}: enter a finite number.`); return value;
}
const fmt = (x: number, digits = 7): string => x === Infinity ? '∞' : x === 0 ? '0' : Math.abs(x) < 0.0001 || Math.abs(x) >= 10000 ? x.toExponential(3) : Number(x.toPrecision(digits)).toString();
const tex = (x: number): string => Number(x.toPrecision(12)).toString().replace(/e([+-]?\d+)/, '\\times10^{$1}');
function polynomial(f: Factor): string { return `${tex(f.a0)}${f.a1 < 0 ? '-' : '+'}${tex(Math.abs(f.a1))}s${f.kind === 'second' ? `+${tex(f.a2)}s^2` : ''}`; }
function expression(model: Model, normalized: boolean): string {
  const n = normalize(model);
  const factors = model.factors.map((f, i) => normalized ? f.kind === 'first' ? `1${f.a1 < 0 ? '-' : '+'}\\frac{s}{${tex(n.factors[i].corner)}}`
    : `1+${tex(2 * n.factors[i].damping!)}\\frac{s}{${tex(n.factors[i].corner)}}+\\left(\\frac{s}{${tex(n.factors[i].corner)}}\\right)^2` : polynomial(f));
  const product = (position: Factor['position']): string => factors.filter((_, i) => model.factors[i].position === position).map(f => `\\left(${f}\\right)`).join('') || '1';
  return `G(s)${normalized ? '\\approx' : '='}${tex(normalized ? n.gain : model.gain)}${model.originPower ? `s^{${model.originPower}}` : ''}${model.delay ? `e^{-${tex(model.delay)}s}` : ''}\\frac{${product('zero')}}{${product('pole')}}`;
}
function table(headers: readonly string[], rows: readonly (readonly string[])[]): HTMLElement {
  const wrap = el('div', undefined, 'bode-table-wrap'), result = el('table'), head = el('thead'), heading = el('tr');
  headers.forEach(h => heading.append(el('th', h))); head.append(heading); const body = el('tbody'); rows.forEach(values => { const row = el('tr'); values.forEach(value => row.append(el('td', value))); body.append(row); }); result.append(head, body); wrap.append(result); return wrap;
}
function svg<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>): SVGElementTagNameMap[K] {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag); Object.entries(attrs).forEach(([name, value]) => node.setAttribute(name, String(value))); return node;
}
interface Curve { name: string; values: number[]; style: string }
function plot(omegas: readonly number[], curves: readonly Curve[], markers: readonly { omega: number; name: string; style: string }[], cursor: number, unit: FrequencyUnit, title: string, vertical: string): HTMLElement {
  const figure = el('figure', undefined, 'bode-figure'); figure.append(el('figcaption', title));
  const image = svg('svg', { viewBox: '0 0 660 315', role: 'img', 'aria-label': title });
  const all = curves.flatMap(c => c.values); if (all.some(x => !Number.isFinite(x))) throw new Error('A plotted value exceeds numerical limits. Check the data.');
  let low = Math.min(...all), high = Math.max(...all); if (high - low < 1e-10) { low -= 1; high += 1; } const pad = (high - low) * 0.08; low -= pad; high += pad;
  const start = omegas[0], end = omegas[omegas.length - 1], x = (w: number): number => 85 + 540 * Math.log10(w / start) / Math.log10(end / start), y = (v: number): number => 250 - 200 * (v - low) / (high - low);
  const label = (tx: number, ty: number, text: string, anchor = 'middle'): void => { const node = svg('text', { x: tx, y: ty, 'text-anchor': anchor }); node.textContent = text; image.append(node); };
  image.append(svg('line', { x1: 85, y1: 45, x2: 85, y2: 255, class: 'bode-axis' }), svg('line', { x1: 85, y1: 250, x2: 630, y2: 250, class: 'bode-axis' }));
  label(85, 18, vertical, 'start'); label(78, 56, fmt(high, 5), 'end'); label(78, 250, fmt(low, 5), 'end');
  for (let decade = Math.ceil(Math.log10(start)); decade <= Math.floor(Math.log10(end)); decade++) { const w = 10 ** decade; image.append(svg('line', { x1: x(w), y1: 45, x2: x(w), y2: 255, class: 'bode-grid' })); label(x(w), 274, fmt(fromAngular(w, unit), 4)); }
  label(350, 305, `Frequency [${unit}] — logarithmic axis`);
  const grouped = new Map<string, { omega: number; names: string[]; style: string }>();
  markers.filter(m => m.omega >= start && m.omega <= end).forEach(m => { const key = `${m.style}:${x(m.omega).toFixed(2)}`; const previous = grouped.get(key); if (previous) previous.names.push(m.name); else grouped.set(key, { omega: m.omega, names: [m.name], style: m.style }); });
  let markerIndex = 0;
  for (const m of grouped.values()) { image.append(svg('line', { x1: x(m.omega), y1: 45, x2: x(m.omega), y2: 250, class: `bode-marker ${m.style}` })); label(x(m.omega), 34 + markerIndex++ % 2 * 12, m.names.join(',')); }
  curves.forEach(c => image.append(svg('polyline', { points: c.values.map((value, i) => `${x(omegas[i]).toFixed(3)},${y(value).toFixed(3)}`).join(' '), class: `bode-line ${c.style}` })));
  image.append(svg('line', { x1: x(cursor), y1: 45, x2: x(cursor), y2: 255, class: 'bode-cursor' })); figure.append(image);
  const legend = el('div', undefined, 'bode-legend'); curves.forEach(c => legend.append(el('span', c.name, c.style))); figure.append(legend); return figure;
}

interface Binding { input: EquationInput; read(): number }
interface Row { id: number; element: HTMLElement; position: ReturnType<typeof select>; kind: ReturnType<typeof select>; fields: Binding[]; guess: ReturnType<typeof numeric>; dispose(): void }
export const mountView: ModuleMount = ({ container, signal }) => {
  const root = el('div', undefined, 'cp04'); container.append(root); root.append(el('h3', 'Construct the Bode plot before revealing the answer'), el('p', 'Normalize the given factors, predict the gain and corners, then compare your construction with the numerical frequency response.'));
  const presets = select('Example', [['baseline', 'Baseline: 1 / ((s+1)(s+2))'], ['delay', 'Baseline with 0.5 s pure delay (proposed)'], ['quadratic', 'Resonant quadratic (proposed)'], ['rhp', 'Right-half-plane zero (proposed)'], ['origin', 'Baseline with an integrator (proposed)']]); root.append(presets.element);
  const globals = el('div', undefined, 'bode-fields'), factorArea = el('div'), results = el('div', undefined, 'bode-results'), message = el('p', 'Place your gain and corner markers, then draw your prediction.', 'bode-message'); message.setAttribute('role', 'status');
  let last: { model: Model; prediction: Prediction; checked: boolean } | undefined; let unit: FrequencyUnit = 'rad/s'; let nextId = 0; let rows: Row[] = [];
  function invalidate(): void { if (signal.aborted) return; last = undefined; results.replaceChildren(); message.textContent = 'Inputs changed. Draw your prediction or reveal the checked construction again.'; }
  function binding(label: string, value: string, ownerSignal = signal): Binding {
    let draft: EquationDraft;
    const input = createEquationInput({ label, value, signal: ownerSignal, onChange: next => { draft = next; invalidate(); } }); draft = input.getValue();
    return { input, read: () => { draft = input.getValue(); if (draft.empty || draft.hasPlaceholders || draft.syntaxIssues.length) throw new Error(`Complete ${label} and check its notation.`); return parseReal(draft.latex); } };
  }
  const gain = binding('Raw gain K', '1'), delay = binding('Pure delay τ [s]', '0'); globals.append(gain.input.element, delay.input.element); root.append(globals);
  const origin = select('Power of s at the origin', Array.from({ length: 7 }, (_, i) => [String(i - 3), `${i - 3}${i - 3 < 0 ? ' — poles at zero' : i - 3 > 0 ? ' — zeros at zero' : ' — no origin factor'}`])); origin.input.value = '0'; root.append(origin.element, factorArea);
  const add = el('button', 'Add a factor', 'button'); add.type = 'button'; root.append(add);
  const displayControls = el('div', undefined, 'bode-controls'), units = select('Frequency unit', [['rad/s', 'rad/s'], ['Hz', 'Hz']]), magnitude = select('Magnitude unit', [['db', 'dB'], ['linear', 'Linear ratio']]);
  const lower = numeric('Lower frequency [rad/s]', 0.01, 1e-4, 1e4), upper = numeric('Upper frequency [rad/s]', 100, 1e-4, 1e4), cursor = numeric('Cursor frequency [rad/s]', 1, 1e-4, 1e4);
  displayControls.append(units.element, magnitude.element, lower.element, upper.element, cursor.element); root.append(displayControls);
  const attempt = el('fieldset', undefined, 'bode-attempt'); attempt.append(el('legend', 'Your asymptotic construction'));
  const guessGain = numeric('Your normalization gain magnitude |Kₙ|', 1, 1e-100, 1e100); attempt.append(guessGain.element, el('p', 'Enter one corner marker in each factor above. Your curve uses those markers and this gain; it does not use the checked gain. Slope changes follow each given factor’s order and numerator/denominator role.')); root.append(attempt);
  const factorChoice = select('Contribution to highlight', [['all', 'Total only'], ['gain', 'Normalization gain'], ['origin', 'Origin factor'], ['delay', 'Pure delay']]); root.append(factorChoice.element);
  const actions = el('div', undefined, 'bode-actions'), draw = el('button', 'Draw my asymptote', 'button'), reveal = el('button', 'Reveal checked construction', 'button bode-primary'); draw.type = reveal.type = 'button'; actions.append(draw, reveal); root.append(actions, message, results);
  const assumptions = el('details'); assumptions.append(el('summary', 'Supported factors, units and approximation limits'));
  assumptions.append(el('p', 'The continuous-time scalar model is K·sⁿ·exp(−τs) times at most six first/second-order numerator or denominator factors. Edit coefficients in ascending order: a₀+a₁s+a₂s². First order requires a₀>0 and signed nonzero a₁; negative a₁ places the real pole/zero in the right half-plane. Quadratics require positive coefficients and 0.05≤ζ≤1; enter overdamped real roots as separate first-order factors. Corners/natural frequencies are 10⁻⁴–10⁴ rad/s.'));
  assumptions.append(el('p', 'Enter signed numbers, decimals (up to 9 decimal places, 12 digits total), or simple fractions. Nonzero coefficient/gain magnitudes are 10⁻⁶–10⁶. K cannot be zero; n is −3…3 and delay is 0…10 s. Coefficients have consistent time units, magnitude is an output/input ratio, and dB means 20 log₁₀ of that ratio. Frequencies are angular rad/s or f=ω/(2π) Hz; phases are unwrapped degrees (negative K contributes +180°). No feedback, initial condition or sample period is implied. Unstable factors are formal frequency evaluations, not stable sinusoidal experiments.'));
  assumptions.append(el('p', 'Magnitude straight lines are asymptotic approximations. Phase uses linear transitions from 0.1 to 10 times each corner: ±45°/decade per first-order factor and ±90°/decade per quadratic. Delay phase −ωτ is added directly, with no Padé approximation. Numerical curves use 601 log-spaced points plus corners/cursor; they are sampled illustrations, not a complete resonance or stability proof. Boundary rounding tolerance is 10⁻¹². Display values are rounded. On a narrow screen, scroll within each plot or table.')); root.append(assumptions);

  function refreshChoices(): void {
    const previous = factorChoice.input.value; while (factorChoice.input.options.length > 4) factorChoice.input.remove(4);
    rows.forEach(row => { const option = el('option', `Factor ${row.id} (normalized)`); option.value = String(row.id); factorChoice.input.append(option); });
    factorChoice.input.value = [...factorChoice.input.options].some(option => option.value === previous) ? previous : 'all'; add.disabled = rows.length >= 6;
  }
  function addRow(f: Factor, initialGuess = 1): void {
    if (rows.length >= 6) return;
    const id = ++nextId, controller = new AbortController(), abort = (): void => controller.abort(); signal.addEventListener('abort', abort, { once: true });
    const element = el('fieldset', undefined, 'bode-factor'); element.append(el('legend', `Factor ${id}`));
    const position = select(`Factor ${id} position`, [['pole', 'Denominator (pole factor)'], ['zero', 'Numerator (zero factor)']]), kind = select(`Factor ${id} order`, [['first', 'First order'], ['second', 'Second order']]); position.input.value = f.position; kind.input.value = f.kind;
    const choices = el('div', undefined, 'bode-controls'); choices.append(position.element, kind.element); element.append(choices);
    const formula = el('div'); const showFormula = (): void => { formula.replaceChildren(createEquationDisplay(`F_{${id}}(s)=a_0+a_1s${kind.input.value === 'second' ? '+a_2s^2' : ''}`, `Factor ${id} coefficient convention`)); };
    element.append(formula); const entries = el('div', undefined, 'bode-coefficients');
    const fields = [f.a0, f.a1, f.kind === 'second' ? f.a2 : 1].map((value, i) => binding(`Factor ${id} coefficient a${['₀', '₁', '₂'][i]}`, String(value), controller.signal)); fields.forEach(field => entries.append(field.input.element)); fields[2].input.element.hidden = f.kind !== 'second'; element.append(entries);
    const guess = numeric(`Your corner for factor ${id} [${unit}]`, fromAngular(initialGuess, unit), fromAngular(1e-4, unit), fromAngular(1e4, unit)); element.append(guess.element);
    const remove = el('button', `Remove factor ${id}`, 'button'); remove.type = 'button'; element.append(remove);
    const dispose = (): void => { signal.removeEventListener('abort', abort); controller.abort(); fields.forEach(field => field.input.destroy()); element.remove(); };
    const row: Row = { id, element, position, kind, fields, guess, dispose }; rows.push(row); factorArea.append(element); showFormula(); refreshChoices();
    for (const input of [position.input, guess.input]) input.addEventListener(input === guess.input ? 'input' : 'change', invalidate, { signal: controller.signal });
    kind.input.addEventListener('change', () => { fields[2].input.element.hidden = kind.input.value !== 'second'; showFormula(); invalidate(); }, { signal: controller.signal });
    remove.addEventListener('click', () => { dispose(); rows = rows.filter(r => r !== row); refreshChoices(); invalidate(); }, { signal: controller.signal });
  }
  function readModel(): Model {
    return { gain: gain.read(), delay: delay.read(), originPower: Number(origin.input.value), factors: rows.map(row => ({ kind: row.kind.input.value as Factor['kind'], position: row.position.input.value as Factor['position'], a0: row.fields[0].read(), a1: row.fields[1].read(), a2: row.kind.input.value === 'second' ? row.fields[2].read() : 0 })) };
  }
  function readPrediction(): Prediction { return { gain: finite(guessGain.input, 'Normalization gain prediction'), corners: rows.map(row => toAngular(finite(row.guess.input, `Corner for factor ${row.id}`), unit)) }; }
  function render(model: Model, prediction: Prediction, checked: boolean): void {
    if (signal.aborted) return; const normalized = normalize(model), low = toAngular(finite(lower.input, 'Lower frequency'), unit), high = toAngular(finite(upper.input, 'Upper frequency'), unit), w = toAngular(finite(cursor.input, 'Cursor frequency'), unit);
    frequency(w); const grid = frequencyGrid(low, high); if (w < low || w > high) throw new Error('Place the cursor inside the displayed frequency range.');
    const omegas = [...new Set([...grid, ...normalized.factors.map(f => f.corner).filter(c => c >= low && c <= high), w])].sort((a, b) => a - b);
    const expected = omegas.map(omega => predictionAt(model, omega, prediction)); const exact = checked ? omegas.map(omega => responseAt(model, omega)) : [];
    const magCurve = (db: number): number => magnitude.input.value === 'db' ? db : dbToLinear(db);
    const magCurves: Curve[] = [{ name: 'Your asymptote — dotted', values: expected.map(p => magCurve(p.db)), style: 'bode-attempt-line' }], phaseCurves: Curve[] = [{ name: 'Your phase construction — dotted', values: expected.map(p => p.phase), style: 'bode-attempt-line' }];
    const markers = prediction.corners.map((omega, i) => ({ omega, name: `p${rows[i].id}`, style: 'bode-predicted-marker' }));
    results.replaceChildren();
    if (checked) {
      const overview = el('section', undefined, 'bode-verdict'); overview.append(el('h3', 'Checked normalization and corner construction'), createEquationDisplay(expression(model, false), 'Entered raw factor transfer'), createEquationDisplay(expression(model, true), 'Normalized transfer with rounded numerical values'));
      overview.append(el('p', 'The transfer equations use s in inverse seconds and angular corner coefficients. Switching the plot to Hz converts the frequency display, not the transfer model.'));
      overview.append(createEquationDisplay(`K_n=K\\frac{\\prod_{\\mathrm{numerator}} a_0}{\\prod_{\\mathrm{denominator}}a_0}\\approx${tex(normalized.gain)}`, 'Normalization gain calculation'), el('p', diagnosePrediction(model, prediction)));
      overview.append(createEquationDisplay(String.raw`a_0+a_1s=a_0\left(1+\frac{a_1}{a_0}s\right),\quad a_0+a_1s+a_2s^2=a_0\left(1+2\zeta\frac{s}{\omega_n}+\frac{s^2}{\omega_n^2}\right)`, 'Constant extraction for each supported factor'));
      overview.append(table(['Factor', 'Extracted a₀', `Corner / ωₙ [${unit}]`, 'Slope change [dB/dec]', 'Damping / location'], model.factors.map((f, i) => [String(rows[i].id), fmt(f.a0), fmt(fromAngular(normalized.factors[i].corner, unit)), fmt(20 * normalized.factors[i].direction * normalized.factors[i].order), f.kind === 'second' ? `ζ≈${fmt(normalized.factors[i].damping!)}` : f.a1 < 0 ? 'Right half-plane' : 'Left half-plane'])));
      overview.append(table([`Frequency interval [${unit}]`, 'Total slope [dB/dec]'], slopeIntervals(model).map(interval => [`${fmt(fromAngular(interval.from, unit))} < ${unit === 'Hz' ? 'f' : 'ω'} < ${fmt(fromAngular(interval.to, unit))}`, fmt(interval.slope)])));
      overview.append(el('p', `Explicit delay: τ=${fmt(model.delay)} s, magnitude contribution 0 dB, phase contribution −ωτ radians. Delay is retained as exp(−τs).`)); results.append(overview);
      magCurves.unshift({ name: 'Exact numerical response — solid', values: exact.map(p => magnitude.input.value === 'db' ? p.db : p.magnitude), style: 'bode-exact-line' }, { name: 'Checked asymptote — dashed', values: exact.map(p => magCurve(p.asymptoteDb)), style: 'bode-asymptote-line' });
      phaseCurves.unshift({ name: 'Exact unwrapped phase — solid', values: exact.map(p => p.phase), style: 'bode-exact-line' }, { name: 'Checked phase approximation — dashed', values: exact.map(p => p.asymptotePhase), style: 'bode-asymptote-line' });
      normalized.factors.forEach((f, i) => markers.push({ omega: f.corner, name: `c${rows[i].id}`, style: 'bode-checked-marker' }));
      if (normalized.factors.some(f => f.corner < low || f.corner > high)) results.append(el('p', 'Some checked corners lie outside the displayed range. Widen the frequency range to inspect them.', 'bode-message'));
      const selected = factorChoice.input.value;
      if (selected !== 'all') {
        const index = rows.findIndex(row => String(row.id) === selected), contributions = omegas.map(omega => index >= 0 ? factorAt(model.factors[index], omega) : selected === 'gain' ? { db: 20 * Math.log10(Math.abs(normalized.gain)), phase: model.gain < 0 ? 180 : 0 } : selected === 'origin' ? { db: 20 * model.originPower * Math.log10(omega), phase: 90 * model.originPower } : { db: 0, phase: -model.delay * omega * 180 / Math.PI });
        const name = index >= 0 ? `Factor ${rows[index].id} normalized` : selected;
        magCurves.push({ name: `${name} contribution — dash-dot`, values: contributions.map(c => magCurve(c.db)), style: 'bode-contribution-line' }); phaseCurves.push({ name: `${name} contribution — dash-dot`, values: contributions.map(c => c.phase), style: 'bode-contribution-line' });
        results.append(el('p', `Highlighted ${name}: ${index >= 0 ? 'its constant a₀ belongs to Kₙ; the normalized factor is shown separately.' : 'this term is shown separately from the total response.'} Contributions add in dB and degrees; linear magnitudes multiply.`));
      }
      const at = responseAt(model, w), atPrediction = predictionAt(model, w, prediction), card = el('section', undefined, 'bode-cursor-card'); card.append(el('h3', `Cursor: ${fmt(fromAngular(w, unit))} ${unit}`));
      card.append(table(['Quantity', 'Exact numerical', 'Checked asymptote', 'Exact − asymptotic'], [['Magnitude ratio', fmt(at.magnitude), fmt(at.asymptoteMagnitude), fmt(at.magnitude - at.asymptoteMagnitude)], ['Magnitude [dB]', fmt(at.db), fmt(at.asymptoteDb), fmt(at.db - at.asymptoteDb)], ['Phase [deg]', fmt(at.phase), fmt(at.asymptotePhase), fmt(at.phase - at.asymptotePhase)]]));
      card.append(el('p', `Your cursor construction: ${fmt(atPrediction.db)} dB and ${fmt(atPrediction.phase)}°. Phase is kept on the additive unwrapped branch.`));
      card.append(table(['Contribution', 'Magnitude [dB]', 'Phase [deg]'], [['Normalization gain', fmt(20 * Math.log10(Math.abs(normalized.gain))), model.gain < 0 ? '180' : '0'], ['Origin factor', fmt(20 * model.originPower * Math.log10(w)), fmt(90 * model.originPower)], ['Pure delay', '0', fmt(-model.delay * w * 180 / Math.PI)], ...at.contributions.map((c, i) => [`Factor ${rows[i].id} normalized`, fmt(c.db), fmt(c.phase)])])); results.append(card);
    } else results.append(el('h3', 'Your predicted asymptotes and corner markers'));
    results.append(plot(omegas, magCurves, markers, w, unit, 'Magnitude construction', magnitude.input.value === 'db' ? 'Magnitude [dB]' : 'Magnitude [output / input ratio]'), plot(omegas, phaseCurves, markers, w, unit, 'Phase construction', 'Unwrapped phase [deg]'));
    results.append(el('p', 'p markers are your predictions; c markers are checked corners after reveal. Vertical accent line is the selected frequency. Exact curves are numerical evaluations; straight lines and phase transitions are approximations.'));
    last = { model, prediction, checked }; message.textContent = checked ? 'Checked construction revealed. Move the frequency cursor or select a contribution to explore.' : 'Prediction drawn. Reveal the checked construction to compare gain, corners and response.';
  }
  function run(checked: boolean): void { try { render(readModel(), readPrediction(), checked); } catch (error) { invalidate(); message.textContent = error instanceof Error ? error.message : 'Check the factor inputs.'; } }
  function redraw(): void { if (!last) return; try { render(last.model, last.prediction, last.checked); } catch (error) { invalidate(); message.textContent = error instanceof Error ? error.message : 'Check the display controls.'; } }
  function labelFrequency(control: ReturnType<typeof numeric>, name: string): void { const label = `${name} [${unit}]`; control.caption.textContent = label; control.input.setAttribute('aria-label', label); control.input.min = String(fromAngular(1e-4, unit)); control.input.max = String(fromAngular(1e4, unit)); }
  function updateUnit(next: FrequencyUnit): void {
    const controls = [lower, upper, cursor, ...rows.map(r => r.guess)]; controls.forEach(control => { if (control.input.value && Number.isFinite(control.input.valueAsNumber)) control.input.value = String(fromAngular(toAngular(control.input.valueAsNumber, unit), next)); });
    unit = next; labelFrequency(lower, 'Lower frequency'); labelFrequency(upper, 'Upper frequency'); labelFrequency(cursor, 'Cursor frequency'); rows.forEach(row => labelFrequency(row.guess, `Your corner for factor ${row.id}`)); redraw();
  }
  draw.addEventListener('click', () => run(false), { signal }); reveal.addEventListener('click', () => run(true), { signal }); add.addEventListener('click', () => { addRow({ kind: 'first', position: 'pole', a0: 1, a1: 1, a2: 0 }); invalidate(); }, { signal });
  origin.input.addEventListener('change', invalidate, { signal }); guessGain.input.addEventListener('input', invalidate, { signal }); units.input.addEventListener('change', () => updateUnit(units.input.value as FrequencyUnit), { signal });
  magnitude.input.addEventListener('change', redraw, { signal }); factorChoice.input.addEventListener('change', redraw, { signal }); [lower, upper, cursor].forEach(control => control.input.addEventListener('input', redraw, { signal }));
  presets.input.addEventListener('change', () => {
    invalidate(); const model = baseline(); const example: Model = presets.input.value === 'delay' ? { ...model, delay: 0.5 } : presets.input.value === 'origin' ? { ...model, originPower: -1 } : presets.input.value === 'quadratic' ? { gain: 1, delay: 0, originPower: 0, factors: [{ kind: 'second', position: 'pole', a0: 4, a1: 1, a2: 1 }] } : presets.input.value === 'rhp' ? { ...model, factors: [...model.factors, { kind: 'first', position: 'zero', a0: 1, a1: -1, a2: 0 }] } : model;
    rows.forEach(row => row.dispose()); rows = []; nextId = 0; unit = 'rad/s'; units.input.value = unit; magnitude.input.value = 'db'; gain.input.setValue(String(example.gain)); delay.input.setValue(String(example.delay)); origin.input.value = String(example.originPower);
    lower.input.value = '0.01'; upper.input.value = '100'; cursor.input.value = '1'; guessGain.input.value = '1'; example.factors.forEach(f => addRow(f)); factorChoice.input.value = 'all'; updateUnit(unit); invalidate();
  }, { signal });
  baseline().factors.forEach(f => addRow(f));
  return () => { rows.forEach(row => row.dispose()); gain.input.destroy(); delay.input.destroy(); root.remove(); };
};
