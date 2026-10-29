# CP01 implementation status

- **Stage:** in-progress (full bounded workspace implemented; actual-browser verification and submission remain)
- **Last assessed:** 2026-10-29
- **Base:** primary-main `f99cfebb65495d3f4385a61dd1d25800e341ea68` (v0.3.5), retained without merge/rebase.
- **Worker:** chat `01a186d1-f1f0-7393-88e7-377fbac7299a`, local.
- **Branch/worktree:** `codex/cp01-time-response-7393`; `C:/Users/baokh/.codex/worktrees/cp01-time-response-7393/CSDKTD APP`.
- **PR:** not yet created. Prior DS01 PR #10 accepted v0.3.6; CF02 PR #18 corrected/resubmitted at `c7ab0f85a0dcb2eb074fe87826b6116145d214bd`, preserved for asynchronous review.
- **Contract:** [TASK.md](TASK.md); [stage definitions](../../../docs/PROJECT_STATUS.md).

## Scope and source provenance

The claimed baseline had a blank synchronous workspace and no local mathematics/tests. The shell's editable example is a notation preview, not a solver input channel. `index.ts` remains metadata-only. All implementation changes are confined to this module.

Read current primary AGENTS, START_HERE, AUTONOMOUS_WORKERS, COORDINATION, PROJECT_STATUS, CONTRIBUTING, DEVELOPMENT, DESIGN and EQUATION_INPUT, the matching atlas and continuous audit R2/P1. Original decks have **not** been newly inspected. Source anchors remain Ch3 time-response, S05:3–11 and S02/S04 initial-condition exercises. The baseline inverse-Laplace oracle is independently derived; nonzero-initial-state fixture below remains a **proposed verification fixture** in audit R2, not a newly transcribed slide example.

## Requirement-to-evidence assessment

| Accepted requirement | Implemented evidence | Remaining verification |
|---|---|---|
| Predict step/ramp/impulse/free response | Editable proper real order-1/2 N/D plus parallel direct path; five source shapes; optional checked numerical prediction before reveal; eleven computed experiment presets | Actual controls/editor and changed-data browser checks |
| Input/output/initial-condition controls | `model.ts` normalizes full coefficients and extracts biproper direct gain; explicit phase state convention and units; numerator controls the output map | Actual browser editing |
| Preserve initial conditions across representations | Exact phase/centered mapping, displayed realization and initial vector; coordinate change leaves inputs/results/paths intact | Actual coordinate switch |
| Free/forced/total overlays | Separate zero-input and zero-state trajectories and states, superposition residual, distinct line patterns; input has separate scale | Desktop/narrow visual inspection |
| Analytic terms | `analytic.ts` computes exact rational polynomial and real exponential/trigonometric terms for distinct/repeated/oscillatory/integrator modes; initial-condition and input transforms displayed | Typeset readability/font check |
| Time cursor | Direct matrix-transition evaluation with numeric field, keyboard range and side selector; no interpolation across jumps | Keyboard and jump controls in browser |
| Impulse and finite pulse | Signed ideal input/output delta **areas**, regular output curve separately; pulse width/height/area and delayed full-step identity; exact one-sided pulse endpoint | Area symbol and finite pulse browser checks |
| Integrator/direct/differentiation caveats | Exact retained-mode category; stable asymptotic polynomial and endpoint horizon heuristic; no general settlement claim for integrators/oscillators/unstable modes; improper transfer rejected | Actual error paths |
| Bounded mathematical errors | Exact grammar/coefficient checks, native nonzero-underflow rejection, finite state-transition/trace caps, truncation/sample-budget/pulse-horizon feedback | Actual editor/native errors |
| Visit/lifecycle isolation | Synchronous owned loading node, child abort signal, late-load guard, partial-failure resource abort, explicit editor cleanup; old result listeners aborted when inputs change/recompute | Actual reset/reopen/rapid navigation |
| Independent project/browser evidence | 186 module tests; all 530 local application tests; type/build pass | Browser reservation, actual QA, PR, exact clean submission |

## Supported model and timing

Continuous real SISO LTI, no feedback loop or sample period assumed. Proper numerator degree at most denominator degree, denominator order 1–2. Visible coefficients use descending powers; polynomial arrays are internal ascending powers. Leading denominator coefficient can be any supported nonzero sign and is normalized exactly. A biproper numerator is divided into a strict remainder plus direct term. The full phase realization is retained through pole cancellations.

- Order 1: w′ + a0 w = u; x=[w], y=b0 w+d u.
- Order 2: w″+a1 w′+a0 w=u; x=[w,w′], y=b0 w+b1 w′+d u.
- Initial phase state x(0−) is caller-owned and **not** silently reinterpreted as external y/y′. Centered z=[w,w′+αw], α=a1/2, preserves the same physical state.
- Time is seconds; signals use normalized units. w has input-units·s^m for denominator order m, and w′ has input-units·s^(m−1). Step A has input units; ramp A has input-units/s; impulse/pulse A is signed input-units·s area.
- Causal step/ramp begin at 0. Ideal impulse jumps the last forced phase state by A at 0+, with direct output area d A δ(t); it has no finite pointwise peak. Pulse height A/W acts on [0,W). Cursor left/right refers to ordinary limits at 0/W; the ideal delta remains separate.
- Improper transfers/ideal differentiation are rejected with distribution-aware feedback, rather than plotted as finite peaks.

Bounds: expression 400 characters, 160 primaries, nesting 12; polynomial degree≤2, intermediate coefficient magnitude≤10^9. Exact reduced fractions at most 4096 bits. Visual decimal/group/product/numeric-fraction/power-0–2 grammar is independently bounded; ambiguous mixed numbers, joined digits, hidden braces, e/E literals and bare multi-character/signed powers are rejected with guidance. True MathLive compact fraction arguments and atomic numeric style wrappers preserve their meaning.

Normalized |a0|≤100, |a1|≤20 (quadratic linear coefficient), strict-remainder |b_i|≤50, parallel/effective |d|≤10; normalized rational coefficient denominators≤10^9. Phase ICs and amplitude/area −10–10. Pulse width .001–10 s; horizon .1–60 s. Native controls use shared `readNumericInput`, including intentional zero versus nonzero underflow.

The numerical engine has at most four augmented states, 24 scalings / 32 Taylor terms, 600–20,000 base intervals plus pulse/event points (at most 20,024), caches capped at 128 transitions each and a 10^10 state/component cap. It reports truncation, a reached sampling budget and pulse end outside the horizon. These are floating-point traces, not exact curves or stability proofs. Analytic identities remain exact rational/radical terms; no rounded root decides an identity. Near/repeated roots use a regular real basis. Pulse propagation advances the postpulse state rather than subtracting large nearly equal step states.

For a strictly stable retained denominator, the computed nondecaying polynomial is shown; a nonzero slope means no finite final value. Endpoint agreement uses a declared 1% normalized-scale horizon heuristic and is explicitly not a settling-time certificate. Other retained-mode categories receive no blanket settling claim, since input/output/initial-state cancellations can remove a particular mode.

## Mathematical and lifecycle verification

Independent closed-form oracles include:

- Baseline step: 1/2−e^(−t)+(1/2)e^(−2t), y(1)=0.199788200446864; impulse e^(−t)−e^(−2t); ramp t/2−3/4+e^(−t)−e^(−2t)/4.
- Proposed R2 fixture x(0)=[1,0]: free 2e^(−t)−e^(−2t), unit-step total 1/2+e^(−t)−e^(−2t)/2.
- Changed gain/poles 2/[(s+1)(s+3)], linear numerator s+4, biproper numerator 2s²+7s+6 retaining the original phase state, repeated pole (s+1)², damped/undamped oscillators, first/double integrators and unstable 1/(s−1).
- Exact IC coordinate/output equivalence, initial Laplace numerator, direct ordinary jumps and output delta area, finite-pulse endpoint continuity/jump and convergence away from 0, plus diagonal/rotation/nilpotent matrix-exponential oracles.
- Pinned MathLive SSR MathML independently confirms mixed-number invisible-plus semantics and one-token exponent scope. This is parser semantic evidence, **not** real-browser editor certification.

Module tests (186): 86 parser, 21 model, 22 response/transition, 5 rational, 30 analytic, 18 workspace-flow, 4 deferred-lifecycle. Workspace-flow uses explicit mock equation fields only for caller draft/ownership behavior; no actual MathLive functionality is inferred. Partial mount failure test registers a child-signal window resource then throws while parent remains active, and confirms immediate abort/recovery. Result replacement and visit cleanup tests prevent old listeners updating new results.

Checks under bundled Node v24.22.1 at this workspace checkpoint:

- `node node_modules/vitest/vitest.mjs run src/modules/cp01`: **186 tests / 7 files pass**.
- `npm run check`: passes.
- `npm test`: **530 tests / 24 files pass**.
- `npm run build`: passes, 152 modules transformed; existing MathLive large-chunk advisory only.
- `git diff --check`: passes.

## Checkpoints and remaining work

Setup `449c98d` recorded the full audit and private claim/worktree. Parser prototype `422b053` was preserved before prioritizing CF02's returned correction. Mathematical-core checkpoint `21eac440af88ff072c08589fef21e8d3ba7eb037` passed 134 local module tests / 478 full tests, before the UI existed. CF02 correction completed and resubmitted before CP01 resumed.

Current code supplies the full bounded exercise; **browser acceptance is still pending**. No CP01 browser tab, preview server, IAB reservation or native focus is held. Latest queue has another owner's CD08 IAB QA; native Firefox is separately coordinated for DF04. Honor active holders/named order; preserve primary8787. After a genuine isolated reserved browser session, record actual checks/screenshots, fix any issues, rerun relevant final checks, create/attach the single PR, push clean final HEAD and submit the exact tested claim. Stage must remain in-progress until this work is done.
