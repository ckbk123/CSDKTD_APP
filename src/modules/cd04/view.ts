import type { ModuleMount } from '../../core/module';
import { createEquationDisplay, createEquationInput, type EquationInput } from '../../shared/equations/input';
import { readNumericInput } from '../../shared/numeric-input';
import { parseNumber } from './number-expression';
import { bound, check, designLead, lagForTarget, nextStep, requiredRatio, rootLocus, stepTrace, targetFromSpecs, type Checked, type Lead, type Plant } from './math';
import type { Trace } from './engine';
import { plot, type Mark } from './plot';
import './style.css';
const fmt = (v: number) => v === 0 ? '0' : Math.abs(v) < 1e-10 ? v.toExponential(3) : v.toLocaleString('en-US', { useGrouping: false, maximumSignificantDigits: 6 });
function el<K extends keyof HTMLElementTagNameMap>(tag: K, text?: string, cls?: string): HTMLElementTagNameMap[K] { const e = document.createElement(tag); if (text !== undefined) e.textContent = text; if (cls) e.className = cls; return e; }
interface Column { name: string; checked: Checked; trace?: Trace; responseError?: string }
export const mount: ModuleMount = ({ container, signal: parent }) => {
  if (parent.aborted) return;
  const lifetime = new AbortController(), signal = lifetime.signal, forward = () => lifetime.abort(); parent.addEventListener('abort', forward, { once: true });
  const root = el('div', undefined, 'cd04'); root.dataset.module = 'CD04'; container.append(root); const editors: EquationInput[] = []; let disposed = false;
  const cleanup = () => { if (disposed) return; disposed = true; lifetime.abort(); parent.removeEventListener('abort', forward); editors.forEach(e => e.destroy()); root.remove(); };
  try {
    let ready = false, columns: Column[] = [], selected: Lead | null = null;
    const feedback = el('p', 'Predict the lead gain, then reveal the transient construction.', 'cd04-feedback'); feedback.setAttribute('role', 'status');
    const section = (title: string) => { const s = el('section'); s.append(el('h2', title)); root.append(s); return s; };
    const note = (host: HTMLElement, text: string) => host.append(el('p', text, 'cd04-note'));
    function button(host: HTMLElement, label: string, action: () => void): HTMLButtonElement {
      const b = el('button', label); b.type = 'button'; host.append(b); b.addEventListener('click', () => { if (signal.aborted) return; b.after(feedback); try { action(); } catch (e) { feedback.textContent = e instanceof Error ? e.message : 'Check the inputs.'; } }, { signal }); return b;
    }
    function number(host: HTMLElement, label: string, value: string, min: string, max: string): HTMLInputElement {
      const l = el('label', label), input = el('input'); input.type = 'number'; input.step = 'any'; input.min = min; input.max = max; input.value = value; l.append(input); host.append(l); return input;
    }
    const data = section('1. Allocate the transient and tracking goals');
    data.append(createEquationDisplay(String.raw`G(s)=\frac{g}{s(s+a)},\quad C_{\mathrm{lead}}(s)=K\frac{s+z_D}{s+p_D}`, 'Supported plant and transient lead'));
    note(data, 'Continuous SISO, negative unity feedback, zero initial state. Normalized input/output: g has units s⁻², a/poles/corners use s⁻¹ (rad/s), controller gains are dimensionless. Reference tests use a unit step and unit-slope ramp.');
    const equations = el('div', undefined, 'cd04-equations'); data.append(equations);
    for (const [label, value] of [['Plant numerator g (s⁻²)', '1'], ['Plant pole parameter a (rad/s)', '2'], ['Baseline controller C0', '4']]) {
      const editor = createEquationInput({ label, value, signal, onChange: dirtyLead }); editors.push(editor); equations.append(editor.element);
    }
    note(data, 'Model boxes: numbers, fractions, visible parentheses, +, −, explicit ×/÷ and integer powers −6…6. No variables, e/E, mixed numbers or hidden grouping. g 0.05…20; a 0.2…20; baseline C0 0.05…50. C0 is the comparison controller; the target construction determines a new K.');
    const targets = el('div', undefined, 'cd04-controls'); data.append(targets);
    const modeLabel = el('label', 'Transient target method'), mode = el('select'); modeLabel.append(mode); targets.append(modeLabel);
    for (const [value, label] of [['poles', 'Desired pole pair'], ['specs', 'Approximate time specifications']]) { const o = el('option', label); o.value = value; mode.append(o); }
    const sigma = number(targets, 'Target decay σ (s⁻¹)', '2', '.1', '10'), omega = number(targets, 'Target imaginary part ω (rad/s)', '2', '.1', '20');
    const specifications = el('div', undefined, 'cd04-controls'); data.append(specifications);
    const pairOS = number(specifications, 'Requested pair overshoot (%)', String(100 * Math.exp(-Math.PI)), '.1', '40'), pairTs = number(specifications, 'Approximate pair 2% settling target (s)', '2', '.4', '40'); pairOS.disabled = pairTs.disabled = true;
    note(data, 'Time specifications give σ≈4/Ts and ω=−πσ/ln(Mp/100) for a zero-free second-order pair. The full lead/combined model still has extra modes and zeros. In this mode the requested limits also apply to the full model, together with the stricter limits below.');
    const requirements = el('div', undefined, 'cd04-controls'); data.append(requirements);
    const maxOS = number(requirements, 'Additional maximum overshoot (%)', '10', '0', '100'), deadline = number(requirements, 'Additional 2% entry deadline (s)', '4', '.5', '200'), maxRamp = number(requirements, 'Maximum unit-ramp error', '.1', '.0001', '1000');
    const presets = el('div', undefined, 'cd04-controls'); data.append(presets); button(presets, 'Baseline design inputs', baseline);
    button(presets, 'Change lead pole to −8', () => { pole.value = '8'; dirtyLead(); feedback.textContent = 'Lead pole changed to −8. Predict its zero, gain and tracking error before allocating lag again.'; });
    const leadSection = section('2. Design lead for the transient target');
    const leadControls = el('div', undefined, 'cd04-controls'); leadSection.append(leadControls);
    const pole = number(leadControls, 'Chosen lead pole pD (rad/s)', '6', '.2', '50'), gainPrediction = number(leadControls, 'Predicted lead gain K (optional)', '', '.001', '5000');
    button(leadSection, 'Check prediction and reveal lead', revealLead).className = 'cd04-primary';
    const leadReasoning = el('div'); leadSection.append(leadReasoning);
    const lagSection = section('3. Allocate steady-error accuracy to lag');
    lagSection.append(createEquationDisplay(String.raw`C(s)=K\frac{s+z_D}{s+p_D}\frac{s+z_L}{s+p_L},\quad \beta=\frac{z_L}{p_L}\ge1`, 'Combined controller and lag ratio'));
    note(lagSection, 'Lag multiplies the lead error constant by β and tends to one at high frequency. Its finite corner locations still move the transient poles. Lead reveal fills a suggested lag pole for the current error target; you may type another pole and check the consequences.');
    const lagControls = el('div', undefined, 'cd04-controls'); lagSection.append(lagControls);
    const lagZero = number(lagControls, 'Lag zero zL (rad/s)', '.1', '.002', '10'), lagPole = number(lagControls, 'Lag pole pL (rad/s)', String(.1 / 3.75), '.00004', '10');
    const sliderLabel = el('label', 'Slide lag zero zL (rad/s)'), slider = el('input'); slider.type = 'range'; slider.min = String(Math.log10(.002)); slider.max = '1'; slider.step = '.01'; sliderLabel.append(slider); lagControls.append(sliderLabel); syncSlider();
    const betaPrediction = number(lagControls, 'Predicted required ratio β (optional)', '', '1', '1000000000000');
    const placeLag = button(lagSection, 'Place lag pole for error target', placeForTarget), addLag = button(lagSection, 'Check prediction and add lag', revealLag);
    const refineLag = button(lagSection, 'Try lag zero 0.02 with the same required ratio', () => { if (!columns[1]) throw new Error('Reveal the lead first.'); const l = lagForTarget(columns[1].checked, read(maxRamp, 'maximum unit-ramp error', .0001, 1000), .02); lagZero.value = String(l.z); lagPole.value = String(l.p); syncSlider(); dirtyLag(); feedback.textContent = 'Lag moved farther below the transient modes while preserving its required DC ratio. Check lag and verify all full models again.'; });
    placeLag.disabled = addLag.disabled = refineLag.disabled = true;
    const lagReasoning = el('div'); lagSection.append(lagReasoning);
    const verification = section('4. Validate the complete allocation');
    const work = el('div', undefined, 'cd04-controls'); verification.append(work);
    const horizon = number(work, 'Response horizon (s)', '80', '.5', '200'), plotWindow = number(work, 'Response plot window (s)', '12', '.5', '200'), maxGain = number(work, 'Root-locus maximum gain', '60', '.01', '10000');
    const verify = button(verification, 'Verify full models', verifyModels); verify.className = 'cd04-primary'; verify.disabled = true;
    const results = el('div'); verification.append(results);
    note(verification, 'Every characteristic pole is retained. The finite gain sweep illustrates all branches on equal complex-plane scales; it does not prove a complete gain/stability interval. Selected stability uses the full Routh inequalities and numerical poles. A gain range extends when needed to contain the actual design.');
    note(verification, 'The plot window shows early detail up to the selected time or the observation horizon, whichever is shorter. Every metric still uses the full computed horizon. Overshoot, IAE and ending error are sampled observations. Observed 2% entry requires all later samples inside 0.98…1.02 and at least one slowest-mode decay time of remaining observation. Short horizons remain unresolved. Ramp error is analytic only after complete strict stability; transient observations do not prove future settling.');
    const details = el('details'); details.append(el('summary', 'Supported domain, numerical checks and source note'));
    note(details, 'Target σ 0.1…10, ω 0.1…20, pD 0.2…50; derived K 0.001…5000, zD 0.01…50 with pD−zD≥0.0001 and remaining pole distance≥0.02. Lag zL 0.002…10, pL 0.00004…10, β 1…50. Required ratio predictions may describe an infeasible ratio; placement rejects values above 50. Ramp target 0.0001…1000.');
    note(details, 'Full degree 2/3/4 state responses compare RK4 at h and h/2 within 0.1% scaled output tolerance. Fine run≤60,000 steps, two runs/model, three models; horizon0.5…200 s. Output>1000, state>10¹², unsupported/nonfinite data, excess work or unresolved roots are rejected. Pole residuals and reconstructed coefficients are checked; clustered root positions have limited precision. Routh relative margins within 10⁻⁹ are unresolved. The gain sweep has at most 242 samples, maximum gain≤10,000.');
    const reference = el('a', 'Method reference: KU Leuven, root-locus angle and magnitude conditions'); reference.href = 'https://modeling-and-simulation-book-fet-edu-em-control--aa8411c2554302.pages.gitlab.kuleuven.be/Content/Control/3_Root_locus.html'; reference.target = '_blank'; reference.rel = 'noopener noreferrer'; details.append(reference);
    note(details, 'The default transient target, allocation limits and combined examples are independently authored for this tool. Original Ch6/S08 sources were unavailable and were not inspected. No instructor-approved combined numerical answer is claimed.'); verification.append(details); root.append(feedback);

    function scalar(i: number): number { const d = editors[i].getValue(); if (d.empty || d.hasPlaceholders || d.syntaxIssues.length) throw new Error('Complete the model equation boxes and check their notation.'); return parseNumber(d.latex); }
    function read(input: HTMLInputElement, label: string, min: number, max: number): number { return bound(readNumericInput(input, label), min, max, label); }
    function plant(): Plant { const p = { g: scalar(0), a: scalar(1), c0: scalar(2) }; check(p); return p; }
    function limits() {
      let os = read(maxOS, 'maximum overshoot', 0, 100), entry = read(deadline, 'entry deadline', .5, 200);
      if (mode.value === 'specs') { os = Math.min(os, read(pairOS, 'requested overshoot', .1, 40)); entry = Math.min(entry, read(pairTs, 'requested settling target', .4, 40)); }
      return { maxOvershoot: os, entryDeadline: entry, maxRamp: read(maxRamp, 'maximum unit-ramp error', .0001, 1000) };
    }
    function syncSlider(): void { const z = lagZero.valueAsNumber; if (Number.isFinite(z) && z > 0) { slider.value = String(Math.log10(z)); slider.setAttribute('aria-valuetext', `${fmt(z)} rad/s`); } }
    function dirtyLead(): void {
      if (!ready || signal.aborted) return; columns = []; selected = null; leadReasoning.replaceChildren(); lagReasoning.replaceChildren(); results.replaceChildren(); placeLag.disabled = addLag.disabled = refineLag.disabled = verify.disabled = true; feedback.textContent = 'Plant or transient target changed. Reveal a new lead before allocating lag.';
    }
    function dirtyLag(): void {
      if (!ready || signal.aborted) return; columns = columns.slice(0, 2); lagReasoning.replaceChildren(); if (renderResults()) feedback.textContent = 'Lag or accuracy draft changed. Check the new lag before accepting a combined design.';
    }
    function baseline(): void {
      ready = false; editors.forEach((e, i) => e.setValue(['1', '2', '4'][i])); mode.value = 'poles'; sigma.disabled = omega.disabled = false; pairOS.disabled = pairTs.disabled = true;
      for (const [input, value] of [[sigma, '2'], [omega, '2'], [pairOS, String(100 * Math.exp(-Math.PI))], [pairTs, '2'], [maxOS, '10'], [deadline, '4'], [maxRamp, '.1'], [pole, '6'], [gainPrediction, ''], [betaPrediction, ''], [lagZero, '.1'], [lagPole, String(.1 / 3.75)], [horizon, '80'], [plotWindow, '12'], [maxGain, '60']] as const) input.value = value;
      ready = true; syncSlider(); dirtyLead(); feedback.textContent = 'Baseline restored. Predict the transient lead gain before revealing.';
    }
    function revealLead(): void {
      dirtyLead(); const p = plant(), t = mode.value === 'specs' ? targetFromSpecs(readNumericInput(pairOS, 'requested overshoot'), readNumericInput(pairTs, 'requested settling time')) : { sigma: read(sigma, 'target decay', .1, 10), omega: read(omega, 'target imaginary part', .1, 20) };
      const d = designLead(p, t, read(pole, 'chosen lead pole', .2, 50)), goal = limits(); let message = 'Lead construction revealed.';
      if (gainPrediction.value.trim() || gainPrediction.validity.badInput) { const prediction = read(gainPrediction, 'predicted lead gain', .001, 5000); message = Math.abs(prediction / d.gain - 1) <= .02 ? 'Lead gain prediction agrees within 2%.' : `Prediction differs: the angle/magnitude construction gives K = ${fmt(d.gain)}.`; }
      selected = d; columns = [{ name: 'Baseline C0', checked: check(p) }, { name: 'Lead', checked: check(p, d) }];
      const q = d.sigma ** 2 + d.omega ** 2;
      leadReasoning.append(createEquationDisplay(`r=a+p_D-2\\sigma=${fmt(d.remaining)},\\quad q=\\sigma^2+\\omega^2=${fmt(q)}`, 'Retained third-pole distance and target factor'));
      leadReasoning.append(createEquationDisplay(`Kg=q+2\\sigma r-ap_D=${fmt(d.gain * p.g)},\\quad z_D=\\frac{qr}{Kg}=${fmt(d.zero)},\\quad K=${fmt(d.gain)}`, 'Designed lead zero and gain'));
      leadReasoning.append(createEquationDisplay(`C_{\\mathrm{lead}}(s)=${fmt(d.gain)}\\frac{s+${fmt(d.zero)}}{s+${fmt(d.pole)}}`, 'Checked lead controller'));
      note(leadReasoning, `Angle deficiency ${fmt(d.deficiency * 180 / Math.PI)}°; lead contribution ${fmt((d.zeroAngle - d.poleAngle) * 180 / Math.PI)}°. Independent magnitude gain ${fmt(d.magnitudeGain)}. All three poles are retained, not only −${fmt(d.sigma)}±j${fmt(d.omega)}.`);
      leadReasoning.append(plot('Lead angle construction', 'Real part (s⁻¹)', 'Imaginary part (rad/s)', [
        { label: 'From plant pole 0', x: [0, -d.sigma], y: [0, d.omega] }, { label: 'From plant pole −a', x: [-p.a, -d.sigma], y: [0, d.omega] },
        { label: 'From lead pole', x: [-d.pole, -d.sigma], y: [0, d.omega], dashed: true }, { label: 'From lead zero', x: [-d.zero, -d.sigma], y: [0, d.omega] },
      ], [{ x: -d.sigma, y: d.omega, label: 'Desired upper pole', kind: 'target' }, { x: -d.zero, y: 0, label: 'Lead zero', kind: 'zero' }], true));
      try { const l = lagForTarget(columns[1].checked, goal.maxRamp, read(lagZero, 'lag zero', .002, 10)); lagPole.value = String(l.p); syncSlider(); } catch (e) { message += ` ${e instanceof Error ? e.message : 'Lag placement unresolved.'}`; }
      placeLag.disabled = addLag.disabled = refineLag.disabled = verify.disabled = false; if (!renderResults()) return; feedback.textContent = `${message} A suggested lag pole was filled where supported. Verify lead transients, then predict the required accuracy ratio and add lag.`;
    }
    function placeForTarget(): void {
      if (!columns[1]) throw new Error('Reveal a checked lead first.'); const l = lagForTarget(columns[1].checked, limits().maxRamp, read(lagZero, 'lag zero', .002, 10)); lagPole.value = String(l.p); syncSlider(); dirtyLag(); feedback.textContent = 'Lag pole placed for the current tracking target. Check its ratio and combined transient effects.';
    }
    function revealLag(): void {
      dirtyLag(); if (!columns[1] || !selected) throw new Error('Reveal the transient lead first.'); const goal = limits(), before = columns[1].checked, ratio = requiredRatio(before, goal.maxRamp); let message = 'Required lag ratio revealed.';
      if (betaPrediction.value.trim() || betaPrediction.validity.badInput) { const prediction = read(betaPrediction, 'predicted required ratio', 1, 1e12); message = Math.abs(prediction / ratio - 1) <= .02 ? 'Lag ratio prediction agrees within 2%.' : `Prediction differs: required β = ${fmt(ratio)} from the stable lead ramp error divided by the target.`; }
      const lag = { z: read(lagZero, 'lag zero', .002, 10), p: read(lagPole, 'lag pole', .00004, 10) }, full = check(before.plant, selected, lag);
      columns.push({ name: 'Combined', checked: full });
      lagReasoning.append(createEquationDisplay(`K_{vD}=${fmt(before.kv)},\\quad \\beta_{\\mathrm{req}}=\\max\\left(1,\\frac{e_{D}}{e_{\\max}}\\right)=${fmt(ratio)},\\quad \\beta_{\\mathrm{chosen}}=${fmt(lag.z / lag.p)}`, 'Required and chosen accuracy ratios'));
      lagReasoning.append(createEquationDisplay(`C(s)=${fmt(selected.gain)}\\frac{s+${fmt(selected.zero)}}{s+${fmt(selected.pole)}}\\frac{s+${fmt(lag.z)}}{s+${fmt(lag.p)}}`, 'Complete checked lead–lag controller'));
      if (!renderResults()) return; feedback.textContent = `${message} All four combined poles are recomputed. Verify the complete responses; unchanged high-frequency gain does not preserve the target poles.`;
    }
    function verifyModels(): void {
      columns.forEach(c => { delete c.trace; delete c.responseError; }); results.replaceChildren(); limits(); const h = read(horizon, 'response horizon', .5, 200), window = read(plotWindow, 'response plot window', .5, 200); read(maxGain, 'root-locus maximum gain', .01, 10000);
      columns.forEach(c => { try { c.trace = stepTrace(c.checked, h, window); } catch (e) { c.responseError = e instanceof Error ? e.message : 'Response unresolved.'; } });
      if (!renderResults()) return; feedback.textContent = columns.at(-1)?.responseError || nextStep(columns.at(-1)!.checked, columns.at(-1)!.trace, limits());
    }
    function renderResults(): boolean {
      results.replaceChildren(); if (!columns.length) return true;
      try {
        const goal = limits(), wrap = el('div', undefined, 'cd04-table-wrap'), table = el('table', undefined, 'cd04-table'); wrap.tabIndex = 0; wrap.setAttribute('role', 'region'); wrap.setAttribute('aria-label', 'Full-model comparison; scroll horizontally for all models'); table.style.minWidth = `${132 + 140 * columns.length}px`; wrap.append(table); results.append(wrap);
        const header = el('tr'); header.append(el('th', 'Complete-model check')); columns.forEach(c => header.append(el('th', c.name))); const thead = el('thead'); thead.append(header); table.append(thead); const body = el('tbody'); table.append(body);
        const row = (label: string, value: (c: Column) => string) => { const tr = el('tr'), th = el('th', label); th.scope = 'row'; tr.append(th); columns.forEach(c => tr.append(el('td', value(c)))); body.append(tr); };
        const pass = (yes: boolean) => yes ? 'Pass' : 'Fails';
        row('Complete stability', c => c.checked.stability.status === 'stable' ? 'Strictly stable (Routh + all poles)' : c.checked.stability.status === 'unstable' ? 'Unstable; no final-value claim' : 'Boundary / unresolved');
        row('All poles (s⁻¹)', c => c.checked.poles.map(z => Math.abs(z.im) < 1e-9 * Math.max(1, Math.abs(z.re)) ? fmt(z.re) : `${fmt(z.re)} ${z.im >= 0 ? '+' : '−'} j${fmt(Math.abs(z.im))}`).join('; '));
        row(`Analytic ramp error ≤ ${fmt(goal.maxRamp)}`, c => c.checked.rampError === null ? 'Unavailable: not strictly stable' : `${fmt(c.checked.rampError)} · ${pass(c.checked.rampError <= goal.maxRamp * (1 + 1e-9))}`);
        row(`Observed overshoot ≤ ${fmt(goal.maxOvershoot)}%`, c => c.trace ? `${fmt(c.trace.overshoot)}% · ${pass(c.trace.overshoot <= goal.maxOvershoot)}` : c.responseError || 'Response not checked');
        row(`Observed 2% entry ≤ ${fmt(goal.entryDeadline)} s`, c => c.trace?.entry !== null && c.trace?.entry !== undefined ? `${fmt(c.trace.entry)} s · ${pass(c.trace.entry <= goal.entryDeadline)}` : c.responseError || (c.trace ? 'Unresolved through this horizon' : 'Response not checked'));
        row('Ending error r − y', c => c.trace ? fmt(c.trace.endingError) : 'Unavailable'); row('IAE (output·s)', c => c.trace ? fmt(c.trace.iae) : 'Unavailable');
        row('Combined requirements', c => nextStep(c.checked, c.trace, goal).startsWith('All displayed') ? 'All displayed checks met; finite-window observations' : 'Unmet or unresolved; see guidance');
        const traces = columns.filter(c => c.trace); if (traces.length) {
          results.append(plot(`Complete unit-step responses: first ${fmt(traces[0].trace!.plotHorizon)} s`, 'Time (s)', 'Output y', traces.map(c => ({ label: c.name, x: c.trace!.points.map(p => p.x), y: c.trace!.points.map(p => p.y), dashed: c.name === 'Lead' }))));
          note(results, `The plotted window ends at ${fmt(traces[0].trace!.plotHorizon)} s; all metrics use the full ${fmt(read(horizon, 'response horizon', .5, 200))} s observation horizon.`);
        }
        for (const c of columns) { results.append(el('h3', `${c.name}: next iteration`)); note(results, c.responseError || nextStep(c.checked, c.trace, goal)); }
        const latest = columns.at(-1)!.checked;
        note(results, `Complete characteristic coefficients in descending powers: [${latest.model.closed.map(fmt).join(', ')}]. ${latest.poles.length} modes retained. ${latest.clustered ? 'Clustered/repeated poles have limited positional precision.' : 'Numerical pole displays are rounded.'}`);
        if (latest.lead) {
          try {
            const locus = rootLocus(latest, read(maxGain, 'root-locus maximum gain', .01, 10000)), marks: Mark[] = [
              { x: 0, y: 0, label: 'Plant pole 0', kind: 'pole' }, { x: -latest.plant.a, y: 0, label: 'Plant pole −a', kind: 'pole' }, { x: -latest.lead.pole, y: 0, label: 'Lead pole', kind: 'pole' }, { x: -latest.lead.zero, y: 0, label: 'Lead zero', kind: 'zero' },
              ...latest.poles.map(z => ({ x: z.re, y: z.im, label: Math.abs(z.im) < 1e-9 * Math.max(1, Math.abs(z.re)) ? `Selected ${fmt(z.re)}` : `Selected ${fmt(z.re)} ${z.im >= 0 ? '+' : '−'} j${fmt(Math.abs(z.im))}`, kind: 'selected' as const })),
              { x: -latest.lead.sigma, y: latest.lead.omega, label: 'Desired upper target', kind: 'target' }, { x: -latest.lead.sigma, y: -latest.lead.omega, label: 'Desired lower target', kind: 'target' },
            ]; if (latest.lag) marks.push({ x: -latest.lag.p, y: 0, label: 'Lag pole', kind: 'pole' }, { x: -latest.lag.z, y: 0, label: 'Lag zero', kind: 'zero' });
            results.append(plot(`${latest.lag ? 'Combined' : 'Lead'} root locus: all ${latest.poles.length} branches`, 'Real part (s⁻¹)', 'Imaginary part (rad/s)', locus.branches.map((b, i) => ({ label: `Branch ${i + 1}`, x: b.map(z => z.re), y: b.map(z => z.im) })), marks, true));
            note(results, `Finite gain range 0…${fmt(locus.maximum)}, ${locus.gains.length} samples, including designed K=${fmt(latest.gain)}. Desired diamonds show the original transient target; filled poles show the actual latest model.`);
          } catch (e) { note(results, `Locus unresolved: ${e instanceof Error ? e.message : 'Change the gain range.'} Selected full-model checks above are separate.`); }
        }
        return true;
      } catch (e) { results.replaceChildren(); feedback.textContent = e instanceof Error ? e.message : 'Check the requirements.'; return false; }
    }
    for (const input of [sigma, omega, pairOS, pairTs, pole, gainPrediction]) input.addEventListener('input', dirtyLead, { signal });
    mode.addEventListener('change', () => { const specs = mode.value === 'specs'; sigma.disabled = omega.disabled = specs; pairOS.disabled = pairTs.disabled = !specs; dirtyLead(); }, { signal });
    for (const input of [lagPole, betaPrediction, maxRamp]) input.addEventListener('input', dirtyLag, { signal }); lagZero.addEventListener('input', () => { syncSlider(); dirtyLag(); }, { signal });
    slider.addEventListener('input', () => { lagZero.value = String(10 ** slider.valueAsNumber); slider.setAttribute('aria-valuetext', `${fmt(lagZero.valueAsNumber)} rad/s`); dirtyLag(); }, { signal });
    for (const input of [horizon, plotWindow, maxOS, deadline, maxGain]) input.addEventListener('input', () => { if (!ready || signal.aborted) return; columns.forEach(c => { delete c.trace; delete c.responseError; }); if (renderResults()) feedback.textContent = 'Requirements, view window, horizon or gain range changed. Verify the complete models again.'; }, { signal });
    ready = true; return cleanup;
  } catch (e) { cleanup(); throw e; }
};
