export interface Series { name:string; values:readonly number[]; style:string }
export interface Axis { low:number; high:number }
export interface Guide { value:number; label:string }
export interface Drawing { element:HTMLElement; select(index:number):void; fromEvent(clientX:number):number|undefined }
const ns='http://www.w3.org/2000/svg';
const format=(value:number)=>value===0?'0':Number(value.toPrecision(7)).toString();
export function fitAxis(series:readonly Series[]):Axis {
  const values=series.flatMap(s=>[...s.values]);let low=Math.min(0,...values),high=Math.max(0,...values);
  if(high===low){low--;high++;}const pad=.1*(high-low);return{low:low-pad,high:high+pad};
}
/** Presentation of existing samples only; no response evaluation or interpolation. */
export function signalPlot(label:string,times:readonly number[],series:readonly Series[],selected:number,axis=fitAxis(series),guides:readonly Guide[]=[]):Drawing {
  const figure=document.createElement('figure');figure.className='pid-live-chart';const caption=document.createElement('figcaption');caption.textContent=label;
  const frame=document.createElement('div');frame.className='pid-native-axes';const yAxis=document.createElement('div');yAxis.className='pid-y-axis';const xAxis=document.createElement('div');xAxis.className='pid-x-axis';
  const svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 600 200');svg.setAttribute('preserveAspectRatio','none');svg.setAttribute('role','img');svg.setAttribute('aria-label',label+'. Existing computed samples; time in seconds. '+series.map(s=>s.name).join('; '));
  const X=(index:number)=>10+580*index/(times.length-1),Y=(value:number)=>180-170*(value-axis.low)/(axis.high-axis.low);
  function add(tag:string,attributes:Record<string,string|number>){const n=document.createElementNS(ns,tag);Object.entries(attributes).forEach(([key,value])=>n.setAttribute(key,String(value)));svg.append(n);return n;}
  for(const value of [axis.high,(axis.low+axis.high)/2,axis.low]){const n=document.createElement('span');n.textContent=format(value);yAxis.append(n);add('line',{x1:10,x2:590,y1:Y(value),y2:Y(value),class:'pid-axis','vector-effect':'non-scaling-stroke'});}
  for(const value of [times[0],times.at(-1)!]){const n=document.createElement('span');n.textContent=format(value);xAxis.append(n);}
  const omitted:string[]=[];for(const guide of guides){if(guide.value<axis.low||guide.value>axis.high){omitted.push(guide.label);continue;}add('line',{x1:10,x2:590,y1:Y(guide.value),y2:Y(guide.value),class:'pid-guide','vector-effect':'non-scaling-stroke'});}
  const markers:SVGElement[]=[];for(const s of series){add('path',{d:s.values.map((v,i)=>(i?'L':'M')+X(i)+','+Y(v)).join(' '),class:s.style,'vector-effect':'non-scaling-stroke'});markers.push(add('circle',{r:4,class:'pid-marker'}));}
  const cursor=add('line',{x1:X(0),x2:X(0),y1:10,y2:180,class:'pid-cursor','vector-effect':'non-scaling-stroke'});
  frame.append(yAxis,svg,xAxis);const title=document.createElement('p');title.className='pid-axis-title';title.textContent='Time t (s)';frame.append(title);
  const legend=document.createElement('p');legend.className='pid-plot-legend';legend.textContent=series.map(s=>s.name).join(' · ')+(guides.length?' · guides: '+guides.map(g=>g.label).join(', '):'')+(omitted.length?'. Outside this fixed view: '+omitted.join(', '):'');
  figure.append(caption,frame,legend);
  function select(index:number){const k=Math.max(0,Math.min(times.length-1,Math.round(index)));cursor.setAttribute('x1',String(X(k)));cursor.setAttribute('x2',String(X(k)));markers.forEach((m,i)=>{const value=series[i].values[k];m.setAttribute('cx',String(X(k)));m.setAttribute('cy',String(Y(value)));m.setAttribute('visibility',value>=axis.low&&value<=axis.high?'visible':'hidden');});}
  select(selected);return{element:figure,select,fromEvent(clientX){const box=svg.getBoundingClientRect();if(!box.width||!Number.isFinite(clientX))return;return Math.max(0,Math.min(times.length-1,Math.round(((clientX-box.left)/box.width*600-10)/580*(times.length-1))));}};
}
