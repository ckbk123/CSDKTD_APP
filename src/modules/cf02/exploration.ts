import{analyseLimit,constants,makeModel,trace,type Channel,type ErrorSignal,type Limit,type Model,type Trace}from'./math';
import{decimal,mul,ONE,ZERO}from'./rational';
import{evaluate}from'./view';

/** Strings come from validated native numeric controls, where exponent notation has its ordinary numeric meaning. */
export type ErrorDraft={gain:string;pole:string;zero:string;zeroEnabled:boolean;integrators:number;sensor:string;channel:Channel;order:number;amplitude:string;horizon:number;error:ErrorSignal};
export type ErrorExperiment={readonly draft:Readonly<ErrorDraft>;readonly model:Model;readonly constants:ReturnType<typeof constants>;readonly limits:Readonly<Record<ErrorSignal,Limit>>;readonly run?:Trace;readonly traceError?:string};
export const errorBaseline=():ErrorDraft=>({gain:'4',pole:'2',zero:'1',zeroEnabled:false,integrators:1,sensor:'1',channel:'reference',order:1,amplitude:'1',horizon:10,error:'comparator'});
const sourceKeys=['gain','pole','zero','zeroEnabled','integrators','sensor','channel','order','amplitude','horizon']as const;
function freeze<T>(value:T):T{if(value!==null&&typeof value==='object'&&!Object.isFrozen(value)){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;}

/** Direct parameters describe the same original bounded family; no transfer-function solver is replaced. */
export function errorExperiment(input:ErrorDraft,previous?:ErrorExperiment):ErrorExperiment{
  if(!['reference','disturbance','noise'].includes(input.channel))throw new Error('Choose one active reference, disturbance or noise source.');
  if(!['comparator','physical'].includes(input.error))throw new Error('Choose comparator or physical tracking error.');
  if(!Number.isFinite(input.horizon)||input.horizon<.1||input.horizon>120)throw new Error('Plot horizon must be between 0.1 and 120 seconds.');
  const draft=Object.freeze({...input});
  if(previous&&sourceKeys.every(key=>draft[key]===previous.draft[key]))return Object.freeze({...previous,draft});
  const gain=decimal(draft.gain,true),pole=decimal(draft.pole,true),sensor=decimal(draft.sensor,true),amplitude=decimal(draft.amplitude,true);
  const numerator=draft.zeroEnabled?[mul(gain,decimal(draft.zero,true)),gain]as const:[gain,ZERO]as const;
  const model=makeModel(numerator,[pole,ONE],draft.integrators,sensor);
  const limits={comparator:analyseLimit(model,draft.channel,'comparator',draft.order,amplitude),physical:analyseLimit(model,draft.channel,'physical',draft.order,amplitude)};
  let run:Trace|undefined,traceError:string|undefined;
  try{run=trace(model,draft.channel,draft.order,amplitude,draft.horizon);}catch(error){traceError=error instanceof Error?error.message:'The bounded numerical trace could not be computed.';}
  return freeze({draft,model,constants:constants(model),limits,...(run?{run}:{}),...(traceError?{traceError}:{})});
}

/** The cursor selects an original computed point, not an interpolated continuous solution. */
export function inspectError(experiment:ErrorExperiment,index:number){
  const points=experiment.run?.points;if(!points?.length)throw new Error('No checked numerical trace is available for inspection.');
  if(!Number.isInteger(index)||index<0||index>=points.length)throw new Error(`Choose a computed point from 0 to ${points.length-1}.`);
  const point=points[index],limit=experiment.limits[experiment.draft.error],asymptote=limit.kind==='uncertified'?null:evaluate(limit.polynomial,point.t),selected=point[experiment.draft.error];
  return{index,point,selected,asymptote,difference:asymptote===null?null:selected-asymptote};
}
export function nearestErrorPoint(experiment:ErrorExperiment,time:number){
  const run=experiment.run,last=run?.points.at(-1);if(!run||!last)throw new Error('No checked numerical trace is available for inspection.');
  if(!Number.isFinite(time)||time<0||time>last.t)throw new Error(`Choose time from 0 to ${last.t} seconds within the checked trace.`);
  return inspectError(experiment,Math.max(0,Math.min(run.points.length-1,Math.round(time/run.interval))));
}
