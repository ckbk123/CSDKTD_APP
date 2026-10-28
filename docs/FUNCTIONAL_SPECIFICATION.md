# CSDKTD APP: candidate functional specification

**Review draft, 28 October 2026.** This is a menu of proposed functionality, not an approved implementation backlog. The instructor can accept, revise or defer each numbered feature in [FEATURE_REVIEW.md](FEATURE_REVIEW.md). Recommendations reflect the course material, the discussion about Mason and symbolic mathematics, and published interactive teaching tools. They are design judgments, not measured learning outcomes.

## 1. Purpose and course evidence

The application should help students explain why a system behaves as it does. A student should be able to start with a physical model or block diagram, derive an equivalent representation, inspect poles and responses, design a controller, and carry the same model into sampled control. Each stage should preserve a readable explanation and enough settings to reproduce the result.

The source review covers the text, available equation nodes and speaker notes of the 15 current teaching decks, containing 225 slides. Nine longer source decks, containing 657 slides, were indexed and cross-referenced through the existing chapter maps and teaching guides. The inventory therefore contains 882 slides. This is a content and functionality review; it does not certify every image-based equation or reconstruct every source diagram. [Course review and evidence limits](research/SLIDE_REVIEW.md).

The current course explicitly separates simulation/theory from its physical laboratory. The proposal supports the theory course and independent practice. Hardware control, PLC programming and a laboratory acquisition system would require separate scope decisions.

The teaching decks repeatedly ask students to predict a result, change one condition, compare calculations and simulation, explain a misconception, and solve an individual variation. That sequence should shape the interface. Moving sliders alone is insufficient evidence that the student understands the result.

## 2. Proposed experience

### One model, several connected views

The central object is a saved **case**: a plant, controller, feedback structure, inputs, parameters, assumptions and optional initial states. Transfer functions, factors, poles, block diagrams, state models and plots are different views of that case. A change should update affected views together or mark older results as stale. The app must never combine an old response with a new controller without making that comparison explicit.

Students can keep a baseline and compare several alternatives with consistent colors and axes. They can enter exact values, use sliders, or drag appropriate graphical objects. Numeric entry remains available for every essential graphical action. A clear reset returns to the instructor's example.

### Lesson and workbench modes

- **Explore:** show controls and results freely, with a small number of purposeful controls initially visible.
- **Guided lesson:** ask for a prediction, allow a controlled experiment, then reveal an explanation in instructor-selected steps.
- **Check my work:** accept the student's expression, chosen loops, table entries or recurrence and explain a specific discrepancy.
- **Instructor presentation:** larger text and controls, a readable light theme, controlled reveal, and saved presets.

These are proposed local modes. Teacher-controlled reveal is a teaching aid, not a secure examination system. A student who controls the local computer can inspect its files.

### Navigation and terminology

Offer navigation by the 15 teaching sessions and by tool. Use Vietnamese course terminology such as “quỹ đạo nghiệm số” beside an optional English equivalent. Display the active variable, signal, unit and model domain. Distinguish radians from degrees, rad/s from Hz, sample index from seconds, and continuous from discrete models. Colors should be reinforced by labels and line patterns.

### Scope of the first mathematical language

Start with scalar, linear, time-invariant continuous or discrete blocks, signed summing points and explicit signal connections. Store real-valued numerical coefficients and a documented exact symbolic subset. Small state-space models are a later foundation. Nonlinear simulations use selected predefined models with declared domains. General nonlinear block analysis, arbitrary implicit equations and mixed-rate systems are not automatically covered by ordinary Mason or transfer-function operations.

## 3. Candidate feature catalog

**Recommendation labels:** Core = central to the proposed learning environment; Course = a valuable course-backed addition; Extension = broader or more costly functionality for later consideration. **Effort** is a rough relative judgment after shared foundations exist, not a schedule estimate. Every entry is pending instructor review.

<a id="f01"></a>

### F01 — Shared case, parameter and representation workspace

**Recommendation:** Core. **Effort:** High foundational work. **Evidence:** sessions 02:7–11, 04:7–11, 15:7–15.

Students enter a transfer function, coefficient lists, factors or a supported state model and name their signals and parameters. They can substitute values, preserve a baseline, undo a change and switch representation without retyping the system. A parameter panel shows bounds, units, exact expressions and current numerical values. Inputs, initial conditions and feedback signs belong to the saved case.

The workspace shows model equations and indicates which conversions are exact, approximate or dependent on assumptions. Changes invalidate dependent analyses. Zero-state transfer-function output is distinguished from a free response caused by initial conditions. A useful acceptance exercise is to represent the same mass–spring–damper system as an ODE, transfer function and state model and recover the same zero-state trajectory. Different state coordinates require corresponding transformed initial states.

**Instructor choice:** Should students begin in guided course presets, or see the general model editor immediately? Proposed default: presets first, editor one action away.

<a id="f02"></a>

### F02 — Polynomial, rational-expression and pole/zero workbench

**Recommendation:** Core and an explicit discussion requirement. **Effort:** High if exact symbolic algebra is included. **Evidence:** sessions 02:5–9,14; 03:4–8; 06:4,7–9; user discussion on expansion, factoring and roots.

Accept factored or expanded polynomials with symbols and numerical coefficients. Offer explicit operations: expand, collect by power, factor within a named coefficient domain, substitute parameters, combine fractions, and compare two expressions. Show the polynomial degree and coefficient order. Preserve exact factors where possible and label numerical roots as approximations. Common-factor cancellation is a visible operation with the original expression retained.

Link the expression to a pole/zero plot and mode descriptions. Real-coefficient models constrain nonreal roots to conjugate pairs. A selected quadratic shows its discriminant and either its real roots or conjugate pair. Repeated roots retain multiplicity. A Bairstow iteration display is an optional explanation inside this tool, rather than a prerequisite for computing all roots.

**Acceptance:** Re-expanding exact factors reproduces the input polynomial. For `s^4+7s^3+27s^2+47s+26`, recover `(s+1)(s+2)(s^2+4s+13)` and roots `-1,-2,-2±3j`. A general quintic need not have a radical formula. Rounded roots must not be relabeled an exact factorization. Canceled transfer poles do not prove that all internal state modes are stable.

**Instructor choice:** Expose derivation steps by default, or only when requested? Should exact coefficients such as `1/3` be the initial entry convention?

<a id="f03"></a>

### F03 — Targeted transforms, partial fractions and trigonometric forms

**Recommendation:** Extension, with selected Laplace operations useful earlier. **Effort:** Medium to high, depending on symbolic scope. **Evidence:** sessions 02:5, 05:4–6, 12:5; broader transform tables in original chapters 2 and 7; trigonometric manipulation requested in discussion.

Offer named transformations instead of a single ambiguous “simplify” button: partial fractions, supported Laplace/inverse Laplace pairs, angle expansion, product-to-sum, and amplitude/phase form for same-frequency sine/cosine terms. Show each rule, applicable assumptions and the result. Link supported transforms to time responses or sequence views.

**Acceptance:** Exact reconstruction verifies partial fractions. Laplace displays state whether initial conditions are zero. `A sin(ωt)+B cos(ωt)` can become amplitude/phase form for declared real coefficients, with the zero-amplitude case handled. Branch and domain restrictions remain attached to transformations. Unsupported inputs receive a precise explanation rather than an invented result.

**Instructor choice:** Is broad symbolic convenience part of the product, or should this remain a small set of course-specific transformations? Proposed default: the latter until the flagship tools work.

<a id="f04"></a>

### F04 — Feedback, tracking and disturbance sandbox

**Recommendation:** Core. **Effort:** Medium. **Evidence:** session 01:3–11,13–14; session 03:5,13.

Students label reference, error, controller output, plant output and disturbance, then switch between explicitly defined open-loop and feedback laws. They change gain, inject a disturbance at a selected point, add sensor bias, and predict the effect before running. Show `r(t),e(t),u(t),y(t)` together, with separate reference and disturbance transfer channels.

**Acceptance:** For `y'=-y+u+d` and `u=2(r-y)`, obtain `Y/R=2/(s+3)` and `Y/D=1/(s+3)`. A unit reference alone settles to `2/3`; adding constant `d=0.2` gives `11/15`. The app must not imply that feedback necessarily provides unity tracking, or that moving the disturbance leaves its transfer function unchanged.

**Instructor choice:** Use a normalized water-tank illustration, a motor, or both? A simple illustration should identify when its parameters represent an educational model rather than measured hardware.

<a id="f05"></a>

### F05 — Control roles, ON/OFF and hysteresis demonstrations

**Recommendation:** Course; richer relay/PLC examples are extensions. **Effort:** Medium. **Evidence:** session 01:4–6,9,13–14; original chapter 1 includes ON/OFF, relay, timer, counter and PLC examples.

Students identify controller, plant, actuator and sensor roles in prepared scenarios. A temperature or level example lets them change the setpoint, hysteresis band, actuator limits and process lag. Show the switching thresholds, actuator state and process response on the same time axis. An optional delay exposes overshoot and repeated switching.

**Acceptance:** Switching follows the declared upper/lower thresholds and retains the previous state inside the band. Zero hysteresis, finite simulation step and any minimum switching interval are explained. Signal arrows and material/energy flow are visually distinct.

**Instructor choice:** Keep this as a short introductory lesson, or extend into timer/relay logic? Proposed default: short ON/OFF and role exercises, with PLC programming deferred.

<a id="f06"></a>

### F06 — Physical model and ODE laboratory

**Recommendation:** Core. **Effort:** Medium for prepared models, high for arbitrary component assembly. **Evidence:** session 02:4–11,13–14; original chapter 2:1–36.

Begin with a mass–spring–damper model. Students change mass, damping, stiffness, force and initial displacement/velocity, then follow force balance, ODE and transfer-function construction. Compare free and forced motion. Additional curated tabs can cover an RLC circuit, DC motor and thermal process when their source equations are verified.

**Acceptance:** `m=1,b=3,k=2` gives `G=1/(s^2+3s+2)`, poles `-1,-2`, DC gain `0.5`, and final displacement `1 m` for a `2 N` step. Show units and coefficient order. Distinguish zero-input response from a zero-state transfer-function simulation. Changing physical parameters must preserve physical sign/domain constraints or explicitly allow an abstract mathematical experiment.

**Instructor choice:** Which plant families should ship? Proposed first example: the mechanical case already reused throughout the course. Arbitrary electrical/mechanical network drawing is a separate extension.

<a id="f07"></a>

### F07 — Structured block-diagram editor and algebra trainer

**Recommendation:** Core flagship foundation. **Effort:** High. **Evidence:** session 03:3–5,7–11,13–14; original chapter 2:37–74.

Provide gain/transfer blocks, explicit signed summers, pickoffs, input/output ports and directed wires. Allow prepared diagrams and manual construction with snapping, labels, undo and clear crossing/junction notation. Students select series, parallel or feedback reductions, or move a summer/pickoff while supplying the compensating gain. Show the local equations and an undoable before/after view.

**Acceptance:** One signal drives each input port unless a summer explicitly combines sources. Feedback is valid and must not be rejected merely because the graph has a cycle. Check mathematical equivalence for every retained external channel. Warn when a proposed move changes the disturbance path even if reference tracking appears unchanged. The course two-loop case reduces to `1/(s^2+5s+5)`.

**Instructor choice:** Permit unrestricted placement immediately, or start from constrained course diagrams? Proposed default: constrained examples plus a general editor. Importing an arbitrary Simulink file is outside the initial format scope.

<a id="f08"></a>

### F08 — Automatic block-diagram to signal-flow conversion

**Recommendation:** Core flagship. **Effort:** High, sharing F07. **Evidence:** session 03:3,6–11,14; explicit user requirement.

Convert the structured model into an equivalent signal-flow graph. A signal net becomes a variable/node, a transfer block becomes a weighted directed branch, signed summer inputs become signed contributions, and pickoffs refer to the same signal. Selecting a source block/net highlights its corresponding graph elements and equation. Preserve readable labels and allow graph layout changes without changing connectivity.

**Acceptance:** Conversion preserves equations and sign conventions. Crossings without junctions remain disconnected. Distinct valid equivalent graph layouts are accepted. Parallel edges, self-loops, named sources and output pickoffs are supported. For multiple sources, explicitly select the input–output pair and set other independent sources to zero for that transfer calculation. Matrix-valued blocks need scalar expansion or a separate matrix solver; ordinary scalar Mason rules cannot be applied blindly.

**Instructor choice:** Show every intermediate signal node, or offer a simplified equivalent graph as a second view? Proposed default: preserve explanatory intermediate nodes first.

<a id="f09"></a>

### F09 — Mason rule tutor and independent answer checker

**Recommendation:** Core flagship. **Effort:** High. **Evidence:** session 03:6–11,14; original chapter 2: signal-flow/Mason sections; explicit user requirement.

Let students choose forward paths, elementary loops and non-touching sets. Highlight repeated-node paths, duplicate loops, missed self-loops, branch-sign mistakes and loops sharing a node. Construct `Δ` and each path cofactor `Δk` term by term, including non-touching triples and higher sets. Display the unsimplified Mason result before its factored or expanded form.

Independently assemble equations from the original block model and solve them without calling the Mason enumerator. Compare the resulting transfer expressions exactly within the supported rational algebra. The status should say what was checked; numerical sampling alone is not proof of an identity.

**Acceptance:** The S03 nested-loop example has touching loops, no product of those two loops in `Δ`, and final DC gain `0.2`. Add fixtures with disjoint loops, a loop touching only one forward path, parallel branches, self-loops, disconnected components and singular interconnections. Distinguish identically singular equations from an ordinary pole at a particular value of `s`. Large enumeration is interruptible and reports a limit; it never silently omits terms.

**Instructor choice:** Should the tool show an answer immediately, check a student attempt first, or support both? Should explanations follow the exact naming/order used in class?

<a id="f10"></a>

### F10 — Equilibrium and local linearization laboratory

**Recommendation:** Course. **Effort:** Medium for curated models. **Evidence:** session 04:3,6–11,13–14.

Start with `h'=q-sqrt(h)`. Students change the equilibrium and excitation size, inspect the tangent/Jacobian and compare nonlinear with linearized trajectories. Switch visibly between absolute variables and deviations. Overlay the approximation error and ask the learner when the local model becomes inadequate.

**Acceptance:** At `h0=q0=1`, the deviation model is `δh'=-0.5δh+δq`. A step from `q=1` to `1.1` gives linear final change `0.2` and nonlinear final change `0.21`. For other positive operating levels, verify `q0=sqrt(h0)` and slope `-1/(2sqrt(h0))`. Respect `h≥0`; the derivative at `h0=0` is singular. Do not prescribe a universal acceptable input amplitude without an error criterion.

**Instructor choice:** Add pendulum or motor nonlinearities later, or retain one carefully explained tank example?

<a id="f11"></a>

### F11 — State equations, coordinates and phase portrait

**Recommendation:** Course; coordinate animation and general phase portraits are extensions. **Effort:** Medium to high. **Evidence:** session 04:4–5,7–11,14; original chapter 2:75–124.

Build `A,B,C,D` from a second-order ODE, highlighting each state derivative. Edit small matrices and initial states while dimensions and units remain visible. Show state trajectories, output and eigenvalues. In a two-state view, selected initial conditions trace trajectories. An optional invertible coordinate change demonstrates that state coordinates change while input–output behavior can remain the same.

**Acceptance:** The shared mechanical model has `A=[[0,1],[-2,-3]], B=[[0],[1]], C=[[1,0]], D=0`. Recover `C(sI-A)^-1B+D` and matching zero-state output. Coordinate conversion must transform initial conditions and matrices consistently. A prepared nonminimal realization distinguishes hidden eigenmodes from transfer poles after cancellation.

**Instructor choice:** Is the phase portrait a main lesson view or an optional explanation? Proposed default: small two-state examples before arbitrary matrix dimensions.

<a id="f12"></a>

### F12 — Canonical dynamic blocks and linked responses

**Recommendation:** Core. **Effort:** Medium. **Evidence:** session 05:3–11,13–14; original chapter 3.

Choose gain, integrator, practical differentiator, first-order, second-order and delay examples. Apply step, ramp, sinusoid or a finite-width pulse, and inspect the corresponding time/frequency behavior. Mark whether an impulse result is analytic or a finite pulse approximation. A frequency cursor highlights the same point on a sinusoidal measurement, Bode and Nyquist representation.

**Acceptance:** For `G0=1/[(s+1)(s+2)]`, unit-step output is `0.5-exp(-t)+0.5exp(-2t)` and `y(1)≈0.199788`. At `ω=1 rad/s`, magnitude is `0.316228` and phase `-71.565°`. An integrator need not settle; ideal differentiation or direct feedthrough may involve impulses, which cannot be plotted as ordinary finite spikes without an explicit approximation.

**Instructor choice:** Let students combine canonical factors here, or direct them to the general model workspace?

<a id="f13"></a>

### F13 — Second-order poles, damping and transient specifications

**Recommendation:** Core and a good first UI prototype. **Effort:** Medium. **Evidence:** session 07:5–11; supporting sessions 05 and 08.

Move damping ratio and natural frequency with sliders and precise entry. Watch poles, step response, overshoot, rise time and settling time together. Overlay damping grids and requirement regions. Add an optional zero or extra pole to see where the usual second-order prediction becomes less representative.

**Acceptance:** `T=4/(s^2+2s+4)` has `ζ=0.5, ωn=2` and overshoot about `16.303%`. Separate the approximate `2%` settling estimate `4 s` from the measured value about `4.039 s`. Record the rise-time convention and settling-band definition. Critical/overdamped, zero final value, unstable and incomplete-horizon responses need appropriate metric states. A response must remain inside the band, not merely cross it once.

**Instructor choice:** How much formula derivation should accompany each metric? Which settling/rise definitions should match examinations?

<a id="f14"></a>

### F14 — System type, steady-state error and performance comparison

**Recommendation:** Course. **Effort:** Medium. **Evidence:** session 07:3–11,13–14; original chapter 5:8–32.

Switch step, ramp and parabolic references; inspect integrators and error constants; compare reference and disturbance channels. Shade `e(t)` and contributions to IAE, ISE, ITAE or ITSE. Pin several designs to compare errors and control effort over the same interval.

**Acceptance:** `L=4/[s(s+2)]` with unity negative feedback gives zero unit-step error and unit-ramp error `0.5`. Check final-value theorem conditions before reporting an analytic limit. A final simulation sample is not automatically the steady-state error. Integral indices state their horizon and units; an unstable response cannot win through a short horizon or truncation. Unit-feedback system-type tables must not be applied to arbitrary sensor configurations without deriving the correct error signal.

**Instructor choice:** Which integral indices are central, and should students choose a design objective or compare several without an automatic ranking?

<a id="f15"></a>

### F15 — Sinusoidal response and construction of Bode plots

**Recommendation:** Core. **Effort:** Medium. **Evidence:** session 05:4–11,13–14; original chapter 3: frequency-response sections.

Animate input and output sinusoids after showing the transient. Drag frequency and measure amplitude ratio and phase lag. Add individual pole/zero contributions to magnitude and phase, then overlay exact curves and asymptotic approximations. A delay changes phase while preserving magnitude. Provide synchronized cursors and explicit conversion between Hz and rad/s.

**Acceptance:** Use the F12 seed values as a check. Frequency response and time measurements agree once transients have decayed for a stable system. Phase wrapping/unwrapping is explicit, and zero magnitude does not receive a fabricated phase. A finite frequency grid should not be presented as the complete behavior of arbitrary high-order systems.

**Instructor choice:** Should students sketch slopes/corner frequencies before seeing the exact Bode curve? Proposed default: optional guided construction.

<a id="f16"></a>

### F16 — Routh, Hurwitz and stability parameter regions

**Recommendation:** Course with high explanatory value. **Effort:** High for symbolic and special cases. **Evidence:** session 06:4–11,13–14; original chapter 4:4–28.

Fill a Routh table interactively or reveal one cell at a time. Each cell highlights the coefficients and arithmetic used. Vary gain and see first-column signs, RHP pole count and pole locations together. Explain a zero first entry, an all-zero row, the auxiliary polynomial and boundaries. Offer Hurwitz determinants as an alternative calculation.

**Acceptance:** `s^3+7s^2+10s+K` gives first column `1,7,(70-K)/7,K` and strict stability interval `0<K<70`. Evaluate endpoints separately: `K=70` has `±j sqrt(10)` and `K=0` includes a zero root. The variant `s^3+6s^2+8s+K` gives `0<K<48`. A slider illustrates an interval; symbolic inequalities or a documented exact method establish it. Numerical counts are secondary checks away from boundaries.

**Instructor choice:** Start with one-parameter polynomials and selected degrees? General multi-parameter stability regions are a separate extension.

<a id="f17"></a>

### F17 — Root-locus construction and gain selection

**Recommendation:** Course. **Effort:** High. **Evidence:** session 08:4,7–9,11; original chapter 4:29–54.

Adjust gain, drag open-loop poles/zeros and select a candidate closed-loop pole. Reveal real-axis rules, asymptotes, centroid, departure/arrival angles, break points and angle/magnitude conditions separately. Link the complete closed-loop pole set with response and control effort. Students can sketch a prediction before revealing the locus.

**Acceptance:** Compute the full characteristic polynomial at each selected gain. Show angle residual and gain feasibility for a candidate point. Track branches using an appropriate continuation/matching strategy rather than simply sorting complex roots at every step. Repeated roots and infinite branches need explicit handling. Declare the feedback sign and whether negative gain is allowed.

**Instructor choice:** Emphasize rule construction, interactive design, or both? The initial plant can be `1/[s(s+2)]`, already shared by later lessons.

<a id="f18"></a>

### F18 — Lead, lag and lead–lag design in the pole plane

**Recommendation:** Course. **Effort:** High. **Evidence:** session 08:5–11,13–14; original chapter 6:21–45.

Select target poles and inspect angle deficiency. Move compensator poles/zeros and calculate gain. Compare P, lead, lag and lead–lag alternatives with all closed-loop poles, tracking errors, full-order responses and actuator effort. Keep the familiar dominant-pair prediction visible as an approximation to test.

**Acceptance:** The existing lead example uses `C=12(s+8/3)/(s+6)` with plant `1/[s(s+2)]`. Its characteristic polynomial is `(s+4)(s^2+4s+8)`, so retain the third pole and controller zero. The case bank reports full-order overshoot around `7.925%` and ramp error `0.375`; a second-order estimate alone is not the answer for the complete system.

**Instructor choice:** Follow the exact class construction for placing the compensator zero/pole, or offer several methods as named alternatives?

<a id="f19"></a>

### F19 — Nyquist contour, mapping and stability argument

**Recommendation:** Course; full contour special cases can follow a basic version. **Effort:** High. **Evidence:** session 09:4,7,9,11; original chapter 4:55–71.

Move a marker around a declared contour in the `s` plane while the mapped marker traces `L(s)`. Display `-1`, open-loop unstable poles, encirclements and predicted closed-loop unstable poles with an explicit winding convention. Adjust gain and compare the prediction with computed closed-loop poles.

**Acceptance:** Use the simple teaching example `L=4/[(s+1)(s+2)]` before integrator cases. Positive-frequency traces alone do not establish the full criterion. Imaginary-axis poles need a documented indented contour and limiting process. Declare whether clockwise or counterclockwise encirclements are positive. Refine sampling when needed; a coarse polyline can miss a winding.

**Instructor choice:** How much contour theory should be revealed initially? Should Nichols remain an optional representation rather than a core view?

<a id="f20"></a>

### F20 — Bode margins and frequency-domain compensator design

**Recommendation:** Course. **Effort:** High. **Evidence:** session 09:5–9,11,13; original chapter 5:33–42 and chapter 6:46–63.

Select a gain/phase crossover and show where its margin comes from. Drag compensator corners or gain, overlay before/after loop responses, and compare tracking, bandwidth, response and effort. Cross-highlight the selected frequency on Nyquist. Offer requirement bands and a manual design sequence before any automatic parameter suggestion.

**Acceptance:** For the course plant `1/[s(s+2)]`, compare `C0=4` with `C1=4(1+0.7071067812s)/(1+0.3535533906s)`. The reported PM changes from about `51.827°` to `64.471°`, with new crossover `2 rad/s`, while `Kv=2` remains unchanged. Recompute actual crossover after compensation. Distinguish infinite, undefined and multiple margins; a single margin display can mislead for unusual loops. PM/overshoot relations remain approximations.

**Instructor choice:** Include sensitivity `S` and complementary sensitivity `T` as an optional advanced explanation of tracking/noise tradeoffs?

<a id="f21"></a>

### F21 — PID tuning, filtering, noise and actuator limits

**Recommendation:** Course with high interactive value. **Effort:** High for realistic nonlinear cases. **Evidence:** session 10:4–11,13–14; original chapter 6 controller sections.

Switch P, PI, PD and PID structures; adjust gains and derivative-filter time constant; preserve comparison runs. Display each controller term, integrator state, reference, output, error and control effort. Add measurement noise, disturbances and actuator limits as separate experiments. Optional clamping/back-calculation lets students investigate anti-windup.

**Acceptance:** The course plant `1/[(s+1)(s+2)]` compares P `4`, PI `4+2/s` and filtered PID `4+2/s+s/(0.05s+1)`. P settles to `2/3`; these PI/PID examples reach unity but do not automatically improve settling time. Declare controller parameterization, derivative-on-error/measurement, filter and anti-windup law. Compare linear unsaturated and nonlinear saturated runs explicitly. Adding I/D should not trigger an automatic “better” label.

**Instructor choice:** Which anti-windup method, derivative structure and gain notation should match the course? Named anti-windup algorithms are proposed extensions to the slide examples.

<a id="f22"></a>

### F22 — Guided tuning rules and identification from a response curve

**Recommendation:** Extension. **Effort:** Medium after PID and simulation. **Evidence:** session 10:5,9; original chapter 6:65–73; supporting chapter 5 teaching guide.

Students fit a first-order-plus-delay approximation from a simulated response, or explore ultimate gain and oscillation period in a bounded simulation. The app shows the selected rule, its conditions and parameter conversions, then compares the suggested controller with a manual improvement.

**Acceptance:** Disable rules whose assumptions do not apply. Show units and distinguish `Ti,Td` from parallel-form `Ki,Kd`. A documented source discrepancy exists in the original PI response-curve table: it must be resolved before that table becomes an algorithm. A tuning rule is a starting point, not an optimum or general stability guarantee. This experiment is a simulation lesson, not an instruction to destabilize laboratory hardware.

**Instructor choice:** Teach Ziegler–Nichols, another named rule, or only manual tuning? Record the approved reference and controller form.

<a id="f23"></a>

### F23 — Controllability and observability laboratory

**Recommendation:** Course. **Effort:** High matrix foundation. **Evidence:** session 11:4,7–9,14; original chapter 6:75–77,85–87.

Edit small `A,B,C,D` matrices and change actuator/sensor placement. Construct controllability and observability matrices a column or row at a time. A two-state example links rank with reachable and indistinguishable directions. Show numerical singular values and the chosen rank tolerance.

**Acceptance:** The common mechanical state model is controllable and observable with `B=[0;1], C=[1,0]`. Verify matrix dimensions and rank. Numerical rank depends on scaling and tolerance; avoid pretending it is an exact symbolic conclusion. Full controllability/observability and the more advanced stabilizability/detectability concepts require distinct explanations if both appear.

**Instructor choice:** Restrict initial lessons to two/three states, or allow larger matrices in a separate workbench view?

<a id="f24"></a>

### F24 — State feedback, pole placement and reference prefilter

**Recommendation:** Course. **Effort:** High, sharing F23. **Evidence:** session 11:5,7–11,14.

Enter target poles or move them graphically. Calculate state feedback, inspect `A-BK`, and compare actual eigenvalues, trajectories and control effort. Add/remove the reference multiplier and see why pole placement alone does not ensure unity reference tracking.

**Acceptance:** With the common continuous model, target poles `-2,-4` give `K=[6,3]` and reference multiplier `N=8`. Check controllability and independently compute the resulting eigenvalues and DC tracking gain. Report infeasible repeated-pole or numerical cases precisely. Ideal-model prefilter tracking is not disturbance rejection or robustness to model error.

**Instructor choice:** Derive gains by coefficient matching for small systems before exposing a general numerical placement algorithm?

<a id="f25"></a>

### F25 — Continuous Luenberger observer

**Recommendation:** Course. **Effort:** High, sharing state feedback. **Evidence:** session 11:6–11,13.

Set true and estimated initial states independently. Move observer poles, compare measured output with inferred states, and inspect innovation and estimation error. Optional noise/model mismatch experiments explain why arbitrarily fast observer poles can be undesirable.

**Acceptance:** `L=[10;10]` in the shared model gives observer poles `-6,-7`. Independently check `eig(A-LC)` and the simulated error dynamics. An estimated state is not a new sensor measurement, and good output tracking does not establish estimation convergence. Save the observer convention and input knowledge.

**Instructor choice:** Initially show the observer separately from feedback, then connect them, or present a combined system with staged reveals?

<a id="f26"></a>

### F26 — Sampling, aliasing and linked s/z pole planes

**Recommendation:** Course for sampling and mapping; aliasing is an extension of the condensed session. **Effort:** Medium. **Evidence:** sessions 12:4,6–11 and 13:2,4,6,13–14; broader source chapter 7.

Vary sample period and overlay a continuous signal, sample markers and the held actuator input. Show `z=exp(sT)` with linked pole markers, radial decay and sampled oscillation. A separate aliasing experiment compares sinusoids that agree at sample instants. Label the selected continuous-frequency branch when mapping back from `z`.

**Acceptance:** Stable continuous poles map inside the unit circle for positive `T`. Negative real discrete poles can be stable and alternate sign. Mapping back via a complex logarithm is not unique without a branch assumption. Distinguish sample time, integration step and plot density. An aliasing claim requires an explicit signal/bandwidth assumption; a continuous signal cannot generally be reconstructed from samples alone.

**Instructor choice:** Is aliasing a short optional explanation, or a full lesson with reconstruction filters?

<a id="f27"></a>

### F27 — ZOH, Z transform and discrete model conversion

**Recommendation:** Course. **Effort:** High numerical foundation. **Evidence:** session 12:4–11,13–14; original chapter 7:1–51.

Convert supported continuous transfer/state models using a selected method and sample period. Expose exact ZOH formulas, selected transform pairs, resulting discrete transfer function and recurrence. Compare continuous response at sample instants with the discrete model under the same held input and initial state.

**Acceptance:** For `G=1/(s+1), T=0.1`, obtain `y[k+1]=0.90483742y[k]+0.09516258u[k]`. Unit-step samples begin approximately `0.095163,0.181269,0.259182`. The matrix-exponential method must work for singular `A`; the formula using `A^-1` cannot be the only implementation. Distinguish exact ZOH equivalence at samples from Euler/Tustin approximations, and plant discretization from controller discretization.

**Instructor choice:** Which methods appear in the basic menu? Proposed first pair: exact ZOH for plants and a separately named controller discretization tool.

<a id="f28"></a>

### F28 — Difference-equation and memory stepper

**Recommendation:** Course. **Effort:** Medium after discrete models. **Evidence:** session 12:5–10; session 14:5,7–11.

Display a recurrence, its delay diagram, memory slots and sample table together. Advance one sample manually, highlight every old value used, then show the new memory state. Toggle `z` and `z^-1` notation with an explicit coefficient convention. Accept input sequences and initial memory values.

**Acceptance:** The arithmetic matches the declared indexing and recurrence. Old history values are used before updates. Zero-state transfer-function behavior is distinguished from nonzero initial memory. Missing leading coefficients or incompatible causal forms receive a clear message. Equivalent recurrences and supported transfer forms agree on the first samples and a longer run.

**Instructor choice:** Allow an intentionally wrong update-order mode so students can debug it, or keep wrong attempts in a separate check-my-work exercise?

<a id="f29"></a>

### F29 — Jury table, unit-circle stability and gain regions

**Recommendation:** Course. **Effort:** Medium for quadratics, high for full symbolic tables. **Evidence:** session 13:5,7–11,14; original chapter 8:14–19.

Fill applicable inequalities/table rows, vary a parameter and see roots relative to the unit circle. Explain each boundary and let students test a changed polynomial. Offer the full higher-order Jury procedure as a later expansion with a fixed, documented table convention.

**Acceptance:** `p(z)=z^2+(K-1)z+0.2K` is strictly stable for `0<K<2.5`. At `K=2.5`, roots are `-1,-0.5`; the endpoint is excluded. A root sweep illustrates the result but does not prove the entire parameter interval. Distinguish strict stability, marginal boundary cases, multiplicity and input–output qualifications.

**Instructor choice:** Is quadratic Jury sufficient initially, or is a complete row-by-row high-order tutor essential?

<a id="f30"></a>

### F30 — Discrete response, frequency response and quality

**Recommendation:** Course; full discrete root locus/Bode design is an extension. **Effort:** High. **Evidence:** session 13:4,6–11,13–14; original chapter 8:20–62.

Show responses as sample sequences and in seconds, with an explicitly labeled held or interpolated view. Compare tracking errors and transient specifications at different sample periods. Evaluate frequency response on `z=exp(jωT)` with a declared unique-frequency range. Extensions include discrete root locus, bilinear frequency warping and discrete loop shaping.

**Acceptance:** Report settling in both sample count and seconds, never confuse a shorter sequence with faster physical response. Separate changing the sample period of a fixed controller from redesigning it at every period. Check discrete final-value assumptions before reporting steady-state error. Any intersample output requires a continuous plant/hold model; drawing straight lines through samples is not evidence of actual intersample behavior.

**Instructor choice:** Which original-slide extensions should be retained beyond the condensed session 13 lesson?

<a id="f31"></a>

### F31 — Digital PID and compensator implementation

**Recommendation:** Course. **Effort:** High. **Evidence:** session 14:4–11,13–14; original chapter 9:1–32.

Choose controller discretization, positional/incremental PID form, period and initialization. Derive the recurrence, inspect coefficient changes when `T` changes, and run it through F28. Compare continuous and discrete compensators under a common plant. Add filtered derivative, saturation and anti-windup as explicit implementation choices.

**Acceptance:** With `Kp=4,Ki=2,Kd=1,T=0.1`, trapezoidal integration and backward derivative give `u[k]=u[k-1]+14.1e[k]-23.9e[k-1]+10e[k-2]`. Its transfer form is `(14.1z^2-23.9z+10)/(z^2-z)`. With `e[0]=0`, `e[1]=e[2]=1`, `u[0]=0` and earlier history zero, obtain `u[1]=14.1` and `u[2]=4.3`. Verify the old/new history order. Session 14's derivative is unfiltered; session 10's is filtered, so they are different structures. At `T=0.1 s`, the existing lead transformed by Tustin is `(136z-104)/(13z-7)`.

**Instructor choice:** Which discretization and PID form should be the default, and which implementation details must students derive by hand?

<a id="f32"></a>

### F32 — Discrete state feedback and observer

**Recommendation:** Course after F23–F27. **Effort:** High. **Evidence:** session 15:4–11,14–15; original chapter 9:33–61.

Select discrete controller and observer poles, calculate gains and reference multiplier, and compare full-state with estimated-state feedback. Vary initial estimation error and sample period. Display actual closed-loop/observer eigenvalues, state trajectories, error, output and control effort in samples and seconds.

**Acceptance:** With ZOH `T=0.1`, the course targets are controller poles `0.7,0.8` and observer poles `0.3,0.4`. The case gives `Kd≈[4.956502,2.335770]`, `Ld≈[1.023568;1.498984]`, `Nd≈6.956502`. Derive/check these from the saved discrete matrices, not the rounded labels. Changing `T` requires a declared policy: keep a controller fixed or recompute it. Continuous gains cannot simply be copied into the discrete model.

**Instructor choice:** Reuse the continuous state lesson layout or give sampled updates a distinct step-by-step presentation?

<a id="f33"></a>

### F33 — Guided activities, student attempts and instructor presets

**Recommendation:** Core teaching framework. **Effort:** Medium initially, high for a general authoring system. **Evidence:** sessions 01–15, especially slides 09–14.

Package each selected lesson as a question, initial model, permitted controls, prediction, experiment, explanation and individual variation. Preserve attempts without forcing a correct answer before exploration. Feedback should identify a mathematical issue: a wrong summer sign, a shared node between loops, an invalid final-value assumption or a stale memory value.

An instructor can save presets, choose reveal order, hide selected results and supply an alternative example. A simple editable lesson-file format can precede a visual lesson authoring interface. Terminology, hints and preferred derivation order should be instructor configurable.

**Acceptance:** A saved activity restores its model, constraints and progress. Reveal settings remain consistent. Input equivalence is mathematical within the supported algebra, not a string comparison. Local attempts remain local by default. Cloud grading, accounts, class analytics and secure examinations are separate products, not implied by this proposal.

**Instructor choice:** Which checks give hints, which show an answer, and which require a written explanation?

<a id="f34"></a>

### F34 — Comparison, export and accumulated design portfolio

**Recommendation:** Core for saving; richer reports are Course. **Effort:** Medium. **Evidence:** session 15:9–15 and repeated comparison tasks.

Save complete cases and baseline/variant snapshots. Export chart images, sampled CSV data, model equations and a readable design record. Include assumptions, units, input, initial conditions, solver/tolerances, metric definitions, controller structure, version and course-source anchor. A student can build a concise portfolio across the term and explain a changed requirement at the final session.

**Acceptance:** Reopening a case reconstructs results within documented tolerances and reports schema/version migration. Exports match the visible selected case and include enough settings for independent reproduction. Save writes should be atomic or recoverable. Use a portable project format rather than depending on a user's absolute local paths. MATLAB/Octave-compatible text export can be added as an exchange convenience without requiring those tools at runtime.

**Instructor choice:** Plain text/Markdown report, printable HTML, PDF, or several? Proposed first exports: project file, CSV and PNG/SVG where supported.

<a id="f35"></a>

### F35 — Assisted import of existing diagram images

**Recommendation:** Extension; valuable but a separate recognition problem. **Effort:** High and uncertain. **Evidence:** explicit user desire to convert existing block schematics; not an exercise required by the current slides.

Allow an image/PDF page as a background for manual tracing into the structured editor. Later recognition may propose blocks, labels, signs and wires, highlighting uncertain elements. The student confirms the recovered topology before the deterministic conversion/checker runs. Keep the original image beside the interpreted model.

**Acceptance:** Ambiguous crossings, faint minus signs and formula text are never silently guessed as verified mathematics. Connectivity and each block expression can be corrected. Imported data follows the same validation as a hand-drawn structured diagram. General photo recognition cannot support a promise to understand every existing schematic.

**Instructor choice:** Is manual tracing sufficient for early use, or is recognition essential? An online recognition service would add connectivity, privacy and deployment decisions; no such service is assumed for the core app.

## 4. Correctness and explanations shared across tools

### Exact versus numerical results

Exact rational/polynomial work, approximate numerical roots, plotted estimates and textbook approximations need distinct labels. Each mathematical tool should state its supported input class. It may return a useful partial result or an explicit unsupported case. It must not silently replace symbols with guessed values, discard a factor or interpret rounded roots as exact.

Track singularities and assumptions through transformations. Scalar transfer functions normally represent zero-state LTI behavior. Cancellation can change what is visible in one input–output channel without establishing internal stability. A state model needs its eigenmodes considered separately. Near cancellation requires an explicit tolerance and preserved original case.

### Independent checks

Use genuinely different routes where practical: Mason versus original block equations; model conversions versus the original ODE; Routh/Jury interval derivations versus root checks at selected interior/boundary cases; controller design versus recomputed actual eigenvalues. Agreement between two plots using the same cached result is not independent verification. Numerical equality at several parameter values is useful evidence, not a symbolic proof.

The existing `technical/case_bank.json` and MATLAB verification outputs are valuable fixtures. They are authored course exercises, not verbatim textbook data. Review their provenance and recompute relevant checks before adopting them into app tests. Image-based equations and topology need visual verification before becoming fixtures. The source-review document records the known PI tuning-table discrepancy.

### Numerical behavior

Use double precision as a proposed numerical baseline, with scaling and conditioning checks. Root residuals, multiplicities and rank tolerances matter more than showing many decimal places. Repeated roots, near cancellation and badly scaled state models need explanatory diagnostics. Prefer appropriate state-space simulation for high-order models instead of relying on expanded polynomials for every operation.

Simulation time, integration method/tolerance, sampling and plotted point count are different settings. Long-running calculations are cancelable. Fast slider changes supersede older jobs so stale results cannot overwrite the newest case. Limit graph enumeration, matrix size and expression growth through documented resource budgets. A resource limit must be visible and must not produce an incomplete expression labeled complete.

Initial explanatory scope should be agreed before coding: a few dozen diagram nodes, small state models and modest polynomial degrees are reasonable prototype workloads, not approved hard limits. Benchmark them before choosing published limits.

### Charts and measurement

Every plot names signals and units, labels axes and preserves a readable legend. Let the instructor lock scales during comparisons; automatic rescaling can conceal worsening performance. Handle unstable growth, missing asymptotes, undefined phase, multiple crossovers and insufficient horizon as explicit states. Metrics carry their conventions. A finite trace that appears flat is not proof of convergence or stability.

### Accessibility, localization and offline use

Propose offline operation for all core computation and lessons, with no mandatory account or embedded browser. Provide keyboard access and direct numeric alternatives to dragging, scalable text, a high-contrast/light presentation mode and color-independent encoding. Test Vietnamese combining marks, Greek/math symbols, subscripts and clipboard behavior in the actual UI library. Existing Raven feature claims are not a substitute for this test.

Lessons and labels should be external resources so the instructor can revise wording without changing numerical code. The user-facing interface should emphasize mathematical assumptions and results; build/runtime details belong in diagnostics only when needed to solve a problem.

## 5. C application and platform proposal

Separate the C mathematical/model core, lesson data, plotting/diagram logic and UI adapter. Raven is a candidate for the UI layer, not a commitment that every dependency must be written in C. A C-callable native algebra library is an option if it supplies the required exact operations. Dependency choice needs a feature/footprint/license review. A Python CAS can be useful for development-time reference calculations without becoming a runtime requirement.

There is no need for GPU numerical computing for the proposed lessons. Vulkan would render the interface; correctness comes from the mathematical core and validation. Keep mathematical tests runnable without a display so renderer issues do not block equation checks.

The requested Windows 7/8/10/11, Linux and macOS coverage remains a requirement to investigate. API support, a GPU driver, UI code, compiler runtime, packaging and a successful clean-machine run are separate conditions. Raven currently has Vulkan and null backends; null does not draw a usable UI. A real software/OpenGL fallback would be new work. Linux uses X11, with Wayland sessions initially relying on XWayland. macOS needs a Vulkan portability implementation and architecture-specific deployment choices. [Detailed platform findings](PLATFORM_FEASIBILITY.md).

Before committing to a renderer, create a small compatibility trial with Vietnamese/math text, sliders, one diagram, linked plots and file operations on representative machines. Check legacy Windows early. Record package size, startup, idle CPU, memory and interaction latency on named hardware; do not infer total application footprint from Raven's library size.

## 6. Suggested implementation sequence, subject to review

| Stage | Concrete outcome | Main dependencies | Decision before continuing |
|---|---|---|---|
| A: compatibility and numerical trials | A small C/Raven window and an independent mathematical command-line trial; clean-machine evidence | Platform tooling, candidate algebra/root/matrix libraries | Does Raven meet the actual lab machines and required math/text behavior? |
| B: shared model and small teaching slice | F01/F02 foundations, F12/F13 response explorer, basic F33/F34 presets/saving | Exact versus numeric conventions, plotting, project format | Is the interaction/notation suitable for the instructor? |
| C: flagship graph workflow | F07/F08/F09 with student attempts and original-equation cross-check | Structured editor, rational algebra, equation solver, cycle enumeration | Are graph rules and explanations faithful to class practice? |
| D: classical control lessons | F04/F06/F14–F22 selected through review | Model/response core, frequency and stability algorithms | Which tools deserve full guided lessons versus quick reference views? |
| E: state and sampled systems | F10/F11/F23–F32 | Matrix/eigenvalue/exponential methods, recurrence engine | Which original-slide extensions are needed beyond the 15-session core? |
| F: selected extensions | F03, richer F05/F22, F35, advanced exports | Evidence of learning value and remaining engineering capacity | Which accepted needs justify extra scope? |

These stages describe dependency order, not dates. A smaller standalone prototype can precede the flagship editor, while Mason remains the central distinctive proposal. No implementation estimate is reliable until the renderer and exact algebra trials are complete.

## 7. Decisions for instructor review

Record individual feature decisions in the review sheet. The most consequential product decisions are:

1. Is the first release a general workbench with lessons, or a smaller set of tightly guided demonstrations?
2. Must Windows 7/8 support be mandatory even if a fallback renderer is required? Which actual lab GPUs/architectures must work?
3. Should the first flagship be Mason/diagram reasoning or linked pole/response exploration?
4. Which notation, derivation order, controller parameterization and performance conventions should match class/exams?
5. How much symbolic scope is required: rational polynomial algebra, selected transforms, or a broader CAS?
6. Which results may be shown immediately, and which require a student attempt first?
7. Which source-slide extensions belong in this course: PLC examples, complete higher-order Jury, discrete loop shaping, Nichols or broad nonlinear models?
8. Which export format and Vietnamese/English presentation should the instructor review first?

No answer is assumed to approve the entire catalog. The next development plan should include only accepted features, their prerequisites and agreed acceptance examples.
