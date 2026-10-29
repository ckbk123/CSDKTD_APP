import type { ModuleMount } from '../../core/module';
import { createEquationDisplay, createEquationInput, type EquationDraft } from '../../shared/equations/input';
import { readNumericInput } from '../../shared/numeric-input';
import { assess, createModel, design, desiredRoots, poleStatus, simulate, type Desired, type Design, type Gains, type Model, type Performance, type Settings, type Target } from './math';
import { parsePlant } from './input';
import { complexText, numberText as n, numberTex as nt, polynomialTex as poly } from './format';
import { polePlot, responsePlot, type Trace } from './plots';
import './style.css';
function say(parent: Element, text: string, tag = 'p') { const e = document.createElement(tag); e.textContent = text; parent.append(e); return e; }
function table(headings: string[], rows: string[][], label: string) {
  const area = document.createElement('div'); area.className = 'ap-scroll'; area.tabIndex = 0; area.setAttribute('role', 'region'); area.setAttribute('aria-label', label);
  const t = document.createElement('table'), head = document.createElement('thead'), header = document.createElement('tr'), body = document.createElement('tbody');
  headings.forEach(text => { const cell = document.createElement('th'); cell.scope = 'col'; cell.textContent = text; header.append(cell); }); head.append(header);
  rows.forEach(row => { const tr = document.createElement('tr'); row.forEach(text => { const cell = document.createElement('td'); cell.textContent = text; tr.append(cell); }); body.append(tr); }); t.append(head, body); area.append(t); return area;
}
const numeric = (id: string, label: string, value: number, min: number, max: number, step = 'any') => `<label>${label}<input type="number" data-number="${id}" value="${value}" min="${min}" max="${max}" step="${step}"></label>`;
const baseline = String.raw`\frac{10}{10s+1}`;
interface Case { label: string; model: Model; result?: Performance; error?: string; matched: boolean }
interface Exercise { settings: Settings; target: Target; desired: Desired; extra: number; tracking: 'comparator' | 'physical'; nonnegative: boolean; intervals: number; candidate: Case; solved?: Design; solvedCase?: Case; solveError?: string; revealed: boolean }

export const mount: ModuleMount = ({ container, signal }) => {
  if (signal.aborted) return;
  const root = document.createElement('div'); root.className = 'ap-tool';
  root.innerHTML = `<section class="ap-card"><h3>Specify the physical loop and complete targets</h3><p>At each tick, read e[k]=F r[k]−H y[k], update the digital controller, then hold u[k] until the next tick. The physical plant has exact ZOH coefficients a=exp(−T/τ), b=g(1−a), so y[k+1]=a y[k]+b u[k]. All initial states and prior errors/control are zero.</p><div class="ap-editor"></div><div class="ap-controls">
    ${numeric('period', 'Sample period T (s)', 2, .001, 10)}${numeric('sensor', 'Sensor gain H', .05, .001, 10)}${numeric('reference', 'Step reference r', 1, -10, 10)}${numeric('intervals', 'Response intervals N', 100, 10, 2000, '1')}
    <label>Reference convention<select data-choice="preweight"><option value="raw">Raw comparator reference: F=1</option><option value="calibrated">Calibrated physical reference: F=H</option></select></label><label>Required zero step error<select data-choice="tracking"><option value="comparator">Comparator error F r−H y</option><option value="physical">Physical tracking error r−y</option></select></label>
    <label>Controller structure<select data-choice="structure"><option value="pi">PI: source baseline, two full modes</option><option value="pid">PID: three full modes</option></select></label><label>Gain constraint<select data-choice="gainConstraint"><option value="nonnegative">Require nonnegative gains</option><option value="signed">Allow signed gains</option></select></label>
    <label>Target pair entry<select data-choice="targetMode"><option value="continuous">Map damping/natural frequency</option><option value="discrete">Enter a direct discrete pair</option></select></label></div>
    <div class="ap-controls ap-continuous">${numeric('zeta', 'Target damping ratio ζ', .707, .05, .9999)}${numeric('wn', 'Target natural frequency ωn (rad/s)', 2, .01, 20)}</div>
    <div class="ap-controls ap-discrete" hidden>${numeric('targetReal', 'Target pair real part', .2, -.9999, .9999)}${numeric('targetImag', 'Target pair positive imaginary part', .3, 1e-5, .9999)}</div>
    <div class="ap-controls">${numeric('extra', 'Additional PID target pole', -.2, -.95, .95)}</div><p class="ap-structure-note"></p>
    <div class="ap-actions"><button data-preset="source">Load source inputs</button><button data-preset="pi">Load exact PI fixture</button><button data-preset="pid">Load exact PID fixture</button></div>
    <p class="ap-note">Chapter9:28 shows this nonunit-sensor topology; slide29 selects PI. The backward integral and backward error-difference PID extension are declared rules here. Some source formulas could not be rendered; the gain calculations below are independently derived, not copied source answers.</p></section>
    <section class="ap-card"><h3>Try controller gains before the coefficient solution</h3><p>PI uses u[k]−u[k−1]=(Kp+KiT)e[k]−Kp e[k−1]. PID additionally uses Kd(e[k]−e[k−1])/T, with its own previous-error state. There is no actuator saturation or nonlinear controller.</p><div class="ap-controls">
    ${numeric('kp', 'Candidate Kp', 1, -1000, 1000)}${numeric('ki', 'Candidate Ki (1/s)', .1, -1000, 1000)}${numeric('kd', 'Candidate Kd (s)', 0, -1000, 1000)}</div><div class="ap-actions"><button data-action="prepare">Prepare coefficient exercise</button></div><p class="ap-message" role="status">Prepare an exercise, predict the behavior, then check your candidate.</p></section>
    <section class="ap-card ap-attempt" hidden><h3>Predict the complete loop</h3><div class="ap-controls"><label>Candidate full-pole stability<select data-choice="stability"><option value="">Choose a prediction</option><option value="inside">All strictly inside the disk</option><option value="boundary">Boundary tolerance band</option><option value="outside">At least one outside</option><option value="unresolved">Numerically unresolved</option></select></label>
    <label>Which error tends to zero under stable integral action?<select data-choice="error"><option value="">Choose a prediction</option><option value="comparator">Comparator error, generally not physical error</option><option value="both">Both comparator and physical error</option><option value="physical">Physical error only</option></select></label><label>Does a target pair alone specify every PID pole?<select data-choice="pair"><option value="">Choose a prediction</option><option value="no">No; the extra mode must be specified</option><option value="yes">Yes; only the pair matters</option></select></label></div><div class="ap-actions"><button data-action="check">Check candidate and predictions</button><button data-action="solve" disabled>Solve the full coefficient match</button></div></section>
    <div class="ap-results" hidden><section class="ap-card"><h3>Desired and actual characteristic coefficients</h3><p class="ap-grade" role="status"></p><div class="ap-derivation"></div><div class="ap-coefficients"></div><div class="ap-candidate-check"></div><div class="ap-solution"></div></section>
    <section class="ap-card"><h3>Every full closed-loop pole</h3><div class="ap-root-tables"></div><div class="ap-scroll ap-pole-plot" role="region" aria-label="Full pole diagram, scroll horizontally" tabindex="0"></div></section>
    <section class="ap-card"><h3>Actual output, effort and error</h3><div class="ap-performance"></div><div class="ap-scroll ap-output-plot" role="region" aria-label="Physical output comparison, scroll horizontally" tabindex="0"></div><div class="ap-scroll ap-control-plot" role="region" aria-label="Held control comparison, scroll horizontally" tabindex="0"></div><p class="ap-note">Both cases use the same physical plant, T, reference convention, zero state and horizon NT. The output curve uses the actual first-order held-plant equation at401 display times; at most201 sample markers are shown. Held control uses every interval. Finite display polylines are illustrations. No future peak/settling tail is proved by a finite response.</p></section>
    <section class="ap-card"><h3>Inspect an actual sample and controller memory</h3><div class="ap-controls"><label>Response case<select data-choice="inspectCase"><option value="candidate">Candidate</option><option value="matched">Matched solution</option></select></label>${numeric('sample', 'Inspect sample k', 0, 0, 2000, '1')}</div><div class="ap-inspection"></div></section></div>
    <details class="ap-card"><summary>Conventions, support limits and numerical checks</summary><p>Positive physical plant G(s)=g/(τs+1), g=.05–100,τ=.01–100s. Native H=.001–10,T=.001–10s,T/τ≤30,N=10–2000 integer holds, reference−10 to10. Visual input supports decimals, signed/compact/nested fractions, polynomial factors and visible parentheses, with literal powers0–2. It does not support function labels, e/E symbols, ambiguous mixed numbers, hidden grouping or cancelled rational models. Bounds:512 characters,128 expanded tokens,8 logical levels, degree4 intermediates, magnitude10¹². All work runs locally in the browser.</p><p>Current-error backward integral and backward difference: q0=Kp+KiT+Kd/T,q1=−Kp−2Kd/T,q2=Kd/T. PI omits the derivative term/state; PID retains its delay even when Kd=0. Physical ZOH conversion and controller discretization are different steps. All actual roots of the full characteristic are kept; no transfer cancellation is used to certify stability. Unit-radius boundary band10⁻⁸; full coefficient matching tolerance10⁻⁸ relative scale. Near-multiple/poorly resolved roots receive explicit feedback after residual/Vieta checks.</p><p>Continuous targets: ζ=.05–.9999,ωn=.01–20rad/s,ζωnT≤20 and damped angle belowπ. Direct target pairs have positive imaginary part≥10⁻⁵ and radius≥10⁻⁵ strictly inside the disk; repeated/under-resolved target pairs are unsupported. PID extra pole−.95 to.95. Gains±1000, increment coefficients±10⁵, actual characteristic coefficients±10⁶. An incompatible signed-gain or error constraint is reported even when algebraic coefficients match.</p><p>Output/control/error magnitudes≤10¹², held-control energy≤10²⁸. A conservative modal amplification estimate checks the original state trace against its characteristic recurrence; estimates above10⁻⁷×max(1,|state|) suppress the complete response/effort rather than returning partial data. Shorter horizons may recover. This is a support guard, not an exact floating-point error theorem. Stable integral-action limits require every full pole strictly inside. Overshoot is observed relative to the modeled nonzero limit; rise is the first sampled10–90% crossing;2% settling is only an observed candidate. Comparator and physical errors have distinct reference units when H≠1.</p></details>`;
  container.append(root);
  const get = <T extends Element = HTMLElement>(selector: string) => root.querySelector<T>(selector)!;
  const field = (id: string) => get<HTMLInputElement>(`[data-number="${id}"]`), choice = (id: string) => get<HTMLSelectElement>(`[data-choice="${id}"]`);
  const button = (id: string) => get<HTMLButtonElement>(`[data-action="${id}"]`), results = get('.ap-results'), attempt = get('.ap-attempt'), message = get('.ap-message');
  let exercise: Exercise | null = null, draft: EquationDraft;
  const invalidate = () => { exercise = null; results.hidden = true; attempt.hidden = true; button('solve').disabled = true; message.textContent = 'Inputs changed. Prepare a fresh coefficient exercise.'; };
  const makeEditor = (value: string) => createEquationInput({ label: 'Physical plant G(s), without a function-name label', value, signal, onChange: next => { draft = next; invalidate(); } });
  let editor = makeEditor(baseline); get('.ap-editor').append(editor.element); draft = editor.getValue();
  const replacePlant = (value: string) => { editor.destroy(); editor = makeEditor(value); get('.ap-editor').append(editor.element); draft = editor.getValue(); };
  const syncControls = () => {
    const pid = choice('structure').value === 'pid', continuous = choice('targetMode').value === 'continuous';
    field('kd').disabled = !pid; field('extra').disabled = !pid; get('.ap-continuous').hidden = !continuous; get('.ap-discrete').hidden = continuous;
    get('.ap-structure-note').textContent = pid ? 'PID has three full modes. Specify the additional real pole; matching a complex pair alone is insufficient.' : 'The source baseline uses PI. Its full polynomial has two modes; no additional PID pole or derivative value is read.';
  }; syncControls();
  const read = (id: string, label: string, lo: number, hi: number) => { const value = readNumericInput(field(id), label); if (value < lo || value > hi) throw new Error(`${label} must be between ${lo} and ${hi}.`); return value; };
  const run = (model: Model, label: string, intervals: number, matched: boolean): Case => {
    try { return { model, label, result: simulate(model, intervals), matched }; } catch (error) { return { model, label, error: (error as Error).message, matched }; }
  };
  const prepare = () => {
    invalidate();
    try {
      if (draft.empty || draft.hasPlaceholders) throw new Error('Complete the physical plant fraction.');
      if (draft.syntaxIssues.length) throw new Error('Check the visual equation notation.');
      const structure = choice('structure').value as Settings['structure'];
      const settings: Settings = { plant: parsePlant(draft.latex), sensor: read('sensor', 'Sensor H', .001, 10), T: read('period', 'Sample period T', .001, 10), reference: read('reference', 'Step reference', -10, 10), preweight: choice('preweight').value as Settings['preweight'], structure };
      const gains: Gains = { kp: read('kp', 'Candidate Kp', -1000, 1000), ki: read('ki', 'Candidate Ki', -1000, 1000), kd: structure === 'pid' ? read('kd', 'Candidate Kd', -1000, 1000) : 0 };
      const target: Target = choice('targetMode').value === 'continuous' ? { mode: 'continuous', zeta: read('zeta', 'Damping ratio', .05, .9999), wn: read('wn', 'Natural frequency (rad/s)', .01, 20) } : { mode: 'discrete', re: read('targetReal', 'Target real part', -.9999, .9999), im: read('targetImag', 'Target positive imaginary part', 1e-5, .9999) };
      const extra = structure === 'pid' ? read('extra', 'Additional PID pole', -.95, .95) : 0, intervals = read('intervals', 'Response interval count', 10, 2000);
      if (!Number.isInteger(intervals)) throw new Error('Use an integer response interval count.');
      const candidate = createModel(settings, gains), desired = desiredRoots(target, settings.T, structure, extra);
      exercise = { settings, target, desired, extra, intervals, tracking: choice('tracking').value as Exercise['tracking'], nonnegative: choice('gainConstraint').value === 'nonnegative', candidate: run(candidate, 'Candidate', intervals, false), revealed: false };
      for (const id of ['stability', 'error', 'pair']) choice(id).value = '';
      attempt.hidden = false; message.textContent = 'Exercise prepared. Predict full-pole stability, the error convention and the need for an extra PID mode.';
    } catch (error) { message.textContent = (error as Error).message; }
  };
  const cases = () => exercise ? [exercise.candidate, ...exercise.solvedCase ? [exercise.solvedCase] : []] : [];
  const renderInspection = () => {
    const area = get('.ap-inspection'); area.replaceChildren(); if (!exercise?.revealed) return;
    const item = choice('inspectCase').value === 'matched' ? exercise.solvedCase : exercise.candidate;
    field('sample').disabled = !item?.result;
    if (!item?.result) { say(area, item?.error ?? 'Reveal the coefficient solution before inspecting its response.'); return; }
    try {
      const k = read('sample', 'Sample k', 0, exercise.intervals); if (!Number.isInteger(k)) throw new Error('Use an integer sample k.');
      const s = item.result.samples[k], previous = item.result.samples[k - 1], previous2 = item.result.samples[k - 2];
      area.append(table(['Case', 'k', 't=kT (s)', 'y[k]', 'Comparator error', 'Physical error', 'Held u[k]'], [[item.label, String(k), n(s.time), n(s.output), n(s.comparator), n(s.physical), s.control === null ? 'Terminal: no extra hold' : n(s.control)]], 'Selected actual sampled state'));
      if (s.control !== null) {
        area.append(table(['u[k−1]', 'e[k−1]', 'e[k−2]', 'q0e[k]', 'q1e[k−1]', 'q2e[k−2]', 'Increment residual ≈', 'y[k+1]'], [[n(previous?.control ?? 0), n(previous?.comparator ?? 0), n(previous2?.comparator ?? 0), n(item.model.q[0] * s.comparator), n(item.model.q[1] * (previous?.comparator ?? 0)), item.model.q.length === 3 ? n(item.model.q[2] * (previous2?.comparator ?? 0)) : 'No derivative state', n(s.incrementResidual), n(item.result.samples[k + 1].output)]], 'Actual controller memory contributions'));
      } else say(area, 'This terminal sample has no additional controller update or control-energy interval.');
    } catch (error) { say(area, (error as Error).message); }
  };
  const render = () => {
    if (!exercise?.revealed) return; const e = exercise, m = e.candidate.model, d = e.desired, order = m.polynomial.length - 1;
    results.hidden = false;
    const derivation = get('.ap-derivation'); derivation.replaceChildren();
    derivation.append(createEquationDisplay(`a=e^{-T/\\tau}\\approx${nt(m.a)},\\quad b=g(1-a)\\approx${nt(m.b)},\\quad e[k]=${nt(m.F)}r[k]-${nt(e.settings.sensor)}y[k]`, 'Actual ZOH coefficients and comparator convention'));
    derivation.append(createEquationDisplay(`C(z)=\\frac{${e.settings.structure === 'pi' ? 'q_0z+q_1' : 'q_0z^2+q_1z+q_2'}}{${e.settings.structure === 'pi' ? 'z-1' : 'z(z-1)'}},\\quad Q(z)=${e.settings.structure === 'pi' ? 'z^2-(1+a)z+a+Hb(q_0z+q_1)' : 'z^3-(1+a)z^2+az+Hb(q_0z^2+q_1z+q_2)'}`, 'Actual full characteristic before matching'));
    derivation.append(createEquationDisplay(`Q_*(z)\\approx${poly(d.polynomial)}`, 'Desired complete characteristic polynomial'));
    say(derivation, d.continuous ? `Mapped targets exp((−ζωn±jωn√(1−ζ²))T): radius≈${n(d.radius)}, angle≈${n(d.angle)}rad/sample. Damped frequency≈${n(d.continuous.damped)}rad/s is below Nyquist ${n(Math.PI / e.settings.T)}rad/s.` : `Direct target pair: ${complexText(d.pair[0])}, ${complexText(d.pair[1])}. The principal angle≈${n(d.angle)}rad/sample does not choose a unique continuous logarithm branch.`);
    say(derivation, `Full order ${order}; ${d.extra === null ? 'PI has only the stated pair.' : `Additional PID target pole=${n(d.extra)}.`} All actual modes are retained, including a zero derivative-delay mode when Kd=0.`);
    const base = order === 2 ? [1, -(1 + m.a), m.a] : [1, -(1 + m.a), m.a, 0], coeff = get('.ap-coefficients'); coeff.replaceChildren();
    coeff.append(table(['Power of z', 'Desired ≈', 'Candidate actual ≈', 'Candidate residual ≈', 'Unknown contribution', 'Matched actual ≈', 'Matched residual ≈'], d.polynomial.map((value, i) => [String(order - i), n(value), n(m.polynomial[i]), n(m.polynomial[i] - value), i ? `H b q${i - 1} = d${i} − (${n(base[i])})` : 'Leading coefficient fixed1', e.solved ? n(e.solved.model.polynomial[i]) : 'Not revealed', e.solved ? n(e.solved.residuals[i]) : 'Not revealed']), 'Every desired actual characteristic coefficient and residual'));
    const candidateCheck = get('.ap-candidate-check'); candidateCheck.replaceChildren(); const assessment = assess(m, d, e.tracking, e.nonnegative);
    say(candidateCheck, assessment.compatible ? 'Candidate satisfies the full coefficient, pole and selected tracking/gain checks within the declared tolerances.' : `Candidate needs revision: ${assessment.issues.join(' ')}`);
    const solution = get('.ap-solution'); solution.replaceChildren();
    if (e.solveError) say(solution, `No bounded coefficient solution: ${e.solveError}`);
    if (e.solved) {
      say(solution, 'Matched controller and constraint checks', 'h4');
      solution.append(createEquationDisplay(e.settings.structure === 'pi' ? 'q_0=K_p+K_iT,\\quad q_1=-K_p,\\quad K_p=-q_1,\\quad K_i=(q_0+q_1)/T' : 'q_0=K_p+K_iT+K_d/T,\\quad q_1=-K_p-2K_d/T,\\quad q_2=K_d/T', 'Declared digital PID coefficient conversion'));
      const s = e.solved.model;
      solution.append(table(['Kp ≈', 'Ki (1/s) ≈', 'Kd (s) ≈', 'q0 ≈', 'q1 ≈', 'q2 ≈'], [[n(s.gains.kp), n(s.gains.ki), n(s.gains.kd), n(s.q[0]), n(s.q[1]), s.q.length === 3 ? n(s.q[2]) : 'No derivative state']], 'Solved complete controller gains'));
      solution.append(createEquationDisplay(`C(z)\\approx\\frac{${poly(s.q)}}{${e.settings.structure === 'pi' ? 'z-1' : 'z(z-1)'}}`, 'Computed matched digital controller'));
      say(solution, e.solved.compatible ? 'Full match and selected constraints pass. Inspect the actual response; target-pair damping alone is not a transient-performance guarantee.' : `Coefficients solved, selected constraints not satisfied: ${e.solved.issues.join(' ')}`);
    }
    const roots = get('.ap-root-tables'); roots.replaceChildren();
    cases().forEach(item => { say(roots, `${item.label}: full stability ${item.model.stability}`, 'h4'); if (item.model.poles) roots.append(table(['Every full pole ≈', '|z| ≈', 'This pole'], item.model.poles.map(z => [complexText(z), n(Math.hypot(z.re, z.im)), poleStatus(z)]), `${item.label} full closed-loop poles`)); else say(roots, item.model.rootError ?? 'Complete pole set unavailable.'); });
    get('.ap-pole-plot').replaceChildren(polePlot(m, d, e.solved?.model));
    const performance = get('.ap-performance'); performance.replaceChildren();
    performance.append(table(['Case', 'Horizon (s)', 'Stable y∞', 'Stable comparator e∞', 'Stable physical error∞', 'Observed peak (%)', 'Sampled rise (s)', 'Observed2% settling candidate (s)', 'Held ∑T u²'], cases().map(item => { const r = item.result; return [item.label, n(e.intervals * e.settings.T), n(r?.limit ?? null), n(r?.comparatorLimit ?? null), n(r?.physicalLimit ?? null), n(r?.overshoot ?? null), n(r?.rise ?? null), n(r?.settlingCandidate ?? null), n(r?.controlEnergy ?? null)]; }), 'Actual candidate and matched sampled performance'));
    cases().forEach(item => { if (item.error) say(performance, `${item.label}: ${item.error}`); });
    say(performance, 'Stable integral action makes F r−H y→0; it makes physical r−y→0 only with compatible reference scaling. Overshoot is relative to the stable modeled output limit. A candidate that fails full-pole/response conditions receives no assumed limit or partial metrics.');
    if (e.settings.reference === 0) say(performance, 'A zero reference with zero initial state makes both errors trivially zero. It does not establish physical tracking for a nonzero reference.');
    const traces: Trace[] = cases().filter((item): item is Case & { result: Performance } => !!item.result).map(item => ({ label: item.label, model: item.model, result: item.result, matched: item.matched }));
    for (const [selector, part] of [['.ap-output-plot', 'output'], ['.ap-control-plot', 'control']] as const) { const area = get(selector); area.replaceChildren(); if (traces.length) area.append(responsePlot(traces, part)); else say(area, 'No complete supported response is available for plotting.'); }
    renderInspection();
  };
  const check = () => {
    if (!exercise) return;
    if (['stability', 'error', 'pair'].some(id => !choice(id).value)) { message.textContent = 'Choose all three predictions before checking.'; return; }
    const m = exercise.candidate.model, both = exercise.settings.reference === 0 || Math.abs(m.F / exercise.settings.sensor - 1) <= 1e-9;
    get('.ap-grade').textContent = `${m.stability === 'unresolved' ? 'Candidate stability cannot be graded: inspect the root conditioning feedback.' : choice('stability').value === m.stability ? 'Correct full-pole prediction.' : `Revisit candidate stability: ${m.stability}.`} ${choice('error').value === (both ? 'both' : 'comparator') ? 'Correct error-convention prediction.' : 'Revisit the distinction between comparator and physical tracking error.'} ${choice('pair').value === 'no' ? 'Correct: the full PID needs its extra mode.' : 'A complex pair alone leaves the third PID mode unspecified.'}`;
    exercise.revealed = true; field('sample').value = '0'; choice('inspectCase').value = 'candidate'; button('solve').disabled = false; render(); message.textContent = 'Candidate checked. Compare every characteristic coefficient and full mode; reveal the matched solution when ready.';
  };
  const solve = () => {
    if (!exercise?.revealed) return;
    const e = exercise; delete e.solved; delete e.solvedCase; delete e.solveError;
    try { e.solved = design(e.settings, e.target, e.extra, e.tracking, e.nonnegative); e.solvedCase = run(e.solved.model, 'Matched solution', e.intervals, true); choice('inspectCase').value = 'matched'; }
    catch (error) { e.solveError = (error as Error).message; }
    render(); message.textContent = e.solveError ? 'Review the bounded-solution feedback; the candidate result remains available.' : 'Complete coefficient solution revealed. Compare constraints, every pole, actual output, control effort and both errors.';
  };
  root.addEventListener('click', event => {
    const target = (event.target as Element).closest<HTMLButtonElement>('button'); if (!target) return;
    if (target.dataset.action === 'prepare') prepare(); if (target.dataset.action === 'check') check(); if (target.dataset.action === 'solve') solve();
    if (target.dataset.preset) {
      invalidate(); const source = target.dataset.preset === 'source'; replacePlant(source ? baseline : String.raw`\frac1{s+1}`);
      const values: Record<string, string> = { period: source ? '2' : String(Math.log(2)), sensor: source ? '.05' : '.5', reference: '1', intervals: source ? '100' : '40', zeta: '.707', wn: '2', targetReal: '.2', targetImag: '.3', extra: '-.2', kp: '1', ki: '.1', kd: '0' };
      for (const [id, value] of Object.entries(values)) field(id).value = value;
      choice('preweight').value = 'raw'; choice('tracking').value = 'comparator'; choice('gainConstraint').value = 'nonnegative'; choice('targetMode').value = source ? 'continuous' : 'discrete'; choice('structure').value = target.dataset.preset === 'pid' ? 'pid' : 'pi'; syncControls(); message.textContent = 'Inputs loaded. Prepare and predict a fresh exercise.';
    }
  }, { signal });
  root.addEventListener('input', event => { const id = (event.target as HTMLElement).dataset.number; if (!id) return; if (id === 'sample') renderInspection(); else invalidate(); }, { signal });
  root.addEventListener('change', event => { const id = (event.target as HTMLElement).dataset.choice; if (!id) return; if (id === 'inspectCase') renderInspection(); else if (['stability', 'error', 'pair'].includes(id)) return; else { syncControls(); invalidate(); } }, { signal });
  let disposed = false;
  const cleanup = () => { if (disposed) return; disposed = true; editor.destroy(); root.remove(); }; signal.addEventListener('abort', cleanup, { once: true }); return cleanup;
};
