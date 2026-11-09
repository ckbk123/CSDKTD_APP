import{afterEach,describe,expect,it,vi}from'vitest';
const editorState=vi.hoisted(()=>({live:new Set<HTMLInputElement>(),fail:'',failAfterResource:'',resourceCalls:0,onCreate:undefined as undefined|((label:string,signal:AbortSignal)=>void),tools:new Map<string,string[]>()}));
vi.mock('../../shared/equations/input',()=>({
  createEquationDisplay:(value:string,label:string)=>{const e=document.createElement('div');e.textContent=value;e.setAttribute('aria-label',label);return e;},
  createEquationInput:({label,value,signal,onChange,tools}:{label:string;value:string;signal:AbortSignal;onChange:()=>void;tools:string[]})=>{
    if(label===editorState.fail)throw new Error('Partial editor failure');
    const input=document.createElement('input');input.setAttribute('aria-label',label);input.value=value;input.addEventListener('input',onChange,{signal});editorState.live.add(input);
    editorState.tools.set(label,tools);
    if(label===editorState.failAfterResource){signal.addEventListener('abort',()=>{editorState.live.delete(input);input.remove();},{once:true});window.addEventListener('dr04-partial-row-probe',()=>editorState.resourceCalls++,{signal});throw new Error('Partial row editor failure');}
    editorState.onCreate?.(label,signal);
    return{element:input,getValue:()=>({latex:input.value,empty:!input.value.trim(),hasPlaceholders:input.value.includes('\\placeholder'),syntaxIssues:[]}),setValue:(s:string)=>{input.value=s;onChange();},destroy:()=>{editorState.live.delete(input);input.remove();}};
  },
}));
import{mount}from'./view';
let clean:(()=>void)|undefined;
afterEach(()=>{clean?.();clean=undefined;document.body.replaceChildren();expect(editorState.live.size).toBe(0);editorState.fail='';editorState.failAfterResource='';editorState.resourceCalls=0;editorState.onCreate=undefined;editorState.tools.clear();});
function visit(){const container=document.createElement('div'),parent=new AbortController();document.body.append(container);clean=mount({container,signal:parent.signal})||undefined;return{container,parent};}
const button=(label:string)=>[...document.querySelectorAll('button')].find(e=>e.textContent===label)!;
const field=(label:string)=>document.querySelector(`input[aria-label="${label}"]`) as HTMLInputElement;
function set(label:string,value:string){const e=field(label);e.value=value;e.dispatchEvent(new Event('input',{bubbles:true}));}
function select(label:string,value:string){const e=document.querySelector(`select[aria-label="${label}"]`)as HTMLSelectElement;e.value=value;e.dispatchEvent(new Event('change',{bubbles:true}));}
const build=()=>button('Convert boundaries and build discrete graph').click();
const solve=()=>button('Check prediction and apply Mason').click();
const feedback=()=>document.querySelector('.dr04-feedback')!.textContent!;
const section=(index:number)=>document.querySelectorAll('section')[index];
const row=(k:number)=>document.querySelectorAll('table tbody tr')[k]?.textContent||'';

describe('sampled conversion and editable Mason exercise (mock editors; browser separately)',()=>{
  it('shows the converted baseline before revealing, grades a full-order prediction and shows exact samples',()=>{
    visit();expect(section(1).hidden).toBe(false);expect(editorState.live.size).toBe(13);expect(document.querySelectorAll('.dr04-branch-target')).toHaveLength(6);expect(document.querySelector('table')).toBeNull();
    set('Predicted output/input transfer (optional)','(z^2+.8z-.2)/(z^4-2z^3+1.1z^2+.08z-.02)');solve();expect(feedback()).toContain('exactly equivalent');expect(row(2)).toBe('211');expect(row(3)).toBe('314/519/5');expect(section(2).textContent).toContain('Original node equations');expect(editorState.live.size).toBe(13);
  });
  it('keeps the physical delay while changing T and exposes the different boundary experiment',()=>{
    visit();button('Half T, keep the physical delay').click();expect(field('Physical transport delay τ (s)').value).toBe('0.2');solve();expect(row(3)).toBe('31/41/4');
    button('Add intermediate sample and hold').click();solve();expect(row(2)).toBe('200');expect(row(3)).toBe('322');expect(section(0).textContent).toContain('Sample v(kT), then hold v[k]');
  });
  it('validates connected paths and signed closed traces by the chosen branch order',()=>{
    visit();build();for(const id of['b1','b2','b3','b4'])button(`Trace ${id}`).click();button('Check selected forward path').click();expect(feedback()).toContain('valid');expect(document.querySelectorAll('.dr04-edge.chosen')).toHaveLength(4);
    button('Check selected elementary loop').click();expect(feedback()).toContain('close');button('Clear selected trace').click();for(const id of['b2','b3','b4','b5','b6'])button(`Trace ${id}`).click();button('Check selected elementary loop').click();expect(feedback()).toContain('valid');
  });
  it('shows distinct cofactors/non-touching products and revokes obsolete answer listeners',()=>{
    visit();button('Two paths and three non-touching loops').click();solve();expect(section(2).textContent).toContain('Elementary loops (3)');
    for(const label of['Select L1 for the two-loop check','Select L2 for the two-loop check']){const e=field(label);e.checked=true;e.dispatchEvent(new Event('change'));}
    const old=button('Check two loops for touching');old.click();expect(section(2).textContent).toContain('Non-touching: no shared signal');
    set('b1 gain in z','2');const changed=feedback();expect(document.querySelector('table')).toBeNull();old.click();expect(feedback()).toBe(changed);solve();expect(document.querySelector('table')).not.toBeNull();
  });
  it('distinguishes an edited graph from its source and audits the new gain',()=>{
    visit();build();set('b2 gain in z','1');expect(section(1).textContent).toContain('independent of the continuous conversion');solve();button('Check original equations at z').click();expect(section(2).textContent).toContain('0.147783251');
    expect(feedback()).toContain('agree at this finite point');
  });
  it('keeps the exact symbolic answer when a numeric audit point is invalid',()=>{
    visit();build();solve();set('Evaluation Re(z)','1');button('Check original equations at z').click();expect(feedback()).toContain('pole');expect(document.querySelector('table')).not.toBeNull();
    set('Evaluation Re(z)','1e-999');button('Check original equations at z').click();expect(feedback()).toContain('too small');expect(document.querySelector('table')).not.toBeNull();
    set('Evaluation Re(z)','2');button('Check original equations at z').click();expect(feedback()).toContain('agree');
  });
  it('rejects a browser badInput-empty numeric audit and keeps exact mathematics',()=>{
    visit();build();solve();const e=field('Evaluation Re(z)');Object.defineProperty(e,'validity',{configurable:true,value:{badInput:true}});e.value='';button('Check original equations at z').click();expect(feedback()).toContain('finite');expect(document.querySelector('table')).not.toBeNull();
  });
  it('revokes predictions and rejects unfinished/unsupported mathematics before recovering',()=>{
    visit();build();solve();set('Predicted output/input transfer (optional)','\\frac{1}{\\placeholder{}}');expect(document.querySelector('table')).toBeNull();expect(feedback()).toContain('Prediction changed');solve();expect(feedback()).toContain('Complete');
    button('Source inputs').click();set('b2 gain in z','s');solve();expect(feedback()).toMatch(/number|symbol|unsupported/i);expect(document.querySelector('table')).toBeNull();button('Source inputs').click();solve();expect(document.querySelector('table')).not.toBeNull();
  });
  it('invalidates converted data and rejects fractional transport delays without rounding',()=>{
    visit();build();solve();set('Physical transport delay τ (s)','0.3');expect(section(1).hidden).toBe(true);expect(document.querySelector('table')).toBeNull();build();expect(feedback()).toContain('integer τ/T');expect(section(1).hidden).toBe(true);button('Source inputs').click();solve();expect(row(2)).toBe('211');
  });
  it.each(['0^0','0^{-0}'])('revokes a solved graph for undefined branch power %s and recovers',value=>{
    visit();build();solve();expect(row(2)).toBe('211');
    set('b1 gain in z',value);expect(document.querySelector('table')).toBeNull();solve();
    expect(feedback()).toContain('Zero to the zeroth power');expect(section(2).textContent).not.toContain('Exact zero-state transfer');
    button('Check original equations at z').click();expect(feedback()).toContain('Apply Mason');
    set('b1 gain in z','2^{-1}');solve();expect(row(2)).toBe('21/21/2');
    set('b1 gain in z','2^{-0}');solve();expect(row(2)).toBe('211');
  });
  it.each(['0^0','0^{-0}'])('revokes a converted source for undefined parameter power %s and recovers',value=>{
    visit();build();solve();expect(row(2)).toBe('211');
    set('Plant gain g (s⁻²)',value);expect(section(1).hidden).toBe(true);expect(document.querySelector('table')).toBeNull();build();
    expect(feedback()).toContain('Zero to the zeroth power');expect(section(1).hidden).toBe(true);expect(section(2).hidden).toBe(true);
    set('Plant gain g (s⁻²)','2^{-1}');build();solve();expect(row(2)).toBe('21/101/10');
    set('Plant gain g (s⁻²)','2^{-0}');build();solve();expect(row(2)).toBe('21/51/5');
  });
  it('edits node names/endpoints while protecting the externally imposed source',()=>{
    visit();build();set('Signal names (2–7, separated by commas)','R,E,U,D,Y');button('Apply signal names').click();expect(feedback()).toContain('Reconnect');
    set('Signal names (2–7, separated by commas)','R,E,U,D,Y,B,X');button('Apply signal names').click();expect((document.querySelector('select[aria-label="b1 to"]') as HTMLSelectElement).options).toHaveLength(7);
    select('External input signal','E');solve();expect(feedback()).toContain('externally imposed');expect(document.querySelector('table')).toBeNull();
  });
  it('disposes removed row editors/listeners and keeps feedback attached',()=>{
    visit();build();const old=field('b1 gain in z');button('Remove b1').click();expect(editorState.live.size).toBe(12);expect(document.querySelector('.dr04-feedback')).not.toBeNull();solve();const before=feedback();old.value='2';old.dispatchEvent(new Event('input'));expect(feedback()).toBe(before);expect(document.querySelector('table')).not.toBeNull();
    button('Add branch').click();expect(editorState.live.size).toBe(13);set('b1 gain in z','z');solve();expect(feedback()).toContain('proper');
  });
  it('withholds causal sample rows for a formal advance produced by an algebraic loop',()=>{
    visit();build();for(let i=1;i<=6;i++)button(`Remove b${i}`).click();set('Signal names (2–7, separated by commas)','R,Y');button('Apply signal names').click();button('Add branch').click();button('Add branch').click();select('b2 from','Y');select('b2 to','Y');set('b2 gain in z','1-z^{-1}');solve();expect(section(2).textContent).toContain('formal transfer exists');expect(section(2).textContent).toContain('table is withheld');expect(document.querySelector('table')).toBeNull();
  });
  it('cleans abort/disposal and reopens at the unrevealed converted baseline',()=>{
    const first=visit();button('Positive feedback').click();solve();const old=button('Check prediction and apply Mason');first.parent.abort();old.click();expect(first.container.children).toHaveLength(0);expect(editorState.live.size).toBe(0);clean?.();visit();expect(editorState.live.size).toBe(13);expect(field('Sample period T (s)').value).toBe('0.2');expect(section(1).hidden).toBe(false);expect(document.querySelector('table')).toBeNull();
  });
  it('does not leave a partial answer when exact sample growth exceeds the arithmetic bound',()=>{
    visit();build();for(let i=1;i<=6;i++)button(`Remove b${i}`).click();set('Signal names (2–7, separated by commas)','R,Y');button('Apply signal names').click();button('Add branch').click();button('Add branch').click();select('b2 from','Y');select('b2 to','Y');set('b2 gain in z','((1000^4)^4)^5/z');solve();expect(feedback()).toMatch(/size limit/);expect(section(2).textContent).not.toContain('Exact zero-state transfer');expect(document.querySelector('table')).toBeNull();button('Source inputs').click();solve();expect(row(2)).toBe('211');
  });
  it('cleans a partial editor initialization while the parent remains active',()=>{
    editorState.fail='Sample period T (s)';const container=document.createElement('div'),parent=new AbortController();document.body.append(container);expect(()=>mount({container,signal:parent.signal})).toThrow('Partial editor');expect(parent.signal.aborted).toBe(false);expect(container.children).toHaveLength(0);expect(editorState.live.size).toBe(0);
  });
  it('switches physical boundaries directly using the unchanged exact model and withholds Mason until requested',()=>{
    visit();const toggle=document.querySelector('button[aria-label="Intermediate sampler and hold"]')as HTMLButtonElement;
    expect(toggle.getAttribute('aria-pressed')).toBe('false');expect(document.querySelector('table')).toBeNull();
    toggle.click();expect(toggle.getAttribute('aria-pressed')).toBe('true');expect(document.querySelector('table')).toBeNull();
    expect((document.querySelector('select[aria-label="Intermediate boundary"]')as HTMLSelectElement).value).toBe('split');
    solve();expect(row(2)).toBe('200');expect(row(3)).toBe('322');
    toggle.click();expect(toggle.getAttribute('aria-pressed')).toBe('false');expect(document.querySelector('table')).toBeNull();solve();expect(row(2)).toBe('211');expect(row(3)).toBe('314/519/5');
  });
  it('uses the full source draft when changing boundaries, preserving invalid edits without an old graph',()=>{
    visit();set('Sample period T (s)','\\frac{1}{5}');select('Intermediate boundary','split');solve();expect(row(3)).toBe('322');
    expect(document.querySelector('.dr04-model-summary')?.textContent).toContain('T=1/5 s');expect(document.querySelector('.dr04-model-summary')?.textContent).not.toContain('\\frac');
    set('Physical transport delay τ (s)','0.3');const toggle=document.querySelector('button[aria-label="Intermediate sampler and hold"]')as HTMLButtonElement;toggle.click();
    expect(field('Physical transport delay τ (s)').value).toBe('0.3');expect(section(1).hidden).toBe(true);expect(section(2).hidden).toBe(true);expect(document.querySelector('table')).toBeNull();expect(feedback()).toContain('integer τ/T');
    set('Physical transport delay τ (s)','0.2');build();solve();expect(row(2)).toBe('211');
  });
  it('shares direct graph and row trace selection, with ordered connectivity checks and revoked stale trace proof',()=>{
    visit();const click=(id:string)=>document.querySelector(`[data-branch="${id}"] .dr04-edge-label`)!.dispatchEvent(new MouseEvent('click',{bubbles:true}));
    for(const id of['b1','b2','b3','b4'])click(id);expect(document.querySelector('.dr04-trace')?.textContent).toContain('b1 → b2 → b3 → b4');
    button('Check selected forward path').click();expect(feedback()).toContain('valid');expect(document.querySelector('[aria-label="Checked selected trace gain"]')).not.toBeNull();
    button('Trace b2').click();expect(document.querySelector('[data-branch="b2"]')?.getAttribute('aria-pressed')).toBe('false');expect(document.querySelector('[aria-label="Checked selected trace gain"]')).toBeNull();expect(feedback()).toContain('selection changed');
    button('Check selected forward path').click();expect(feedback()).toMatch(/connect|consecutive/i);
    button('Clear selected trace').click();for(const id of['b2','b3','b4','b5','b6'])click(id);button('Check selected elementary loop').click();expect(feedback()).toContain('valid');
  });
  it('keeps keyboard focus, scroll and native badInput attempts intact across drawing redraws',()=>{
    visit();solve();const input=field('Evaluation Re(z)');input.value='';Object.defineProperty(input,'validity',{configurable:true,value:{badInput:true}});const writes=vi.spyOn(input,'value','set');
    let target=document.querySelector('[data-branch="b1"]')as SVGElement;target.focus();const scroll=document.querySelector('.dr04-drawing .dr04-scroll')as HTMLElement;scroll.scrollLeft=139;
    target.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));target=document.querySelector('[data-branch="b1"]')as SVGElement;
    expect(document.activeElement).toBe(target);expect(target.getAttribute('aria-pressed')).toBe('true');expect((document.querySelector('.dr04-drawing .dr04-scroll')as HTMLElement).scrollLeft).toBe(139);
    target.dispatchEvent(new KeyboardEvent('keydown',{key:' ',bubbles:true}));expect(document.activeElement).toBe(document.querySelector('[data-branch="b1"]'));expect(document.querySelector('[data-branch="b1"]')?.getAttribute('aria-pressed')).toBe('false');
    expect(field('Evaluation Re(z)')).toBe(input);expect(writes).not.toHaveBeenCalled();expect(document.querySelector('table')).not.toBeNull();button('Check original equations at z').click();expect(feedback()).toContain('finite');
    writes.mockRestore();Object.defineProperty(input,'validity',{configurable:true,value:{badInput:false}});set('Evaluation Re(z)','2');button('Check original equations at z').click();expect(feedback()).toContain('agree');
  });
  it('cleans a partially constructed row scope even before that row enters the model',()=>{
    editorState.failAfterResource='b1 gain in z';const container=document.createElement('div'),parent=new AbortController();document.body.append(container);
    expect(()=>mount({container,signal:parent.signal})).toThrow('Partial row editor');expect(parent.signal.aborted).toBe(false);expect(container.children).toHaveLength(0);expect(editorState.live.size).toBe(0);
    window.dispatchEvent(new Event('dr04-partial-row-probe'));expect(editorState.resourceCalls).toBe(0);
  });
  it('releases an editor returned after reentrant parent abort without attaching a late graph',()=>{
    const container=document.createElement('div'),parent=new AbortController();document.body.append(container);editorState.onCreate=label=>{if(label==='b1 gain in z')parent.abort();};
    expect(()=>mount({container,signal:parent.signal})).toThrow('visit was cancelled');expect(container.children).toHaveLength(0);expect(editorState.live.size).toBe(0);
  });
  it('offers only quick equation tools accepted by the existing bounded grammar',()=>{
    visit();expect(editorState.tools.size).toBe(13);for(const tools of editorState.tools.values())expect(tools).toEqual(['fraction','power','parentheses']);
  });
});
