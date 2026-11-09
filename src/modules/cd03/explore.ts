import { createEquationDisplay, createEquationInput, type EquationInput } from '../../shared/equations/input';
import { readNumericInput } from '../../shared/numeric-input';
import { parsePlant, type Design } from './model';
import { check, moveCorner, type Checked, type Requirements } from './session';
import { draw, pointAt, type Axis, type Line, type Mark } from './drawing';
import type { LearningContext } from './view';
const fmt = (value: number) => value === 0 ? '0' : Number(value.toPrecision(7)).toString();
const tex = (value: number) => String(value === 0 ? 0 : value).replace(/e([+-]?\d+)$/, (_, exponent: string) => '\\times10^{' + Number(exponent) + '}');
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, text = '', cls = '') => { const node = document.createElement(tag); node.textContent = text; node.className = cls; return node; };
const problem = (error: unknown) => error instanceof Error ? error.message : 'Check the lag design.';
type Selection = 'p' | 'z' | 'ratio';
type Gesture = { id: number; selection: Selection; design: Design; checked: Checked; p: string; z: string; box: DOMRect; geometry: ReturnType<typeof draw>['geometry']; candidate?: number };
export function mount({ container, signal: parent, hooks, isActive }: LearningContext): () => void {
  if (parent.aborted) return () => {};
  const life = new AbortController(), signal = life.signal, root = el('div', '', 'cd03 cd03-explore'); root.dataset.module = 'CD03'; container.append(root);
  let closed = false, editor: EquationInput | undefined, observer: ResizeObserver | undefined, timer: ReturnType<typeof setTimeout> | undefined, checked: Checked | undefined, gesture: Gesture | undefined;
  let pending = false, needsRun = false, issue = '', cursorIssue = '', currentTime = 0, cornerExtent: number | undefined, planeAxis: Axis | undefined, responseY: [number, number] | undefined, measured = '';
  let responseDrawing: ReturnType<typeof draw> | undefined, cornerDrawing: ReturnType<typeof draw> | undefined;
  const stop = () => { if (timer !== undefined) clearTimeout(timer); timer = undefined; };
  const releaseCapture = () => { const id = gesture?.id; gesture = undefined; if (id !== undefined) try { if (root.hasPointerCapture?.(id)) root.releasePointerCapture(id); } catch { /* Capture can already have ended. */ } };
  const cleanup = () => { if (closed) return; closed = true; parent.removeEventListener('abort', cleanup); stop(); releaseCapture(); observer?.disconnect(); life.abort(); try { editor?.destroy(); } finally { root.remove(); } };
  parent.addEventListener('abort', cleanup, { once: true });
  try {
    const workbench = el('div', '', 'cd03-workbench'), visual = el('section', '', 'cd03-live-visual'), controls = el('section', '', 'cd03-live-controls');
    const state = el('p', '', 'cd03-preview-state'), targetSummary = el('p', '', 'cd03-target-summary'), responseHost = el('div', '', 'cd03-live-response'), warning = el('p', '', 'cd03-live-warning'), conclusion = el('p', '', 'cd03-live-conclusion');
    state.setAttribute('role', 'status'); warning.setAttribute('role', 'status'); visual.append(state, targetSummary, responseHost, warning, conclusion); workbench.append(visual, controls); root.append(workbench);
    function numeric(host: HTMLElement, label: string, name: string, value: string) { const wrap = el('label', label), input = el('input'); input.type = 'number'; input.step = 'any'; input.value = value; input.name = name; input.setAttribute('aria-label', label); wrap.append(input); host.append(wrap); return input; }
    function button(host: HTMLElement, text: string, action: () => void) { const node = el('button', text); node.type = 'button'; node.addEventListener('click', () => { if (closed || signal.aborted || !isActive()) return; try { action(); } catch (error) { issue = problem(error); refreshState(); } }, { signal }); host.append(node); return node; }
    const top = el('div', '', 'cd03-compact'), rates = el('div', '', 'cd03-compact'); controls.append(top);
    const gain = numeric(top, 'Proportional gain K', 'gain', '4'), lagWrap = el('label', 'Enable lag section'), lag = el('input'); lag.type = 'checkbox'; lag.name = 'lag'; lag.setAttribute('aria-label', 'Enable lag section'); lagWrap.append(lag); top.append(lagWrap); controls.append(rates);
    const p = numeric(rates, 'Lag pole rate p (1/s)', 'p', '.01'), z = numeric(rates, 'Lag zero rate z (1/s)', 'z', '.1');
    const selectionWrap = el('label', 'Selected movement'), selection = el('select'); selection.name = 'selection'; selection.setAttribute('aria-label', 'Selected movement');
    for (const [value, name] of [['p', 'Move pole p'], ['z', 'Move zero z'], ['ratio', 'Move both, preserve z/p']]) { const option = el('option', name); option.value = value; selection.append(option); } selectionWrap.append(selection); controls.append(selectionWrap);
    const rangeWrap = el('label', 'Selected rate (logarithmic 1/s)'), range = el('input'); range.type = 'range'; range.step = 'any'; range.name = 'cornerRange'; range.setAttribute('aria-label', 'Selected logarithmic corner rate'); rangeWrap.append(range); controls.append(rangeWrap);
    const rangeNote = el('p', '', 'cd03-range-note'), draftNote = el('p', '', 'cd03-draft-note'); controls.append(rangeNote, draftNote);
    const actions = el('div', '', 'cd03-actions'); root.append(actions);
    button(actions, 'Check current design', () => { cancelGesture(); run(); });
    button(actions, 'Fit checked plots', () => { cancelGesture(); cornerExtent = undefined; planeAxis = undefined; responseY = undefined; if (checked) paint(checked); refreshState(); });
    button(actions, 'Enable proposed lag', () => { cancelGesture(); lag.checked = true; p.value = '.01'; z.value = '.1'; changed(); });
    button(actions, 'Move both corners ÷5', () => { cancelGesture(); const d = readDesign(), next = moveCorner({ ...d, lag: true }, 'ratio', d.p / 5); publishRates(next); lag.checked = true; changed(); });
    button(actions, 'Choose z from required Kv', () => { cancelGesture(); const d = readDesign(), r = readRequirements(), ratio = r.kv * d.a / (d.k * d.b); if (ratio <= 1) throw new Error('The proportional reference already meets this Kv target; no lag ratio above one is needed.'); const next = moveCorner({ ...d, lag: true }, 'z', d.p * ratio); publishRates(next); lag.checked = true; changed(); });
    button(actions, 'Restore Explore baseline', reset);
    const cursor = el('div', '', 'cd03-cursor-controls'), time = numeric(cursor, 'Inspect response time (s)', 'time', '0'), cursorWrap = el('label', 'Response time cursor'), cursorRange = el('input'); cursorRange.type = 'range'; cursorRange.step = 'any'; cursorRange.min = '0'; cursorRange.max = '20'; cursorRange.value = '0'; cursorRange.name = 'timeRange'; cursorRange.setAttribute('aria-label', 'Response time cursor'); cursorWrap.append(cursorRange); cursor.append(cursorWrap);
    const readout = el('p', '', 'cd03-live-readout'); readout.setAttribute('role', 'status'); visual.append(cursor, readout);
    const secondary = el('div', '', 'cd03-secondary'), cornerHost = el('section', '', 'cd03-corner-host'), planeHost = el('section', '', 'cd03-full-plane'); secondary.append(cornerHost, planeHost); root.append(secondary);
    const help = el('p', 'Select p, z or a ratio-preserving move. Drag the selected real-axis handle, or use arrow keys (.001 per second; Shift .01). The rate slider is logarithmic; the actual pole/zero drawing is linear. A future slow tail is checked separately from the accuracy ratio.', 'cd03-note'); root.append(help);
    const settings = el('details', '', 'cd03-settings'), settingsTitle = el('summary', 'Plant, retained requirements, horizon and limits'); settings.append(settingsTitle); root.append(settings);
    const plantHost = el('div'); settings.append(plantHost); const fields = el('div', '', 'cd03-compact'); settings.append(fields);
    const kv = numeric(fields, 'Required Kv (1/s)', 'kv', '20'), mp = numeric(fields, 'Overshoot limit (%)', 'mp', '20'), settling = numeric(fields, 'Settling limit (s)', 'settling', '4.5'), horizon = numeric(fields, 'Measurement horizon H (s)', 'horizon', '20');
    const bandWrap = el('label', 'Settling band'), band = el('select'); band.name = 'band'; band.setAttribute('aria-label', 'Settling band'); for (const [value, name] of [['.02', '2%'], ['.05', '5%'], ['.01', '1%']]) { const option = el('option', name); option.value = value; band.append(option); } bandWrap.append(band); fields.append(bandWrap);
    settings.append(el('p', 'Negative unity feedback; zero initial conditions; unit ramp slope 1 input unit/s. The same K updates the proportional reference and chosen loop. Proposed retained targets start at Kv20, overshoot20%, settling4.5s. Plant family b/[s(s+a)], a=.2–20,b=.05–20,K=.05–100; the reference stays oscillatory with .2≤ωn≤20 and .1≤ζ≤.95. Active lag: .001≤p<z≤5 and z/p≤1000.', 'cd03-note'));
    settings.append(el('p', 'The visual plant uses the original bounded degree-two rational parser, including fractions and powers0–2. Hidden canceled plant factors reject. Repeated or near-coincident poles (relative gap≤10⁻⁵), modal coefficient sum>10⁵ and reconstruction failures withhold full transient metrics. H=.1–200s; 1/2/5% bands; ≤16,384 intervals, halving/midpoint consistency10⁻⁴. Settling requires the future modal envelope, never just an in-band endpoint. Routh relative margin10⁻⁹ and near-Kv target margin10⁻¹⁰ remain uncertain. Numerical consistency is not an interval proof.', 'cd03-note'));
    const depth = el('details', '', 'cd03-depth'), depthTitle = el('summary', 'Complete roots, Routh condition, angle and comparison'), detailsHost = el('div'); depth.append(depthTitle, detailsHost); root.append(depth);
    editor = createEquationInput({ label: 'Explore plant G(s)', value: '\\frac{1}{s(s+2)}', signal, tools: ['fraction', 'power', 'parentheses'], description: 'A proper degree-two plant fraction reducing to b/[s(s+a)], with visible grouping and powers0–2.', onChange: () => changed() });
    if (closed || signal.aborted) { editor.destroy(); return cleanup; } plantHost.append(editor.element);
    function readDesign(): Design { const value = editor!.getValue(); if (value.empty || value.hasPlaceholders || value.syntaxIssues.length) throw new Error('Complete the plant fraction and check its notation.'); return { ...parsePlant(value.latex), k: readNumericInput(gain, 'Proportional gain'), lag: lag.checked, p: readNumericInput(p, 'Lag pole rate'), z: readNumericInput(z, 'Lag zero rate') }; }
    function readRequirements(): Requirements { return { kv: readNumericInput(kv, 'Required Kv'), overshoot: readNumericInput(mp, 'Overshoot limit'), settling: readNumericInput(settling, 'Settling limit'), horizon: readNumericInput(horizon, 'Measurement horizon'), band: Number(band.value) }; }
    function refreshState() {
      state.textContent = pending ? checked ? 'Updating · previous checked model shown' : 'Checking initial model' : issue ? checked ? 'Rejected draft · previous checked model shown' : 'Rejected draft · no checked result' : gesture ? 'Checked placement preview · release to keep, Escape cancels' : 'Checked model · proportional reference and full loop';
      warning.textContent = [issue, checked?.baseline.issue ? 'Reference: ' + checked.baseline.issue : '', checked?.full.issue && checked.full !== checked.baseline ? 'Full response: ' + checked.full.issue : '', checked?.full.metrics && checked.full.metrics.settling === undefined ? 'Full settling is not established by the future envelope in H=' + checked.requirements.horizon + 's; an in-band endpoint is insufficient.' : '', checked?.full.metrics && !checked.full.metrics.peakEstablished ? 'The largest peak remains qualified by the observed horizon.' : ''].filter(Boolean).join(' ');
      syncRange();
    }
    function syncRange() {
      if (!checked) return; const chosen = selection.value as Selection, source = checked.design; let value = chosen === 'z' ? source.z : source.p, ratio = source.z / source.p, bad = '';
      try { const pv = readNumericInput(p, 'Lag pole rate'), zv = readNumericInput(z, 'Lag zero rate'); if (![pv, zv].every(v => v >= .001 && v <= 5)) throw new Error('The numeric draft rates must stay inside .001–5.'); value = chosen === 'z' ? zv : pv; ratio = zv / pv; }
      catch (error) { value = chosen === 'z' ? source.z : source.p; ratio = source.z / source.p; bad = problem(error); }
      const maximum = chosen === 'ratio' ? 5 / ratio : 5, validRatio = chosen !== 'ratio' || ratio > 1 && ratio <= 1000;
      range.min = '-3'; range.max = String(Math.log10(Math.max(.001, maximum))); range.disabled = !validRatio || maximum < .001; range.value = String(Math.log10(Math.max(.001, Math.min(maximum, value))));
      range.setAttribute('aria-valuetext', (bad ? 'Last checked ' : '') + (chosen === 'z' ? 'z' : 'p') + '=' + value + ' per second; logarithmic position' + (chosen === 'ratio' ? ', preserving z/p=' + ratio : ''));
      rangeNote.textContent = bad ? bad + ' Actual numeric draft retained; the slider shows the checked rate.' : !validRatio ? 'Choose a lag draft with 1 < z/p ≤ 1000 for ratio-preserving movement.' : chosen === 'ratio' ? 'Both corners move with z/p=' + fmt(ratio) + '; p may not exceed ' + fmt(maximum) + ' per second.' : '';
    }
    function paint(next: Checked) {
      const d = next.design, m = next.model, r = next.requirements, base = next.baseline.metrics, full = next.full.metrics;
      const lines: Line[] = [];
      if (base) lines.push({ name: 'Dashed proportional reference', points: base.times.map((t, i) => ({ re: t, im: base.values[i] })), style: 'cd03-dashed' });
      if (full) lines.push({ name: d.lag ? 'Solid full lag loop' : 'Solid chosen proportional loop', points: full.times.map((t, i) => ({ re: t, im: full.values[i] })), style: 'cd03-solid' });
      lines.push({ name: fmt(r.band * 100) + '% lower band', points: [{ re: 0, im: 1 - r.band }, { re: r.horizon, im: 1 - r.band }], style: 'cd03-band-line' }, { name: 'Upper band', points: [{ re: 0, im: 1 + r.band }, { re: r.horizon, im: 1 + r.band }], style: 'cd03-band-line' });
      const values = lines.flatMap(line => line.points.map(point => point.im)), low = Math.min(0, ...values), high = Math.max(1, ...values), pad = .1 * Math.max(.2, high - low);
      const responseAxis = { x: [0, r.horizon] as [number, number], y: responseY ?? [low - pad, high + pad] as [number, number] };
      const responsePlot = draw('Actual unit-step output · same K in both loops', responseHost.getBoundingClientRect().width || 540, lines, [], ['Time t (s)', 'Output y'], responseAxis);
      const extent = cornerExtent ?? Math.max(.02, d.p, d.z) * 1.25, selected = selection.value as Selection, marks: Mark[] = [{ point: { re: -d.p, im: 0 }, kind: 'pole', label: (d.lag ? 'Applied' : 'Inactive draft') + ' lag pole −' + d.p, ...(selected === 'p' || selected === 'ratio' ? { handle: selected } : {}) }, { point: { re: -d.z, im: 0 }, kind: 'zero', label: (d.lag ? 'Applied' : 'Inactive draft') + ' lag zero −' + d.z, ...(selected === 'z' ? { handle: selected } : {}) }];
      const corners = draw(d.lag ? 'Applied low-frequency pole and zero' : 'Inactive lag draft · proportional loop is applied', cornerHost.getBoundingClientRect().width || 500, [], marks, ['Real part (1/s)', 'Pole × · zero ○'], { x: [-extent, .05 * extent], y: [-1, 1] }, false, 200);
      const vectors: Line[] = d.lag ? [-d.p, -d.z].map((start, i) => ({ name: i ? 'Zero angle vector' : 'Pole angle vector', points: [{ re: start, im: 0 }, m.s0], style: 'cd03-dashed' })) : [];
      const roots: Mark[] = [...m.baselineRoots.map(point => ({ point, kind: 'base' as const, label: 'Proportional reference pole' })), ...m.fullRoots.map(point => ({ point, kind: 'full' as const, label: 'Retained full-loop pole' })), ...(d.lag ? marks.map(({ handle: _handle, ...mark }) => mark) : [])];
      const plane = draw('Every full-loop pole and reference angle', planeHost.getBoundingClientRect().width || 500, vectors, roots, ['Real part (1/s)', 'Imaginary part (rad/s)'], planeAxis, true);
      const reasoning = el('div'); reasoning.append(createEquationDisplay('K_{v,0}=\\frac{Kb}{a}=' + tex(m.baselineKv) + ',\\quad K_v=' + tex(m.kv) + ',\\quad \\beta=' + tex(m.beta), 'Applied velocity constants and accuracy ratio'));
      reasoning.append(el('p', 'Full poles (' + m.stability + '): ' + m.fullRoots.map(root => fmt(root.re) + (root.im < 0 ? '−' : '+') + fmt(Math.abs(root.im)) + 'j').join('; ') + '. No characteristic mode is discarded at a controller cancellation.'));
      reasoning.append(el('p', d.lag ? 'Full cubic Routh numerator=' + fmt(m.routh) + ', relative margin=' + fmt(m.margin) + '. At the original upper proportional pole: lag angle=' + fmt(m.angle) + '°, magnitude=' + fmt(m.magnitude) + '; magnitude-only K=' + fmt(m.magnitudeGain) + ' does not enforce the angle condition.' : 'Lag is disabled. The applied section is 1, with angle0° and magnitude1. p/z are retained design drafts.'));
      reasoning.append(el('p', 'Formal Kv=' + fmt(m.kv) + '; final unit-ramp error=' + (m.rampError === undefined ? 'not established' : fmt(m.rampError)) + '. An improved accuracy ratio does not establish full-loop stability or transients.'));
      const table = el('table'), caption = el('caption', 'Complete checked response; finite numerical refinement and future-tail qualifications apply.'); table.append(caption); const header = el('tr'); ['Check', 'Proportional reference', 'Chosen full loop'].forEach(value => header.append(el('th', value))); table.append(header);
      const row = (name: string, a: string, b: string) => { const tr = el('tr'); [name, a, b].forEach(value => tr.append(el('td', value))); table.append(tr); };
      row('Kv (1/s)', fmt(m.baselineKv), fmt(m.kv)); row('Ramp final error', fmt(1 / m.baselineKv), m.rampError === undefined ? 'Not established' : fmt(m.rampError));
      row('Overshoot', base ? fmt(base.overshoot * 100) + '%' + (base.peakEstablished ? ' · future larger peak excluded' : ' · observed in H') : 'Not established', full ? fmt(full.overshoot * 100) + '%' + (full.peakEstablished ? ' · future larger peak excluded' : ' · observed in H') : 'Not established');
      row('Measured settling (s)', base?.settling === undefined ? 'Not established in H' : fmt(base.settling), full?.settling === undefined ? 'Not established in H' : fmt(full.settling));
      row('Future envelope at H', base ? fmt(base.tail) : 'Unavailable', full ? fmt(full.tail) : 'Unavailable'); row('Overshoot / settling target', next.assessment.baseline.overshoot + ' / ' + next.assessment.baseline.settling, next.assessment.chosen.overshoot + ' / ' + next.assessment.chosen.settling);
      const scroll = el('div', '', 'cd03-scroll'); scroll.append(table); reasoning.append(scroll);
      reasoning.append(el('p', 'H=' + r.horizon + 's; band=' + r.band * 100 + '%. Full measurement intervals=' + (full?.intervals ?? 'unavailable') + '; interpolation discrepancy=' + (full ? fmt(full.interpolationError) : 'unavailable') + '. Settling uses the future envelope. These locations/vectors are not a whole root-locus continuation.'));
      responseHost.replaceChildren(responsePlot.figure); cornerHost.replaceChildren(corners.figure); planeHost.replaceChildren(plane.figure); detailsHost.replaceChildren(reasoning);
      checked = next; responseDrawing = responsePlot; cornerDrawing = corners; cornerExtent ??= extent; planeAxis ??= { x: [...plane.geometry.x], y: [...plane.geometry.y] }; responseY ??= [...responsePlot.geometry.y];
      if (currentTime > r.horizon) { currentTime = r.horizon / 2; if (!cursorIssue) time.value = String(currentTime); }
      time.max = cursorRange.max = String(r.horizon);
      targetSummary.textContent = 'Retained targets: Kv≥' + fmt(r.kv) + ' 1/s; overshoot≤' + fmt(r.overshoot) + '%; ' + fmt(r.band * 100) + '% settling≤' + fmt(r.settling) + 's.';
      conclusion.textContent = 'Checked accuracy: ' + next.assessment.accuracy + ' · full step targets: ' + next.assessment.transient + '. Kv=' + fmt(m.kv) + '; ramp error=' + (m.rampError === undefined ? 'not established' : fmt(m.rampError)) + '; observed overshoot=' + (full ? fmt(full.overshoot * 100) + '%' : 'unavailable') + '; settling=' + (full?.settling === undefined ? 'not established in H' : fmt(full.settling) + 's') + '.';
      draftNote.textContent = d.lag ? 'Applied lag z/p=' + fmt(m.beta) + '. All full roots and modal weights are checked.' : 'Lag off: the applied accuracy ratio is1. Draft z/p=' + fmt(d.z / d.p) + ' is not applied.';
      inspectChecked(); refreshState();
    }
    function inspectChecked() {
      if (!checked) return; const c = checked, base = c.baseline.signal.response?.value(currentTime), full = (!c.design.lag || c.full.metrics) ? c.full.signal.response?.value(currentTime) : undefined;
      responseDrawing?.inspect(currentTime, [base, full]); cursorRange.value = String(currentTime); cursorRange.setAttribute('aria-valuetext', 't=' + currentTime + ' seconds on the checked model');
      readout.textContent = (cursorIssue ? cursorIssue + ' ' : '') + 'Checked t=' + fmt(currentTime) + 's: proportional y=' + (base === undefined ? 'unavailable' : fmt(base)) + '; chosen full y=' + (full === undefined ? 'unavailable (see response qualification)' : fmt(full)) + '. Values evaluate the retained complete modal response, not an interpolated sample.';
    }
    function inspect() { try { const value = readNumericInput(time, 'Inspection time'); if (!checked || value < 0 || value > checked.requirements.horizon) throw new Error('Choose time inside the checked horizon.'); currentTime = value; cursorIssue = ''; } catch (error) { cursorIssue = problem(error); } inspectChecked(); }
    function run(): boolean {
      stop(); if (closed || signal.aborted || !isActive()) { needsRun = true; return false; }
      try { const candidate = check(readDesign(), readRequirements(), checked); paint(candidate); pending = needsRun = false; issue = ''; refreshState(); return true; }
      catch (error) { pending = false; issue = problem(error); refreshState(); return false; }
    }
    function changed(preserve?: HTMLInputElement) { if (closed || signal.aborted) return; cancelGesture(preserve); pending = true; issue = ''; syncRange(); refreshState(); if (!isActive()) { needsRun = true; return; } if (timer === undefined) timer = setTimeout(run, 80); }
    function publishRates(d: Design) { p.value = String(d.p); z.value = String(d.z); }
    function reset() { cancelGesture(); stop(); editor!.setValue('\\frac{1}{s(s+2)}'); gain.value = '4'; lag.checked = false; p.value = '.01'; z.value = '.1'; kv.value = '20'; mp.value = '20'; settling.value = '4.5'; horizon.value = '20'; band.value = '.02'; selection.value = 'p'; currentTime = 0; cursorIssue = ''; time.value = '0'; cornerExtent = undefined; planeAxis = undefined; responseY = undefined; issue = ''; run(); }
    function cancelGesture(preserve?: HTMLInputElement) { if (!gesture) return; stop(); const old = gesture; releaseCapture(); if (p !== preserve) p.value = old.p; if (z !== preserve) z.value = old.z; pending = false; issue = ''; paint(old.checked); refreshState(); }
    function move(value: number) {
      const old = gesture; if (!old) return;
      try { const next = moveCorner(old.design, old.selection, value); publishRates(next); pending = true; issue = ''; run(); }
      catch (error) { issue = 'Placement rejected: ' + problem(error) + ' Last checked placement retained; Escape restores the starting model.'; pending = false; refreshState(); }
    }
    for (const input of [gain, p, z, kv, mp, settling, horizon]) input.addEventListener('input', () => changed(input), { signal }); lag.addEventListener('change', () => changed(), { signal }); band.addEventListener('change', () => changed(), { signal });
    selection.addEventListener('change', () => { const wanted = selection.value; cancelGesture(); selection.value = wanted; if (checked) paint(checked); syncRange(); }, { signal });
    range.addEventListener('input', () => { cancelGesture(); try { const next = moveCorner(readDesign(), selection.value as Selection, 10 ** readNumericInput(range, 'Logarithmic rate')); publishRates(next); changed(); } catch (error) { issue = problem(error); refreshState(); } }, { signal });
    range.addEventListener('keydown', event => { if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End'].includes(event.key)) return; event.preventDefault(); event.stopPropagation(); const step = (event.shiftKey || event.key.startsWith('Page') ? .2 : .02), down = ['ArrowLeft', 'ArrowDown', 'PageDown'].includes(event.key); range.value = String(event.key === 'Home' ? Number(range.min) : event.key === 'End' ? Number(range.max) : Math.max(Number(range.min), Math.min(Number(range.max), Number(range.value) + (down ? -step : step)))); range.dispatchEvent(new Event('input', { bubbles: true })); }, { signal });
    time.addEventListener('input', inspect, { signal }); time.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); inspect(); } }, { signal });
    cursorRange.addEventListener('input', () => { time.value = cursorRange.value; inspect(); }, { signal });
    cursorRange.addEventListener('keydown', event => { if (!checked || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown'].includes(event.key)) return; event.preventDefault(); const step = checked.requirements.horizon / 1000 * (event.shiftKey || event.key.startsWith('Page') ? 10 : 1), down = ['ArrowLeft', 'ArrowDown', 'PageDown'].includes(event.key); time.value = String(event.key === 'Home' ? 0 : event.key === 'End' ? checked.requirements.horizon : Math.max(0, Math.min(checked.requirements.horizon, currentTime + (down ? -step : step)))); inspect(); }, { signal });
    root.addEventListener('pointerdown', event => {
      const handle = (event.target as Element).closest<SVGElement>('[data-corner-handle]'); if (!isActive() || gesture || event.button !== 0 || !handle || !cornerDrawing) return;
      if (!run() || !checked || !cornerDrawing) return;
      gesture = { id: event.pointerId, selection: handle.dataset.cornerHandle as Selection, design: checked.design, checked, p: p.value, z: z.value, box: cornerDrawing.image.getBoundingClientRect(), geometry: cornerDrawing.geometry };
      event.preventDefault(); cornerHost.tabIndex = -1; cornerHost.focus({ preventScroll: true });
      try { root.setPointerCapture?.(event.pointerId); } catch (error) { cancelGesture(); issue = problem(error); refreshState(); } refreshState();
    }, { signal });
    window.addEventListener('pointermove', event => { if (!gesture || gesture.id !== event.pointerId || !isActive()) return; event.preventDefault(); try { gesture.candidate = -pointAt(event.clientX, gesture.box, gesture.geometry); if (timer === undefined) timer = setTimeout(() => { timer = undefined; if (gesture?.candidate !== undefined) { const candidate = gesture.candidate; gesture.candidate = undefined; move(candidate); } }, 80); } catch (error) { issue = problem(error); refreshState(); } }, { signal, passive: false });
    window.addEventListener('pointerup', event => { if (!gesture || gesture.id !== event.pointerId) return; stop(); if (gesture.candidate !== undefined) move(gesture.candidate); releaseCapture(); refreshState(); }, { signal });
    const cancelPointer = (event: PointerEvent) => { if (gesture?.id === event.pointerId) cancelGesture(); }; window.addEventListener('pointercancel', cancelPointer, { signal }); root.addEventListener('lostpointercapture', cancelPointer, { signal });
    window.addEventListener('blur', () => cancelGesture(), { signal }); window.addEventListener('keydown', event => { if (gesture && event.key === 'Escape' && isActive()) { event.preventDefault(); event.stopImmediatePropagation(); cancelGesture(); cornerHost.focus({ preventScroll: true }); } }, { signal, capture: true });
    cornerHost.addEventListener('keydown', event => { const handle = (event.target as Element).closest<SVGElement>('[data-corner-handle]'); if (!handle || gesture || !isActive() || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return; event.preventDefault(); event.stopPropagation(); try { const d = readDesign(), chosen = handle.dataset.cornerHandle as Selection, value = chosen === 'z' ? d.z : d.p, step = event.shiftKey ? .01 : .001, next = moveCorner(d, chosen, value + (['ArrowLeft', 'ArrowDown'].includes(event.key) ? step : -step)); publishRates(next); run(); cornerHost.querySelector<SVGElement>('[data-corner-handle]')?.focus({ preventScroll: true }); } catch (error) { issue = problem(error); refreshState(); } }, { signal });
    const resize = () => { if (closed || signal.aborted || !isActive()) return; const size = [responseHost, cornerHost, planeHost].map(host => host.getBoundingClientRect().width).join(':'); if (size === measured) return; measured = size; cancelGesture(); if (checked) paint(checked); };
    hooks.suspend = () => { const wasPending = pending; cancelGesture(); stop(); needsRun ||= wasPending; };
    hooks.resume = () => { if (needsRun) { pending = true; if (timer === undefined) timer = setTimeout(run, 80); } else if (checked) paint(checked); };
    run(); if (closed || signal.aborted) return cleanup;
    if (typeof ResizeObserver !== 'undefined') { observer = new ResizeObserver(resize); if (closed || signal.aborted) observer.disconnect(); else observer.observe(workbench); } window.addEventListener('resize', resize, { signal });
    return cleanup;
  } catch (error) { cleanup(); throw error; }
}
