import type { ModuleMount } from '../../core/module';
import { createEquationDisplay, createEquationInput, type EquationInput } from '../../shared/equations/input';
import { readNumericInput } from '../../shared/numeric-input';
import { parseNumber } from './number-expression';
import { measure, openResponse, simulate, tune, validatePlant, type Controller, type Kind, type Plant } from './math';
import { plot } from './plot';
import './style.css';

const reference = 'https://modeling-and-simulation-book-fet-edu-em-control--aa8411c2554302.pages.gitlab.kuleuven.be/Content/Control/4_Ziegler-Nichols.html';
// Plain decimal result text avoids displaying a mathematical e as a number suffix.
const fmt = (n: number) => n === 0 ? '0' : n.toLocaleString('en-US', { useGrouping: false, maximumSignificantDigits: 5 });
function element<K extends keyof HTMLElementTagNameMap>(tag: K, text?: string, className?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag); if (text !== undefined) e.textContent = text; if (className) e.className = className; return e;
}

export const mount: ModuleMount = ({ container, signal: parent }) => {
  if (parent.aborted) return;
  const lifetime = new AbortController(), signal = lifetime.signal;
  const forward = () => lifetime.abort(); parent.addEventListener('abort', forward, { once: true });
  const root = element('div', undefined, 'cd07'); root.dataset.module = 'CD07'; container.append(root);
  const editors: EquationInput[] = [];
  const cleanup = () => { lifetime.abort(); parent.removeEventListener('abort', forward); editors.forEach(e => e.destroy()); root.remove(); };
  try {
    let plant: Plant | null = null, suggestion: Controller | null = null;
    const feedback = element('p', 'Edit the model or move the tangent markers. Confirm the assumptions before revealing a rule.', 'cd07-feedback'); feedback.setAttribute('role', 'status');
    function section(title: string): HTMLElement { const s = element('section'); s.append(element('h2', title)); root.append(s); return s; }
    function note(host: HTMLElement, text: string): void { host.append(element('p', text, 'cd07-note')); }
    function button(host: HTMLElement, text: string, action: () => void, primary = false): HTMLButtonElement {
      const b = element('button', text, primary ? 'cd07-primary' : ''); b.type = 'button'; host.append(b);
      b.addEventListener('click', () => { if (!signal.aborted) { b.after(feedback); action(); } }, { signal }); return b;
    }
    function number(host: HTMLElement, title: string, value: string, min: string, max: string): HTMLInputElement {
      const label = element('label', title), input = element('input'); input.type = 'number'; input.step = 'any'; input.min = min; input.max = max; input.value = value; label.append(input); host.append(label); return input;
    }
    function guard(action: () => void): void { try { action(); } catch (e) { feedback.textContent = e instanceof Error ? e.message : 'Check the inputs.'; } }
    const model = section('1. Read the reaction curve');
    note(model, 'Unit-step experiment on a stable first-order-plus-dead-time model. K is output/input; τ and L are seconds. Initial output, integral and filter states are zero.');
    model.append(createEquationDisplay(String.raw`G(s)=\frac{K e^{-Ls}}{\tau s+1}`, 'Supported plant'));
    const modelGrid = element('div', undefined, 'cd07-grid'); model.append(modelGrid);
    const dirty = () => { plant = null; suggestion = null; curve.replaceChildren(); derivation.replaceChildren(); comparison.replaceChildren(); compare.disabled = true; feedback.textContent = 'Inputs changed. Plot the curve, then check or reveal the rule again.'; };
    for (const [label, value] of [['Plant gain K', '1'], ['Time constant τ (s)', '2'], ['Delay L (s)', String.raw`\frac{1}{2}`]]) {
      const input = createEquationInput({ label, value, signal, onChange: dirty }); editors.push(input); modelGrid.append(input.element);
    }
    note(model, 'Enter numbers, fractions, +, −, ×, ÷, visible parentheses or integer powers −6…6. Use explicit + or × beside a fraction; e/E and mixed numbers are unsupported. K: 0.05…20; τ: 0.2…20 s; L: 0.02…10 s; 0.05 ≤ L/τ ≤ 1.');
    const presets = element('div', undefined, 'cd07-controls'); model.append(presets);
    button(presets, 'Baseline model', () => preset(['1', '2', String.raw`\frac{1}{2}`]));
    button(presets, 'Changed-data experiment', () => preset(['2', '3', '1']));
    const markers = element('div', undefined, 'cd07-controls'); model.append(markers);
    const lower = number(markers, 'Zero-intercept marker t₀ (s)', '0.5', '.02', '10');
    const upper = number(markers, 'Plateau-intercept marker t₁ (s)', '2.5', '.22', '30');
    note(model, 'Move these markers with typing or arrow keys to fit the dashed tangent. They estimate L̂ = t₀ and τ̂ = t₁ − t₀; the measured plateau is K. For this FOPDT surrogate, the true initial tangent starts at t = L.');
    const curveActions = element('div', undefined, 'cd07-controls'); model.append(curveActions);
    button(curveActions, 'Plot response curve', () => guard(drawCurve), true);
    button(curveActions, 'Use model tangent', () => guard(() => { const p = readPlant(); lower.value = fmt(p.delay); upper.value = fmt(p.delay + p.tau); dirty(); drawCurve(); }));
    const curve = element('div'); model.append(curve);
    function readPlant(): Plant {
      const values = editors.map(e => { const d = e.getValue(); if (d.empty || d.hasPlaceholders || d.syntaxIssues.length) throw new Error('Complete the model equation boxes and check their notation.'); return parseNumber(d.latex); });
      return validatePlant({ gain: values[0], tau: values[1], delay: values[2] });
    }
    function measurement(p: Plant) { return measure(p, readNumericInput(lower, 'zero-intercept marker'), readNumericInput(upper, 'plateau-intercept marker')); }
    function drawCurve(): void {
      plant = null; suggestion = null; curve.replaceChildren(); derivation.replaceChildren(); comparison.replaceChildren(); compare.disabled = true;
      const p = readPlant(), m = measurement(p), end = Math.max(p.delay + 5 * p.tau, m.delay + m.tau);
      const time = Array.from({ length: 401 }, (_, i) => end * i / 400);
      curve.append(plot('Open-loop unit-step response and measurement tangent', 'Output y (output units)', [
        { label: 'Plant response', x: time, y: time.map(t => openResponse(p, t)) },
        { label: 'Marker tangent', x: [m.delay, m.delay + m.tau], y: [0, p.gain], dashed: true },
      ], [p.gain]));
      curve.append(element('p', `Marker times: ${fmt(m.delay)} s at y = 0; ${fmt(m.delay + m.tau)} s at y = ${fmt(p.gain)}. Tangent slope: ${fmt(m.slope)} output units/s.`));
      plant = p; feedback.textContent = 'Curve updated. Predict Kp, confirm the model assumptions, then check or reveal the named rule.';
    }
    function preset(values: string[]): void {
      editors.forEach((e, i) => e.setValue(values[i])); dirty();
      guard(() => { const p = readPlant(); lower.value = fmt(p.delay); upper.value = fmt(p.delay + p.tau); drawCurve(); });
    }
    const rule = section('2. Predict, then reveal the tuning rule');
    const confirmLabel = element('label', undefined, 'cd07-confirm'), confirm = element('input'); confirm.type = 'checkbox';
    confirmLabel.append(confirm, element('span', 'I confirm a stable, monotone FOPDT step response with positive gain and nonzero delay, under negative unity feedback e = r − y. The rule is a heuristic starting point.')); rule.append(confirmLabel);
    const ruleControls = element('div', undefined, 'cd07-controls'); rule.append(ruleControls);
    const kindLabel = element('label', 'Controller structure'), kind = element('select');
    for (const name of ['P', 'PI', 'PID']) { const o = element('option', name); o.value = name; kind.append(o); } kind.value = 'PID'; kindLabel.append(kind); ruleControls.append(kindLabel);
    const prediction = number(ruleControls, 'Predicted Kp (optional)', '', '.001', '500');
    const reveal = button(ruleControls, 'Check prediction and reveal rule', () => guard(revealRule), true); reveal.disabled = true;
    const derivation = element('div'); rule.append(derivation);
    note(rule, 'Course audit: the original PI table reportedly prints Ti = 0.3L. This exercise uses Ti = L/0.3 ≈ 3.333L, not 0.3L; Ki = Kp/Ti. The original slide images are unavailable here and were not inspected.');
    const source = element('a', 'Rule source: KU Leuven, §5.8.1'); source.href = reference; source.target = '_blank'; source.rel = 'noreferrer'; rule.append(source);
    note(rule, 'The cited table supplies the unity-gain formulas; dividing Kp by plant gain K follows by normalizing the loop gain. No instructor correction to the original deck is claimed.');
    function revealRule(): void {
      suggestion = null; derivation.replaceChildren(); comparison.replaceChildren(); compare.disabled = true;
      if (!confirm.checked) throw new Error('Confirm the rule assumptions first.');
      drawCurve(); const p = plant!, m = measurement(p), selected = kind.value as Kind, next = tune(p, m, selected);
      let message = 'Rule revealed. Compare the suggested controller with a manual refinement.';
      if (prediction.value.trim()) {
        const predicted = readNumericInput(prediction, 'predicted Kp');
        if (predicted < .001 || predicted > 500) throw new Error('Predicted Kp must be from 0.001 to 500.');
        message = Math.abs(predicted - next.kp) <= .02 * next.kp ? 'Prediction agrees within 2%. Now test the controller.' : `Prediction differs: your Kp = ${fmt(predicted)}, rule Kp = ${fmt(next.kp)}. Check the measured delay, slope and plant gain.`;
      }
      derivation.append(createEquationDisplay(String.raw`\hat L=${fmt(m.delay)},\quad\hat\tau=${fmt(m.tau)},\quad R=\frac{K}{\hat\tau}=${fmt(m.slope)}`, 'Measured parameters in seconds and slope'));
      const factor = selected === 'P' ? '1' : selected === 'PI' ? '.9' : '1.2';
      derivation.append(createEquationDisplay(String.raw`K_p=${factor}\frac{\hat\tau}{K\hat L}=${fmt(next.kp)}`, 'Ziegler Nichols reaction curve gain'));
      if (next.ti !== null) derivation.append(createEquationDisplay(selected === 'PI' ? String.raw`T_i=\frac{\hat L}{0.3}=${fmt(next.ti)}\;\mathrm{s}` : String.raw`T_i=2\hat L=${fmt(next.ti)}\;\mathrm{s},\quad T_d=.5\hat L=${fmt(next.td)}\;\mathrm{s}`, 'Rule time parameters'));
      const integral = next.ti === null ? '' : String.raw`+\frac{1}{T_i s}`, derivative = next.td === 0 ? '' : '+T_d s';
      derivation.append(createEquationDisplay(String.raw`C_{\mathrm{ideal}}(s)=K_p\left(1${integral}${derivative}\right)`, 'Ideal standard controller'));
      if (next.td !== 0) derivation.append(createEquationDisplay(String.raw`C_f(s)=K_p\left(1+\frac{1}{T_i s}+\frac{T_d s}{1+(T_d/10)s}\right)`, 'Filtered controller used in the simulation'));
      const ki = next.ti === null ? 0 : next.kp / next.ti, kd = next.kp * next.td;
      derivation.append(createEquationDisplay(String.raw`K_p=${fmt(next.kp)},\quad K_i=${fmt(ki)},\quad K_d=${fmt(kd)}`, 'Equivalent ideal parallel gains'));
      note(derivation, 'Kp units: input/output; Ki: input/(output·s); Kd: input·s/output. P omits the integral term. Simulation replaces ideal differentiation with Td s/(1 + Td s/10), acting on error; derivative step kick is retained.');
      manualKp.value = fmt(next.kp); manualTi.value = fmt(next.ti ?? 1); manualTd.value = fmt(next.td);
      manualTi.disabled = selected === 'P'; manualTd.disabled = selected !== 'PID'; suggestion = next; compare.disabled = false; feedback.textContent = message;
    }
    const test = section('3. Test and refine the controller');
    note(test, 'Both responses use the actual plant above, not the measured surrogate. Change markers to explore identification error, or edit the manual controller to improve a requirement.');
    const manual = element('div', undefined, 'cd07-controls'); test.append(manual);
    const manualKp = number(manual, 'Manual Kp (input/output)', '4.8', '.001', '500');
    const manualTi = number(manual, 'Manual Ti (s)', '1', '.01', '100');
    const manualTd = number(manual, 'Manual Td (s)', '.25', '0', '10');
    const requirements = element('div', undefined, 'cd07-controls'); test.append(requirements);
    const horizon = number(requirements, 'Observation horizon (s)', '20', '1', '200');
    const overshoot = number(requirements, 'Maximum overshoot (%)', '20', '0', '100');
    const deadline = number(requirements, '2% entry deadline (s)', '10', '.1', '200');
    const compare = button(test, 'Compare controllers', () => guard(compareControllers), true); compare.disabled = true;
    const comparison = element('div'); test.append(comparison);
    note(test, 'Numerical experiment: method of steps with RK4 and interpolated past control; L is retained without a rational delay approximation. Each trace is checked at half the time step (output 0.2%, effort 0.5% scaled tolerances). At most 100,000 steps per run, four runs per comparison; magnitudes above 10,000 are rejected.');
    note(test, 'Metrics use the full computed trace: overshoot relative to unit reference, finite-window IAE, peak |u| and ending error. “Observed 2% entry” requires staying inside 0.98…1.02 through the horizon for at least max(τ, 2L). A short horizon is unresolved. Observations do not prove stability, future settling or steady-state error. No noise, saturation or hardware experiment is modeled.');
    root.append(feedback);
    function compareControllers(): void {
      comparison.replaceChildren();
      if (!suggestion || !plant || !confirm.checked) throw new Error('Plot the curve and reveal a rule with confirmed assumptions first.');
      const h = readNumericInput(horizon, 'observation horizon'), os = readNumericInput(overshoot, 'maximum overshoot'), due = readNumericInput(deadline, '2% entry deadline');
      if (os < 0 || os > 100 || due < .1 || due > 200) throw new Error('Use overshoot 0…100% and a deadline 0.1…200 s.');
      const selected = kind.value as Kind;
      const edited = { kp: readNumericInput(manualKp, 'manual Kp'), ti: selected === 'P' ? null : readNumericInput(manualTi, 'manual Ti'), td: selected === 'PID' ? readNumericInput(manualTd, 'manual Td') : 0 };
      const responses = [simulate(plant, suggestion, h), simulate(plant, edited, h)];
      for (const [field, label, unit] of [['y', 'Closed-loop unit-step response', 'Output y (output units)'], ['u', 'Controller effort (derivative acts on error)', 'Control u (input units)']] as const) {
        comparison.append(plot(label, unit, responses.map((r, i) => ({ label: i ? 'Manual refinement' : 'Suggested rule', x: r.trace.time, y: r.trace[field], dashed: i === 1 })), field === 'y' ? [.98, 1, 1.02] : []));
      }
      const wrap = element('div', undefined, 'cd07-table-wrap'), table = element('table', undefined, 'cd07-table'), head = element('thead'), row = element('tr');
      for (const t of ['Finite-horizon measure', 'Suggested rule', 'Manual refinement']) row.append(element('th', t)); head.append(row); table.append(head);
      const body = element('tbody');
      const rows: [string, ...string[]][] = [
        ['Overshoot', ...responses.map(r => `${fmt(r.metrics.overshoot)}%`)],
        ['Observed 2% entry', ...responses.map(r => r.metrics.entry === null ? 'Unresolved in horizon' : `${fmt(r.metrics.entry)} s`)],
        ['Ending error r − y', ...responses.map(r => fmt(r.metrics.endError))],
        ['IAE (output·s)', ...responses.map(r => fmt(r.metrics.iae))],
        ['Peak |u| (input units)', ...responses.map(r => fmt(r.metrics.peakEffort))],
        ['Requirement observations', ...responses.map(r => r.metrics.overshoot > os ? 'Fails overshoot limit' : r.metrics.entry === null ? 'Settling unresolved' : r.metrics.entry > due ? 'Fails entry deadline' : h < due ? 'Deadline beyond horizon' : 'Observed pass; finite horizon')],
      ];
      for (const values of rows) { const tr = element('tr'); values.forEach((s, i) => tr.append(element(i ? 'td' : 'th', s))); body.append(tr); } table.append(body); wrap.append(table); comparison.append(wrap);
      comparison.append(element('p', `Half-step differences (scaled): output ${responses.map(r => fmt(r.discrepancy)).join(' / ')}; effort ${responses.map(r => fmt(r.effortDiscrepancy)).join(' / ')}. Curves show suggested / manual controllers.`, 'cd07-note'));
      feedback.textContent = 'Comparison computed. Check requirement observations, ending error and effort before accepting the tuning heuristic.';
    }
    confirm.addEventListener('change', () => { reveal.disabled = !confirm.checked; dirty(); }, { signal });
    kind.addEventListener('change', dirty, { signal });
    for (const input of [lower, upper, prediction]) input.addEventListener('input', dirty, { signal });
    for (const input of [manualKp, manualTi, manualTd, horizon, overshoot, deadline]) input.addEventListener('input', () => { comparison.replaceChildren(); feedback.textContent = 'Test inputs changed. Compare controllers again to update the observations.'; }, { signal });
    drawCurve();
  } catch (e) { cleanup(); throw e; }
  return cleanup;
};
