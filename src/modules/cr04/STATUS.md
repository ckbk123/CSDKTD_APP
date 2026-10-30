# CR04 current external reservation — 30 October 2026

- **Stage:** in-progress; reserve completion of the missing teaching interface.
- **Base:** `a43989def918052cc969cbee8691ce79d8824ec9` (v0.3.14).
- **Owner:** external contributor `ckbk456`, branch `codex/cr04-block-diagram-editor-20261030`.
- **Scope:** `src/modules/cr04/**`; preserve the integrated exact core and its mathematical tests.

The latest FINAL_HANDOFF explicitly permits resuming CR04 on a fresh branch/PR. The former worker's PR #45 and branch remain preserved. Current upstream still has the partial core and a blank workspace. All open PR bodies and issues were checked: no competing CR04 reservation and no returned correction to this contributor's earlier submissions was found. This checkpoint changes only this audit, before substantial new implementation.

Complete the full TASK: structured block/port/signed-summer/junction editing, selected reference/disturbance channels, local series/parallel/feedback and compensated summer/pickoff transformations, checked prediction/application with before/after equations and changed-signal highlighting, undo plus dragging/numeric coordinates, lifecycle isolation and actual desktop/phone validation. Every accepted transformation must preserve both retained scalar output channels. Do not weaken the core or discard the proposed disturbance channel to make a reduction work.

Original Ch2/S03/W03 image assets remain unavailable and uninspected. Preserve the existing source/audit/proposed distinctions. This is a new public reservation for completing the current-main partial; it does not take over the stopped worker's branch or claim the previous partial was a completed exercise. All new implementation and validation gates remain pending. Metadata/TASK, shared/global/dependency/version/release/deployment files remain outside ownership.

The historical partial-core and integration records follow unchanged.

---
# CR04 implementation status

- **Stage:** in-progress
- **Last assessed:** 2026-10-29
- **Worker chat:** `01a186d2-2175-7122-ad9f-c01694059c6c`
- **Contract / ownership:** [TASK.md](TASK.md), `src/modules/cr04/**` only
- **Draft PR:** [#45 — Checkpoint CR04 exact diagram core; workspace unfinished](https://github.com/ckbk123/CSDKTD_APP/pull/45), attached; partial core checkpoint, complete exercise unfinished
- **Branch:** `codex/cr04-block-diagrams-2175`
- **Worktree:** `C:/Users/baokh/.codex/worktrees/cr04-block-diagrams-2175/CSDKTD APP`
- **Starting main:** `9d923d2f9a3728bdfd6516dd68aa06c93d9e7f86` (v0.3.9)
- **Checked implementation checkpoint:** `cc23c19f5a92ba0f55f8583891369e6baf06f93f`; subsequent commits only add this delivery/PR record. The exact final tested HEAD is retained in the claim and private worker ledger to avoid a self-referential commit hash in this file.

## Starting requirement audit

Current source inspection confirms an unchanged metadata entry and an empty synchronous workspace, with no local tests. No working feature is being replaced. CR04 was atomically claimed after CS02 PR#39 was submitted/frozen; a fresh managed worktree and unique branch from the exact recorded main baseline were registered. Earlier submitted branches/worktrees are preserved for asynchronous review. Current primary AGENTS, START_HERE, AUTONOMOUS_WORKERS and COORDINATION were read, together with the contributing/development/design/equation-input guides and the CR04 atlas/audit entry. The shared math folder has no installed solver backend. Locked Node24 dependencies are installed inside this worktree without package/lockfile changes.

| Accepted requirement | Starting evidence | Work still required |
|---|---|---|
| Construct a structured scalar diagram | Metadata only | Editable blocks, signed summer input ports, explicit junctions, sources and output; topology independent of geometry |
| Series, parallel and feedback reduction | TASK/course audit gives rules and nested fixture | Select legal local motifs, predict/check an equivalent block and show before/after signal equations |
| Compensated summer and pickoff movement | Audit requires preserving affected paths/channels | Both movement directions with student-supplied side gain, affected-signal highlighting, exact rejection of wrong compensation and legal application |
| Selected reference/disturbance transfer | No solver | Direct exact signal-equation solution, selected scalar channel with the other input zero, retain both output channels after every accepted transformation |
| Course nested-loop example and variation | Audit R5 records G1,G2,H2,H1 and expected inner/overall | Independently derive inner1/(s+4), overall1/(s²+5s+5), changed H2=3 inner1/(s+5); label added disturbance location as proposed |
| Numeric entry, dragging and undo | Empty mount | Selected-node coordinates/keyboard controls plus pointer dragging, bounded reversible history and baseline reset |
| Displayed mathematical meaning | Shared editor/display available | Bounded local rational-expression parser preserving raw fraction/power argument scope, mixed-number rejection and visible grouping |
| Bounds and failure feedback | No implementation | Explicit graph/port/order/arithmetic limits, incomplete ports, zero division/inverse and nonunique signal equations; no fake result |
| Lifecycle and accessibility | Empty synchronous mount | Owned child signal/loading wrapper, editor/pointer cleanup, fresh per-visit state, readable narrow diagram and keyboard alternatives |
| Verification/delivery | No local checks or PR | Independent mathematical fixtures, changed/failure cases, project checks and actual private-browser checks, then one attached PR/exact clean submission |

## Intended bounded implementation

Build a small editable directed scalar block diagram rather than a canned nested-loop formula. Two independent named sources r,d support one-at-a-time SISO transfer selection; Y remains the retained scalar output. Each block multiplies its one input by a real rational function of s; a summer adds its signed input ports and a junction copies its one input. Explicit edge endpoints/junction dots define connectivity; moving a drawing or crossing lines cannot connect signals.

A private exact rational-function linear solver will assemble all internal signal equations and solve both r→Y and d→Y. Legal local reductions and compensated summer/pickoff moves will construct a candidate diagram, compare both output channels exactly, and apply only a checked equivalent transformation. Removed/redefined internal signals must be distinguished from retained output channels. Add adjacent-summer flattening as needed to complete the nested reduction without silently discarding a disturbance branch. Series/parallel/feedback and both junction-movement directions remain accepted work, not optional follow-up scope.

Provisional graph limits are twelve non-source nodes, two sources, twenty-four input ports and four signed inputs per summer. Student block numerator/denominator degree at most3; formal inverse compensation may be improper and must be explicitly labeled as signal algebra rather than a standalone causal realization or stability proof. Exact reduced functions/intermediate degree, bit and operation bounds will be enforced and finalized by tests. Zero initial conditions and Laplace-domain scalar algebra apply; s is in inverse seconds and gains carry compatible signal units. This tool does not infer internal stability from a canceled external transfer.

Visual transfer-function entry, prediction/check/reveal, selected-block and connection editing, position controls, dragging and undo are planned as caller-owned state. No sibling imports, shared API changes or dependencies are needed. Routine implementation details remain local; exact supported limits will replace provisional values before completion.

## Provenance and independent expected fixtures

The recorded continuous audit R5 and atlas entry were inspected. Ch2:38–42 anchors scalar series/parallel/feedback algebra, Ch2:43–62 worked reductions, and S03:4–5,7–11/W03 nested loops. Original diagrams remain outside Git and were not newly inspected. The audit cautions against claiming an image-only topology was visually transcribed.

Adopt the explicitly described nested connection: E1=R−H1Y, U=G1E1, E2=U−H2Y, Y=G2E2. Its algebra gives inner B=G2/(1+G2H2), and Y/R=G1G2/(1+G2H2+G1G2H1). The source values G1=1/(s+1),G2=1/(s+2),H2=2,H1=1 independently give B=1/(s+4), Y/R=1/(s²+5s+5); H2=3 gives B=1/(s+5), Y/R=1/(s²+6s+6).

A proposed disturbance is added with positive sign at E2, not claimed as an inspected source port. For this declared location, Y/D=G2/(1+G2H2+G1G2H1), which is(s+1)/(s²+5s+5) at baseline and(s+1)/(s²+6s+6) when H2=3. Every reduction must retain both scalar output channels. Additional independent series/parallel, signed feedback, compensated-move, wrong-side-gain and singular fixtures remain to be implemented/tested.

Primary teaching references were inspected for the basic rules, separate from course provenance: [NTU Feng-Li Lian block-diagram slides, pages4–6](https://homepage.ntu.edu.tw/~fengli/Teaching/ControlSystems/110-1_CS3B_BlockDiagram.pdf) and [University of Washington block-diagram simplification lecture](https://faculty.washington.edu/chx/teaching/fbintro/lec02-block-diagram-simplification/). These inform independently derived local identities; they are not runtime solvers or dependencies. No external diagrams/assets are being copied into the application.

## Initial audit checkpoint

At the first checkpoint only ownership/setup and this audit were delivered; no computation, student interface, mathematical tests or browser exercise was then claimed. The implementation checkpoint below supersedes that initial state. No CR04 preview, tab or shared QA reservation has been started. Preserve the primary8787preview and all earlier frozen submissions.

## Partial implementation and stop handoff

The human's stop-after-current amendment arrived after CR04 was claimed and implementation began. It supersedes the earlier continuous-next-module loop. This contribution is deliberately **partial**, not implemented or verified: the core is recoverable and checked, while the full accepted student workspace and browser validation remain unfinished. No further module was claimed after that amendment. Do not integrate this draft as a finished teaching tool.

Delivered privately inside this folder:

- `algebra.ts`: immutable exact rational coefficients; ascending polynomials; bounded polynomial division/GCD; reduced real rational transfers with arithmetic, equality, evaluation and mathematical formatting. Components are bounded to4096bits, intermediate polynomial degree24 and reduced transfer numerator/denominator degree12. Inversion of a zero transfer and exhausted bounds give explicit errors. Exact cancellation is rational-function algebra, not internal-stability certification.
- `model.ts`: typed blocks, signed summer ports, copying junctions, two independent named sources and one retained scalar output. The direct signal-equation solver assembles and exactly solves both r→Y and d→Y with the other input zero. At most12non-source nodes,2sources,24input ports and4ports/summer; node coordinates x40..1460,y40..860. Incomplete/dangling ports, duplicate identities, bad dimensions/positions and nonunique equations report errors. Screen geometry has no mathematical effect. The default graph implements the declared nested loops and separately labeled proposed disturbance.
- `operations.ts`: enumerates self-contained series, signed parallel and feedback motifs; adjacent-summer flattening; compensated summer and explicit-pickoff movements in both directions. Each candidate carries its local identity/expected gain and constructs a candidate graph. `previewOperation` independently solves before/after graphs, compares both retained output channels exactly and reports changed/redefined and removed internal signals. A proposal is correct only when its local gain and both external channels agree. The future UI must gate application on `preview.correct`; a wrong candidate remains preview data, never silently committed as equivalent. Supported local motifs require no collateral branch from a block/removed signal; zero inverse moves are omitted. Broader topology/parameter edge coverage remains pending.
- `parser.ts`: bounded real rational entry in s, sums/products/division, visible parentheses and proper compact/braced/nested fractions; raw fraction/power argument scope is checked before spacing removal. Unsupported mixed numbers, spacing fusion, hidden grouping, ambiguous exponent tails and unbraced parenthesized powers are rejected. Limits:600characters,256expanded tokens,16nested groups, exponents0..12, block literals12digits/8decimal places, reduced block numerator/denominator degree≤3 and coefficient parts≤10¹²/magnitude≤10⁶. Answers separately allow60digits/40decimal places and reduced degree≤12. Other variables/functions/e notation and zero division are unsupported. The parser is not yet connected to an actual editor.

### Current independent checks

`npm test -- src/modules/cr04` passes17/17tests across4files. Fixtures independently establish baseline/changed nested reference and disturbance channels, actual inner1/(s+4) or1/(s+5), the complete nested reduction with disturbance compensation retained, signed parallel difference1/((s+1)(s+2)), positive/negative feedback algebra, a wrong summer gain that preserves the reference channel but changes the disturbance channel, both movement directions, missing retained branches, exact near-cancellation, singular equations and malformed/unsupported notation. All transformations in the nested sequence are checked against both original scalar channels, not just a DC sample.

`npm run check` passes. `npm test` passes677/677tests across30files on this branch's v0.3.9 baseline. `npm run build` passes with the existing MathLive large-chunk warning. `git diff --check` passes. These checks establish the delivered pure core/type integration, not a working CR04 exercise: `workspace.ts` is still the original blank mount and does not import this core. No mocked editor or browser evidence is claimed. No independent technical review has certified this partial core.

### Exact next steps for an authorized resumption

1. Reassess this preserved worktree/branch, current primary guides and claim disposition. Add changed-sign/multiport, graph/resource-bound and transformation-edge fixtures as needed; retain the existing independent reference/disturbance oracle. Check formal inverse/improper compensation and canceled-transfer limits explicitly.
2. Build the complete bounded structured diagram workspace: select/add/delete block/summer/junction nodes, edit source/sign input ports and visual block transfers, retain r,d,Y, draw directional ports/junction dots and distinguish geometric crossings. No arbitrary freehand connectivity should be inferred.
3. Add prediction/check/reveal for local equivalent/compensating gains and the selected external transfer. Show actual before/after signal equations, both channel comparisons and changed/removed internal signals. Apply only checked equivalent operations. Include source/changed-H2 and series/parallel/movement experiments; do not stop at a canned nested-loop result.
4. Add pointer dragging with abort/capture cleanup, shared native-number coordinate entry, keyboard alternatives and bounded undo snapshots. Keep the two-source one-at-a-time SISO interpretation, units, zero-state/formal inverse assumptions and all arithmetic/parser limits visible. No stability conclusion follows from a reduced scalar channel.
5. Implement the synchronous loading wrapper/child-signal failure cleanup and a caller-owned view with shared visual inputs/displays. Add meaningful workspace/lifecycle tests, then check the actual MathLive fonts/buttons/keyboard, stale-error clearing, changed inputs, reset/reopen/fast navigation, dragging/keyboard alternatives and narrow layouts in this chat's verified private browser context. No CR04 browser test has occurred yet.
6. Complete all accepted rows, rerun project/module/type/build checks, update this same PR and STATUS, then submit the exact clean tested HEAD only if the full bounded contract is actually complete. Otherwise retain the honest partial disposition. Preserve history; do not rebase/force-push, merge main, bump versions or deploy.

This branch will be recorded as `handoff --reason partial` at its clean pushed/tested checkpoint, with the token only in the private worker ledger. No runtime dependency/shared-helper request exists. No CR04 preview/tab/QA lock is open. Earlier CS02 PR#39, CS03 PR#26 and DS04 PR#13 remain separately submitted/frozen pending coordinator disposition; DS03 PR#2 was accepted previously. All their branches, worktrees and evidence are preserved. No new review work or further module will be started after this handoff.

## Prepared partial-core integration — 30 October 2026

The user requested preservation/merging of worked code, including honest partials. Frozen core checkpoint `ef360b4ad9da8182090eb04484f94edf7d23727e` is merged with preserved history as PARTIAL only. Independent review checked the exact rational scalar algebra, structured two-input one-at-a-time SISO equations, singular-system rejection and both retained channel checks on local reductions/moves. New proposed H2=0,4,7 fixtures independently verify reference1/[s^2+(3+H2)s+(3+H2)], disturbance(s+1) over the same denominator and the actual inner1/(s+2+H2).

Shared argument preflight is installed in the private parser with malformed command/Unicode/nested-delimiter controls and a supported boxed fraction. The frozen core's original17 tests remain historical evidence; integration adds9 tests for26 total, with TypeScript/diff checks passing. No new slide inspection or browser test occurred.

Stage remains IN-PROGRESS. workspace.ts remains the original blank mount, imports none of this core and produces no controls; an explicit inertness regression verifies that. The interface, prediction/reveal flow, editing/dragging/undo, explanation rendering, real equation input and all browser/lifecycle teaching gates listed above are unfinished. This preparation does not label CR04 implemented, verified, student-ready or a completed exercise. Root owns the final partial-integration disposition and any release notes.

## Final coordinator disposition — 0.3.14

Frozen source `ef360b4ad9da8182090eb04484f94edf7d23727e`, [PR #45](https://github.com/ckbk123/CSDKTD_APP/pull/45), is preserved in the integration history. Accepted as a partial core only. The workspace remains blank and displays Implementation pending. The complete interactive TASK, UI/lifecycle/browser exercise and missing steps above remain unfinished; no implemented/verified teaching-tool claim is made. A future contributor can resume the core from current main on a fresh branch/PR.

All **4,692 application tests, 32 coordination tests, type checking and production build pass** for the final combined candidate. [The final handoff](../../../docs/FINAL_HANDOFF.md) and [batch evidence](../../../docs/INTEGRATION_BATCHES.md) distinguish complete tools, this partial core and remaining scaffolds. Numerical qualification and supported-domain limitations remain explicit; independent checks of corrected propagation/phase are recorded there. No deployment occurred.
