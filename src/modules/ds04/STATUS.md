# DS04 implementation status

- **Stage:** in-progress
- **Last assessed:** 2026-10-29
- **Worker chat:** `01a186d2-2175-7122-ad9f-c01694059c6c`
- **Branch:** `codex/ds04-gain-regions-2175`
- **Worktree:** `C:/Users/baokh/.codex/worktrees/ds04-gain-regions-2175/CSDKTD APP`
- **Starting primary main:** `ae7daf3477c322d980418ec094b35585e43e109c`
- **Contract:** [TASK.md](TASK.md)

## Initial audit and chosen bounded exercise

The inspected folder has immutable metadata, an empty synchronous mount and no local tests. No existing mathematical feature is being replaced. Own only this folder; no shared APIs/dependencies or sibling imports are needed.

| Accepted requirement | Current evidence | Remaining implementation |
|---|---|---|
| Editable L(z) and negative-unity characteristic equation | Baseline metadata only | Visual N(z), D(z), numeric K; P=D+KN; retain uncancelled roots |
| Every real/complex unit-circle crossing | Absent | Solve P(1), P(-1), a=c; check conjugate angles; distinguish fixed-boundary identities and degree loss |
| Complete stable gain set, including disconnected sets | Absent | Exact rational affine critical gains and sign partition; Jury/transformed-Routh equivalence; exclude singular feedback |
| Locus, interval bar and complete root list | Absent | Bounded sampled graph with branch continuity, gain bar, selected roots and all boundary equations |
| Prediction/reveal and changed-data experiment | Absent | Student interval-count prediction; .5 numerator-zero variation and proposed disconnected-set fixture |
| Independent mathematical checks | Absent | Baseline 0<K<2.5; changed complex crossing K=2; disconnected (-infinity,2/3) union (2,infinity); residual and failure tests |
| Browser/lifecycle/project evidence | Empty mount only | Shared equation controls, abort/cleanup, scoped responsive layout, real-browser reservation/checks, final tests/build |

Support plan: proper or biproper real N(z)/D(z), degree N<=2, monic degree-2 D, with bounded decimal/numeric-fraction polynomial grammar. Gain K is real, negative unity feedback, z dimensionless. P=a(K)z^2+b(K)z+c(K). Complete Jury conditions are (a+b+c)/a>0, (a-b+c)/a>0, (a-c)/a>0. Each affine sign is constant between its exact rational zeros; partition those gains algebraically rather than infer a region from the locus samples. Leading a=0 is an algebraic-loop/degree-loss exclusion. Nonminimal factors are retained and disclosed.

Original course slides have not been inspected in this run. Course/audit anchors retain their recorded evidence status. The disconnected biproper fixture is an independently derived proposed variation, not a claimed slide transcription. All accepted functionality and verification remain open at this initial checkpoint.

## Implementation checkpoint (2026-10-29)

The initial-audit table above records the starting scaffold. Its computation and interface rows are now implemented in `math.ts`, `plots.ts`, `ui.ts`, scoped `workspace.css`, and the guarded synchronous `workspace.ts` loader. Both visual polynomial fields use the shared equation components and caller-owned drafts/signals. No sibling imports or shared/package/configuration edits were made.

- Exact reduced rational coefficients preserve input decimals and numeric fractions, including actual MathLive shorthand such as `\frac12`. Numeric literals: at most 6 decimal places and 9 digits. Final reduced coefficient numerators/denominators: at most 10^12; magnitude of nonzero coefficients: 1e-8 to 100. Input/token/nesting bounds are stated in the UI. Exact arithmetic intermediates are capped at 2048 bits.
- The real gain line is partitioned at every exact zero of a, P(+1), P(-1), a-c. Signs of these affine functions are constant in each open cell; one exact rational test point establishes its complete Jury classification. All candidate gains are excluded, and identically-zero constraints are separately explained. The sign test allows negative leading coefficients, so disconnected sets are retained.
- Numerical quadratic roots use a cancellation-resistant formula, and all finite roots plus missing roots at infinity/identically-zero feedback are listed. Unit-circle radius tolerance is 1e-8; near-zero leading coefficient warning is relative at 1e-10. Selected gain and locus-window bounds are [-100,100]. The exact interval result covers all real gains, including beyond the displayed window.
- The locus is explicitly a sampled illustration (401 samples), follows both roots by nearest-pair continuation, and breaks at/algebraically across a=0. The view follows selected roots, capped at extent 10, and reports omitted points. A gain bar shows stable components within the plot window; exact global intervals remain visible independently.
- The baseline yields 0<K<5/2; changing N to z+.5 yields a complex unit-circle pair at K=2 with theta=±120 degrees and strict set 0<K<2. The proposed biproper variation N=-z²+.5z, D=z² gives K<2/3 or K>2, with singular feedback at K=1. No source-transcription claim is made for that synthetic variation.

Verification completed in this private worktree (Node 24.22.1, installed npm CLI):

- `npm test -- src/modules/ds04`: **37/37 passed** (29 math/parser and 8 caller-state/lifecycle tests).
- `npm run check`: **passed**.
- `npm test`: **79/79 passed across 8 files** (this worktree's baseline is independent of pending DS03).
- `npm run build`: **passed**; existing MathLive chunk warning only.
- `git diff --check`: **passed**.

Independent tests include exact baseline/changed/disconnected sets, +1/-1/complex crossings, no-crossing affine equality, fixed boundary modes, nonminimal factors, all-real/empty sets, arbitrarily close rational critical gains, stable root residuals, degree-loss/identically-zero cases, numerical-locus segmentation and invalid inputs/work bounds. A raw floating root-radius assertion initially rounded a fixed z=1 root slightly inward; the invariant test now uses a justified 1e-10 disk margin, while the exact partition retains its zero constraint. Root ordering is compared as a set where appropriate.

Remaining acceptance work: actual browser QA of visual fields/fonts/Systems keyboard, input/edit/reset/reopen/rapid navigation, plots/crossings and narrow layout; repair any findings, record browser evidence and final checks, then create/attach one module PR and submit the tested SHA. Stage remains **in-progress**. Per coordinator scheduling, do not acquire a new QA slot until its DS03 integration-slot release notice. No DS04 preview or browser session has been started yet.

Additional numerical review before browser QA: exact coefficient/discriminant arithmetic now preserves close modes, including `(z-1)(z-(1-1e-8))`. Complex crossing angles use the exact half-angle quantities 1±cos(theta), avoiding acos rounding to zero near ±1. A regression at K=1e8 independently checks a genuine roughly 1e-8-radian crossing. The selected browser Number is interpreted through its decimal serialization for exact coefficient arithmetic; the stated 2048-bit intermediate resource bound applies. Small nonzero outputs are displayed without an arbitrary zero cutoff. The locus and gain bar use compact viewboxes for phone legibility, and crossing markers are restricted to the sampled gain window; exact global crossings remain listed separately. Latest module tests: 38/38; type check/build pass. Browser QA is still pending; the coordinator's reserved integration slot is finished, and the currently held normal slot belongs to DD04.

The coordinator's wider notation review found that other modules had misread visually typed `1e-2` as scientific notation. DS04 already rejects e/E in its polynomial grammar. A dedicated semantic regression now verifies rejection of that notation while accepting the decimal 0.01 as exactly 1/100. Numeric K controls are separate HTML number fields. Latest local test count is 39/39; no browser functionality is claimed from these tests.
