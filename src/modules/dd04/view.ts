import type { ModuleMount } from '../../core/module';
import { createEquationDisplay, createEquationInput, type EquationDraft } from '../../shared/equations/input';
import { readNumericInput } from '../../shared/numeric-input';
import { calculate, derive, initialize, type DerivativeRule, type InitialMemory, type IntegralRule, type Memory, type Model, type Step } from './math';
import { parseErrors } from './input';
import { numberText as n, numberTex as t, polynomialTex as polynomial } from './format';
import { samplePlots } from './plots';
import './style.css';

export const mount: ModuleMount = ({ container, signal }) => {
  const root = document.createElement('div'); root.className = 'pid-tool';
  root.innerHTML = `
    <section class="pid-card">
      <h3>1. Set the controller and sampling rules</h3>
      <p>Execute a SISO linear digital PID from supplied error samples. Error and output are normalized scalars. This lesson computes the controller; it does not simulate a plant or close a feedback loop.</p>
      <div class="pid-presets" role="group" aria-label="PID experiments">
        <button type="button" data-preset="baseline">S14 baseline</button>
        <button type="button" data-preset="period">Change T to 0.2 s</button>
        <button type="button" data-preset="filter">Filtered derivative</button>
      </div>
      <div class="pid-controls">
        <label>Kp (u/e)<input data-number="kp" type="number" value="4" step="any"></label>
        <label>Ki (u/e/s)<input data-number="ki" type="number" value="2" step="any"></label>
        <label>Kd (u·s/e)<input data-number="kd" type="number" value="1" step="any"></label>
        <label>Sample period T (s)<input data-number="period" type="number" value="0.1" step="any" min="0.001" max="10"></label>
        <label>Integration rule<select data-choice="integral"><option value="trapezoidal">Trapezoidal (Tustin)</option><option value="backward">Backward rectangle</option><option value="forward">Forward rectangle</option></select></label>
        <label>Derivative rule<select data-choice="derivative"><option value="backward">Unfiltered backward difference</option><option value="tustin">Unfiltered Tustin</option><option value="filtered">Filtered backward Euler</option><option value="forward">Forward difference (future input)</option></select></label>
        <label>Filter time constant τ (s)<input data-number="tau" type="number" value="0.1" step="any" min="0.001" max="10" disabled></label>
        <label>Primary calculation view<select data-choice="form"><option value="position">Positional P + I + D</option><option value="incremental">Incremental Δu</option></select></label>
      </div>
      <div class="pid-errors"></div>
      <p class="pid-help">Enter 1–40 error values for e[1], e[2], …, separated by commas. Decimals, fractions, visible parentheses and finite real arithmetic are supported. Write 0.01 here; e/E exponent notation is available in the numeric controller fields. Use explicit + or × before an adjacent fraction.</p>
    </section>
    <section class="pid-card">
      <h3>2. Specify the memory before k = 1</h3>
      <div class="pid-controls">
        <label>Previous error e[0]<input data-number="e0" type="number" value="0" step="any"></label>
        <label>Older error e[−1]<input data-number="em1" type="number" value="0" step="any"></label>
        <label>Integral memory I[0] (u)<input data-number="i0" type="number" value="0" step="any"></label>
        <label>Derivative memory D[0] (u)<input data-number="d0" type="number" value="0" step="any" disabled></label>
      </div>
      <p class="pid-help">Backward difference fixes D[0] from e[0] and e[−1]. Tustin and filtered D have an independent derivative state. The tool derives consistent prior output/increment history from these states. Initial memory is separate from the zero-state transfer function.</p>
      <button type="button" class="pid-primary" data-action="derive">Derive controller and initialize memory</button>
      <p class="pid-message" role="status" aria-live="polite">Enter the experiment, then derive it.</p>
    </section>
    <div class="pid-lesson" hidden>
      <section class="pid-card"><h3>3. Follow the derivation</h3><div class="pid-derivation"></div></section>
      <section class="pid-card">
        <h3>4. Read, calculate, then commit one sample</h3>
        <p class="pid-index"></p><div class="pid-memory" aria-label="Current stored memory"></div>
        <label class="pid-prediction">Your prediction for the next u[k] (optional)<input type="number" data-number="prediction" step="any"></label>
        <div class="pid-actions"><button type="button" data-action="calculate">Calculate and reveal next output</button><button type="button" data-action="commit" disabled>Commit memory update</button><button type="button" data-action="run">Run remaining samples</button><button type="button" data-action="restart">Restart this experiment</button></div>
        <div class="pid-pending" hidden></div>
      </section>
      <section class="pid-card"><h3>5. Compare committed samples</h3><div class="pid-history"></div></section>
    </div>
    <details class="pid-card"><summary>Conventions and supported limits</summary>
      <p>Sample index starts at k=1; physical time is kT seconds. Signed gains have magnitude ≤10000; T and active τ are .001–10 s; errors have magnitude ≤10000; initial I/D magnitude ≤10⁶. Execute 1–40 error samples. Finite arithmetic is bounded to magnitude 10¹²; overflow, underflow and unsupported forms are reported. Each scalar uses ≤160 characters, 64 tokens and 8 grouping levels; the list uses ≤2048 characters.</p>
      <p>Coefficients b₀,b₁,b₂ are ordered from present error to two-sample-old error. Exact LTI difference identities are evaluated in floating point, normally shown to seven significant digits. Positional/incremental agreement uses a scale-aware 10⁻⁹ tolerance. No actuator, saturation or anti-windup is included. A finite controller trace does not establish closed-loop stability or performance.</p>
    </details>`;
  container.append(root);
  const get = <T extends HTMLElement>(selector: string): T => root.querySelector<T>(selector)!;
  const input = (name: string) => get<HTMLInputElement>(`[data-number="${name}"]`);
  const choice = (name: string) => get<HTMLSelectElement>(`[data-choice="${name}"]`);
  const action = (name: string) => get<HTMLButtonElement>(`[data-action="${name}"]`);
  const message = get('.pid-message'), lesson = get('.pid-lesson'), derivation = get('.pid-derivation');
  const memoryPanel = get('.pid-memory'), pendingPanel = get('.pid-pending'), history = get('.pid-history');
  let draft: EquationDraft;
  let experiment: { model: Model; initial: InitialMemory; initialMemory: Memory; errors: readonly number[] } | undefined;
  let memory: Memory | undefined, pending: Step | undefined;
  let committed: Step[] = [];
  const say = (parent: HTMLElement, text: string, tag = 'p') => {
    const element = document.createElement(tag); element.textContent = text; parent.append(element); return element;
  };
  const equation = (parent: HTMLElement, latex: string, label: string) => parent.append(createEquationDisplay(latex, label));
  const invalidate = () => {
    experiment = undefined; memory = undefined; pending = undefined; committed = [];
    lesson.hidden = true; pendingPanel.hidden = true; pendingPanel.replaceChildren();
    message.textContent = 'Inputs changed. Derive and initialize the new experiment.';
  };
  const syncRules = () => {
    input('tau').disabled = choice('derivative').value !== 'filtered';
    input('d0').disabled = choice('derivative').value === 'backward';
  };
  const errorsInput = createEquationInput({ label: 'Error samples starting at k = 1', value: '[1,1,1,1,0,0]', signal,
    onChange: value => { draft = value; invalidate(); } });
  get('.pid-errors').append(errorsInput.element); draft = errorsInput.getValue();
  const numeric = (name: string) => {
    const field = input(name);
    if (field.value.trim().length > 160) throw new Error(`Keep ${name} within 160 characters.`);
    return readNumericInput(field, name);
  };
  for (const field of root.querySelectorAll<HTMLInputElement>('[data-number]:not([data-number="prediction"])')) field.addEventListener('input', invalidate, { signal });
  for (const select of root.querySelectorAll<HTMLSelectElement>('[data-choice]')) select.addEventListener('change', () => { syncRules(); invalidate(); }, { signal });

  function renderDerivation(model: Model): void {
    derivation.replaceChildren();
    const integralNames = { forward: 'forward rectangle reads the previous error', backward: 'backward rectangle reads the current error', trapezoidal: 'trapezoidal integration averages current and previous errors' };
    say(derivation, `Integration: ${integralNames[model.integral]}. c₀=${n(model.c0)}, c₁=${n(model.c1)}.`);
    equation(derivation, String.raw`I[k]=I[k-1]+c_0e[k]+c_1e[k-1]`, 'Integral state update');
    equation(derivation, String.raw`D[k]=\alpha D[k-1]+\beta(e[k]-e[k-1])`, 'Derivative state update');
    say(derivation, `Derivative coefficients: α=${n(model.alpha)}, β=${n(model.beta)}. ${model.derivative === 'filtered' ? 'Backward Euler discretizes Kd·s/(τs+1); the filter has its own D memory. This differs from the unfiltered S14 structure and is not asserted to reproduce S10 gains.' : model.derivative === 'tustin' ? 'Ideal Tustin differentiation has a pole at z=−1. A step can excite a persistent alternating component; it is not a derivative noise filter.' : 'Backward difference uses the current and previous errors; its D value is recomputed from them.'}`);
    equation(derivation, String.raw`u[k]=K_pe[k]+I[k]+D[k],\quad q=z^{-1}`, 'Positional output and delay convention');
    equation(derivation, `C(q)=${t(model.kp)}+\\frac{${polynomial([model.c0, model.c1], 'q', true)}}{1-q}+\\frac{${t(model.beta)}(1-q)}{1-(${t(model.alpha)})q}`, 'Term-by-term zero-state transfer function');
    equation(derivation, String.raw`C(q)=\frac{b_0+b_1q+b_2q^2}{(1-q)(1-\alpha q)}`, 'Common-denominator transfer function');
    equation(derivation, String.raw`b_0=K_p+c_0+\beta,\quad b_1=-K_p(1+\alpha)+c_1-\alpha c_0-2\beta,\quad b_2=K_p\alpha-\alpha c_1+\beta`, 'Recurrence coefficient derivation');
    say(derivation, `Present-to-old error coefficients: b₀=${n(model.b[0])}, b₁=${n(model.b[1])}, b₂=${n(model.b[2])}.`);
    equation(derivation, `C(z)=\\frac{${polynomial(model.b, 'z')}}{${polynomial(model.a, 'z')}}`, 'Unreduced zero-state C(z)');
    equation(derivation, String.raw`\Delta u[k]=\alpha\Delta u[k-1]+b_0e[k]+b_1e[k-1]+b_2e[k-2],\quad u[k]=u[k-1]+\Delta u[k]`, 'Incremental recurrence');
    say(derivation, 'C(z) is shown without cancellation under zero initial memory. Nonzero I/D memory adds a separate response; canceled factors do not erase stored states. This page executes both output forms from consistently mapped history.');
    if (model.alpha === 0) say(derivation, 'Here α=0: the previous Δu is unused and is displayed as 0. No older output history is needed.');
  }
  function renderMemory(): void {
    if (!experiment || !memory) return;
    const { model, errors } = experiment;
    get('.pid-index').textContent = memory.k <= errors.length ? `Next: k=${memory.k}, t=${n(memory.k * model.period)} s, e[k]=${n(errors[memory.k - 1])}. Stored values stay unchanged until Commit.` : `All ${errors.length} samples committed through t=${n(errors.length * model.period)} s.`;
    memoryPanel.replaceChildren(); memoryPanel.classList.toggle('pid-read', Boolean(pending));
    for (const [label, value] of [[`e[${memory.k - 1}]`, memory.ePrev], [`e[${memory.k - 2}]`, memory.eOlder], [`I[${memory.k - 1}]`, memory.integral], [`D[${memory.k - 1}]`, memory.derivative], [`u[${memory.k - 1}]`, memory.output], [`Δu[${memory.k - 1}]`, memory.delta]] as const) {
      const cell = document.createElement('div'); say(cell, label, 'span'); say(cell, n(value), 'strong'); memoryPanel.append(cell);
    }
    action('calculate').disabled = memory.k > errors.length;
    action('commit').disabled = !pending;
    action('run').disabled = Boolean(pending) || memory.k > errors.length;
  }
  function renderHistory(): void {
    if (!experiment) return;
    history.replaceChildren();
    history.append(samplePlots(committed, experiment.initialMemory.output, experiment.initial.e0, experiment.model.period));
    const wrap = document.createElement('div'); wrap.className = 'pid-table'; wrap.tabIndex = 0;
    wrap.setAttribute('role', 'region'); wrap.setAttribute('aria-label', 'Committed sample values, scroll horizontally if needed');
    const table = document.createElement('table');
    const header = document.createElement('tr');
    for (const text of ['k', 'kT (s)', 'e[k]', 'P', 'I', 'D', 'u (position)', 'u (incremental)', '|difference|']) say(header, text, 'th');
    const thead = document.createElement('thead'); thead.append(header); table.append(thead);
    const body = document.createElement('tbody');
    for (const step of committed) { const row = document.createElement('tr'); for (const value of [step.k, step.time, step.error, step.proportional, step.integral, step.derivative, step.position, step.incremental, step.residual]) say(row, n(value), 'td'); body.append(row); }
    table.append(body); wrap.append(table); history.append(wrap);
    if (!committed.length) say(history, 'Only the initial sample is plotted. Calculate and commit to add actual samples.');
  }
  function restart(): void {
    if (!experiment) return;
    memory = initialize(experiment.model, experiment.initial); committed = []; pending = undefined;
    pendingPanel.hidden = true; pendingPanel.replaceChildren(); input('prediction').value = '';
    renderMemory(); renderHistory();
  }
  action('derive').addEventListener('click', () => {
    if (signal.aborted) return;
    try {
      if (draft.empty || draft.hasPlaceholders || draft.syntaxIssues.length) throw new Error('Complete the error samples and all highlighted equation boxes.');
      const errors = parseErrors(draft.latex);
      const model = derive({ kp: numeric('kp'), ki: numeric('ki'), kd: numeric('kd'), period: numeric('period'), integral: choice('integral').value as IntegralRule, derivative: choice('derivative').value as DerivativeRule, tau: input('tau').disabled ? 0.1 : numeric('tau') });
      const initial = { e0: numeric('e0'), eMinus1: numeric('em1'), i0: numeric('i0'), d0: input('d0').disabled ? 0 : numeric('d0') };
      experiment = { model, initial, errors, initialMemory: initialize(model, initial) };
      renderDerivation(model); restart(); lesson.hidden = false;
      message.textContent = 'Controller derived. Predict the next output, calculate from the old memory, then commit the update.';
    } catch (error) { invalidate(); message.textContent = (error as Error).message; }
  }, { signal });
  action('calculate').addEventListener('click', () => {
    if (signal.aborted || !experiment || !memory) return;
    try {
      pending = calculate(experiment.model, memory, experiment.errors[memory.k - 1]);
      pendingPanel.replaceChildren(); pendingPanel.hidden = false;
      const s = pending;
      say(pendingPanel, `Read memory at k=${s.k - 1}; compute u[${s.k}]. Nothing has been committed.`, 'h4');
      equation(pendingPanel, `P=${t(s.proportional)},\\quad I=${t(s.old.integral)}+(${t(s.integralCurrent)})+(${t(s.integralPrevious)})=${t(s.integral)}`, 'Proportional and integral arithmetic');
      equation(pendingPanel, `D=(${t(s.derivativeMemory)})+(${t(s.derivativeChange)})=${t(s.derivative)}`, 'Derivative old-memory and error-change arithmetic');
      equation(pendingPanel, `u_{\\mathrm{position}}=${t(s.proportional)}+(${t(s.integral)})+(${t(s.derivative)})=${t(s.position)}`, 'Positional checked result');
      equation(pendingPanel, `\\Delta u=${s.incrementTerms.map(value => `(${t(value)})`).join('+')}=${t(s.increment)},\\quad u=${t(s.old.output)}+(${t(s.increment)})=${t(s.incremental)}`, 'Incremental checked result');
      say(pendingPanel, `Primary ${choice('form').value === 'position' ? 'positional' : 'incremental'} result: u[${s.k}]=${n(choice('form').value === 'position' ? s.position : s.incremental)}. Positional/incremental difference: ${n(s.residual)}.`);
      if (input('prediction').value.trim()) {
        const prediction = numeric('prediction');
        say(pendingPanel, Math.abs(prediction - s.position) <= 1e-7 * Math.max(1, Math.abs(s.position)) ? 'Your prediction matches within the displayed precision.' : `Your prediction differs by ${n(prediction - s.position)}. Check the highlighted old values and arithmetic.`);
      }
      renderMemory(); message.textContent = 'Result revealed. Commit shifts the error history and stores I, D, u and Δu together.';
    } catch (error) { pending = undefined; pendingPanel.hidden = true; renderMemory(); message.textContent = (error as Error).message; }
  }, { signal });
  action('commit').addEventListener('click', () => {
    if (signal.aborted || !pending) return;
    memory = pending.next; committed.push(pending); pending = undefined; pendingPanel.hidden = true; input('prediction').value = '';
    renderMemory(); renderHistory(); message.textContent = 'Memory update committed. The next calculation reads the updated history.';
  }, { signal });
  action('restart').addEventListener('click', () => { if (!signal.aborted) { restart(); message.textContent = 'Same experiment restarted with its specified initial memory.'; } }, { signal });
  action('run').addEventListener('click', () => {
    if (signal.aborted || !experiment || !memory || pending) return;
    try {
      while (memory.k <= experiment.errors.length) { const step = calculate(experiment.model, memory, experiment.errors[memory.k - 1]); committed.push(step); memory = step.next; }
      renderMemory(); renderHistory(); message.textContent = 'Remaining samples calculated and committed. Compare both forms in the table.';
    } catch (error) { renderMemory(); renderHistory(); message.textContent = (error as Error).message; }
  }, { signal });
  for (const button of root.querySelectorAll<HTMLButtonElement>('[data-preset]')) button.addEventListener('click', () => {
    for (const [name, value] of Object.entries({ kp: 4, ki: 2, kd: 1, period: button.dataset.preset === 'period' ? 0.2 : 0.1, tau: 0.1, e0: 0, em1: 0, i0: 0, d0: 0 })) input(name).value = String(value);
    choice('integral').value = 'trapezoidal'; choice('derivative').value = button.dataset.preset === 'filter' ? 'filtered' : 'backward'; choice('form').value = 'position';
    errorsInput.setValue('[1,1,1,1,0,0]'); draft = errorsInput.getValue(); syncRules(); invalidate();
    message.textContent = 'Experiment loaded. Derive it to inspect its controller and memory.';
  }, { signal });
  return () => { errorsInput.destroy(); root.remove(); };
};
