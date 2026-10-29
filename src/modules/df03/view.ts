import type { ModuleMount } from '../../core/module';
import { createEquationDisplay, createEquationInput, type EquationDraft } from '../../shared/equations/input';
import { readNumericInput } from '../../shared/numeric-input';
import { analyzeFrequency, emulatePI, frequency, poleStatus, sampledResponse, samplePeriod, unitPoint, type FrequencyAnalysis, type Model, type Response } from './math';
import { parseModel } from './input';
import { complex, decimal, loopLatex, number as n, polynomial } from './format';
import { frequencyPlot, polePlot, responsePlot, type Axis } from './plots';
import './style.css';

function say(parent: Element, text: string, tag = 'p') { const e = document.createElement(tag); e.textContent = text; parent.append(e); return e; }
function table(headings: string[], rows: string[][], label: string) {
  const scroll = document.createElement('div'); scroll.className = 'fq-scroll'; scroll.tabIndex = 0; scroll.setAttribute('role', 'region'); scroll.setAttribute('aria-label', label);
  const t = document.createElement('table'), head = document.createElement('thead'), hrow = document.createElement('tr'), body = document.createElement('tbody');
  headings.forEach(text => { const cell = document.createElement('th'); cell.scope = 'col'; cell.textContent = text; hrow.append(cell); }); head.append(hrow);
  rows.forEach(row => { const tr = document.createElement('tr'); row.forEach(text => { const td = document.createElement('td'); td.textContent = text; tr.append(td); }); body.append(tr); });
  t.append(head, body); scroll.append(t); return scroll;
}
interface Targets { bandwidth: number; pm: number; overshoot: number; settling: number }
interface Prepared { model: Model; T: number; samples: number; targets: Targets; analysis?: FrequencyAnalysis; frequencyError?: string; response?: Response; responseError?: string; provenance: string | null; revealed: boolean }
const baseline = String.raw`\frac{0.5}{z-0.8}`;
const numeric = (id: string, label: string, value: number, min: number, max: number, step: string = 'any') => `<label>${label}<input data-number="${id}" type="number" value="${value}" min="${min}" max="${max}" step="${step}"></label>`;

export const mount: ModuleMount = ({ container, signal }) => {
  if (signal.aborted) return;
  const root = document.createElement('div'); root.className = 'fq-tool';
  root.innerHTML = `<section class="fq-card"><h3>Read the actual sampled loop</h3><p>Edit L(z)=N(z)/D(z), with a degree 1 or 2 denominator and a strictly smaller numerator degree. Negative unity feedback gives H(z)=N(z)/(D(z)+N(z)). All full-loop poles are retained.</p><div class="fq-editor"></div><div class="fq-controls">
    ${numeric('period', 'Sample period T (s)', .1, .001, 10)}${numeric('samples', 'Response intervals N', 100, 10, 2000, '1')}
    ${numeric('targetBandwidth', 'Minimum bandwidth target (rad/s)', 5, 0, 1e6)}${numeric('targetPM', 'Minimum phase-margin target (degrees)', 45, 0, 180)}
    ${numeric('targetOvershoot', 'Maximum overshoot target (%)', 10, 0, 1000)}${numeric('targetSettling', 'Maximum settling target (s)', 1, .001, 20000)}</div>
    <div class="fq-actions"><button data-action="prepare">Prepare exercise</button><button data-preset="baseline">Load baseline</button><button data-preset="resonance">Load two-crossing loop</button><button data-preset="cancelled">Load cancelled-mode loop</button></div>
    <details><summary>Build an actual sampled PI loop from a physical precursor</summary><p>Use P(s)=g/(τs+1), C(s)=Kp+Ki/s. At each tick read the error, update the PI rule, then hold u until the next tick. The physical plant is discretized with exact ZOH; the controller uses the selected integrator. The resulting discrete loop replaces the field above. Only that actual discrete loop is assessed.</p><div class="fq-controls">
    ${numeric('physicalGain', 'Physical plant gain g', 1, .05, 20)}${numeric('tau', 'Physical time constant τ (s)', 1, .01, 10)}${numeric('kp', 'PI proportional gain Kp', 2, 0, 20)}${numeric('ki', 'PI integral gain Ki (1/s)', 1, .001, 20)}
    <label>PI integrator<select data-choice="method"><option value="backward">Backward Euler: Tz/(z−1)</option><option value="trapezoidal">Trapezoidal: T(z+1)/(2(z−1))</option></select></label></div><div class="fq-actions"><button data-action="emulate">Build sampled PI exercise</button></div></details>
    <p class="fq-message" role="status">Prepare an exercise, predict the result, then check it.</p></section>
    <section class="fq-card fq-attempt" hidden><h3>Predict before checking</h3><div class="fq-controls"><label>Full closed-loop poles<select data-choice="stability"><option value="">Choose a prediction</option><option value="inside">All strictly inside the disk</option><option value="boundary">On/within the boundary tolerance</option><option value="outside">At least one outside the disk</option></select></label>
    <label>Unit-gain crossing set<select data-choice="crossings"><option value="">Choose a prediction</option><option value="0">No crossing</option><option value="1">One frequency</option><option value="2">Two frequencies</option><option value="continuum">A continuum of frequencies</option></select></label>
    <label>Does phase margin exactly determine discrete overshoot?<select data-choice="identity"><option value="">Choose a prediction</option><option value="no">No; check the actual sampled response</option><option value="yes">Yes; it is an exact discrete identity</option></select></label></div><div class="fq-actions"><button data-action="reveal">Check predictions and reveal</button></div></section>
    <div class="fq-results" hidden><section class="fq-card"><h3>Full feedback model and targets</h3><p class="fq-grade" role="status"></p><div class="fq-model"></div><div class="fq-targets"></div></section>
    <section class="fq-card"><h3>Crossovers, margins and bandwidth</h3><div class="fq-crossings"></div></section>
    <section class="fq-card"><h3>Unit-circle cursor and frequency axes</h3><div class="fq-controls">${numeric('cursor', 'Cursor Ω (rad/sample)', .5, 0, Math.PI)}<label>Plot frequency axis<select data-choice="axis"><option value="angle">Ω (rad/sample)</option><option value="omega">Physical ω (rad/s)</option><option value="hz">Physical f (Hz)</option><option value="warped">Bilinear warped ν (rad/s)</option></select></label></div><div class="fq-cursor-readout"></div><div class="fq-scroll fq-frequency-db" role="region" aria-label="Magnitude plot, scroll horizontally" tabindex="0"></div><div class="fq-scroll fq-frequency-phase" role="region" aria-label="Phase plot, scroll horizontally" tabindex="0"></div><div class="fq-scroll fq-poles" role="region" aria-label="Pole and unit-circle plot, scroll horizontally" tabindex="0"></div>
    <p class="fq-note">Each frequency curve uses 401 display points; the crossing table comes from the complete algebraic equations. dB values beyond ±80 are clipped. Singular samples are gaps. Principal phase wraps are disconnected. The warped plot ends at Ω=0.98π; Nyquist itself maps to ν=∞. Physical ω and warped ν have different meanings.</p></section>
    <section class="fq-card"><h3>Actual sampled unit-step response</h3><div class="fq-response"></div><div class="fq-scroll fq-response-plot" role="region" aria-label="Sampled response plot, scroll horizontally" tabindex="0"></div><div class="fq-controls">${numeric('sample', 'Inspect sample k', 0, 0, 2000, '1')}</div><div class="fq-sample-readout"></div><p class="fq-note">Zero state, unit reference step at k=0, y[0]=0. Markers are samples; there is no assumed intersample output. Overshoot is the maximum observed by NT. Rise is the first sampled 10–90% crossing. A settling candidate is based only on subsequent observed samples in the2% band; it does not prove the infinite tail.</p></section></div>
    <details class="fq-card"><summary>Supported mathematics and limits</summary><p>Real strictly proper rational loops with denominator degree 1 or 2. Coefficients are normalized to a monic denominator, descending powers of z; no pole cancellation. Each nonzero normalized coefficient has magnitude1e−9 to100. Visual inputs accept decimals, fractions, polynomial factors, visible parentheses and literal powers0–2; no function-name labels, e/E symbols, hidden grouping or mixed-number adjacency. Use explicit + or × around fractions.</p><p>T=.001–10s, N=10–2000 integer intervals. Output magnitude is bounded by 10¹²; growth gives no partial response metrics. A conservative modal roundoff-amplification estimate above 1e−7×max(1,|y|) also makes the response unavailable, rather than displaying cancellation noise. It may require a shorter horizon. Disk boundary band1e−9. Crossing cosine endpoints use a64-epsilon rounding band; unresolved near-double frequency roots receive feedback. All displayed pole/crossing values are numerical approximations of the stated identities. Magnitude zeros have phase undefined; poles and unreduced0/0 points are reported. A GM factor is the positive gain multiplier reaching a negative-real intersection. Signed PM is the nearest negative-axis phase reserve in(−180,180]degrees. These geometric margins alone do not prove stability, especially with open-loop unstable poles, multiple crossings or cancellations. Check every full D+N pole.</p><p>Bandwidth uses the first downward−3dB threshold relative to a finite nonzero stable closed-loop DC gain (squared ratio10^(−3/10)). It can be unresolved beyond Nyquist or undefined. A continuous second-order PM/overshoot relation is a model-dependent heuristic, not an exact sampled-loop identity. PI builder bounds: g=.05–20,τ=.01–10s,Kp=0–20,Ki=.001–20s⁻¹,T/τ≤20, plus the same normalized coefficient limits. The builder uses actual discrete coefficients; it does not supply a continuous-only design guarantee.</p></details>`;
  container.append(root);
  const get = <T extends Element = HTMLElement>(selector: string) => root.querySelector<T>(selector)!;
  const field = (id: string) => get<HTMLInputElement>(`[data-number="${id}"]`), choice = (id: string) => get<HTMLSelectElement>(`[data-choice="${id}"]`);
  const message = get('.fq-message'), results = get('.fq-results'), attempt = get('.fq-attempt');
  let prepared: Prepared | null = null, provenance: string | null = null, draft: EquationDraft;
  const invalidate = () => { prepared = null; results.hidden = true; attempt.hidden = true; message.textContent = 'Inputs changed. Prepare and predict a fresh exercise.'; };
  const newEditor = (value: string) => createEquationInput({ label: 'Discrete loop L(z), without a function-name label', value, signal, onChange: next => { draft = next; provenance = null; invalidate(); } });
  let editor = newEditor(baseline);
  get('.fq-editor').append(editor.element); draft = editor.getValue();
  // A whole-model preset starts a fresh caller-owned editing session. This
  // releases selection/keyboard modes as well as the old component's resources.
  // It also avoids carrying MathLive's Escape-induced latex mode across a model
  // replacement in preserved shared-component versions.
  const replaceEquation = (value: string) => {
    editor.destroy(); editor = newEditor(value); get('.fq-editor').append(editor.element); draft = editor.getValue();
  };
  const read = (id: string, label: string, lo: number, hi: number) => { const x = readNumericInput(field(id), label); if (x < lo || x > hi) throw new Error(`${label} must be between ${lo} and ${hi}.`); return x; };
  const prepare = () => {
    invalidate();
    try {
      if (draft.empty || draft.hasPlaceholders) throw new Error('Complete the loop numerator and denominator.');
      if (draft.syntaxIssues.length) throw new Error('Check the visual equation notation before preparing.');
      const model = parseModel(draft.latex), T = samplePeriod(readNumericInput(field('period'), 'sample period T'));
      const samples = read('samples', 'Response interval count', 10, 2000); if (!Number.isInteger(samples)) throw new Error('Use an integer response interval count.');
      const targets = { bandwidth: read('targetBandwidth', 'Bandwidth target (rad/s)', 0, 1e6), pm: read('targetPM', 'Phase-margin target (degrees)', 0, 180), overshoot: read('targetOvershoot', 'Overshoot target (%)', 0, 1000), settling: read('targetSettling', 'Settling target (s)', .001, 20000) };
      prepared = { model, T, samples, targets, provenance, revealed: false };
      try { prepared.analysis = analyzeFrequency(model, T); } catch (error) { prepared.frequencyError = (error as Error).message; }
      try { prepared.response = sampledResponse(model, T, samples); } catch (error) { prepared.responseError = (error as Error).message; }
      for (const id of ['stability', 'crossings', 'identity']) choice(id).value = '';
      attempt.hidden = false; message.textContent = `Exercise prepared with T=${n(T)}s and ${samples} response intervals. Make three predictions before revealing.`;
    } catch (error) { message.textContent = (error as Error).message; }
  };
  const renderSample = () => {
    const area = get('.fq-sample-readout'); area.replaceChildren();
    if (!prepared?.revealed) return;
    const r = prepared.response; field('sample').disabled = !r; if (!r) return;
    try {
      const k = read('sample', 'Sample k', 0, prepared.samples); if (!Number.isInteger(k)) throw new Error('Use an integer sample k.');
      area.append(table(['k', 't=kT (s)', 'y[k]', 'r[k]−y[k]', 'y[k−1]'], [[String(k), n(k * prepared.T), n(r.values[k]), n(1 - r.values[k]), k ? n(r.values[k - 1]) : 'Zero prehistory']], 'Selected actual response sample'));
    } catch (error) { say(area, (error as Error).message); }
  };
  const renderCursor = () => {
    const area = get('.fq-cursor-readout'); area.replaceChildren();
    for (const selector of ['.fq-frequency-db', '.fq-frequency-phase', '.fq-poles']) get(selector).replaceChildren();
    if (!prepared?.revealed) return;
    try {
      const angle = read('cursor', 'Cursor Ω (rad/sample)', 0, Math.PI), T = prepared.T, f = frequency(prepared.model, angle, T), closed = frequency({ denominator: prepared.model.closed, numerator: prepared.model.numerator }, angle, T);
      const point = unitPoint(angle);
      area.append(table(['Ω (rad/sample)', 'ω (rad/s)', 'f (Hz)', 'Warped ν (rad/s)', 'z on unit circle'], [[n(angle), n(f.omega), n(f.hz), n(f.warped), `${n(point.re)} + j(${n(point.im)})`]], 'Exact requested unit-circle coordinates'));
      area.append(table(['Response at requested Ω', 'Status', 'Real', 'Imaginary', 'Magnitude', 'dB', 'Principal phase (degrees)'], [['L', f.status, n(f.value?.re ?? null), n(f.value?.im ?? null), n(f.magnitude), n(f.db), n(f.phase)], ['H=N/(D+N)', closed.status, n(closed.value?.re ?? null), n(closed.value?.im ?? null), n(closed.magnitude), n(closed.db), n(closed.phase)]], 'Direct complex frequency values'));
      if (f.status === 'pole' || f.status === 'indeterminate') say(area, 'The unreduced loop is singular here. No finite cursor phase or margin is invented.');
      if (f.status === 'finite' && Math.abs(f.value!.im) <= 1e-10 * f.magnitude! && f.value!.re < 0) say(area, `Negative-real cursor: gain multiplier to the critical point = ${n(1 / f.magnitude!)} (${n(-f.db!)}dB).`);
      const axis = choice('axis').value as Axis;
      get('.fq-frequency-db').append(frequencyPlot(prepared.model, T, angle, axis, 'db', prepared.analysis));
      get('.fq-frequency-phase').append(frequencyPlot(prepared.model, T, angle, axis, 'phase', prepared.analysis));
      get('.fq-poles').append(polePlot(prepared.model, angle));
      if (axis === 'warped' && angle > .98 * Math.PI) say(area, 'This cursor is beyond the finite warped plot; its direct values above still apply. Nyquist maps to infinite warped frequency.');
    } catch (error) { say(area, (error as Error).message); }
  };
  const renderFrequency = (p: Prepared) => {
    const area = get('.fq-crossings'); area.replaceChildren(); const a = p.analysis;
    if (!a) { say(area, p.frequencyError ?? 'Frequency crossing set unavailable.'); return; }
    say(area, 'Solve |N(exp(jΩ))|²−|D(exp(jΩ))|²=0 in c=cosΩ for all gain intersections. Negative-real intersections solve Im(N·conj(D))=0 and Re(L)<0. Endpoints0 andπ are included. Numerical endpoints use the stated rounding band.');
    if (a.gain.continuum) say(area, 'Unit-gain continuum: every nonsingular Ω in[0,π] has |L|=1. There is no single phase-margin frequency; use the exact cursor for its phase reserve.');
    else if (!a.gain.points.length) say(area, 'No unit-gain crossing in[0,π]; phase margin is undefined.');
    else area.append(table(['Gain crossing Ω', 'ω (rad/s)', 'Type', '|L|', 'Phase (degrees)', 'Signed PM (degrees)'], a.gain.points.map((point, i) => [n(point.angle), n(point.angle / p.T), point.kind, n(point.value.magnitude), n(point.value.phase), n(a.phaseMargins[i].degrees)]), 'All unit-gain crossings and signed phase margins'));
    if (a.phase.continuum) {
      say(area, 'A continuum of negative-real intersections exists on the intervals below. The critical gain multiplier varies with Ω; use its direct cursor value. A finite list is not the complete margin set.');
      area.append(table(['Negative-axis interval Ω (rad/sample)', 'Critical multiplier along interval'], (a.phase.intervals ?? []).map(interval => [`${interval.fromIncluded ? '[' : '('}${n(interval.from)}, ${n(interval.to)}${interval.toIncluded ? ']' : ')'}`, '1/|L(exp(jΩ))|; endpoints follow inclusion signs']), 'Complete negative-real continuum intervals'));
    } else if (!a.phase.points.length) say(area, 'No finite negative-real intersection in[0,π]: geometric gain margin is infinite. This alone does not prove closed-loop stability.');
    if (a.phase.points.length) area.append(table(['Negative-axis Ω', 'ω (rad/s)', '|L|', 'Critical gain factor', 'GM (dB)'], a.phase.points.map((point, i) => [n(point.angle), n(point.angle / p.T), n(point.value.magnitude), n(a.gainMargins[i].factor), n(a.gainMargins[i].db)]), a.phase.continuum ? 'Included continuum endpoints, not a finite margin list' : 'All negative-real crossings and gain margins'));
    if (a.singular.length) area.append(table(['On/near-circle open pole Ω', 'Direct evaluation'], a.singular.map(f => [n(f.angle), f.status]), 'Unreduced loop circle singularities'));
    say(area, `Closed-loop bandwidth: ${a.bandwidth.status === 'finite' ? `${n(a.bandwidth.angle! / p.T)}rad/s, Ω=${n(a.bandwidth.angle)}` : a.bandwidth.status === 'beyond' ? 'beyond/unresolved at Nyquist' : 'undefined'}. ${a.bandwidth.reason}`);
    if (a.bandwidth.points.length) area.append(table(['All −3dB threshold Ω', 'ω (rad/s)', 'Type'], a.bandwidth.points.map(point => [n(point.angle), n(point.angle / p.T), point.kind]), 'All closed-loop bandwidth threshold intersections'));
  };
  const renderTargets = (p: Prepared) => {
    const area = get('.fq-targets'); area.replaceChildren(); const a = p.analysis, r = p.response, target = p.targets, nyquist = Math.PI / p.T;
    say(area, `Sampling frequency=${n(1 / p.T)}Hz; Nyquist=${n(nyquist)}rad/s (${n(.5 / p.T)}Hz). Target bandwidth ${n(target.bandwidth)}rad/s corresponds to Ω=${n(target.bandwidth * p.T)}rad/sample.`);
    say(area, target.bandwidth >= nyquist ? 'The requested target is at/above Nyquist. It cannot describe a resolved unique sampled-frequency bandwidth at this T.' : a?.bandwidth.status === 'finite' ? `Bandwidth target: ${a.bandwidth.angle! / p.T >= target.bandwidth ? 'met' : 'not met'} by the actual closed-loop −3dB crossing.` : 'Bandwidth target is not certified: there is no finite supported bandwidth result.');
    say(area, a && !a.gain.continuum && a.phaseMargins.length ? `Phase reserve target: ${a.phaseMargins.every(m => m.degrees >= target.pm) ? 'met at every listed crossing' : 'not met at every listed crossing'} (minimum target ${n(target.pm)} degrees). Full poles still determine stability.` : 'Phase reserve target is undefined or a continuum; no single phase-margin target pass is claimed.');
    say(area, r?.overshoot !== null && r?.overshoot !== undefined ? `Observed overshoot ${n(r.overshoot)}% by ${n(r.lastSample)}s ${r.overshoot > target.overshoot ? 'violates' : 'does not violate'} the ${n(target.overshoot)}% target within this horizon. This does not bound a later peak.` : 'Overshoot target is not assessed without a supported nonzero stable limit and complete response.');
    say(area, r?.settlingCandidate !== null && r?.settlingCandidate !== undefined ? `Observed 2% settling candidate ${n(r.settlingCandidate)}s ${r.settlingCandidate <= target.settling ? 'is within' : 'exceeds'} the ${n(target.settling)}s target. The infinite tail is not certified.` : 'Settling target remains unresolved within the available horizon/limit conditions.');
    say(area, 'A continuous PM/overshoot rule is not an exact discrete identity. Multiple poles/zeros, sampling and the actual discrete controller all matter; compare the actual response below with the requested targets.');
  };
  const reveal = () => {
    if (!prepared) return;
    if (['stability', 'crossings', 'identity'].some(id => !choice(id).value)) { message.textContent = 'Choose all three predictions before checking.'; return; }
    const p = prepared, a = p.analysis, crossAnswer = a ? a.gain.continuum ? 'continuum' : String(a.gain.points.length) : null;
    p.revealed = true; results.hidden = false;
    get('.fq-grade').textContent = `${choice('stability').value === p.model.stability ? 'Correct full-pole prediction.' : `Revisit the full-pole prediction: ${p.model.stability}.`} ${crossAnswer === null ? 'The crossing prediction cannot be graded: review its precision feedback.' : choice('crossings').value === crossAnswer ? 'Correct crossing-set prediction.' : `Revisit the gain crossing set: ${crossAnswer}.`} ${choice('identity').value === 'no' ? 'Correct: PM alone is not an exact overshoot identity.' : 'Check the actual sampled response; the continuous heuristic is not an exact identity.'}`;
    const modelArea = get('.fq-model'); modelArea.replaceChildren();
    modelArea.append(createEquationDisplay(`L(z)\\approx${loopLatex(p.model, 8)},\\quad H(z)\\approx\\frac{${polynomial(p.model.numerator, 8)}}{${polynomial(p.model.closed, 8)}}`, 'Actual loop and negative-unity-feedback transfer, coefficients shown to eight significant digits'));
    modelArea.append(table(['Full D+N pole ≈', '|z| ≈', 'This pole in the disk'], p.model.poles.map(pole => [complex(pole), n(Math.hypot(pole.re, pole.im)), poleStatus(pole)]), 'Every full closed-loop pole'));
    say(modelArea, 'No pole is removed by transfer cancellation. Boundary means within the 1e−9 unit-radius band; it is not a certificate of asymptotic stability. Geometric margins do not replace this full-pole check.');
    if (p.provenance) say(modelArea, p.provenance);
    renderFrequency(p); renderTargets(p);
    const responseArea = get('.fq-response'); responseArea.replaceChildren(); get('.fq-response-plot').replaceChildren();
    if (p.response) {
      const r = p.response;
      responseArea.append(createEquationDisplay(`y[k]\\approx${p.model.closed.slice(1).map((q, i) => `${i ? '+' : ''}(${decimal(Number((-q).toPrecision(8)))})y[k-${i + 1}]`).join('')}+\\sum_{i=1}^{${p.model.closed.length - 1}}b_i r[k-i]`, 'Zero-state closed-loop sample recurrence, coefficients shown to eight significant digits'));
      const padded = Array(p.model.closed.length - p.model.numerator.length).fill(0).concat(p.model.numerator) as number[];
      say(responseArea, `Descending delay coefficients: q=[${p.model.closed.slice(1).map(x => n(x)).join(', ')}], b=[${padded.slice(1).map(x => n(x)).join(', ')}]. r[k]=1 for k≥0 and zero for k<0. y[k]=0 for k≤0 before its first causal output.`);
      responseArea.append(table(['Response horizon (s)', 'Stable modeled limit', 'Observed overshoot (%)', 'Sampled 10–90% rise (s)', 'Observed 2% settling candidate (s)'], [[n(r.lastSample), n(r.limit), n(r.overshoot), n(r.rise), n(r.settlingCandidate)]], 'Actual sampled transient measures'));
      get('.fq-response-plot').append(responsePlot(r));
    } else say(responseArea, p.responseError ?? 'Response unavailable.');
    field('sample').value = '0'; renderSample(); renderCursor(); message.textContent = 'Predictions checked. Inspect every crossing, full pole, target and actual response; unresolved cases retain their feedback.';
  };
  root.addEventListener('click', event => {
    const button = (event.target as Element).closest<HTMLButtonElement>('button'); if (!button) return;
    if (button.dataset.action === 'prepare') prepare();
    if (button.dataset.action === 'reveal') reveal();
    if (button.dataset.preset) {
      const selected = button.dataset.preset; provenance = null; invalidate();
      replaceEquation(selected === 'baseline' ? baseline : selected === 'resonance' ? String.raw`\frac{0.4z}{z^2-1.4z+0.9}` : String.raw`\frac{0.5(z-1)}{z(z-1)}`);
      field('period').value = '.1'; field('samples').value = '100'; message.textContent = 'Loop preset loaded. Prepare a fresh exercise.';
    }
    if (button.dataset.action === 'emulate') {
      invalidate(); provenance = null;
      try {
        const T = samplePeriod(readNumericInput(field('period'), 'sample period T')), method = choice('method').value as 'backward' | 'trapezoidal';
        const g = read('physicalGain', 'Physical gain g', .05, 20), tau = read('tau', 'Physical time constant', .01, 10), kp = read('kp', 'PI proportional gain', 0, 20), ki = read('ki', 'PI integral gain', .001, 20);
        const result = emulatePI({ T, method, g, tau, kp, ki }); replaceEquation(loopLatex(result.model));
        provenance = `Actual emulation: g=${n(g)},τ=${n(tau)}s,Kp=${n(kp)},Ki=${n(ki)}s⁻¹,T=${n(T)}s,${method}. ZOH a=exp(−T/τ)=${n(result.a)},b=g(1−a)=${n(result.b)}. D(z)=(z−a)(z−1); the displayed numerator includes the selected actual PI rule. This loop, not the continuous precursor, produced the checks and response.`;
        prepare();
      } catch (error) { message.textContent = (error as Error).message; }
    }
  }, { signal });
  root.addEventListener('input', event => { const id = (event.target as HTMLElement).dataset.number; if (!id) return; if (id === 'cursor') renderCursor(); else if (id === 'sample') renderSample(); else { provenance = null; invalidate(); } }, { signal });
  root.addEventListener('change', event => { const id = (event.target as HTMLElement).dataset.choice; if (id === 'axis') renderCursor(); else if (id === 'method') { provenance = null; invalidate(); } }, { signal });
  let disposed = false;
  const cleanup = () => { if (disposed) return; disposed = true; editor.destroy(); root.remove(); }; signal.addEventListener('abort', cleanup, { once: true }); return cleanup;
};
