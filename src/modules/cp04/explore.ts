import type { ModuleMount } from '../../core/module';
import { createEquationDisplay, createEquationInput, type EquationInput } from '../../shared/equations/input';
import { readNumericInput } from '../../shared/numeric-input';
import { baseline, dbToLinear, factorAt, frequency, frequencyGrid, fromAngular, normalize, normalizeFactor, parseDelay, parseReal, responseAt, slopeIntervals, toAngular, type Contribution, type Factor, type FrequencyUnit, type Model } from './math';
import { editFactor, scalarText } from './editing';
import { createPlot, format as fmt, pointerFrequency, type Axis, type Curve, type Geometry } from './plot';
import type { ModeHooks } from './mode';

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, text?: string, className?: string): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag); if (text !== undefined) node.textContent = text; if (className) node.className = className; return node;
};
function select(parent: HTMLElement, title: string, choices: readonly (readonly [string, string])[]) {
  const label = el('label', title, 'bode-control'), input = el('select'); input.setAttribute('aria-label', title);
  for (const [value, text] of choices) { const option = el('option', text); option.value = value; input.append(option); } label.append(input); parent.append(label); return input;
}
function numeric(parent: HTMLElement, title: string, value: number, min: number, max: number, range = false) {
  const label = el('label', title, 'bode-control'), input = el('input'); input.type = range ? 'range' : 'number'; input.step = 'any'; input.min = String(min); input.max = String(max); input.value = String(value); input.setAttribute('aria-label', title); label.append(input); parent.append(label); return input;
}
function button(parent: HTMLElement, title: string) { const node = el('button', title, 'button'); node.type = 'button'; parent.append(node); return node; }
function depth(parent: HTMLElement, title: string) { const node = el('details'); node.append(el('summary', title)); parent.append(node); return node; }
interface Snapshot { model: Model; gain: string; delay: string; factors: string[][] }
const snapshot = (model: Model): Snapshot => ({ model, gain: scalarText(model.gain), delay: scalarText(model.delay, true), factors: model.factors.map(f => [scalarText(f.a0), scalarText(f.a1), scalarText(f.a2)]) });
type ExploreContext = Parameters<ModuleMount>[0] & { hooks?: ModeHooks; isActive?: () => boolean };

export const mountExplore = ({ container, signal: parent, hooks, isActive = () => true }: ExploreContext): (() => void) | undefined => {
  const life = new AbortController(), signal = life.signal, editors: EquationInput[] = [];
  const root = el('div', undefined, 'bode-explore'); container.append(root);
  root.append(el('p', 'Move a corner to change both plots. Select a factor to link its contribution; raw constants stay in the normalization gain.', 'bode-intro'));
  const layout = el('div', undefined, 'bode-explore-layout'), visual = el('section', undefined, 'bode-visual'), controls = el('section', undefined, 'bode-explore-controls'); root.append(layout); layout.append(visual, controls);
  const plots = el('div', undefined, 'bode-live-plots'); plots.tabIndex = -1; plots.setAttribute('aria-label', 'Bode plots and corner editing');
  const warning = el('p', undefined, 'bode-warning'); warning.setAttribute('role', 'status');
  const readout = el('p', undefined, 'bode-live-readout'); readout.setAttribute('aria-live', 'polite');
  const feedback = el('p', undefined, 'bode-live-status'); feedback.setAttribute('role', 'status'); visual.append(warning, plots, readout, feedback);
  const examples = select(controls, 'Example', [['baseline', 'Baseline — two real poles'], ['quadratic', 'Resonant quadratic (proposed)'], ['rhp', 'Right-half-plane zero (proposed)'], ['delay', 'Pure delay (proposed)'], ['origin', 'Integrator (proposed)']]);
  const choice = select(controls, 'Selected factor', []);
  const corner = numeric(controls, 'Actual corner [rad/s]', 1, 1e-4, 1e4);
  const cornerRange = numeric(controls, 'Move selected corner (log scale)', 0, -4, 4, true); cornerRange.step = '.01';
  const damping = numeric(controls, 'Damping ratio ζ', .25, .05, 1); damping.step = '.01';
  const gainControl = numeric(controls, 'Raw gain K (signed)', 1, -1e6, 1e6);
  const gainRange = numeric(controls, 'Gain magnitude (log scale)', 0, -6, 6, true); gainRange.step = '.01';
  const delayControl = numeric(controls, 'Delay τ [s]', 0, 0, 10);
  const delayRange = numeric(controls, 'Move delay [s]', 0, 0, 10, true); delayRange.step = '.01';
  controls.append(el('p', 'Corner movement preserves a₀, raw K, first-order half-plane sign and quadratic damping. Gain translates magnitude; pure delay changes phase only.', 'bode-small'));
  const actions = el('div', undefined, 'bode-actions'); controls.append(actions); const undo = button(actions, 'Undo model edit'), fit = button(actions, 'Fit axes'); undo.disabled = true;
  const view = depth(controls, 'Frequency, units and contribution');
  const units = select(view, 'Frequency unit', [['rad/s', 'rad/s'], ['Hz', 'Hz']]), magnitude = select(view, 'Magnitude unit', [['db', 'dB'], ['linear', 'Linear ratio']]);
  const lowInput = numeric(view, 'Lower frequency [rad/s]', .01, 1e-4, 1e4), highInput = numeric(view, 'Upper frequency [rad/s]', 100, 1e-4, 1e4), cursor = numeric(view, 'Cursor frequency [rad/s]', 1, 1e-4, 1e4);
  const cursorRange = numeric(view, 'Move frequency cursor (log scale)', 0, -2, 2, true); cursorRange.step = '.01';
  const contribution = select(view, 'Contribution to highlight', [['factor', 'Selected factor'], ['all', 'Total only'], ['gain', 'Normalization gain'], ['origin', 'Origin factor'], ['delay', 'Pure delay']]);
  const raw = depth(root, 'Full model — edit raw coefficients or add/remove factors');
  raw.append(el('p', 'Ascending coefficients a₀+a₁s+a₂s². Values shown here are reparsed before every model edit. Simple fractions and decimals are supported. Changing a₀ intentionally changes the normalization gain.'));
  const rawGlobals = el('div', undefined, 'bode-fields'); raw.append(rawGlobals);
  let checked = snapshot(baseline()), selected = 0, unit: FrequencyUnit = 'rad/s', history: Snapshot | undefined;
  let axes: [Axis, Axis] | undefined, width = 660, geometry: Geometry | undefined, validDraft = true, disposed = false, timer: number | undefined;
  let invalidQuick: HTMLInputElement | undefined, pendingRaw = false;
  let normalizationEquation: HTMLElement | undefined, normalizationValue: number | undefined;
  let gesture: { base: Snapshot; pointer?: number; source?: HTMLInputElement; kind: 'corner' | 'gain' | 'delay'; factor: number; value?: number } | undefined;
  let observer: ResizeObserver | undefined;
  // Link ownership before the first editor can register a resource or throw.
  parent.addEventListener('abort', dispose, { once: true });
  if (parent.aborted) { dispose(); return; }
  const entry = { tools: ['fraction', 'parentheses'] as const, description: 'Enter a signed real number, decimal with up to 9 places, or a simple fraction. Algebraic expressions and powers are unsupported.' };
  function editor(parentNode: HTMLElement, label: string, value: string) {
    const input = createEquationInput({ ...entry, label, value, signal, onChange: () => { cancelGesture(); validDraft = false; clearPlots('Raw model draft changed; checking…'); queueRaw(); } }); editors.push(input); parentNode.append(input.element); return input;
  }
  const gain = editor(rawGlobals, 'Raw gain K', checked.gain), delay = editor(rawGlobals, 'Pure delay τ [s]', checked.delay);
  const origin = select(raw, 'Power of s at the origin', Array.from({ length: 7 }, (_, i) => [String(i - 3), String(i - 3)])); origin.value = '0';
  const factorRaw = el('div', undefined, 'bode-coefficients'); raw.append(factorRaw);
  const position = select(factorRaw, 'Selected factor position', [['pole', 'Denominator (pole factor)'], ['zero', 'Numerator (zero factor)']]);
  const order = select(factorRaw, 'Selected factor order', [['first', 'First order'], ['second', 'Second order']]);
  const coefficients = [0, 1, 2].map(i => editor(factorRaw, `Selected factor coefficient a${['₀', '₁', '₂'][i]}`, checked.factors[0][i]));
  const factorActions = el('div', undefined, 'bode-actions'); raw.append(factorActions); const add = button(factorActions, 'Add a factor'), remove = button(factorActions, 'Remove selected factor'), apply = button(factorActions, 'Check raw model');
  const reasoning = depth(root, 'Normalization, slopes and cursor contributions');
  const limits = depth(root, 'Supported model and approximation limits');
  limits.append(el('p', 'K·sⁿ·exp(−τs) times up to six numerator/denominator first- or second-order factors. First order: a₀>0 and signed nonzero a₁; a₁<0 is a right-half-plane factor. Quadratics: positive coefficients and 0.05≤ζ≤1. Enter overdamped roots as separate first-order factors. Nonzero coefficient and raw gain magnitudes: 10⁻⁶–10⁶; K cannot be zero, n is −3…3, delay 0…10 s, angular corners/frequencies 10⁻⁴–10⁴ rad/s. Small positive delay is allowed below the coefficient floor.'));
  limits.append(el('p', 'All calculations retain the existing bounded scalar parser (12 digits per number, 9 decimal places or a simple fraction; no algebraic expressions). Derived coefficient fractions are numerical representations, reparsed before plotting. Normalization and plotted values are rounded for display. Phase is additive and unwrapped, with negative K contributing +180°. No feedback, stability verdict or time-response claim is implied. Right-half-plane factors are formal frequency evaluations.'));
  limits.append(el('p', 'Exact numerical response is evaluated at 601 log-spaced samples plus corners and cursor. Dashed magnitude lines are asymptotes; phase transitions span 0.1–10 times each corner. Delay adds −ωτ radians with no Padé approximation. Slopes combine corner events within relative 10⁻¹² resolution. These sampled curves do not prove complete extrema. Contributions add in dB/degrees; linear magnitudes multiply. Drag or use the numeric corner/range controls; arrow keys move a focused marker by 0.02 decade (Shift: 0.1); Home/End use the visible frequency bounds. Escape cancels an active gesture. Axes stay fixed until Fit.'));

  function clearTimer() { if (timer !== undefined) window.clearTimeout(timer); timer = undefined; }
  function clearPlots(message: string) { plots.replaceChildren(); readout.textContent = ''; warning.textContent = ''; reasoning.replaceChildren(el('summary', 'Normalization, slopes and cursor contributions')); feedback.textContent = message; }
  function report(error: unknown) { validDraft = false; clearPlots(error instanceof Error ? error.message : 'Check the model and frequency controls.'); }
  function read(editorInput: EquationInput, title: string, delayValue = false) {
    const draft = editorInput.getValue(); if (draft.empty || draft.hasPlaceholders || draft.syntaxIssues.length) throw new Error(`Complete ${title} and check its notation.`);
    return { text: draft.latex, value: (delayValue ? parseDelay : parseReal)(draft.latex) };
  }
  function readRaw(): Snapshot {
    const k = read(gain, 'Raw gain K'), tau = read(delay, 'Pure delay', true), texts = checked.factors.map(values => [...values]);
    const factors = checked.model.factors.map((factor, i) => {
      if (i !== selected) return factor;
      const values = coefficients.map((field, j) => j === 2 && order.value === 'first' ? { text: field.getValue().latex, value: 0 } : read(field, `coefficient a${j}`));
      texts[i] = values.map(v => v.text);
      return { kind: order.value as Factor['kind'], position: position.value as Factor['position'], a0: values[0].value, a1: values[1].value, a2: values[2].value };
    });
    const model = { gain: k.value, delay: tau.value, originPower: Number(origin.value), factors }; normalize(model); return { model, gain: k.text, delay: tau.text, factors: texts };
  }
  function synchronize() {
    invalidQuick = undefined;
    const model = checked.model, factor = model.factors[selected];
    const set = (input: EquationInput, text: string) => { if (input.getValue().latex !== text) input.setValue(text); };
    set(gain, checked.gain); set(delay, checked.delay); origin.value = String(model.originPower);
    gainControl.value = String(model.gain); gainRange.value = String(Math.log10(Math.abs(model.gain))); delayControl.value = String(model.delay); delayRange.value = String(model.delay);
    choice.replaceChildren(); model.factors.forEach((f, i) => { const option = el('option', `Factor ${i + 1} · ${f.position} · ${f.kind === 'first' ? '1st' : '2nd'} order`); option.value = String(i); choice.append(option); }); choice.value = String(selected);
    choice.disabled = !factor; add.disabled = model.factors.length >= 6; remove.disabled = !factor;
    corner.disabled = cornerRange.disabled = !factor; position.disabled = order.disabled = !factor; coefficients.forEach(c => c.element.hidden = !factor);
    if (factor) {
      const f = normalizeFactor(factor); corner.value = String(fromAngular(f.corner, unit)); cornerRange.value = String(Math.log10(f.corner));
      damping.value = String(f.damping ?? .25); damping.parentElement!.hidden = factor.kind !== 'second';
      position.value = factor.position; order.value = factor.kind; coefficients.forEach((field, i) => set(field, checked.factors[selected][i])); coefficients[2].element.hidden = factor.kind !== 'second';
    } else { damping.parentElement!.hidden = true; corner.value = ''; }
    undo.disabled = !history;
  }
  function viewValues() {
    const low = toAngular(readNumericInput(lowInput, 'Lower frequency'), unit), high = toAngular(readNumericInput(highInput, 'Upper frequency'), unit), omega = toAngular(readNumericInput(cursor, 'Cursor frequency'), unit);
    const grid = frequencyGrid(low, high); frequency(omega); if (omega < low || omega > high) throw new Error('Place the cursor inside the displayed frequency range.'); return { low, high, omega, grid };
  }
  function redraw(fitAxes = false) {
    if (signal.aborted || !validDraft || !isActive()) return;
    const model = checked.model, n = normalize(model), { low, high, omega, grid } = viewValues();
    const omegas = [...new Set([...grid, ...n.factors.map(f => f.corner).filter(c => c >= low && c <= high), omega])].sort((a, b) => a - b), exact = omegas.map(w => responseAt(model, w));
    const mag = (db: number) => magnitude.value === 'linear' ? dbToLinear(db) : db;
    const magCurves: Curve[] = [{ name: 'Exact numerical — solid', values: exact.map(r => mag(r.db)), style: 'bode-exact-line' }, { name: 'Asymptotic — dashed', values: exact.map(r => mag(r.asymptoteDb)), style: 'bode-asymptote-line' }];
    const phaseCurves: Curve[] = [{ name: 'Exact unwrapped — solid', values: exact.map(r => r.phase), style: 'bode-exact-line' }, { name: 'Phase approximation — dashed', values: exact.map(r => r.asymptotePhase), style: 'bode-asymptote-line' }];
    const term = (w: number): Pick<Contribution, 'db' | 'phase'> | undefined => contribution.value === 'factor' ? model.factors[selected] && factorAt(model.factors[selected], w) : contribution.value === 'gain' ? { db: 20 * Math.log10(Math.abs(n.gain)), phase: model.gain < 0 ? 180 : 0 } : contribution.value === 'origin' ? { db: 20 * model.originPower * Math.log10(w), phase: 90 * model.originPower } : contribution.value === 'delay' ? { db: 0, phase: -model.delay * w * 180 / Math.PI } : undefined;
    const highlighted = omegas.map(term);
    if (highlighted[0]) { const title = contribution.value === 'factor' ? `Factor ${selected + 1} normalized` : contribution.selectedOptions[0].text; magCurves.push({ name: `${title} — dash-dot`, values: highlighted.map(c => mag(c!.db)), style: 'bode-contribution-line' }); phaseCurves.push({ name: `${title} — dash-dot`, values: highlighted.map(c => c!.phase), style: 'bode-contribution-line' }); }
    const markers = n.factors.map((f, i) => ({ omega: f.corner, name: `c${i + 1}`, style: i === selected ? 'bode-selected-marker' : 'bode-checked-marker', factor: i }));
    const magnitudePlot = createPlot(omegas, magCurves, markers, omega, unit, 'Magnitude response', magnitude.value === 'linear' ? 'Magnitude [output / input ratio]' : 'Magnitude [dB]', { width, axis: fitAxes ? undefined : axes?.[0], interactive: true, nonnegative: magnitude.value === 'linear' });
    const phasePlot = createPlot(omegas, phaseCurves, markers, omega, unit, 'Phase response', 'Unwrapped phase [deg]', { width, axis: fitAxes ? undefined : axes?.[1], interactive: true });
    axes = [magnitudePlot.axis, phasePlot.axis]; geometry = magnitudePlot.geometry;
    const focused = plots.contains(document.activeElement); plots.replaceChildren(magnitudePlot.figure, phasePlot.figure); if (focused || gesture?.pointer !== undefined) plots.focus({ preventScroll: true });
    const notices: string[] = [];
    if (n.factors.some(f => f.corner < low || f.corner > high)) notices.push('Some actual corners are outside the visible frequency range. Widen the range to inspect them.');
    if (magnitudePlot.clipped || phasePlot.clipped) notices.push('Some curves extend beyond the fixed axes. Choose Fit axes to see them.');
    if (model.factors.some(f => f.kind === 'first' && f.a1 < 0)) notices.push('Right-half-plane factors: this is a formal frequency evaluation, not a stable sinusoidal experiment.');
    warning.textContent = notices.join(' ');
    const at = responseAt(model, omega), selectedAt = term(omega);
    readout.textContent = `At ${fmt(fromAngular(omega, unit))} ${unit}: |G|=${fmt(at.magnitude)}, ${fmt(at.db)} dB, ${fmt(at.phase)}°. Exact − asymptotic: ${fmt(at.db - at.asymptoteDb)} dB, ${fmt(at.phase - at.asymptotePhase)}°.${selectedAt ? ` Highlighted: ${fmt(selectedAt.db)} dB, ${fmt(selectedAt.phase)}°.` : ''}`;
    reasoning.replaceChildren(el('summary', 'Normalization, slopes and cursor contributions'));
    if (!normalizationEquation || normalizationValue !== n.gain) { normalizationEquation = createEquationDisplay(`K_n=K\\frac{\\prod_{\\mathrm{numerator}}a_0}{\\prod_{\\mathrm{denominator}}a_0}\\approx${n.gain.toPrecision(8).replace(/e([+-]?\d+)/, '\\times10^{$1}')}`, 'Normalization gain'); normalizationValue = n.gain; }
    reasoning.append(normalizationEquation, el('p', `Raw K=${fmt(model.gain)}; normalization gain Kₙ=${fmt(n.gain)}. The selected normalized factor excludes its a₀ constant. Contributions add in dB/degrees; linear ratios multiply.`));
    reasoning.append(el('p', slopeIntervals(model).map(s => `${fmt(fromAngular(s.from, unit))} < ${unit === 'Hz' ? 'f' : 'ω'} < ${fmt(fromAngular(s.to, unit))}: ${s.slope} dB/dec`).join('; ')));
    reasoning.append(el('p', `Cursor contributions: gain ${fmt(20 * Math.log10(Math.abs(n.gain)))} dB / ${model.gain < 0 ? 180 : 0}°; origin ${fmt(20 * model.originPower * Math.log10(omega))} dB / ${90 * model.originPower}°; delay 0 dB / ${fmt(-model.delay * omega * 180 / Math.PI)}°; ${at.contributions.map((c, i) => `factor ${i + 1}: ${fmt(c.db)} dB / ${fmt(c.phase)}°`).join('; ')}.`));
    cursorRange.min = String(Math.log10(low)); cursorRange.max = String(Math.log10(high)); cursorRange.value = String(Math.log10(omega));
  }
  function publish(next: Snapshot, message: string, remember = true, fitAxes = false, nextSelected = selected) {
    normalize(next.model); viewValues(); const previous = checked, previousSelected = selected; checked = next; selected = nextSelected; validDraft = true;
    try { redraw(fitAxes); if (remember) history = previous; synchronize(); feedback.textContent = message; }
    catch (error) { checked = previous; selected = previousSelected; validDraft = true; synchronize(); redraw(); throw error; }
  }
  function runRaw() { clearTimer(); try { publish(readRaw(), 'Checked raw model. Plots use the displayed coefficients.'); } catch (error) { report(error); } }
  function queueRaw() { if (disposed || signal.aborted) return; if (!isActive()) { pendingRaw = true; return; } if (timer === undefined) timer = window.setTimeout(() => { timer = undefined; runRaw(); }, 40); }
  function begin(kind: 'corner' | 'gain' | 'delay', pointer?: number, factor = selected, source?: HTMLInputElement) {
    if (gesture && (gesture.kind !== kind || gesture.factor !== factor || gesture.pointer !== pointer || gesture.source !== source)) commit();
    if (gesture) return;
    if (invalidQuick) throw new Error(`Correct ${invalidQuick.getAttribute('aria-label')} before another model or view change, or check the raw model to restore its values.`);
    // An invalid visible draft must never be silently replaced by a gesture.
    const current = readRaw(); viewValues(); checked = current; validDraft = true; gesture = { base: current, pointer, source, kind, factor };
  }
  function propose(value: number) {
    if (!gesture) return;
    const base = gesture.base; let next: Snapshot;
    if (gesture.kind === 'corner') {
      const edit = editFactor(base.model.factors[gesture.factor], value); const factors = base.factors.map(values => [...values]); factors[gesture.factor][1] = edit.a1; if (edit.factor.kind === 'second') factors[gesture.factor][2] = edit.a2;
      next = { ...base, factors, model: { ...base.model, factors: base.model.factors.map((f, i) => i === gesture!.factor ? edit.factor : f) } };
    } else if (gesture.kind === 'gain') { const text = scalarText(value), parsed = parseReal(text); next = { ...base, gain: text, model: { ...base.model, gain: parsed } }; }
    else { const text = scalarText(value, true); next = { ...base, delay: text, model: { ...base.model, delay: parseDelay(text) } }; }
    publish(next, 'Live preview from displayed, checked coefficients. Release to commit; Escape cancels.', false);
  }
  function flush() { clearTimer(); if (gesture?.value !== undefined) { const value = gesture.value; gesture.value = undefined; propose(value); } }
  function queue(value: number) { if (!gesture) return; gesture.value = value; if (timer === undefined) timer = window.setTimeout(() => { timer = undefined; try { flush(); } catch (error) { cancelGesture(); feedback.textContent = error instanceof Error ? error.message : 'This edit is unsupported.'; } }, 32); }
  function releasePointer() {
    const pointer = gesture?.pointer; gesture = undefined;
    if (pointer !== undefined && plots.hasPointerCapture?.(pointer)) plots.releasePointerCapture(pointer);
  }
  function commit() { if (!gesture) return; try { flush(); history = gesture.base; releasePointer(); synchronize(); feedback.textContent = 'Checked model edit committed. Displayed coefficients determine both plots.'; } catch (error) { cancelGesture(); feedback.textContent = error instanceof Error ? error.message : 'This edit is unsupported.'; } }
  function cancelGesture() { clearTimer(); if (!gesture) return; checked = gesture.base; releasePointer(); validDraft = true; synchronize(); try { redraw(); feedback.textContent = 'Gesture cancelled; previous checked model restored.'; } catch (error) { report(error); } }
  function quick(input: HTMLInputElement, kind: 'corner' | 'gain' | 'delay', value: () => number, range = false) {
    input.addEventListener('input', () => {
      const draft = input.value;
      try { const proposed = value(); if (invalidQuick === input) invalidQuick = undefined; begin(kind, undefined, selected, input); if (range) queue(proposed); else propose(proposed); }
      catch (error) { const blocked = invalidQuick; if (gesture) cancelGesture(); input.value = draft; if (!range) invalidQuick = blocked ?? input; report(error); }
    }, { signal });
    input.addEventListener('change', commit, { signal });
    input.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); commit(); } }, { signal });
  }
  quick(corner, 'corner', () => toAngular(readNumericInput(corner, 'Actual corner'), unit));
  quick(cornerRange, 'corner', () => 10 ** readNumericInput(cornerRange, 'Corner range'), true);
  quick(gainControl, 'gain', () => readNumericInput(gainControl, 'Raw gain K'));
  quick(gainRange, 'gain', () => Math.sign(checked.model.gain) * 10 ** readNumericInput(gainRange, 'Gain range'), true);
  quick(delayControl, 'delay', () => readNumericInput(delayControl, 'Delay'));
  quick(delayRange, 'delay', () => readNumericInput(delayRange, 'Delay range'), true);
  damping.addEventListener('input', () => {
    cancelGesture(); try {
      if (invalidQuick === damping) invalidQuick = undefined;
      if (invalidQuick) throw new Error(`Correct ${invalidQuick.getAttribute('aria-label')} before another model change.`);
      const current = readRaw(), f = normalizeFactor(current.model.factors[selected]), edit = editFactor(current.model.factors[selected], f.corner, readNumericInput(damping, 'Damping ratio'));
      const factors = current.factors.map(v => [...v]); factors[selected][1] = edit.a1; factors[selected][2] = edit.a2;
      publish({ ...current, factors, model: { ...current.model, factors: current.model.factors.map((v, i) => i === selected ? edit.factor : v) } }, 'Checked damping edit; natural frequency and normalization gain preserved.');
    } catch (error) { invalidQuick ??= damping; report(error); }
  }, { signal });
  choice.addEventListener('change', () => { const next = Number(choice.value); cancelGesture(); try { if (invalidQuick) throw new Error(`Correct ${invalidQuick.getAttribute('aria-label')} before selecting another factor, or check the raw model to restore its values.`); const current = readRaw(); publish(current, 'Selected factor linked on both plots.', JSON.stringify(current.model) !== JSON.stringify(checked.model), false, next); } catch (error) { choice.value = String(selected); report(error); } }, { signal });
  apply.addEventListener('click', runRaw, { signal });
  for (const input of [origin, position, order]) input.addEventListener('change', () => {
    cancelGesture();
    try {
      if (input === order) { window.mathVirtualKeyboard?.hide({ animate: false }); coefficients[2].element.hidden = order.value === 'first'; if (order.value === 'second' && parseReal(coefficients[2].getValue().latex) === 0) coefficients[2].setValue('1'); }
      runRaw();
    } catch (error) { report(error); }
  }, { signal });
  add.addEventListener('click', () => { cancelGesture(); try {
    const current = readRaw(); if (current.model.factors.length >= 6) throw new Error('Use at most six factors.');
    publish({ ...current, factors: [...current.factors, ['1', '1', '0']], model: { ...current.model, factors: [...current.model.factors, { kind: 'first', position: 'pole', a0: 1, a1: 1, a2: 0 }] } }, 'Added a first-order pole factor.', true, false, current.model.factors.length);
  } catch (error) { report(error); } }, { signal });
  remove.addEventListener('click', () => { cancelGesture(); try {
    const current = readRaw(), index = selected;
    publish({ ...current, factors: current.factors.filter((_, i) => i !== index), model: { ...current.model, factors: current.model.factors.filter((_, i) => i !== index) } }, 'Removed the selected factor.', true, false, Math.max(0, Math.min(selected, current.model.factors.length - 2)));
  } catch (error) { report(error); } }, { signal });
  undo.addEventListener('click', () => { cancelGesture(); if (!history) return; const previous = history; try { publish(previous, 'Previous checked model restored.', false, false, Math.min(selected, Math.max(0, previous.model.factors.length - 1))); history = undefined; undo.disabled = true; } catch (error) { report(error); } }, { signal });
  fit.addEventListener('click', () => { cancelGesture(); try { redraw(true); } catch (error) { report(error); } }, { signal });
  function displayChanged(fitAxes = false) { cancelGesture(); try { if (invalidQuick) throw new Error(`Correct ${invalidQuick.getAttribute('aria-label')} before changing the view, or check the raw model to restore its values.`); if (!validDraft) { const current = readRaw(); publish(current, 'Checked model; view updated.', JSON.stringify(current.model) !== JSON.stringify(checked.model), fitAxes); } else redraw(fitAxes); } catch (error) { report(error); } }
  function labelFrequencies() {
    [lowInput, highInput, cursor, corner].forEach((input, i) => { const title = `${['Lower frequency', 'Upper frequency', 'Cursor frequency', 'Actual corner'][i]} [${unit}]`; input.setAttribute('aria-label', title); input.parentElement!.firstChild!.textContent = title; input.min = String(fromAngular(1e-4, unit)); input.max = String(fromAngular(1e4, unit)); });
  }
  [lowInput, highInput, cursor].forEach(input => input.addEventListener('input', () => displayChanged(), { signal }));
  magnitude.addEventListener('change', () => displayChanged(true), { signal }); contribution.addEventListener('change', () => displayChanged(), { signal });
  cursorRange.addEventListener('input', () => { try { cursor.value = String(fromAngular(10 ** readNumericInput(cursorRange, 'Frequency cursor'), unit)); displayChanged(); } catch (error) { report(error); } }, { signal });
  units.addEventListener('change', () => {
    cancelGesture(); const next = units.value as FrequencyUnit;
    try {
      const inputs = [lowInput, highInput, cursor, ...(checked.model.factors.length ? [corner] : [])], values = inputs.map(input => { const omega = toAngular(readNumericInput(input, 'Frequency'), unit); frequency(omega); return fromAngular(omega, next); });
      inputs.forEach((input, i) => input.value = String(values[i])); unit = next;
      labelFrequencies(); displayChanged();
    } catch (error) { units.value = unit; report(error); }
  }, { signal });
  plots.addEventListener('pointerdown', event => {
    if (!isActive()) return;
    const target = (event.target as Element).closest('[data-factor]'); if (!target || event.button !== 0) return;
    if (gesture?.pointer !== undefined) return;
    commit(); try { checked = readRaw(); selected = Number(target.getAttribute('data-factor')); synchronize(); begin('corner', event.pointerId, selected); redraw(); plots.focus({ preventScroll: true }); event.preventDefault(); plots.setPointerCapture?.(event.pointerId); } catch (error) { report(error); }
  }, { signal });
  window.addEventListener('pointermove', event => { if (!isActive() || gesture?.pointer !== event.pointerId || !geometry) return; event.preventDefault(); try { const image = plots.querySelector('svg'); if (image) queue(pointerFrequency(event.clientX, image.getBoundingClientRect(), geometry)); } catch (error) { cancelGesture(); feedback.textContent = error instanceof Error ? error.message : 'Pointer edit failed.'; } }, { signal, passive: false });
  window.addEventListener('pointerup', event => { if (isActive() && gesture?.pointer === event.pointerId) commit(); }, { signal });
  window.addEventListener('pointercancel', event => { if (isActive() && gesture?.pointer === event.pointerId) cancelGesture(); }, { signal });
  plots.addEventListener('lostpointercapture', event => { if (isActive() && gesture?.pointer === event.pointerId) cancelGesture(); }, { signal });
  window.addEventListener('blur', () => { if (isActive()) cancelGesture(); }, { signal });
  window.addEventListener('keydown', event => { if (isActive() && event.key === 'Escape' && gesture) { event.preventDefault(); event.stopImmediatePropagation(); cancelGesture(); plots.focus({ preventScroll: true }); } }, { signal, capture: true });
  plots.addEventListener('keydown', event => {
    if (!isActive()) return;
    const target = (event.target as Element).closest('[data-factor]'); if (!target || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
    const originPlot = target.closest('svg[aria-label]')?.getAttribute('aria-label');
    event.preventDefault(); try {
      cancelGesture(); checked = readRaw(); selected = Number(target.getAttribute('data-factor')); synchronize(); const f = normalizeFactor(checked.model.factors[selected]), bounds = viewValues();
      begin('corner'); propose(event.key === 'Home' ? bounds.low : event.key === 'End' ? bounds.high : Math.max(bounds.low, Math.min(bounds.high, f.corner * 10 ** ((event.key === 'ArrowRight' || event.key === 'ArrowUp' ? 1 : -1) * (event.shiftKey ? .1 : .02))))); commit();
      const samePlot = [...plots.querySelectorAll('svg[aria-label]')].find(plot => plot.getAttribute('aria-label') === originPlot);
      samePlot?.querySelector<SVGElement>(`[data-factor="${selected}"]`)?.focus({ preventScroll: true });
    } catch (error) { cancelGesture(); feedback.textContent = error instanceof Error ? error.message : 'This corner edit is unsupported.'; }
  }, { signal });
  examples.addEventListener('change', () => {
    cancelGesture(); const base = baseline();
    const model: Model = examples.value === 'quadratic' ? { gain: 1, delay: 0, originPower: 0, factors: [{ kind: 'second', position: 'pole', a0: 4, a1: 1, a2: 1 }] } : examples.value === 'rhp' ? { ...base, factors: [...base.factors, { kind: 'first', position: 'zero', a0: 1, a1: -1, a2: 0 }] } : examples.value === 'delay' ? { ...base, delay: .5 } : examples.value === 'origin' ? { ...base, originPower: -1 } : base;
    try { publish(snapshot(model), 'Checked example loaded. Proposed variations are labelled in the menu.', true, true, 0); } catch (error) { report(error); }
  }, { signal });
  const resize = () => { if (disposed || !isActive()) return; const next = plots.getBoundingClientRect().width; if (next > 0 && Math.abs(next - width) > 1) { cancelGesture(); width = next; try { redraw(); } catch (error) { report(error); } } };
  observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(resize);
  if (disposed || signal.aborted) observer?.disconnect(); else observer?.observe(plots);
  window.addEventListener('resize', resize, { signal });
  function dispose() { if (disposed) return; disposed = true; parent.removeEventListener('abort', dispose); clearTimer(); releasePointer(); observer?.disconnect(); life.abort(); editors.forEach(e => e.destroy()); root.remove(); }
  if (hooks) {
    hooks.suspend = () => {
      pendingRaw ||= timer !== undefined && !gesture;
      // A valid typed value settles like blur; an unfinished drag/range rolls back.
      if (gesture?.source?.type === 'number') commit(); else cancelGesture();
    };
    hooks.resume = () => { resize(); if (pendingRaw) { pendingRaw = false; queueRaw(); } };
  }
  if (parent.aborted) dispose(); else { synchronize(); labelFrequencies(); validDraft = true; try { redraw(true); feedback.textContent = 'Checked baseline. Both plots respond to the controls.'; resize(); } catch (error) { report(error); } }
  return dispose;
};
