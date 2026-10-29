# DS05 implementation status

- **Stage:** in-progress
- **Last assessed:** 2026-10-29
- **Assessed code baseline:** fresh primary-main `9d923d2f9a3728bdfd6516dd68aa06c93d9e7f86` (v0.3.9)
- **Worker:** chat `01a186d1-f1f0-7393-88e7-377fbac7299a`, local.
- **Branch/worktree:** `codex/ds05-discrete-nyquist-7393`; `C:/Users/baokh/.codex/worktrees/ds05-discrete-nyquist-7393/CSDKTD APP`.
- **PR:** none yet. Prior CP01 [PR #24](https://github.com/ckbk123/CSDKTD_APP/pull/24) is submitted at clean tested `87034c72b1e6b1505095d5d82c3171d7d1993cb4`; CF02 [PR #18](https://github.com/ckbk123/CSDKTD_APP/pull/18) is resubmitted at `c7ab0f85a0dcb2eb074fe87826b6116145d214bd`. Preserve both for asynchronous review; requested corrections take priority. DS01 PR #10 was accepted v0.3.6.
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

## Fresh claim and requirement audit — 29 October 2026

Current primary guides, PROJECT_STATUS, CONTRIBUTING, DEVELOPMENT, DESIGN, EQUATION_INPUT, TASK/index/workspace/STATUS, matching atlas, shared math README and relevant discrete/source-audit anchors have been inspected. The module still has a blank mount and no tests. No existing module behavior is being replaced. All source changes will stay in this folder. Original slides have not been newly inspected; the full discrete Nyquist contour tutor remains an **instructor-review extension**, rather than a claimed worked slide exercise. Ch8/E10 establish its broader frequency-analysis relevance.

| Accepted requirement | Existing behavior | Required implementation/evidence |
|---|---|---|
| Editable loop and prediction | Metadata only | Visual N(z), D(z), scalar gain, sample period; meaningful predicted winding/closed-loop root count before reveal |
| Unit-circle and mapped curve | Absent | This module's paired full unit-circle and complex loop-image plots, arrow orientation and a linked numeric/keyboard cursor |
| Explicit discrete contour convention | Absent | Derive the chosen counterclockwise unit-disk convention, relate inside and outside counts; never copy a continuous positive-frequency sign shortcut |
| Open-loop unstable poles | Absent | Count all retained open-loop denominator roots outside the unit disk; preserve cancellation effects on internal modes |
| Predicted versus actual closed-loop count | Absent | Derive the winding relation and independently classify the full characteristic polynomial; distinguish a sampled image from a certified count |
| Boundary/singular handling | Absent | Separate open-loop contour poles, closed-loop roots on the circle, direct-feedback degeneracy, numerical gap/conditioning limits and failed winding resolution |
| Baseline/changed examples | Unverified metadata | Independent baseline z=.3 and changed open-unstable/stabilized, closed-unstable, boundary, cancellation and quadratic fixtures |
| Input validation and limits | Absent | Bounded real rational family, finite/sample/gain/order checks, displayed-meaning parser and shared native reader |
| Teaching/lifecycle/accessibility | Scaffold only | Revealable intermediate equations/counts; immutable metadata, synchronous owned loading node, child-signal partial-failure cleanup, reset/reopen, keyboard and narrow browser checks |
| Delivery | Setup only | Mathematical/project tests, actual private production-browser evidence, single attached PR and exact clean tested submission |

## Mathematical direction to establish

A proper real first/second-order rational family is the proposed bounded domain. Final coefficient, period/gain and adaptive-work limits still need derivation/testing. Negative unity feedback gives Q(z)=D(z)+N(z) (or D+K N if K is a separate scalar). Retain the full denominator realization and characteristic polynomial through cancellations; reject a singular algebraic direct loop rather than silently dropping its degree.

Proposed contour: z=exp(jθ), θ from 0 to 2π counterclockwise around the unit **disk**. For F=1+L=Q/D, its counterclockwise winding W about zero (equivalently L about −1) satisfies W=Z_in−P_in when there is no zero/pole on the contour. With equal retained degree n, P_out=n−P_in and Z_out=n−Z_in give **Z_out=P_out−W**. This convention and its derivation must be visible. The mapped orientation can differ from the source-circle orientation; do not label every image counterclockwise.

A coarse polyline alone cannot certify W. Investigate an adaptive arc bound that keeps each image subarc in a convex disk excluding the critical point, then a guarded phase increment sum; explicitly report unresolved work/conditioning if its budget is reached. Exact polynomial root classification supplies an independent closed-loop check. Do not use the same root count to manufacture both the predicted winding and its supposed verification. Root/contour boundaries require their own exact checks before a generic winding computation.

Independent proposed fixtures (not yet tested or newly sourced from slides):

- Baseline L=(1/2)/(z−4/5), Q=z−3/10. P_in=1, P_out=0, W=0, Z_in=1, Z_out=0: strict closed-loop stability. θ=0 gives L=5/2; θ=π gives −5/18. The loop-image circle has center 10/9 and radius 25/18, hence does not enclose −1; it runs clockwise around its own center.
- Change denominator to z−6/5, keep N=1/2. Open-loop P_out=1 but Q=z−7/10 is stable; W=+1 is required by the declared disk convention. This catches the wrong sign/open-loop-count shortcut.
- Keep baseline D=z−4/5, set N=2. Q=z+6/5 gives one outside closed-loop pole and W=−1. N=9/5 instead gives Q=z+1, a strict-stability boundary rather than a certified winding away from −1.
- D=z−1 has a pole on the contour: no ordinary complete contour certificate. A sampled finite value near its singular point is not a pole-free curve.
- N=(1/2)(z−6/5), D=(z−6/5)(z−1/5): common unstable factor remains in Q=(z−6/5)(z+3/10). A reduced transfer plot can hide the retained internal unstable pole; full P_out=Z_out=1 and W=0.
- Add independently derived quadratic complex-pair, repeated and ±1 boundary cases; include nearly boundary coefficients, signed gain and a well-posed biproper case if supported.

## Setup checks and next action

Atomic claim and fresh managed worktree/unique branch record the exact primary baseline. Locked dependencies installed independently under bundled Node v24.22.1: 109 packages, zero vulnerabilities. `npm run check` passes. These are foundation checks only; no DS05 solver, curve, winding proof or browser behavior exists yet.

No preview, browser tab, QA waiter/reservation or native focus is held. The coordinator's explicit per-chat IAB isolation authorization is in force: verify this chat's session metadata and use only its own tabs/private preview before actual QA; restore its viewport and close its tabs afterward. Native Firefox page inspection is unavailable under the current guard and must not be retried.

Next: verify the contour/count derivation against a primary technical reference, freeze supported mathematical/work bounds, implement/test the bounded parser and exact retained root classification, and independently certify/diagnose the mapped winding. Then finish the full workspace and actual browser/delivery contract above. This setup checkpoint is not implementation success.

## Mathematical prototype checkpoint / priority CP01 review return

Added local rational/degree-two visual-parser helpers adapted from the prior owned CP01 code, with no sibling imports; exact rational linear/quadratic root accounting, retained model/negative-feedback characteristic polynomial and exact common-factor detection. `parser.test.ts` and `roots.test.ts` pass **92 tests** under bundled Node24. `npm run check` passes. The model currently supports proper real degree0–2 loops, normalized raw coefficient magnitudes≤20 and fraction denominators≤10^9, K∈[−10,10] with denominator≤10^9, T∈[.001,10]s, and rejects the singular direct loop 1+Kd=0.

`winding.ts` is a new **untested prototype**: normalize Q and D by positive coefficient 1-norms, bound each polynomial's variation over a half arc h by h·Σi|p_i| with a 10^-12 floating guard, and require both relative disks below1/8. Their quotient remains in a relative disk below2/7, excludingzero; this can justify endpoint-chord phase increments. Limits are32768 arcchecks/depth20, with explicit unresolved/boundary outcomes and a sampled fallback. This is a guarded numerical check, not interval-arithmetic certification; no winding result/UI/browser acceptance is claimed yet. Verify this derivation and implementation independently before building the workspace.

Primary mathematical reference read: [Berkeley complex-analysis argument-principle notes, lecture23](https://math.berkeley.edu/~avizeff/complex_analysis_S26/lecture_23.html), including multiplicity, poles and winding. The Caltech Feedback Systems search-index excerpt also states the CCW zero-minus-pole theorem; opening its PDF timed out, so no full-PDF inspection is claimed. These support the general mathematical theorem; they do not turn this instructor-review extension into a local worked slide exercise.

The coordinator reopened CP01 PR24 for confirmed modal cancellation/iteration contamination: G=1/[(s−2)(s+3)], free x(0−)=[1,−3] should be exp(−3t), but direct transition multiplication/iteration invents growth at horizons20/30. Preserve DS05 and return to the original CP01 branch/PR first. Required repair: stable modal contributions before amplification or explicit loss-of-accuracy feedback; regress direct sample and trace at20/30 and nearby IC with a genuine unstable component; verify in the actual private browser, update evidence and resubmit exact clean revision. CP01 corrections take priority; DS05 remains active and checkpointed without preview/browser resources.
