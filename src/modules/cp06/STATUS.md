# CP06 implementation status

- **Stage:** in-progress
- **Assessed:** 2026-10-29; primary baseline `9d923d2f9a3728bdfd6516dd68aa06c93d9e7f86` (v0.3.9).
- **Contract / ownership:** [TASK.md](TASK.md), `src/modules/cp06/**` only.
- **Worker:** chat `01a186d1-f1f0-7393-88e7-377fbac7299a`.
- **Branch / worktree:** `codex/cp06-root-locus-7393`, `C:/Users/baokh/.codex/worktrees/cp06-root-locus-7393/CSDKTD APP`.
- **PR:** not yet opened. Mathematics/UI checkpoint; browser validation and delivery remain.

## Current code and requirement audit

Inspection at the baseline found metadata, a blank synchronous workspace and no CP06 tests. There are no working features to replace. Shared visual equation inputs, native-number validation and lifecycle conventions are available; no shared root-locus mathematics exists.

| Accepted requirement | Current evidence / remaining implementation |
|---|---|
| Editable loop and actual varying parameter | `parser.ts`, `model.ts`, `view.ts`: visual N/D, native gains, effective proportional / fixed-Ki PI normalization. Tests distinguish the proposed PI model from plant gain. Browser pending. |
| Real-axis segments and asymptotes | `rules.ts`: multiplicity-aware reduced geometry, exact rational centroid, independent reveals. Baseline/changed-zero tests. |
| Break/entry, imaginary crossing and departure/arrival points | `polynomial.ts`/`rules.ts`: exact Sturm counts for degree≤4, stationary candidates, positive finite-gain/full-Q/derivative checks, repeated tangent rays, isolated crossings versus axis families. Exact K=0/1000 endpoint screens prevent numerical exclusion; three new regressions failed before the correction. |
| Candidate vectors, angle residual and gain | `model.ts`, `plot.ts`, `view.ts`: numeric/plot selection, independent vector/angle/gain reveals, complex −D/N and full-Q checks. Invalid numeric candidates preserve the last valid result. |
| Root-locus branches across gain | `roots.ts` and `continuation.ts`: exact square-free multiplicities, numerical degree≤3 roots, residual/Vieta/separation guards, minimum-distance assignment and midpoint refinement. Ambiguous/unresolved connections are omitted and counted. |
| Prediction / checked result / changed experiment | `view.ts`: optional infinity-branch and candidate predictions, seven presets, all full-Q roots, separate rule disclosures. `view.test.ts` covers changed inputs/reveal/reset/error flow; real browser pending. |
| Exact algebra versus numerical/sample evidence | Exact rational polynomials and multiplicities, numerical roots/geometry, finite gain trace and tolerances are separately labeled. Common factors retained as fixed modes in full Q. |
| Independent tests and browser evidence | 111 module tests across five files pass. Fixtures cover baseline, changed roots/zeros, proposed PI, complex/repeated/cancelled modes, crossing endpoints, parser semantics and bounded failures. Browser pending. |
| Fresh mount/reset/cleanup and accessible narrow layout | Scoped styles and synchronous loading wrapper with child abort signal. Four deferred tests include a signal-owned resource then throw with parent active. Mocked view tests cover partial editor failure and fresh visits. Actual keyboard/fonts/narrow/reset/navigation checks pending. |

## Implemented domain (browser validation pending)

Negative unity feedback with effective characteristic polynomial `Q(s,K)=D(s)+K N(s)`, nonnegative real K. Real rational polynomial coefficients, strictly proper effective loop, denominator degree 1–3, numerator degree 0–2 with positive leading coefficient after denominator normalization. Keep common factors and label their fixed modes. A fixed-Ki PI mode constructs `D_eff=s D_plant+Ki N_plant`, `N_eff=s N_plant` from a strictly proper plant of degree at most two. `Ki` stays fixed while `Kp` varies; this is a different locus from proportional plant gain.

Normalized coefficients have magnitude≤1000 and rational denominator≤10⁹; selected gain/trace maximum≤1000. Visual grammar: ≤400 characters, 160 primaries, 12 nested groups, powers 0–3, intermediate coefficient magnitude≤10⁹, exact arithmetic≤4096 bits. Native gains allow ordinary exponent notation and reject nonzero underflow through the shared numeric reader. A candidate has |s|≤100. K is nonnegative; the supplied loop sign must be positive after denominator normalization. Frequencies are s⁻¹ / rad/s; no initial-state trajectory is simulated.

Distinct numerical roots require relative separation≥2×10⁻⁷, scaled residual≤2×10⁻¹⁰ and coefficient reconstruction error≤10⁻⁹. Exact repeated factors are handled separately. Real stationary/frequency equations use exact Sturm counts and ≤1024 interval checks / 100 bisections; displayed midpoints are numerical (relative interval width≤2×10⁻¹³). Root/rational work can reject ill-conditioned data with feedback. Location labels within 10⁻⁸·max(1,|s|) of the axis are numerical near-axis labels.

The default trace starts with 64 gain intervals and adaptively refines by midpoint curvature/displacement, bounded by depth 12 and 2049 root evaluations. Matching checks all ≤3! assignments. Tied distinct-branch assignments, unresolved roots and exhausted bounds create counted gaps. This finite trace does not certify complete stability regions. Candidate checks use 10⁻⁶ rad angle tolerance, 10⁻⁸ relative imaginary-gain tolerance and full-Q residual≤2×10⁻⁸. Common factors remain fixed full-model modes. The PI integrator state is retained even at Ki=0.

All state belongs to this visit. No packages or unowned shared changes are needed. Local coefficient/parser/lifecycle primitives were adapted from this worker's preserved contributions without sibling imports.

## Provenance and independent fixtures

[Atlas](../../../docs/EXERCISE_TOOL_ATLAS.md#cp06) and [continuous audit S5](../../../docs/research/CONTINUOUS_EXERCISE_AUDIT.md#s5-stable-gain-values-located-through-root-locus) were read. They identify Ch4:30–54 and S08:4,7–11 and explicitly leave the original Ch4:50–54 PI diagram untranscribed. Do not claim an inspected topology for that example. A new PI example will be labeled proposed.

- Accepted baseline: `D=s(s+2)(s+5)=s^3+7s^2+10s`, `N=1`. Stationary gain solves `3s^2+14s+10=0`; only `s=(-7+sqrt(19))/3` lies on the positive-gain real-axis locus. Asymptote centroid `-7/3`, angles 60°, 180°, 300°. At `K=70`, `Q=(s+7)(s^2+10)` and roots `-7, ±j sqrt(10)` independently establish the crossing.
- Proposed PI fixture: plant `1/[s(s+2)]`, fixed `Ki=27/10`, variable `Kp`. Then `Q=s^3+2s^2+Kp s+27/10`; at `Kp=27/20`, `Q=(s+2)(s^2+27/20)`. The effective loop is `s/(s^3+2s^2+27/10)`, not the original plant.
- Independent changed fixtures include `Q=(s+4)(s²+9)` at K=36; complex-pole departure 45°/315° for `1/[(s+3)(s²+2s+5)]`; complex-zero arrival derived from `-D/N′=-11-3j`; triple-pole endpoint at K=8 for `1/(s+1)³`; unstable cancelled fixed mode at +1; even-quadratic imaginary-axis families; exact K=0/1000 crossing endpoints.

## Checks and next action

- Fresh isolated baseline and atomic claim recorded. Locked install: `npm ci`, 109 packages, zero vulnerabilities.
- `npm exec vitest run src/modules/cp06`: 111/111 tests, five files pass (52 foundation, 20 rules, 11 continuation, 24 mocked flow, four deferred lifecycle).
- `npm test`: 771/771 tests, 31 files pass.
- `npm run check` and `npm run build`: pass; only the existing bundled MathLive large-chunk advisory.
- Browser checks have not yet run for CP06. Mocked editor tests do not establish interactive MathLive behavior.
- Next: actual production browser editing/reveals/plots/keyboard/fonts/reset/reopen/navigation/narrow verification, then final evidence, one PR and exact clean submission.
