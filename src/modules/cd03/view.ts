import type { ModuleMount } from '../../core/module';
import { createEquationDisplay, createEquationInput } from '../../shared/equations/input';
import { readNumericInput } from '../../shared/numeric-input';
import { model, parsePlant, type Design, type Complex } from './model';
import { assess, measure, response, type Metrics, type Response } from './response';
import { placement, polePlot, transientPlot } from './plots';
import './style.css';
const fmt = (v: number) => Number(v.toPrecision(7)).toString();
const num = (v: number) => fmt(v).replace(/e([+-]?\d+)$/, (_, e: string) => `\\times10^{${Number(e)}}`);
const pole = (p: Complex) => `${fmt(p.re)} ${p.im < 0 ? '−' : '+'} j${fmt(Math.abs(p.im))}`;
const text = (tag: string, value: string) => { const e = document.createElement(tag); e.textContent = value; return e; };
function polynomial(c: number[]) { return c.map((v, i) => `${i && v >= 0 ? '+' : ''}${num(v)}${i === c.length - 1 ? '' : i === c.length - 2 ? 's' : `s^{${c.length - 1 - i}}`}`).join(''); }
export const mount: ModuleMount = ({ container, signal }) => {
  if (signal.aborted) return;
  const root = document.createElement('div'); root.className = 'cd03'; root.dataset.module = 'CD03';
  root.innerHTML = `<section><h2>1. Keep accuracy and transient requirements together</h2><p>Negative unity feedback, zero initial conditions. Plant G(s)=b/[s(s+a)]; the proportional reference is C₀=K. Enable C(s)=K(s+z)/(s+p) to design lag with 0&lt;p&lt;z. The same K is used in both comparisons; changing it updates the reference pair too. A unit-ramp input has slope 1 input unit/s. Step outputs below are dimensionless and have final value 1 when stable.</p><div data-part="plant"></div>
    <div class="cd03-row"><label>Proportional gain K<input data-control="k" aria-label="Proportional gain" type="number" step="any" value="4"></label><label>Use the chosen lag section<input data-control="lag" aria-label="Enable lag section" type="checkbox"></label><label>Lag pole rate p (s⁻¹)<input data-control="p" aria-label="Lag pole rate" type="number" step="any" value="0.01"></label><label>Lag zero rate z (s⁻¹)<input data-control="z" aria-label="Lag zero rate" type="number" step="any" value="0.1"></label></div>
    <div class="cd03-row"><label>Required velocity constant Kv (s⁻¹)<input data-control="kv" aria-label="Required velocity constant" type="number" step="any" value="20"></label><label>Retained overshoot limit (%)<input data-control="mp" aria-label="Overshoot limit" type="number" step="any" value="20"></label><label>Retained settling limit (s)<input data-control="ts" aria-label="Settling limit" type="number" step="any" value="4.5"></label></div>
    <p class="cd03-note">The initial Kv20, overshoot20% and settling4.5s are proposed exercise targets. The course baseline remains G=1/[s(s+2)], C₀=4. Original external motor sketches are not adopted as verified models. Plant a=0.2–20, b=0.05–20; K=0.05–100; the reference must have 0.2≤ωn≤20 rad/s, 0.1≤ζ≤0.95. For lag:0.001≤p&lt;z≤5 and z/p≤1000.</p>
    <div class="cd03-row"><button data-action="suggest" type="button">Choose z from the accuracy ratio</button><button data-action="lag" type="button">Try proposed lag p=.01, z=.1</button><button data-action="near" type="button">Move both corners nearer zero</button><button data-action="reset" type="button">Restore baseline</button></div><p data-part="feedback" role="status" aria-live="polite"></p></section>
  <section><h2>2. Predict, then check the full loop</h2><div class="cd03-row"><label>Settling band<select data-control="band" aria-label="Settling band"><option value=".02">2%</option><option value=".05">5%</option><option value=".01">1%</option></select></label><label>Measurement horizon H (s)<input data-control="horizon" aria-label="Measurement horizon" type="number" step="any" value="20"></label><label>Your prediction<select data-control="prediction" aria-label="Your prediction"><option value="">Choose</option><option value="both">Accuracy and transients meet targets</option><option value="accuracy">Only accuracy meets its target</option><option value="transient">Only transients meet their targets</option><option value="neither">Neither meets its target</option><option value="unknown">Not established yet</option></select></label><button data-action="compute" type="button">Check complete design</button></div><p data-part="prediction" role="status"></p><div data-part="reasoning"></div><div data-part="table" class="cd03-scroll"></div><div data-part="roots"></div></section>
  <section><h2>3. Inspect pole placement and the actual response</h2><div data-part="placement" class="cd03-scroll"></div><p class="cd03-note">The first view magnifies the chosen real pole and zero. The second keeps every computed closed-loop pole visible: × full-loop poles; △ proportional reference poles; ○ chosen lag zero; + chosen lag pole. Dashed vectors end at the original upper reference pole. These are pole locations and angle vectors, not a claim that the original point stays on the compensated locus.</p><div data-part="poles" class="cd03-scroll"></div><p data-part="angle"></p><p>Unit-step comparison: dashed proportional reference, solid chosen full loop. Band shading and peak/settling markers use the chosen model. Measured step transients and the final unit-ramp error test different requirements.</p><div data-part="response" class="cd03-scroll"></div><div class="cd03-row"><label>Inspect time t (s)<input data-control="time" aria-label="Inspect response time" type="number" step="any" value="0"></label><button data-action="inspect" type="button">Inspect output</button></div><p data-part="inspection" role="status"></p>
    <details><summary>Conventions and calculation limits</summary><p>Gain entry uses the visual fraction and power controls, with decimals, visible grouping and proper degree≤2 rational expressions; the plant must reduce to the declared family. Input≤256 characters,96 atoms,12 nested levels,9 digits/6 decimal places per literal, literal magnitude≤1000. Unsupported symbols, hidden grouping, mixed-number/adjacent-number ambiguity, nonfinite values and undefined powers reject.</p><p>Full characteristic: s³+(a+p)s²+(ap+Kb)s+Kbz. All factors/poles are retained even at a pole-zero cancellation; no hidden-state stability claim follows from a reduced transfer. Positive coefficients give the full cubic condition (a+p)(ap+Kb)&gt;Kbz. A relative Routh margin within10⁻⁹ is reported as boundary/uncertain, and no final-value ramp limit is asserted there.</p><p>H=0.1–200s. Simple poles only for transients: relative gaps&gt;10⁻⁵, modal coefficient sum≤10⁵. Initial-value and three rational reconstruction checks gate results. At most16,384 time intervals; halving and midpoint interpolation must agree to10⁻⁴ output units/seconds. These are numerical consistency checks, not interval-certified extrema. Settling needs a future sum-of-modal-magnitudes envelope; a last in-band sample does not suffice. A peak remains horizon-qualified unless its future is excluded. Near-target margins remain not established. Repeated/near-coincident modes, excess work or unresolved refinement receive feedback.</p></details></section>`;
  container.append(root);
  const part = (name: string) => root.querySelector<HTMLElement>(`[data-part="${name}"]`)!;
  const input = (name: string) => root.querySelector<HTMLInputElement>(`[data-control="${name}"]`)!;
  const select = (name: string) => root.querySelector<HTMLSelectElement>(`[data-control="${name}"]`)!;
  const read = (name: string, label: string, minimum: number, maximum: number) => { const value = readNumericInput(input(name), label); if (value < minimum || value > maximum) throw new Error(`${label} must be from ${minimum} to ${maximum}.`); return value; };
  let baselineResponse: Response | undefined, fullResponse: Response | undefined, horizon = 20;
  const clear = () => { baselineResponse = fullResponse = undefined; for (const name of ['prediction', 'reasoning', 'table', 'roots', 'placement', 'poles', 'angle', 'response', 'inspection']) part(name).replaceChildren(); };
  const plant = createEquationInput({ label: 'Plant gain G(s)', value: String.raw`\frac{1}{s(s+2)}`, signal, onChange: () => { clear(); part('feedback').textContent = 'Plant edited. Check the complete design again.'; } }); part('plant').append(plant.element);
  const readDesign = (): Design => {
    const value = plant.getValue();
    if (value.empty) throw new Error('Enter the plant gain.'); if (value.hasPlaceholders) throw new Error('Complete the plant fraction or power boxes.'); if (value.syntaxIssues.length) throw new Error('Check the plant equation notation.');
    return { ...parsePlant(value.latex), k: read('k', 'Proportional gain', .05, 100), lag: input('lag').checked, p: read('p', 'Lag pole rate', .001, 5), z: read('z', 'Lag zero rate', .001, 5) };
  };
  const eq = (parent: HTMLElement, latex: string, label: string) => parent.append(createEquationDisplay(latex, label));
  const reset = () => { clear(); plant.setValue(String.raw`\frac{1}{s(s+2)}`); for (const [name, value] of Object.entries({ k: '4', p: '.01', z: '.1', kv: '20', mp: '20', ts: '4.5', horizon: '20', time: '0' })) input(name).value = value; input('lag').checked = false; select('band').value = '.02'; select('prediction').value = ''; part('feedback').textContent = 'Baseline restored: proportional C₀=4, unit-ramp reference. Check the complete design to reveal results.'; };
  function inspect() {
    if (!baselineResponse) throw new Error('Check a valid design before inspecting the response.');
    const time = read('time', 'Inspection time', 0, horizon);
    part('inspection').textContent = `At t=${fmt(time)}s: proportional reference y=${fmt(baselineResponse.value(time))}; chosen full loop ${fullResponse ? `y=${fmt(fullResponse.value(time))}` : 'response unavailable (see full-model feedback)'}.`;
  }
  function compute() {
    clear();
    const d = readDesign(), targetKv = read('kv', 'Required Kv', .05, 10000), targetMp = read('mp', 'Overshoot limit', 0, 99), targetTs = read('ts', 'Settling limit', .1, 200);
    horizon = read('horizon', 'Measurement horizon', .1, 200); const band = Number(select('band').value), m = model(d), issues: string[] = [];
    let baseMetrics: Metrics | undefined, fullMetrics: Metrics | undefined;
    baselineResponse = response([d.k * d.b], m.baselineDenominator, m.baselineRoots);
    try { baseMetrics = measure(baselineResponse, horizon, band); } catch (error) { issues.push(`Reference response: ${(error as Error).message}`); }
    if (m.stability === 'stable') {
      try { fullResponse = d.lag ? response(m.numerator, m.denominator, m.fullRoots) : baselineResponse; fullMetrics = d.lag ? measure(fullResponse, horizon, band) : baseMetrics; } catch (error) { issues.push(`Full response: ${(error as Error).message}`); fullResponse = undefined; }
    } else issues.push(`Full loop is ${m.stability === 'unstable' ? 'unstable' : 'on/near the Routh boundary'}. Step targets and the final ramp limit are not established.`);
    const baseAssessment = assess(baseMetrics, targetMp, targetTs), fullAssessment = assess(fullMetrics, targetMp, targetTs);
    const kvDifference = m.kv - targetKv, kvTolerance = 1e-10 * Math.max(1, m.kv, targetKv);
    const accuracy = m.stability === 'unstable' ? 'failed' : m.stability === 'boundary' ? 'unknown' : m.kv === targetKv ? 'met' : Math.abs(kvDifference) <= kvTolerance ? 'unknown' : kvDifference > 0 ? 'met' : 'failed';
    const transient = m.stability === 'unstable' ? 'failed' : fullAssessment.all;
    const prediction = accuracy === 'unknown' || transient === 'unknown' ? 'unknown' : accuracy === 'met' && transient === 'met' ? 'both' : accuracy === 'met' ? 'accuracy' : transient === 'met' ? 'transient' : 'neither';
    part('prediction').textContent = `Accuracy: ${accuracy}. Full step targets: ${transient}. ${select('prediction').value ? select('prediction').value === prediction ? 'Your prediction agrees.' : 'Review your prediction using the complete roots and measured response.' : 'Choose a prediction before your next experiment.'}`;
    if (accuracy === 'unknown' && m.stability === 'stable') part('prediction').append(text('span', ' The Kv difference is within the relative10⁻¹⁰ comparison margin; it is not counted as a pass.'));
    const reasoning = part('reasoning');
    eq(reasoning, `K_{v,0}=\\frac{Kb}{a}=${num(m.baselineKv)},\\quad K_v=${d.lag ? 'K_{v,0}\\frac{z}{p}' : 'K_{v,0}'}=${num(m.kv)}`, 'Velocity constants for the applied controller');
    reasoning.append(text('p', d.lag ? `The chosen section multiplies low-frequency gain by z/p=${fmt(m.beta)}. The current requirement needs a ratio of at least ${fmt(targetKv / m.baselineKv)}. This accuracy relation alone does not preserve the transient response.` : 'Lag is disabled: C=C₀=K, so the accuracy ratio is 1. The p/z entries are a design draft.'));
    eq(reasoning, m.rampError === undefined ? 'e_{\\mathrm{ramp},\\infty}\\;\\mathrm{not\\ established}' : `e_{\\mathrm{ramp},\\infty}=\\frac{1}{K_v}=${num(m.rampError)}`, 'Unit-ramp final error, only for the strictly stable full loop');
    if (d.lag) { eq(reasoning, 'D(s)=s^3+(a+p)s^2+(ap+Kb)s+Kbz', 'Complete characteristic before numeric substitution'); eq(reasoning, `\\rho=(a+p)(ap+Kb)-Kbz\\approx${num(m.routh)}`, 'Full cubic Routh numerator'); }
    eq(reasoning, `T(s)\\approx\\frac{${polynomial(m.numerator)}}{${polynomial(m.denominator)}}`, 'Full unit-step transfer, coefficients rounded to seven significant digits');
    const table = document.createElement('table'); table.innerHTML = '<thead><tr><th>Check</th><th>Proportional reference</th><th>Chosen full loop</th></tr></thead>'; const body = document.createElement('tbody');
    const targetSummary = `Retained targets: Kv≥${fmt(targetKv)}s⁻¹; overshoot≤${fmt(targetMp)}%; ${fmt(band * 100)}% settling≤${fmt(targetTs)}s.`;
    table.prepend(text('caption', targetSummary));
    const cell = (label: string, base: string, full: string) => { const row = document.createElement('tr'); for (const v of [label, base, full]) row.append(text('td', v)); body.append(row); };
    cell('Velocity constant Kv (s⁻¹)', fmt(m.baselineKv), fmt(m.kv)); cell('Unit-ramp final error (output units)', fmt(1 / m.baselineKv), m.rampError === undefined ? 'Not established' : fmt(m.rampError));
    const os = (v?: Metrics) => v ? `${fmt(v.overshoot * 100)}% ${v.peakEstablished ? '(future larger peak ruled out)' : '(observed through H)'}` : 'Not established';
    cell('Step overshoot', os(baseMetrics), os(fullMetrics)); cell(`${fmt(band * 100)}% measured settling (s)`, baseMetrics?.settling === undefined ? 'Not established in H' : fmt(baseMetrics.settling), fullMetrics?.settling === undefined ? 'Not established in H' : fmt(fullMetrics.settling));
    cell('Retained overshoot / settling targets', `${baseAssessment.overshoot} / ${baseAssessment.settling}`, `${fullAssessment.overshoot} / ${fullAssessment.settling}`); cell('Future output envelope at H', baseMetrics ? fmt(baseMetrics.tail) : 'Unavailable', fullMetrics ? fmt(fullMetrics.tail) : 'Unavailable');
    table.append(body); part('table').append(table);
    part('roots').append(text('h3', `Complete full-loop poles — ${m.stability}`), text('p', m.fullRoots.map(pole).join('; ')), text('p', `Proportional reference poles: ${m.baselineRoots.map(pole).join('; ')}. Numerator zeros do not remove poles from this list.`));
    part('placement').append(placement(d, m)); part('poles').append(polePlot(d, m));
    part('angle').textContent = d.lag ? `At the original upper reference pole ${pole(m.s0)}: chosen-section angle ${fmt(m.angle)}°, magnitude ${fmt(m.magnitude)}. A magnitude-only gain adjustment would be K=${fmt(m.magnitudeGain)}. Magnitude alone does not put the original point on the compensated locus; its angle must agree too.` : `Lag is disabled. Original upper reference pole ${pole(m.s0)}; applied section 1 has angle0° and magnitude1. Enable lag to inspect the draft section’s vectors.`;
    part('response').append(text('p', targetSummary), transientPlot(baseMetrics, fullMetrics, horizon, band, d.lag));
    if (!fullMetrics) part('response').append(text('p', `Chosen full response unavailable. ${issues.join(' ')}`));
    if (fullMetrics) part('response').append(text('p', `Full response used ${fullMetrics.intervals} intervals; midpoint interpolation discrepancy ${fmt(fullMetrics.interpolationError)}. Settling requires the future modal envelope, not the last sample. The added real pole/zero changes all full-loop roots and modal weights; a small angle change can still leave a measurable slow tail.`));
    part('feedback').textContent = issues.join(' ') || 'Complete model checked. Compare accuracy with the retained transient requirements before accepting this lag.';
  }
  root.addEventListener('input', event => { const control = (event.target as HTMLElement).dataset?.control; if (control && control !== 'time' && control !== 'prediction') { clear(); part('feedback').textContent = 'Data changed. Check the complete design again.'; } }, { signal });
  root.addEventListener('change', event => { const control = (event.target as HTMLElement).dataset?.control; if (control === 'band' || control === 'lag') { clear(); part('feedback').textContent = 'Data changed. Check the complete design again.'; } }, { signal });
  root.addEventListener('click', event => {
    const b = (event.target as Element).closest<HTMLButtonElement>('button[data-action]'); if (!b) return;
    try {
      if (b.dataset.action === 'reset') reset();
      else if (b.dataset.action === 'lag') { clear(); input('lag').checked = true; input('p').value = '.01'; input('z').value = '.1'; part('feedback').textContent = 'Proposed lag selected. Plant, K and retained targets are unchanged; check the complete design.'; }
      else if (b.dataset.action === 'near') { const p = read('p', 'Lag pole rate', .001, 5), z = read('z', 'Lag zero rate', .001, 5); if (p / 5 < .001) throw new Error('Moving both corners five times closer would exceed p≥0.001.'); clear(); input('lag').checked = true; input('p').value = String(p / 5); input('z').value = String(z / 5); part('feedback').textContent = 'Both corners moved five times closer to zero, preserving z/p. Recheck actual settling; the slower mode also has a different residue.'; }
      else if (b.dataset.action === 'suggest') { const d = readDesign(), requirement = read('kv', 'Required Kv', .05, 10000), ratio = requirement * d.a / (d.k * d.b), z = ratio * d.p; if (ratio <= 1) throw new Error('The proportional reference already meets this Kv target; no lag accuracy ratio above one is needed.'); if (ratio > 1000 || z > 5) throw new Error('This p requires a zero outside the supported bounds. Choose a smaller p or revise the gain/target.'); clear(); input('z').value = String(z); input('lag').checked = true; part('feedback').textContent = 'Zero chosen from the required accuracy ratio. Check full stability and transients before accepting it.'; }
      else if (b.dataset.action === 'compute') compute();
      else if (b.dataset.action === 'inspect') inspect();
    } catch (error) { if (b.dataset.action === 'compute') clear(); part(b.dataset.action === 'inspect' ? 'inspection' : 'feedback').textContent = (error as Error).message; }
  }, { signal });
  reset(); return () => { plant.destroy(); root.remove(); };
};
