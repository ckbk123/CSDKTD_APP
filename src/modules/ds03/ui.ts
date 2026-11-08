import type { ModuleMount } from '../../core/module';
import { createEquationDisplay, createEquationInput, type EquationDraft } from '../../shared/equations/input';
import { readNumericInput } from '../../shared/numeric-input';
import { analyze, BASELINE, parseFamily, stableInterval, transform, VARIANT, type Affine, type Complex, type Family } from './math';
import { createMapping } from './mapping';
import './workspace.css';

const fmt = (n: number): string => Math.abs(n) < 1e-13 ? '0' : n.toLocaleString('en-US', { useGrouping: false, maximumSignificantDigits: 7 });
function affine(a: Affine): string {
  if (a.slope === 0) return fmt(a.constant);
  const term = a.slope === 1 ? 'K' : a.slope === -1 ? '-K' : `${fmt(a.slope)}K`;
  return term + (a.constant === 0 ? '' : a.constant < 0 ? fmt(a.constant) : `+${fmt(a.constant)}`);
}
const complex = (z: Complex): string => z.im === 0 ? fmt(z.re) : `${fmt(z.re)} ${z.im < 0 ? '−' : '+'} ${fmt(Math.abs(z.im))}j`;
function intervalText(lower: number, upper: number, empty = false): string {
  if (empty) return 'No strictly stable gain';
  if (lower === -Infinity && upper === Infinity) return 'Every real K';
  return `${lower === -Infinity ? '−∞' : fmt(lower)} < K < ${upper === Infinity ? '∞' : fmt(upper)}`;
}
function inequality(a: Affine): string {
  return a.slope === 0 ? a.constant > 0 ? 'all real K' : 'no K'
    : `K ${a.slope > 0 ? '>' : '<'} ${fmt(-a.constant / a.slope)}`;
}
function node<K extends keyof HTMLElementTagNameMap>(tag: K, text?: string, className?: string): HTMLElementTagNameMap[K] {
  const n = document.createElement(tag); if (text !== undefined) n.textContent = text; if (className) n.className = className; return n;
}
function equation(latex: string, label: string): HTMLElement { return createEquationDisplay(latex, label); }

export const mountUI: ModuleMount = ({ container, signal: parent }) => {
  const life = new AbortController(), signal = life.signal;
  let disposed = false, disposeInput = () => {}, disposeMapping = () => {};
  const root = node('div', undefined, 'ds-tool'); container.append(root);
  const dispose = () => {
    if (disposed) return; disposed = true; parent.removeEventListener('abort', dispose); life.abort();
    try { disposeInput(); } finally { try { disposeMapping(); } finally { root.remove(); } }
  };
  parent.addEventListener('abort', dispose, { once: true });
  if (parent.aborted) { dispose(); return dispose; }
  try {
  const mapping = createMapping(root, signal); disposeMapping = mapping.destroy;
  const identity = node('details'); identity.append(node('summary', 'Why the disk maps to the left half-plane'),
    equation(String.raw`w=\frac{z-1}{z+1},\quad z=\frac{1+w}{1-w}`, 'Bilinear convention'),
    equation(String.raw`\operatorname{Re}w=\frac{|z|^2-1}{|z+1|^2}`, 'Disk to half-plane identity'),
    node('p', 'For z≠−1 the denominator is positive, so the sign of Re w follows |z|²−1. The unit circle maps to the imaginary axis. The inverse has a pole at w=1. Plot coordinates and displayed decimals are numerical; the formulas are algebraic identities.', 'ds-small'));
  mapping.element.append(identity);
  const exercise = node('details', undefined, 'ds-exercise'); exercise.append(node('summary', 'Characteristic polynomial and Routh exercise')); root.append(exercise);
  const intro = node('p', 'Use a bilinear substitution to turn a discrete stability question into a quadratic Routh test. Predict first, then reveal each step.');
  exercise.append(intro);
  let draft: EquationDraft, family: Family | null = null, gain = 1, step = 0, row = 0;
  let gradeCurrent = false;
  const error = node('p', undefined, 'ds-feedback'); error.setAttribute('role', 'status'); error.hidden = true;
  const result = node('section'); result.setAttribute('aria-label', 'Checked derivation');
  const input = createEquationInput({ label: 'Characteristic polynomial P(z)', value: BASELINE, signal, tools: ['fraction', 'power', 'parentheses'], onChange: next => { draft = next; invalidate(); } });
  disposeInput = input.destroy;
  exercise.append(input.element, node('p', 'Supported: monic z² + (aK+b)z + cK+d; decimals, parentheses, products and numeric fractions. Each nonzero coefficient: magnitude 10⁻⁸ to 100; up to 300 characters. Higher orders and nonlinear K terms are unsupported.', 'ds-small'));
  draft = input.getValue();
  const controls = node('div', undefined, 'ds-controls');
  function numeric(label: string, value: number, min: number, max: number, change: (v: number) => void): HTMLInputElement {
    const wrap = node('label', label); const field = node('input'); field.type = 'number'; field.value = String(value); field.min = String(min); field.max = String(max); field.step = 'any'; field.setAttribute('aria-label', label);
    field.addEventListener('input', () => {
      let next: number;
      try { next = readNumericInput(field, label); }
      catch (reason) {
        change(NaN); error.textContent = reason instanceof Error ? reason.message : 'Check the selected gain.'; error.hidden = false; return;
      }
      change(next);
    }, { signal }); wrap.append(field); controls.append(wrap); return field;
  }
  const gainField = numeric('Selected gain K (−100 to 100)', gain, -100, 100, v => { gain = v; invalidate(); });
  const predictionLabel = node('label', 'Your prediction at this K'); const prediction = node('select');
  for (const value of ['Choose a prediction', 'strictly stable', 'boundary', 'unstable']) { const option = node('option', value); option.value = value; prediction.append(option); }
  predictionLabel.append(prediction); controls.append(predictionLabel); exercise.append(controls);
  const actions = node('div', undefined, 'ds-actions');
  function button(label: string, action: () => void, parent: HTMLElement = actions): HTMLButtonElement {
    const b = node('button', label); b.type = 'button';
    b.addEventListener('click', () => {
      const hadFocus = document.activeElement === b;
      action();
      if (hadFocus && !b.isConnected) {
        const replacement = Array.from(result.querySelectorAll('button')).find(next => next.textContent === label);
        const target = replacement ?? result.querySelector('h3');
        if (target) { if (!replacement) target.tabIndex = -1; target.focus(); }
      }
    }, { signal }); parent.append(b); return b;
  }
  button('Check and reveal', () => {
    if (signal.aborted) return;
    try {
      if (draft.empty || draft.hasPlaceholders || draft.syntaxIssues.length) throw new Error('Complete the visual polynomial and check its notation first.');
      family = parseFamily(draft.latex); gain = readNumericInput(gainField, 'Selected gain K'); analyze(family, gain); gradeCurrent = true; step = 1; error.hidden = true; render();
    } catch (reason) { family = null; result.replaceChildren(); renderMap(); error.textContent = reason instanceof Error ? reason.message : 'Check the inputs.'; error.hidden = false; }
  });
  button('Try 0.1K variation', () => { input.setValue(VARIANT); draft = input.getValue(); invalidate(); input.focus(); });
  exercise.append(actions, error, result);
  root.append(node('p', 'This is a characteristic-polynomial exercise: strict stability requires every root inside the disk. Boundary roots are excluded, including repeated ones. No transfer-function cancellation, feedback topology or time-response initial condition is assumed. Formulas are algebraic identities; displayed decimals and plotted coordinates are numerical.', 'ds-small'));

  prediction.addEventListener('change', () => { gradeCurrent = false; if (family) render(); }, { signal });
  function invalidate(): void { gradeCurrent = false; family = null; step = 0; result.replaceChildren(); error.hidden = true; prediction.value = 'Choose a prediction'; renderMap(); }
  function renderMap(): void {
    if (signal.aborted) return;
    const r = family && step ? analyze(family, gain) : null; mapping.setRoots(r?.zRoots ?? [], r?.wRoots ?? []);
  }
  function render(): void {
    if (!family || signal.aborted) return;
    const r = analyze(family, gain), q = transform(family), set = stableInterval(family);
    result.replaceChildren();
    const chosen = gradeCurrent ? prediction.value : 'Choose a prediction'; const correct = chosen === r.classification || chosen === 'boundary' && r.classification.startsWith('boundary');
    const feedback = node('p', `${chosen === 'Choose a prediction' ? 'Computed check' : correct ? 'Your prediction agrees' : 'Compare your prediction'}: at K = ${fmt(gain)}, the original quadratic is ${r.classification}.`, 'ds-feedback');
    feedback.setAttribute('role', 'status'); result.append(feedback);
    result.append(node('h3', `Step ${step} of 5`));
    result.append(equation(String.raw`Q(w)=(1-w)^2P\!\left(\frac{1+w}{1-w}\right)`, 'Clear a degree-two denominator'));
    result.append(equation(`Q(w)=(1+w)^2+(${affine(family.b)})(1+w)(1-w)+(${affine(family.c)})(1-w)^2`, 'Substitution before collecting powers'));
    result.append(node('p', 'P has degree 2 in z. Multiply by (1−w)² before collecting powers of w. Q(1) = 4, so clearing denominators introduces no finite root at w = 1.'));
    if (step >= 2) {
      result.append(node('h3', 'Collect the transformed coefficients'));
      result.append(equation(`Q(w)=A(K)w^2+B(K)w+C(K)`, 'Collected polynomial'));
      ['A=1-b+c', 'B=2-2c', 'C=1+b+c'].forEach((identity, i) => result.append(equation(`${identity}=${affine(q[i])}`, `Coefficient ${'ABC'[i]}`)));
      result.append(node('p', `Here b(K) = ${affine(family.b)}, c(K) = ${affine(family.c)}. At this gain: A = ${fmt(r.abc[0])}, B = ${fmt(r.abc[1])}, C = ${fmt(r.abc[2])}.`));
    }
    if (step >= 3) {
      result.append(node('h3', 'Quadratic Routh table'));
      const table = node('table'); const head = node('tr'); ['Power', 'First column', 'Second column'].forEach(t => head.append(node('th', t))); table.append(head);
      for (let i = 0; i < 3; i++) {
        const tr = node('tr'); tr.className = i === row ? 'ds-active-row' : '';
        tr.append(node('th', `w${['²', '¹', '⁰'][i]}`), node('td', `${'ABC'[i]} = ${fmt(r.abc[i])}`), node('td', i === 0 ? `C = ${fmt(r.abc[2])}` : '0')); table.append(tr);
      }
      result.append(table);
      const rows = node('div', undefined, 'ds-actions');
      ['Inspect w² row', 'Inspect w¹ row', 'Inspect w⁰ row'].forEach((label, i) => button(label, () => { row = i; render(); }, rows)); result.append(rows);
      const explanations = ['Start with even powers: the w² row reads [A, C].', 'The odd-power row reads [B, 0]. A zero B makes this entire row zero; use the original roots and the auxiliary polynomial Aw²+C.', 'For B ≠ 0, the final entry is (B·C−A·0)/B = C. Never divide by B when it vanishes.'];
      result.append(node('p', explanations[row]));
      const specialMessage = r.special === 'degree-loss' ? 'A is zero or near zero. At exact A=0, Q loses its highest term and P(−1)=0: retain the missing z=−1 root at infinity. A constant Q can represent two such roots. Inspect the original roots below; do not classify the reduced Q as the full system.'
        : r.special === 'zero-row' ? 'B is zero or near zero. At exact B=0, the w¹ row vanishes and Q=Aw²+C is the auxiliary polynomial; its roots are symmetric. For C/A>0 they lie on the imaginary axis; for C/A<0 one is in each half-plane; for C=0 both are at w=0 (z=+1). Original z roots decide the strict-disk test.'
        : r.special === 'zero-constant' ? 'C is zero or near zero: Q has a root at or near w=0, corresponding to z=+1. This is excluded from strict stability. Check the other original root too.'
        : `Regular first column: ${r.signChanges} sign change(s), hence ${r.signChanges} right-half-plane root(s) of Q. No zero-row rule is needed.`;
      result.append(node('p', specialMessage, 'ds-feedback'));
      result.append(node('p', 'Near-zero row detection uses 10⁻⁹ times the largest transformed coefficient (at least 1). Root radii within 10⁻⁸ of 1 are reported as boundary/within tolerance; numerical uncertainty does not become a strict stability claim.', 'ds-small'));
    }
    if (step >= 4) {
      result.append(node('h3', 'Intersect strict inequalities'));
      result.append(node('p', 'For a real quadratic, Routh stability means A, B, C all have the same nonzero sign. Here A+B+C=4, so that sign must be positive. These three affine inequalities establish the complete real-gain interval.'));
      q.forEach((a, i) => result.append(node('p', `${'ABC'[i]}: ${affine(a)} > 0  ⇒  ${inequality(a)}`)));
      result.append(node('p', intervalText(set.lower, set.upper, set.empty), 'ds-answer'));
      result.append(node('p', 'All finite interval endpoints are excluded. Bounds are computed from affine coefficients in floating point (shown to 7 significant digits); this derivation is not a numerical sweep. The interval is over all real K; the selected-gain control is limited to [−100,100].'));
      const endpointActions = node('div', undefined, 'ds-actions');
      for (const [label, value] of [['lower', set.lower], ['upper', set.upper]] as const) if (!set.empty && Number.isFinite(value) && Math.abs(value) <= 100) button(`Inspect ${label} endpoint (${fmt(value)})`, () => {
        gain = value; const field = controls.querySelector('input'); if (field) field.value = String(value);
        prediction.value = 'Choose a prediction'; gradeCurrent = false; step = 5; render();
      }, endpointActions);
      result.append(endpointActions);
    }
    if (step >= 5) {
      result.append(node('h3', 'Check every original root'));
      result.append(equation(`P(z)=z^2+(${fmt(r.b)})z+(${fmt(r.c)})`, 'Original polynomial at selected gain'));
      const list = node('ul'); r.zRoots.forEach((z, i) => list.append(node('li', `z${i + 1} = ${complex(z)}, |z${i + 1}| = ${fmt(r.radius[i])}; w${i + 1} = ${r.wRoots[i] ? complex(r.wRoots[i]!) : '∞ (z = −1)'}.`))); result.append(list);
      result.append(node('p', `Transformed degree: ${Math.abs(r.abc[0]) > r.tolerance ? '2' : Math.abs(r.abc[1]) > r.tolerance ? '1 (or near degree loss)' : '0 (or near degree loss)'}. Original degree remains 2. Classification: ${r.classification}.`));
      result.append(node('p', 'Cross-check with quadratic Jury: 1+b+c > 0, 1−b+c > 0, 1−c > 0. These are C>0, A>0 and B/2>0, respectively. They give the identical strict interval.'));
    }
    const navigation = node('div', undefined, 'ds-actions');
    if (step > 1) button('Previous step', () => { step--; render(); }, navigation);
    if (step < 5) button('Next derivation step', () => { step++; render(); }, navigation);
    if (step < 5) button('Reveal all steps', () => { step = 5; render(); }, navigation);
    result.append(navigation); renderMap();
  }
  renderMap();
  return dispose;
  } catch (reason) { dispose(); throw reason; }
};
