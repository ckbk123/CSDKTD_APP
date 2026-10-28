# CSDKTD APP

A proposed native C learning application for **Cơ sở điều khiển tự động (EE2019)**, scoped to **SISO LTI**.

**Current stage: course architecture and exercise-tool specification.** The hierarchy below follows the instructor's direction. Detailed interactions and release priorities remain open for review.

```text
Continuous                         Discrete
  System Representation              System Representation
  Plots                              Plots
  Stability                          Stability
  Performance                        Performance
  Controller Design                  Controller Design
```

The same saved model moves through these workspaces. A plot can be reused to construct a graph, explain stability, measure performance or design a controller. Several internal states and a Luenberger observer remain compatible with one external input/output.

## Read in this order

1. [Course architecture and scope](docs/FUNCTIONAL_SPECIFICATION.md): understand the ten blocks and how they connect.
2. [Instructor review](docs/FEATURE_REVIEW.md): review blocks first, then choose their exercise modes.
3. [Exercise tool atlas](docs/EXERCISE_TOOL_ATLAS.md): inspect 56 modes, each tied to a student task, visual explanation and verification contract.

The atlas's modes are parts of ten workspaces, not 56 standalone applications. Reusable math, diagrams and plots support them.

## Evidence and implementation constraints

- [Continuous exercise audit](docs/research/CONTINUOUS_EXERCISE_AUDIT.md) and [Discrete exercise audit](docs/research/DISCRETE_EXERCISE_AUDIT.md): deeper course examples, worksheets, original-slide anchors and diagnostics.
- [External exercise patterns](docs/research/EXTERNAL_EXERCISE_REFERENCES.md): verified university/author problems that inform the interaction design.
- [Existing applet references](docs/research/APPLET_REFERENCES.md): interaction precedents and mathematical references.
- [Slide review](docs/research/SLIDE_REVIEW.md) and [inventory](docs/research/SLIDE_INVENTORY.json): 24 decks / 882 indexed slides, with review limits and provenance.
- [Platform feasibility](docs/PLATFORM_FEASIBILITY.md): C/Raven/Vulkan assessment for requested Windows versions, Linux and macOS. These platforms remain unverified targets.
- [Scope and migration](docs/research/SCOPE_AND_MIGRATION.md): disposition of the first draft's features.

The app's active plan excludes MIMO, nonlinear/ON-OFF/saturation/anti-windup simulation, PLC/hardware control and a general-purpose CAS. Polynomial/rational algebra needed for LTI exercises remains in Representation. Explicit course delay problems remain in scope.

No application has been implemented. Course decks/textbooks remain outside this repository. External code/assets have not been incorporated; dependency and project licensing remain implementation decisions. Prepared/revised 28 October 2026.
