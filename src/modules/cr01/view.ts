import type { ModuleMount } from '../../core/module';
import type { MathfieldElement } from 'mathlive';
import { createEquationInput, createEquationDisplay, type EquationInput, type EquationDraft } from '../../shared/equations/input';
import { readNumericInput } from '../../shared/numeric-input';
import { coefficientContributions, compareRational, discriminant, expandedFactors, factorPolynomial, fromPoles, roots, type Root } from './algebra';
import { decimal, equal, latexR, multiply, polynomialLatex, same, textR, validatePolynomial, zero, type Poly, type Rational } from './exact';
import { parsePolynomial } from './expression';
import './workspace.css';

const baseline = 's^{4}+7s^{3}+27s^{2}+47s+26';
function el<K extends keyof HTMLElementTagNameMap>(tag: K, text = '', className = ''): HTMLElementTagNameMap[K] { const n = document.createElement(tag); n.textContent = text; if (className) n.className = className; return n; }
const format = (n: number) => Number(Math.abs(n) < 1e-14 ? 0 : n.toPrecision(8)).toString();
const rootText = (z: Root) => `${format(z.re)}${Number(format(z.im)) < 0 ? ' − ' : ' + '}${format(Math.abs(z.im))}j`;

export const mountView: ModuleMount = ({ container, signal }) => {
  const root = el('div', '', 'cr01-tool'), editors: EquationInput[] = [];
  const message = el('p', 'Choose a coefficient to predict, then reveal the checked polynomial.', 'cr01-message'); message.setAttribute('role', 'status');
  const output = el('section', '', 'cr01-output'); output.hidden = true;
  let current: { polynomial: Poly; factors: ReturnType<typeof factorPolynomial> } | undefined;
  const invalidate = () => { current = undefined; output.hidden = true; message.textContent = 'Inputs changed. Reveal again to check this polynomial.'; };
  function button(text: string, action: () => void) { const b = el('button', text); b.type = 'button'; b.addEventListener('click', action, { signal }); return b; }
  function fail(error: unknown) { current = undefined; output.hidden = true; message.textContent = error instanceof Error ? error.message : 'Check the mathematical inputs.'; }
  function editor(label: string, value: string, changed: () => void = invalidate) {
    const input = createEquationInput({ label, value, signal, onChange: changed }); editors.push(input);
    const field = input.element.querySelector<MathfieldElement>('math-field'); if (field) field.smartSuperscript = false;
    input.element.addEventListener('keydown', event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); window.mathVirtualKeyboard.hide(); } }, { capture: true, signal });
    return input;
  }
  function parsed(input: EquationInput, label: string, allowZero = false): Poly {
    const draft: EquationDraft = input.getValue();
    if (draft.empty || draft.hasPlaceholders || draft.syntaxIssues.length) throw new Error(`Complete ${label} in the visual editor.`);
    return parsePolynomial(draft.latex, allowZero);
  }
  function scalar(input: EquationInput, label: string): Rational { const p = parsed(input, label, true); if (p.length > 1) throw new Error(`${label} must be a number, not a polynomial.`); return p[0]; }
  function numericControl(label: string, value: string) { const wrap = el('label', '', 'cr01-field'), input = el('input'); input.type = 'number'; input.step = 'any'; input.value = value; input.setAttribute('aria-label', label); wrap.append(el('span', label), input); return { wrap, input }; }
  function select(label: string, count: number, selected = 0) { const wrap = el('label', '', 'cr01-field'), input = el('select'); for (let i = 0; i < count; i++) { const o = el('option', String(i)); o.value = String(i); input.append(o); } input.value = String(selected); input.setAttribute('aria-label', label); wrap.append(el('span', label), input); return { wrap, input }; }
  function section(title: string) { const details = el('details', '', 'cr01-card'); details.append(el('summary', title)); return details; }
  root.append(el('h2', 'From products to coefficients and roots'), el('p', 'Edit an expanded polynomial or a product of factors. Exact rational algebra and approximate root coordinates are shown separately. The default quartic is a proposed teaching fixture.'));
  const model = editor('Polynomial P(s)', baseline); root.append(model.element);
  const conventions = section('Conventions and supported inputs'); conventions.append(el('p', 'Polynomials in s with real rational coefficients, degree 0–4. Enter decimals, visual fractions, sums, products, visible parentheses and integer powers. Division inside a polynomial field is by numbers only. Use + for a mixed number and × for numeric multiplication; use the power button for signed or multi-digit exponents.'), el('p', 'Factoring is exact over Q[s], the rational numbers. Decimals are exact as entered. After clearing denominators and common scale, integer coefficient magnitudes must be ≤10,000; coefficient magnitudes ≤1,000,000. Limits: 600 characters, 240 symbols, 24 nested groups, 15 digits per decimal, 30-digit exact arithmetic and intermediate degree 16. Factoring allows 100,000 candidate checks and intermediate integer height 1,000,000. Unsupported work gets feedback.'), el('p', 'Numerical roots use analytic formulas through degree2 or at most three starts of 600 iterations for degrees3–4, with normalized residual≤10⁻¹⁰ and a complete monic-coefficient reconstruction check at relative/absolute tolerance10⁻⁸. Multiplicity comes from exact rational factors, never rounded-root clustering. Root coordinates use the units assigned to s; coefficient units must be consistent. This algebra exercise has no sample period, feedback sign or initial-condition model. No stability or rounded cancellation is inferred.')); root.append(conventions);
  const prediction = el('fieldset', '', 'cr01-card'); prediction.append(el('legend', 'Predict a coefficient (optional)'));
  const power = select('Coefficient power k in sᵏ', 5, 2), guess = editor('Your coefficient prediction', ''); prediction.append(power.wrap, guess.element); root.append(prediction);
  power.input.addEventListener('change', () => { if (current) renderContributions(); }, { signal });
  const actions = el('div', '', 'cr01-actions');
  for (const [label, value] of [['Proposed quartic', baseline], ['Change constant to 27', 's^4+7s^3+27s^2+47s+27'], ['Repeated conjugate roots', '(s^2+1)^2'], ['Irrational real roots', 's^2-2']]) actions.append(button(label, () => { model.setValue(value); invalidate(); }));
  root.append(actions);

  const coefficients = section('Edit coefficients (ascending a₀ through a₄)'), coefficientGrid = el('div', '', 'cr01-coefficients');
  const cells = [26, 47, 27, 7, 1].map((c, i) => { const input = editor(`Coefficient a${i} for s^${i}`, String(c)); coefficientGrid.append(input.element); return input; });
  coefficients.append(el('p', 'Zero leading entries lower the degree. Copy the current expression to keep its exact fractions, or apply these five coefficient drafts to P(s).'), coefficientGrid,
    button('Copy exact coefficients from P(s)', () => { try { const p = parsed(model, 'P(s)'); cells.forEach((input, i) => input.setValue(latexR(p[i] ?? zero))); message.textContent = 'Exact coefficient drafts copied. Apply after editing.'; } catch (e) { fail(e); } }),
    button('Apply coefficient drafts', () => { try { const p = validatePolynomial(cells.map((input, i) => scalar(input, `coefficient a${i}`))); model.setValue(polynomialLatex(p)); invalidate(); } catch (e) { fail(e); } })); root.append(coefficients);

  const poles = section('Build from real roots and conjugate pairs'), poleGrid = el('div', '', 'cr01-poles'), poleNote = el('p');
  poles.append(el('p', 'Each included row supplies one real root (imaginary part 0) or a conjugate pair (positive imaginary part). Multiplicity applies to each root. Applying defines a polynomial exactly for the entered decimals; rounded numerical roots do not certify the previous polynomial.'), poleGrid);
  const poleRows = [[-1, 0], [-2, 0], [-2, 3], [0, 0]].map(([re, im], i) => {
    const row = el('fieldset'); row.append(el('legend', `Root row ${i + 1}`));
    const enabled = el('input'); enabled.type = 'checkbox'; enabled.checked = i < 3; const include = el('label', 'Include row'); enabled.setAttribute('aria-label', `Include root row ${i + 1}`); include.prepend(enabled);
    const real = numericControl(`Row ${i + 1} real part`, String(re)), imaginary = numericControl(`Row ${i + 1} imaginary magnitude`, String(im)), multiplicity = select(`Row ${i + 1} multiplicity`, 5, 1); multiplicity.input.options[0].disabled = true;
    row.append(include, real.wrap, imaginary.wrap, multiplicity.wrap); poleGrid.append(row); return { enabled, real: real.input, im: imaginary.input, multiplicity: multiplicity.input };
  });
  const scale = numericControl('Leading scale for root construction', '1'); poles.append(scale.wrap);
  function nativeR(input: HTMLInputElement, label: string): Rational { const value = readNumericInput(input, label); if (Math.abs(value) > 100) throw new Error(`${label} must have magnitude at most 100.`); return decimal(input.value, true); }
  poles.append(button('Apply root drafts', () => {
    try {
      const entered = poleRows.filter(r => r.enabled.checked).map(r => ({ re: nativeR(r.real, 'root real part'), im: nativeR(r.im, 'root imaginary magnitude'), multiplicity: Number(r.multiplicity.value) }));
      const p = fromPoles(entered, nativeR(scale.input, 'leading scale')); let previous: Poly | undefined; try { previous = parsed(model, 'P(s)'); } catch { /* The new draft can replace an invalid expression. */ }
      model.setValue(polynomialLatex(p)); invalidate();
      poleNote.textContent = previous && same(previous, p) ? 'Exact re-expansion matches the previous polynomial.' : 'The entered root decimals define a changed polynomial. This is not an exact reconstruction of the previous expression.';
    } catch (e) { fail(e); }
  }), poleNote); root.append(poles);

  const exactCard = el('div', '', 'cr01-card'), contributionCard = el('div', '', 'cr01-card'), rootCard = el('div', '', 'cr01-card'); output.append(exactCard, contributionCard, rootCard);
  function renderContributions() {
    if (!current) return; const k = Number(power.input.value), factors = expandedFactors(current.factors), rows = coefficientContributions(factors, k);
    contributionCard.replaceChildren(el('h3', `Which products contribute to s^${k}?`));
    contributionCard.append(el('p', 'Choose one term from each factor. Only products whose powers add to k contribute. The first factor is the leading scale.'));
    for (const row of rows) {
      const term = row.choices.map((j, i) => `\\left(${latexR(factors[i][j])}${j ? `s^{${j}}` : ''}\\right)`).join('');
      contributionCard.append(createEquationDisplay(`${term}=${latexR(row.value)}s^{${k}}`, 'Contributing product'));
    }
    if (!rows.length) contributionCard.append(el('p', 'No nonzero products contribute to this power.'));
    contributionCard.append(createEquationDisplay(`a_{${k}}=${latexR(current.polynomial[k] ?? zero)}`, 'Recovered coefficient'));
    const draft = guess.getValue();
    if (!draft.empty) {
      try { contributionCard.append(el('p', equal(scalar(guess, 'coefficient prediction'), current.polynomial[k] ?? zero) ? 'Coefficient prediction matches exactly.' : `Prediction differs. The exact coefficient is ${textR(current.polynomial[k] ?? zero)}.`)); }
      catch (e) { contributionCard.append(el('p', (e as Error).message)); }
    }
  }
  function renderRoots() {
    if (!current) return; rootCard.replaceChildren(el('h3', 'Numerical roots and exact multiplicity'));
    const quadratics = current.polynomial.length === 3 ? [current.polynomial] : current.factors.factors.filter(f => f.polynomial.length === 3).map(f => f.polynomial);
    for (const q of quadratics) {
      const delta = discriminant(q); rootCard.append(createEquationDisplay(`Q(s)=${polynomialLatex(q)},\\quad\\Delta=b^2-4ac=${latexR(delta)}`, 'Quadratic discriminant'), el('p', delta.n < 0n ? 'Negative discriminant: a complex conjugate pair.' : delta.n > 0n ? 'Positive discriminant: two distinct real roots (possibly irrational).' : 'Zero discriminant: one repeated real root.'));
    }
    try {
      const list = roots(current.polynomial, current.factors);
      if (!list.length) { rootCard.append(el('p', 'A nonzero constant polynomial has no roots.')); return; }
      const table = el('table'), head = el('thead'), header = el('tr'); for (const title of ['Approximate root', 'Multiplicity', 'Normalized residual']) header.append(el('th', title)); head.append(header); const body = el('tbody');
      for (const z of list) { const row = el('tr'); row.append(el('td', rootText(z)), el('td', String(z.multiplicity)), el('td', z.residual.toExponential(2))); body.append(row); } table.append(head, body); rootCard.append(table, rootPlot(list));
      rootCard.append(el('p', 'Approximate coordinates are rounded to 8 significant digits. Multiplicity is exact over Q[s]; a small residual alone does not prove a root error bound. Plot symbols are ×; labels report multiplicity.'));
    } catch (e) { rootCard.append(el('p', (e as Error).message)); }
  }
  root.append(button('Expand, factor and reveal', () => {
    try {
      const p = parsed(model, 'P(s)'), f = factorPolynomial(p); current = { polynomial: p, factors: f };
      exactCard.replaceChildren(el('h3', 'Exact rational factorization and re-expansion'));
      exactCard.append(createEquationDisplay(`P(s)=${polynomialLatex(p)}`, 'Expanded polynomial'));
      const product = `${latexR(f.scale)}${f.factors.map(x => `\\left(${polynomialLatex(x.polynomial)}\\right)${x.multiplicity > 1 ? `^{${x.multiplicity}}` : ''}`).join('')}`;
      exactCard.append(createEquationDisplay(`P(s)=${product}`, 'Exact factors over the rationals'), el('p', 'Exact factors over Q[s]. Every remaining factor is irreducible over the rationals within the completed exhaustive degree-four search. Re-expansion was checked coefficient by coefficient with exact fractions. This does not say every factor is linear over the reals.'));
      let stage: Poly = [f.scale];
      expandedFactors(f).slice(1).forEach((factor, i) => { const next = multiply(stage, factor); exactCard.append(createEquationDisplay(`\\left(${polynomialLatex(stage)}\\right)\\left(${polynomialLatex(factor)}\\right)=${polynomialLatex(next)}`, `Expansion stage ${i + 1}`)); stage = next; });
      const table = el('table'), row = el('tr'), values = el('tr'); p.forEach((c, i) => { row.append(el('th', `a${i} (s^${i})`)); values.append(el('td', textR(c))); }); const head = el('thead'); head.append(row); const body = el('tbody'); body.append(values); table.append(head, body); exactCard.append(table);
      renderContributions(); renderRoots(); output.hidden = false; message.textContent = 'Exact expansion checked. Inspect the coefficient products and independently residual-checked numerical roots.';
    } catch (e) { fail(e); }
  }), message, output);

  const comparison = section('Compare two rational expressions without silent cancellation'), comparisonResult = el('div', '', 'cr01-comparison'); comparisonResult.hidden = true;
  comparison.append(el('p', 'Equality on a common domain uses N₁D₂−N₂D₁=0 exactly. Each original denominator still excludes its own roots, even if a factor could cancel. No near pole/zero pair is canceled.'));
  const compInputs = [['Numerator A', 's^2-1'], ['Denominator A', 's-1'], ['Numerator B', 's+1'], ['Denominator B', '1']].map(([label, value]) => { const input = editor(label, value, () => { comparisonResult.hidden = true; }); comparison.append(input.element); return input; });
  comparison.append(button('Compare rational expressions', () => {
    try {
      const [n1, d1, n2, d2] = compInputs.map((input, i) => parsed(input, ['numerator A', 'denominator A', 'numerator B', 'denominator B'][i], i % 2 === 0));
      const result = compareRational(n1, d1, n2, d2);
      comparisonResult.replaceChildren(createEquationDisplay(`\\frac{${polynomialLatex(n1)}}{${polynomialLatex(d1)}}\\quad\\text{and}\\quad\\frac{${polynomialLatex(n2)}}{${polynomialLatex(d2)}}`, 'Original rational expressions'), createEquationDisplay(`N_1D_2-N_2D_1=${polynomialLatex(result.difference)}`, 'Exact cross-product difference'), el('p', result.equalOnCommonDomain ? 'Equal on their common domain.' : 'Different rational expressions: the exact cross-product difference is nonzero.'), el('p', result.sameDomain ? 'The original denominator domains agree (over complex s).' : 'The original denominator domains differ (over complex s). A canceled point remains excluded from its original expression.'), el('p', `A excludes: ${result.exclusions1.map(rootText).join('; ') || 'no finite roots'}. B excludes: ${result.exclusions2.map(rootText).join('; ') || 'no finite roots'}. Coordinates here are approximate; the domain comparison used exact rational factors.`));
      comparisonResult.hidden = false;
    } catch (e) { comparisonResult.replaceChildren(el('p', (e as Error).message)); comparisonResult.hidden = false; }
  }), comparisonResult); root.append(comparison); container.append(root);
  return () => { editors.forEach(input => input.destroy()); root.remove(); };
};

function rootPlot(roots: readonly Root[]): HTMLElement {
  const region = el('div', '', 'cr01-scroll'); region.tabIndex = 0; region.setAttribute('role', 'region'); region.setAttribute('aria-label', 'Root plane. Use arrow keys to scroll on narrow screens.');
  const ns = 'http://www.w3.org/2000/svg', svg = document.createElementNS(ns, 'svg'); svg.setAttribute('viewBox', '0 0 420 310'); svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', 'Computed polynomial roots; cross symbols with multiplicity labels.');
  const limit = 1.3 * Math.max(1, ...roots.flatMap(z => [Math.abs(z.re), Math.abs(z.im)])), x = (v: number) => 210 + 120 * v / limit, y = (v: number) => 150 - 120 * v / limit;
  function shape(tag: string, attrs: Record<string, number | string>, text = '') { const n = document.createElementNS(ns, tag); for (const [key, value] of Object.entries(attrs)) n.setAttribute(key, String(value)); n.textContent = text; svg.append(n); }
  shape('line', { x1: 65, y1: 150, x2: 355, y2: 150, class: 'cr01-axis' }); shape('line', { x1: 210, y1: 20, x2: 210, y2: 280, class: 'cr01-axis' });
  shape('text', { x: 250, y: 304 }, 'Re s (entered units)'); shape('text', { x: 10, y: 16 }, 'Im s (entered units)');
  for (const value of [-1, 0, 1]) { shape('text', { x: x(value * limit), y: 170 }, format(value * limit)); if (value) shape('text', { x: 218, y: y(value * limit) }, format(value * limit)); }
  for (const z of roots) {
    const px = x(z.re), py = y(z.im); shape('path', { d: `M${px - 5},${py - 5}L${px + 5},${py + 5}M${px - 5},${py + 5}L${px + 5},${py - 5}`, class: 'cr01-root' });
    shape('text', { x: px + 8, y: py - 8 }, `m=${z.multiplicity}`);
  }
  region.append(svg); return region;
}
