# Agent implementation tasks

**Agent entry point: [START_HERE.md](START_HERE.md).** Read it for the product end goal, how to assess existing work and how to finish an assignment autonomously. [PROJECT_STATUS.md](PROJECT_STATUS.md) distinguishes delivered foundations from module implementation and defines completion stages.

**Browser assessment, 29 October 2026, v0.3.0.** The catalogue contained **56 independent scaffolds**, not 56 completed solvers. Every module has a stable `TASK.md` containing the full atlas exercise/interaction/check contract and baseline metadata, plus a module-owned `STATUS.md` recording current progress and evidence. The progress links below stay valid as implementation proceeds; inspect the record and actual code/tests before starting.

## Assign work with narrow ownership

For automatic selection, copy [WORKER_GOAL.txt](WORKER_GOAL.txt) unchanged into each local chat. It includes the exact primary checkout and directs each agent to continuously select/claim tractable unfinished modules, implement one at a time and submit one PR per module. Read current coordination guides from the primary checkout before each contribution; preserved branches can contain older instructions. The [worker protocol](AUTONOMOUS_WORKERS.md) covers atomic reservations, a fresh worktree/branch from current primary `main` for each contribution, checkpoints, browser QA, PR attachment/submission and review returns. The module index is the catalogue of accepted goals, not a requirement for manual ID assignment.

Each worker actively implements one claimed module folder at a time. After its checked PR and claim are submitted, preserve them for the coordinator and immediately choose another eligible module. Review corrections take priority over newer work and stay on the original PR/branch. Several agents can therefore cover the backlog without sharing implementation ownership. Shared dependencies still need clear owners; repeated contributions do not authorize broad edits to catalogue, types, packages or shared mathematics. Explicit single-module assignments can remain finite.

Copy one module's full TASK assignment, or use this template:

```text
Implement <ID> using src/modules/<idlower>/TASK.md as the acceptance contract. Start with AGENTS.md and docs/START_HERE.md. Audit STATUS.md against current code/tests, preserve what works and autonomously complete the missing accepted requirements. Own src/modules/<idlower>/**. Use shared visual equation inputs and preserve the metadata/lazy-workspace, synchronous mount/cleanup and per-visit baseline contracts. Independently verify the mathematics, meaningful local tests and real-browser behavior. Coordinate necessary shared changes. Update STATUS.md with requirement-level evidence, supported limits, exact checks and remaining work. Do not stop at a plan, claim unfinished requirements complete, deploy, add keys/servers or commit generated output.
```

`TASK.md` copies the mathematical goal for durability; [the atlas](EXERCISE_TOOL_ATLAS.md) remains the canonical course catalogue. Keep the two synchronized when the instructor changes an exercise. Source labels distinguish inspected course examples from proposed fixtures and synthesis/extension interfaces.

## Integration and shared mathematics

1. The integration owner maintains shell/routing/lifecycle/types, global styling, package dependencies and deployment.
2. A module agent identifies the smallest missing pure API: inputs/results, conventions, tolerances, failure statuses, size limits and independent tests. It requests an owner instead of changing a shared package/configuration unilaterally.
3. Assign shared stateless helpers in `src/shared/math/` to a named owner before dependents implement against them. Start with a small contract; do not make every module wait for a hypothetical complete MATLAB replacement.
4. Module agents can develop local controls, fixtures, pure calculations and tests while coordinated foundations progress. Promote genuinely reusable work deliberately; sibling-module imports remain prohibited.
5. Integrate a small representative slice, verify mathematics and browser lifecycle, then expand by subject block. Metadata scaffolds are not a reason to start 56 simultaneous solvers.

A practical foundation sequence is explicit scalar/complex arithmetic and polynomial conventions; checked low-order roots/rational operations; matrix conventions/linear solves; then time/frequency/state services as the first consuming exercises require them. Exact parameter algebra, graph enumeration, robust high-order roots and optional C/WebAssembly are separately scoped work. Pick initial tools based on pedagogical value and dependencies, rather than assuming numerical IDs are an implementation order.

## Searchable module index

Each row links the stable teaching brief and its current progress record. Domain/category headings match the student's catalogue. A progress link is not a certification that the tool works.

### Continuous / System Representation

| ID | Tool / full task | Owned folder | Status record |
|---|---|---|---|
| CR01 | [Expand, factor and interpret polynomials](../src/modules/cr01/TASK.md) | `src/modules/cr01/**` | [Progress](../src/modules/cr01/STATUS.md) |
| CR02 | [Derive a linear ODE and apply Laplace correctly](../src/modules/cr02/TASK.md) | `src/modules/cr02/**` | [Progress](../src/modules/cr02/STATUS.md) |
| CR03 | [Convert TF/ODE/state descriptions and canonical coordinates](../src/modules/cr03/TASK.md) | `src/modules/cr03/**` | [Progress](../src/modules/cr03/STATUS.md) |
| CR04 | [Construct and reduce a scalar block diagram](../src/modules/cr04/TASK.md) | `src/modules/cr04/**` | [Progress](../src/modules/cr04/STATUS.md) |
| CR05 | [Convert to SFG and apply Mason step by step](../src/modules/cr05/TASK.md) | `src/modules/cr05/**` | [Progress](../src/modules/cr05/STATUS.md) |
| CR06 | [Choose dynamic states and explain state response](../src/modules/cr06/TASK.md) | `src/modules/cr06/**` | [Progress](../src/modules/cr06/STATUS.md) |

### Continuous / Plots

| ID | Tool / full task | Owned folder | Status record |
|---|---|---|---|
| CP01 | [Construct a time response](../src/modules/cp01/TASK.md) | `src/modules/cp01/**` | [Progress](../src/modules/cp01/STATUS.md) |
| CP02 | [Explain pole modes and zero effects](../src/modules/cp02/TASK.md) | `src/modules/cp02/**` | [Progress](../src/modules/cp02/STATUS.md) |
| CP03 | [Measure sinusoidal gain and phase](../src/modules/cp03/TASK.md) | `src/modules/cp03/**` | [Progress](../src/modules/cp03/STATUS.md) |
| CP04 | [Build a Bode plot from factors](../src/modules/cp04/TASK.md) | `src/modules/cp04/**` | [Progress](../src/modules/cp04/STATUS.md) |
| CP05 | [Construct a Nyquist curve](../src/modules/cp05/TASK.md) | `src/modules/cp05/**` | [Progress](../src/modules/cp05/STATUS.md) |
| CP06 | [Construct a root locus and test its rules](../src/modules/cp06/TASK.md) | `src/modules/cp06/**` | [Progress](../src/modules/cp06/STATUS.md) |

### Continuous / Stability

| ID | Tool / full task | Owned folder | Status record |
|---|---|---|---|
| CS01 | [Classify poles, eigenmodes and boundaries](../src/modules/cs01/TASK.md) | `src/modules/cs01/**` | [Progress](../src/modules/cs01/STATUS.md) |
| CS02 | [Work through Routh and Hurwitz, including special cases](../src/modules/cs02/TASK.md) | `src/modules/cs02/**` | [Progress](../src/modules/cs02/STATUS.md) |
| CS03 | [Derive a complete stable parameter region](../src/modules/cs03/TASK.md) | `src/modules/cs03/**` | [Progress](../src/modules/cs03/STATUS.md) |
| CS04 | [Apply Nyquist with the correct loop and pole count](../src/modules/cs04/TASK.md) | `src/modules/cs04/**` | [Progress](../src/modules/cs04/STATUS.md) |
| CS05 | [Find stable gains on a root locus](../src/modules/cs05/TASK.md) | `src/modules/cs05/**` | [Progress](../src/modules/cs05/STATUS.md) |

### Continuous / Performance

| ID | Tool / full task | Owned folder | Status record |
|---|---|---|---|
| CF01 | [Measure transient requirements and test pole predictions](../src/modules/cf01/TASK.md) | `src/modules/cf01/**` | [Progress](../src/modules/cf01/STATUS.md) |
| CF02 | [Derive steady-state error and system type](../src/modules/cf02/TASK.md) | `src/modules/cf02/**` | [Progress](../src/modules/cf02/STATUS.md) |
| CF03 | [Compare integral error criteria and control effort](../src/modules/cf03/TASK.md) | `src/modules/cf03/**` | [Progress](../src/modules/cf03/STATUS.md) |
| CF04 | [Read margins, crossovers, resonance and bandwidth](../src/modules/cf04/TASK.md) | `src/modules/cf04/**` | [Progress](../src/modules/cf04/STATUS.md) |
| CF05 | [Test time/frequency performance relationships](../src/modules/cf05/TASK.md) | `src/modules/cf05/**` | [Progress](../src/modules/cf05/STATUS.md) |

### Continuous / Controller Design

| ID | Tool / full task | Owned folder | Status record |
|---|---|---|---|
| CD01 | [Choose and tune an LTI P/PI/PD/PID structure](../src/modules/cd01/TASK.md) | `src/modules/cd01/**` | [Progress](../src/modules/cd01/STATUS.md) |
| CD02 | [Design lead compensation using root locus](../src/modules/cd02/TASK.md) | `src/modules/cd02/**` | [Progress](../src/modules/cd02/STATUS.md) |
| CD03 | [Design lag compensation using root locus](../src/modules/cd03/TASK.md) | `src/modules/cd03/**` | [Progress](../src/modules/cd03/STATUS.md) |
| CD04 | [Allocate requirements between lead and lag](../src/modules/cd04/TASK.md) | `src/modules/cd04/**` | [Progress](../src/modules/cd04/STATUS.md) |
| CD05 | [Design lead using frequency response](../src/modules/cd05/TASK.md) | `src/modules/cd05/**` | [Progress](../src/modules/cd05/STATUS.md) |
| CD06 | [Design lag or lead–lag using frequency response](../src/modules/cd06/TASK.md) | `src/modules/cd06/**` | [Progress](../src/modules/cd06/STATUS.md) |
| CD07 | [Apply and evaluate a named PID tuning rule](../src/modules/cd07/TASK.md) | `src/modules/cd07/**` | [Progress](../src/modules/cd07/STATUS.md) |
| CD08 | [Design SISO state feedback and reference tracking](../src/modules/cd08/TASK.md) | `src/modules/cd08/**` | [Progress](../src/modules/cd08/STATUS.md) |
| CD09 | [Design a Luenberger observer and combine feedback](../src/modules/cd09/TASK.md) | `src/modules/cd09/**` | [Progress](../src/modules/cd09/STATUS.md) |

### Discrete / System Representation

| ID | Tool / full task | Owned folder | Status record |
|---|---|---|---|
| DR01 | [Connect sequences with Z transforms](../src/modules/dr01/TASK.md) | `src/modules/dr01/**` | [Progress](../src/modules/dr01/STATUS.md) |
| DR02 | [Derive and execute a difference equation](../src/modules/dr02/TASK.md) | `src/modules/dr02/**` | [Progress](../src/modules/dr02/STATUS.md) |
| DR03 | [Construct discrete state models and delay states](../src/modules/dr03/TASK.md) | `src/modules/dr03/**` | [Progress](../src/modules/dr03/STATUS.md) |
| DR04 | [Reduce sampled diagrams and apply discrete Mason](../src/modules/dr04/TASK.md) | `src/modules/dr04/**` | [Progress](../src/modules/dr04/STATUS.md) |
| DR05 | [Derive a sampled model using a declared hold](../src/modules/dr05/TASK.md) | `src/modules/dr05/**` | [Progress](../src/modules/dr05/STATUS.md) |

### Discrete / Plots

| ID | Tool / full task | Owned folder | Status record |
|---|---|---|---|
| DP01 | [Plot sequences and interpret modal behavior](../src/modules/dp01/TASK.md) | `src/modules/dp01/**` | [Progress](../src/modules/dp01/STATUS.md) |
| DP02 | [Map continuous poles and discrete modes](../src/modules/dp02/TASK.md) | `src/modules/dp02/**` | [Progress](../src/modules/dp02/STATUS.md) |
| DP03 | [Construct discrete Bode/Nyquist and W-plane views](../src/modules/dp03/TASK.md) | `src/modules/dp03/**` | [Progress](../src/modules/dp03/STATUS.md) |
| DP04 | [Construct a discrete root locus](../src/modules/dp04/TASK.md) | `src/modules/dp04/**` | [Progress](../src/modules/dp04/STATUS.md) |

### Discrete / Stability

| ID | Tool / full task | Owned folder | Status record |
|---|---|---|---|
| DS01 | [Classify discrete pole/eigenvalue stability](../src/modules/ds01/TASK.md) | `src/modules/ds01/**` | [Progress](../src/modules/ds01/STATUS.md) |
| DS02 | [Apply Jury conditions and build the table](../src/modules/ds02/TASK.md) | `src/modules/ds02/**` | [Progress](../src/modules/ds02/STATUS.md) |
| DS03 | [Transform the disk and apply Routh](../src/modules/ds03/TASK.md) | `src/modules/ds03/**` | [Progress](../src/modules/ds03/STATUS.md) |
| DS04 | [Derive stable gain intervals on a discrete locus](../src/modules/ds04/TASK.md) | `src/modules/ds04/**` | [Progress](../src/modules/ds04/STATUS.md) |
| DS05 | [Explain discrete Nyquist stability](../src/modules/ds05/TASK.md) | `src/modules/ds05/**` | [Progress](../src/modules/ds05/STATUS.md) |

### Discrete / Performance

| ID | Tool / full task | Owned folder | Status record |
|---|---|---|---|
| DF01 | [Measure sampled transient specifications](../src/modules/df01/TASK.md) | `src/modules/df01/**` | [Progress](../src/modules/df01/STATUS.md) |
| DF02 | [Derive discrete error constants with physical time](../src/modules/df02/TASK.md) | `src/modules/df02/**` | [Progress](../src/modules/df02/STATUS.md) |
| DF03 | [Read sampled-loop frequency requirements](../src/modules/df03/TASK.md) | `src/modules/df03/**` | [Progress](../src/modules/df03/STATUS.md) |
| DF04 | [Compare sample periods and discrete quality indices](../src/modules/df04/TASK.md) | `src/modules/df04/**` | [Progress](../src/modules/df04/STATUS.md) |

### Discrete / Controller Design

| ID | Tool / full task | Owned folder | Status record |
|---|---|---|---|
| DD01 | [Emulate a continuous LTI controller](../src/modules/dd01/TASK.md) | `src/modules/dd01/**` | [Progress](../src/modules/dd01/STATUS.md) |
| DD02 | [Design lead and lag directly in the z plane](../src/modules/dd02/TASK.md) | `src/modules/dd02/**` | [Progress](../src/modules/dd02/STATUS.md) |
| DD03 | [Design using discrete frequency and W-plane methods](../src/modules/dd03/TASK.md) | `src/modules/dd03/**` | [Progress](../src/modules/dd03/STATUS.md) |
| DD04 | [Derive and single-step a digital PID](../src/modules/dd04/TASK.md) | `src/modules/dd04/**` | [Progress](../src/modules/dd04/STATUS.md) |
| DD05 | [Design a digital PID analytically](../src/modules/dd05/TASK.md) | `src/modules/dd05/**` | [Progress](../src/modules/dd05/STATUS.md) |
| DD06 | [Place discrete state poles and set tracking gain](../src/modules/dd06/TASK.md) | `src/modules/dd06/**` | [Progress](../src/modules/dd06/STATUS.md) |
| DD07 | [Design a sampled Luenberger observer](../src/modules/dd07/TASK.md) | `src/modules/dd07/**` | [Progress](../src/modules/dd07/STATUS.md) |

## Per-module handoff

A submitted module should report its one PR URL, exact tested commit, supported exercise flow/domain, baseline/changed-data/edge-case verification, exact type/test/build results, real-browser editing/reset/reopen/cleanup checks, changed files and unresolved limits. Record the PR URL in the owned `STATUS.md` and attach every PR created or worked on in the app. The coordinator reviews and versions accepted integrations separately. Submission is a milestone in the continuous generic goal; next-module work can proceed while prior claims/worktrees remain available for review. A temporary queue with all work reserved is not backlog completion, and budget-limited partial work stays partial. See [PROJECT_STATUS.md](PROJECT_STATUS.md) for stages and [CONTRIBUTING.md](CONTRIBUTING.md) for quality requirements.
