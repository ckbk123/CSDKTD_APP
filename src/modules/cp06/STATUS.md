# CP06 implementation status

- **Stage:** in-progress
- **Assessed:** 2026-10-29; primary baseline `9d923d2f9a3728bdfd6516dd68aa06c93d9e7f86` (v0.3.9).
- **Contract / ownership:** [TASK.md](TASK.md), `src/modules/cp06/**` only.
- **Worker:** chat `01a186d1-f1f0-7393-88e7-377fbac7299a`.
- **Branch / worktree:** `codex/cp06-root-locus-7393`, `C:/Users/baokh/.codex/worktrees/cp06-root-locus-7393/CSDKTD APP`.
- **PR:** not yet opened. This is a setup/audit checkpoint, not a delivered teaching tool.

## Current code and requirement audit

Inspection at the baseline found metadata, a blank synchronous workspace and no CP06 tests. There are no working features to replace. Shared visual equation inputs, native-number validation and lifecycle conventions are available; no shared root-locus mathematics exists.

| Accepted requirement | Current evidence / remaining implementation |
|---|---|
| Editable loop and actual varying parameter | Missing. Build proper real rational polynomial inputs and proportional-gain / fixed-integral PI parameter modes. Derive the effective numerator and denominator before applying any rule. |
| Real-axis segments and asymptotes | Missing. Compute from effective poles/zeros; keep rule reveals independent. |
| Break/entry, imaginary crossing and departure/arrival points | Missing. Derive stationary-gain and imaginary-axis equations; filter admissible positive gains and verify the full characteristic polynomial. Handle repeated roots and degeneracies explicitly. |
| Candidate vectors, angle residual and gain | Missing. Numeric complex-point entry and plot selection; reveal vectors/angle/gain separately, compare full polynomial residual and all closed-loop roots. |
| Root-locus branches across gain | Missing. Numerical root solver with residual/conditioning checks, bounded continuation with minimum-distance matching and explicit ambiguity at collisions. Never sort each sample by real part. |
| Prediction / checked result / changed experiment | Missing. Prediction controls, selected-gain root table, presets and independently revealable rules. |
| Exact algebra versus numerical/sample evidence | Missing. Rational coefficient identities; numerical root/geometry and finite gain trace separately labeled. No sweep proves a complete stability interval. |
| Independent tests and browser evidence | Not yet performed. Baseline, changed roots/zeros, fixed-Ki variation, repeated/cancelled roots, parser semantics and failure cases required. |
| Fresh mount/reset/cleanup and accessible narrow layout | Not yet implemented. Owned child signal for deferred view, cleanup-on-failure tests, visual editor keyboard/fonts and real-browser checks required. |

## Planned supported domain (not yet a support claim)

Negative unity feedback with effective characteristic polynomial `Q(s,K)=D(s)+K N(s)`, nonnegative real K. Real rational polynomial coefficients, strictly proper effective loop, denominator degree 1–3, numerator degree 0–2 with positive leading coefficient after denominator normalization. Keep common factors and label their fixed modes. A fixed-Ki PI mode constructs `D_eff=s D_plant+Ki N_plant`, `N_eff=s N_plant` from a strictly proper plant of degree at most two. `Ki` stays fixed while `Kp` varies; this is a different locus from proportional plant gain.

Use bounded exact coefficient arithmetic and bounded numerical roots/continuation. Set and test precise coefficient, gain, point, sampling and conditioning limits during implementation. All state belongs to this visit. No packages or unowned shared changes are currently needed.

## Provenance and independent fixtures

[Atlas](../../../docs/EXERCISE_TOOL_ATLAS.md#cp06) and [continuous audit S5](../../../docs/research/CONTINUOUS_EXERCISE_AUDIT.md#s5-stable-gain-values-located-through-root-locus) were read. They identify Ch4:30–54 and S08:4,7–11 and explicitly leave the original Ch4:50–54 PI diagram untranscribed. Do not claim an inspected topology for that example. A new PI example will be labeled proposed.

- Accepted baseline: `D=s(s+2)(s+5)=s^3+7s^2+10s`, `N=1`. Stationary gain solves `3s^2+14s+10=0`; only `s=(-7+sqrt(19))/3` lies on the positive-gain real-axis locus. Asymptote centroid `-7/3`, angles 60°, 180°, 300°. At `K=70`, `Q=(s+7)(s^2+10)` and roots `-7, ±j sqrt(10)` independently establish the crossing.
- Proposed PI fixture: plant `1/[s(s+2)]`, fixed `Ki=27/10`, variable `Kp`. Then `Q=s^3+2s^2+Kp s+27/10`; at `Kp=27/20`, `Q=(s+2)(s^2+27/20)`. The effective loop is `s/(s^3+2s^2+27/10)`, not the original plant.
- Further changed-data, complex-departure, cancellation, multiplicity and failure fixtures remain to be derived and tested.

## Checks and next action

- Fresh isolated baseline and atomic claim recorded. Locked install: `npm ci`, 109 packages, zero vulnerabilities.
- No CP06 mathematics/project/browser verification is claimed at this audit checkpoint.
- Next: bounded polynomial/root primitives and independent mathematical fixtures, then complete teaching UI and real-browser verification.
