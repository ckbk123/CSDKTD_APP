import type { ModuleMount } from '../../core/module';
import { createEquationDisplay, createEquationInput } from '../../shared/equations/input';
import { readNumericInput } from '../../shared/numeric-input';
import { latex, type Gain } from './algebra';
import { drawGraph } from './diagram';
import { baseline, disjoint, parsed, type DraftNet } from './fixtures';
import { analyze, numericCheck, sharedNodes, trace, validate, type Analysis, type Net, type Trace } from './mason';
import './style.css';

const nodeLatex = (name: string) => `\\mathrm{${name}}`;
function text(tag: string, value: string, className = '') { const el = document.createElement(tag); el.textContent = value; el.className = className; return el; }
function button(label: string, action: string) { const b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.dataset.action = action; return b; }
function equation(parent: HTMLElement, value: string, label: string) { parent.append(createEquationDisplay(value, label)); }
const gainEquation = (parent: HTMLElement, name: string, g: Gain) => equation(parent, `${name}=${latex(g)}`, name);

export const mount: ModuleMount = ({ container, signal }) => {
  if (signal.aborted) return;
  const root = document.createElement('div'); root.className = 'cr05'; root.dataset.module = 'CR05';
  root.innerHTML = `<section><h2>1. Define signals and signed blocks</h2><p>Each signal is the sum of its incoming signed block outputs. An arrow carries its gain times the upstream signal. A line crossing adds no junction. All signals are scalar; use consistent signal units. Laplace s has units s⁻¹; coefficients carry the units required by each gain. Zero initial conditions; no sampling or time simulation.</p>
    <div class="cr05-row"><button type="button" data-action="baseline">Course baseline / reset</button><button type="button" data-action="changed">Course with H2 = 3</button><button type="button" data-action="disjoint">Proposed disjoint-loop experiment</button></div><p data-part="source-note" class="cr05-muted"></p>
    <div class="cr05-row"><label class="cr05-grow">Signal names, separated by commas<input data-control="nodes" aria-label="Signal names" value="r,e,x,y"></label><button type="button" data-action="nodes">Update signal list</button><label>External input<select data-control="source" aria-label="External input"></select></label><label>Read output<select data-control="target" aria-label="Read output"></select></label></div>
    <p class="cr05-muted">2–7 distinct names, 1–16 branches. Gains: proper rational functions in s of degree ≤2, decimals with ≤6 places and 9 digits, each literal ≤1000. Use visible parentheses and fraction/power buttons. Negative gain includes the summer sign. Zero-gain branches are omitted from paths/loops.</p>
    <div data-part="branches" class="cr05-branches"></div><div class="cr05-row"><button type="button" data-action="add">Add branch</button><button type="button" data-action="apply">Apply graph</button></div><p data-part="feedback" role="status" aria-live="polite"></p>
    <div data-part="graph"></div><div data-part="signals" class="cr05-row"></div><p class="cr05-muted">Select a signal to highlight its incident block connections and graph node. Select branch buttons below to trace arrows in order. The graph is a schematic; endpoints define connectivity.</p></section>
  <section><h2>2. Trace before revealing</h2><div data-part="trace-buttons" class="cr05-row"></div><p data-part="sequence">No branches selected.</p><div class="cr05-row"><button type="button" data-action="back">Remove last branch</button><button type="button" data-action="clear">Clear trace</button><button type="button" data-action="path">Check forward path</button><button type="button" data-action="loop">Check elementary loop</button></div><p data-part="trace-feedback" role="status"></p><div data-part="attempts" class="cr05-list"></div><button type="button" data-action="touch">Test selected loop pair</button><p data-part="touch-feedback" role="status"></p>
    <div class="cr05-row"><label>Predict forward paths<select data-control="path-count"><option value="">Choose</option><option>0</option><option>1</option><option>2</option><option value="3">3 or more</option></select></label><label>Predict elementary loops<select data-control="loop-count"><option value="">Choose</option><option>0</option><option>1</option><option>2</option><option value="3">3 or more</option></select></label><button type="button" data-action="enumerate">Reveal enumeration</button></div><p data-part="prediction" role="status"></p><div data-part="enumeration" class="cr05-list"></div></section>
  <section><h2>3. Build determinants, then simplify</h2><p>A non-touching set has no shared signal nodes. The empty product contributes 1; single-loop terms subtract, pairs add and triples subtract. A path cofactor uses only sets that avoid every node on that path.</p><button type="button" data-action="determinants">Build Δ and path cofactors</button><div data-part="determinants"></div><button type="button" data-action="result">Simplify and check original equations</button><div data-part="result"></div>
    <div class="cr05-row"><label>Evaluation σ (s⁻¹)<input data-control="sigma" aria-label="Evaluation real part" type="number" step="any" value="0"></label><label>Evaluation ω (rad/s)<input data-control="omega" aria-label="Evaluation imaginary part" type="number" step="any" value="0"></label><button type="button" data-action="numeric">Check at s = σ + jω</button></div><p data-part="numeric" role="status"></p><p class="cr05-muted">Formal rational identities use exact decimal arithmetic with polynomial cancellation; no stability conclusion follows from a reduced transfer. Original node equations are independently eliminated before exact comparison. The numeric point check uses branch gains before network cancellation and reports singular/poorly conditioned points. |s| ≤100; pivot threshold 10⁻¹¹, scaled residual ≤10⁻⁹ and transfer disagreement ≤10⁻⁸. Exact work is capped at 200,000 coefficient operations, 2048-bit integers, intermediate degree 64; enumeration at 10,000 visits, 128 paths/loops and 256 non-touching sets. Limits give feedback, never a partial answer.</p></section>`;
  container.append(root);
  const part = (name: string) => root.querySelector<HTMLElement>(`[data-part="${name}"]`)!;
  const control = <T extends HTMLInputElement | HTMLSelectElement>(name: string) => root.querySelector<T>(`[data-control="${name}"]`)!;
  let draft = baseline(), net: Net | undefined, analysis: Analysis | undefined, built = false, revealed = false;
  let inputs: ReturnType<typeof createEquationInput>[] = [], sequence: string[] = [], highlightEdges: string[] = [], highlightNodes: string[] = [], selectedNode = '';
  let attemptedPaths: Trace[] = [], attemptedLoops: Trace[] = [], chosenLoops = new Set<number>();
  const clearAnswers = () => { analysis = undefined; built = false; revealed = false; for (const id of ['enumeration', 'prediction', 'determinants', 'result', 'numeric']) part(id).replaceChildren(); };
  const clearTraces = () => { sequence = []; highlightEdges = []; highlightNodes = []; selectedNode = ''; attemptedPaths = []; attemptedLoops = []; chosenLoops = new Set(); for (const id of ['attempts', 'trace-feedback', 'touch-feedback']) part(id).replaceChildren(); part('sequence').textContent = 'No branches selected.'; };
  const invalidate = () => { net = undefined; clearAnswers(); clearTraces(); part('graph').textContent = 'Apply the edited graph to update the diagram and begin tracing.'; part('signals').replaceChildren(); part('trace-buttons').replaceChildren(); part('feedback').textContent = 'Edits are pending. Apply graph before tracing or revealing.'; };
  const graph = () => {
    if (!net) return;
    part('graph').replaceChildren(drawGraph(net, highlightEdges, highlightNodes, selectedNode));
    for (const card of root.querySelectorAll<HTMLElement>('[data-branch-card]')) { const b = net.branches.find(e => e.id === card.dataset.branchCard)!; card.classList.toggle('chosen', highlightEdges.includes(b.id) || !!selectedNode && (b.from === selectedNode || b.to === selectedNode)); }
    for (const b of root.querySelectorAll<HTMLButtonElement>('[data-edge]')) b.setAttribute('aria-pressed', String(highlightEdges.includes(b.dataset.edge!)));
    for (const b of root.querySelectorAll<HTMLButtonElement>('[data-node]')) b.setAttribute('aria-pressed', String(b.dataset.node === selectedNode || highlightNodes.includes(b.dataset.node!)));
  };
  const showTrace = (value: Trace) => { highlightEdges = [...value.edges]; highlightNodes = [...value.nodes]; selectedNode = ''; graph(); };
  const options = (select: HTMLSelectElement, value: string) => {
    select.replaceChildren(); for (const name of new Set([...draft.nodes, value])) { const o = document.createElement('option'); o.value = name; o.textContent = draft.nodes.includes(name) ? name : `${name} (missing)`; select.append(o); } select.value = value;
  };
  function renderBranches() {
    inputs.forEach(input => input.destroy()); inputs = []; part('branches').replaceChildren();
    draft.branches.forEach(branch => {
      const card = text('div', '', 'cr05-branch'); card.dataset.branchCard = branch.id;
      card.append(text('strong', `Signed block ${branch.id}`));
      const row = text('div', '', 'cr05-row');
      for (const endpoint of ['from', 'to'] as const) { const label = text('label', endpoint === 'from' ? 'Upstream signal' : 'Into summer at'); const select = document.createElement('select'); select.dataset.endpoint = endpoint; select.dataset.branch = branch.id; select.setAttribute('aria-label', `${branch.id} ${endpoint}`); options(select, branch[endpoint]); label.append(select); row.append(label); }
      const remove = button('Remove branch', 'remove'); remove.dataset.branch = branch.id; row.append(remove); card.append(row);
      const pick = button(`Trace ${branch.id}`, 'edge'); pick.dataset.edge = branch.id; card.append(pick);
      const input = createEquationInput({ label: `${branch.id} signed gain`, value: branch.value, signal, onChange: value => { branch.value = value.latex; invalidate(); } });
      inputs.push(input); card.append(input.element); part('branches').append(card);
    });
  }
  function renderAttempts() {
    const host = part('attempts'); host.replaceChildren();
    for (const [kind, traces] of [['path', attemptedPaths], ['loop', attemptedLoops]] as const) traces.forEach((value, i) => {
      const card = text('div', '', 'cr05-branch'), row = text('div', '', 'cr05-row');
      const show = button(`Highlight your ${kind} ${i + 1}: ${value.edges.join(' → ')}`, 'attempt'); show.dataset.kind = kind; show.dataset.index = String(i); row.append(show);
      if (kind === 'loop') { const label = text('label', 'Select for pair test'), check = document.createElement('input'); check.type = 'checkbox'; check.dataset.loop = String(i); check.checked = chosenLoops.has(i); label.append(check); row.append(label); }
      card.append(row); gainEquation(card, `${kind === 'path' ? 'P' : 'L'}_{\\mathrm{attempt},${i + 1}}`, value.gain); host.append(card);
    });
  }
  function apply() {
    clearAnswers(); clearTraces();
    if (control<HTMLInputElement>('nodes').value.split(',').map(n => n.trim()).join(',') !== draft.nodes.join(',')) throw new Error('Update the edited signal list before applying the graph.');
    net = parsed(draft); validate(net);
    part('source-note').textContent = `${draft.label}. ${draft.note}`;
    part('signals').replaceChildren(); part('trace-buttons').replaceChildren();
    for (const name of net.nodes) { const b = button(`Signal ${name}`, 'node'); b.dataset.node = name; part('signals').append(b); }
    for (const e of net.branches) { const b = button(`${e.id}: ${e.from} → ${e.to}`, 'edge'); b.dataset.edge = e.id; part('trace-buttons').append(b); }
    graph(); part('feedback').textContent = 'Graph applied. Trace branch arrows, or predict counts before revealing enumeration.';
  }
  function load(value: DraftNet) {
    invalidate(); draft = value; control<HTMLInputElement>('nodes').value = draft.nodes.join(',');
    options(control('source'), draft.source); options(control('target'), draft.target);
    control<HTMLInputElement>('sigma').value = '0'; control<HTMLInputElement>('omega').value = '0'; control<HTMLSelectElement>('path-count').value = ''; control<HTMLSelectElement>('loop-count').value = '';
    renderBranches(); apply();
  }
  function needNet(): Net { if (!net) throw new Error('Apply a valid graph first.'); return net; }
  function enumerate() {
    analysis = analyze(needNet()); built = false; revealed = false;
    for (const id of ['determinants', 'result', 'numeric']) part(id).replaceChildren();
    const host = part('enumeration'); host.replaceChildren();
    const counts = [['path-count', analysis.paths.length, 'paths'], ['loop-count', analysis.loops.length, 'loops']] as const;
    part('prediction').textContent = counts.map(([c, count, label]) => { const p = control<HTMLSelectElement>(c).value; return `${count} ${label}; ${p === '' ? 'no prediction entered' : Number(p) === Math.min(3, count) ? 'your prediction agrees' : 'review your prediction'}.`; }).join(' ');
    for (const [kind, traces] of [['path', analysis.paths], ['loop', analysis.loops]] as const) traces.forEach((value, i) => {
      const card = text('div', '', 'cr05-branch'), b = button(`Highlight ${kind === 'path' ? 'P' : 'L'}${i + 1}: ${value.edges.join(' → ')}`, 'enumerated'); b.dataset.kind = kind; b.dataset.index = String(i); card.append(b, text('p', `Signal nodes: ${value.nodes.join(', ')}.`)); gainEquation(card, `${kind === 'path' ? 'P' : 'L'}_{${i + 1}}`, value.gain); host.append(card);
    });
    host.append(text('p', `${analysis.sets.length} nonempty non-touching sets (including each single loop). A self-loop is an elementary loop.`));
    part('feedback').textContent = 'Enumeration is revealed. Build Δ and every path cofactor next.';
  }
  const setFormula = (sets: Analysis['sets']) => '1' + sets.map(set => `${set.loops.length % 2 ? '-' : '+'}${set.loops.map(i => `L_{${i + 1}}`).join('\\,')}`).join('');
  function determinants() {
    if (!analysis) throw new Error('Reveal the enumeration first.');
    const a = analysis, host = part('determinants'); host.replaceChildren();
    equation(host, `\\Delta=${setFormula(a.sets)}`, 'Mason determinant, before substitution');
    const groups = new Map<number, typeof a.sets>(); a.sets.forEach(s => groups.set(s.loops.length, [...(groups.get(s.loops.length) ?? []), s]));
    for (const [size, sets] of groups) { host.append(text('h3', `${size}-loop terms: ${size % 2 ? 'subtract' : 'add'}`)); for (const set of sets) { const line = text('div', '', 'cr05-branch'); const b = button(`Highlight ${set.loops.map(i => `L${i + 1}`).join(' · ')} (nodes ${set.nodes.join(', ')})`, 'set'); b.dataset.loops = set.loops.join(','); line.append(b); equation(line, `${set.loops.map(i => `L_{${i + 1}}`).join('\\,')}=${latex(set.gain)}`, 'Loop set product'); host.append(line); } }
    a.paths.forEach((p, i) => { const excluded = a.loops.map((loop, j) => ({ j, shared: sharedNodes(p, loop) })).filter(v => v.shared.length);
      host.append(text('h3', `Path P${i + 1} cofactor`)); host.append(text('p', excluded.length ? `Exclude ${excluded.map(v => `L${v.j + 1} (shared ${v.shared.join(', ')})`).join('; ')}.` : 'No loop touches this path; retain every non-touching set.'));
      equation(host, `\\Delta_{${i + 1}}=${setFormula(a.eligibleSets[i])}`, 'Path cofactor before substitution');
    });
    equation(host, `\\frac{${nodeLatex(needNet().target)}}{${nodeLatex(needNet().source)}}=\\frac{${a.paths.length ? a.paths.map((_, i) => `P_{${i + 1}}\\Delta_{${i + 1}}`).join('+') : '0'}}{\\Delta}`, 'Assembled Mason formula');
    built = true; part('feedback').textContent = 'Determinants are built. Compare the included/excluded sets, then simplify and check the original equations.';
  }
  function checkPoint() {
    if (!analysis || !revealed) throw new Error('Simplify and reveal the transfer before checking a point.');
    part('numeric').replaceChildren();
    const s = { re: readNumericInput(control('sigma'), 'evaluation real part'), im: readNumericInput(control('omega'), 'evaluation imaginary part') };
    const c = numericCheck(needNet(), analysis, s), fmt = (x: number) => Number(x.toPrecision(8)).toString();
    part('numeric').textContent = `At s = ${fmt(s.re)} + j(${fmt(s.im)}): Mason = ${fmt(c.mason.re)} + j(${fmt(c.mason.im)}); original equations = ${fmt(c.direct.re)} + j(${fmt(c.direct.im)}). Scaled equation residual ${c.residual.toExponential(2)}, relative transfer difference ${c.difference.toExponential(2)}.${s.re === 0 && s.im === 0 ? ' This point gives the formal DC gain; it does not establish closed-loop stability.' : ''}`;
  }
  function result() {
    if (!analysis || !built) throw new Error('Build Δ and the path cofactors before simplifying.');
    const a = analysis, n = needNet(), host = part('result'); host.replaceChildren();
    gainEquation(host, '\\Delta', a.delta); a.cofactors.forEach((value, i) => gainEquation(host, `\\Delta_{${i + 1}}`, value));
    gainEquation(host, `\\frac{${nodeLatex(n.target)}}{${nodeLatex(n.source)}}`, a.transfer);
    host.append(text('h3', 'Independent original block equations'));
    for (const name of n.nodes.filter(name => name !== n.source)) {
      const incoming = n.branches.filter(e => e.to === name);
      equation(host, `${nodeLatex(name)}=${incoming.length ? incoming.map(e => `\\left(${latex(e.gain)}\\right)${nodeLatex(e.from)}`).join('+') : '0'}`, `Original equation for ${name}`);
      gainEquation(host, `\\frac{${nodeLatex(name)}}{${nodeLatex(n.source)}}`, a.signals.get(name)!);
    }
    host.append(text('p', 'Exact elimination of these original signal equations agrees with Mason’s transfer. Canceled network factors are not a test of internal stability.', 'cr05-highlight'));
    revealed = true; try { checkPoint(); } catch (error) { part('numeric').textContent = (error as Error).message; }
  }
  root.addEventListener('change', event => {
    const t = event.target;
    if (!(t instanceof HTMLSelectElement || t instanceof HTMLInputElement)) return;
    if (t.dataset.endpoint) { const b = draft.branches.find(b => b.id === t.dataset.branch)!; b[t.dataset.endpoint as 'from' | 'to'] = t.value; invalidate(); }
    else if (t.dataset.control === 'source' || t.dataset.control === 'target') { draft[t.dataset.control] = t.value; invalidate(); }
    else if (t.dataset.loop !== undefined) { const i = Number(t.dataset.loop); if ((t as HTMLInputElement).checked) chosenLoops.add(i); else chosenLoops.delete(i); part('touch-feedback').replaceChildren(); }
  }, { signal });
  root.addEventListener('input', event => { if ((event.target as HTMLElement).dataset?.control === 'nodes') invalidate(); }, { signal });
  root.addEventListener('click', event => {
    const b = (event.target as Element).closest<HTMLButtonElement>('button[data-action]'); if (!b) return;
    const action = b.dataset.action; const feedback = ['path', 'loop', 'back', 'clear', 'edge', 'attempt'].includes(action ?? '') ? part('trace-feedback') : action === 'touch' ? part('touch-feedback') : action === 'numeric' ? part('numeric') : part('feedback');
    try {
      if (action === 'baseline') load(baseline());
      else if (action === 'changed') { const d = baseline(); d.branches[3].value = '-3'; d.label = 'Course changed inner feedback H2=3'; load(d); }
      else if (action === 'disjoint') load(disjoint());
      else if (action === 'nodes') {
        const names = control<HTMLInputElement>('nodes').value.split(',').map(n => n.trim());
        validate({ nodes: names, source: names[0], target: names.at(-1)!, branches: [{ id: 'test', from: names[0], to: names.at(-1)!, gain: parsed(baseline()).branches[0].gain }] });
        draft.nodes = names; options(control('source'), draft.source); options(control('target'), draft.target); renderBranches(); invalidate();
      } else if (action === 'add') {
        if (draft.branches.length >= 16) throw new Error('The graph supports at most 16 branches.');
        let id = 1; while (draft.branches.some(b => b.id === `b${id}`)) id++;
        draft.branches.push({ id: `b${id}`, from: draft.source, to: draft.target, value: '1' }); renderBranches(); invalidate();
      } else if (action === 'remove') { draft.branches = draft.branches.filter(e => e.id !== b.dataset.branch); renderBranches(); invalidate(); }
      else if (action === 'apply') apply();
      else if (action === 'edge') { needNet(); if (sequence.length >= 7) throw new Error('A simple trace uses at most 7 branches. Clear it or remove the last branch.'); sequence.push(b.dataset.edge!); highlightEdges = [...sequence]; highlightNodes = []; selectedNode = ''; part('sequence').textContent = sequence.join(' → '); graph(); }
      else if (action === 'back' || action === 'clear') { if (action === 'clear') sequence = []; else sequence.pop(); highlightEdges = [...sequence]; highlightNodes = []; selectedNode = ''; part('sequence').textContent = sequence.join(' → ') || 'No branches selected.'; graph(); }
      else if (action === 'node') { selectedNode = b.dataset.node!; highlightEdges = []; highlightNodes = []; graph(); }
      else if (action === 'path' || action === 'loop') {
        const value = trace(needNet(), sequence, action), list = action === 'path' ? attemptedPaths : attemptedLoops;
        if (!list.some(v => [...v.edges].sort().join(',') === [...value.edges].sort().join(','))) list.push(value);
        renderAttempts(); showTrace(value); feedback.textContent = `Valid ${action}. Signal nodes: ${value.nodes.join(' → ')}${action === 'loop' ? ` → ${value.nodes[0]}` : ''}.`;
      } else if (action === 'attempt') showTrace((b.dataset.kind === 'path' ? attemptedPaths : attemptedLoops)[Number(b.dataset.index)]);
      else if (action === 'touch') {
        if (chosenLoops.size !== 2) throw new Error('Check exactly two of your traced loops, then test the pair.');
        const selected = [...chosenLoops].map(i => attemptedLoops[i]), shared = sharedNodes(selected[0], selected[1]);
        highlightEdges = selected.flatMap(v => v.edges); highlightNodes = shared; selectedNode = ''; graph();
        feedback.textContent = shared.length ? `These loops touch at ${shared.join(', ')}. Their product must be excluded from Δ; the shared nodes are highlighted.` : 'These loops have no shared nodes. Include their positive pair product in Δ.';
      } else if (action === 'enumerate') enumerate();
      else if (action === 'enumerated') { if (!analysis) throw new Error('Reveal enumeration first.'); showTrace((b.dataset.kind === 'path' ? analysis.paths : analysis.loops)[Number(b.dataset.index)]); }
      else if (action === 'set') { if (!analysis) throw new Error('Reveal enumeration first.'); const selected = b.dataset.loops!.split(',').map(i => analysis!.loops[Number(i)]); highlightEdges = selected.flatMap(v => v.edges); highlightNodes = selected.flatMap(v => v.nodes); selectedNode = ''; graph(); }
      else if (action === 'determinants') determinants();
      else if (action === 'result') result();
      else if (action === 'numeric') checkPoint();
    } catch (error) {
      if (['apply', 'enumerate'].includes(action ?? '')) { invalidate(); }
      feedback.textContent = (error as Error).message;
    }
  }, { signal });
  load(baseline());
  return () => { inputs.forEach(input => input.destroy()); inputs = []; root.remove(); };
};
