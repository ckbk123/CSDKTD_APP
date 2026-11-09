import type{Point}from'./math';
import{numeric}from'./view';
export type Signal='input'|'output'|'comparator'|'physical';
export type TraceAxes={end:number;low:number;high:number};
export function fitTrace(points:readonly Point[],keys:readonly Signal[],horizon:number):TraceAxes{
  let low=0,high=0;for(const p of points)for(const key of keys){low=Math.min(low,p[key]);high=Math.max(high,p[key]);}
  const span=high-low;return{end:points.at(-1)?.t||horizon,low:span?low-.08*span:-1,high:span?high+.08*span:1};
}
/** The same endpoint/extrema-per-bucket policy as the original error plot, now valid for each original signal. */
export function reduceTrace(points:readonly Point[],key:Signal):Point[]{
  const output:Point[]=[],bucket=Math.max(1,Math.ceil(points.length/500));
  for(let start=0;start<points.length;start+=bucket){const group=points.slice(start,start+bucket),low=group.reduce((a,b)=>a[key]<b[key]?a:b),high=group.reduce((a,b)=>a[key]>b[key]?a:b);output.push(...[group[0],low,high,group.at(-1)!].sort((a,b)=>a.t-b.t));}
  return output;
}
/** Clip the sampled straight segment before pixel conversion, including extremely small fixed vertical ranges. */
export function clipTraceSegment(a:{t:number;value:number},b:{t:number;value:number},low:number,high:number){
  if(a.value<low&&b.value<low||a.value>high&&b.value>high)return null;
  const endpoint=(p:typeof a)=>{if(p.value>=low&&p.value<=high)return p;const value=p.value<low?low:high,ratio=(value-a.value)/(b.value-a.value);return{t:a.t+(b.t-a.t)*ratio,value};};
  return[endpoint(a),endpoint(b)]as const;
}
export function drawTrace(points:readonly Point[],keys:readonly[Signal,Signal],axes:TraceAxes,width:number,title:string){
  const w=Math.max(180,Math.min(1600,width||640)),height=250,left=Math.min(85,w*.25),right=w-18,top=35,bottom=205,ns='http://www.w3.org/2000/svg';
  const host=document.createElement('div');host.className='cf-live-plot';const svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox',`0 0 ${w} ${height}`);svg.setAttribute('role','img');svg.setAttribute('aria-label',`${title}. Sampled numerical trace, with cached selected-point markers.`);host.append(svg);
  const add=(tag:string,attrs:Record<string,string|number>,text?:string)=>{const node=document.createElementNS(ns,tag);for(const[key,value]of Object.entries(attrs))node.setAttribute(key,String(value));if(text!==undefined)node.textContent=text;svg.append(node);return node;};
  const x=(t:number)=>left+(t/axes.end)*(right-left),y=(value:number)=>bottom-((value-axes.low)/(axes.high-axes.low))*(bottom-top),inside=(value:number)=>value>=axes.low&&value<=axes.high;
  add('text',{x:left,y:16},title);
  for(let i=0;i<=4;i++){const value=axes.low+(axes.high-axes.low)*i/4,t=axes.end*i/4;add('line',{x1:left,x2:right,y1:y(value),y2:y(value),class:'cf-gridline'});add('text',{x:left-7,y:y(value)+4,'text-anchor':'end'},numeric(value,3));add('text',{x:x(t),y:225,'text-anchor':'middle'},numeric(t,3));}
  add('text',{x:right,y:246,'text-anchor':'end'},'time t (s)');
  const counts:Record<string,number>={};
  const markers:SVGElement[]=[];
  for(const[keyIndex,key]of keys.entries()){
    const reduced=reduceTrace(points,key),segments:string[]=[];counts[key]=points.filter(p=>!inside(p[key])).length;
    for(let i=1;i<reduced.length;i++){const segment=clipTraceSegment({t:reduced[i-1].t,value:reduced[i-1][key]},{t:reduced[i].t,value:reduced[i][key]},axes.low,axes.high);if(segment)segments.push(`M${x(segment[0].t).toFixed(3)},${y(segment[0].value).toFixed(3)}L${x(segment[1].t).toFixed(3)},${y(segment[1].value).toFixed(3)}`);}
    add('path',{d:segments.join(' '),class:`cf-curve cf-live-${keyIndex}`,fill:'none','data-curve':key});
    if(points.length===1&&inside(points[0][key]))add('circle',{cx:x(points[0].t),cy:y(points[0][key]),r:3,class:`cf-live-point cf-live-${keyIndex}`});
    for(const side of ['low','high']as const){if(points.some(p=>side==='low'?p[key]<axes.low:p[key]>axes.high)){const at=side==='low'?bottom:top;add('path',{d:`M${right-10},${at}l-7,${side==='low'?-8:8}h14Z`,class:`cf-live-bound cf-live-${keyIndex}`,'data-bound':side});}}
    markers.push(add('circle',{r:5,class:`cf-live-point cf-live-${keyIndex}`,'data-marker':key})as SVGElement);
  }
  const cursor=add('line',{x1:left,x2:left,y1:top,y2:bottom,class:'cf-live-cursor'});let selected=-1;
  const update=(index:number)=>{if(!Number.isInteger(index)||index<0||index>=points.length)throw new Error('Choose a checked trace point.');selected=index;const point=points[index];cursor.setAttribute('x1',String(x(point.t)));cursor.setAttribute('x2',String(x(point.t)));markers.forEach((marker,i)=>{marker.setAttribute('cx',String(x(point.t)));marker.setAttribute('cy',String(inside(point[keys[i]])?y(point[keys[i]]):top));marker.setAttribute('visibility',inside(point[keys[i]])?'visible':'hidden');});};
  if(points.length)update(0);else cursor.setAttribute('visibility','hidden');
  return{element:host,svg,counts,update,get selected(){return selected;}};
}
