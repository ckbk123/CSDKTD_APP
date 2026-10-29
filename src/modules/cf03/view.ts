import type { ModuleMount } from '../../core/module';
import { createEquationDisplay,createEquationInput,type EquationDraft } from '../../shared/equations/input';
import { readNumericInput } from '../../shared/numeric-input';
import { format as f,latexNumber as ln,parseController,parsePlant,type Plant,type Controller } from './input';
import { density,metrics,panel,ranking,simulate,verifyIntegral,type Metric,type Run } from './math';
import { costPlot,densityUnit,responsePlot,unit } from './plots';
import './style.css';
const poly=(p:number[])=>p.map((v,i)=>{
  if(v===0)return '';
  const power=p.length-1-i;
  return `${v<0?'-':'+'}${Math.abs(v)===1&&power?'':ln(Math.abs(v))}${power?'s':''}${power>1?`^{${power}}`:''}`;
}).filter(Boolean).join('').replace(/^\+/,'')||'0';
const controllerLatex=(c:Controller)=>c.ki===0?ln(c.kp):`\\frac{${poly([c.kp,c.ki])}}{s}`;
const plantLatex=(p:Plant)=>`\\frac{${ln(p.g)}}{${poly(p.a)}}`;
const expression:Record<Metric,string>={IAE:'|e(t)|',ISE:'e^2(t)',ITAE:'t|e(t)|',ITSE:'te^2(t)',Effort:'u^2(t)'};
export const mount:ModuleMount=({container,signal})=>{
  const root=document.createElement('div');root.className='cf-tool';
  root.innerHTML=`
  <section class="cf-card"><h3>1. Compare two controllers on the same task</h3>
    <p>Unit step r(t)=1 output unit, unity negative feedback: e=r−y, u=Ce. All plant states and the PI integral start at zero. E denotes the output/error unit; U denotes the control unit. These are continuous models; plot intervals are numerical resolution.</p>
    <div class="cf-plant"></div><div class="cf-inputs"><div class="cf-A"></div><div class="cf-B"></div></div>
    <p class="cf-muted">Plant: nonzero constant numerator over a degree1–2 polynomial in s (products allowed). Controller: a constant P gain, or PI as (Kp s+Ki) over s. Use the visual fraction boxes and visible parentheses; decimal coefficients only.</p>
    <div class="cf-controls"><label>Common horizon H (s)<input name="horizon" type="number" min="0.05" max="50" step="any" value="10"></label>
    <label>Refinement tolerance<select name="tolerance"><option value="0.001">0.001</option><option value="0.00001" selected>0.00001</option><option value="0.0000001">0.0000001</option></select></label></div>
    <div class="cf-actions"><button type="button" class="button" data-action="compute">Compare trajectories</button><button type="button" class="button" data-action="ranking">Ranking-reversal experiment</button><button type="button" class="button" data-action="unstable">Short unstable experiment</button><button type="button" class="button" data-action="baseline">Baseline inputs</button></div>
    <p class="cf-status" role="status" aria-live="polite"></p>
  </section>
  <section class="cf-card"><h3>2. Inspect the contributions and predict a ranking</h3>
    <div class="cf-controls"><label>Criterion to inspect<select name="metric">${metrics.map(m=>`<option value="${m}">${m==='Effort'?'Control effort ∫u²dt':m}</option>`).join('')}</select></label>
    <label>Inspect run<select name="run"><option value="A">A</option><option value="B">B</option></select></label>
    <label>Inspection time (s)<input name="time" type="number" min="0" max="10" step="any" value="5"></label></div>
    <div class="cf-response cf-plot"></div><div class="cf-density cf-plot"></div><p class="cf-inspection" aria-live="polite"></p><div class="cf-panel-equation"></div>
    <p class="cf-muted">The density plot shades a linear illustration through the selected panel. Its incremental contribution uses the three-point Simpson calculation shown below. Squaring emphasizes large errors; multiplying by t emphasizes later errors.</p>
    <div class="cf-controls"><label>Your lower-score prediction<select name="prediction"><option value="">Choose A, B or a tie</option><option value="A">A is lower</option><option value="B">B is lower</option><option value="tie">Tie within tolerance</option></select></label></div>
    <button type="button" class="button" data-action="reveal">Check prediction and reveal totals</button><p class="cf-feedback" role="status"></p>
  </section>
  <section class="cf-card cf-answer" hidden><h3>3. Read the finite-horizon comparison</h3><p>Every cost is for this common horizon and unit step. A smaller number is a comparison for that criterion, not an optimal-controller claim. The control-effort measure introduces no saturation model.</p>
    <div class="cf-table"></div><p class="cf-explanation"></p><details><summary>Compare early and late error cost</summary><div class="cf-split cf-table"></div></details><div class="cf-reasoning"></div>
    <button type="button" class="button" data-action="verify">Check selected integral on a finer grid</button><p class="cf-verification" role="status"></p>
  </section>
  <details class="cf-card"><summary>Supported bounds, stability and numerical meaning</summary><p>Real SISO constant-numerator strictly proper plants of order1–2; proportional or PI controllers. Normalized plant coefficients and controller gains have magnitude at most1000; nonzero plant gain and integral gain have magnitude at least10⁻⁹. Input polynomials have degree at most2, at most128 tokens and512 characters per field. Numeric wrappers nest at most16. Hidden algebraic grouping, mixed/nested fractions, e/E symbols and general controller dynamics are unsupported. Ki=0 selects the proportional realization, with no integral state.</p><p>Common H from0.05 to50s. RK4 uses zero initial states and a grid doubled until all five cost differences and aligned e/u sample differences are at most tolerance×(1+|value|), in their declared numeric units. At most16384 intervals establish a run; the separate trapezoidal check uses at most32768. Initial grid size also resolves the model's coefficient scale. State or control magnitude above10⁸ and unresolved refinement return an error. The Simpson/trapezoid differences show numerical consistency, not a certified bound on the exact continuous integral.</p><p>Strict Hurwitz conditions are checked on the complete first-, second- or third-order characteristic polynomial of the chosen realization, with margin10⁻¹⁰ times each condition's scale. Failed/boundary conditions prevent a stability claim even if a short trace looks small. Finite-horizon costs do not establish an infinite-horizon optimum; persistent steady error can make a cost grow with H. Plotted maxima are sampled approximations. No physical actuator limit, saturation, saving or cross-tool model transfer is used.</p></details>`;
  container.append(root);
  const q=<T extends Element>(selector:string)=>root.querySelector<T>(selector)!;
  const number=(name:string)=>q<HTMLInputElement>(`[name="${name}"]`);
  const select=(name:string)=>q<HTMLSelectElement>(`[name="${name}"]`);
  const answer=q<HTMLElement>('.cf-answer'),status=q<HTMLElement>('.cf-status'),feedback=q<HTMLElement>('.cf-feedback');
  let runs:{A:Run;B:Run}|undefined;
  let drafts:{plant:EquationDraft;A:EquationDraft;B:EquationDraft};
  const make=(where:string,label:string,value:string,key:'plant'|'A'|'B')=>{
    const field=createEquationInput({label,value,signal,onChange:next=>{drafts[key]=next;invalidate();}});q(where).append(field.element);return field;
  };
  const plant=make('.cf-plant','Plant transfer function G(s)',String.raw`G(s)=\frac{1}{(s+1)(s+2)}`,'plant');
  const A=make('.cf-A','Controller A transfer function C(s)','C(s)=4','A');
  const B=make('.cf-B','Controller B transfer function C(s)','C(s)=8','B');
  drafts={plant:plant.getValue(),A:A.getValue(),B:B.getValue()};
  function invalidate():void{
    runs=undefined;answer.hidden=true;feedback.textContent='';q('.cf-verification').textContent='';q('.cf-panel-equation').replaceChildren();q('.cf-inspection').textContent='';
    q('.cf-response').textContent='Inputs changed. Compare trajectories to recompute.';q('.cf-density').replaceChildren();status.textContent='Inputs changed. Choose Compare trajectories to recompute.';
  }
  function metric():Metric{return select('metric').value as Metric;}
  function inspect():void{
    if(!runs||signal.aborted)return;
    try{
      const time=readNumericInput(number('time'),'inspection time'),r=runs[select('run').value as 'A'|'B'],m=metric(),selected=panel(r,time,m),samples=selected.samples,h=r.horizon/r.intervals;
      q('.cf-response').replaceChildren(responsePlot(runs.A,runs.B,time));q('.cf-density').replaceChildren(costPlot(r,time,m,select('run').value));
      q('.cf-inspection').textContent=`Run ${select('run').value}, Simpson panel ${selected.index/2+1}: t=${f(samples[0].t)}…${f(samples[2].t)}s, h=${f(h)}s. At panel start e=${f(samples[0].e)}E, u=${f(samples[0].u)}U. ${m} panel contribution=${f(selected.contribution)}${unit[m]}; cumulative through panel end=${f(selected.cumulative)}${unit[m]}. Density values are in ${densityUnit[m]}.`;
      q('.cf-panel-equation').replaceChildren(createEquationDisplay(`\\Delta J\\approx\\frac{${ln(h)}}3\\left(${ln(density(samples[0],m))}+4(${ln(density(samples[1],m))})+${ln(density(samples[2],m))}\\right)=${ln(selected.contribution)}`,'Selected Simpson panel contribution'));
    }catch(error){q('.cf-inspection').textContent=error instanceof Error?error.message:'Check inspection time.';}
  }
  function compute():void{
    if(signal.aborted)return;
    invalidate();
    try{
      drafts={plant:plant.getValue(),A:A.getValue(),B:B.getValue()};
      for(const [name,draft]of Object.entries(drafts))if(draft.empty||draft.hasPlaceholders||draft.syntaxIssues.length)throw new Error(`Complete the ${name==='plant'?'plant':`controller${name}`} equation and check its notation.`);
      const model=parsePlant(drafts.plant.latex),ca=parseController(drafts.A.latex),cb=parseController(drafts.B.latex),H=readNumericInput(number('horizon'),'common horizon'),tol=Number(select('tolerance').value);
      const ra=simulate(model,ca,H,tol),rb=simulate(model,cb,H,tol);runs={A:ra,B:rb};number('time').max=String(H);number('time').value=f(H/2);
      status.textContent=`Computed A on${ra.intervals} and B on${rb.intervals} intervals, both over0…${f(H)}s. ${ra.stability.stable&&rb.stability.stable?'Both chosen realizations satisfy strict Hurwitz conditions.':'Strict stability is not established for at least one run: its finite-horizon cost is not a recommendation.'}`;
      inspect();
    }catch(error){status.textContent=error instanceof Error?error.message:'Check the model and horizon.';}
  }
  function preset(kind:string):void{
    plant.setValue(String.raw`G(s)=\frac{1}{(s+1)(s+2)}`);
    A.setValue(kind==='ranking'?String.raw`C(s)=\frac{0.5s+0.5}{s}`:'C(s)=4');
    B.setValue(kind==='ranking'?String.raw`C(s)=\frac{2s+0.25}{s}`:kind==='unstable'?String.raw`C(s)=\frac{20s+100}{s}`:'C(s)=8');
    number('horizon').value=kind==='unstable'?'0.3':'10';select('tolerance').value='0.00001';select('metric').value='IAE';select('run').value='A';select('prediction').value='';compute();
  }
  function reveal():void{
    if(!runs){status.textContent='Compute a valid comparison before revealing totals.';return;}
    const m=metric(),r=ranking(runs.A.totals[m],runs.B.totals[m]),prediction=select('prediction').value;
    feedback.textContent=prediction?`${prediction===r?'Correct.':'Check your prediction.'} ${m}: ${r==='tie'?'tie within tolerance':`${r} has the lower finite-horizon score`}.`:'Choose a prediction to compare; the checked totals are below.';
    answer.hidden=false;
    const table=document.createElement('table');table.innerHTML='<thead><tr><th>Criterion</th><th>Units</th><th>Run A</th><th>Run B</th><th>Lower score</th></tr></thead>';const body=document.createElement('tbody');
    for(const name of metrics){const row=document.createElement('tr');const win=ranking(runs.A.totals[name],runs.B.totals[name]);for(const text of[name,unit[name],f(runs.A.totals[name]),f(runs.B.totals[name]),win]){const cell=document.createElement('td');cell.textContent=text;row.append(cell);}body.append(row);}table.append(body);q('.cf-table').replaceChildren(table);
    const errorRanks=metrics.slice(0,4).map(name=>`${name}: ${ranking(runs!.A.totals[name],runs!.B.totals[name])}`);
    q('.cf-explanation').textContent=`${errorRanks.join('; ')}. Different rankings follow different weights: ISE/ITSE square the error, and ITAE/ITSE multiply it by elapsed time. Use early and late panel contributions to inspect the tradeoff. Control effort measures u² separately in U²·s; no unweighted collection of these costs defines one optimum.`;
    const split=document.createElement('table'),caption=document.createElement('caption');caption.textContent=`Cost contributions split at t=${f(runs.A.horizon/2)}s (same units as the main table)`;split.append(caption);
    const head=document.createElement('thead');head.innerHTML='<tr><th>Criterion</th><th>A early</th><th>A late</th><th>B early</th><th>B late</th></tr>';split.append(head);
    const splitBody=document.createElement('tbody');
    for(const name of metrics.slice(0,4)){
      const row=document.createElement('tr'),earlyA=panel(runs.A,runs.A.horizon/2-runs.A.horizon/runs.A.intervals,name).cumulative,earlyB=panel(runs.B,runs.B.horizon/2-runs.B.horizon/runs.B.intervals,name).cumulative;
      for(const value of[name,f(earlyA),f(runs.A.totals[name]-earlyA),f(earlyB),f(runs.B.totals[name]-earlyB)]){const cell=document.createElement('td');cell.textContent=value;row.append(cell);}splitBody.append(row);
    }
    split.append(splitBody);q('.cf-split').replaceChildren(split);
    const reasoning=q('.cf-reasoning');reasoning.replaceChildren();
    const equation=(latex:string,label:string)=>reasoning.append(createEquationDisplay(latex,label));
    equation(`e(t)=1-y(t),\\quad u(t)=K_pe(t)+K_i\\int_0^t e(\\tau)\\,d\\tau`,'Unity negative feedback and P/PI controller');
    equation(`${m==='Effort'?'J_u':m}=\\int_0^{${ln(runs.A.horizon)}}${expression[m]}\\,dt`,'Selected finite-horizon integral');
    for(const name of['A','B']as const){const run=runs[name];equation(`G(s)=${plantLatex(run.plant)},\\quad C_${name}(s)=${controllerLatex(run.controller)}`,`Run${name} model`);equation(`D_${name}(s)=${poly(run.stability.characteristic)}`,`Run${name} full characteristic polynomial`);
      const p=document.createElement('p');p.textContent=`Run${name}: ${run.stability.stable?'strict Hurwitz conditions satisfied':'strict stability not established (failed/boundary Hurwitz condition)'}. ${run.stability.conditions.map(c=>`${c.label}: ${f(c.value)} (${c.passed?'pass':'not strict'})`).join('; ')}. Refinement change=${f(run.refinementChange)}, requested=${f(run.tolerance)}, intervals=${run.intervals}. Sampled max|u|=${f(run.sampledPeakControl)}U.`;reasoning.append(p);
    }
    const note=document.createElement('p');note.textContent='Characteristic coefficients use descending powers of s and retain all states of the chosen P/PI realization. A zero integral gain selects P with no integral state. Calculations use zero plant state and zero PI integral; the continuous input may jump at t=0 but has no derivative impulse. Costs remain finite-horizon numerical approximations, including when a short unstable trajectory fits on the plot.';reasoning.append(note);
  }
  function verify():void{
    q('.cf-verification').textContent='';if(!runs)return;
    try{const name=select('run').value as 'A'|'B',m=metric(),r=runs[name],check=verifyIntegral(r,m);q('.cf-verification').textContent=`Run${name}, ${m}: original Simpson=${f(r.totals[m])}${unit[m]}; independent composite trapezoid on${check.intervals} intervals=${f(check.trapezoid)}${unit[m]}; finer Simpson=${f(check.fineSimpson)}${unit[m]}. Refined tolerance=${f(check.tolerance)} (ten times tighter); independent-rule normalized difference=${f(check.ruleChange)}, original-score difference=${f(check.relativeChange)}. ${check.consistent?'Consistent within5× the refined rule tolerance and5× the original-score tolerance.':'Not established at this check tolerance; request finer refinement before relying on the score.'} This checks quadrature consistency on a finer state grid, not a certified exact-integral error bound.`;}catch(error){q('.cf-verification').textContent=error instanceof Error?error.message:'Integral check failed.';}
  }
  number('horizon').addEventListener('input',invalidate,{signal});select('tolerance').addEventListener('change',invalidate,{signal});number('time').addEventListener('input',inspect,{signal});
  for(const name of['metric','run'])select(name).addEventListener('change',()=>{feedback.textContent='';q('.cf-verification').textContent='';select('prediction').value='';inspect();},{signal});
  root.querySelectorAll<HTMLButtonElement>('[data-action]').forEach(button=>button.addEventListener('click',()=>{const action=button.dataset.action!;if(action==='compute')compute();else if(action==='reveal')reveal();else if(action==='verify')verify();else preset(action);},{signal}));
  compute();
  return()=>{runs=undefined;plant.destroy();A.destroy();B.destroy();root.remove();};
};
