import type { ModuleMount } from '../../core/module';
import { createEquationDisplay, createEquationInput, type EquationDraft } from '../../shared/equations/input';
import { readNumericInput } from '../../shared/numeric-input';
import { leadLatex, parseLead, parsePlant, plantLatex, validateLead, type Lead, type Plant } from './input';
import { bode, centerPeak, closedLoop, constantLead, corners, designLead, frequency, margins, matchGain, requiredPhase } from './frequency';
import { roots, type PoleResult } from './poles';
import { stepResponse, type StepResponse } from './response';
import { fmt, polynomial, tex } from './format';
import { geometry, plot } from './visuals';
import './style.css';
function el<K extends keyof HTMLElementTagNameMap>(tag: K, text = '', className = ''): HTMLElementTagNameMap[K] {
  const out = document.createElement(tag); out.textContent = text; if (className) out.className = className; return out;
}
function card(title: string): HTMLElement { const out = el('section', '', 'cd05-card'); out.append(el('h3', title)); return out; }
const eq = createEquationDisplay;
interface Result {
  p: Plant; c: Lead; base: Lead; omega: number; pm: number; H: number; maxOS: number; maxTs: number; minKv: number;
  before: ReturnType<typeof margins>; after: ReturnType<typeof margins>; required: ReturnType<typeof requiredPhase>;
  model: ReturnType<typeof closedLoop>; poles?: PoleResult; poleWarning: string;
  response?: StepResponse; baselineResponse?: StepResponse; responseWarning: string; baselineWarning: string;
}
export const mount: ModuleMount = ({ container, signal }) => {
  if (signal.aborted) return;
  const root = el('section', '', 'cd05-workspace'); root.dataset.module = 'CD05'; container.append(root);
  const inputs = card('1. Plant, proposed lead and requirements'), controls = el('div', '', 'cd05-controls'), helpers = el('div', '', 'cd05-controls');
  const results = el('div', '', 'cd05-results'); results.hidden = true;
  const feedback = el('p', 'Enter a proposal or use the construction steps, then reveal the full-loop checks.', 'cd05-feedback cd05-status'); feedback.setAttribute('role', 'status');
  const assessment = el('p', '', 'cd05-feedback cd05-assessment'); assessment.hidden = true; assessment.setAttribute('role', 'status');
  let result: Result | undefined, disposed = false, plantDraft: EquationDraft, controllerDraft: EquationDraft;
  const report = (text: string, error = false): void => { feedback.textContent = text; feedback.classList.toggle('cd05-error', error); };
  const invalidate = (): void => { result = undefined; results.hidden = true; results.replaceChildren(); assessment.hidden = true; assessment.textContent = ''; report('Data changed. Reveal again to check this complete proposal.'); };
  const safe = (action: () => void): void => { if (disposed || signal.aborted) return; try { action(); } catch (error) { report(error instanceof Error ? error.message : 'Check the inputs.', true); } };
  const number = (group: HTMLElement, label: string, value: string, min?: number, max?: number): HTMLInputElement => {
    const wrapper = el('label', '', 'cd05-number'), input = el('input'); input.type = 'number'; input.step = 'any'; input.value = value; input.setAttribute('aria-label', label);
    if (min !== undefined) input.min = String(min); if (max !== undefined) input.max = String(max);
    wrapper.append(el('span', label), input); group.append(wrapper); return input;
  };
  const watch = (input: HTMLInputElement): void => { input.addEventListener('input', invalidate, { signal }); };
  const button = (parent: HTMLElement, label: string, action: () => void): HTMLButtonElement => {
    const out = el('button', label); out.type = 'button'; out.addEventListener('click', () => safe(action), { signal }); parent.append(out); return out;
  };
  const C0 = number(controls, 'Baseline constant gain C₀', '4', .01, 1000);
  const target = number(controls, 'Target crossover (rad/s)', '2', .01, 100), pm = number(controls, 'Minimum phase margin (degrees)', '60', 1, 85);
  const horizon = number(controls, 'Response horizon (s)', '10', .1, 200), maxOS = number(controls, 'Maximum sampled overshoot (%)', '20', 0, 100);
  const maxTs = number(controls, 'Maximum 2% settling time (s)', '4', .1, 200), minKv = number(controls, 'Minimum velocity constant Kᵥ', '2', .000001, 1000000);
  const plant = createEquationInput({ label: 'Plant G(s)', value: plantLatex({ k: 1, a: 2 }), signal, onChange: d => { plantDraft = d; invalidate(); } });
  const controller = createEquationInput({ label: 'Proposed controller C(s)', value: leadLatex({ K: 4, T: 1 / Math.sqrt(2), alpha: .5 }), signal, onChange: d => { controllerDraft = d; invalidate(); } });
  plantDraft = plant.getValue(); controllerDraft = controller.getValue();
  const read = (): { p: Plant; c: Lead } => {
    plantDraft = plant.getValue(); controllerDraft = controller.getValue();
    for (const [draft, name] of [[plantDraft, 'G(s)'], [controllerDraft, 'C(s)']] as const) if (draft.empty || draft.hasPlaceholders || draft.syntaxIssues.length) throw new Error('Complete ' + name + ' and fill every fraction/power box.');
    return { p: parsePlant(plantDraft.latex), c: parseLead(controllerDraft.latex) };
  };
  const native = el('details'); native.append(el('summary', 'Native parameter and corner alternatives'));
  const k = number(helpers, 'Plant gain k', '1', .01, 100), a = number(helpers, 'Plant pole rate a (rad/s)', '2', .1, 100);
  const K = number(helpers, 'Controller DC gain K', '4', .01, 1000), T = number(helpers, 'Lead time T (s)', String(1 / Math.sqrt(2)), .01, 10);
  const alpha = number(helpers, 'Lead ratio α', '.5', .02, 1);
  const zero = number(helpers, 'Lead zero frequency ωz (rad/s)', String(Math.sqrt(2))), pole = number(helpers, 'Lead pole frequency ωp (rad/s)', String(2 * Math.sqrt(2)));
  function sync(p: Plant, c: Lead): void {
    k.value = String(p.k); a.value = String(p.a); K.value = String(c.K); T.value = String(c.T); alpha.value = String(c.alpha);
    const placement = corners(c); zero.value = String(placement.zero); pole.value = String(placement.pole);
  }
  function setController(c: Lead): void {
    const draft = plant.getValue();
    if (draft.empty || draft.hasPlaceholders || draft.syntaxIssues.length) throw new Error('Complete G(s) before applying a controller.');
    const p = parsePlant(draft.latex), latex = leadLatex(c);
    controller.setValue(latex); controllerDraft = controller.getValue(); sync(p, c); invalidate();
  }
  native.append(el('p', 'These are drafts until Apply. α=ωz/ωp and T=1/ωz. A lead zero is nearer the origin than its pole. α=1 is the constant-controller case.'), helpers);
  button(native, 'Apply numeric parameters', () => {
    const p = { k: readNumericInput(k, 'plant gain k'), a: readNumericInput(a, 'plant pole rate a') };
    const c = { K: readNumericInput(K, 'controller gain K'), T: readNumericInput(T, 'lead time T'), alpha: readNumericInput(alpha, 'lead ratio α') };
    const gp = plantLatex(p), cc = leadLatex(c); plant.setValue(gp); controller.setValue(cc); plantDraft = plant.getValue(); controllerDraft = controller.getValue(); sync(p, c); invalidate();
  });
  button(native, 'Copy equations to numeric drafts', () => { const model = read(); sync(model.p, model.c); report('Current equations copied into parameter drafts.'); });
  button(native, 'Apply corner frequencies', () => {
    const model = read(), wz = readNumericInput(zero, 'zero frequency'), wp = readNumericInput(pole, 'pole frequency');
    if (wz <= 0 || wp <= 0) throw new Error('Use positive corner frequencies with zero frequency no greater than pole frequency.');
    const c = { K: model.c.K, T: 1 / wz, alpha: wz / wp }; validateLead(c); setController(c);
  });
  inputs.append(el('p', 'Real integrating plants G(s)=k/[s(s+a)], k,a>0; one lead C(s)=K(1+Ts)/(1+αTs), K,T>0, .02≤α≤1. Negative unity feedback, zero initial states and a unit-step reference.'),
    plant.element, controller.element, controls, native);
  [C0, target, pm, horizon, maxOS, maxTs, minKv].forEach(watch);
  const construction = card('2. Choose phase, corners and gain'), actions = el('div');
  const prediction = number(construction, 'Predicted required phase boost (degrees, optional)', '');
  prediction.addEventListener('input', () => { assessment.hidden = true; assessment.textContent = ''; }, { signal });
  function optionalPrediction(): number | undefined { return !prediction.value.trim() && !prediction.validity.badInput ? undefined : readNumericInput(prediction, 'phase prediction'); }
  button(actions, 'Choose phase and center corners', () => {
    const m = read(), d = designLead(m.p, readNumericInput(target, 'target crossover'), readNumericInput(pm, 'minimum phase margin'));
    setController({ ...d.lead, K: m.c.K }); report('Phase and centered corners chosen; the old DC gain is retained. Set gain next to enforce the magnitude condition.');
  });
  button(actions, 'Center current lead at target', () => { const m = read(); setController(centerPeak(m.c, readNumericInput(target, 'target crossover'))); report('Current ratio retained; its geometric-mean frequency is centered at the target. Recheck gain.'); });
  button(actions, 'Set gain for target crossover', () => { const m = read(); setController(matchGain(m.p, m.c, readNumericInput(target, 'target crossover'))); report('DC gain set from the full loop magnitude at the target. Reveal to check the actual margin and response.'); });
  button(actions, 'Design corners and gain from targets', () => {
    const m = read(); setController(designLead(m.p, readNumericInput(target, 'target crossover'), readNumericInput(pm, 'minimum phase margin')).lead);
    report('Target construction applied. Reveal the complete loop to check every requirement.');
  });
  button(actions, 'Use course lead proposal', () => {
    plant.setValue(plantLatex({ k: 1, a: 2 })); controller.setValue(leadLatex({ K: 4, T: .7071067812, alpha: .5 }));
    plantDraft = plant.getValue(); controllerDraft = controller.getValue(); C0.value = '4'; target.value = '2'; pm.value = '60'; sync(read().p, read().c); invalidate();
    report('Course-rounded proposal applied: T=.7071067812 s, αT=.3535533906 s, K=4. Compare it with baseline C₀=4.');
  });
  button(actions, 'Use baseline constant controller', () => { setController(constantLead(readNumericInput(C0, 'baseline constant gain'))); });
  button(actions, 'Check phase prediction', () => {
    const m = read(), expected = requiredPhase(m.p, readNumericInput(target, 'target crossover'), readNumericInput(pm, 'minimum phase margin')).required, value = optionalPrediction();
    if (value === undefined) throw new Error('Enter a phase prediction first.');
    assessment.textContent = Math.abs(value - expected) <= 1e-5 ? 'Phase prediction matches within10⁻⁵ degrees.' : 'Required boost is ' + fmt(expected) + ' degrees. Use the plant phase at the chosen frequency, rather than its old crossover.';
    assessment.hidden = false;
  });
  construction.append(el('p', 'Predict the phase needed at the target frequency. Centering the peak alone does not set the loop magnitude. Editing corners or gain can move the actual crossover.'), actions, assessment);
  const inspection = card('Frequency and response inspection'), inspectControls = el('div', '', 'cd05-controls'), inspectBody = el('div');
  const omegaCursor = number(inspectControls, 'Inspect frequency ω (rad/s)', '2', 1e-8, 1e8), sampleCursor = number(inspectControls, 'Inspect response sample k', '0', 0, 400);
  inspection.append(inspectControls, inspectBody);
  function inspect(): void {
    inspectBody.replaceChildren();
    if (!result) return;
    const w = readNumericInput(omegaCursor, 'inspection frequency'), at = frequency(result.p, result.c, w);
    const index = readNumericInput(sampleCursor, 'response sample index');
    if (!Number.isInteger(index) || index < 0) throw new Error('Use a nonnegative integer response sample index. The raw draft is preserved.');
    const bounded = Math.min(400, index); if (bounded !== index) sampleCursor.value = String(bounded);
    inspectBody.append(eq('\\omega=' + tex(w) + ',\\quad |G|_{dB}=' + tex(at.plantDb) + ',\\quad |C|_{dB}=' + tex(at.controllerDb) + ',\\quad |L|_{dB}=' + tex(at.loopDb), 'Frequency magnitude values'),
      eq('\\arg G=' + tex(at.plantPhase) + '^\\circ,\\quad \\arg C=' + tex(at.boost) + '^\\circ,\\quad \\arg L=' + tex(at.phase) + '^\\circ', 'Frequency phase values'));
    if (result.response) {
      const row = result.response.points[bounded];
      inspectBody.append(el('p', 'Response sample ' + bounded + ': t=' + fmt(row.t) + ' s, y=' + fmt(row.y) + ', error=' + fmt(row.error) + ', controller effort u=' + fmt(row.u) + '.'));
    }
    if (feedback.classList.contains('cd05-error')) report('Inspection updated for the current checked proposal.');
  }
  omegaCursor.addEventListener('input', () => safe(inspect), { signal }); sampleCursor.addEventListener('input', () => safe(inspect), { signal });
  function addPlot(parent: HTMLElement, graphic: SVGSVGElement): void { const wrapper = el('div', '', 'cd05-scroll'); wrapper.append(graphic); parent.append(wrapper); }
  function metric(value: number | undefined, suffix = ''): string { return value === undefined ? 'Unconfirmed' : fmt(value) + suffix; }
  function render(r: Result): void {
    results.replaceChildren(); results.hidden = false;
    const g = corners(r.c), phase = card('3. Phase and geometric construction');
    phase.append(eq('\\phi_{req}=' + tex(r.pm) + '^\\circ-[180^\\circ+(' + tex(r.required.plantPhase) + '^\\circ)]=' + tex(r.required.required) + '^\\circ', 'Required phase at target'),
      eq('\\phi_{max}=\\sin^{-1}\\frac{1-\\alpha}{1+\\alpha}=' + tex(g.maxBoost) + '^\\circ,\\quad \\omega_m=\\sqrt{\\omega_z\\omega_p}', 'Available phase and geometric mean'),
      eq('\\alpha=\\frac{1-\\sin\\phi}{1+\\sin\\phi},\\quad T=\\frac1{\\omega_m\\sqrt\\alpha},\\quad K=\\frac1{|G(j\\omega_m)|\\,|(1+j\\omega_m T)/(1+j\\alpha\\omega_m T)|}', 'Target construction equations'),
      el('p', 'Required boost: ' + fmt(r.required.required) + '°. Available with this proposal: ' + fmt(g.maxBoost) + '°. Single-section bound at α=.02: ' + fmt(r.required.available) + '°. These target formulas do not replace the actual-loop checks.'));
    addPlot(phase, geometry(g.zero, g.peak, g.pole, r.c.alpha === 1));
    const margin = card('4. Actual loop Bode curves and margins');
    const min = Math.max(1e-8, Math.min(g.zero, g.pole, r.before.omega, r.after.omega, r.omega) / 30), max = Math.min(1e8, Math.max(g.zero, g.pole, r.before.omega, r.after.omega, r.omega) * 30);
    const before = bode(r.p, r.base, min, max), after = bode(r.p, r.c, min, max);
    margin.append(el('p', 'Dashed slate: baseline L₀=C₀G. Solid indigo: proposed L=CG. Vertical marker: actual proposed gain crossover. Curves sample the analytic frequency response; no asymptote is used.'),
      eq('\\omega_{c0}=' + tex(r.before.omega) + ',\\ PM_0=' + tex(r.before.phaseMargin) + '^\\circ,\\quad \\omega_c=' + tex(r.after.omega) + ',\\ PM=' + tex(r.after.phaseMargin) + '^\\circ', 'Actual crossover and phase margin comparison'),
      eq('PM=180^\\circ+\\arg L(j\\omega_c)=180^\\circ+(' + tex(r.after.phaseAtCrossing) + '^\\circ)=' + tex(r.after.phaseMargin) + '^\\circ', 'Phase margin construction at actual crossing'),
      el('p', 'Margin improvement=' + fmt(r.after.phaseMargin - r.before.phaseMargin) + '°, while maximum added phase=' + fmt(g.maxBoost) + '°. The crossover moves. Gain margin is infinite in this positive integrating-plant/lead family: phase stays above −180° at every finite positive frequency. Its magnitude is strictly decreasing, so exactly one gain crossover exists. Residual=' + fmt(r.after.magnitudeResidual) + '.'));
    addPlot(margin, plot({ x: before.map(v => v.omega), y: before.map(v => v.loopDb) }, { x: after.map(v => v.omega), y: after.map(v => v.loopDb) }, 'Full loop magnitude comparison', 'ω (rad/s), logarithmic', 'Magnitude (dB)', true, r.after.omega));
    addPlot(margin, plot({ x: before.map(v => v.omega), y: before.map(v => v.phase) }, { x: after.map(v => v.omega), y: after.map(v => v.phase) }, 'Full loop phase comparison', 'ω (rad/s), logarithmic', 'Phase (degrees)', true, r.after.omega, -180));
    const full = card('5. Full characteristic, poles and tracking');
    full.append(eq('T_y(s)=\\frac{C(s)G(s)}{1+C(s)G(s)}=\\frac{' + polynomial(r.model.numerator) + '}{' + polynomial(r.model.denominator) + '}', 'Full closed-loop output transfer function'),
      eq('K_v=\\lim_{s\\to0}sC(s)G(s)=\\frac{Kk}{a}=' + tex(r.model.Kv) + ',\\quad e_{ramp,\\infty}=\\frac1{K_v}=' + tex(r.model.rampError), 'Velocity constant and unit-ramp error'),
      el('p', 'Negative unity feedback. For the supported positive family, all characteristic coefficients and the expanded Routh quantity are positive; strict stability follows. Routh quantity=' + fmt(r.model.routh) + '. Unit-step final error is zero. A ramp uses the stated stable final-value limit, not a claim based on a truncated step plot.'));
    if (r.poles) {
      const table = el('table'), head = el('tr'); ['Pole real part (s⁻¹)', 'Imaginary part (rad/s)', 'Multiplicity'].forEach(t => head.append(el('th', t))); const thead = el('thead'); thead.append(head);
      const body = el('tbody'); r.poles.values.forEach(p => { const row = el('tr'); [fmt(p.re), fmt(p.im), String(p.multiplicity)].forEach(v => row.append(el('td', v))); body.append(row); }); table.append(thead, body); full.append(table, el('p', 'Every full characteristic pole is retained, including cancelled stable modes. Backward residual=' + fmt(r.poles.residual) + '; coefficient residual=' + fmt(r.poles.coefficientResidual) + '.'));
    } else full.append(el('p', 'Numerical full-pole check unavailable: ' + r.poleWarning));
    const response = card('6. Full response and requirement checklist');
    const b = r.baselineResponse, c = r.response;
    response.append(el('p', 'Unit-step reference, all physical initial states zero. Dashed baseline and solid proposal use the complete models, including the controller zero. Output and effort curves connect numerical samples; they are not a second-order substitution.'));
    if (b || c) {
      const series = (v: StepResponse | undefined, key: 'y' | 'u') => ({ x: v?.points.map(p => p.t) ?? [], y: v?.points.map(p => p[key]) ?? [] });
      addPlot(response, plot(series(b, 'y'), series(c, 'y'), 'Complete unit-step output comparison', 'Time (s)', 'Output y', false, undefined, 1));
      addPlot(response, plot(series(b, 'u'), series(c, 'u'), 'Complete controller effort comparison', 'Time (s)', 'Effort u'));
    }
    for (const [label, item, warning] of [['Baseline', b, r.baselineWarning], ['Proposal', c, r.responseWarning]] as const) {
      response.append(el('p', item ? label + ': ' + item.states + ' physical states; sampled overshoot ' + metric(item.metrics.overshoot, '%') + ', 10–90% rise ' + metric(item.metrics.rise, ' s') + ', 2% settling ' + metric(item.metrics.settling, ' s') + ' (sampled candidate ' + metric(item.metrics.settlingCandidate, ' s') + '). Δt=' + fmt(item.dt) + ' s; refinement residual=' + fmt(item.refinementResidual) + ', peak change=' + fmt(item.peakRefinementDelta) + '. ' + item.tailMessage : label + ' response unavailable: ' + warning));
    }
    const checklist = el('ul');
    const items: [string, boolean | undefined][] = [
      ['Actual crossover within5% of target', Math.abs(r.after.omega / r.omega - 1) <= .05],
      ['Actual phase margin meets minimum', r.after.phaseMargin + 1e-8 >= r.pm],
      ['Every numerical full pole is in the open left half-plane', r.poles ? r.poles.values.every(p => p.re < 0) : undefined],
      ['Velocity constant meets minimum', r.model.Kv + 1e-10 * Math.max(1, r.minKv) >= r.minKv],
      ['Observed overshoot meets maximum, with numerical future-tail check', c?.tail ? Math.max(c.metrics.overshoot, 100 * c.tail.bound) <= r.maxOS + .01 : undefined],
      ['Sampled 2% settling meets maximum, with numerical tail check', c?.metrics.settling === undefined ? undefined : c.metrics.settling <= r.maxTs],
    ];
    items.forEach(([name, pass]) => checklist.append(el('li', (pass === undefined ? 'Unconfirmed — ' : pass ? 'Meets — ' : 'Does not meet — ') + name)));
    response.append(checklist, el('p', 'Overshoot/rise/settling are numerical measurements over the selected horizon and resolution. A numerical modal tail estimate supports the future check; it is not an interval proof of intersample extrema. Unconfirmed items need a longer resolvable horizon or different parameters.'));
    results.append(phase, margin, full, response, inspection);
  }
  button(construction, 'Reveal full-loop checks', () => {
    invalidate(); optionalPrediction(); const m = read();
    const omega = readNumericInput(target, 'target crossover'), phaseMargin = readNumericInput(pm, 'minimum phase margin'), H = readNumericInput(horizon, 'response horizon');
    const requirements = [readNumericInput(maxOS, 'maximum overshoot'), readNumericInput(maxTs, 'maximum settling time'), readNumericInput(minKv, 'minimum velocity constant')];
    if (requirements[0] < 0 || requirements[0] > 100 || requirements[1] < .1 || requirements[1] > 200 || requirements[2] < 1e-6 || requirements[2] > 1e6) throw new Error('Use overshoot0–100%, settling .1–200 s and velocity constant10⁻⁶–10⁶.');
    if (H < .1 || H > 200) throw new Error('Use a response horizon from .1 to200 seconds.');
    const base = constantLead(readNumericInput(C0, 'baseline gain')), model = closedLoop(m.p, m.c);
    const r: Result = { ...m, base, omega, pm: phaseMargin, H, maxOS: requirements[0], maxTs: requirements[1], minKv: requirements[2],
      before: margins(m.p, base), after: margins(m.p, m.c), required: requiredPhase(m.p, omega, phaseMargin), model, poleWarning: '', responseWarning: '', baselineWarning: '' };
    try { r.poles = roots(model.denominator); } catch (error) { r.poleWarning = error instanceof Error ? error.message : 'Check pole conditioning.'; }
    try { r.response = stepResponse(m.p, m.c, H); } catch (error) { r.responseWarning = error instanceof Error ? error.message : 'Check response limits.'; }
    try { r.baselineResponse = stepResponse(m.p, base, H); } catch (error) { r.baselineWarning = error instanceof Error ? error.message : 'Check response limits.'; }
    result = r; render(r); report('Full-loop checks computed. Review each requirement and any horizon/work limitation.'); inspect();
  }).className = 'cd05-primary';
  const limits = el('details'); limits.append(el('summary', 'Domain, tolerances and source evidence'),
    el('p', 'Supported: .01≤k≤100, .1≤a≤100 rad/s; .01≤K≤1000, .01≤T≤10 s, .02≤α≤1. Proper unreduced visual order≤2, powers0–2,512 characters/20 groups; entered numbers≤10⁶, normalized coefficient magnitude≤10¹⁰, leading denominator magnitude≥10⁻⁸. Mixed numbers, hidden grouping, visual e/E, functions, other plant/controller structures and improper forms are rejected. Native number fields accept exponent notation.'),
    el('p', 'Target crossover .01–100 rad/s; minimum PM1–85°. Analytic Bode evaluation uses10⁻⁸–10⁸ rad/s; one family-specific crossover, residual≤10⁻¹⁰. Pole residual≤10⁻¹⁰ and component-relative coefficient residual≤10⁻⁸. Input fractions normalize exactly before numerical parameter conversion; displays round to seven significant digits.'),
    el('p', 'Response horizon .1–200 s with at most40000 refined steps and fewer than80000 total intervals. Resolving all modes can require a shorter horizon. Step refinement≤10⁻⁸, peak change≤10⁻⁴;401 displayed samples. Numerical modal solve condition≤10¹⁰ and reconstruction≤10⁻⁸. No unavailable response/tail is counted as a passed requirement. Effort is the linear controller output; no saturation or actuator model is implied.'),
    el('p', 'Source anchors: Ch6:47–55, S09:5–11 and E07. Course-rounded proposal4(1+.7071067812s)/(1+.3535533906s) gives crossover≈2 rad/s and PM≈64.471°, versus baseline≈51.827°; Kv=2 in both. Original external decks were not newly inspected; independent changed-data fixtures are separate. No model or result persists across reset/navigation.'));
  root.append(inputs, construction, feedback, results, limits);
  const cleanup = (): void => { if (disposed) return; disposed = true; plant.destroy(); controller.destroy(); result = undefined; root.remove(); signal.removeEventListener('abort', cleanup); };
  signal.addEventListener('abort', cleanup, { once: true }); return cleanup;
};
