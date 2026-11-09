import { readNumericInput } from '../../shared/numeric-input';
import type { Memory, Model, Step } from './math';
import { numberText as n } from './format';
import { sampleTimeline } from './timeline';

export interface PIDSession { readonly model:Model;readonly initialMemory:Memory;readonly errors:readonly number[];readonly memory:Memory;readonly committed:readonly Step[] }
interface Options {
  readonly container:HTMLElement;readonly signal:AbortSignal;readonly read:()=>PIDSession|undefined;
  readonly edit:(k:number,value:number)=>void;readonly replay:(k:number)=>void;
  /** Freeze execution/settings while editing; cancellation restores its exact starting attempt. */
  readonly beginEdit:()=>()=>void;readonly endEdit:()=>void;
}
const el=<K extends keyof HTMLElementTagNameMap>(tag:K,text='',cls='')=>{const e=document.createElement(tag);e.textContent=text;if(cls)e.className=cls;return e;};
export function createWorkbench(options:Options){
  const {container,read}=options,parent=options.signal,life=new AbortController(),signal=life.signal,root=el('section','','pid-workbench');container.prepend(root);
  let disposed=false,selectedInput=1,selectedOutput=0,inputIssue='',indexIssue='',inspectionIssue='',errorExtent=1.5,outputExtent=1.5;
  let drawing:ReturnType<typeof sampleTimeline>|undefined;
  let gesture:{id:number;kind:'error'|'inspect';rollback:()=>void}|undefined;
  const plots=el('div','','pid-direct-plots');plots.tabIndex=-1;
  const inputStatus=el('p','','pid-edit-status');inputStatus.setAttribute('role','status');
  const controls=el('div','','pid-controls');
  function numeric(label:string,value:string){const wrap=el('label',label),field=el('input');field.type='number';field.step='any';field.value=value;field.setAttribute('aria-label',label);wrap.append(field);controls.append(wrap);return field;}
  const index=numeric('Select input sample k','1');index.step='1';index.min='1';
  const value=numeric('Error e[k] to edit','1');value.min='-10000';value.max='10000';
  const actions=el('div','','pid-actions');
  function button(name:string,action:()=>void){const b=el('button',name);b.type='button';b.addEventListener('click',()=>{if(!disposed)action();},{signal});actions.append(b);return b;}
  button('Fit sample views',()=>{cancel();const s=read();if(!s)return;errorExtent=1.5*Math.max(1,Math.abs(s.initialMemory.ePrev),...s.errors.map(Math.abs));outputExtent=1.5*Math.max(1,Math.abs(s.initialMemory.output),...s.committed.map(step=>Math.abs(step.position)));refresh();});
  button('Discard error draft',()=>{cancel();const s=read();if(!s)return;inputIssue=indexIssue='';index.value=String(selectedInput);value.value=String(s.errors[selectedInput-1]);refresh();});
  const cancelButton=button('Cancel error drag',()=>cancel());cancelButton.disabled=true;
  const inspection=el('details','','pid-committed-inspector'),inspectControls=el('div','','pid-controls');
  const inspectLabel=el('label','Inspect committed sample k'),inspect=el('input');inspect.type='number';inspect.min='0';inspect.step='1';inspect.value='0';inspect.setAttribute('aria-label','Inspect committed sample k');inspectLabel.append(inspect);inspectControls.append(inspectLabel);
  const rangeLabel=el('label','Move committed sample cursor'),range=el('input');range.type='range';range.min='0';range.max='0';range.step='1';range.value='0';range.setAttribute('aria-label','Committed sample cursor');rangeLabel.append(range);inspectControls.append(rangeLabel);
  const inspectionError=el('p','','pid-inspection-error'),details=el('div','','pid-inspection-values');inspectionError.setAttribute('role','status');
  const replay=el('button','Replay from selected sample');replay.type='button';replay.addEventListener('click',()=>{if(disposed||gesture||selectedOutput<1)return;options.replay(selectedOutput);refresh();},{signal});
  inspection.append(el('summary','Inspect actual committed arithmetic'),inspectControls,replay,inspectionError,details);
  root.append(plots,inputStatus,controls,actions,el('p','Drag the selected uncommitted error vertically, or use its arrow keys (0.1; Shift: 1). Other stems select a sample. Changing future input clears its uncommitted calculation; stored memory stays unchanged. Replay explicitly restores the old memory and removes later commits.','pid-help'),inspection);

  function showInspection(s:PIDSession){
    const step=s.committed[selectedOutput-1];details.replaceChildren();
    if(!step){details.append(el('p',`Initial memory, k=0: e[0]=${n(s.initialMemory.ePrev)}, I[0]=${n(s.initialMemory.integral)}, D[0]=${n(s.initialMemory.derivative)}, u[0]=${n(s.initialMemory.output)}.`));return;}
    details.append(el('p',`Committed k=${step.k}, t=${n(step.time)} s. This inspection does not advance live memory.`),el('p',`Read old e=${n(step.old.ePrev)}, older e=${n(step.old.eOlder)}, I=${n(step.old.integral)}, D=${n(step.old.derivative)}, u=${n(step.old.output)}, Δu=${n(step.old.delta)}.`),el('p',`Calculate P=${n(step.proportional)}, I=${n(step.old.integral)}+${n(step.integralCurrent)}+${n(step.integralPrevious)}=${n(step.integral)}, D=${n(step.derivativeMemory)}+${n(step.derivativeChange)}=${n(step.derivative)}.`),el('p',`Committed together: e=${n(step.next.ePrev)}, older e=${n(step.next.eOlder)}, I=${n(step.next.integral)}, D=${n(step.next.derivative)}, u=${n(step.next.output)}, Δu=${n(step.next.delta)}. Positional/incremental difference ${n(step.residual)}.`));
  }
  function refresh(){
    if(disposed||signal.aborted)return;const s=read();
    if(!s){plots.replaceChildren(el('p','Derive and initialize the experiment to edit its samples.'));details.replaceChildren();return;}
    index.max=String(s.errors.length);inspect.max=range.max=String(s.committed.length);
    if(selectedOutput>s.committed.length){selectedOutput=s.committed.length;if(!inspectionIssue)inspect.value=String(selectedOutput);}
    range.value=String(selectedOutput);range.setAttribute('aria-valuetext',`Committed sample ${selectedOutput}; ${n(selectedOutput*s.model.period)} seconds`);
    outputExtent=Math.max(outputExtent,1.5*Math.abs(s.initialMemory.output),...s.committed.map(step=>1.5*Math.abs(step.position)));
    const focused=plots.contains(document.activeElement);
    drawing=sampleTimeline({errors:s.errors,steps:s.committed,error0:s.initialMemory.ePrev,output0:s.initialMemory.output,period:s.model.period,nextK:s.memory.k,selectedInput,selectedOutput,errorExtent,outputExtent});plots.replaceChildren(drawing.element);
    if(focused&&!gesture)plots.querySelector<HTMLElement>('[data-error-handle]')?.focus({preventScroll:true});
    value.disabled=!!gesture||selectedInput<s.memory.k;index.disabled=inspect.disabled=range.disabled=!!gesture;replay.disabled=!!gesture||selectedOutput<1;cancelButton.disabled=!gesture;
    inputStatus.textContent=[indexIssue,inputIssue].filter(Boolean).join(' ')||(selectedInput<s.memory.k?`e[${selectedInput}] is already committed. Restart or replay before editing it.`:`Selected uncommitted input e[${selectedInput}]=${n(s.errors[selectedInput-1])}; live memory next k=${s.memory.k}.`);
    inspectionError.textContent=inspectionIssue?`${inspectionIssue} Last checked inspection remains k=${selectedOutput}.`:'';showInspection(s);
  }
  function chooseInput(k:number){const s=read();if(!s)return;if(inputIssue)throw new Error('Correct or discard the current error draft before selecting another input.');if(!Number.isInteger(k)||k<1||k>s.errors.length)throw new Error(`Choose an input sample from 1 to ${s.errors.length}.`);selectedInput=k;indexIssue='';index.value=String(k);value.value=String(s.errors[k-1]);refresh();}
  function chooseOutput(k:number){const s=read();if(!s)return;if(!Number.isInteger(k)||k<0||k>s.committed.length)throw new Error('Select an actual initialized or committed sample; future outputs are not available.');selectedOutput=k;inspectionIssue='';inspect.value=range.value=String(k);inspection.open=true;refresh();}
  function editValue(next:number,replaceField=false){try{options.edit(selectedInput,next);inputIssue='';if(replaceField)value.value=String(next);refresh();}catch(error){inputIssue=error instanceof Error?error.message:'Check the error sample.';refresh();}}
  index.addEventListener('input',()=>{try{chooseInput(readNumericInput(index,'Input sample k'));}catch(error){indexIssue=String(error instanceof Error?error.message:error);refresh();}},{signal});
  value.addEventListener('input',()=>{try{const next=readNumericInput(value,'Error sample');editValue(next);}catch(error){inputIssue=String(error instanceof Error?error.message:error);refresh();}},{signal});
  inspect.addEventListener('input',()=>{try{const next=readNumericInput(inspect,'Committed sample k');chooseOutput(next);}catch(error){inspectionIssue=String(error instanceof Error?error.message:error);refresh();}},{signal});
  range.addEventListener('input',()=>{try{chooseOutput(readNumericInput(range,'Committed sample cursor'));}catch(error){inspectionIssue=String(error instanceof Error?error.message:error);refresh();}},{signal});
  const release=()=>{const id=gesture?.id;gesture=undefined;if(id!==undefined&&plots.hasPointerCapture?.(id))plots.releasePointerCapture(id);};
  function cancel(){if(!gesture||disposed)return;const old=gesture;release();old.rollback();if(old.kind==='error')options.endEdit();refresh();}
  plots.addEventListener('pointerdown',event=>{
    if(gesture||event.button!==0||!drawing)return;const target=event.target as Element;
    try{
      if(drawing.output.element.contains(target)){const k=drawing.output.indexAt(event.clientX);if(k===undefined)return;const old=selectedOutput;chooseOutput(k);gesture={id:event.pointerId,kind:'inspect',rollback:()=>chooseOutput(old)};}
      else if(drawing.error.element.contains(target)){
        if(!target.closest('[data-error-handle]')){const k=drawing.error.indexAt(event.clientX);if(k===undefined)return;chooseInput(k);return;}
        if(inputIssue||indexIssue)throw new Error('Correct or discard the error draft before dragging.');
        const previousValue=value.value,previousIndex=index.value,rollback=options.beginEdit();
        gesture={id:event.pointerId,kind:'error',rollback:()=>{rollback();inputIssue=indexIssue='';value.value=previousValue;index.value=previousIndex;}};
      }else return;
      event.preventDefault();plots.focus({preventScroll:true});plots.setPointerCapture?.(event.pointerId);refresh();
    }catch(error){inputStatus.textContent=error instanceof Error?error.message:'Select an available sample.';}
  },{signal});
  window.addEventListener('pointermove',event=>{if(!gesture||gesture.id!==event.pointerId||!drawing)return;event.preventDefault();if(gesture.kind==='error'){const next=drawing.error.valueAt(event.clientY);if(next!==undefined)editValue(Math.round(Math.max(-10000,Math.min(10000,next))*10)/10,true);}else{const k=drawing.output.indexAt(event.clientX);const s=read();if(k!==undefined&&s&&k<=s.committed.length)chooseOutput(k);}},{signal,passive:false});
  window.addEventListener('pointerup',event=>{if(gesture?.id!==event.pointerId)return;const kind=gesture.kind;release();if(kind==='error')options.endEdit();refresh();},{signal});
  const cancelPointer=(event:PointerEvent)=>{if(gesture?.id===event.pointerId)cancel();};window.addEventListener('pointercancel',cancelPointer,{signal});plots.addEventListener('lostpointercapture',cancelPointer,{signal});
  window.addEventListener('blur',cancel,{signal});window.addEventListener('keydown',event=>{if(event.key==='Escape'&&gesture){event.preventDefault();event.stopImmediatePropagation();cancel();}},{signal,capture:true});
  plots.addEventListener('keydown',event=>{if(gesture||!(event.target as Element).closest('[data-error-handle]')||!['ArrowUp','ArrowDown'].includes(event.key))return;event.preventDefault();const s=read();if(!s||inputIssue||indexIssue)return;editValue(s.errors[selectedInput-1]+(event.key==='ArrowUp'?1:-1)*(event.shiftKey?1:.1),true);},{signal});
  function reset(){cancel();const s=read();if(!s)return;selectedInput=Math.min(s.memory.k,s.errors.length);selectedOutput=0;inputIssue=indexIssue=inspectionIssue='';errorExtent=1.5*Math.max(1,Math.abs(s.initialMemory.ePrev),...s.errors.map(Math.abs));outputExtent=1.5*Math.max(1,Math.abs(s.initialMemory.output),...s.committed.map(step=>Math.abs(step.position)));index.value=String(selectedInput);value.value=String(s.errors[selectedInput-1]);inspect.value=range.value='0';refresh();}
  function destroy(){if(disposed)return;disposed=true;parent.removeEventListener('abort',destroy);release();life.abort();root.remove();}
  parent.addEventListener('abort',destroy,{once:true});try{if(parent.aborted)destroy();else reset();}catch(error){destroy();throw error;}
  return{element:root,refresh,reset,cancel,destroy,isDragging:()=>!!gesture};
}
