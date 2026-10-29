# Agent implementation tasks

**Browser milestone, 29 October 2026.** The catalogue contains **56 independent scaffolds**, not 56 completed solvers. Every module has a durable `TASK.md` with a copyable assignment containing the full atlas exercise/interaction/check contract and its baseline metadata. These tasks implement the accepted SISO LTI course; they do not add menus or application-wide infrastructure.

## Assign work with narrow ownership

Assign one module folder to one agent. Several agents may work in parallel on different folders after shared dependencies have clear owners. Do not issue a broad parallel assignment to “implement all modules”: it invites changes to the same catalogue, types, dependencies and shared mathematics.

Copy one module's full TASK assignment, or use this template:

```text
Implement <ID> using src/modules/<idlower>/TASK.md as the complete acceptance contract. Own only src/modules/<idlower>/**. Read AGENTS.md and docs/CONTRIBUTING.md. Preserve the metadata/lazy-workspace boundary, synchronous mount/cleanup contract and per-visit baseline. Implement and independently verify the exercise mathematics, meaningful local Vitest tests and real-browser checks. Coordinate shared helper/dependency requests; do not edit the shell, another module or global configuration. Report supported limits, exact checks and remaining issues. Do not deploy, add keys/servers or commit generated output.
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

Every link below opens the module's complete brief. Domain/category headings match the student's catalogue.

### Continuous / System Representation

| ID | Tool / full task | Owned folder |
|---|---|---|
| CR01 | [Expand, factor and interpret polynomials](../src/modules/cr01/TASK.md) | `src/modules/cr01/**` |
| CR02 | [Derive a linear ODE and apply Laplace correctly](../src/modules/cr02/TASK.md) | `src/modules/cr02/**` |
| CR03 | [Convert TF/ODE/state descriptions and canonical coordinates](../src/modules/cr03/TASK.md) | `src/modules/cr03/**` |
| CR04 | [Construct and reduce a scalar block diagram](../src/modules/cr04/TASK.md) | `src/modules/cr04/**` |
| CR05 | [Convert to SFG and apply Mason step by step](../src/modules/cr05/TASK.md) | `src/modules/cr05/**` |
| CR06 | [Choose dynamic states and explain state response](../src/modules/cr06/TASK.md) | `src/modules/cr06/**` |

### Continuous / Plots

| ID | Tool / full task | Owned folder |
|---|---|---|
| CP01 | [Construct a time response](../src/modules/cp01/TASK.md) | `src/modules/cp01/**` |
| CP02 | [Explain pole modes and zero effects](../src/modules/cp02/TASK.md) | `src/modules/cp02/**` |
| CP03 | [Measure sinusoidal gain and phase](../src/modules/cp03/TASK.md) | `src/modules/cp03/**` |
| CP04 | [Build a Bode plot from factors](../src/modules/cp04/TASK.md) | `src/modules/cp04/**` |
| CP05 | [Construct a Nyquist curve](../src/modules/cp05/TASK.md) | `src/modules/cp05/**` |
| CP06 | [Construct a root locus and test its rules](../src/modules/cp06/TASK.md) | `src/modules/cp06/**` |

### Continuous / Stability

| ID | Tool / full task | Owned folder |
|---|---|---|
| CS01 | [Classify poles, eigenmodes and boundaries](../src/modules/cs01/TASK.md) | `src/modules/cs01/**` |
| CS02 | [Work through Routh and Hurwitz, including special cases](../src/modules/cs02/TASK.md) | `src/modules/cs02/**` |
| CS03 | [Derive a complete stable parameter region](../src/modules/cs03/TASK.md) | `src/modules/cs03/**` |
| CS04 | [Apply Nyquist with the correct loop and pole count](../src/modules/cs04/TASK.md) | `src/modules/cs04/**` |
| CS05 | [Find stable gains on a root locus](../src/modules/cs05/TASK.md) | `src/modules/cs05/**` |

### Continuous / Performance

| ID | Tool / full task | Owned folder |
|---|---|---|
| CF01 | [Measure transient requirements and test pole predictions](../src/modules/cf01/TASK.md) | `src/modules/cf01/**` |
| CF02 | [Derive steady-state error and system type](../src/modules/cf02/TASK.md) | `src/modules/cf02/**` |
| CF03 | [Compare integral error criteria and control effort](../src/modules/cf03/TASK.md) | `src/modules/cf03/**` |
| CF04 | [Read margins, crossovers, resonance and bandwidth](../src/modules/cf04/TASK.md) | `src/modules/cf04/**` |
| CF05 | [Test time/frequency performance relationships](../src/modules/cf05/TASK.md) | `src/modules/cf05/**` |

### Continuous / Controller Design

| ID | Tool / full task | Owned folder |
|---|---|---|
| CD01 | [Choose and tune an LTI P/PI/PD/PID structure](../src/modules/cd01/TASK.md) | `src/modules/cd01/**` |
| CD02 | [Design lead compensation using root locus](../src/modules/cd02/TASK.md) | `src/modules/cd02/**` |
| CD03 | [Design lag compensation using root locus](../src/modules/cd03/TASK.md) | `src/modules/cd03/**` |
| CD04 | [Allocate requirements between lead and lag](../src/modules/cd04/TASK.md) | `src/modules/cd04/**` |
| CD05 | [Design lead using frequency response](../src/modules/cd05/TASK.md) | `src/modules/cd05/**` |
| CD06 | [Design lag or lead–lag using frequency response](../src/modules/cd06/TASK.md) | `src/modules/cd06/**` |
| CD07 | [Apply and evaluate a named PID tuning rule](../src/modules/cd07/TASK.md) | `src/modules/cd07/**` |
| CD08 | [Design SISO state feedback and reference tracking](../src/modules/cd08/TASK.md) | `src/modules/cd08/**` |
| CD09 | [Design a Luenberger observer and combine feedback](../src/modules/cd09/TASK.md) | `src/modules/cd09/**` |

### Discrete / System Representation

| ID | Tool / full task | Owned folder |
|---|---|---|
| DR01 | [Connect sequences with Z transforms](../src/modules/dr01/TASK.md) | `src/modules/dr01/**` |
| DR02 | [Derive and execute a difference equation](../src/modules/dr02/TASK.md) | `src/modules/dr02/**` |
| DR03 | [Construct discrete state models and delay states](../src/modules/dr03/TASK.md) | `src/modules/dr03/**` |
| DR04 | [Reduce sampled diagrams and apply discrete Mason](../src/modules/dr04/TASK.md) | `src/modules/dr04/**` |
| DR05 | [Derive a sampled model using a declared hold](../src/modules/dr05/TASK.md) | `src/modules/dr05/**` |

### Discrete / Plots

| ID | Tool / full task | Owned folder |
|---|---|---|
| DP01 | [Plot sequences and interpret modal behavior](../src/modules/dp01/TASK.md) | `src/modules/dp01/**` |
| DP02 | [Map continuous poles and discrete modes](../src/modules/dp02/TASK.md) | `src/modules/dp02/**` |
| DP03 | [Construct discrete Bode/Nyquist and W-plane views](../src/modules/dp03/TASK.md) | `src/modules/dp03/**` |
| DP04 | [Construct a discrete root locus](../src/modules/dp04/TASK.md) | `src/modules/dp04/**` |

### Discrete / Stability

| ID | Tool / full task | Owned folder |
|---|---|---|
| DS01 | [Classify discrete pole/eigenvalue stability](../src/modules/ds01/TASK.md) | `src/modules/ds01/**` |
| DS02 | [Apply Jury conditions and build the table](../src/modules/ds02/TASK.md) | `src/modules/ds02/**` |
| DS03 | [Transform the disk and apply Routh](../src/modules/ds03/TASK.md) | `src/modules/ds03/**` |
| DS04 | [Derive stable gain intervals on a discrete locus](../src/modules/ds04/TASK.md) | `src/modules/ds04/**` |
| DS05 | [Explain discrete Nyquist stability](../src/modules/ds05/TASK.md) | `src/modules/ds05/**` |

### Discrete / Performance

| ID | Tool / full task | Owned folder |
|---|---|---|
| DF01 | [Measure sampled transient specifications](../src/modules/df01/TASK.md) | `src/modules/df01/**` |
| DF02 | [Derive discrete error constants with physical time](../src/modules/df02/TASK.md) | `src/modules/df02/**` |
| DF03 | [Read sampled-loop frequency requirements](../src/modules/df03/TASK.md) | `src/modules/df03/**` |
| DF04 | [Compare sample periods and discrete quality indices](../src/modules/df04/TASK.md) | `src/modules/df04/**` |

### Discrete / Controller Design

| ID | Tool / full task | Owned folder |
|---|---|---|
| DD01 | [Emulate a continuous LTI controller](../src/modules/dd01/TASK.md) | `src/modules/dd01/**` |
| DD02 | [Design lead and lag directly in the z plane](../src/modules/dd02/TASK.md) | `src/modules/dd02/**` |
| DD03 | [Design using discrete frequency and W-plane methods](../src/modules/dd03/TASK.md) | `src/modules/dd03/**` |
| DD04 | [Derive and single-step a digital PID](../src/modules/dd04/TASK.md) | `src/modules/dd04/**` |
| DD05 | [Design a digital PID analytically](../src/modules/dd05/TASK.md) | `src/modules/dd05/**` |
| DD06 | [Place discrete state poles and set tracking gain](../src/modules/dd06/TASK.md) | `src/modules/dd06/**` |
| DD07 | [Design a sampled Luenberger observer](../src/modules/dd07/TASK.md) | `src/modules/dd07/**` |

## Per-module handoff

A completed assignment should report the supported exercise flow and mathematical domain, baseline/changed-data/edge-case verification, exact type/test/build results, real-browser editing/reset/reopen/cleanup checks, changed files and unresolved limits. The coordinator updates implementation status after review; “scope accepted” and “solver implemented” remain separate states. See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed quality requirements.
