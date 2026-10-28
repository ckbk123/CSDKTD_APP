# Instructor review: ten course blocks and their exercise tools

**Revision 2, 28 October 2026.** The instructor's organization is adopted: **SISO LTI only**, then **Continuous / Discrete**, then the same **five curricular blocks**. This sheet reviews the detailed exercise behavior and build priority within that structure. It replaces the flat 35-feature checklist.

Read the [architecture](FUNCTIONAL_SPECIFICATION.md) first. Use the [exercise atlas](EXERCISE_TOOL_ATLAS.md) when reviewing a specific tool. Source/exercise audits are supporting evidence, not additional application menus.

## 1. Review the blocks first

All ten workspaces belong to the proposed course architecture. In the table, choose a build priority and note omissions or preferred teaching workflows. A priority decision does not approve every submode automatically.

| Domain | Block | Exercise modes | Build priority | Instructor notes |
|---|---|---|---|---|
| Continuous | [System Representation](FUNCTIONAL_SPECIFICATION.md#continuous-representation) | 6 | Pending | |
| Continuous | [Plots](FUNCTIONAL_SPECIFICATION.md#continuous-plots) | 6 | Pending | |
| Continuous | [Stability](FUNCTIONAL_SPECIFICATION.md#continuous-stability) | 5 | Pending | |
| Continuous | [Performance](FUNCTIONAL_SPECIFICATION.md#continuous-performance) | 5 | Pending | |
| Continuous | [Controller Design](FUNCTIONAL_SPECIFICATION.md#continuous-design) | 9 | Pending | |
| Discrete | [System Representation](FUNCTIONAL_SPECIFICATION.md#discrete-representation) | 5 | Pending | |
| Discrete | [Plots](FUNCTIONAL_SPECIFICATION.md#discrete-plots) | 4 | Pending | |
| Discrete | [Stability](FUNCTIONAL_SPECIFICATION.md#discrete-stability) | 5 | Pending | |
| Discrete | [Performance](FUNCTIONAL_SPECIFICATION.md#discrete-performance) | 4 | Pending | |
| Discrete | [Controller Design](FUNCTIONAL_SPECIFICATION.md#discrete-design) | 7 | Pending | |

## 2. Review tool modes inside each block

Decision vocabulary: **Keep**, **Revise**, **Defer** or **Omit**. All individual decisions start **Pending**. Record the expected student action, reveal order, notation, example and acceptable answer. Several named exercise submodes can share one UI/engine.

### Continuous / System Representation

| Tool | Exercise | Decision | Teaching behavior / example / priority |
|---|---|---|---|
| [CR01](EXERCISE_TOOL_ATLAS.md#cr01) | Expand, factor and interpret polynomials | Pending | |
| [CR02](EXERCISE_TOOL_ATLAS.md#cr02) | Derive a linear ODE and apply Laplace correctly | Pending | |
| [CR03](EXERCISE_TOOL_ATLAS.md#cr03) | Convert TF/ODE/state descriptions and canonical coordinates | Pending | |
| [CR04](EXERCISE_TOOL_ATLAS.md#cr04) | Construct and reduce a scalar block diagram | Pending | |
| [CR05](EXERCISE_TOOL_ATLAS.md#cr05) | Convert to SFG and apply Mason step by step | Pending | |
| [CR06](EXERCISE_TOOL_ATLAS.md#cr06) | Choose dynamic states and explain state response | Pending | |

### Continuous / Plots

| Tool | Exercise | Decision | Teaching behavior / example / priority |
|---|---|---|---|
| [CP01](EXERCISE_TOOL_ATLAS.md#cp01) | Construct a time response | Pending | |
| [CP02](EXERCISE_TOOL_ATLAS.md#cp02) | Explain pole modes and zero effects | Pending | |
| [CP03](EXERCISE_TOOL_ATLAS.md#cp03) | Measure sinusoidal gain and phase | Pending | |
| [CP04](EXERCISE_TOOL_ATLAS.md#cp04) | Build a Bode plot from factors | Pending | |
| [CP05](EXERCISE_TOOL_ATLAS.md#cp05) | Construct a Nyquist curve | Pending | |
| [CP06](EXERCISE_TOOL_ATLAS.md#cp06) | Construct a root locus and test its rules | Pending | |

### Continuous / Stability

| Tool | Exercise | Decision | Teaching behavior / example / priority |
|---|---|---|---|
| [CS01](EXERCISE_TOOL_ATLAS.md#cs01) | Classify poles, eigenmodes and boundaries | Pending | |
| [CS02](EXERCISE_TOOL_ATLAS.md#cs02) | Work through Routh and Hurwitz, including special cases | Pending | |
| [CS03](EXERCISE_TOOL_ATLAS.md#cs03) | Derive a complete stable parameter region | Pending | |
| [CS04](EXERCISE_TOOL_ATLAS.md#cs04) | Apply Nyquist with the correct loop and pole count | Pending | |
| [CS05](EXERCISE_TOOL_ATLAS.md#cs05) | Find stable gains on a root locus | Pending | |

### Continuous / Performance

| Tool | Exercise | Decision | Teaching behavior / example / priority |
|---|---|---|---|
| [CF01](EXERCISE_TOOL_ATLAS.md#cf01) | Measure transient requirements and test pole predictions | Pending | |
| [CF02](EXERCISE_TOOL_ATLAS.md#cf02) | Derive steady-state error and system type | Pending | |
| [CF03](EXERCISE_TOOL_ATLAS.md#cf03) | Compare integral error criteria and control effort | Pending | |
| [CF04](EXERCISE_TOOL_ATLAS.md#cf04) | Read margins, crossovers, resonance and bandwidth | Pending | |
| [CF05](EXERCISE_TOOL_ATLAS.md#cf05) | Test time/frequency performance relationships | Pending | |

### Continuous / Controller Design

| Tool | Exercise | Decision | Teaching behavior / example / priority |
|---|---|---|---|
| [CD01](EXERCISE_TOOL_ATLAS.md#cd01) | Choose and tune an LTI P/PI/PD/PID structure | Pending | |
| [CD02](EXERCISE_TOOL_ATLAS.md#cd02) | Design lead compensation using root locus | Pending | |
| [CD03](EXERCISE_TOOL_ATLAS.md#cd03) | Design lag compensation using root locus | Pending | |
| [CD04](EXERCISE_TOOL_ATLAS.md#cd04) | Allocate requirements between lead and lag | Pending | |
| [CD05](EXERCISE_TOOL_ATLAS.md#cd05) | Design lead using frequency response | Pending | |
| [CD06](EXERCISE_TOOL_ATLAS.md#cd06) | Design lag or lead–lag using frequency response | Pending | |
| [CD07](EXERCISE_TOOL_ATLAS.md#cd07) | Apply and evaluate a named PID tuning rule | Pending | |
| [CD08](EXERCISE_TOOL_ATLAS.md#cd08) | Design SISO state feedback and reference tracking | Pending | |
| [CD09](EXERCISE_TOOL_ATLAS.md#cd09) | Design a Luenberger observer and combine feedback | Pending | |

### Discrete / System Representation

| Tool | Exercise | Decision | Teaching behavior / example / priority |
|---|---|---|---|
| [DR01](EXERCISE_TOOL_ATLAS.md#dr01) | Connect sequences with Z transforms | Pending | |
| [DR02](EXERCISE_TOOL_ATLAS.md#dr02) | Derive and execute a difference equation | Pending | |
| [DR03](EXERCISE_TOOL_ATLAS.md#dr03) | Construct discrete state models and delay states | Pending | |
| [DR04](EXERCISE_TOOL_ATLAS.md#dr04) | Reduce sampled diagrams and apply discrete Mason | Pending | |
| [DR05](EXERCISE_TOOL_ATLAS.md#dr05) | Derive a sampled model using a declared hold | Pending | |

### Discrete / Plots

| Tool | Exercise | Decision | Teaching behavior / example / priority |
|---|---|---|---|
| [DP01](EXERCISE_TOOL_ATLAS.md#dp01) | Plot sequences and interpret modal behavior | Pending | |
| [DP02](EXERCISE_TOOL_ATLAS.md#dp02) | Map continuous poles and discrete modes | Pending | |
| [DP03](EXERCISE_TOOL_ATLAS.md#dp03) | Construct discrete Bode/Nyquist and W-plane views | Pending | |
| [DP04](EXERCISE_TOOL_ATLAS.md#dp04) | Construct a discrete root locus | Pending | |

### Discrete / Stability

| Tool | Exercise | Decision | Teaching behavior / example / priority |
|---|---|---|---|
| [DS01](EXERCISE_TOOL_ATLAS.md#ds01) | Classify discrete pole/eigenvalue stability | Pending | |
| [DS02](EXERCISE_TOOL_ATLAS.md#ds02) | Apply Jury conditions and build the table | Pending | |
| [DS03](EXERCISE_TOOL_ATLAS.md#ds03) | Transform the disk and apply Routh | Pending | |
| [DS04](EXERCISE_TOOL_ATLAS.md#ds04) | Derive stable gain intervals on a discrete locus | Pending | |
| [DS05](EXERCISE_TOOL_ATLAS.md#ds05) | Explain discrete Nyquist stability (extension / synthesis) | Pending | |

### Discrete / Performance

| Tool | Exercise | Decision | Teaching behavior / example / priority |
|---|---|---|---|
| [DF01](EXERCISE_TOOL_ATLAS.md#df01) | Measure sampled transient specifications | Pending | |
| [DF02](EXERCISE_TOOL_ATLAS.md#df02) | Derive discrete error constants with physical time | Pending | |
| [DF03](EXERCISE_TOOL_ATLAS.md#df03) | Read sampled-loop frequency requirements | Pending | |
| [DF04](EXERCISE_TOOL_ATLAS.md#df04) | Compare sample periods and discrete quality indices | Pending | |

### Discrete / Controller Design

| Tool | Exercise | Decision | Teaching behavior / example / priority |
|---|---|---|---|
| [DD01](EXERCISE_TOOL_ATLAS.md#dd01) | Emulate a continuous LTI controller | Pending | |
| [DD02](EXERCISE_TOOL_ATLAS.md#dd02) | Design lead and lag directly in the z plane | Pending | |
| [DD03](EXERCISE_TOOL_ATLAS.md#dd03) | Design using discrete frequency and W-plane methods (extension / synthesis) | Pending | |
| [DD04](EXERCISE_TOOL_ATLAS.md#dd04) | Derive and single-step a digital PID | Pending | |
| [DD05](EXERCISE_TOOL_ATLAS.md#dd05) | Design a digital PID analytically | Pending | |
| [DD06](EXERCISE_TOOL_ATLAS.md#dd06) | Place discrete state poles and set tracking gain | Pending | |
| [DD07](EXERCISE_TOOL_ATLAS.md#dd07) | Design a sampled Luenberger observer | Pending | |

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
| User interface | Vietnamese terminology, numeric/keyboard alternatives, readable plots | |
| Platform | Preserve existing Windows/Linux/Mac feasibility investigation | |

## 4. First end-to-end exercises

Select the first paths to make usable; they can cross several workspaces without adding more top-level categories.

- Diagram → SFG/Mason → TF → poles → stability/error:
- ODE → state model → state feedback/observer → actual response:
- Root-locus/frequency requirements → lead/lag design → full-order check:
- Continuous plant/ZOH → recurrence → Jury/transformed Routh → sampled performance:
- Continuous emulation or direct digital design → PID memory stepper → exact sampled-loop check:

## 5. Notes for the next implementation plan

The next plan should use approved exercise contracts, shared mathematical dependencies and measured platform trials. Tool counts are coverage markers rather than estimates of independent code modules. The scope changes from the first draft are documented in [the migration record](research/SCOPE_AND_MIGRATION.md).
