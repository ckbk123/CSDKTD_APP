import type { ModuleMount } from '../../core/module';
import { createEquationDisplay, createEquationInput, type EquationInput } from '../../shared/equations/input';
import { readNumericInput } from '../../shared/numeric-input';
import { c, type Complex } from './complex';
import { trace, type Trace } from './continuation';
import { fraction, numeric, numericLatex, polynomial } from './format';
import { candidate, characteristic, gainValue, parseModel, type Model } from './model';
import { plane, type Plane, type Reveals } from './plot';
import { degree } from './polynomial';
import { toNumber, type Rational } from './rational';
import { roots, type Root } from './roots';
import { rules, vectors, type RuleSet } from './rules';
import './style.css';

const presets = [
  { name: 'Course baseline: three real poles', mode: 'gain', n: '1', d: 's(s+2)(s+5)', ki: 2.7, gain: 70, max: 140, re: 0, im: Math.sqrt(10) },
  { name: 'Changed numerator zero', mode: 'gain', n: 's+1', d: 's(s+2)(s+5)', ki: 2.7, gain: 20, max: 100, re: -3, im: 0 },
  { name: 'Complex poles: departure directions', mode: 'gain', n: '1', d: '(s+3)(s^2+2s+5)', ki: 2.7, gain: 10, max: 80, re: -1, im: 2 },
  { name: 'Repeated pole: three departure rays', mode: 'gain', n: '1', d: '(s+1)^3', ki: 2.7, gain: 8, max: 12, re: 0, im: Math.sqrt(3) },
  { name: 'Cancelled unstable fixed mode', mode: 'gain', n: 's-1', d: '(s-1)(s+2)', ki: 2.7, gain: 3, max: 10, re: 1, im: 0 },
  { name: 'Proposed PI: fixed Ki, varying Kp', mode: 'pi', n: '1', d: 's(s+2)', ki: 2.7, gain: 1.35, max: 20, re: 0, im: Math.sqrt(1.35) },
  { name: 'Imaginary-axis branch family', mode: 'gain', n: '1', d: 's^2+1', ki: 2.7, gain: 1, max: 10, re: 0, im: Math.sqrt(2) },
] as const;
interface Exercise { readonly model: Model; readonly construction: RuleSet; readonly sampled: Trace; readonly gain: Rational; readonly selected: readonly Root[]; readonly rootIssue?: string }
function node<K extends keyof HTMLElementTagNameMap>(tag: K, text?: string, className?: string): HTMLElementTagNameMap[K] { const element = document.createElement(tag); if (text) element.textContent = text; if (className) element.className = className; return element; }
function numberInput(label: string, value: number, min: number, max: number): { element: HTMLLabelElement; input: HTMLInputElement } {
  const element = node('label', label), input = node('input'); input.type = 'number'; input.step = 'any'; input.value = String(value); input.min = String(min); input.max = String(max); input.setAttribute('aria-label', label); element.append(input); return { element, input };
}
function select(label: string, choices: readonly [string, string][]): { element: HTMLLabelElement; input: HTMLSelectElement } {
  const element = node('label', label), input = node('select'); input.setAttribute('aria-label', label);
  choices.forEach(([value, text]) => { const option = node('option', text); option.value = value; input.append(option); }); element.append(input); return { element, input };
}
function table(headings: readonly string[], rows: readonly (readonly string[])[]): HTMLDivElement {
  const region = node('div', undefined, 'cp-table-region'); region.tabIndex = 0; region.setAttribute('role', 'region'); region.setAttribute('aria-label', headings.join(', '));
  const result = node('table'), head = node('thead'), header = node('tr'), body = node('tbody'); headings.forEach(text => { const th = node('th', text); th.scope = 'col'; header.append(th); }); head.append(header);
  rows.forEach(row => { const tr = node('tr'); row.forEach(text => tr.append(node('td', text))); body.append(tr); }); result.append(head, body); region.append(result); return region;
}
const pointText = (point: Complex): string => !point.im ? numeric(point.re) : `${numeric(point.re)} ${point.im < 0 ? '−' : '+'} j ${numeric(Math.abs(point.im))}`;
const boundText = (value: number): string => Number.isFinite(value) ? numeric(value) : value < 0 ? '−∞' : '+∞';
const rootRows = (values: readonly Root[]): string[][] => values.map(point => [pointText(point), String(point.multiplicity), point.re > 1e-8 * Math.max(1, Math.hypot(point.re, point.im)) ? 'Right half-plane' : point.re < -1e-8 * Math.max(1, Math.hypot(point.re, point.im)) ? 'Left half-plane' : 'Near imaginary axis (numerical)']);

export const mountView: ModuleMount = ({ container, signal }) => {
  const inputs: EquationInput[] = []; let disposed = false, resultAbort: AbortController | undefined;
  const cleanup = (): void => { if (disposed) return; disposed = true; resultAbort?.abort(); inputs.forEach(input => input.destroy()); container.replaceChildren(); };
  signal.addEventListener('abort', cleanup, { once: true });
  try {
    const controls = node('section', undefined, 'cp-card'), title = node('h3', '1. Choose the loop parameter');
    controls.append(title, node('p', 'Negative unity feedback. Construct a finite gain trace, reveal each rule separately, then check a candidate against the complete characteristic polynomial.'));
    const preset = select('Exercise preset', presets.map((item, index) => [String(index), item.name]));
    const mode = select('Varying parameter', [['gain', 'K multiplying N(s) / D(s)'], ['pi', 'Kp with fixed Ki in C(s)=Kp+Ki/s']]);
    const top = node('div', undefined, 'cp-controls'); top.append(preset.element, mode.element); controls.append(top);
    const feedback = node('p', 'Edit the inputs, make a prediction and construct the locus.', 'cp-feedback'); feedback.setAttribute('role', 'status'); feedback.setAttribute('aria-live', 'polite');
    const output = node('div', undefined, 'cp-results'); let exercise: Exercise | undefined;
    const invalidate = (): void => { exercise = undefined; resultAbort?.abort(); output.replaceChildren(); feedback.textContent = 'Inputs changed. Construct the locus to check this model.'; };
    let n = createEquationInput({ label: 'Numerator polynomial N(s)', value: '1', signal, onChange: invalidate }); inputs.push(n);
    let d = createEquationInput({ label: 'Denominator polynomial D(s)', value: 's(s+2)(s+5)', signal, onChange: invalidate }); inputs.push(d);
    const equationInputs = node('div', undefined, 'cp-equation-inputs'); equationInputs.append(n.element, d.element); controls.append(equationInputs);
    const ki = numberInput('Fixed Ki (Kp per second)', 2.7, 0, 1000), gain = numberInput('Selected gain K or Kp', 70, 0, 1000), max = numberInput('Trace maximum gain', 140, .000000001, 1000);
    ki.element.hidden = true; const gains = node('div', undefined, 'cp-controls'); gains.append(ki.element, gain.element, max.element); controls.append(gains);
    for (const control of [ki.input, gain.input, max.input]) control.addEventListener('input', invalidate, { signal });
    mode.input.addEventListener('change', () => { ki.element.hidden = mode.input.value !== 'pi'; invalidate(); }, { signal });
    controls.append(node('p', 'Real rational coefficients; powers 0–3, visible parentheses and numeric-denominator fractions. No e/E shortcuts in equations. Strictly proper loop: degree D=1–3, degree N<degree D, positive leading loop sign. Fixed-Ki PI plants have degree D≤2. Normalized coefficients |a|≤1000, denominators≤10⁹; 0≤gain≤1000. Frequencies use s⁻¹ / rad·s⁻¹. Transfer functions use zero initial conditions.', 'cp-note'));
    const predictionCard = node('section', undefined, 'cp-card'); predictionCard.append(node('h3', '2. Predict before checking'));
    const predictionInfinity = select('Predicted branches to infinity', [['', 'Choose (optional)'], ['1', '1'], ['2', '2'], ['3', '3']]);
    const predictionPoint = select('Predicted candidate membership', [['', 'Choose (optional)'], ['yes', 'On the nonnegative-gain locus'], ['no', 'Outside the nonnegative-gain locus']]);
    const pointRe = numberInput('Candidate real part (s⁻¹)', 0, -100, 100), pointIm = numberInput('Candidate imaginary part (rad/s)', Math.sqrt(10), -100, 100);
    const candidates = node('div', undefined, 'cp-controls'); candidates.append(pointRe.element, pointIm.element, predictionInfinity.element, predictionPoint.element);
    predictionCard.append(candidates, node('p', 'Enter a complex point numerically, or select a point on the plot. The candidate radius is bounded by |s|≤100. Changing the selected gain requires a new construction; testing a candidate reuses this visit’s trace.', 'cp-note'));
    const actions = node('div', undefined, 'cp-actions'), construct = node('button', 'Construct and check'), test = node('button', 'Test candidate'), baseline = node('button', 'Restore baseline');
    construct.type = test.type = baseline.type = 'button'; construct.className = 'cp-primary'; test.disabled = true; actions.append(construct, test, baseline); predictionCard.append(actions);
    container.append(controls, predictionCard, feedback, output);
    let currentPoint = c(0, Math.sqrt(10));
    const reveals: { -readonly [K in keyof Reveals]: Reveals[K] } & { angle: boolean; gain: boolean } = { segments: false, asymptotes: false, tangents: false, vectors: false, angle: false, gain: false };
    const readPoint = (): Complex => { const point = c(readNumericInput(pointRe.input, 'Candidate real part'), readNumericInput(pointIm.input, 'Candidate imaginary part')); if (Math.hypot(point.re, point.im) > 100) throw new Error('Keep the candidate inside |s|≤100 rad/s.'); return point; };
    const readDraft = (input: EquationInput, label: string): string => { const draft = input.getValue(); if (draft.empty) throw new Error(`Enter ${label}.`); if (draft.hasPlaceholders) throw new Error(`Complete the fraction or power boxes in ${label}.`); if (draft.syntaxIssues.length) throw new Error(`Check the notation in ${label}.`); return draft.latex; };

    function renderResult(): void {
      if (!exercise || disposed) return; resultAbort?.abort(); resultAbort = new AbortController(); const resultSignal = resultAbort.signal;
      const { model, construction, sampled, selected, rootIssue } = exercise, selectedGain = exercise.gain, parameter = model.mode === 'pi' ? 'K_p' : 'K';
      const check = candidate(model, currentPoint, selectedGain), summary = node('section', undefined, 'cp-card'); summary.append(node('h3', '3. Normalized characteristic equation'));
      if (model.mode === 'pi') {
        summary.append(node('p', 'Ki stays fixed while Kp varies. The integrator state remains in the full model, including Ki=0. This proposed PI fixture illustrates parameter normalization; the original Ch4:50–54 diagram has not been transcribed here.'));
        summary.append(createEquationDisplay(`G(s)=\\frac{${polynomial(model.plantN)}}{${polynomial(model.plantD)}},\\quad C(s)=K_p+\\frac{${fraction(model.integral)}}{s}`, 'Plant and fixed integral controller'));
        summary.append(createEquationDisplay('Q=sD_{\\mathrm{plant}}+K_iN_{\\mathrm{plant}}+K_p sN_{\\mathrm{plant}}', 'Actual varying parameter derivation'));
      }
      summary.append(createEquationDisplay(`D(s)=${polynomial(model.denominator)},\\quad N(s)=${polynomial(model.numerator)}`, 'Effective loop polynomials'));
      summary.append(createEquationDisplay(`1+${parameter}\\frac{N(s)}{D(s)}=0,\\qquad Q(s,${parameter})=D(s)+${parameter}N(s)`, 'Normalized gain equation'));
      summary.append(createEquationDisplay(`Q(s,${fraction(selectedGain)})=${polynomial(characteristic(model, selectedGain))}`, 'Complete selected characteristic polynomial'));
      if (degree(model.common)) summary.append(createEquationDisplay(`F_{\\mathrm{common}}(s)=${polynomial(model.common)}`, 'Retained common factor'), node('p', `The common factor creates retained fixed modes. Geometry uses the reduced loop; all roots of the full Q remain in the selected table. Fixed modes: ${model.fixed.map(p => `${pointText(p)} (multiplicity ${p.multiplicity})`).join('; ')}. A cancelled scalar factor does not remove this full-model mode.`, 'cp-warning'));
      summary.append(table(['Effective open-loop pole', 'Multiplicity', 'Numerical location'], rootRows(model.poles)), table(['Effective finite zero', 'Multiplicity', 'Numerical location'], rootRows(model.zeros)));
      const prediction = node('p', undefined, 'cp-prediction'); const messages: string[] = [];
      if (predictionInfinity.input.value) messages.push(Number(predictionInfinity.input.value) === construction.asymptotes.count ? 'Infinity-branch prediction correct.' : `Infinity-branch prediction differs: n−m=${construction.asymptotes.count}.`);
      if (predictionPoint.input.value) messages.push((predictionPoint.input.value === 'yes') === check.onPositiveLocus ? 'Candidate prediction correct within the stated checks.' : `Candidate prediction differs: ${check.onPositiveLocus ? 'on' : 'outside'} the supported nonnegative-gain locus.`);
      prediction.textContent = messages.join(' ') || 'No prediction entered. Use the independent rule reveals below to check your sketch.'; summary.append(prediction);
      const plotCard = node('section', undefined, 'cp-card'); plotCard.append(node('h3', '4. Computed finite gain trace'));
      const plotPanel = node('div', undefined, 'cp-plane-region'); plotPanel.tabIndex = 0; plotPanel.setAttribute('role', 'region'); plotPanel.setAttribute('aria-label', 'Scrollable root-locus plot');
      let currentPlane: Plane;
      const draw = (): void => { currentPlane = plane(model, sampled, construction, selected, currentPoint, reveals); plotPanel.replaceChildren(currentPlane.element); };
      draw();
      plotPanel.addEventListener('click', event => { const point = currentPlane.pointFromEvent(event); if (!point) return; pointRe.input.value = String(point.re); pointIm.input.value = String(point.im); testCandidate(); }, { signal: resultSignal });
      const vectorLabel = node('label', undefined, 'cp-checkbox'), vectorToggle = node('input'); vectorToggle.type = 'checkbox'; vectorToggle.checked = reveals.vectors; vectorLabel.append(vectorToggle, document.createTextNode('Show pole/zero vectors to the candidate'));
      vectorToggle.addEventListener('change', () => { reveals.vectors = vectorToggle.checked; draw(); }, { signal: resultSignal });
      plotCard.append(vectorLabel, plotPanel, node('p', '× effective pole · ○ finite zero · ◇ retained fixed mode · ● roots at selected gain · + candidate. Arrows follow increasing gain. All multiplicities are listed in the tables. The plot is a finite numerical illustration, not a complete stability-region proof.', 'cp-note'));
      plotCard.append(node('p', `${sampled.evaluations} root evaluations over 0–${numeric(sampled.maxGain)}; ${sampled.gaps} omitted connections${sampled.capped ? '; evaluation budget reached' : ''}. Adaptive midpoint refinement and minimum-distance matching preserve nearby branches. At ambiguous collisions or unresolved roots, no connection is drawn.`, sampled.gaps ? 'cp-warning' : 'cp-note'));
      if (sampled.gaps) plotCard.append(node('p', [...new Set(sampled.frames.filter(frame => frame.issue).map(frame => frame.issue))].join(' '), 'cp-note'));
      const selectedCard = node('section', undefined, 'cp-card'); selectedCard.append(node('h3', 'All roots at the selected gain'));
      if (rootIssue) selectedCard.append(node('p', rootIssue, 'cp-warning')); else selectedCard.append(table(['Full-Q root', 'Multiplicity', 'Numerical location'], rootRows(selected)));
      selectedCard.append(node('p', 'Locations within 10⁻⁸·max(1,|s|) of the imaginary axis are labeled near-axis. Root residual ≤2×10⁻¹⁰ and coefficient reconstruction ≤10⁻⁹ are checked; distinct roots closer than relative 2×10⁻⁷ are unresolved. Exact repeated factors are handled separately.', 'cp-note'));
      const candidateCard = node('section', undefined, 'cp-card'); candidateCard.append(node('h3', '5. Check the candidate'));
      candidateCard.append(createEquationDisplay(`s_*=${numericLatex(currentPoint.re)}${currentPoint.im < 0 ? '-' : '+'}${numericLatex(Math.abs(currentPoint.im))}\\mathrm{j}`, 'Candidate point'));
      candidateCard.append(node('p', check.kind === 'fixed' ? 'This is a retained common-factor root for every gain; the reduced-loop angle rule does not test this fixed mode.' : check.kind === 'pole' ? 'This is an effective open-loop pole: the gain endpoint is K=0 and loop phase is undefined here.' : check.kind === 'zero' ? 'This is a finite loop zero. It is approached as gain tends to infinity; there is no ordinary finite candidate gain here.' : check.onPositiveLocus ? 'The candidate passes the nonnegative-gain angle/gain and full-polynomial residual checks.' : 'The candidate does not pass the supported nonnegative-gain locus checks.'));
      candidateCard.append(node('p', `At the selected gain, full-Q scaled residual: ${numeric(check.selectedResidual)}. Candidate-angle tolerance: 10⁻⁶ rad; imaginary candidate-gain tolerance: 10⁻⁸·max(1,|K|); candidate full-Q residual ≤2×10⁻⁸. These are numerical point checks.`, 'cp-note'));
      function reveal(key: keyof typeof reveals, label: string, body: HTMLElement[]): HTMLDetailsElement {
        const details = node('details'); details.open = reveals[key]; details.append(node('summary', label), ...body);
        details.addEventListener('toggle', () => { reveals[key] = details.open; draw(); }, { signal: resultSignal }); return details;
      }
      candidateCard.append(reveal('angle', 'Reveal vector angles and angle residual', [
        table(['Vector from', 'Multiplicity', 'Angle (degrees)'], vectors(model, currentPoint).map(v => [`${v.kind}: ${pointText(v.from)}`, String(v.from.multiplicity), numeric(v.angle)])),
        createEquationDisplay('\\arg L_0(s_*)=\\sum\\arg(s_*-z_i)-\\sum\\arg(s_*-p_i)=(2\\ell+1)\\pi', 'Angle rule with multiplicity'),
        node('p', check.angleResidual === undefined ? 'Ordinary loop phase is undefined at this endpoint/fixed mode.' : `Wrapped residual from an odd multiple of π: ${numeric(check.angleResidual)} rad (${numeric(check.angleResidual * 180 / Math.PI)}°).`),
      ]));
      candidateCard.append(reveal('gain', 'Reveal candidate gain and full check', [
        createEquationDisplay('K_{\\mathrm{candidate}}=-\\frac{D(s_*)}{N(s_*)},\\qquad K_{\\mathrm{magnitude}}=\\frac{1}{|L_0(s_*)|}', 'Candidate gain identities'),
        node('p', check.complexGain ? `Complex gain −D/N = ${pointText(check.complexGain)}; magnitude-only gain = ${numeric(check.magnitudeGain!)}. A magnitude alone cannot satisfy the angle rule. ${check.candidateResidual === undefined ? 'No admissible finite real gain in 0–1000 was found within tolerance.' : `Full-Q scaled residual at real candidate gain: ${numeric(check.candidateResidual)}.`}` : `Ordinary ratio gain is unavailable at this ${check.kind}.`),
      ]));
      const ruleCard = node('section', undefined, 'cp-card'); ruleCard.append(node('h3', '6. Reveal construction rules independently'));
      ruleCard.append(reveal('segments', 'Real-axis segments', [node('p', 'For a positive leading loop sign and K≥0, a real point belongs when the total number of real effective poles and zeros to its right is odd. Multiplicity counts; common fixed factors are separate.'), table(['Interval in s⁻¹', 'Count to right', 'On locus'], construction.segments.map(segment => [`(${boundText(segment.lower)}, ${boundText(segment.upper)})`, String(segment.rightCount), segment.onLocus ? 'Yes' : 'No']))]));
      ruleCard.append(reveal('asymptotes', 'Asymptotes and centroid', [createEquationDisplay(`n-m=${construction.asymptotes.count},\\quad\\sigma_a=\\frac{\\sum p_i-\\sum z_i}{n-m}=${fraction(construction.asymptotes.centroid)}`, 'Exact asymptote centroid'), node('p', `Angles: ${construction.asymptotes.angles.map(theta => `${numeric(theta)}°`).join(', ')}. These are infinite-gain directions; the finite trace ends at the chosen gain maximum.`)]));
      ruleCard.append(reveal('tangents', 'Break/entry points and departure/arrival rays', [
        createEquationDisplay(`D'N-DN'=0,\\quad R(s)=${polynomial(construction.stationaryPolynomial)}`, 'Stationary gain equation'),
        table(['Real stationary point', 'Candidate gain', 'Full check'], construction.breaks.map(point => [numeric(point.point), numeric(point.gain), point.reason])),
        node('p', 'Stationary candidates are approximate isolated roots of R. Positive finite gain, Q=0 and Q′=0 are checked; a negative-gain stationary point is excluded. At repeated poles, several departure rays are possible.'),
        table(['Endpoint', 'Multiplicity', 'Rays from endpoint'], construction.tangents.map(tangent => [`${tangent.kind}: ${pointText(tangent.root)}`, String(tangent.root.multiplicity), tangent.angles.map(theta => `${numeric(theta)}°`).join(', ')])),
        createEquationDisplay('(s-p)^m\\sim-\\frac{K N(p)}{D^{(m)}(p)/m!},\\qquad(s-z)^m\\sim-\\frac{D(z)}{K N^{(m)}(z)/m!}', 'Local departure and arrival equations'),
        node('p', 'Arrival rays point outward from a zero toward nearby branch points; gain motion approaches the zero along that ray.', 'cp-note'),
      ]));
      const crossingDetails = node('details'); crossingDetails.append(node('summary', 'Imaginary-axis crossing equations and full checks'), createEquationDisplay('s=\\mathrm{j}\\omega,\\ u=\\omega^2,\\quad d_0+Kn_0-(d_2+Kn_2)u=0,\\quad\\omega(d_1+Kn_1-d_3u)=0', 'Imaginary-axis substitution'));
      if (construction.crossingEquation) crossingDetails.append(createEquationDisplay(`${polynomial(construction.crossingEquation, 'u')}=0`, 'Eliminated frequency equation'));
      crossingDetails.append(table(['Gain (0–1000)', 'ω≥0 (rad/s)', 'Full-Q residual'], construction.crossings.map(crossing => [numeric(crossing.gain), numeric(crossing.omega), numeric(crossing.residual)])), node('p', 'Each nonzero frequency also represents its conjugate −jω root. The origin is checked separately. Fixed common-factor axis roots are listed as retained modes. This list is not a general stable-interval proof.', 'cp-note'));
      if (construction.axisFamily) crossingDetails.append(node('p', construction.axisFamily, 'cp-warning')); ruleCard.append(crossingDetails);
      output.replaceChildren(summary, plotCard, selectedCard, candidateCard, ruleCard);
    }
    function testCandidate(): void {
      if (!exercise) { feedback.textContent = 'Construct the current model before testing a candidate.'; return; }
      try { const point = readPoint(); candidate(exercise.model, point, exercise.gain); currentPoint = point; renderResult(); feedback.textContent = 'Candidate checked against this visit’s model and selected gain.'; }
      catch (error) { feedback.textContent = `${error instanceof Error ? error.message : 'Check the candidate.'} The last valid candidate and results remain visible.`; }
    }
    construct.addEventListener('click', () => {
      try {
        const selectedGain = gainValue(String(readNumericInput(gain.input, 'Selected gain'))), maxGain = readNumericInput(max.input, 'Trace maximum gain');
        if (!(maxGain > 0 && maxGain <= 1000) || toNumber(selectedGain) > maxGain) throw new Error('Use 0<maximum gain≤1000 and keep the selected gain within the trace range.');
        const modeValue = mode.input.value === 'pi' ? 'pi' : 'gain';
        const model = parseModel(readDraft(n, 'the numerator'), readDraft(d, 'the denominator'), modeValue, modeValue === 'pi' ? String(readNumericInput(ki.input, 'Fixed Ki')) : '2.7');
        const construction = rules(model), sampled = trace(model, maxGain); currentPoint = readPoint();
        let selected: Root[] = [], rootIssue: string | undefined;
        try { selected = roots(characteristic(model, selectedGain)); } catch (error) { rootIssue = error instanceof Error ? error.message : 'Selected roots could not be resolved.'; }
        exercise = { model, construction, sampled, gain: selectedGain, selected, rootIssue }; renderResult(); test.disabled = false;
        feedback.textContent = 'Construction computed. Open individual reveals to compare the rules with your prediction.';
      } catch (error) { exercise = undefined; resultAbort?.abort(); output.replaceChildren(); test.disabled = true; feedback.textContent = error instanceof Error ? error.message : 'Check the model and numerical limits.'; }
    }, { signal });
    test.addEventListener('click', testCandidate, { signal });
    function applyPreset(index: number): void {
      const item = presets[index];
      // A reset owns fresh editors, including their pending power/command selection state.
      // The real browser exposed stale empty drafts when setValue reused a power-edited field.
      const nextN = createEquationInput({ label: 'Numerator polynomial N(s)', value: item.n, signal, onChange: invalidate });
      let nextD: EquationInput;
      try { nextD = createEquationInput({ label: 'Denominator polynomial D(s)', value: item.d, signal, onChange: invalidate }); }
      catch (error) { nextN.destroy(); feedback.textContent = 'Equation controls could not reset. Use Reset example to retry.'; throw error; }
      inputs.splice(0).forEach(input => input.destroy()); n = nextN; d = nextD; inputs.push(n, d); equationInputs.replaceChildren(n.element, d.element);
      preset.input.value = String(index); mode.input.value = item.mode; ki.input.value = String(item.ki); gain.input.value = String(item.gain); max.input.value = String(item.max); pointRe.input.value = String(item.re); pointIm.input.value = String(item.im); ki.element.hidden = item.mode !== 'pi'; predictionInfinity.input.value = ''; predictionPoint.input.value = ''; Object.assign(reveals, { segments: false, asymptotes: false, tangents: false, vectors: false, angle: false, gain: false }); invalidate(); test.disabled = true;
    }
    preset.input.addEventListener('change', () => applyPreset(Number(preset.input.value)), { signal }); baseline.addEventListener('click', () => applyPreset(0), { signal });
    return cleanup;
  } catch (error) { cleanup(); throw error; }
};
