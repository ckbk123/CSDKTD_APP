import {format}from'./math';
import type{SequenceTrial}from'./exploration';
export type SequenceAxes={last:number;low:number;high:number};
export function fitSequence(trial:SequenceTrial):SequenceAxes{
  const values=[0,...trial.rows.map(r=>r.value),...trial.zero.map(r=>r.value)],low=Math.min(...values),high=Math.max(...values),span=high-low;
  return{last:Math.max(15,trial.rows.length-1),low:span?low-.08*span:-1,high:span?high+.08*span:1};
}
export function sequenceGeometry(width:number,axes:SequenceAxes){
  const w=Math.max(180,Math.min(1600,width||640)),left=Math.min(78,w*.25),right=w-20,top=48,bottom=220;
  return{width:w,height:300,left,right,top,bottom,x:(k:number)=>left+k*(right-left)/axes.last,y:(value:number)=>bottom-(value-axes.low)*(bottom-top)/(axes.high-axes.low),sample:(clientX:number,rect:{left:number;width:number})=>{if(!(rect.width>0))throw new Error('The sequence drawing is not measurable yet.');return((clientX-rect.left)*w/rect.width-left)*axes.last/(right-left);}};
}
export function drawSequence(trial:SequenceTrial,k:number,axes:SequenceAxes,width:number){
  const g=sequenceGeometry(width,axes),ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox',`0 0 ${g.width} ${g.height}`);svg.setAttribute('role','group');svg.setAttribute('aria-label','Discrete sequence. Filled circles include selected initial history; open circles have zero history. Use the sample control to inspect. Drag the square onset marker or use numeric delay.');svg.classList.add('dr01-sequence-svg');
  const node=(tag:string,attrs:Record<string,string|number>,text?:string,host:Element=svg)=>{const e=document.createElementNS(ns,tag);for(const[key,value]of Object.entries(attrs))e.setAttribute(key,String(value));if(text!==undefined)e.textContent=text;host.append(e);return e;};
  const defs=node('defs',{}),clip=node('clipPath',{id:'dr01-sequence-clip'},undefined,defs);node('rect',{x:g.left-6,y:g.top,width:g.right-g.left+12,height:g.bottom-g.top},undefined,clip);
  node('line',{x1:g.left,x2:g.right,y1:g.y(0),y2:g.y(0),class:'dr01-axis'});node('line',{x1:g.left,x2:g.left,y1:g.top,y2:g.bottom,class:'dr01-axis'});
  node('text',{x:8,y:20},'x[k]');node('text',{x:g.left-8,y:g.top+4,'text-anchor':'end'},format(axes.high));node('text',{x:g.left-8,y:g.bottom,'text-anchor':'end'},format(axes.low));
  for(let i=0;i<=axes.last;i++){if(i%Math.max(1,Math.ceil(axes.last/8))===0||i===axes.last)node('text',{x:g.x(i),y:240,'text-anchor':'middle'},String(i));}
  node('text',{x:g.right,y:290,'text-anchor':'end'},'sample k');
  const stems=node('g',{'clip-path':'url(#dr01-sequence-clip)'});let clipped=0;
  for(let i=0;i<trial.rows.length;i++){
    const row=trial.rows[i],zero=trial.zero[i],inside=(v:number)=>v>=axes.low&&v<=axes.high;node('line',{x1:g.x(i),x2:g.x(i),y1:g.y(0),y2:g.y(Math.max(axes.low,Math.min(axes.high,row.value))),class:i===k?'dr01-stem dr01-chosen':'dr01-stem'},undefined,stems);
    if(inside(row.value))node('circle',{cx:g.x(i),cy:g.y(row.value),r:i===k?5:3,class:'dr01-dot'},undefined,stems);if(inside(zero.value))node('circle',{cx:g.x(i),cy:g.y(zero.value),r:5,class:'dr01-zero'},undefined,stems);
    const sides=new Set([row.value,zero.value].flatMap(v=>v<axes.low?['low']:v>axes.high?['high']:[]));
    if(sides.size){clipped++;for(const side of sides){const y=side==='high'?g.top+3:g.bottom-3;node('path',{d:`M ${g.x(i)-4} ${y} L ${g.x(i)+4} ${y} L ${g.x(i)} ${y+(side==='high'?7:-7)} Z`,class:'dr01-dot','data-clipped':side});}}
  }
  node('line',{x1:g.x(k),x2:g.x(k),y1:g.top,y2:g.bottom,class:'dr01-inspection-line'});
  const onset=node('g',{'data-onset':'true',role:'slider',tabindex:0,'aria-valuemin':0,'aria-valuemax':12,'aria-valuenow':trial.draft.delay,'aria-orientation':'horizontal','aria-label':`Sequence onset delay ${trial.draft.delay} samples. Drag horizontally, or use Left and Right arrows. Home is zero; End is twelve.`});
  node('line',{x1:g.x(trial.draft.delay),x2:g.x(trial.draft.delay),y1:g.top,y2:253,class:'dr01-delay-guide'},undefined,onset);
  node('rect',{x:g.x(trial.draft.delay)-22,y:253,width:44,height:44,rx:6,class:'dr01-onset-target'},undefined,onset);node('text',{x:g.x(trial.draft.delay),y:280,'text-anchor':'middle'},'d',onset);
  return{svg,geometry:g,clipped};
}
