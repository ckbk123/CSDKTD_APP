import type{ModuleMount}from'../../core/module';
import{createEquationDisplay}from'../../shared/equations/input';
import{readNumericInput}from'../../shared/numeric-input';
import{format,type SequenceKind}from'./math';
import{inspectSequence,sequenceBaseline,sequenceTrial,type SequenceDraft,type SequenceTrial}from'./exploration';
import{drawSequence,fitSequence,type SequenceAxes}from'./sequence-plot';

const el=<K extends keyof HTMLElementTagNameMap>(tag:K,text='')=>{const e=document.createElement(tag);e.textContent=text;return e;};
type Key=Exclude<keyof SequenceDraft,'kind'>;
type Gesture={pointer:number;start:SequenceTrial;key:'pole'|'delay'|'length';raw:string;message:string;source:'onset'|'range';capture?:Element};
export const mountExplore:ModuleMount=({container,signal:parent})=>{
  if(parent.aborted)return;const lifetime=new AbortController(),signal=lifetime.signal,root=el('div');root.className='dr01-tool dr01-explore';container.append(root);
  let disposed=false,observer:ResizeObserver|undefined,gesture:Gesture|undefined,current:SequenceTrial,axes:SequenceAxes,selected=0,width=0,plot:ReturnType<typeof drawSequence>|undefined;
  const history:SequenceTrial[]=[];
  const releaseCapture=()=>{const previous=gesture;gesture=undefined;if(previous?.capture){try{(previous.capture as HTMLElement).releasePointerCapture?.(previous.pointer);}catch{/* Capture may already be released by the browser. */}}};
  const cleanup=()=>{if(disposed)return;disposed=true;parent.removeEventListener('abort',cleanup);lifetime.abort();releaseCapture();try{observer?.disconnect();}finally{root.remove();}};
  parent.addEventListener('abort',cleanup,{once:true});
  try{
    current=sequenceTrial(sequenceBaseline());if(disposed||signal.aborted)return cleanup;axes=fitSequence(current);
    const listen=(target:EventTarget,event:string,fn:EventListener)=>target.addEventListener(event,fn,{signal});
    const action=(host:HTMLElement,text:string,fn:()=>void)=>{const b=el('button',text);b.type='button';host.append(b);listen(b,'click',()=>{if(disposed)return;try{fn();}catch(error){report(error);}});return b;};
    root.append(el('h2','Build a causal sequence'),el('p','Change the pole, onset delay or finite length and compare the actual samples with the transform. Practice inversion keeps its own inputs and hidden answer.'));
    const feedback=el('p');feedback.className='dr01-message';feedback.setAttribute('role','status');
    const controls=el('div');controls.className='dr01-explore-controls';root.append(controls);
    const familyLabel=el('label','Sequence family'),family=el('select');family.setAttribute('aria-label','Explore sequence family');
    for(const[value,text]of[['geometric','Delayed geometric'],['sum','Finite moving sum'],['average','Finite moving average']]){const o=el('option',text);o.value=value;family.append(o);}familyLabel.append(family);controls.append(familyLabel);
    const knobLabel=el('label','Control beside the plot'),knob=el('select');knob.setAttribute('aria-label','Sequence control parameter');for(const[value,text]of[['pole','Geometric pole a'],['delay','Onset delay d'],['length','Finite length L']]){const o=el('option',text);o.value=value;knob.append(o);}knobLabel.append(knob);controls.append(knobLabel);
    const selectedHost=el('div');selectedHost.className='dr01-selected-parameter';controls.append(selectedHost);
    const slider=el('input');slider.type='range';slider.setAttribute('aria-label','Selected sequence parameter');slider.step='any';controls.append(slider);
    const figure=el('div');figure.className='dr01-sequence-figure';root.append(figure);
    const figureNote=el('p'),identity=el('div'),convention=el('p'),inspectHost=el('div'),arithmetic=el('div');inspectHost.className='dr01-explore-inspection';root.append(figureNote,identity,convention,inspectHost,arithmetic,feedback);
    const kLabel=el('label','Inspect sample k'),kInput=el('input'),inspectionError=el('p');inspectionError.setAttribute('role','status');kInput.type='number';kInput.min='0';kInput.step='1';kInput.value='0';kInput.setAttribute('aria-label','Explore sample k');kLabel.append(kInput);inspectHost.append(kLabel);
    const kRange=el('input');kRange.type='range';kRange.min='0';kRange.step='1';kRange.value='0';kRange.setAttribute('aria-label','Inspect computed sample');inspectHost.append(kRange,inspectionError);
    const plotActions=el('div');plotActions.className='dr01-actions';inspectHost.append(plotActions);
    action(plotActions,'Fit sequence axes',()=>{cancelGesture();axes=fitSequence(current);renderInspection();});
    const undo=action(plotActions,'Undo source change',()=>{cancelGesture();const previous=history.pop();if(!previous)return;current=previous;syncSource(true);selected=Math.min(selected,current.rows.length-1);feedback.textContent='Restored the previous accepted source inputs.';renderSource();});
    const settings=el('details');settings.className='dr01-card';settings.append(el('summary','Source values, history, timing and sample count'));const grid=el('div');grid.className='dr01-grid';settings.append(grid);root.append(settings);
    const inputs={}as Record<Key,HTMLInputElement>,wrappers={}as Record<Key,HTMLLabelElement>;
    const definitions:readonly[Key,string][]=[['gain','Sequence gain c'],['pole','Explore geometric pole a'],['delay','Explore onset delay d (samples)'],['length','Explore finite length L (samples)'],['count','Explore number of samples'],['period','Explore sample period T (s)'],['history1','Explore initial x[−1]'],['history2','Explore initial x[−2]']];
    for(const[key,label]of definitions){const wrap=el('label',label),input=el('input');input.type='number';input.step=['delay','length','count'].includes(key)?'1':'any';input.value=String(current.draft[key]);input.setAttribute('aria-label',label);wrap.className='dr01-field';wrap.append(input);grid.append(wrap);inputs[key]=input;wrappers[key]=wrap;listen(input,'input',()=>{cancelGesture(key);commitNative();});}
    const limits=el('p','Builder: |c|≤10⁶, |a|≤10; nonzero magnitudes at least 10⁻¹²; d=0…12, L=1…12, last finite tap at k≤14; 4…64 computed samples, |history|≤10⁶, samples bounded by 10¹². T=10⁻⁶…100 s labels kT only. The other builder parameter is retained as an inactive draft. Samples and readouts use floating-point arithmetic and 7 significant digits; the transform retains the full generated coefficients.');settings.append(limits);
    listen(family,'change',()=>{cancelGesture();moveSelectedControl();commitNative();});listen(knob,'change',()=>{cancelGesture();moveSelectedControl();});
    listen(slider,'input',()=>{const value=Number(slider.value),key=knob.value as 'pole'|'delay'|'length';applyParameter(key,value,!gesture);});
    slider.addEventListener('pointerdown',event=>{if(gesture){event.preventDefault();return;}if(event.button!==0)return;try{sequenceTrial(readSource(),current);const key=knob.value as 'pole'|'delay'|'length';gesture={pointer:event.pointerId,start:current,key,raw:inputs[key].value,message:feedback.textContent??'',source:'range'};}catch(error){event.preventDefault();report(error);}},{signal});
    slider.addEventListener('lostpointercapture',event=>{if(gesture?.source==='range'&&gesture.pointer===event.pointerId)cancelGesture();},{signal});
    slider.addEventListener('keydown',event=>{const next=keyValue(event.key,knob.value as 'pole'|'delay'|'length',current.draft[knob.value as Key],event.shiftKey);if(next===null)return;event.preventDefault();cancelGesture();applyParameter(knob.value as 'pole'|'delay'|'length',next,true);},{signal});
    listen(kInput,'input',()=>{try{const k=readNumericInput(kInput,'sample k');inspectSequence(current,k);selected=k;renderInspection();}catch(error){inspectionError.textContent=error instanceof Error?error.message:'Choose a computed sample.';}});
    listen(kRange,'input',()=>inspectAt(Number(kRange.value),true));
    kRange.addEventListener('keydown',event=>{const k=event.key==='Home'?0:event.key==='End'?current.rows.length-1:event.key==='ArrowLeft'||event.key==='ArrowDown'?selected-1:event.key==='ArrowRight'||event.key==='ArrowUp'?selected+1:null;if(k===null)return;event.preventDefault();inspectAt(Math.max(0,Math.min(current.rows.length-1,k)),true);},{signal});
    figure.addEventListener('pointerdown',event=>{
      if(gesture||event.button!==0||!plot)return;const target=event.target instanceof Element?event.target.closest('[data-onset]'):null;
      if(!target){const rect=plot.svg.getBoundingClientRect();try{inspectAt(Math.max(0,Math.min(current.rows.length-1,Math.round(plot.geometry.sample(event.clientX,rect)))),true);}catch(error){report(error);}return;}
      try{sequenceTrial(readSource(),current);target instanceof SVGElement&&target.focus({preventScroll:true});gesture={pointer:event.pointerId,start:current,key:'delay',raw:inputs.delay.value,message:feedback.textContent??'',source:'onset',capture:figure};figure.setPointerCapture?.(event.pointerId);event.preventDefault();}catch(error){report(error);}
    },{signal});
    window.addEventListener('pointermove',event=>{if(!gesture||event.pointerId!==gesture.pointer||gesture.source!=='onset'||!plot)return;try{const value=Math.max(0,Math.min(12,Math.round(plot.geometry.sample(event.clientX,plot.svg.getBoundingClientRect()))));if(value!==current.draft.delay)applyParameter('delay',value,false);}catch(error){report(error);}},{signal});
    window.addEventListener('pointerup',event=>{if(!gesture||event.pointerId!==gesture.pointer)return;const before=gesture.start;releaseCapture();if(!sameSource(before,current))remember(before);},{signal});
    window.addEventListener('pointercancel',event=>{if(gesture?.pointer===event.pointerId)cancelGesture();},{signal});
    figure.addEventListener('lostpointercapture',event=>{if(gesture?.pointer===(event as PointerEvent).pointerId)cancelGesture();},{signal});
    window.addEventListener('keydown',event=>{if(event.key==='Escape'&&gesture){event.preventDefault();event.stopPropagation();cancelGesture();}},{signal});
    listen(window,'blur',()=>cancelGesture());listen(container,'dr01-suspend',()=>cancelGesture());
    figure.addEventListener('keydown',event=>{if(!(event.target instanceof Element)||!event.target.closest('[data-onset]'))return;const value=keyValue(event.key,'delay',current.draft.delay,event.shiftKey);if(value===null)return;event.preventDefault();event.stopPropagation();cancelGesture();applyParameter('delay',value,true);},{signal});
    function report(error:unknown){if(disposed)return;feedback.textContent=`${error instanceof Error?error.message:'Check the sequence inputs.'} The drawing still shows the last accepted source.`;}
    function readSource(){const d={...current.draft,kind:family.value as SequenceKind};for(const[key,label]of definitions){if(key==='pole'&&d.kind!=='geometric'||key==='length'&&d.kind==='geometric')continue;d[key]=readNumericInput(inputs[key],label);}return d;}
    function sameSource(a:SequenceTrial,b:SequenceTrial){return Object.keys(a.draft).every(key=>a.draft[key as keyof SequenceDraft]===b.draft[key as keyof SequenceDraft]);}
    function remember(before:SequenceTrial){history.push(before);if(history.length>24)history.shift();undo.disabled=history.length===0;}
    function commitNative(){if(disposed||signal.aborted)return;try{const before=current,next=sequenceTrial(readSource(),current);if(disposed)return;current=next;if(!sameSource(before,next))remember(before);feedback.textContent='Computed from the current source. Axes stay fixed until Fit.';renderSource();}catch(error){report(error);}}
    function applyParameter(key:'pole'|'delay'|'length',value:number,record:boolean){if(disposed||signal.aborted)return;try{const source=readSource(),before=current,next=sequenceTrial({...source,[key]:value},current);if(disposed)return;current=next;inputs[key].value=String(value);if(record&&!sameSource(before,next))remember(before);feedback.textContent='Computed from the current source. Axes stay fixed until Fit.';renderSource();}catch(error){report(error);syncSlider();}}
    function syncSource(discard:boolean){if(disposed)return;family.value=current.draft.kind;if(discard)for(const[key]of definitions)inputs[key].value=String(current.draft[key]);moveSelectedControl();}
    function keyValue(key:string,parameter:'pole'|'delay'|'length',value:number,shift:boolean){const min=parameter==='pole'?-10:parameter==='delay'?0:1,max=parameter==='pole'?10:12,step=parameter==='pole'?(shift?.1:.01):(shift?5:1);return key==='Home'?min:key==='End'?max:key==='ArrowLeft'||key==='ArrowDown'?Math.max(min,value-step):key==='ArrowRight'||key==='ArrowUp'?Math.min(max,value+step):null;}
    function moveSelectedControl(){
      if(disposed)return;
      const geometric=family.value==='geometric';inputs.pole.disabled=!geometric;inputs.length.disabled=geometric;
      for(const o of knob.options)o.disabled=(o.value==='pole'&&!geometric)||(o.value==='length'&&geometric);
      if(knob.selectedOptions[0]?.disabled)knob.value=geometric?'pole':'length';
      for(const key of ['pole','delay','length']as const){const destination=key===knob.value?selectedHost:grid;if(wrappers[key].parentElement!==destination)destination.append(wrappers[key]);}syncSlider();
    }
    function syncSlider(){if(disposed)return;const key=knob.value as 'pole'|'delay'|'length';slider.min=key==='pole'?'-10':key==='delay'?'0':'1';slider.max=key==='pole'?'10':'12';slider.step=key==='pole'?'any':'1';slider.value=String(current.draft[key]);slider.setAttribute('aria-valuetext',`${key} ${format(current.draft[key])}; accepted ${current.draft.kind} source`);}
    function inspectAt(k:number,write:boolean){if(disposed)return;inspectSequence(current,k);selected=k;if(write)kInput.value=String(k);renderInspection();}
    function renderInspection(){
      if(disposed)return;selected=Math.min(selected,current.rows.length-1);const inspected=inspectSequence(current,selected);arithmetic.replaceChildren(el('h3',`k=${selected}, t=${format(inspected.time)} s`),el('p',`x[k]=${format(inspected.row.value)}; zero history ${format(inspected.zero.value)}; forcing b[k]=${format(inspected.row.forcing)}.`));
      for(const old of inspected.old)arithmetic.append(el('p',`Read old x[${old.index}]=${format(old.value)}; multiply by ${format(old.weight)} → ${format(old.product)}.`));
      if(disposed)return;kInput.max=String(current.rows.length-1);kRange.max=String(current.rows.length-1);kRange.value=String(selected);kRange.setAttribute('aria-valuetext',`Checked sample ${selected} of ${current.rows.length-1}`);
      try{inspectSequence(current,readNumericInput(kInput,'sample k'));inspectionError.textContent='';}catch(error){inspectionError.textContent=`${error instanceof Error?error.message:'Choose a computed sample.'} Showing checked sample ${selected}.`;}
      const focused=figure.contains(document.activeElement)&&document.activeElement?.closest('[data-onset]'),next=drawSequence(current,selected,axes,width||figure.clientWidth);if(disposed)return;plot=next;figure.replaceChildren(next.svg);if(focused)figure.querySelector<SVGElement>('[data-onset]')?.focus({preventScroll:true});
      figureNote.textContent=`Filled ●: selected initial history; open ○: zero history. Computed k=0…${current.rows.length-1}. Stems are discrete; no intersample curve. ${next.clipped?`${next.clipped} sample positions exceed the fixed vertical range; triangles mark truncation. Use Fit to include them.`:'Axes stay fixed while source values change.'}`;
    }
    function renderSource(){
      if(disposed)return;axes={...axes,last:Math.max(axes.last,current.rows.length-1,15)};const displayed=createEquationDisplay(`X_0(z)=${current.expression}`,'Computed builder transform with full precision coefficients');if(disposed)return;displayed.tabIndex=0;identity.replaceChildren(displayed);
      if(disposed)return;const d=current.draft;convention.textContent=`Zero-history X₀: ${d.kind==='geometric'?`x₀[k]=c a^(k−d) for k≥d`:`${d.kind==='average'?'L taps of weight c/L':'L taps of weight c'} beginning at k=d`}; zero extension before onset. ${current.roots.length?`Retained pole ${format(current.roots[0].re)}; guaranteed causal exterior |z|>${format(current.radius)} (may be conservative).`:current.model.b.length>1?'Finite causal sequence; delay powers are undefined at z=0.':'Scaled impulse; its constant transform converges for all z.'} ${current.atOne===null?'No finite DC sum is reported at z=1.':current.convergentSum?`Zero-history sum ≈${format(current.atOne)}.`:`Algebraic X₀(1)≈${format(current.atOne)}; convergence is not established by the retained poles.`}`;
      moveSelectedControl();undo.disabled=history.length===0;renderInspection();
    }
    function cancelGesture(preserveKey?:Key){if(!gesture)return;const before=gesture.start,key=gesture.key,raw=gesture.raw,message=gesture.message;releaseCapture();current=before;if(disposed)return;if(preserveKey!==key)inputs[key].value=raw;feedback.textContent=message;renderSource();}
    feedback.textContent='Baseline geometric sequence. Change its pole or drag the square onset marker.';moveSelectedControl();renderSource();
    if(disposed||signal.aborted)return cleanup;
    if(typeof ResizeObserver!=='undefined'){
      observer=new ResizeObserver(entries=>{if(disposed||signal.aborted)return;const measured=entries[0]?.contentRect.width??figure.clientWidth;if(measured>0&&Math.abs(measured-width)>.5){cancelGesture();width=measured;renderInspection();}});
      if(disposed||signal.aborted){observer.disconnect();return cleanup;}observer.observe(figure);
    }
    return cleanup;
  }catch(error){cleanup();throw error;}
};
