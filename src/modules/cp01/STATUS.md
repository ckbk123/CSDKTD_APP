# CP01 implementation status

- **Stage:** in-progress (tested numerical/model core; analytic display and interactive workspace remain)
- **Last assessed:** 2026-10-29
- **Assessed code baseline:** fresh primary-main `f99cfebb65495d3f4385a61dd1d25800e341ea68` (v0.3.5)
- **Worker chat:** `01a186d1-f1f0-7393-88e7-377fbac7299a`, host local.
- **Branch/worktree:** `codex/cp01-time-response-7393`; `C:\Users\baokh\.codex\worktrees\cp01-time-response-7393\CSDKTD APP`.
- **PR:** not created yet. DS01 PR #10 was accepted as v0.3.6. CF02 PR #18 is corrected/resubmitted at `c7ab0f85a0dcb2eb074fe87826b6116145d214bd`; its worktree/history remain preserved for asynchronous review. Further correction requests take priority.
- **Goal and acceptance contract:** [TASK.md](TASK.md)
- **Stage definitions and evidence rules:** [Project status](../../../docs/PROJECT_STATUS.md)

## Implemented and inspected

- `index.ts` defines the module metadata, default example and lazy workspace loader.
- `workspace.ts` exports the synchronous mount contract and deliberately adds no controls or calculations.
- The shared shell displays and edits a baseline-equation preview. It is not this module's solver or working input model.

## Remaining acceptance work

- [ ] Working exercise inputs, declared supported domain and mathematical validation.
- [ ] Input-dependent computation and the full mathematical checks in TASK.md.
- [ ] Intuitive visualization, intermediate reasoning and the required student interactions.
- [ ] Independently checked baseline, changed-data and boundary/failure tests.
- [ ] Real-browser editing, reset, reopen, keyboard, narrow-screen and cleanup checks.

## Evidence and next action

Source inspection found the blank mount and no module-owned mathematical tests at the assessed baseline. No module solver, plots or exercise browser behavior are claimed verified; shared-shell tests do not establish these.

Start with [START_HERE.md](../../../docs/START_HERE.md), then compare TASK.md with current source and rerun relevant checks. Replace the generic remaining list with a requirement-to-evidence assessment as implementation progresses. Record supported limits, exact check results and unresolved dependencies here; do not silently reduce the accepted goal.

## Requirement audit — 29 October 2026

The fresh primary baseline still has the blank synchronous mount, correct lazy metadata and no local algorithms/tests. No existing working module behavior will be replaced.

| Accepted requirement | Current evidence | Remaining work |
|---|---|---|
| Predict/sketch step, ramp, impulse interpretation or free response | Absent | Bounded input-dependent model solver, shape/amplitude controls, optional prediction and checked reveal |
| Input/output/initial-condition controls | Absent | Explicit scalar input and state convention; preserve the same initial state when changing representation |
| Free/forced overlays | Absent | Separately compute zero-input, zero-state and total responses; show all three with units and a superposition check |
| Analytic terms | Absent | Derive transformed input and initial-condition terms, then computed response/modal terms; distinguish exact identities from rounded coefficients |
| Time cursor | Absent | Synchronized plot and numeric cursor with keyboard access; report one-sided values at jumps |
| Impulse and pulse interpretation | Absent | Show ideal impulse area and any distributional direct term; finite rectangular pulse must show width, height and area; never draw a delta as an ordinary finite peak |
| Baseline and changed data | Absent | Independent residues, y(1)≈0.1997882004; changed poles/gains and nonzero initial conditions |
| Integrators/direct feedthrough/differentiation | Absent | Do not assert settlement for integrators; label direct jumps and impulse distributions; clearly reject unsupported improper forms |
| Mathematical/resource errors | Absent | Bounded order/coefficients and trace work, finite inputs, native underflow, near/repeated roots, horizon/truncation feedback |
| Visual entry and lifecycle | Scaffold only | Shared visual inputs/results, local drafts/parser, abort-safe deferred loading and cleanup, reset/reopen isolation |
| Independent project/browser evidence | Absent | Local mathematical fixtures, check/test/build, reserved actual editor/buttons/fonts/keyboard/navigation/mobile checks |

## Bounded direction to derive and test

A proper real first/second-order rational family with an explicit optional direct term and a declared phase-variable realization can cover the full teaching exercise. It must cover distinct/repeated real modes, oscillatory modes, integrators and a bounded unstable example rather than only the baseline. Exact coefficient/work bounds and analytic formulas will be frozen after derivation and fixtures. The transfer and state presentations must describe the same realization and initial state; changing a presentation must not reset or reinterpret it.

Native numbers will use current `readNumericInput`. Expressions and results use shared equation components and a bounded local parser. Preserve actual MathLive compact fraction and power serialization, mixed-number/hidden-grouping semantics and scalar style wrappers. No sibling imports, package changes or shared API are currently needed.

The ideal impulse interpretation, any direct distributional term and finite pulse approximation must stay distinct. Plots need separate input/output scales where pulse height would obscure the response, readable free/forced/sum overlays, and a keyboard-accessible time cursor. Analytic terms must be computed from the input, not replaced by only a generic convolution formula or a canned baseline.

## Independent fixtures to establish

These are derived test plans, not completed tests or new slide transcriptions:

- Baseline step Y=1/[s(s+1)(s+2)] has residues 1/2, −1, 1/2: y(t)=1/2−exp(−t)+(1/2)exp(−2t), y(1)=0.199788200446864. Its impulse response is exp(−t)−exp(−2t).
- For y''+3y'+2y=u with y(0)=1, y'(0)=0, free response is 2exp(−t)−exp(−2t), and the unit-step total is 1/2+exp(−t)−(1/2)exp(−2t). This is a **proposed verification fixture** in continuous audit R2.
- For 1/(s+1), unit step gives 1−exp(−t), and unit ramp gives t−1+exp(−t).
- For 1/s and 1/s², unit steps give t and t²/2; finite plots do not imply settlement. Repeated poles and damped/undamped oscillators need separate analytic oracles.
- A direct term d0 contributes d0*u(t) to ordinary inputs and area d0*A delta for an ideal impulse of area A. A rectangular approximation has height A/width and area A; its dynamic response must approach the proper impulse response away from endpoints as width shrinks.

## Setup checkpoint and provenance

Read current primary AGENTS, START_HERE, AUTONOMOUS_WORKERS, COORDINATION, PROJECT_STATUS, CONTRIBUTING, DEVELOPMENT, DESIGN and EQUATION_INPUT; CP01 TASK/index/workspace/STATUS, the matching atlas and continuous audit R2/P1 sections. Original decks have not been newly inspected. Course anchors remain Ch3, S05:3–11 and S02/S04, with proposed-fixture labels preserved.

The atomic claim records this fresh primary baseline, unique branch and isolated worktree. Locked dependencies installed locally under bundled Node v24.22.1 (109 packages, zero vulnerabilities); `npm run check` passes. No module mathematics or browser functionality is claimed by this foundation check. No preview or QA resource is held; the coordinator released the temporary DS01 order, so normal future QA acquisition may resume while respecting any current holder.

Only this audit is delivered at the setup checkpoint. Full solver/UI implementation, mathematical/project/browser verification and PR submission remain required. Prior submitted worktrees/claims remain intact for review.

## Prototype checkpoint / priority review return

Added private bounded rational arithmetic and a degree-at-most-two visual polynomial parser prototype. No response engine or workspace UI is implemented, and no parser/math tests have been run yet. The scalar helper is copied locally from the prior owned CF02 contribution; there are no sibling imports or shared edits. This is not implemented CP01 mathematics.

The coordinator reopened CF02 PR #18 for a confirmed lexical mixed-number bypass (`s2` followed by 1/2). CP01's new prototype uses the same accumulated-constant guard and must receive the corrected lexical rule and regression coverage when resumed. Preserve this checkpoint/reservation, suspend CP01 implementation and repair CF02 in its preserved worktree/PR first. The current browser order is DP03→DP04→coordinator DP02; do not acquire another QA slot until its release notice. No CP01 preview/QA resource is held.

The proposed general proper order-1/2 realization, response basis and pulse handling are preserved in IMPLEMENTATION_NOTES.md. Full accepted TASK and this requirement audit remain the contract; no scope has been dropped.

## Resumed mathematical-core checkpoint

CF02's priority correction passed focused actual-editor checks and final-head CI, then was resubmitted on the same PR before resuming CP01. The CP01 parser now uses the corrected lexical-factor rule, preserves fractions after supported powers, and rejects ambiguous bare multi-character/signed exponent syntax with power-box guidance. Pinned MathLive MathML independently checks the mixed-number and exponent distinctions. Current primary guidance also requires a synchronous owned loading node for deferred views; the upcoming workspace must follow it.

Implemented locally:

- `parser.ts` / `rational.ts`: exact bounded polynomial/scalar arithmetic, visible grouping, degree 0–2 powers, true fraction-argument scope, numeric style wrappers, mixed-number/joined-digit rejection, finite coefficient limits and nonzero-underflow feedback. Ordinary finite rational conversion uses direct number ratios; very large finite ratios retain the bounded leading-digit fallback.
- `model.ts`: proper real order-1/2 models; exact leading-scale normalization and biproper long division; retained phase-variable realization; direct-path extraction; exact discriminant and denominator-mode categories; initial-state coordinate mapping; Laplace initial-condition numerator. Negative leading scales are normalized correctly rather than changing the transfer gain.
- `response.ts`: separate zero-input/zero-state/total trajectories, step/ramp/free/ideal-impulse/finite-pulse modes, ideal input/output impulse **areas** separate from regular curves, one-sided endpoint values, a cursor evaluator independent of plot interpolation, and bounded numerical trace propagation. Pulse propagation hits its end exactly, preserves continuous dynamic states across the direct jump, and propagates the postpulse state rather than subtracting two large step states.

Supported core limits now tested: normalized |a0|≤100, |a1|≤20 (quadratic coefficient), strict-remainder |b0|/|b1|≤50, parallel/effective direct gain magnitudes≤10, normalized coefficient rational denominators≤10^9; first/second denominator order, proper numerator only. Initial phase states and amplitude/area are −10–10. Pulse width .001–10 s; horizon .1–60 s. The realization is w'+a0*w=u or w''+a1*w'+a0*w=u, y=b0*w+b1*w'+d*u. These phase states are not silently reinterpreted as external output initial derivatives.

The numerical engine uses at most four augmented states, a scaling/Taylor transition bounded to 24 scalings / 32 terms, 600–20,000 base intervals plus pulse/event points (at most 20,024 plotted points), finite caches capped at 128 transitions each and a 10^10 state/component cap. It reports truncation, sample-budget limits and a horizon ending before the pulse ends. Exact arithmetic decides model identities; trajectories are floating-point approximations.

Checks under bundled Node v24.22.1:

- `node node_modules/vitest/vitest.mjs run src/modules/cp01`: **134 tests pass** (86 grammar, 21 model, 22 response/transition, 5 rational).
- `npm run check`: passes.
- Preliminary `npm test`: **478 tests / 21 files pass**.
- Preliminary `npm run build`: passes, including type check; existing MathLive large-chunk advisory only. Since the workspace is still blank, this is project compatibility evidence, **not** CP01 browser/UI certification.

Independent response oracles include the baseline inverse Laplace step/ramp/impulse and y(1); changed poles/gain; nonzero initial-state superposition; first-order direct jumps and output delta area; linear and biproper numerators; repeated real and underdamped/undamped modes; first/double integrators; a retained cancelled mode; growing-response truncation; finite pulse formulas/one-sided endpoints and convergence to the proper impulse response; known diagonal/rotation/nilpotent matrix exponentials. Centered-coordinate outputs are checked against the independent free-response formula, not only against another implementation path.

**Remaining accepted work:** computed analytic/modal terms and their tests, the full shared-equation workspace, prediction/reveal, input/output/free/forced plots, representation views and preserved initial-state controls, numeric/keyboard time cursor, student-visible domain/errors/impulse interpretation, lifecycle/UI tests, final full checks and actual-browser QA, then the module's PR/exact submission. No working CP01 interface or browser result is claimed. The current temporary QA order is coordinator DD04→CP03→DR01→DP03 before ordinary acquisition; no CP01 preview/reservation is held.
