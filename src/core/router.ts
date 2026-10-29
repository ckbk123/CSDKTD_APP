import type { Category, Domain } from './module';
import { categories, findModule } from '../modules/catalog';

export type Route = { kind: 'library'; domain: Domain; category?: Category }
  | { kind: 'module'; id: string }
  | { kind: 'missing' };

export function parseRoute(hash: string): Route {
  const rawPath = hash.replace(/^#/, '');
  const path = !rawPath || rawPath === '/' ? '/continuous' : rawPath;
  const moduleMatch = /^\/module\/([A-Za-z]{2}\d{2})\/?$/.exec(path);
  if (moduleMatch) {
    const id = moduleMatch[1].toUpperCase();
    return findModule(id) ? { kind: 'module', id } : { kind: 'missing' };
  }
  const libraryMatch = /^\/(continuous|discrete)(?:\/([a-z]+))?\/?$/.exec(path);
  if (!libraryMatch) return { kind: 'missing' };
  const domain = libraryMatch[1] as Domain;
  if (!libraryMatch[2]) return { kind: 'library', domain };
  const category = categories.find(category => category.id === libraryMatch[2])?.id;
  return category ? { kind: 'library', domain, category } : { kind: 'missing' };
}
export function libraryHref(domain: Domain, category?: Category): string {
  return `#/${domain}${category ? `/${category}` : ''}`;
}
export function moduleHref(id: string): string { return `#/module/${id}`; }
