# CR04 implementation status

- **Stage:** in-progress
- **Last assessed:** 2026-10-29
- **Worker chat:** `01a186d2-2175-7122-ad9f-c01694059c6c`
- **Contract / ownership:** [TASK.md](TASK.md), `src/modules/cr04/**` only
- **Branch:** `codex/cr04-block-diagrams-2175`
- **Worktree:** `C:/Users/baokh/.codex/worktrees/cr04-block-diagrams-2175/CSDKTD APP`
- **Starting main:** `9d923d2f9a3728bdfd6516dd68aa06c93d9e7f86` (v0.3.9)

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

## Current evidence and remaining work

Only ownership/setup and this requirement/provenance audit are delivered. No computation, student interface, mathematical tests or browser exercise is yet claimed. All acceptance rows remain open. No CR04 preview, tab or shared QA reservation has been started. Use this chat's verified private in-app browser under current primary guidance for later QA; preserve the primary8787preview and all earlier frozen submissions. Coordinator review returns take priority after an honest checkpoint.
