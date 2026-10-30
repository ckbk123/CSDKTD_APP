import type { ModuleMount } from '../../core/module';
import { createEquationDisplay, createEquationInput, type EquationInput } from '../../shared/equations/input';
import { readNumericInput } from '../../shared/numeric-input';
import { parseNumber } from './number-expression';
import { analyze, bound, designLead, frequency, gainCrossover, model, requiredRatio, stepTrace, type Analysis, type Corners, type Loop, type Plant, type Trace } from './math';
import { plot } from './plot';
import './style.css';

const fmt = (n: number) => n === 0 ? '0' : Math.abs(n) < 1e-10 ? n.toExponential(3) : n.toLocaleString('en-US', { useGrouping: false, maximumSignificantDigits: 6 });
function el<K extends keyof HTMLElementTagNameMap>(tag: K, text?: string, className?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag); if (text !== undefined) e.textContent = text; if (className) e.className = className; return e;
}
interface Column { name: string; analysis: Analysis; trace?: Trace; responseError?: string }
export const mount: ModuleMount = ({ container, signal: parent }) => {
  if (parent.aborted) return;
  const lifetime = new AbortController(), signal = lifetime.signal, forward = () => lifetime.abort();
  parent.addEventListener('abort', forward, { once: true });
  const root = el('div', undefined, 'cd06'); root.dataset.module = 'CD06'; container.append(root);
  const editors: EquationInput[] = []; let disposed = false;
  const cleanup = () => { if (disposed) return; disposed = true; lifetime.abort(); parent.removeEventListener('abort', forward); editors.forEach(e => e.destroy()); root.remove(); };
  try {
    let ready = false, columns: Column[] = [], leadDraft = false;
    const feedback = el('p', 'Predict the required lag ratio, then reveal the checked design.', 'cd06-feedback'); feedback.setAttribute('role', 'status');
    function section(title: string): HTMLElement { const s = el('section'); s.append(el('h2', title)); root.append(s); return s; }
    function note(host: HTMLElement, text: string): void { host.append(el('p', text, 'cd06-note')); }
    function button(host: HTMLElement, label: string, action: () => void): HTMLButtonElement {
      const b = el('button', label); b.type = 'button'; host.append(b);
      b.addEventListener('click', () => { if (signal.aborted) return; b.after(feedback); try { action(); } catch (e) { feedback.textContent = e instanceof Error ? e.message : 'Check the inputs.'; } }, { signal }); return b;
    }
    function number(host: HTMLElement, label: string, value: string, min: string, max: string): HTMLInputElement {
      const l = el('label', label), input = el('input'); input.type = 'number'; input.step = 'any'; input.value = value; input.min = min; input.max = max; l.append(input); host.append(l); return input;
    }
    function dirty(): void {
      if (!ready || signal.aborted) return;
      columns = []; leadDraft = false; reasoning.replaceChildren(); results.replaceChildren(); auto.disabled = manual.disabled = verify.disabled = true;
      feedback.textContent = 'Inputs changed. Draft Bode curves update where valid; reveal again to check crossovers, poles and requirements.'; renderBode();
    }
    function corner(host: HTMLElement, label: string, value: string, min: number, max: number, action: () => void): HTMLInputElement {
      const input = number(host, label, value, String(min), String(max)), l = el('label', `Slide ${label.toLowerCase()}`), slider = el('input');
      slider.type = 'range'; slider.min = String(Math.log10(min)); slider.max = String(Math.log10(max)); slider.step = '.01';
      const sync = () => { const v = input.valueAsNumber; if (Number.isFinite(v) && v > 0) { slider.value = String(Math.log10(v)); slider.setAttribute('aria-valuetext', `${fmt(v)} rad/s`); } };
      sync(); l.append(slider); host.append(l);
      input.addEventListener('input', () => { sync(); action(); }, { signal });
      slider.addEventListener('input', () => { input.value = String(10 ** slider.valueAsNumber); slider.setAttribute('aria-valuetext', `${fmt(input.valueAsNumber)} rad/s`); action(); }, { signal });
      input.addEventListener('cd06-sync', sync, { signal }); return input;
    }
    const data = section('1. Set the tracking and frequency goals');
    note(data, 'Continuous SISO, negative unity feedback e = r − y, zero initial conditions. Normalized input/output units: g is in s⁻², a and all corners are in rad/s, C0 is dimensionless. The ramp slope is one output unit/s.');
    data.append(createEquationDisplay(String.raw`G(s)=\frac{g}{s(s+a)},\quad C_{\mathrm{lag}}(s)=C_0\frac{s+z_L}{s+p_L},\quad z_L\ge p_L>0`, 'Supported integrating plant and lag controller'));
    const equations = el('div', undefined, 'cd06-equations'); data.append(equations);
    for (const [label, value] of [['Plant numerator g (s⁻²)', '1'], ['Plant pole parameter a (rad/s)', '2'], ['Proportional gain C0', '4']]) {
      const editor = createEquationInput({ label, value, signal, onChange: dirty }); editors.push(editor); equations.append(editor.element);
    }
    note(data, 'Model boxes accept numbers, fractions, visible parentheses, +, −, explicit ×/÷ and integer powers −6…6. No variables, e/E, mixed numbers or hidden grouping. g: 0.05…20; a: 0.2…20; C0: 0.05…50.');
    const targets = el('div', undefined, 'cd06-controls'); data.append(targets);
    const errorTarget = number(targets, 'Maximum unit-ramp error', '.1', '.0001', '1000');
    const minPM = number(targets, 'Minimum phase margin (deg)', '55', '15', '85');
    const minCross = number(targets, 'Minimum gain crossover (rad/s)', '1', '.001', '100');
    const maxCross = number(targets, 'Maximum gain crossover (rad/s)', '2.5', '.001', '100');
    const presets = el('div', undefined, 'cd06-actions'); data.append(presets); button(presets, 'Baseline design inputs', baseline);
    button(presets, 'Move lag corners nearer crossover', () => { lagZero.value = '.5'; lagPole.value = '.1'; syncCorners(); dirty(); feedback.textContent = 'The lag ratio is still 5. Predict how the actual crossover, phase margin and full response change.'; });
    const lagSection = section('2. Place the lag corners and reveal');
    const lagControls = el('div', undefined, 'cd06-corners'); lagSection.append(lagControls);
    const lagZero = corner(lagControls, 'Lag zero zL (rad/s)', '.1', .002, 10, dirty);
    const lagPole = corner(lagControls, 'Lag pole pL (rad/s)', '.02', .00004, 10, dirty);
    note(lagSection, 'Lag raises low-frequency gain by β = zL/pL and tends to one at high frequency. Keep 1 ≤ β ≤ 50. The sliders use a logarithmic frequency scale; type exact values or use arrow keys. A corner far below crossover still changes the exact loop.');
    button(lagSection, 'Place lag pole for error target', () => {
      const ratio = requiredRatio(readPlant(), read(errorTarget, 'maximum unit-ramp error', .0001, 1000));
      if (ratio > 50) throw new Error(`The target requires β = ${fmt(ratio)}, beyond 50. Increase C0 or relax the error target.`);
      const z = read(lagZero, 'lag zero', .002, 10), p = z / ratio;
      bound(p, .00004, 10, 'Derived lag pole'); lagPole.value = String(p); syncCorners(); dirty(); feedback.textContent = `Pole placed for required β = ${fmt(ratio)}. Predict, then reveal and check its finite phase effect.`;
    });
    const prediction = number(lagSection, 'Predicted required ratio β (optional)', '', '1', '100000000');
    const reveal = button(lagSection, 'Check prediction and reveal lag', revealLag); reveal.className = 'cd06-primary';
    const reasoning = el('div', undefined, 'cd06-reasoning'); lagSection.append(reasoning);
    const bodeSection = section('Bode comparison'); const bode = el('div'); bodeSection.append(bode);
    note(bodeSection, 'The shaded band is the requested gain-crossover interval. Circles mark actual 0 dB crossings; dotted vertical lines mark the newest controller corners and crossover. The phase guides are −180° and the requested margin above −180°. Curves are drafts until revealed.');
    const leadSection = section('3. Add lead when the frequency goals need it');
    leadSection.append(createEquationDisplay(String.raw`C(s)=C_{\mathrm{lag}}(s)\frac{p_D}{z_D}\frac{s+z_D}{s+p_D},\qquad p_D>z_D>0`, 'DC-normalized optional lead controller'));
    note(leadSection, 'The lead factor has DC gain one, so it preserves the lag error constant. It raises high-frequency gain and moves crossover. The automatic attempt centers its phase peak at the new crossover and seeks the phase target plus 2° reserve within your crossover interval; it can report no feasible attempt.');
    const leadActions = el('div', undefined, 'cd06-actions'); leadSection.append(leadActions);
    const auto = button(leadActions, 'Add lead for frequency goals', autoLead); auto.disabled = true;
    const leadControls = el('div', undefined, 'cd06-controls'); leadSection.append(leadControls);
    const leadZero = number(leadControls, 'Manual lead zero zD (rad/s)', '2', '.002', '50');
    const leadPole = number(leadControls, 'Manual lead pole pD (rad/s)', '4', '.002', '100');
    const manual = button(leadSection, 'Check manual lead corners', manualLead); manual.disabled = true;
    note(leadSection, 'Manual lead bounds: zD 0.002…50, pD 0.002…100 rad/s, 1.0001 ≤ pD/zD ≤ 100. Full quartic checks retain stable canceled modes. If only the error target fails, revise lag or C0; DC-normalized lead cannot improve that error.');
    const verification = section('4. Check the complete responses');
    const limits = el('div', undefined, 'cd06-controls'); verification.append(limits);
    const horizon = number(limits, 'Response horizon (s)', '40', '.5', '200');
    const maxOS = number(limits, 'Maximum observed overshoot (%)', '20', '0', '100');
    const deadline = number(limits, 'Observed 2% entry deadline (s)', '8', '.5', '200');
    const verify = button(verification, 'Verify full responses', verifyResponses); verify.className = 'cd06-primary'; verify.disabled = true;
    const results = el('div'); verification.append(results);
    note(verification, 'Overshoot, IAE and ending error are finite-window numerical observations. “Observed 2% entry” requires every later sample in 0.98…1.02 and at least one slowest-mode decay time of observed tail. A short window is unresolved. These observations do not prove future settling. Analytic ramp error is reported only for a strictly stable complete model.');
    const details = el('details'), summary = el('summary', 'Supported checks and source note'); details.append(summary);
    note(details, 'Only the displayed positive integrating-plant family, one lag and optional one lead are supported. Frequency range: 10⁻⁸…10⁶ rad/s. Its magnitude decreases strictly, so there is one gain crossover. All finite −180° crossings are solved from the complete loop, including two crossings when present; an out-of-range crossing is unresolved.');
    note(details, 'The complete degree 2/3/4 characteristic polynomial is checked by Routh and all numerical poles. Near-boundary Routh margins within 10⁻⁹ relative tolerance are unresolved. Pole residuals and reconstructed coefficients are checked; clustered poles have limited positional accuracy. Nonconvergent cases are rejected. The full zero-state response keeps every state, checks a half-size time step within 0.1% scaled output tolerance, and allows at most 60,000 steps/run, two runs/model and three models. Output magnitude above 1,000 or excessive numerical state growth is rejected.');
    const reference = el('a', 'Method reference: University of Illinois ECE 486, Lecture 17'); reference.href = 'https://courses.grainger.illinois.edu/ece486/fa2025/documentation/handbook/lec17.html'; reference.target = '_blank'; reference.rel = 'noopener noreferrer'; details.append(reference);
    note(details, 'The integrating-plant fixtures and automatic search are independently authored for this tool. Original course slides/worksheet were unavailable and were not inspected; the worksheet’s inconsistent numerical target is not used.'); verification.append(details); root.append(feedback);

    function scalar(index: number): number { const d = editors[index].getValue(); if (d.empty || d.hasPlaceholders || d.syntaxIssues.length) throw new Error('Complete the model equation boxes and check their notation.'); return parseNumber(d.latex); }
    function read(input: HTMLInputElement, label: string, min: number, max: number): number { return bound(readNumericInput(input, label), min, max, label); }
    function readPlant(): Plant { const plant = { g: scalar(0), a: scalar(1), k: scalar(2) }; model({ plant }); return plant; }
    function readLag(): Loop {
      const loop = { plant: readPlant(), lag: { z: read(lagZero, 'lag zero', .002, 10), p: read(lagPole, 'lag pole', .00004, 10) } }; model(loop); return loop;
    }
    function readLead(): Corners { return { z: read(leadZero, 'lead zero', .002, 50), p: read(leadPole, 'lead pole', .002, 100) }; }
    function goals() {
      const e = read(errorTarget, 'maximum unit-ramp error', .0001, 1000), pm = read(minPM, 'minimum phase margin', 15, 85), low = read(minCross, 'minimum crossover', .001, 100), high = read(maxCross, 'maximum crossover', .001, 100);
      if (low > high) throw new Error('The minimum crossover must not exceed the maximum.'); return { e, pm, low, high };
    }
    function syncCorners(): void { lagZero.dispatchEvent(new Event('cd06-sync')); lagPole.dispatchEvent(new Event('cd06-sync')); }
    function baseline(): void {
      ready = false; editors.forEach((e, i) => e.setValue(['1', '2', '4'][i]));
      for (const [input, value] of [[errorTarget, '.1'], [minPM, '55'], [minCross, '1'], [maxCross, '2.5'], [lagZero, '.1'], [lagPole, '.02'], [leadZero, '2'], [leadPole, '4'], [horizon, '40'], [maxOS, '20'], [deadline, '8'], [prediction, '']] as const) input.value = value;
      ready = true; syncCorners(); dirty(); feedback.textContent = 'Baseline restored. Predict the required lag ratio before revealing.';
    }
    function revealLag(): void {
      columns = []; results.replaceChildren(); reasoning.replaceChildren(); auto.disabled = manual.disabled = verify.disabled = true; leadDraft = false;
      const loop = readLag(), g = goals(), ratio = requiredRatio(loop.plant, g.e); let predictionText = 'Required lag ratio revealed.';
      if (prediction.value.trim() || prediction.validity.badInput) {
        const attempt = read(prediction, 'predicted required ratio', 1, 100000000);
        predictionText = Math.abs(attempt - ratio) <= .02 * ratio ? 'Prediction agrees within 2%.' : `Prediction differs: required β = ${fmt(ratio)}. Use the original ramp error divided by the target, with a minimum ratio of one.`;
      }
      const before = analyze({ plant: loop.plant }), after = analyze(loop); columns = [{ name: 'C0 only', analysis: before }, { name: 'Lag', analysis: after }];
      reasoning.append(createEquationDisplay(`K_{v0}=\\frac{C_0g}{a}=${fmt(before.kv)},\\quad \\beta_{\\mathrm{req}}=\\max\\left(1,\\frac{1}{K_{v0}e_{\\max}}\\right)=${fmt(ratio)}`, 'Required velocity constant and lag ratio'));
      reasoning.append(createEquationDisplay(`\\beta_{\\mathrm{chosen}}=\\frac{z_L}{p_L}=${fmt(loop.lag!.z / loop.lag!.p)},\\quad K_v=K_{v0}\\beta=${fmt(after.kv)}`, 'Chosen lag ratio and velocity constant'));
      note(reasoning, `The chosen lag changes crossover by ${fmt(100 * (after.crossover / before.crossover - 1))}% and phase margin by ${fmt(after.phaseMargin - before.phaseMargin)}°. High-frequency gain tending to one does not make these effects zero.`);
      auto.disabled = manual.disabled = verify.disabled = false; renderBode(); if (!renderResults()) return; feedback.textContent = `${predictionText} Check the exact lag results; add lead if the frequency goals need it, then verify the full responses.`;
    }
    function clearLead(): void {
      if (!ready || signal.aborted) return; columns = columns.slice(0, 2); leadDraft = columns.length === 2;
      if (columns.length && renderResults()) feedback.textContent = 'Manual lead draft changed. Check its corners before treating it as a verified design.';
      renderBode();
    }
    function autoLead(): void {
      columns = columns.slice(0, 2); leadDraft = false; renderBode(); if (!renderResults()) return; const g = goals();
      const plan = designLead(columns[1].analysis.model.loop, g.pm, g.low, g.high);
      if (!plan) { feedback.textContent = 'Lag already meets the frequency goals. No lead is needed for those goals; verify the full responses and ramp-error requirement.'; return; }
      leadZero.value = String(plan.z); leadPole.value = String(plan.p);
      columns.push({ name: 'Lead–lag', analysis: analyze({ ...columns[1].analysis.model.loop, lead: plan }) }); renderBode(); if (!renderResults()) return;
      feedback.textContent = `Lead added at new crossover ${fmt(plan.omega)} rad/s: α = ${fmt(plan.alpha)}, peak added phase ${fmt(plan.phaseAdded)}°, actual margin ${fmt(columns[2].analysis.phaseMargin)}°. This includes the 2° reserve. Verify all full responses.`;
    }
    function manualLead(): void {
      columns = columns.slice(0, 2); leadDraft = true; if (!renderResults()) return;
      const loop = { ...columns[1].analysis.model.loop, lead: readLead() }, next = analyze(loop);
      columns.push({ name: 'Lead–lag', analysis: next }); leadDraft = false; renderBode(); if (!renderResults()) return; feedback.textContent = 'Manual lead–lag checked from the complete loop. Verify the full responses; a phase-margin change does not guarantee transient performance.';
    }
    function verifyResponses(): void {
      columns.forEach(c => { delete c.trace; delete c.responseError; }); results.replaceChildren();
      const t = read(horizon, 'response horizon', .5, 200); read(maxOS, 'maximum observed overshoot', 0, 100); read(deadline, 'observed entry deadline', .5, 200);
      columns.forEach(c => { try { c.trace = stepTrace(c.analysis, t); } catch (e) { c.responseError = e instanceof Error ? e.message : 'Response unresolved.'; } });
      if (!renderResults()) return; feedback.textContent = 'Full-model response checks updated. Read each failed or unresolved requirement before accepting the design.';
    }
    function renderBode(): void {
      bode.replaceChildren();
      try {
        const loop = readLag(), g = goals();
        const entries: { name: string; loop: Loop }[] = [{ name: 'C0 only', loop: { plant: loop.plant } }, { name: 'Lag', loop }];
        if (columns.length === 3) entries.push({ name: 'Lead–lag', loop: columns[2].analysis.model.loop });
        else if (leadDraft) { const draft = { ...loop, lead: readLead() }; model(draft); entries.push({ name: 'Draft lead–lag', loop: draft }); }
        const last = entries[entries.length - 1].loop, corners = [loop.plant.a, loop.lag!.z, loop.lag!.p, ...(last.lead ? [last.lead.z, last.lead.p] : [])];
        const wc = entries.map(e => gainCrossover(e.loop)); const low = Math.max(1e-8, Math.min(...corners, ...wc, g.low) / 12), high = Math.min(1e6, Math.max(...corners, ...wc, g.high) * 12);
        const sample = Array.from({ length: 481 }, (_, i) => low * (high / low) ** (i / 480)); sample[0] = low; sample[sample.length - 1] = high;
        const values = entries.map(e => sample.map(w => frequency(e.loop, w))), current = wc[wc.length - 1];
        const guides = [...corners.slice(1).map(x => ({ x })), { x: current }], band = { low: g.low, high: g.high };
        bode.append(plot({ title: 'Loop magnitude', xLabel: 'ω (rad/s, logarithmic)', yLabel: 'Magnitude (dB)', logX: true, band, guides: [...guides, { y: 0 }], marks: wc.map(x => ({ x, y: 0 })), series: entries.map((e, j) => ({ name: e.name, points: sample.map((x, i) => ({ x, y: values[j][i].db })) })) }));
        bode.append(plot({ title: 'Loop phase', xLabel: 'ω (rad/s, logarithmic)', yLabel: 'Phase (deg)', logX: true, band, yDomain: [-270, 0], guides: [...guides, { y: -180 }, { y: -180 + g.pm }], marks: wc.map((x, i) => ({ x, y: frequency(entries[i].loop, x).phase })), series: entries.map((e, j) => ({ name: e.name, points: sample.map((x, i) => ({ x, y: values[j][i].phase })) })) }));
      } catch (e) { note(bode, e instanceof Error ? e.message : 'Complete the draft to plot it.'); }
    }
    function renderResults(): boolean {
      results.replaceChildren(); if (!columns.length) return true;
      try {
        const g = goals(), os = read(maxOS, 'maximum observed overshoot', 0, 100), entry = read(deadline, 'observed entry deadline', .5, 200);
        const wrap = el('div', undefined, 'cd06-table-wrap'), table = el('table', undefined, 'cd06-table');
        wrap.tabIndex = 0; wrap.setAttribute('role', 'region'); wrap.setAttribute('aria-label', 'Full-model comparison; scroll horizontally for all models');
        table.style.minWidth = `${132 + columns.length * 140}px`; wrap.append(table); results.append(wrap);
        const head = el('tr'); head.append(el('th', 'Complete-model check')); columns.forEach(c => head.append(el('th', c.name))); const thead = el('thead'); thead.append(head); table.append(thead); const body = el('tbody'); table.append(body);
        const row = (label: string, value: (c: Column) => string) => { const tr = el('tr'); const th = el('th', label); th.scope = 'row'; tr.append(th); columns.forEach(c => tr.append(el('td', value(c)))); body.append(tr); };
        const pass = (yes: boolean) => yes ? 'Pass' : 'Fails';
        row('Full polynomial stability', c => c.analysis.stability.status === 'stable' ? 'Strictly stable (Routh + poles)' : c.analysis.stability.status === 'unstable' ? 'Unstable — no final-value claim' : 'Boundary / unresolved — not strictly stable');
        row(`Gain crossover, ${fmt(g.low)}…${fmt(g.high)} rad/s`, c => `${fmt(c.analysis.crossover)} · ${pass(c.analysis.crossover >= g.low && c.analysis.crossover <= g.high)}`);
        row(`Phase margin ≥ ${fmt(g.pm)}°`, c => `${fmt(c.analysis.phaseMargin)}° · ${pass(c.analysis.phaseMargin >= g.pm - 1e-7)}`);
        row('Finite −180° crossings (rad/s)', c => c.analysis.phaseCrossings.map(x => fmt(x.omega)).join(', ') || 'None finite');
        row('Gain margins at those crossings (dB)', c => c.analysis.phaseCrossings.map(x => fmt(x.gainMarginDb)).join(', ') || 'No finite crossing');
        row(`Analytic ramp error ≤ ${fmt(g.e)}`, c => c.analysis.rampError === null ? 'Unavailable: stability not established' : `${fmt(c.analysis.rampError)} · ${pass(c.analysis.rampError <= g.e * (1 + 1e-9))}`);
        row('All closed-loop poles (s⁻¹)', c => c.analysis.poles.map(z => Math.abs(z.im) < 1e-9 * Math.max(1, Math.abs(z.re)) ? fmt(z.re) : `${fmt(z.re)} ${z.im >= 0 ? '+' : '−'} j${fmt(Math.abs(z.im))}`).join('; '));
        row(`Observed overshoot ≤ ${fmt(os)}%`, c => c.trace ? `${fmt(c.trace.overshoot)}% · ${pass(c.trace.overshoot <= os)}` : c.responseError || 'Response not checked');
        row(`Observed 2% entry ≤ ${fmt(entry)} s`, c => c.trace?.entry !== null && c.trace?.entry !== undefined ? `${fmt(c.trace.entry)} s · ${pass(c.trace.entry <= entry)}` : c.responseError || (c.trace ? 'Unresolved through this horizon' : 'Response not checked'));
        row('Ending error r − y', c => c.trace ? fmt(c.trace.endingError) : 'Unavailable'); row('IAE (output·s)', c => c.trace ? fmt(c.trace.iae) : 'Unavailable');
        row('Combined requirements', c => {
          const a = c.analysis, t = c.trace;
          return a.stability.status === 'stable' && a.rampError !== null && a.rampError <= g.e * (1 + 1e-9) && a.phaseMargin >= g.pm - 1e-7 && a.crossover >= g.low && a.crossover <= g.high && t && t.overshoot <= os && t.entry !== null && t.entry <= entry ? 'All displayed checks met; transient observations are finite-window' : 'Unmet or unresolved checks';
        });
        const traces = columns.filter(c => c.trace); if (traces.length) results.append(plot({ title: 'Full-model unit-step responses', xLabel: 'Time (s)', yLabel: 'Output y', guides: [{ y: 1 }, { y: .98 }, { y: 1.02 }], series: traces.map(c => ({ name: c.name, points: c.trace!.points, styleIndex: columns.indexOf(c) })) }));
        const latest = columns[columns.length - 1];
        note(results, `Characteristic coefficients, descending powers of s: [${latest.analysis.model.closed.map(fmt).join(', ')}]. All ${latest.analysis.poles.length} poles are retained. Numerical pole displays are rounded; margins do not replace stability checks.`);
        if (columns.some(c => c.analysis.clustered)) note(results, 'Clustered or repeated poles: individual numerical locations have limited positional accuracy. Full-state responses do not require simple poles.');
        columns.filter(c => c.responseError).forEach(c => note(results, `${c.name}: ${c.responseError}`)); return true;
      } catch (e) { results.replaceChildren(); feedback.textContent = e instanceof Error ? e.message : 'Check the requirements.'; return false; }
    }
    for (const input of [errorTarget, minPM, minCross, maxCross, prediction]) input.addEventListener('input', dirty, { signal });
    for (const input of [leadZero, leadPole]) input.addEventListener('input', clearLead, { signal });
    for (const input of [horizon, maxOS, deadline]) input.addEventListener('input', () => {
      if (!ready || signal.aborted) return; columns.forEach(c => { delete c.trace; delete c.responseError; }); if (renderResults()) feedback.textContent = 'Response window or limits changed. Verify the full responses again.';
    }, { signal });
    ready = true; renderBode();
    return cleanup;
  } catch (e) { cleanup(); throw e; }
};
