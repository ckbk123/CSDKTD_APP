# DD07 implementation status

- **Stage:** in-progress — ownership/source audit complete; implementation and checks pending.
- **Assessed:** 29 October 2026; primary base `9d923d2f9a3728bdfd6516dd68aa06c93d9e7f86` (v0.3.9).
- **Ownership / contract:** `src/modules/dd07/**`, [TASK.md](TASK.md), atlas DD07 and discrete audit DD6.
- **Worker chat:** `01a18700-78e9-7a80-af1b-4436e25b10ff`.
- **Branch:** `codex/dd07-sampled-observer-01a18700`.
- **Worktree:** `C:\Users\baokh\.codex\worktrees\dd07-sampled-observer-01a18700\CSDKTD APP`.
- **PR:** not created.

## Inspected foundation and provenance

Primary folder was clean and unclaimed; current index is metadata-only and workspace is blank, with no local tests. Claimed atomically before editing. New isolated branch/worktree starts at the recorded primary base, excluding all earlier submitted worker branches. Locked dependencies installed with Node24.22.1:109 packages,0 vulnerabilities. Earlier CD08 PR20 and CD09 PR30 remain submitted/frozen for review; DS02 is integrated.

TASK baseline is continuous A=[[0,1],[-2,-3]],C=[1,0],ZOH T=.1,observer targets .3,.4. B=[0;1] will be the explicitly declared input-column choice for the held-input/feedback experiment, consistent with the common mechanical model; it is not additional DD07 metadata. Original slides have not been reinspected. The discrete audit records separate printed CH9:57 matrices Ad=[[.967,.148],[-.297,.522]],Bd=[.231;.264],C=[1,3],targets .13,.36; retain these as rounded source data, never substitute them for the exact ZOH baseline. Audit quotes the S15 Ld≈[1.023568;1.498984]; independently recompute before accepting.

## Requirement audit and intended bounded implementation

| Accepted requirement | Existing / missing action |
|---|---|
| Editable sampled model/targets | Missing. Shared visual A/B/C and z-target inputs; bounded matrix/quadratic parser; ZOH and direct-discrete interpretations, sample period visible. |
| Observability / derive gain | Missing. Reveal C then CAd, scaled rank, matching equations, prediction and checked actual error matrix/every mode. |
| Separate measured output and truth | Missing. Independent state/estimate initial values; known held input, scalar measurement, innovation, explicit timing and sample/second inspector. |
| Predictor/current timing | Missing. Implement predictor form and current-correction form with explicit read/correct/control/advance order; verify their distinct error matrices and equivalent gain relation. |
| Estimated-state feedback | Missing. Optional checked K/N; all controller/observer modes; held reference and sampled output/effort. |
| Rounding / changed inputs | Missing. Exact ZOH baseline, separate rounded source model and rounding residual comparison; changed period redesign, sensor/targets/data; reject rank loss and unsupported cases. |
| Lifecycle / accessibility | Missing. Owned child-signal loading/recovery, scoped styles, shared native numeric reader, keyboard controls, numeric table/plots and narrow layout. |
| Verification | Missing. Independent analytic ZOH, discrete recurrence and mode fixtures; project and real-browser checks. |

## Mathematical design to verify

Two-state real continuous ZOH or given discrete SISO, D=0. Targets real monic Schur quadratics, ascending internal parser coefficients but displayed z²+d1*z+d0. Matrix row-major; x columns; negative feedback. Continuous held-input model uses the 3×3 augmented matrix exponential, including singular A; direct models use entered matrices without rediscretization. Period edits recompute ZOH and redesign fixed z-targets; in direct mode matrices stay fixed and T changes the seconds axis only.

Predictor: read y[k], innovation y[k]-C*xhat[k], control u[k]=-K*xhat[k]+Nr, then advance x[k+1]=Ad*x[k]+Bd*u[k], xhat[k+1]=Ad*xhat[k]+Bd*u[k]+Ld*innovation. Error modes Ad-Ld*C.

Current estimate: initial prior p[0], read y[k], correct h[k]=p[k]+M*(y[k]-C*p[k]), use h[k] for control, then p[k+1]=Ad*h[k]+Bd*u[k]. Prior error matrix Ad*(I-MC), corrected error matrix (I-MC)*Ad; show actual matrices and all modes. Solve Ad*M=Ld when well-conditioned; never use Ld as a current-correction gain. Exact ZOH Ad is invertible mathematically, but ill conditioning requires feedback. Direct singular Ad may support predictor design while current-gain conversion is unsupported.

All computation and exercise state remain browser-local; no shared/package change requested. These are plans, not implemented/tested claims. Next: pure mathematics/parser and independent fixtures, then complete UI, browser checks and delivery.