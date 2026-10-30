import type { ModuleMount } from '../../core/module';
import { createEquationDisplay as equationMarkup, createEquationInput, type EquationInput } from '../../shared/equations/input';
import { readNumericInput } from '../../shared/numeric-input';
import { Work, constant, latex, same, type Gain } from './algebra';
import { drawGraph } from './diagram';
import { baseline as nested, disjoint, type DraftNet } from './fixtures';
import { parseGain } from './input';
import { analyze, numericCheck, sharedNodes, trace, validate, type Analysis, type Net } from './mason';
import { causalUpdate, convert, samples, sourceDefault, type Boundary, type Conversion, type Feedback, type SourceDraft } from './model';
import './style.css';

function el<K extends keyof HTMLElementTagNameMap>(tag:K,text?:string):HTMLElementTagNameMap[K]{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e;}
function createEquationDisplay(tex:string,label:string){const e=equationMarkup(tex,label);e.tabIndex=0;return e;}
type Row={id:string;from:HTMLSelectElement;to:HTMLSelectElement;gain:EquationInput;host:HTMLElement;life:AbortController};
const signalTex=(name:string)=>`\\mathrm{${name}}(z)`;
export const mount:ModuleMount=({container,signal:parent})=>{
  if(parent.aborted)return;
  const lifetime=new AbortController(),signal=lifetime.signal,root=el('div');root.dataset.module='DR04';container.append(root);
  const editors=new Set<EquationInput>();let rows:Row[]=[],answerLife:AbortController|undefined,disposed=false;
  const cleanup=()=>{if(disposed)return;disposed=true;parent.removeEventListener('abort',cleanup);lifetime.abort();answerLife?.abort();rows.forEach(r=>r.life.abort());editors.forEach(e=>e.destroy());editors.clear();root.remove();};
  parent.addEventListener('abort',cleanup,{once:true});
  try{
    let ready=false,conversion:Conversion|null=null,nodes:string[]=[],kind='converted',chosen:string[]=[],chosenNodes:string[]=[],analysis:Analysis|null=null,solvedNet:Net|null=null;
    const feedback=el('p','Declare the boundaries, convert to samples, then predict and reduce the discrete graph.');feedback.className='dr04-feedback';feedback.setAttribute('role','status');
    const note=(host:HTMLElement,text:string)=>host.append(el('p',text));
    const section=(title:string)=>{const s=el('section');s.append(el('h2',title));root.append(s);return s;};
    const grid=(host:HTMLElement)=>{const g=el('div');g.className='dr04-grid';host.append(g);return g;};
    const button=(host:HTMLElement,label:string,action:()=>void,life=signal)=>{const b=el('button',label);b.type='button';host.append(b);b.addEventListener('click',()=>{if(life.aborted)return;b.after(feedback);try{action();}catch(e){feedback.textContent=e instanceof Error?e.message:'Check the graph and inputs.';}},{signal:life});return b;};
    const select=(host:HTMLElement,label:string,options:readonly(readonly[string,string])[])=>{const l=el('label',label),s=el('select');s.setAttribute('aria-label',label);l.append(s);host.append(l);options.forEach(([value,text])=>{const o=el('option',text);o.value=value;s.append(o);});return s;};
    const math=(host:HTMLElement,label:string,value:string,onChange:()=>void,life=signal)=>{const e=createEquationInput({label,value,signal:life,onChange});editors.add(e);host.append(e.element);return e;};
    const read=(e:EquationInput,optional=false)=>{const d=e.getValue();if(optional&&d.empty&&!d.hasPlaceholders&&!d.syntaxIssues.length)return null;if(d.empty||d.hasPlaceholders||d.syntaxIssues.length)throw new Error('Complete each math box, including all fraction and power boxes.');return d.latex;};
    const native=(host:HTMLElement,label:string,value:string)=>{const l=el('label',label),e=el('input');e.type='number';e.step='any';e.value=value;e.setAttribute('aria-label',label);l.append(e);host.append(l);return e;};

    const source=section('1. Declare the sample and hold boundaries');
    source.append(createEquationDisplay(String.raw`G_c(s)=\frac{g e^{-\tau s}}{s^2},\quad u[k]=c_0 e[k]+c_1 e[k-1]`,'Original continuous delayed plant and causal digital controller'));
    note(source,'The original course diagram is unavailable. This authored topology updates the digital controller immediately at kT, holds its output on [kT,(k+1)T), and samples the plant output at kT. States and prehistory are zero. The output is physical y[k]; H scales only its feedback measurement.');
    const sourceInputs=grid(source),initial=sourceDefault(),fields={} as Record<'g'|'T'|'tau'|'H'|'c0'|'c1',EquationInput>;
    for(const [key,label]of [['g','Plant gain g (s⁻²)'],['T','Sample period T (s)'],['tau','Physical transport delay τ (s)'],['H','Sensor gain H'],['c0','Controller current coefficient c₀'],['c1','Controller memory coefficient c₁']] as const)fields[key]=math(sourceInputs,label,initial[key],sourceDirty);
    const boundary=select(source,'Intermediate boundary',[['whole','Keep the continuous integrators connected'],['split','Insert a sampler and ZOH between integrators']]);
    const sign=select(source,'Feedback sign',[['negative','Negative: e[k]=r[k]−H y[k]'],['positive','Positive: e[k]=r[k]+H y[k]'],['open','Open: e[k]=r[k]']]);
    const pipeline=el('ol');pipeline.className='dr04-pipeline';source.append(pipeline);drawPipeline();
    button(source,'Convert boundaries and build discrete graph',build);
    const presets=el('div');presets.className='dr04-actions';source.append(presets);
    for(const[label,patch]of [['Source inputs',{}],['Add intermediate sample and hold',{boundary:'split'}],['Half T, keep the physical delay',{T:'0.1'}],['Remove the transport delay',{tau:'0'}],['Positive feedback',{feedback:'positive'}]] as const)button(presets,label,()=>preset(patch));
    button(presets,'Two paths and three non-touching loops',()=>loadGraph(disjoint(),'authored discrete-only'));
    button(presets,'Nested discrete loops',()=>loadGraph(nested(),'authored discrete-only'));

    const graphSection=section('2. Edit the discrete signal-flow graph');graphSection.hidden=true;
    const graphNote=el('p'),derived=el('div'),drawing=el('div');graphSection.append(graphNote,derived,drawing);
    note(graphSection,'Each receiving node sums its incoming signed branches. Branch IDs define connectivity; crossing lines do not connect. Every node here is a discrete sample, and every gain is a rational function of z. Zero-gain branches do not contribute to paths or loops.');
    const namesLabel=el('label','Signal names (2–7, separated by commas)'),names=el('input');names.type='text';names.setAttribute('aria-label','Signal names (2–7, separated by commas)');namesLabel.append(names);graphSection.append(namesLabel);
    button(graphSection,'Apply signal names',()=>{
      const next=names.value.trim().split(/[,\s]+/);if(next.length<2||next.length>7||new Set(next).size!==next.length||next.some(n=>!/^[A-Za-z][A-Za-z0-9]{0,7}$/.test(n)))throw new Error('Use 2–7 distinct signal names: a letter followed by at most 7 letters/digits.');
      if(rows.some(r=>!next.includes(r.from.value)||!next.includes(r.to.value)))throw new Error('Reconnect or remove branches attached to a removed signal before applying the names.');
      nodes=next;updateSelects();graphDirty();
    });
    const ends=grid(graphSection),sourceSelect=select(ends,'External input signal',[]),targetSelect=select(ends,'Output signal',[]);
    const rowHost=el('div');graphSection.append(rowHost);
    button(graphSection,'Add branch',()=>{if(rows.length>=16)throw new Error('Use at most 16 branches.');let id=1;while(rows.some(r=>r.id===`b${id}`))id++;addRow(`b${id}`,sourceSelect.value,targetSelect.value,'1');graphDirty();});
    const traceBox=el('div');traceBox.className='dr04-trace';graphSection.append(traceBox);traceBox.append(el('h3','Trace a path or loop before revealing the answer'));
    note(traceBox,'Use each branch’s Trace button in arrow order. Clicking a selected branch removes it from the sequence.');
    const traceStatus=el('p','No branches selected.'),traceAnswer=el('div');traceBox.append(traceStatus,traceAnswer);
    button(traceBox,'Clear selected trace',()=>{chosen=[];chosenNodes=[];traceAnswer.replaceChildren();redraw();});
    button(traceBox,'Check selected forward path',()=>checkTrace('path'));
    button(traceBox,'Check selected elementary loop',()=>checkTrace('loop'));

    const exercise=section('3. Predict, apply Mason, and check');exercise.hidden=true;
    const prediction=math(exercise,'Predicted output/input transfer (optional)','',()=>{if(ready){clearAnswer();feedback.textContent='Prediction changed. Check it against the current graph.';}});
    button(exercise,'Check prediction and apply Mason',solve);
    const answer=el('div');exercise.append(answer);
    const auditBox=el('div');auditBox.className='dr04-audit';exercise.append(auditBox);auditBox.append(el('h3','Audit a complex z point'));
    note(auditBox,'z is dimensionless. This check solves the node equations numerically and compares the transfer. Each branch is first simplified exactly; its remaining poles can invalidate a point even when the final transfer is finite. Removable points of the unsimplified input are not tracked. This is not a stability test.');
    const points=grid(auditBox),real=native(points,'Evaluation Re(z)','2'),imag=native(points,'Evaluation Im(z)','0'),audit=el('p');
    button(auditBox,'Check original equations at z',()=>{
      audit.textContent='';if(!analysis||!solvedNet)throw new Error('Apply Mason to the current graph before auditing a point.');
      const z={re:readNumericInput(real,'Re(z)'),im:readNumericInput(imag,'Im(z)')},v=numericCheck(solvedNet,analysis,z);
      audit.textContent=`Mason ${formatComplex(v.mason)}; direct node equations ${formatComplex(v.direct)}. Scaled equation residual ${v.residual.toExponential(2)}; relative difference ${v.difference.toExponential(2)}.`;feedback.textContent='The original equations and Mason result agree at this finite point.';
    });auditBox.append(audit);
    for(const input of[real,imag])input.addEventListener('input',()=>{audit.textContent='';if(analysis)feedback.textContent='Evaluation point changed. Check the original equations again.';},{signal});

    const limits=el('details');limits.className='dr04-source';limits.append(el('summary','Supported models and calculation limits'));
    note(limits,'Exact scalar model: g 0.1–1000 s⁻², T 0.01–1 s, τ 0–2 s with τ/T exactly 0, 1 or 2. Fractional-sample transport delays are unsupported. H 0–10; c₀,c₁ −1000…1000. Reduced model-parameter numerators and denominators are bounded by 10⁹. No added computation delay. The intermediate sampler and hold change the physical topology.');
    note(limits,'Graph: 2–7 signals, 1–16 branches, each proper rational degree ≤2. Math boxes accept numbers, z (graph/prediction only), complete fractions, visible parentheses and integer powers −6…6; 256 characters, 48 digits per number, 24 decimal places and bounded nesting. Unsupported symbols, e notation, hidden grouping and ambiguous adjacency are rejected. Prediction degree ≤16.');
    note(limits,'Enumeration and exact arithmetic are bounded. For a readable complete reveal use at most 16 paths, 16 loops and 32 non-touching sets; larger graphs get feedback. Exact cancellations describe zero-state input/output behavior, without internal-stability claims. Eight exact first samples are shown only for a proper transfer and nonsingular instantaneous node sums. Numeric audit: |z|≤100, guarded pivots, scaled residual ≤10⁻⁹ and relative discrepancy ≤10⁻⁸.');root.append(limits);
    const provenance=el('details');provenance.className='dr04-source';provenance.append(el('summary','Source anchors and independent checks'));
    note(provenance,'Source inputs are g=5, τ=.2 s, T=.2 s, H=.1 and C(z)=10−2z⁻¹. Original Ch7/S12 diagrams remain unavailable and uninspected. This topology, changed-boundary examples and other discrete graphs are authored. Independent physical held-state calculations check the pulse coefficients, feedback transfer and first samples.');
    const link=el('a','NPTEL: express sampled graphs using discrete variables before Mason');link.href='https://archive.nptel.ac.in/content/storage2/courses/108103008/module2/lec5/1.html';provenance.append(link);root.append(provenance,feedback);

    function clearAnswer(){answerLife?.abort();answerLife=undefined;analysis=null;solvedNet=null;answer.replaceChildren();audit.textContent='';if(!root.contains(feedback))root.append(feedback);}
    function sourceDirty(){if(!ready)return;conversion=null;graphSection.hidden=true;exercise.hidden=true;clearAnswer();source.append(feedback);feedback.textContent='Source model changed. Convert its sample/hold boundaries again.';}
    function graphDirty(){clearAnswer();kind='edited discrete';chosen=[];chosenNodes=[];traceAnswer.replaceChildren();feedback.textContent='Graph changed. Check the edited discrete model again.';redraw();}
    function sourceDraft():SourceDraft{const d=sourceDefault();for(const key of Object.keys(fields) as (keyof typeof fields)[])d[key]=read(fields[key])!;d.boundary=boundary.value as Boundary;d.feedback=sign.value as Feedback;return d;}
    function build(){clearAnswer();graphSection.hidden=true;exercise.hidden=true;conversion=convert(sourceDraft());loadGraph(conversion.graph,'converted');}
    function preset(patch:Partial<SourceDraft>){const d={...sourceDefault(),...patch};for(const key of Object.keys(fields) as (keyof typeof fields)[])fields[key].setValue(d[key]);boundary.value=d.boundary;sign.value=d.feedback;drawPipeline();build();}
    function drawPipeline(){pipeline.replaceChildren();for(const[domain,text]of[
      ['discrete',sign.value==='negative'?'Σ: e[k]=r[k] − H y[k]':sign.value==='positive'?'Σ: e[k]=r[k] + H y[k]':'Σ: e[k]=r[k]'],['discrete','Controller C(z): u[k]'],['boundary','Input ZOH: u[k] → u_h(t)'],['continuous','Transport delay exp(−τs)'],['continuous','Integrator g/s: v(t)'],
      ...(boundary.value==='split'?[['boundary','Sample v(kT), then hold v[k]']]:[]),['continuous','Integrator 1/s: y(t)'],['boundary','Output sampler at kT: y[k]'],['discrete','Sensor H, then return to Σ'],
    ]){const item=el('li'),badge=el('strong',domain);item.append(badge,el('span',text));pipeline.append(item);}}
    function loadGraph(d:DraftNet,label:string){
      clearAnswer();rows.forEach(r=>{r.life.abort();r.gain.destroy();editors.delete(r.gain);});rows=[];rowHost.replaceChildren();nodes=[...d.nodes];kind=label;names.value=nodes.join(', ');sourceSelect.replaceChildren();targetSelect.replaceChildren();fillOptions(sourceSelect,d.source);fillOptions(targetSelect,d.target);
      d.branches.forEach(b=>addRow(b.id,b.from,b.to,b.value));chosen=[];chosenNodes=[];traceAnswer.replaceChildren();graphSection.hidden=false;exercise.hidden=false;derived.replaceChildren();prediction.setValue('');
      if(label==='converted'&&conversion){derived.append(createEquationDisplay(`C(z)=${latex(conversion.controller)},\\quad z^{-m}=${latex(conversion.delay)},\\quad P_0(z)=${latex(conversion.input.boundary==='whole'?conversion.whole:conversion.split)}`,'Converted controller, transport delay, and undelayed held plant'));
        derived.append(createEquationDisplay(String.raw`P_{\mathrm{whole}}(z)=\frac{gT^2}{2}\frac{z+1}{(z-1)^2},\quad P_{\mathrm{split}}(z)=\frac{gT^2}{(z-1)^2}`,'Different exact pulse transfers for the two physical boundaries'));
        note(derived,`Physical delay τ/T=${conversion.m} samples. D[k]=u[k−${conversion.m}]. The whole cascade has y[k+1]=y[k]+T v[k]+gT²u[k−m]/2; the extra intermediate hold removes that half-interval input term. v[k+1]=v[k]+gT u[k−m].`);
      }else conversion=null;
      redraw();feedback.textContent='The graph is discrete. Predict its output/input transfer or trace a path/loop before revealing Mason’s result.';
    }
    function fillOptions(s:HTMLSelectElement,current:string){s.replaceChildren();nodes.forEach(n=>{const o=el('option',n);o.value=n;s.append(o);});s.value=nodes.includes(current)?current:nodes[0];}
    function updateSelects(){for(const s of[sourceSelect,targetSelect,...rows.flatMap(r=>[r.from,r.to])])fillOptions(s,s.value);}
    function addRow(id:string,from:string,to:string,value:string){
      const host=el('div');host.className='dr04-branch';host.append(el('h3',`Branch ${id}`));const life=new AbortController(),endpoints=grid(host),a=select(endpoints,`${id} from`,[]),b=select(endpoints,`${id} to`,[]);fillOptions(a,from);fillOptions(b,to);
      const gain=math(host,`${id} gain in z`,value,graphDirty,life.signal),r:Row={id,from:a,to:b,gain,host,life};rows.push(r);rowHost.append(host);
      button(host,`Trace ${id}`,()=>{traceAnswer.replaceChildren();chosen=chosen.includes(id)?chosen.filter(v=>v!==id):[...chosen,id];chosenNodes=[];redraw();},life.signal);
      button(host,`Remove ${id}`,()=>{life.abort();gain.destroy();editors.delete(gain);rows=rows.filter(v=>v!==r);host.remove();graphDirty();},life.signal);
      for(const s of[a,b])s.addEventListener('change',graphDirty,{signal:life.signal});
    }
    function net(readGains=true):Net{const n:Net={nodes:[...nodes],source:sourceSelect.value,target:targetSelect.value,branches:rows.map(r=>({id:r.id,from:r.from.value,to:r.to.value,gain:readGains?parseGain(read(r.gain)!):constant(1n)}))};if(readGains)validate(n);return n;}
    function redraw(){if(!nodes.length)return;derived.hidden=kind!=='converted';graphNote.textContent=kind==='converted'?'Converted from the declared continuous model. All nodes below are discrete.':`This ${kind} graph is independent of the continuous conversion. Reconvert the source model to restore its derived gains.`;traceStatus.textContent=chosen.length?`Selected branch order: ${chosen.join(' → ')}`:'No branches selected.';drawing.replaceChildren(drawGraph(net(false),chosen,chosenNodes,''));}
    function checkTrace(type:'path'|'loop'){traceAnswer.replaceChildren();const t=trace(net(),chosen,type);chosenNodes=t.nodes;traceAnswer.append(createEquationDisplay(`G_{\\mathrm{trace}}(z)=${latex(t.gain)}`,'Checked selected trace gain'));note(traceAnswer,`${type==='path'?'Forward path':'Elementary loop'}: ${t.nodes.join(' → ')}${type==='loop'?` → ${t.nodes[0]}`:''}.`);feedback.textContent='The connected trace is valid; its signed gain is the product of the selected branches.';redraw();}
    function solve(){
      clearAnswer();const n=net(),guess=read(prediction,true),a=analyze(n);
      if(a.paths.length>16||a.loops.length>16||a.sets.length>32)throw new Error('For a readable complete reveal, reduce this graph to at most 16 paths, 16 loops and 32 non-touching sets.');
      const predicted=guess===null?null:parseGain(guess,'transfer');
      const message=predicted===null?'No prediction entered. Mason and the original node equations agree exactly.':same(predicted,a.transfer,new Work())?'Your prediction is exactly equivalent. Mason and the original node equations agree.':'Your prediction differs from the exact transfer. Compare the paths, loop signs and cofactors below.';
      try{render(n,a);}catch(error){clearAnswer();throw error;}analysis=a;solvedNet=n;feedback.textContent=message;
    }
    function equation(host:HTMLElement,label:string,g:Gain,description='Exact rational expression'){host.append(createEquationDisplay(`${label}=${latex(g)}`,description));}
    function render(n:Net,a:Analysis){
      answerLife=new AbortController();const life=answerLife.signal;answer.append(el('h3','Exact zero-state transfer'));
      equation(answer,`\\frac{${signalTex(n.target)}}{${signalTex(n.source)}}`,a.transfer,`Exact transfer from ${n.source} to ${n.target}`);
      note(answer,'Mason’s path/loop expression and an independent elimination of the original signal equations give this same exact rational function. Cancellations describe this zero-state input/output ratio; no internal-stability conclusion is inferred.');
      equation(answer,'\\Delta',a.delta,'Mason determinant Delta');
      answer.append(createEquationDisplay(String.raw`T(z)=\frac{\sum_k P_k(z)\Delta_k(z)}{\Delta(z)}`,'Mason formula with path cofactors'));
      const paths=el('details');paths.open=true;paths.append(el('summary',`Forward paths and cofactors (${a.paths.length})`));answer.append(paths);
      if(!a.paths.length)note(paths,'No nonzero path reaches this output; the transfer is zero.');
      a.paths.forEach((p,i)=>{note(paths,`P${i+1}: ${p.nodes.join(' → ')}; branches ${p.edges.join(', ')}.`);equation(paths,`P_{${i+1}}`,p.gain);equation(paths,`\\Delta_{${i+1}}`,a.cofactors[i]);note(paths,`Eligible non-touching sets for this cofactor: ${a.eligibleSets[i].map(s=>s.loops.map(j=>`L${j+1}`).join('·')).join('; ')||'none; cofactor is 1'}.`);button(paths,`Highlight path P${i+1}`,()=>{chosen=[...p.edges];chosenNodes=[...p.nodes];redraw();},life);});
      const loops=el('details');loops.open=true;loops.append(el('summary',`Elementary loops (${a.loops.length}) and non-touching products`));answer.append(loops);const picks=new Set<number>();
      if(!a.loops.length)note(loops,'No nonzero loop: Δ=1.');
      a.loops.forEach((l,i)=>{note(loops,`L${i+1}: ${[...l.nodes,l.nodes[0]].join(' → ')}; branches ${l.edges.join(', ')}.`);equation(loops,`L_{${i+1}}`,l.gain);button(loops,`Highlight loop L${i+1}`,()=>{chosen=[...l.edges];chosenNodes=[...l.nodes];redraw();},life);const label=el('label',`Select L${i+1} for the two-loop check`),check=el('input');check.type='checkbox';check.setAttribute('aria-label',`Select L${i+1} for the two-loop check`);label.append(check);loops.append(label);check.addEventListener('change',()=>{if(check.checked)picks.add(i);else picks.delete(i);},{signal:life});});
      const shared=el('p');button(loops,'Check two loops for touching',()=>{if(picks.size!==2)throw new Error('Select exactly two elementary loops.');const[i,j]=[...picks],overlap=sharedNodes(a.loops[i],a.loops[j]);shared.textContent=overlap.length?`Touching: shared signal${overlap.length>1?'s':''} ${overlap.join(', ')}. Their product is excluded from Δ.`:'Non-touching: no shared signal. Their product contributes with a plus sign to Δ.';},life);loops.append(shared);
      for(const set of a.sets.filter(s=>s.loops.length>1)){note(loops,`${set.loops.map(i=>`L${i+1}`).join(' · ')}: ${set.loops.length%2?'subtract':'add'} this product in Δ.`);equation(loops,'\\mathrm{product}',set.gain);}
      const equations=el('details');equations.append(el('summary','Original node equations'));answer.append(equations);
      for(const name of n.nodes.filter(v=>v!==n.source)){const terms=n.branches.filter(e=>e.to===name).map(e=>`\\left(${latex(e.gain)}\\right)${signalTex(e.from)}`);equations.append(createEquationDisplay(`${signalTex(name)}=${terms.join('+')||'0'}`,`Signal equation for ${name}`));}
      if(causalUpdate(n,a)){const sequence=samples(a.transfer),wrap=el('div');wrap.className='dr04-scroll';wrap.tabIndex=0;wrap.setAttribute('role','region');wrap.setAttribute('aria-label','Exact first samples; scroll horizontally if needed');const table=el('table'),caption=el('caption','Exact first samples, all histories zero'),head=el('tr'),thead=el('thead'),body=el('tbody');['k','Unit impulse r[k]=δ[k]','Unit step r[k]=1'].forEach(v=>{const th=el('th',v);th.scope='col';head.append(th);});thead.append(head);sequence.impulse.forEach((v,k)=>{const row=el('tr');row.append(el('td',String(k)),el('td',fractionText(v)),el('td',fractionText(sequence.step[k])));body.append(row);});table.append(caption,thead,body);wrap.append(table);answer.append(wrap);note(answer,'These are exact discrete zero-state series coefficients, not a continuous intersample trace or a stability test.');}
      else note(answer,'The formal transfer exists, but the instantaneous node sums are singular or a signal needs an advance. A direct causal sample update is not established; the sample table is withheld.');
    }
    function fractionText(g:Gain){const q=g.n[0];return q.d===1n?String(q.n):`${q.n}/${q.d}`;}
    function formatComplex(z:{re:number;im:number}){return`${z.re.toPrecision(9)} ${z.im<0?'−':'+'} j${Math.abs(z.im).toPrecision(9)}`;}
    boundary.addEventListener('change',()=>{drawPipeline();sourceDirty();},{signal});sign.addEventListener('change',()=>{drawPipeline();sourceDirty();},{signal});for(const s of[sourceSelect,targetSelect])s.addEventListener('change',graphDirty,{signal});
    ready=true;return cleanup;
  }catch(error){cleanup();throw error;}
};
