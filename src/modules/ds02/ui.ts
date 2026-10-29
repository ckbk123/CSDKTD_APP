import type { ModuleMount } from '../../core/module';
import { createEquationDisplay, createEquationInput, type EquationDraft } from '../../shared/equations/input';
import { at, cmp, conditions, evaluate, exact, intersect, intervalText, latex, num, parseFamily, parseNumber, rat, roots, type Affine, type Family, type Rational, type Root } from './math';
import './style.css';

const BASELINE = String.raw`P(z)=z^2+(K-1)z+0.2K`;
const VARIANT = String.raw`P(z)=z^2+(K-1)z+0.1K`;
const fmt = (n: number) => Math.abs(n) < 1e-12 ? '0' : Number(n.toPrecision(7)).toString();
const rootText = (r: Root) => `${fmt(r.re)}${r.im ? ` ${r.im < 0 ? '−' : '+'} j ${fmt(Math.abs(r.im))}` : ''}`;
function el<K extends keyof HTMLElementTagNameMap>(tag: K, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag); if (text !== undefined) e.textContent = text; return e;
}
function affineTex(c: Affine): string { return `${latex(c.slope)}K${c.offset.n < 0n ? '' : '+'}${latex(c.offset)}`; }
function svgEl(tag: string, attrs: Record<string, string | number>, text?: string): SVGElement {
  const e = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [key, value] of Object.entries(attrs)) e.setAttribute(key, String(value));
  if (text) e.textContent = text; return e;
}

export const mount: ModuleMount = ({ container, signal }) => {
  let draft: EquationDraft;
  let family: Family = parseFamily(BASELINE), selectedK = rat(1), revealed = false, dirty = false;
  let activeCondition = 0, sweep: [Rational, Rational] | null = null;
  const root = el('div'); root.className = 'jury';
  const intro = el('section');
  intro.append(el('h3', 'Derive a strict stability interval'), el('p', 'For a monic quadratic, build the mirrored rows, intersect the strict Jury inequalities, then check the roots. Predict the interval before revealing the result.'));
  const editor = createEquationInput({ label: 'Characteristic polynomial P(z)', value: BASELINE, signal, onChange: next => {
    draft = next; dirty = true; revealed = false; sweep = null;
    feedback.textContent = 'Polynomial changed. Apply it to update the exercise.';
    lesson.replaceChildren();
  } });
  const actions = el('div'); actions.className = 'jury-actions';
  const button = (text: string, action: string) => { const b = el('button', text); b.type = 'button'; b.dataset.action = action; return b; };
  actions.append(button('Apply polynomial', 'apply'), button('Try .1K worksheet variant', 'variant'), button('Restore .2K example', 'baseline'));
  const feedback = el('p'); feedback.setAttribute('role', 'status');
  const limits = el('details'); limits.append(el('summary', 'Supported inputs and conventions'));
  limits.append(el('p', 'Quadratic mode: P(z) = z² + b(K)z + a(K), where b and a are real affine expressions in K. Use numbers, fractions, parentheses and ordinary multiplication. Coefficients and K are dimensionless; no sample time or feedback model is assumed. This checks strict root stability of the supplied characteristic polynomial, not hidden states of an unspecified realization.'));
  limits.append(el('p', 'Coefficient magnitudes ≤ 10,000; coefficient denominators ≤ 1,000,000; |K| ≤ 10,000. Decimal numbers have at most six places. Expressions: ≤400 characters, 160 tokens, nesting ≤16, rational size ≤10²⁴. Powers of z up to two and K up to one; no functions or variable divisors. This is the complete quadratic test, not the full high-order Jury procedure. Root coordinates are numerical; points within 10⁻⁹ of the circle are visually near its boundary. Strict decisions use exact rational inequalities.'));
  const lesson = el('div');
  intro.append(editor.element, actions, feedback, limits); root.append(intro, lesson); container.append(root);
  draft = editor.getValue();

  function labelInput(parent: HTMLElement, label: string, name: string, value = '', placeholder = ''): HTMLInputElement {
    const wrap = el('label', label), input = el('input');
    input.name = name; input.value = value; input.placeholder = placeholder; input.setAttribute('aria-label', label); input.autocomplete = 'off';
    wrap.append(input); parent.append(wrap); return input;
  }
  function drawPoles(parent: HTMLElement, f: Family, k: Rational): void {
    const current = at(f, k), points = [...current.roots];
    const sampled: Root[] = [];
    if (sweep) for (let i = 0; i <= 80; i++) {
      const value = num(sweep[0]) + (num(sweep[1]) - num(sweep[0])) * i / 80;
      sampled.push(...roots(num(f.b.slope) * value + num(f.b.offset), num(f.a.slope) * value + num(f.a.offset)));
    }
    points.push(...sampled);
    const extent = Math.max(1.35, ...points.map(p => Math.max(Math.abs(p.re), Math.abs(p.im)) * 1.15));
    const scale = 140 / extent, x = (n: number) => 190 + scale * n, y = (n: number) => 174 - scale * n;
    const svg = svgEl('svg', { viewBox: '0 0 390 355', role: 'img', 'aria-label': `Unit circle and roots at K=${exact(k)}: ${current.roots.map(rootText).join('; ')}. ${sweep ? 'Dots are 81 sampled gains, not an interval proof.' : ''}` });
    svg.append(svgEl('title', {}, 'Roots in the z plane'), svgEl('line', { x1: 25, y1: 174, x2: 355, y2: 174, class: 'jury-axis' }), svgEl('line', { x1: 190, y1: 20, x2: 190, y2: 325, class: 'jury-axis' }),
      svgEl('circle', { cx: 190, cy: 174, r: scale, class: 'jury-circle' }), svgEl('text', { x: 318, y: 195 }, 'Re(z)'), svgEl('text', { x: 198, y: 30 }, 'Im(z)'),
      svgEl('text', { x: x(1), y: 190 }, '1'), svgEl('text', { x: x(-1) - 14, y: 190 }, '−1'), svgEl('text', { x: 198, y: y(1) - 4 }, 'j'));
    for (const p of sampled) svg.append(svgEl('circle', { cx: x(p.re), cy: y(p.im), r: 1.8, class: 'jury-sample' }));
    current.roots.forEach((p, i) => {
      const px = x(p.re), py = y(p.im);
      svg.append(svgEl('path', { d: `M${px - 5},${py - 5}l10,10m0,-10l-10,10`, class: 'jury-pole' }), svgEl('text', { x: px + 8, y: py - 8 - i * 3 }, `z${i + 1}`));
    });
    parent.append(svg, el('p', `Plot scale: ±${fmt(extent)} on both dimensionless axes. × selected roots; dots sampled roots. Coincident roots share a marker; both appear in the list below.`));
    const table = el('table'), caption = el('caption', 'Numerical roots at the selected K'); table.append(caption);
    const head = el('tr'); ['Root', 'Coordinate', '|z|', 'Position'].forEach(t => head.append(el('th', t))); table.append(head);
    current.roots.forEach((p, i) => {
      const radius = Math.hypot(p.re, p.im), row = el('tr');
      [`z${i + 1}`, rootText(p), fmt(radius), Math.abs(radius - 1) <= 1e-9 ? 'Near unit circle' : radius < 1 ? 'Inside' : 'Outside'].forEach(t => row.append(el('td', t))); table.append(row);
    });
    parent.append(table);
  }
  function render(): void {
    const active = document.activeElement instanceof HTMLElement && lesson.contains(document.activeElement) ? document.activeElement : null;
    const action = active?.dataset.action, actionValue = active?.dataset.value;
    const inputName = active instanceof HTMLInputElement ? active.name : null;
    renderContent();
    if (!active || active.isConnected) return;
    const replacement = action ? Array.from(lesson.querySelectorAll<HTMLButtonElement>('button[data-action]')).find(b => b.dataset.action === action && b.dataset.value === actionValue)
      : inputName ? Array.from(lesson.querySelectorAll<HTMLInputElement>('input[name]')).find(input => input.name === inputName) : null;
    const focusTarget = replacement ?? lesson.querySelector<HTMLElement>('h3');
    if (focusTarget) { if (!replacement) focusTarget.tabIndex = -1; focusTarget.focus({ preventScroll: true }); }
  }
  function renderContent(): void {
    if (signal.aborted || dirty) return;
    const cs = conditions(family), interval = intersect(cs), current = at(family, selectedK);
    lesson.replaceChildren();
    const inspect = el('section'); inspect.append(el('h3', '1. Inspect the coefficient rows'));
    const gain = el('div'); gain.className = 'jury-actions';
    labelInput(gain, 'Selected K (decimal or fraction)', 'gain', exact(selectedK)); gain.append(button('Inspect K', 'gain'));
    inspect.append(createEquationDisplay(`b(K)=${affineTex(family.b)},\\quad a(K)=${affineTex(family.a)}`, 'Affine coefficient functions'), gain, createEquationDisplay(`P(z)=z^2+(${latex(current.b)})z+(${latex(current.a)})`, 'Selected polynomial'));
    const rows = el('table'); rows.append(el('caption', 'Descending-power convention; the second row mirrors the first'));
    const header = el('tr'); ['Row', 'z² coefficient', 'z coefficient', 'constant'].forEach(t => header.append(el('th', t))); rows.append(header);
    for (const [name, values] of [['Forward A', ['1', exact(current.b), exact(current.a)]], ['Mirrored A*', [exact(current.a), exact(current.b), '1']]] as const) {
      const row = el('tr'); row.append(el('th', name)); values.forEach((value, i) => {
        const cell = el('td', value); if (i !== 1) cell.className = 'jury-coefficient'; row.append(cell);
      }); rows.append(row);
    }
    inspect.append(rows, createEquationDisplay(String.raw`zB(z)=P(z)-a z^2P(1/z),\quad B(z)=(1-a^2)z+b(1-a)`, 'Reduction convention'),
      el('p', 'Multiply the forward row by 1 and subtract a times the mirrored row. The constant cancels. Dividing by z leaves the linear row [1 − a², b(1 − a)].'));
    const rowAttempt = el('div'); rowAttempt.className = 'jury-actions';
    labelInput(rowAttempt, 'Your reduced leading coefficient', 'row0', '', 'e.g. 24/25');
    labelInput(rowAttempt, 'Your reduced constant', 'row1', '', 'e.g. 0'); rowAttempt.append(button('Check my row', 'row'));
    const rowFeedback = el('p'); rowFeedback.dataset.rowFeedback = ''; rowFeedback.setAttribute('role', 'status');
    inspect.append(rowAttempt, rowFeedback);
    if (revealed) {
      inspect.append(createEquationDisplay(`B(z)=(${latex(current.row[0])})z+(${latex(current.row[1])})`, 'Checked reduced row'),
        createEquationDisplay(`1-a^2=1-(${latex(current.a)})^2=${latex(current.row[0])}`, 'Leading determinant arithmetic'),
        createEquationDisplay(`b(1-a)=(${latex(current.b)})(1-(${latex(current.a)}))=${latex(current.row[1])}`, 'Constant determinant arithmetic'));
      if (!current.row[0].n) inspect.append(el('p', 'The leading reduction entry is zero (|a| = 1). Do not divide by it: strict stability fails. The root list separates unit-circle roots from roots outside the disk.'));
    }
    const attempt = el('section'); attempt.append(el('h3', '2. Predict the strict gain interval'));
    attempt.append(el('p', 'For a finite interval enter its lower and upper bounds (fractions work). Use −inf and inf for unbounded ends, or select the empty set. Endpoints must be excluded.'));
    const prediction = el('div'); prediction.className = 'jury-actions';
    labelInput(prediction, 'Predicted lower bound', 'lower', '', '0'); labelInput(prediction, 'Predicted upper bound', 'upper', '', '5/2');
    const emptyLabel = el('label', 'No stable K '), empty = el('input'); empty.type = 'checkbox'; empty.name = 'empty'; emptyLabel.append(empty); prediction.append(emptyLabel, button('Check my interval', 'predict'), button(revealed ? 'Hide checked result' : 'Reveal checked result', 'reveal'));
    const attemptFeedback = el('p'); attemptFeedback.dataset.attemptFeedback = ''; attemptFeedback.setAttribute('role', 'status'); attempt.append(prediction, attemptFeedback);
    lesson.append(inspect, attempt);
    if (!revealed) return;
    const proof = el('section'); proof.append(el('h3', '3. Intersect the Jury inequalities'));
    proof.append(el('p', 'For this real monic quadratic the necessary and sufficient conditions are |a| < 1, P(1) > 0 and P(−1) > 0. Under |a| < 1, the reduced leading entry 1−a² is positive and |b(1−a)| < 1−a² simplifies to |b| < 1+a. The following four linear inequalities therefore prove the complete interval.'));
    const list = el('div'); list.className = 'jury-conditions';
    cs.forEach((c, i) => {
      const card = el('div'); card.className = i === activeCondition ? 'jury-active' : '';
      card.append(button(c.label, `condition-${i}`), createEquationDisplay(`${c.formula}=${affineTex(c)}>0`, c.label), el('p', `Allowed set: ${intervalText(intersect([c]))}. At selected K: ${exact(evaluate(c, selectedK))} ${evaluate(c, selectedK).n > 0n ? '> 0 ✓' : '≤ 0; fails'}`)); list.append(card);
    });
    proof.append(list, el('p', `Complete strict intersection: ${intervalText(interval)}. Every finite endpoint is excluded.`));
    const focused = cs[activeCondition], bound = intersect([focused]);
    const why = activeCondition === 0 ? 'Equality places a root at +1.' : activeCondition === 1 ? 'Equality places a root at −1.' : 'Equality gives |a| = 1; the root product has unit magnitude. This prevents both roots from being strictly inside. It need not mean that both roots lie on the circle.';
    proof.append(el('p', `Selected condition: ${focused.label}. ${why}`));
    const boundaryActions = el('div'); boundaryActions.className = 'jury-actions';
    const candidates = [bound.lower, bound.upper, interval.lower, interval.upper].filter((r): r is Rational => r !== null);
    const seen = new Set<string>();
    for (const candidate of candidates) {
      if (Math.abs(num(candidate)) > 10000 || seen.has(exact(candidate))) continue;
      seen.add(exact(candidate)); const b = button(`Inspect boundary K = ${exact(candidate)}`, 'boundary'); b.dataset.value = exact(candidate); boundaryActions.append(b);
    }
    proof.append(boundaryActions);
    const line = svgEl('svg', { viewBox: '0 0 600 110', role: 'img', 'aria-label': `Inequality intersection: ${intervalText(interval)}. Selected K ${exact(selectedK)}.` });
    const finiteBounds = cs.flatMap(c => { const i = intersect([c]); return [i.lower, i.upper].filter((x): x is Rational => x !== null).map(num); });
    const lo = Math.min(-1, num(selectedK), ...finiteBounds), hi = Math.max(3, num(selectedK), ...finiteBounds), pad = (hi - lo) * .1;
    const X = (v: number) => 40 + 520 * (v - lo + pad) / (hi - lo + 2 * pad);
    line.append(svgEl('line', { x1: 20, y1: 45, x2: 580, y2: 45, class: 'jury-axis' }));
    if (!interval.empty) {
      const left = interval.lower === null ? 20 : X(num(interval.lower)), right = interval.upper === null ? 580 : X(num(interval.upper));
      line.append(svgEl('line', { x1: left, y1: 45, x2: right, y2: 45, class: 'jury-interval' }));
      for (const r of [interval.lower, interval.upper]) if (r !== null) line.append(svgEl('circle', { cx: X(num(r)), cy: 45, r: 6, class: 'jury-open' }), svgEl('text', { x: X(num(r)), y: 75, 'text-anchor': 'middle' }, fmt(num(r))));
    }
    line.append(svgEl('path', { d: `M${X(num(selectedK))},20v36`, class: 'jury-pole' }), svgEl('text', { x: X(num(selectedK)), y: 14, 'text-anchor': 'middle' }, `K=${fmt(num(selectedK))}`), svgEl('text', { x: 570, y: 97 }, 'K'));
    proof.append(line, el('p', 'Open circles mark excluded endpoints; the thick segment is the strict stable set. Axis labels are rounded; exact bounds are listed above. The table gives each inequality even when its bound is redundant.'));
    const plot = el('section'); plot.append(el('h3', '4. Check every root'));
    plot.append(el('p', `At K = ${exact(selectedK)}: ${current.stable ? 'strictly stable — all Jury inequalities are positive.' : current.boundary ? 'on the closed stability boundary — strict stability fails. Boundary roots can give bounded or growing free responses depending on multiplicity; they do not establish BIBO stability.' : 'not strictly stable — at least one Jury inequality fails; inspect both roots.'}`));
    drawPoles(plot, family, selectedK);
    const sweepControls = el('div'); sweepControls.className = 'jury-actions';
    labelInput(sweepControls, 'Sweep start K', 'sweepStart', sweep ? exact(sweep[0]) : '-0.5'); labelInput(sweepControls, 'Sweep end K', 'sweepEnd', sweep ? exact(sweep[1]) : '3');
    sweepControls.append(button('Show 81 sampled gains', 'sweep'), button('Clear sweep', 'clearSweep'));
    plot.append(sweepControls, el('p', 'A finite sweep illustrates motion; it cannot prove the complete stable interval. Change the constant coefficient from .2K to .1K using the worksheet button, predict again and compare the exact upper bounds.'));
    lesson.append(proof, plot);
  }
  const value = (name: string) => root.querySelector<HTMLInputElement>(`input[name="${name}"]`)!.value;
  function apply(): void {
    if (draft.empty || draft.hasPlaceholders || draft.syntaxIssues.length) throw new Error('Complete the polynomial and correct its notation before applying it.');
    const next = parseFamily(draft.latex);
    at(next, selectedK);
    family = next; dirty = false; revealed = false; sweep = null; activeCondition = 0;
    feedback.textContent = 'Polynomial applied. Fill the reduced row and predict the interval.'; render();
  }
  root.addEventListener('click', event => {
    const target = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-action]'); if (!target) return;
    const action = target.dataset.action!;
    try {
      if (action === 'apply') apply();
      else if (action === 'variant' || action === 'baseline') {
        editor.setValue(action === 'variant' ? VARIANT : BASELINE); draft = editor.getValue(); selectedK = rat(1); apply();
      } else if (action === 'gain') { const nextK = parseNumber(value('gain')); at(family, nextK); selectedK = nextK; render(); feedback.textContent = `Now inspecting K = ${exact(selectedK)}.`; }
      else if (action === 'reveal') { revealed = !revealed; render(); }
      else if (action.startsWith('condition-')) { activeCondition = Number(action.slice(10)); render(); }
      else if (action === 'boundary') { const nextK = parseNumber(target.dataset.value!); at(family, nextK); selectedK = nextK; render(); feedback.textContent = `Exact boundary K = ${exact(selectedK)} selected.`; }
      else if (action === 'row') {
        const current = at(family, selectedK), good = cmp(parseNumber(value('row0')), current.row[0]) === 0 && cmp(parseNumber(value('row1')), current.row[1]) === 0;
        root.querySelector('[data-row-feedback]')!.textContent = good ? 'Both entries are correct.' : 'Try again: leading = 1 − a², constant = b(1 − a). Substitute the displayed a and b; fractions are accepted.';
      } else if (action === 'predict') {
        const expected = intersect(conditions(family)), empty = root.querySelector<HTMLInputElement>('input[name="empty"]')!.checked;
        const matches = (entry: string, bound: Rational | null, negative: boolean) => bound === null ? (negative ? ['-inf', '−inf', '-∞', '−∞'] : ['inf', '+inf', '∞', '+∞']).includes(entry.trim()) : cmp(parseNumber(entry), bound) === 0;
        const good = empty ? expected.empty : !expected.empty && matches(value('lower'), expected.lower, true) && matches(value('upper'), expected.upper, false);
        root.querySelector('[data-attempt-feedback]')!.textContent = good ? 'Correct strict interval. Each finite endpoint is excluded.' : 'Recheck the intersection of all four inequalities. A root on the unit circle is excluded.';
      } else if (action === 'sweep') {
        const start = parseNumber(value('sweepStart')), end = parseNumber(value('sweepEnd'));
        if (cmp(start, rat(-10000)) < 0 || cmp(end, rat(10000)) > 0 || cmp(start, end) >= 0) throw new Error('Sweep needs −10,000 ≤ start < end ≤ 10,000.');
        sweep = [start, end]; render(); feedback.textContent = '81 sampled gains shown. Use the inequalities for the full interval.';
      } else if (action === 'clearSweep') { sweep = null; render(); }
    } catch (error) { feedback.textContent = error instanceof Error ? error.message : 'Check the input.'; }
  }, { signal });
  render();
  return () => { editor.destroy(); root.remove(); };
};
