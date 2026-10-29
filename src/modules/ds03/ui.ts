import type { ModuleMount } from '../../core/module';
import { createEquationDisplay, createEquationInput, type EquationDraft } from '../../shared/equations/input';
import { analyze, BASELINE, mapToW, parseFamily, stableInterval, transform, VARIANT, type Affine, type Complex, type Family } from './math';
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

/** A sampled visual only; roots, identities and the gain interval are computed separately. */
function plane(title: string, isW: boolean, points: readonly (Complex | null)[], selected: Complex | null): HTMLElement {
  const figure = node('figure'); const caption = node('figcaption', title); figure.append(caption);
  const ns = 'http://www.w3.org/2000/svg'; const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 360 300'); svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', title);
  const extent = Math.min(10, Math.max(1.5, ...[...points, selected].filter((p): p is Complex => p !== null).map(p => Math.max(Math.abs(p.re), Math.abs(p.im)) * 1.2)));
  const scale = 112 / extent, x = (v: number) => 180 + v * scale, y = (v: number) => 146 - v * scale;
  function shape(tag: string, attrs: Record<string, string | number>, text?: string): void {
    const s = document.createElementNS(ns, tag); for (const [k, v] of Object.entries(attrs)) s.setAttribute(k, String(v)); if (text) s.textContent = text; svg.append(s);
  }
  if (isW) shape('rect', { x: 38, y: 20, width: 142, height: 252, class: 'ds-region' });
  else shape('circle', { cx: 180, cy: 146, r: scale, class: 'ds-region' });
  shape('line', { x1: 38, x2: 325, y1: 146, y2: 146, class: 'ds-axis' });
  shape('line', { x1: 180, x2: 180, y1: 20, y2: 272, class: 'ds-axis' });
  shape('text', { x: 285, y: 139 }, isW ? 'Re w' : 'Re z'); shape('text', { x: 187, y: 25 }, isW ? 'Im w' : 'Im z');
  shape('text', { x: 45, y: 289 }, `Ticks: ±${fmt(extent)}; dimensionless`);
  for (const tick of [-extent, extent]) {
    shape('line', { x1: x(tick), x2: x(tick), y1: 142, y2: 150, class: 'ds-axis' });
    shape('text', { x: x(tick), y: 164, 'text-anchor': 'middle' }, fmt(tick));
    shape('line', { x1: 176, x2: 184, y1: y(tick), y2: y(tick), class: 'ds-axis' });
  }
  if (!isW) { shape('text', { x: x(-1) - 15, y: 177 }, '−1'); shape('text', { x: x(1), y: 177 }, '+1'); }
  let hidden = 0;
  points.forEach(p => {
    if (!p || Math.abs(p.re) > extent || Math.abs(p.im) > extent) { hidden++; return; }
    const px = x(p.re), py = y(p.im);
    shape('path', { d: `M${px - 5},${py - 5}l10,10m0,-10l-10,10`, class: 'ds-root' });
  });
  if (selected && Math.abs(selected.re) <= extent && Math.abs(selected.im) <= extent) shape('circle', { cx: x(selected.re), cy: y(selected.im), r: 6, class: 'ds-selected' });
  else if (selected) hidden++;
  figure.append(svg, node('p', `${isW ? 'Tint: Re w < 0.' : 'Tint: |z| < 1.'} ○ selected point; × roots.${hidden ? ` ${hidden} point(s) at infinity or outside this view; see numeric values.` : ''}`, 'ds-small'));
  return figure;
}

export const mountUI: ModuleMount = ({ container, signal }) => {
  const root = node('div', undefined, 'ds-tool'); container.append(root);
  const intro = node('p', 'Use a bilinear substitution to turn a discrete stability question into a quadratic Routh test. Predict first, then reveal each step.');
  root.append(intro);
  let draft: EquationDraft, family: Family | null = null, gain = 1, step = 0, row = 0;
  let point: Complex = { re: 0, im: 1 };
  const error = node('p', undefined, 'ds-feedback'); error.setAttribute('role', 'status'); error.hidden = true;
  const result = node('section'); result.setAttribute('aria-label', 'Checked derivation');
  const input = createEquationInput({ label: 'Characteristic polynomial P(z)', value: BASELINE, signal, onChange: next => { draft = next; invalidate(); } });
  root.append(input.element, node('p', 'Supported: monic z² + (aK+b)z + cK+d; decimals, parentheses, products and numeric fractions. Each nonzero coefficient: magnitude 10⁻⁸ to 100; up to 300 characters. Higher orders and nonlinear K terms are unsupported.', 'ds-small'));
  draft = input.getValue();
  const controls = node('div', undefined, 'ds-controls');
  function numeric(label: string, value: number, min: number, max: number, change: (v: number) => void): HTMLInputElement {
    const wrap = node('label', label); const field = node('input'); field.type = 'number'; field.value = String(value); field.min = String(min); field.max = String(max); field.step = 'any';
    field.addEventListener('input', () => change(field.value.trim() ? Number(field.value) : NaN), { signal }); wrap.append(field); controls.append(wrap); return field;
  }
  numeric('Selected gain K (−100 to 100)', gain, -100, 100, v => { gain = v; invalidate(); });
  const predictionLabel = node('label', 'Your prediction at this K'); const prediction = node('select');
  for (const value of ['Choose a prediction', 'strictly stable', 'boundary', 'unstable']) { const option = node('option', value); option.value = value; prediction.append(option); }
  predictionLabel.append(prediction); controls.append(predictionLabel); root.append(controls);
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
      family = parseFamily(draft.latex); analyze(family, gain); step = 1; error.hidden = true; render();
    } catch (reason) { family = null; result.replaceChildren(); renderMap(); error.textContent = reason instanceof Error ? reason.message : 'Check the inputs.'; error.hidden = false; }
  });
  button('Try 0.1K variation', () => { input.setValue(VARIANT); draft = input.getValue(); invalidate(); input.focus(); });
  root.append(actions, error, result);
  const mapping = node('section', undefined, 'ds-section'); root.append(mapping);
  mapping.append(node('h3', 'Explore the disk boundary'), equation(String.raw`w=\frac{z-1}{z+1},\quad z=\frac{1+w}{1-w}`, 'Bilinear convention'));
  mapping.append(node('p', 'Dimensionless coordinates; no 2/T scaling or sample period is used. The unit circle maps to the imaginary axis, except z = −1, which maps to infinity. The inverse has w = 1 as its pole.'));
  const mapControls = node('div', undefined, 'ds-controls'); const mapView = node('div');
  const angleLabel = node('label', 'Unit-circle angle θ (degrees)'); const angle = node('input'); angle.type = 'number'; angle.min = '0'; angle.max = '360'; angle.step = '1'; angle.value = '90';
  const slider = node('input'); slider.type = 'range'; slider.min = '0'; slider.max = '360'; slider.value = '90'; slider.setAttribute('aria-label', 'Unit-circle angle slider in degrees'); angleLabel.append(angle, slider); mapControls.append(angleLabel);
  const reLabel = node('label', 'Selected Re z (−5 to 5)'), re = node('input'); re.type = 'number'; re.min = '-5'; re.max = '5'; re.step = '.1'; re.value = '0'; reLabel.append(re); mapControls.append(reLabel);
  const imLabel = node('label', 'Selected Im z (−5 to 5)'), im = node('input'); im.type = 'number'; im.min = '-5'; im.max = '5'; im.step = '.1'; im.value = '1'; imLabel.append(im); mapControls.append(imLabel);
  const mapError = node('p'); mapError.setAttribute('role', 'status'); mapping.append(mapControls, mapError, mapView);
  function updateAngle(raw: string): void {
    const degrees = raw.trim() ? Number(raw) : NaN;
    if (!Number.isFinite(degrees) || degrees < 0 || degrees > 360) { mapError.textContent = 'Choose an angle from 0° to 360°.'; return; }
    angle.value = raw; slider.value = raw;
    point = degrees === 180 ? { re: -1, im: 0 } : { re: Math.cos(degrees * Math.PI / 180), im: Math.sin(degrees * Math.PI / 180) };
    re.value = fmt(point.re); im.value = fmt(point.im); mapError.textContent = ''; renderMap();
  }
  angle.addEventListener('input', () => updateAngle(angle.value), { signal }); slider.addEventListener('input', () => updateAngle(slider.value), { signal });
  const updatePoint = () => {
    const r = re.value.trim() ? Number(re.value) : NaN, i = im.value.trim() ? Number(im.value) : NaN;
    if (![r, i].every(v => Number.isFinite(v) && Math.abs(v) <= 5)) { mapError.textContent = 'Choose finite real and imaginary parts between −5 and 5.'; return; }
    const distance = Math.hypot(r + 1, i);
    if (distance !== 0 && distance < 1e-8) { mapError.textContent = 'This point is too close to the mapping pole. Choose z = −1 exactly, or a point at least 10⁻⁸ away.'; return; }
    point = { re: r, im: i }; mapError.textContent = ''; renderMap();
  };
  re.addEventListener('input', updatePoint, { signal }); im.addEventListener('input', updatePoint, { signal });
  mapping.append(equation(String.raw`\operatorname{Re}w=\frac{|z|^2-1}{|z+1|^2}`, 'Disk to half-plane identity'));
  root.append(node('p', 'This is a characteristic-polynomial exercise: strict stability requires every root inside the disk. Boundary roots are excluded, including repeated ones. No transfer-function cancellation, feedback topology or time-response initial condition is assumed. Formulas are algebraic identities; displayed decimals and plotted coordinates are numerical.', 'ds-small'));

  function invalidate(): void { family = null; step = 0; result.replaceChildren(); error.hidden = true; prediction.value = 'Choose a prediction'; renderMap(); }
  function renderMap(): void {
    if (signal.aborted) return;
    const w = mapToW(point); const r = family && step ? analyze(family, gain) : null;
    const pair = node('div', undefined, 'ds-planes'); pair.append(plane('z plane · unit disk', false, r?.zRoots ?? [], point), plane('w plane · left half-plane', true, r?.wRoots ?? [], w));
    const readout = node('p', `Selected z = ${complex(point)}; |z| = ${fmt(Math.hypot(point.re, point.im))}. ${w ? `w = ${complex(w)}.` : 'w is at infinity: z = −1 is the mapping pole.'}`);
    mapView.replaceChildren(pair, readout);
  }
  function render(): void {
    if (!family || signal.aborted) return;
    const r = analyze(family, gain), q = transform(family), set = stableInterval(family);
    result.replaceChildren();
    const chosen = prediction.value; const correct = chosen === r.classification || chosen === 'boundary' && r.classification.startsWith('boundary');
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
        gain = value; const field = controls.querySelector('input'); if (field) field.value = String(value); step = 5; render();
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
  return () => { input.destroy(); root.remove(); };
};
