import type { ModuleMount } from '../../core/module';
import type { EquationDraft, EquationInput } from '../../shared/equations/input';
import { chainLength, classify, copies, locate, parsePole, radius, realDimension, realization, samples, validateModel, type Mode, type Structure } from './math';
import './workspace.css';

const structures: readonly [Structure, string][] = [
  ['simple', 'Simple mode'], ['independent', 'Two independent copies'],
  ['jordan2', 'Jordan chain, length 2'], ['jordan3', 'Jordan chain, length 3'],
];
const verdicts = { decays: 'All free responses decay to zero', bounded: 'All free responses bounded; some do not decay', grows: 'Some free responses grow without bound', uncertain: 'Too close to the unit circle to certify' } as const;
const biboText = { stable: 'BIBO stable', unstable: 'Not BIBO stable', uncertain: 'BIBO stability not certified' } as const;
const locationText = { inside: 'Inside', outside: 'Outside', boundary: 'On circle at working precision', 'near-boundary': 'Within rounding band' } as const;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, text?: string, className?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag); if (text !== undefined) node.textContent = text; if (className) node.className = className; return node;
}
function number(value: number): string { return Object.is(value, -0) ? '0' : Number(value.toPrecision(14)).toString(); }
function tex(value: number): string { return number(value).replace(/e([+-]?\d+)/, '\\times 10^{$1}'); }
function poleTex(p: Mode['pole']): string {
  if (!p.im) return tex(p.re);
  return `${tex(p.re)}${p.im < 0 ? '-' : '+'}${tex(Math.abs(p.im))}\\mathrm{j}`;
}
function tfTerm(mode: Mode): string {
  const m = chainLength(mode.structure), count = copies(mode.structure);
  const fraction = (im: number) => `\\frac{${count}}{(z-(${poleTex({ re: mode.pole.re, im })}))^{${m}}}`;
  return mode.pole.im ? `\\frac{1}{2}\\left(${fraction(mode.pole.im)}+${fraction(-mode.pole.im)}\\right)` : fraction(0);
}
function matrix(rows: readonly (readonly number[])[]): string { return `\\begin{bmatrix}${rows.map(row => row.map(tex).join('&')).join('\\\\')}\\end{bmatrix}`; }

function svgNode<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>, text?: string): SVGElementTagNameMap[K] {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  if (text !== undefined) node.textContent = text;
  return node;
}
function plane(modes: readonly Mode[], selected: number): HTMLElement {
  const figure = el('figure');
  const svg = svgNode('svg', { viewBox: '0 0 400 340', role: 'img', 'aria-label': 'All eigenvalues in the z plane, with the unit circle' });
  const x = (v: number) => 200 + v * 64, y = (v: number) => 162 - v * 64;
  svg.append(svgNode('line', { x1: 36, y1: 162, x2: 364, y2: 162, stroke: 'var(--line)' }), svgNode('line', { x1: 200, y1: 22, x2: 200, y2: 302, stroke: 'var(--line)' }), svgNode('circle', { cx: 200, cy: 162, r: 64, fill: 'none', stroke: 'var(--muted)', 'stroke-dasharray': '4 4' }));
  for (const v of [-2, -1, 0, 1, 2]) {
    svg.append(svgNode('text', { x: x(v), y: 179, 'text-anchor': 'middle' }, String(v)));
    if (v) svg.append(svgNode('text', { x: 211, y: y(v) + 4 }, String(v)));
  }
  svg.append(svgNode('text', { x: 325, y: 199 }, 'Re(z)'), svgNode('text', { x: 215, y: 25 }, 'Im(z)'), svgNode('text', { x: 240, y: 101 }, '|z| = 1'));
  modes.forEach((mode, index) => {
    const ims = mode.pole.im ? [mode.pole.im, -mode.pole.im] : [0];
    for (const im of ims) {
      const cx = x(mode.pole.re), cy = y(im), stroke = index === selected ? 'var(--accent)' : 'var(--text)';
      svg.append(svgNode('path', { d: `M${cx - 5},${cy - 5}l10,10m-10,0l10,-10`, stroke, 'stroke-width': index === selected ? 3 : 2 }));
      if (!mode.visible) svg.append(svgNode('circle', { cx, cy, r: 10, fill: 'none', stroke, 'stroke-dasharray': '2 2' }));
      svg.append(svgNode('text', { x: cx + 9, y: cy - 10 }, String(index + 1)));
    }
  });
  figure.append(svg, el('figcaption', '× eigenvalue; row number identifies the pole. A dashed ring marks an output-hidden mode. Complex rows include both conjugates.'));
  return figure;
}
function sequence(mode: Mode, period: number, horizon: number): HTMLElement {
  const data = samples(mode, period, horizon), figure = el('figure');
  const svg = svgNode('svg', { viewBox: '0 0 480 340', role: 'img', 'aria-label': 'Free response: first coordinate as stems, state norm as a dashed line' });
  const minimum = Math.min(0, ...data.map(s => s.first)), maximum = Math.max(1, ...data.map(s => s.norm));
  const bottom = minimum < 0 ? minimum * 1.1 : -.08 * maximum, top = maximum * 1.1;
  const x = (k: number) => 65 + k / horizon * 385, y = (v: number) => 290 - (v - bottom) / (top - bottom) * 245;
  svg.append(svgNode('line', { x1: 65, y1: y(0), x2: 450, y2: y(0), stroke: 'var(--line)' }), svgNode('line', { x1: 65, y1: 35, x2: 65, y2: 290, stroke: 'var(--line)' }));
  for (const k of [0, Math.floor(horizon / 2), horizon]) svg.append(svgNode('text', { x: x(k), y: 310, 'text-anchor': 'middle' }, String(k)));
  for (const value of [0, maximum, ...(minimum < 0 ? [minimum] : [])]) svg.append(svgNode('text', { x: 59, y: y(value) + 4, 'text-anchor': 'end' }, Number(value.toPrecision(3)).toString()));
  svg.append(svgNode('text', { x: 72, y: 22 }, 'State amplitude / norm (unit initial norm)'), svgNode('text', { x: 290, y: 330 }, 'k (samples); t = kT seconds'));
  for (const s of data) svg.append(svgNode('line', { x1: x(s.k), y1: y(0), x2: x(s.k), y2: y(s.first), stroke: 'var(--accent)', 'stroke-width': 1.5 }), svgNode('circle', { cx: x(s.k), cy: y(s.first), r: 2.4, fill: 'var(--accent)' }));
  svg.append(svgNode('polyline', { points: data.map(s => `${x(s.k)},${y(s.norm)}`).join(' '), fill: 'none', stroke: 'var(--text)', 'stroke-dasharray': '5 4', 'stroke-width': 2 }));
  figure.append(svg, el('figcaption', 'Indigo stems: first real state coordinate. Dashed line: full state norm of one representative block. These are free-response samples, with input zero; a finite plot alone does not prove stability.'));
  return figure;
}

type Equations = typeof import('../../shared/equations/input');

// The public mount stays synchronous. Load browser-only MathLive after mounting,
// not when the catalogue checks workspace exports in Node. Never mount after abort.
export const mount: ModuleMount = context => {
  if (context.signal.aborted) return;
  let cleanup: ReturnType<ModuleMount>;
  let disposed = false;
  const loading = el('p', 'Loading equation controls…'); context.container.append(loading);
  void import('../../shared/equations/input').then(equations => {
    if (context.signal.aborted || disposed) return;
    loading.remove(); cleanup = mountExercise(context, equations);
  }).catch(() => {
    if (!context.signal.aborted && !disposed) loading.textContent = 'Equation controls could not load. Reset the tool to try again.';
  });
  return () => { disposed = true; loading.remove(); cleanup?.(); };
};

const mountExercise = ({ container, signal }: Parameters<ModuleMount>[0], { createEquationInput, createEquationDisplay }: Equations): ReturnType<ModuleMount> => {
  const root = el('div', undefined, 'ds01');
  const inputCard = el('section', undefined, 'ds-card');
  inputCard.append(el('h2', '1. Choose poles and predict stability'), el('p', 'Stability in discrete time depends on distance from the origin. Compare decay, persistent oscillation and growth, then test whether an output can hide an internal mode.'));
  const controls = el('div', undefined, 'ds-controls');
  function numeric(label: string, value: string, min: string, max: string, step: string): HTMLInputElement {
    const wrapper = el('label', label), input = el('input'); input.type = 'number'; input.value = value; input.min = min; input.max = max; input.step = step; wrapper.append(input); controls.append(wrapper); return input;
  }
  const periodInput = numeric('Sample period T (s)', '0.1', '0.001', '10', '0.001');
  const horizonInput = numeric('Last sample k', '20', '4', '80', '1');
  const experimentLabel = el('label', 'Changed-data experiment'), experiment = el('select');
  for (const [value, text] of [['baseline', '0.8 and −0.8 (baseline)'], ['plus', '+1: persistent mode'], ['minus', '−1: alternating boundary'], ['independent', '+1 repeated independently'], ['jordan2', '+1 in a length-2 chain'], ['jordan3', '−1 in a length-3 chain'], ['hidden', 'Hide an unstable 1.2 mode'], ['complex', '0.6 ± 0.8j on the circle']]) experiment.append(new Option(text, value));
  experimentLabel.append(experiment); controls.append(experimentLabel);
  const load = el('button', 'Load experiment'); load.type = 'button'; controls.append(load);
  inputCard.append(controls);
  const rowsHost = el('div'); inputCard.append(rowsHost);
  const actions = el('div', undefined, 'ds-controls'), add = el('button', 'Add pole'), remove = el('button', 'Remove last pole');
  add.type = remove.type = 'button'; actions.append(add, remove); inputCard.append(actions);
  inputCard.append(el('p', 'Each complex row includes its conjugate, so the system remains real. Enter a decimal or numeric fraction, with optional imaginary part (for example 0.6 + 0.8j). Radius ≤ 2; at most four distinct rows. Repetition belongs in the structure control.', 'ds-muted'));
  const predictionLabel = el('label', 'Prediction for the full internal state'), prediction = el('select');
  prediction.append(new Option('Choose a prediction (optional)', ''));
  for (const [value, text] of Object.entries(verdicts)) prediction.append(new Option(text, value));
  predictionLabel.append(prediction);
  const reveal = el('button', 'Reveal and check', 'ds-primary'); reveal.type = 'button';
  const revealControls = el('div', undefined, 'ds-controls'); revealControls.append(predictionLabel, reveal); inputCard.append(revealControls);
  const feedback = el('p', 'Predict first, then reveal the calculated result.', 'ds-feedback'); feedback.setAttribute('role', 'status'); inputCard.append(feedback);
  const results = el('div', undefined, 'ds-results'); results.hidden = true;
  root.append(inputCard, results); container.append(root);
  interface Row { input: EquationInput; draft: EquationDraft; structure: HTMLSelectElement; visible: HTMLInputElement; radio: HTMLInputElement; destroy: () => void }
  const rows: Row[] = [];
  let selected = 0, revealed = false;
  function invalidate(): void {
    if (signal.aborted) return;
    revealed = false; results.hidden = true; results.replaceChildren();
    feedback.textContent = 'Inputs changed. Predict, then reveal again.';
  }
  function appendRow(value: string, structureValue: Structure = 'simple', visibleValue = true): void {
    const index = rows.length, wrapper = el('div', undefined, 'ds-row');
    const listeners = new AbortController();
    const input = createEquationInput({ label: `Pole ${index + 1} (a + bj)`, value, signal, onChange: draft => { rows[index].draft = draft; invalidate(); } });
    const options = el('div', undefined, 'ds-row-options'), structureLabel = el('label', `Structure for pole ${index + 1}`), structure = el('select');
    for (const [id, text] of structures) structure.append(new Option(text, id)); structure.value = structureValue; structureLabel.append(structure);
    const visibleLabel = el('label', undefined, 'ds-inline'), visible = el('input'); visible.type = 'checkbox'; visible.checked = visibleValue; visibleLabel.append(visible, document.createTextNode(`Pole ${index + 1} contributes to the output`));
    const radioLabel = el('label', undefined, 'ds-inline'), radio = el('input'); radio.type = 'radio'; radio.name = 'ds01-selected-pole'; radio.checked = index === selected; radioLabel.append(radio, document.createTextNode(`Inspect pole ${index + 1}`));
    options.append(structureLabel, visibleLabel, radioLabel); wrapper.append(input.element, options); rowsHost.append(wrapper);
    const destroy = () => { listeners.abort(); signal.removeEventListener('abort', destroy); input.destroy(); wrapper.remove(); };
    signal.addEventListener('abort', destroy, { once: true });
    rows.push({ input, draft: input.getValue(), structure, visible, radio, destroy });
    structure.addEventListener('change', invalidate, { signal: listeners.signal }); visible.addEventListener('change', invalidate, { signal: listeners.signal });
    radio.addEventListener('change', () => { selected = index; if (revealed) show(); }, { signal: listeners.signal });
    add.disabled = rows.length >= 4; remove.disabled = rows.length <= 1;
  }
  function model(): Mode[] {
    return rows.map((row, index) => {
      row.draft = row.input.getValue();
      if (row.draft.empty || row.draft.hasPlaceholders || row.draft.syntaxIssues.length) throw new Error(`Pole ${index + 1}: complete the numeric pole and check its notation.`);
      try { return { pole: parsePole(row.draft.latex), structure: row.structure.value as Structure, visible: row.visible.checked }; }
      catch (error) { throw new Error(`Pole ${index + 1}: ${(error as Error).message}`); }
    });
  }
  function show(): void {
    if (signal.aborted) return;
    try {
      const modes = model();
      const period = periodInput.value.trim() ? Number(periodInput.value) : NaN, horizon = horizonInput.value.trim() ? Number(horizonInput.value) : NaN;
      validateModel(modes, period, horizon);
      const verdict = classify(modes), mode = modes[selected], m = chainLength(mode.structure), r = radius(mode.pole), data = samples(mode, period, horizon);
      feedback.textContent = prediction.value ? `${prediction.value === verdict.internal ? 'Your prediction matches.' : 'Compare your prediction with the result.'} ${verdicts[verdict.internal]}.` : `Calculated: ${verdicts[verdict.internal]}.`;
      const summary = el('section', undefined, 'ds-card'); summary.append(el('h2', '2. Compare the two stability questions'), el('h3', `Internal state: ${verdicts[verdict.internal]}`), el('p', 'Asymptotic stability means every free response tends to zero. Bounded free response also permits persistent modes on the unit circle, provided every boundary eigenvalue is semisimple (independent copies).'), el('h3', `Visible channel: ${biboText[verdict.bibo]}`), el('p', 'BIBO means every bounded input produces a bounded output from zero initial state. An uncancelled pole on the unit circle fails this test, even if free responses stay bounded. Output-hidden modes still count for internal stability.'));
      const active = modes.filter(item => item.visible);
      summary.append(createEquationDisplay(`G(z)=${active.length ? active.map(tfTerm).join('+') : '0'}`, 'Reduced zero-state input/output transfer function'));
      summary.append(el('p', `The visible channel is the sum of the displayed terms. Hidden blocks have C = 0, so their factors disappear from G(z). The full real realization still has ${realDimension(modes)} states. No pole is discarded from the internal-state verdict.`, 'ds-muted'));
      const scroll = el('div', undefined, 'ds-scroll'), table = el('table'), head = el('tr');
      for (const text of ['Pole row', 'Radius |z|', 'Angle (rad/sample)', 'Disk location', 'Output']) head.append(el('th', text));
      const thead = el('thead'); thead.append(head); const tbody = el('tbody');
      modes.forEach((item, index) => { const tr = el('tr', undefined, index === selected ? 'ds-selected' : '');
        for (const text of [String(index + 1), number(radius(item.pole)), radius(item.pole) === 0 ? 'Undefined at zero' : number(Math.atan2(item.pole.im, item.pole.re)), locationText[locate(item.pole)], item.visible ? 'Visible' : 'Hidden']) tr.append(el('td', text)); tbody.append(tr); });
      table.append(thead, tbody); scroll.append(table); summary.append(scroll, el('p', 'Numerical guard: radii within 10⁻⁹ of 1, but not equal to 1 at working precision, are reported as uncertified. Exact boundary examples use ±1 or the 0.6 ± 0.8j pair. These are numerical calculations, not symbolic certificates.', 'ds-muted'));
      const plots = el('section', undefined, 'ds-card'); plots.append(el('h2', `3. Inspect pole ${selected + 1}`));
      const grid = el('div', undefined, 'ds-plots'); grid.append(plane(modes, selected), sequence(mode, period, horizon)); plots.append(grid);
      const reasoning = el('section', undefined, 'ds-card'); reasoning.append(el('h2', '4. Read the modal argument'));
      reasoning.append(createEquationDisplay(`p=${poleTex(mode.pole)},\\quad r=\\sqrt{(${tex(mode.pole.re)})^2+(${tex(mode.pole.im)})^2}=${tex(r)}`, 'Selected pole and radius'));
      if (r === 0) reasoning.append(el('p', `A zero pole has no defined angle. Its simple mode is 1 at k = 0 and zero thereafter. A length-${m} zero Jordan block is nilpotent: every state is zero after ${m} samples.`));
      else reasoning.append(createEquationDisplay(`\\theta=\\operatorname{atan2}(${tex(mode.pole.im)},${tex(mode.pole.re)})=${tex(Math.atan2(mode.pole.im, mode.pole.re))},\\quad p^k=r^k e^{\\mathrm{j}k\\theta}`, 'Radius controls decay and angle controls oscillation'));
      reasoning.append(el('p', 'Angle is measured in radians per sample; t = kT seconds. A negative real pole alternates sign. Complex pairs rotate while their radius controls the envelope. Changing T changes the time labels, not the sequence for a fixed z pole.'));
      reasoning.append(createEquationDisplay(`J_m(p)=pI+N,\\quad J_m(p)^k e_m=\\sum_{\\ell=0}^{\\min(k,m-1)}\\binom{k}{\\ell}p^{k-\\ell}e_{m-\\ell}`, 'Jordan power with unit superdiagonal'));
      reasoning.append(createEquationDisplay(`m=${m},\\quad x_1[k]=${m === 1 ? '\\operatorname{Re}(p^k)' : `\\binom{k}{${m - 1}}\\operatorname{Re}(p^{k-${m - 1}}),\\ k\\ge ${m - 1}`}`, 'Selected first-coordinate free response'));
      reasoning.append(el('p', m === 1 ? 'A simple block has norm r^k. Two independent copies have the same behavior: repetition alone creates no polynomial growth.' : `A length-${m} chain includes a polynomial factor of degree ${m - 1}. At |p| = 1 this gives an unbounded free response. Inside the circle, exponential decay eventually dominates the polynomial; an early rise does not imply instability. Before k = ${m - 1}, the plotted first coordinate is zero.`));
      reasoning.append(el('p', `The plot uses one representative block, u[k] = 0 and unit initial state in the last scalar coordinate (or the real coordinate of the last complex pair). It runs through k = ${horizon}, t = ${number(period * horizon)} s. Other initial states can give different traces; the verdict concerns all initial states.`));
      const detail = el('details'), detailTitle = el('summary', 'Inspect the explicit real state block and channel convention'); detail.append(detailTitle);
      const state = realization(mode);
      detail.append(createEquationDisplay(`x[k+1]=Ax[k]+Bu[k],\\quad y[k]=Cx[k],\\quad D=0`, 'Discrete SISO state convention'));
      detail.append(createEquationDisplay(`A_{${selected + 1}}=${matrix(state.a)},\\quad B_{${selected + 1}}=${matrix(state.b.map(v => [v]))}`, 'Selected real A and B blocks'));
      detail.append(createEquationDisplay(`C_{${selected + 1}}=${matrix([state.c])}`, 'Selected real C block'));
      detail.append(el('p', 'The full A is block diagonal; B stacks the row inputs and C concatenates their output rows. Complex rows use 2 × 2 real rotation blocks with identity superdiagonal blocks. Two independent copies use two separate blocks. No feedback loop is assumed. G(z) describes zero initial state; free-response plots use the stated nonzero initial state.'));
      reasoning.append(detail);
      const sampleDetails = el('details'); sampleDetails.append(el('summary', 'Check the computed sample table'));
      const sampleScroll = el('div', undefined, 'ds-samples ds-scroll'), sampleTable = el('table'), sampleHead = el('thead'), sampleTr = el('tr');
      for (const text of ['k', 't (s)', 'Re(p^k)', 'First coordinate', 'State norm']) sampleTr.append(el('th', text)); sampleHead.append(sampleTr);
      const sampleBody = el('tbody'); for (const sample of data) { const tr = el('tr'); for (const value of [sample.k, sample.t, sample.basic, sample.first, sample.norm]) tr.append(el('td', number(value))); sampleBody.append(tr); }
      sampleTable.append(sampleHead, sampleBody); sampleScroll.append(sampleTable); sampleDetails.append(sampleScroll); reasoning.append(sampleDetails);
      results.replaceChildren(summary, plots, reasoning); results.hidden = false; revealed = true;
    } catch (error) { results.hidden = true; results.replaceChildren(); revealed = false; feedback.textContent = (error as Error).message; }
  }
  add.addEventListener('click', () => { if (rows.length < 4) { appendRow('0'); invalidate(); } }, { signal });
  remove.addEventListener('click', () => {
    if (rows.length <= 1) return;
    rows.pop()!.destroy(); selected = Math.min(selected, rows.length - 1); rows[selected].radio.checked = true; add.disabled = false; remove.disabled = rows.length <= 1; invalidate();
  }, { signal });
  load.addEventListener('click', () => {
    for (const row of rows) row.destroy(); rows.length = 0; rowsHost.replaceChildren(); selected = 0; prediction.value = '';
    switch (experiment.value) {
      case 'plus': appendRow('1'); break;
      case 'minus': appendRow('-1'); break;
      case 'independent': appendRow('1', 'independent'); break;
      case 'jordan2': appendRow('1', 'jordan2'); break;
      case 'jordan3': appendRow('-1', 'jordan3'); break;
      case 'hidden': appendRow('0.8'); appendRow('1.2', 'simple', false); selected = 1; rows[1].radio.checked = true; break;
      case 'complex': appendRow('0.6+0.8\\mathrm{j}'); break;
      default: appendRow('0.8'); appendRow('-0.8');
    }
    invalidate();
  }, { signal });
  periodInput.addEventListener('input', invalidate, { signal }); horizonInput.addEventListener('input', invalidate, { signal });
  reveal.addEventListener('click', show, { signal });
  prediction.addEventListener('change', () => { if (revealed) show(); }, { signal });
  appendRow('0.8'); appendRow('-0.8');
  return () => { for (const row of rows) row.destroy(); root.remove(); };
};
