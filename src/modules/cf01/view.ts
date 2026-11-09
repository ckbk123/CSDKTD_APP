import type { ModuleMount } from '../../core/module';
import { createEquationDisplay, createEquationInput, type EquationInput } from '../../shared/equations/input';
import { readNumericInput } from '../../shared/numeric-input';
import { format as f, latexNumber as ln, parseTransfer } from './input';
import { buildResponse, normalizedAt, type Model, type Response } from './response';
import { assess, deriveTargets, measure, pairPrediction, type Band, type Rise, type Measurement, type Targets } from './measure';
import { fitPoles, polePlot, responsePlot, type Handle, type PoleDrawing, type PoleWindow, type ResponseDrawing } from './plots';
import { draggedPair, editedPair, pairEquation, type PairModel } from './parameters';
import { markup } from './markup';
import './style.css';
const baseLatex = (r: Response) => '\\frac{' + ln(r.model.g) + '}{s^2+' + ln(r.model.a1) + 's+' + ln(r.model.a0) + '}';
const judgment = (v: boolean | undefined) => v === true ? 'Meets target' : v === false ? 'Does not meet target' : 'Not established';
const seconds = (v: number | undefined) => v === undefined ? 'Not established' : f(v) + ' s';
const peak = (m: Measurement) => m.noOvershoot ? 'No finite overshoot peak' : seconds(m.peakTime) + (m.peakEstablished ? '' : ' (within H)');
const riseTime = (m: Measurement) => m.rise === '0-100' && m.noOvershoot ? 'No finite 100% crossing' : seconds(m.riseTime);
interface Snapshot { pair: Measurement; full: Measurement; targets: Targets }
export const mount: ModuleMount = ({ container, signal: parent }) => {
  if (parent.aborted) return;
  const life = new AbortController(), signal = life.signal, root = document.createElement('div'); root.className = 'cf1-tool'; root.innerHTML = markup; container.append(root);
  const q = <T extends Element>(selector: string) => root.querySelector<T>(selector)!;
  const input = (name: string) => q<HTMLInputElement>('[name="' + name + '"]'), select = (name: string) => q<HTMLSelectElement>('[name="' + name + '"]');
  const read = (name: string, label = name) => readNumericInput(input(name), label);
  const answer = q<HTMLElement>('.cf1-answer'), status = q<HTMLElement>('.cf1-status'), state = q<HTMLElement>('.cf1-preview-state'), warning = q<HTMLElement>('.cf1-warning');
  const responseHost = q<HTMLElement>('.cf1-response'), poleHost = q<HTMLElement>('.cf1-poles'), cancelButton = q<HTMLButtonElement>('[data-action="cancel"]');
  const measureActions = document.createElement('div'); measureActions.className='cf1-actions'; measureActions.hidden=true; responseHost.after(measureActions);
  let field: EquationInput | undefined, disposed = false, timer: ReturnType<typeof globalThis.setTimeout> | undefined, result: Snapshot | undefined;
  let base: PairModel = { g: 4, a1: 2, a0: 4 }, currentTime = 5, window: PoleWindow | undefined, responseDrawing: ResponseDrawing | undefined, poleDrawing: PoleDrawing | undefined;
  let equationDirty = false, pairDirty = false, pending = false, revealed = false, runIssue = '', targetIssue = '', timeIssue = '', activeHandle: Handle | undefined;
  interface Saved { base: PairModel; result: Snapshot; latex: string; values: string[]; time: number; window: PoleWindow; revealed: boolean }
  let drag: { id: number; kind: Handle | 'time'; host: HTMLElement; saved: Saved } | undefined;
  const clearTimer = () => { if (timer !== undefined) { globalThis.clearTimeout(timer); timer = undefined; } };
  const releaseCapture = (host: HTMLElement, id: number) => { try { if (host.hasPointerCapture?.(id)) host.releasePointerCapture(id); } catch { /* The browser may already release a detached pointer. */ } };
  const cleanup = () => { if (disposed) return; disposed = true; clearTimer(); const previous = drag; drag = undefined; if (previous) releaseCapture(previous.host, previous.id); parent.removeEventListener('abort', cleanup); life.abort(); field?.destroy(); result = undefined; root.remove(); };
  parent.addEventListener('abort', cleanup, { once: true }); if (parent.aborted) { cleanup(); return cleanup; }
  try {
    const on = (node: EventTarget, type: string, action: () => void) => node.addEventListener(type, () => { if (!disposed && !signal.aborted) action(); }, { signal });
    field = createEquationInput({ label: 'Closed-loop target-pair transfer function T(s)', value: 'T(s)=\\frac{4}{s^2+2s+4}', signal, tools: ['fraction', 'power', 'parentheses'], description: 'One positive constant over a stable second-order polynomial; extra factors use their separate controls.', onChange: () => {
      if (drag) { const draft = field!.getValue().latex; cancelDrag(); field!.setValue(draft); }
      clearTimer(); pending = false; equationDirty = true; pairDirty = false; hideAnswer(); updateState();
    } });
    q('.cf1-equation').append(field.element);
    function updateState() {
      state.textContent = equationDirty ? 'Equation draft · previous curves' : runIssue || targetIssue ? 'Unapplied inputs · previous curves' : pending ? 'Updating · previous curves' : revealed ? 'Checked measurements' : 'Live curves · measurements hidden';
      warning.textContent = [runIssue, targetIssue, !runIssue && result?.full.settlingTime === undefined && result ? 'This finite horizon does not establish settling. Extend H before treating an in-band endpoint as settled.' : ''].filter(Boolean).join(' ');
      const busy = !!drag;
      for (const name of ['damping', 'damping-range', 'frequency', 'frequency-range']) input(name).disabled = equationDirty || busy;
      input('pole').disabled = !input('include-pole').checked || busy; input('zero').disabled = !input('include-zero').checked || busy;
      for (const name of ['include-pole', 'include-zero', 'overshoot', 'overshoot-range', 'settling', 'settling-range', 'horizon']) input(name).disabled = busy;
      for (const name of ['band', 'rise', 'tolerance']) select(name).disabled = busy;
      select('prediction').disabled = busy; root.querySelectorAll<HTMLButtonElement>('[data-action]').forEach(button => { if (button !== cancelButton) button.disabled = busy; });
      measureActions.querySelectorAll('button').forEach(button=>{button.disabled=busy;});
      poleHost.querySelectorAll<HTMLButtonElement>('[data-handle]').forEach(button => { button.disabled=equationDirty || !!runIssue || !!targetIssue || busy; });
      cancelButton.disabled = !drag; input('time').disabled = input('time-range').disabled = pending || (busy && drag?.kind !== 'time');
    }
    function showInspection() {
      if (!result) return;
      const pair = normalizedAt(result.pair.response, currentTime), full = normalizedAt(result.full.response, currentTime), finalValue = result.full.response.finalValue;
      responseDrawing?.cursor(currentTime);
      q('.cf1-inspection').textContent = timeIssue || 'At t=' + f(currentTime) + ' s: pair y=' + f(pair.value * finalValue) + ', full y=' + f(full.value * finalValue) + ' output units. Normalized pair=' + f(pair.value) + ', full=' + f(full.value) + '; common final value=' + f(finalValue) + '.';
    }
    function inspect() {
      if (!result || disposed) return;
      try { const time = read('time', 'inspection time'); if (time < 0 || time > result.full.horizon) throw new Error('Choose inspection time within the common horizon.'); currentTime = time; timeIssue = ''; input('time-range').value = String(time); }
      catch (error) { timeIssue = error instanceof Error ? error.message : 'Check inspection time.'; }
      showInspection();
    }
    function renderPole() { if (!result) return; window ??= fitPoles(result.full, result.targets); poleDrawing = polePlot(result.full, result.targets, window); poleHost.replaceChildren(poleDrawing.element); if(activeHandle&&!poleHost.querySelector('[data-handle="'+activeHandle+'"]'))activeHandle=undefined; }
    function renderResponse() {
      if (!result) return; responseDrawing = responsePlot(result.pair, result.full, currentTime, revealed); responseHost.replaceChildren(responseDrawing.element); showInspection();
      measureActions.replaceChildren(); measureActions.hidden=!revealed;
      if(revealed) for(const [time,title] of [[result.full.riseStart,'rise start'],[result.full.riseEnd,'rise end'],[result.full.peakTime,'detected peak'],[result.full.settlingTime,'settling']] as const){if(time===undefined)continue;const button=document.createElement('button');button.type='button';button.textContent='Inspect '+title;button.dataset.measureTime=String(time);measureActions.append(button);}
    }
    function hideAnswer() {
      const wasRevealed = revealed; revealed = false; answer.hidden = true; q('.cf1-feedback').textContent = ''; q('.cf1-table').replaceChildren(); q('.cf1-reasoning').replaceChildren(); q('.cf1-target-steps').replaceChildren();
      if (wasRevealed) renderResponse();
    }
    function queue() {
      hideAnswer(); if (equationDirty) { updateState(); return; }
      pending = true; updateState(); if (timer === undefined) timer = globalThis.setTimeout(() => { timer = undefined; compute(); }, 80);
    }
    function matches(m: Measurement | undefined, model: Model, horizon: number, band: Band, rise: Rise, tolerance: number): m is Measurement {
      return !!m && m.horizon === horizon && m.band === band && m.rise === rise && m.tolerance === tolerance && (['g', 'a1', 'a0', 'pole', 'zero'] as const).every(key => m.response.model[key] === model[key]);
    }
    function compute(fit = false): boolean {
      if (disposed || signal.aborted) return false; clearTimer(); pending = false; hideAnswer();
      try {
        const draft = field!.getValue(); if (draft.empty || draft.hasPlaceholders || draft.syntaxIssues.length) throw new Error('Complete the target-pair equation and check its notation.');
        const candidate = pairDirty && !equationDirty ? editedPair(drag?.saved.base ?? base, read('damping', 'damping ratio'), read('frequency', 'natural frequency')) : undefined;
        const nextBase = candidate?.model ?? parseTransfer(draft.latex), horizon = read('horizon', 'common horizon'), band = Number(select('band').value) as Band, rise = select('rise').value as Rise, tolerance = Number(select('tolerance').value);
        const targets = deriveTargets(read('overshoot', 'maximum overshoot'), read('settling', 'maximum settling time'), band);
        const fullModel = { ...nextBase, pole: input('include-pole').checked ? read('pole', 'added pole parameter') : undefined, zero: input('include-zero').checked ? read('zero', 'added zero parameter') : undefined };
        const pair = matches(result?.pair, nextBase, horizon, band, rise, tolerance) ? result.pair : measure(buildResponse(nextBase), horizon, band, rise, tolerance);
        const full = matches(result?.full, fullModel, horizon, band, rise, tolerance) ? result.full : matches(pair, fullModel, horizon, band, rise, tolerance) ? pair : measure(buildResponse(fullModel), horizon, band, rise, tolerance);
        // Commit only after parsing, all modal checks and both complete measurements succeed.
        base = nextBase; result = { pair, full, targets }; equationDirty = pairDirty = false; runIssue = targetIssue = '';
        if (candidate) field!.setValue(candidate.latex);
        for (const [name, value] of [['damping', pair.response.damping], ['frequency', pair.response.naturalFrequency]] as const) { input(name).value = String(value); input(name + '-range').value = String(value); }
        input('time').max = input('time-range').max = String(horizon);
        if (!timeIssue && currentTime > horizon) { currentTime = horizon / 2; input('time').value = String(currentTime); input('time-range').value = String(currentTime); }
        if (fit || !window) window = fitPoles(full, targets);
        renderResponse(); renderPole(); updateState();
        status.textContent = 'Computed both responses over 0…' + f(horizon) + ' s. Measurement values/markers stay hidden until Reveal. Fixed pole axes retain their scale during edits; Fit changes the view only.';
        if (full.settlingTime === undefined) status.textContent += ' Not established: extend the horizon before treating an in-band endpoint as settled.';
        return true;
      } catch (error) { runIssue = error instanceof Error ? error.message : 'Check the equation and requirements.'; status.textContent = runIssue + ' Previous checked curves are retained.'; updateState(); return false; }
    }
    function changeTargets() {
      hideAnswer();
      try {
        const next = deriveTargets(read('overshoot', 'maximum overshoot'), read('settling', 'maximum settling time'), Number(select('band').value) as Band); targetIssue = '';
        input('overshoot-range').value = String(next.overshoot); input('settling-range').value = String(next.settling);
        if (result && !pending && !equationDirty && !pairDirty && !runIssue && result.full.band === next.band) { result = { ...result, targets: next }; renderPole(); status.textContent = 'Requirement region updated using the cached responses. Reveal compares their measurements with the new targets.'; }
        else if (!equationDirty) queue();
      } catch (error) { targetIssue = error instanceof Error ? error.message : 'Check the transient targets.'; }
      updateState();
    }
    function renderTargetSteps() {
      if (!result) return; const targets = result.targets, steps = q('.cf1-target-steps'); steps.replaceChildren();
      steps.append(createEquationDisplay(targets.overshoot === 0 ? '\\zeta_{\\min}=1\\quad(M_{p,\\max}=0)' : '\\zeta_{\\min}=\\frac{-\\ln(' + ln(targets.overshoot / 100) + ')}{\\sqrt{\\pi^2+\\ln^2(' + ln(targets.overshoot / 100) + ')}}=' + ln(targets.dampingMinimum), 'Minimum damping from overshoot requirement'));
      steps.append(createEquationDisplay('\\sigma_g=\\frac{' + ln(targets.coefficient) + '}{' + ln(targets.settling) + '}=' + ln(targets.decayMinimum) + ',\\quad\\omega_{n,g}|_{\\zeta_{\\min}}=' + ln(targets.naturalFrequencyAtMinimumDamping), 'Approximate decay and natural-frequency guideline'));
    }

  function renderAnswer(): void {
    if (!result) { status.textContent = 'Calculate valid responses before revealing measurements.'; return; }
    const { pair, full, targets } = result, prediction = pairPrediction(pair.response, targets), checked = assess(full, targets);
    const outcome = checked.overshoot === false || checked.settling === false ? 'not' : checked.overshoot === true && checked.settling === true ? 'met' : 'unknown';
    const attempt = select('prediction').value;
    q('.cf1-feedback').textContent = (attempt ? attempt === outcome ? 'Correct. ' : 'Check your prediction. ' : 'Choose a prediction to compare. ') + 'Full model: overshoot ' + judgment(checked.overshoot).toLowerCase() + '; settling ' + judgment(checked.settling).toLowerCase() + '.';
    answer.hidden = false;
    const table = document.createElement('table'); table.innerHTML = '<thead><tr><th>Criterion</th><th>Pair formula / guideline</th><th>Measured pair</th><th>Measured full model</th></tr></thead>';
    const body = document.createElement('tbody'), mp = (m: Measurement) => f(m.overshootPercent) + '%' + (m.peakEstablished ? '' : ' (detected in H)');
    const rows = [
      ['Overshoot', f(prediction.overshoot) + '%', mp(pair), mp(full)],
      ['Peak time', prediction.peakTime === undefined ? 'No finite overshoot peak' : seconds(prediction.peakTime), peak(pair), peak(full)],
      ['Rise time: ' + (full.rise === '10-90' ? 'first 10–90%' : 'step start to first 100%'), 'Read the pair curve', riseTime(pair), riseTime(full)],
      ['Settling: ±' + full.band + '%', prediction.settlingGuideline === undefined ? 'Overdamped: use measured curve' : seconds(prediction.settlingGuideline) + ' (approximate)', seconds(pair.settlingTime), seconds(full.settlingTime)],
      ['Maximum overshoot ' + f(targets.overshoot) + '%', 'Pair in shaded guideline: ' + (prediction.inRegion ? 'yes' : 'no'), judgment(assess(pair, targets).overshoot), judgment(checked.overshoot)],
      ['Maximum settling ' + f(targets.settling) + ' s', 'Region is a guideline, not proof', judgment(assess(pair, targets).settling), judgment(checked.settling)],
    ];
    for (const row of rows) { const tr = document.createElement('tr'); for (const value of row) { const td = document.createElement('td'); td.textContent = value; tr.append(td); } body.append(tr); }
    table.append(body); q('.cf1-table').replaceChildren(table);
    q('.cf1-target-result').textContent = 'The pair is unchanged by the added factors. Standard formulas describe the pair; the full curve includes every chosen denominator mode and zero. Near-target differences within ' + f(full.tolerance) + ' s or ' + f(full.tolerance * 100) + ' percentage points remain not established.';
    const reasoning = q('.cf1-reasoning'); reasoning.replaceChildren();
    const equation = (latex: string, label: string) => reasoning.append(createEquationDisplay(latex, label));
    equation(String.raw`T_2(s)=${baseLatex(pair.response)},\quad\omega_n=\sqrt{${ln(pair.response.model.a0)}}=${ln(pair.response.naturalFrequency)},\quad\zeta=\frac{${ln(pair.response.model.a1)}}{2\omega_n}=${ln(pair.response.damping)}`, 'Pair model, natural frequency and damping');
    let factors = String.raw`T_{\mathrm{full}}(s)=T_2(s)`;
    if (full.response.model.pole !== undefined) { const p = ln(full.response.model.pole); factors += String.raw`\frac{${p}}{s+${p}}`; }
    if (full.response.model.zero !== undefined) { const z = full.response.model.zero; factors += String.raw`\left(1${z < 0 ? '-' : '+'}\frac{s}{${ln(Math.abs(z))}}\right)`; }
    equation(factors, 'Full chosen cascade with unchanged target pair');
    const poles = document.createElement('p'); poles.textContent = 'Retained full-model poles (s⁻¹): ' + full.response.poles.map(p => f(p.re) + (p.im === 0 ? '' : (p.im < 0 ? ' − j' : ' + j') + f(Math.abs(p.im)))).join('; ') + (full.response.model.zero === undefined ? '. No added zero.' : '. Added zero at ' + f(-full.response.model.zero) + ' s⁻¹.'); reasoning.append(poles);
    equation(String.raw`y_\infty=\frac{${ln(pair.response.model.g)}}{${ln(pair.response.model.a0)}}=${ln(full.response.finalValue)},\quad E_H=${ln(full.envelope)},\quad b=${ln(full.band / 100)}`, 'Final value and normalized future error envelope');
    const note = document.createElement('p'); note.textContent = full.settlingTime === undefined ? 'Settling is not established at this horizon. The future-envelope test has not established that all later values remain in the band. Extend H; the last plotted time is not a settling measurement.' : 'After the last detected band crossing, the future modal envelope at H fits inside the band. Refined settling measurement: ' + f(full.settlingTime) + ' s, under the stated conditioning/refinement checks.'; reasoning.append(note);
    const numerical = document.createElement('p'); numerical.textContent = 'Pair/full intervals=' + pair.intervals + '/' + full.intervals + '; refinement differences=' + f(pair.refinementChange) + '/' + f(full.refinementChange) + ', requested=' + f(full.tolerance) + '. ' + (full.noOvershoot ? 'A sufficient positivity or modal-dominance condition establishes zero positive overshoot; undershoot can still occur. ' : full.peakEstablished ? 'The detected overshoot peak exceeds the remaining future envelope. ' : 'Overshoot/peak remains a horizon-only measurement. ') + 'These checks do not provide interval-certified global extrema.'; reasoning.append(numerical);
  }


    function reveal() {
      if (equationDirty) { runIssue = 'Calculate or discard the original equation draft before revealing measurements.'; updateState(); return; }
      if (pending && !compute()) return;
      if (!result || runIssue || targetIssue || pairDirty) { status.textContent = 'Calculate valid current responses and requirements before revealing measurements.'; return; }
      revealed = true; renderAnswer(); renderTargetSteps(); renderResponse(); updateState();
    }
    function preset(kind: string) {
      if (drag) cancelDrag();
      clearTimer(); pending = false;
      if (kind === 'baseline') {
        field!.setValue('T(s)=\\frac{4}{s^2+2s+4}'); base = { g:4,a1:2,a0:4 }; equationDirty = pairDirty = false;
        input('overshoot').value = input('overshoot-range').value = '20'; input('settling').value = input('settling-range').value = '4'; input('horizon').value = '10'; select('band').value = '2'; select('rise').value = '10-90'; select('tolerance').value = '.0001'; input('include-pole').checked = input('include-zero').checked = false; input('pole').value = input('zero').value = '1'; currentTime = 5; input('time').value = input('time-range').value = '5'; timeIssue = '';
      } else if (kind === 'slow') { input('include-pole').checked = true; input('pole').value = '.2'; }
      else if (kind === 'zero') { input('include-zero').checked = true; input('zero').value = '-1'; }
      else { input('include-pole').checked = input('include-zero').checked = false; }
      select('prediction').value = ''; compute(kind === 'baseline');
    }
    const savedNames = ['damping', 'frequency', 'pole', 'zero', 'time'] as const;
    function save(): Saved { return { base, result: result!, latex: field!.getValue().latex, values: savedNames.map(name => input(name).value), time: currentTime, window: window!, revealed }; }
    function cancelDrag() {
      clearTimer(); const old = drag; if (!old) return; drag = undefined; pending = false;
      base = old.saved.base; result = old.saved.result; window = old.saved.window; currentTime = old.saved.time; revealed = old.saved.revealed; field!.setValue(old.saved.latex);
      savedNames.forEach((name, i) => { input(name).value = old.saved.values[i]; }); pairDirty = equationDirty = false; runIssue = '';
      input('damping-range').value = input('damping').value; input('frequency-range').value = input('frequency').value; input('time-range').value = String(currentTime);
      if (revealed) { renderAnswer(); renderTargetSteps(); } else answer.hidden = true;
      renderResponse(); renderPole(); updateState(); releaseCapture(old.host, old.id); status.textContent = 'Drag cancelled. The complete previous checked model and selection are restored.';
    }
    function moveHandle(kind: Handle, real: number, imaginary: number) {
      try {
        if (kind.startsWith('pair-')) {
          const candidate = draggedPair(drag?.saved.base ?? base, real, imaginary), response = buildResponse(candidate.model);
          input('damping').value = input('damping-range').value = String(response.damping); input('frequency').value = input('frequency-range').value = String(response.naturalFrequency); pairDirty = true;
        } else if (kind === 'pole') {
          if (!Number.isFinite(real) || real > -.02 || real < -50) throw new Error('Keep the added pole on the real axis at −p, with p=.02–50 s⁻¹.');
          input('pole').value = String(-real);
        } else {
          const zero = -real; if (!Number.isFinite(zero) || Math.abs(zero) < .02 || Math.abs(zero) > 50) throw new Error('Keep the real zero outside the forbidden |z|<.02 gap and within |z|≤50. No zero is rounded or moved across the gap.');
          const previous = drag?.saved.result.full.response.model.zero ?? result!.full.response.model.zero!;
          if (zero * previous < 0) throw new Error('A zero drag stays on its current side of the forbidden gap. Use the numeric control for an explicit LHP/RHP change.');
          input('zero').value = String(zero);
        }
        runIssue = ''; queue();
      } catch (error) { clearTimer(); pending = false; runIssue = error instanceof Error ? error.message : 'This handle position is unsupported.'; updateState(); }
    }
    for (const host of [responseHost, poleHost]) {
      host.addEventListener('pointerdown', event => {
        if (drag || event.button !== 0 || !result || !window || pending || equationDirty || pairDirty || runIssue || targetIssue || timeIssue) return;
        const kind = host === responseHost ? (event.target as Element).closest('svg') ? 'time' : undefined : (event.target as Element).closest<HTMLElement>('[data-handle]')?.dataset.handle as Handle | undefined;
        if (!kind) return; if(kind!=='time')activeHandle=kind; drag = { id:event.pointerId, kind, host, saved:save() }; event.preventDefault(); host.focus({ preventScroll:true }); try { host.setPointerCapture?.(event.pointerId); } catch { /* Cancel/keyboard controls remain available. */ } updateState();
        if (kind === 'time') { const time = responseDrawing?.fromEvent(event.clientX); if (time !== undefined) { input('time').value = String(time); inspect(); } }
      }, { signal });
      host.addEventListener('pointermove', event => {
        if (!drag || drag.id !== event.pointerId || drag.host !== host) return;
        if (drag.kind === 'time') { const time = responseDrawing?.fromEvent(event.clientX); if (time !== undefined) { input('time').value = String(time); inspect(); } }
        else { const point = poleDrawing?.fromEvent(event.clientX, event.clientY); if (point) moveHandle(drag.kind, point.re, point.im); }
      }, { signal });
      host.addEventListener('pointerup', event => { if (!drag || drag.id !== event.pointerId || drag.host !== host) return; const old = drag; if (pending) compute(); drag = undefined; releaseCapture(old.host, old.id); updateState(); }, { signal });
      const cancelPointer = (event: PointerEvent) => { if (drag?.id === event.pointerId && drag.host === host) cancelDrag(); };
      host.addEventListener('pointercancel', cancelPointer, { signal }); host.addEventListener('lostpointercapture', cancelPointer, { signal });
    }
    responseHost.tabIndex = 0;
    poleHost.addEventListener('focusin', event => { const handle = (event.target as Element).closest<HTMLElement>('[data-handle]'); if (handle) activeHandle = handle.dataset.handle as Handle; }, { signal });
    poleHost.addEventListener('keydown', event => {
      const handle = (event.target as Element).closest<HTMLElement>('[data-handle]')?.dataset.handle as Handle | undefined ?? (event.target === poleHost ? activeHandle : undefined);
      if (!handle || drag || !result || equationDirty || runIssue || targetIssue || !['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)) return;
      event.preventDefault(); event.stopPropagation(); activeHandle = handle; poleHost.focus({ preventScroll:true });
      try {
      const step = event.shiftKey ? .1 : .01, pairResponse = pairDirty ? buildResponse(editedPair(base,read('damping'),read('frequency')).model) : result.full.response;
      const p = handle.startsWith('pair-') ? pairResponse.poles.find(p => handle === 'pair-upper' ? p.im > 0 : p.im < 0) : { re: -read(handle === 'pole' ? 'pole' : 'zero'), im:0 };
      if(!p)return;
      moveHandle(handle, p.re + (event.key === 'ArrowRight' ? step : event.key === 'ArrowLeft' ? -step : 0), p.im + (event.key === 'ArrowUp' ? step : event.key === 'ArrowDown' ? -step : 0));
      } catch(error) { runIssue=error instanceof Error?error.message:'Complete the pair or factor controls before moving the handle.';updateState(); }
    }, { signal });
    globalThis.addEventListener('keydown', event => { if (event.key === 'Escape' && drag) { event.preventDefault(); event.stopImmediatePropagation(); cancelDrag(); } }, { capture:true, signal });
    globalThis.addEventListener('blur', () => { if (drag) cancelDrag(); }, { signal });
    for (const name of ['damping', 'frequency']) on(input(name), 'input', () => { pairDirty = true; queue(); });
    for (const name of ['pole','zero','horizon']) on(input(name), 'input', queue);
    for (const name of ['include-pole','include-zero']) on(input(name), 'change', () => { updateState(); queue(); });
    for (const name of ['band','rise','tolerance']) on(select(name), 'change', queue);
    for (const name of ['overshoot','settling']) on(input(name), 'input', changeTargets);
    on(input('time'), 'input', inspect);
    measureActions.addEventListener('click',event=>{const button=(event.target as Element).closest<HTMLButtonElement>('[data-measure-time]');if(!button||!revealed||pending||drag||!result)return;input('time').value=button.dataset.measureTime!;inspect();},{signal});
    const ranges = [['damping',.01],['frequency',.05],['overshoot',1],['settling',.1],['time',.01]] as const;
    for (const [name, step] of ranges) {
      const range = input(name + '-range'), change = () => { input(name).value = range.value; if (name === 'time') inspect(); else if (name === 'overshoot' || name === 'settling') changeTargets(); else { pairDirty = true; queue(); } };
      on(range,'input',change);
      range.addEventListener('keydown', event => { if (!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End','PageUp','PageDown'].includes(event.key)) return; event.preventDefault(); event.stopPropagation(); const decrease = ['ArrowLeft','ArrowDown','PageDown'].includes(event.key), delta = name === 'time' ? (result?.full.horizon ?? 10) / 1000 : step, amount = delta * (event.shiftKey || event.key.startsWith('Page') ? 10 : 1); range.value = String(event.key === 'Home' ? Number(range.min) : event.key === 'End' ? Number(range.max) : Math.max(Number(range.min), Math.min(Number(range.max), Number(range.value) + (decrease ? -amount : amount)))); change(); }, { signal });
    }
    for (const type of ['input','change']) on(select('prediction'),type,() => { q('.cf1-feedback').textContent = revealed ? 'Prediction edited. Check again; the displayed measurements remain valid.' : 'Prediction edited. Reveal measurements to check it.'; });
    root.querySelectorAll<HTMLButtonElement>('[data-action]').forEach(button => on(button,'click',() => {
      const action = button.dataset.action;
      if (action === 'compute') compute(true);
      else if (action === 'reveal') reveal();
      else if (action === 'cancel') cancelDrag();
      else if (action === 'fit') { if (result && !drag) { window = fitPoles(result.full,result.targets); renderPole(); status.textContent = 'Pole axes fitted to the checked model and current guideline. Unapplied input drafts were preserved.'; updateState(); } }
      else if (action === 'discard') { field!.setValue(pairEquation(base)); equationDirty = false; updateState(); status.textContent = 'Restored the checked original equation.'; }
      else preset(action!);
    }));
    compute(true); return cleanup;
  } catch (error) { cleanup(); throw error; }
};
