# Agent instructions for CSDKTD APP

## Product and current status

CSDKTD APP is a **browser-first static educational application** for SISO LTI control theory. Continuous and Discrete each contain Representation, Plots, Stability, Performance and Controller Design. The 56 module folders are scaffolds; mathematical features are pending until implemented and verified individually.

Use TypeScript/HTML/CSS and Vite without adding a UI framework. All exercise computation runs in the browser. There are no accounts, persistence, saved projects, export workflow, application API server, database or API keys. Do not add a service worker/PWA/offline guarantee in this release. C/WebAssembly is an optional future math implementation detail; web interfaces use browser/TypeScript types rather than Raven or C UI types.

## Read before editing

1. Read the assigned module's `src/modules/<id>/TASK.md`, `index.ts` and `workspace.ts`.
2. Read `docs/CONTRIBUTING.md`, `docs/DEVELOPMENT.md` and the matching atlas entry.
3. Check the current working tree and existing shared helpers. Course slides remain outside Git; audits distinguish inspected examples from proposed fixtures. Preserve those distinctions.

## Ownership and isolation

- A normal module assignment owns only `src/modules/<id>/**`, including its local tests/styles/helpers. Do not import from a sibling module or alter another module's files.
- Do not change the shell, routing, catalogue, shared types, global configuration, package dependencies, deployment configuration or shared math without explicit coordination with their owner. Describe the required API/dependency and why it is needed; continue independent module work while coordination happens.
- `index.ts` exports an immutable `manifest` with ID/title/description/domain/category/defaultExample and `load: () => import('./workspace')`. Keep algorithms and UI work out of this eagerly loaded metadata file.
- `workspace.ts` exports a synchronous `mount({ container, signal })` returning `void` or a cleanup function. Initialize all mutable exercise state inside `mount`. A visit/reset starts from the baseline; no mutable state travels between tools.
- The shell aborts the signal and runs cleanup before leaving/resetting; it rejects stale lazy imports. Use the signal for event listeners and asynchronous work. Cleanup timers, animation frames, observers, workers, subscriptions and third-party instances. Ignore late results after abort.
- Scope styles with CSS modules or selectors beneath this tool's `[data-module="ID"]` root. Never introduce unscoped element/global styles from a module.
- Shared helpers belong in coordinated, stateless `src/shared/math/` or other explicitly assigned shared locations. Inputs/results/workspaces are caller-owned. A general instruction to "implement all modules" is not a safe parallel ownership assignment.

## Mathematics and student interface

Implement the assigned exercise contract with explicit, tested limits. Declare coefficient order, dimensions, units, feedback sign, timing, tolerances and assumptions. Validate finite inputs, polynomial/matrix sizes and bounded computation. Report singularities, unsupported forms, nonconvergence and insufficient horizons clearly. Never substitute a canned result, an LLM/API call or a fake CAS for computation. Distinguish exact identities, numerical approximations and sampled illustrations; a sweep is not a proof of a complete parameter region.

Use readable labels, units and equations. Provide numeric/keyboard alternatives to dragging, accessible controls and useful input errors. Avoid slogans, decorative filler and claims broader than the implemented mathematics. Keep every tool within the course's SISO LTI scope.

## Validation and delivery

Use Vitest `*.test.ts` files inside the owned module for meaningful mathematical tests: the declared baseline, an independently derived expected result, changed data and relevant edge/failure cases. Tests should check the mathematics rather than repeat the algorithm. Verify the module in a real browser, including edit/reset, leave/reopen, fast navigation, keyboard use and a narrow viewport. There is no dedicated end-to-end test command yet; do not invent one.

Run `npm run check`, relevant Vitest tests, `npm test` and `npm run build` as appropriate to the change. Report exact commands/results and any unresolved limitations. Do not deploy, introduce servers/keys, or change dependencies without coordinated scope. Preserve unrelated edits, research evidence and course assets. Do not commit generated `dist/`, `node_modules/` or local build artefacts.
