# CP01 — Construct a time response

**Status:** accepted educational concept; the current browser workspace is a scaffold. This brief specifies future implementation, not a delivered solver. **Ownership:** `src/modules/cp01/**` only. **Course block:** Continuous / Plots.

The [canonical atlas entry](../../../docs/EXERCISE_TOOL_ATLAS.md#cp01), [course architecture](../../../docs/FUNCTIONAL_SPECIFICATION.md), [contribution guide](../../../docs/CONTRIBUTING.md) and [development guide](../../../docs/DEVELOPMENT.md) provide context. The original slides/worksheets remain outside Git. Source anchors and proposed-fixture labels below must remain distinguishable.

## Copy-and-paste implementation assignment

Copy the following assignment into an agent working from this repository. It contains this module's exercise contract so the goal survives changes to navigation or agent history.

```text
Implement CP01 — Construct a time response for the CSDKTD APP browser application.

Own only src/modules/cp01/**. Read AGENTS.md and this folder's TASK.md, index.ts and workspace.ts, plus docs/CONTRIBUTING.md and docs/DEVELOPMENT.md. Preserve unrelated edits. Do not edit another module, the shell/routing/catalogue, shared types, package dependencies, deployment or global configuration without coordination with the integration owner.

Default example metadata to initialize on each visit/reset:
G(s) = 1/((s+1)(s+2)); input: unit step; initial state: zero

This description is the starting fixture, not proof that a calculation is correct. Verify its topology, units, initialization and expected outputs against the mathematical checks and source evidence below. Where the source leaves an answer/topology unverified, make that uncertainty explicit before freezing an expected result.

Exercise, interaction and verification contract:
**Exercise:** sketch/predict a unit-step, ramp, impulse interpretation or free response, then compute it from a supported model. **Evidence:** Ch3 time-response sections; S05:3–11; S02/S04 initial-condition exercises.

**Tool:** input/output/initial-condition controls, free/forced overlays, analytic terms and a time cursor. For a pulse approximation to an impulse, show pulse width and area.

**Check/variation:** `G=1/[(s+1)(s+2)]` gives step `0.5-e^-t+0.5e^-2t`, hence `y(1)≈0.199788`. Preserve initial conditions across representations. Integrators may not settle; direct feedthrough/ideal differentiation may include impulses that cannot be shown as ordinary finite peaks without a declared approximation.

Implementation requirements:
1. Deliver the student exercise and visual reasoning described above: editable data, an attempt/prediction where appropriate, intermediate steps, a revealable checked result and a changed-data experiment. Keep the visible flow readable and concrete. The tool lives inside its existing page, with no separate window.
2. Define the supported mathematical domain and resource bounds. State relevant coefficient order, matrix/state convention, units, sample period, feedback sign, initial conditions, tolerance and approximation assumptions. Validate empty/nonfinite/malformed data, singularities, excessive order/work, unsupported forms and nonconvergence. Show useful feedback rather than NaN, an infinite loop or a plausible-looking wrong answer.
3. Compute answers from the input. Keep exact identities, numerical approximations, heuristics and sampled demonstrations clearly labeled. Do not fake a CAS, return only a canned baseline answer, use an LLM/API as a solver, or claim generality beyond tested support. Preserve the course's SISO LTI scope and the source/proposed-fixture distinctions.
4. Keep index.ts metadata-only, exporting the existing immutable manifest and load: () => import('./workspace'). workspace.ts exports synchronous mount({ container, signal }) returning void or cleanup. Initialize all mutable state within that mount. Reset/reopen must start from the baseline; no persistence or cross-module model transfer.
5. Keep private math/types/tests/styles in this folder. Do not import sibling modules or introduce shared mutable state. Request a coordinated stateless helper/API under src/shared/math/ when reuse is justified; the integration owner owns upstream package/global changes. C/WebAssembly is optional future math infrastructure, not a requirement or a browser UI type.
6. Use the AbortSignal for event listeners/async work; cleanup timers, animation frames, observers, workers, subscriptions and chart instances. Guard late results after abort. The shell aborts and cleans before leaving/resetting and rejects stale lazy imports. Do not override shell navigation or lifecycle.
7. Scope CSS with CSS modules or beneath [data-module="CP01"]. Provide clear labels, equations, axis units, keyboard/numeric alternatives to dragging and readable layouts on narrow screens. Avoid slogans, filler and algorithm implementation jargon in student flows.
8. Add meaningful local Vitest *.test.ts coverage: the baseline with independently derived expected results/residuals, changed coefficients/parameters and relevant boundary/failure cases from the contract. Test equivalence/invariants when a representation is nonunique and use justified scale-aware tolerances. A calculation tested against itself is not independent verification.
9. Run the relevant tests, npm run check, npm test and npm run build. Inspect this tool in a real browser: edit controls, validate outputs, reset, leave/reopen, navigate rapidly during loading, use the keyboard and inspect a narrow viewport. Confirm old work cannot update the next page. There is no dedicated end-to-end command yet; report actual browser checks.
10. Do not add accounts, saving, persistence, export, a service worker, API keys, runtime servers or deployment steps. Report what students can now do, supported limits, changed files, exact validation results and unresolved shared-helper/dependency requests. Do not deploy or commit generated output.

Acceptance: this one module's exercise and mathematical checks work for its declared supported inputs; baseline/reset/lifecycle isolation holds; tests and production integration pass; any remaining limits are explicit. A populated scaffold or attractive plot alone is not completion.
```

## Coordination notes

Keep the canonical exercise contract synchronized with the atlas if the instructor changes the goal. Shared helper work needs a separately assigned owner and API before multiple modules consume it. Mathematical verification should be independent of display code; baseline text must not be used as a substitute for a test oracle.
