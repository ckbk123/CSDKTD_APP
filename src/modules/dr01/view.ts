import type { ModuleMount } from '../../core/module';
import { createEquationDisplay, createEquationInput, type EquationDraft } from '../../shared/equations/input';
import { format, fromSequence, initialNumerator, numberLatex, parseTransform, poles, polynomial, samples, transformLatex, type Sample, type SequenceKind, type Transform } from './math';
import './workspace.css';

export const mountView: ModuleMount = ({ container, signal }) => {
  const el = <K extends keyof HTMLElementTagNameMap>(tag: K, text = '', className = '') => {
    const node = document.createElement(tag); node.textContent = text; node.className = className; return node;
  };
  const root = el('div', '', 'dr01-tool');
  container.append(root);
  const listen = (node: EventTarget, event: string, action: () => void) => node.addEventListener(event, action, { signal });
  const button = (text: string, action: () => void) => {
    const node = el('button', text); node.type = 'button'; listen(node, 'click', action); return node;
  };
  const numeric = (label: string, value: string, step = 'any') => {
    const wrapper = el('label', label, 'dr01-field');
    const input = el('input'); input.type = 'number'; input.value = value; input.step = step;
    wrapper.append(input); return { wrapper, input };
  };
  const read = (input: HTMLInputElement, name: string): number => {
    if (!input.value.trim() || !Number.isFinite(input.valueAsNumber)) throw new Error(`Enter a finite ${name}.`);
    if (input.valueAsNumber === 0 && /[1-9]/.test(input.value.trim().split(/[eE]/)[0])) throw new Error(`${name} is nonzero but too small for numeric entry. Use zero intentionally or a representable nonzero number.`);
    return input.valueAsNumber;
  };
  root.append(el('h2', 'Identify a sequence from its transform'), el('p', 'Predict the first samples, then reveal the causal inverse. Edit the fraction directly or build it from a sequence.'));
  const limits = el('details', '', 'dr01-card');
  limits.append(el('summary', 'Conventions and supported inputs'), el('p', 'Real rational expressions in z, or q = z⁻¹. Sums, products, fractions and integer powers are supported. After removing common delay factors: denominator order ≤ 2, numerator delay order ≤ 14; 4–64 samples. No automatic pole/zero cancellation. Coefficients have magnitude ≤ 10⁶; displayed samples ≤ 10¹².'));
  limits.append(el('p', 'The default is the unilateral transform X₊(z) = Σ from k=0 to ∞ of x[k]z⁻ᵏ, with a causal, zero-history sequence. T only labels physical time; it does not change the transform. Initial history is separate from the entered zero-history expression X₀(z). No feedback loop is assumed. Numeric results use floating-point arithmetic, rounded to 7 significant digits.'));
  limits.append(el('p', 'In the visual equation, use decimals or ×10ⁿ for powers of ten. The letters e/E are not exponent notation there. Ordinary number controls accept standard numeric entry separately.'));
  limits.append(el('p', 'Write mixed numbers with an explicit +, such as 2 + 1/2. Put × between a number and a fraction when you intend multiplication.'));
  root.append(limits);
  let draft: EquationDraft;
  const error = el('p', '', 'dr01-message'); error.setAttribute('role', 'status'); error.hidden = true;
  const results = el('section', '', 'dr01-results'); results.hidden = true;
  const invalidate = () => {
    results.hidden = true; error.hidden = false; error.textContent = 'Inputs changed. Predict again, then reveal the checked sequence.';
  };
  const equation = createEquationInput({ label: 'Zero-history transform X₀(z)', value: String.raw`\frac{z}{z-0.8}`, signal, onChange: value => { draft = value; invalidate(); } });
  root.append(equation.element); draft = equation.getValue();

  const builder = el('details', '', 'dr01-card'); builder.append(el('summary', 'Build from a sequence'));
  const builderGrid = el('div', '', 'dr01-grid');
  const kindLabel = el('label', 'Sequence family', 'dr01-field'); const kind = el('select');
  for (const [value, text] of [['geometric', 'Delayed geometric'], ['sum', 'Finite moving sum'], ['average', 'Finite moving average']]) {
    const option = el('option', text); option.value = value; kind.append(option);
  }
  kindLabel.append(kind);
  const gain = numeric('Gain c', '1'), pole = numeric('Geometric pole a', '0.8'), delay = numeric('Delay d (samples)', '0', '1'), length = numeric('Finite length L (samples)', '4', '1');
  delay.input.min = '0'; delay.input.max = '12'; length.input.min = '1'; length.input.max = '12';
  builderGrid.append(kindLabel, gain.wrapper, pole.wrapper, delay.wrapper, length.wrapper);
  const builderNote = el('p');
  const familyDescription = () => {
    const geometric = kind.value === 'geometric'; pole.input.disabled = !geometric; length.input.disabled = geometric;
    builderNote.textContent = geometric ? 'x₀[k] = c a^(k−d) for k ≥ d; zero for k < d. A delay shifts the entire zero-extended sequence.' : kind.value === 'sum' ? 'x₀[k] = c for d ≤ k < d+L; zero elsewhere. Each of the L taps has weight c.' : 'x₀[k] = c/L for d ≤ k < d+L; zero elsewhere. The L tap weights sum to c.';
  };
  familyDescription(); listen(kind, 'change', familyDescription);
  builder.append(builderGrid, builderNote, button('Build transform', () => {
    try {
      const model = fromSequence(kind.value as SequenceKind, read(gain.input, 'gain'), read(pole.input, 'pole'), read(delay.input, 'delay'), read(length.input, 'length'));
      equation.setValue(transformLatex(model, 'q', true)); draft = equation.getValue(); invalidate();
      error.textContent = 'Transform built. Its coefficients are explicit; make a prediction before revealing.';
    } catch (cause) { error.hidden = false; error.textContent = (cause as Error).message; results.hidden = true; }
  }));
  root.append(builder);
  const presets = el('div', '', 'dr01-actions');
  for (const [text, value] of [
    ['Baseline .8ᵏ', String.raw`\frac{z}{z-0.8}`], ['Alternating', String.raw`\frac{1}{1+0.8z^{-1}}`],
    ['Moving sum (4)', '1+z^{-1}+z^{-2}+z^{-3}'], ['Moving average (4)', String.raw`\frac{1+z^{-1}+z^{-2}+z^{-3}}{4}`],
    ['Repeated pole', String.raw`\frac{1}{(1-0.5z^{-1})^2}`], ['Conjugate poles', String.raw`\frac{1}{1+z^{-2}}`],
  ]) presets.append(button(text, () => { equation.setValue(value); draft = equation.getValue(); invalidate(); }));
  root.append(presets);
  const setup = el('div', '', 'dr01-grid');
  const period = numeric('Sample period T (s)', '0.1'), count = numeric('Number of samples', '16', '1'), h1 = numeric('Initial x[−1]', '0'), h2 = numeric('Initial x[−2]', '0');
  period.input.min = '0.000001'; period.input.max = '100'; count.input.min = '4'; count.input.max = '64';
  setup.append(period.wrapper, count.wrapper, h1.wrapper, h2.wrapper);
  root.append(setup, el('p', 'Change initial memory to add an initial-condition response. The zero-history transform stays fixed. Only the first one or two history values are used, according to the denominator order.'));
  const attempt = el('fieldset', '', 'dr01-card'); attempt.append(el('legend', 'Predict before revealing (optional)'));
  const predictions = [0, 1, 2].map(k => numeric(`Your x[${k}]`, ''));
  const predictionGrid = el('div', '', 'dr01-grid'); predictionGrid.append(...predictions.map(x => x.wrapper));
  attempt.append(predictionGrid, el('p', 'Use the selected initial history. The check uses a relative/absolute tolerance of 10⁻⁶.'));
  root.append(attempt);
  for (const { input } of [period, count, h1, h2, ...predictions]) listen(input, 'input', invalidate);
  let current: { model: Transform; rows: Sample[]; zero: Sample[]; time: number; history: number[] } | undefined;
  const summary = el('div'), derivation = el('div', '', 'dr01-card'), feedback = el('p');
  const selected = numeric('Selected sample k', '0', '1'); selected.input.min = '0';
  const selectedDetails = el('div', '', 'dr01-card'), figure = el('div', '', 'dr01-plot'), tableHolder = el('div', '', 'dr01-table');
  const showSelected = () => {
    if (!current) return;
    const value = selected.input.valueAsNumber;
    if (!Number.isInteger(value) || value < 0 || value >= current.rows.length) {
      selectedDetails.replaceChildren(el('p', `Choose k from 0 to ${current.rows.length - 1}.`)); return;
    }
    const row = current.rows[value];
    selectedDetails.replaceChildren(el('h3', `Sample k = ${value}, t = ${format(value * current.time)} s`));
    selectedDetails.append(el('p', `Forcing b[${value}] = ${format(row.forcing)}. Read old samples before calculating the current sample.`));
    row.feedback.forEach((term, j) => {
      const oldIndex = value - j - 1;
      const oldValue = oldIndex < 0 ? current!.history[-oldIndex - 1] : current!.rows[oldIndex].value;
      selectedDetails.append(el('p', `Memory x[${oldIndex}] = ${format(oldValue)}; multiply by ${format(-current!.model.a[j + 1])} → ${format(term)}.`, 'dr01-highlight'));
    });
    selectedDetails.append(createEquationDisplay(`x[${value}]\\approx${[row.forcing, ...row.feedback].map(x => `(${numberLatex(x)})`).join('+')}\\approx${numberLatex(row.value)}`, 'Sample arithmetic'));
    tableHolder.querySelectorAll('tr[data-k]').forEach(tr => { tr.classList.toggle('dr01-highlight', tr.getAttribute('data-k') === String(value)); });
    drawPlot();
  };
  listen(selected.input, 'input', showSelected);
  // One listener survives table replacements; old rows do not accumulate signal registrations.
  tableHolder.addEventListener('click', event => {
    const target = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('button[data-sample]') : null;
    if (!target || !tableHolder.contains(target)) return;
    selected.input.value = target.dataset.sample!; showSelected();
  }, { signal });
  function drawPlot(): void {
    if (!current) return;
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg'); svg.setAttribute('viewBox', '0 0 700 250'); svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', 'Discrete sequence stems: filled circles are the selected history; open circles are zero history. Horizontal axis sample k, vertical axis x[k].');
    const node = (tag: string, attrs: Record<string, string | number>, text?: string) => {
      const child = document.createElementNS(ns, tag); Object.entries(attrs).forEach(([key, value]) => child.setAttribute(key, String(value)));
      if (text) child.textContent = text; svg.append(child); return child;
    };
    const all = [...current.rows, ...current.zero].map(x => x.value);
    const lo = Math.min(0, ...all), hi = Math.max(0, ...all) || (lo === 0 ? 1 : 0), span = hi - lo;
    const y = (v: number) => 210 - (v - lo) / span * 170, x = (k: number) => 65 + k * 600 / (current!.rows.length - 1);
    node('line', { x1: 65, x2: 665, y1: y(0), y2: y(0), class: 'dr01-axis' });
    node('line', { x1: 65, x2: 65, y1: 28, y2: 218, class: 'dr01-axis' });
    node('text', { x: 8, y: 20 }, 'x[k]'); node('text', { x: 500, y: 245 }, 'sample index k');
    node('text', { x: 2, y: 40 }, format(hi)); node('text', { x: 2, y: 214 }, format(lo));
    current.rows.forEach((row, k) => {
      node('line', { x1: x(k), x2: x(k), y1: y(0), y2: y(row.value), class: k === selected.input.valueAsNumber ? 'dr01-stem dr01-chosen' : 'dr01-stem' });
      node('circle', { cx: x(k), cy: y(row.value), r: k === selected.input.valueAsNumber ? 5 : 3, class: 'dr01-dot' });
      node('circle', { cx: x(k), cy: y(current!.zero[k].value), r: 5, class: 'dr01-zero' });
      if (k % Math.max(1, Math.ceil(current!.rows.length / 12)) === 0 || k === current!.rows.length - 1) node('text', { x: x(k), y: 230, 'text-anchor': 'middle' }, String(k));
    });
    figure.replaceChildren(svg, el('p', 'Filled ●: selected initial history. Open ○: zero history. Stems show discrete samples only; no intersample behavior is inferred.'));
  }
  const compute = () => {
    if (signal.aborted) return;
    try {
      draft = equation.getValue();
      if (draft.empty || draft.hasPlaceholders || draft.syntaxIssues.length) throw new Error('Complete the visual equation and check its notation before revealing.');
      const model = parseTransform(draft.latex), time = read(period.input, 'sample period');
      if (time < 1e-6 || time > 100) throw new Error('Sample period must be between 0.000001 and 100 seconds.');
      const history = [read(h1.input, 'x[−1]'), read(h2.input, 'x[−2]')];
      const sampleCount = read(count.input, 'sample count');
      const rows = samples(model, history, sampleCount), zero = samples(model, [0, 0], sampleCount);
      const predictionsRead = predictions.map(({ input }, k) => input.value.trim() ? read(input, `prediction x[${k}]`) : undefined);
      current = { model, rows, zero, time, history };
      results.hidden = false; error.hidden = true;
      feedback.textContent = predictionsRead.some(x => x !== undefined) ? predictionsRead.flatMap((guess, k) => guess === undefined ? [] : [`x[${k}]: ${Math.abs(guess - rows[k].value) <= 1e-6 * Math.max(1, Math.abs(rows[k].value)) ? 'matches' : `your ${format(guess)}; computed ${format(rows[k].value)}`}`]).join(' · ') : 'No prediction entered. Compare the first three samples, then try a changed pole, delay or initial history.';
      summary.replaceChildren(el('h3', 'Checked causal sequence'), feedback, el('p', 'Numerical coefficients and samples below are rounded to 7 significant digits. The identities describe the unrounded model; generated exercise inputs retain full floating-point precision.'),
        createEquationDisplay(`X_0(z)=${transformLatex(model)}`, 'Negative-power transform'),
        createEquationDisplay(`X_0(z)=${transformLatex(model, 'z')}`, 'Positive-power transform'));
      const numerator = initialNumerator(model, history);
      derivation.replaceChildren(el('h3', 'Transform, recurrence and initial values'));
      derivation.append(createEquationDisplay(`(${polynomial(model.a, 'q')})X_0=B(q),\\quad q=z^{-1}`, 'Coefficient identity'));
      derivation.append(createEquationDisplay(`x[k]=b[k]${model.a.slice(1).map((a, j) => `${a > 0 ? '-' : '+'}(${numberLatex(Math.abs(a))})x[k-${j + 1}]`).join('')}`, 'Recurrence'));
      derivation.append(createEquationDisplay(`B(q)=${polynomial(model.b, 'q')}`, 'Forcing coefficients'));
      derivation.append(el('p', 'b[k] is the coefficient of qᵏ in B(q), and is zero after its last coefficient. Start from x[−1] and x[−2], read old values, then compute x[k].'));
      derivation.append(createEquationDisplay(`X_+(z)=\\frac{${polynomial(numerator, 'q')}}{${polynomial(model.a, 'q')}},\\quad q=z^{-1}`, 'History-corrected unilateral transform'));
      derivation.append(el('p', 'The unilateral shift identity is Z₊{x[k−j]} = qʲX₊ + x[−1]qʲ⁻¹ + … + x[−j]. Thus A(q)X₊ = B(q) − a₁x[−1] − a₂x[−2] − a₂x[−1]q. Missing coefficients are zero. X₀ and X₊ agree for zero history.'));
      const roots = poles(model), radius = Math.max(0, ...roots.map(p => Math.hypot(p.re, p.im)));
      const poleText = (p: { re: number; im: number }) => p.im === 0 ? format(p.re) : `${format(p.re)}${p.im < 0 ? '-' : '+'}${format(Math.abs(p.im))}j`;
      if (roots.length) {
        derivation.append(el('p', `Denominator poles in z: ${roots.map(poleText).join(', ')}. Guaranteed causal exterior of convergence: |z| > ${format(radius)}. This bound is conservative if a pole is removable; factors are retained, including internal recurrence memory. Initial conditions can activate a canceled mode.`));
        derivation.append(createEquationDisplay(roots.map((p, i) => `p_${i + 1}\\approx ${numberLatex(p.re)}${p.im ? `${p.im < 0 ? '-' : '+'}${numberLatex(Math.abs(p.im))}j` : ''}`).join(',\\quad '), 'Computed poles'));
        derivation.append(createEquationDisplay(`A(q)=${roots.map((_, i) => `(1-p_${i + 1}q)`).join('')}`, 'Transform factors'));
        if (roots.length === 1) derivation.append(createEquationDisplay('g[k]=p_1^k,\\quad k\\ge0', 'Geometric transform pair'));
        else {
          derivation.append(createEquationDisplay(`\\Delta\\approx${numberLatex(model.a[1] ** 2 - 4 * model.a[2])}`, 'Quadratic discriminant'));
          const repeated = roots[0].re === roots[1].re && roots[0].im === roots[1].im;
          derivation.append(createEquationDisplay(repeated ? '\\frac{1}{A(q)}=\\frac{1}{(1-pq)^2},\\quad g[k]=(k+1)p^k' : '\\frac{1}{A(q)}=\\frac{p_1}{p_1-p_2}\\frac{1}{1-p_1q}-\\frac{p_2}{p_1-p_2}\\frac{1}{1-p_2q}', 'Inverse kernel partial fractions'));
          if (!repeated) derivation.append(createEquationDisplay('g[k]=\\frac{p_1^{k+1}-p_2^{k+1}}{p_1-p_2},\\quad k\\ge0', 'Inverse kernel'));
          derivation.append(el('p', 'Conjugate factors combine to a real sequence. The recurrence computes samples directly, including repeated and closely spaced poles; no subtraction of rounded poles is used to compute samples.'));
        }
      } else derivation.append(el('p', model.b.length > 1 ? 'Finite causal sequence: the transform converges for every z ≠ 0. The delay powers are undefined at z=0.' : 'A constant transform is a scaled impulse at k=0 and converges for all z.'));
      derivation.append(createEquationDisplay(roots.length ? 'x_0[k]=\\sum_{i=0}^{M}b_i g[k-i],\\quad g[n]=0\\ (n<0)' : 'x_0[k]=b_k', 'Reconstruction by delayed terms'));
      derivation.append(el('p', 'Each bᵢ multiplies a copy of the inverse kernel delayed i samples. This causal shift identity assumes zero extension before k=0; nonzero history is handled by the separate correction above.'));
      const dcDen = model.a.reduce((a, b) => a + b, 0), dcNum = model.b.reduce((a, b) => a + b, 0);
      derivation.append(el('p', Math.abs(dcDen) <= 1e-12 * model.a.reduce((s, x) => s + Math.abs(x), 0) ? 'At z=1 the denominator vanishes (or is too close numerically); no finite DC sum is reported.' : radius < 1 ? `Zero-history sum Σx₀[k] = X₀(1) ≈ ${format(dcNum / dcDen)}. A length-L moving sum of unit taps has gain L; its normalized average has gain 1.` : `Algebraic X₀(1) ≈ ${format(dcNum / dcDen)}; this is not asserted to be the convergent sequence sum because a retained pole has radius ≥ 1.`));
      derivation.append(el('p', 'A rational formula alone does not determine a bilateral sequence. For a nonzero real a, z/(z−a) represents aᵏ for k≥0 when |z|>|a|, but −aᵏ for k≤−1 when |z|<|a|. This tool chooses the causal exterior, and does not invert the interior convention.'));
      const table = el('table'), head = el('tr');
      for (const title of ['k (select)', 't (s)', 'x₀[k]', 'x[k] with history']) head.append(el('th', title));
      const thead = el('thead'); thead.append(head); const tbody = el('tbody');
      rows.forEach((row, k) => {
        const tr = el('tr'); tr.dataset.k = String(k); const cell = el('td');
        const pick = el('button', String(k)); pick.type = 'button'; pick.dataset.sample = String(k); pick.setAttribute('aria-label', `Inspect sample ${k}`); cell.append(pick);
        tr.append(cell, el('td', format(k * time)), el('td', format(zero[k].value)), el('td', format(row.value))); tbody.append(tr);
      });
      table.append(thead, tbody); tableHolder.replaceChildren(table);
      selected.input.max = String(rows.length - 1); selected.input.value = '0'; showSelected();
    } catch (cause) {
      results.hidden = true; error.hidden = false; error.textContent = (cause as Error).message; current = undefined;
    }
  };
  root.append(button('Reveal and check sequence', compute), error);
  results.append(summary, selected.wrapper, selectedDetails, figure, tableHolder, derivation); root.append(results);
  return () => { current = undefined; equation.destroy(); root.remove(); };
};
