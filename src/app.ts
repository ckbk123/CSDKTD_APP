import type { Category, Domain, ModuleManifest } from './core/module';
import { libraryHref, moduleHref, parseRoute } from './core/router';
import { WorkspaceSession } from './core/workspace-session';
import { categories, categoryName, domainName, domains, filterModules, findModule } from './modules/catalog';

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function link(text: string, href: string, className = ''): HTMLAnchorElement {
  const node = element('a', className, text);
  node.href = href;
  return node;
}

export function createApp(root: HTMLElement): () => void {
  const session = new WorkspaceSession();
  let domain: Domain = 'continuous';
  let category: Category | undefined;
  let currentModule: ModuleManifest | undefined;
  let search: HTMLInputElement | undefined;
  let query = '';
  let results: HTMLElement;

  const skip = link('Skip to content', '#main', 'skip-link');
  skip.addEventListener('click', event => {
    event.preventDefault();
    document.querySelector<HTMLElement>('#main')?.focus();
  });
  const header = element('header', 'app-header');
  const brand = link('', libraryHref('continuous'), 'brand');
  brand.setAttribute('aria-label', 'CSDKTD APP home');
  const logo = element('img', 'brand-logo');
  logo.src = '/hcmut.png'; logo.alt = 'HCMUT'; logo.width = 46; logo.height = 46;
  const wordmark = element('span', 'wordmark');
  wordmark.append(element('strong', '', 'CSDKTD APP'), element('span', 'university', 'Ho Chi Minh City University of Technology'));
  brand.append(logo, wordmark);
  header.append(brand, element('span', 'scope-label', 'SISO LTI'));
  const layout = element('div', 'app-layout');
  const aside = element('aside', 'sidebar');
  const main = element('main', 'main'); main.id = 'main'; main.tabIndex = -1;
  layout.append(aside, main);
  root.replaceChildren(skip, header, layout);

  function sidebar(): void {
    const domainNav = element('nav', 'domain-nav'); domainNav.setAttribute('aria-label', 'System domain');
    domains.forEach(item => {
      const itemLink = link(item.name, libraryHref(item.id, category), `domain-link${item.id === domain ? ' selected' : ''}`);
      if (item.id === domain) itemLink.setAttribute('aria-current', 'page');
      domainNav.append(itemLink);
    });
    const topicNav = element('nav', 'topic-nav'); topicNav.setAttribute('aria-label', 'Topics');
    const overview = link('Overview', libraryHref(domain), `topic-link${!category ? ' selected' : ''}`);
    if (!category) overview.setAttribute('aria-current', 'page');
    topicNav.append(overview);
    categories.forEach(item => {
      const itemLink = link(item.name, libraryHref(domain, item.id), `topic-link${item.id === category ? ' selected' : ''}`);
      if (item.id === category) itemLink.setAttribute('aria-current', 'page');
      topicNav.append(itemLink);
    });
    const footer = element('p', 'sidebar-count', `${filterModules(domain).length} modules · ${domainName(domain)}`);
    aside.replaceChildren(element('p', 'nav-label', 'Systems'), domainNav, element('p', 'nav-label topics-label', 'Topics'), topicNav, footer);
  }

  function renderResults(): void {
    const items = filterModules(domain, category, query);
    const grid = element('div', 'card-grid');
    if (!category && !query.trim()) {
      categories.forEach((item, index) => {
        const card = link('', libraryHref(domain, item.id), 'card');
        card.append(element('span', 'card-meta', `${String(index + 1).padStart(2, '0')} / ${filterModules(domain, item.id).length} modules`),
          element('h2', '', item.name), element('p', '', item.description));
        grid.append(card);
      });
      results.replaceChildren(element('p', 'results-count', 'Topics'), grid);
      return;
    }
    const count = element('p', 'results-count', `${items.length} module${items.length === 1 ? '' : 's'}${query.trim() ? ' found' : ''}`);
    count.setAttribute('role', 'status');
    if (!items.length) {
      const empty = element('div', 'no-results');
      empty.append(element('h2', '', 'No matching modules'), element('p', '', 'Change the search text or select another topic.'));
      results.replaceChildren(count, empty);
      return;
    }
    items.forEach(item => {
      const card = link('', moduleHref(item.id), 'card module-card');
      card.dataset.moduleId = item.id;
      card.append(element('span', 'card-meta', `${item.id} / ${categoryName(item.category)}`),
        element('h2', '', item.title), element('p', '', item.description));
      grid.append(card);
    });
    results.replaceChildren(count, grid);
  }

  function libraryPage(): void {
    const heading = element('header', 'page-heading');
    if (category) heading.append(element('p', 'eyebrow', `${domainName(domain)} systems`));
    heading.append(element('h1', '', category ? categoryName(category) : `${domainName(domain)} systems`));
    if (category) heading.append(element('p', 'page-description', categories.find(item => item.id === category)!.description));
    const searchBox = element('div', 'search-box');
    const label = element('label', '', 'Search modules'); label.htmlFor = 'module-search';
    search = element('input'); search.id = 'module-search'; search.type = 'search';
    search.placeholder = 'Name, topic or module ID'; search.autocomplete = 'off';
    search.setAttribute('aria-controls', 'module-results');
    search.addEventListener('input', () => { query = search!.value; renderResults(); });
    searchBox.append(label, search);
    results = element('section', 'module-results'); results.id = 'module-results'; results.setAttribute('aria-label', 'Module catalogue');
    main.append(heading, searchBox, results);
    renderResults();
  }

  function modulePage(module: ModuleManifest): void {
    const toolbar = element('div', 'module-toolbar');
    const back = link('← All modules', libraryHref(domain, category), 'back-link');
    const reset = element('button', 'button', 'Reset example'); reset.type = 'button';
    toolbar.append(back, reset);
    const breadcrumb = element('nav', 'breadcrumb'); breadcrumb.setAttribute('aria-label', 'Breadcrumb');
    breadcrumb.append(link(domainName(domain), libraryHref(domain)), element('span', '', '/'),
      link(categoryName(module.category), libraryHref(domain, module.category)), element('span', '', '/'), element('span', '', module.id));
    const heading = element('header', 'page-heading');
    heading.append(element('h1', '', module.title), element('p', 'page-description', module.description));
    const example = element('section', 'default-example'); example.setAttribute('aria-label', 'Default example');
    example.append(element('h2', 'eyebrow', 'Default example'), element('p', 'example-value', module.defaultExample));
    const workspaceHeading = element('div', 'workspace-heading');
    const status = element('span', 'workspace-status', 'Loading workspace…'); status.setAttribute('role', 'status');
    workspaceHeading.append(element('h2', '', 'Workspace'), status);
    const workspace = element('section', 'workspace');
    workspace.dataset.module = module.id; workspace.id = 'module-workspace';
    workspace.setAttribute('aria-label', `${module.title} workspace`);
    workspace.setAttribute('aria-busy', 'true');
    const footer = element('p', 'workspace-note', 'Each visit starts with the default example.');
    main.append(toolbar, breadcrumb, heading, example, workspaceHeading, workspace, footer);

    async function mount(isReset = false): Promise<void> {
      status.textContent = 'Loading workspace…';
      workspace.setAttribute('aria-busy', 'true');
      try {
        const mounted = await session.open(module, workspace);
        if (!mounted) return;
        workspace.setAttribute('aria-busy', 'false');
        status.textContent = isReset ? 'Default example restored' : workspace.childElementCount ? '' : 'Implementation pending';
      } catch (error) {
        console.error(`Could not mount ${module.id}`, error);
        workspace.setAttribute('aria-busy', 'false'); status.textContent = 'Workspace unavailable';
        const message = element('div', 'workspace-error'); message.setAttribute('role', 'alert');
        const retry = element('button', 'button', 'Try again'); retry.type = 'button';
        retry.addEventListener('click', () => { void mount(); });
        message.append(element('p', '', 'The workspace could not be loaded. Check your connection and try again.'), retry);
        workspace.replaceChildren(message);
      }
    }
    reset.addEventListener('click', () => { void mount(true); });
    void mount();
  }

  function render(): void {
    session.close();
    query = ''; search = undefined;
    const route = parseRoute(location.hash);
    currentModule = route.kind === 'module' ? findModule(route.id) : undefined;
    if (route.kind === 'library') { domain = route.domain; category = route.category; }
    if (currentModule) { domain = currentModule.domain; category = currentModule.category; }
    brand.href = libraryHref(domain);
    sidebar(); main.replaceChildren();
    if (route.kind === 'library') libraryPage();
    else if (currentModule) modulePage(currentModule);
    else {
      main.append(element('h1', '', 'Page not found'), link('Return to modules', libraryHref(domain), 'button'));
    }
    document.title = currentModule ? `${currentModule.title} · CSDKTD APP` : 'CSDKTD APP';
    main.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }
  function keydown(event: KeyboardEvent): void {
    if (event.defaultPrevented) return;
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f' && search) {
      event.preventDefault(); search.focus();
    } else if (event.key === 'Escape') {
      if (currentModule) { event.preventDefault(); location.hash = libraryHref(domain, category); }
      else if (search?.value) { event.preventDefault(); query = search.value = ''; renderResults(); }
    } else if ((event.ctrlKey || event.metaKey) && event.key === 'Home') {
      event.preventDefault(); location.hash = libraryHref(domain);
    }
  }
  window.addEventListener('hashchange', render);
  window.addEventListener('keydown', keydown);
  render();
  return () => {
    session.close(); window.removeEventListener('hashchange', render);
    window.removeEventListener('keydown', keydown); root.replaceChildren();
  };
}
