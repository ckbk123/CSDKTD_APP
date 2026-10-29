import type { ModuleMount } from '../../core/module';
import { createEquationDisplay, createEquationInput, type EquationDraft } from '../../shared/equations/input';
import { BASELINE, dcGain, equations, formatNumber as fmt, latexNumber as num, odeLatex, parseOde, poles, responseAt, responseSamples, warnings, type Excitation, type Experiment, type Initial, type Model, type Response } from './math';
import './workspace.css';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, text = '', className = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag); node.textContent = text; node.className = className; return node;
}
function control(label: string, value: number): { label: HTMLLabelElement; input: HTMLInputElement } {
  const wrapper = el('label', label), input = el('input'); input.type = 'number'; input.step = 'any'; input.value = String(value); input.setAttribute('aria-label', label); wrapper.append(input); return { label: wrapper, input };
}
function numeric(input: HTMLInputElement, label: string, maximum: number): number {
  if (!input.value.trim() || !Number.isFinite(input.valueAsNumber) || Math.abs(input.valueAsNumber) > maximum) throw new Error(`${label} must be finite with magnitude at most ${maximum.toLocaleString()}.`);
  if (input.valueAsNumber === 0 && /[1-9]/.test(input.value.split(/[eE]/)[0])) throw new Error(`${label} is too small to represent. Enter zero explicitly or a representable value.`);
  return input.valueAsNumber;
}
type Key = keyof Model;
const terms: readonly { key: Key; title: string; units: string; physical: string; ode: string }[] = [
  { key:'m', title:'Mass m', units:'kg', physical:'Inertia: m·acceleration', ode:"y''" },
  { key:'c', title:'Damping c', units:'N·s/m', physical:'Viscous force: −c·velocity', ode:"y'" },
  { key:'k', title:'Stiffness k', units:'N/m', physical:'Spring force: −k·displacement', ode:'y' },
  { key:'b', title:'Input gain b', units:'N / input unit', physical:'Applied force: b·u', ode:'u' },
  { key:'d', title:'Input-rate gain d', units:'N·s / input unit', physical:'Applied force: d·u′', ode:"u'" },
];

export const mount: ModuleMount = ({ container, signal }) => {
  const root = el('div', '', 'cr02'); container.append(root);
  // Fixed structural markup only. Every mathematical/user-derived value below
  // goes through textContent or the shared equation renderer.
  root.innerHTML = `<p class="notice" role="status" aria-live="polite" data-ui="status"></p>
    <section><h3>1. Start with a force balance</h3>
      <p>A rigid mass moves to the right. A linear spring and a viscous damper oppose displacement and velocity. One command u creates the applied force; an optional derivative term still comes from that same command.</p>
      <div class="scroll" tabindex="0" aria-label="Scrollable mass, spring and damper schematic" data-ui="schematic"></div><div data-ui="balance"></div><div data-ui="equation"></div>
      <div class="actions" data-ui="model-actions"></div>
      <p class="muted">Enter sums of numeric multiples of y″, y′, y on the left and u, u′ on the right: at most 16 terms per side. Primes, dots, simple numeric fractions and products of up to 8 numeric factors are supported. Separate coefficient values with explicit + or ×; mixed-number adjacency is rejected. Use decimal coefficients; e/E and coefficient powers are unsupported. There are no unknown parameters or nonlinear terms.</p>
      <p class="muted">The coefficient cells describe the applied model. Cell edits write a new equation draft; Apply synchronizes the physical and equation views.</p>
      <div class="scroll" data-ui="coefficients"></div>
      <p class="muted">Limits: 0.01 ≤ m ≤ 1,000 kg; c and k ≥ 0. Other coefficients are zero or have magnitude 10⁻⁹…1,000. Negative b or d reverses that force contribution. No feedback connection is imposed.</p>
    </section>
    <section><h3>2. Transform one term at a time</h3>
      <p>Select a physical term above to link its force, ODE term, Laplace term and polynomial coefficient. Initial values belong in the transformed equation.</p>
      <p class="muted">Numeric labels use 7 significant digits. Normalized coefficients and computed roots are numerical approximations; the derivative identities describe the applied model.</p>
      <div data-ui="term"></div><div data-ui="normalized"></div>
    </section>
    <section><h3>3. Set the experiment and predict</h3>
      <p>Initial displacement and velocity are specified just before the command starts, at 0−. The command was zero before that instant. Changing these initial values does not change the system transfer function.</p>
      <div class="controls" data-ui="experiment-controls"></div><div class="controls" data-ui="plot-controls"></div>
      <p class="muted">Time is in seconds, y is in metres and velocity is in m/s. A step has amplitude in input units; a ramp has slope in input units/s. The plot horizon is 0.001…60 s, with 2…1,001 computed points. Initial values and input amplitude/slope have magnitude at most 100.</p>
      <div class="controls" data-ui="prediction"></div><div class="actions" data-ui="reveal-action"></div>
    </section>
    <section data-ui="answers" hidden><h3>4. Separate the system from its response</h3>
      <div data-ui="derivation"></div><div data-ui="derivative"></div><div data-ui="warnings"></div>
      <div class="scroll" tabindex="0" aria-label="Scrollable computed response plot" data-ui="plot"></div><div class="controls" data-ui="cursor-control"></div><div data-ui="cursor-result"></div>
      <details><summary>Inspect the computed sample table</summary><div class="scroll" tabindex="0" aria-label="Computed response table" data-ui="sample-table"></div></details>
      <p class="muted">The curves join numerically computed points. They do not certify peaks or settling between points. Response values use floating-point arithmetic and are displayed to 7 significant digits; polynomial/Laplace identities are distinguished from these approximations. Running displacement/velocity magnitudes are bounded by 10¹².</p>
    </section>`;
  const ui = (name: string) => root.querySelector<HTMLElement>(`[data-ui="${name}"]`)!;
  const on = (node: HTMLElement, event: string, callback: () => void) => node.addEventListener(event, () => { if (!signal.aborted) callback(); }, { signal });
  const button = (label: string, callback: () => void, primary = false) => { const b = el('button', label, primary ? 'primary' : ''); b.type = 'button'; on(b,'click',callback); return b; };
  const show = (text: string) => { ui('status').textContent = text; };
  const error = (reason: unknown) => show(reason instanceof Error ? reason.message : 'Check the exercise data.');
  let model: Model = { ...BASELINE }, selected: Key = 'm', dirty = false, physicalInvalid = false, draft: EquationDraft;
  let shown: { model: Model; experiment: Experiment; horizon: number; count: number; samples: Response[] } | undefined;
  const fields = {} as Record<Key, HTMLInputElement>, rows = {} as Record<Key, HTMLTableRowElement>, selectors = {} as Record<Key, HTMLButtonElement>;
  function invalidate(message: string): void { shown = undefined; ui('answers').hidden = true; ui('derivation').replaceChildren(); ui('cursor-result').replaceChildren(); show(message); }
  const equation = createEquationInput({ label:'Physical ODE', value:odeLatex(model), signal, onChange: next => {
    draft = next; dirty = true; physicalInvalid = false; ui('term').replaceChildren(); ui('normalized').replaceChildren(); invalidate('Equation changed. Apply it to update the physical model before revealing a response.');
  } });
  // Escape dismisses this exercise's keyboard before MathLive can enter its
  // separate raw-notation mode, which leaves programmatic presets uncommitted.
  equation.element.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    event.preventDefault(); event.stopPropagation(); window.mathVirtualKeyboard.hide();
  }, { capture: true, signal });
  ui('equation').append(equation.element); draft = equation.getValue();
  const y0 = control('Initial displacement y(0−) (m)',0), v0 = control('Initial velocity y′(0−) (m/s)',0), amplitude = control('Command amplitude / ramp slope',1);
  const horizon = control('Plot horizon (s)',10), count = control('Computed points',301), prediction = control('Predicted free response at cursor (m)',0), cursor = control('Time cursor (s)',1);
  prediction.input.value = ''; count.input.step = '1';
  const excitationLabel = el('label','One scalar command'), excitation = el('select'); excitation.setAttribute('aria-label','One scalar command');
  for (const [value,label] of [['zero','Zero input'],['step','Step A at t = 0'],['ramp','Ramp A·t for t ≥ 0']]) { const option = el('option',label); option.value=value; excitation.append(option); }
  excitation.value = 'step'; excitationLabel.append(excitation);
  ui('experiment-controls').append(y0.label,v0.label,excitationLabel,amplitude.label); ui('plot-controls').append(horizon.label,count.label,cursor.label);
  ui('prediction').append(prediction.label);
  for (const field of [y0.input,v0.input,amplitude.input,horizon.input,count.input,excitation]) on(field,'input',()=>{
    amplitude.input.disabled = excitation.value === 'zero';
    invalidate('Experiment changed. G(s) is unchanged when the physical coefficients stay fixed. Reveal again to apply this initial state/input.');
    try { renderTerm(); } catch(reason) { ui('term').replaceChildren(); error(reason); }
  });
  function initial(): Initial { return {y:numeric(y0.input,'Initial displacement',100),v:numeric(v0.input,'Initial velocity',100)}; }
  function experiment(): Experiment { return { initial:initial(), excitation:excitation.value as Excitation, amplitude:excitation.value==='zero'?0:numeric(amplitude.input,'Command amplitude/slope',100) }; }

  const table = el('table'), head = el('thead'), heading = el('tr');
  for (const label of ['Select physical term','Coefficient cell','ODE term / side']) heading.append(el('th',label)); head.append(heading); table.append(head);
  const body = el('tbody');
  for (const definition of terms) {
    const row = el('tr'), term = button(definition.physical,()=>{ selected=definition.key; try { renderTerm(); } catch(reason) { error(reason); } });
    const coefficient = control(`${definition.title} (${definition.units})`,model[definition.key]); fields[definition.key]=coefficient.input; rows[definition.key]=row; selectors[definition.key]=term;
    const chooseCell=el('td'), fieldCell=el('td'), equationCell=el('td'); chooseCell.append(term); fieldCell.append(coefficient.label); equationCell.textContent=`${definition.ode} · ${definition.key==='b'||definition.key==='d'?'right side':'left side'}`; row.append(chooseCell,fieldCell,equationCell); body.append(row);
    on(coefficient.input,'input',()=>{
      selected=definition.key; dirty=true; invalidate('Coefficient changed. The equation draft was updated; apply it before revealing a response.'); ui('term').replaceChildren(); ui('normalized').replaceChildren();
      try {
        const next = Object.fromEntries(terms.map(t=>[t.key,numeric(fields[t.key],t.title,1000)])) as unknown as Model;
        equation.setValue(odeLatex(next)); draft=equation.getValue(); physicalInvalid=false;
      } catch(reason) { physicalInvalid=true; error(reason); }
    });
  }
  table.append(body); ui('coefficients').append(table);
  function apply(): void {
    try {
      if(physicalInvalid)throw new Error('Complete finite physical coefficient cells before applying, or edit the ODE directly.');
      draft=equation.getValue();
      if(draft.empty||draft.hasPlaceholders||draft.syntaxIssues.length) throw new Error('Complete the equation and check its notation before applying.');
      model=parseOde(draft.latex); dirty=false; for(const t of terms) fields[t.key].value=String(model[t.key]);
      invalidate('Model applied. Follow the derivative transforms, predict the free response, then reveal the decomposition.'); renderPhysical(); renderTerm();
      ui('normalized').replaceChildren(el('h4','Divide every coefficient by the mass'),createEquationDisplay(equations(model,initial()).normalized,'Normalized ODE'));
    } catch(reason) { dirty=true; invalidate(''); ui('term').replaceChildren(); ui('normalized').replaceChildren(); error(reason); }
  }
  function preset(next: Model, displacement=0, mode: Excitation='step'): void {
    y0.input.value=String(displacement);v0.input.value='0';amplitude.input.value='1';amplitude.input.disabled=mode==='zero';excitation.value=mode;horizon.input.value='10';count.input.value='301';cursor.input.value='1';prediction.input.value='';
    physicalInvalid=false;equation.setValue(odeLatex(next));draft=equation.getValue();apply();
  }
  ui('model-actions').append(button('Apply ODE',apply,true),button('Baseline',()=>preset(BASELINE)),button('W02 worksheet',()=>preset({m:2,c:5,k:3,b:1,d:0})),button('Nonzero initial displacement',()=>preset(BASELINE,1)),button('Input-derivative example',()=>preset({...BASELINE,b:4,d:1})),button('Free mass',()=>preset({...BASELINE,c:0,k:0})));
  function renderPhysical(): void {
    ui('balance').replaceChildren(createEquationDisplay(`(${num(model.m)})y''=(${num(model.b)})u+(${num(model.d)})u'-(${num(model.c)})y'-(${num(model.k)})y`,'Newton force balance'));
    const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 620 195');svg.setAttribute('role','img');svg.setAttribute('aria-label','Mass, spring and damper schematic. Positive displacement and applied force point right; select the linked coefficient cells for numerical values.');
    function path(value:string,key?:Key):void {const p=document.createElementNS(ns,'path');p.setAttribute('d',value);p.setAttribute('fill','none');p.setAttribute('stroke',key===selected?'var(--accent)':'var(--muted)');p.setAttribute('stroke-width',key===selected?'3':'1.5');svg.append(p);}
    function text(value:string,x:number,y:number):void {const t=document.createElementNS(ns,'text');t.textContent=value;t.setAttribute('x',String(x));t.setAttribute('y',String(y));svg.append(t);}
    path('M30 20V155 M30 55H65L75 45L90 65L105 45L120 65L135 45L150 65L160 55H260','k');
    path('M30 125H115 M115 110V140H155V110H115 M135 125H260','c');
    path('M260 35H405V150H260Z','m');path('M405 85H560L550 77 M560 85L550 93');path('M300 175H460L450 168 M460 175L450 182');
    text(`k = ${fmt(model.k)} N/m`,70,32);text(`c = ${fmt(model.c)} N·s/m`,60,170);text(`m = ${fmt(model.m)} kg`,275,92);text('F(t)',480,65);text('y(t) →',470,180);ui('schematic').replaceChildren(svg);
  }
  function renderTerm(): void {
    if(dirty) return;
    const ic=initial(), value=num(model[selected]);
    const transform:Record<Key,string>={m:`(${value})(s^2Y(s)-s(${num(ic.y)})-(${num(ic.v)}))`,c:`(${value})(sY(s)-(${num(ic.y)}))`,k:`(${value})Y(s)`,b:`(${value})U(s)`,d:`(${value})(sU(s)-u(0^-)),\\quad u(0^-)=0`};
    for(const t of terms){rows[t.key].classList.toggle('selected',selected===t.key);selectors[t.key].setAttribute('aria-pressed',String(selected===t.key));}
    const definition=terms.find(t=>t.key===selected)!;
    ui('term').replaceChildren(el('p',`${definition.physical}; ${definition.units}. Its ODE term and unilateral Laplace transform are:`),createEquationDisplay(`(${value})${definition.ode}\\quad\\longrightarrow\\quad ${transform[selected]}`,'Selected term and its Laplace transform'));
    renderPhysical();
  }

  ui('reveal-action').append(button('Reveal derivation & response',()=>{
    try {
      if(dirty) throw new Error('Apply the ODE draft before revealing a response.');
      const ex=experiment(), duration=numeric(horizon.input,'Plot horizon',60), size=numeric(count.input,'Computed points',1001);
      const samples=responseSamples(model,ex,duration,size);
      const time=Math.min(duration,Math.max(0,numeric(cursor.input,'Time cursor',60)));cursor.input.value=String(time);
      const guess=prediction.input.value.trim()?numeric(prediction.input,'Prediction',1e12):undefined;
      shown={model,experiment:ex,horizon:duration,count:size,samples};ui('answers').hidden=false;
      renderDerivation();renderCursor();renderTable();
      const calculated=responseAt(model,ex,time).free;
      show(guess===undefined?'Derivation and numerical response revealed. G(s) contains the zero-state model; the initial response is separate.':Math.abs(guess-calculated)<=1e-7*Math.max(1,Math.abs(calculated))?'Prediction agrees within 10⁻⁷ relative/absolute tolerance. Compare the initial and forced components below.':`At ${fmt(time)} s the free response is approximately ${fmt(calculated)} m. Compare it with your prediction.`);
    }catch(reason){invalidate('');error(reason);}
  },true));
  function renderDerivation():void {
    if(!shown)return;const m=shown.model,ex=shown.experiment,eq=equations(m,ex.initial),p=poles(m),gain=dcGain(m);
    ui('derivation').replaceChildren(createEquationDisplay(eq.transformed,'Laplace equation including initial values'),createEquationDisplay(eq.split,'Zero-input and zero-state components'),createEquationDisplay(eq.transfer,'Zero-state transfer function'),
      el('p','A nonzero-initial-condition trajectory Y/U from one experiment is not the system transfer function. Only the zero-state ratio defines G(s).'),
      createEquationDisplay(`\\Delta=${num(p.discriminant)},\\qquad ${p.roots.map((r,i)=>`s_${i+1}=${num(r.re)}${r.im?(r.im<0?'-':'+')+num(Math.abs(r.im))+'\\mathrm{j}':''}`).join(',\\quad ')}`,'Denominator discriminant and both poles'),
      el('p',gain.kind==='finite'?`DC limit G(0) = ${fmt(gain.value)} m/input unit.${gain.cancellation?' This limit cancels a true zero factor; the original denominator poles above and initial response are retained.':''}`:gain.kind==='out-of-range'?'The DC limit exceeds the numerical display range.':'This zero-state transfer has no finite DC limit. A finite plot is not a final-value proof.'));
    ui('derivative').replaceChildren();
    if(m.d!==0){
      ui('derivative').append(el('h4','Construct states for the same single input'),el('p','The naive velocity state would contain u′. Subtract (d/m)u to obtain a standard one-input state equation; u′ is not a second independent input.'),createEquationDisplay(eq.state,'Modified states and one-input state equation'),
        el('p',ex.excitation==='step'?`The step derivative contains an impulse. Displacement stays continuous, while y′(0+) = y′(0−) + dA/m = ${fmt(ex.initial.v+m.d*ex.amplitude/m.m)} m/s. The initial-only component still uses the specified pre-step velocity.`:'For a ramp starting at zero, u is continuous and u′ equals its slope for t > 0; there is no initial velocity jump. Zero input also gives no jump.'));
    }
    ui('warnings').replaceChildren(...warnings(m,shown.horizon,shown.count).map(message=>el('p',message,'notice')));
  }
  function renderCursor():void {
    if(!shown)return;const t=numeric(cursor.input,'Time cursor',60);if(t<0||t>shown.horizon)throw new Error('Keep the time cursor inside the plotted horizon.');
    const point=responseAt(shown.model,shown.experiment,t);
    ui('cursor-result').replaceChildren(createEquationDisplay(`y(${num(t)})\\approx\\underbrace{${num(point.free)}}_{\\mathrm{zero\\ input}}+\\underbrace{${num(point.forced)}}_{\\mathrm{zero\\ state}}\\approx${num(point.total)}\\;\\mathrm{m}`,'Numerical response at cursor'),el('p',`Command u = ${fmt(point.input)} input units; total velocity = ${fmt(point.velocity)} m/s. At t = 0 the response is read on the 0+ side.`, 'muted'));
    renderPlot(shown.samples,t);
  }
  on(cursor.input,'input',()=>{try{renderCursor();if(shown)show('Time cursor updated. Values below refer to this time; reveal again to compare a new prediction.');}catch(reason){ui('cursor-result').replaceChildren();error(reason);}});
  function renderTable():void {
    if(!shown)return;const table=el('table'),head=el('thead'),row=el('tr');for(const label of ['t (s)','Zero-input y (m)','Zero-state y (m)','Total y (m)','Velocity (m/s)'])row.append(el('th',label));head.append(row);table.append(head);const body=el('tbody');
    for(const point of shown.samples){const row=el('tr');for(const value of [point.t,point.free,point.forced,point.total,point.velocity])row.append(el('td',fmt(value)));body.append(row);}table.append(body);ui('sample-table').replaceChildren(table);
  }
  function renderPlot(samples:Response[],time:number):void {
    const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 640 300');svg.setAttribute('role','img');svg.setAttribute('aria-label','Total, zero-input and zero-state displacement versus time in seconds. The same computed points are available in the sample table.');
    const values=samples.flatMap(p=>[p.free,p.forced,p.total]);let low=Math.min(0,...values),high=Math.max(0,...values);
    if(high===low){low-=1;high+=1;}const span=high-low,end=samples[samples.length-1].t;
    const axis=(v:number)=>Math.abs(v)>=10000||(v!==0&&Math.abs(v)<.001)?v.toExponential(1).replace(/e\+?(-?\d+)/,'×10^$1'):Number(v.toPrecision(3)).toString();
    const x=(t:number)=>95+525*t/end,y=(v:number)=>250-210*(v-low)/span;
    const line=(value:string,dash='')=>{const p=document.createElementNS(ns,'path');p.setAttribute('d',value);p.setAttribute('fill','none');p.setAttribute('stroke','currentColor');p.setAttribute('stroke-width','1.7');if(dash)p.setAttribute('stroke-dasharray',dash);svg.append(p);};
    line(`M95 30V250H620`);line(`M95 ${y(0)}H620`);line(`M${x(time)} 30V250`,'2 4');
    for(const [key,dash]of [['total',''],['free','8 5'],['forced','2 4']]as const)line(samples.map((point,i)=>`${i?'L':'M'}${x(point.t)} ${y(point[key])}`).join(' '),dash);
    for(const [label,px,py]of [['y (m)',95,18],[axis(high),0,40],[axis(low),0,250],['0',95,270],[fmt(end),590,270],['Time t (s)',285,294]]as const){const text=document.createElementNS(ns,'text');text.textContent=label;text.setAttribute('x',String(px));text.setAttribute('y',String(py));svg.append(text);}
    ui('plot').replaceChildren(svg,el('p','Total: solid · Zero input: dashed · Zero state: dotted · Vertical guide: time cursor','muted'));
  }
  apply();
  return()=>{equation.destroy();root.remove();};
};
