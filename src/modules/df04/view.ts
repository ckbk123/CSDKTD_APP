import type { ModuleMount } from '../../core/module';
import { createEquationDisplay, createEquationInput, type EquationDraft } from '../../shared/equations/input';
import { readNumericInput } from '../../shared/numeric-input';
import { parsePlant } from './input';
import { modelAt, simulate, validateTask, type CaseSpec, type Model, type Plant, type Policy, type Run, type Task } from './math';
import { numberText as n, numberTex as tex } from './format';
import { comparisonPlot } from './plots';
import './style.css';
interface Case { spec: CaseSpec; position: number; model: Model | null; run: Run | null; error: string | null }
interface Comparison { plant: Plant; task: Task; cases: Case[]; revealed: boolean }

export const mount: ModuleMount = ({ container, signal }) => {
  const root = document.createElement('div'); root.className = 'sp-tool';
  root.innerHTML = `
    <section class="sp-card"><h3>1. Keep one physical task</h3>
      <p>Read y[k], calculate u[k] = K(R − y[k]), then hold u until the next tick. Every case uses this same plant, reference step, initial output and final time. Negative unity feedback; normalized output/input units.</p>
      <div class="sp-actions"><button type="button" data-preset="baseline">Baseline comparison</button><button type="button" data-preset="raw">Expose raw-sum scaling</button><button type="button" data-preset="alternating">Alternating and unstable poles</button></div>
      <div class="sp-editor"></div><p class="sp-help">Enter the plant fraction without G(s)=. Supported: positive first-order g/(τs+1), real decimals/fractions and visible parentheses. No pole cancellation, rational sums or e/E symbols. Native numeric controls accept scientific notation.</p>
      <div class="sp-controls">
        <label>Reference step R<input type="number" data-number="reference" value="1" min="0.1" max="10" step="any"></label>
        <label>Initial output y(0)<input type="number" data-number="initial" value="0" min="-10" max="10" step="any"></label>
        <label>Common horizon H (s)<input type="number" data-number="horizon" value="5" min="0.01" max="60" step="any"></label>
        <label>Fixed controller gain K<input type="number" data-number="gain" value="2" min="0" max="100" step="any"></label>
        <label>Target decay rate λ (s⁻¹)<input type="number" data-number="rate" value="3" min="0.01" max="100" step="any"></label>
        <label>First sample period T₁ (s)<input type="number" data-number="t1" value="0.1" min="0.001" max="10" step="any"></label>
        <label>Second sample period T₂ (s)<input type="number" data-number="t2" value="0.2" min="0.001" max="10" step="any"></label>
        <label>Third sample period T₃ (s)<input type="number" data-number="t3" value="0.5" min="0.001" max="10" step="any"></label>
      </div>
      <p>Fixed gain keeps K unchanged as T varies. Redesign selects K at each T to match q = exp(−λT). It preserves that pole decay rate, and generally changes the steady tracking error. This is a declared proportional-gain design, not an optimal controller.</p>
      <div class="sp-actions"><button type="button" data-build="fixed">Compare fixed gain</button><button type="button" data-build="redesign">Compare redesigned gain</button><button type="button" data-build="both" class="sp-primary">Compare both policies</button></div>
      <p class="sp-message" role="status" aria-live="polite">Choose a comparison, predict stability and the error sum, then check.</p>
    </section>
    <section class="sp-card sp-attempt" hidden><h3>2. Predict before comparing</h3>
      <p>Check each case whose entire scalar pole is numerically inside the unit circle. Near-boundary cases use the declared tolerance. Unsupported cases explain their limits below.</p>
      <fieldset class="sp-choices"><legend>Your inside-disk predictions</legend><div class="sp-case-choices"></div></fieldset>
      <label>Error accumulation prediction<select data-choice="sum" aria-label="Error accumulation prediction"><option value="">Choose a comparable error sum</option><option value="raw">Sum e[k]² without time weights</option><option value="weighted">Sum Δt[k] e[k]² over the common horizon</option></select></label>
      <button type="button" data-action="reveal" class="sp-primary">Check predictions and reveal comparisons</button>
    </section>
    <div class="sp-results" hidden>
      <section class="sp-card"><h3>3. Compare complete cases</h3><p class="sp-grade" role="status"></p><div class="sp-summary"></div><div class="sp-metrics"></div></section>
      <section class="sp-card"><h3>4. Compare on the same seconds axis</h3><div class="sp-legend"></div>
        <label><input type="checkbox" data-option="reconstruct">Reconstruct output between ticks using the physical plant and hold</label>
        <div class="sp-output-plot"></div><div class="sp-control-plot"></div>
      </section>
      <section class="sp-card"><h3>5. Inspect one held interval</h3><div class="sp-controls">
        <label>Case details<select data-choice="case" aria-label="Case details"></select></label>
        <label>Held interval index k<input type="number" data-number="cursor" value="0" min="0" step="1"></label>
      </div><div class="sp-detail" role="status"></div></section>
    </div>
    <details class="sp-card"><summary>Supported domain, timing and numerical limits</summary>
      <p>G(s)=g/(τs+1), g .05–20 and τ .01–10 s; one state, scalar input/output, no added delay. K 0–100, R .1–10, y(0) within ±10, H .01–60 s, λ .01–100 s⁻¹ and T .001–10 s. T/τ ≤30; redesigned λT ≤30 and λ ≥1/τ. Target matching relative tolerance 10⁻⁷; circle band ±10⁻⁹. A conditioned numerical match is an approximation.</p>
      <p>At most six temporary cases and 2000 held intervals each. Output/error/control magnitude ≤10¹² and accumulated indices ≤10²⁸. An unsupported or overflowing case has no partial metrics. Extremely small decaying trajectory tails may round to zero; the complete sampled pole remains displayed. Visual input ≤512 characters/128 expanded tokens/eight logical grouping levels; intermediate degree ≤4 and magnitude ≤10¹², with nonzero-input-underflow checks.</p>
      <p>Each interval uses its true Δt, including a partial last hold. ISE, IAE and ITAE are left-rectangle approximations from the sampled error, not exact continuous error integrals. Held-control energy is the exact ZOH integral up to floating arithmetic. Terminal H adds no extra weight. A finite endpoint is not proof of a steady value; a steady-limit label requires the complete pole inside the tolerance band.</p>
      <p>The sample-to-sample model is discrete LTI. The whole clocked sample/hold system is not ordinary continuous-time LTI. Output samples alone do not establish intersample behavior; the optional reconstruction explicitly uses the given continuous plant and hold. This comparison is a proposed course synthesis, not a newly transcribed worked slide.</p>
    </details>`;
  container.append(root);
  const get = <T extends HTMLElement>(selector: string) => root.querySelector<T>(selector)!;
  const number = (name: string) => get<HTMLInputElement>(`[data-number="${name}"]`);
  const choice = (name: string) => get<HTMLSelectElement>(`[data-choice="${name}"]`);
  const read = (name: string, label: string) => readNumericInput(number(name), label);
  const say = (parent: HTMLElement, text: string, tag = 'p') => { const element = document.createElement(tag); element.textContent = text; parent.append(element); return element; };
  const equation = (parent: HTMLElement, latex: string, label: string) => parent.append(createEquationDisplay(latex, label));
  const table = (headers: readonly string[], rows: readonly (readonly string[])[], label: string) => {
    const wrap = document.createElement('div'); wrap.className = 'sp-scroll'; wrap.tabIndex = 0; wrap.setAttribute('role', 'region'); wrap.setAttribute('aria-label', `${label}, scroll horizontally if needed`);
    const node = document.createElement('table'), head = document.createElement('thead'), top = document.createElement('tr'), body = document.createElement('tbody');
    headers.forEach(text => say(top, text, 'th')); head.append(top);
    rows.forEach(row => { const item = document.createElement('tr'); row.forEach(text => say(item, text, 'td')); body.append(item); }); node.append(head, body); wrap.append(node); return wrap;
  };
  const message = get('.sp-message'), attempt = get('.sp-attempt'), results = get('.sp-results');
  let draft: EquationDraft, comparison: Comparison | undefined;
  const label = (item: Case) => `T${item.position + 1} = ${n(item.spec.period)} s · ${item.spec.policy === 'fixed' ? 'fixed gain' : 'redesigned gain'}`;
  const invalidate = () => { if (signal.aborted) return; comparison = undefined; attempt.hidden = true; results.hidden = true; message.textContent = 'Inputs changed. Choose a new comparison before checking.'; };
  const editor = createEquationInput({ label: 'Physical plant G(s), without function label', value: String.raw`\frac1{s+1}`, signal, onChange: next => { draft = next; invalidate(); } });
  get('.sp-editor').append(editor.element); draft = editor.getValue();

  const renderPlots = () => {
    if (!comparison?.revealed) return;
    const selected = comparison.cases.flatMap((item, index) => item.run && get<HTMLInputElement>(`[data-plot="${index}"]`)?.checked ? [{ label: label(item), run: item.run, position: item.position }] : []);
    const reconstruct = get<HTMLInputElement>('[data-option="reconstruct"]').checked;
    get('.sp-output-plot').replaceChildren(comparisonPlot(selected, 'output', reconstruct)); get('.sp-control-plot').replaceChildren(comparisonPlot(selected, 'control', false));
  };
  const renderDetail = () => {
    const area = get('.sp-detail'); area.replaceChildren();
    if (!comparison?.revealed) return;
    const item = comparison.cases[Number(choice('case').value)]; if (!item) return;
    number('cursor').disabled = !item.run;
    say(area, label(item), 'h4');
    if (!item.model) { say(area, item.error ?? 'This case is unsupported.'); return; }
    const m = item.model, p = comparison.plant;
    equation(area, `a=e^{-T/\\tau}\\approx${tex(m.a)},\\quad b=g(1-a)\\approx${tex(m.b)},\\quad q=a-bK\\approx${tex(m.pole)}`, 'Exact held-plant coefficients and full scalar closed-loop pole');
    if (item.spec.policy === 'redesign') {
      equation(area, `q_*=e^{-\\lambda T}\\approx${tex(m.targetPole!)},\\quad K_T=\\frac{a-q_*}{b}\\approx${tex(m.gain)}`, 'Physical-rate redesign and matched proportional gain');
      say(area, `Actual pole residual ≈ ${n(m.targetResidual!)}; relative matching tolerance 10⁻⁷. Fixed plant g = ${n(p.gain)}, τ = ${n(p.tau)} s. Redesign changes K and the tracking bias.`);
    } else say(area, `K = ${n(m.gain)} is unchanged across the fixed-gain cases. T alone changes a, b and the sampled pole.`);
    say(area, m.steadyOutput === null ? `Algebraic equilibrium ${n(m.equilibrium)} is not reported as a steady limit for this boundary/outside case.` : `Stable modeled limit y∞ ≈ ${n(m.steadyOutput)}; e∞ ≈ ${n(comparison.task.reference - m.steadyOutput)}. Finite terminal values remain separate.`);
    if (!item.run) { say(area, item.error ?? 'No complete trajectory is available.'); return; }
    const run = item.run; number('cursor').max = String(run.holds.length - 1);
    try {
      const index = read('cursor', 'held interval index k');
      if (!Number.isInteger(index) || index < 0 || index >= run.holds.length) throw new Error(`Choose an integer interval from 0 to ${run.holds.length - 1}.`);
      const hold = run.holds[index];
      equation(area, String.raw`e_k=R-y_k,\quad u_k=Ke_k,\quad y(t_k+\delta)=y_k+(1-e^{-\delta/\tau})(gu_k-y_k)`, 'Read-error-control-hold order and physical interval update');
      area.append(table(['k', 't start (s)', 't end (s)', 'Δt (s)', 'y start', 'e start', 'u held', 'y end'], [[String(index), n(hold.time), n(hold.end), n(hold.weight), n(hold.output), n(hold.error), n(hold.control), n(hold.nextOutput)]], 'Selected held interval'));
      area.append(table(['Raw e²', 'Δt e²', 'Δt |e|', 'Δt t |e|', 'Δt u²'], [[n(hold.contribution.raw), n(hold.contribution.ise), n(hold.contribution.iae), n(hold.contribution.itae), n(hold.contribution.effort)]], 'Selected interval contributions'));
      say(area, `Terminal observation at shared H = ${n(run.task.horizon)} s: y(H) ≈ ${n(run.terminal)}, e(H) ≈ ${n(run.task.reference - run.terminal)}. It adds no extra interval or quadrature weight. Every one of the ${run.holds.length} intervals contributes, including the final weight ${n(run.holds.at(-1)!.weight)} s.`);
    } catch (error) { say(area, (error as Error).message); }
  };
  const reveal = () => {
    if (!comparison || signal.aborted) return;
    for (const item of comparison.cases) if (item.model) {
      try { item.run = simulate(comparison.plant, comparison.task, item.spec); } catch (error) { item.run = null; item.error = (error as Error).message; }
    }
    comparison.revealed = true;
    const answer = choice('sum').value, stableCorrect = comparison.cases.every((item, index) => !item.model || get<HTMLInputElement>(`[data-predict="${index}"]`).checked === (item.model.stability === 'inside'));
    const stabilityGrade = !comparison.cases.some(item => item.model) ? 'No supported case could be checked for stability. Review the case feedback.' : stableCorrect ? 'Correct numerical stability predictions.' : 'Revisit the stability predictions using the full scalar pole.';
    get('.sp-grade').textContent = `${stabilityGrade} ${answer === 'weighted' ? 'Correct: interval weights preserve the common seconds horizon.' : 'Use interval time weights. A raw sample sum changes scale when the sample count changes.'}`;
    const summary = get('.sp-summary'); summary.replaceChildren();
    summary.append(table(['Case / policy', 'K used', 'Full pole q ≈', 'Disk check', 'Target pole ≈', 'y(H) ≈', 'Stable y∞ ≈'], comparison.cases.map(item => [label(item), item.model ? n(item.model.gain) : 'Unsupported', item.model ? n(item.model.pole) : 'Unavailable', item.model?.stability ?? 'Unsupported', item.model?.targetPole === null || !item.model ? 'Not redesigned' : n(item.model.targetPole), item.run ? n(item.run.terminal) : 'Unavailable', item.model?.steadyOutput === null || !item.model ? 'No certified limit' : n(item.model.steadyOutput)]), 'Complete case poles and endpoints'));
    comparison.cases.forEach(item => { if (item.error) say(summary, `${label(item)}: ${item.error}`); });
    const metrics = get('.sp-metrics'); metrics.replaceChildren();
    equation(metrics, String.raw`J_{\mathrm{ISE}}\approx\sum_k\Delta t_k e_k^2,\quad J_u=\sum_k\Delta t_k u_k^2,\quad \Delta t_k=\min(T,H-t_k)`, 'Weighted left-rectangle error and held-control energy');
    metrics.append(table(['Case / policy', 'Intervals', 'Raw Σe²', 'ISE (output²·s)', 'IAE (output·s)', 'ITAE (output·s²)', 'Held effort (input²·s)'], comparison.cases.map(item => { const run = item.run; return [label(item), run ? String(run.holds.length) : 'Unavailable', ...(['raw', 'ise', 'iae', 'itae', 'effort'] as const).map(key => run ? n(run.indices[key]) : 'Unavailable')]; }), 'Common-horizon weighted quality indices'));
    say(metrics, 'Error indices use left-rectangle approximations; held effort uses the actual ZOH intervals. The raw sum has no seconds weighting. Different gains can change both speed and steady tracking bias.');
    const legend = get('.sp-legend'); legend.replaceChildren(); choice('case').replaceChildren();
    comparison.cases.forEach((item, index) => {
      const option = document.createElement('option'); option.value = String(index); option.textContent = label(item); choice('case').append(option);
      if (item.run) {
        const line = document.createElement('label'), checkbox = document.createElement('input'), swatch = document.createElement('span'); checkbox.type = 'checkbox'; checkbox.checked = true; checkbox.dataset.plot = String(index); swatch.className = `sp-swatch ${item.spec.policy === 'redesign' ? 'sp-redesign' : ''}`; swatch.dataset.period = String(item.position); swatch.setAttribute('aria-hidden', 'true'); line.append(checkbox, swatch, document.createTextNode(label(item))); legend.append(line);
      }
    });
    number('cursor').value = '0'; renderPlots(); renderDetail(); results.hidden = false;
    const completeCount = comparison.cases.filter(item => item.run).length;
    message.textContent = completeCount ? `${completeCount} of ${comparison.cases.length} cases have complete common-horizon trajectories. Inspect policies, poles and weighted indices; other cases retain their feedback.` : 'No complete trajectory is available. Review each case limit before comparing quality indices.';
  };
  const build = (policy: Policy | 'both') => {
    invalidate();
    try {
      if (draft.empty || draft.hasPlaceholders || draft.syntaxIssues.length) throw new Error('Complete the plant expression and highlighted equation boxes.');
      const plant = parsePlant(draft.latex), task = validateTask({ reference: read('reference', 'reference R'), initial: read('initial', 'initial output'), horizon: read('horizon', 'common horizon H') });
      const fixedGain = policy === 'redesign' ? 0 : read('gain', 'fixed controller gain'), rate = policy === 'fixed' ? 0 : read('rate', 'target decay rate');
      const periods = ['t1', 't2', 't3'].map((name, index) => read(name, `sample period T${index + 1}`));
      const cases: Case[] = periods.flatMap((period, position) => (policy === 'both' ? ['fixed', 'redesign'] as const : [policy]).map(selected => {
        const spec: CaseSpec = { period, policy: selected, fixedGain, rate };
        try { return { spec, position, model: modelAt(plant, task, spec), run: null, error: null }; }
        catch (error) { return { spec, position, model: null, run: null, error: (error as Error).message }; }
      }));
      comparison = { plant, task, cases, revealed: false };
      const choices = get('.sp-case-choices'); choices.replaceChildren();
      cases.forEach((item, index) => { const line = document.createElement('label'), checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.dataset.predict = String(index); checkbox.disabled = !item.model; line.append(checkbox, document.createTextNode(`${label(item)}${item.error ? ` · ${item.error}` : ' · predict inside disk'}`)); choices.append(line); });
      choice('sum').value = ''; attempt.hidden = false; message.textContent = `Prepared ${cases.length} temporary cases with shared H = ${n(task.horizon)} s. Predict, then reveal. Each unsupported case retains its own feedback.`;
    } catch (error) { comparison = undefined; message.textContent = (error as Error).message; }
  };
  root.addEventListener('click', event => {
    if (signal.aborted) return;
    const target = (event.target as HTMLElement).closest<HTMLButtonElement>('button'); if (!target) return;
    if (target.dataset.build) build(target.dataset.build as Policy | 'both');
    else if (target.dataset.action === 'reveal') reveal();
    else if (target.dataset.preset) {
      editor.setValue(String.raw`\frac1{s+1}`); draft = editor.getValue();
      const values: Record<string, number> = { reference: 1, initial: 0, horizon: 5, gain: 2, rate: 3, t1: 0.1, t2: 0.2, t3: 0.5 };
      if (target.dataset.preset === 'raw') Object.assign(values, { horizon: 1, gain: 0, t3: 0.3 });
      if (target.dataset.preset === 'alternating') Object.assign(values, { horizon: 3 * Math.LN2, rate: 2, t1: Math.LN2, t2: 0.5, t3: 1.2 });
      for (const [name, value] of Object.entries(values)) number(name).value = String(value);
      invalidate(); message.textContent = 'Experiment loaded. Choose fixed gain, redesigned gain or both, then make your prediction.';
    }
  }, { signal });
  root.addEventListener('input', event => { const field = event.target as HTMLElement; if (!field.dataset.number) return; if (field.dataset.number === 'cursor') renderDetail(); else invalidate(); }, { signal });
  root.addEventListener('change', event => { const field = event.target as HTMLElement; if (field.dataset.choice === 'case') { number('cursor').value = '0'; renderDetail(); } else if (field.hasAttribute('data-plot') || field.dataset.option === 'reconstruct') renderPlots(); }, { signal });
  return () => { comparison = undefined; editor.destroy(); root.remove(); };
};
