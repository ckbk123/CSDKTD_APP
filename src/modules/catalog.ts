import type { Category, Domain, ModuleManifest } from '../core/module';

export const domains: readonly { id: Domain; name: string }[] = [
  { id: 'continuous', name: 'Continuous' }, { id: 'discrete', name: 'Discrete' },
];
export const categories: readonly { id: Category; name: string; description: string }[] = [
  { id: 'representation', name: 'System Representation', description: 'Polynomials, equations, transfer functions, state space and signal diagrams.' },
  { id: 'plots', name: 'Plots', description: 'Time responses, pole maps, Bode, Nyquist and root locus.' },
  { id: 'stability', name: 'Stability', description: 'Stability criteria, parameter ranges and feedback stability.' },
  { id: 'performance', name: 'Performance', description: 'Tracking error, transient response and frequency specifications.' },
  { id: 'design', name: 'Controller Design', description: 'Lead and lag, PID, state feedback and observers.' },
];

// Only tiny manifests are eager. Each workspace is a separate lazy import.
const discovered = import.meta.glob<ModuleManifest>('./*/index.ts', { eager: true, import: 'manifest' });
export const modules: readonly ModuleManifest[] = Object.freeze(
  Object.values(discovered).map(manifest => Object.freeze(manifest)).sort((a, b) => a.id.localeCompare(b.id)),
);
export function findModule(id: string): ModuleManifest | undefined {
  return modules.find(module => module.id === id);
}
export function categoryName(id: Category): string {
  return categories.find(category => category.id === id)!.name;
}
export function domainName(id: Domain): string {
  return domains.find(domain => domain.id === id)!.name;
}
const conceptGroups: readonly { terms: string; ids: readonly string[] }[] = [
  { terms: 'root locus rlocus rootlocus pole trajectories quy dao nghiem so', ids: ['CP06', 'CS05', 'CD02', 'CD03', 'CD04', 'DP04', 'DS04', 'DD02'] },
  { terms: 'pid proportional integral derivative controller tuning', ids: ['CD01', 'CD07', 'DD01', 'DD04', 'DD05'] },
  { terms: 'state space realization feedback observer estimation', ids: ['CR03', 'CR06', 'CD08', 'CD09', 'DR03', 'DD06', 'DD07'] },
  { terms: 'sampling sample period hold zoh discretization aliasing', ids: ['DR05', 'DP02', 'DF04', 'DD01', 'DD03'] },
  { terms: 'bode frequency response gain phase margins bandwidth', ids: ['CP04', 'CF04', 'CD05', 'CD06', 'DP03', 'DF03', 'DD03'] },
  { terms: 'nyquist contour mapping winding encirclement', ids: ['CP05', 'CS04', 'DS05'] },
  { terms: 'time response transient step free forced modes', ids: ['CP01', 'CP02', 'CP03', 'CF01', 'CF05', 'DF01'] },
  { terms: 'block diagram signal flow mason paths loops', ids: ['CR04', 'CR05', 'DR04'] },
  { terms: 'difference recurrence delay memory registers sequence z transform', ids: ['DR02', 'DR01', 'DP01'] },
  { terms: 'stability routh hurwitz jury parameter region', ids: ['CS01', 'CS02', 'CS03', 'DS01', 'DS02', 'DS03'] },
  { terms: 'steady state tracking error quality cost indices', ids: ['CF02', 'CF03', 'DF02'] },
  { terms: 'polynomial factors roots differential equation ode laplace physical model', ids: ['CR01', 'CR02'] },
];

function searchWords(value: string): string {
  return value.normalize('NFKD').replace(/\p{M}/gu, '').toLocaleLowerCase().replace(/đ/g, 'd').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

// Search synonyms describe what a tool actually supports. Related-topic
// groups are broader and must not make every state tool an observer designer.
const searchGroups: readonly { terms: string; ids: readonly string[] }[] = [
  conceptGroups[0],
  { terms: 'bode frequency response', ids: ['CP04', 'CF04', 'CD05', 'CD06', 'DP03', 'DF03', 'DD03'] },
  { terms: 'nyquist contour mapping', ids: ['CP05', 'CF04', 'CS04', 'DS05'] },
  { terms: 'state space realization', ids: ['CR03', 'DR03'] },
  { terms: 'zero order hold zoh sampling', ids: ['DR05'] },
  { terms: 'sampling period aliasing pole mapping', ids: ['DP02'] },
  { terms: 'sampling period redesign policy', ids: ['DF04'] },
  { terms: 'differential equation ode laplace', ids: ['CR02'] },
  { terms: 'difference equation recurrence delay memory', ids: ['DR02'] },
];

/** Undefined domain searches the whole catalogue; caller explicitly owns scope. */
export function filterModules(domain: Domain | undefined, category?: Category, query = ''): ModuleManifest[] {
  const words = searchWords(query).split(/\s+/).filter(Boolean);
  return modules.filter(module => {
    if ((domain && module.domain !== domain) || (category && module.category !== category)) return false;
    const aliases = searchGroups.filter(group => group.ids.includes(module.id)).map(group => group.terms).join(' ');
    const text = searchWords(`${module.id} ${module.title} ${module.description} ${categoryName(module.category)} ${aliases}`);
    return words.every(word => text.includes(word));
  });
}

/** Related visits start their own baseline; no exercise model travels here. */
export function relatedModules(id: string): readonly ModuleManifest[] {
  const current = findModule(id);
  if (!current) return [];
  const group = conceptGroups.find(candidate => candidate.ids.includes(id));
  const others = (group?.ids ?? []).filter(other => other !== id).map(findModule).filter((item): item is ModuleManifest => !!item);
  return [...others.filter(item => item.domain === current.domain).slice(0, 2),
    ...others.filter(item => item.domain !== current.domain).slice(0, 2)];
}
