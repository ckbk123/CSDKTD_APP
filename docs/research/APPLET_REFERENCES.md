# Existing applets, teaching tools and algorithm references

**Research date: 28 October 2026.** The entries below use project authors, universities, official documentation or original papers. Their descriptions distinguish published capabilities from recommendations for CSDKTD APP. No downloaded executable was run, no full browser interaction test was performed, and no solver was audited for correctness. Older tools remain useful design precedents even when their binaries may no longer run on a current machine.

## Interaction precedents

### R01 — Lund University Pole-Zero Explorer (LU-PZE)

**Primary sources:** [live project and its help text](https://lu-pze.github.io/), [authors' 2024 paper](https://arxiv.org/abs/2410.12466).

The project connects pole/zero manipulation with step or impulse response, Bode and Nyquist displays. Its help text describes several comparable transfer functions and optional assignments, achievements and quizzes.

**Proposal for our app:** use synchronized representations and preserved comparison cases in F01/F02/F12/F13/F15. A student should see why moving one pole changes several views, then explain the connection. Assignment prompts can sit beside exploration instead of requiring a separate product.

**Boundary:** gamification is optional. The project's interface and paper do not establish the accuracy or teaching effect of our future implementation. Its page can initially show uninitialized numerical fields before client execution; this review did not treat those as a validated result.

### R02 — Automatic Control with Interactive Tools

**Primary sources:** [University of Almería project](https://www2.ual.es/icontrol/), [closed-loop and stability tools](https://www2.ual.es/icontrol/closed-loop-systems-and-stability/), [published contents](https://www2.ual.es/icontrol/wp-content/uploads/2022/10/contents.pdf).

The authors describe tools for root locus, Nyquist mapping, margins and delay limitations. Their contents also locate physical-model and frequency-response demonstrations, including tanks and motors.

**Proposal:** selective overlays for root-locus construction in F17, a linked contour/mapped curve in F19, and physical parameters connected to transfer behavior in F06. These interactions give a stronger explanation than simply presenting the final chart.

**Boundary:** source pages were reviewed; the full interactive-tools index timed out in this research session. We should assess individual tools directly before claiming UI parity or current binary compatibility. State-space problem material is available on the authors' site, but not all of it belongs in the condensed CSDKTD course.

### R03 — UNED Linear Control System Design (LCSD)

**Primary source:** [UNED project page and feature descriptions](https://www.dia.uned.es/itfe/LCSD/LCSD.html).

LCSD describes a SISO loop-shaping environment with graphical controller/plant parameters, design requirements, frequency plots, root locus and time responses updated together. Its page lists Windows and Mac downloads and historical release notes.

**Proposal:** adopt the idea of one design visible through several synchronized plots in F18/F20/F21, with requirement overlays and locked-axis comparisons. Make the chosen plant/controller/prefilter structure explicit.

**Boundary:** its SYSQUAKE implementation and listed historical Windows compatibility say nothing about Raven's compatibility. Published version notes are from 2019; executable compatibility was not tested. A broad design workbench should be introduced gradually for novices.

### R04 — Interactive Learning Modules for PID control

**Primary sources:** [authors' ILM project](https://arm.ual.es/ilm/), [author's teaching-tool directory](https://w3.ual.es/personal/joguzman/material_docente_itools.html).

The project lists modeling, PID basics/design/loop shaping, windup, dead-time compensation, loop interaction and feedforward modules.

**Proposal:** let students inspect the mechanism behind an output curve in F04/F21/F22: integrator accumulation, limited actuator output, and separate disturbance/noise experiments. Keep anti-windup methods named and selectable. A sequence of small focused lessons can share the same simulation engine.

**Boundary:** advanced dead-time compensation and interacting-loop design extend beyond the core CSDKTD examples. They are optional candidates, not automatic scope additions. Listed modules were not executed during this research.

### R05 — University of Michigan / Carnegie Mellon Control Tutorials

**Primary sources:** [CTMS index](https://ctms.engin.umich.edu/CTMS/), [authors' paper about the tutorials](https://websites.umich.edu/~tilbury/papers/ctm-asme98.pdf).

The index organizes physical applications alongside modeling, analysis, PID, root-locus, frequency, state-space and digital methods. The authors' paper describes the educational sequence and digital-control material.

**Proposal:** reuse one verified physical example across several methods rather than teach each method on an unrelated model. This supports F06/F18/F20/F24/F27 and the accumulated portfolio in F34. Begin with CSDKTD's own mechanical and integrating-plant cases, using external applications as optional comparisons.

**Boundary:** CTMS is a tutorial collection with MATLAB/Simulink workflows, not an independent promise of a native C applet. A direct digital tutorial URL returned 403 during this review; this document does not claim that page was read or tested. The index and authors' paper were available.

### R06 — MIT Interactive Dynamics and Control (IDC)

**Primary source:** [MIT's archived project page](https://web.mit.edu/visdycon/www/).

The historical suite describes `sysresp` for connected system representations/responses, `rlocus` with draggable roots and step-by-step explanations, and `lgraph` for deriving equations from models.

**Proposal:** F01 should preserve a model across representations, F17 should expose the reasoning behind a locus, and F07/F08 should connect diagram elements to equations. These ideas predate current web frameworks and remain applicable to a small native application.

**Boundary:** this is a historical interaction precedent. The page references an old execution environment and FTP binaries. No current OS compatibility or available executable is inferred.

### R07 — Signal Flow Graph Solver

**Primary source:** [AhmedZahRan7 project README and source repository](https://github.com/AhmedZahRan7/Signal-Flow-Graph-Solver).

The author documents a graphical solver showing forward paths, loops, non-touching combinations, the determinant, path cofactors and total transfer result.

**Proposal:** adopt the explanatory sequence in F09, then add our course-specific structured block conversion, linked highlighting and independent original-equation check. In check-my-work mode, explain precisely why two loops touch or why a path repeats a node.

**Boundary:** this source documents an SFG solver. It does not establish reliable conversion from arbitrary block-diagram pictures. Its algorithm, symbolic coverage, license suitability and edge-case behavior would need separate inspection before any code reuse. No code was copied.

### R08 — hneemann/control

**Primary source:** [author's project repository](https://github.com/hneemann/control).

The project describes a browser-based control teaching tool with polynomial and linear-system types, mathematical expression input, and Bode/Nyquist/root-locus/time-response outputs.

**Proposal:** F01/F02 can offer a compact expression entry such as `(s+2)/((s+3)*(s+1))` alongside graphical entry. Text input is valuable for quick reproduction and accessibility. A student's case should be portable independently of its current diagram layout.

**Boundary:** its browser/WebAssembly implementation is a reference for user experience, not the proposed runtime architecture. A general scripting language is optional; a constrained mathematical parser may meet the initial need with a smaller scope.

## Supporting mathematical references

### R09 — SymPy: exact algebra and roots

**Official sources:** [simplification operations](https://docs.sympy.org/latest/tutorials/intro-tutorial/simplification.html), [polynomial roots](https://docs.sympy.org/latest/guides/solving/find-roots-polynomial.html), [factorization internals](https://docs.sympy.org/latest/modules/polys/internals.html).

These references distinguish expansion, factoring, targeted transformations, numerical roots and exact algebraic root objects. They also explain that generic simplification uses heuristics and that symbolic root formulas do not cover every high-degree polynomial.

**Proposal:** F02/F03 should present named operations and explicit exact/approximate output. SymPy can serve as a development-time comparison tool without becoming a Python runtime requirement for the C application. Use it as one reference route, not a declaration that all future app calculations are verified.

### R10 — NIST: iterative roots and quadratic-factor extraction

**Primary reference:** [DLMF section 3.8(iv), including Bairstow's method](https://dlmf.nist.gov/3.8#iv).

NIST describes iterative polynomial root methods, deflation and Bairstow's extraction of real quadratic factors representing real roots or complex conjugate pairs.

**Proposal:** an optional F02 demonstration can show the quadratic coefficients changing and the division remainder shrinking. The app should check convergence and revisit roots against the original polynomial, rather than presenting any starting guess as guaranteed to succeed.

### R11 — Native numerical and algebra library candidates

**Primary sources:** [GNU Scientific Library polynomial routines](https://www.gnu.org/software/gsl/doc/html/poly.html), [SymEngine project and C wrapper](https://github.com/symengine/symengine).

GSL documents a numerical companion-matrix root solver and limits involving multiple roots. SymEngine documents a C++ symbolic library callable through a C wrapper.

**Proposal:** evaluate proven algorithms behind a C-facing mathematical layer. Numerical roots and general symbolic transformations are different capabilities; a numerical library alone does not provide symbolic Mason-expression manipulation. A wrapper does not remove the dependency's runtime or license obligations.

**Boundary:** these are candidates for a later capability/build/license comparison. Neither was built or benchmarked for this application, and neither is an approved dependency.

### R12 — MathWorks: integrated design and explicit reduction

**Official sources:** [Control System Toolbox overview](https://www.mathworks.com/help/control/getting-started-with-control-system-toolbox.html), [polynomial root algorithm](https://www.mathworks.com/help/matlab/ref/roots.html), [pole-zero reduction guidance](https://www.mathworks.com/help/control/ug/pole-zero-simplification.html).

The documentation provides a mature comparison for linked design plots and numerical root calculation. It also makes near pole/zero cancellation a tolerance-dependent reduction that can remove relevant behavior.

**Proposal:** F02/F18/F20 should expose reductions and model changes. F34 should preserve the unreduced case and exact design settings. Control-system software output is useful comparative evidence; the teaching app should still state conventions and independently validate adopted fixtures.

## What this research changes in the proposal

The strongest recurring interaction is one parameter change reflected across several mathematically linked views. Course-specific derivation, student attempts and independent checks distinguish this proposal from a collection of calculators. Existing tools support adopting those interaction patterns; they do not justify adding every advanced control topic to this course.

None of the references above established a complete, audited conversion service for every existing block-schematic image. F35 remains a separately scoped recognition/confirmation workflow. F07–F09 operate deterministically on explicit structured models.

Before borrowing implementation or assets, inspect the exact project's license and attribution requirements. For this documentation pass, the sources provide interaction ideas and algorithm references only.
