import type { ModuleContext } from '../../core/module';
import { createEquationDisplay, createEquationInput, type EquationInput } from '../../shared/equations/input';
import { readNumericInput } from '../../shared/numeric-input';
import { canonical, formatNumber as fmt, identity, matrixLatex, norm, physical, type Matrix, type StateModel } from './math';
import { parseOde, parseTransfer } from './parser';
import { baseline, createSession, family, inspect, type Checked, type Experiment } from './session';
import { draw, fit, type Limits } from './drawing';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, text = '', cls = '') { const n = document.createElement(tag); n.textContent = text; n.className = cls; return n; }
interface View { checked: Checked; s: number; h: number; pair: [number, number]; family: boolean }
interface Gesture { id: number; target: Element; start: View; sRaw: string; hRaw: string; handle?: 'scale' | 'shear' }
export function mountExplore({ container, signal: parent }: ModuleContext): () => void {
  const scope = new AbortController(), signal = scope.signal, root = el('div', '', 'cr03-explore'); container.append(root);
  let disposed = false, timer: ReturnType<typeof setTimeout> | undefined, observer: ResizeObserver | undefined;
  let gesture: Gesture | undefined, quarantined: number | undefined, pending: View | undefined;
  const session = createSession(); let current: View = { checked: session.evaluate(baseline()), s: 1, h: 0, pair: [0, 1], family: true };
  let k = 0, selected = 0, width = 620, limits = fit(current.checked, selected, current.pair), active = true;
  const history: View[] = [], editors: EquationInput[] = [], issues = new Map<HTMLInputElement, string>();
  const on = (target: EventTarget, event: string, callback: EventListener, capture = false) => target.addEventListener(event, callback, { signal, capture });
  const button = (label: string, action: () => void) => { const b = el('button', label); b.type = 'button'; on(b, 'click', () => action()); return b; };
  const field = (label: string, value: number) => { const wrap = el('label', label), input = el('input'); input.type = 'number'; input.step = 'any'; input.value = String(value); input.setAttribute('aria-label', label); wrap.append(input); return { wrap, input }; };
  const select = (label: string) => { const wrap = el('label', label), input = el('select'); input.setAttribute('aria-label', label); wrap.append(input); return { wrap, input }; };
  const status = el('p', '', 'cr03-live'); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
  const notice = el('p', '', 'cr03-material'); notice.setAttribute('role', 'status');
  const controls = el('div', '', 'cr03-controls'), s = field('Coordinate scale s', 1), h = field('Coordinate shear h', 0);
  s.input.min = '.5'; s.input.max = '2'; h.input.min = '-2'; h.input.max = '2';
  const sRange = el('input'), hRange = el('input');
  for (const [range, number, label, min, max] of [[sRange, s.input, 'Coordinate scale range', '.5', '2'], [hRange, h.input, 'Coordinate shear range', '-2', '2']] as const) {
    range.type = 'range'; range.min = min; range.max = max; range.step = 'any'; range.value = number.value; range.setAttribute('aria-label', label);
    (number === s.input ? s.wrap : h.wrap).append(range);
  }
  const iSelect = select('First coordinate i'), jSelect = select('Second coordinate j'), stateSelect = select('Selected state component');
  const familyButton = button('Use shear/scale family', () => { cancel(); try { acceptFamily(1, 0, current.pair, true); } catch (e) { error(e); } });
  const undo = button('Undo coordinate change', () => {
    cancel(); const prior = history.at(-1); if (!prior) return;
    try { const prepared = prepare(prior, limits); history.pop(); publish(prior, prepared, true); feedback('Previous checked coordinates restored.'); } catch (e) { error(e); }
  });
  const fitButton = button('Fit checked trajectories', () => { try { const next = fit(current.checked, selected, current.pair); const prepared = prepare(current, next); limits = next; publish(current, prepared); feedback('View fitted to the checked samples.'); } catch (e) { error(e); } });
  controls.append(s.wrap, h.wrap, iSelect.wrap, jSelect.wrap, stateSelect.wrap);
  const actions = el('div', '', 'cr03-actions'); actions.append(familyButton, button('Identity coordinates', () => { cancel(); try { const next = { ...current, checked: session.evaluate({ ...current.checked.experiment, T: identity(current.checked.experiment.model.A.length) }), family: true, s: 1, h: 0 }; accept(next, true); } catch (e) { error(e); } }), undo, fitButton);
  const title = el('h3', 'Change coordinates, retain the output'), stateHost = el('div', '', 'cr03-plot'), outputHost = el('div', '', 'cr03-plot'), planes = el('div', '', 'cr03-planes');
  stateHost.dataset.explorePlot = 'state'; outputHost.dataset.explorePlot = 'output';
  const identityHost = el('div'), sample = el('p', '', 'cr03-sample'), cursorControls = el('div', '', 'cr03-controls'), cursor = field('Computed sample index k', 0), range = el('input');
  cursor.input.step = '1'; cursor.input.min = '0'; range.type = 'range'; range.min = '0'; range.step = '1'; range.setAttribute('aria-label', 'Computed sample range'); cursorControls.append(cursor.wrap, range);
  const legend = el('p', 'Solid: original x or y. Dashed: transformed z or y. Curves join computed samples; coordinate units can differ.', 'cr03-muted');
  const planeIntro = el('p', 'New coordinate basis in the original x plane: columns of T⁻¹. Drag the scale or shear endpoint, or use their numbers and arrow keys. Both axes have equal scale.', 'cr03-muted');
  const table = el('details'), tableHost = el('div', '', 'cr03-local-scroll'); table.append(el('summary', 'All checked state and output samples'), tableHost);
  root.append(title, controls, actions, status, notice, stateHost, legend, cursorControls, sample, outputHost, planeIntro, planes, identityHost, table);
  const settings = el('details'); settings.append(el('summary', 'Model, general coordinate matrix and experiment')); root.append(settings);
  const source = select('Explore given form'); for (const [value, label] of [['tf', 'Transfer function'], ['ode', 'Linear ODE'], ['matrix', 'State matrices']]) { const option = el('option', label); option.value = value; source.input.append(option); }
  const tfHost = el('div'), odeHost = el('div'), tf = createEquationInput({ label: 'Explore transfer function', value: String.raw`G(s)=\frac1{s^2+3s+2}`, tools: ['fraction', 'power', 'parentheses'], description: 'Real proper rational polynomials in s, through order four.', signal, onChange: () => feedback('Unapplied source draft. The checked preview is retained.') }); editors.push(tf); tfHost.append(tf.element);
  const ode = createEquationInput({ label: 'Explore linear ODE', value: "y''+3y'+2y=u", tools: ['fraction', 'parentheses'], description: 'Linear constant-coefficient derivatives through order four; use primes.', signal, onChange: () => feedback('Unapplied source draft. The checked preview is retained.') }); editors.push(ode); odeHost.append(ode.element); odeHost.hidden = true;
  const size = select('Explore matrix dimension'); for (let n = 0; n <= 4; n++) { const o = el('option', n ? `${n} states` : 'Static gain'); o.value = String(n); size.input.append(o); }
  const matrixHost = el('div', '', 'cr03-matrices'), initialHost = el('div', '', 'cr03-matrices'), T = el('div', '', 'cr03-matrices');
  let matrixFields: HTMLInputElement[][][] = [], initialFields: HTMLInputElement[] = [], tFields: HTMLInputElement[][] = [];
  function grid(host: HTMLElement, label: string, values: Matrix): HTMLInputElement[][] {
    const group = el('div'), scroll = el('div', '', 'cr03-local-scroll'), table = el('table'); group.append(el('h4', label), scroll); scroll.append(table); host.append(group);
    return values.map((row, i) => { const tr = el('tr'); table.append(tr); return row.map((v, j) => { const f = field(`${label} row ${i + 1} column ${j + 1}`, v), td = el('td'); td.append(f.wrap); tr.append(td); on(f.input, 'input', () => feedback('Unapplied matrix draft. The checked preview is retained.')); return f.input; }); });
  }
  function modelFields(model: StateModel) {
    matrixHost.replaceChildren(); size.input.value = String(model.A.length);
    matrixFields = [grid(matrixHost, 'Explore A', model.A), grid(matrixHost, 'Explore B', model.B.map(v => [v])), grid(matrixHost, 'Explore C', model.A.length ? [model.C] : []), grid(matrixHost, 'Explore D', [[model.D]])];
  }
  function coordinateFields(exp: Experiment) {
    T.replaceChildren(); tFields = grid(T, 'Explore T draft', exp.T); initialHost.replaceChildren();
    initialFields = exp.initial.map((v, i) => { const f = field(`Explore x${i + 1}(0−)`, v); initialHost.append(f.wrap); return f.input; });
  }
  modelFields(current.checked.experiment.model); coordinateFields(current.checked.experiment);
  const command = field('Explore constant command u', 1), horizon = field('Explore horizon H (s)', 5), count = field('Explore computed points', 201); count.input.step = '1';
  function read(input: HTMLInputElement, label: string, max = 1e6) { const v = readNumericInput(input, label); if (Math.abs(v) > max) throw new Error(`${label}: magnitude must be at most ${max}.`); return v; }
  const matrixRead = (fields: HTMLInputElement[][]) => fields.map(row => row.map(f => read(f, f.getAttribute('aria-label')!)));
  function readModel(): StateModel { return { A: matrixRead(matrixFields[0]), B: matrixRead(matrixFields[1]).map(r => r[0]), C: matrixFields[2].length ? matrixRead(matrixFields[2])[0] : [], D: read(matrixFields[3][0][0], 'Explore D') }; }
  const draft = (editor: EquationInput) => { const value = editor.getValue(); if (value.empty || value.hasPlaceholders || value.syntaxIssues.length) throw new Error('Complete the source equation first.'); return value.latex; };
  settings.append(el('p', 'Apply a source explicitly. Source cells and general T are independent drafts; view changes keep them intact. The complete candidate-realization exercise remains in Practice.', 'cr03-muted'), source.wrap, tfHost, odeHost, size.wrap, matrixHost, button('Apply Explore given model', () => {
    cancel(); try {
      const model = source.input.value === 'matrix' ? readModel() : canonical(source.input.value === 'ode' ? parseOde(draft(ode)) : parseTransfer(draft(tf)));
      const exp = { ...current.checked.experiment, model, initial: Array(model.A.length).fill(0) as number[], T: identity(model.A.length) }, pair: [number, number] = [0, model.A.length > 1 ? 1 : 0];
      const next: View = { checked: session.evaluate(exp), s: 1, h: 0, pair, family: true }, nextLimits = fit(next.checked, 0, pair), prepared = prepare(next, nextLimits, 0, 0);
      selected = 0; k = 0; limits = nextLimits; history.length = 0; publish(next, prepared, true); coordinateFields(exp); feedback('Source applied; initial state and T reset. Candidate Practice remains independent.');
    } catch (e) { error(e); }
  }), el('h4', 'General coordinate draft: z = T x'), T, button('Copy checked T to draft cells', () => { T.replaceChildren(); tFields = grid(T, 'Explore T draft', current.checked.experiment.T); feedback('Checked T copied explicitly to the matrix draft.'); }), button('Apply general T', () => {
    cancel(); try { accept({ ...current, checked: session.evaluate({ ...current.checked.experiment, T: matrixRead(tFields) }), family: false }, true); feedback('General T checked. Family controls are inactive until explicitly selected.'); } catch (e) { error(e); }
  }), button('Use output-derivative coordinates', () => {
    cancel(); try { const exp = current.checked.experiment, T = physical(exp.model, exp.initial).T; accept({ ...current, checked: session.evaluate({ ...exp, T }), family: false }, true); feedback('Output-derivative coordinate map checked; all terms still use the same input.'); } catch (e) { error(e); }
  }), el('h4', 'Same physical initial state and constant command'), initialHost, command.wrap, horizon.wrap, count.wrap, button('Apply experiment', () => {
    cancel(); try {
      const exp = { ...current.checked.experiment, initial: initialFields.map(f => read(f, f.getAttribute('aria-label')!, 100)), command: read(command.input, 'Command', 100), horizon: read(horizon.input, 'Horizon', 20), count: read(count.input, 'Computed points', 401) };
      const next = { ...current, checked: session.evaluate(exp) }; accept(next); history.length = 0; feedback('Experiment checked in both coordinate systems.');
    } catch (e) { error(e); }
  }), el('p', '0–4 states; coefficients and T entries ≤10⁶; x(0−), command magnitude ≤100; constant input begins at0; state stays continuous and D can jump the output. Horizon0.001–20s,2–401 points. T condition ≤10⁸. Projection cancellation can reject an otherwise bounded experiment; shorten the horizon or improve coordinates. This is a numerical screen, not a certified error bound.', 'cr03-muted'));
  on(source.input, 'change', () => { tfHost.hidden = source.input.value !== 'tf'; odeHost.hidden = source.input.value !== 'ode'; feedback('Source choice is an unapplied draft.'); });
  on(size.input, 'change', () => { const n = Number(size.input.value); modelFields({ A: identity(n).map(row => row.map(() => 0)), B: Array(n).fill(0) as number[], C: Array(n).fill(0) as number[], D: 0 }); feedback('New matrix dimensions are an unapplied draft.'); });

  function feedback(message: string) { status.textContent = `${message}${issues.size ? ` ${[...issues.values()].join(' ')}` : ''}`; }
  function error(e: unknown) { feedback(`${e instanceof Error ? e.message : 'Check the model and coordinates.'} Previous checked preview retained.`); }
  function prepare(view: View, nextLimits: Limits, nextK = k, component = selected) {
    const n = view.checked.experiment.model.A.length; component = Math.min(component, Math.max(0, n - 1)); nextK = Math.min(nextK, view.checked.original.length - 1);
    const plots = draw(view.checked, nextK, component, view.pair, width, nextLimits, view.family);
    const eq = createEquationDisplay(`z=Tx,\\quad T=${matrixLatex(view.checked.experiment.T)}`, 'Checked coordinate transformation');
    return { plots, eq, component, index: nextK };
  }
  function renderSample() {
    const p = inspect(current.checked, k), exp = current.checked.experiment;
    sample.textContent = `k=${k}/${exp.count - 1}, t=${fmt(p.original.t)} s · x=[${p.original.state.map(fmt).join(', ')}] · z=[${p.changed.state.map(fmt).join(', ')}] · y original=${fmt(p.original.output)}, mapped=${fmt(p.changed.output)}. ${exp.model.A.length > 2 ? 'The planes are projections; all states and coupling remain in the computations.' : ''}`;
    notice.textContent = `Checked condition≈${fmt(current.checked.transformed.condition)}; algebraic residual≈${fmt(current.checked.transformed.residual)}; max sampled output difference≈${fmt(current.checked.outputError)}. ${norm(exp.model.A) * exp.horizon / (exp.count - 1) > 1 ? 'Spacing may hide fast variation: increase points or shorten H.' : ''}`;
    const rows = document.createElement('table'), head = el('tr'); for (const label of ['k', 't(s)', ...exp.initial.map((_, i) => `x${i + 1}`), ...exp.initial.map((_, i) => `z${i + 1}`), 'y original', 'y mapped']) head.append(el('th', label)); rows.append(head);
    current.checked.original.forEach((point, i) => { const row = el('tr'); if (i === k) row.setAttribute('aria-current', 'true'); for (const v of [i, point.t, ...point.state, ...current.checked.changed[i].state, point.output, current.checked.changed[i].output]) row.append(el('td', fmt(v))); rows.append(row); }); tableHost.replaceChildren(rows);
  }
  function options(input: HTMLSelectElement, n: number, value: number) { if (input.options.length !== n) { input.replaceChildren(); for (let i = 0; i < n; i++) { const o = el('option', `${i + 1}`); o.value = String(i); input.append(o); } } input.value = String(value); input.disabled = !n; }
  function sync(explicit = false) {
    const n = current.checked.experiment.model.A.length;
    options(iSelect.input, n, current.pair[0]); options(jSelect.input, n, current.pair[1]); options(stateSelect.input, n, selected);
    iSelect.wrap.hidden = n < 2; jSelect.wrap.hidden = n < 2; h.wrap.hidden = n < 2; s.wrap.hidden = n === 0; planeIntro.hidden = n < 2;
    for (const control of [s.input, h.input, sRange, hRange]) control.disabled = !current.family || !n;
    familyButton.disabled = !n; undo.disabled = !history.length;
    sRange.value = String(current.s); hRange.value = String(current.h); sRange.setAttribute('aria-valuetext', `Scale ${current.s}`); hRange.setAttribute('aria-valuetext', `Shear ${current.h}`);
    if (explicit) { s.input.value = String(current.s); h.input.value = String(current.h); issues.delete(s.input); issues.delete(h.input); }
    cursor.input.max = range.max = String(current.checked.original.length - 1); range.value = String(k); range.setAttribute('aria-valuetext', `Sample ${k}, time ${fmt(current.checked.original[k].t)} seconds`);
    if (!issues.has(cursor.input)) cursor.input.value = String(k);
    root.querySelectorAll('[data-handle]').forEach(handle => { const isScale = (handle as HTMLElement).dataset.handle === 'scale'; handle.setAttribute('aria-valuenow', String(isScale ? current.s : current.h)); handle.setAttribute('aria-valuetext', `${isScale ? 'Scale' : 'Shear'} ${isScale ? current.s : current.h}`); });
  }
  function publish(view: View, prepared: ReturnType<typeof prepare>, explicit = false) {
    const focusedHandle = root.contains(document.activeElement) ? (document.activeElement as HTMLElement)?.dataset.handle : undefined;
    current = view; k = prepared.index; selected = prepared.component;
    stateHost.replaceChildren(...prepared.plots.state.childNodes); outputHost.replaceChildren(...prepared.plots.output.childNodes); planes.replaceChildren(...prepared.plots.planes.childNodes); identityHost.replaceChildren(prepared.eq); sync(explicit); renderSample();
    if (focusedHandle) root.querySelector<SVGElement>(`[data-handle="${focusedHandle}"]`)?.focus({ preventScroll: true });
  }
  function accept(next: View, record = false) {
    const prepared = prepare(next, limits); if (record) { history.push(current); if (history.length > 20) history.shift(); } publish(next, prepared);
  }
  function acceptFamily(nextS: number, nextH: number, pair: [number, number], explicit = false, record = true) {
    const n = current.checked.experiment.model.A.length, exp = { ...current.checked.experiment, T: family(n, pair[0], pair[1], nextS, nextH) };
    const next: View = { checked: session.evaluate(exp), s: nextS, h: nextH, pair, family: true }; const prepared = prepare(next, limits);
    if (record) { history.push(current); if (history.length > 20) history.shift(); } publish(next, prepared, explicit); feedback('Coordinates checked independently; the output is retained.');
  }
  function queue(nextS: number, nextH: number, pair = current.pair) {
    pending = { ...current, s: nextS, h: nextH, pair }; if (timer) clearTimeout(timer);
    feedback('Updating · previous checked preview'); timer = setTimeout(() => {
      timer = undefined; const next = pending; pending = undefined; if (!next || disposed || !active) return;
      try { acceptFamily(next.s, next.h, next.pair, false, !gesture); } catch (e) { error(e); }
    }, 80);
  }
  function stopPending() { if (timer) clearTimeout(timer); timer = undefined; pending = undefined; }
  function release(g: Gesture) { try { if (g.target.hasPointerCapture(g.id)) g.target.releasePointerCapture(g.id); } catch { /* already released */ } }
  function cancel() {
    stopPending(); const g = gesture; if (!g) return; gesture = undefined; quarantined = g.id; release(g);
    try { const prepared = prepare(g.start, limits); publish(g.start, prepared); s.input.value = g.sRaw; h.input.value = g.hRaw; feedback('Coordinate gesture cancelled; starting checked coordinates restored.'); } catch (e) { error(e); }
  }
  function start(event: PointerEvent, target: Element, handle?: 'scale' | 'shear') {
    if (gesture || event.button !== 0 || !current.family) return false;
    stopPending(); quarantined = undefined; gesture = { id: event.pointerId, target, start: current, sRaw: s.input.value, hRaw: h.input.value, handle };
    try { target.setPointerCapture(event.pointerId); } catch { /* window terminal listeners also own release */ } return true;
  }
  function end(event: PointerEvent, cancelled: boolean) {
    if (gesture?.id === event.pointerId) {
      if (cancelled) cancel(); else {
        const g = gesture, next = pending; stopPending();
        if (next) { try { acceptFamily(next.s, next.h, next.pair, false, false); } catch (e) { error(e); } }
        gesture = undefined; release(g); if (current !== g.start) { history.push(g.start); if (history.length > 20) history.shift(); } sync();
      }
    }
    if (quarantined === event.pointerId) quarantined = undefined;
  }
  on(window, 'pointerup', event => end(event as PointerEvent, false)); on(window, 'pointercancel', event => end(event as PointerEvent, true));
  on(window, 'lostpointercapture', event => { const e = event as PointerEvent; if (gesture?.id === e.pointerId) cancel(); });
  on(window, 'keydown', event => { const e = event as KeyboardEvent; if (e.key === 'Escape' && gesture) { e.preventDefault(); e.stopImmediatePropagation(); cancel(); } }, true);
  function parameter(name: 'scale' | 'shear', value: number, explicit = false) {
    const base = pending ?? current, nextS = name === 'scale' ? value : base.s, nextH = name === 'shear' ? value : base.h;
    if (explicit) { const f = name === 'scale' ? s.input : h.input; f.value = String(value); issues.delete(f); }
    queue(nextS, nextH);
  }
  function keyValue(e: KeyboardEvent, name: 'scale' | 'shear') {
    const base = pending ?? current, min = name === 'scale' ? .5 : -2, max = 2, old = name === 'scale' ? base.s : base.h, step = (name === 'scale' ? .05 : .1) * (e.shiftKey ? 10 : 1);
    const value = e.key === 'Home' ? min : e.key === 'End' ? max : ['ArrowRight', 'ArrowUp', 'PageUp'].includes(e.key) ? old + step * (e.key === 'PageUp' ? 10 : 1) : ['ArrowLeft', 'ArrowDown', 'PageDown'].includes(e.key) ? old - step * (e.key === 'PageDown' ? 10 : 1) : undefined;
    if (value === undefined) return; e.preventDefault(); parameter(name, Math.min(max, Math.max(min, Number(value.toPrecision(14)))), true);
  }
  for (const [name, number, slider, low] of [['scale', s.input, sRange, .5], ['shear', h.input, hRange, -2]] as const) {
    on(number, 'input', () => { try { const value = readNumericInput(number, `Coordinate ${name}`); if (value < low || value > 2) throw new Error(`Coordinate ${name} must be ${low}–2.`); issues.delete(number); parameter(name, value); } catch (e) { issues.set(number, e instanceof Error ? e.message : 'Check the coordinate number.'); error(e); } });
    on(slider, 'pointerdown', event => { if (!start(event as PointerEvent, slider)) event.preventDefault(); });
    on(slider, 'input', () => { if (quarantined !== undefined || !current.family) return; parameter(name, Number(slider.value), true); });
    on(slider, 'keydown', event => keyValue(event as KeyboardEvent, name));
  }
  on(planes, 'pointerdown', event => { const e = event as PointerEvent, target = (e.target as Element).closest<SVGElement>('[data-handle]'); if (target && start(e, planes, target.dataset.handle as 'scale' | 'shear')) { e.preventDefault(); target.focus(); } });
  on(planes, 'keydown', event => { const target = (event.target as HTMLElement).closest<HTMLElement>('[data-handle]'); if (target) keyValue(event as KeyboardEvent, target.dataset.handle as 'scale' | 'shear'); });
  on(window, 'pointermove', event => {
    const e = event as PointerEvent, g = gesture; if (!g || g.id !== e.pointerId || !g.handle) return;
    const svg = planes.querySelector<SVGSVGElement>('[data-plane="x"]'); if (!svg) return;
    const rect = svg.getBoundingClientRect(); if (!rect.width) return;
    const px = (e.clientX - rect.left) * width / rect.width, py = (e.clientY - rect.top) * Number(svg.viewBox.baseVal.height) / rect.height;
    const size = Number(svg.dataset.size), left = Number(svg.dataset.left), top = Number(svg.dataset.top), bound = Number(svg.dataset.bound);
    const x = (px - left - size / 2) * 2 * bound / size, y = (top + size / 2 - py) * 2 * bound / size;
    if (g.handle === 'scale') parameter('scale', Math.min(2, Math.max(.5, x > 0 ? 1 / x : 2)), true);
    else { const nextS = Math.min(2, Math.max(.5, y)), nextH = Math.min(2, Math.max(-2, -x)); s.input.value = String(nextS); h.input.value = String(nextH); issues.delete(s.input); issues.delete(h.input); queue(nextS, nextH); }
  });
  for (const input of [iSelect.input, jSelect.input]) on(input, 'change', () => {
    cancel(); const pair: [number, number] = [Number(iSelect.input.value), Number(jSelect.input.value)];
    if (pair[0] === pair[1]) { feedback('Choose two distinct coordinates. Previous checked projection retained.'); return; }
    try { if (current.family) acceptFamily(current.s, current.h, pair); else { const next = { ...current, pair }; publish(next, prepare(next, limits)); feedback('Projection changed; the full model is retained.'); } } catch (e) { error(e); }
  });
  on(stateSelect.input, 'change', () => { try { const next = Number(stateSelect.input.value), prepared = prepare(current, limits, k, next); selected = next; publish(current, prepared); feedback('Selected component changed using checked samples.'); } catch (e) { error(e); } });
  function setIndex(index: number, explicit = false) {
    try { inspect(current.checked, index); const prepared = prepare(current, limits, index); if (explicit) { issues.delete(cursor.input); cursor.input.value = String(index); } publish(current, prepared); feedback('Inspecting the same computed sample in each view.'); } catch (e) { error(e); }
  }
  on(cursor.input, 'input', () => { try { const value = readNumericInput(cursor.input, 'Sample index'); inspect(current.checked, value); issues.delete(cursor.input); setIndex(value); } catch (e) { issues.set(cursor.input, e instanceof Error ? e.message : 'Check the sample index.'); error(e); } });
  on(range, 'input', () => setIndex(Number(range.value), true));
  const deactivate = () => { active = false; cancel(); }; on(container, 'cr03-deactivate', deactivate); on(container, 'cr03-activate', () => { active = true; });
  function dispose() {
    if (disposed) return; disposed = true; parent.removeEventListener('abort', dispose); stopPending(); const g = gesture; gesture = undefined; if (g) release(g); scope.abort(); observer?.disconnect();
    try { for (const editor of editors) editor.destroy(); } finally { root.remove(); }
  }
  parent.addEventListener('abort', dispose, { once: true });
  try {
    publish(current, prepare(current, limits)); feedback('Live checked coordinate experiment. Change s or h; compare state values and the common output.');
    if (typeof ResizeObserver !== 'undefined') { observer = new ResizeObserver(entries => {
      if (disposed || !active) return; const next = entries[0]?.contentRect.width; if (!next || Math.abs(next - width) < .5) return;
      const old = width; width = Math.max(260, Math.min(960, next)); try { publish(current, prepare(current, limits)); } catch (e) { width = old; error(e); }
    }); if (disposed) observer.disconnect(); else observer.observe(stateHost); }
    if (parent.aborted) dispose(); return dispose;
  } catch (e) { dispose(); throw e; }
}
