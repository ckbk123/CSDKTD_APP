# DP04 implementation status

- **Stage:** in-progress (audit; solver/interface not implemented yet)
- **Assessed:** 2026-10-29; starting primary main `0b199d44b5a83d2c4fbf08e3e7c8dec1117da31d`
- **Owned scope:** `src/modules/dp04/**`; [accepted contract](TASK.md)
- **Worker chat:** `01a186d1-a367-78f1-98f5-e1cf147ef306`
- **Branch:** `codex/dp04-root-locus-01a186d1`
- **Worktree:** `C:\Users\baokh\.codex\worktrees\dp04-root-locus-01a186d1\CSDKTD APP`
- **PR:** not created yet

## Starting evidence and full bounded exercise

The metadata and blank synchronous mount match the scaffold record. There are no module calculations, controls or tests to preserve. Primary was clean in DP04 when claimed. This fresh branch contains committed current-primary code, rather than either preceding worker contribution. Native controls will use the shared numeric reader in this baseline; no shared mathematical API or package change is needed.

The complete construction lesson will support real quadratic negative-feedback families D(z)+K B(z)=0, D=z²+a1 z+a0, B=b1 z+b0, with a nonzero linear or constant numerator and K>=0. This includes real or conjugate open-loop poles, repeated roots, either sign of the fixed numerator, and exact/near pole-zero overlaps without cancellation. Degree-three/higher and improper loops will be rejected explicitly. Within this class, every accepted construction step, candidate check, branch tracking and the full selected characteristic root set is required, not just a fixed baseline plot.

| Accepted requirement | Starting evidence | Implementation/check plan |
|---|---|---|
| Editable model/gain/sample period | Metadata only | Shared visual rational-polynomial input; native K/window/T/candidate controls; bounded parser |
| Student construction before locus | None | Build pole/zero view; predict real-axis intervals; check attempt and reveal analytic rules and sampled branches |
| Real-axis segments | None | Count real poles/zeros to the right with multiplicities and fixed numerator sign; exclude singular endpoints |
| Asymptotes/break points | None | Centroid/angles and candidates from D′B−DB′=0; admissibility, singular/common-root exclusions and gain-window limits |
| Continuous branch tracking | None | Quadratic square-root continuation through collisions, without independent root sorting; finite trace labeled sampled |
| Unit circle and entire root set | None | Scoped locally scrolling SVG with declared clipping; both roots/multiplicities, radii, residuals and qualified selected-gain disk classification |
| Angle/magnitude vectors | None | Every pole/zero vector and coefficient phase; direct complex −D/B reference; distinguish off-locus, K=0, singular and common-root cases |
| Discrete time interpretation | None | Unit-amplitude real modal samples and T; principal inverse where finite; repeated-root qualification; no forced-response claim |
| Changed data/failures | None | Changed zero, constant/negative numerator and unreduced common-factor fixtures; finite/underflow/grammar/resource validation |
| Reset/isolation/accessibility | Shell foundation only | Mount-local state/draft, guarded deferred view and abort cleanup; real browser keyboard/font/narrow/navigation checks |
| Delivery | None | Independent module tests, check/all tests/build, exclusive QA, one attached PR and exact final submitted SHA |

## Planned conventions and numerical bounds

Negative feedback is 1+K L0(z)=0, with L0=B/D and K nonnegative; the fixed numerator may have either sign. Coefficient order/monic normalization will be explicit. Preserve the unreduced characteristic polynomial; never silently remove exact or near common factors. z and K use normalized units; T is seconds. Modal traces illustrate root modes with unit initial amplitude, not a closed-loop step response or general transfer-channel stability claim.

The visual grammar will support finite real decimals, fractions (compact/signed/nested MathLive forms), polynomial arithmetic and nonnegative integer powers through two in z. e/E programming exponents and unsupported variables are rejected there; native controls retain scientific notation through the shared reader. Proposed resource bounds:512 source characters,128 tokens,eight nesting levels,intermediate polynomial degree at most four; final denominator degree exactly two/numerator degree at most one. Coefficient/intermediate bounds, scale checks and nonzero-underflow guards will be tested before freezing them in the UI.

Planned controls:T .001–10s, gain window .01–100, selected K from zero to that window, candidate coordinates within±50, plot half-range1.25–20 and integer modal horizon4–30. Closed quadratic formulas have residual checks and no iterative convergence claim. Unit-circle and angle/magnitude tolerances will be declared. The plot retains readable text with an explicit view window; off-view roots remain listed. Modal growth beyond supported display magnitude gets feedback without hiding the root set.

A complete stable-gain interval belongs to DS04. This lesson checks the entire selected root set and labels finite branch samples; a sweep is not proof of the full parameter region. Matching data is entered manually in other tools, with no model transfer.

## Independent fixtures and provenance

Read current primary guides, atlas DP04 and research audit DP3 (CH8:20–31,E10, construction/continuity guidance). Original slides were not reinspected. Baseline is accepted metadata; these are independently derived analytic checks, not newly claimed inspected slide examples:

- Baseline D=z²−z,B=z+.2:K=0 roots0,1;K=1 gives±j√.2 and real-mode samples1,0,−.2,0,.04. K=2.5 roots−1,−.5;K=3 gives−1±√.4.
- Discriminant K²−2.8K+1. Break gains(7±2√6)/5 with double roots(-1∓√6)/5; centroid1.2 and asymptote180°. Real-axis segments(−∞,−.2) and(0,1).
- Changed B=z+.5 atK=2 gives−.5±j√3/2, both on the circle. Constant B=1 has centroid.5, asymptotes90°/270°, break z=.5 atK=.25. Negative B=−1 reverses real-axis parity/directions;K=1 roots(1±√5)/2.
- Unreduced D=(z−2)(z+.5),B=z−2 atK=.25 retains roots2,−.75, including the fixed unstable root a reduced ratio would hide. A nearby unequal zero must remain uncancelled too.
- Candidate z=−1 givesK=2.5;z=−.2 has no finite magnitude gain;z=0 is aK=0 pole endpoint. A common D/B zero has an undefined angle/magnitude ratio and no unique gain.

## Checkpoint and remaining work

Locked npm ci completed with Node24.22.1 and zero vulnerabilities. No implementation tests, build or browser checks have run yet. Every table requirement remains implementation/verification work. Earlier submitted DP02 and DD04 contributions stay preserved for review; coordinator returns take priority.

## Mathematical checkpoint

math.ts now computes the unreduced quadratic root set with scaled residual checks, continuous square-root branches and sampled traces including discriminant collision gains. It derives real-axis parity with fixed numerator sign, centroid/asymptote directions, D′B−DB′ break candidates, singular/common-root exclusions and direct complex candidate gain/phase. Both roots are always retained, including coincident and near-common-factor cases. Unit root-mode samples and principal inverse interpretation remain distinct from a forced system response.

Current tested numeric limits: normalized coefficient magnitude≤100, nonzero numerator scale≥.0001, open poles/zero radius≤20, gain0–100 and trace window.01–100. Root residual tolerance10^-10; circle band10^-9; candidate angle tolerance10^-7rad plus scaled imaginary-gain tolerance10^-8. Modal roots support radius≤20000,4–30 intervals and finite amplitude≤10^150; tiny decaying tails may round to zero. T is .001–10s. The parser and interface must surface these bounds before delivery.

npm test -- src/modules/dp04 passes16 independent math/edge cases; npm run check passes. The first run exposed signed-zero output and an overly strict exact assertion on a binary-floating candidate gain. Signed zeros are normalized for displayable outputs and the independently derived2.5 oracle uses a justified10^-14 tolerance; no physical result was changed. Baseline/changed zero, both break points, signed/constant numerator, conjugate poles, collision continuity, unreduced fixed roots, candidate singularities and modal interpretation pass.

Visual parser, UI, lifecycle tests, full-project/build checks and browser verification remain unfinished. Browser acquisition is deferred for the coordinator's CR02→CP03→mixed-fraction integration order until its release notice. The planned parser must reject mixed number/fraction adjacency (including signed/grouped variants) with explicit +/× guidance, preserving normal compact/nested fractions. The current primary helper additionally requires a clean worktree/index and submitted SHA equal to HEAD; final delivery will use that helper, without resetting edits to satisfy it.
