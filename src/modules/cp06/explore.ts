import type { ModuleMount } from '../../core/module';
import { createEquationDisplay, createEquationInput, type EquationInput } from '../../shared/equations/input';
import { readNumericInput } from '../../shared/numeric-input';
import { c, type Complex } from './complex';
import { trace, type Trace } from './continuation';
import { addFactor, additionLimit, editableFactors, factorLabel, moveFactor, removeFactor, snapCoordinate, type EditFactor } from './editing';
import { fraction, numeric, polynomial } from './format';
import { baseline, candidate, characteristic, gainValue, parseModel, type Model } from './model';
import { plane, type Plane, type PlaneWindow, type Reveals } from './plot';
import { degree } from './polynomial';
import { toNumber, type Rational } from './rational';
import { roots, type Root } from './roots';
import { rules, type RuleSet } from './rules';

interface Snapshot { readonly model: Model; readonly gain: Rational; readonly maximum: number }
interface Computed extends Snapshot { readonly construction: RuleSet; readonly sampled: Trace; readonly selected: readonly Root[]; readonly issue?: string; readonly factors: readonly EditFactor[] }
interface Drag { readonly pointer: number; readonly id: string; readonly pair: boolean; re: number; im: number; moved: boolean }
const equationEntry = { tools: ['fraction', 'power', 'parentheses'] as const,
  description: 'Enter a real polynomial in s with fractions, visible parentheses and integer powers from 0 to 3.' };
function el<K extends keyof HTMLElementTagNameMap>(tag: K, text = '', className = ''): HTMLElementTagNameMap[K] { const n = document.createElement(tag); n.textContent = text; if (className) n.className = className; return n; }
const pointText = (p: Complex): string => `${numeric(p.re)}${p.im ? ` ${p.im < 0 ? '−' : '+'} j${numeric(Math.abs(p.im))}` : ''}`;
function selectedRoots(model: Model, gain: Rational): { selected: Root[]; issue?: string } {
  try { return { selected: roots(characteristic(model, gain)), issue: undefined }; }
  catch (error) { return { selected: [], issue: error instanceof Error ? error.message : 'Selected roots could not be resolved.' }; }
}
function compute(snapshot: Snapshot, preview = false): Computed {
  return { ...snapshot, construction: rules(snapshot.model), sampled: trace(snapshot.model, snapshot.maximum, preview ? 16 : 64, preview ? 129 : 2049), factors: editableFactors(snapshot.model), ...selectedRoots(snapshot.model, snapshot.gain) };
}

export const mountExplore: ModuleMount = ({ container, signal }) => {
  if (signal.aborted) return;
  const root = el('div', '', 'cp-explore'); container.append(root);
  const editors: EquationInput[] = []; let disposed = false, timer: ReturnType<typeof setTimeout> | undefined, drag: Drag | undefined;
  let observer: ResizeObserver | undefined, measuredWidth: number | undefined;
  let current = compute({ model: baseline(), gain: gainValue('70'), maximum: 140 }), shown = current;
  let viewWindow: PlaneWindow | undefined, currentPlane: Plane, selectedId = 'pole-0', draftDirty = false, suppressClick = false, testedPoint = c(0, Math.sqrt(10));
  const history: Snapshot[] = [];
  const status = el('p', 'Drag a pole or zero, or move the gain to see every closed-loop root change.', 'cp-feedback'); status.setAttribute('role', 'status');
  const overview = el('section', '', 'cp-card cp-explore-head'); overview.append(el('h3', 'Change a pole or zero and watch the locus'), el('p', 'Negative unity feedback: 1 + K L₀(s) = 0. The finite trace is a numerical illustration; every full characteristic root is checked at the selected gain.', 'cp-note'));
  const equation = el('div'), badge = el('p', 'Checked model', 'cp-model-state'); overview.append(equation, badge); root.append(overview);
  const split = el('div', '', 'cp-explore-layout'), visual = el('section', '', 'cp-card cp-explore-visual'), inspector = el('section', '', 'cp-card cp-inspector'); split.append(visual, inspector); root.append(split);
  const controls = el('div', '', 'cp-controls');
  function number(label: string, value: number, min: number, max: number) { const wrap = el('label', label), input = el('input'); input.type = 'number'; input.step = 'any'; input.value = String(value); input.min = String(min); input.max = String(max); input.setAttribute('aria-label', label); wrap.append(input); return { wrap, input }; }
  function button(label: string, action: () => void, host: HTMLElement) { const b = el('button', label); b.type = 'button'; b.addEventListener('click', action, { signal }); host.append(b); return b; }
  const gain = number('Selected gain K or Kp', 70, 0, 1000), slider = el('input'); slider.type = 'range'; slider.min = '0'; slider.max = '140'; slider.step = 'any'; slider.value = '70'; slider.setAttribute('aria-label', 'Live gain cursor');
  const sliderLabel = el('label', 'Move the gain'); sliderLabel.append(slider); controls.append(gain.wrap, sliderLabel); visual.append(controls);
  const plotHost = el('div', '', 'cp-plane-region cp-interactive-plane'); plotHost.tabIndex = 0; plotHost.setAttribute('role', 'region'); plotHost.setAttribute('aria-label', 'Root-locus exploration plot'); visual.append(plotHost);
  const plotActions = el('div', '', 'cp-actions'), overlays = el('div', '', 'cp-overlays'), rootSummary = el('div', '', 'cp-root-summary'), plotNote = el('p', '', 'cp-note');
  visual.append(plotActions, overlays, rootSummary, plotNote);
  button('Fit plot', () => { if (draftDirty || drag) return; viewWindow = undefined; draw(current, false); status.textContent = 'Fit to the current finite trace. Axes stay fixed until you fit again.'; }, plotActions);
  const undo = button('Undo model edit', () => { cancelDrag(); const previous = history.at(-1); if (!previous) return; try { install(compute(previous)); history.pop(); status.textContent = 'Restored the previous checked model and gain.'; undo.disabled = history.length === 0; } catch (e) { fail(e); } }, plotActions); undo.disabled = true;
  const cancel = button('Cancel drag', () => cancelDrag(), plotActions); cancel.disabled = true;
  const reveals: { -readonly [K in keyof Reveals]: Reveals[K] } = { segments: true, asymptotes: false, tangents: false, vectors: false };
  for (const [key, label] of [['segments', 'Real-axis segments'], ['asymptotes', 'Asymptotes'], ['tangents', 'Departure / arrival rays'], ['vectors', 'Candidate vectors']] as const) {
    const wrap = el('label', '', 'cp-checkbox'), input = el('input'); input.type = 'checkbox'; input.checked = reveals[key]; input.setAttribute('aria-label', label); wrap.append(input, document.createTextNode(label)); overlays.append(wrap);
    input.addEventListener('change', () => { reveals[key] = input.checked; draw(shown, shown !== current); }, { signal });
  }
  inspector.append(el('h3', 'Poles and zeros'));
  const selectionLabel = el('label', 'Selected plant factor'), selection = el('select'); selection.setAttribute('aria-label', 'Selected plant factor'); selectionLabel.append(selection); inspector.append(selectionLabel);
  const real = number('Factor real coordinate (s⁻¹)', 0, -100, 100), imaginary = number('Factor imaginary coordinate (rad/s)', 0, 0, 100); real.input.step = imaginary.input.step = '.01';
  const coordinateControls = el('div', '', 'cp-controls'); coordinateControls.append(real.wrap, imaginary.wrap); inspector.append(coordinateControls);
  const objectActions = el('div', '', 'cp-actions'); inspector.append(objectActions);
  const apply = button('Apply coordinates', () => {
    if (!ready()) return;
    try { const r = readNumericInput(real.input, 'Factor real coordinate'), i = readNumericInput(imaginary.input, 'Factor imaginary coordinate'); const edited = moveFactor(current.model, selectedId, r, i); publish(edited.model, edited.note, { re: snapCoordinate(r), im: Math.abs(snapCoordinate(i)) }); } catch (e) { fail(e); }
  }, objectActions);
  const remove = button('Remove selected group', () => { if (!ready()) return; try { const edited = removeFactor(current.model, selectedId); publish(edited.model, edited.note); } catch (e) { fail(e); } }, objectActions);
  const selectedNote = el('p', '', 'cp-note'); inspector.append(selectedNote);
  const pairLabel = el('label', '', 'cp-checkbox'), pair = el('input'); pair.type = 'checkbox'; pair.setAttribute('aria-label', 'Add a conjugate pair'); pairLabel.append(pair, document.createTextNode('Add a conjugate pair')); inspector.append(pairLabel);
  const addActions = el('div', '', 'cp-actions'); inspector.append(addActions);
  const addPole = button('Add pole', () => add('pole'), addActions), addZero = button('Add zero', () => add('zero'), addActions), limitsNote = el('p', '', 'cp-note'); inspector.append(limitsNote);
  button('Try two poles', () => { if (!ready()) return; publish(parseModel('1', 's(s+2)'), 'Two-pole experiment loaded. Add a third pole or a real zero, then compare the changed branches.'); }, inspector);
  inspector.append(el('p', 'Crosses are poles and rings are zeros. Drag a handle; real roots stay on the real axis and conjugates move together. Arrow keys move a focused handle by 0.01; Shift moves by 0.1. Repeated groups move together. Escape cancels a drag.', 'cp-note'));
  root.append(status);
  const advanced = el('details', '', 'cp-card'), form = el('div', '', 'cp-equation-inputs'); advanced.append(el('summary', 'Edit equations, PI mode and gain range'), form); root.append(advanced);
  const invalidate = () => { draftDirty = true; cancelDrag(false); badge.textContent = 'Equation draft changed — plot shows the last checked model'; status.textContent = 'Apply the equation edits to update the plot, or discard them before moving a factor.'; refreshEnabled(); };
  const numerator = createEquationInput({ ...equationEntry, label: 'Numerator polynomial N(s)', value: '1', signal, onChange: invalidate }); editors.push(numerator);
  const denominator = createEquationInput({ ...equationEntry, label: 'Denominator polynomial D(s)', value: 's(s+2)(s+5)', signal, onChange: invalidate }); editors.push(denominator); form.append(numerator.element, denominator.element);
  const settings = el('div', '', 'cp-controls'), modeLabel = el('label', 'Varying parameter'), mode = el('select'); mode.setAttribute('aria-label', 'Varying parameter');
  for (const [value, label] of [['gain', 'K multiplying the plant'], ['pi', 'Kp with fixed Ki']]) { const option = el('option', label); option.value = value; mode.append(option); } modeLabel.append(mode);
  const ki = number('Fixed Ki (Kp per second)', 2.7, 0, 1000), maximum = number('Trace maximum gain', 140, 1e-9, 1000); ki.wrap.hidden = true; settings.append(modeLabel, ki.wrap, maximum.wrap); advanced.append(settings);
  const equationActions = el('div', '', 'cp-actions'); advanced.append(equationActions);
  button('Apply equations', () => {
    try {
      const read = (input: EquationInput, label: string) => { const d = input.getValue(); if (d.empty || d.hasPlaceholders || d.syntaxIssues.length) throw new Error(`Complete ${label} using the visual equation controls.`); return d.latex; };
      const model = parseModel(read(numerator, 'the numerator'), read(denominator, 'the denominator'), mode.value === 'pi' ? 'pi' : 'gain', mode.value === 'pi' ? String(readNumericInput(ki.input, 'Fixed Ki')) : '2.7');
      const max = readNumericInput(maximum.input, 'Trace maximum gain');
      if (!(max > 0 && max <= 1000) || toNumber(current.gain) > max) throw new Error('Use a gain maximum above zero and at least as large as the selected gain, up to 1000.');
      publish(model, 'Equation edits checked. Plant factors, full characteristic and trace now use this model.', undefined, max);
    } catch (e) { fail(e, true); }
  }, equationActions);
  button('Discard equation edits', () => { draftDirty = false; syncInputs(); refreshEnabled(); draw(current, false); status.textContent = 'Restored the checked equations.'; }, equationActions);
  button('Course baseline', () => { cancelDrag(false); publish(baseline(), 'Course baseline restored.', undefined, 140, gainValue('70')); }, equationActions);
  button('Fixed-Ki PI example', () => { cancelDrag(false); publish(parseModel('1', 's(s+2)', 'pi', '2.7'), 'PI example loaded. Handles edit plant poles/zeros; the effective locus factors are derived with Ki fixed.', undefined, 20, gainValue('1.35')); }, equationActions);
  advanced.append(el('p', 'Real rational, strictly proper plant: gain mode has 1–3 poles; fixed-Ki PI has 1–2 plant poles. Coefficients have magnitude ≤1000 and reduced denominator ≤10⁹; 0≤gain≤1000. Original factors remain in the full characteristic. Coordinate edits use a 0.01 s⁻¹ grid within ±100; this is an explicit editing precision, not an exact description of every original root. No time response is simulated.', 'cp-note'));
  mode.addEventListener('change', () => { ki.wrap.hidden = mode.value !== 'pi'; invalidate(); }, { signal }); for (const input of [ki.input, maximum.input]) input.addEventListener('input', invalidate, { signal });
  const candidateDetails = el('details', '', 'cp-card'), candidateControls = el('div', '', 'cp-controls'), candidateReal = number('Candidate real part (s⁻¹)', 0, -100, 100), candidateImaginary = number('Candidate imaginary part (rad/s)', Math.sqrt(10), -100, 100), candidateReadout = el('div');
  candidateDetails.append(el('summary', 'Test a candidate and inspect the full model'), candidateControls, candidateReadout); candidateControls.append(candidateReal.wrap, candidateImaginary.wrap);
  button('Test candidate', () => { try { if (!ready()) return; const point = c(readNumericInput(candidateReal.input, 'Candidate real part'), readNumericInput(candidateImaginary.input, 'Candidate imaginary part')); candidate(current.model, point, current.gain); testedPoint = point; draw(current, false); status.textContent = 'Candidate checked against the full characteristic polynomial.'; } catch (e) { fail(e); } }, candidateDetails); root.append(candidateDetails);

  function ready(): boolean { if (draftDirty) { status.textContent = 'Apply or discard the equation draft before changing the checked model.'; return false; } if (drag) { status.textContent = 'Finish or cancel the current drag first.'; return false; } return true; }
  function fail(error: unknown, draft = false): void { if (draft) draftDirty = true; badge.textContent = draftDirty ? 'Invalid or unapplied draft — plot shows the last checked model' : 'Change rejected — last checked model retained'; status.textContent = `${error instanceof Error ? error.message : 'This change could not be checked.'} The last checked model remains visible.`; refreshEnabled(); }
  function syncInputs(): void { numerator.setValue(polynomial(current.model.plantN)); denominator.setValue(polynomial(current.model.plantD)); mode.value = current.model.mode; ki.input.value = String(toNumber(current.model.integral)); ki.wrap.hidden = mode.value !== 'pi'; maximum.input.value = String(current.maximum); gain.input.value = String(toNumber(current.gain)); slider.max = String(current.maximum); slider.value = gain.input.value; }
  function selectedFactor(): EditFactor | undefined { return current.factors.find(f => f.id === selectedId); }
  function refreshEnabled(): void {
    const selected = selectedFactor(); apply.disabled = remove.disabled = !selected || draftDirty || !!drag; selection.disabled = draftDirty || !!drag; real.input.disabled = !selected || draftDirty || !!drag; imaginary.input.disabled = !selected?.pair || draftDirty || !!drag;
    gain.input.disabled = slider.disabled = draftDirty || !!drag; pair.disabled = draftDirty || !!drag;
    const poleLimit = additionLimit(current.model, 'pole', pair.checked), zeroLimit = additionLimit(current.model, 'zero', pair.checked); addPole.disabled = !!poleLimit || draftDirty || !!drag; addZero.disabled = !!zeroLimit || draftDirty || !!drag; addPole.title = poleLimit ?? ''; addZero.title = zeroLimit ?? '';
    limitsNote.textContent = [poleLimit && `Add pole: ${poleLimit}`, zeroLimit && `Add zero: ${zeroLimit}`].filter(Boolean).join(' ') || 'New groups start at −1 (or −1 ± j); select and move them to compare.';
    cancel.disabled = !drag; undo.disabled = history.length === 0 || !!drag;
  }
  function syncSelection(): void {
    const factor = selectedFactor(); selection.value = selectedId;
    if (factor) { real.input.value = String(factor.re); imaginary.input.value = String(factor.pair ? factor.im : 0); selectedNote.textContent = `${factorLabel(factor)}. ${Math.max(Math.abs(factor.re), factor.im) > 100 ? 'This accepted root is outside the ±100 coordinate-edit window. Enter a position inside that window or edit the equation; selection does not change the root. ' : ''}${current.model.mode === 'pi' ? 'This is a plant factor, not an independently editable effective PI factor. ' : ''}${factor.exact ? 'Untouched exact factors remain exact when this group moves.' : 'Roots without an exact split will be rounded to the 0.01 grid during a coordinate edit; untouched exact factors remain exact.'}`; }
    else selectedNote.textContent = 'Select a handle on the plot or a factor above.';
    refreshEnabled();
  }
  function refreshFactors(preferred?: Complex, kind?: 'pole' | 'zero'): void {
    const factors = current.factors; selection.replaceChildren();
    factors.forEach(f => { const o = el('option', factorLabel(f)); o.value = f.id; selection.append(o); });
    if (preferred) selectedId = [...factors].filter(f => !kind || f.kind === kind).sort((a, b) => Math.hypot(a.re - preferred.re, a.im - preferred.im) - Math.hypot(b.re - preferred.re, b.im - preferred.im))[0]?.id ?? factors[0]?.id ?? '';
    else if (!factors.some(f => f.id === selectedId)) selectedId = factors[0]?.id ?? '';
    syncSelection();
  }
  function install(next: Computed, preferred?: Complex, kind = selectedFactor()?.kind): void {
    const previous = current, previousId = selectedId, previousDirty = draftDirty, previousWindow = viewWindow;
    // Validate the full factor list before publishing, even if those roots are outside the coordinate-edit window.
    current = next; draftDirty = false;
    try { syncInputs(); refreshFactors(preferred, kind); draw(current, false); }
    catch (e) { current = previous; selectedId = previousId; draftDirty = previousDirty; viewWindow = previousWindow; syncInputs(); refreshFactors(); throw e; }
  }
  function publish(model: Model, note: string, preferred?: Complex, max = current.maximum, nextGain = current.gain, kind?: 'pole' | 'zero'): void {
    const next = compute({ model, gain: nextGain, maximum: max }), previous = current;
    install(next, preferred, kind);
    history.push({ model: previous.model, gain: previous.gain, maximum: previous.maximum }); if (history.length > 20) history.shift();
    status.textContent = note; refreshEnabled();
  }
  function add(kind: 'pole' | 'zero'): void {
    if (!ready()) return; try { const reason = additionLimit(current.model, kind, pair.checked); if (reason) throw new Error(reason); const edited = addFactor(current.model, kind, pair.checked, -1, pair.checked ? 1 : 0); publish(edited.model, edited.note, c(-1, pair.checked ? 1 : 0), current.maximum, current.gain, kind); } catch (e) { fail(e); }
  }
  function draw(value: Computed, preview: boolean): void {
    const markers = value.factors.flatMap(f => [f.im, ...(f.pair && f.im ? [-f.im] : [])].map(im => ({ id: f.id, kind: f.kind, point: c(f.re, im), label: `${factorLabel(f)}; arrow keys move this group`, selected: f.id === selectedId })));
    const nextPlane = plane(value.model, value.sampled, value.construction, value.selected, testedPoint, reveals, { window: viewWindow, markers }), nextWindow = viewWindow ?? nextPlane.window;
    nextPlane.element.dataset.preview = String(preview);
    nextPlane.resize(measuredWidth ?? (plotHost.getBoundingClientRect().width || 480));
    const nextEquation = el('div'), nextSummary = el('div'), nextReadout = el('div');
    nextEquation.append(createEquationDisplay(`${value.model.mode === 'pi' ? 'G' : 'L_0'}(s)=\\frac{${polynomial(value.model.plantN)}}{${polynomial(value.model.plantD)}}${value.model.mode === 'pi' ? `,\\quad C(s)=K_p+\\frac{${fraction(value.model.integral)}}{s}` : ''}`, value.model.mode === 'pi' ? 'Plant and fixed integral controller' : 'Applied loop factor'));
    if (value.model.mode === 'pi') nextEquation.append(createEquationDisplay(`L_{0,eff}(s)=\\frac{${polynomial(value.model.numerator)}}{${polynomial(value.model.denominator)}},\\quad 1+K_pL_{0,eff}(s)=0`, 'Effective fixed Ki locus'));
    const fullQ = createEquationDisplay(`Q(s,${fraction(value.gain)})=${polynomial(characteristic(value.model, value.gain))}`, 'Complete selected characteristic polynomial');
    nextSummary.append(el('h3', `All roots at ${value.model.mode === 'pi' ? 'Kp' : 'K'} = ${numeric(toNumber(value.gain))}`), fullQ);
    if (value.issue) nextSummary.append(el('p', value.issue, 'cp-warning'));
    else {
      const list = el('ul'); for (const p of value.selected) list.append(el('li', `${pointText(p)} s⁻¹ · multiplicity ${p.multiplicity} · ${p.re > 1e-8 * Math.max(1, Math.hypot(p.re, p.im)) ? 'right half-plane' : p.re < -1e-8 * Math.max(1, Math.hypot(p.re, p.im)) ? 'left half-plane' : 'near imaginary axis (numerical)'}`)); nextSummary.append(list);
    }
    if (degree(value.model.common)) nextSummary.append(el('p', `Retained common-factor modes: ${value.model.fixed.map(pointText).join('; ')}. Cancellation in the scalar loop does not remove them from the full characteristic.`, 'cp-warning'));
    const allPoints = [...markers.map(m => m.point), ...value.selected, ...value.sampled.frames.flatMap(f => f.points)];
    const offView = allPoints.some(p => Math.abs(p.re - nextWindow.center) > nextWindow.extent || Math.abs(p.im) > nextWindow.extent);
    const nextNote = `${value.sampled.evaluations} root evaluations over 0–${numeric(value.maximum)}; ${value.sampled.gaps} omitted connections${value.sampled.capped ? '; display budget reached' : ''}. Equal axis scales are fixed; use Fit plot to change the view.${offView ? ' Some roots or branches are clipped outside this view. Full selected roots remain listed; fit the plot to see the changed geometry.' : ''}${value.model.mode === 'pi' ? ' Large handles are original plant factors; smaller locus symbols show the derived effective loop.' : ''}`;
    const check = candidate(value.model, testedPoint, value.gain); nextReadout.append(el('p', `Candidate ${pointText(testedPoint)}: ${check.kind === 'ordinary' ? check.onPositiveLocus ? 'passes the nonnegative-gain angle and full-Q checks' : 'does not pass the nonnegative-gain locus checks' : check.kind === 'fixed' ? 'retained fixed mode for every gain' : `${check.kind} endpoint`}. Selected full-Q residual ${numeric(check.selectedResidual)}.`));
    if (check.complexGain) nextReadout.append(el('p', `−D/N = ${pointText(check.complexGain)}; angle residual ${numeric(check.angleResidual!)} rad. Magnitude-only gain ${numeric(check.magnitudeGain!)} does not alone establish membership.`));
    nextReadout.append(el('p', `Asymptote count ${value.construction.asymptotes.count}; centroid ${numeric(toNumber(value.construction.asymptotes.centroid))}. Imaginary-axis crossing gains in 0–1000: ${value.construction.crossings.map(p => numeric(p.gain)).join(', ') || 'no isolated crossings found'}. This is not a complete stable-gain-region proof.`, 'cp-note'));
    if (value.construction.axisFamily) nextReadout.append(el('p', value.construction.axisFamily, 'cp-warning'));
    // Publish only after every mathematical/readout operation succeeds.
    shown = value; currentPlane = nextPlane; viewWindow = nextWindow;
    plotHost.replaceChildren(nextPlane.element); equation.replaceChildren(...nextEquation.childNodes); rootSummary.replaceChildren(...nextSummary.childNodes); candidateReadout.replaceChildren(...nextReadout.childNodes); plotNote.textContent = nextNote;
    badge.textContent = preview ? 'Drag preview — lower-resolution finite trace; release to check' : draftDirty ? 'Draft changed — plot shows the last checked model' : 'Checked model';
  }
  function updateGain(fromRange: boolean): void {
    if (!ready()) return;
    try {
      const number = readNumericInput(fromRange ? slider : gain.input, 'Selected gain'), cursorValue = fromRange ? Number(number.toFixed(9)) : number;
      if (number !== 0 && cursorValue === 0) throw new Error('This nonzero gain is below the cursor precision of 0.000000001; it was not changed to zero.');
      const nextGain = gainValue(String(cursorValue));
      if (number > current.maximum) throw new Error('Keep the selected gain within the finite trace range.');
      const next = { ...current, gain: nextGain, ...selectedRoots(current.model, nextGain) }; draw(next, false); current = next; gain.input.value = String(toNumber(nextGain)); slider.value = gain.input.value; status.textContent = `${fromRange && number !== cursorValue ? `Gain cursor rounded to nine decimal places: ${cursorValue}. ` : ''}Selected roots updated. The unchanged finite gain trace was reused.`;
    } catch (e) { fail(e); }
  }
  gain.input.addEventListener('input', () => updateGain(false), { signal }); slider.addEventListener('input', () => updateGain(true), { signal });
  selection.addEventListener('change', () => { selectedId = selection.value; syncSelection(); draw(current, false); }, { signal }); pair.addEventListener('change', refreshEnabled, { signal });
  function clearTimer(): void { if (timer !== undefined) { clearTimeout(timer); timer = undefined; } }
  function cancelDrag(announce = true): void {
    clearTimer(); const previous = drag; drag = undefined;
    if (previous && plotHost.hasPointerCapture?.(previous.pointer)) plotHost.releasePointerCapture(previous.pointer);
    if (previous) { draw(current, false); syncSelection(); if (announce) status.textContent = 'Drag cancelled. The checked model is unchanged.'; }
  }
  container.addEventListener('cp06-suspend', () => cancelDrag(), { signal });
  // The persistent host and window capture own Escape even after a preview replaces the SVG.
  const cancelOnEscape = (event: KeyboardEvent) => { if (event.key !== 'Escape' || !drag) return; event.preventDefault(); event.stopPropagation(); cancelDrag(); };
  const cancelOnBlur = () => { if (drag) cancelDrag(); };
  window.addEventListener('keydown', cancelOnEscape, { capture: true, signal }); window.addEventListener('blur', cancelOnBlur, { signal });
  function queuePreview(): void {
    if (timer !== undefined) return;
    timer = setTimeout(() => {
      timer = undefined; if (!drag || disposed || signal.aborted) return;
      try { const edited = moveFactor(current.model, drag.id, drag.re, drag.im); draw(compute({ model: edited.model, gain: current.gain, maximum: current.maximum }, true), true); status.textContent = `Preview at ${pointText(c(drag.re, drag.im))}; release to check, or Escape to cancel.`; }
      catch (e) { draw(current, false); badge.textContent = 'Preview unavailable — last checked model shown'; status.textContent = `${e instanceof Error ? e.message : 'This preview is unresolved.'} Release will validate; Escape cancels.`; }
    }, 80);
  }
  plotHost.addEventListener('pointerdown', event => {
    const target = (event.target as Element).closest<SVGGElement>('[data-edit-id]'); if (!target || !ready() || event.button !== 0) return;
    const factor = current.factors.find(f => f.id === target.dataset.editId); if (!factor) return;
    selectedId = factor.id; syncSelection();
    drag = { pointer: event.pointerId, id: factor.id, pair: factor.pair, re: factor.re, im: factor.im, moved: false }; plotHost.setPointerCapture?.(event.pointerId); event.preventDefault(); plotHost.focus({ preventScroll: true }); refreshEnabled();
  }, { signal });
  plotHost.addEventListener('pointermove', event => {
    if (!drag || drag.pointer !== event.pointerId) return; const point = currentPlane.pointFromEvent(event); if (!point) return;
    try { drag.re = snapCoordinate(point.re); drag.im = drag.pair ? Math.abs(snapCoordinate(point.im)) : 0; drag.moved = true; real.input.value = String(drag.re); imaginary.input.value = String(drag.im); queuePreview(); } catch (e) { status.textContent = (e as Error).message; }
  }, { signal });
  plotHost.addEventListener('pointerup', event => {
    if (!drag || drag.pointer !== event.pointerId) return; const next = drag; clearTimer(); drag = undefined; if (plotHost.hasPointerCapture?.(event.pointerId)) plotHost.releasePointerCapture(event.pointerId); suppressClick = next.moved;
    if (!next.moved) { syncSelection(); draw(current, false); return; }
    try { const edited = moveFactor(current.model, next.id, next.re, next.im); publish(edited.model, edited.note, c(next.re, next.im)); } catch (e) { draw(current, false); syncSelection(); fail(e); }
  }, { signal });
  plotHost.addEventListener('pointercancel', () => cancelDrag(), { signal }); plotHost.addEventListener('lostpointercapture', () => { if (drag) cancelDrag(); }, { signal });
  root.addEventListener('keydown', event => {
    if (event.key === 'Escape' && drag) { event.preventDefault(); event.stopPropagation(); cancelDrag(); return; }
    const target = (event.target as Element).closest<SVGGElement>('[data-edit-id]'); if (!target || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault(); event.stopPropagation(); if (!ready()) return;
    const f = current.factors.find(value => value.id === target.dataset.editId); if (!f) return;
    const step = event.shiftKey ? .1 : .01; selectedId = f.id;
    try {
      const re = snapCoordinate(f.re + (event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0));
      const side = Number(target.dataset.editIm) < 0 ? -1 : 1;
      const im = f.pair ? Math.max(0, snapCoordinate(f.im + side * (event.key === 'ArrowDown' ? -step : event.key === 'ArrowUp' ? step : 0))) : 0;
      const edited = moveFactor(current.model, f.id, re, im); publish(edited.model, edited.note, c(re, im));
      const handles = [...plotHost.querySelectorAll<SVGGElement>(`[data-edit-id="${selectedId}"]`)];
      (handles.find(handle => Math.sign(Number(handle.dataset.editIm)) === side) ?? handles[0])?.focus();
    } catch (e) { fail(e); }
  }, { capture: true, signal });
  plotHost.addEventListener('click', event => {
    if (suppressClick) { suppressClick = false; return; }
    const target = (event.target as Element).closest<SVGGElement>('[data-edit-id]'); if (target) { selectedId = target.dataset.editId!; syncSelection(); draw(current, false); return; }
    if (!ready()) return; const point = currentPlane.pointFromEvent(event); if (!point || Math.hypot(point.re, point.im) > 100) return; testedPoint = point; candidateReal.input.value = String(point.re); candidateImaginary.input.value = String(point.im); draw(current, false);
  }, { signal });
  function cleanup(): void { if (disposed) return; disposed = true; clearTimer(); observer?.disconnect(); window.removeEventListener('keydown', cancelOnEscape, true); window.removeEventListener('blur', cancelOnBlur); const previous = drag; drag = undefined; if (previous && plotHost.hasPointerCapture?.(previous.pointer)) plotHost.releasePointerCapture(previous.pointer); editors.forEach(editor => editor.destroy()); root.remove(); }
  signal.addEventListener('abort', cleanup, { once: true });
  if (signal.aborted) { cleanup(); return cleanup; }
  try {
    syncInputs(); refreshFactors(); draw(current, false);
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(entries => {
        if (disposed || signal.aborted) return; const width = entries[0]?.contentRect.width;
        if (!width || width <= 0 || Math.abs(width - (measuredWidth ?? 0)) <= .5) return;
        measuredWidth = width;
        if (drag) { cancelDrag(false); status.textContent = 'Drag cancelled because the plot resized. The checked model is unchanged.'; }
        currentPlane.resize(width);
      });
      observer.observe(plotHost);
    }
    return cleanup;
  } catch (e) { cleanup(); throw e; }
};
