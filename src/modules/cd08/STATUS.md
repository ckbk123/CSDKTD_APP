# CD08 implementation status

- **Stage:** in-progress — mathematical exercise and guided UI implemented; actual browser QA pending.
- **Assessed:** 2026-10-29; starting main `f99cfebb65495d3f4385a61dd1d25800e341ea68`.
- **Ownership:** `src/modules/cd08/**`; [TASK.md](TASK.md), atlas CD08, continuous exercise audit controller-design section.
- **Worker chat:** `01a18700-78e9-7a80-af1b-4436e25b10ff`.
- **Branch:** `codex/cd08-state-feedback-01a18700`.
- **Worktree:** `C:\Users\baokh\.codex\worktrees\cd08-state-feedback-01a18700\CSDKTD APP`.
- **PR:** https://github.com/ckbk123/CSDKTD_APP/pull/20 (draft, attached; same branch/PR for corrections).
- **Own preview:** http://127.0.0.1:8997/#/module/CD08. Busy port8893 was left untouched; primary8787 is not changed.

## Requirement-to-evidence audit

| Accepted requirement | Current evidence and remaining gate |
|---|---|
| Editable small SISO model and target poles | Four shared visual inputs for A,B,C and the target polynomial, validated by bounded `parser.ts`. Native initial state/reference/horizon use shared `readNumericInput`. Actual matrix editing remains to be browser checked. |
| Column-by-column controllability | B then AB construction, full matrix, independently normalized column determinant and declared numerical rank threshold in `math.ts`/`ui.ts`. Rank-deficient/near-deficient cases tested. |
| Coefficient matching and K | Trace and determinant equations, substituted 2×2 solve, K and full A−BK shown. Actual characteristic coefficients and both eigenvalues independently checked. No selected-mode-only verification. |
| Reference correction | Derives DC gain and N, checks baseline N=8 vs N=1 final gain1/8. Zero/too-small DC channel retains K and shows unavailable static prefilter. |
| States/output/effort | Four computed plots compare the same model/history under N=1 and calculated N, with native time inspection and sample table. Zero-prefilter case explicitly has only N=1. Coarse sampling warning; no finite-horizon settling claim. |
| Attempt/reveal/changed data | Gain and no-prefilter prediction, checked reveal/hide, real/conjugate target variations and changed output. Native/visual edits invalidate stale results; focus restoration tested. |
| Lifecycle/isolation | Metadata unchanged; synchronous lazy wrapper guards abort/dispose, has visible failure recovery, and releases the UI. All state is mount-owned. Loader and mocked fresh-visit tests pass; real reset/reopen/rapid navigation remain pending. |
| Keyboard/fonts/narrow layout | Scoped Indigo/slate UI, labeled numeric alternatives, responsive SVG/matrix grids and shared equation controls. Actual MathLive fonts/keyboard/390px QA remains pending. |

## Supported domain and computation

Real continuous two-state SISO: A2×2, B2×1, C1×2, D=0, x column, u=−Kx+Nr. Both states are assumed available to the feedback; C defines the selected output and does not supply an observer. Time is in seconds; other units belong to the supplied model. The same initial state and held constant reference are used in both comparisons. No sample period/discrete dynamics are inferred.

Matrices accept finite decimal literals, unary signs, literal numeric fractions including nested/signed/compact TeX forms and unambiguous numeric wrappers. They do not accept general cell arithmetic. Desired q(s) is a real monic quadratic: visible expanded/factored polynomial arithmetic, numeric fractions, constant division and squares. Both coefficients must be strictly positive (strictly Hurwitz). Repeated and conjugate poles are supported through the real polynomial. e/E scientific literals in visual fields, hidden algebraic braces and ambiguous mixed-number adjacency are rejected. Native number controls legitimately accept ordinary exponents and intentional zero; nonzero browser underflow is rejected.

Bounds: equations≤600 characters, target≤120 tokens/nesting12, scalar nesting8, literal decimals≤12 fractional places and≤8 integer digits; matrix entries≤1000 and target coefficients≤10000. Controllability uses independently normalized columns, determinant threshold10⁻⁹. Matching solve uses independently normalized rows at the same determinant threshold. Gain≤10⁶ and closed-matrix entries≤10⁴. Each actual coefficient must match its strictly positive target with relative error≤10⁻⁹; there is no absolute denominator floor that could conceal a tiny-coefficient mismatch. Actual coefficients must also remain strictly Hurwitz.

The prefilter requires |DC gain|>10⁻¹⁰||C||||(A−BK)⁻¹B|| and |N|≤10⁶. Otherwise the feedback design remains available with a no-static-tracking explanation. The full original two-state model remains in the calculations even if C hides a mode.

Response is a numerical augmented 3×3 matrix exponential for a held input, avoiding subtraction of huge equilibrium terms and division by slow poles. Scaling≤30, Taylor≤24 terms at reduced norm≤.5 and term tolerance10⁻¹⁶. Horizon0.1–50s; pure API samples2–1001, UI fixed401; |initial/reference|≤100 and finite response values≤10⁸. Coarse modal time resolution is explicitly warned about. Plots are sampled numerical illustrations; DC statements concern the stable infinite-time limit. Result equations use powers of ten for small nonzero values rather than rounding them to zero; displayed values use about seven significant digits.

## Independent mathematical evidence

Original decks were not reinspected. Source anchors remain TASK/atlas and the continuous exercise audit; the following are independently derived checks, not claimed new slide inspections.

- Mechanical baseline A=[[0,1],[−2,−3]], B=[0,1], C=[1,0], targets−2,−4 gives K=[6,3], N=8; A−BK=[[0,1],[−8,−6]]. Without N correction the DC output gain is1/8. Corrected zero-state y=1−2e^(−2t)+e^(−4t), x2=4e^(−2t)−4e^(−4t), u=2+6e^(−4t).
- Changed targets−1,−5 give K=[3,3], N=5 and y=1−(5/4)e^(−t)+(1/4)e^(−5t). Repeated−3 gives y=1−(1+3t)e^(−3t). Conjugate−2±3j gives y=1−e^(−2t)(cos3t+(2/3)sin3t).
- Independent free response and state-coordinate transform S=diag(2,3) preserve y/u and map x/K consistently. C=[0,1] retains valid K but has no static DC tracking gain.
- Noncanonical unstable plant A=[[1,2],[3,4]], B=[1,−1], C=[1,2], q=s²+4s+5 gives K=[−21.5,−30.5], N=2.5. Independent matching equations k1−k2=9 and 6k1−4k2=−7; steady x=[−3,2], u=−1 gives Ax+Bu=0 and Cx=1.
- A tiny-gain double integrator preserves K,N≈10⁻¹⁴ and the forced output≈5×10⁻¹⁷ at t=.1 without equilibrium cancellation.
- Prediction checks use relative tolerance10⁻⁷ for nonzero gains and exact equality for zero. A zero prediction does not pass for a tiny nonzero gain; the tiny-gain UI regression checks both the rejected zero attempt and accepted native exponent input.
- Accuracy review caught A=diag(10⁻⁶,−2), B=[3,1], C=[1,0], desired constant10⁻³⁰ producing actual≈5.05783×10⁻²² under a former tolerance floor. The floor was removed; a regression now requires explicit accuracy rejection. Small magnitude alone is not rejected.

## Verification and recovery

Bundled Node24.22.1 with compatible npm CLI/PATH, local locked dependencies (`npm ci`,109 packages,0 vulnerabilities). The latest `node node_modules/vitest/vitest.mjs run src/modules/cd08` passes56 tests (48 math/parser,5 UI/native-state/focus,3 loader). Production build including type check passed at the preceding checkpoint; a final combined rerun remains required after browser completion. Earlier full-project `npm test` passed391 tests before additional fixtures. Existing MathLive large-chunk warning only. `git diff --check` was clean after trailing-blank cleanup.

PR check passed at `21b30d0`: https://github.com/ckbk123/CSDKTD_APP/actions/runs/40875737912/job/123453957009. That is a checkpoint CI result, not final completion evidence. Early signed-zero assertions were corrected to numerical zero equivalence; one test literal was changed to an equivalent supported fraction after exceeding the declared integer-digit grammar.

## Remaining gates and coordination

Real browser matrix entry, power/fraction/Systems keyboard, baseline/changed outputs, rank/error paths, reset/reopen/rapid navigation/cleanup and narrow layout remain mandatory. No CD08 browser controls have been used yet. The coordinator's DP03→DP04→DP02 ordered gate is finished. Normal supported acquisition resumed; the live release-event waiter respects newer holders (currently CF02). Do not submit or mark implemented before actual browser evidence and final combined checks. No shared change is required. Prior DS02 PR4 is integrated/verified (v0.3.3, followed by coordinator notation correction0.3.5) and preserved in its original worktree.

The prediction and plot descriptions say no *supported* static prefilter, distinguishing an implementation gain bound from mathematical nonexistence. An independent C=[10⁻⁸,0] fixture retains K=[6,3] and DC gain1.25×10⁻⁹: the mathematical N=8×10⁸ exists but exceeds the declared10⁶ bound. The original zero-DC velocity fixture remains separate. Unbraced exponent regressions reject `s^02`, `s^2.0`, `s^22`, signed unbraced powers and adjacent numeric text after a braced square; the parser does not collapse TeX token boundaries into a different exponent. Ordinary `s^2` and the shared square button's `s^{2}` remain supported.
