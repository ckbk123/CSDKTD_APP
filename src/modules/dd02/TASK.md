# DD02 — Design lead and lag directly in the z plane

**Status:** accepted educational concept; the current browser workspace is a scaffold. This brief specifies future implementation, not a delivered solver. **Ownership:** `src/modules/dd02/**` only. **Course block:** Discrete / Controller Design.

The [canonical atlas entry](../../../docs/EXERCISE_TOOL_ATLAS.md#dd02), [course architecture](../../../docs/FUNCTIONAL_SPECIFICATION.md), [contribution guide](../../../docs/CONTRIBUTING.md) and [development guide](../../../docs/DEVELOPMENT.md) provide context. The original slides/worksheets remain outside Git. Source anchors and proposed-fixture labels below must remain distinguishable.

## Copy-and-paste implementation assignment

Copy the following assignment into an agent working from this repository. It contains this module's exercise contract so the goal survives changes to navigation or agent history.

```text
Implement DD02 — Design lead and lag directly in the z plane for the CSDKTD APP browser application.

Own only src/modules/dd02/**. Read AGENTS.md and this folder's TASK.md, index.ts and workspace.ts, plus docs/CONTRIBUTING.md and docs/DEVELOPMENT.md. Preserve unrelated edits. Do not edit another module, the shell/routing/catalogue, shared types, package dependencies, deployment or global configuration without coordination with the integration owner.

Default example metadata to initialize on each visit/reset:
G(s) = 50/(s(s+5)); ZOH T = 0.1 s; target zeta = 0.707, wn = 10 rad/s

This description is the starting fixture, not proof that a calculation is correct. Verify its topology, units, initialization and expected outputs against the mathematical checks and source evidence below. Where the source leaves an answer/topology unverified, make that uncertainty explicit before freezing an expected result.

Exercise, interaction and verification contract:
**Exercise:** separate lead and lag submodes: map transient targets, solve angle/magnitude conditions, or meet a defined velocity constant. **Evidence:** Ch9:11–27, especially14 and22; S14 broader source.

**Tool:** target pair `exp(sT)`, angle vectors, gain residual, complete locus and a magnified neighborhood of `z=1` for lag placement. Preserve the original hold/plant model.

**Check/variation:** source lead inputs are `50/[s(s+5)]`, `T=.1`, `ζ=.707,ωn=10`; source lag uses the same plant/T and target `Kv*=100`. Verify source normalization/topology before freezing a numeric answer. Lag placement near `+1`, not automatically near the continuous origin, is a key concept.

Implementation requirements:
1. Deliver the student exercise and visual reasoning described above: editable data, an attempt/prediction where appropriate, intermediate steps, a revealable checked result and a changed-data experiment. Keep the visible flow readable and concrete. The tool lives inside its existing page, with no separate window.
2. Define the supported mathematical domain and resource bounds. State relevant coefficient order, matrix/state convention, units, sample period, feedback sign, initial conditions, tolerance and approximation assumptions. Validate empty/nonfinite/malformed data, singularities, excessive order/work, unsupported forms and nonconvergence. Show useful feedback rather than NaN, an infinite loop or a plausible-looking wrong answer.
3. Compute answers from the input. Keep exact identities, numerical approximations, heuristics and sampled demonstrations clearly labeled. Do not fake a CAS, return only a canned baseline answer, use an LLM/API as a solver, or claim generality beyond tested support. Preserve the course's SISO LTI scope and the source/proposed-fixture distinctions.
4. Keep index.ts metadata-only, exporting the existing immutable manifest and load: () => import('./workspace'). workspace.ts exports synchronous mount({ container, signal }) returning void or cleanup. Initialize all mutable state within that mount. Reset/reopen must start from the baseline; no persistence or cross-module model transfer.
5. Keep private math/types/tests/styles in this folder. Do not import sibling modules or introduce shared mutable state. Request a coordinated stateless helper/API under src/shared/math/ when reuse is justified; the integration owner owns upstream package/global changes. C/WebAssembly is optional future math infrastructure, not a requirement or a browser UI type.
6. Use the AbortSignal for event listeners/async work; cleanup timers, animation frames, observers, workers, subscriptions and chart instances. Guard late results after abort. The shell aborts and cleans before leaving/resetting and rejects stale lazy imports. Do not override shell navigation or lifecycle.
7. Scope CSS with CSS modules or beneath [data-module="DD02"]. Provide clear labels, equations, axis units, keyboard/numeric alternatives to dragging and readable layouts on narrow screens. Avoid slogans, filler and algorithm implementation jargon in student flows.
8. Add meaningful local Vitest *.test.ts coverage: the baseline with independently derived expected results/residuals, changed coefficients/parameters and relevant boundary/failure cases from the contract. Test equivalence/invariants when a representation is nonunique and use justified scale-aware tolerances. A calculation tested against itself is not independent verification.
9. Run the relevant tests, npm run check, npm test and npm run build. Inspect this tool in a real browser: edit controls, validate outputs, reset, leave/reopen, navigate rapidly during loading, use the keyboard and inspect a narrow viewport. Confirm old work cannot update the next page. There is no dedicated end-to-end command yet; report actual browser checks.
10. Do not add accounts, saving, persistence, export, a service worker, API keys, runtime servers or deployment steps. Report what students can now do, supported limits, changed files, exact validation results and unresolved shared-helper/dependency requests. Do not deploy or commit generated output.

Acceptance: this one module's exercise and mathematical checks work for its declared supported inputs; baseline/reset/lifecycle isolation holds; tests and production integration pass; any remaining limits are explicit. A populated scaffold or attractive plot alone is not completion.
```

## Coordination notes

Keep the canonical exercise contract synchronized with the atlas if the instructor changes the goal. Shared helper work needs a separately assigned owner and API before multiple modules consume it. Mathematical verification should be independent of display code; baseline text must not be used as a substitute for a test oracle.
