import type { ModuleMount } from '../../core/module';
import { createEquationDisplay, createEquationInput, type EquationDraft } from '../../shared/equations/input';
import { readNumericInput } from '../../shared/numeric-input';
import { aliasExperiment, decimalLiteral, inversePole, mapPole, modeSamples, parsePole, radialMovement, type Pole } from './math';
import { complex, fmt, sequencePlot } from './plots';
import { explorationPlanes, sizePlots, worldPoint, type PlaneWindow } from './exploration-plots';
import './style.css';

interface Model {pole:Pole;T:number;T0:number;N:number}
const poleText=(p:Pole)=>`s=${decimalLiteral(p.real)}${p.imag<0?'-':'+'}${decimalLiteral(Math.abs(p.imag))}j`;

export const mount:ModuleMount=({container,signal})=>{
  const life=new AbortController(),forward=()=>life.abort();signal.addEventListener('abort',forward,{once:true});if(signal.aborted)life.abort();
  const root=document.createElement('div');root.className='dp-tool dp-explore';
  root.innerHTML=`<section class="dp-card">
    <div class="dp-controls dp-period-controls">
      <label>Target T (seconds)<input data-field="period" type="number" min="0.001" max="10" step="any" value="0.1"></label>
      <label>Move target T (logarithmic)<input data-field="period-range" type="range" min="-3" max="1" step="0.001" value="-1"></label>
    </div>
    <p class="dp-message" role="status" aria-live="polite"></p>
    <div class="dp-live-planes" tabindex="-1"></div>
    <p class="dp-window-note dp-help"></p>
    <div class="dp-controls">
      <label>Real part σ (s⁻¹)<input data-field="sigma" type="number" min="-1000" max="1000" step="any" value="-2"></label>
      <label>Imaginary part ω (rad/s)<input data-field="omega" type="number" min="-10000" max="10000" step="any" value="3"></label>
    </div>
    <div class="dp-presets"><button type="button" data-action="fit">Fit plots</button><button type="button" data-action="cancel" disabled>Cancel pole drag</button></div>
    <p class="dp-help">Drag either continuous cross on a 0.01 grid. Arrow keys move it by 0.01; Shift moves by 0.1. Conjugates stay paired. Escape cancels a drag. Numeric entry retains the full supported domain.</p>
    <div class="dp-live-readout"></div>
  </section>
  <section class="dp-card"><h3>Sampled free mode</h3><div class="dp-live-sequence"></div>
    <div class="dp-controls"><label>Inspect sample k<input data-field="sample" type="number" min="0" max="30" step="1" value="0"></label><label>Move sample cursor<input data-field="sample-range" type="range" min="0" max="30" step="1" value="0"></label></div>
    <p class="dp-sample-readout"></p><p class="dp-inspection-error" role="status"></p>
    <p class="dp-help">Stems are integer samples of x[k] = rᵏ cos(kθ), starting at 1. Dashed envelopes guide the eye; no output between samples is inferred.</p>
  </section>
  <details class="dp-card"><summary>Equation, reference period, sample count and experiments</summary><div class="dp-editor"></div>
    <div class="dp-controls"><label>Reference T (seconds)<input data-field="reference" type="number" min="0.001" max="10" step="any" value="0.1"></label><label>Sample intervals N<input data-field="count" type="number" min="4" max="100" step="1" value="30"></label></div>
    <div class="dp-presets" role="group" aria-label="Pole experiments"><button type="button" data-preset="baseline">Baseline −2 ± 3j</button><button type="button" data-preset="negative">Alternating decay: z = −0.8</button><button type="button" data-preset="growth">Growing mode</button><button type="button" data-preset="boundary">Unit-circle mode</button></div>
    <p class="dp-help">One pole and its conjugate, not a complete plant or feedback loop. T is 0.001–10 s; |σ| ≤ 1000, |ω| ≤ 10000, |σT| ≤ 20, |ωT| ≤ 200π; N is 4–100 with σTN ≤ 30 for growth. Unsupported drafts retain the explicitly labelled last checked mapping.</p>
  </details>
  <details class="dp-card"><summary>Inverse branches, aliasing and mathematical meaning</summary>
    <label class="dp-branch">Inverse branch m<select data-field="branch"></select></label><div class="dp-inverse-readout"></div>
    <p>Angles use (−π, π]. An inverse needs a branch restriction; samples alone cannot choose it. Radius determines the selected mode's decay, including negative-real z. Every mode and multiplicity matter for a complete-system stability claim.</p>
    <div class="dp-alias-readout"></div>
  </details>`;
  container.append(root);
  const get=<T extends HTMLElement>(selector:string)=>root.querySelector<T>(selector)!;
  const input=(name:string)=>get<HTMLInputElement>(`[data-field="${name}"]`);
  const sigma=input('sigma'),omega=input('omega'),period=input('period'),reference=input('reference'),count=input('count'),periodRange=input('period-range');
  const kInput=input('sample'),kRange=input('sample-range'),branch=get<HTMLSelectElement>('[data-field="branch"]');
  for(let m=-5;m<=5;m++){const option=document.createElement('option');option.value=String(m);option.textContent=String(m);branch.append(option);}branch.value='0';
  const planes=get<HTMLDivElement>('.dp-live-planes'),sequence=get<HTMLDivElement>('.dp-live-sequence'),message=get<HTMLParagraphElement>('.dp-message'),cancelButton=get<HTMLButtonElement>('[data-action="cancel"]');
  let draft:EquationDraft,checked:Model={pole:{real:-2,imag:3},T:.1,T0:.1,N:30},viewWindow:PlaneWindow={s:5,z:1.2},samples=modeSamples(checked.pole,.1,30),selected=0,timer:ReturnType<typeof setTimeout>|undefined,disposed=false;
  type Snapshot={values:string[];latex:string};
  let drag:{id:number;side:number;start:Snapshot}|undefined;
  const clearTimer=()=>{if(timer!==undefined){clearTimeout(timer);timer=undefined;}};
  const fields=[sigma,omega,period,reference,count];
  const snapshot=():Snapshot=>({values:fields.map(f=>f.value),latex:equation.getValue().latex});
  const rejected=(error:unknown)=>{message.textContent=`Draft rejected — last checked mapping shown. ${(error as Error).message}`;};
  const readModel=():Model=>{
    if(draft.empty)throw new Error('Enter a supported continuous pole or both numeric components.');
    if(draft.hasPlaceholders||draft.syntaxIssues.length)throw new Error('Complete the pole notation before exploring.');
    const pole=parsePole(draft.latex),real=readNumericInput(sigma,'σ'),imag=readNumericInput(omega,'ω');
    if(real!==pole.real||imag!==pole.imag)throw new Error('Complete matching pole components or edit the visual equation.');
    return {pole,T:readNumericInput(period,'target T'),T0:readNumericInput(reference,'reference T'),N:readNumericInput(count,'sample count')};
  };
  const inspect=()=>{
    const p=samples[selected];get('.dp-sample-readout').textContent=`k = ${selected}; t = ${fmt(p.time)} s; x[k] ≈ ${fmt(p.value,8)}; envelope rᵏ ≈ ${fmt(p.envelope,8)}.`;
    kRange.value=String(selected);kRange.max=kInput.max=String(checked.N);
    sequence.querySelector('[data-selected-sample]')?.remove();
    const svg=sequence.querySelector('svg');if(svg){const marker=document.createElementNS('http://www.w3.org/2000/svg','circle'),scale=Math.max(1,...samples.map(p=>p.envelope));marker.setAttribute('cx',String(55+selected/checked.N*320));marker.setAttribute('cy',String(125-p.value/scale*80));marker.setAttribute('r','6');marker.setAttribute('class','dp-selected-sample');marker.dataset.selectedSample='';svg.append(marker);}
  };
  function publish(model:Model):void {
    const z=mapPole(model.pole,model.T),previous=mapPole(model.pole,model.T0),nextSamples=modeSamples(model.pole,model.T,model.N),inv=inversePole(z,model.T,Number(branch.value)),alias=aliasExperiment(model.pole,model.T,model.N);
    const nextPlanes=explorationPlanes(model.pole,model.T,model.T0,inv,viewWindow),nextSequence=sequencePlot(model.pole,model.T,model.N);
    const readout=document.createElement('div');
    readout.append(createEquationDisplay(`z=e^{sT}\\approx ${decimalLiteral(z.real)}${z.imag<0?'-':'+'}${decimalLiteral(Math.abs(z.imag))}j`,'Checked mapped pole'));
    const values=document.createElement('p');values.textContent=`Checked s = ${complex(model.pole)}; T = ${fmt(model.T,9)} s; r ≈ ${fmt(z.radius,9)}; θ ≈ ${fmt(z.angle,9)} rad/sample. Reference T = ${fmt(model.T0,9)} s, rref ≈ ${fmt(previous.radius,9)}. ${radialMovement(model.pole,model.T0,model.T)} radius movement. ${z.classification==='decay'?'This mode decays.':z.classification==='growth'?'This mode grows.':'Boundary or numerically near-boundary radius (tolerance 10⁻¹⁰).'} `;readout.append(values);
    const inverse=document.createElement('p');inverse.textContent=`s${branch.value} ≈ ${complex(inv)}; original ω = ${fmt(model.pole.imag)} rad/s. Unwrapped ωT = ${fmt(model.pole.imag*model.T)} rad. Changing m preserves z; it changes the inferred continuous frequency.`;
    const aliases=document.createElement('div'),aliasText=document.createElement('p');aliases.append(createEquationDisplay(String.raw`e^{(s+j2\pi/T)kT}=e^{skT}\quad(k\in\mathbb Z)`,'Exact alias identity at integer samples'));
    aliasText.textContent=`Alias ω + 2π/T = ${fmt(alias.alias.imag)} rad/s. Every integer sample agrees by the identity; floating-point illustration residual over 0…${model.N}: ${alias.residual.toExponential(2)}. This derived alias may be outside the editable pole range. Intersample modes generally differ.`;aliases.append(aliasText);
    const focus=planes.contains(document.activeElement)?(document.activeElement as HTMLElement)?.dataset.poleHandle:undefined;
    const inspectionDraft=kInput.value,invalidInspection=Boolean(get('.dp-inspection-error').textContent);
    checked=model;samples=nextSamples;selected=Math.min(selected,model.N);kInput.value=invalidInspection?inspectionDraft:String(selected);
    planes.replaceChildren(nextPlanes);sequence.replaceChildren(nextSequence);get('.dp-live-readout').replaceChildren(readout);get('.dp-inverse-readout').replaceChildren(inverse);get('.dp-alias-readout').replaceChildren(aliases);
    const clipped=Math.max(Math.abs(model.pole.real),Math.abs(model.pole.imag),Math.abs(inv.real),Math.abs(inv.imag))>viewWindow.s||Math.max(z.radius,previous.radius)>viewWindow.z;
    get('.dp-window-note').textContent=clipped?'Some checked poles, inverse branches or radii are outside the fixed view. Values remain listed; use Fit plots.':'Equal plane axes are fixed. Reference T stays fixed while you move target T.';
    message.textContent=`Checked · ${model.N} intervals · ${fmt(model.N*model.T)} s.`;
    periodRange.value=String(Math.log10(model.T));periodRange.setAttribute('aria-valuetext',`${fmt(model.T,9)} seconds`);
    inspect();sizePlots(root);if(focus)(planes.querySelector<SVGElement>(`[data-pole-handle="${focus}"]`)??planes.querySelector<SVGElement>('[data-pole-handle="1"]'))?.focus({preventScroll:true});
  }
  const commit=()=>{clearTimer();if(disposed||life.signal.aborted)return;try{publish(readModel());}catch(error){rejected(error);}};
  const queue=()=>{if(disposed||life.signal.aborted)return;message.textContent='Updating — previous checked mapping shown.';if(timer===undefined)timer=setTimeout(commit,32);};
  const equation=createEquationInput({label:'Continuous pole s',value:'s=-2+3j',signal:life.signal,tools:['fraction','parentheses','pi'],description:'Enter one pole a + bj using numbers, pi, fractions and arithmetic; powers and functions are unsupported.',onChange:next=>{draft=next;try{const p=parsePole(next.latex);sigma.value=String(p.real);omega.value=String(p.imag);queue();}catch(error){clearTimer();rejected(error);}}});
  get('.dp-editor').append(equation.element);draft=equation.getValue();
  const setPole=(p:Pole)=>{sigma.value=String(p.real);omega.value=String(p.imag);equation.setValue(poleText(p));draft=equation.getValue();};
  for(const field of [sigma,omega])field.addEventListener('input',()=>{try{setPole({real:readNumericInput(sigma,'σ'),imag:readNumericInput(omega,'ω')});queue();}catch(error){clearTimer();rejected(error);}},{signal:life.signal});
  for(const field of [period,reference,count])field.addEventListener('input',queue,{signal:life.signal});
  periodRange.addEventListener('input',()=>{try{period.value=String(10**readNumericInput(periodRange,'logarithmic T'));queue();}catch(error){rejected(error);}},{signal:life.signal});
  for(const field of [kInput,kRange])field.addEventListener('input',()=>{try{const k=readNumericInput(field,'sample k');if(!Number.isInteger(k)||k<0||k>checked.N)throw new Error(`Choose an integer sample from 0 to ${checked.N}.`);selected=k;kInput.value=String(k);get('.dp-inspection-error').textContent='';inspect();}catch(error){get('.dp-inspection-error').textContent=(error as Error).message;}},{signal:life.signal});
  const viewOnly=()=>{const prior=message.textContent,inspection=kInput.value,invalid=Boolean(get('.dp-inspection-error').textContent);try{publish(checked);if(!prior?.startsWith('Checked ·'))message.textContent=prior;if(invalid)kInput.value=inspection;}catch(error){rejected(error);}};
  branch.addEventListener('change',viewOnly,{signal:life.signal});
  get('[data-action="fit"]').addEventListener('click',()=>{const z=mapPole(checked.pole,checked.T),p=mapPole(checked.pole,checked.T0),inv=inversePole(z,checked.T,Number(branch.value));viewWindow={s:Math.max(1,Math.abs(checked.pole.real),Math.abs(checked.pole.imag),Math.abs(inv.real),Math.abs(inv.imag))*1.25,z:Math.max(1,z.radius,p.radius)*1.2};viewOnly();},{signal:life.signal});
  const releaseCapture=(id:number)=>{try{if(planes.hasPointerCapture?.(id))planes.releasePointerCapture(id);}catch{/* A detached pointer may already be released. */}};
  const cancel=()=>{clearTimer();const old=drag;if(!old)return;drag=undefined;cancelButton.disabled=true;fields.forEach((field,i)=>field.value=old.start.values[i]);equation.setValue(old.start.latex);draft=equation.getValue();commit();releaseCapture(old.id);};
  cancelButton.addEventListener('click',cancel,{signal:life.signal});
  planes.addEventListener('pointerdown',event=>{const handle=(event.target as Element).closest<SVGElement>('[data-pole-handle]');if(drag||!handle||event.button!==0)return;try{clearTimer();publish(readModel());}catch(error){rejected(error);return;}event.preventDefault();planes.focus({preventScroll:true});drag={id:event.pointerId,side:Number(handle.dataset.poleHandle),start:snapshot()};cancelButton.disabled=false;try{planes.setPointerCapture(event.pointerId);}catch{/* Cancel and keyboard alternatives remain available. */}},{signal:life.signal});
  planes.addEventListener('pointermove',event=>{if(!drag||event.pointerId!==drag.id)return;const svg=planes.querySelector<SVGSVGElement>('[data-plane="s"]')!,rect=svg.getBoundingClientRect();if(!rect.width||!rect.height)return;const x=Math.max(65,Math.min(335,(event.clientX-rect.left)*400/rect.width)),y=Math.max(30,Math.min(300,(event.clientY-rect.top)*360/rect.height)),p=worldPoint(x,y,viewWindow.s);setPole({real:Math.round(p.real*100)/100,imag:Math.round(p.imag*drag.side*100)/100});queue();},{signal:life.signal});
  planes.addEventListener('pointerup',event=>{if(!drag||event.pointerId!==drag.id)return;commit();const id=drag.id;drag=undefined;cancelButton.disabled=true;releaseCapture(id);},{signal:life.signal});
  for(const type of ['pointercancel','lostpointercapture'])planes.addEventListener(type,event=>{if(drag&&(event as PointerEvent).pointerId===drag.id)cancel();},{signal:life.signal});
  planes.addEventListener('keydown',event=>{const handle=(event.target as Element).closest<SVGElement>('[data-pole-handle]');if(!handle||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;event.preventDefault();const step=event.shiftKey?.1:.01,side=Number(handle.dataset.poleHandle),p=checked.pole;setPole({real:Number((p.real+(event.key==='ArrowRight'?step:event.key==='ArrowLeft'?-step:0)).toFixed(10)),imag:Number((p.imag+side*(event.key==='ArrowUp'?step:event.key==='ArrowDown'?-step:0)).toFixed(10))});commit();(planes.querySelector<SVGElement>(`[data-pole-handle="${side}"]`)??planes.querySelector<SVGElement>('[data-pole-handle="1"]'))?.focus({preventScroll:true});},{signal:life.signal});
  window.addEventListener('keydown',event=>{if(event.key==='Escape'&&drag){event.preventDefault();event.stopImmediatePropagation();cancel();}},{capture:true,signal:life.signal});
  window.addEventListener('blur',cancel,{signal:life.signal});
  container.parentElement?.addEventListener('dp02-suspend',()=>{if(drag)cancel();else commit();},{signal:life.signal});
  for(const button of root.querySelectorAll<HTMLButtonElement>('[data-preset]'))button.addEventListener('click',()=>{cancel();clearTimer();const preset=button.dataset.preset,p=preset==='negative'?{real:Math.log(.8)/.1,imag:Math.PI/.1}:preset==='growth'?{real:1,imag:3}:preset==='boundary'?{real:0,imag:3}:{real:-2,imag:3};setPole(p);period.value='.1';reference.value=preset==='negative'?'.05':'.1';count.value='30';branch.value='0';viewWindow={s:Math.max(5,Math.abs(p.real)*1.25,Math.abs(p.imag)*1.25),z:1.2};commit();},{signal:life.signal});
  const observer=typeof ResizeObserver==='undefined'?undefined:new ResizeObserver(()=>{if(drag)cancel();sizePlots(root);});life.signal.addEventListener('abort',()=>observer?.disconnect(),{once:true});observer?.observe(root);
  const cleanup=()=>{if(disposed)return;disposed=true;clearTimer();const id=drag?.id;drag=undefined;if(id!==undefined)releaseCapture(id);observer?.disconnect();signal.removeEventListener('abort',forward);life.abort();equation.destroy();root.remove();};
  life.signal.addEventListener('abort',cleanup,{once:true});
  try{if(life.signal.aborted){cleanup();return cleanup;}publish(checked);return cleanup;}catch(error){cleanup();throw error;}
};

