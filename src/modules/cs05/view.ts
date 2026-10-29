import type { ModuleMount } from '../../core/module';
import type { MathfieldElement } from 'mathlive';
import { createEquationInput, createEquationDisplay, type EquationInput } from '../../shared/equations/input';
import { readNumericInput } from '../../shared/numeric-input';
import { decimal, latexR, numeric, polynomialLatex, type Poly } from './exact';
import { parsePolynomial } from './expression';
import { characteristic, cutLatex, cutNumber, gainPolynomialLatex, intervalLatex, isStable, locus, numericRoots, rationalCut, signAt, solveRegions, type Cut, type Region, type Root } from './gains';
import './workspace.css';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, text = '', cls = ''): HTMLElementTagNameMap[K] { const e = document.createElement(tag); e.textContent = text; if (cls) e.className = cls; return e; }
const f = (n: number) => Number(Math.abs(n) < 1e-12 ? 0 : n.toPrecision(8)).toString();
const numberLatex = (n: number): string => { const parts = f(n).split('e'); return parts.length === 1 ? parts[0] : `${parts[0]}\\times10^{${Number(parts[1])}}`; };
const polynomialNumberLatex = (p: readonly number[]) => p.map((v, i) => v ? `${v < 0 ? '-' : '+'}${numberLatex(Math.abs(v))}${i ? `s^{${i}}` : ''}` : '').reverse().join('').replace(/^\+/, '') || '0';

export const mountView: ModuleMount = ({ container, signal }) => {
  const root = el('div', '', 'cs05-tool'), output = el('section', '', 'cs05-output'), message = el('p', 'Predict whether this gain is strictly stable, then reveal.', 'cs05-message'); message.setAttribute('role', 'status'); output.hidden = true;
  const editors: EquationInput[] = []; let region: Region | undefined, boundary: Cut | undefined;
  let samples: ReturnType<typeof locus> = [], selectedRoots: Root[] = [], selectedGain: Cut | undefined;
  const exactCard = el('div', '', 'cs05-card'), selectionCard = el('div', '', 'cs05-card'), boundaryCard = el('div', '', 'cs05-card'), plotCard = el('div', '', 'cs05-card');
  const invalidate = () => { region = undefined; if (boundary) gain.setValue('20'); boundary = undefined; selectedGain = undefined; selectedRoots = []; output.hidden = true; message.textContent = 'Model or plot range changed. Reveal to derive the complete gain set.'; };
  function button(name: string, action: () => void) { const b = el('button', name); b.type = 'button'; b.addEventListener('click', action, { signal }); return b; }
  function editor(label: string, value: string, changed = invalidate) {
    const input = createEquationInput({ label, value, signal, onChange: changed }); editors.push(input); const field = input.element.querySelector<MathfieldElement>('math-field'); if (field) field.smartSuperscript = false;
    input.element.addEventListener('keydown', event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); window.mathVirtualKeyboard.hide(); } }, { capture: true, signal }); return input;
  }
  function parse(input: EquationInput, label: string, allowZero = false): Poly { const d = input.getValue(); if (d.empty || d.hasPlaceholders || d.syntaxIssues.length) throw new Error(`Complete ${label} in the visual editor.`); return parsePolynomial(d.latex, allowZero); }
  function numericControl(label: string, value: string) { const wrap = el('label', '', 'cs05-field'), input = el('input'); input.type = 'number'; input.step = 'any'; input.value = value; input.setAttribute('aria-label', label); wrap.append(el('span', label), input); return { wrap, input }; }
  function choice(label: string, values: readonly string[]) { const wrap = el('label', '', 'cs05-field'), input = el('select'); input.setAttribute('aria-label', label); values.forEach(value => { const option = el('option', value); option.value = value; input.append(option); }); wrap.append(el('span', label), input); return { wrap, input }; }
  root.append(el('h2', 'Find the gains that keep every pole left of the imaginary axis'), el('p', 'Negative unity feedback: L(s)=K N(s)/D(s), K≥0. The characteristic polynomial is D(s)+K N(s). Enter the fixed polynomials; only the scalar K varies. Original denominator modes are retained without cancellation.'));
  const inputs = el('div', '', 'cs05-grid'), numerator = editor('Fixed numerator N(s)', '1'), denominator = editor('Fixed denominator D(s)', 's(s+2)(s+5)'); inputs.append(numerator.element, denominator.element); root.append(inputs);
  const gain = editor('Selected gain K', '20', () => { boundary = undefined; if (region) renderSelection(); else message.textContent = 'Gain draft changed. Reveal after completing it.'; }); root.append(gain.element);
  const controls = el('div', '', 'cs05-grid'), maximum = numericControl('Locus maximum gain', '100'), sliderLabel = el('label', 'Gain cursor (arrow keys or equation entry)', 'cs05-field'), slider = el('input'); slider.type = 'range'; slider.min = '0'; slider.max = '100'; slider.step = '.1'; slider.value = '20'; slider.setAttribute('aria-label', 'Gain cursor'); sliderLabel.append(slider); controls.append(maximum.wrap, sliderLabel); root.append(controls);
  maximum.input.addEventListener('input', invalidate, { signal });
  slider.addEventListener('input', () => { boundary = undefined; gain.setValue(latexR(decimal(Number(slider.value).toPrecision(8), true))); if (region) renderSelection(); }, { signal });
  const attempts = el('fieldset', '', 'cs05-card'); attempts.append(el('legend', 'Predict before revealing (optional)'));
  const prediction = choice('Your selected-gain prediction', ['No prediction', 'Strictly stable', 'Not strictly stable']), count = numericControl('Your number of stable intervals', ''), tail = choice('Your unbounded stable-tail prediction', ['No prediction', 'Yes', 'No']); attempts.append(prediction.wrap, count.wrap, tail.wrap); root.append(attempts);
  const assumptions = el('details', '', 'cs05-card'); assumptions.append(el('summary', 'Conventions, exact domain and numerical limits'), el('p', 'Strictly proper real rational N/D with denominator degree1–3 and lower-degree numerator. Polynomials accept decimals, visual fractions, products and nonnegative powers of s; division inside a field is by a number only. Decimals are exact as entered. Both polynomials are divided by D’s leading coefficient. s uses the entered inverse-time units; K is a nonnegative scalar gain. This stability calculation has no time history or sampling model.'), el('p', 'Complete gain regions follow exact Routh/Hurwitz inequalities, not the plotted samples. All endpoints except an allowed K=0 are open. Manual K is0–10,000; computed boundary buttons retain exact rational/square-root values through10¹². The finite locus range is positive and≤10,000, using241 samples; nearby branch matching minimizes full-list displacement and is a numerical continuation choice near coincident roots.'), el('p', 'Input polynomial degree≤4 is parsed before the model’s stricter degree checks. Bounds:600 characters,240 symbols,24 nested groups,15 digits per decimal; primitive integer coefficient height≤10,000, normalized magnitudes≤1,000,000;60-digit exact rational arithmetic and64 bisections for an interior interval test. Bounds/nonseparated endpoints produce feedback. Numerical roots require residual≤10⁻⁹ and complete monic-coefficient reconstruction within10⁻⁷ relative/absolute tolerance. Ill-conditioned roots are omitted with feedback while exact intervals remain. No gain sweep or one selected branch certifies stability.')); root.append(assumptions);
  const presets = el('div', '', 'cs05-actions');
  for (const [name, n, d] of [['Course cubic', '1', 's(s+2)(s+5)'], ['Changed cubic', '1', 's^3+6s^2+8s'], ['Two stable ranges', 's^2+s+6', 's^3+s^2+s-2'], ['Irrational boundaries', 's^2+s+6', 's^3+s^2+s-1'], ['Stable from zero', '-s', 's^2+2s+1']]) presets.append(button(name, () => { numerator.setValue(n); denominator.setValue(d); invalidate(); })); root.append(presets);
  function getGain(): Cut {
    if (boundary) return boundary;
    const p = parse(gain, 'gain K', true); if (p.length !== 1 || p[0].n < 0n || numeric(p[0]) > 10000) throw new Error('Enter K as a rational number from0 to10,000, or use an exact boundary button.'); return rationalCut(p[0]);
  }
  function plotMaximum(): number { const value = readNumericInput(maximum.input, 'locus maximum gain'); if (value < .001 || value > 10000) throw new Error('Locus maximum gain must be from0.001 to10,000.'); return value; }
  function renderSelection() {
    if (!region || signal.aborted) return; selectionCard.replaceChildren(el('h3', 'Check every root at the selected gain')); selectedRoots = []; selectedGain = undefined;
    try {
      const k = getGain(), polynomial = characteristic(region.model, k), stable = isStable(region, k); selectedGain = k; slider.value = String(Math.min(cutNumber(k), Number(slider.max)));
      selectionCard.append(createEquationDisplay(`K=${cutLatex(k)},\\quad P_K(s)\\approx${polynomialNumberLatex(polynomial)}`, 'Selected gain and complete characteristic polynomial'), el('p', stable ? 'Strictly stable: every exact gain inequality is positive.' : 'Not strictly stable: at least one exact gain inequality is zero or negative.'));
      selectionCard.append(el('p', boundary ? 'This selection retains the exact algebraic endpoint. Numerical root rounding does not decide its classification.' : 'This manual/range gain is an exact rational value.'));
      for (const condition of region.conditions) selectionCard.append(el('p', `${condition.name}: ${['negative', 'zero', 'positive'][signAt(condition.polynomial, k) + 1]}.`));
      const feedback: string[] = [];
      if (prediction.input.value !== 'No prediction') feedback.push((prediction.input.value === 'Strictly stable') === stable ? 'Gain prediction matches.' : 'Gain prediction differs. Inspect all inequalities and roots.');
      if (count.input.value.trim()) { const guess = readNumericInput(count.input, 'interval count prediction'); if (!Number.isInteger(guess) || guess < 0 || guess > 6) throw new Error('Predict an integer interval count from0 to6.'); feedback.push(guess === region.intervals.length ? 'Interval count matches.' : `There are ${region.intervals.length} stable intervals.`); }
      if (tail.input.value !== 'No prediction') feedback.push((tail.input.value === 'Yes') === region.intervals.some(i => !i.upper) ? 'Tail prediction matches.' : 'Tail prediction differs.');
      selectionCard.append(el('p', feedback.join(' ')));
      const zeros = region.conditions.filter(c => signAt(c.polynomial, k) === 0).map(c => c.name);
      if (zeros.length) selectionCard.append(el('p', `Zero conditions: ${zeros.join('; ')}. This gain is excluded from strict stability.`));
      if (region.model.d.length === 4) {
        selectionCard.append(createEquationDisplay('s=j\\omega:\\quad a_0-a_2\\omega^2=0,\\quad\\omega(a_1-\\omega^2)=0', 'Imaginary-axis boundary equations'));
        if (signAt(region.conditions.at(-1)!.polynomial, k) === 0 && polynomial[2] > 0 && polynomial[1] > 0) selectionCard.append(el('p', `At this determinant boundary: ω≈sqrt(a₁)=${f(Math.sqrt(polynomial[1]))} in the units of s, with the remaining pole≈−a₂=${f(-polynomial[2])}.`));
        if (!polynomial[2]) selectionCard.append(el('p', 'The Routh quotient is undefined when a₂=0. The strict coefficient inequalities already exclude this gain; no small positive number is substituted.'));
      }
      if (cutNumber(k) > plotMaximum()) selectionCard.append(el('p', 'Selected gain is beyond the finite curve range. Its full roots are evaluated separately.'));
      try {
        selectedRoots = numericRoots(polynomial); const table = el('table'), header = el('tr'), body = el('tbody'); ['All approximate roots', 'Normalized residual'].forEach(t => header.append(el('th', t))); const head = el('thead'); head.append(header);
        selectedRoots.forEach(z => { const row = el('tr'); row.append(el('td', `${f(z.re)}${Number(f(z.im)) < 0 ? ' − ' : ' + '}${f(Math.abs(z.im))}j`), el('td', z.residual.toExponential(2))); body.append(row); }); table.append(head, body); selectionCard.append(table, el('p', 'All roots are listed, including coincident entries. Coordinates are numerical approximations; the strict-stability verdict uses exact gain inequalities.'));
      } catch (error) { selectionCard.append(el('p', (error as Error).message)); }
      message.textContent = 'Complete gain set derived. The finite locus illustrates those algebraic results.';
    } catch (error) { selectionCard.replaceChildren(el('h3', 'Selected gain needs attention'), el('p', (error as Error).message)); }
    renderPlots();
  }
  function renderPlots() {
    if (!region) return; plotCard.replaceChildren(el('h3', 'Gain strip and sampled root-locus branches'));
    const max = plotMaximum(); plotCard.append(gainStrip(region, max, selectedGain), rootPlane(samples, selectedRoots));
    plotCard.append(el('p', `Curve range0≤K≤${f(max)} with241 samples. Exact stable intervals extend beyond this picture where stated. Branches use all-root minimum-displacement matching; branch names near coincident roots are numerical choices. Dashed patterns distinguish the sampled branches; × marks every selected root.`));
    const failures = samples.filter(s => s.error).length; if (failures) plotCard.append(el('p', `${failures} curve samples failed numerical verification and are shown as gaps. Exact gain intervals are retained.`));
  }
  root.append(button('Derive intervals and reveal', () => {
    try {
      const candidate = solveRegions(parse(numerator, 'N(s)', true), parse(denominator, 'D(s)')), max = plotMaximum(); region = candidate;
      samples = locus(candidate.model, max); slider.max = String(max); slider.step = String(max / 1000);
      exactCard.replaceChildren(el('h3', 'Complete exact gain set'));
      exactCard.append(createEquationDisplay(`P_K(s)=\\left(${polynomialLatex(candidate.model.d)}\\right)+K\\left(${polynomialLatex(candidate.model.n)}\\right)`, 'Normalized complete characteristic polynomial'));
      for (const condition of candidate.conditions) exactCard.append(createEquationDisplay(`${gainPolynomialLatex(condition.polynomial)}>0`, condition.name));
      exactCard.append(createEquationDisplay(`K\\in${candidate.intervals.length ? candidate.intervals.map(intervalLatex).join('\\cup') : '\\varnothing'}`, 'Exact strictly stable gain set'), el('p', 'These are all admissible nonnegative gains under the declared degree bounds. Endpoints come from exact equality conditions; each open cell has an exact interior sign test.'));
      candidate.intervals.forEach((interval, i) => exactCard.append(createEquationDisplay(`K_{\\mathrm{test},${i + 1}}=${latexR(interval.test)}`, 'Exact interior sign-check gain')));
      const degree = candidate.model.d.length - 1;
      exactCard.append(createEquationDisplay(degree === 3 ? '\\text{Routh first column: }1,\\ a_2,\\ \\frac{a_2a_1-a_0}{a_2},\\ a_0' : degree === 2 ? '\\text{Routh first column: }1,\\ a_1,\\ a_0' : '\\text{First-order condition: }a_0>0', 'Routh derivation'));
      boundaryCard.replaceChildren(el('h3', 'Inspect exact gain endpoints'));
      candidate.cuts.forEach((endpoint, i) => { const row = el('div', '', 'cs05-boundary'); row.append(createEquationDisplay(`K=${cutLatex(endpoint)}`, 'Exact gain endpoint'), button(`Inspect endpoint ${i + 1}`, () => { boundary = endpoint; gain.setValue(cutLatex(endpoint)); renderSelection(); })); boundaryCard.append(row); });
      output.hidden = false; renderSelection();
    } catch (error) { invalidate(); message.textContent = (error as Error).message; }
  }), message); output.append(exactCard, boundaryCard, selectionCard, plotCard); root.append(output); container.append(root);
  return () => { editors.forEach(input => input.destroy()); root.remove(); };
};

function picture(label: string, width: number, height: number) {
  const ns = 'http://www.w3.org/2000/svg', svg = document.createElementNS(ns, 'svg'), region = el('div', '', 'cs05-scroll'); region.tabIndex = 0; region.setAttribute('role', 'region'); region.setAttribute('aria-label', `${label}. Use arrow keys to scroll.`); svg.setAttribute('viewBox', `0 0 ${width} ${height}`); svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', label);
  const shape = (tag: string, attrs: Record<string, string | number>, text = '') => { const e = document.createElementNS(ns, tag); for (const [key, value] of Object.entries(attrs)) e.setAttribute(key, String(value)); e.textContent = text; svg.append(e); };
  region.append(svg); return { region, shape };
}
function gainStrip(region: Region, maximum: number, selected?: Cut): HTMLElement {
  const p = picture('Stable gain strip over the finite plotted range', 440, 110), x = (k: number) => 35 + 360 * k / maximum;
  p.shape('line', { x1: 35, x2: 395, y1: 50, y2: 50, class: 'cs05-axis' });
  for (const interval of region.intervals) { const low = cutNumber(interval.lower), high = Math.min(maximum, interval.upper ? cutNumber(interval.upper) : maximum); if (low >= maximum || high < 0) continue; p.shape('rect', { x: x(Math.max(0, low)), y: 40, width: Math.max(0, x(high) - x(Math.max(0, low))), height: 20, class: 'cs05-stable' }); }
  for (const c of region.cuts) { const k = cutNumber(c); if (k > maximum) continue; p.shape('circle', { cx: x(k), cy: 50, r: 4, class: isStable(region, c) ? 'cs05-included' : 'cs05-excluded' }); }
  if (selected && cutNumber(selected) <= maximum) p.shape('line', { x1: x(cutNumber(selected)), x2: x(cutNumber(selected)), y1: 20, y2: 75, class: 'cs05-selected' });
  p.shape('text', { x: 30, y: 94 }, '0'); p.shape('text', { x: 350, y: 94 }, `K=${f(maximum)}`); p.shape('text', { x: 40, y: 16 }, 'Shaded: strict stability; open circles: excluded endpoints'); return p.region;
}
function rootPlane(samples: ReturnType<typeof locus>, selected: readonly Root[]): HTMLElement {
  const p = picture('Sampled root locus and every selected closed-loop root', 440, 330), all = [...samples.flatMap(s => s.roots ?? []), ...selected], limit = 1.2 * Math.max(1, ...all.flatMap(z => [Math.abs(z.re), Math.abs(z.im)]));
  const x = (v: number) => 220 + 130 * v / limit, y = (v: number) => 160 - 130 * v / limit;
  p.shape('line', { x1: 60, y1: 160, x2: 380, y2: 160, class: 'cs05-axis' }); p.shape('line', { x1: 220, y1: 20, x2: 220, y2: 300, class: 'cs05-axis' });
  for (let branch = 0; branch < 3; branch++) {
    let path = '', gap = true; for (const sample of samples) { const z = sample.roots?.[branch]; if (!z) { gap = true; continue; } path += `${gap ? 'M' : 'L'}${x(z.re)},${y(z.im)}`; gap = false; }
    p.shape('path', { d: path, class: 'cs05-branch', 'stroke-dasharray': ['', '6 3', '2 3'][branch] });
  }
  for (const z of selected) { const px = x(z.re), py = y(z.im); p.shape('path', { d: `M${px - 5},${py - 5}L${px + 5},${py + 5}M${px - 5},${py + 5}L${px + 5},${py - 5}`, class: 'cs05-selected' }); }
  for (const s of [-1, 0, 1]) { p.shape('text', { x: x(s * limit), y: 180 }, f(s * limit)); if (s) p.shape('text', { x: 228, y: y(s * limit) }, f(s * limit)); }
  p.shape('text', { x: 280, y: 325 }, 'Re s (entered units)'); p.shape('text', { x: 10, y: 15 }, 'Im s (entered units)'); return p.region;
}
