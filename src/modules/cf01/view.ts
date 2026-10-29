import type { ModuleMount } from '../../core/module';
import { createEquationDisplay, createEquationInput, type EquationDraft } from '../../shared/equations/input';
import { readNumericInput } from '../../shared/numeric-input';
import { format as f, latexNumber as ln, parseTransfer } from './input';
import { buildResponse, normalizedAt, type Response } from './response';
import { assess, deriveTargets, measure, pairPrediction, type Band, type Rise, type Measurement, type Targets } from './measure';
import { polePlot, responsePlot } from './plots';
import { markup } from './markup';
import './style.css';
const baseLatex = (r: Response) => String.raw`\frac{${ln(r.model.g)}}{s^2+${ln(r.model.a1)}s+${ln(r.model.a0)}}`;
const judgment = (v: boolean | undefined) => v === true ? 'Meets target' : v === false ? 'Does not meet target' : 'Not established';
const seconds = (v: number | undefined) => v === undefined ? 'Not established' : f(v) + ' s';
const peak = (m: Measurement) => m.noOvershoot ? 'No finite overshoot peak' : seconds(m.peakTime) + (m.peakEstablished ? '' : ' (within H)');
const riseTime = (m: Measurement) => m.rise === '0-100' && m.noOvershoot ? 'No finite 100% crossing' : seconds(m.riseTime);
export const mount: ModuleMount = ({ container, signal }) => {
  if (signal.aborted) return;
  const root = document.createElement('div'); root.className = 'cf1-tool'; root.innerHTML = markup; container.append(root);
  const q = <T extends Element>(selector: string) => root.querySelector<T>(selector)!;
  const input = (name: string) => q<HTMLInputElement>('[name="' + name + '"]');
  const select = (name: string) => q<HTMLSelectElement>('[name="' + name + '"]');
  const read = (name: string, label: string) => readNumericInput(input(name), label);
  const answer = q<HTMLElement>('.cf1-answer'), status = q<HTMLElement>('.cf1-status');
  let draft: EquationDraft, result: { pair: Measurement; full: Measurement; targets: Targets } | undefined;
  const field = createEquationInput({ label: 'Closed-loop target-pair transfer function T(s)', value: String.raw`T(s)=\frac{4}{s^2+2s+4}`, signal, onChange: value => { draft = value; invalidate(); } });
  q('.cf1-equation').append(field.element); draft = field.getValue();
  function syncEnabled(): void { input('pole').disabled = !input('include-pole').checked; input('zero').disabled = !input('include-zero').checked; }
  function invalidate(): void {
    result = undefined; answer.hidden = true; q('.cf1-feedback').textContent = ''; q('.cf1-target-steps').replaceChildren(); q('.cf1-inspection').textContent = '';
    q('.cf1-response').textContent = 'Inputs changed. Calculate responses to recompute.'; q('.cf1-poles').replaceChildren(); status.textContent = 'Inputs changed. Calculate responses to recompute.';
  }
  function inspect(): void {
    if (!result || signal.aborted) return;
    try {
      const time = read('time', 'inspection time');
      if (time < 0 || time > result.full.horizon) throw new Error('Choose inspection time within the common horizon.');
      const pair = normalizedAt(result.pair.response, time), full = normalizedAt(result.full.response, time), finalValue = result.full.response.finalValue;
      q('.cf1-response').replaceChildren(responsePlot(result.pair, result.full, time));
      q('.cf1-inspection').textContent = 'At t=' + f(time) + ' s: pair y=' + f(pair.value * finalValue) + ', full y=' + f(full.value * finalValue) + ' output units. Normalized outputs: pair=' + f(pair.value) + ', full=' + f(full.value) + '; common final value=' + f(finalValue) + ' output units.';
    } catch (error) { q('.cf1-inspection').textContent = error instanceof Error ? error.message : 'Check inspection time.'; }
  }
  function compute(): void {
    if (signal.aborted) return;
    invalidate();
    try {
      draft = field.getValue();
      if (draft.empty || draft.hasPlaceholders || draft.syntaxIssues.length) throw new Error('Complete the target-pair equation and check its notation.');
      const base = parseTransfer(draft.latex), horizon = read('horizon', 'common horizon'), band = Number(select('band').value) as Band, rise = select('rise').value as Rise, tolerance = Number(select('tolerance').value);
      const targets = deriveTargets(read('overshoot', 'maximum overshoot'), read('settling', 'maximum settling time'), band);
      const pairResponse = buildResponse(base), fullResponse = buildResponse({ ...base, pole: input('include-pole').checked ? read('pole', 'added pole parameter') : undefined, zero: input('include-zero').checked ? read('zero', 'added zero parameter') : undefined });
      const pair = measure(pairResponse, horizon, band, rise, tolerance), full = measure(fullResponse, horizon, band, rise, tolerance);
      result = { pair, full, targets }; input('time').max = String(horizon); input('time').value = f(horizon / 2);
      status.textContent = 'Computed both responses over 0…' + f(horizon) + ' s. Full-model settling: ' + seconds(full.settlingTime) + '. Future error envelope at H=' + f(full.envelope) + ' of the final value; band=' + f(band / 100) + '.';
      const steps = q('.cf1-target-steps');
      steps.append(createEquationDisplay(targets.overshoot === 0 ? String.raw`\zeta_{\min}=1\quad(M_{p,\max}=0)` : String.raw`\zeta_{\min}=\frac{-\ln(${ln(targets.overshoot / 100)})}{\sqrt{\pi^2+\ln^2(${ln(targets.overshoot / 100)})}}=${ln(targets.dampingMinimum)}`, 'Minimum damping from overshoot requirement'));
      steps.append(createEquationDisplay(String.raw`\sigma_g=\frac{${ln(targets.coefficient)}}{${ln(targets.settling)}}=${ln(targets.decayMinimum)},\quad\omega_{n,g}\big|_{\zeta_{\min}}=\frac{\sigma_g}{\zeta_{\min}}=${ln(targets.naturalFrequencyAtMinimumDamping)}`, 'Approximate decay and natural-frequency guideline'));
      q('.cf1-poles').replaceChildren(polePlot(full, targets)); inspect();
    } catch (error) { invalidate(); status.textContent = error instanceof Error ? error.message : 'Check the equation and requirements.'; }
  }
  function reveal(): void {
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
  function preset(kind: string): void {
    if (kind === 'baseline') {
      field.setValue(String.raw`T(s)=\frac{4}{s^2+2s+4}`); input('overshoot').value = '20'; input('settling').value = '4'; input('horizon').value = '10'; select('band').value = '2'; select('rise').value = '10-90'; select('tolerance').value = '0.0001'; input('include-pole').checked = false; input('include-zero').checked = false; input('pole').value = '1'; input('zero').value = '1';
    } else if (kind === 'slow') { input('include-pole').checked = true; input('pole').value = '.2'; }
    else if (kind === 'zero') { input('include-zero').checked = true; input('zero').value = '-1'; }
    else { input('include-pole').checked = false; input('include-zero').checked = false; }
    syncEnabled(); select('prediction').value = ''; compute();
  }
  for (const name of ['overshoot', 'settling', 'pole', 'zero', 'horizon']) input(name).addEventListener('input', invalidate, { signal });
  for (const name of ['band', 'rise', 'tolerance']) select(name).addEventListener('change', invalidate, { signal });
  for (const name of ['include-pole', 'include-zero']) input(name).addEventListener('change', () => { syncEnabled(); invalidate(); }, { signal });
  input('time').addEventListener('input', inspect, { signal });
  root.querySelectorAll<HTMLButtonElement>('[data-action]').forEach(button => button.addEventListener('click', () => { const action = button.dataset.action!; if (action === 'compute') compute(); else if (action === 'reveal') reveal(); else preset(action); }, { signal }));
  compute();
  return () => { result = undefined; field.destroy(); root.remove(); };
};
