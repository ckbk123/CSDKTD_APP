import type { Step } from './math';
import { numberText } from './format';

const ns='http://www.w3.org/2000/svg';
const el=<K extends keyof HTMLElementTagNameMap>(tag:K,text='',cls='')=>{const n=document.createElement(tag);n.textContent=text;if(cls)n.className=cls;return n;};
function shape<K extends keyof SVGElementTagNameMap>(tag:K,attrs:Record<string,string|number>){const n=document.createElementNS(ns,tag);for(const [k,v]of Object.entries(attrs))n.setAttribute(k,String(v));return n;}
export interface TimelineInput {
  readonly errors:readonly number[];readonly steps:readonly Step[];readonly error0:number;readonly output0:number;
  readonly period:number;readonly nextK:number;readonly selectedInput:number;readonly selectedOutput:number;
}
export interface SampleDrawing { readonly element:HTMLElement; readonly svg:SVGSVGElement; indexAt(clientX:number):number|undefined; valueAt(clientY:number):number|undefined }
/** Known inputs and committed outputs share a fixed complete input-sequence time axis. */
export function sampleTimeline(input:TimelineInput):{element:HTMLElement;error:SampleDrawing;output:SampleDrawing}{
  const row=el('div','','pid-timeline');
  const draw=(kind:'error'|'output'):SampleDrawing=>{
    const values=kind==='error'?[input.error0,...input.errors]:[input.output0,...input.steps.map(s=>s.position)];
    const figure=el('figure','','pid-timeline-chart'),frame=el('div','','pid-timeline-frame'),axisY=el('div','','pid-timeline-y'),stage=el('div','','pid-timeline-stage'),axisX=el('div','','pid-timeline-x');
    const svg=shape('svg',{viewBox:'0 0 600 220',preserveAspectRatio:'none',role:'img','aria-label':kind==='error'?'Known error samples including future input':'Committed controller outputs only'});
    const count=input.errors.length,maximum=1.5*Math.max(1,...values.map(Math.abs));
    const X=(k:number)=>60+480*k/count,Y=(v:number)=>110-88*v/maximum;
    figure.append(el('figcaption',kind==='error'?'Known input e[k]':'Committed output u[k]'),frame);
    frame.append(axisY,stage,axisX);stage.append(svg);
    for(const value of[maximum,0,-maximum])axisY.append(el('span',numberText(value)));
    svg.append(shape('line',{x1:60,x2:540,y1:110,y2:110,class:'pid-axis'}));
    values.forEach((value,k)=>{
      svg.append(shape('line',{x1:X(k),x2:X(k),y1:110,y2:Y(value),class:'pid-stem','data-sample-k':k}),shape('circle',{cx:X(k),cy:Y(value),r:4,class:kind==='output'&&k===input.selectedOutput?'pid-sample pid-selected-sample':'pid-sample','data-sample-k':k}));
    });
    for(const k of new Set([0,Math.floor(count/2),count])){
      const tick=el('span',`k=${k}\n${numberText(k*input.period)} s`);tick.style.left=String(X(k)/6)+'%';axisX.append(tick);
    }
    if(kind==='error'&&input.selectedInput>=input.nextK&&input.selectedInput<=count){
      const k=input.selectedInput,button=el('button','','pid-error-handle');button.type='button';button.dataset.errorHandle=String(k);button.setAttribute('aria-label',`Edit error e[${k}]=${numberText(values[k])}; drag vertically or use arrow keys`);button.style.left=String(X(k)/6)+'%';button.style.top=String(Y(values[k])/2.2)+'%';stage.append(button);
    }
    figure.append(el('p',kind==='error'?'All supplied inputs are known. Committed inputs are locked; select a current/future stem to edit it.':'Only initialized and committed values are drawn. Blank future positions are not predicted outputs.','pid-help'));
    return{element:figure,svg,indexAt(clientX){const box=svg.getBoundingClientRect();if(!box.width||!Number.isFinite(clientX))return;return Math.max(0,Math.min(count,Math.round(((clientX-box.left)/box.width*600-60)*count/480)));},valueAt(clientY){const box=svg.getBoundingClientRect();if(!box.height||!Number.isFinite(clientY))return;return(110-(clientY-box.top)/box.height*220)*maximum/88;}};
  };
  const error=draw('error'),output=draw('output');row.append(error.element,output.element);return{element:row,error,output};
}
