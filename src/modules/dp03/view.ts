import type { ModuleMount } from '../../core/module';
import { createEquationInput, createEquationDisplay, type EquationDraft } from '../../shared/equations/input';
import { parseModel, type FrequencyModel } from './expression';
import { bilinear, format, frequencySamples, fromPhysical, numberLatex, polynomialLatex, rationalAt, unitResponse, warpedResponse, type FrequencyResult, type WarpedModel } from './frequency';
import './workspace.css';

type Sweep = ReturnType<typeof frequencySamples>;
export const mountView: ModuleMount = ({ container, signal }) => {
  const el = <K extends keyof HTMLElementTagNameMap>(tag: K, text = '', className = '') => {
    const node = document.createElement(tag); node.textContent = text; node.className = className; return node;
  };
  const root = el('div', '', 'dp03-tool'); container.append(root);
  const listen = (target: EventTarget, event: string, action: () => void) => target.addEventListener(event, action, { signal });
  const button = (text: string, action: () => void) => {
    const node = el('button', text); node.type = 'button'; listen(node, 'click', action); return node;
  };
  const numeric = (text: string, value: string) => {
    const label = el('label', text, 'dp03-field'), input = el('input'); input.type = 'number'; input.step = 'any'; input.value = value; label.append(input); return { label, input };
  };
  const read = (input: HTMLInputElement, label: string) => {
    if (!input.value.trim() || !Number.isFinite(input.valueAsNumber)) throw new Error(`Enter a finite ${label}.`);
    return input.valueAsNumber;
  };
  let draft: EquationDraft, current: { model: FrequencyModel; transformed: WarpedModel; points: Sweep; period: number } | undefined;
  let alias: { raw: number; angle: number; aliased: boolean } | undefined;
  const message = el('p', '', 'dp03-message'); message.hidden = true; message.setAttribute('role', 'status');
  const output = el('section', '', 'dp03-output'); output.hidden = true;
  const invalidate = () => { current = undefined; output.hidden = true; message.hidden = false; message.textContent = 'Predict the response, then reveal the checked plots for these inputs.'; };
  root.append(el('h2', 'Follow a frequency around the unit circle'), el('p', 'Evaluate the entered discrete model exactly at z = exp(jΩ), then compare a bilinear construction on its correctly warped frequency axis.'));
  const editor = createEquationInput({ label: 'Discrete transfer function G(z)', value: String.raw`\frac{0.0544z+0.0493}{z^2-1.741z+0.741}`, signal, onChange: next => { draft = next; invalidate(); } });
  root.append(editor.element); draft = editor.getValue();
  const conventions = el('details', '', 'dp03-card'); conventions.append(el('summary', 'Conventions and supported inputs'), el('p', 'Real causal rational expressions of numerator/denominator order at most 4 in q=z⁻¹. Coefficients ascend in q and are normalized to a₀=1. Sums, products, fractions, integer powers and textbook powers of ten are supported; visual e/E exponent text is rejected. No automatic non-delay pole/zero cancellation. These are frequency evaluations, not time-response or closed-loop stability proofs.'), el('p', 'The baseline coefficients are rounded source inputs. At their printed precision z=1 is a denominator root, so DC has no reported finite gain. Changing T holds the entered coefficients fixed and changes physical frequency labels; it does not re-discretize a plant. Magnitudes use gain units and dB=20 log₁₀|G|; phase is principal phase in degrees, with jumps drawn as gaps.'), el('p', 'T: 10⁻⁶–100 s; normalized or physical alias entry magnitude ≤100,000 (with |ωT|≤100,000). Normalized coefficients ≤10⁶, transformed coefficients ≤10¹⁶, expression length ≤600, token count ≤240 and group depth ≤24. Plot: 241 samples including DC, logarithmically spaced over π·10⁻⁴≤Ω≤π. A finite sample plot cannot prove behavior between points. Near-pole threshold: 10⁻¹⁰ relative to coefficient construction scales; zero/phase threshold: 10⁻¹⁴. Numerical coefficients/results round to 7 significant digits.'));
  root.append(conventions);
  const controls = el('div', '', 'dp03-grid');
  const period = numeric('Sample period T (s)', '.1'), omega = numeric('Normalized Ω (rad/sample)', '.1'), span = numeric('Nyquist half-span (gain units)', '10');
  omega.input.min = '0'; omega.input.max = String(Math.PI); period.input.min = '.000001'; period.input.max = '100'; span.input.min = '.01'; span.input.max = '1000000';
  controls.append(period.label, omega.label, span.label); root.append(controls);
  const sliderLabel = el('label', 'Unit-circle cursor Ω (arrow keys or numeric entry)', 'dp03-field'), slider = el('input');
  slider.type = 'range'; slider.min = '0'; slider.max = String(Math.PI); slider.step = '.001'; slider.value = '.1'; sliderLabel.append(slider); root.append(sliderLabel);
  const attempts = el('fieldset', '', 'dp03-card'); attempts.append(el('legend', 'Predict before revealing (optional)'));
  const attemptGrid = el('div', '', 'dp03-grid'), predictedGain = numeric('Your magnitude |G|', ''), predictedPhase = numeric('Your phase (degrees)', ''); attemptGrid.append(predictedGain.label, predictedPhase.label); attempts.append(attemptGrid, el('p', 'Feedback uses 0.1%/0.001 gain tolerance and 0.5° phase tolerance modulo 360°.'));
  root.append(attempts);
  const aliasPanel = el('details', '', 'dp03-card'); aliasPanel.append(el('summary', 'Try a physical frequency beyond Nyquist'));
  const physical = numeric('Requested physical ω (rad/s)', '1'), aliasNote = el('p');
  aliasPanel.append(physical.label, button('Map physical frequency', () => {
    try {
      alias = fromPhysical(read(physical.input, 'physical frequency'), read(period.input, 'sample period'));
      omega.input.value = String(Math.abs(alias.angle)); slider.value = omega.input.value;
      aliasNote.textContent = `Raw Ω=ωT=${format(alias.raw)} rad/sample; principal signed Ω=${format(alias.angle)}. ${alias.aliased ? 'This repeats an existing unit-circle frequency.' : 'This lies within the independent interval.'} The positive-frequency cursor uses |Ω|; a negative signed alias has the conjugate response.`;
      if (current) render(); else invalidate();
    } catch (cause) { fail(cause); }
  }), aliasNote); root.append(aliasPanel);
  const presets = el('div', '', 'dp03-actions');
  for (const [name, latex] of [['Rounded source baseline', String.raw`\frac{0.0544z+0.0493}{z^2-1.741z+0.741}`], ['First-order variation', String.raw`\frac1{1-0.5z^{-1}}`], ['Two-tap average', String.raw`\frac12(1+z^{-1})`]]) {
    presets.append(button(name, () => { editor.setValue(latex); draft = editor.getValue(); invalidate(); }));
  }
  root.append(presets);
  const summary = el('div', '', 'dp03-card'), feedback = el('p'), plots = el('div', '', 'dp03-plots'), mapping = el('div', '', 'dp03-card');
  output.append(summary, feedback, plots, mapping);
  function fail(cause: unknown): void { current = undefined; output.hidden = true; message.hidden = false; message.textContent = (cause as Error).message; }
  const checkedAngle = () => {
    const angle = read(omega.input, 'normalized frequency');
    if (angle < 0 || angle > Math.PI) throw new Error('Choose the positive-frequency cursor from 0 to π rad/sample. Use the alias experiment for signed frequencies.');
    return angle;
  };
  const resultText = (result: FrequencyResult): string => result.kind === 'pole' ? result.message : result.magnitude === 0 ? 'Zero (or below numerical resolution): |G|=0, dB tends to −∞; phase is undefined.' : `|G|≈${format(result.magnitude)}; ${format(result.db!)} dB; principal phase≈${format(result.phase! * 180 / Math.PI)}°.`;
  const complexLatex = (result: FrequencyResult) => result.kind === 'value' ? `${numberLatex(result.value.re)}${result.value.im < 0 ? '-' : '+'}${numberLatex(Math.abs(result.value.im))}j` : '\\text{undefined}';
  function render(): void {
    if (!current || signal.aborted) return;
    try {
      const angle = checkedAngle(), halfSpan = read(span.input, 'Nyquist half-span');
      if (halfSpan < .01 || halfSpan > 1e6) throw new Error('Nyquist half-span must be between .01 and 1,000,000 gain units.');
      const exact = unitResponse(current.model, angle), warped = warpedResponse(current.model, current.transformed, angle), physicalFrequency = angle / current.period;
      const unwarped = rationalAt(current.transformed, { re: 0, im: physicalFrequency });
      summary.replaceChildren(el('h3', 'Checked unit-circle cursor'), createEquationDisplay(`z=e^{j\\Omega},\\quad\\Omega=${numberLatex(angle)}\\;\\mathrm{rad/sample}`, 'Selected normalized frequency'), createEquationDisplay(`\\omega=\\Omega/T\\approx${numberLatex(physicalFrequency)}\\;\\mathrm{rad/s},\\quad f\\approx${numberLatex(physicalFrequency / (2 * Math.PI))}\\;\\mathrm{Hz}`, 'Physical frequency'), createEquationDisplay(`G(e^{j\\Omega})\\approx${complexLatex(exact)}`, 'Exact frequency evaluation'), el('p', resultText(exact)), el('p', `Nyquist frequency: π/T≈${format(Math.PI / current.period)} rad/s (${format(1 / (2 * current.period))} Hz). Real coefficients give G(exp(−jΩ))=conj(G(exp(jΩ))). No initial history is used in this algebraic frequency evaluation.`));
      const messages: string[] = [];
      if (exact.kind === 'value') {
        if (predictedGain.input.value.trim()) {
          const guess = read(predictedGain.input, 'magnitude prediction');
          messages.push(Math.abs(guess - exact.magnitude) <= .001 * Math.max(1, exact.magnitude) ? 'Magnitude prediction matches.' : `Magnitude: your ${format(guess)}, computed ${format(exact.magnitude)}.`);
        }
        if (predictedPhase.input.value.trim()) {
          const guess = read(predictedPhase.input, 'phase prediction');
          if (exact.phase === null) messages.push('Phase cannot be checked at a zero response.');
          else {
            const residual = Math.abs(((guess - exact.phase * 180 / Math.PI + 180) % 360 + 360) % 360 - 180);
            messages.push(residual <= .5 ? 'Phase prediction matches.' : `Phase: your ${format(guess)}°, computed ${format(exact.phase * 180 / Math.PI)}°.`);
          }
        }
      }
      feedback.textContent = messages.join(' ') || 'Move the unit-circle cursor with the slider, arrow keys or numeric Ω. Edit the model or T for a new prediction.';
      mapping.replaceChildren(el('h3', 'Bilinear construction and frequency warping'), createEquationDisplay('z=\\frac{1+Tw/2}{1-Tw/2},\\quad q=z^{-1}=\\frac{1-Tw/2}{1+Tw/2}', 'Bilinear substitution'), createEquationDisplay(`G_w(w)\\approx\\frac{${polynomialLatex(current.transformed.b, 'w')}}{${polynomialLatex(current.transformed.a, 'w')}}`, 'Computed transformed polynomials'), createEquationDisplay('w=j\\omega_w,\\quad\\omega_w=\\frac{2}{T}\\tan\\frac{\\Omega}{2}', 'Frequency warping relation'), el('p', warped.endpoint ? 'At Ω=π, z=−1 maps to w at infinity. The transformed value below is the original rational endpoint limit, not a finite W-frequency evaluation.' : `For this cursor, ω_w≈${format(warped.frequency!)} rad/s in the transformed plane.`), el('p', `Warped construction: ${resultText(warped.result)}`), el('p', `Unwarped approximation at w=jω with ω=Ω/T: ${resultText(unwarped)}`), el('p', 'The substitution is an algebraic identity for the entered discrete model when frequency is warped. Evaluating the transformed model on the unwarped physical frequency axis is an approximation. The dashed Bode curve exposes that error; it is not an identical linear frequency axis.'));
      if (exact.kind === 'value' && warped.result.kind === 'value') mapping.append(el('p', `Direct/warped complex residual ≈ ${format(Math.hypot(exact.value.re - warped.result.value.re, exact.value.im - warped.result.value.im))}. Transformed coefficient construction scales are retained when detecting singularities.`));
      if (alias) mapping.append(el('p', `Signed alias evaluation at Ω=${format(alias.angle)}: ${resultText(unitResponse(current.model, alias.angle))} Frequencies separated by 2π/T repeat; frequencies beyond Nyquist add no new independent discrete response information.`));
      drawPlots(angle, exact, halfSpan); output.hidden = false; message.hidden = true;
    } catch (cause) { fail(cause); }
  }
  function drawPlots(angle: number, selected: FrequencyResult, halfSpan: number): void {
    if (!current) return;
    const ns = 'http://www.w3.org/2000/svg';
    const svg = (label: string, width = 640, height = 280) => {
      const node = document.createElementNS(ns, 'svg'); node.setAttribute('viewBox', `0 0 ${width} ${height}`); node.setAttribute('role', 'img'); node.setAttribute('aria-label', label); return node;
    };
    const shape = (parent: SVGSVGElement, tag: string, attrs: Record<string, number | string>, text?: string) => {
      const node = document.createElementNS(ns, tag); for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value)); if (text) node.textContent = text; parent.append(node); return node;
    };
    const card = (title: string, picture: SVGSVGElement, note: string) => {
      const node = el('div', '', 'dp03-card'); node.append(el('h3', title)); const scroll = el('div', '', 'dp03-scroll'); scroll.append(picture); node.append(scroll, el('p', note)); return node;
    };
    const plane = svg('Unit circle: real and imaginary z axes, selected positive-frequency point.', 320, 280);
    shape(plane, 'line', { x1: 30, y1: 140, x2: 290, y2: 140, class: 'dp03-axis' }); shape(plane, 'line', { x1: 160, y1: 25, x2: 160, y2: 255, class: 'dp03-axis' });
    shape(plane, 'circle', { cx: 160, cy: 140, r: 100, class: 'dp03-circle' });
    shape(plane, 'circle', { cx: 160 + 100 * Math.cos(angle), cy: 140 - 100 * Math.sin(angle), r: 6, class: 'dp03-marker' });
    shape(plane, 'text', { x: 250, y: 165 }, 'Re z'); shape(plane, 'text', { x: 175, y: 25 }, 'Im z'); shape(plane, 'text', { x: 261, y: 140 }, '1'); shape(plane, 'text', { x: 40, y: 140 }, '−1');
    const nyquist = svg('Sampled Nyquist response: solid positive frequencies, dashed conjugate negative frequencies, selected gain point. Both axes are gain units.');
    const nx = (x: number) => 330 + 110 * x / halfSpan, ny = (y: number) => 140 - 110 * y / halfSpan;
    shape(nyquist, 'line', { x1: 70, y1: 140, x2: 590, y2: 140, class: 'dp03-axis' }); shape(nyquist, 'line', { x1: 330, y1: 25, x2: 330, y2: 255, class: 'dp03-axis' });
    shape(nyquist, 'text', { x: 480, y: 270 }, 'Re G (gain units)'); shape(nyquist, 'text', { x: 10, y: 20 }, 'Im G');
    for (const sign of [1, -1]) {
      let path = '', previous = false;
      for (const point of current.points) {
        if (point.exact.kind !== 'value' || Math.abs(point.exact.value.re) > halfSpan || Math.abs(point.exact.value.im) > halfSpan) { previous = false; continue; }
        path += `${previous ? 'L' : 'M'}${nx(point.exact.value.re)},${ny(sign * point.exact.value.im)} `; previous = true;
      }
      shape(nyquist, 'path', { d: path, class: sign === 1 ? 'dp03-line' : 'dp03-comparison' });
    }
    for (const tick of [-halfSpan, 0, halfSpan]) {
      shape(nyquist, 'text', { x: nx(tick), y: 157, 'text-anchor': 'middle' }, format(tick)); shape(nyquist, 'text', { x: 335, y: ny(tick) }, format(tick));
    }
    if (selected.kind === 'value' && Math.abs(selected.value.re) <= halfSpan && Math.abs(selected.value.im) <= halfSpan) shape(nyquist, 'circle', { cx: nx(selected.value.re), cy: ny(selected.value.im), r: 5, class: 'dp03-marker' });
    const bode = (phase: boolean) => {
      const picture = svg(phase ? 'Principal phase Bode plot in degrees; solid exact, dashed unwarped approximation, positive normalized log-frequency axis.' : 'Magnitude Bode plot in decibels; solid exact, dashed unwarped approximation, positive normalized log-frequency axis.');
      const values = current!.points.flatMap(point => [point.exact, point.unwarped]).flatMap(result => result.kind === 'pole' || (phase ? result.phase === null : result.db === null) ? [] : [phase ? result.phase! * 180 / Math.PI : result.db!]);
      const low = phase ? -180 : Math.floor(Math.min(0, ...values) / 20) * 20, high = phase ? 180 : Math.max(20, Math.ceil(Math.max(0, ...values) / 20) * 20);
      const bx = (x: number) => 70 + 510 * Math.max(0, Math.min(1, (Math.log10(Math.max(x, Math.PI * .0001) / Math.PI) + 4) / 4));
      const by = (x: number) => 225 - 190 * (x - low) / (high - low);
      shape(picture, 'line', { x1: 70, y1: 225, x2: 580, y2: 225, class: 'dp03-axis' }); shape(picture, 'line', { x1: 70, y1: 30, x2: 70, y2: 225, class: 'dp03-axis' });
      shape(picture, 'text', { x: 5, y: 20 }, phase ? 'Phase (°)' : 'Magnitude (dB)'); shape(picture, 'text', { x: 350, y: 275 }, 'Ω (rad/sample, log)');
      for (const tick of [low, (high + low) / 2, high]) { shape(picture, 'text', { x: 62, y: by(tick) + 4, 'text-anchor': 'end' }, format(tick)); shape(picture, 'line', { x1: 70, y1: by(tick), x2: 580, y2: by(tick), class: 'dp03-grid-line' }); }
      for (let i = 0; i <= 4; i++) { const tick = Math.PI * 10 ** (-4 + i); shape(picture, 'text', { x: bx(tick), y: 247, 'text-anchor': 'middle' }, format(tick)); }
      for (const key of ['exact', 'unwarped'] as const) {
        let path = '', previous: number | undefined;
        for (const point of current!.points) {
          const result = point[key], ordinate = result.kind === 'value' ? phase ? result.phase === null ? null : result.phase * 180 / Math.PI : result.db : null;
          if (point.angle === 0 || ordinate === null) { previous = undefined; continue; }
          path += `${previous === undefined || (phase && Math.abs(previous - ordinate) > 180) ? 'M' : 'L'}${bx(point.angle)},${by(ordinate)} `; previous = ordinate;
        }
        shape(picture, 'path', { d: path, class: key === 'exact' ? 'dp03-line' : 'dp03-comparison' });
      }
      if (selected.kind === 'value') { const ordinate = phase ? selected.phase === null ? null : selected.phase * 180 / Math.PI : selected.db; if (ordinate !== null) shape(picture, 'circle', { cx: bx(angle), cy: by(ordinate), r: 5, class: 'dp03-marker' }); }
      return picture;
    };
    plots.replaceChildren(card('Unit-circle cursor', plane, 'The point is z=cos Ω+j sin Ω. Ω=0 is DC; Ω=π is the Nyquist endpoint.'), card('Sampled Nyquist curve', nyquist, `Positive Ω: solid. Negative Ω: dashed conjugate. Out-of-view segments beyond ±${format(halfSpan)} gain units are omitted; adjust the half-span. Singular points are gaps. This is not an encirclement/stability proof.`), card('Magnitude', bode(false), 'Solid: direct discrete evaluation. Dashed: transformed model evaluated without frequency warping. DC and frequencies below the logarithmic span are reported by the cursor, not represented by a log-zero axis.'), card('Principal phase', bode(true), 'Phase is undefined at a zero or pole. Principal-phase wraps are drawn as gaps; ±180° represent the same negative real direction.'));
  }
  const reveal = () => {
    try {
      draft = editor.getValue(); if (draft.empty || draft.hasPlaceholders || draft.syntaxIssues.length) throw new Error('Complete the visual transfer function before revealing.');
      const model = parseModel(draft.latex), time = read(period.input, 'sample period');
      checkedAngle(); current = { model, transformed: bilinear(model, time), points: frequencySamples(model, time), period: time }; render();
    } catch (cause) { fail(cause); }
  };
  const moveCursor = (range: boolean) => { alias = undefined; if (range) omega.input.value = slider.value; else slider.value = omega.input.value; if (current) render(); };
  listen(slider, 'input', () => moveCursor(true)); listen(omega.input, 'input', () => moveCursor(false));
  listen(period.input, 'input', () => { alias = undefined; aliasNote.textContent = ''; invalidate(); });
  listen(span.input, 'input', () => { if (current) render(); });
  for (const prediction of [predictedGain, predictedPhase]) listen(prediction.input, 'input', () => { if (current) render(); });
  root.append(button('Reveal and compare frequency plots', reveal), message, output);
  return () => { current = undefined; editor.destroy(); root.remove(); };
};
