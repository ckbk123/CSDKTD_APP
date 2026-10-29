# CD08 implementation status

- **Stage:** in-progress (requirement audit; implementation starting)
- **Assessed:** 2026-10-29, baseline `f99cfeb`; ownership `src/modules/cd08/**`.
- **Worker:** `01a18700-78e9-7a80-af1b-4436e25b10ff`.
- **Branch:** `codex/cd08-state-feedback-01a18700`.
- **Worktree:** `C:\Users\baokh\.codex\worktrees\cd08-state-feedback-01a18700\CSDKTD APP`.
- **Contract:** [TASK.md](TASK.md), atlas CD08, continuous exercise audit controller-design section. No original deck reinspection is claimed.

## Requirement audit

| Accepted requirement | Existing evidence / next action |
|---|---|
| Editable small SISO model and target poles | Metadata exists, workspace blank, no local tests. Implement shared visual matrix inputs and target-polynomial input with bounded local parsing. |
| Column-by-column controllability and rank | Absent. Construct B, AB, show scaled numerical rank/tolerance and useful uncontrollable/conditioning feedback. |
| Coefficient matching and feedback K | Absent. For arbitrary real two-state A,B solve trace/determinant matching; show equations and independently verify both eigenvalues of A−BK. |
| Scalar reference correction | Absent. Derive DC tracking with u=−Kx+Nr; show unscaled vs corrected reference gain and no-static-prefilter cases. |
| State/output/effort comparison | Absent. Compute both reference-gain responses under the same initial state and held step; plot labeled states, output and effort with sample values and horizon caveat. |
| Attempt, reveal and changed data | Absent. Add gain/tracking prediction and checked derivation, change targets/model and repeat. |
| Meaning, units and errors | Declare continuous two-state SISO with D=0, x column, C row, negative feedback, seconds; no hidden model assumptions. Reject unsupported dimensions, visual scientific literals, mixed-number adjacency/hidden grouping, nonfinite/oversized/ill-conditioned data. |
| Lifecycle and real browser | Preserve synchronous mount and lazy metadata. Test fresh reset/reopen, stale import/abort, keyboard/focus, actual MathLive entry/font and narrow viewport under shared QA reservation. |

## Planned bounded domain and independent fixtures

Arbitrary real A (2×2), B (2×1), C (1×2), D=0; real monic quadratic desired characteristic polynomial, including repeated or conjugate poles, with strictly stable targets for the tracking comparison. Matrix entries use supported finite decimal/signed fractions, not a general CAS. Native time/reference/initial-state controls use the shared numeric reader. Exact limits/tolerances will be recorded with the solver.

For baseline A=[[0,1],[-2,-3]], B=[0,1], C=[1,0], desired (s+2)(s+4)=s²+6s+8: trace matching gives k2=3 and determinant matching k1=6. A−BK=[[0,1],[-8,-6]], closed poles −2,−4. For a unit reference without prefilter the final output is 1/8; N=8 gives unity. With zero initial state corrected output is 1−2 exp(−2t)+exp(−4t). These are independent analytic expectations, not values read from the eventual solver.

No implementation, tests, browser evidence or PR is claimed complete at this checkpoint. No shared dependency change is currently required. Prior DS02 PR #4 was accepted as v0.3.3 and is preserved in its original worktree.

## Mathematical checkpoint

`parser.ts` now reads 2×2/2×1/1×2 visual matrices with literal decimal and signed numeric fraction entries, including compact/mixed-brace TeX fraction arguments and outer unary signs. The desired monic quadratic accepts visible factored or expanded expressions, but rejects scientific e/E, hidden standalone grouping, numeric/fraction adjacency and unsupported functions/orders/divisors. Literal decimals have ≤12 places and ≤8 integer digits; equations ≤600 characters, target ≤120 tokens/nesting12, scalar fraction nesting8. Matrix entries |value|≤1000, desired coefficients ≤10000.

`math.ts` constructs B, AB and a normalized-column controllability determinant (rank threshold10⁻⁹), solves trace/determinant matching, checks actual A−BK coefficients and both eigenvalues, and computes the static DC prefilter where reliable. Desired d1,d0 must be strictly positive. Gain magnitude≤10⁶, closed-matrix entries≤10⁴, relative coefficient verification≤10⁻⁹ (scale floor10⁻¹²); actual coefficients must also remain strictly Hurwitz. A zero/too-small DC channel retains the valid feedback design but reports unavailable static tracking.

Response uses a numerical augmented 3×3 exponential for the held reference, avoiding subtraction of huge steady-state terms. Scaling≤30 and Taylor≤24 terms at reduced norm≤.5, term tolerance10⁻¹⁶; horizon0.1–50s, samples2–1001, |initial states/reference|≤100, finite responses≤10⁸. It is a numerical time response, not a symbolic identity or proof that a finite horizon has settled.

Bundled Node24.22.1: type check passed and 38 module tests passed. Independent checks cover baseline analytic x/y/u, unscaled-reference factor1/8, nonzero free response, changed targets −1/−5, repeated −3, conjugate −2±3j, state-coordinate invariance, uncontrollable/near-rank-deficient models, zero DC output, parser semantic failures and resource limits. One initial assertion distinguished −0 from +0; corrected to numerical zero equivalence. UI and browser work remain pending. No full-project/build/browser success is claimed yet.

## Guided workspace checkpoint

`workspace.ts` now guards its browser-only lazy UI and provides visible load/retry feedback. `ui.ts` owns four visual editors, native reference/time/initial-state controls via the shared numeric reader, controllability column stepping, gain/no-prefilter prediction and reveal, matching equations, actual poles/DC correction and four computed y/u/x1/x2 plots. Both reference-gain cases share the same model/history; nearest-sample inspection has a numeric keyboard control. Changed-target/conjugate-target/velocity-output buttons compute from edited inputs. Styles are scoped beneath CD08 and use the existing tokens. Redraws preserve focused controls.

Type checking and 45 initial module tests passed; all 389 current project tests passed. New slow-pole and tiny nonzero display regressions were added during final source inspection so valid small gains are never displayed as zero. UI mocks establish caller state, native-reader wiring, focus and lifecycle only; real MathLive editing/fonts/phone/browser evidence is still pending. No implementation-complete claim is made yet.
