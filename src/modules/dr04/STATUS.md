# DR04 implementation status

- **Stage:** implemented; independent maintainer verification pending.
- **Last assessed:** 2026-10-30.
- **Base:** `a43989def918052cc969cbee8691ce79d8824ec9`.
- **Contract:** [TASK.md](TASK.md), unchanged; index metadata unchanged.
- **Owner:** external contributor `ckbk456`, branch `codex/dr04-sampled-mason-20261030`.
- **Public reservation:** [upstream draft PR #56](https://github.com/ckbk123/CSDKTD_APP/pull/56), opened at `da84e1d` before substantial implementation. All open PR bodies/issues were checked before claiming and immediately after publication; no competing DR04 reservation or returned correction was found.

## Student exercise and acceptance

Students declare a physical sample/hold topology, convert it to a discrete graph, optionally predict the full output/input transfer, trace a connected path or elementary loop, and reveal a checked Mason reduction. The source model and arbitrary edited discrete graphs remain explicitly separate. Native endpoint selectors, editable gain equations, signal names, add/remove controls and ordered Trace buttons form the block/SFG editor; no dragging is required. Path/loop highlighting, signed gains, non-touching products, path cofactors, Delta and original node equations expose the reasoning.

The boundary editor distinguishes the continuous g/s -> 1/s cascade from a different physical chain with an intermediate sampler and ZOH. It labels continuous, discrete and boundary stages, the feedback sum, physical transport delay, input hold and output sampler. The original hold/plant is preserved rather than multiplying individually discretized integrators across a continuous connection.

Changing source data revokes and hides the previous converted graph until conversion. Editing a graph revokes its answer and marks it independent of the continuous source. Converting again restores the derived graph. A full transfer prediction is compared by exact rational equivalence; incomplete optional drafts are errors, while an intentional blank is allowed. The separate numeric audit checks original parsed-branch equations against the exact transfer at a regular complex z. Exact first impulse/step samples are shown only when a direct causal update is established. Reset/reopen start at the unconverted source baseline.

## Source provenance and declared interpretation

Given inputs are Gc(s)=5 exp(-.2s)/s^2, T=.2 s, H=.1 and u[k]=10 e[k]-2 e[k-1]. Original Ch7:22-29/S12 diagrams remain unavailable and uninspected. The feedback placement, immediate update and optional extra boundary are authored interpretations, not purported worksheet answers. The source parameters are preserved verbatim in metadata, and the tool distinguishes these anchors from authored variations and independent discrete-only fixtures.

Separately inspected primary references: [NPTEL sampled SFG](https://archive.nptel.ac.in/content/storage2/courses/108103008/module2/lec5/1.html) explains converting mixed analog/digital variables to discrete variables before Mason; [cascaded sampled elements](https://archive.nptel.ac.in/content/storage2/courses/108103008/module2/lec3/4a.html) distinguishes an intervening sampler; [ZOH](https://archive.nptel.ac.in/content/storage2/courses/108103008/module2/lec3/4.html) supplies the hold context. The specific intermediate-ZOH equations below are independently derived for this declared physical model rather than attributed to an uninspected original diagram.

## Exact model, units and timing

The continuous plant is g exp(-tau s)/s^2. g has units s^-2; T and tau are seconds. Signals and controller/sensor coefficients use normalized compatible units; z is dimensionless. The digital controller uses e[k]=r[k]+sign H y[k], sign=-1 by default, +1 for positive feedback or 0 for open feedback. It immediately applies u[k]=c0 e[k]+c1 e[k-1] at kT. The input ZOH holds that value on [kT,(k+1)T); there is no extra computational delay. All physical states, controller memory and transport-delay prehistory are zero. The output is y[k], rather than the scaled measurement H y[k].

Only exact integer transport ratios m=tau/T in {0,1,2} are supported. A fractional ratio is rejected without rounding. For physical states [v,y], with vdot=g u(t-tau), ydot=v, a held interval gives

`v[k+1]=v[k]+gT u[k-m]`

`y[k+1]=y[k]+T v[k]+gT^2 u[k-m]/2`.

Thus the undelayed whole-cascade pulse transfer is P0_whole=(gT^2/2)(z+1)/(z-1)^2 and P=z^-m P0. If an extra sampler/ZOH holds v[k] between the integrators, the last half-interval input term disappears: P0_split=gT^2/(z-1)^2. This product of separately held integrators describes that different physical chain. Controller C(z)=c0+c1 z^-1 remains causal, with its actual memory coefficient/sign preserved.

The converted graph has discrete signals R,E,U,D,Y,B and edges R->E:1; E->U:C(z); U->D:z^-m; D->Y:P0(z); Y->B:H; B->E:sign. Incoming edges sum, the externally imposed source has no incoming nonzero branch, and line crossings do not define connectivity. Edited graphs can use other signal names/endpoints/gains within the bounds below.

## Mason and independent checks

The stateless exact API enumerates forward paths, elementary loops once per canonical node rotation, all node-disjoint loop sets, Delta and each path cofactor, then computes sum(Pk Delta_k)/Delta. Exact Gaussian elimination of the independently assembled original node equations must give the same transfer. Identically singular equations are rejected even when a selected output might hide an undetermined internal signal. Branches first reduce as rational functions over Q[z]; removable points of unsimplified notation are not tracked. Cross-branch cancellation yields the zero-state transfer, without an internal-stability conclusion.

Internal polynomial arrays ascend in z; printed polynomials descend. Exact rational coefficients have no floating trimming. The direct-causal sample guard checks the instantaneous determinant (nonzero Delta at z=infinity) and proper node transfers. A formal transfer can exist despite a singular instantaneous sum or an advance; such cases receive an explanation without a sample table. The first eight impulse coefficients and cumulative step coefficients use an exact rational recurrence, so an unstable mode cannot create a fabricated floating trajectory. Any arithmetic/display failure during a reveal clears the entire partial answer and aborts its listeners before feedback; a regression covers rapidly growing exact samples and recovery.

A separate task-local Python Fraction reference, with no TypeScript imports or transfer recurrence, updated the original physical [v,y] states under delayed held controller values. At z=2, summing 220 physical impulse coefficients agreed with the independently reduced rational values to <1e-20. The reference/log stays outside Git; committed tests preserve its fixtures and the symbolic coefficients.

- Baseline m=1, P=(z+1)/[10z(z-1)^2], C=(10z-2)/z. Physical-output transfer is `(z^2+.8z-.2)/(z^4-2z^3+1.1z^2+.08z-.02)`; integer arrays ascending are N=[-10,40,50], D=[-1,4,55,-100,50]. At z=2 it is 270/227. Impulse samples start [0,0,1,14/5,43/10,136/25,2973/500,281/50], step [0,0,1,19/5,81/10,677/50].
- Adding the intermediate hold changes z=2 to 90/109 and first impulse samples to [0,0,0,2,18/5,26/5,32/5,174/25].
- Halving T while retaining the original tau=.2 yields m=2, a fifth-degree denominator, z=2 value 270/1627 and first samples [0,0,0,1/4,7/10,11/10,239/160,373/200].
- Positive feedback changes z=2 to 270/173; removing the transport delay changes it to 270/127. Both full first-sample sequences match the independent physical recurrence.
- Extra tests cover zero controller, open feedback, exact fractional parameters, non-touching/cofactor combinations, disconnected output, singular loops, numeric poles/poor conditioning, malformed notation and bounded work. The adapted nested/disjoint graph fixtures are authored discrete exercises, not the DR04 physical source topology.

## Supported limits

- g .1..1000; T .01..1 s; tau 0..2 s with exact ratio 0/1/2; H 0..10; c0,c1 -1000..1000. Reduced scalar numerator/denominator magnitude <=1e9. Source boxes lexically forbid z, even in expressions that would cancel it.
- Graph: 2..7 distinct signal names, each a letter plus at most seven letters/digits; 1..16 uniquely identified branches. Each parsed branch is proper rational degree <=2. Source and target differ.
- Visual math: complete fractions, visible parentheses, explicit products and integer powers -6..6; maximum 256 characters, 96 atoms, depth 12, 48 digits per literal and 24 decimal places. Prediction degree <=16, including a formal improper prediction. Variables other than graph/prediction z, e notation, hidden brace grouping, spacing arguments, ambiguous adjacency and incomplete notation are rejected.
- Enumeration: 10,000 visits, 128 paths/loops and 256 non-touching sets in the private helper. The exercise accepts a complete readable reveal of <=16 paths, <=16 loops and <=32 sets; larger results receive feedback.
- Exact arithmetic: 200,000 operation budget per normal work context, 30,000 in parsing; coefficient size <=2048 bits, polynomial degree <=64, display LCM <=4096 bits and <=8192 equation characters. Exact series supports at most 12 samples internally and displays eight. Resource failures do not leave a partial answer.
- Optional numeric audit uses dimensionless |z|<=100, retains poles of individual simplified branches, and rejects guarded pivots below 1e-11 relative scale or ill-conditioned evaluation. Scaled equation residual <=1e-9 and relative transfer discrepancy <=1e-8 are required. Audit failure preserves the independently valid exact symbolic answer, without retaining an old numeric value.

## Validation completed

- Supported Node 24.19.0/npm 10.9.3; locked installation; no dependency changes.
- `npm test -- src/modules/dr04`: **88 tests / 4 files passed** (46 adapted algebra/Mason, 21 physical-model/grammar, 15 interaction/resource, 6 deferred lifecycle).
- `npm run check`: passed.
- `npm test`: **4,780 tests / 223 files passed** after the final resource-error correction.
- `npm run build`: passed; only the existing shared MathLive >500 kB chunk advisory remains.
- Actual production-preview desktop 1280x900 and phone 390x844: exact full fourth-order prediction entered using fraction/power buttons and graded equivalent; exact T=1/5; controller 10-2z^-1 entered with the negative-power tool; all physical/timing/sign presets and z=2 numeric audits matched the independent values. Tested path tracing/highlighting, non-touching and touching loop pairs, adding/removing branches, endpoints and signal names, and a free graph producing a formal advance without a causal table.
- Actual invalid/recovery checks: unfinished prediction fraction, unsupported fractional transport delay (no rounding), native unfinished e and 1e-999, error without stale calculation, and recovery to source inputs. Native audit failure preserved the exact transfer while revoking its previous numeric value.
- Phone: document client/scroll widths 375/375; graph client/scroll 276/800 and exact-sample table 276/510, both panned by keyboard. Read-only equations have keyboard focus/scroll and human accessible labels (transfer client 278/scroll 336). Numeric and Systems keyboard layouts work. Reset with keyboard open restored seven fields, no table and keyboard toggle false. Source anchors/limits remain readable white panels.
- Immediate post-reload exit and three cached rapid-navigation cycles left the next page with zero DR04 roots and zero math fields. Reopening restored seven source/prediction fields and no prior result. Deterministic deferred-import tests cover loading, abort before/after resolution, import failure, partial view resources, reentrancy and repeated cleanup. Browser warning/error logs were empty. Own preview/tab are closed and viewport reset.
- Final staged whitespace/scope checks precede commit. Original metadata/TASK and shared/global files are unchanged; final global curated-source tests pass.
- Coordination scripts are unchanged. Earlier **32/32** helper tests (511.1 s, task-local cd07-agent-tests.log) are reused rather than claimed as rerun: agent-claim.mjs blob `64bd6ba343a7e0e4c8c2837539e6fd278c95de07`, agent-claim.node-test.mjs blob `3f0ee4448a38d39d8d0c9661d0047e03e1fca6f2`.

## Ownership, reuse and remaining gates

Only src/modules/dr04/** changes: this STATUS, workspace lifecycle, private exact algebra/Mason/parser/fixtures/diagram, physical converter/series, view/style and four test files. Exact helpers are private compatible adaptations from CR05 at the recorded base; variable formatting/parsing, delay powers, bounds and domain-specific conversion are DR04-owned. There is no sibling runtime import or shared model state. Per-row and per-answer abort lifetimes release editors/listeners on removal/reveal failure, while mount cleanup releases all remaining resources. No accounts, persistence, export, runtime API server, package/global/release/deployment changes are added.

Integration-owner request: assign a separately owned variable-neutral exact rational/Mason API before extracting common stateless helpers into shared math. Preserve existing continuous CR05 behavior and module-owned parsing/formatting. Private copies have no runtime/package blocker. Independent maintainer verification and exact-head upstream CI remain pending; PR #56 stays draft for those gates. No merge or deployment is performed.

## Coordinator-assigned signed-zero exponent correction — 30 October 2026

An independent review of frozen PR #56 head `3125905de603454b2b43916a861d85f86a8fc56d` reproduced ordinary browser typing of `0^{-0}` being accepted as 1, although `0^0` was rejected. The coordinator assigned only this correction, relevant tests and this record. Local branch `codex/dr04-zero-exponent-fix-01a186d2` starts directly at that head in `C:/Users/baokh/.codex/worktrees/dr04-review-pr56-01a186d2/CSDKTD APP`. The external fork branch and primary/coordinator integration checkouts are untouched.

`input.ts` now converts the validated integer exponent to a number before applying the zero-base guard. Both zero signs therefore reject zero to the zeroth power. No other grammar, arithmetic, graph or interface behavior changes. Pure regressions cover literal/algebraically zero negative-zero powers and a nested fraction, with independent exact coefficient controls for `2^{-0}`, `2^{-1}`, `(-2)^{-3}`, `z^{-2}` and `0^2`.

Caller-state UI regressions start from a solved baseline, edit either branch b1 or source plant gain to ordinary `0^0` or `0^{-0}`, and confirm old samples/results are revoked. Invalid source conversion stays hidden; invalid graph solving also revokes the old numeric-audit model. Correcting the input to a valid reciprocal or a nonzero base to exponent −0 recovers independently expected first samples. These tests use the existing mock editor and do not claim a new interactive-browser run.

Before the production fix the new tests reproduced **five failures**: three pure signed-zero cases and the graph/source signed-zero UI cases. After the fix, `npm test -- src/modules/dr04` passes **100 tests / four files**, and `npm run check` passes. `git diff --check` passes. The earlier 88-test/build/browser evidence above belongs to the external source revision; no full application/build or fresh browser run is claimed for this focused correction. The coordinator owns final inspection, combined integration checks and browser/release gates.

This is a local committed correction handoff only: no push, new PR, PR metadata change, version change or deployment. Its exact commit is reported in the worker chat for the coordinator to inspect and stage while preserving source history.
