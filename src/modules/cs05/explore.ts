import type { ModuleMount } from '../../core/module';
import { createEquationDisplay, createEquationInput, type EquationInput } from '../../shared/equations/input';
import { readNumericInput } from '../../shared/numeric-input';
import { decimal, latexR, numeric, polynomialLatex, type Poly } from './exact';
import { parsePolynomial } from './expression';
import { characteristic, cutLatex, cutNumber, gainPolynomialLatex, intervalLatex, isStable, locus, numericRoots, rationalCut, signAt, solveRegions, type Cut, type Region, type Root } from './gains';
import { fitWindow, formatLatex, formatNumber as f, gainStrip, rootPlane, type Plane, type PlaneWindow, type Strip } from './plots';
import { cursorGain, nativeGain } from './selection';

interface Checked { readonly region: Region; readonly samples: ReturnType<typeof locus>; readonly maximum: number }
interface Selection { readonly gain: Cut; readonly source: 'manual' | 'fraction' | 'cursor' | 'endpoint' }
interface Drag { readonly pointer: number; readonly saved: Selection; readonly endpoint?: number; value: number; moved: boolean }
const presets = [
  ['Course cubic', '1', 's(s+2)(s+5)'], ['Changed cubic', '1', 's^3+6s^2+8s'],
  ['Two stable ranges', 's^2+s+6', 's^3+s^2+s-2'], ['Irrational boundaries', 's^2+s+6', 's^3+s^2+s-1'], ['Stable from zero', '-s', 's^2+2s+1'],
] as const;
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, text = '', className = ''): HTMLElementTagNameMap[K] => { const n = document.createElement(tag); n.textContent = text; if (className) n.className = className; return n; };
const baseline = (): Checked => { const region = solveRegions(parsePolynomial('1', true), parsePolynomial('s(s+2)(s+5)')); return { region, samples: locus(region.model, 100), maximum: 100 }; };

export const mountExplore: ModuleMount = ({ container, signal: parentSignal }) => {
  if (parentSignal.aborted) return;
  const life = new AbortController(), signal = life.signal, forward = () => life.abort(); parentSignal.addEventListener('abort', forward, { once: true });
  const root = el('div', '', 'cs05-tool cs05-explore'); container.append(root);
  const editors: EquationInput[] = []; let disposed = false, frame: number | undefined, observer: ResizeObserver | undefined;
  let checked = baseline(), selected: Selection = { gain: rationalCut(decimal('20')), source: 'manual' }, viewWindow = fitWindow(checked.samples), draftDirty = false;
  let strip: Strip, plane: Plane, drag: Drag | undefined, measuredWidth: number | undefined, currentPlaneRoots: Root[] = [], fractionDirty = false;
  const layout = el('div', '', 'cs05-explore-layout'), visual = el('section', '', 'cs05-card cs05-visual'), inspector = el('section', '', 'cs05-card cs05-inspector'); layout.append(visual, inspector); root.append(layout);
  visual.append(el('p', 'Negative unity feedback · 1 + K N(s)/D(s) = 0 · K ≥ 0', 'cs05-note'));
  function number(label: string, value: string) { const wrap = el('label', label, 'cs05-field'), input = el('input'); input.type = 'number'; input.step = 'any'; input.value = value; input.setAttribute('aria-label', label); wrap.append(input); return { wrap, input }; }
  function button(label: string, action: () => void, host: HTMLElement) { const n = el('button', label); n.type = 'button'; n.addEventListener('click', action, { signal }); host.append(n); return n; }
  const gain = number('Numeric gain K', '20'), range = el('input'); range.type = 'range'; range.min = '0'; range.max = '100'; range.step = '.1'; range.value = '20'; range.setAttribute('aria-label', 'Live gain cursor');
  const rangeLabel = el('label', 'Move the gain', 'cs05-field'); rangeLabel.append(range); const controls = el('div', '', 'cs05-grid'); controls.append(gain.wrap, rangeLabel); visual.append(controls);
  const state = el('p', 'Checked model', 'cs05-model-state'), stripHost = el('div', '', 'cs05-interactive-strip'), planeHost = el('div', '', 'cs05-responsive-plane'); stripHost.tabIndex = 0; stripHost.setAttribute('role', 'region'); stripHost.setAttribute('aria-label', 'Scrub the stable gain strip; arrow keys adjust gain');
  visual.append(state, stripHost, planeHost);
  const actions = el('div', '', 'cs05-actions'), chartNote = el('p', '', 'cs05-note'); visual.append(actions, chartNote);
  const fit = button('Fit selected roots', () => { if (!ready()) return; try { paint(selected, checked, fitWindow(checked.samples, currentPlaneRoots)); message.textContent = `Equal-scale axes fitted to the finite trace and selected roots. They stay fixed while the gain changes.${fractionDirty ? ' The unapplied rational gain draft is preserved; the diagram still shows the checked gain.' : ''}`; } catch (e) { fail(e); } }, actions);
  const cancel = button('Cancel gain drag', () => cancelDrag(), actions); cancel.disabled = true;
  const message = el('p', 'Move the gain or choose an exact endpoint. The interval set comes from exact inequalities.', 'cs05-feedback'); message.setAttribute('role', 'status'); root.append(message);
  const verdict = el('div', '', 'cs05-verdict'), exactSet = el('div'), rootsHost = el('div'), endpointHost = el('div', '', 'cs05-endpoints'), modelHost = el('div');
  inspector.append(verdict, exactSet, rootsHost, el('h3', 'Exact endpoints'), endpointHost);
  const modelDetails = el('details', '', 'cs05-card'), modelFields = el('div', '', 'cs05-grid'); modelDetails.append(el('summary', 'Edit the model and exact gain'), modelFields); root.append(modelDetails);
  const invalidate = () => { cancelDrag(false); draftDirty = true; state.textContent = 'Model draft changed · diagram shows the last checked model'; message.textContent = 'Apply or discard the model draft before exploring another gain. The previous exact set belongs to the checked equation.'; setEnabled(); };
  const equationOptions = { tools: ['fraction', 'power', 'parentheses'] as const, description: 'Real polynomial in s; divide only by numbers. The fixed denominator has degree 1–3 and the numerator has lower degree.' };
  const n = createEquationInput({ ...equationOptions, label: 'Fixed numerator N(s)', value: '1', signal, onChange: invalidate }); editors.push(n);
  const d = createEquationInput({ ...equationOptions, label: 'Fixed denominator D(s)', value: 's(s+2)(s+5)', signal, onChange: invalidate }); editors.push(d); modelFields.append(n.element, d.element);
  const modelActions = el('div', '', 'cs05-actions'); modelDetails.append(modelActions);
  const parse = (input: EquationInput, label: string, allowZero = false): Poly => { const draft = input.getValue(); if (draft.empty || draft.hasPlaceholders || draft.syntaxIssues.length) throw new Error(`Complete ${label} in the visual equation editor.`); return parsePolynomial(draft.latex, allowZero); };
  button('Apply model', () => { try { const region = solveRegions(parse(n, 'N(s)', true), parse(d, 'D(s)')); publish({ region, samples: locus(region.model, checked.maximum), maximum: checked.maximum }); } catch (e) { fail(e, true); } }, modelActions);
  button('Discard model draft', () => { syncModel(); draftDirty = false; setEnabled(); paint(selected); message.textContent = 'Restored the checked model.'; }, modelActions);
  const presetActions = el('div', '', 'cs05-actions'); modelDetails.append(presetActions);
  for (const [name, numerator, denominator] of presets) button(name, () => { try { const region = solveRegions(parsePolynomial(numerator, true), parsePolynomial(denominator)); publish({ region, samples: locus(region.model, 100), maximum: 100 }, { gain: rationalCut(decimal('20')), source: 'manual' }); } catch (e) { fail(e); } }, presetActions);
  modelDetails.append(modelHost);
  const fractionGain = createEquationInput({ label: 'Exact rational gain K', value: '20', tools: ['fraction', 'power', 'parentheses'], description: 'Enter a nonnegative rational constant from 0 to 10,000. Computed endpoint buttons retain exact square-root identities separately.', signal, onChange: () => { fractionDirty = true; state.textContent = 'Gain draft changed · diagram shows the last checked gain'; message.textContent = 'Apply the rational gain draft, or move the primary gain control to replace it.'; } }); editors.push(fractionGain); modelDetails.append(fractionGain.element);
  button('Apply rational gain', () => { if (!ready()) return; try { if (!fractionDirty && selected.source === 'endpoint') { paint(selected); return; } const p = parse(fractionGain, 'the rational gain', true); if (p.length !== 1 || p[0].n < 0n || numeric(p[0]) > 10000) throw new Error('Enter a rational gain from 0 to 10,000.'); applySelection({ gain: rationalCut(p[0]), source: 'fraction' }); } catch (e) { fail(e); } }, modelDetails);
  const viewDetails = el('details', '', 'cs05-card'), maximum = number('Locus maximum gain', '100'); viewDetails.append(el('summary', 'Adjust the displayed gain range'), maximum.wrap); root.append(viewDetails);
  button('Apply view range', () => { if (!ready()) return; try { const max = readNumericInput(maximum.input, 'Locus maximum gain'); if (max < .001 || max > 10000) throw new Error('Locus maximum gain must be from 0.001 to 10,000.'); const next = { ...checked, maximum: max, samples: locus(checked.region.model, max) }; publish(next, selected, false); message.textContent = `Finite curve range updated. The complete exact region and endpoint selection were retained.${fractionDirty ? ' The unapplied rational gain draft is preserved; the diagram still shows the checked gain.' : ''}`; } catch (e) { fail(e); } }, viewDetails);
  const depth = el('details', '', 'cs05-card'), reasoning = el('div'); depth.append(el('summary', 'Why these are all stable gains'), reasoning); root.append(depth);
  const limits = el('details', '', 'cs05-card'); limits.append(el('summary', 'Conventions and supported limits'), el('p', 'Exact rational Routh/Hurwitz inequalities classify all K≥0 for strictly proper real N/D with denominator degree 1–3, including negative or zero N. Original modes in D+KN are retained without cancellation. Multiple stable intervals, an included K=0 and unbounded tails remain distinct. A finite locus or one root never proves the complete gain set.'), el('p', 'Polynomial entry: 600 characters, 240 symbols, 24 groups, at most 15 digits per decimal; primitive integer height ≤10,000, normalized coefficients ≤10⁶, 60-digit exact arithmetic and 64 interval bisections. Manual rational gain is 0–10,000; exact computed endpoints can reach 10¹². Native numeric fields accept exponent notation; visual fields use textbook notation.'), el('p', 'The curve uses 241 gain samples with full-list displacement matching. Numerical roots need residual ≤10⁻⁹ and coefficient reconstruction within 10⁻⁷. Failed samples remain gaps; exact gain inequalities remain authoritative. Cursor entry uses at most 12 significant digits within the existing 10⁻¹⁵ decimal scale; it never turns a tiny nonzero gain into zero. No time response, saved state or cross-module transfer is used.')); root.append(limits);

  function ready(): boolean { if (draftDirty) { message.textContent = 'Apply or discard the model draft first; the plot belongs to the checked model.'; return false; } return true; }
  function fail(error: unknown, modelDraft = false): void { if (modelDraft) draftDirty = true; state.textContent = draftDirty ? 'Unapplied model draft · last checked model shown' : 'Change rejected · last checked gain/model shown'; message.textContent = `${error instanceof Error ? error.message : 'This change could not be checked.'} The last checked result is retained.`; setEnabled(); }
  function setEnabled(): void { gain.input.disabled = range.disabled = draftDirty || !!drag; fit.disabled = draftDirty || !!drag; cancel.disabled = !drag; endpointHost.querySelectorAll<HTMLButtonElement>('button').forEach(b => { b.disabled = draftDirty || !!drag; }); }
  function syncModel(): void { n.setValue(polynomialLatex(checked.region.model.n)); d.setValue(polynomialLatex(checked.region.model.d)); maximum.input.value = String(checked.maximum); }
  function renderState(): void { state.textContent = draftDirty ? 'Model draft changed · last checked model shown' : fractionDirty ? 'Gain draft changed · diagram shows the last checked gain' : drag ? 'Gain drag preview · Escape cancels' : 'Checked model'; }
  function syncGain(preserveDraft = false): void { const pending = preserveDraft && fractionDirty ? fractionGain.getValue().latex : undefined; gain.input.value = String(cutNumber(selected.gain)); range.max = String(checked.maximum); range.step = String(checked.maximum / 1000); range.value = String(Math.min(checked.maximum, cutNumber(selected.gain))); fractionGain.setValue(pending ?? cutLatex(selected.gain)); fractionDirty = pending !== undefined; renderState(); }
  function paint(selection: Selection, model = checked, planeWindow: PlaneWindow = viewWindow): void {
    const k = selection.gain, stable = isStable(model.region, k), coefficients = characteristic(model.region.model, k); let selectedRoots: Root[] = [], rootIssue: string | undefined;
    try { selectedRoots = numericRoots(coefficients); } catch (e) { rootIssue = e instanceof Error ? e.message : 'Numerical root coordinates are unresolved.'; }
    const nextPlane = rootPlane(model.samples, selectedRoots, planeWindow), nextStrip = gainStrip(model.region, model.maximum, k), width = measuredWidth ?? (planeHost.getBoundingClientRect().width || 440); nextPlane.resize(width); nextStrip.resize(width);
    const nextVerdict = el('div'), nextRoots = el('div'); nextVerdict.append(createEquationDisplay(`K=${cutLatex(k)}`, 'Selected exact gain'), el('p', stable ? 'Strictly stable · every exact inequality is positive' : 'Not strictly stable · an exact inequality is zero or negative', 'cs05-stability-verdict'), el('p', selection.source === 'endpoint' ? model.region.cuts.includes(k) ? 'Exact endpoint identity retained. Its decimal position and root coordinates are approximations.' : 'Exact algebraic gain retained from the earlier model. Stability is checked against the current model; decimal positions and roots are approximations.' : 'Exact rational gain. Root coordinates and the finite curve are numerical approximations.', 'cs05-note'));
    const failed = model.region.conditions.filter(condition => signAt(condition.polynomial, k) <= 0); if (failed.length) nextVerdict.append(el('p', `Nonpositive exact conditions: ${failed.map(condition => condition.name).join('; ')}.`, 'cs05-note'));
    const polynomial = coefficients.map((value, i) => value === 0 ? '' : `${value < 0 ? '-' : '+'}${i && Math.abs(value) === 1 ? '' : formatLatex(Math.abs(value))}${i ? i === 1 ? 's' : `s^{${i}}` : ''}`).reverse().join('').replace(/^\+/, '') || '0';
    nextRoots.append(createEquationDisplay(`P_K(s)\\approx${polynomial}`, 'Complete selected characteristic polynomial'), el('h3', 'Every characteristic root'));
    if (rootIssue) nextRoots.append(el('p', rootIssue, 'cs05-warning'));
    else { const list = el('ul'); selectedRoots.forEach((value, i) => list.append(el('li', `${i + 1}: ${f(value.re)} ${value.im < 0 ? '−' : '+'} j${f(Math.abs(value.im))} · residual ${f(value.residual)}`))); nextRoots.append(list); }
    const nextExact = createEquationDisplay(`K\\in${model.region.intervals.length ? model.region.intervals.map(intervalLatex).join('\\cup') : '\\varnothing'}`, 'Complete exact stable gain set');
    // Publish only after the complete readout and both diagrams have been constructed successfully.
    checked = model; selected = selection; viewWindow = planeWindow; plane = nextPlane; strip = nextStrip; currentPlaneRoots = selectedRoots;
    planeHost.replaceChildren(plane.element); stripHost.replaceChildren(strip.element); verdict.replaceChildren(...nextVerdict.childNodes); rootsHost.replaceChildren(...nextRoots.childNodes); exactSet.replaceChildren(el('h3', 'Complete exact stable gain set'), nextExact);
    const failures = model.samples.filter(s => s.error).length;
    chartNote.textContent = `Shading: strict stability. Open endpoint circles are excluded; a filled zero endpoint is included. Crosses mark every selected root; axes keep equal fixed scales. ${failures ? `${failures} numerically unresolved curve samples are gaps. ` : ''}${nextPlane.clipped ? 'Some selected roots are outside this view; all remain listed. Use Fit selected roots. ' : ''}${cutNumber(k) > model.maximum ? 'Selected exact gain is beyond the finite curve range. ' : ''}The exact set is not derived from these samples.`;
    renderState();
  }
  function prepareDepth(model: Checked) {
    const region = model.region, nextReasoning = el('div'), nextModel = el('div'), nextEndpoints = el('div'); nextReasoning.append(createEquationDisplay(`P_K(s)=(${polynomialLatex(region.model.d)})+K(${polynomialLatex(region.model.n)})`, 'Normalized full characteristic family'));
    for (const condition of region.conditions) nextReasoning.append(createEquationDisplay(`${gainPolynomialLatex(condition.polynomial)}>0`, condition.name));
    region.intervals.forEach((interval, i) => nextReasoning.append(createEquationDisplay(`K_{test,${i + 1}}=${latexR(interval.test)}`, 'Exact interior sign-check gain')));
    nextModel.append(createEquationDisplay(`L_0(s)=\\frac{${polynomialLatex(region.model.n)}}{${polynomialLatex(region.model.d)}}`, 'Checked fixed loop model'));
    region.cuts.forEach((cut, i) => { const row = el('div', '', 'cs05-boundary'), pick = el('button', `Select endpoint ${i + 1}`); pick.type = 'button'; pick.dataset.exactEndpoint = String(i); row.append(createEquationDisplay(`K=${cutLatex(cut)}`, 'Exact gain endpoint'), pick); nextEndpoints.append(row); });
    return { reasoning: nextReasoning, model: nextModel, endpoints: nextEndpoints };
  }
  function renderDepth(next = prepareDepth(checked)): void { reasoning.replaceChildren(...next.reasoning.childNodes); modelHost.replaceChildren(...next.model.childNodes); endpointHost.replaceChildren(...next.endpoints.childNodes); setEnabled(); }
  endpointHost.addEventListener('click', event => { const target = (event.target as Element).closest<HTMLButtonElement>('[data-exact-endpoint]'); if (!target || !ready()) return; try { const gain = checked.region.cuts[Number(target.dataset.exactEndpoint)]; if (!gain) return; applySelection({ gain, source: 'endpoint' }); message.textContent = 'Selected the exact endpoint, without substituting its rounded decimal position.'; } catch (e) { fail(e); } }, { signal });
  function publish(next: Checked, nextSelection: Selection = selected, resetRange = true): void {
    cancelDrag(false); const old = checked, oldSelection = selected, oldWindow = viewWindow, dirty = draftDirty;
    try { const nextDepth = prepareDepth(next); draftDirty = false; paint(nextSelection, next, resetRange ? fitWindow(next.samples) : viewWindow); syncModel(); syncGain(!resetRange); renderDepth(nextDepth); message.textContent = 'Checked model applied. The exact full gain set and numerical locus now match it. Model application replaces an unapplied gain draft with the retained checked gain.'; }
    catch (e) { checked = old; selected = oldSelection; viewWindow = oldWindow; draftDirty = dirty; paint(oldSelection); throw e; }
  }
  function applySelection(next: Selection): void { if (!ready()) return; paint(next); syncGain(); message.textContent = next.source === 'endpoint' ? 'Exact endpoint selected.' : 'Selected gain updated. The cached exact region and finite trace were reused.'; }
  gain.input.addEventListener('input', () => { if (!ready()) return; try { readNumericInput(gain.input, 'Numeric gain K'); applySelection({ gain: nativeGain(gain.input.value), source: 'manual' }); } catch (e) { fail(e); } }, { signal });
  range.addEventListener('input', () => { if (!ready()) return; try { applySelection({ gain: cursorGain(readNumericInput(range, 'Gain cursor')), source: 'cursor' }); } catch (e) { fail(e); } }, { signal });
  function clearFrame(): void { if (frame !== undefined) { cancelAnimationFrame(frame); frame = undefined; } }
  function cancelDrag(announce = true): void { clearFrame(); const previous = drag; drag = undefined; if (!previous) return; if (stripHost.hasPointerCapture?.(previous.pointer)) stripHost.releasePointerCapture(previous.pointer); paint(previous.saved); syncGain(); setEnabled(); if (announce) message.textContent = 'Gain drag cancelled. The exact previous selection is restored.'; }
  function queueGain(): void { if (frame !== undefined) return; frame = requestAnimationFrame(() => { frame = undefined; if (!drag || disposed || signal.aborted) return; try { applySelection({ gain: cursorGain(drag.value), source: 'cursor' }); } catch (e) { fail(e); } }); }
  stripHost.addEventListener('pointerdown', event => { if (drag || event.button !== 0 || !ready()) return; const value = strip.fromEvent(event); if (value === undefined) return; const target = event.target as Element, mark = target.closest<SVGElement>('[data-endpoint]'), selectedEndpoint = target.closest('.cs05-gain-handle') && selected.source === 'endpoint' ? checked.region.cuts.indexOf(selected.gain) : -1;
    const endpoint = mark ? Number(mark.dataset.endpoint) : selectedEndpoint >= 0 ? selectedEndpoint : undefined;
    drag = { pointer: event.pointerId, saved: selected, value, moved: false, endpoint }; stripHost.setPointerCapture?.(event.pointerId); event.preventDefault(); stripHost.focus({ preventScroll: true }); setEnabled(); if (endpoint === undefined) queueGain(); }, { signal });
  stripHost.addEventListener('pointermove', event => { if (!drag || event.pointerId !== drag.pointer) return; const value = strip.fromEvent(event); if (value !== undefined) { drag.value = value; drag.moved = true; queueGain(); } }, { signal });
  stripHost.addEventListener('pointerup', event => { if (!drag || event.pointerId !== drag.pointer) return; const previous = drag; clearFrame(); drag = undefined; if (stripHost.hasPointerCapture?.(previous.pointer)) stripHost.releasePointerCapture(previous.pointer); try { applySelection(previous.endpoint !== undefined && !previous.moved ? { gain: checked.region.cuts[previous.endpoint], source: 'endpoint' } : { gain: cursorGain(previous.value), source: 'cursor' }); } catch (e) { paint(previous.saved); fail(e); } setEnabled(); }, { signal });
  const cancelPointer = (event: PointerEvent) => { if (drag?.pointer === event.pointerId) cancelDrag(); };
  stripHost.addEventListener('pointercancel', cancelPointer, { signal }); stripHost.addEventListener('lostpointercapture', cancelPointer, { signal });
  stripHost.addEventListener('keydown', event => { if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key) || !ready()) return; event.preventDefault(); event.stopPropagation(); const step = checked.maximum / 1000 * (event.shiftKey ? 10 : 1), value = event.key === 'Home' ? 0 : event.key === 'End' ? checked.maximum : Math.max(0, Math.min(checked.maximum, cutNumber(selected.gain) + (event.key === 'ArrowLeft' ? -step : step))); try { applySelection({ gain: cursorGain(value), source: 'cursor' }); } catch (e) { fail(e); } }, { signal });
  const escape = (event: KeyboardEvent) => { if (event.key === 'Escape' && drag) { event.preventDefault(); event.stopPropagation(); cancelDrag(); } }, blur = () => { if (drag) cancelDrag(); };
  window.addEventListener('keydown', escape, { capture: true, signal }); window.addEventListener('blur', blur, { signal }); container.addEventListener('cs05-suspend', () => cancelDrag(), { signal });
  function cleanup(): void { if (disposed) return; disposed = true; clearFrame(); observer?.disconnect(); const previous = drag; drag = undefined; if (previous && stripHost.hasPointerCapture?.(previous.pointer)) stripHost.releasePointerCapture(previous.pointer); parentSignal.removeEventListener('abort', forward); life.abort(); editors.forEach(editor => editor.destroy()); root.remove(); }
  signal.addEventListener('abort', cleanup, { once: true });
  try {
    syncModel(); paint(selected); syncGain(); renderDepth();
    if (typeof ResizeObserver !== 'undefined') { observer = new ResizeObserver(entries => { if (disposed || signal.aborted) return; const width = entries[0]?.contentRect.width; if (!width || width <= 0 || Math.abs(width - (measuredWidth ?? 0)) < .5) return; measuredWidth = width; if (drag) cancelDrag(); plane.resize(width); strip.resize(width); }); observer.observe(planeHost); }
    return cleanup;
  } catch (e) { cleanup(); throw e; }
};
