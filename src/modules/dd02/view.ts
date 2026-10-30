import type { ModuleMount } from '../../core/module';
import { createEquationDisplay, createEquationInput, type EquationInput } from '../../shared/equations/input';
import { readNumericInput } from '../../shared/numeric-input';
import { parseNumber } from './number-expression';
import { bounded, lag, lead, magnitude, mapTarget, openPoints, rootLocus, zoh, type Convention, type Lag, type Lead, type Locus, type Model } from './math';
import { plot, type Mark, type Series, type Window } from './plot';
import './style.css';
const fmt=(v:number)=>v===0?'0':Math.abs(v)<1e-5||Math.abs(v)>1e6?v.toExponential(5):v.toLocaleString('en-US',{useGrouping:false,maximumSignificantDigits:10});
const residual=(v:number)=>Math.abs(v)<1e-9?'≈0':fmt(v);
const tex=(v:number)=>{const s=v.toPrecision(10);if(!s.includes('e'))return String(Number(s));const[m,e]=s.split('e');return`${Number(m)}\\times10^{${Number(e)}}`;};
const factor=(v:number)=>v===0?'z':v<0?`z+${tex(-v)}`:`z-${tex(v)}`;
function polynomial(p:readonly number[]){const terms:string[]=[];for(let i=p.length-1;i>=0;i--){const v=p[i];if(v===0)continue;terms.push(`${v<0?'-':terms.length?'+':''}${i&&Math.abs(v)===1?'':tex(Math.abs(v))}${i?i===1?'z':`z^{${i}}`:''}`);}return terms.join('')||'0';}
const complex=(z:{re:number;im:number})=>`${fmt(z.re)} ${z.im<0?'−':'+'} j${fmt(Math.abs(z.im))}`;
function el<K extends keyof HTMLElementTagNameMap>(tag:K,text?:string):HTMLElementTagNameMap[K]{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e;}
interface Output { readonly m:Model; readonly lead:Lead|null; readonly lag:Lag|null; readonly locus:Locus; readonly zoom:number }
export const mount:ModuleMount=({container,signal:parent})=>{
  if(parent.aborted)return;
  const lifetime=new AbortController(),signal=lifetime.signal,forward=()=>lifetime.abort();parent.addEventListener('abort',forward,{once:true});
  const root=el('div');root.dataset.module='DD02';container.append(root);const editors:EquationInput[]=[];let disposed=false;
  const cleanup=()=>{if(disposed)return;disposed=true;lifetime.abort();parent.removeEventListener('abort',forward);parent.removeEventListener('abort',cleanup);editors.forEach(e=>e.destroy());root.remove();};
  try{
    let ready=false,active:Output|null=null;
    const feedback=el('p','Choose a submode, predict its gain or boost, then solve the full sampled loop.');feedback.className='dd02-feedback';feedback.setAttribute('role','status');
    const section=(title:string)=>{const s=el('section');s.append(el('h2',title));root.append(s);return s;};
    const note=(host:HTMLElement,text:string)=>host.append(el('p',text));
    const button=(host:HTMLElement,label:string,action:()=>void)=>{const b=el('button',label);b.type='button';host.append(b);b.addEventListener('click',()=>{if(signal.aborted)return;if(host.classList.contains('dd02-actions'))host.after(feedback);else b.after(feedback);try{action();}catch(e){feedback.textContent=e instanceof Error?e.message:'Check the inputs.';}},{signal});return b;};
    const number=(host:HTMLElement,label:string,value:string,min:string,max:string,step='any')=>{const l=el('label',label),input=el('input');input.type='number';input.value=value;input.min=min;input.max=max;input.step=step;input.setAttribute('aria-label',label);l.append(input);host.append(l);return input;};
    const select=(host:HTMLElement,label:string,options:readonly(readonly[string,string])[])=>{const l=el('label',label),s=el('select');s.setAttribute('aria-label',label);for(const[value,text]of options){const o=el('option',text);o.value=value;s.append(o);}l.append(s);host.append(l);return s;};
    const grid=(host:HTMLElement)=>{const g=el('div');g.className='dd02-grid';host.append(g);return g;};
    const data=section('1. Preserve the continuous plant and its exact hold');
    data.append(createEquationDisplay(String.raw`G(s)=\frac{g}{s(s+a)},\quad e[k]=r[k]-y[k],\quad U(z)=C(z)E(z)`,'Original plant and negative sampled unity feedback'));
    note(data,'The controller reads y[k] and updates u[k] at kT. A zero-order hold applies u[k] to the original plant throughout [kT,(k+1)T); no additional computation delay is inserted. Transfer functions use zero initial state.');
    const modelInputs=grid(data);
    for(const[label,value]of[['Plant numerator g (s⁻²)','50'],['Plant pole parameter a (s⁻¹)','5'],['Sample period T (s)','0.1']]){const editor=createEquationInput({label,value,signal,onChange:dirty});editors.push(editor);modelInputs.append(editor.element);}
    const mode=select(data,'Design submode',[['lead','Lead: place a mapped pole pair'],['lag','Lag: meet a minimum velocity constant']]);
    const presets=el('div');presets.className='dd02-actions';data.append(presets);
    for(const[label,kind]of[['Source inputs, lead mode','lead'],['Double the sample period','period'],['Manual lead pole −0.95','unstable-lead'],['Physical-ramp lag target 100','lag'],['Per-sample lag target 100','sample'],['Lag zero at the origin','origin']])button(presets,label,()=>preset(kind));
    const settings=section('2. Solve the selected design conditions');
    const leadBox=el('div'),lagBox=el('div');settings.append(leadBox,lagBox);
    const targets=grid(leadBox),zeta=number(targets,'Target damping ratio ζ','0.707','.05','.95'),wn=number(targets,'Target natural frequency ωn (rad/s)','10','.1','30');
    leadBox.append(createEquationDisplay(String.raw`z_d=\exp\left[\left(-\zeta\omega_n\pm j\omega_n\sqrt{1-\zeta^2}\right)T\right]`,'Continuous target pair mapped into z'));
    const method=select(leadBox,'Lead construction',[['cancel','Initial lead: cancel the stable held-plant pole'],['manual','Choose a real controller pole']]);
    const pole=number(leadBox,'Manual lead pole p','0.02','-.99','.99','.01');
    note(leadBox,'For a positive-gain lead C=K(z−z₀)/(z−p), p lies to the left of z₀ and both corners lie inside the unit disk. The initial construction retains the original plant and its stable canceled mode in the full characteristic. A manual pole can hit the target pair while leaving another mode unstable.');
    const lagControls=grid(lagBox),lagK=number(lagControls,'Lag gain multiplier K','1','.000001','10000'),goal=number(lagControls,'Minimum velocity constant target','100','.0001','10000');
    const convention=select(lagBox,'Velocity-constant convention',[['physical','Unit ramp per second: r[k]=kT'],['sample','Unit ramp per sample: r[k]=k']]);
    lagBox.append(createEquationDisplay(String.raw`K_{v,\mathrm{sec}}=\frac{1}{T}\lim_{z\to1}(z-1)L(z),\quad K_{v,\mathrm{sample}}=T K_{v,\mathrm{sec}}`,'Two explicit velocity constant conventions'));
    const corners=grid(lagBox),zero=number(corners,'Lag zero z₀','0.95','0','.9999'),zoom=number(corners,'Zoom half width around +1','0.06','.000001','1');
    const sliderLabel=el('label','Distance of lag zero from +1 (log scale)'),slider=el('input');slider.type='range';slider.min='-4';slider.max='0';slider.step='.02';slider.value=String(Math.log10(.05));slider.setAttribute('aria-label','Lag zero distance from +1');sliderLabel.append(slider);lagBox.append(sliderLabel);
    note(lagBox,'A lag raises the DC gain with p=1−(1−z₀)/β, so its pole is closer to +1 than its zero. Start near +1; placing a zero near the continuous origin can consume phase and destabilize the sampled loop. The velocity goal is a minimum; no extra lag is added when the bare K already meets it.');
    const shared=grid(settings),guessLabel=el('label','Predicted gain K (optional)'),guess=el('input');guess.type='number';guess.step='any';guessLabel.append(guess);shared.append(guessLabel);
    const gainMax=number(shared,'Locus gain upper bound','10','.001','10000');
    button(settings,'Check prediction and solve design',solve);
    const limits=el('details'),limitsTitle=el('summary','Supported inputs and numerical limits');limits.append(limitsTitle);
    note(limits,'g: 0.1–1000 s⁻²; a: 0.2–20 s⁻¹; T: 0.01–0.5 s. Model math boxes accept real numbers, complete fractions, visible parentheses and integer powers −6…6, within 512 characters and bounded nesting/work. Variables, e/E, mixed numbers and hidden grouping are rejected. Numeric controls support native scientific notation but reject incomplete/nonfinite and underflowed drafts.');
    note(limits,'Lead ζ: 0.05–0.95; ωn: 0.1–30 rad/s. Require ωd T<π and mapped imaginary part ≥10⁻⁵. Positive K: 10⁻⁶–10⁴; controller zero −0.9999…0.9999 and pole −0.99…0.999999, with at least 10⁻⁶ separation for a lead and pole distance ≥10⁻⁶ from +1. Infeasible/non-lead constructions are reported. Lag zero: 0…0.9999; minimum Kv: 10⁻⁴…10⁴; boost ≤1000.');
    note(limits,'All two or three full feedback roots are checked, including stable cancellations. A bilinear unit-disk-to-LHP Routh count must agree with numerical root radii; uncertain coefficient rows and the ±10⁻⁸ unit-circle band are unresolved. Root residual ≤10⁻⁹ and coefficient reconstruction ≤10⁻⁷ are required. Lead angle, magnitude and polynomial residuals are bounded. The finite sampled locus is not a proof of an entire stability interval. No overshoot, settling-time or intersample-performance guarantee is inferred from a requested pair.');settings.append(limits);
    const results=section('3. Inspect every mode and the design geometry'),view=select(results,'Locus view',[['full','Whole finite gain range'],['disk','Unit-disk window (clipped)']]),answer=el('div');results.append(answer);root.append(feedback);
    const provenance=el('details'),sourceTitle=el('summary','Source anchors and independent model checks');provenance.className='dd02-source';provenance.append(sourceTitle);
    note(provenance,'The given source inputs are 50/[s(s+5)], T=0.1, ζ=0.707, ωn=10, and a lag target Kv*=100. Original Ch9/S14 worksheets and their normalization/topology are unavailable and uninspected. The explicit timing, two ramp conventions and controller constructions here are authored and independently calculated, rather than purported worksheet answers. The default lag convention is per second.');
    const source=el('a','NPTEL: sampled-ramp velocity constant, including 1/T');source.href='https://archive.nptel.ac.in/content/storage2/courses/108103008/module4/lec1/3.html';provenance.append(source);root.append(provenance);
    function dirty(){if(!ready)return;active=null;answer.replaceChildren();feedback.textContent='Inputs changed. Solve this design again; the prior result is no longer shown.';}
    function visibility(){const isLead=mode.value==='lead';leadBox.hidden=!isLead;lagBox.hidden=isLead;pole.disabled=method.value!=='manual';guessLabel.firstChild!.textContent=isLead?'Predicted gain K (optional)':'Predicted lag boost β (optional)';guess.value='';dirty();}
    function preset(kind:string){['50','5',kind==='period'?'0.2':'0.1'].forEach((v,i)=>editors[i].setValue(v));zeta.value='.707';wn.value='10';mode.value=['lag','sample','origin'].includes(kind)?'lag':'lead';method.value=kind==='unstable-lead'?'manual':'cancel';pole.value=kind==='unstable-lead'?'-0.95':'.02';lagK.value='1';goal.value='100';zero.value=kind==='origin'?'0':'.95';slider.value=String(Math.log10(1-Number(zero.value)));convention.value=kind==='sample'?'sample':'physical';zoom.value='.06';gainMax.value='10';visibility();}
    function read(editor:EquationInput){const draft=editor.getValue();if(draft.empty||draft.hasPlaceholders||draft.syntaxIssues.length)throw new Error('Complete all model math boxes, including each fraction and power.');return parseNumber(draft.latex);}
    function solve(){
      dirty();const prediction=guess.validity.badInput||guess.value.trim()?readNumericInput(guess,'your optional prediction'):null;
      const p=zoh(read(editors[0]),read(editors[1]),read(editors[2]));let d:Lead|null=null,l:Lag|null=null;
      if(mode.value==='lead')d=lead(p,mapTarget(readNumericInput(zeta,'damping ratio ζ'),readNumericInput(wn,'natural frequency ωn'),p.T),method.value==='manual'?readNumericInput(pole,'manual lead pole'):undefined);
      else l=lag(p,readNumericInput(lagK,'lag gain K'),readNumericInput(zero,'lag zero'),readNumericInput(goal,'minimum velocity constant'),convention.value as Convention);
      const m=d?d.m:l!.m,range=rootLocus(m,readNumericInput(gainMax,'locus gain limit')),half=l?bounded(readNumericInput(zoom,'zoom half width'),1e-6,1,'zoom half width'):0.06;
      active={m,lead:d,lag:l,locus:range,zoom:half};render();const expected=d?m.c.K:l!.beta;
      const grading=prediction===null?'No prediction entered.':Math.abs(prediction-expected)<=.01*Math.max(1e-12,Math.abs(expected))?'Your prediction is within 1% of the computed value.':`Your prediction ${fmt(prediction)} differs from the computed ${d?'K':'β'}=${fmt(expected)}.`;
      feedback.textContent=`${grading} ${m.stability==='stable'?'Every full feedback mode is inside the unit disk.':m.stability==='unstable'?'The full loop is unstable: a target pair or formal velocity constant does not establish stable tracking.':'The stability margin is unresolved at this precision; no strict-stability or steady-tracking claim is made.'}`;
    }
    function table(host:HTMLElement,title:string,headers:string[],rows:string[][]){const region=el('div');region.className='dd02-table';region.tabIndex=0;region.setAttribute('role','region');region.setAttribute('aria-label',`${title}; scroll horizontally if needed`);const t=el('table'),caption=el('caption',title),head=el('tr'),thead=el('thead'),tbody=el('tbody');headers.forEach(v=>{const th=el('th',v);th.scope='col';head.append(th);});rows.forEach(values=>{const row=el('tr');values.forEach(v=>row.append(el('td',v)));tbody.append(row);});thead.append(head);t.append(caption,thead,tbody);region.append(t);host.append(region);}
    function facts(host:HTMLElement,rows:[string,string][]){const list=el('dl');rows.forEach(([name,value])=>list.append(el('dt',name),el('dd',value)));host.append(list);}
    function render(){
      if(!active)return;const{m,lead:d,lag:l,locus}=active,p=m.plant;answer.replaceChildren();answer.append(el('h3',m.stability==='stable'?'Stable full sampled loop':m.stability==='unstable'?'Unstable full sampled loop':'Unit-circle boundary or unresolved numerical margin'));
      answer.append(createEquationDisplay(`G_d(z)\\approx\\frac{${polynomial([p.b0,p.b1])}}{${polynomial([p.r,-1-p.r,1])}},\\quad C(z)\\approx${m.c.kind==='constant'?tex(m.c.K):`${tex(m.c.K)}\\frac{${factor(m.c.zero)}}{${factor(m.c.pole)}}`}`,'Original exact-ZOH plant and designed compensator, rounded coefficients'));
      answer.append(createEquationDisplay(`Q(z)\\approx ${polynomial(m.closed)}`,'Full feedback polynomial without pole-zero cancellation'));
      note(answer,'The ZOH formula is exact for the declared plant and timing; displayed coefficients are rounded. The original held-plant model is retained throughout the design.');
      if(d){facts(answer,[['Mapped upper target z_d',complex(d.target.z)],['Mapped radius / angle (rad)',`${fmt(d.target.radius)} / ${fmt(d.target.theta)}`],['Computed gain K',fmt(m.c.K)],['Gain from magnitude condition',fmt(d.check.requiredGain)],['Angle residual (degrees)',residual(d.check.phaseResidual)],['Magnitude residual |L(z_d)|−1',residual(d.check.magnitudeResidual)],['Relative feedback-polynomial residual',residual(d.check.polynomialResidual)],['Additional full-state root',fmt(d.other)]]);
        note(answer,d.cancellation?`Controller zero coincides with the stable held-plant pole r=${fmt(p.r)}. Its stationary full-state mode is retained, even though this exact input/output pole-zero pair cancels.`:'The chosen manual controller pole fixes a real zero and gain. The requested pair is checked against the complete cubic; the remaining root is checked independently.');
      }else if(l){facts(answer,[['Ramp definition',l.convention==='physical'?'r[k]=kT (unit slope per second)':'r[k]=k (one unit per sample)'],['Minimum velocity goal',fmt(l.goal)],['Required lag boost β',fmt(l.beta)],['Achieved velocity constant in selected units',fmt(l.achieved)],['Relative surplus over minimum',residual(l.residual)],['Stable asymptotic ramp error',l.error===null?'Unavailable: loop unstable or unresolved':fmt(l.error)]]);
        if(!l.needed)note(answer,'The bare K already meets the minimum velocity goal within tolerance. No additional lag state is invented: this is a constant controller with two full feedback modes.');
        else if(m.c.kind==='corners')note(answer,`Lag zero=${fmt(m.c.zero)}, pole=${fmt(m.c.pole)}. Their distances from +1 are ${fmt(1-m.c.zero)} and ${fmt(1-m.c.pole)}. The velocity condition does not enforce a transient target pair.`);
      }
      facts(answer,[['Plant formal Kv per second',fmt(p.g/p.a)],['Plant formal Kv per sample',fmt(p.T*p.g/p.a)],['Selected formal Kv per second (s⁻¹)',fmt(m.physicalKv)],['Selected formal Kv per sample',fmt(m.sampleKv)]]);
      if(d)note(answer,m.stability==='stable'?`For the unit-slope physical ramp r[k]=kT, the stable asymptotic error is ${fmt(1/m.physicalKv)}. A placed pair does not promise the full response's overshoot or settling time.`:'Formal velocity limits are not stable tracking errors for this loop.');
      table(answer,'All full feedback roots',['Root z','Radius |z|','Geometric position'],m.poles.map(z=>[complex(z),fmt(magnitude(z)),Math.abs(magnitude(z)-1)<=1e-8?'Unit-circle band':magnitude(z)>1?'Outside unit disk':'Inside unit disk']));
      const points=openPoints(m),marks:Mark[]=[...m.poles.map(z=>({x:z.re,y:z.im,shape:'closed' as const,color:magnitude(z)>1+1e-8?'#b74349':'#4e5ea6'})),...points.poles.map(z=>({x:z.re,y:z.im,shape:'pole' as const,...(z.re===1?{label:'+1'}:{})})),...points.zeros.map(z=>({x:z.re,y:z.im,shape:'zero' as const,color:'#3f788a'}))];
      if(d)marks.push({x:d.target.z.re,y:d.target.z.im,shape:'target',color:'#a96f25',label:'target'},{x:d.target.z.re,y:-d.target.z.im,shape:'target',color:'#a96f25'});
      const colors=['#624cb0','#3e7b91','#9b7141'],series:Series[]=locus.branches.map((b,i)=>({points:b.map(z=>z?{x:z.re,y:z.im}:null),color:colors[i]}));
      if(d)for(const vector of d.check.vectors)series.push({points:[{x:vector.at.re,y:vector.at.im},{x:d.target.z.re,y:d.target.z.im}],color:vector.kind==='pole'?'#9a6a71':'#5c8d73',thin:true,dashed:true});
      const figures=el('div');figures.className='dd02-plots';const window:Window|undefined=view.value==='disk'?{x:0,y:0,half:1.3}:undefined;
      figures.append(plot(`Full characteristic locus: ${locus.branches.length} modes, K=0…${fmt(locus.max)}${window?' (clipped)':''}`,series,marks,window));
      if(l)figures.append(plot('Lag placement near z=+1 (clipped)',series,marks,{x:1,y:0,half:active.zoom}));answer.append(figures);
      note(answer,`× open-loop poles; ○ zeros; ● selected full feedback roots; ♦ lead targets; gray boundary |z|=1. ${d?'Thin red/green dashed segments run from open poles/zeros toward the upper target; their signed angles are listed below. ':''}All ${locus.branches.length} characteristic branches are computed over the finite displayed gain interval, starting at K=0 at ×. ${locus.gaps?`${locus.gaps} unresolved gain samples are left as gaps.`:'No gain sample was unresolved.'} This sampled locus is not a complete stability-interval proof. Clipped views omit off-window portions; all selected roots remain listed above.`);
      if(d)table(answer,'Angle vectors at the upper target',['Vector','Location','Signed contribution (degrees)'],d.check.vectors.map(v=>[v.name,complex(v.at),`${v.kind==='pole'?'−':''}${fmt(v.degrees)}`]));
    }
    for(const input of[zeta,wn,pole,lagK,goal,zoom,guess,gainMax])input.addEventListener('input',dirty,{signal});
    mode.addEventListener('change',visibility,{signal});method.addEventListener('change',()=>{pole.disabled=method.value!=='manual';dirty();},{signal});convention.addEventListener('change',dirty,{signal});view.addEventListener('change',render,{signal});
    zero.addEventListener('input',()=>{try{const value=readNumericInput(zero,'lag zero');if(value>=0&&value<=.9999)slider.value=String(Math.log10(1-value));}catch{/* Validate drafts when solving; prior results are revoked now. */}dirty();},{signal});
    slider.addEventListener('input',()=>{zero.value=String(1-10**Number(slider.value));dirty();},{signal});
    ready=true;visibility();feedback.textContent='Choose lead or lag, predict K or β if you wish, then solve from the source model.';parent.addEventListener('abort',cleanup,{once:true});return cleanup;
  }catch(error){cleanup();throw error;}
};
