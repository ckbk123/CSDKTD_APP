# CSDKTD APP: course architecture and functional plan

**Revision 4, 29 October 2026. Browser-first architecture; 56 module scaffolds, mathematical implementation pending.** The application covers **single-input, single-output, linear time-invariant systems**. Its organization follows the mathematical course, with exercise-specific tools inside each block. This replaces the previous flat F01–F35 catalog.

This revision records the accepted scope and the v0.3.0 scaffold baseline. Current delivery evidence belongs in module-owned `STATUS.md` files linked from [AGENT_TASKS.md](AGENT_TASKS.md); begin implementation at [START_HERE.md](START_HERE.md). See [PROJECT_STATUS.md](PROJECT_STATUS.md) for the foundations and completion stages.

## 1. Scope

There is no SISO/MIMO selector. Continuous and Discrete are the primary sections. Each has the same five subsections: **System Representation, Plots, Stability, Performance, Controller Design**.

SISO describes external input/output dimensions. Multiple states are allowed: `A` is `n×n`, `B` is `n×1`, `C` is `1×n`, and `D` is scalar. State feedback, controllability, observability and Luenberger observers stay in scope. An observer estimates vector state from one measured output; it does not require a MIMO workspace.

Reference, disturbance and sensor-noise exercises select different scalar channels, one at a time with other independent excitations zero. This preserves the course's superposition problems. Plant, controller, sensor and feedback sign remain explicit.

The mathematical scope is finite-order rational continuous/discrete LTI models, plus **explicit delays required by course examples**. Continuous pure delay is LTI but generally has no exact finite-dimensional ordinary state realization. Retain it or label a selected approximation. An integer-sample delay has an exact shift-register representation; fractional delays must not be silently rounded.

Improper expressions/ideal differentiators may appear in algebra and frequency exercises. An ordinary finite-dimensional `xdot=Ax+Bu` realization requires a proper transfer function; direct feedthrough is allowed. Initial conditions remain separate from the zero-state transfer relation. Sampling/ZOH is a declared modeling bridge: the continuous hybrid arrangement is generally periodically time varying, while its fixed-period sample-to-sample equivalent can be discrete LTI.

**Outside scope:** MIMO, nonlinear simulation/linearization, ON/OFF/relay/switching logic, saturation, windup/anti-windup, gain scheduling, PLC/hardware control and arbitrary mixed-rate networks. A pre-derived LTI approximation can be entered as an LTI model. A general CAS/trigonometry workspace and automatic interpretation of arbitrary schematic photographs are removed from the active plan. Course-specific algebra remains embedded in Representation.

The objective is coverage of the identified SISO LTI exercise families with documented limits, rather than an unlimited solver for every possible order, delay or symbolic parameter problem.

## 2. Navigation and the meaning of each block

```text
CSDKTD APP — SISO LTI
├── Continuous
│   ├── System Representation
│   ├── Plots
│   ├── Stability
│   ├── Performance
│   └── Controller Design
└── Discrete
    ├── System Representation
    ├── Plots
    ├── Stability
    ├── Performance
    └── Controller Design
```

| Block | Student's question | Result |
|---|---|---|
| System Representation | What are the equations, and how are different descriptions equivalent? | ODE/difference equation, TF, state model, block diagram, SFG and a checked conversion |
| Plots | How does the model produce this graph, and how is it constructed? | Time/sequence, pole–zero, Bode, Nyquist or root-locus construction |
| Stability | Is this selected feedback system stable, and for which parameters? | An argument, stable intervals, boundary cases and an independent check |
| Performance | How well does the system meet its time/frequency requirements? | Errors, transient metrics, frequency specifications and declared assumptions |
| Controller Design | Which controller/observer meets those requirements? | A derivation followed by actual poles and verified full-model performance |

These are ten subject groups containing independent subapplications. Each subapplication owns its model, inputs, results and temporary UI state. Root-locus construction, stable-gain analysis and compensator design may reuse stateless plot/math helpers, but each opens its own page with its own baseline example. Changes made in one subapplication do not update another subapplication.

**Teaching sequence example:** students can study `G=1/[s(s+2)]` in several independent tools: representation, root-locus construction, stable-gain analysis, error measurement and lead design. Each tool starts from its declared local example. A teacher may ask students to enter matching data manually; navigation does not transfer a mutable model or result between tools.

## Browser shell architecture — 29 October 2026

The primary application is a static browser application built with **Vite and TypeScript, without a UI framework**. Its catalogue groups 56 independent modules by domain and subject. Clicking a tile replaces the workspace in the same browser page; Home/back returns to the catalogue. Student-facing names describe the subject, while stable module IDs support development and source review.

Only immutable catalogue metadata loads eagerly. Each workspace implementation is imported lazily when selected. A module exposes a synchronous lifecycle:

```ts
mount({ container, signal }): void | (() => void)
```

The container is an `HTMLElement` owned by the shell, and the signal is the visit's `AbortSignal`. The module creates its local exercise state inside `mount`, using its own immutable baseline data. It may return a synchronous cleanup function. The web interface contains no C or Raven types. Module implementation and helper imports must not create a mutable cross-module current model.

Before leaving or resetting a workspace, the shell aborts its active signal, runs the returned cleanup once and releases its content. Reset remounts a fresh visit at the same baseline. A navigation generation/token guards lazy imports: a superseded import must never mount after the user has left or selected another tool. Later module-owned asynchronous work must also honor abort/visit checks before changing the page. The dynamic import itself need not be cancelable for its stale result to be discarded.

Workspace styling is scoped through CSS modules or the shell’s `data-module="CR01"`-style root; module CSS does not apply global rules to other workspaces.

The first-release milestone is the catalogue, navigation and **56 independent scaffolds with mathematics pending**. All future educational mathematics runs on the client. There is no server calculation, account system, persistence, save/load, project file, export or service worker in the first release. Navigation and reset discard the current visit's state; no result travels automatically to another module. Static hosting is sufficient, with browser compatibility established by testing the chosen build and APIs.

Stateless shared numerical services can be added under `src/shared/math/` later. If a particular algorithm benefits from C, a future compiled C/WebAssembly component may supply mathematics behind a TypeScript adapter after capability, size and license evaluation. It does not replace the browser UI with a native window. The earlier [native platform assessment](history/PLATFORM_FEASIBILITY_NATIVE.md) is retained as historical research, not a deployment requirement for this browser architecture.

## 3. What makes an exercise tool

Each concept that forms an identified exercise family gets a dedicated **subapplication inside its subject group**. Its contract contains:

1. A problem with assumptions and editable data.
2. A student attempt: expression, sketch, table entry, selected loop, predicted result or chosen parameter.
3. A visual explanation of the mathematical step.
4. Specific feedback and a revealable derivation.
5. An independently checkable answer and a changed-data exercise.

Examples include highlighting the coefficients used in a Routh cell, showing which old samples a recurrence reads, selecting a shared node between Mason loops, or mapping a contour point into a Nyquist curve. Highlighted equations, matrix rows and tables can be more informative than animation.

Explore, Guided and Check-my-work behaviors can be implemented inside each tool later. Every tool has a baseline default example and starts fresh when opened. Any comparison or answer-reveal state is local to that visit. Localization, keyboard input and reusable visual controls can share code. The first release has no accounts, saving, project files, persistence, export or service worker. Local reveal controls are teaching aids, not secure examinations.

Tool identifiers below are review references; student menus use subject names. The [exercise tool atlas](EXERCISE_TOOL_ATLAS.md) details tasks, controls, visual behavior, source anchors and checks. The [review sheet](FEATURE_REVIEW.md) starts with the ten blocks and then their modes. The instructor has accepted the hierarchy and all 56 logical subapplication concepts. The browser catalogue and 56 lazy module scaffolds were delivered in the v0.3.0 baseline; subsequent mathematical work is tracked in the module progress records.

## 4. Continuous systems

<a id="continuous-representation"></a>
### System Representation

**Course:** source chapter 2; sessions 02–04.

| Mode | Exercise family |
|---|---|
| CR01 | Polynomial/rational algebra, coefficient order, factors, roots, equivalence |
| CR02 | Linear physical ODE, Laplace construction, input derivatives and initial conditions |
| CR03 | ODE/TF/state conversion, canonical/physical coordinates, properness and direct feedthrough |
| CR04 | Structured block construction, reductions, summing/pickoff moves and scalar channels |
| CR05 | Block-to-SFG conversion and Mason paths/loops/determinants/cofactors |
| CR06 | States from integrator outputs, state transition, free/forced/total response |

A generic conversion button is insufficient. Original chapter 2 distinguishes realizations with/without input derivatives, canonical coordinates and choosing integrator outputs as states. Each needs its own guided exercise within these modes.

Students construct intermediate equations, choose a target representation and verify equivalence. A TF can produce a canonical diagram/realization; it cannot recover a unique original physical diagram. Similarity transformations must also map initial states. Hidden modes in a nonminimal state realization must remain distinguishable from canceled input/output poles. The Mason result is checked against equations assembled directly from the original structured block model.

<a id="continuous-plots"></a>
### Plots

**Course:** chapter 3 and root-locus part of chapter 4; sessions 05 and 08.

| Mode | Exercise family |
|---|---|
| CP01 | Step/ramp/impulse interpretation and free/forced time response |
| CP02 | Pole/zero modes, repeated/conjugate poles, zero effects and inverse response |
| CP03 | Sinusoidal amplitude/phase and synchronized frequency cursor |
| CP04 | Factor-by-factor Bode construction, exact/asymptotic curves and delay |
| CP05 | Nyquist construction, orientation, positive/negative-frequency branches and arcs |
| CP06 | Root-locus rules, angle/magnitude conditions and parameter normalization |

Students can sketch a slope, identify a corner or test a candidate locus point before revealing the exact curve. Moving conjugate poles updates both members, coefficients and responses. A same-poles/different-zeros exercise shows why denominator roots alone do not determine the step shape. Plot construction identifies limits/omitted contour portions and units before the graph is used to make a stability/design argument.

<a id="continuous-stability"></a>
### Stability

**Course:** chapter 4; sessions 06, 08 and 09.

| Mode | Exercise family |
|---|---|
| CS01 | Pole/eigenvalue stability, imaginary-axis multiplicity, BIBO versus internal modes |
| CS02 | Routh/Hurwitz construction, zero first entry and all-zero-row cases |
| CS03 | Parameter inequalities, complete stable intervals and separate boundary classification |
| CS04 | Nyquist criterion, open-loop RHP pole count and explicit winding convention |
| CS05 | Stable feedback gains and crossings on a root locus |

A finite gain sweep illustrates a region but does not prove all of it. Let students compare an analytical boundary with computed roots. For `s^3+7s^2+10s+K`, strict stability is `0<K<70`; endpoints require separate reasoning. Hurwitz determinants, Routh's epsilon case and the auxiliary-polynomial case are distinct exercises. Nyquist's stability argument lives here while curve construction remains available from Plots.

<a id="continuous-performance"></a>
### Performance

**Course:** chapter 5; sessions 07 and 09.

| Mode | Exercise family |
|---|---|
| CF01 | Rise/peak/settling, overshoot, pole-plane specifications and full-order checks |
| CF02 | Step/ramp/parabolic error, type/error constants, nonunity sensor and scalar disturbance channel |
| CF03 | IAE/ISE/ITAE/ITSE, a common evaluation horizon and control effort |
| CF04 | Frequency margins, crossovers, resonance and bandwidth of a named channel |
| CF05 | Time/frequency relationships and their limits with extra poles/zeros |

The tool identifies whether a plot/metric refers to plant `G`, open-loop `L`, closed-loop reference transfer, or an error/disturbance channel. Check stability/final-value conditions before reporting a steady-state limit. Distinguish textbook estimates from measured full-order values. Multiple crossovers, insufficient horizon and undefined metrics need explicit output states. Frequency margins can also serve Stability and Design, but their measurement and interpretation form a Performance exercise here.

<a id="continuous-design"></a>
### Controller Design

**Course:** chapter 6; sessions 08–11.

| Mode | Exercise family |
|---|---|
| CD01 | P/PI/PD/PID structure, manual tuning and analytical coefficient matching |
| CD02 | Lead by root locus |
| CD03 | Lag by root locus |
| CD04 | Lead–lag by root locus |
| CD05 | Lead by frequency response |
| CD06 | Lag/lead–lag by frequency response |
| CD07 | Named PID tuning rules and verification |
| CD08 | SISO state feedback, controllability and scalar reference prefilter |
| CD09 | Luenberger observer, observability and observer-based feedback |

Each design begins with requirements and ends with a complete-loop check. Lead and lag deserve separate tasks even when their controls use the same graph. An arbitrary compensator playground does not replace a guided design exercise. State feedback verifies actual `A-BK` eigenvalues and tracking gain. Observer exercises show actual/estimated states, innovation and error dynamics. PID comparisons stay linear and identify ideal versus filtered derivative structure explicitly.

## 5. Discrete systems

The five labels repeat because the student asks the same kinds of questions. Equations, timing, stability regions and design procedures are discrete-specific. Replacing the letter `s` with `z` does not supply those methods.

<a id="discrete-representation"></a>
### System Representation

**Course:** chapter 7; session 12, with recurrence work in session 14.

| Mode | Exercise family |
|---|---|
| DR01 | Z-transform/inverse sequence, assumptions, initial terms and causal convention |
| DR02 | Difference equation/TF/delay diagram, coefficient order, memory and first samples |
| DR03 | Discrete TF/state conversion, canonical forms and delay-state coordinates |
| DR04 | Discrete block/SFG/Mason with explicit sample topology |
| DR05 | ZOH and selected model conversions, hold/sample timing and explicit delay |

The sample stepper exposes each old value before memory updates. Exact ZOH checks the continuous plant at sample instants under held input, not an arbitrary interpolation between them. The original delayed-plant exercise remains in scope. Without a sampler separating continuous blocks, the pulse transfer of their continuous cascade is generally not the product of their separately discretized pulse transfers. The diagram must show sample/hold placement.

<a id="discrete-plots"></a>
### Plots

**Course:** chapter 8; sessions 12–13.

| Mode | Exercise family |
|---|---|
| DP01 | Impulse/step/ramp sequences, alternating/conjugate modes and time axes |
| DP02 | Unit-circle plot and `z=exp(sT)` mapping, radius/angle and log branches |
| DP03 | Direct discrete Bode/Nyquist, normalized/physical frequency and W-plane construction |
| DP04 | Discrete root-locus construction with the unit-circle overlay |

Frequency axes distinguish rad/sample, rad/s and Hz. A negative real z pole can be stable and alternate sign. Direct `G(exp(jωT))` evaluation and bilinear/W-plane approximation are separate constructions. A line joining sample markers is illustrative unless a continuous plant/hold model supplies intersample behavior.

<a id="discrete-stability"></a>
### Stability

**Course:** chapter 8; session 13.

| Mode | Exercise family |
|---|---|
| DS01 | Pole/eigenvalue radius, unit-circle multiplicity and internal versus channel stability |
| DS02 | Jury conditions/table, symbolic parameter intervals and endpoints |
| DS03 | Bilinear transformation and Routh in the transformed plane |
| DS04 | Stable K from a discrete root locus and unit-circle crossings |
| DS05 | Discrete Nyquist argument and closed-loop root check (extension / synthesis) |

Jury and transformed Routh are both course-backed methods. Choose/display a transformation convention, e.g. `z=(1+w)/(1-w)`, which maps the open unit disk to `Re(w)<0` under its inverse. The singular point, denominator clearing and any degree change need explicit boundary treatment. Discrete locus stability crossings occur on a unit circle, not the continuous imaginary axis.

<a id="discrete-performance"></a>
### Performance

**Course:** quality/error part of chapter 8; session 13.

| Mode | Exercise family |
|---|---|
| DF01 | Sampled transient specifications in samples/seconds and intersample qualification |
| DF02 | Discrete final value, type/error constants and physical versus index-based ramps |
| DF03 | Discrete crossover/margins/bandwidth and frequency warping |
| DF04 | Sample-period experiments, fixed versus redesigned controller, error sums and effort |

`r[k]=kT` has a different slope convention from `r[k]=k`; the app must expose the resulting factor of `T` in error calculations. Error sums approximate time integrals only with the correct sample-period weighting. Preserve the physical horizon when comparing sample periods. Make “keep controller fixed” and “redesign at this T” separate actions so the result has an interpretable cause.

<a id="discrete-design"></a>
### Controller Design

**Course:** chapter 9; sessions 14–15.

| Mode | Exercise family |
|---|---|
| DD01 | Continuous-controller emulation by selected Euler/Tustin rules |
| DD02 | Direct discrete lead/lag root-locus design |
| DD03 | Discrete frequency/W-plane design and final unit-circle check (extension / synthesis) |
| DD04 | Digital PID position/incremental recurrence, initialization and update order |
| DD05 | Analytical discrete PID design by characteristic equation matching |
| DD06 | Discrete SISO state feedback, controllability and reference multiplier |
| DD07 | Discrete Luenberger observer and combined feedback timing |

Emulating a continuous controller and directly designing a discrete one are distinct tasks. Recheck actual sampled-loop stability and performance after either. State and observer gains must match the active subapplication's sample time. An ideal derivative recurrence and a filtered recurrence have different structures. Observer timing must state the update convention actually used. Analytical target-pole matching must verify all remaining modes and realization constraints.

## 6. Shared mathematical and UI services

Each subapplication creates its own in-memory exercise state from immutable baseline data: domain, coefficients/factors or state realization, delays, sample period, selected scalar channel, inputs, initial conditions and requirements. Its own dependent views update together or mark its own results stale. Leaving the page releases that visit's state. Reopening starts from the baseline. No model, history or result travels automatically to another subapplication, and no project/save/export service is required.

The browser implementation separates workspace modules from stateless mathematical/UI helpers. Future client-side services under `src/shared/math/` can cover polynomial algebra, roots, scalar block/SFG structure, matrices, simulation, plot construction and exercise feedback. Callers own mutable inputs, temporary workspaces and results; shared services do not retain a global current system. A future C/WebAssembly math adapter is optional and unselected. It must preserve the TypeScript/browser lifecycle and contain no Raven or native-window interface types. [Mathematical backend research](MATH_BACKEND_OPTIONS.md) records candidates and evaluation limits.

Exact algebra, numerical estimates and textbook approximations have different labels. Declare coefficient order, factor domain, transform convention, initial conditions, metric definitions, units, horizon, tolerances and resource limits. A numerical sample is supporting evidence, not a proof of symbolic equivalence. A canceled transfer factor cannot alone establish internal stability. Unsupported/singular cases and incomplete enumeration must receive explicit results.

Checks follow the exercise: original block equations versus Mason; ODE/recurrence versus a converted representation; inequality boundaries versus actual roots; designed versus actual eigenvalues; derived versus hand-stepped digital PID. Numerical conditioning, repeated roots and rank tolerance require meaningful diagnostics rather than many unchecked decimal places.

## 7. Evidence, review and development sequence

The [exercise atlas](EXERCISE_TOOL_ATLAS.md) uses the exact ten-block order. The deeper [continuous audit](research/CONTINUOUS_EXERCISE_AUDIT.md), [discrete audit](research/DISCRETE_EXERCISE_AUDIT.md) and [external exercise research](research/EXTERNAL_EXERCISE_REFERENCES.md) distinguish observed tasks from proposed variations. The [slide inventory](research/SLIDE_INVENTORY.json) fixes deck identities. A source heading or image-only equation is not a verified algorithm/fixture; the audits state these limits.

Evaluate coverage by exercise families within a block, not by the number of sliders built. A mode is ready to implement when the student input, exposed reasoning, answer/variant and independent checks are agreed.

Proposed dependency sequence:

1. Implement and verify the static Vite/TypeScript catalogue and same-page navigation into 56 lazily imported module scaffolds.
2. Verify navigation, module lifecycle, baseline reset and UI/platform behavior without introducing mathematical runtime dependencies.
3. Implement the first selected subapplication with its local baseline, narrow service interfaces and explanatory plotting.
4. Develop the other representation, stability, performance and controller-design subapplications independently, with module-specific checks.
5. Add the corresponding discrete subapplications and their own recurrence, stability and design methods.
6. Verify related teaching sequences using matching manually entered or predefined local examples, without automatic cross-module state transfer.

All 56 subapplication concepts are accepted in scope, but they need not be mathematically implemented in one release. The [review sheet](FEATURE_REVIEW.md) records accepted scope and the baseline assessment; [module progress records](AGENT_TASKS.md) track subsequent implementation and evidence.
