import {characteristic,exponential,finite,roots,type Complex} from './numerics';
export type Kind='P'|'PI'|'PD'|'PID';
export interface Plant { b:number;a1:number;a0:number }
export interface Controller { kind:Kind;kp:number;ki:number;kd:number;tf:number }
export interface Model {
  plant:Plant;controller:Controller;activeKind:Kind;matrix:number[];input:number[];order:number;integralIndex:number;filterIndex:number;
  polynomial:number[];actual:number[];poles:Complex[];residual:number;stability:'stable'|'unstable'|'near boundary';dcGain:number|null;
}
export interface Options {initial:readonly[number,number];integral:number;filter:number;reference:number;horizon:number;count?:number}
export interface Sample {t:number;y:number;velocity:number;error:number;integral:number;filter:number;u:number;p:number;i:number;d:number}
export interface Run {
  samples:Sample[];overshoot:number|null;lastOutsideBand:number|null;inBandAtEnd:boolean|null;
  finalValue:number|null;overshootFinal:number|null;lastOutsideFinalBand:number|null;inFinalBandAtEnd:boolean|null;observedFinalWindowStart:number|null;
  peakEffort:number;steadyError:number|null;step:number;coarse:boolean;
}
export function standard(controller:Controller):{ti:number|null;td:number;tf:number}|null {
  if(controller.kp===0)return null;
  return{ti:controller.ki===0?null:controller.kp/controller.ki,td:controller.kd/controller.kp,tf:controller.kd===0?0:controller.tf};
}
function validatePlant(p:Plant):void {finite([p.b,p.a1,p.a0],100,'Plant coefficients');if(Math.abs(p.b)<1e-6)throw new Error('Plant numerator b must have magnitude from10⁻⁶ to100.');}
export function build(plant:Plant,controller:Controller):Model {
  validatePlant(plant);if(!['P','PI','PD','PID'].includes(controller.kind))throw new Error('Choose P, PI, filtered PD or filtered PID.');
  const kp=controller.kp,ki=controller.kind.includes('I')?controller.ki:0,kd=controller.kind.includes('D')?controller.kd:0,tf=controller.tf;
  finite([kp,ki,kd],100,'Controller gains');if(kd!==0&&(!Number.isFinite(tf)||tf<.001||tf>10))throw new Error('An active derivative filter needs Tf from0.001 to10 seconds.');
  const hasI=ki!==0,hasD=kd!==0,activeKind:Kind=hasI?(hasD?'PID':'PI'):(hasD?'PD':'P');
  const n=2+Number(hasI)+Number(hasD),integralIndex=hasI?2:-1,filterIndex=hasD?n-1:-1;
  const {b,a1,a0}=plant,derivative=hasD?kd/tf:0,effective=kp+derivative;
  const matrix=Array(n*n).fill(0) as number[],input=Array(n).fill(0) as number[];
  matrix[1]=1;matrix[n]=-(a0+b*effective);matrix[n+1]=-a1;input[1]=b*effective;
  if(hasI){matrix[n+integralIndex]=b*ki;matrix[integralIndex*n]=-1;input[integralIndex]=1;}
  if(hasD){matrix[n+filterIndex]=-b*derivative;matrix[filterIndex*n]=-1/tf;matrix[filterIndex*n+filterIndex]=-1/tf;input[filterIndex]=1/tf;}
  finite([...matrix,...input],1e6,'Closed state entries');
  let polynomial:number[];
  if(activeKind==='P')polynomial=[1,a1,a0+b*kp];
  else if(activeKind==='PI')polynomial=[1,a1,a0+b*kp,b*ki];
  else if(activeKind==='PD')polynomial=[1,a1+1/tf,a1/tf+a0+b*kp+b*kd/tf,(a0+b*kp)/tf];
  else polynomial=[1,a1+1/tf,a1/tf+a0+b*kp+b*kd/tf,(a0+b*kp)/tf+b*ki,b*ki/tf];
  const actual=characteristic(matrix,n),residual=Math.max(...actual.map((v,i)=>Math.abs(v-polynomial[i])/Math.max(1,Math.abs(polynomial[i]))));
  if(!Number.isFinite(residual)||residual>1e-9)throw new Error('Actual state-matrix coefficient check lost accuracy. Rescale the plant/gains.');
  const poles=roots(actual),tolerance=1e-8*Math.max(1,...poles.map(p=>Math.hypot(...p)));
  const stability=poles.some(p=>p[0]>tolerance)?'unstable':poles.some(p=>p[0]>=-tolerance)?'near boundary':'stable';
  const dcGain=stability==='stable'?(hasI?1:b*kp/(a0+b*kp)):null;
  return{plant:{...plant},controller:{kind:controller.kind,kp,ki,kd,tf:hasD?tf:0},activeKind,matrix,input,order:n,integralIndex,filterIndex,polynomial,actual,poles,residual,stability,dcGain};
}
/** Coefficient matching for the selected active structure at the given filter time. */
export function match(plant:Plant,kind:Kind,target:readonly number[],tf:number):Controller {
  validatePlant(plant);const degree=kind==='P'?2:kind==='PID'?4:3;
  if(target.length!==degree+1||target[0]!==1)throw new Error(`This structure needs a monic target of degree${degree}.`);
  const targetPoles=roots(target);if(targetPoles.some(p=>p[0]>=-1e-8*Math.max(1,Math.hypot(...p))))throw new Error('Choose strictly Hurwitz target poles away from the numerical boundary.');
  const {b,a1,a0}=plant;let kp=0,ki=0,kd=0;
  const fixed=kind==='P'||kind==='PI'?a1:a1+1/tf;
  if((kind==='PD'||kind==='PID')&&(!Number.isFinite(tf)||tf<.001||tf>10))throw new Error('Set a derivative-filter time from0.001 to10 seconds before matching.');
  if(Math.abs(target[1]-fixed)>1e-10*Math.max(1,Math.abs(fixed)))throw new Error(`The next-leading target coefficient must equal${fixed}: this structure/filter leaves it fixed. Change structure, filter time or target.`);
  if(kind==='P')kp=(target[2]-a0)/b;
  if(kind==='PI'){kp=(target[2]-a0)/b;ki=target[3]/b;}
  if(kind==='PD'){kp=(tf*target[3]-a0)/b;kd=(tf*target[2]-a1-tf*a0-b*kp*tf)/b;}
  if(kind==='PID'){ki=target[4]*tf/b;kp=(tf*target[3]-a0-b*ki*tf)/b;kd=(tf*target[2]-a1-tf*a0-b*kp*tf)/b;}
  const controller:Controller={kind,kp,ki,kd,tf},model=build(plant,controller);
  if(model.order!==degree)throw new Error('A solved zero gain removes an inactive controller state; this target order is not realized. Choose a lower-order structure/target.');
  if(model.actual.some((v,i)=>Math.abs(v-target[i])>1e-8*Math.max(1,Math.abs(target[i]))))throw new Error('Matched gains fail the actual characteristic check; rescale or choose less extreme targets.');
  return controller;
}
export function simulate(model:Model,options:Options):Run {
  const {horizon}=options,count=options.count??801;
  if(options.initial.length!==2)throw new Error('Enter two initial plant states: y and its time derivative.');
  finite([...options.initial,options.integral,options.filter,options.reference],100,'Initial states and reference');
  if(!Number.isFinite(horizon)||horizon<.1||horizon>100||!Number.isInteger(count)||count<2||count>1001)throw new Error('Use a0.1–100 second horizon and2–1001 samples.');
  const n=model.order,aug=n+1,step=horizon/(count-1),g=Array(aug*aug).fill(0) as number[];
  for(let i=0;i<n;i++){for(let j=0;j<n;j++)g[i*aug+j]=model.matrix[i*n+j]*step;g[i*aug+n]=model.input[i]*step;}
  const transition=exponential(g,aug),state=Array(aug).fill(0) as number[];state[0]=options.initial[0];state[1]=options.initial[1];state[n]=options.reference;
  if(model.integralIndex>=0)state[model.integralIndex]=options.integral;if(model.filterIndex>=0)state[model.filterIndex]=options.filter;
  const {kp,ki,kd,tf}=model.controller,samples:Sample[]=[];
  for(let k=0;k<count;k++){
    const y=state[0],error=options.reference-y,integral=model.integralIndex>=0?state[model.integralIndex]:0,filter=model.filterIndex>=0?state[model.filterIndex]:0;
    const p=kp*error,i=ki*integral,d=kd===0?0:kd/tf*(error-filter),u=p+i+d;
    if([...state,error,p,i,d,u].some(v=>!Number.isFinite(v)||Math.abs(v)>1e8))throw new Error('Response exceeds magnitude10⁸; reduce horizon, gains or initial data.');
    samples.push({t:k*step,y,velocity:state[1],error,integral,filter,u,p,i,d});
    if(k<count-1){const next=Array.from({length:aug},(_,row)=>state.reduce((s,v,col)=>s+transition[row*aug+col]*v,0));state.splice(0,state.length,...next);}
  }
  const r=options.reference,normalized=r===0?null:samples.map(s=>s.y/r),overshoot=normalized?Math.max(0,...normalized.map(y=>100*(y-1))):null;
  let lastOutsideBand:number|null=null,inBandAtEnd:boolean|null=null;
  if(r!==0){const outside=samples.filter(s=>Math.abs(s.y-r)>.02*Math.abs(r));lastOutsideBand=outside.length?outside.at(-1)!.t:0;inBandAtEnd=Math.abs(samples.at(-1)!.y-r)<=.02*Math.abs(r);}
  const finalValue=model.dcGain===null?null:r*model.dcGain;
  let overshootFinal:number|null=null,lastOutsideFinalBand:number|null=null,inFinalBandAtEnd:boolean|null=null,observedFinalWindowStart:number|null=null;
  if(finalValue!==null&&finalValue!==0){
    overshootFinal=Math.max(0,...samples.map(s=>100*(s.y/finalValue-1)));
    let lastIndex=-1;samples.forEach((s,i)=>{if(Math.abs(s.y-finalValue!)>.02*Math.abs(finalValue!))lastIndex=i;});
    lastOutsideFinalBand=lastIndex<0?null:samples[lastIndex].t;inFinalBandAtEnd=Math.abs(samples.at(-1)!.y-finalValue)<=.02*Math.abs(finalValue);
    if(inFinalBandAtEnd)observedFinalWindowStart=lastIndex<0?0:samples[lastIndex+1].t;
  }
  return{samples,overshoot,lastOutsideBand,inBandAtEnd,finalValue,overshootFinal,lastOutsideFinalBand,inFinalBandAtEnd,observedFinalWindowStart,peakEffort:Math.max(...samples.map(s=>Math.abs(s.u))),steadyError:model.dcGain===null?null:r*(1-model.dcGain),step,coarse:step*Math.max(...model.poles.map(p=>Math.hypot(...p)))>.25};
}
