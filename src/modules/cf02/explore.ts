import type{ModuleMount}from'../../core/module';
import{createEquationDisplay}from'../../shared/equations/input';
import{readNumericInput}from'../../shared/numeric-input';
import{errorNumerator,type ErrorSignal}from'./math';
import{errorBaseline,errorExperiment,inspectError,nearestErrorPoint,type ErrorDraft,type ErrorExperiment}from'./exploration';
import{exactText}from'./rational';
import{fraction,numeric,polynomial}from'./view';
import{drawTrace,fitTrace,type TraceAxes}from'./trace-plot';
import{createPreview}from'./preview';
import{gainStep}from'./gain-step';

const el=<K extends keyof HTMLElementTagNameMap>(tag:K,text='')=>{const e=document.createElement(tag);e.textContent=text;return e;};
type Axes={signals:TraceAxes;errors:TraceAxes};
type Frame={experiment:ErrorExperiment;model:HTMLElement;error:HTMLElement;signals?:ReturnType<typeof drawTrace>;errors?:ReturnType<typeof drawTrace>;axes:Axes;index:number;warnings:string[]};
type Gesture={pointer:number;frame:Frame;raw:string;message:string};
export const mountExplore:ModuleMount=({container,signal:parent})=>{
  if(parent.aborted)return;const lifetime=new AbortController(),signal=lifetime.signal,root=el('section');root.className='cf-explore';container.append(root);
  let disposed=false,observer:ResizeObserver|undefined,preview:ReturnType<typeof createPreview<ErrorDraft>>|undefined,current:Frame,gesture:Gesture|undefined,cancelledPointer:number|undefined;
  const cleanup=()=>{if(disposed)return;disposed=true;parent.removeEventListener('abort',cleanup);lifetime.abort();preview?.dispose();gesture=undefined;try{observer?.disconnect();}finally{root.remove();}};
  parent.addEventListener('abort',cleanup,{once:true});
  try{
    root.append(el('h2','Explore tracking and error'),el('p','Negative feedback, zero initial states, one scalar source at a time. Change gain or integrators and compare output with both error signals.'));
    const feedback=el('p');feedback.className='cf-feedback';feedback.setAttribute('role','status');
    const quick=el('div');quick.className='cf-live-controls';root.append(quick);
    const inputs={}as Record<'gain'|'pole'|'zero'|'sensor'|'amplitude'|'horizon',HTMLInputElement>;
    const number=(host:HTMLElement,key:keyof typeof inputs,label:string,value:string,min:string,max:string)=>{const l=el('label',label),input=el('input');input.type='number';input.step='any';input.value=value;input.min=min;input.max=max;input.setAttribute('aria-label',label);l.append(input);host.append(l);inputs[key]=input;input.addEventListener('input',()=>{cancelGesture(key==='gain');schedule();},{signal});return input;};
    number(quick,'gain','Explore normalized gain g','4','.05','50');
    const range=el('input');range.type='range';range.min='.05';range.max='50';range.step='any';range.value='4';range.setAttribute('aria-label','Explore gain control');quick.append(range);
    const chips=el('div');chips.className='cf-actions';chips.setAttribute('role','group');chips.setAttribute('aria-label','Number of origin integrators');root.append(chips);
    let integrators=1;const chipButtons:HTMLButtonElement[]=[];
    for(let n=0;n<=2;n++){const b=el('button',`${n} integrator${n===1?'':'s'}`);b.type='button';b.setAttribute('aria-pressed',String(n===1));chips.append(b);chipButtons.push(b);b.addEventListener('click',()=>{cancelGesture();integrators=n;syncChips();schedule();},{signal});}
    const selectors=el('div');selectors.className='cf-live-controls';root.append(selectors);
    const select=(host:HTMLElement,label:string,values:readonly(readonly[string,string])[],value:string)=>{const l=el('label',label),s=el('select');s.setAttribute('aria-label',label);for(const[v,text]of values){const o=el('option',text);o.value=v;s.append(o);}s.value=value;l.append(s);host.append(l);s.addEventListener('change',()=>{cancelGesture();schedule();},{signal});return s;};
    const channel=select(selectors,'Explore active source',[['reference','Reference r'],['disturbance','Plant-input disturbance d'],['noise','Sensor noise ν after H']],'reference');
    const order=select(selectors,'Explore input shape',[['0','Step A'],['1','Ramp A t'],['2','Parabolic A t²/2']],'1');
    const modelHost=el('div'),plots=el('div'),signalHost=el('div'),errorColumn=el('div'),errorHost=el('div'),errorPlotHost=el('div');plots.className='cf-live-plots';signalHost.className='cf-live-signal-host';errorPlotHost.className='cf-live-error-host';errorColumn.append(errorHost,errorPlotHost);plots.append(signalHost,errorColumn);root.append(modelHost,plots);
    const viewControls=el('div');viewControls.className='cf-live-controls';root.append(viewControls);
    const selectedError=select(viewControls,'Explore selected error',[['comparator','Comparator r−H y−ν'],['physical','Physical tracking r−y']],'comparator');
    const timeLabel=el('label','Inspect time t (s)'),time=el('input');time.type='number';time.step='any';time.min='0';time.value='0';time.setAttribute('aria-label','Explore inspection time (s)');timeLabel.append(time);viewControls.append(timeLabel);
    const timeRange=el('input');timeRange.type='range';timeRange.min='0';timeRange.step='1';timeRange.value='0';timeRange.setAttribute('aria-label','Inspect checked trace point');viewControls.append(timeRange);
    const cursorError=el('p'),readout=el('div'),warnings=el('div');cursorError.setAttribute('role','status');root.append(cursorError,readout,warnings,feedback);
    const actions=el('div');actions.className='cf-actions';root.append(actions);
    const action=(label:string,fn:()=>void)=>{const b=el('button',label);b.type='button';actions.append(b);b.addEventListener('click',()=>{if(disposed)return;try{fn();}catch(error){report(error);}},{signal});return b;};
    action('Fit checked trace axes',()=>{cancelGesture();if(!current)return;const experiment=current.experiment,next=prepare(experiment,undefined,current);if(next)publish(next);});
    action('Restore Explore baseline',()=>{cancelGesture();preview?.cancel();const draft=errorBaseline(),experiment=errorExperiment(draft),frame=prepare(experiment);if(!frame)return;writeSource(draft);time.value='0';publish(frame);feedback.textContent='Explore baseline restored. Practice inputs are independent.';});
    const settings=el('details');settings.className='cf-card';settings.append(el('summary','Other source values, sensor and horizon'));const settingsGrid=el('div');settingsGrid.className='cf-live-controls';settings.append(settingsGrid);root.append(settings);
    number(settingsGrid,'pole','Explore finite pole rate a (s⁻¹)','2','.1','10');number(settingsGrid,'zero','Explore zero rate z (s⁻¹)','1','.05','10');
    const zeroLabel=el('label','Include numerator zero'),zeroEnabled=el('input');zeroEnabled.type='checkbox';zeroEnabled.setAttribute('aria-label','Explore numerator zero');zeroLabel.append(zeroEnabled);settingsGrid.append(zeroLabel);inputs.zero.disabled=true;
    zeroEnabled.addEventListener('change',()=>{cancelGesture();inputs.zero.disabled=!zeroEnabled.checked;schedule();},{signal});
    number(settingsGrid,'sensor','Explore sensor gain H','1','.1','10');number(settingsGrid,'amplitude','Explore amplitude A','1','-10','10');number(settingsGrid,'horizon','Explore trace horizon (s)','10','.1','120');
    settings.append(el('p','P(s)=g/[sⁿ(s+a)], or g(s+z)/[sⁿ(s+a)] when the zero is enabled. g=.05…50, a=.1…10 s⁻¹, z=.05…10 s⁻¹, H=.1…10, A=−10…10, horizon=.1…120 s. Signals use normalized units; A is units/s for a ramp and units/s² for a parabola. Inactive sources and all initial states are zero.'));
    settings.append(el('p','Gain pointer edits use a .05 grid; keyboard arrows change .1 (Shift: 1), Home/End select the full bounds, and native number entry retains its full digits. All exact certificates and numerical work limits are unchanged. The trace uses the original bounded transition and 600…40,000 intervals. Readouts inspect the nearest computed timestamp; endpoint agreement is not a final-value or settling-time proof. Use Practice for the complete derivation, exact equation entry and source provenance.'));
    const readSource=():ErrorDraft=>{
      for(const[key,input]of Object.entries(inputs)){if(key==='zero'&&!zeroEnabled.checked)continue;readNumericInput(input,key);}
      return{gain:inputs.gain.value,pole:inputs.pole.value,zero:zeroEnabled.checked?inputs.zero.value:current?.experiment.draft.zero??'1',zeroEnabled:zeroEnabled.checked,integrators,sensor:inputs.sensor.value,channel:channel.value as ErrorDraft['channel'],order:Number(order.value),amplitude:inputs.amplitude.value,horizon:readNumericInput(inputs.horizon,'trace horizon'),error:selectedError.value as ErrorSignal};
    };
    function sourceSame(a:ErrorDraft,b:ErrorDraft){return(Object.keys(a)as(keyof ErrorDraft)[]).every(key=>a[key]===b[key]);}
    function report(error:unknown){if(disposed)return;feedback.textContent=`${error instanceof Error?error.message:'Check the source inputs.'} Plots and limits still describe the last checked source.`;syncRange();}
    function syncChips(){chipButtons.forEach((b,n)=>b.setAttribute('aria-pressed',String(n===integrators)));}
    function syncRange(){if(!disposed&&current){range.value=current.experiment.draft.gain;range.setAttribute('aria-valuetext',`Checked gain ${current.experiment.draft.gain}`);}}
    function schedule(){if(disposed)return;try{const draft=readSource();preview?.request(draft);feedback.textContent=`Updating source. Plots and limits remain checked for g=${current.experiment.draft.gain}, n=${current.experiment.draft.integrators}, ${current.experiment.draft.channel}, H=${current.experiment.draft.sensor}.`;}catch(error){preview?.cancel();report(error);}}
    function writeSource(draft:ErrorDraft){for(const key of Object.keys(inputs)as(keyof typeof inputs)[])inputs[key].value=String(draft[key]);integrators=draft.integrators;syncChips();channel.value=draft.channel;order.value=String(draft.order);selectedError.value=draft.error;zeroEnabled.checked=draft.zeroEnabled;inputs.zero.disabled=!draft.zeroEnabled;}
    function prepare(experiment:ErrorExperiment,oldAxes?:Axes,reuse?:Frame):Frame|undefined{
      if(disposed)return;const d=experiment.draft,m=experiment.model,model=reuse?.experiment===experiment?reuse.model:el('div'),error=reuse?.experiment===experiment?reuse.error:el('div');
      if(!reuse||reuse.experiment!==experiment){
        const plant=createEquationDisplay(`P(s)=\\frac{${polynomial(m.numerator)}}{${polynomial(m.denominator)}},\\quad H=${fraction(m.h)}`,'Checked forward path and sensor');if(disposed)return;plant.tabIndex=0;model.append(plant,el('p',`Checked: ${d.channel}, ${['step','ramp','parabolic'][d.order]}, A=${d.amplitude}; ${m.integrators} origin integrators; full closed loop ${m.stability.kind==='stable'?'strictly Hurwitz':m.stability.kind}.`));
        const variable=d.channel==='reference'?'R':d.channel==='disturbance'?'D_d':'V',name=d.error==='comparator'?'E_c':'E_t';
        const derived=createEquationDisplay(`${name}(s)/${variable}(s)=\\frac{${polynomial(errorNumerator(m,d.channel,d.error))}}{${polynomial(m.closed)}}`,'Checked selected error channel before type-table interpretation');if(disposed)return;derived.tabIndex=0;error.append(derived);
        const limit=experiment.limits[d.error];
        if(limit.kind==='uncertified')error.append(el('p',limit.reason));else{
          const result=createEquationDisplay(limit.kind==='finite'?`\\lim_{t\\to\\infty}${d.error==='comparator'?'e_c':'e_t'}(t)=${fraction(limit.value)}`:`${d.error==='comparator'?'e_c':'e_t'}(t)\\sim ${polynomial(limit.polynomial,'t')}`,'Checked exact limit or long-time polynomial');if(disposed)return;result.tabIndex=0;error.append(result);
          if(limit.kind==='finite'&&limit.reason!=='stable')error.append(el('p',`${limit.reason==='zero-input'?'Zero-source':'Identically zero-channel'} identity with zero initial state; the full-loop stability label remains separate.`));
        }
        const details=el('details');details.append(el('summary','Full-loop polynomial and sensor-loop constants'));const certificate=createEquationDisplay(`Q(s)=${polynomial(m.closed)}`,'Full characteristic polynomial retained before cancellation');if(disposed)return;certificate.tabIndex=0;details.append(certificate,el('p',`Kp=${experiment.constants[0].kind==='infinite'?'∞':exactText(experiment.constants[0].value!)}; Kv=${experiment.constants[1].kind==='infinite'?'∞':exactText(experiment.constants[1].value!)} s⁻¹; Ka=${experiment.constants[2].kind==='infinite'?'∞':exactText(experiment.constants[2].value!)} s⁻². These describe reference comparator error; the selected channel above is authoritative.`));if(m.stability.determinant)details.append(el('p',`Cubic Hurwitz determinant a₂a₁−a₃a₀=${exactText(m.stability.determinant)}.`));error.append(details);
      }
      const points=experiment.run?.points??[],horizon=d.horizon,axes:Axes=oldAxes?{signals:{...oldAxes.signals,end:Math.max(oldAxes.signals.end,points.at(-1)?.t??horizon)},errors:{...oldAxes.errors,end:Math.max(oldAxes.errors.end,points.at(-1)?.t??horizon)}}:{signals:fitTrace(points,['input','output'],horizon),errors:fitTrace(points,['comparator','physical'],horizon)};
      const messages:string[]=[];if(experiment.traceError)messages.push(`Numerical trace unavailable: ${experiment.traceError}`);if(experiment.run?.truncated)messages.push('Trace truncated at the original 10¹² state/signal bound. No limit is inferred from that stopped curve.');if(experiment.run?.resolutionLimited)messages.push('The 40,000-interval sample budget was reached; fast modes may be unresolved. Reduce the horizon.');
      let signals:Frame['signals'],errors:Frame['errors'],index=0;
      if(points.length){signals=drawTrace(points,['input','output'],axes.signals,signalHost.clientWidth,'Active input and output');if(disposed)return;errors=drawTrace(points,['comparator','physical'],axes.errors,errorPlotHost.clientWidth,'Comparator and physical error');if(disposed)return;
        const oldTime=current?.experiment.run?.points[current.index]?.t??0;index=nearestErrorPoint(experiment,Math.min(oldTime,points.at(-1)!.t)).index;signals.update(index);errors.update(index);
        const clipped=Object.values(signals.counts).reduce((a,b)=>a+b,0)+Object.values(errors.counts).reduce((a,b)=>a+b,0);if(clipped)messages.push(`${clipped} plotted signal values exceed the fixed vertical ranges. Boundary triangles mark truncation; Fit includes the checked values.`);
      }
      return{experiment,model,error,signals,errors,axes,index,warnings:messages};
    }
    function publish(frame:Frame){if(disposed)return;current=frame;if(modelHost.firstElementChild!==frame.model)modelHost.replaceChildren(frame.model);if(errorHost.firstElementChild!==frame.error)errorHost.replaceChildren(frame.error);signalHost.replaceChildren(el('p',`${frame.experiment.draft.channel==='reference'?'Reference r':frame.experiment.draft.channel==='disturbance'?'Plant-input disturbance d':'Sensor noise ν'} — solid; output y — dashed.`),...(frame.signals?[frame.signals.element]:[el('p','No checked numerical trace.')]));errorPlotHost.replaceChildren(el('p','Comparator e_c — solid; physical tracking e_t — dashed.'),...(frame.errors?[frame.errors.element]:[]));warnings.replaceChildren(...frame.warnings.map(text=>el('p',text)));syncRange();renderInspection();}
    function renderInspection(){
      if(disposed)return;const run=current.experiment.run;time.disabled=timeRange.disabled=!run?.points.length;
      if(!run?.points.length){readout.replaceChildren(el('p','Numerical inspection is unavailable; the exact certificate above remains independent.'));cursorError.textContent='';return;}
      let issue='';try{current.index=nearestErrorPoint(current.experiment,readNumericInput(time,'inspection time')).index;}catch(error){issue=error instanceof Error?error.message:'Choose a checked time.';}
      const point=inspectError(current.experiment,current.index);current.signals?.update(current.index);current.errors?.update(current.index);time.max=String(run.points.at(-1)!.t);timeRange.max=String(run.points.length-1);timeRange.value=String(current.index);timeRange.setAttribute('aria-valuetext',`Checked time ${numeric(point.point.t)} seconds; point ${current.index}`);
      readout.replaceChildren(el('p',`Checked sample t=${numeric(point.point.t)} s: active input ${numeric(point.point.input)}, y=${numeric(point.point.output)}, comparator ${numeric(point.point.comparator)}, physical ${numeric(point.point.physical)}.`),el('p',point.asymptote===null?'No certified asymptote is compared at this point.':`Selected-error sample ${numeric(point.selected)}; numerical evaluation of its exact asymptotic ${current.experiment.limits[current.experiment.draft.error].kind==='finite'?'value':'polynomial'} ${numeric(point.asymptote)}; difference ${numeric(point.difference!)}. Endpoint agreement is not a convergence certificate.`));
      cursorError.textContent=issue?`${issue} Markers retain checked t=${numeric(point.point.t)} s.`:'The markers use the nearest original computed timestamp; no interpolation is claimed.';
    }
    function cancelGesture(preserveGain=false){if(!gesture)return;const before=gesture;cancelledPointer=before.pointer;gesture=undefined;preview?.cancel();if(disposed)return;if(!preserveGain)inputs.gain.value=before.raw;publish(before.frame);feedback.textContent=before.message;}
    preview=createPreview(signal,draft=>{const experiment=errorExperiment(draft,current?.experiment),frame=prepare(experiment,current?.axes);if(!frame||disposed)return;publish(frame);feedback.textContent='Checked current source. The exact limit and finite numerical trace retain their separate qualifications.';},report);
    range.addEventListener('input',()=>{if(cancelledPointer!==undefined){syncRange();return;}inputs.gain.value=String(Math.max(.05,Math.min(50,Math.round(Number(range.value)*20)/20)));schedule();},{signal});
    range.addEventListener('pointerdown',event=>{if(gesture||event.isPrimary===false){event.preventDefault();return;}if(event.button!==0)return;cancelledPointer=undefined;preview?.flush();if(disposed)return;try{const draft=readSource();if(!sourceSame(draft,current.experiment.draft))throw new Error('Complete and check the current source inputs before dragging.');gesture={pointer:event.pointerId,frame:current,raw:inputs.gain.value,message:feedback.textContent??''};}catch(error){event.preventDefault();report(error);}},{signal});
    range.addEventListener('keydown',event=>{
      if(!['Home','End','ArrowLeft','ArrowDown','ArrowRight','ArrowUp'].includes(event.key))return;event.preventDefault();cancelGesture();
      try{const next=event.key==='Home'?'0.05':event.key==='End'?'50':gainStep(current.experiment.draft.gain,event.key==='ArrowLeft'||event.key==='ArrowDown'?-1:1,event.shiftKey);if(disposed)return;inputs.gain.value=next;schedule();preview?.flush();}catch(error){report(error);}
    },{signal});
    range.addEventListener('lostpointercapture',event=>{if(gesture?.pointer===event.pointerId)cancelGesture();},{signal});
    window.addEventListener('pointerup',event=>{if(cancelledPointer===event.pointerId){cancelledPointer=undefined;syncRange();}if(gesture?.pointer!==event.pointerId)return;preview?.flush();if(disposed)return;gesture=undefined;},{signal});
    window.addEventListener('pointercancel',event=>{if(gesture?.pointer===event.pointerId)cancelGesture();if(cancelledPointer===event.pointerId){cancelledPointer=undefined;syncRange();}},{signal});
    window.addEventListener('keydown',event=>{if(event.key==='Escape'&&gesture){event.preventDefault();event.stopImmediatePropagation();cancelGesture();}},{capture:true,signal});window.addEventListener('blur',()=>cancelGesture(),{signal});container.addEventListener('cf02-suspend',()=>cancelGesture(),{signal});
    time.addEventListener('input',()=>{try{const point=nearestErrorPoint(current.experiment,readNumericInput(time,'inspection time'));current.index=point.index;renderInspection();}catch(error){cursorError.textContent=error instanceof Error?error.message:'Choose a checked time.';}},{signal});
    timeRange.addEventListener('input',()=>{if(!current.experiment.run?.points.length)return;current.index=Number(timeRange.value);time.value=String(current.experiment.run.points[current.index].t);renderInspection();},{signal});
    const initial=prepare(errorExperiment(errorBaseline()));if(disposed||!initial)return cleanup;publish(initial);feedback.textContent='Baseline unit-ramp error. Move gain or change the number of integrators.';
    if(typeof ResizeObserver!=='undefined'){
      let oldWidth=signalHost.clientWidth;observer=new ResizeObserver(()=>{if(disposed||signal.aborted)return;const width=signalHost.clientWidth;if(width>0&&Math.abs(width-oldWidth)>.5){cancelGesture();oldWidth=width;const frame=prepare(current.experiment,current.axes,current);if(frame&&!disposed)publish(frame);}});
      if(disposed||signal.aborted){observer.disconnect();return cleanup;}observer.observe(signalHost);
    }
    return cleanup;
  }catch(error){cleanup();throw error;}
};
