import type { ModuleMount } from '../../core/module';
import { createEquationDisplay, createEquationInput, type EquationDraft } from '../../shared/equations/input';
import { analyze, atGain, boundaryInfo, constraints, exactLatex, exactText, gainRegions, numberOf, parseModel, type GainRegion, type Model, type Polynomial, type Rational } from './math';
import { gainBar, locusPlot } from './plots';
import './workspace.css';

function element<K extends keyof HTMLElementTagNameMap>(tag: K, text?: string, className?: string): HTMLElementTagNameMap[K] {
  const out = document.createElement(tag); if (text !== undefined) out.textContent = text; if (className) out.className = className; return out;
}
const fmt = (n: number) => n === 0 ? '0' : n.toLocaleString('en-US', { useGrouping: false, maximumSignificantDigits: 8 });
function polynomial(p: Polynomial): string {
  let out = '';
  for (let i = 2; i >= 0; i--) {
    const q = p[i]; if (!q.n) continue;
    const negative = q.n < 0n, magnitude = { n: negative ? -q.n : q.n, d: q.d };
    out += out ? negative ? '-' : '+' : negative ? '-' : '';
    out += (i && magnitude.n === magnitude.d ? '' : exactLatex(magnitude)) + (i === 2 ? 'z^2' : i === 1 ? 'z' : '');
  }
  return out || '0';
}
function regionText(r: GainRegion): string {
  return `${r.lower ? exactText(r.lower) : '−∞'} < K < ${r.upper ? exactText(r.upper) : '∞'}`;
}
const equation = (latex: string, label: string) => createEquationDisplay(latex, label);

export const mountUI: ModuleMount = ({ container, signal }) => {
  const root = element('div', undefined, 'gain-tool'); container.append(root);
  let nDraft: EquationDraft, dDraft: EquationDraft, model: Model | null = null;
  let gain = 1, exactGain: Rational | null = null, minimum = -3, maximum = 6;
  const error = element('p', undefined, 'g-feedback'); error.setAttribute('role', 'status'); error.hidden = true;
  const result = element('section'); result.setAttribute('aria-label', 'Checked gain regions');
  root.append(element('p', 'Predict how many separate stable gain intervals exist, then locate every unit-circle crossing and check all closed-loop roots.'));
  root.append(equation(String.raw`L(z)=K\frac{N(z)}{D(z)},\quad 1+L(z)=0,\quad P(z,K)=D(z)+KN(z)`, 'Negative unity feedback'));
  root.append(element('p', 'Negative unity feedback; K is real. Enter a proper or biproper plant with monic quadratic D and numerator degree at most 2. No cancellation is applied: every uncancelled characteristic root is checked. z and K are dimensionless; no sample period is needed.'));
  const nInput = createEquationInput({ label: 'Numerator N(z)', value: 'N(z)=z+0.2', signal, onChange: d => { nDraft = d; invalidate(); } });
  const dInput = createEquationInput({ label: 'Denominator D(z)', value: 'D(z)=z(z-1)', signal, onChange: d => { dDraft = d; invalidate(); } });
  root.append(nInput.element, dInput.element); nDraft = nInput.getValue(); dDraft = dInput.getValue();
  root.append(element('p', 'Grammar: sums/products, parentheses, powers 0/1/2, decimals (up to 6 places, 9 digits per literal) and numeric fractions. At most 300 characters, 160 tokens and 12 nested groups per polynomial. Final nonzero coefficients: magnitude 10⁻⁸ to 100, reduced numerator/denominator at most 40 bits. K belongs in its own control.', 'g-small'));
  const controls = element('div', undefined, 'g-controls'); root.append(controls);
  function numeric(label: string, value: number, change: (n: number) => void): HTMLInputElement {
    const wrap = element('label', label), field = element('input'); field.type = 'number'; field.min = '-100'; field.max = '100'; field.step = 'any'; field.value = String(value);
    field.addEventListener('input', () => change(field.value.trim() ? Number(field.value) : NaN), { signal }); wrap.append(field); controls.append(wrap); return field;
  }
  const gainInput = numeric('Selected gain K (−100 to 100)', gain, v => { gain = v; exactGain = null; if (model) render(); });
  numeric('Locus window K minimum', minimum, v => { minimum = v; if (model) render(); });
  numeric('Locus window K maximum', maximum, v => { maximum = v; if (model) render(); });
  const predictionLabel = element('label', 'Predicted number of stable intervals'), prediction = element('select');
  for (const [value, text] of [['', 'Choose a prediction'], ['0', 'No stable interval'], ['1', 'One stable interval'], ['2', 'Two stable intervals']]) { const option = element('option', text); option.value = value; prediction.append(option); }
  predictionLabel.append(prediction); controls.append(predictionLabel);
  const actions = element('div', undefined, 'g-actions'); root.append(actions, error, result);
  function button(parent: HTMLElement, text: string, action: () => void) {
    const b = element('button', text); b.type = 'button';
    b.addEventListener('click', () => {
      const focused = document.activeElement === b; action();
      if (focused && !b.isConnected) {
        const target = Array.from(result.querySelectorAll('button')).find(next => next.textContent === text) ?? result.querySelector('h3');
        if (target) { target.tabIndex = target instanceof HTMLButtonElement ? 0 : -1; target.focus(); }
      }
    }, { signal }); parent.append(b); return b;
  }
  function showError(reason: unknown) { error.textContent = reason instanceof Error ? reason.message : 'Check the inputs.'; error.hidden = false; result.replaceChildren(); }
  button(actions, 'Check prediction and reveal', () => {
    try {
      if ([nDraft, dDraft].some(d => d.empty || d.hasPlaceholders || d.syntaxIssues.length)) throw new Error('Complete both visual polynomials and check their notation.');
      model = parseModel(nDraft.latex, dDraft.latex); render();
    } catch (reason) { model = null; showError(reason); }
  });
  function preset(n: string, d: string, k: number) {
    nInput.setValue(n); dInput.setValue(d); nDraft = nInput.getValue(); dDraft = dInput.getValue(); gain = k; exactGain = null; gainInput.value = String(k); invalidate();
  }
  button(actions, 'Complex crossing experiment', () => preset('N(z)=z+0.5', 'D(z)=z(z-1)', 2));
  button(actions, 'Disconnected gain-set experiment', () => preset('N(z)=-z^2+0.5z', 'D(z)=z^2', 0));
  root.append(element('p', 'The locus is a bounded sampled illustration. The complete gain set comes from exact rational sign partitions, independently of the picture. Repeated/unit-circle roots and singular algebraic feedback are excluded from strict stability. Displayed root coordinates are approximate (radius tolerance 10⁻⁸).', 'g-small'));

  function invalidate() { model = null; result.replaceChildren(); error.hidden = true; prediction.value = ''; }
  function render() {
    if (!model || signal.aborted) return;
    try {
      if (![minimum, maximum].every(v => Number.isFinite(v) && Math.abs(v) <= 100) || maximum <= minimum) throw new Error('Choose a locus window with −100 ≤ minimum < maximum ≤ 100.');
      if (!Number.isFinite(gain) || Math.abs(gain) > 100) throw new Error('Choose a finite K in [-100,100].');
      const m = model, partition = gainRegions(m), current = analyze(m, exactGain ?? gain), all = constraints(m);
      error.hidden = true; result.replaceChildren();
      const feedback = element('p', `${prediction.value === '' ? 'Computed check' : Number(prediction.value) === partition.stable.length ? 'Your prediction agrees' : 'Compare your prediction'}: ${partition.stable.length} separate strictly stable gain interval(s).`, 'g-feedback'); feedback.setAttribute('role', 'status'); result.append(feedback);
      result.append(element('h3', 'Form the uncancelled characteristic equation'));
      result.append(equation(`P(z,K)=(${polynomial(m.denominator)})+K(${polynomial(m.numerator)})=a(K)z^2+b(K)z+c(K)`, 'Characteristic equation from feedback'));
      for (const [symbol, i] of [['a', 2], ['b', 1], ['c', 0]] as const) result.append(equation(`${symbol}(K)=${exactLatex(m.denominator[i])}+(${exactLatex(m.numerator[i])})K`, `Coefficient ${symbol}`));
      result.append(element('h3', 'Derive the complete gain set'));
      result.append(equation(String.raw`a\ne0,\quad\frac{a+b+c}{a}>0,\quad\frac{a-b+c}{a}>0,\quad\frac{a-c}{a}>0`, 'Quadratic Jury conditions'));
      result.append(element('p', 'Normalize by a before applying Jury. All three numerators must have the same nonzero sign as a; negative a is allowed. Each expression is affine in K, so its sign is fixed between consecutive exact zeros. Checking one exact rational point per cell proves the complete interval set.'));
      const setText = partition.stable.length ? partition.stable.map(regionText).join('  ∪  ') : 'No strictly stable real gain';
      result.append(element('p', setText, 'g-answer'));
      if (partition.identities.length) {
        result.append(element('p', `Identically zero condition(s): ${partition.identities.join(', ')}. This prevents strict stability for every gain. A fixed P(+1)=0 or P(-1)=0 retains that unit-circle root even if N and D share its factor.`, 'g-feedback'));
        if (partition.identities.includes('a-c')) {
          const pairs = partition.regions.filter(r => r.signs[0] !== 0 && r.signs[1] === r.signs[0] && r.signs[2] === r.signs[0]);
          result.append(element('p', pairs.length ? `Because a=c for all K, a complex pair lies on the circle throughout: ${pairs.map(regionText).join(' ∪ ')}. Its angle obeys cos θ=−b/(2a); real endpoints and singular gains are handled separately.` : 'Here a=c is an identity; a complex circle pair requires |b|<2|a| and a≠0. There is no open gain cell satisfying that condition.'));
        }
      }
      const partitionTable = element('table'), head = element('tr'); ['Open gain cell', 'Exact test K', 'signs: a, P(+1), P(−1), a−c', 'Strictly stable?'].forEach(t => head.append(element('th', t))); partitionTable.append(head);
      for (const region of partition.regions) {
        const row = element('tr'); row.append(element('td', regionText(region)), element('td', exactText(region.probe)), element('td', region.signs.map(s => s > 0 ? '+' : s < 0 ? '−' : '0').join(', ')), element('td', region.stable ? 'Yes' : 'No')); partitionTable.append(row);
      }
      const scroll = element('div', undefined, 'g-table-scroll'); scroll.append(partitionTable); result.append(scroll);
      result.append(equation(String.raw`(1-w)^2P\left(\frac{1+w}{1-w},K\right)=(a-b+c)w^2+2(a-c)w+(a+b+c)`, 'Transformed Routh cross-check'));
      result.append(element('p', 'Routh cross-check: the first column is [a−b+c, 2(a−c), a+b+c]. Its entries sum to 4a, so all have the same nonzero sign exactly when the three normalized Jury inequalities hold. At a=0, the biproper feedback equation is algebraically singular; a reduced-degree polynomial cannot certify the original feedback interconnection.'));
      result.append(gainBar(m, gain, minimum, maximum), locusPlot(m, gain, minimum, maximum));
      result.append(element('h3', `All roots at K = ${exactGain ? exactText(exactGain) : fmt(gain)}`));
      const classification = element('p', current.classification, 'g-feedback'); classification.setAttribute('role', 'status'); result.append(classification);
      result.append(equation(`P(z)=(${fmt(current.a)})z^2+(${fmt(current.b)})z+(${fmt(current.c)})`, 'Selected characteristic coefficients'));
      const list = element('ul'); current.roots.finite.forEach((z, i) => list.append(element('li', `z${i + 1} = ${fmt(z.re)} ${z.im < 0 ? '−' : '+'} ${fmt(Math.abs(z.im))}j; radius ${fmt(current.radii[i])}`)));
      if (current.roots.atInfinity) list.append(element('li', `${current.roots.atInfinity} root(s) at infinity through degree loss; algebraic feedback is singular.`));
      if (current.roots.identicallyZero) list.append(element('li', 'P is identically zero. Its roots are undetermined; the feedback equation is singular.'));
      result.append(list);
      if (current.nearSingular) result.append(element('p', 'The leading coefficient is near zero relative to the remaining coefficients. Root locations are ill-conditioned; choose a gain farther from this algebraic singularity.', 'g-feedback'));
      result.append(element('h3', 'Every critical gain and crossing equation'));
      result.append(equation(String.raw`P(1,K)=a+b+c=0,\quad P(-1,K)=a-b+c=0`, 'Real unit-circle crossings'));
      result.append(equation(String.raw`z=e^{j\theta},\quad a=c,\quad\cos\theta=-\frac{b}{2a},\quad |b|<2|a|`, 'Complex unit-circle crossings'));
      result.append(element('p', 'For a nonreal pair, the imaginary part of P(eʲᶿ)/eʲᶿ is (a−c)sin θ. Thus a=c is necessary, and the cosine condition verifies a genuine complex crossing. An a=c candidate with |b|>2|a| is not a circle pair. Fixed-boundary identities above describe nonisolated crossings.'));
      if (!partition.critical.length) result.append(element('p', 'There are no isolated critical gains; the constant-sign conditions above apply to every real K.'));
      for (const k of partition.critical) {
        const section = element('section', undefined, 'g-boundary'), info = boundaryInfo(m, k);
        section.append(element('h4', `K = ${exactText(k)} (≈ ${fmt(numberOf(k))})`));
        for (const condition of all.filter(q => atGain(q, k).n === 0n)) section.append(equation(`${condition.name.replace('P(+1)', 'P(1)').replace('P(-1)', 'P(-1)')}=${exactLatex(condition.constant)}+(${exactLatex(condition.slope)})K=0`, `${condition.name} boundary equation`));
        section.append(element('p', info.kinds.join('; ') || 'Critical affine equality'));
        if (info.angle !== null) section.append(element('p', `θ = ±${fmt(info.angle)} rad = ±${fmt(info.angle * 180 / Math.PI)}°. Both conjugate roots are on the circle.`));
        section.append(element('p', info.roots.identicallyZero ? 'Characteristic polynomial identically zero; no root set can be assigned.' : `Finite roots: ${info.roots.finite.map(z => `${fmt(z.re)} ${z.im < 0 ? '−' : '+'} ${fmt(Math.abs(z.im))}j`).join('; ') || 'none'}${info.roots.atInfinity ? `; ${info.roots.atInfinity} at infinity` : ''}. All critical gains are excluded from the strict set.`));
        if (Math.abs(numberOf(k)) <= 100) button(section, `Inspect K = ${exactText(k)}`, () => { exactGain = k; gain = numberOf(k); gainInput.value = String(gain); render(); });
        result.append(section);
      }
    } catch (reason) { showError(reason); }
  }
  return () => { nInput.destroy(); dInput.destroy(); root.remove(); };
};
