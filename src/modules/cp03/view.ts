import type { ModuleMount } from '../../core/module';
import { createEquationDisplay, createEquationInput, type EquationDraft } from '../../shared/equations/input';
import { evaluatePolynomial, experiment, frequencySweep, measure, parsePlant, poles, type Complex, type Plant } from './math';
import { numberLabel as fmt, plot, type Series } from './plots';
import './workspace.css';

function node<K extends keyof HTMLElementTagNameMap>(tag: K, text = '', className = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag); e.textContent = text; e.className = className; return e;
}
function numeric(label: string, value: number, min: number, max: number, step = 'any'): { wrapper: HTMLLabelElement; input: HTMLInputElement } {
  const wrapper = node('label', '', 'cp03-field');
  const input = node('input'); input.type = 'number'; input.value = String(value); input.min = String(min); input.max = String(max); input.step = step;
  wrapper.append(node('span', label), input); return { wrapper, input };
}
function read(input: HTMLInputElement, label: string): number {
  const raw = input.value.trim();
  if (raw.length > 80) throw new Error(`Keep ${label} within 80 characters.`);
  const value = input.valueAsNumber;
  if (!raw || !Number.isFinite(value) || !input.checkValidity()) throw new Error(`Enter ${label} between ${input.min} and ${input.max}.`);
  if (value === 0 && /[1-9]/.test(raw.split(/[eE]/, 1)[0])) throw new Error(`The ${label} is nonzero but too small to represent. Use a larger magnitude.`);
  return value;
}
const mf = (x: number) => fmt(x).replace(/e([+-]?\d+)/, String.raw`\times 10^{$1}`);
function polynomial(p: number[]): string {
  return p.map((v, i) => v === 0 ? '' : `${v >= 0 ? '+' : '-'}${mf(Math.abs(v))}${i === 1 ? 's' : i === 2 ? 's^2' : ''}`).reverse().join('').replace(/^\+/, '') || '0';
}
const degrees = (rad: number) => rad * 180 / Math.PI;
const complexLatex = (z: Complex) => `${mf(z.re)}${z.im < 0 ? '-' : '+'}${mf(Math.abs(z.im))}j`;

export const mount: ModuleMount = ({ container, signal }) => {
  const root = node('div', '', 'cp03-tool');
  const intro = node('p', 'Read the input and output peaks, place your markers, then check gain and phase. Change the frequency to follow the same point through time, Bode and Nyquist views.', 'cp03-intro');
  const form = node('form', '', 'cp03-card'); form.noValidate = true;
  form.append(node('h3', '1. Set the experiment'));
  let draft: EquationDraft;
  let viewController: AbortController | undefined;
  let lastRevealed = false;
  const error = node('p', '', 'cp03-message'); error.setAttribute('role', 'alert'); error.hidden = true;
  const view = node('div', '', 'cp03-view');
  const invalidate = () => {
    if (signal.aborted) return;
    viewController?.abort(); view.replaceChildren();
    lastRevealed = false;
    error.textContent = 'Inputs changed. Apply the experiment to recompute the traces.'; error.hidden = false;
  };
  const plantInput = createEquationInput({ label: 'Plant G(s)', value: String.raw`G(s)=\frac{1}{(s+1)(s+2)}`, signal, onChange: next => { draft = next; invalidate(); } });
  form.append(plantInput.element);
  const fields = node('div', '', 'cp03-fields');
  const omega = numeric('Frequency ω (rad/s)', 1, 0.01, 100);
  const amplitude = numeric('Input amplitude A', 1, 0.01, 100);
  const start = numeric('Window start (s)', 8, 0, 1000);
  fields.append(omega.wrapper, amplitude.wrapper, start.wrapper);
  [omega.input, amplitude.input, start.input].forEach(input => input.addEventListener('input', invalidate, { signal }));
  const cursorLabel = node('label', '', 'cp03-field');
  const cursor = node('input'); cursor.type = 'range'; cursor.min = '-2'; cursor.max = '2'; cursor.step = '0.01'; cursor.value = '0';
  cursorLabel.append(node('span', 'Linked frequency cursor · 0.01–100 rad/s (logarithmic)'), cursor);
  const apply = node('button', 'Apply experiment', 'cp03-primary'); apply.type = 'submit';
  const presets = node('div', '', 'cp03-actions');
  const presetData = [
    ['Course baseline', String.raw`G(s)=\frac{1}{(s+1)(s+2)}`, 1, 1, 8],
    ['Changed frequency', String.raw`G(s)=\frac{1}{(s+1)(s+2)}`, 2, 2, 8],
    ['Slow transient', String.raw`G(s)=\frac{1}{s+0.1}`, 1, 1, 0],
    ['Unstable model', String.raw`G(s)=\frac{1}{s-1}`, 1, 1, 0],
  ] as const;
  presetData.forEach(([label, latex, w, a, t]) => {
    const button = node('button', label); button.type = 'button';
    button.addEventListener('click', () => {
      plantInput.setValue(latex); draft = plantInput.getValue(); omega.input.value = String(w); amplitude.input.value = String(a); start.input.value = String(t); render();
    }, { signal }); presets.append(button);
  });
  form.append(fields, cursorLabel, apply, presets, error);
  const limits = node('details', '', 'cp03-card cp03-limits'); limits.append(node('summary', 'Supported models and conventions'));
  limits.append(node('p', 'Real proper rational polynomials in s, degree 0–2, expanded or factored; decimal numbers, fractions, products, sums and polynomial powers −2…2. Textbook powers of the number 10 accept integer exponents −400…400 within numeric bounds. Use decimals or ×10 powers for coefficients; e/E notation is algebra in the visual editor and is rejected. Optional G(s)=. No delays or other functions. Expanded coefficients ≤10000, normalized coefficients ≤10⁶, leading denominator magnitude ≥10⁻⁸, pole magnitudes ≤100 rad/s, at most 300 characters.'));
  limits.append(node('p', 'u(t)=A sin(ωt) starts at t=0 with zero canonical states. A is in arbitrary input units; y uses the corresponding output units. Open-loop SISO LTI plant; no feedback or sampling. Denominator modes are retained without pole-zero cancellation, so “stable” is a conservative denominator-mode classification, not a hidden-state assertion.'));
  limits.append(node('p', 'The window spans three periods. Start 0–1000 s; total time ≤3000 s; 901 particular-sinusoid samples, at most 12001 transient samples, and 301 frequency samples plus the cursor. An unresolved transient window is reported instead of drawing an aliased trace. Curves illustrate analytic formulas, not sampled proofs. Phase is principal (−180° to 180°), and marker phase is modulo one period. Zero/near-zero frequency response has undefined phase. Singular frequencies are rejected (relative denominator tolerance 10⁻¹⁰). Values are rounded for display; no solver iteration is used.'));
  limits.append(node('p', 'Calculations use floating-point coefficients and sampled drawings. Dynamic unstable time traces require positive pole rate × time ≤20 to limit roundoff amplification; this numerical guard is not a certified error bound or a stability proof. Exact algebraic-output identities have no transient. Formal sinusoidal and frequency results remain available outside the time-trace horizon.'));
  limits.append(node('p', 'Use an explicit + or − for addition, or × for multiplication between a number and a fraction. Adjacent mixed numbers are rejected because their displayed meaning differs from multiplication. Ordinary and nested fractions remain supported.'));
  limits.append(node('p', 'Visible parentheses group sums and signed bases. Fraction boxes and exponent positions retain their own scope; invisible formatting groups do not add parentheses or multiplication.'));
  root.append(intro, form, view, limits); container.append(root); draft = plantInput.getValue();

  function render(keepReveal = false): void {
    if (signal.aborted) return;
    const revealOnLoad = keepReveal && lastRevealed; lastRevealed = false;
    viewController?.abort(); viewController = new AbortController();
    const localSignal = viewController.signal;
    view.replaceChildren(); error.hidden = true;
    try {
      if (draft.empty || draft.hasPlaceholders || draft.syntaxIssues.length) throw new Error('Complete the plant equation and check its notation before applying.');
      const plant: Plant = parsePlant(draft.latex);
      const w = read(omega.input, 'frequency in rad/s'), A = read(amplitude.input, 'input amplitude'), t0 = read(start.input, 'window start in seconds');
      cursor.value = String(Math.log10(w));
      const e = experiment(plant, w, A), f = e.value, t1 = t0 + 3 * e.period;
      const times = Array.from({ length: 901 }, (_, i) => t0 + (t1 - t0) * i / 900);
      const samples = times.map(t => ({ t, ...e.particular(t) }));
      const responseAmplitude = A * f.magnitude;
      const bound = e.tailBound(t0), tolerance = Math.max(1e-9, responseAmplitude * 0.01);
      const settled = e.stable && bound <= tolerance;
      let actual: ({ t: number } & ReturnType<typeof e.sample>)[] | undefined;
      let actualError = '';
      // Resolve each retained mode with at least ten points per inverse pole
      // magnitude. A proven small tail needs no extra visual resolution.
      const rate = Math.max(w, ...poles(plant).map(p => Math.hypot(p.re, p.im)));
      const steps = settled ? 900 : Math.max(900, Math.ceil((t1 - t0) * rate * 10));
      try {
        if (steps > 12000) throw new Error('This three-period window cannot resolve the transient within 12001 samples. Increase ω, choose slower modes, or move to a settled window.');
        actual = Array.from({ length: steps + 1 }, (_, i) => { const t = t0 + (t1 - t0) * i / steps; return { t, ...e.sample(t) }; });
      } catch (cause) { actualError = cause instanceof Error ? cause.message : 'The zero-state response could not be displayed.'; }
      const traceCard = node('section', '', 'cp03-card');
      traceCard.append(node('h3', '2. Measure before revealing'));
      const classification = node('p', e.classification, 'cp03-badge'); traceCard.append(classification);
      const qualification = !e.stable ? 'The plotted sinusoid is a formal particular solution. The zero-state response need not approach it; do not report a steady-state trace measurement.'
        : settled ? 'The transient tail is bounded below 1% of the output sinusoid amplitude throughout this window (absolute floor 10⁻⁹). Peak measurements can be interpreted as steady-state approximations.'
          : `Not settled: the conservative transient tail bound at this start is ${fmt(bound)} output units. Move the window later before interpreting actual peaks as a steady-state frequency result.`;
      traceCard.append(node('p', qualification, 'cp03-qualification'));
      traceCard.append(node('p', 'Place tᵤ at a positive input peak and tᵧ at a matching positive output peak. Set B at the output amplitude above zero. A later output peak means negative phase. Numeric controls provide the same placement as clicking the plot.'));
      const inputPeak = (Math.ceil((w * t0 - Math.PI / 2) / (2 * Math.PI)) * 2 * Math.PI + Math.PI / 2) / w;
      const tu = numeric('Input peak tᵤ (s)', inputPeak, t0, t1);
      const ty = numeric('Output peak tᵧ (s)', inputPeak, t0, t1);
      const B = numeric('Output amplitude marker B', Math.min(1e8, A / 2), 0, 1e8);
      const markerFields = node('div', '', 'cp03-fields'); markerFields.append(tu.wrapper, ty.wrapper, B.wrapper);
      const clickLabel = node('label', '', 'cp03-field'); clickLabel.append(node('span', 'Click plot to place'));
      const target = node('select');
      for (const [value, label] of [['input', 'Input peak marker'], ['output', 'Output peak marker']]) { const option = node('option', label); option.value = value; target.append(option); }
      clickLabel.append(target);
      const transientLabel = node('label', '', 'cp03-check'); const showTransient = node('input'); showTransient.type = 'checkbox';
      transientLabel.append(showTransient, node('span', 'Reveal zero-state response and transient'));
      showTransient.disabled = !actual;
      if (!actual) transientLabel.append(node('span', `Unavailable for this window: ${actualError}`));
      const plotHost = node('div');
      const markerStatus = node('p', '', 'cp03-message'); markerStatus.setAttribute('role', 'status');
      const measurement = node('div', '', 'cp03-equations');
      const reveal = node('button', 'Reveal calculation and linked plots', 'cp03-primary'); reveal.type = 'button';
      const checked = node('div', '', 'cp03-checked');
      let revealed = false;
      let plotController: AbortController | undefined;
      const disposePlot = () => plotController?.abort();
      localSignal.addEventListener('abort', disposePlot, { once: true });
      function updateMarkers(): void {
        if (localSignal.aborted) return;
        measurement.replaceChildren(); markerStatus.textContent = '';
        try {
          const inputTime = read(tu.input, 'input peak time'), outputTime = read(ty.input, 'output peak time'), b = read(B.input, 'output amplitude');
          const m = measure(inputTime, outputTime, b, w, A);
          measurement.append(createEquationDisplay(String.raw`\widehat{|G|}=\frac{B}{A}\approx ${mf(m.gain)},\quad\widehat{\varphi}\equiv-\omega(t_y-t_u)\approx ${mf(degrees(m.phase))}^{\circ}\approx ${mf(m.phase)}\ \mathrm{rad}`, 'Your marker measurement'));
          if (revealed && f.phase !== null) {
            const phaseError = Math.atan2(Math.sin(m.phase - f.phase), Math.cos(m.phase - f.phase));
            const gainDifference = m.gain - f.magnitude, phaseDifference = degrees(phaseError);
            markerStatus.textContent = `Marker difference from the analytic value: gain ${fmt(Math.abs(gainDifference) < 1e-12 ? 0 : gainDifference)}, phase ${fmt(Math.abs(phaseDifference) < 1e-12 ? 0 : phaseDifference)}°. ${settled ? 'Measured peaks are approximate.' : 'Use the formal sinusoid for comparison; actual response peaks are not certified steady state.'}`;
          } else if (revealed) markerStatus.textContent = 'Phase is undefined at zero/near-zero gain. A positive output peak cannot determine it.';
          plotController?.abort(); plotController = new AbortController();
          const series: Series[] = [
            { label: 'Input u · dashed', style: 'input', points: samples.map(s => ({ x: s.t, y: s.input })) },
            { label: e.stable ? 'Steady sinusoid yₛ · solid' : 'Formal particular yₚ · solid', style: 'output', points: samples.map(s => ({ x: s.t, y: s.particular })) },
          ];
          if (showTransient.checked && actual) {
            series[1] = { label: 'Zero-state output y · solid', style: 'output', points: actual.map(s => ({ x: s.t, y: s.output })) };
            series.push({ label: 'Transient y−yₚ · dotted', style: 'transient', points: actual.map(s => ({ x: s.t, y: s.transient })) });
          }
          const extrema = series.flatMap(s => s.points.flatMap(p => p ? [p.y] : []));
          const lo = Math.min(0, ...extrema), hi = Math.max(0, b, ...extrema), pad = Math.max(1e-12, (hi - lo) * 0.12);
          plotHost.replaceChildren(plot({ title: showTransient.checked ? 'Input, actual zero-state output and transient' : 'Input and particular sinusoid', xLabel: 'Time t (s)', yLabel: 'Signal amplitude (u / y units)', series,
            xRange: [t0, t1], yRange: [lo - pad, hi + pad],
            marks: [{ x: inputTime, label: `tᵤ=${fmt(inputTime)} s` }, { x: outputTime, label: `tᵧ=${fmt(outputTime)} s` }, { y: b, label: `B=${fmt(b)}` }],
            signal: plotController.signal, onTime: time => { (target.value === 'input' ? tu.input : ty.input).value = String(time); updateMarkers(); },
          }));
        } catch (cause) {
          plotController?.abort(); plotHost.replaceChildren();
          markerStatus.textContent = cause instanceof Error ? cause.message : 'Check marker values.';
        }
      }
      [tu.input, ty.input, B.input].forEach(input => input.addEventListener('input', updateMarkers, { signal: localSignal }));
      showTransient.addEventListener('change', updateMarkers, { signal: localSignal });
      reveal.addEventListener('click', () => {
        if (revealed) return;
        revealed = true; lastRevealed = true; reveal.disabled = true; reveal.textContent = 'Calculation revealed';
        checked.append(node('h3', '3. Compare and explain'));
        checked.append(createEquationDisplay(String.raw`G(s)\approx\frac{${polynomial(plant.numerator)}}{${polynomial(plant.denominator)}},\quad u(t)\approx ${mf(A)}\sin(${mf(w)}t)`, 'Normalized plant and input, rounded coefficients'));
        const numerator = evaluatePolynomial(plant.numerator, w), denominator = evaluatePolynomial(plant.denominator, w);
        checked.append(createEquationDisplay(String.raw`s=j\omega,\quad j^2=-1,\quad G(j${mf(w)})\approx\frac{${complexLatex(numerator)}}{${complexLatex(denominator)}}\approx ${complexLatex(f)}`, 'Substitute frequency and divide complex numbers'));
        checked.append(createEquationDisplay(String.raw`|G|=\sqrt{(\Re G)^2+(\Im G)^2}\approx ${mf(f.magnitude)},\quad B=A|G|\approx ${mf(responseAmplitude)}`, 'Calculated gain and output amplitude'));
        if (f.phase !== null) {
          checked.append(createEquationDisplay(String.raw`\varphi=\operatorname{atan2}(\Im G,\Re G)\approx ${mf(f.phase)}\ \mathrm{rad}=${mf(degrees(f.phase))}^{\circ}`, 'Calculated signed principal phase'));
          checked.append(createEquationDisplay(String.raw`y_p(t)\approx ${mf(responseAmplitude)}\sin\left(${mf(w)}t${f.phase < 0 ? '-' : '+'}${mf(Math.abs(f.phase))}\right),\quad\Delta t\equiv -\frac{\varphi}{\omega}\approx ${mf(-f.phase / w)}\ \mathrm{s}`, 'Particular solution and peak shift modulo a period'));
        } else checked.append(node('p', 'The gain is zero or within the relative 10⁻¹² numerator tolerance of a zero: phase and a peak time shift are undefined.'));
        const rootText = poles(plant).map(p => `${fmt(p.re)}${p.im < 0 ? '−' : '+'}${fmt(Math.abs(p.im))}j`).join(', ') || 'no dynamic poles';
        checked.append(node('p', `Denominator poles (rad/s): ${rootText}. ${e.stable ? 'All denominator modes decay.' : 'A nondecaying denominator mode prevents a guaranteed steady-state experiment.'} Phase is wrapped; adding a whole period to a marker preserves its frequency interpretation.`));
        checked.append(node('p', 'Exact identities are shown symbolically; displayed numbers are rounded. The zero-state response is the particular sinusoid plus the homogeneous transient from zero canonical states. Toggle the transient, then try Window start = 0 and compare it with a later window.'));
        const sweep = frequencySweep(plant, w);
        const magnitude: Series = { label: 'Magnitude', style: 'output', points: sweep.map(s => s && s.db !== null ? { x: Math.log10(s.w), y: s.db } : null) };
        let previous: number | null = null;
        const phase: Series = { label: 'Principal phase', style: 'output', points: [] };
        sweep.forEach(s => {
          const d = s?.phase == null ? null : degrees(s.phase);
          if (d !== null && previous !== null && Math.abs(d - previous) > 180) phase.points.push(null);
          phase.points.push(s && d !== null ? { x: Math.log10(s.w), y: d } : null); previous = d;
        });
        const plots = node('div', '', 'cp03-frequency-plots');
        plots.append(plot({ title: `Bode magnitude · cursor ω=${fmt(w)} rad/s`, xLabel: 'ω (rad/s, logarithmic)', yLabel: '20 log₁₀ |G| (dB)', series: [magnitude], xRange: [-2, 2], logX: true, marks: f.db === null ? [] : [{ x: Math.log10(w), y: f.db, label: `${fmt(f.db)} dB` }] }));
        plots.append(plot({ title: 'Bode phase · same frequency cursor', xLabel: 'ω (rad/s, logarithmic)', yLabel: 'Principal phase (°)', series: [phase], xRange: [-2, 2], yRange: [-190, 190], logX: true, marks: f.phase === null ? [] : [{ x: Math.log10(w), y: degrees(f.phase), label: `${fmt(degrees(f.phase))}°` }] }));
        const nyquist: Series = { label: 'Positive frequencies 0.01–100 rad/s', style: 'output', points: sweep.map(s => s ? { x: s.re, y: s.im } : null) };
        const range = Math.max(1e-4, ...sweep.flatMap(s => s ? [Math.abs(s.re), Math.abs(s.im)] : [])) * 1.15;
        plots.append(plot({ title: 'Nyquist · same frequency cursor', xLabel: 'Re G(jω)', yLabel: 'Im G(jω)', series: [nyquist], xRange: [-range, range], yRange: [-range, range], marks: [{ x: f.re, y: f.im, label: `ω=${fmt(w)} rad/s` }] }));
        checked.append(plots, node('p', 'Frequency curves are sampled over 0.01–100 rad/s; gaps mark known imaginary-axis poles and singular or undefined samples. Narrow finite peaks may be missed by the grid. Nyquist shows the positive-frequency branch, with independently drawn horizontal/vertical scales; it is not a stability test. Move the linked frequency cursor above to begin a new measurement.'));
        updateMarkers();
      }, { signal: localSignal });
      traceCard.append(markerFields, clickLabel, transientLabel, plotHost, measurement, markerStatus, reveal, checked);
      view.append(traceCard); updateMarkers(); if (revealOnLoad) reveal.click();
    } catch (cause) {
      error.textContent = cause instanceof Error ? cause.message : 'The experiment could not be computed.'; error.hidden = false;
    }
  }
  form.addEventListener('submit', event => { event.preventDefault(); render(); }, { signal });
  cursor.addEventListener('input', () => { omega.input.value = String(Number((10 ** cursor.valueAsNumber).toPrecision(8))); render(true); }, { signal });
  render();
  const cleanup = () => { viewController?.abort(); plantInput.destroy(); root.remove(); };
  signal.addEventListener('abort', cleanup, { once: true });
  return cleanup;
};
