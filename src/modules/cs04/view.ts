import type { ModuleMount } from '../../core/module';
import { createEquationDisplay, createEquationInput, type EquationInput } from '../../shared/equations/input';
import { readNumericInput } from '../../shared/numeric-input';
import { analyze, compose, type Analysis, type Loop } from './criterion';
import { parsePolynomial } from './expression';
import { numeric, polynomialLatex } from './exact';
import type { Point, Kind } from './nyquist';
import { plot, type Series, type XY } from './plot';
import './style.css';
const fmt = (v: number) => v === 0 ? '0' : v.toLocaleString('en-US', { useGrouping: false, maximumSignificantDigits: 7 });
const complex = (z: { re: number; im: number }) => `${fmt(z.re)} ${z.im < 0 ? '−' : '+'} j${fmt(Math.abs(z.im))}`;
const colors: Record<Kind, string> = { 'negative-axis': '#366c87', 'positive-axis': '#624cb0', indent: '#aa6b16', 'outer-arc': '#65826b' };
function el<K extends keyof HTMLElementTagNameMap>(tag: K, text?: string): HTMLElementTagNameMap[K] { const e = document.createElement(tag); if (text !== undefined) e.textContent = text; return e; }
export const mount: ModuleMount = ({ container, signal: parent }) => {
  if (parent.aborted) return;
  const lifetime = new AbortController(), signal = lifetime.signal, forward = () => lifetime.abort(); parent.addEventListener('abort', forward, { once: true });
  const root = el('div'); root.dataset.module = 'CS04'; container.append(root); const editors: EquationInput[] = []; let disposed = false;
  const cleanup = () => { if (disposed) return; disposed = true; lifetime.abort(); parent.removeEventListener('abort', forward); parent.removeEventListener('abort', cleanup); editors.forEach(e => e.destroy()); root.remove(); };
  try {
    let loop: Loop | null = null, analysis: Analysis | null = null, checkedP = false, ready = false;
    const feedback = el('p', 'Build the loop, then count its open-loop RHP poles before revealing the stability result.'); feedback.className = 'cs04-feedback'; feedback.setAttribute('role', 'status');
    const section = (title: string) => { const s = el('section'); s.append(el('h2', title)); root.append(s); return s; };
    const note = (host: HTMLElement, text: string) => host.append(el('p', text));
    const button = (host: HTMLElement, label: string, action: () => void) => { const b = el('button', label); b.type = 'button'; host.append(b); b.addEventListener('click', () => { if (signal.aborted) return; if (host.classList.contains('cs04-actions')) host.after(feedback); else b.after(feedback); try { action(); } catch (e) { feedback.textContent = e instanceof Error ? e.message : 'Check the inputs.'; } }, { signal }); return b; };
    const number = (host: HTMLElement, label: string, value: string, min: string, max: string, step = 'any') => { const l = el('label', label), input = el('input'); input.type = 'number'; input.value = value; input.min = min; input.max = max; input.step = step; l.append(input); host.append(l); return input; };
    const data = section('1. Select the loop at the summing junction');
    data.append(createEquationDisplay(String.raw`e=r-Hy,\quad y=CG\,e,\quad L=CGH,\quad \frac{Y}{R}=\frac{CG}{1+CGH}`, 'Negative-feedback loop and reference transfer'));
    note(data, 'Continuous SISO with normalized variables: L is dimensionless, s uses s⁻¹, and imaginary-axis frequency ω uses rad/s. Controller C and sensor H are scalar gains. No time response or initial state is involved.');
    const inputs = el('div'); inputs.className = 'cs04-grid cs04-equations'; data.append(inputs);
    for (const [label, value] of [['Plant numerator N_G(s)', '1'], ['Plant denominator D_G(s)', '(s+1)(s+2)'], ['Controller gain C', '4'], ['Sensor gain H', '1']]) {
      const editor = createEquationInput({ label, value, signal, onChange: dirty }); editors.push(editor); inputs.append(editor.element);
    }
    const presets = el('div'); presets.className = 'cs04-actions'; data.append(presets);
    for (const [label, n, d, c, h] of [
      ['Baseline loop', '1', '(s+1)(s+2)', '4', '1'], ['Stabilize one RHP pole', '1', 's-1', '2', '1'], ['No encirclement, unstable', '1', 's-1', '0.5', '1'],
      ['Nonunit sensor trap', '1', 's-1', '1.5', '0.5'], ['Two RHP poles', 's+10', '(s-1)(s-2)', '5', '1'], ['Clockwise winding', '1', 's+1', '-2', '1'],
      ['Origin pole', '1', 's', '1', '1'], ['Triple origin pole', '1', 's^3', '1', '1'], ['Axis conjugate poles', '1', '(s^2+1)(s+2)', '4', '1'], ['Boundary at −1', '1', 's-1', '1', '1'],
    ]) button(presets, label, () => { [n, d, c, h].forEach((v, i) => editors[i].setValue(v)); radius.value = '20'; epsilon.value = '.05'; guessP.value = ''; guessN.value = ''; dirty(); });
    const contourInputs = el('div'); contourInputs.className = 'cs04-grid'; data.append(contourInputs);
    const radius = number(contourInputs, 'Contour radius R (s⁻¹)', '20', '.01', '10000'), epsilon = number(contourInputs, 'Axis-indent radius ε (s⁻¹)', '.05', '.00001', '1');
    for (const input of [radius, epsilon]) input.addEventListener('input', dirty, { signal });
    const selected = el('div'); data.append(selected);
    button(data, 'Build the selected loop and contour', build);
    const convention = el('details'), summary = el('summary', 'Supported inputs and contour procedure'); convention.append(summary);
    note(convention, 'G=N_G/D_G must be proper, real and coprime; denominator degree 1–3. Common factors are rejected, including cancellations that could hide unstable modes. Each polynomial accepts numbers, fractions, visible parentheses, sums/products and integer powers. Its cleared-fraction primitive integer coefficients are limited to 10,000 and coefficient magnitude to 1,000,000. Each decimal has at most 15 digits; exact arithmetic is bounded to 60 digits.');
    note(convention, 'C has magnitude 0.05–50 and may be negative; H is positive 0.05–20. The outer summing junction remains e=r−Hy. A zero direct feedback denominator 1+CGH(∞) is rejected. Complete fraction/power boxes; use explicit + for mixed numbers.');
    note(convention, 'Traverse the imaginary axis upward from −jR to +jR. At each exact imaginary-axis pole, detour through a right-half-plane semicircle of radius ε; these poles are excluded from P. Return clockwise along the outer right semicircle. Both frequency directions, all indents and the mapped outer arc belong to this module’s curve.');
    note(convention, 'R: 0.01–10,000; ε: 0.00001–1 and less than R/4. The count requires R beyond a complete polynomial-root bound and indent disks free of closed-loop roots. It is checked again with a changed R and ε. Numerical near-boundary, conditioning and work-limit failures are reported as unresolved. Imaginary-axis closed-loop roots are boundary cases, never strict stability.');
    data.append(convention);
    const visual = section('2. Follow the complete oriented curve');
    note(visual, 'The source contour is clockwise. Image winding N is positive counterclockwise about −1: Z=P−N. No encirclement means stability only when P=0 and there are no closed-loop axis roots.');
    const viewControls = el('div'); viewControls.className = 'cs04-grid'; visual.append(viewControls);
    const zoomLabel = el('label', 'Mapped-curve view'), zoom = el('select'); for (const [v, name] of [['full', 'Whole finite curve, true scale'], ['critical', 'Near −1, clipped true scale']]) { const o = el('option', name); o.value = v; zoom.append(o); } zoomLabel.append(zoom); viewControls.append(zoomLabel);
    const index = number(viewControls, 'Contour sample index', '0', '0', '0', '1'), sliderLabel = el('label', 'Follow the curve (arrow keys)'), slider = el('input'); slider.type = 'range'; slider.min = '0'; slider.max = '0'; slider.step = '1'; slider.value = '0'; slider.setAttribute('aria-label', 'Follow the complete contour'); sliderLabel.append(slider); viewControls.append(sliderLabel);
    const inspector = el('p'), figures = el('div'); figures.className = 'cs04-plots'; visual.append(inspector, figures); let paintedView = zoom.value;
    note(visual, 'Blue dashed: negative-frequency axis; purple: positive-frequency axis; ochre: axis indents; green: outer arc. Arrows follow traversal. × marks open-loop poles on the source plot and −1 on the image plot; the dot follows the selected sample. The near−1 view clips the curve; the count always uses the entire curve.');
    const attempt = section('3. Check P before revealing N and Z');
    const attemptControls = el('div'); attemptControls.className = 'cs04-grid'; attempt.append(attemptControls);
    const guessP = number(attemptControls, 'Your open-loop RHP pole count P', '', '0', '3', '1');
    const pReason = el('div'); attempt.append(pReason);
    const pButton = button(attempt, 'Check my open-loop pole count', () => {
      checkedP = false; answer.replaceChildren(); nButton.disabled = true;
      if (!loop) throw new Error('Build the selected loop first.');
      const value = integer(guessP, 'your pole count P', 0, 3);
      pReason.replaceChildren(el('p', `Open-loop poles (multiplicity retained): ${loop.openRoots.map(complex).join('; ')}. Strict RHP count P=${loop.open.rhp}; axis poles=${loop.open.axis}.`));
      if (value !== loop.open.rhp) { feedback.textContent = `Your P=${value} is incorrect. Count only poles strictly to the right of the imaginary axis, including multiplicity. Correct P before the Nyquist answer is shown.`; return; }
      checkedP = true; nButton.disabled = false; guessN.disabled = !analysis || !('winding' in analysis); feedback.textContent = analysis && 'winding' in analysis ? `P=${value} is correct. Now predict the signed image winding; counterclockwise is positive.` : `P=${value} is correct. Inspect the contour checks before inferring Z; a winding prediction is not required for this case.`;
    });
    const windingControls = el('div'); windingControls.className = 'cs04-grid'; attempt.append(windingControls);
    const guessN = number(windingControls, 'Your counterclockwise winding N', '', '-3', '3', '1');
    const nButton = button(attempt, 'Check winding and reveal closed-loop count', reveal);
    const answer = el('div'); answer.className = 'cs04-answer'; attempt.append(answer);
    root.append(feedback);
    const sources = el('details'), sourcesTitle = el('summary', 'Exercise provenance and numerical checks'); sources.append(sourcesTitle);
    note(sources, 'The starting L=4/((s+1)(s+2)) is the module metadata fixture. Original Ch4/S09/E05 slides are unavailable and uninspected. Other presets are authored variations. The separately inspected Illinois ECE486 Lecture 18 supports the argument principle and the CCW stability convention used here.');
    const sourceLink = el('a', 'Illinois ECE486: Nyquist stability criterion'); sourceLink.href = 'https://courses.physics.illinois.edu/ece486/fa2026/documentation/handbook/lec18.html'; sources.append(sourceLink);
    note(sources, 'Exact rational Routh counts are independent of numerical root positions. Root residual ≤10⁻⁹ and coefficient reconstruction ≤10⁻⁷ are required. Image argument changes are adaptively bounded with polynomial Taylor disks and conservative floating padding; maximum 32,768 visits per contour and depth 30. Two safe contours must agree with each other and with the exact closed-root count. This is a guarded numerical check, not an interval-arithmetic certificate.'); root.append(sources);
    function integer(input: HTMLInputElement, label: string, min: number, max: number) { const value = readNumericInput(input, label); if (!Number.isInteger(value) || value < min || value > max) throw new Error(`Enter ${label} as an integer from ${min} to ${max}.`); return value; }
    function dirty() { if (!ready) return; loop = null; analysis = null; checkedP = false; selected.replaceChildren(); figures.replaceChildren(); inspector.textContent = ''; pReason.replaceChildren(); answer.replaceChildren(); pButton.disabled = true; nButton.disabled = true; index.disabled = slider.disabled = true; guessN.disabled = true; feedback.textContent = 'Inputs changed. Rebuild this loop and check P again.'; }
    function build() {
      dirty(); const polys = editors.map((editor, i) => { const draft = editor.getValue(); if (draft.empty || draft.hasPlaceholders || draft.syntaxIssues.length) throw new Error('Complete all four equation boxes, including every fraction and power.'); const poly = parsePolynomial(draft.latex, i === 0); if (i > 1 && poly.length !== 1) throw new Error('C and H must be scalar gains.'); return poly; });
      const nextLoop = compose(polys[0], polys[1], polys[2][0], polys[3][0]);
      const nextAnalysis = analyze(nextLoop, readNumericInput(radius, 'radius R'), readNumericInput(epsilon, 'indent radius ε'));
      loop = nextLoop; analysis = nextAnalysis; selected.append(createEquationDisplay(`L(s)=\\frac{${polynomialLatex(loop.n)}}{${polynomialLatex(loop.d)}},\\quad Q(s)=D_L+N_L=${polynomialLatex(loop.characteristic)}`, 'Selected physical loop and normalized feedback polynomial'));
      note(selected, `Sensor H=${fmt(numeric(polys[3][0]))} is included in L. The displayed loop numerator N_L and denominator D_L are scaled together so D_L is monic. Q=D_L+N_L is proportional to the original D_G+C H N_G. The reference numerator in the original plant scale is C N_G.`);
      if (analysis.kind === 'unresolved') note(selected, `Contour limit: ${analysis.message}`);
      pButton.disabled = false; index.disabled = slider.disabled = false; index.value = slider.value = '0'; const points = samples(); index.max = slider.max = String(points.length - 1); guessN.disabled = true; paint(); feedback.textContent = 'Loop and oriented curve constructed. Enter P and check it before revealing N, Z and the closed-loop roots.';
    }
    function samples(): readonly Point[] { return analysis ? 'winding' in analysis ? analysis.winding.points : analysis.contour.points : []; }
    function paint() {
      if (!analysis || !loop) return; const points = samples(), selectedIndex = integer(index, 'contour sample index', 0, points.length - 1); slider.value = String(selectedIndex); const point = points[selectedIndex];
      const source: Series[] = [], image: Series[] = []; let previous: Point | null = null;
      for (const p of points) {
        if (!previous || previous.kind !== p.kind) { source.push({ name: p.kind, points: previous ? [{ x: previous.source.re, y: previous.source.im }] : [], color: colors[p.kind], dashed: p.kind === 'negative-axis' }); image.push({ name: p.kind, points: previous?.response.kind === 'value' ? [{ x: previous.response.value.re, y: previous.response.value.im }] : [], color: colors[p.kind], dashed: p.kind === 'negative-axis' }); }
        (source.at(-1)!.points as XY[]).push({ x: p.source.re, y: p.source.im }); if (p.response.kind === 'value') (image.at(-1)!.points as XY[]).push({ x: p.response.value.re, y: p.response.value.im }); previous = p;
      }
      figures.replaceChildren(plot('Clockwise RHP source contour', source, [...loop.openRoots.map(z => ({ x: z.re, y: z.im, label: '', cross: true })), { x: point.source.re, y: point.source.im, label: 's', color: '#192b45' }], ['Re(s) (s⁻¹)', 'Im(s) (s⁻¹)']), plot(zoom.value === 'critical' ? 'L(s) near −1: clipped Cartesian window' : 'L(s): complete finite mapped contour', image, [{ x: -1, y: 0, label: '−1', cross: true }, ...(point.response.kind === 'value' ? [{ x: point.response.value.re, y: point.response.value.im, label: 'L(s)', color: '#192b45' }] : [])], ['Re(L), dimensionless', 'Im(L), dimensionless'], zoom.value === 'critical'));
      inspector.textContent = `Sample ${selectedIndex}/${points.length - 1}, ${point.kind}: s=${complex(point.source)} s⁻¹; ${point.response.kind === 'value' ? `L(s)=${complex(point.response.value)}` : point.response.message}. Indent samples evaluate L(s) off the imaginary axis, rather than L(jω).`;
      paintedView = zoom.value;
    }
    function refreshPlot() {
      try { paint(); }
      catch (error) {
        zoom.value = paintedView;
        inspector.textContent = `${error instanceof Error ? error.message : 'Choose a curve sample.'} The last valid view is kept. Correct the contour sample index to continue.`;
      }
    }
    function reveal() {
      answer.replaceChildren(); if (!loop || !analysis || !checkedP) throw new Error('Check the correct open-loop pole count P first.');
      if ('winding' in analysis) {
        const guess = integer(guessN, 'your signed winding N', -3, 3), n = analysis.winding.n;
        feedback.textContent = guess === n ? 'Your signed winding is correct. The independent feedback-root check agrees.' : `Your N=${guess} differs from the complete curve’s N=${n}. Counterclockwise is positive; include both axis directions, all indents and the outer arc.`;
        answer.append(el('h3', analysis.kind === 'stable' ? 'Strictly stable within the supported model' : 'Unstable closed loop'));
        table(['P: open-loop RHP poles', 'N: CCW image winding', 'Z=P−N: closed-loop RHP roots', 'Closed-loop axis roots'], [String(loop.open.rhp), String(n), `${loop.open.rhp}−(${n})=${analysis.z}`, String(loop.closed.axis)]);
        note(answer, `The resolved net angle change of 1+L is approximately ${fmt(n * 360)}° (integer-turn residual below 10⁻⁷ turns). A second safe contour gives the same N=${analysis.confirmation.n}. The independent exact Routh count is Z=${loop.closed.rhp}.`);
        const phase = analysis.winding.phase.map((v, i) => ({ x: i, y: v * 180 / Math.PI })); answer.append(plot('Accumulated argument along the complete curve', [{ name: 'argument', points: phase, color: '#624cb0' }], [], ['Contour sample index', 'Δ arg(1+L), degrees'], false, false));
      } else {
        answer.append(el('h3', analysis.kind === 'boundary' ? 'Boundary: no strict-stability conclusion' : 'Contour count unresolved')); note(answer, analysis.message);
        table(['P: open-loop RHP poles', 'N: full-criterion winding', 'Z: independent exact RHP root count', 'Closed-loop axis roots'], [String(loop.open.rhp), 'Not reported', String(loop.closed.rhp), String(loop.closed.axis)]);
        feedback.textContent = 'The independent root information is shown below. No P−N answer or strict-stability claim is made for this contour.';
      }
      note(answer, `All feedback-polynomial roots: ${loop.closedRoots.map(complex).join('; ')} s⁻¹.`);
      note(answer, loop.open.rhp ? `With P=${loop.open.rhp}, stability needs exactly ${loop.open.rhp} net counterclockwise turns and no closed-loop axis roots. Zero turns alone cannot establish stability.` : 'With P=0, zero net turns is the strict-stability requirement only after excluding closed-loop axis roots.');
    }
    function table(names: string[], values: string[]) { const region = el('div'); region.className = 'cs04-table'; region.tabIndex = 0; region.setAttribute('role', 'region'); region.setAttribute('aria-label', 'Nyquist counts; scroll horizontally if needed'); const t = el('table'), head = el('tr'), row = el('tr'); names.forEach((name, i) => { const th = el('th', name); th.scope = 'col'; head.append(th); row.append(el('td', values[i])); }); const thead = el('thead'), tbody = el('tbody'); thead.append(head); tbody.append(row); t.append(thead, tbody); region.append(t); answer.append(region); }
    guessP.addEventListener('input', () => { checkedP = false; nButton.disabled = true; guessN.disabled = true; pReason.replaceChildren(); answer.replaceChildren(); }, { signal });
    guessN.addEventListener('input', () => answer.replaceChildren(), { signal });
    index.addEventListener('input', refreshPlot, { signal });
    slider.addEventListener('input', () => { index.value = slider.value; refreshPlot(); }, { signal }); zoom.addEventListener('change', refreshPlot, { signal });
    ready = true; pButton.disabled = nButton.disabled = guessN.disabled = true; index.disabled = slider.disabled = true;
    parent.addEventListener('abort', cleanup, { once: true }); return cleanup;
  } catch (error) { cleanup(); throw error; }
};
