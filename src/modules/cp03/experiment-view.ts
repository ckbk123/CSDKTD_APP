import type { ModuleMount } from '../../core/module';
import { createEquationInput, type EquationInput } from '../../shared/equations/input';
import { readNumericInput } from '../../shared/numeric-input';
import { frequencySweep, measure, parsePlant } from './math';
import { prepare, type Trial } from './calculation';
import { reasoning } from './reasoning';
import { drawPlot, numberLabel as fmt, pointerPosition, type Geometry, type Handle, type Series } from './plots';

export interface ModeHooks { suspend?: () => void; resume?: () => void }
type Context = Parameters<ModuleMount>[0] & { mode: 'explore' | 'practice'; hooks: ModeHooks; isActive: () => boolean };
const node = <K extends keyof HTMLElementTagNameMap>(tag: K, text = '', className = ''): HTMLElementTagNameMap[K] => { const e = document.createElement(tag); e.textContent = text; e.className = className; return e; };
const degrees = (value: number) => value * 180 / Math.PI;
function numeric(parent: HTMLElement, title: string, value: string, min: number, max: number, range = false) {
  const label = node('label', title, 'cp03-field'), input = node('input'); input.type = range ? 'range' : 'number'; input.step = 'any'; input.value = value; input.min = String(min); input.max = String(max); input.setAttribute('aria-label', title); label.append(input); parent.append(label); return input;
}
function button(parent: HTMLElement, title: string, action: () => void, signal: AbortSignal) { const e = node('button', title); e.type = 'button'; e.addEventListener('click', action, { signal }); parent.append(e); return e; }
function read(input: HTMLInputElement, title: string): number {
  if (input.value.trim().length > 80) throw new Error(`Keep ${title} within 80 characters.`);
  const value = readNumericInput(input, title); if (!input.checkValidity()) throw new Error(`Enter ${title} between ${input.min} and ${input.max}.`); return value;
}
const presets = [
  ['Course baseline', String.raw`G(s)=\frac{1}{(s+1)(s+2)}`, 1, 1, 8],
  ['Changed frequency', String.raw`G(s)=\frac{1}{(s+1)(s+2)}`, 2, 2, 8],
  ['Slow transient', String.raw`G(s)=\frac{1}{s+0.1}`, 1, 1, 0],
  ['Unstable model', String.raw`G(s)=\frac{1}{s-1}`, 1, 1, 0],
] as const;

export function mountExperiment({ container, signal: parent, mode, hooks, isActive }: Context): () => void {
  const life = new AbortController(), signal = life.signal, root = node('div', '', 'cp03-tool'); container.append(root);
  let disposed = false, timer: number | undefined, pending = false, dirty = false, editor: EquationInput | undefined, observer: ResizeObserver | undefined;
  let trial: Trial | undefined, revealed = mode === 'explore', graded = false, initialized = false, width = 700, timeAxis: [number, number] | undefined;
  let sweep: ReturnType<typeof frequencySweep> = [], sweepKey = '';
  const drawings = new Map<string, { geometry: Geometry; image: SVGSVGElement }>();
  type Key = Handle['key'];
  let gesture: { key: Key; plot: string; pointer: number; base: string; trial: Trial; revealed: boolean; geometry: Geometry; box: DOMRect; value?: number } | undefined;
  const cancelTimer = () => { if (timer !== undefined) window.clearTimeout(timer); timer = undefined; };
  function dispose() { if (disposed) return; disposed = true; parent.removeEventListener('abort', dispose); cancelTimer(); releasePointer(); observer?.disconnect(); life.abort(); editor?.destroy(); root.remove(); }
  parent.addEventListener('abort', dispose, { once: true }); if (parent.aborted) { dispose(); return dispose; }
  root.append(node('p', mode === 'explore' ? 'Change the frequency and follow the same point through the time, Bode and Nyquist views.' : 'Place the peak and amplitude markers on the traces, then reveal the calculation.', 'cp03-intro'));
  const layout = node('div', '', 'cp03-laboratory'), visual = node('section', '', 'cp03-visual'), controls = node('section', '', 'cp03-controls'); root.append(layout); layout.append(visual, controls);
  const qualification = node('p', '', 'cp03-qualification'), timeHost = node('div', '', 'cp03-time-host'), material = node('p', '', 'cp03-material'), feedback = node('p', '', 'cp03-message'), analytic = node('p', '', 'cp03-analytic');
  timeHost.tabIndex = -1; timeHost.setAttribute('aria-label', 'Time traces and measurement markers'); feedback.setAttribute('role', 'status'); material.setAttribute('role', 'status'); visual.append(qualification, timeHost, material, analytic, feedback);
  const sourceFields = node('div', '', 'cp03-fields'); controls.append(sourceFields);
  const omega = numeric(sourceFields, 'Frequency ω (rad/s)', '1', .01, 100), cursor = numeric(sourceFields, 'Linked frequency cursor · 0.01–100 rad/s (logarithmic)', '0', -2, 2, true); cursor.step = '.01';
  const amplitude = numeric(sourceFields, 'Input amplitude A', '1', .01, 100), start = numeric(sourceFields, 'Window start (s)', '8', 0, 1000);
  const markerFields = node('fieldset', '', 'cp03-markers'); markerFields.append(node('legend', 'Your measurement markers')); controls.append(markerFields);
  const tu = numeric(markerFields, 'Input peak tᵤ (s)', '0', 0, 3000), ty = numeric(markerFields, 'Output peak tᵧ (s)', '0', 0, 3000), B = numeric(markerFields, 'Output amplitude marker B', '.5', 0, 1e8);
  const markerError = node('p', '', 'cp03-message cp03-marker-error'); markerError.setAttribute('role', 'status'); markerFields.append(markerError);
  const placementLabel = node('label', 'Click plot to place', 'cp03-field'), placement = node('select'); placement.setAttribute('aria-label', 'Click plot to place');
  for (const [value, text] of [['tu', 'Input peak marker'], ['ty', 'Output peak marker'], ['B', 'Output amplitude marker']]) { const e = node('option', text); e.value = value; placement.append(e); } placementLabel.append(placement); markerFields.append(placementLabel);
  const transientLabel = node('label', '', 'cp03-check'), transient = node('input'); transient.type = 'checkbox'; transient.setAttribute('aria-label', 'Reveal zero-state response and transient'); transientLabel.append(transient, node('span', 'Reveal zero-state response and transient')); controls.append(transientLabel);
  const measurement = node('p', '', 'cp03-measurement'), grade = node('p', '', 'cp03-message cp03-grade'); grade.setAttribute('role', 'status'); controls.append(measurement, grade);
  const actions = node('div', '', 'cp03-actions'); controls.append(actions);
  const reveal = button(actions, mode === 'practice' ? 'Reveal calculation and linked plots' : 'Check marker measurement', () => { if (!trial || dirty) { compute(); if (!trial) return; } revealed = true; graded = true; renderChecked(); drawTime(); updateMeasurement(); }, signal);
  button(actions, 'Fit time axes', () => { cancelGesture(); timeAxis = undefined; drawTime(); }, signal);
  button(actions, 'Window start = 0', () => { start.value = '0'; changed(); }, signal);
  button(actions, 'One period later', () => { try { const next = read(start, 'window start in seconds') + 2 * Math.PI / read(omega, 'frequency in rad/s'); if (next > 1000) throw new Error('The later window exceeds the 1000 s start limit.'); start.value = String(next); changed(); } catch (error) { report(error); } }, signal);
  const frequencyHost = node('div', '', 'cp03-frequency-plots'); frequencyHost.tabIndex = -1; root.append(frequencyHost);
  const setup = node('details', '', 'cp03-card cp03-setup'); setup.append(node('summary', 'Plant, examples and equation entry')); root.append(setup);
  const form = node('form'); form.noValidate = true; setup.append(form);
  editor = createEquationInput({ label: 'Plant G(s)', value: presets[0][1], signal, tools: ['fraction', 'power', 'parentheses'], description: 'Proper real rational plant in s, degree zero through two. Fractions, visible parentheses and bounded integer powers are supported.', onChange: () => changed() }); form.append(editor.element);
  const apply = node('button', 'Apply experiment', 'cp03-primary'); apply.type = 'submit'; form.append(apply);
  const presetHost = node('div', '', 'cp03-actions'); form.append(presetHost);
  for (const [title, latex, w, a, t] of presets) button(presetHost, title, () => { cancelGesture(); editor!.setValue(latex); omega.value = String(w); amplitude.value = String(a); start.value = String(t); initialized = false; timeAxis = undefined; compute(); }, signal);
  const derivation = node('details', '', 'cp03-card cp03-derivation'), checked = node('div', '', 'cp03-checked'); derivation.append(node('summary', 'Complex substitution, gain, phase and transient reasoning'), checked); root.append(derivation);
  const limits = node('details', '', 'cp03-card cp03-limits'); limits.append(node('summary', 'Supported models and conventions')); root.append(limits);
  limits.append(node('p', 'Real proper rational polynomials in s, degree 0–2, expanded or factored; decimals, fractions, products, sums and polynomial powers −2…2. Textbook powers of 10 accept integer exponents −400…400 within numeric bounds; e/E notation is rejected in equations. No delays or other functions. Expanded coefficients ≤10000, normalized ≤10⁶, leading denominator ≥10⁻⁸, retained pole magnitudes ≤100 rad/s, input length ≤300, ≤160 tokens, nesting ≤24 and intermediate degree ≤8. No symbolic pole-zero cancellation.'));
  limits.append(node('p', 'u(t)=A sin(ωt) begins at zero canonical states at t=0. A=0.01–100 in input units; ω=0.01–100 rad/s; window start 0–1000 s and duration three periods, total time ≤3000 s. Open-loop SISO LTI: no feedback or sampling. Phase is principal in [−π,π], degrees/radians distinguished; marker phase is modulo one period. A later matching positive output peak means lag. A whole-period marker shift preserves the phase interpretation.'));
  limits.append(node('p', 'Particular traces use 901 samples; actual traces resolve retained modes with at least ten points per inverse pole magnitude, at most 12001 points. An unresolved actual trace is omitted with explanation. Stable tail qualification uses a conservative future envelope below 1% of output amplitude, absolute floor 10⁻⁹. Dynamic unstable traces require positive pole rate × time ≤20; plotted values are bounded by 10⁸. Analytic frequency results remain available when actual traces cannot be drawn. These are numerical reliability/drawing guards, not certified error bounds.'));
  limits.append(node('p', 'Frequency curves use 301 log frequencies plus the cursor, known imaginary-axis poles and notches. Denominator-relative singularity tolerance is 10⁻¹⁰; numerator-relative zero/undefined-phase tolerance is 10⁻¹². Singular samples break all curves; notches break dB/phase, Nyquist passes through zero. Phase jumps are not joined. Nyquist is positive-frequency only and is not a stability test. Sampled drawings can miss narrow features. Invisible formatting groups do not group sums; visible parentheses, fraction boxes and power scope retain displayed meaning. Mixed-number adjacency needs an explicit operation.'));

  function report(error: unknown) { feedback.textContent = error instanceof Error ? error.message : 'Check the experiment inputs.'; }
  function clearResults() { timeHost.replaceChildren(); frequencyHost.replaceChildren(); checked.replaceChildren(); analytic.textContent = ''; measurement.textContent = ''; grade.textContent = ''; material.textContent = ''; qualification.textContent = ''; drawings.clear(); derivation.hidden = true; }
  function readSource() {
    const draft = editor!.getValue(); if (draft.empty || draft.hasPlaceholders || draft.syntaxIssues.length) throw new Error('Complete the plant equation and check its notation before applying.');
    return { plant: parsePlant(draft.latex), w: read(omega, 'frequency in rad/s'), A: read(amplitude, 'input amplitude'), t0: read(start, 'window start in seconds') };
  }
  function changed(preserve?: HTMLInputElement, keepReveal = false) {
    if (disposed || signal.aborted) return; cancelGesture(preserve); dirty = true; graded = false; if (!keepReveal && mode === 'practice') revealed = false; clearResults();
    feedback.textContent = 'Inputs changed. Checking the current experiment…'; reveal.disabled = true; [tu, ty, B].forEach(input => input.disabled = true);
    if (!isActive()) { pending = true; return; }
    if (timer === undefined) timer = window.setTimeout(() => { timer = undefined; compute(keepReveal); }, 40);
  }
  function compute(keepReveal = false) {
    if (disposed || signal.aborted || !isActive()) return; cancelTimer();
    try {
      const source = readSource(), next = prepare(source.plant, source.w, source.A, source.t0); trial = next; dirty = false; revealed = mode === 'explore' || keepReveal && revealed; graded = false;
      const key = JSON.stringify([source.plant, source.w]); if (key !== sweepKey) { sweep = frequencySweep(source.plant, source.w); sweepKey = key; }
      cursor.value = String(Math.log10(source.w)); cursor.setAttribute('aria-valuetext', `${fmt(source.w)} rad/s`);
      for (const input of [tu, ty]) { input.min = String(next.t0); input.max = String(next.t1); }
      if (!initialized) { const peak = (Math.ceil((source.w * source.t0 - Math.PI / 2) / (2 * Math.PI)) * 2 * Math.PI + Math.PI / 2) / source.w; tu.value = ty.value = String(peak); B.value = String(Math.min(1e8, source.A / 2)); initialized = true; }
      transient.disabled = !next.actual; reveal.disabled = false; [tu, ty, B].forEach(input => input.disabled = false);
      qualification.textContent = `${next.e.classification}. ` + (!next.e.stable ? 'The sinusoid is a formal particular solution; the actual response need not approach it. Do not report a steady-state trace measurement.' : next.settled ? 'The transient tail is bounded below 1% throughout this window (absolute floor 10⁻⁹). Peak measurements are steady-state approximations.' : `Not settled: the conservative transient tail bound is ${fmt(next.bound)} output units. Move the window later before interpreting actual peaks as a steady-state frequency result.`);
      feedback.textContent = mode === 'practice' && !revealed ? 'Place your markers, then reveal the calculation.' : 'Current experiment checked. Move frequency or measurement markers to compare.';
      drawTime(); renderChecked(); updateMeasurement();
    } catch (error) { trial = undefined; dirty = true; clearResults(); reveal.disabled = false; [tu, ty, B].forEach(input => input.disabled = true); report(error); }
  }
  function readMarkers() {
    return { inputTime: read(tu, 'input peak time'), outputTime: read(ty, 'output peak time'), b: read(B, 'output amplitude') };
  }
  function updateMeasurement() {
    markerError.textContent = ''; measurement.textContent = ''; grade.textContent = ''; if (!trial || dirty) return;
    try {
      const { inputTime, outputTime, b } = readMarkers(), measured = measure(inputTime, outputTime, b, trial.w, trial.A);
      measurement.textContent = `Your markers: Δt=${fmt(outputTime - inputTime)} s; B/A=${fmt(measured.gain)}; phase=${fmt(degrees(measured.phase))}° (${fmt(measured.phase)} rad), modulo one period.`;
      if (graded) {
        const f = trial.e.value;
        if (f.phase === null) grade.textContent = 'Phase is undefined at zero/near-zero gain; a positive output peak cannot determine it.';
        else { const phaseError = degrees(Math.atan2(Math.sin(measured.phase - f.phase), Math.cos(measured.phase - f.phase))), gainError = measured.gain - f.magnitude; grade.textContent = `Marker difference from the analytic value: gain ${fmt(Math.abs(gainError) < 1e-12 ? 0 : gainError)}, phase ${fmt(Math.abs(phaseError) < 1e-12 ? 0 : phaseError)}°. ${trial.settled ? 'Measured peaks are approximate.' : 'Actual peaks are not certified steady state; compare the formal sinusoid.'}`; }
      }
    } catch (error) { markerError.textContent = error instanceof Error ? error.message : 'Check your marker values.'; }
  }
  function timeSeries(): Series[] {
    if (!trial) return [];
    const actual = transient.checked && !!trial.actual;
    const series: Series[] = [{ label: 'Input u · dashed', style: 'input', points: trial.samples.map(s => ({ x: s.t, y: s.input })) }, { label: actual ? 'Zero-state output y · solid' : trial.e.stable ? 'Steady sinusoid yₛ · solid' : 'Formal particular yₚ · solid', style: 'output', points: actual ? trial.actual!.map(s => ({ x: s.t, y: s.output })) : trial.samples.map(s => ({ x: s.t, y: s.particular })) }];
    if (actual) series.push({ label: 'Transient y−yₚ · dotted', style: 'transient', points: trial.actual!.map(s => ({ x: s.t, y: s.transient })) }); return series;
  }
  function drawTime() {
    if (!trial || dirty || !isActive()) return;
    let markers: ReturnType<typeof readMarkers> | undefined; try { markers = readMarkers(); } catch { /* Keep valid traces visible while the marker draft is corrected. */ }
    const handles: Handle[] = [], marks = [];
    if (markers) { handles.push({ key: 'tu', label: 'Move input peak marker', x: markers.inputTime, min: trial.t0, max: trial.t1, value: markers.inputTime, units: 's' }, { key: 'ty', label: 'Move output peak marker', x: markers.outputTime, min: trial.t0, max: trial.t1, value: markers.outputTime, units: 's' }, { key: 'B', label: 'Move output amplitude marker', y: markers.b, min: 0, max: 1e8, value: markers.b, units: 'output units' }); marks.push({ x: markers.inputTime, label: 'tᵤ' }, { x: markers.outputTime, label: 'tᵧ' }, { y: markers.b, label: 'B' }); }
    const series = timeSeries();
    if (!timeAxis) { const values = series.flatMap(s => s.points.flatMap(p => p ? [p.y] : [])); const lo = Math.min(0, ...values), hi = Math.max(0, markers?.b ?? 0, ...values), pad = Math.max(1e-12, (hi - lo) * .12); timeAxis = [lo - pad, hi + pad]; }
    const drawing = drawPlot({ id: 'time', title: transient.checked && trial.actual ? 'Input, actual zero-state output and transient' : 'Input and particular sinusoid', xLabel: 'Time t (s)', yLabel: 'Signal amplitude (u / y units)', series, marks, handles, xRange: [trial.t0, trial.t1], yRange: timeAxis, width: width - 2 });
    replaceDrawing(timeHost, drawing, 'time');
    material.textContent = [trial.actualError ? `Actual trace unavailable: ${trial.actualError} The particular sinusoid remains available.` : '', drawing.clipped || markers && (markers.b < timeAxis[0] || markers.b > timeAxis[1]) ? 'Some values are outside the fixed time axes. Choose Fit time axes.' : ''].filter(Boolean).join(' ');
  }
  function replaceDrawing(host: HTMLElement, drawing: ReturnType<typeof drawPlot>, id: string) { const focused = host.contains(document.activeElement); host.replaceChildren(drawing.element); drawings.set(id, { geometry: drawing.geometry, image: drawing.image }); if (focused || gesture?.plot === id) host.focus({ preventScroll: true }); }
  function renderChecked() {
    const focused = frequencyHost.contains(document.activeElement); frequencyHost.replaceChildren(); checked.replaceChildren(); analytic.textContent = ''; derivation.hidden = !revealed; if (!trial || dirty || !revealed) return;
    const available = frequencyHost.getBoundingClientRect().width || width, columns = available >= 760 ? 2 : 1, plotWidth = (available - (columns - 1) * 18) / columns - 2;
    frequencyHost.style.gridTemplateColumns = `repeat(${columns}, minmax(0, 1fr))`;
    const key = JSON.stringify([trial.plant, trial.w]); if (key !== sweepKey) { sweep = frequencySweep(trial.plant, trial.w); sweepKey = key; }
    const f = trial.e.value; analytic.textContent = `Calculated |G(jω)|=${fmt(f.magnitude)}; output amplitude=${fmt(trial.responseAmplitude)}; ` + (f.phase === null ? 'phase and dB are undefined at zero/near-zero gain.' : `phase=${fmt(degrees(f.phase))}° (${fmt(f.phase)} rad).`); checked.append(reasoning(trial));
    const magnitude: Series = { label: 'Magnitude', style: 'output', points: sweep.map(s => s && s.db !== null ? { x: Math.log10(s.w), y: s.db } : null) }, phase: Series = { label: 'Principal phase', style: 'output', points: [] }; let previous: number | null = null;
    sweep.forEach(s => { const d = s?.phase == null ? null : degrees(s.phase); if (d !== null && previous !== null && Math.abs(d - previous) > 180) phase.points.push(null); phase.points.push(s && d !== null ? { x: Math.log10(s.w), y: d } : null); previous = d; });
    const frequencyHandle: Handle = { key: 'frequency', label: 'Move linked frequency cursor', x: Math.log10(trial.w), min: .01, max: 100, value: trial.w, units: 'rad/s' };
    for (const [id, title, series, label] of [['magnitude', `Bode magnitude · cursor ω=${fmt(trial.w)} rad/s`, magnitude, '20 log₁₀ |G| (dB)'], ['phase', 'Bode phase · same frequency cursor', phase, 'Principal phase (°)']] as const) {
      if (!series.points.some(Boolean)) { frequencyHost.append(node('p', `${title}: undefined for this zero response.`)); continue; }
      const drawing = drawPlot({ id, title, xLabel: 'ω (rad/s, logarithmic)', yLabel: label, series: [series], xRange: [-2, 2], yRange: id === 'phase' ? [-190, 190] : undefined, logX: true, handles: [frequencyHandle], width: plotWidth }); drawings.set(id, { geometry: drawing.geometry, image: drawing.image }); frequencyHost.append(drawing.element);
    }
    const nyquist: Series = { label: 'Positive frequencies 0.01–100 rad/s', style: 'output', points: sweep.map(s => s ? { x: s.re, y: s.im } : null) }, extent = Math.max(1e-4, ...sweep.flatMap(s => s ? [Math.abs(s.re), Math.abs(s.im)] : [])) * 1.15;
    const drawing = drawPlot({ id: 'nyquist', title: 'Nyquist · same frequency cursor', xLabel: 'Re G(jω)', yLabel: 'Im G(jω)', series: [nyquist], xRange: [-extent, extent], yRange: [-extent, extent], equalAspect: true, marks: [{ x: f.re, y: f.im, label: `ω=${fmt(trial.w)}` }], width: plotWidth }); drawings.set('nyquist', { geometry: drawing.geometry, image: drawing.image }); frequencyHost.append(drawing.element, node('p', 'Sampled positive-frequency curves; gaps retain singularities/undefined phase. Nyquist uses equal units per pixel and is not a stability test.', 'cp03-small'));
    if (focused || gesture?.key === 'frequency') frequencyHost.focus({ preventScroll: true });
  }

  // Stable hosts own capture/focus while sampled SVG children are replaced.
  function releasePointer() { const id = gesture?.pointer; gesture = undefined; if (id !== undefined && root.hasPointerCapture?.(id)) root.releasePointerCapture(id); }
  function cancelGesture(preserve?: HTMLInputElement) { if (!gesture) return; cancelTimer(); const old = gesture; releasePointer(); const input = old.key === 'frequency' ? omega : old.key === 'tu' ? tu : old.key === 'ty' ? ty : B; if (input !== preserve) input.value = old.base; trial = old.trial; revealed = old.revealed; if (!preserve) { dirty = false; drawTime(); renderChecked(); updateMeasurement(); } }
  function applyGesture(value: number) {
    if (!gesture || !isActive()) return;
    if (gesture.key === 'frequency') { omega.value = String(value); compute(gesture.revealed); }
    else { const input = gesture.key === 'tu' ? tu : gesture.key === 'ty' ? ty : B; input.value = String(value); graded = false; updateMeasurement(); drawTime(); }
  }
  function flushGesture() { cancelTimer(); if (gesture?.value !== undefined) { const value = gesture.value; gesture.value = undefined; applyGesture(value); } }
  function commitGesture() { if (!gesture) return; flushGesture(); if (!trial || dirty) { const error = feedback.textContent; cancelGesture(); feedback.textContent = `${error} Previous checked experiment restored.`; } else { releasePointer(); feedback.textContent = 'Placement committed. Check the markers to compare with the calculated response.'; } }
  root.addEventListener('pointerdown', event => {
    if (!isActive() || gesture || !trial || dirty || event.button !== 0) return;
    const handle = (event.target as Element).closest('[data-cp03-handle]'), plot = handle?.closest<HTMLElement>('figure[data-plot]')?.dataset.plot; if (!handle || !plot) return;
    const key = handle.getAttribute('data-cp03-handle') as Key, drawing = drawings.get(plot), input = key === 'frequency' ? omega : key === 'tu' ? tu : key === 'ty' ? ty : B; if (!drawing) return;
    try { readSource(); read(input, 'marker placement'); gesture = { key, plot, pointer: event.pointerId, base: input.value, trial, revealed, geometry: drawing.geometry, box: drawing.image.getBoundingClientRect() }; root.setPointerCapture?.(event.pointerId); event.preventDefault(); (plot === 'time' ? timeHost : frequencyHost).focus({ preventScroll: true }); } catch (error) { report(error); }
  }, { signal });
  window.addEventListener('pointermove', event => {
    if (!isActive() || !gesture || event.pointerId !== gesture.pointer) return; event.preventDefault();
    try {
      const point = pointerPosition(event.clientX, event.clientY, gesture.box, gesture.geometry); gesture.value = gesture.key === 'frequency' ? 10 ** point.x : gesture.key === 'B' ? Math.min(1e8, Math.max(0, point.y)) : point.x;
      if (timer === undefined) timer = window.setTimeout(() => { timer = undefined; flushGesture(); }, 32);
    } catch (error) { cancelGesture(); report(error); }
  }, { signal, passive: false });
  window.addEventListener('pointerup', event => { if (isActive() && gesture?.pointer === event.pointerId) commitGesture(); }, { signal });
  window.addEventListener('pointercancel', event => { if (isActive() && gesture?.pointer === event.pointerId) cancelGesture(); }, { signal });
  root.addEventListener('lostpointercapture', event => { if (isActive() && gesture?.pointer === event.pointerId) cancelGesture(); }, { signal });
  window.addEventListener('blur', () => { if (isActive()) cancelGesture(); }, { signal });
  window.addEventListener('keydown', event => { if (isActive() && gesture && event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); const host = gesture.plot === 'time' ? timeHost : frequencyHost; cancelGesture(); host.focus({ preventScroll: true }); } }, { signal, capture: true });
  root.addEventListener('keydown', event => {
    if (!isActive() || !trial || dirty) return;
    const handle = (event.target as Element).closest('[data-cp03-handle]'); if (!handle || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
    const key = handle.getAttribute('data-cp03-handle') as Key, plot = handle.closest<HTMLElement>('figure[data-plot]')?.dataset.plot, input = key === 'frequency' ? omega : key === 'tu' ? tu : key === 'ty' ? ty : B;
    event.preventDefault();
    try {
      readSource(); const current = read(input, 'marker placement'), direction = event.key === 'ArrowLeft' || event.key === 'ArrowDown' ? -1 : 1, step = event.shiftKey ? 10 : 1;
      let next = key === 'frequency' ? current * 10 ** (direction * step * .02) : current + direction * step * (key === 'B' ? trial.A / 100 : trial.e.period / 180);
      const min = key === 'frequency' ? .01 : key === 'B' ? 0 : trial.t0, max = key === 'frequency' ? 100 : key === 'B' ? 1e8 : trial.t1;
      next = event.key === 'Home' ? min : event.key === 'End' ? max : Math.max(min, Math.min(max, next)); input.value = String(next);
      if (key === 'frequency') compute(revealed); else { graded = false; updateMeasurement(); drawTime(); }
      const same = root.querySelector<SVGElement>(`figure[data-plot="${plot}"] [data-cp03-handle="${key}"]`); if (same) same.focus({ preventScroll: true }); else omega.focus({ preventScroll: true });
    } catch (error) { report(error); }
  }, { signal });
  timeHost.addEventListener('click', event => {
    if (!isActive() || !trial || dirty || (event.target as Element).closest('[data-cp03-handle]') || !((event.target as Element).closest('svg'))) return;
    const drawing = drawings.get('time'); if (!drawing) return;
    try { const point = pointerPosition(event.clientX, event.clientY, drawing.image.getBoundingClientRect(), drawing.geometry), input = placement.value === 'tu' ? tu : placement.value === 'ty' ? ty : B; input.value = String(placement.value === 'B' ? Math.max(0, point.y) : point.x); graded = false; updateMeasurement(); drawTime(); } catch (error) { report(error); }
  }, { signal });
  form.addEventListener('submit', event => { event.preventDefault(); cancelGesture(); compute(); }, { signal });
  for (const input of [omega, amplitude, start]) input.addEventListener('input', () => changed(input), { signal });
  for (const input of [tu, ty, B]) input.addEventListener('input', () => { cancelGesture(input); graded = false; updateMeasurement(); drawTime(); if (revealed) grade.textContent = 'Markers edited. Check again to compare; the calculated response remains valid.'; }, { signal });
  transient.addEventListener('change', () => { cancelGesture(); drawTime(); }, { signal });
  cursor.addEventListener('input', () => { try { readSource(); cancelGesture(); omega.value = String(Number((10 ** readNumericInput(cursor, 'frequency slider')).toPrecision(8))); changed(undefined, revealed); } catch (error) { report(error); } }, { signal });
  const resize = () => { if (disposed || !isActive()) return; const next = timeHost.getBoundingClientRect().width; if (next > 0 && Math.abs(next - width) > 1) { cancelGesture(); width = next; drawTime(); renderChecked(); } };
  observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(resize); if (disposed || signal.aborted) observer?.disconnect(); else observer?.observe(timeHost); window.addEventListener('resize', resize, { signal });
  hooks.suspend = () => { pending ||= timer !== undefined && !gesture; cancelGesture(); cancelTimer(); }; hooks.resume = () => { resize(); if (pending) { pending = false; changed(); } };
  if (!disposed) { compute(); resize(); } return dispose;
}
