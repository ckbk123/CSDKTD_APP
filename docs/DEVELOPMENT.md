# Browser development guide

**Browser scaffold assessment, 29 October 2026, v0.3.0.** Control Studio is a static Vite/TypeScript browser application. At this baseline its 56 independent module folders provided metadata and blank workspaces; the shared equation layer typeset their examples and offered temporary editing. Begin assignments at [START_HERE.md](START_HERE.md). [PROJECT_STATUS.md](PROJECT_STATUS.md) and module-owned `STATUS.md` files record subsequent implementation and verification; check current code/tests before assuming a tool is still blank or already complete.

## Build and run

Use **Node.js 24 LTS (24.15+)** with its bundled npm. The pinned toolchain also supports Node 22.22.2+. From the repository root:

```sh
npm ci
npm run dev
```

Use Vite's printed local address. The other commands are:

| Command | Purpose |
|---|---|
| `npm run check` | TypeScript checking (`tsc --noEmit`) |
| `npm test` | Vitest tests (`vitest run`) |
| `npm run build` | Produce the static application in `dist/` |
| `npm run preview` | Serve the production build locally for inspection |

Run check, tests and build before handing off a module. Local development/preview does not publish the site. See [DEPLOYMENT.md](DEPLOYMENT.md) for Cloudflare Workers Static Assets and `wrangler.jsonc`. The deployed application needs no API server, account system, database or secrets for its calculations.

## Source boundaries

| Location | Responsibility |
|---|---|
| `src/core/module.ts` | Browser module manifest and mount/cleanup types |
| `src/core/workspace-session.ts` | Active workspace lifecycle and stale-import protection |
| `src/modules/catalog.ts` | Discover metadata and validate catalogue identities/grouping |
| `src/modules/<id>/index.ts` | Small immutable metadata entry and lazy workspace loader |
| `src/modules/<id>/workspace.ts` | One tool's interface and per-visit state |
| `src/modules/<id>/TASK.md` | Durable implementation goal and mathematical acceptance contract |
| `src/modules/<id>/STATUS.md` | Module-owned requirement audit, delivered behavior, remaining work and verification evidence |
| `src/modules/<id>/*.test.ts` | Module-owned numerical/logic tests |
| `src/shared/math/` | Future coordinated stateless mathematical helpers |
| `src/shared/equations/` | Shared visual equation display/input and curated baseline previews; no mathematical solver |
| `docs/research/` | Course evidence and provenance; original slide decks remain outside Git |

The catalogue uses eager `import.meta.glob` discovery for **metadata only**. Each manifest's `load` lazily imports `./workspace`. Keep large algorithms, plotting libraries and module UI out of metadata imports so opening the home grid does not load every tool's implementation.

A manifest has this shape:

```ts
export const manifest = {
  id: 'CR01',
  title: 'Polynomial laboratory',
  description: 'Expand expressions, inspect factors and locate roots.',
  domain: 'continuous',
  category: 'representation',
  defaultExample: 'P(s) = s^4 + 7s^3 + 27s^2 + 47s + 26',
  load: () => import('./workspace'),
} satisfies ModuleManifest;
```

Domains are `continuous`/`discrete`; categories are `representation`, `plots`, `stability`, `performance`, `design`. IDs and folder names are stable routing identities. Coordinate changes rather than silently renaming them.

## Mount, reset and leave

The workspace exports a **synchronous** mount function. It receives an HTML container and an `AbortSignal`, and may return cleanup:

```ts
export const mount: ModuleMount = ({ container, signal }) => {
  // Initialize this visit from the module's baseline.
  const input = document.createElement('input');
  input.setAttribute('aria-label', 'Example parameter');
  container.append(input);
  input.addEventListener('input', () => { /* update local state */ }, { signal });
  return () => { /* release module-owned resources */ };
};
```

Mutable state belongs inside `mount` or objects created by that call. It must not live in an imported singleton. Pure functions and immutable constants can live at module scope. Module visits do not exchange models or results.

The shell aborts and cleans the current workspace before leaving/resetting, clears its content, and mounts a fresh baseline on the next visit. Its session guard discards a lazy import that completes after navigation has moved elsewhere. Mount can start asynchronous work, but it returns synchronously; abort/guard outstanding work and late results. Release timers, animation frames, observers, workers, chart instances and subscriptions in cleanup. Keep cleanup safe when work has already completed or been aborted.

Scope CSS with CSS modules or beneath the shell-provided `[data-module="CR01"]` root, substituting the assigned ID. Avoid module styles that change the shell or other tools. Each tool must fit the existing page and provide keyboard/numeric alternatives for graphical interactions.

The shell's empty-workspace caption disappears when a mount adds controls; it
does not certify mathematical completeness. The catalogue tests check metadata
and lazy export contracts without requiring modules to remain blank or running
browser-only plotting APIs in jsdom. Add the real mathematical tests locally.
An editor/dialog may consume a keyboard event with `preventDefault()`; the shell
respects that before handling its own Escape and navigation shortcuts.

## Shared visual contract

Follow [DESIGN.md](DESIGN.md) for the selected Control Studio identity, Indigo + slate light/dark tokens and compact layout. The 64 px header contains the 32 px pole/zero mark, application name and `v<package.version> · Cao Kha Bao Khanh`. Read the version automatically from `package.json`; do not duplicate it as a hardcoded UI value. Catalogue search belongs in the header, with a collapsible search control on small screens. Keep the sidebar light and surfaces subtly outlined. The unchanged HCMUT PNG is institutional HCMUT/EE2019 footer credit; provenance is in [ASSETS.md](ASSETS.md).

The repository remains `CSDKTD_APP` and package/Cloudflare identifiers remain `csdktd-app`. Stable module IDs and course/history references are preserved. Module work uses the selected shared tokens and scoped styles; changes to the global identity or header need coordination.

## Mathematical services

Use the [shared equation UI](EQUATION_INPUT.md) for expression display and student entry. It provides textbook-style visual editing through locally bundled MathLive 0.111.1. The shell's editable example banner is a preview and does not update workspace inputs. Real module inputs use `createEquationInput` with caller-owned drafts and the visit's abort signal; use `createEquationDisplay` for results. No student should need MATLAB syntax or LaTeX knowledge. LaTeX syntax feedback is separate from the module's bounded domain parser and mathematical validation.

The shell currently includes no general control toolbox or CAS. [MATH_BACKEND_OPTIONS.md](MATH_BACKEND_OPTIONS.md) records future candidates. Prefer small pure services with explicit coefficient order, matrix layout, units, tolerances, status and resource limits. Reuse shared math only through a documented interface; keep teaching state local.

JavaScript/TypeScript and optional future C/WebAssembly are implementation choices behind that interface. Native library availability does not establish browser compatibility. A C/WebAssembly choice needs toolchain/library/license checks, bounded memory, predictable error handling and independent numerical tests. Raven/C UI types do not belong in the browser module contract.

Coordinate shared helper and dependency changes with the integration owner. Assign one owner to a shared API before several agents depend on it. A module agent can build its controls, fixtures and local pure helpers while that shared work proceeds.

## Verification

Vitest tests use `*.test.ts`. Keep normal module tests inside its directory. Check the baseline against an independent analytic or high-confidence reference, change data, and test domain-specific boundary/failure cases. Use residuals and scale-aware tolerances for numerical algorithms; never test correctness solely by calling the same calculation twice.

Real-browser checks complement unit tests: open the module, edit values, inspect plots/results, reset to baseline, leave/reopen, navigate rapidly during loading, use keyboard input and inspect a narrow viewport. Confirm cleanup prevents old work from updating a new workspace. The project has no dedicated end-to-end command yet; record the manual/browser-tool checks performed.

MathLive's Node export is its server-rendering build, not the interactive browser editor. A mock in jsdom cannot verify field selection, local fonts or the virtual keyboard. Follow the real-browser checks in [EQUATION_INPUT.md](EQUATION_INPUT.md) when using the shared component.

Type checking and a successful build establish integration, not mathematical correctness or support for every browser/device. Record actual tested browsers and supported computational limits.

## Product boundaries and history

All calculations execute in the browser. The first release has no accounts, persistence, saved projects, export workflow or service worker, and does not promise offline installation. Browser caching alone is not an offline guarantee. Cloudflare serves generated static files; publishing and cache behavior are described in the deployment guide.

The former C/Raven shell is historical context, not the active build path. See [native platform feasibility](history/PLATFORM_FEASIBILITY_NATIVE.md). Its Windows/Vulkan test results do not validate the browser application, and its native binary size does not predict web download size. Preserve course asset provenance and [third-party notices](../THIRD_PARTY_NOTICES.md); no application-wide license has been selected.
