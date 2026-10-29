import type { ModuleMount } from '../../core/module';
import { createEquationDisplay, createEquationInput, type EquationDraft } from '../../shared/equations/input';
import { readNumericInput } from '../../shared/numeric-input';
import { Z, constantOf, constantRF, formatP, latexQ, latexRF, limitRF, mulRF, q, signQ, textQ, type RF } from './algebra';
import { gradeCount, gradeEntry, type EntryPrediction, type Treatment } from './grade';
import { analyzeCoefficients, determinantWork, type Analysis } from './math';
import { parseAnswer, parseCharacteristic } from './parser';
import './workspace.css';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, text?: string, className?: string): HTMLElementTagNameMap[K] { const node = document.createElement(tag); if (text !== undefined) node.textContent = text; if (className) node.className = className; return node; }
const display = (latex: string, label: string) => createEquationDisplay(latex, label);
const signText = (sign: number) => sign > 0 ? '+' : sign < 0 ? '−' : '0';
const vector = (values: readonly RF[]) => `\\left[${values.map(latexRF).join(',')}\\right]`;
function rfPolynomial(values: readonly RF[]): string {
  const constants = values.map(constantOf);
  if (constants.every(value => value !== null)) return formatP(constants, 's', true);
  return values.map((value, power) => constantOf(value)?.n === 0n ? '' : `\\left(${latexRF(value)}\\right)${power ? `s^{${power}}` : ''}`).filter(Boolean).reverse().join('+') || '0';
}
const categoryText = (counts: { origin: number; realPairs: number; imaginaryPairs: number; complexQuartets: number }) => `${counts.origin} root(s) at the origin; ${counts.realPairs} symmetric real pair(s); ${counts.imaginaryPairs} imaginary pair(s); ${counts.complexQuartets} complex quartet(s), including multiplicity.`;

export const mountView: ModuleMount = ({ container, signal }) => {
  const root = el('div', undefined, 'routh-tool'); container.append(root);
  let draft: EquationDraft, answerDraft: EquationDraft, analysis: Analysis | null = null, selectedRow = 2, selectedColumn = 0, minorOrder = 2, highlighted = -1, revealed = false;
  const error = el('p', undefined, 'r-feedback'); error.setAttribute('role', 'status'); error.hidden = true;
  const result = el('section'); result.setAttribute('aria-label', 'Checked Routh and Hurwitz analysis');
  root.append(el('p', 'Predict the right-half-plane root count and identify any special row. Then fill a Routh cell or a leading Hurwitz minor and inspect its arithmetic.'));
  root.append(el('p', 'P(s) is an already formed real SISO characteristic polynomial. Coefficients are shown in descending powers and normalized to leading coefficient 1; multiplying all coefficients by a nonzero constant does not move roots. Time is in seconds and s has units s⁻¹; coefficients carry the corresponding powers. K substitutes a real coefficient value in these normalized units. No feedback topology, sampling or initial state is assumed.'));
  const input = createEquationInput({ label: 'Characteristic polynomial P(s)', value: 'P(s)=s^3+7s^2+10s+K', signal, onChange: next => { draft = next; invalidate(); } }); draft = input.getValue(); root.append(input.element);
  const limits = el('details'); limits.append(el('summary', 'Supported polynomials, exact answers and limits'));
  limits.append(el('p', 'Real degree 1..6, sums/products, visible parentheses, constant division, numeric or polynomial fractions, bounded nested fractions and optional K. Power boxes accept integers 0..12; the expanded polynomial must stay within degree six. Mixed numbers require + or ×. Spacing cannot fill an argument box or join separate numbers. Invisible grouping, ambiguous exponent tails, negative powers and visual e notation are unsupported.'));
  limits.append(el('p', 'At most 600 characters, 256 expanded symbols and sixteen nested groups including fraction parts. Model literals: twelve digits/eight decimal places. Reduced input coefficient parts ≤10¹² and magnitudes ≤10⁶; K in [−1000,1000]. Native finite exponents are accepted; nonzero underflow is rejected. Exact intermediates are bounded to 4096 bits and symbolic degree32. Student numeric answers allow sixty digits/forty decimal places per literal and bounded arithmetic. Enter exact fractions for nonterminating values. No floating epsilon or gain sweep is used as a proof.')); root.append(limits);
  const controls = el('div', undefined, 'r-controls'); root.append(controls);
  function number(parent: HTMLElement, label: string, value: string, integer = false) { const wrap = el('label', label), field = el('input'); field.type = 'number'; field.step = integer ? '1' : 'any'; field.value = value; wrap.append(field); parent.append(wrap); return field; }
  function select(parent: HTMLElement, label: string, options: readonly (readonly [string, string])[]) { const wrap = el('label', label), field = el('select'); options.forEach(([value, text]) => { const option = el('option', text); option.value = value; field.append(option); }); wrap.append(field); parent.append(wrap); return { field, wrap }; }
  function options(field: HTMLSelectElement, values: readonly (readonly [string, string])[], value: string) { field.replaceChildren(); values.forEach(([key, text]) => { const option = el('option', text); option.value = key; field.append(option); }); field.value = value; }
  const gain = number(controls, 'K (coefficient substitution)', '20'); gain.min = '-1000'; gain.max = '1000';
  const mode = select(controls, 'Exercise view', [['routh', 'Routh table'], ['hurwitz', 'Hurwitz leading minors']]).field;
  const coefficient = select(controls, 'Highlight coefficient', [['-1', 'Choose after revealing']]).field; coefficient.disabled = true;
  const prediction = el('fieldset'); prediction.append(el('legend', 'Your original-polynomial prediction')); const predictionControls = el('div', undefined, 'r-controls'); prediction.append(predictionControls); root.append(prediction);
  const predictedCount = number(predictionControls, 'Predicted RHP root count', '', true); predictedCount.min = '0'; predictedCount.max = '6';
  const treatment = select(predictionControls, 'Required row treatment', [['ordinary', 'Ordinary recurrence'], ['epsilon', 'Isolated zero: positive epsilon'], ['auxiliary', 'All-zero row: auxiliary derivative'], ['both', 'Both special treatments']]).field;
  const predictionFeedback = el('p', undefined, 'r-feedback'); predictionFeedback.setAttribute('role', 'status'); predictionFeedback.hidden = true; prediction.append(predictionFeedback);
  const actions = el('div', undefined, 'r-actions'); root.append(actions, error);
  function button(parent: HTMLElement, text: string, action: () => void) { const node = el('button', text); node.type = 'button'; node.addEventListener('click', () => { try { action(); } catch (reason) { showError(reason); } }, { signal }); parent.append(node); return node; }
  function showError(reason: unknown) { error.textContent = reason instanceof Error ? reason.message : 'Check the inputs.'; error.hidden = false; }
  const entry = el('fieldset'); entry.append(el('legend', 'Fill one selected entry')); entry.hidden = true; root.append(entry, result);
  const entrySelectors = el('div', undefined, 'r-controls'); entry.append(entrySelectors);
  const rowChoice = select(entrySelectors, 'Routh row', []), columnChoice = select(entrySelectors, 'Routh column', []), minorChoice = select(entrySelectors, 'Leading minor order', []);
  const target = el('p'); entry.append(target);
  const answer = createEquationInput({ label: 'Exact selected entry or finite limit', value: '', signal, onChange: next => { answerDraft = next; if (analysis) { revealed = false; entryFeedback.textContent = 'Your entry changed; check again.'; entryFeedback.hidden = false; renderOutput(); } } }); answerDraft = answer.getValue(); entry.append(answer.element);
  const limitControls = el('div', undefined, 'r-controls'); entry.append(limitControls);
  const limitKind = select(limitControls, 'Predicted epsilon limit', [['finite', 'Finite'], ['positive-infinity', 'Positive infinity'], ['negative-infinity', 'Negative infinity']]);
  const limitSide = select(limitControls, 'Sign for small positive epsilon', [['1', 'Positive'], ['-1', 'Negative'], ['0', 'Identically zero']]);
  entry.append(el('p', 'For ordinary cells and minors enter the exact value. For a symbolic epsilon cell choose its one-sided limit; when that limit is zero, also retain its sign for positive epsilon. Selecting a table cell is an alternative to the row/column controls.', 'r-small'));
  const entryActions = el('div', undefined, 'r-actions'); entry.append(entryActions);
  const entryFeedback = el('p', undefined, 'r-feedback'); entryFeedback.setAttribute('role', 'status'); entryFeedback.hidden = true; entry.append(entryFeedback);
  function expected(): RF { return !analysis ? constantRF(Z) : mode.value === 'hurwitz' ? constantRF(analysis.minors[minorOrder - 1]) : analysis.rows[selectedRow].values[selectedColumn]; }
  function syncEntry() {
    if (!analysis) return;
    const hurwitz = mode.value === 'hurwitz', value = expected(), constant = constantOf(value), limit = limitRF(value);
    rowChoice.wrap.hidden = columnChoice.wrap.hidden = hurwitz; minorChoice.wrap.hidden = !hurwitz;
    target.textContent = hurwitz ? `Selected leading minor Δ${minorOrder}: first ${minorOrder} rows and columns.` : `Selected continued cell: row s^${analysis.rows[selectedRow].power}, entry ${selectedColumn + 1}.`;
    limitKind.wrap.hidden = constant !== null; answer.element.hidden = constant === null && limitKind.field.value !== 'finite';
    limitSide.wrap.hidden = constant !== null || limitKind.field.value !== 'finite' || limit.kind !== 'finite' || limit.value.n !== 0n;
  }
  function resetEntry() { revealed = false; answer.setValue(''); answerDraft = answer.getValue(); entryFeedback.hidden = true; limitKind.field.value = 'finite'; limitSide.field.value = '1'; syncEntry(); renderOutput(); }
  function invalidate() { analysis = null; error.hidden = true; predictionFeedback.hidden = true; entry.hidden = true; coefficient.disabled = true; result.replaceChildren(); }
  function solve(grade: boolean) {
    try {
      if (draft.empty || draft.hasPlaceholders || draft.syntaxIssues.length) throw new Error('Complete the characteristic polynomial and check its visual notation.');
      const value = analyzeCoefficients(parseCharacteristic(draft.latex, readNumericInput(gain, 'K')));
      const feedback = grade ? gradeCount(value, readNumericInput(predictedCount, 'the RHP root count'), treatment.value as Treatment).message : 'Derivation revealed. Compare the exact count and detected rows with your prediction.';
      analysis = value; selectedRow = Math.min(2, value.degree); selectedColumn = 0; minorOrder = Math.min(2, value.degree); highlighted = -1;
      options(rowChoice.field, value.rows.map((row, i) => [String(i), `s^${row.power}`]), String(selectedRow));
      options(columnChoice.field, value.rows[0].values.map((_v, i) => [String(i), `Entry ${i + 1}`]), '0');
      options(minorChoice.field, value.minors.map((_v, i) => [String(i + 1), `Δ${i + 1}`]), String(minorOrder));
      options(coefficient, [['-1', 'None'], ...value.normalized.map((_v, i) => [String(i), `Coefficient of s^${i}`] as const).reverse()], '-1'); coefficient.disabled = false;
      predictionFeedback.textContent = feedback; predictionFeedback.hidden = false; error.hidden = true; entry.hidden = false; resetEntry();
    } catch (reason) { invalidate(); showError(reason); }
  }
  button(actions, 'Check count and reveal', () => solve(true)); button(actions, 'Reveal derivation', () => solve(false));
  function preset(source: string) { input.setValue(source); draft = input.getValue(); gain.value = '20'; predictedCount.value = ''; treatment.value = 'ordinary'; mode.value = 'routh'; invalidate(); }
  button(actions, 'Ordinary cubic', () => preset('P(s)=s^3+7s^2+10s+K'));
  button(actions, 'Isolated-zero pivot fixture', () => preset('P(s)=s^4+2s^3+3s^2+6s+5'));
  button(actions, 'All-zero row fixture', () => preset('P(s)=(s^2+4)(s+1)^3'));
  const advanced = el('details'); advanced.append(el('summary', 'More symmetry experiments')); const advancedActions = el('div', undefined, 'r-actions'); advanced.append(advancedActions); root.insertBefore(advanced, entry);
  button(advancedActions, 'Symmetric real roots', () => preset('P(s)=s^2-4')); button(advancedActions, 'Mixed axis and epsilon', () => preset('P(s)=(s^2+1)(s^4-s^3-1)'));
  button(entryActions, 'Check selected entry', () => {
    if (!analysis) return;
    try {
      const kind = constantOf(expected()) === null ? limitKind.field.value as EntryPrediction['kind'] : 'finite'; let value;
      if (kind === 'finite') { if (answerDraft.empty || answerDraft.hasPlaceholders || answerDraft.syntaxIssues.length) throw new Error('Complete the exact entry and its visual notation.'); value = parseAnswer(answerDraft.latex); }
      const feedback = gradeEntry(expected(), { kind, value, side: Number(limitSide.field.value) });
      entryFeedback.textContent = feedback.message; entryFeedback.hidden = false; revealed = true; renderOutput();
    } catch (reason) { entryFeedback.textContent = reason instanceof Error ? reason.message : 'Check the entry.'; entryFeedback.hidden = false; }
  });
  button(entryActions, 'Reveal selected entry', () => { if (analysis) { revealed = true; entryFeedback.textContent = 'Exact entry revealed. Follow its worked arithmetic below.'; entryFeedback.hidden = false; renderOutput(); } });
  gain.addEventListener('input', () => { invalidate(); try { const k = readNumericInput(gain, 'K'); if (Math.abs(k) > 1000) throw new Error('Choose finite K in [−1000,1000].'); } catch (reason) { showError(reason); } }, { signal });
  for (const field of [predictedCount, treatment]) field.addEventListener('input', () => { if (analysis) { predictionFeedback.textContent = 'Your count or treatment changed; check again.'; predictionFeedback.hidden = false; } }, { signal });
  mode.addEventListener('change', resetEntry, { signal });
  coefficient.addEventListener('change', () => { highlighted = Number(coefficient.value); renderOutput(); }, { signal });
  rowChoice.field.addEventListener('change', () => { selectedRow = Number(rowChoice.field.value); resetEntry(); }, { signal });
  columnChoice.field.addEventListener('change', () => { selectedColumn = Number(columnChoice.field.value); resetEntry(); }, { signal });
  minorChoice.field.addEventListener('change', () => { minorOrder = Number(minorChoice.field.value); resetEntry(); }, { signal });
  limitKind.field.addEventListener('change', () => { revealed = false; entryFeedback.textContent = 'Your limit choice changed; check again.'; entryFeedback.hidden = false; syncEntry(); renderOutput(); }, { signal });
  limitSide.field.addEventListener('change', () => { entryFeedback.textContent = 'Your limit sign changed; check again.'; entryFeedback.hidden = false; }, { signal });

  function matrixTable(parent: HTMLElement, matrix: readonly (readonly import('./algebra').Q[])[], leading = 0, powers?: readonly (readonly (number | null)[])[]) {
    const scroll = el('div', undefined, 'r-table-scroll'), table = el('table', undefined, 'r-matrix'); table.setAttribute('aria-label', 'Exact matrix entries');
    matrix.forEach((row, i) => { const tr = el('tr'); row.forEach((value, j) => { const td = el('td'); if (leading && i < leading && j < leading) td.classList.add('r-leading'); if (powers && highlighted >= 0 && powers[i][j] === highlighted) td.classList.add('r-source'); td.append(display(latexQ(value), `Row ${i + 1}, column ${j + 1}: ${textQ(value)}`)); tr.append(td); }); table.append(tr); }); scroll.append(table); parent.append(scroll);
  }
  function routhTable(parent: HTMLElement, value: Analysis, practice: boolean) {
    const scroll = el('div', undefined, 'r-table-scroll'), table = el('table'), header = el('tr'); header.append(el('th', 'Row'));
    value.rows[0].values.forEach((_v, i) => header.append(el('th', `Entry ${i + 1}`))); header.append(el('th', 'First-column limit'), el('th', 'Sign for ε>0')); table.append(header);
    value.rows.forEach((row, i) => { const tr = el('tr'); tr.append(el('th', `s^${row.power}`));
      row.values.forEach((cell, j) => { const td = el('td'), selected = practice && mode.value === 'routh' && i === selectedRow && j === selectedColumn;
        if (row.treatment === 'ordinary' && row.coefficientPowers && highlighted >= 0 && row.coefficientPowers[j] === highlighted) td.classList.add('r-source'); if (selected) td.classList.add('r-selected');
        if (practice) { const choose = button(td, '', () => { selectedRow = i; selectedColumn = j; rowChoice.field.value = String(i); columnChoice.field.value = String(j); resetEntry(); answer.focus(); }); choose.setAttribute('aria-label', `Practice row s^${row.power}, entry ${j + 1}`); choose.append(selected && !revealed ? el('span', '?') : display(latexRF(cell), `Continued Routh value at row s^${row.power}, entry ${j + 1}`)); }
        else td.append(display(latexRF(cell), `Reduced Routh value at row s^${row.power}, entry ${j + 1}`)); tr.append(td);
      });
      const limit = value.limits[i], hidden = practice && i === selectedRow && selectedColumn === 0 && !revealed;
      tr.append(el('td', hidden ? '?' : limit.kind === 'infinite' ? `${signText(limit.sign)}∞` : `${textQ(limit.value)}${!limit.value.n && limit.sign ? ` (from ${signText(limit.sign)})` : ''}`), el('td', signText(limit.sign))); table.append(tr);
    }); scroll.append(table); parent.append(scroll);
  }
  function renderOutput() {
    if (!analysis || signal.aborted) return; syncEntry(); const m = analysis; result.replaceChildren();
    result.append(el('h3', 'Normalize and count the original roots'));
    result.append(display(`P(s)=\\left(${latexQ(m.leading)}\\right)\\widehat P(s),\\quad\\widehat P(s)=${formatP(m.normalized, 's', true)}`, 'Leading-coefficient normalization'));
    result.append(el('p', `${m.right} RHP root(s), ${m.axis} on the imaginary axis, ${m.left} LHP root(s), including multiplicity. RHP means Re(s)>0; the axis means Re(s)=0.`, 'r-count'));
    result.append(el('p', m.strict ? 'Strictly Hurwitz: every root lies in the open left half-plane.' : 'Not strictly Hurwitz. Axis roots are excluded from strict stability even when there are no RHP roots.', 'r-feedback'));
    if (highlighted >= 0) result.append(el('p', `Highlighted source: coefficient of s^${highlighted} = ${textQ(m.normalized[highlighted])}. Matching direct source positions have a marked border. Continued special rows use the shown derivative or epsilon treatment; other constructed cells use the recurrence shown when selected.`));
    if (mode.value === 'routh') {
      result.append(el('h3', 'Routh table: continued values and one-sided signs')); result.append(el('p', 'Select a cell to practice it. The selected value stays hidden until checked or revealed. Always distinguish an entirely zero row from an isolated zero first entry. Values are exact; the sign of an entry whose limit is zero is taken before ε reaches zero.'));
      routhTable(result, m, true);
      result.append(el('p', m.separation ? `The full-table epsilon limit has ${m.firstColumnChanges} sign changes. Here its perturbation can move original axis roots; use the exact separation below for the original-polynomial count.` : `${m.firstColumnChanges} first-column sign change(s), hence ${m.right} RHP root(s). Axis multiplicity is checked separately; no floating epsilon is substituted.`));
      m.rows.forEach((row, i) => {
        if (row.treatment === 'ordinary') return;
        const card = el('section', undefined, 'r-special'); card.append(el('h4', `s^${row.power}: ${row.treatment === 'epsilon' ? 'isolated zero first entry' : 'all-zero row'}`));
        card.append(display(String.raw`${vector(row.original)}\quad\longrightarrow\quad${vector(row.values)}`, `Original and continued row s^${row.power}`));
        if (row.treatment === 'epsilon') card.append(el('p', 'The rest of this row is nonzero. Replace only its first entry by ε>0 and use the exact ε→0⁺ limits. A zero pivot alone does not prove an axis root.'));
        else {
          const aux = m.auxiliaries.find(a => a.row === i)!, derivative = aux.symbolic.slice(1).map((coefficient, power) => mulRF(constantRF(q(power + 1)), coefficient));
          card.append(display(`A(s)=${rfPolynomial(aux.symbolic)},\\quad A'(s)=${rfPolynomial(derivative)}`, 'Auxiliary polynomial and its derivative'));
          card.append(el('p', `${aux.epsilonFamily ? 'For sufficiently small positive ε, before its limit: ' : ''}${categoryText(aux.classification)} The roots are symmetric about the origin; symmetry can include real pairs or complex quartets.`));
          if (aux.polynomial && aux.polynomial.length === 3 && aux.polynomial[2].n) card.append(display(`s^2=-\\frac{${latexQ(aux.polynomial[0])}}{${latexQ(aux.polynomial[2])}}`, 'Squared auxiliary roots; sign distinguishes real and imaginary pairs'));
        }
        result.append(card);
      });
      if (revealed) {
        const row = m.rows[selectedRow], cell = expected(); result.append(el('h3', 'Selected cell arithmetic'));
        if (row.treatment === 'auxiliary') result.append(el('p', 'This entire row was zero. Its continued entries are coefficients of the displayed auxiliary derivative, not a division by a zero pivot.'));
        else if (row.treatment === 'epsilon' && !selectedColumn) result.append(el('p', 'This zero first entry is replaced by ε>0. Its zero limit still has a positive Routh sign.'));
        else if (selectedRow < 2) result.append(el('p', `Read the normalized coefficient of s^${row.coefficientPowers?.[selectedColumn] ?? 'padding'}; out-of-range powers contribute zero.`));
        else {
          const above = m.rows[selectedRow - 2].values, previous = m.rows[selectedRow - 1].values, zero = constantRF(Z);
          result.append(display(`r=\\frac{\\left(${latexRF(previous[0])}\\right)\\left(${latexRF(above[selectedColumn + 1] ?? zero)}\\right)-\\left(${latexRF(above[0])}\\right)\\left(${latexRF(previous[selectedColumn + 1] ?? zero)}\\right)}{${latexRF(previous[0])}}`, 'Actual source entries in the Routh recurrence'));
        }
        result.append(display(`r=${latexRF(cell)}`, 'Exact selected continued Routh entry'));
      }
    } else {
      result.append(el('h3', 'Hurwitz matrix and leading principal minors')); result.append(el('p', 'For descending normalized coefficients a₀=1,a₁,…,aₙ, matrix entry Hᵢⱼ=a₂ⱼ₋ᵢ with one-based i,j and out-of-range entries zero. Δk uses the first k rows and columns. Every Δk must be strictly positive. The marked square is the selected leading submatrix.'));
      matrixTable(result, m.matrix, minorOrder, m.matrixPowers);
      const list = el('ul'); m.minors.forEach((value, i) => list.append(el('li', `Δ${i + 1} = ${i + 1 === minorOrder && !revealed ? '?' : textQ(value)}${i + 1 === minorOrder && !revealed ? '' : signQ(value) > 0 ? ' > 0' : ' (not positive)'}`))); result.append(list);
      if (revealed) {
        const work = determinantWork(m.matrix.slice(0, minorOrder).map(row => row.slice(0, minorOrder))); result.append(el('h3', `Worked leading minor Δ${minorOrder}`));
        result.append(el('p', 'Subtracting a multiple of another row preserves the determinant; each row swap changes its sign. The resulting triangular determinant is the diagonal product.'));
        work.operations.forEach(operation => result.append(display(operation.kind === 'swap' ? `R_{${operation.first + 1}}\\leftrightarrow R_{${operation.second + 1}}` : `R_{${operation.target + 1}}\\leftarrow R_{${operation.target + 1}}-\\left(${latexQ(operation.factor)}\\right)R_{${operation.source + 1}}`, 'Exact determinant row operation')));
        matrixTable(result, work.triangular);
        result.append(work.singularColumn === null ? display(`\\Delta_{${minorOrder}}=(-1)^{${work.operations.filter(operation => operation.kind === 'swap').length}}${work.pivots.map(value => `\\left(${latexQ(value)}\\right)`).join('')}=${latexQ(work.value)}`, 'Signed product of exact determinant pivots') : el('p', `Column ${work.singularColumn + 1} has no nonzero pivot after elimination, so this determinant is exactly zero.`));
      }
    }
    if (m.separation) {
      const s = m.separation; result.append(el('h3', 'Separate original symmetric roots before epsilon counting'));
      result.append(display(`\\widehat P(s)=A(s)Q(s),\\quad A(s)=${formatP(s.factor, 's', true)},\\quad Q(s)=${formatP(s.quotient, 's', true)}`, 'Exact origin-symmetric factor and axis-free quotient'));
      result.append(el('p', `A is the exact common factor of P(s) and P(−s). ${categoryText(s.classification)} It contributes ${s.symmetricRight} RHP root(s). The axis-free Q table contributes ${s.quotientRight}; the original total is ${m.right}. The full perturbed-table count is not used as the original count.`));
      if (s.quotientRows.length) {
        const lines = el('ul'); s.quotientRows.forEach((row, i) => { const line = el('li', `Q row s^${row.power}, sign ${signText(s.quotientSigns[i])}: `); line.append(display(latexRF(row.values[0]), `Exact first entry in quotient row s^${row.power}`)); lines.append(line); }); result.append(lines);
      } else result.append(el('p', 'Q is constant and contributes no roots.'));
    }
  }
  return () => { input.destroy(); answer.destroy(); root.remove(); };
};
