# Contributing an educational module

Implement one clearly assigned tool at a time. The [task index](AGENT_TASKS.md) links all 56 durable briefs. Each brief copies its exercise, evidence, intended interaction, verification requirements and default-example metadata. A scaffold's existence is not evidence that its mathematics works.

## Before implementation

1. Read the assigned `TASK.md`, `index.ts`, `workspace.ts`, [atlas](EXERCISE_TOOL_ATLAS.md), [functional specification](FUNCTIONAL_SPECIFICATION.md) and [development guide](DEVELOPMENT.md).
2. Confirm ownership is `src/modules/<id>/**`. Inspect existing helpers and unrelated edits. Keep the stable ID/domain/category.
3. Turn the brief into explicit supported inputs and limits. Resolve ambiguous topology, notation or source rounding from the audits before declaring a numeric answer authoritative.
4. Tell the integration owner about required shared math, charting or package changes. Specify inputs, outputs, conventions, failure statuses and tests. The owner assigns those dependencies; module agents do not independently edit global packages/configuration.

## What belongs in a module

Keep `index.ts` small: immutable manifest metadata and `load: () => import('./workspace')`. Put controls, local types, private pure math and tests in the module directory. Export synchronous `mount({ container, signal })` from `workspace.ts`; initialize the baseline and all mutable exercise state during mount. Return cleanup where resources need release.

Use the supplied signal for listeners/async work and stop timers, animation frames, workers and subscriptions during cleanup. An aborted or closed module cannot update the active page. Reset and reopen must reproduce the baseline without relying on previous visits. Never import a sibling module or create shared mutable exercise state. Coordinated shared helpers are stateless services, not another module's implementation.

Scope styles with CSS modules or the module's `[data-module="ID"]` root. Build within the existing page; a tool does not open its own window or replace shell navigation.

## Mathematical quality

- Declare coefficient order, units, dimensions, sample period, transform convention, feedback sign, initial conditions and rounding/tolerance where relevant.
- Separate exact algebra, numerical approximation, an asymptotic formula and a sampled illustration. State the implemented factoring/expression domain; do not present canned strings as a general symbolic solver.
- Validate nonfinite/empty inputs, supported size/order, singular systems and computation limits. Give useful feedback for unsupported cases or nonconvergence.
- Preserve original and reduced models where cancellation affects internal stability. Check all roots/modes in stability/design; one selected branch or target pair is insufficient.
- Treat interval endpoints, contour poles, repeated/boundary roots and insufficient simulation horizons explicitly. Numeric sweeps do not prove complete symbolic parameter regions.
- Keep the tool within SISO LTI scope. Multiple states remain SISO; hardware/nonlinear/MIMO features need a separate scope decision.

## Student-facing quality

Show the exercise data, assumptions, action, intermediate reasoning and result in a readable order. Provide meaningful numeric controls and units alongside sliders/dragging. Label axes, signs and tolerances. Make keyboard use and narrow screens practical. Feedback should explain the concrete mathematical issue; avoid slogans, filler and implementation jargon.

Use the [shared visual equation input and display](EQUATION_INPUT.md) for mathematical expressions. Students edit textbook-style fractions and powers directly; do not require MATLAB syntax or LaTeX knowledge. `createEquationInput` reports an editing draft, not a validated mathematical model: add a bounded, tested domain parser before computation. Keep the draft and parsed model inside `mount`, supply its abort signal and release the input during cleanup. The shell's **Edit equations** banner is a preview only; its edits do not drive the workspace. Use `createEquationDisplay` for mathematical results and intermediate steps.

Baseline, changed-data experiments, answer reveal and comparisons are temporary visit state. There are no accounts, persistence, saved projects, student export, remote solver calls or service worker in this release.

## Validation and handoff

Write meaningful Vitest `*.test.ts` files inside the module. Include the brief's baseline and independent expected answer, changed data, and relevant edge/failure cases. Compare residuals or invariants when representations are nonunique; do not require one matrix string or one root ordering. Document tolerances and any external reference provenance.

Run the relevant tests, then:

```sh
npm run check
npm test
npm run build
```

Exercise the module in a real browser using the available browser tools/manual inspection. Check editing, reset, leave/reopen, rapid navigation, keyboard controls, cleanup and a narrow viewport. There is no dedicated end-to-end command yet. Include exact checks/results in the handoff and keep unresolved limits visible.

For visual equations, also check the actual fonts, fraction/power buttons and math keyboard. MathLive's Node export is a server renderer; successful jsdom tests with a mock do not establish interactive browser behavior. See the [equation verification checklist](EQUATION_INPUT.md#browser-verification).

A useful handoff states what students can now do, the supported mathematical domain, files changed, validation results, remaining limits and any shared API requests. Do not deploy, add API keys/servers, change dependencies/global configuration or modify another module without coordination. Do not commit generated output. Retain the course evidence and asset provenance.
