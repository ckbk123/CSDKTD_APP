import type { ModuleMount } from '../../core/module';
import { createEquationInput,createEquationDisplay,type EquationInput,type EquationDraft } from '../../shared/equations/input';
import { readNumericInput } from '../../shared/numeric-input';
import { parseRational,num,latexRat,div,neg } from './algebra';
import { readController,discretize,zoh,simulate,closedPoles,stability,analogStep,loopAt,margins,magnitude,type Discrete,type Method,type Trace } from './math';
import './workspace.css';

const fmt=(value:number):string=>Number.isFinite(value)?((Math.abs(value)<1e-5&&value!==0)||Math.abs(value)>=1e7?value.toExponential(5):Number(value.toPrecision(8)).toString()):'undefined';
const tex=(value:number):string=>fmt(value).replace(/e([+-]?\d+)$/,'\\times10^{$1}');
const el=<K extends keyof HTMLElementTagNameMap>(tag:K,text?:string):HTMLElementTagNameMap[K]=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
const p=(text:string)=>el('p',text);
const eq=(text:string,label:string)=>createEquationDisplay(text,label);
function polynomial(a:string,b:string,variable:string):string{return `${a}${variable}+(${b})`;}
function plot(series:{name:string;values:{t:number;y:number}[];kind:'solid'|'dash'|'dots'}[],label:string,xLabel:string):HTMLElement{
  const wrap=el('div');wrap.className='dd01-plot-scroll';wrap.tabIndex=0;wrap.setAttribute('aria-label',`${label}, horizontally scrollable plot`);
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 680 280');svg.setAttribute('role','img');svg.setAttribute('aria-label',label);
  const all=series.flatMap(s=>s.values).filter(v=>Number.isFinite(v.y));let low=Math.min(0,...all.map(v=>v.y)),high=Math.max(1,...all.map(v=>v.y));
  const span=high-low;low-=span*.08;high+=span*.08;
  const xmax=Math.max(1e-12,...all.map(v=>v.t)),x=(t:number)=>64+592*t/xmax,y=(v:number)=>230-204*(v-low)/(high-low);
  const shape=(tag:string,attributes:Record<string,string>,text?:string)=>{const n=document.createElementNS(svg.namespaceURI,tag);for(const [key,value]of Object.entries(attributes))n.setAttribute(key,value);if(text!==undefined)n.textContent=text;svg.append(n);return n;};
  for(let i=0;i<=4;i++){const t=xmax*i/4,v=low+(high-low)*i/4;shape('line',{x1:'64',x2:'656',y1:String(y(v)),y2:String(y(v)),class:'dd01-gridline'});shape('text',{x:'59',y:String(y(v)+4),'text-anchor':'end'},fmt(v));shape('text',{x:String(x(t)),y:'250','text-anchor':'middle'},fmt(t));}
  shape('text',{x:'360',y:'273','text-anchor':'middle'},xLabel);shape('text',{x:'12',y:'15'},label);
  for(const s of series){if(s.kind==='dots'){for(const v of s.values)shape('circle',{cx:String(x(v.t)),cy:String(y(v.y)),r:'2.2',class:'dd01-dot'});}
    else shape('path',{d:s.values.map((v,i)=>`${i?'L':'M'}${x(v.t).toFixed(3)},${y(v.y).toFixed(3)}`).join(' '),class:`dd01-curve ${s.kind==='dash'?'dd01-dash':''}`});}
  wrap.append(svg);const legend=el('p',series.map(s=>`${s.kind==='dash'?'– –':s.kind==='dots'?'●':'—'} ${s.name}`).join(' · '));legend.className='dd01-legend';wrap.append(legend);return wrap;
}
function table(headers:string[],rows:(string|HTMLElement)[][]):HTMLElement{
  const scroll=el('div');scroll.className='dd01-table-scroll';scroll.tabIndex=0;scroll.setAttribute('aria-label',`${headers[0]} table, horizontally scrollable`);const t=el('table'),head=el('thead'),tr=el('tr');for(const h of headers){const th=el('th',h);th.scope='col';tr.append(th);}head.append(tr);const body=el('tbody');for(const row of rows){const r=el('tr');for(const value of row){const td=el('td');td.append(value);r.append(td);}body.append(r);}t.append(head,body);scroll.append(t);return scroll;
}

export const mount:ModuleMount=({container,signal})=>{
  if(signal.aborted)return;
  const root=el('div');root.className='dd01-tool';container.append(root);
  const editors:EquationInput[]=[],drafts=new Map<string,EquationDraft>();let disposed=false,resultScope=new AbortController();
  const cleanup=()=>{if(disposed)return;disposed=true;resultScope.abort();editors.forEach(e=>e.destroy());root.remove();};
  signal.addEventListener('abort',cleanup,{once:true});
  const intro=p('Derive a digital controller, then test it with a sampled plant. First predict the recurrence coefficients; reveal the algebra and actual loop checks.');
  const data=el('section');data.append(el('h2','1. Controller and sampling'));
  const presets=el('select');presets.setAttribute('aria-label','Controller example');for(const [value,label]of [['lead','Course lead'],['pi','PI'],['derivative','Filtered derivative'],['static','Static gain']]){const option=el('option',label);option.value=value;presets.append(option);}
  const fields=el('div');fields.className='dd01-fields';
  const error=el('p');error.className='dd01-feedback';error.setAttribute('role','status');
  const output=el('div');
  const invalidate=()=>{resultScope.abort();output.replaceChildren();error.textContent='Data changed. Check the inputs, then reveal the new result.';};
  function visual(label:string,value:string,parent:HTMLElement):EquationInput{
    const input=createEquationInput({label,value,signal,onChange:d=>{drafts.set(label,d);invalidate();}});editors.push(input);parent.append(input.element);drafts.set(label,input.getValue());return input;
  }
  const cs=['b₁: controller numerator s coefficient','b₀: controller numerator constant','a₁: controller denominator s coefficient','a₀: controller denominator constant'];
  const controller=['12','32','1','6'].map((value,i)=>visual(cs[i],value,fields));
  const formula=eq('C(s)=\\frac{b_1s+b_0}{a_1s+a_0}','Controller coefficient convention');
  const method=el('select');method.setAttribute('aria-label','Controller approximation');for(const [value,label]of [['forward','Forward Euler'],['backward','Backward Euler'],['tustin','Tustin (bilinear)']]){const option=el('option',label);option.value=value;method.append(option);}method.value='tustin';
  function numeric(label:string,value:string,min:string,max:string,step:string,parent:HTMLElement):HTMLInputElement{
    const wrapper=el('label',label),input=el('input');input.type='number';input.value=value;input.min=min;input.max=max;input.step=step;input.setAttribute('aria-label',label);wrapper.append(input);parent.append(wrapper);return input;
  }
  const controls=el('div');controls.className='dd01-controls';const methodLabel=el('label','Approximation');methodLabel.append(method);controls.append(methodLabel);
  const period=numeric('Sample period T (s)','.1','.001','2','.01',controls);
  const preLabel=el('label'),pre=el('input');pre.type='checkbox';preLabel.append(pre,document.createTextNode('Prewarp Tustin'));controls.append(preLabel);
  const warp=numeric('Prewarp frequency ωₚ (rad/s)','5','.001','1000','.1',controls);warp.disabled=true;
  const plant=el('section');plant.append(el('h2','2. Actual loop plant'),p('Proposed teaching fixture: G(s)=K/(s+a). The course gives the lead controller; this editable stable first-order plant is added for the loop experiment.'));
  const plantFields=el('div');plantFields.className='dd01-fields';visual('Plant gain K','1',plantFields);visual('Plant decay a (s⁻¹)','1',plantFields);plant.append(plantFields);
  const ncontrols=el('div');ncontrols.className='dd01-controls';const count=numeric('Sample intervals','80','20','500','1',ncontrols);plant.append(ncontrols);
  const attempt=el('section');attempt.append(el('h2','3. Predict, then reveal'),eq('u[k]=\\alpha u[k-1]+\\beta_0e[k]+\\beta_1e[k-1]','Recurrence to predict'),p('Predict α, β₀ and β₁. You can also reveal without an attempt. Initial controller memory and plant output are zero.'));
  const predictions=el('div');predictions.className='dd01-fields';const predictionLabels=['Prediction α','Prediction β₀','Prediction β₁'];predictionLabels.forEach(label=>visual(label,'',predictions));
  const reveal=el('button','Reveal and test actual loop');reveal.type='button';attempt.append(predictions,reveal,error);
  const assumptions=el('details'),summary=el('summary','Supported inputs and timing');assumptions.append(summary,
    p('Real SISO proper first-order controllers only. Each coefficient is 0 or 0.001–100; numerator and denominator must be nonzero. Scalars accept decimals (9 places) or simple numeric fractions, including compact fraction-button notation; reduced denominators ≤10¹⁸, at most 24 digits/100 normalized characters. Evaluate sums, powers, mixed numbers and nested fractions first. Negative controller coefficients and ideal unfiltered differentiation are outside this exercise.'),
    p('T=0.001–2 s, at most9 decimal places; K,a=0.001–100. Tustin may use 0.001–1000 rad/s prewarping with ωₚT<π−0.0001. Recurrence gains are bounded by 10⁶; response has 20–500 intervals and stops at magnitude10¹². Numerical unit-circle tolerance is10⁻¹⁰. No actuator saturation is modeled.'),
    eq('y[k]=x[k],\\quad e[k]=1-y[k],\\quad u[k]=C_d(e)[k],\\quad x[k+1]=A_dx[k]+B_du[k]','Sample and hold timing'),
    p('Negative unity feedback; reference steps to 1 at k=0. Compute u[k] from the current error, then hold it on [kT,(k+1)T). There is no extra computation delay. All histories and x[0] are zero. Exact static cancellations use the minimal zero-state controller; unspecified hidden physical states are not assessed. Plant ZOH and controller approximation are separate operations.'));
  data.append(presets,formula,p('Signals are normalized. In this coefficient convention b₁ and a₁ carry seconds; b₀ and a₀ are dimensionless. Plant K and a carry s⁻¹; frequency is in rad/s.'),fields,controls);root.append(intro,data,plant,attempt,assumptions,output);
  const scalar=(label:string,limit=100):string=>{
    const d=drafts.get(label)!;if(d.empty)throw new Error(`Enter ${label}.`);if(d.hasPlaceholders)throw new Error(`Complete the highlighted boxes in ${label}.`);if(d.syntaxIssues.length)throw new Error(`Check the notation in ${label}.`);
    const value=parseRational(d.latex,limit);return `${value.n}/${value.d}`;
  };
  function cursorBox(m:Discrete,s:Trace,parent:HTMLElement):void{
    const controls=el('div');controls.className='dd01-controls';const cursor=numeric('Inspect sample k','0','0',String(s.samples.at(-1)?.k??0),'1',controls),readout=el('div');readout.setAttribute('role','status');
    const update=()=>{try{const k=readNumericInput(cursor,'sample index');if(!Number.isInteger(k)||k<0||k>=s.samples.length)throw new Error(`Choose an available sample from 0 to ${s.samples.length-1}.`);
      const r=s.samples[k];readout.replaceChildren(eq(`u[${k}]=(${tex(m.alpha)})(${tex(r.oldU)})+(${tex(m.beta0)})(${tex(r.e)})+(${tex(m.beta1)})(${tex(r.oldE)})=${tex(r.u)}`,'Current sample arithmetic'),
        table(['k','t (s)','y[k]','e[k]','u[k−1]','e[k−1]','u[k]'],[[String(k),fmt(r.t),fmt(r.y),fmt(r.e),fmt(r.oldU),fmt(r.oldE),fmt(r.u)]]),p('Read old memory first; commit u[k] and e[k] only after calculating this row. The plant uses the newly computed u[k] for the next interval.'));
    }catch(e){readout.replaceChildren(p((e as Error).message));}};cursor.addEventListener('input',update,{signal:resultScope.signal});parent.append(controls,readout);update();
  }
  function frequencyBox(m:Discrete,parent:HTMLElement):void{
    const controls=el('div');controls.className='dd01-controls';const frequency=numeric('Inspect frequency ω (rad/s)','1','0',String(Math.PI/m.settings.T),'.1',controls),readout=el('div');readout.setAttribute('role','status');
    const update=()=>{try{const w=readNumericInput(frequency,'frequency');if(w<0||w>Math.PI/m.settings.T||(w>0&&w<1e-6))throw new Error('Choose DC (0) or a frequency from 0.000001 rad/s to Nyquist.');const value=loopAt(m,Math.min(Math.PI,w*m.settings.T)),gain=magnitude(value);
      readout.replaceChildren(p(`At ω=${fmt(w)} rad/s (ωT=${fmt(w*m.settings.T)} rad/sample): L=${fmt(value.re)} ${value.im<0?'−':'+'} j${fmt(Math.abs(value.im))}; |L|=${fmt(gain)}${gain?`, ${fmt(20*Math.log10(gain))} dB; principal phase=${fmt(Math.atan2(value.im,value.re)*180/Math.PI)}°`: '; phase is undefined at zero gain'}.`));
    }catch(e){readout.replaceChildren(p((e as Error).message));}};frequency.addEventListener('input',update,{signal:resultScope.signal});parent.append(controls,readout);update();
  }
  function render(m:Discrete,s:Trace):void{
    resultScope.abort();resultScope=new AbortController();output.replaceChildren();const algebra=el('section');algebra.append(el('h2','Substitution → discrete controller'));
    const c=m.original,method=m.settings.method;
    const substitution=method==='forward'?'s=\\frac{z-1}{T}':method==='backward'?'s=\\frac{z-1}{Tz}':`s=\\kappa\\frac{z-1}{z+1},\\quad\\kappa=${m.settings.prewarp===undefined?'2/T':String.raw`\omega_p/\tan(\omega_pT/2)`}`;
    algebra.append(eq(substitution,`${method==='forward'?'Forward Euler':method==='backward'?'Backward Euler':'Tustin'} substitution`),p(`T=${fmt(m.settings.T)} s${m.kappa!==undefined?`; κ=${fmt(m.kappa)} s⁻¹`:''}. ${m.exact?'Rational coefficient algebra below is exact for the entered decimals/fractions.':'Prewarped coefficients use numerical trigonometry; displayed values are rounded.'}`));
    const k=method==='tustin'?'\\kappa(z-1)':'(z-1)',common=method==='forward'?'T':method==='backward'?'Tz':'(z+1)';
    algebra.append(eq(`C_d(z)=\\frac{(${latexRat(c.b1)})${k}+(${latexRat(c.b0)})${common}}{(${latexRat(c.a1)})${k}+(${latexRat(c.a0)})${common}}`,'Clear the substitution denominator'));
    if(m.primitive){const [n1,n0,d1,d0]=m.primitive.map(String);algebra.append(eq(`C_d(z)=\\frac{${polynomial(n1,n0,'z')}}{${polynomial(d1,d0,'z')}}`,'Exact primitive integer coefficients'));}
    else algebra.append(eq(`C_d(z)=\\frac{${polynomial(tex(m.n1),tex(m.n0),'z')}}{${polynomial(tex(m.d1),tex(m.d0),'z')}}`,'Numerical prewarped coefficients'));
    if(m.staticGain!==undefined)algebra.append(p(`Exact proportional factors cancel. The minimal zero-state controller is the static gain ${fmt(m.staticGain)}; artificial mapping factors are removed before realizing histories.`));
    const exactRecurrence=m.exact&&(m.staticGain===undefined?
      [neg(div(m.exact[3],m.exact[2])),div(m.exact[0],m.exact[2]),div(m.exact[1],m.exact[2])]:
      [parseRational('0'),c.a1.n?div(c.b1,c.a1):div(c.b0,c.a0),parseRational('0')]);
    const recurrence=exactRecurrence?exactRecurrence.map(latexRat):[m.alpha,m.beta0,m.beta1].map(tex);
    algebra.append(eq(`u[k]${exactRecurrence?'=':'\\approx'}(${recurrence[0]})u[k-1]+(${recurrence[1]})e[k]+(${recurrence[2]})e[k-1]`,'Checked controller recurrence'));
    const checkRows=predictionLabels.map((label,i)=>{const expected=[m.alpha,m.beta0,m.beta1][i],draft=drafts.get(label)!;
      if(draft.empty)return [label,'No attempt',fmt(expected)];try{const answer=num(parseRational(scalar(label,1e6),1e6));return[label,Math.abs(answer-expected)<=1e-7*Math.max(1,Math.abs(expected))?'Matches (relative tolerance10⁻⁷)':'Revise this coefficient',fmt(expected)];}catch(e){return[label,(e as Error).message,fmt(expected)];}});
    algebra.append(table(['Coefficient','Your attempt','Checked value'],checkRows));output.append(algebra);
    const loop=el('section');loop.append(el('h2','Actual sampled loop and response'));
    const {ad,bd}=zoh(m);loop.append(eq(`A_d=e^{-aT}=${tex(ad)},\\quad B_d=\\frac{K}{a}(1-e^{-aT})=${tex(bd)},\\quad G_d(z)=\\frac{B_d}{z-A_d}`,'Exact plant ZOH formula, numerical values'),
      p('This is the ZOH equivalent of the plant. The controller above came from the selected approximation. Combining these two models gives the actual loop.'),
      eq('L(z)=C_d(z)G_d(z),\\qquad Y(z)/R(z)=L(z)/(1+L(z))','Actual open and closed loop'),
      eq(m.staticGain!==undefined?`P(z)\\approx z-(${tex(ad-bd*m.staticGain)})`:`P(z)\\approx(${tex(m.d1)})z^2+(${tex(m.d0-ad*m.d1+bd*m.n1)})z+(${tex(-ad*m.d0+bd*m.n0)})`,'Full actual closed-loop characteristic polynomial, rounded coefficients'));
    const poleText=closedPoles(m).map(z=>`${fmt(z.re)}${z.im?`${z.im<0?'−':'+'}j${fmt(Math.abs(z.im))}`:''} (|z|=${fmt(magnitude(z))})`).join('; ');
    loop.append(p(`Closed-loop poles: ${poleText}. Classification: ${stability(m)}${stability(m)==='boundary'?' / within10⁻¹⁰ of the unit circle; asymptotic stability is not established':''}. This checks every implemented controller/plant mode after exact static reduction.`));
    if(s.stopped)loop.append(p(s.stopped));
    const last=s.samples.at(-1)!,analog=Array.from({length:641},(_,i)=>{const t=last.t*i/640;return{t,y:analogStep(m,t)};});
    loop.append(eq('y(kT+\\tau)=e^{-a\\tau}y[k]+\\frac{K}{a}(1-e^{-a\\tau})u[k],\\quad0\\le\\tau<T','Held-plant intersample formula'),
      p('The held-plant curve joins eight evaluated points per interval; the analog reference joins 641 points. These are sampled illustrations of the formulas. The filled points show actual sample instants.'),
      plot([{name:'held-plant path (8 points/interval)',values:s.held,kind:'solid'},{name:'samples y[k]',values:s.samples.map(r=>({t:r.t,y:r.y})),kind:'dots'},{name:'original analog loop',values:analog,kind:'dash'}],'Output y / unit reference','Time t (s)'),
      plot([{name:'held control u[k]',values:s.samples.flatMap((r,i)=>i<s.samples.length-1?[{t:r.t,y:r.u},{t:s.samples[i+1].t,y:r.u}]:[{t:r.t,y:r.u}]),kind:'solid'}],'Control effort u','Time t (s)'),
      p(`At the last available sample k=${last.k}, t=${fmt(last.t)} s: actual y=${fmt(last.y)}, original analog y=${fmt(analogStep(m,last.t))}. A finite trace does not establish settling or stability. The analog reference uses the same C(s), G(s) and feedback; emulation need not preserve its performance.`));
    cursorBox(m,s,loop);output.append(loop);
    const frequency=el('section');frequency.append(el('h2','Actual loop margins'),p(`Physical frequency ω is in rad/s, 0≤ω≤π/T=${fmt(Math.PI/m.settings.T)}. For inspection choose DC or ω≥0.000001 rad/s. The open-loop channel is L(eʲωᵀ). Crossings come from a quadratic in tan²(ωT/2) and a linear phase equation; plotted response samples are not used to infer them.`));
    const result=margins(m);
    frequency.append(table(['Unity-gain ω (rad/s)','Loop phase (°)','Phase margin (°)'],result.gainCrossings.map(x=>[fmt(x.omega),fmt(x.phase),fmt(x.margin)])),
      p(result.gainCrossings.length?'Phase margin uses the signed principal convention (−180°,180°], with the continuous phase branch shown in the table. Multiple crossings and unstable open-loop poles require the full closed-loop pole check.':'No isolated interior unity-gain crossing was found in the supported domain; no phase margin is assigned.'),
      table(['Negative-real ω (rad/s)','Gain margin factor','Gain margin (dB)'],result.phaseCrossings.map(x=>[`${fmt(x.omega)}${x.endpoint?' (endpoint)':''}`,fmt(x.margin),fmt(x.db!)])),
      p(result.phaseCrossings.length?'Each negative-real crossing is listed, including a defined Nyquist endpoint. Gain margin scales this actual loop; the smallest positive factor alone does not certify stability.':'No isolated negative-real crossing was found; no finite gain-margin threshold is assigned. Singular/continuum qualifications below take precedence.'),
      p(result.qualified?'Crossing residuals satisfy the numerical checks. Closed-loop stability is assessed separately from these margins.':'This margin calculation is numerically qualified; use the notes and full pole check.'));
    for(const note of result.notes)frequency.append(p(note));frequencyBox(m,frequency);output.append(frequency);
  }
  const run=()=>{try{const c=readController(cs.map(label=>scalar(label))),settings={method:method.value as Method,T:readNumericInput(period,'sample period T'),prewarp:pre.checked?readNumericInput(warp,'prewarp frequency'):undefined,plantK:num(parseRational(scalar('Plant gain K'))),plantA:num(parseRational(scalar('Plant decay a (s⁻¹)')))};
    const intervals=readNumericInput(count,'sample intervals'),m=discretize(c,settings),s=simulate(m,intervals);render(m,s);error.textContent='Result recalculated from the current inputs. Compare your recurrence and the actual loop checks.';
  }catch(e){resultScope.abort();output.replaceChildren();error.textContent=(e as Error).message;}};
  reveal.addEventListener('click',run,{signal});
  for(const input of [period,warp,count])input.addEventListener('input',invalidate,{signal});
  const samplingChange=()=>{pre.disabled=method.value!=='tustin';if(pre.disabled)pre.checked=false;warp.disabled=!pre.checked;invalidate();};
  method.addEventListener('change',samplingChange,{signal});pre.addEventListener('change',samplingChange,{signal});
  presets.addEventListener('change',()=>{const values=presets.value==='pi'?['1','2','1','0']:presets.value==='derivative'?['1','0','.05','1']:presets.value==='static'?['0','2','0','1']:['12','32','1','6'];controller.forEach((e,i)=>{e.setValue(values[i]);drafts.set(cs[i],e.getValue());});invalidate();},{signal});
  return()=>{signal.removeEventListener('abort',cleanup);cleanup();};
};
