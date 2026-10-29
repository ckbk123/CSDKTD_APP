import type {ModuleMount} from '../../core/module';
import {createEquationDisplay,createEquationInput,type EquationInput} from '../../shared/equations/input';
import {readNumericInput} from '../../shared/numeric-input';
import {build,match,simulate,standard,type Controller,type Kind,type Model,type Options,type Run} from './math';
import {parsePlant,parseTarget} from './parser';
import './style.css';
const INITIAL=String.raw`G(s)=\frac{1}{(s+1)(s+2)}`;
const el=<K extends keyof HTMLElementTagNameMap>(tag:K,text?:string):HTMLElementTagNameMap[K]=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e;};
const plain=(v:number)=>v===0?'0':Number(v.toPrecision(7)).toString();
const fmt=(v:number)=>plain(v).replace(/e([+-]?\d+)/,(_,p:string)=>` × 10^${Number(p)}`);
const tex=(v:number)=>{const [a,b]=plain(v).split('e');return b===undefined?a:`${a}\\times10^{${Number(b)}}`;};
const matrix=(a:readonly number[],n:number)=>`\\begin{bmatrix}${a.map((v,i)=>tex(v)+(i===a.length-1?'':(i+1)%n?'&':'\\\\')).join('')}\\end{bmatrix}`;
const poly=(p:readonly number[])=>p.map((v,i)=>`(${tex(v)})${p.length-i-1?`s${p.length-i-1>1?`^{${p.length-i-1}}`:''}`:''}`).join('+');
const poles=(m:Model)=>m.poles.map(([a,b])=>`${fmt(a)}${b?` ${b<0?'−':'+'} j ${fmt(Math.abs(b))}`:''}`).join('; ');
const button=(text:string,action:string)=>{const b=el('button',text);b.type='button';b.dataset.action=action;return b;};
const svgEl=(tag:string,attributes:Record<string,string|number>,text?:string)=>{const e=document.createElementNS('http://www.w3.org/2000/svg',tag);Object.entries(attributes).forEach(([k,v])=>e.setAttribute(k,String(v)));if(text!==undefined)e.textContent=text;return e;};
interface Trial {label:string;model:Model;run:Run}
interface Requirements {error:number;overshoot:number;window:number;effort:number}

export const mount:ModuleMount=({container,signal})=>{
  const root=el('div');root.className='pid-tool';container.append(root);
  const status=el('p');status.setAttribute('role','status');const view=el('div'),history=el('div');
  let selected:Trial,comparisons:Trial[]=[],comparisonNotes:string[]=[],applied:Options,requirements:Requirements,matchedTarget:number[]|null=null,revealed=false,inspectTime=0;
  const attempts={error:'',effort:''},notes:{reason:string;summary:string}[]=[];
  const invalidate=()=>{view.replaceChildren();revealed=false;status.textContent='Draft changed. Choose a reason and apply the trial to recompute.';};
  const intro=el('section');intro.append(el('h3','Choose a linear controller and test the complete result'),el('p','Set the performance requirements, choose a structure and record a reason before applying changed gains. Compare tracking accuracy, transients and effort; the same pole pair alone does not describe every controller.'));
  intro.append(createEquationDisplay(String.raw`e=r-y,\quad u=u_P+u_I+u_D,\quad y=G(s)u,\quad\text{negative unity feedback}`, 'Error and negative-feedback signal convention'));
  const editors:EquationInput[]=[];
  function equation(label:string,value:string):EquationInput{
    const e=createEquationInput({label,value,signal,onChange:invalidate});editors.push(e);
    e.element.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();e.element.querySelector<HTMLButtonElement>('button[aria-pressed="true"]')?.click();}},{capture:true,signal});return e;
  }
  const plantEditor=equation('Plant G(s): constant over quadratic',INITIAL),targetEditor=equation('Desired monic characteristic polynomial','q(s)=(s+17)(s+2)^3');
  intro.append(plantEditor.element);
  function numeric(parent:HTMLElement,label:string,name:string,value:string):HTMLInputElement{
    const wrap=el('label',label),input=el('input');input.type='number';input.step='any';input.name=name;input.value=value;input.setAttribute('aria-label',label);wrap.append(input);parent.append(wrap);return input;
  }
  function select(parent:HTMLElement,label:string,name:string,items:[string,string][]):HTMLSelectElement{
    const wrap=el('label',label),input=el('select');input.name=name;input.setAttribute('aria-label',label);items.forEach(([value,text])=>{const option=el('option',text);option.value=value;input.append(option);});wrap.append(input);parent.append(wrap);return input;
  }
  const request=el('fieldset');request.append(el('legend','1. State the requirements'));
  const reqRow=el('div');reqRow.className='pid-controls';request.append(reqRow);
  const errorLimit=numeric(reqRow,'Maximum steady |r−y| (output units)','errorLimit','.01'),osLimit=numeric(reqRow,'Maximum overshoot (% final value)','osLimit','10'),windowLimit=numeric(reqRow,'Observed 2% window begins by (s)','windowLimit','4'),effortLimit=numeric(reqRow,'Maximum sampled |u| (input units)','effortLimit','30');
  request.append(el('p','The 2% window and overshoot refer to the analytic final output when it exists. Command tracking is checked separately. Sampled windows/peaks describe the plotted horizon; they do not certify all future times.'));
  const gains=el('fieldset');gains.append(el('legend','2. Choose structure and gains'));
  const gainRow=el('div');gainRow.className='pid-controls';gains.append(gainRow);
  const kind=select(gainRow,'Controller structure','kind',[['P','P'],['PI','PI'],['PD','PD with derivative filter'],['PID','PID with derivative filter']]);kind.value='PID';
  const kp=numeric(gainRow,'Kp (input/output)','kp','4'),ki=numeric(gainRow,'Ki (input/(output·s))','ki','2'),kd=numeric(gainRow,'Kd (input·s/output)','kd','1'),tf=numeric(gainRow,'Derivative-filter Tf (s)','tf','.05');
  const compareWrap=el('label','Compare P, PI and filtered PID with these gains '),compare=el('input');compare.type='checkbox';compare.name='compare';compare.checked=true;compareWrap.append(compare);gains.append(compareWrap);
  gains.append(el('p','Integral action can remove constant step error only when the complete loop is stable. Derivative action can change damping, but requires its declared filter. Inactive controller terms add no states; retained plant modes are always checked. Gains not used by the selected structure remain available for the comparison.'));
  const initial=el('fieldset');initial.append(el('legend','Initial conditions and plotted experiment'));
  const initialRow=el('div');initialRow.className='pid-controls';initial.append(initialRow);
  const y0=numeric(initialRow,'Initial y(0)','y0','0'),v0=numeric(initialRow,'Initial ẏ(0) (output/s)','v0','0'),i0=numeric(initialRow,'Initial integral I(0) (output·s)','i0','0'),f0=numeric(initialRow,'Initial filter v(0) (output)','f0','0'),reference=numeric(initialRow,'Held reference r (output)','reference','1'),horizon=numeric(initialRow,'Plot horizon (s)','horizon','20');
  const why=select(intro,'Reason for this trial','reason',[['','Choose a reason before applying changes'],['accuracy','Improve steady tracking'],['transient','Change overshoot or transient speed'],['effort','Reduce control effort'],['structure','Compare controller structures'],['matching','Test analytic pole placement'],['data','Test changed plant or initial data']]);
  const actions=el('div');actions.className='pid-actions';actions.append(button('Apply trial and record reason','apply'),button('Load course data as a draft','baseline'));
  const matching=el('details');matching.append(el('summary','3. Derive gains by coefficient matching'),targetEditor.element,el('p','P leaves a₁ fixed. PI leaves its next-leading coefficient a₁ fixed. With a fixed Tf, filtered PD/PID leave a₁+1/Tf fixed. An incompatible target is feedback about this structure, not a successful design.'));
  const matchingFormula=el('div');
  function explainMatching():void{
    const identities:Record<Kind,string>={
      P:String.raw`d_1=a_1,\quad d_0=a_0+bK_p,\quad K_p=(d_0-a_0)/b`,
      PI:String.raw`d_2=a_1,\quad d_1=a_0+bK_p,\quad d_0=bK_i,\quad K_p=(d_1-a_0)/b,\quad K_i=d_0/b`,
      PD:String.raw`d_2=a_1+1/T_f,\quad d_1=a_1/T_f+a_0+bK_p+bK_d/T_f,\quad d_0=(a_0+bK_p)/T_f`,
      PID:String.raw`d_3=a_1+1/T_f,\quad d_2=a_1/T_f+a_0+bK_p+bK_d/T_f,\quad d_1=(a_0+bK_p)/T_f+bK_i,\quad d_0=bK_i/T_f`,
    };
    matchingFormula.replaceChildren(createEquationDisplay(identities[kind.value as Kind],'Coefficient-matching identities for the selected structure'));
    if(kind.value==='PD')matchingFormula.append(createEquationDisplay(String.raw`K_p=(T_fd_0-a_0)/b,\quad K_d=(T_fd_1-a_1-T_fa_0-bK_pT_f)/b`,'Solved filtered PD matching equations'));
    if(kind.value==='PID')matchingFormula.append(createEquationDisplay(String.raw`K_i=T_fd_0/b,\quad K_p=(T_fd_1-a_0-bK_iT_f)/b,\quad K_d=(T_fd_2-a_1-T_fa_0-bK_pT_f)/b`,'Solved filtered PID matching equations'));
  }
  explainMatching();kind.addEventListener('input',explainMatching,{signal});
  matching.append(matchingFormula,button('Load authored target for course plant','target'),button('Set Tf from target coefficient','setFilter'),button('Derive gains and apply with reason','derive'));
  const limits=el('details');limits.append(el('summary','Supported model, units and numerical limits'),
    el('p','Real continuous SISO G=b/(s²+a₁s+a₀), D=0 and negative unity feedback. The denominator may be expanded/factored and is normalized to monic form. Numerator is one evaluated nonzero constant; plant zeros, delays, MIMO and nonlinear hardware are outside this bounded exercise. Parallel C=Kp+Ki/s+Kd·s/(Tf·s+1); derivative acts on error. Its finite initial kick is included. Filter state v obeys Tf·v̇=e−v; İ=e. Initial states are independent; inactive terms ignore their initial controller memories.'),
    el('p','|b|=10⁻⁶–100, |a₁|,|a₀|≤100; gains magnitude≤100; active Tf=.001–10s; closed state/input entries≤10⁶. Targets monic degree2–4, parser coefficients≤10⁸. Decimals≤8 integer/12 fractional digits; numeric fractions including signed/compact forms;160 tokens,nesting12,600 characters. Unsupported e/E, mixed adjacency, hidden grouping, ambiguous powers and unbraced spacing arguments reject. Native numeric exponents use their separate number-control grammar.'),
    el('p','All active closed-state modes are computed. Matrix/formula coefficient discrepancy≤10⁻⁹; roots use normalized residual10⁻⁹ and complete Vieta check10⁻⁸. Repeated roots are numerically sensitive; stability uses real-part tolerance10⁻⁸·max(1,mode magnitude). Initial/reference magnitude≤100; horizon.1–100s;801 samples,response≤10⁸. Augmented exponential order≤5,30 scaling steps,24 Taylor terms,reduced norm≤.5,term tolerance10⁻¹⁶. Coarse mode resolution is warned about; no sampled endpoint is called settled forever.'));
  intro.append(request,gains,initial,actions,matching,status,limits);root.append(intro,history,view);
  for(const controls of [request,gains,initial])controls.addEventListener('input',invalidate,{signal});
  const read=(input:HTMLInputElement,label=input.getAttribute('aria-label')??input.name)=>readNumericInput(input,label);
  function readRequirements():Requirements{
    const r={error:read(errorLimit),overshoot:read(osLimit),window:read(windowLimit),effort:read(effortLimit)};
    if(r.error<0||r.error>100||r.overshoot<0||r.overshoot>1000||r.window<=0||r.window>100||r.effort<=0||r.effort>1e8)throw new Error('Use error0–100, overshoot0–1000%, window0–100s (positive) and effort0–10⁸ (positive).');return r;
  }
  function record(reason:string):void{
    const m=selected.model,r=selected.run;notes.unshift({reason,summary:`${m.controller.kind} (active ${m.activeKind}): Kp=${fmt(m.controller.kp)}, Ki=${fmt(m.controller.ki)}, Kd=${fmt(m.controller.kd)}, Tf=${fmt(m.controller.tf)}s; ${m.stability}; steady error=${r.steadyError===null?'unavailable':fmt(r.steadyError)}, sampled peak|u|=${fmt(r.peakEffort)}.`});notes.splice(8);
    history.replaceChildren(el('h3','Temporary trial notes'));const list=el('ol');notes.forEach(n=>list.append(el('li',`${n.reason}: ${n.summary}`)));history.append(list,el('p','Up to eight applied reasons/results stay in this visit. Draft edits do not change a trial until Apply; reset/reopen clears the notes.'));
  }
  function apply(reason:string,derive=false):void{
    const draft=plantEditor.getValue();if(draft.empty||draft.hasPlaceholders||draft.syntaxIssues.length)throw new Error('Complete the plant fraction and notation.');
    const plant=parsePlant(draft.latex),nextRequirements=readRequirements();
    let controller:Controller={kind:kind.value as Kind,kp:read(kp),ki:read(ki),kd:read(kd),tf:read(tf)};
    let desired:number[]|null=null;
    if(derive){const d=targetEditor.getValue();if(d.empty||d.hasPlaceholders||d.syntaxIssues.length)throw new Error('Complete the desired target polynomial.');desired=parseTarget(d.latex,controller.kind==='P'?2:controller.kind==='PID'?4:3);controller=match(plant,controller.kind,desired,controller.tf);}
    const options:Options={initial:[read(y0),read(v0)],integral:read(i0),filter:read(f0),reference:read(reference),horizon:read(horizon)};
    const model=build(plant,controller),run=simulate(model,options),others:Trial[]=[],unavailable:string[]=[];
    if(compare.checked)for(const k of ['P','PI','PID'] as Kind[])if(k!==controller.kind){try{const m=build(plant,{...controller,kind:k});others.push({label:k,model:m,run:simulate(m,options)});}catch(error){unavailable.push(`${k} comparison unavailable: ${error instanceof Error?error.message:'check its bounds'}`);}}
    if(derive){kp.value=String(controller.kp);ki.value=String(controller.ki);kd.value=String(controller.kd);}
    selected={label:`Selected ${controller.kind}`,model,run};comparisons=others;comparisonNotes=unavailable;applied=options;requirements=nextRequirements;matchedTarget=desired;revealed=false;inspectTime=0;attempts.error='';attempts.effort='';record(reason);why.value='';render();status.textContent='Trial applied and reason recorded. Predict tracking error and initial effort, then reveal the complete check.';
  }
  function plot(label:string,series:{name:string;values:number[];style:string}[]):HTMLElement{
    const figure=el('figure');figure.append(el('figcaption',label));const values=series.flatMap(s=>s.values);let low=Math.min(0,...values),high=Math.max(0,...values);if(high===low){low--;high++;}const pad=.1*(high-low);low-=pad;high+=pad;
    const X=(i:number)=>88+385*i/(selected.run.samples.length-1),Y=(v:number)=>185-155*(v-low)/(high-low),index=Math.round(inspectTime/applied.horizon*(selected.run.samples.length-1));
    const svg=svgEl('svg',{viewBox:'0 0 500 225',role:'img','aria-label':`${label}; time0–${applied.horizon}s. ${series.map(s=>s.name).join('; ')}. Sampled values in the numeric table.`});
    const axis=(v:number)=>Math.abs(v)>0&&(Math.abs(v)<.001||Math.abs(v)>10000)?v.toExponential(1):Number(v.toPrecision(3)).toString();
    svg.append(svgEl('line',{x1:88,x2:478,y1:185,y2:185,class:'pid-axis'}),svgEl('line',{x1:88,x2:88,y1:25,y2:185,class:'pid-axis'}),svgEl('text',{x:83,y:30,'text-anchor':'end'},axis(high)),svgEl('text',{x:83,y:185,'text-anchor':'end'},axis(low)),svgEl('text',{x:88,y:204},'0'),svgEl('text',{x:478,y:204,'text-anchor':'end'},fmt(applied.horizon)),svgEl('text',{x:235,y:219},'Time t (s)'));
    series.forEach(s=>svg.append(svgEl('path',{d:s.values.map((v,i)=>`${i?'L':'M'}${X(i).toFixed(3)},${Y(v).toFixed(3)}`).join(' '),class:s.style}),svgEl('circle',{cx:X(index),cy:Y(s.values[index]),r:3,class:'pid-marker'})));
    const scroll=el('div');scroll.className='pid-plot-scroll';scroll.tabIndex=0;scroll.setAttribute('role','region');scroll.setAttribute('aria-label',`${label} plot; scroll horizontally for readable axes`);scroll.append(svg);figure.append(scroll,el('p',series.map(s=>s.name).join(' · ')));return figure;
  }
  function metricTable():HTMLTableElement{
    const table=el('table');table.className='pid-metrics';table.append(el('caption','Independent structure comparisons: same entered plant, initial memories and reference. Metrics are finite-window observations except analytic stable DC error.'));
    const header=el('tr');['Structure / actual order','Steady error','Overshoot % final','Observed 2% window start (s)','Sample peak |u|'].forEach(s=>header.append(el('th',s)));table.append(header);
    for(const trial of [selected,...comparisons]){const row=el('tr'),r=trial.run,m=trial.model;[`${trial.label}, active ${m.activeKind}, ${m.order} modes; ${m.stability}`,r.steadyError===null?'unavailable':fmt(r.steadyError),r.overshootFinal===null?'undefined':fmt(r.overshootFinal),r.observedFinalWindowStart===null?'undefined / insufficient window':fmt(r.observedFinalWindowStart),fmt(r.peakEffort)].forEach(s=>row.append(el('td',s)));table.append(row);}
    return table;
  }
  function scrollTable(table:HTMLTableElement,label:string):HTMLElement{const region=el('div');region.className='pid-table-scroll';region.tabIndex=0;region.setAttribute('role','region');region.setAttribute('aria-label',label);region.append(table);return region;}
  function render():void{
    if(signal.aborted)return;const active=document.activeElement instanceof HTMLElement&&view.contains(document.activeElement)?document.activeElement:null,action=active?.dataset.action,name=active instanceof HTMLInputElement?active.name:undefined;
    view.replaceChildren();const m=selected.model,c=m.controller,r=selected.run;
    const exercise=el('section');exercise.append(el('h3','4. Predict tracking and the first control effort'),el('p',`Selected ${c.kind}; active ${m.activeKind}. Initial plant y=${fmt(applied.initial[0])}, ẏ=${fmt(applied.initial[1])}; held reference=${fmt(applied.reference)}. An inactive term adds no state.`));
    const prediction=el('div');prediction.className='pid-controls';numeric(prediction,'Your stable steady error r−y∞','predictError',attempts.error);numeric(prediction,'Your initial control u(0)','predictEffort',attempts.effort);exercise.append(prediction,button('Check my prediction','predict'),button(revealed?'Hide complete check':'Reveal complete check','reveal'));const feedback=el('p');feedback.dataset.prediction='';feedback.setAttribute('role','status');exercise.append(feedback);view.append(exercise);
    if(revealed){
      const terms=el('section');terms.append(el('h3','5. Keep controller form and filter explicit'),createEquationDisplay(`C(s)=(${tex(c.kp)})${c.ki?`+\\frac{${tex(c.ki)}}{s}`:''}${c.kd?`+\\frac{(${tex(c.kd)})s}{(${tex(c.tf)})s+1}`:''}`, 'Applied parallel controller, inactive terms omitted'),createEquationDisplay(String.raw`u_P=K_pe`+(c.ki?String.raw`,\quad\dot I=e,\quad u_I=K_iI`:String.raw`,\quad u_I=0`)+(c.kd?String.raw`,\quad T_f\dot v=e-v,\quad u_D=\frac{K_d}{T_f}(e-v)`:String.raw`,\quad u_D=0`), 'Individual active controller contributions'));
      const converted=standard(c);if(converted)terms.append(createEquationDisplay(`C(s)=(${tex(c.kp)})\\left(1+${converted.ti===null?'0':`\\frac{1}{(${tex(converted.ti)})s}`}+\\frac{(${tex(converted.td)})s}{(${tex(converted.tf)})s+1}\\right)`, 'Equivalent standard controller notation'),el('p',`Ti=${converted.ti===null?'inactive':fmt(converted.ti)+'s'}, Td=${fmt(converted.td)}s, Tf=${fmt(converted.tf)}s. These are an algebraic conversion, not a new tuning rule.`));else terms.append(el('p','Kp=0: the parallel controller is valid, but a standard form factored by Kp is unavailable.'));
      terms.append(el('p',`Derivative acts on error; with zero initial memories the filtered step kick contributes Kd/Tf·r. The displayed u(0) includes it. There is no actuator saturation or nonlinear refinement in this model.`));
      const check=el('section');check.append(el('h3','6. Check every active mode and the requirements'),createEquationDisplay(`p(s)=${poly(m.polynomial)}`, 'Full characteristic polynomial from loop coefficients'),createEquationDisplay(`A_{\\mathrm{cl}}=${matrix(m.matrix,m.order)}`, 'Actual complete closed-state matrix'),el('p',`State order: y, ẏ${m.integralIndex>=0?', I':''}${m.filterIndex>=0?', v':''}. All ${m.order} actual modes: ${poles(m)}. Classification: ${m.stability}. Matrix/formula coefficient residual=${fmt(m.residual)}. No plant mode is discarded if an output factor cancels.`));
      check.append(el('p','Modes are numerical approximations. Repeated roots can split under coefficient rounding; the normalized polynomial and complete-coefficient checks remain separate from their displayed digits.'));
      if(matchedTarget){
        check.append(createEquationDisplay(`q_{\\mathrm{desired}}(s)=${poly(matchedTarget)}`,'Applied desired polynomial for the matched trial'));
        const table=el('table');table.append(el('caption','Desired versus actual monic coefficients after solving gains'));const header=el('tr');['Power','Desired','Actual','Difference'].forEach(s=>header.append(el('th',s)));table.append(header);
        matchedTarget.forEach((value,i)=>{const row=el('tr');[String(m.order-i),fmt(value),fmt(m.actual[i]),fmt(m.actual[i]-value)].forEach(s=>row.append(el('td',s)));table.append(row);});check.append(scrollTable(table,'Matched coefficient check; scroll horizontally'));
      }
      if(r.steadyError!==null&&Math.abs(r.steadyError)>requirements.error&&m.integralIndex<0)check.append(el('p','Structure cue: this P/PD choice retains too much constant-reference error. Test integral action or a different proportional gain, then recheck the complete transient and effort.'));
      if(m.integralIndex>=0)check.append(el('p','Structure cue: integral action is active. Zero stable DC error does not establish the requested overshoot, window or effort; use the full comparison before refining gains.'));
      check.append(el('p',`Steady error requirement ${fmt(requirements.error)}: ${r.steadyError===null?'unavailable because strict stability is not established':Math.abs(r.steadyError)<=requirements.error?'passes the analytic stable-model DC check':'fails the analytic stable-model DC check'}.`),el('p',`Final-value overshoot limit ${fmt(requirements.overshoot)}%: ${r.overshootFinal===null?'undefined':r.overshootFinal<=requirements.overshoot?'passes over the plotted samples':'exceeds the limit in the plotted samples'}. Sampled effort limit ${fmt(requirements.effort)}: ${r.peakEffort<=requirements.effort?'passes over the plotted samples':'exceeds the limit in the plotted samples'}.`),el('p',`Observed 2% final-value window by ${fmt(requirements.window)}s: ${m.stability!=='stable'?'strict stability is not established':r.finalValue===0?'percentage window is undefined for zero final output':!r.inFinalBandAtEnd?'insufficient horizon or response remains outside the band':r.observedFinalWindowStart!<=requirements.window?'observed over the remaining plotted samples':'not observed by the requested time'}. A finite-window check is not a proof of permanent settling.`));
      check.append(scrollTable(metricTable(),'Structure metric comparison; scroll horizontally'));
      comparisonNotes.forEach(note=>check.append(el('p',note)));
      const plots=el('section');plots.append(el('h3','7. Compare output, error and effort'),el('p',`Analytic final output=${r.finalValue===null?'unavailable':fmt(r.finalValue)}; overshoot relative to command=${r.overshoot===null?'undefined':fmt(r.overshoot)+'%'}. Command tracking and settling near a different final value are distinct.`));
      if([selected,...comparisons].some(t=>t.run.coarse))plots.append(el('p',`Sampling warning: Δt=${fmt(r.step)}s is coarse for at least one mode. Shorten the horizon to inspect fast peaks/filter motion; sampled maxima may miss intersample peaks.`));
      const styles=['pid-current','pid-dashed','pid-dotted','pid-longdash'],trials=[selected,...comparisons],grid=el('div');grid.className='pid-plots';
      grid.append(plot('Output y(t) (output units)',trials.map((t,i)=>({name:`${t.label} (${['solid','dashed','dotted','long dash'][i]})`,values:t.run.samples.map(s=>s.y),style:styles[i]}))),plot('Total control u(t) (input units)',trials.map((t,i)=>({name:t.label,values:t.run.samples.map(s=>s.u),style:styles[i]}))),plot('Tracking error r−y (output units)',trials.map((t,i)=>({name:t.label,values:t.run.samples.map(s=>s.error),style:styles[i]}))),plot('Selected controller terms (input units)',[{name:'P: solid',values:r.samples.map(s=>s.p),style:'pid-current'},{name:'I: dashed',values:r.samples.map(s=>s.i),style:'pid-dashed'},{name:'D: dotted',values:r.samples.map(s=>s.d),style:'pid-dotted'}]));plots.append(grid);
      const inspect=el('div');inspect.className='pid-actions';numeric(inspect,'Inspect time (s)','inspectTime',String(inspectTime));inspect.append(button('Inspect nearest sample','time'));plots.append(inspect);
      const sample=r.samples[Math.round(inspectTime/applied.horizon*(r.samples.length-1))],table=el('table');table.append(el('caption',`Selected trial nearest sample t=${fmt(sample.t)}s;801 computed samples.`));const head=el('tr');['Signal','Value in declared units'].forEach(v=>head.append(el('th',v)));table.append(head);
      for(const [label,value] of [['Output y',sample.y],['Output derivative ẏ',sample.velocity],['Tracking error',sample.error],['Integral state I',sample.integral],['Filter state v',sample.filter],['Proportional effort',sample.p],['Integral effort',sample.i],['Derivative effort',sample.d],['Total effort',sample.u]] as const){const row=el('tr'),heading=el('th',label);heading.scope='row';row.append(heading,el('td',fmt(value)));table.append(row);}plots.append(scrollTable(table,'Selected trial numeric sample table; scroll horizontally'));
      view.append(terms,check,plots);
    }
    if(active&&!active.isConnected){const replacement=action?[...view.querySelectorAll<HTMLButtonElement>('button[data-action]')].find(b=>b.dataset.action===action):[...view.querySelectorAll<HTMLInputElement>('input[name]')].find(i=>i.name===name);replacement?.focus({preventScroll:true});}
  }
  const reasons:Record<string,string>={accuracy:'Improve steady tracking',transient:'Change overshoot or transient speed',effort:'Reduce control effort',structure:'Compare controller structures',matching:'Test analytic pole placement',data:'Test changed plant or initial data'};
  root.addEventListener('input',event=>{const input=event.target;if(input instanceof HTMLInputElement&&(input.name==='predictError'||input.name==='predictEffort')){attempts[input.name==='predictError'?'error':'effort']=input.value;view.querySelector('[data-prediction]')?.replaceChildren();}},{signal});
  root.addEventListener('click',event=>{
    const action=(event.target as Element).closest<HTMLButtonElement>('button[data-action]')?.dataset.action;if(!action)return;
    try{
      if(action==='apply'||action==='derive'){if(!reasons[why.value])throw new Error('Choose a reason before applying a changed trial.');apply(reasons[why.value],action==='derive');}
      else if(action==='baseline'){plantEditor.setValue(INITIAL);kind.value='PID';for(const [input,value]of[[kp,'4'],[ki,'2'],[kd,'1'],[tf,'.05'],[y0,'0'],[v0,'0'],[i0,'0'],[f0,'0'],[reference,'1'],[horizon,'20']]as const)input.value=value;compare.checked=true;invalidate();status.textContent='Course data loaded as a draft. Choose a reason, then apply.';}
      else if(action==='target'){targetEditor.setValue(kind.value==='P'?'q(s)=(s+1.5)^2':kind.value==='PI'?'q(s)=(s+1)^3':kind.value==='PD'?'q(s)=(s+17)(s+3)^2':'q(s)=(s+17)(s+2)^3');status.textContent='Authored target draft for the course plant/Tf=.05. Changed plant or filter values can make it incompatible. Choose a reason before deriving.';}
      else if(action==='setFilter'){if(kind.value==='P'||kind.value==='PI')throw new Error('P/PI has no derivative-filter coefficient to set.');const d=targetEditor.getValue(),p=parsePlant(plantEditor.getValue().latex),q=parseTarget(d.latex,kind.value==='PID'?4:3),value=1/(q[1]-p.a1);if(!Number.isFinite(value)||value<.001||value>10)throw new Error('Target next-leading coefficient cannot give a supported positive Tf.');tf.value=String(value);invalidate();status.textContent='Filter draft set from the target coefficient. Choose a reason and derive the gains to verify the full result.';}
      else if(action==='reveal'){revealed=!revealed;render();}
      else if(action==='predict'){const e=read(view.querySelector<HTMLInputElement>('input[name="predictError"]')!),u=read(view.querySelector<HTMLInputElement>('input[name="predictEffort"]')!),r=selected.run,agrees=(a:number,b:number)=>b===0?a===0:Math.abs(a-b)<=1e-7*Math.abs(b);view.querySelector('[data-prediction]')!.textContent=r.steadyError===null?'A stable-model steady error is unavailable; check every mode first.':agrees(e,r.steadyError)&&agrees(u,r.samples[0].u)?'Prediction agrees with the stable DC calculation and the initial controller memories.':'Recheck the stable DC error and all three effort terms, including the filtered derivative kick.';}
      else if(action==='time'){const value=read(view.querySelector<HTMLInputElement>('input[name="inspectTime"]')!);if(value<0||value>applied.horizon)throw new Error('Inspection time must lie inside the horizon.');inspectTime=value;render();}
    }catch(error){status.textContent=error instanceof Error?error.message:'Check the controller inputs.';}
  },{signal});
  view.addEventListener('keydown',event=>{if(event.key==='Enter'&&(event.target as HTMLInputElement).name==='inspectTime'){event.preventDefault();view.querySelector<HTMLButtonElement>('button[data-action="time"]')?.click();}},{signal});
  try{apply('Course baseline on initial visit');}catch(error){status.textContent=error instanceof Error?error.message:'Check the model.';}
  return()=>{editors.forEach(e=>e.destroy());root.remove();};
};
