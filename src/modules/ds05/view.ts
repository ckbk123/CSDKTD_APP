import type { ModuleMount } from '../../core/module';
import { createEquationDisplay, createEquationInput, type EquationInput } from '../../shared/equations/input';
import { readNumericInput } from '../../shared/numeric-input';
import { fraction, numeric, numericLatex, polynomial } from './format';
import { makeModel, type Model } from './model';
import { parsePolynomial } from './parser';
import { plane, type Plane } from './plots';
import { decimal, toNumber, ZERO, type Rational } from './rational';
import type { RootCount } from './roots';
import { mapAt, winding, type Complex, type WindingResult } from './winding';
import './style.css';

const presets = [
  { label: 'Baseline — stable loop', n: '.5', d: 'z-.8', k: '1' },
  { label: 'Stabilize an open-loop outside pole', n: '.5', d: 'z-1.2', k: '1' },
  { label: 'Gain change — one outside closed-loop root', n: '2', d: 'z-.8', k: '1' },
  { label: 'Two counterclockwise windings', n: '2z-1.5', d: '(z-1.2)(z-1.3)', k: '1' },
  { label: 'Two clockwise windings', n: '-2z+1.5', d: '(z-.2)(z-.3)', k: '1' },
  { label: 'Conjugate closed-loop roots outside', n: '1.25', d: 'z^2-.6z+.25', k: '1' },
  { label: 'Closed-loop boundary at z = −1', n: '1.8', d: 'z-.8', k: '1' },
  { label: 'Open-loop pole on the contour', n: '.5', d: 'z-1', k: '1' },
  { label: 'Cancelled outside mode retained', n: '.5(z-1.2)', d: '(z-1.2)(z-.2)', k: '1' },
  { label: 'Zero gain with an outside retained mode', n: '1', d: 'z-1.2', k: '0' },
  { label: 'Biproper loop with direct feedthrough', n: 'z', d: 'z-.8', k: '1' },
  { label: 'Near-contour pole — numerical count unresolved', n: '.5', d: 'z-.999999999', k: '1' },
  { label: 'Well-posed static loop', n: '2', d: '1', k: '1' },
] as const;
const element = <K extends keyof HTMLElementTagNameMap>(tag: K, text?: string, className?: string): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag); if (text !== undefined) node.textContent = text; if (className) node.className = className; return node;
};
function paragraph(parent: HTMLElement, text: string, note = false): void { parent.append(element('p', text, note ? 'dn-note' : undefined)); }
function card(parent: HTMLElement, title: string): HTMLElement { const node = element('section', undefined, 'dn-card'); node.append(element('h3', title)); parent.append(node); return node; }
function label(parent: HTMLElement, title: string, control: HTMLElement): void { const node = element('label', title); node.append(control); parent.append(node); }
function select(parent: HTMLElement, title: string, entries: readonly (readonly [string, string])[], value: string): HTMLSelectElement {
  const node = element('select'); for (const [key, text] of entries) { const option = element('option', text); option.value = key; node.append(option); }
  node.value = value; label(parent, title, node); return node;
}
function number(parent: HTMLElement, title: string, value: string, min: string, max: string): HTMLInputElement {
  const node = element('input'); node.type = 'number'; node.step = 'any'; node.value = value; node.min = min; node.max = max; label(parent, title, node); return node;
}
function exactNumber(input: HTMLInputElement, title: string): Rational { readNumericInput(input, title); return decimal(input.value, true); }
function parsed(input: EquationInput, title: string) {
  const draft = input.getValue();
  if (draft.empty || draft.hasPlaceholders || draft.syntaxIssues.length) throw new Error(`Complete ${title} using the visual equation controls.`);
  return parsePolynomial(draft.latex);
}
function display(parent: HTMLElement, latex: string, title: string): void { parent.append(createEquationDisplay(latex, title)); }
type Cell = string | HTMLElement;
function table(parent: HTMLElement, caption: string, headings: string[], rows: Cell[][]): void {
  const region = element('div', undefined, 'dn-table-scroll'); region.tabIndex = 0; region.setAttribute('role', 'region'); region.setAttribute('aria-label', caption);
  const node = element('table'); node.append(element('caption', caption));
  const header = element('tr'), head = element('thead'); for (const title of headings) { const th = element('th', title); th.scope = 'col'; header.append(th); } head.append(header); node.append(head);
  const body = element('tbody'); for (const row of rows) { const tr = element('tr'); for (const value of row) { const td = element('td'); td.append(value); tr.append(td); } body.append(tr); } node.append(body);
  region.append(node); parent.append(region);
}
function complexLatex(value: Complex): string {
  if (!value.im) return numericLatex(value.re);
  return `${value.re ? numericLatex(value.re) : ''}${value.im < 0 ? '-' : value.re ? '+' : ''}${numericLatex(Math.abs(value.im))}\\mathrm{j}`;
}
function rootTable(parent: HTMLElement, name: string, count: RootCount): void {
  if (!count.degree) { paragraph(parent, `${name}: constant nonzero polynomial; no finite dynamic roots.`); return; }
  table(parent, `${name}: complete retained root set`, ['Exact root', 'Numerical approximation', 'Location', 'Multiplicity'], count.roots.map(r => [
    createEquationDisplay(r.exact, `Exact ${name} root`), createEquationDisplay(complexLatex(r), `Approximate ${name} root`),
    r.location + (r.nearCircle ? ' (rounded point is near the circle)' : ''), String(r.multiplicity),
  ]));
}
function verdict(m: Model): string {
  return m.closedRoots.boundary ? 'Boundary: strict stability fails because a retained root lies on |z| = 1.'
    : m.closedRoots.outside ? 'Unstable retained closed loop: at least one root is outside |z| = 1.'
      : m.order ? 'Strictly stable retained closed loop: every root is inside |z| = 1.' : 'Well-posed static loop: there are no retained dynamic roots.';
}

export const mountView: ModuleMount = ({ container: root, signal }) => {
  let disposed = false, resultEvents: AbortController | undefined; const editors: EquationInput[] = [];
  function stopResult(): void { resultEvents?.abort(); resultEvents = undefined; }
  function dispose(): void { if (disposed) return; disposed = true; stopResult(); for (const editor of editors) editor.destroy(); }
  signal.addEventListener('abort', dispose, { once: true }); if (signal.aborted) { dispose(); return dispose; }
  paragraph(root, 'Follow one complete unit circle into the loop plane. Predict the winding and outside root count, then compare the contour result with the full closed-loop polynomial.');
  const form = element('form'); form.noValidate = true; root.append(form);
  const setup = card(form, '1. Choose the retained loop');
  const preset = select(setup, 'Experiment', [...presets.map((p, i) => [String(i), p.label] as const), ['custom', 'Custom inputs']], '0');
  paragraph(setup, 'L(z) = K N(z)/D(z), with negative unity feedback. Edit N and D as separate real polynomials in z; numerator degree cannot exceed denominator degree, at most 2.', true);
  const equations = element('div', undefined, 'dn-equations'); setup.append(equations);
  const controls = element('div', undefined, 'dn-controls'); setup.append(controls);
  const gain = number(controls, 'Loop gain K (dimensionless)', '1', '-10', '10');
  const period = number(controls, 'Sample period T (s)', '.1', '.001', '10');
  paragraph(setup, 'z advances one sample: a mode evolves as zᵏ at t = kT. The discrete coefficients stay fixed when T changes; T relabels physical frequency and does not redesign this model. Frequency response is a zero-state calculation. Root stability concerns all initial states of the retained realization.', true);
  paragraph(setup, 'D is retained as the characteristic polynomial of the scalar realization. Common numerator/denominator factors are reported and kept in the internal-mode counts. A reduced transfer curve can hide an unstable mode.');
  const attempt = card(form, '2. Predict before revealing');
  const guesses = element('div', undefined, 'dn-controls'); attempt.append(guesses);
  const counts = [['none', 'Choose a prediction (optional)'], ['0', '0'], ['1', '1'], ['2', '2']] as const;
  const predictedOpen = select(guesses, 'Predicted outside open-loop poles P_out', counts, 'none');
  const predictedWinding = select(guesses, 'Predicted counterclockwise winding W about −1', [
    ['none', 'Choose a prediction (optional)'], ['-2', '−2 — twice clockwise'], ['-1', '−1 — once clockwise'], ['0', '0 — no net winding'], ['1', '+1 — once counterclockwise'], ['2', '+2 — twice counterclockwise'], ['boundary', 'No ordinary count: a boundary lies on the contour'], ['unresolved', 'No checked count within numerical limits'],
  ], 'none');
  const predictedClosed = select(guesses, 'Predicted outside closed-loop roots Z_out', counts, 'none');
  paragraph(attempt, 'For this tool, the source circle runs counterclockwise from θ = 0 to 2π. W is positive for counterclockwise encirclements of −1 by the image. With no contour poles/zeros, Z_out = P_out − W. A zero outside count alone does not exclude roots on the circle.');
  const actions = element('div', undefined, 'dn-actions'); attempt.append(actions);
  const reveal = element('button', 'Trace, count and reveal'); reveal.type = 'submit'; const reset = element('button', 'Restore baseline'); reset.type = 'button'; actions.append(reveal, reset);
  const feedback = element('p', 'Choose a prediction, then trace and count.', 'dn-feedback'); feedback.setAttribute('role', 'status'); root.append(feedback);
  const results = element('div'); results.setAttribute('aria-label', 'Checked Nyquist result'); root.append(results);
  function changed(event?: Event): void {
    if (disposed || signal.aborted) return; stopResult(); results.replaceChildren();
    feedback.textContent = 'Inputs changed. Predict and reveal the new contour result.';
    if (event && event.target !== preset) preset.value = 'custom';
  }
  const numerator = createEquationInput({ label: 'Numerator N(z)', value: '.5', signal, onChange: () => changed() }); editors.push(numerator); equations.append(numerator.element);
  const denominator = createEquationInput({ label: 'Denominator D(z)', value: 'z-.8', signal, onChange: () => changed() }); editors.push(denominator); equations.append(denominator.element);
  function loadPreset(index: number): void {
    const p = presets[index]; if (!p) return; numerator.setValue(p.n); denominator.setValue(p.d); gain.value = p.k; period.value = '.1';
    predictedOpen.value = predictedWinding.value = predictedClosed.value = 'none'; changed();
  }
  preset.addEventListener('change', () => { if (preset.value !== 'custom') loadPreset(Number(preset.value)); }, { signal });
  reset.addEventListener('click', () => { preset.value = '0'; loadPreset(0); }, { signal });
  form.addEventListener('input', changed, { signal }); form.addEventListener('change', changed, { signal });
  function predictionFeedback(m: Model, run: WindingResult): string {
    const checks: string[] = [];
    if (predictedOpen.value !== 'none') checks.push(`P_out ${Number(predictedOpen.value) === m.openRoots.outside ? 'agrees' : `should be ${m.openRoots.outside}`}`);
    if (predictedWinding.value !== 'none') {
      const agrees = run.kind === 'checked' ? Number(predictedWinding.value) === run.winding : predictedWinding.value === run.kind;
      checks.push(`W ${agrees ? 'agrees' : run.kind === 'checked' ? `should be ${run.winding}` : `is ${run.kind}, so no ordinary checked integer is asserted`}`);
    }
    if (predictedClosed.value !== 'none') checks.push(`Z_out ${Number(predictedClosed.value) === m.closedRoots.outside ? 'agrees' : `should be ${m.closedRoots.outside}`}`);
    return checks.length ? `${checks.join('; ')}. ${verdict(m)}` : 'Result revealed. Compare the contour relation with the independent root table, then try a changed model.';
  }
  form.addEventListener('submit', event => {
    event.preventDefault(); if (disposed || signal.aborted) return; stopResult(); results.replaceChildren();
    try {
      const m = makeModel(parsed(numerator, 'the numerator N(z)'), parsed(denominator, 'the denominator D(z)'), exactNumber(gain, 'Loop gain K'), exactNumber(period, 'Sample period T'));
      const run = winding(m); resultEvents = new AbortController(); const local = resultEvents.signal;
      const modelSection = card(results, '3. Establish the model and pole accounting');
      display(modelSection, `L(z)=\\frac{${fraction(m.gain)}\\left(${polynomial(m.rawNumerator)}\\right)}{${polynomial(m.denominator)}}=\\frac{${polynomial(m.numerator)}}{${polynomial(m.denominator)}}`, 'Normalized retained loop');
      const direct = m.rawNumerator[m.order] ?? ZERO;
      display(modelSection, `d_0=${fraction(direct)},\\quad 1+Kd_0=${fraction(m.wellPosed)}`, 'Direct feedback well-posedness check');
      paragraph(modelSection, 'Coefficients are shown in descending powers. A nonzero 1 + Kd₀ keeps the retained closed-loop degree equal to the denominator degree. A singular direct loop is rejected, rather than disguised by dropping its leading coefficient.');
      table(modelSection, 'Retained pole accounting before using the contour', ['Polynomial', 'Degree', 'Inside |z| < 1', 'On |z| = 1', 'Outside |z| > 1'], [[
        'Open D', String(m.order), String(m.openRoots.inside), String(m.openRoots.boundary), String(m.openRoots.outside),
      ]]);
      if (m.common.length > 1) {
        display(modelSection, `\\gcd(D,KN)=${polynomial(m.common)}`, 'Retained common factor');
        paragraph(modelSection, `This common factor cancels from the transfer quotient but contributes equally to D and Q. It remains in both internal-mode counts. Cancelled outside roots: ${m.cancelledRoots.outside}; cancelled boundary roots: ${m.cancelledRoots.boundary}.`);
      }
      const contour = card(results, '4. Trace the complete contour and its image');
      display(contour, 'z=e^{\\mathrm{j}\\theta},\\quad 0\\leq\\theta\\leq2\\pi', 'Counterclockwise unit-circle contour');
      paragraph(contour, 'Start at z = 1, pass through +j, −1 and −j, then return to 1. Arrows follow increasing θ. The mapped curve may turn clockwise, counterclockwise or form several loops. Both frequency halves are included.');
      const zoom = select(contour, 'Mapped view', [['full', 'Full displayed curve'], ['critical', 'Near −1 (clips the curve outside the box)']], 'full');
      const plotGrid = element('div', undefined, 'dn-planes'); contour.append(plotGrid);
      const plotNote = element('p', undefined, 'dn-note'); contour.append(plotNote);
      paragraph(contour, 'Source: × open poles, ○ closed-loop roots; filled dot is the linked cursor. The source box is −1.6 to 1.6 on each axis; all roots are still counted/listed if a marker is outside it. In the image, + marks −1 and the cursor ray shows the return-difference vector. Plots have equal scales on both axes and scroll horizontally on a narrow screen.', true);
      const countSection = card(results, '5. Relate the winding to closed-loop roots');
      display(countSection, 'F(z)=1+L(z)=\\frac{Q(z)}{D(z)},\\quad Q(z)=D(z)+KN(z)', 'Return difference and characteristic polynomial');
      display(countSection, 'W=Z_{\\mathrm{in}}-P_{\\mathrm{in}},\\quad Z_{\\mathrm{out}}=P_{\\mathrm{out}}-W', 'Argument principle under this tool’s disk convention');
      paragraph(countSection, 'The counterclockwise contour encloses the unit disk. Convert inside to outside counts using the common retained degree n: P_out = n − P_in and Z_out = n − Z_in. Common factors cancel in the difference, but are retained in the individual counts. This is the reason for the minus sign in the outside-count formula.');
      if (run.kind === 'checked') {
        display(countSection, `W=${run.winding},\\quad Z_{\\mathrm{out,pred}}=${m.openRoots.outside}-(${run.winding})=${m.openRoots.outside - run.winding!}`, 'Guarded numerical winding and predicted outside count');
        paragraph(countSection, `The complete path passes a guarded numerical arc check: ${run.acceptedArcs} accepted arcs, ${run.arcChecks} arc checks, phase change ≈ ${numeric(run.turns!)} turns. This is a numerical result with an exclusion check, not a count inferred from a coarse picture or an interval-arithmetic proof.`);
      } else paragraph(countSection, run.reason!);
      if (run.omittedPoints) paragraph(countSection, `The displayed curve omits ${run.omittedPoints} point(s) whose normalized denominator is too small or whose loop magnitude exceeds 10⁶. Gaps remain gaps; no finite pole value or indentation is invented. The displayed drawing is incomplete at those gaps.`);
      const certificate = element('details'); certificate.append(element('summary', 'How the numerical arc check avoids a coarse-curve shortcut')); countSection.append(certificate);
      display(certificate, '\\widehat p=p/\\sum_i|p_i|,\\quad M_p=\\sum_i i|\\widehat p_i|', 'Positive coefficient normalization and derivative bound');
      display(certificate, '|\\widehat p(\\theta)-\\widehat p(\\theta_m)|\\leq M_p h,\\quad p\\in\\{Q,D\}', 'Polynomial variation on an angular half arc');
      paragraph(certificate, 'Each accepted half arc has a guarded relative radius below 1/8 for both Q and D. Their quotient then stays in a disk of relative radius below 2/7, excluding zero, so the actual arc can be continuously replaced by its endpoint chord without crossing zero. Principal angle increments can then be summed on the complete path. A 10⁻¹² normalized floating guard, depth 20, at most 32,768 arc checks and closure within 10⁻⁷ turns bound the calculation. Failure to meet these conditions yields no asserted winding integer.');
      if (run.kind === 'checked') paragraph(certificate, `Largest accepted polynomial relative radius: ${numeric(run.maximumRatio)}. Guarded minimum normalized magnitudes: D > ${numeric(run.minimumD)}, Q > ${numeric(run.minimumQ)}.`, true);
      const roots = card(results, '6. Independently check the full polynomial');
      display(roots, `Q(z)=${polynomial(m.closed)}`, 'Full retained closed-loop polynomial');
      table(roots, 'Exact rational root-location counts', ['Polynomial', 'Inside', 'On circle', 'Outside'], [
        ['D', String(m.openRoots.inside), String(m.openRoots.boundary), String(m.openRoots.outside)],
        ['Q', String(m.closedRoots.inside), String(m.closedRoots.boundary), String(m.closedRoots.outside)],
      ]);
      rootTable(roots, 'D', m.openRoots); rootTable(roots, 'Q', m.closedRoots);
      paragraph(roots, verdict(m));
      if (run.kind === 'checked') paragraph(roots, m.openRoots.outside - run.winding! === m.closedRoots.outside ? 'The contour prediction agrees with the independently classified full polynomial.' : 'The contour and exact root count disagree. Treat the numerical count as unresolved and inspect conditioning.');
      else paragraph(roots, 'The exact polynomial classification is shown independently. It does not turn this unresolved/boundary contour into a checked winding result.');
      paragraph(roots, 'Locations and multiplicities are decided with exact rational inequalities, including quadratic discriminants. Decimal root positions are approximations; a point rounded onto the circle is not an exact boundary test. Unit-circle roots fail strict stability; boundedness of a particular trajectory is not inferred here.', true);
      const cursorSection = card(results, '7. Inspect a linked frequency');
      const cursorControls = element('div', undefined, 'dn-controls'); cursorSection.append(cursorControls);
      const angle = number(cursorControls, 'Contour angle θ (degrees)', '0', '0', '360');
      const slider = element('input'); slider.type = 'range'; slider.min = '0'; slider.max = '360'; slider.step = 'any'; slider.value = '0'; label(cursorSection, 'Move contour cursor (arrow keys supported)', slider);
      const cursorActions = element('div', undefined, 'dn-actions'); cursorSection.append(cursorActions);
      const cursorFeedback = element('p'); cursorFeedback.setAttribute('role', 'status'); cursorSection.append(cursorFeedback);
      const cursorValues = element('div'); cursorSection.append(cursorValues);
      let current = mapAt(m, 0), sourcePlot: Plane, mappedPlot: Plane;
      function renderPlanes(): void {
        sourcePlot = plane(m, run.points, true); mappedPlot = plane(m, run.points, false, zoom.value === 'critical'); plotGrid.replaceChildren(sourcePlot.element, mappedPlot.element);
        sourcePlot.update(current); mappedPlot.update(current);
        plotNote.textContent = `${sourcePlot.outside} retained root marker(s), with multiplicity, lie outside the source box. ${zoom.value === 'critical' ? `${mappedPlot.outside} sampled image points lie outside this clipped critical view.` : 'The full view fits all finite displayed curve samples and the critical point; it cannot restore omitted gaps.'}`;
      }
      function drawCursor(): void {
        try {
          const degrees = readNumericInput(angle, 'Contour angle'); if (degrees < 0 || degrees > 360) throw new Error('Contour angle must be between 0 and 360 degrees.');
          current = mapAt(m, degrees * Math.PI / 180); slider.value = String(degrees); sourcePlot.update(current); mappedPlot.update(current); cursorValues.replaceChildren();
          const t = toNumber(m.period), equivalent = degrees > 180 ? degrees - 360 : degrees;
          table(cursorValues, 'Frequency cursor and alias convention', ['Quantity', 'Value'], [
            ['θ (degrees)', numeric(degrees)], ['θ (rad/sample)', createEquationDisplay(numericLatex(current.theta), 'Normalized angular frequency')],
            ['Unwrapped ω = θ/T (rad/s)', createEquationDisplay(numericLatex(current.theta / t), 'Unwrapped physical angular frequency')],
            ['Equivalent signed ω (rad/s)', createEquationDisplay(numericLatex(equivalent * Math.PI / 180 / t), 'Equivalent signed angular frequency')],
            ['T (s)', createEquationDisplay(fraction(m.period), 'Sample period')],
          ]);
          display(cursorValues, `z\\approx${complexLatex(current.z)}`, 'Cursor point on the unit circle');
          if (current.loop) {
            display(cursorValues, `L(z)\\approx${complexLatex(current.loop)}`, 'Mapped loop cursor');
            display(cursorValues, `F(z)=1+L(z)\\approx${complexLatex(current.returnDifference!)}`, 'Return-difference cursor evaluated from Q over D');
            const l = Math.hypot(current.loop.re, current.loop.im), f = Math.hypot(current.returnDifference!.re, current.returnDifference!.im);
            table(cursorValues, 'Mapped cursor values (rounded)', ['Quantity', 'Value'], [
              ['|L|', createEquationDisplay(numericLatex(l), 'Loop magnitude')],
              ['arg L (degrees)', l ? createEquationDisplay(numericLatex(Math.atan2(current.loop.im, current.loop.re) * 180 / Math.PI), 'Principal loop phase') : 'Undefined for L = 0'],
              ['Distance from −1: |1+L|', createEquationDisplay(numericLatex(f), 'Distance to the critical point')],
              ['arg F (degrees)', f ? createEquationDisplay(numericLatex(Math.atan2(current.returnDifference!.im, current.returnDifference!.re) * 180 / Math.PI), 'Principal return-difference phase') : 'Undefined for F = 0'],
            ]);
            cursorFeedback.textContent = mappedPlot.contains(current.loop) ? 'Both dots represent the same angle. Cursor values are evaluated directly, rather than interpolated from the plotted curve.' : 'The mapped cursor lies outside this view. Its finite value is listed below; change the mapped view to inspect the curve.';
          } else cursorFeedback.textContent = 'No finite mapped point is displayed here: the denominator is at/near the numerical guard or |L| exceeds the 10⁶ display range. The source cursor still shows its location. A pole is not replaced by a finite peak.';
        } catch (error) { cursorFeedback.textContent = `${error instanceof Error ? error.message : 'Unable to inspect this angle.'} The previous valid cursor is retained.`; }
      }
      for (const value of [0, 90, 180, 270, 360]) {
        const button = element('button', `${value}°`); button.type = 'button'; button.addEventListener('click', () => { angle.value = String(value); drawCursor(); }, { signal: local }); cursorActions.append(button);
      }
      angle.addEventListener('input', drawCursor, { signal: local });
      slider.addEventListener('input', () => { try { angle.value = String(readNumericInput(slider, 'Contour slider')); drawCursor(); } catch (error) { cursorFeedback.textContent = String(error); } }, { signal: local });
      zoom.addEventListener('change', () => { renderPlanes(); drawCursor(); }, { signal: local });
      renderPlanes(); drawCursor();
      paragraph(cursorSection, 'The signed equivalent frequency uses θ − 2π for θ > π; 360° aliases 0°. A changing T with fixed discrete coefficients changes ω labels, not the circle or its loop image. Principal phase at one point is not the accumulated winding. Very small F is evaluated as Q/D, rather than subtracting two rounded nearly equal numbers.', true);
      feedback.textContent = predictionFeedback(m, run);
    } catch (error) { stopResult(); results.replaceChildren(); feedback.textContent = error instanceof Error ? error.message : 'Unable to compute this bounded discrete contour exercise.'; }
  }, { signal });
  const limits = element('details'); limits.append(element('summary', 'Supported domain, assumptions and numerical limits')); root.append(limits);
  paragraph(limits, 'Discrete-time real SISO LTI loops in z, with negative unity feedback, z as the advance variable, and T in seconds. Proper numerator/denominator degree 0–2, nonzero D, including a well-posed static/direct path. The full D realization is retained through cancellations. Strict internal root stability requires every retained closed-loop root strictly inside the unit disk; the transfer curve alone does not certify hidden modes. A transfer in s requires an explicit sampling model and is unsupported here.');
  paragraph(limits, 'Visual polynomials accept decimals, visible parentheses, sums/products, numeric fractions and powers0–2. Mixed numbers/joined digits, hidden grouping, e/E literals, unsupported symbols/functions, negative or ambiguous bare powers are rejected with guidance. Bounds:400 characters,160 primaries, nesting12, intermediate coefficients10⁹ and exact fractions4096bits. After denominator leading-scale normalization, each raw coefficient has magnitude≤20 and fraction denominator≤10⁹. K is−10 to10, denominator≤10⁹; T is.001–10s. Native numeric controls accept normal exponent notation and reject nonzero underflow.');
  paragraph(limits, 'The complete source circle runs counterclockwise, θ=0–2π; W counts counterclockwise image turns about−1. Poles/zeros on the contour receive a boundary outcome, without an invented indentation. The numerical winding checks at most32768 arcs at depth20, uses a10⁻¹² normalized floating guard and requires closure within10⁻⁷ turns. It is a guarded double-precision check, not a formal interval proof. Unresolved cases assert no winding; exact degree≤2 root inequalities remain an independent algebraic result.');
  paragraph(limits, 'Checked curves use accepted arc endpoints; boundary/unresolved displays use1024 intervals as illustrations. Curve points with relative denominator≤10⁻¹⁰ or |L|>10⁶ are omitted as gaps. Root positions and curve samples are numerical; counts use exact rational comparisons. Plotted root markers outside the source box remain in the complete table. The critical view explicitly clips the image; a finite drawing or a positive-frequency half alone is not the full stability criterion.');
  paragraph(root, 'This guided full-contour lesson is an instructor-review extension of the course frequency-analysis material; it is not presented as a complete worked local slide example.', true);
  return dispose;
};
