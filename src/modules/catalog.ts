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
export function filterModules(domain: Domain, category?: Category, query = ''): ModuleManifest[] {
  const needle = query.trim().toLocaleLowerCase();
  return modules.filter(module => module.domain === domain && (!category || module.category === category)
    && `${module.id} ${module.title} ${module.description} ${categoryName(module.category)}`.toLocaleLowerCase().includes(needle));
}
