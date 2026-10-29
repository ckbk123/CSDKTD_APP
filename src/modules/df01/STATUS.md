# DF01 implementation status

- **Stage:** in-progress (browser QA still pending)
- **Assessed:** 2026-10-29; base `c5d1135`, implementation checkpoints `a798749`, `309dbc8`
- **Ownership:** `src/modules/df01/**`; acceptance: [TASK.md](TASK.md)

## Requirement evidence

| Accepted requirement | Implementation and checks |
|---|---|
| Editable sampled channel, period, horizon and band | `view.ts`: shared visual G(z) field; T, N, 2%/5% controls. `math.ts`: independent bounded parser/validation; malformed, unsupported, nonfinite, improper and unstable inputs tested. Edits invalidate stale answers. |
| Identify largest/peak and settling indices before revealing | Stem plot and numeric sample inspector; two prediction inputs and an unestablished option; reveal gives feedback and reasoning. For monotone responses, distinguish largest plotted sample from an attained global peak. |
| Stem visualization, final value, band and markers | Computed SVG stems, dashed final level, shaded band, selected sample and revealed largest/settling markers. Both k and t=kT axes; keyboard numeric inspector shows both numerical routes. |
| Samples and physical time with explicit initialization | k=0 is the first output, including direct feedthrough. Unit step starts at k=0, all prior inputs/outputs and x[0] are zero. Output is read before simultaneous state update. No added feedback. T changes seconds without changing this fixed discrete sequence. |
| Remain in band after the first settling index | Observed suffix plus a conservative bound on **every** unplotted homogeneous-error sample; insufficient horizon or unresolved numerical boundary gives “not established.” Never substitutes N for settling. |
| Compare recurrence/state under identical initialization | Independent output recurrence and controllable state realization; matrices, recurrence, DC limit and maximum discrepancy revealed. Fixtures check both routes against independently derived sequences. |
| Changed-data experiment | Oscillatory `1.25/(z²+.25)` and short-horizon `.01/(z-.99)` presets; manual model/T/N/band edits; state and answer do not survive reopening. |
| Intersample distinction | No continuous plant/hold is supplied. Explicitly no reconstruction or continuous-peak claim. |
| Lifecycle/metadata/style isolation | Original `index.ts` unchanged. Synchronous `workspace.ts` mount owns guarded lazy view and cleanup; tests prevent late import mount and duplicate disposal. View listeners use signal, field destroyed, no timers/workers. All CSS under `[data-module="DF01"]`. |
| Independent math and project checks | 29 parser/math tests plus 4 UI/lifecycle tests (33 local total); exact commands/results below. Browser checks still required. |

## Supported mathematics and numerical limits

- Real SISO LTI proper rational polynomials in z, denominator degree **1 or 2**, numerator degree no larger; optional G(z)=. One visual fraction or typed division; decimal coefficients, sums, products, parentheses and integer powers 0–2. No variables other than z, symbolic parameters, functions, nested fractions or implicit cancellation. Visual `2e-7` is rejected rather than silently treating the displayed variable e as scientific syntax; enter a decimal coefficient.
- Parser uses ascending powers internally; normalized solver arrays/equations use descending powers: a=[1,a1,a2], b=[b0,b1,b2], dropping the second-order entries for order one. Direct term D=b0; C=[b1−a1b0,b2−a2b0]. No feedback loop is added.
- Strict disk stability uses every unreduced denominator root, radius <1−10⁻⁹. Unstable cancelled modes remain rejected. Zero-state unit step only. Relative bands need nonzero final value: 10⁻⁹≤|G(1)|≤10⁶.
- ≤512 input characters and 128 polynomial tokens; degree ≤2 including intermediate polynomial products. Coefficients and normalized coefficients ≤10⁶, leading denominator magnitude ≥10⁻¹⁰. T in [10⁻⁶,1000] seconds; integer last index N in [2,500] (N+1 plotted samples). Abort computation if response/state magnitude exceeds 10⁹. No iterative root finder.
- All displayed decimal evaluations are numerical approximations (7 significant digits); small nonzero residuals remain visible and scientific outputs use typeset powers of ten. State/recurrence agreement threshold 10⁻⁸ times max(1,response scale). Peak ties within 10⁻¹² of final-value scale choose the earliest index. Negative-gain peaks/overshoot follow the direction of final value.
- For future-error certification use the homogeneous error state v=[e[k],e[k−1]] and companion matrix A. Find m≤4096 with q=||A^m||∞<1−10⁻⁸. For j=lm+r, ||A^j v||∞≤||A^r||∞ q^l ||v||∞. The maximum norm for r=0…m−1 bounds every future sample; inflate by 1+10⁻⁸ and reserve 10⁻¹⁰ times the output scale. First-order errors use their monotone absolute envelope. This bound can be conservative. An ambiguous band-boundary sample does not justify naming the following sample as first; such cases remain unestablished. Extending N can resolve insufficient horizons, but cannot resolve a mathematically exact boundary obscured by floating arithmetic.
- Overshoot is observed on the grid. A positive directional peak is globally certified only if its excess dominates the future-error bound. Otherwise “largest plotted sample” is the stated result; a monotone response may have no attained finite maximum.

## Independent fixtures and provenance

The course audit DF1 supports TF/recurrence/state comparison and sampled transient metrics (CH8:41–62; S13:6–11). This worker read the recorded audit/atlas, not original slide assets; no fixture below is claimed to be a slide transcription.

- Baseline `.2/(z−.8)`: y[k]=1−.8^k, y[0…3]=0,.2,.36,.488; `.8^17>.02`, `.8^18<.02`, so k_s=18 and t_s=1.8 s at T=.1. At 5%, k_s=14; T=.25 gives 3.5 s with unchanged sequence.
- Alternating `1.5/(z+.5)`: y[k]=1−(−.5)^k; k_p=1, 50% overshoot, k_s=6. Negative-gain counterpart checks direction and absolute band.
- Repeated poles `.25/(z−.5)^2`: h[k]=(k−1).5^k for k≥2, zero earlier; step is its partial sum, error=(k+1)/2^k; k_s=9.
- Conjugate poles `1.25/(z²+.25)`: sequence 0,0,1.25,1.25,.9375,.9375,1.015625,1.015625; first peak k=2, overshoot25%, k_s=6.
- Direct feedthrough `(z+.2)/(z−.5)`: y[k]=2.4−1.4(.5)^k, y[0]=1; checks output-before-update timing.
- Temporary band entry `(z²−z+1.64)/(z²+.64)`: y[2]=1, y[3]=1.64, final1; N=2 must not establish settling. Exact 5% boundary with pole sqrt(.05) checks numerical uncertainty.
- Tail bounds checked against independently continued sequences to k=500 for distinct/repeated/conjugate modes. Failure cases include unstable hidden cancellation, ±1/unit-circle poles, zero final value, malformed/incomplete forms, noncausal degree, coefficient limits and invalid T/N/band.

## Executed checks

Toolchain: **Node 24.22.1**, npm 10.8.2, locked dependencies inside this worktree. Invoked npm via `node.exe C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js` with Node24 on child PATH; direct Vitest via the same Node runtime.

- `npm ci`: passed, 109 packages / 0 vulnerabilities. Initial machine-default Node20 invocation printed engine warnings; repeated under Node24 successfully. No dependency files changed.
- `npx vitest run src/modules/df01` (direct equivalent `node node_modules/vitest/vitest.mjs run src/modules/df01`): **3 files / 33 tests passed** after the decimal-grammar clarification.
- `npm run check`: passed before the final two-line decimal-grammar clarification; rerun for final submission.
- `npm test`: **9 files / 75 tests passed** before that clarification; rerun for final submission.
- `npm run build`: passed before that clarification; only the existing large MathLive chunk warning. All 20 local font files emitted.
- `git diff --check`: passed.
- An initial full-suite import failure exposed MathLive's browser-only initialization in a public workspace import. The visit-owned lazy `view.ts` now keeps public metadata/workspace loading independent of browser initialization, with explicit abort/disposal tests. No shared files changed.
- Browser QA attempts correctly reported other owners (DR01, then DS03). No browser control was used without the reservation. Worker production preview is at `127.0.0.1:8811`; primary port8787 untouched.

## Remaining work and delivery

Real-browser editing/fonts/keyboard, error/reset/reopen/rapid-navigation/narrow-layout checks, final project checks, evidence update and final submission remain. No shared dependency requests; no independent reviewer has been claimed. Stage stays in-progress until those checks finish. The unique branch is `codex/df01-sampled-quality-01a18701`; checkpoints pushed for recovery, claim active. No merge, deployment, version/dependency changes or added agents.

## Preliminary review correction (2026-10-29)

Coordinator review identified that a floating residual could round to zero even though the exact tail remains nonzero. Corrected the returned/displayed tail envelope to **include** the scale-aware roundoff allowance already used for settling, and explicitly labeled it floating-point evidence rather than an interval-arithmetic proof. Global-peak wording uses the same allowance. Regression `(z²+.5z+.75)/(z²+.25)` has exact e[2]=1/5 and e[62]=(1/5)4^-30>0, while its computed residual can round to zero; the displayed envelope now remains positive and encloses this error. No independent final-review stage is claimed.

Also accepted MathLive's single-token fraction arguments (for example fraction numerator 1 need not serialize with braces); decimal-only coefficient grammar remains explicit. Current checks after these changes: local suite **3 files / 34 tests**, full `npm test` **9 files / 76 tests**, `npm run check`, `npm run build` and `git diff --check` all passed under Node24. Build warning unchanged. Browser QA still pending (resource now held by DP01).
