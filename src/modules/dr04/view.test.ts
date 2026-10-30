import{afterEach,describe,expect,it,vi}from'vitest';
const editorState=vi.hoisted(()=>({live:new Set<HTMLInputElement>(),fail:''}));
vi.mock('../../shared/equations/input',()=>({
  createEquationDisplay:(value:string,label:string)=>{const e=document.createElement('div');e.textContent=value;e.setAttribute('aria-label',label);return e;},
  createEquationInput:({label,value,signal,onChange}:{label:string;value:string;signal:AbortSignal;onChange:()=>void})=>{
    if(label===editorState.fail)throw new Error('Partial editor failure');
    const input=document.createElement('input');input.setAttribute('aria-label',label);input.value=value;input.addEventListener('input',onChange,{signal});editorState.live.add(input);
    return{element:input,getValue:()=>({latex:input.value,empty:!input.value.trim(),hasPlaceholders:input.value.includes('\\placeholder'),syntaxIssues:[]}),setValue:(s:string)=>{input.value=s;onChange();},destroy:()=>{editorState.live.delete(input);input.remove();}};
  },
}));
import{mount}from'./view';
let clean:(()=>void)|undefined;
afterEach(()=>{clean?.();clean=undefined;document.body.replaceChildren();expect(editorState.live.size).toBe(0);editorState.fail='';});
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
  it('converts before revealing, grades a full-order prediction and shows exact samples',()=>{
    visit();expect(section(1).hidden).toBe(true);expect(editorState.live.size).toBe(7);build();expect(section(1).hidden).toBe(false);expect(document.querySelector('table')).toBeNull();
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
  it('cleans abort/disposal and reopens at the unconverted source baseline',()=>{
    const first=visit();button('Positive feedback').click();solve();const old=button('Check prediction and apply Mason');first.parent.abort();old.click();expect(first.container.children).toHaveLength(0);expect(editorState.live.size).toBe(0);clean?.();visit();expect(editorState.live.size).toBe(7);expect(field('Sample period T (s)').value).toBe('0.2');expect(section(1).hidden).toBe(true);expect(document.querySelector('table')).toBeNull();
  });
  it('does not leave a partial answer when exact sample growth exceeds the arithmetic bound',()=>{
    visit();build();for(let i=1;i<=6;i++)button(`Remove b${i}`).click();set('Signal names (2–7, separated by commas)','R,Y');button('Apply signal names').click();button('Add branch').click();button('Add branch').click();select('b2 from','Y');select('b2 to','Y');set('b2 gain in z','((1000^4)^4)^5/z');solve();expect(feedback()).toMatch(/size limit/);expect(section(2).textContent).not.toContain('Exact zero-state transfer');expect(document.querySelector('table')).toBeNull();button('Source inputs').click();solve();expect(row(2)).toBe('211');
  });
  it('cleans a partial editor initialization while the parent remains active',()=>{
    editorState.fail='Sample period T (s)';const container=document.createElement('div'),parent=new AbortController();document.body.append(container);expect(()=>mount({container,signal:parent.signal})).toThrow('Partial editor');expect(parent.signal.aborted).toBe(false);expect(container.children).toHaveLength(0);expect(editorState.live.size).toBe(0);
  });
});
