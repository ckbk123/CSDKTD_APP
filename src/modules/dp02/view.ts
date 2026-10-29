import type { ModuleMount } from '../../core/module';
import { createEquationDisplay, createEquationInput, type EquationDraft } from '../../shared/equations/input';
import { aliasExperiment, inversePole, mapPole, modeSamples, parsePole, radialMovement, type Pole } from './math';
import { complex, fmt, polePlanes, sequencePlot } from './plots';
import './style.css';

export const mount: ModuleMount = ({ container, signal }) => {
  const root = document.createElement('div'); root.className = 'dp-tool';
  // Static authored markup only. User data is appended as text or typeset equations.
  root.innerHTML = `
    <section class="dp-card">
      <h3>1. Choose a continuous mode</h3>
      <p>Map one pole and its conjugate with z = exp(sT). The real mode starts at amplitude 1; there is no forcing input or feedback loop.</p>
      <div class="dp-presets" role="group" aria-label="Pole experiments">
        <button type="button" data-preset="baseline">Baseline −2 ± 3j</button>
        <button type="button" data-preset="negative">Alternating decay: z = −0.8</button>
        <button type="button" data-preset="growth">Growing mode</button>
        <button type="button" data-preset="boundary">Unit-circle mode</button>
      </div>
      <div class="dp-editor"></div>
      <p class="dp-help">Enter a + bj (or s = a + bj). Real numbers, π, fractions, parentheses and arithmetic are supported. Powers, functions and other variables are unsupported. Or edit the numeric components below.</p>
      <div class="dp-controls">
        <label>Real part σ (s⁻¹)<input data-field="sigma" type="number" value="-2" step="any" min="-1000" max="1000"></label>
        <label>Imaginary part ω (rad/s)<input data-field="omega" type="number" value="3" step="any" min="-10000" max="10000"></label>
      </div>
    </section>
    <section class="dp-card">
      <h3>2. Predict the radial movement</h3>
      <p>Keep s fixed. Compare the radius at the reference period with the radius at the target period. Increasing T changes the sample instants, not the continuous mode.</p>
      <div class="dp-controls">
        <label>Reference T (seconds)<input data-field="reference" type="number" value="0.1" min="0.001" max="10" step="0.01"></label>
        <label>Target T (seconds)<input data-field="period" type="number" value="0.1" min="0.001" max="10" step="0.01"></label>
        <label>Sample intervals N<input data-field="count" type="number" value="30" min="4" max="100" step="1"></label>
        <label>Your prediction<select data-field="prediction"><option value="">Choose before revealing</option><option value="inward">Inward: smaller radius</option><option value="outward">Outward: larger radius</option><option value="unchanged">Radius unchanged</option></select></label>
      </div>
      <p class="dp-help">Try target T = 0.2 s with reference T = 0.1 s. Predict first, then compare the calculated radii.</p>
      <button type="button" class="dp-primary" data-action="reveal">Reveal mapping and check prediction</button>
      <p class="dp-message" role="status" aria-live="polite"></p>
    </section>
    <div class="dp-results" hidden></div>
    <details class="dp-card dp-limits"><summary>Supported domain and numerical limits</summary>
      <p>One pole and its conjugate; T from 0.001 to 10 s; |σ| ≤ 1000 s⁻¹, |ω| ≤ 10000 rad/s, |σT| ≤ 20, |ωT| ≤ 200π, N from 4 to 100, and σTN ≤ 30 for growing modes. The visual expression is limited to 256 characters, 80 tokens and 12 grouping levels. Inverse branches m = −5,…,5.</p>
      <p>Exact exponential/log identities are evaluated in floating point. Angles use (−π, π]; radii within 10⁻¹⁰ of 1 are labeled near-boundary. Very small decaying tails can round to zero. The finite stem plot illustrates a selected free mode and is not a general system stability test. No transfer-function order, pole multiplicity, input/output stability or controller is inferred.</p>
    </details>`;
  container.append(root);
  const get = <T extends HTMLElement>(selector: string): T => root.querySelector<T>(selector)!;
  const numberInput = (name: string) => get<HTMLInputElement>(`[data-field="${name}"]`);
  const sigma = numberInput('sigma'), omega = numberInput('omega');
  const period = numberInput('period'), reference = numberInput('reference'), count = numberInput('count');
  const prediction = get<HTMLSelectElement>('[data-field="prediction"]');
  const message = get<HTMLParagraphElement>('.dp-message'), results = get<HTMLDivElement>('.dp-results');
  let draft: EquationDraft;
  let resultEvents = new AbortController();
  signal.addEventListener('abort', () => resultEvents.abort(), { once: true });
  const invalidate = () => {
    if (signal.aborted) return;
    resultEvents.abort();
    results.hidden = true; results.replaceChildren();
    message.textContent = 'Inputs changed. Choose a prediction and reveal the new mapping.';
  };
  const readPole = (): Pole => {
    if (draft.empty) throw new Error('Enter a pole in the visual field or use both numeric components.');
    if (draft.hasPlaceholders) throw new Error('Complete the highlighted equation boxes.');
    if (draft.syntaxIssues.length) throw new Error('Check the pole notation before revealing.');
    return parsePole(draft.latex);
  };
  const equation = createEquationInput({
    label: 'Continuous pole s', value: 's=-2+3j', signal,
    onChange: next => {
      draft = next; invalidate();
      try { const p = readPole(); sigma.value = String(p.real); omega.value = String(p.imag); }
      catch { sigma.value = ''; omega.value = ''; message.textContent = 'Complete a supported pole expression, then reveal to check it.'; }
    },
  });
  get('.dp-editor').append(equation.element); draft = equation.getValue();
  const readNumber = (input: HTMLInputElement, name: string) => {
    if (!input.value.trim() || !Number.isFinite(input.valueAsNumber)) throw new Error(`Enter a finite number for ${name}.`);
    return input.valueAsNumber;
  };
  const syncNumbers = () => {
    invalidate();
    try {
      const p = { real: readNumber(sigma, 'σ'), imag: readNumber(omega, 'ω') };
      equation.setValue(`s=${p.real}${p.imag < 0 ? '-' : '+'}${Math.abs(p.imag)}j`);
      draft = equation.getValue();
    } catch (error) {
      equation.setValue(''); draft = equation.getValue();
      message.textContent = (error as Error).message;
    }
  };
  for (const input of [sigma, omega]) input.addEventListener('input', syncNumbers, { signal });
  for (const input of [period, reference, count]) input.addEventListener('input', invalidate, { signal });
  prediction.addEventListener('change', invalidate, { signal });
  const text = (parent: HTMLElement, content: string, tag = 'p') => {
    const node = document.createElement(tag); node.textContent = content; parent.append(node); return node;
  };
  const display = (parent: HTMLElement, latex: string, label: string) => parent.append(createEquationDisplay(latex, label));
  const section = (title: string) => {
    const node = document.createElement('section'); node.className = 'dp-card';
    text(node, title, 'h3'); results.append(node); return node;
  };
  function reveal(): void {
    if (signal.aborted) return;
    resultEvents.abort(); resultEvents = new AbortController();
    results.hidden = true; results.replaceChildren();
    try {
      const pole = readPole();
      const T = readNumber(period, 'target T'), T0 = readNumber(reference, 'reference T'), N = readNumber(count, 'sample count');
      const z = mapPole(pole, T), previous = mapPole(pole, T0);
      const samples = modeSamples(pole, T, N); // Validate plot bounds before showing any result.
      const movement = radialMovement(pole, T0, T);
      if (!prediction.value) throw new Error('Choose inward, outward or unchanged before revealing.');
      const correct = prediction.value === movement;
      message.textContent = `${correct ? 'Correct prediction.' : 'Revise your prediction.'} Radius moves ${movement === 'unchanged' ? 'neither inward nor outward' : movement}: ${fmt(previous.radius)} → ${fmt(z.radius)}.`;
      const mapping = section('3. Read the mapping');
      display(mapping, String.raw`z=e^{(\sigma+j\omega)T}=e^{\sigma T}\left(\cos(\omega T)+j\sin(\omega T)\right)`, 'Exponential mapping identity');
      display(mapping, `r=e^{${fmt(pole.real)}(${fmt(T)})}\\approx ${fmt(z.radius)},\\quad\\theta=\\operatorname{Arg}(z)\\approx ${fmt(z.angle)}\\;\\mathrm{rad}`, 'Radius and principal angle');
      text(mapping, `s = ${complex(pole)} → z ≈ ${complex(z)}; the conjugate maps to its conjugate. Unwrapped ωT = ${fmt(pole.imag * T)} rad; principal θ = ${fmt(z.angle * 180 / Math.PI)}°. Radius at reference T = ${fmt(previous.radius)}.`);
      text(mapping, pole.real === 0 ? 'σ = 0 keeps r = 1 for every T.' : `The log-radius change is σ(T − Tref) = ${fmt(pole.real * (T - T0))}. Its sign determines inward or outward movement.`);
      text(mapping, z.classification === 'decay' ? 'r < 1: this mode decays, even when Re z is negative or z is complex.'
        : z.classification === 'growth' ? 'r > 1: this mode grows.'
          : 'r is within 10⁻¹⁰ of 1: boundary or numerically near-boundary. A simple unit-circle mode is bounded but does not decay; repeated poles can grow. Full-system stability requires every mode and the stability definition.');

      const inverseSection = section('4. Choose an inverse-log branch');
      display(inverseSection, String.raw`s_m=\frac{\ln r}{T}+j\frac{\theta+2\pi m}{T},\quad m\in\mathbb{Z}`, 'Multivalued inverse identity');
      const label = document.createElement('label'); label.className = 'dp-branch'; label.textContent = 'Inverse branch m';
      const branch = document.createElement('select'); branch.setAttribute('aria-label', 'Inverse branch m');
      for (let m = -5; m <= 5; m++) { const option = document.createElement('option'); option.value = String(m); option.textContent = String(m); branch.append(option); }
      branch.value = '0'; label.append(branch); inverseSection.append(label);
      const inverseResult = text(inverseSection, '');
      text(inverseSection, 'The principal branch m = 0 restricts frequency to (−π/T, π/T]. Selecting another branch changes the inferred continuous frequency while preserving z. The conjugate has the corresponding conjugate inverse; a real negative z has ±π representatives. z = 0 has no finite inverse.');
      const planes = document.createElement('div'); mapping.append(planes);
      const updateBranch = () => {
        if (signal.aborted) return;
        const inv = inversePole(z, T, Number(branch.value));
        inverseResult.textContent = `Selected inverse s${branch.value} ≈ ${complex(inv)} (σ in s⁻¹, ω in rad/s). Original ω = ${fmt(pole.imag)} rad/s; these need not be the same branch.`;
        planes.replaceChildren(polePlanes(pole, T, T0, inv));
      };
      // Result-local listeners disappear with this element; the visit signal also aborts them.
      branch.addEventListener('change', updateBranch, { signal: resultEvents.signal }); updateBranch();

      const sequence = section('5. Interpret the samples');
      display(sequence, String.raw`x[k]=\operatorname{Re}(z^k)=r^k\cos(k\theta),\quad x[0]=1,\quad t_k=kT`, 'Real free mode with unit initial amplitude');
      sequence.append(sequencePlot(pole, T, N));
      text(sequence, `Stems are samples; dashed curves connect the sampled ±rᵏ envelope for guidance. There is no interpolated output between samples. Horizon: ${fmt(N * T)} s (${N} intervals). Phase θ is radians per sample; θ/T = ${fmt(z.angle / T)} rad/s on the principal branch. Radius controls decay; angle controls sampled oscillation/alternation.`);
      const tableWrap = document.createElement('div'); tableWrap.className = 'dp-table';
      const table = document.createElement('table');
      const head = document.createElement('tr');
      for (const item of ['k', 't = kT (s)', 'x[k]', 'rᵏ']) text(head, item, 'th');
      const thead = document.createElement('thead'); thead.append(head); table.append(thead);
      const body = document.createElement('tbody');
      for (const sample of samples.slice(0, 6)) {
        const row = document.createElement('tr');
        for (const item of [sample.k, fmt(sample.time), fmt(sample.value), fmt(sample.envelope)]) text(row, String(item), 'td');
        body.append(row);
      }
      table.append(body); tableWrap.append(table); sequence.append(tableWrap);

      const aliases = section('6. Test a second continuous frequency');
      const experiment = aliasExperiment(pole, T, N);
      display(aliases, String.raw`e^{(s+j2\pi/T)kT}=e^{skT}e^{j2\pi k}=e^{skT}\quad(k\in\mathbb{Z})`, 'Aliasing identity at integer sample times');
      text(aliases, `Original ω = ${fmt(pole.imag)} rad/s; alias ω + 2π/T = ${fmt(experiment.alias.imag)} rad/s. Both map to the same z and every integer sample agrees. Maximum scaled sample difference from floating-point evaluation over k = 0…${N}: ${experiment.residual.toExponential(2)}. The identity holds for all integer k; this finite numerical check illustrates it.`);
      text(aliases, 'Between sample instants the continuous modes generally differ. A unique inverse frequency requires a branch restriction; samples alone cannot select it. Try a different T and observe that the alias spacing 2π/T changes.');
      results.hidden = false;
    } catch (error) {
      results.replaceChildren(); message.textContent = (error as Error).message;
    }
  }
  get('[data-action="reveal"]').addEventListener('click', reveal, { signal });
  for (const button of root.querySelectorAll<HTMLButtonElement>('[data-preset]')) button.addEventListener('click', () => {
    const preset = button.dataset.preset;
    const p = preset === 'negative' ? { real: Math.log(0.8) / 0.1, imag: Math.PI / 0.1 }
      : preset === 'growth' ? { real: 1, imag: 3 }
        : preset === 'boundary' ? { real: 0, imag: 3 } : { real: -2, imag: 3 };
    sigma.value = String(p.real); omega.value = String(p.imag); syncNumbers();
    reference.value = preset === 'negative' ? '0.05' : '0.1'; period.value = '0.1'; count.value = '30'; prediction.value = '';
    message.textContent = 'Experiment loaded. Make your prediction before revealing.';
  }, { signal });
  message.textContent = 'Choose a prediction, then reveal. At equal periods, consider whether the radius changes.';
  return () => { resultEvents.abort(); equation.destroy(); root.remove(); };
};
