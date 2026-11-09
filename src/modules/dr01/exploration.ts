import {fromSequence,poles,samples,transformLatex,type Pole,type Sample,type SequenceKind,type Transform} from './math';

/** Caller-owned builder data; the original transform/sample engines remain authoritative. */
export type SequenceDraft={kind:SequenceKind;gain:number;pole:number;delay:number;length:number;count:number;period:number;history1:number;history2:number};
export type SequenceTrial={readonly draft:Readonly<SequenceDraft>;readonly model:Transform;readonly expression:string;readonly rows:readonly Sample[];readonly zero:readonly Sample[];readonly roots:readonly Pole[];readonly radius:number;readonly atOne:number|null;readonly convergentSum:boolean};
export const sequenceBaseline=():SequenceDraft=>({kind:'geometric',gain:1,pole:.8,delay:0,length:4,count:16,period:.1,history1:0,history2:0});
const sourceKeys=['kind','gain','pole','delay','length','count','history1','history2']as const;
function validatePeriod(period:number){if(!Number.isFinite(period)||period<1e-6||period>100)throw new Error('Sample period must be between 0.000001 and 100 seconds.');}
const retainRows=(rows:Sample[])=>Object.freeze(rows.map(row=>Object.freeze({...row,feedback:Object.freeze([...row.feedback])})));

/** T only labels kT in this declared sequence exercise. Every source change runs the full original bounded calculation. */
export function sequenceTrial(input:SequenceDraft,previous?:SequenceTrial):SequenceTrial{
  validatePeriod(input.period);const draft=Object.freeze({...input});
  if(previous&&sourceKeys.every(key=>draft[key]===previous.draft[key]))return Object.freeze({...previous,draft});
  const built=fromSequence(draft.kind,draft.gain,draft.pole,draft.delay,draft.length);
  const model=Object.freeze({a:Object.freeze([...built.a]),b:Object.freeze([...built.b])});
  const history=[draft.history1,draft.history2],rows=retainRows(samples(model,history,draft.count)),zero=retainRows(samples(model,[0,0],draft.count)),roots=Object.freeze(poles(model).map(p=>Object.freeze({...p})));
  const radius=Math.max(0,...roots.map(p=>Math.hypot(p.re,p.im))),den=model.a.reduce((s,v)=>s+v,0),num=model.b.reduce((s,v)=>s+v,0);
  const atOne=Math.abs(den)<=1e-12*model.a.reduce((s,v)=>s+Math.abs(v),0)?null:num/den;
  return Object.freeze({draft,model,expression:transformLatex(model,'q',true),rows,zero,roots,radius,atOne,convergentSum:atOne!==null&&radius<1});
}

/** Inspection reads an already computed sample. It never advances memory or reruns a transform. */
export function inspectSequence(trial:SequenceTrial,k:number){
  if(!Number.isInteger(k)||k<0||k>=trial.rows.length)throw new Error(`Choose an integer sample k from 0 to ${trial.rows.length-1}.`);
  const history=[trial.draft.history1,trial.draft.history2];
  return{row:trial.rows[k],zero:trial.zero[k],time:k*trial.draft.period,old:trial.rows[k].feedback.map((product,j)=>{const index=k-j-1;return{index,value:index<0?history[-index-1]:trial.rows[index].value,weight:-trial.model.a[j+1],product};})};
}
