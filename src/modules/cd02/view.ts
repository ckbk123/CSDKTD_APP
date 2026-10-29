import type { ModuleMount } from '../../core/module';
import { createEquationDisplay, createEquationInput, type EquationInput } from '../../shared/equations/input';
import { readNumericInput } from '../../shared/numeric-input';
import { parseNumber } from './number-expression';
import { bound, cubicRoots, design, polynomialResidual, responseCoefficients, rootLocus, stepTrace, targetFromSpecs, type Design } from './math';
import { plot, type Mark } from './plot';
import './style.css';

const fmt = (n: number) => n === 0 ? '0' : n.toLocaleString('en-US', { useGrouping: false, maximumSignificantDigits: 6 });
const degrees = (n: number) => fmt(n * 180 / Math.PI);
function el<K extends keyof HTMLElementTagNameMap>(tag: K, text?: string, className?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag); if (text !== undefined) e.textContent = text; if (className) e.className = className; return e;
}
export const mount: ModuleMount = ({ container, signal: parent }) => {
  if (parent.aborted) return;
  const lifetime = new AbortController(), signal = lifetime.signal, forward = () => lifetime.abort();
  parent.addEventListener('abort', forward, { once: true });
  const root = el('div', undefined, 'cd02'); root.dataset.module = 'CD02'; container.append(root);
  const editors: EquationInput[] = [];
  const cleanup = () => { lifetime.abort(); parent.removeEventListener('abort', forward); editors.forEach(e => e.destroy()); root.remove(); };
  try {
    let selected: Design | null = null;
    const feedback = el('p', 'Predict the gain, then reveal the angle and magnitude construction.', 'cd02-feedback'); feedback.setAttribute('role', 'status');
    function section(title: string): HTMLElement { const s = el('section'); s.append(el('h2', title)); root.append(s); return s; }
    function note(host: HTMLElement, text: string): void { host.append(el('p', text, 'cd02-note')); }
    function button(host: HTMLElement, label: string, action: () => void): HTMLButtonElement {
      const b = el('button', label, 'cd02-primary'); b.type = 'button'; host.append(b);
      b.addEventListener('click', () => { if (signal.aborted) return; b.after(feedback); try { action(); } catch (e) { feedback.textContent = e instanceof Error ? e.message : 'Check the inputs.'; } }, { signal }); return b;
    }
    function number(host: HTMLElement, label: string, value: string, min: string, max: string): HTMLInputElement {
      const l = el('label', label), n = el('input'); n.type = 'number'; n.step = 'any'; n.value = value; n.min = min; n.max = max; l.append(n); host.append(l); return n;
    }
    const data = section('1. Choose a plant and target');
    note(data, 'Continuous SISO, negative unity feedback, zero initial conditions. Plant poles are 0 and −a; the lead section has pole −p and zero −z. All pole/zero locations use 1/s.');
    data.append(createEquationDisplay(String.raw`G(s)=\frac{g}{s(s+a)},\qquad C(s)=K\frac{s+z}{s+p}`, 'Supported plant and lead controller'));
    const equations = el('div', undefined, 'cd02-equations'); data.append(equations);
    const dirty = () => { selected = null; reasoning.replaceChildren(); results.replaceChildren(); verify.disabled = true; feedback.textContent = 'Inputs changed. Reveal the new design before checking the full model.'; };
    for (const [label, value] of [['Plant numerator g', '1'], ['Plant pole parameter a (1/s)', '2']]) {
      const editor = createEquationInput({ label, value, signal, onChange: dirty }); editors.push(editor); equations.append(editor.element);
    }
    note(data, 'Model fields accept numbers, fractions, visible parentheses, +, −, explicit ×/÷ and integer powers −6…6. No variables, e/E, mixed numbers or hidden brace grouping. g: 0.05…20; a: 0.1…20.');
    const targetControls = el('div', undefined, 'cd02-controls'); data.append(targetControls);
    const modeLabel = el('label', 'Target input method'), mode = el('select');
    for (const [value, label] of [['poles', 'Target pole pair'], ['specs', 'Time specifications']]) { const option = el('option', label); option.value = value; mode.append(option); } modeLabel.append(mode); targetControls.append(modeLabel);
    const sigma = number(targetControls, 'Target decay σ (1/s)', '2', '.1', '10'), omega = number(targetControls, 'Target imaginary part ω (rad/s)', '2', '.1', '20');
    const specControls = el('div', undefined, 'cd02-controls'); data.append(specControls);
    const targetOS = number(specControls, 'Requested overshoot (%)', String(100 * Math.exp(-Math.PI)), '.1', '40');
    const targetTs = number(specControls, 'Approximate 2% settling target (s)', '2', '.4', '40'); targetOS.disabled = true; targetTs.disabled = true;
    note(data, 'Time specifications give σ≈4/Ts and ω=−πσ/ln(Mp/100), using a zero-free second-order approximation. The complete compensated system must still meet the requested limits.');
    const poleControls = el('div', undefined, 'cd02-controls'); data.append(poleControls);
    const pole = number(poleControls, 'Compensator pole distance p (1/s)', '6', '.2', '50');
    const prediction = number(poleControls, 'Predicted controller gain K (optional)', '', '.001', '5000');
    const presets = el('div', undefined, 'cd02-controls'); data.append(presets);
    button(presets, 'Baseline design inputs', baseline);
    button(presets, 'Change pole to −8', () => { pole.value = '8'; dirty(); feedback.textContent = 'Pole moved to −8. Predict the new zero, gain, remaining pole and ramp error before revealing.'; });
    const construction = section('2. Predict, then reveal the construction');
    button(construction, 'Check prediction and reveal design', reveal);
    const reasoning = el('div'); construction.append(reasoning);
    const verification = section('3. Verify all modes and requirements');
    note(verification, 'These full-model limits also apply in pole-target mode. In time-specification mode, the stricter of each requested limit and the additional limit below is checked.');
    const limits = el('div', undefined, 'cd02-controls'); verification.append(limits);
    const maxOS = number(limits, 'Additional maximum overshoot (%)', '10', '0', '100');
    const maxTs = number(limits, 'Additional 2% entry deadline (s)', '4', '.1', '200');
    const maxRamp = number(limits, 'Maximum unit-ramp error', '.4', '0', '100');
    const work = el('div', undefined, 'cd02-controls'); verification.append(work);
    const horizon = number(work, 'Response horizon (s)', '12', '.5', '200'), maxGain = number(work, 'Root-locus maximum gain', '60', '.01', '10000');
    const verify = button(verification, 'Verify full compensated model', check); verify.disabled = true;
    const results = el('div'); verification.append(results);
    note(verification, 'The gain sweep computes all three branches at 402 gain samples, including the designed gain. Its range extends if needed to include that gain. Paths are numerical illustrations; root residuals and the complete cubic Routh check verify the selected design. Stable canceled modes are retained.');
    note(verification, 'The zero-state step formula retains all three modes. Metrics use up to 60,000 samples; midpoint-versus-coarse interpolation differences must be ≤0.001 output units. Overshoot and 2% entry are sampled observations through the chosen horizon; entry requires at least max(1/σ,1/r) of observed tail. A short horizon is unresolved. Final ramp error is analytic only after strict full-cubic stability is checked.');
    root.append(feedback);
    function scalar(index: number): number { const d = editors[index].getValue(); if (d.empty || d.hasPlaceholders || d.syntaxIssues.length) throw new Error('Complete the model equation boxes and check their notation.'); return parseNumber(d.latex); }
    function readDesign(): Design {
      const target = mode.value === 'specs' ? targetFromSpecs(readNumericInput(targetOS, 'requested overshoot'), readNumericInput(targetTs, 'settling target')) : { sigma: readNumericInput(sigma, 'target decay'), omega: readNumericInput(omega, 'target imaginary part') };
      return design({ g: scalar(0), a: scalar(1), ...target, pole: readNumericInput(pole, 'compensator pole distance') });
    }
    function marks(d: Design): Mark[] { return [
      { x: 0, y: 0, label: 'plant pole 0', kind: 'pole' }, { x: -d.a, y: 0, label: `plant pole −${fmt(d.a)}`, kind: 'pole' },
      { x: -d.pole, y: 0, label: `controller pole −${fmt(d.pole)}`, kind: 'pole' }, { x: -d.zero, y: 0, label: `controller zero −${fmt(d.zero)}`, kind: 'zero' },
      { x: -d.sigma, y: d.omega, label: `target −${fmt(d.sigma)}+${fmt(d.omega)}j`, kind: 'selected' }, { x: -d.sigma, y: -d.omega, label: `target −${fmt(d.sigma)}−${fmt(d.omega)}j`, kind: 'selected' },
      { x: -d.remaining, y: 0, label: `remaining pole −${fmt(d.remaining)}`, kind: 'selected' },
    ]; }
    function reveal(): void {
      dirty(); const d = readDesign();
      let message = 'Design revealed. Verify the full response, all three poles and the ramp error.';
      if (prediction.value.trim() || prediction.validity.badInput) {
        const guessed = bound(readNumericInput(prediction, 'predicted controller gain'), .001, 5000, 'Predicted gain');
        message = Math.abs(guessed - d.gain) <= .02 * d.gain ? 'Gain prediction agrees within 2%. Now verify the complete model.' : `Your gain ${fmt(guessed)} differs from ${fmt(d.gain)}. Check the magnitude condition after placing the zero.`;
      }
      reasoning.append(createEquationDisplay(String.raw`s_d=-${fmt(d.sigma)}\pm ${fmt(d.omega)}j`, 'Target pole pair'));
      note(reasoning, `Plant angle deficiency: ${degrees(d.deficiency)}°. Chosen controller pole contributes −${degrees(d.poleAngle)}°; the zero contributes +${degrees(d.zeroAngle)}°. Net lead: ${degrees(d.zeroAngle - d.poleAngle)}°. Angle residual: ${degrees(d.angleResidual)}°.`);
      reasoning.append(plot('Angle vectors at the upper target', 'Real part (1/s)', 'Imaginary part (rad/s)', [0, -d.a, -d.pole, -d.zero].map((start, i) => ({ label: ['from plant pole 0', 'from plant pole −a', 'from controller pole −p', 'from controller zero −z'][i], x: [start, -d.sigma], y: [0, d.omega], dashed: i === 3 })), marks(d), true));
      reasoning.append(createEquationDisplay(String.raw`z=\sigma+\frac{\omega}{\tan\theta_z}\approx ${fmt(d.zero)},\quad K=\frac{|s_d(s_d+a)(s_d+p)|}{g|s_d+z|}\approx ${fmt(d.magnitudeGain)}`, 'Angle and magnitude construction'));
      reasoning.append(createEquationDisplay(String.raw`C(s)\approx ${fmt(d.gain)}\frac{s+${fmt(d.zero)}}{s+${fmt(d.pole)}}`, 'Computed lead compensator'));
      reasoning.append(createEquationDisplay(String.raw`r=a+p-2\sigma=${fmt(d.remaining)},\quad Kg=\sigma^2+\omega^2+2\sigma r-ap,\quad z=\frac{(\sigma^2+\omega^2)r}{Kg}`, 'Independent coefficient matching cross check'));
      note(reasoning, `A third pole remains at −${fmt(d.remaining)}. The compensator zero is −${fmt(d.zero)}. They are retained in the full-order check; a target pair does not determine the actual overshoot.`);
      selected = d; verify.disabled = false; feedback.textContent = message;
    }
    function check(): void {
      results.replaceChildren(); if (!selected) throw new Error('Reveal a valid design first.'); const d = selected;
      let osLimit = bound(readNumericInput(maxOS, 'overshoot limit'), 0, 100, 'Overshoot limit (%)');
      let tsLimit = bound(readNumericInput(maxTs, 'entry deadline'), .1, 200, 'Entry deadline (s)');
      const rampLimit = bound(readNumericInput(maxRamp, 'ramp-error limit'), 0, 100, 'Ramp-error limit');
      if (mode.value === 'specs') { osLimit = Math.min(osLimit, readNumericInput(targetOS, 'requested overshoot')); tsLimit = Math.min(tsLimit, readNumericInput(targetTs, 'settling target')); }
      const h = readNumericInput(horizon, 'response horizon'), locus = rootLocus(d, readNumericInput(maxGain, 'locus gain range')), trace = stepTrace(d, h);
      const roots = cubicRoots(d.coefficients[1], d.coefficients[2], d.coefficients[3]);
      if (roots.some(r => r.re >= -1e-8)) throw new Error('The complete cubic roots are not resolved strictly in the left half-plane. Move the target or compensator pole.');
      const residual = Math.max(...roots.map(r => polynomialResidual(d.coefficients, r)));
      results.append(createEquationDisplay(String.raw`D_{cl}(s)=s(s+a)(s+p)+Kg(s+z)=(s+r)(s^2+2\sigma s+\sigma^2+\omega^2)`, 'Unreduced closed loop characteristic polynomial'));
      results.append(createEquationDisplay(String.raw`D_{cl}(s)\approx s^3+${fmt(d.coefficients[1])}s^2+${fmt(d.coefficients[2])}s+${fmt(d.coefficients[3])}`, 'Descending coefficient cubic'));
      note(results, `All computed roots: ${roots.map(r => `${fmt(r.re)}${r.im < 0 ? '' : '+'}${fmt(r.im)}j`).join(', ')}. Scaled polynomial residual ≤ ${fmt(residual)}. Cubic Routh: all coefficients positive and a₂a₁−a₀ = ${fmt(d.coefficients[1] * d.coefficients[2] - d.coefficients[3])} > 0.`);
      if (Math.abs(d.zero - d.remaining) < 1e-8 * Math.max(1, d.zero)) note(results, 'The stable real mode cancels in the reference-to-output transfer relation, but remains in the unreduced cubic and stability check.');
      results.append(plot(`Full compensated root locus, 0 ≤ K ≤ ${fmt(locus.gains.at(-1)!)}`, 'Real part (1/s)', 'Imaginary part (rad/s)', locus.branches.map((b, i) => ({ label: `Branch ${i + 1}`, x: b.map(r => r.re), y: b.map(r => r.im), dashed: i === 1 })), marks(d), true));
      note(results, `Beyond the finite displayed range, one branch approaches the zero −${fmt(d.zero)} as K→∞. The two remaining branches have asymptote angles +90° and −90°, with real-axis centroid ${fmt(-(d.a + d.pole - d.zero) / 2)} (1/s). The finite sweep is not the entire infinite-gain locus.`);
      const residues = responseCoefficients(d);
      results.append(createEquationDisplay(String.raw`y(t)=1+A e^{-rt}+e^{-\sigma t}(B\cos\omega t+D\sin\omega t)`, 'Exact zero state full-model step form'));
      note(results, `Computed residues: A=${fmt(residues.A)}, B=${fmt(residues.B)}, D=${fmt(residues.D)}. Initial y=0 and y′=0; final y=1. Second-order pair-only estimate: overshoot ${fmt(100 * Math.exp(-Math.PI * d.sigma / d.omega))}%, approximate Ts ${fmt(4 / d.sigma)} s.`);
      results.append(plot('Full step response versus target-pair approximation', 'Time (s)', 'Output y (output units)', [
        { label: 'Full cubic and controller zero', x: trace.time, y: trace.full }, { label: 'Pair-only estimate', x: trace.time, y: trace.pair, dashed: true },
        { label: '2% lower band', x: [0, h], y: [.98, .98], dashed: true }, { label: '2% upper band', x: [0, h], y: [1.02, 1.02], dashed: true },
      ]));
      const wrap = el('div', undefined, 'cd02-table-wrap'), table = el('table', undefined, 'cd02-table');
      const header = el('thead'), tr = el('tr'); for (const name of ['Full-model requirement', 'Computed result', 'Check']) tr.append(el('th', name)); header.append(tr); table.append(header);
      const body = el('tbody');
      const rows = [
        ['Strict stability, all three modes', 'Routh and all roots in LHP', 'Pass'],
        [`Overshoot ≤ ${fmt(osLimit)}%`, `${fmt(trace.overshoot)}%`, trace.overshoot <= osLimit ? 'Observed pass' : 'Fails limit'],
        [`2% entry ≤ ${fmt(tsLimit)} s`, trace.entry === null ? 'Unresolved in horizon' : `${fmt(trace.entry)} s`, trace.entry === null || h < tsLimit ? 'Unresolved' : trace.entry <= tsLimit ? 'Observed pass' : 'Fails deadline'],
        [`Unit-ramp error ≤ ${fmt(rampLimit)}`, fmt(d.rampError), d.rampError <= rampLimit ? 'Pass' : 'Fails limit'],
      ];
      for (const values of rows) { const row = el('tr'); values.forEach((v, i) => row.append(el(i ? 'td' : 'th', v))); body.append(row); } table.append(body); wrap.append(table); results.append(wrap);
      results.append(createEquationDisplay(String.raw`K_v=\frac{Kg z}{ap},\qquad e_{\mathrm{ramp}}=\frac{1}{K_v}\approx ${fmt(d.rampError)}`, 'Final value ramp error after full stability verification'));
      note(results, `Ending step error at ${fmt(h)} s: ${fmt(trace.endError)}. Midpoint resolution discrepancy: ${fmt(trace.refinement)} output units. This ending sample is not used as a proof of steady-state error.`);
      feedback.textContent = 'Complete model checked. Compare the full response with the target-pair estimate, then move the compensator pole and repeat.';
    }
    function baseline(): void {
      editors[0].setValue('1'); editors[1].setValue('2'); sigma.value = '2'; omega.value = '2'; pole.value = '6'; mode.value = 'poles'; targetOS.value = String(100 * Math.exp(-Math.PI)); targetTs.value = '2'; prediction.value = ''; maxOS.value = '10'; maxTs.value = '4'; maxRamp.value = '.4'; horizon.value = '12'; maxGain.value = '60'; syncMode(); dirty();
    }
    function syncMode(): void { const specs = mode.value === 'specs'; sigma.disabled = specs; omega.disabled = specs; targetOS.disabled = !specs; targetTs.disabled = !specs; }
    mode.addEventListener('change', () => { syncMode(); dirty(); }, { signal });
    for (const input of [sigma, omega, pole, prediction, targetOS, targetTs]) input.addEventListener('input', dirty, { signal });
    for (const input of [maxOS, maxTs, maxRamp, horizon, maxGain]) input.addEventListener('input', () => { results.replaceChildren(); feedback.textContent = 'Verification inputs changed. Verify the full model again.'; }, { signal });
  } catch (e) { cleanup(); throw e; }
  return cleanup;
};
