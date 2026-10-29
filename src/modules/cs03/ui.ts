import type { ModuleMount } from '../../core/module';
import { createEquationDisplay, createEquationInput, type EquationDraft } from '../../shared/equations/input';
import { add, analyze, checkPrediction, conditions, div, interval, latexOf, mul, neg, numberOf, parseEndpoint, parseModel, q, sub, textOf, type Model, type Polynomial, type Rational } from './math';
import { conditionPlot, rootPlot } from './plots';
import './workspace.css';
function el<K extends keyof HTMLElementTagNameMap>(tag: K, text?: string, className?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag); if (text !== undefined) node.textContent = text; if (className) node.className = className; return node;
}
const display = (latex: string, label: string) => createEquationDisplay(latex, label);
const fmt = (n: number) => {
  if (n === 0) return '0';
  if (Math.abs(n) >= 1e-5) return n.toLocaleString('en-US', { useGrouping: false, maximumSignificantDigits: 8 });
  const [mantissa, exponent] = n.toExponential(6).split('e');
  const superscript = String(Number(exponent)).replace(/[-0-9]/g, digit => '⁻⁰¹²³⁴⁵⁶⁷⁸⁹'['-0123456789'.indexOf(digit)]);
  return `${mantissa} × 10${superscript}`;
};
function polynomial(p: Polynomial) {
  let out = '';
  for (let i = p.length - 1; i >= 0; i--) {
    const v = p[i]; if (!v.n) continue; const magnitude = { n: v.n < 0n ? -v.n : v.n, d: v.d };
    out += out ? v.n < 0n ? '-' : '+' : v.n < 0n ? '-' : '';
    out += (i && magnitude.n === magnitude.d ? '' : latexOf(magnitude)) + (i > 1 ? `s^${i}` : i === 1 ? 's' : '');
  }
  return out || '0';
}
// Native numeric exponents are separate from the visual polynomial grammar.
function numericValue(field: HTMLInputElement) {
  const raw = field.value.trim(), value = Number(raw);
  return !raw || (value === 0 && /[1-9]/.test(raw.split(/[eE]/)[0])) ? NaN : value;
}
export const mountUI: ModuleMount = ({ container, signal }) => {
  const root = el('div', undefined, 'cubic-tool'); container.append(root);
  let draft: EquationDraft, model: Model | null = null, gainFactor = 1, gain = 10, exactGain: Rational | null = null, minimum = -10, maximum = 80;
  let predictionFeedback = '';
  const result = el('section'); result.setAttribute('aria-label', 'Checked cubic stability region');
  const error = el('p', undefined, 'c-feedback'); error.setAttribute('role', 'status'); error.hidden = true;
  root.append(el('p', 'Predict the complete gain interval, then intersect the Routh conditions and inspect every mode at interior, exterior and boundary gains.'));
  root.append(display(String.raw`L(s)=\frac{Kg}{D(s)},\quad 1+L(s)=0,\quad P(s,K)=D(s)+Kg`, 'Negative unity feedback characteristic equation'));
  root.append(el('p', 'Negative unity SISO feedback with constant real numerator g and monic cubic D(s)=s³+a s²+b s+d. No factors are cancelled. K is dimensionless; time is in seconds, s has units s⁻¹, and a,b,d have units s⁻¹,s⁻²,s⁻³. gK has units s⁻³. There is no sample period.'));
  const input = createEquationInput({ label: 'Plant denominator D(s)', value: 'D(s)=s(s+2)(s+5)', signal, onChange: next => { draft = next; invalidate(); } });
  draft = input.getValue(); root.append(input.element);
  const details = el('details'), summary = el('summary', 'Supported equations and limits'); details.append(summary);
  details.append(el('p', 'Use sums, products, visible parentheses, powers 0..3, decimals (six places/nine digits per number) and signed numeric fractions. At most 300 characters, 160 symbols and twelve nested groups. Mixed numbers need an explicit + or ×; invisible brace grouping, nested fraction notation, visual e notation and K inside D are unsupported. Final nonzero coefficients: magnitude 10⁻⁸..100, reduced fraction parts ≤10¹²; leading coefficient exactly 1. Exact fraction components are bounded to 2048 bits.'));
  details.append(el('p', 'g: zero or magnitude 10⁻⁸..100. Manual selected K and plot endpoints: −1000..1000. Exact inspection buttons can select gains outside that window. Native numeric controls accept finite exponents but reject nonzero underflow. Endpoint answers accept exact visual fractions or decimals; comparison tolerance is at most 10⁻⁶ relative to at least 1 and 10⁻⁴ of interval width. Endpoint grammar: constant arithmetic, 300 characters/80 symbols/12 groups, 80 digits/50 decimal places per literal, answer magnitude ≤10¹³. Root coordinates are numerical; the interval proof is exact.')); root.append(details);
  const controls = el('div', undefined, 'c-controls'); root.append(controls);
  function numeric(parent: HTMLElement, label: string, value: number | null, onChange?: (v: number) => void) {
    const wrap = el('label', label), field = el('input'); field.type = 'number'; field.step = 'any'; field.value = value === null ? '' : String(value);
    if (onChange) field.addEventListener('input', () => onChange(numericValue(field)), { signal }); wrap.append(field); parent.append(wrap); return field;
  }
  const gField = numeric(controls, 'Constant numerator g', gainFactor, value => { gainFactor = value; invalidate(); }); gField.min = '-100'; gField.max = '100';
  const kField = numeric(controls, 'Selected K (manual −1000..1000)', gain, value => { gain = value; exactGain = null; if (model) render(); }); kField.min = '-1000'; kField.max = '1000';
  const minField = numeric(controls, 'Gain-axis minimum', minimum, value => { minimum = value; if (model) render(); });
  const maxField = numeric(controls, 'Gain-axis maximum', maximum, value => { maximum = value; if (model) render(); });
  const attempt = el('fieldset'), legend = el('legend', 'Your complete strict-stability set'); attempt.append(legend); root.append(attempt);
  const answerControls = el('div', undefined, 'c-controls c-answer-controls'); attempt.append(answerControls);
  const kindLabel = el('label', 'Gain-set type'), kind = el('select');
  for (const [value, label] of [['finite', 'Finite interval'], ['all', 'All real K'], ['empty', 'Empty set']]) { const option = el('option', label); option.value = value; kind.append(option); }
  kindLabel.append(kind); answerControls.append(kindLabel);
  function answerChanged() { if (model) { predictionFeedback = 'Your interval answer changed; check again.'; render(); } }
  const lower = createEquationInput({ label: 'Predicted lower endpoint', value: '', signal, onChange: answerChanged }), upper = createEquationInput({ label: 'Predicted upper endpoint', value: '', signal, onChange: answerChanged });
  const lowerGroup = el('div', undefined, 'c-answer-bound'), upperGroup = el('div', undefined, 'c-answer-bound');
  lowerGroup.append(lower.element); upperGroup.append(upper.element); answerControls.append(lowerGroup, upperGroup);
  attempt.append(el('p', 'Enter numerical endpoints using fractions or decimal approximations, then choose whether each endpoint is included. Use explicit + or × beside a fraction; mixed-number notation is unsupported. Very narrow intervals require exact fractions or sufficiently precise decimals.', 'c-small'));
  function endpoint(parent: HTMLElement, label: string) { const wrap = el('label', label), select = el('select'); for (const [value, text] of [['open', 'Open (excluded)'], ['closed', 'Closed (included)']]) { const option = el('option', text); option.value = value; select.append(option); } wrap.append(select); parent.append(wrap); return select; }
  const lowerType = endpoint(lowerGroup, 'Lower endpoint inclusion'), upperType = endpoint(upperGroup, 'Upper endpoint inclusion');
  kind.addEventListener('change', () => { lower.element.hidden = upper.element.hidden = kind.value !== 'finite'; lowerType.disabled = upperType.disabled = kind.value !== 'finite'; answerChanged(); }, { signal });
  lowerType.addEventListener('change', answerChanged, { signal }); upperType.addEventListener('change', answerChanged, { signal });
  const actions = el('div', undefined, 'c-actions'); root.append(actions, error, result);
  function button(parent: HTMLElement, text: string, action: () => void) {
    const node = el('button', text); node.type = 'button'; node.addEventListener('click', () => {
      const focused = document.activeElement === node; action();
      if (focused && !node.isConnected) { const target = Array.from(result.querySelectorAll('button')).find(b => b.textContent === text) ?? result.querySelector('h3'); if (target) { target.tabIndex = target instanceof HTMLButtonElement ? 0 : -1; target.focus(); } }
    }, { signal }); parent.append(node); return node;
  }
  function showError(reason: unknown) { error.textContent = reason instanceof Error ? reason.message : 'Check the inputs.'; error.hidden = false; result.replaceChildren(); }
  function solve(grade: boolean) {
    try {
      if (draft.empty || draft.hasPlaceholders || draft.syntaxIssues.length) throw new Error('Complete the denominator and check its visual notation.');
      model = parseModel(draft.latex, gainFactor);
      let answerLower = q(0), answerUpper = q(0);
      if (grade && kind.value === 'finite') {
        const drafts = [lower.getValue(), upper.getValue()];
        if (drafts.some(value => value.empty || value.hasPlaceholders || value.syntaxIssues.length)) throw new Error('Complete both numerical endpoints and their visual notation.');
        answerLower = parseEndpoint(drafts[0].latex); answerUpper = parseEndpoint(drafts[1].latex);
      }
      predictionFeedback = grade ? checkPrediction(model, { kind: kind.value as 'finite' | 'all' | 'empty', lower: answerLower, upper: answerUpper, lowerClosed: lowerType.value === 'closed', upperClosed: upperType.value === 'closed' }).message : 'Derivation revealed. Compare it with your interval answer.';
      render();
    } catch (reason) { model = null; showError(reason); }
  }
  button(actions, 'Check interval and reveal', () => solve(true)); button(actions, 'Reveal derivation', () => solve(false));
  function preset(source: string, g: number, k: number, min: number, max: number) {
    input.setValue(source); draft = input.getValue(); gainFactor = g; gain = k; minimum = min; maximum = max; exactGain = null;
    gField.value = String(g); kField.value = String(k); minField.value = String(min); maxField.value = String(max); lower.setValue(''); upper.setValue(''); invalidate();
  }
  button(actions, 'W06 cubic experiment', () => preset('D(s)=s^3+6s^2+8s', 1, 10, -10, 60));
  button(actions, 'Reverse gain polarity', () => preset('D(s)=s(s+2)(s+5)', -1, -10, -80, 10));
  button(actions, 'Gain-independent experiment', () => preset('D(s)=(s+1)(s+2)(s+3)', 0, 10, -10, 80));
  function invalidate() { model = null; predictionFeedback = ''; error.hidden = true; result.replaceChildren(); }
  function select(k: Rational) { exactGain = k; gain = numberOf(k); kField.value = String(gain); render(); }
  function render() {
    if (!model || signal.aborted) return;
    try {
      if (![minimum, maximum].every(v => Number.isFinite(v) && Math.abs(v) <= 1000) || maximum <= minimum) throw new Error('Choose −1000 ≤ gain-axis minimum < maximum ≤ 1000.');
      if (!exactGain && (!Number.isFinite(gain) || Math.abs(gain) > 1000)) throw new Error('Choose finite manual K in [−1000,1000].');
      const m = model, set = interval(m), current = analyze(m, exactGain ?? gain), rows = conditions(m);
      error.hidden = true; result.replaceChildren();
      const feedback = el('p', predictionFeedback, 'c-feedback'); feedback.setAttribute('role', 'status'); result.append(feedback);
      result.append(el('h3', 'Form the characteristic polynomial'));
      result.append(display(`P(s,K)=(${polynomial(m.denominator)})+(${latexOf(m.g)})K=s^3+(${latexOf(m.a)})s^2+(${latexOf(m.b)})s+c(K)`, 'Editable feedback characteristic polynomial'));
      result.append(display(`c(K)=${latexOf(m.d)}+(${latexOf(m.g)})K`, 'Affine constant term'));
      result.append(el('h3', 'Derive and intersect the strict inequalities'));
      result.append(display(String.raw`a>0,\quad b>0,\quad c(K)>0,\quad ab-c(K)>0`, 'Necessary and sufficient cubic Hurwitz conditions'));
      result.append(el('p', 'For a monic real cubic, these four strict conditions are necessary and sufficient. When a>0, the Routh first column is 1, a, (ab−c)/a, c. Each condition is constant or affine in K, so solving and intersecting the half-lines gives the complete real-gain set. No gain sweep is used as a proof.'));
      result.append(display(String.raw`${latexOf(m.d)}+(${latexOf(m.g)})K>0,\qquad ${latexOf(sub(mul(m.a, m.b), m.d))}-(${latexOf(m.g)})K>0`, 'Both affine gain inequalities'));
      const answer = set.kind === 'finite' ? `${textOf(set.lower!)} < K < ${textOf(set.upper!)}` : set.kind === 'all' ? 'All real K' : 'Empty set: no strictly stable real gain'; result.append(el('p', answer, 'c-answer'));
      if (set.kind === 'empty') result.append(el('p', 'At least one necessary condition has no common solution. Changing only the constant term cannot repair a≤0 or b≤0. For g=0 every condition is gain-independent.'));
      if (set.kind === 'all') result.append(el('p', 'Here g=0 and D is strictly Hurwitz, so changing K does not move any mode.'));
      result.append(conditionPlot(m, gain, minimum, maximum));
      const checks = el('table'), head = el('tr'); ['Condition', 'Exact value at selected K', 'Pass?'].forEach(text => head.append(el('th', text))); checks.append(head);
      rows.forEach((row, i) => { const tr = el('tr'); tr.append(el('th', row.label), el('td', textOf(current.evaluated[i])), el('td', current.evaluated[i].n > 0n ? 'Yes' : 'No')); checks.append(tr); });
      const scroll = el('div', undefined, 'c-table-scroll'); scroll.append(checks); result.append(scroll);
      result.append(el('h3', `All roots at K = ${textOf(current.gain)}`));
      result.append(display(`P(s)=${polynomial([current.c, m.b, m.a, { n: 1n, d: 1n }])}`, 'Selected characteristic polynomial'));
      result.append(el('p', current.formalStable ? 'Strictly stable by the exact inequalities.' : 'Not strictly stable by the exact inequalities.', 'c-feedback'));
      result.append(rootPlot(current.roots));
      const roots = el('ul'); current.roots.forEach((z, i) => roots.append(el('li', `s${i + 1} = ${fmt(z.re)} ${z.im < 0 ? '−' : '+'} ${fmt(Math.abs(z.im))}j s⁻¹`))); result.append(roots);
      result.append(el('p', `${current.structure}. Numerical right-half-plane count: ${current.rightCount}. Axis comparison tolerance: ${fmt(current.tolerance)} s⁻¹ (10⁻⁸ times the largest root magnitude or 1). Largest normalized polynomial residual: ${fmt(current.residual)} (required ≤10⁻⁸; scale is the sum of term magnitudes or 1).${current.nearAxis ? ' A mode is on or near the imaginary axis; coordinates alone cannot certify strict stability.' : ''}`, 'c-small'));
      result.append(el('h3', 'Routh table and endpoint classification'));
      if (current.firstColumn) {
        const table = el('table'); [['Row', 'First entry', 'Second entry'], ['s³', '1', textOf(m.b)], ['s²', textOf(m.a), textOf(current.c)], ['s¹', textOf(current.firstColumn[2]), '0'], ['s⁰', textOf(current.c), '0']].forEach((cells, i) => { const row = el('tr'); cells.forEach(t => row.append(el(i === 0 ? 'th' : 'td', t))); table.append(row); }); const wrap = el('div', undefined, 'c-table-scroll'); wrap.append(table); result.append(wrap);
        result.append(el('p', current.signChanges === null ? 'A zero first-column entry requires special treatment; no sign-change count is assigned. At c=0 or c=ab, use the exact factors below and all listed roots.' : `${current.signChanges} Routh sign change(s), counting right-half-plane roots by the exact nonzero first column. The numerical axis tolerance may hide a mode very close to the axis.`));
      } else result.append(el('p', 'a=0: the usual Routh pivot is zero, so division by a is not performed. The necessary condition a>0 fails; the full numerical roots remain available.'));
      result.append(display(String.raw`c=0:\ P=s(s^2+as+b),\qquad c=ab:\ P=(s+a)(s^2+b)`, 'Exact endpoint factor identities'));
      result.append(el('p', 'When a,b>0, c=0 has a zero mode and c=ab has the pair ±j√b plus −a. Both endpoints are excluded from strict stability. The pair has angular frequency √b rad/s. These identities classify the boundaries without inferring them from rounded roots.'));
      if (m.g.n) {
        // These equalities remain inspectable even when a/b make the strict set empty.
        const zero = div(neg(m.d), m.g), other = div(sub(mul(m.a, m.b), m.d), m.g);
        const inspect = el('div', undefined, 'c-actions'); result.append(inspect);
        button(inspect, `Inspect K = ${textOf(zero)}`, () => select(zero));
        if (textOf(other) !== textOf(zero)) button(inspect, `Inspect K = ${textOf(other)}`, () => select(other));
        result.append(el('p', `c=0 at K=${textOf(zero)}; c=ab at K=${textOf(other)}. Equality alone does not guarantee the other conditions. Exact buttons retain fractional gains.`));
      }
      if (set.kind === 'finite') {
        const inspect = el('div', undefined, 'c-actions'); result.append(inspect);
        button(inspect, 'Inspect interval midpoint', () => select(div(add(set.lower!, set.upper!), q(2))));
        const step = div(sub(set.upper!, set.lower!), q(4));
        button(inspect, 'Inspect below interval', () => select(sub(set.lower!, step)));
        button(inspect, 'Inspect above interval', () => select(add(set.upper!, step)));
        result.append(el('p', 'The midpoint is interior; the two exterior checks are one quarter-interval width beyond each endpoint. All three roots are recomputed. Use numeric K for further points.'));
      }
    } catch (reason) { showError(reason); }
  }
  return () => { input.destroy(); lower.destroy(); upper.destroy(); root.remove(); };
};
