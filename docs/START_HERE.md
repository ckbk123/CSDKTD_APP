# Start here: implement a Control Studio goal

This is the entry point for an agent receiving a goal such as **"Implement CD02"** or **"Finish the Routh tool"**. Assess the repository first, then complete the missing work within the assigned scope. Do not stop at a proposal or replace an existing implementation without checking it.

## The finished product

Control Studio is a static browser application that helps students **understand, work through and verify SISO LTI control exercises**. Continuous and Discrete systems each contain System Representation, Plots, Stability, Performance and Controller Design. The accepted course plan contains 56 independent teaching tools.

A finished tool lets a student edit understandable mathematical inputs, explore a useful visualization, follow the mathematical reasoning, obtain a checked result and repeat the exercise with changed data. It computes from the student's input within explicit supported limits. A polished page showing a fixed answer does not meet that goal.

Each tool runs inside the existing page and owns its temporary state. Reset and reopen restore its baseline. Preserve the selected Control Studio identity, visual equation entry and keyboard alternatives to dragging. There are no accounts, saving, cross-module models, remote solvers or application API server. The active interface is TypeScript/HTML/CSS; C/WebAssembly is optional future calculation infrastructure.

## Read in this order

| Read | What it answers |
|---|---|
| [AGENTS.md](../AGENTS.md) | Product rules, ownership and integration boundaries |
| [PROJECT_STATUS.md](PROJECT_STATUS.md) | Which foundations exist, what remains, and what status labels mean |
| [Module index](AGENT_TASKS.md), then the assigned folder's `TASK.md` and `STATUS.md` | The accepted teaching goal and the latest recorded progress |
| The assigned `index.ts`, `workspace.ts`, helpers and tests | What actually exists now |
| [CONTRIBUTING.md](CONTRIBUTING.md), [DEVELOPMENT.md](DEVELOPMENT.md), [DESIGN.md](DESIGN.md), [EQUATION_INPUT.md](EQUATION_INPUT.md) | How to implement, integrate and verify the tool |

Read the relevant atlas entry and source audit linked from `TASK.md` when deriving the mathematics. The [functional specification](FUNCTIONAL_SPECIFICATION.md) defines overall scope. The [exercise atlas](EXERCISE_TOOL_ATLAS.md) defines the course catalogue. Historical research is context, not an instruction to restore the native C/Raven application.

Documentation records intent and evidence; current code and reproducible checks establish behavior. A status may be stale. Investigate discrepancies and update the assigned record rather than assuming that a checkbox proves completion. Original course decks remain outside Git; follow the recorded source anchors and distinguish inspected examples from proposed fixtures. If unavailable source material affects correctness, state the gap and continue work that can be verified independently.

## Work autonomously from the assigned goal

1. **Inspect before changing.** Check the working tree and assigned files. Preserve unrelated edits. Establish what runs, what is partial and what is absent. Read existing tests before replacing an algorithm or interface.
2. **Map requirements to evidence.** In the module's `STATUS.md`, break the TASK's Exercise, Tool and Check/variation paragraphs into concrete requirements. For each, record existing files/tests, missing behavior and the next action. Include mathematical substeps and changed-data behavior; do not hide several unfinished requirements behind one broad label.
3. **Choose a bounded implementation.** Declare the supported input grammar, mathematical conventions, limits and failure cases. Derive independent expected results. Preserve the accepted exercise; do not silently reduce a full-module assignment to its baseline demonstration. Resolve routine algorithm, layout, labels and local helper choices yourself.
4. **Build a working slice, then finish the contract.** Implement local inputs, validated models, calculations, visual reasoning and useful errors. Use shared equation inputs for expressions and typeset displays for results. The shell's editable example banner is a notation preview, not a channel carrying inputs into the workspace. Complete the remaining accepted requirements after the initial slice works.
5. **Handle dependencies deliberately.** Reuse existing shared APIs. Local pure helpers may live inside the assigned module. If a shared API/package change is necessary outside your ownership, specify its smallest inputs/results, conventions, limits, failure behavior and tests to the integration owner. Continue independent work. Broader ownership explicitly granted by the user takes precedence; do not manufacture a permission gate for routine local work.
6. **Verify the result.** Run appropriate independent mathematical tests, the project checks and actual browser checks below. Fix failures within your scope. If an unrelated concurrent change breaks a global check, record the exact failure and coordinate it rather than editing another agent's files or claiming success.
7. **Update progress and deliver.** Record supported behavior, requirement evidence, limitations, actual commands/results and browser checks in `STATUS.md`. Mark the appropriate stage honestly. Finish with what works and any remaining requirements or external dependencies. Follow the assignment's Git delivery instructions; keep generated output and unrelated changes out of commits.

Continue through implementation and verification without asking for approval at each routine decision. Clarify when a missing fact changes the accepted educational goal or mathematical correctness, or ownership of a necessary shared change is unresolved. An unanswered optional preference is not a reason to abandon independent work. An actual unresolved requirement is not a reason to label an incomplete tool complete.

## Definition of completion

- The assigned TASK's accepted exercise, visualization and checks work for the declared supported inputs, including changed data. Any remaining requirement is visible in the status record; bounded support does not excuse omitting the core exercise.
- Calculations are verified against independent expected results, residuals or invariants. Domain-specific boundaries and failure cases have useful feedback. Exact algebra, approximations and sampled illustrations remain distinguishable.
- Students can use visual mathematical inputs and understand the intermediate reasoning and result. Plots have meaningful axes/units. Keyboard/numeric controls supplement dragging.
- Metadata remains small and lazy loading still works. The synchronous mount/abort/cleanup contract, reset, reopen and module isolation hold. No mutable exercise state escapes the mount.
- `npm run check`, relevant module tests, `npm test` and `npm run build` pass, with actual results recorded. Browser checks cover editing, calculations, reset/reopen, rapid navigation, cleanup and a narrow viewport. Shared equation fonts and the math keyboard are checked in the real browser.

Passing the existing global tests does not establish that a new solver works. The baseline version's 42 tests cover the scaffold and equation layer. Every implemented mathematical tool needs its own meaningful verification. A second agent can perform the independent technical review for `verified` status; this does not require a new human approval step.

## Example: assess CD02 before coding

CD02's requirement audit should distinguish target-pole selection, angle deficiency/vectors, compensator pole/zero placement, gain calculation, the full compensated root locus and full-model requirement verification. Its task includes a checked baseline and a changed compensator-pole experiment. A page containing only the given compensator formula leaves most of that contract unfinished.

Keep the actual audit in [CD02/STATUS.md](../src/modules/cd02/STATUS.md). This example describes how to assess a tool; it does not declare CD02 implemented or replace its mathematical brief.

## Assignment you can send to an agent

Replace CD02 and its folder when assigning a different module. The [module index](AGENT_TASKS.md) maps all IDs to their briefs and progress records.

```text
Implement CD02 in Control Studio. Start with AGENTS.md and docs/START_HERE.md, then read src/modules/cd02/TASK.md, STATUS.md and the current code/tests. Audit the accepted requirements against what already works, preserve working behavior, and autonomously complete the missing implementation and verification. Own src/modules/cd02/**; coordinate necessary shared API changes. Use the shared visual equation components and the existing mount/reset/cleanup contract. Do not stop at a plan or a fixed-answer demonstration. Update STATUS.md with requirement-level evidence, supported limits, exact test/build/browser results and remaining issues. Do not mark unfinished requirements complete or deploy the application.
```

For a shared-foundation goal, specify the owned shared paths/API and the first consuming module separately. For parallel module work, assign distinct folders and one integration owner for shared changes and final integration. Do not make all 56 agents edit one global progress document or develop competing shared math APIs.
