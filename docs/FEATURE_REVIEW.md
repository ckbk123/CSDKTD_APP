# Instructor review: ten course blocks and their exercise tools

**Revision 4, 29 October 2026.** The instructor has accepted all 56 logical subapplication concepts in the **SISO LTI → Continuous / Discrete → five subject blocks** structure. Scope is accepted; mathematical implementation is pending. The first-release milestone is a static Vite/TypeScript browser catalogue and 56 independent lazy module scaffolds inside the same page. The interface uses no UI framework; all educational mathematics remains pending and will run client-side.

Read the [architecture](FUNCTIONAL_SPECIFICATION.md) first. Use the [exercise atlas](EXERCISE_TOOL_ATLAS.md) when reviewing a specific tool. Source/exercise audits are supporting evidence, not additional application menus.

**Status date:** the implementation labels in this review sheet describe the 29 October 2026 scaffold baseline. They are not a live progress ledger. Current implementation and verification evidence lives in each module's `STATUS.md`, linked from [AGENT_TASKS.md](AGENT_TASKS.md). Agents start at [START_HERE.md](START_HERE.md); stages are defined in [PROJECT_STATUS.md](PROJECT_STATUS.md).

## 1. Review the blocks first

All ten subject groups and their subapplication concepts are accepted. The status below records accepted scope separately from the still-pending mathematical functionality. The shell supplies eager immutable metadata, catalogue navigation and lazily mounted blank workspaces first.

| Domain | Block | Exercise modes | Scope / implementation | Instructor notes |
|---|---|---|---|---|
| Continuous | [System Representation](FUNCTIONAL_SPECIFICATION.md#continuous-representation) | 6 | Accepted / implementation pending | |
| Continuous | [Plots](FUNCTIONAL_SPECIFICATION.md#continuous-plots) | 6 | Accepted / implementation pending | |
| Continuous | [Stability](FUNCTIONAL_SPECIFICATION.md#continuous-stability) | 5 | Accepted / implementation pending | |
| Continuous | [Performance](FUNCTIONAL_SPECIFICATION.md#continuous-performance) | 5 | Accepted / implementation pending | |
| Continuous | [Controller Design](FUNCTIONAL_SPECIFICATION.md#continuous-design) | 9 | Accepted / implementation pending | |
| Discrete | [System Representation](FUNCTIONAL_SPECIFICATION.md#discrete-representation) | 5 | Accepted / implementation pending | |
| Discrete | [Plots](FUNCTIONAL_SPECIFICATION.md#discrete-plots) | 4 | Accepted / implementation pending | |
| Discrete | [Stability](FUNCTIONAL_SPECIFICATION.md#discrete-stability) | 5 | Accepted / implementation pending | |
| Discrete | [Performance](FUNCTIONAL_SPECIFICATION.md#discrete-performance) | 4 | Accepted / implementation pending | |
| Discrete | [Controller Design](FUNCTIONAL_SPECIFICATION.md#discrete-design) | 7 | Accepted / implementation pending | |

## 2. Review tool modes inside each block

Every listed concept is **Accepted**. **Implementation pending** means its educational calculations and module-specific interface are not delivered by the blank-container shell. Record refinements to student action, reveal order, notation and examples in the notes column. Each subapplication owns its model/state; reusable stateless math and visual helpers may share code.

### Continuous / System Representation

| Tool | Exercise | Scope / implementation | Teaching behavior / example / priority |
|---|---|---|---|
| [CR01](EXERCISE_TOOL_ATLAS.md#cr01) | Expand, factor and interpret polynomials | Accepted / implementation pending | |
| [CR02](EXERCISE_TOOL_ATLAS.md#cr02) | Derive a linear ODE and apply Laplace correctly | Accepted / implementation pending | |
| [CR03](EXERCISE_TOOL_ATLAS.md#cr03) | Convert TF/ODE/state descriptions and canonical coordinates | Accepted / implementation pending | |
| [CR04](EXERCISE_TOOL_ATLAS.md#cr04) | Construct and reduce a scalar block diagram | Accepted / implementation pending | |
| [CR05](EXERCISE_TOOL_ATLAS.md#cr05) | Convert to SFG and apply Mason step by step | Accepted / implementation pending | |
| [CR06](EXERCISE_TOOL_ATLAS.md#cr06) | Choose dynamic states and explain state response | Accepted / implementation pending | |

### Continuous / Plots

| Tool | Exercise | Scope / implementation | Teaching behavior / example / priority |
|---|---|---|---|
| [CP01](EXERCISE_TOOL_ATLAS.md#cp01) | Construct a time response | Accepted / implementation pending | |
| [CP02](EXERCISE_TOOL_ATLAS.md#cp02) | Explain pole modes and zero effects | Accepted / implementation pending | |
| [CP03](EXERCISE_TOOL_ATLAS.md#cp03) | Measure sinusoidal gain and phase | Accepted / implementation pending | |
| [CP04](EXERCISE_TOOL_ATLAS.md#cp04) | Build a Bode plot from factors | Accepted / implementation pending | |
| [CP05](EXERCISE_TOOL_ATLAS.md#cp05) | Construct a Nyquist curve | Accepted / implementation pending | |
| [CP06](EXERCISE_TOOL_ATLAS.md#cp06) | Construct a root locus and test its rules | Accepted / implementation pending | |

### Continuous / Stability

| Tool | Exercise | Scope / implementation | Teaching behavior / example / priority |
|---|---|---|---|
| [CS01](EXERCISE_TOOL_ATLAS.md#cs01) | Classify poles, eigenmodes and boundaries | Accepted / implementation pending | |
| [CS02](EXERCISE_TOOL_ATLAS.md#cs02) | Work through Routh and Hurwitz, including special cases | Accepted / implementation pending | |
| [CS03](EXERCISE_TOOL_ATLAS.md#cs03) | Derive a complete stable parameter region | Accepted / implementation pending | |
| [CS04](EXERCISE_TOOL_ATLAS.md#cs04) | Apply Nyquist with the correct loop and pole count | Accepted / implementation pending | |
| [CS05](EXERCISE_TOOL_ATLAS.md#cs05) | Find stable gains on a root locus | Accepted / implementation pending | |

### Continuous / Performance

| Tool | Exercise | Scope / implementation | Teaching behavior / example / priority |
|---|---|---|---|
| [CF01](EXERCISE_TOOL_ATLAS.md#cf01) | Measure transient requirements and test pole predictions | Accepted / implementation pending | |
| [CF02](EXERCISE_TOOL_ATLAS.md#cf02) | Derive steady-state error and system type | Accepted / implementation pending | |
| [CF03](EXERCISE_TOOL_ATLAS.md#cf03) | Compare integral error criteria and control effort | Accepted / implementation pending | |
| [CF04](EXERCISE_TOOL_ATLAS.md#cf04) | Read margins, crossovers, resonance and bandwidth | Accepted / implementation pending | |
| [CF05](EXERCISE_TOOL_ATLAS.md#cf05) | Test time/frequency performance relationships | Accepted / implementation pending | |

### Continuous / Controller Design

| Tool | Exercise | Scope / implementation | Teaching behavior / example / priority |
|---|---|---|---|
| [CD01](EXERCISE_TOOL_ATLAS.md#cd01) | Choose and tune an LTI P/PI/PD/PID structure | Accepted / implementation pending | |
| [CD02](EXERCISE_TOOL_ATLAS.md#cd02) | Design lead compensation using root locus | Accepted / implementation pending | |
| [CD03](EXERCISE_TOOL_ATLAS.md#cd03) | Design lag compensation using root locus | Accepted / implementation pending | |
| [CD04](EXERCISE_TOOL_ATLAS.md#cd04) | Allocate requirements between lead and lag | Accepted / implementation pending | |
| [CD05](EXERCISE_TOOL_ATLAS.md#cd05) | Design lead using frequency response | Accepted / implementation pending | |
| [CD06](EXERCISE_TOOL_ATLAS.md#cd06) | Design lag or lead–lag using frequency response | Accepted / implementation pending | |
| [CD07](EXERCISE_TOOL_ATLAS.md#cd07) | Apply and evaluate a named PID tuning rule | Accepted / implementation pending | |
| [CD08](EXERCISE_TOOL_ATLAS.md#cd08) | Design SISO state feedback and reference tracking | Accepted / implementation pending | |
| [CD09](EXERCISE_TOOL_ATLAS.md#cd09) | Design a Luenberger observer and combine feedback | Accepted / implementation pending | |

### Discrete / System Representation

| Tool | Exercise | Scope / implementation | Teaching behavior / example / priority |
|---|---|---|---|
| [DR01](EXERCISE_TOOL_ATLAS.md#dr01) | Connect sequences with Z transforms | Accepted / implementation pending | |
| [DR02](EXERCISE_TOOL_ATLAS.md#dr02) | Derive and execute a difference equation | Accepted / implementation pending | |
| [DR03](EXERCISE_TOOL_ATLAS.md#dr03) | Construct discrete state models and delay states | Accepted / implementation pending | |
| [DR04](EXERCISE_TOOL_ATLAS.md#dr04) | Reduce sampled diagrams and apply discrete Mason | Accepted / implementation pending | |
| [DR05](EXERCISE_TOOL_ATLAS.md#dr05) | Derive a sampled model using a declared hold | Accepted / implementation pending | |

### Discrete / Plots

| Tool | Exercise | Scope / implementation | Teaching behavior / example / priority |
|---|---|---|---|
| [DP01](EXERCISE_TOOL_ATLAS.md#dp01) | Plot sequences and interpret modal behavior | Accepted / implementation pending | |
| [DP02](EXERCISE_TOOL_ATLAS.md#dp02) | Map continuous poles and discrete modes | Accepted / implementation pending | |
| [DP03](EXERCISE_TOOL_ATLAS.md#dp03) | Construct discrete Bode/Nyquist and W-plane views | Accepted / implementation pending | |
| [DP04](EXERCISE_TOOL_ATLAS.md#dp04) | Construct a discrete root locus | Accepted / implementation pending | |

### Discrete / Stability

| Tool | Exercise | Scope / implementation | Teaching behavior / example / priority |
|---|---|---|---|
| [DS01](EXERCISE_TOOL_ATLAS.md#ds01) | Classify discrete pole/eigenvalue stability | Accepted / implementation pending | |
| [DS02](EXERCISE_TOOL_ATLAS.md#ds02) | Apply Jury conditions and build the table | Accepted / implementation pending | |
| [DS03](EXERCISE_TOOL_ATLAS.md#ds03) | Transform the disk and apply Routh | Accepted / implementation pending | |
| [DS04](EXERCISE_TOOL_ATLAS.md#ds04) | Derive stable gain intervals on a discrete locus | Accepted / implementation pending | |
| [DS05](EXERCISE_TOOL_ATLAS.md#ds05) | Explain discrete Nyquist stability (extension / synthesis) | Accepted / implementation pending | |

### Discrete / Performance

| Tool | Exercise | Scope / implementation | Teaching behavior / example / priority |
|---|---|---|---|
| [DF01](EXERCISE_TOOL_ATLAS.md#df01) | Measure sampled transient specifications | Accepted / implementation pending | |
| [DF02](EXERCISE_TOOL_ATLAS.md#df02) | Derive discrete error constants with physical time | Accepted / implementation pending | |
| [DF03](EXERCISE_TOOL_ATLAS.md#df03) | Read sampled-loop frequency requirements | Accepted / implementation pending | |
| [DF04](EXERCISE_TOOL_ATLAS.md#df04) | Compare sample periods and discrete quality indices | Accepted / implementation pending | |

### Discrete / Controller Design

| Tool | Exercise | Scope / implementation | Teaching behavior / example / priority |
|---|---|---|---|
| [DD01](EXERCISE_TOOL_ATLAS.md#dd01) | Emulate a continuous LTI controller | Accepted / implementation pending | |
| [DD02](EXERCISE_TOOL_ATLAS.md#dd02) | Design lead and lag directly in the z plane | Accepted / implementation pending | |
| [DD03](EXERCISE_TOOL_ATLAS.md#dd03) | Design using discrete frequency and W-plane methods (extension / synthesis) | Accepted / implementation pending | |
| [DD04](EXERCISE_TOOL_ATLAS.md#dd04) | Derive and single-step a digital PID | Accepted / implementation pending | |
| [DD05](EXERCISE_TOOL_ATLAS.md#dd05) | Design a digital PID analytically | Accepted / implementation pending | |
| [DD06](EXERCISE_TOOL_ATLAS.md#dd06) | Place discrete state poles and set tracking gain | Accepted / implementation pending | |
| [DD07](EXERCISE_TOOL_ATLAS.md#dd07) | Design a sampled Luenberger observer | Accepted / implementation pending | |

## 3. Conventions and limits to agree

| Item | Proposed interpretation | Instructor choice |
|---|---|---|
| Model size | SISO externally; vector internal state is allowed | |
| Disturbances | Select scalar input/output channels one at a time | |
| Delays | Explicit continuous delay and integer-sample delay; label approximations | |
| Representation | Several equivalent realizations can be correct; ordinary state form requires properness | |
| LTI boundary | Exclude nonlinear, switching, saturation and anti-windup simulations | |
| Polynomial algebra | Exact supported subset; distinguish numerical roots and factoring domains | |
| Stability | Declare strict/boundary and internal/input-output meanings | |
| Time quality | Agree rise-time, 2%/5% band and final-value convention | |
| Frequency | Declare loop/channel, winding convention and all relevant crossovers | |
| Sampling | Distinguish k, seconds, normalized frequency, hold and sample topology | |
| Controller form | Agree PID parameterization, linear filter and observer update timing | |
| Reveal | Student attempt/prediction before selected steps or answers | |
| User interface | Static Vite/TypeScript; no UI framework; catalogue and independent workspaces in one browser page | Accepted |
| Module lifecycle | Synchronous `mount({container,signal})` returns void or cleanup; local state starts in mount; abort/cleanup before leave/reset; discard stale imports | Accepted |
| Persistence | First release has no accounts, persistence, save/load, project files, export or service worker | Accepted |
| Platform | Test supported browsers and the static build; native OS/Vulkan research is historical | |
| Mathematical backend | Client-side TypeScript services first; optional future C/WebAssembly math requires evaluation | |

## 4. Related teaching sequences

These are conceptual lesson sequences across independent tools. Each tool opens its own baseline, and matching data can be entered manually. The shell does not carry a shared case or result between them.

- Diagram → SFG/Mason → TF → poles → stability/error:
- ODE → state model → state feedback/observer → actual response:
- Root-locus/frequency requirements → lead/lag design → full-order check:
- Continuous plant/ZOH → recurrence → Jury/transformed Routh → sampled performance:
- Continuous emulation or direct digital design → PID memory stepper → exact sampled-loop check:

## 5. Notes for the next implementation plan

The current plan implements the browser shell and 56 independent lazy scaffolds first. Later work implements accepted tools individually using module-local baseline state and stateless client-side mathematical helpers. Only catalogue metadata loads eagerly; mounts initialize state synchronously and return optional cleanup. The shell aborts and cleans the current visit before leave/reset and discards superseded imports. The first release has no accounts, persistence, save/load, project-file, export or service-worker feature. Historical scope changes from the first draft remain documented in [the migration record](research/SCOPE_AND_MIGRATION.md); the revision 4 browser and lifecycle requirements above supersede earlier shared-case and native-window assumptions.
