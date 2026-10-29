# Project status and completion evidence

Use [START_HERE.md](START_HERE.md) to begin an assignment. This page separates available application foundations from individual teaching-tool implementation. Module progress belongs in each module's `STATUS.md`, linked from the [56-module index](AGENT_TASKS.md).

## Assessed baseline

**29 October 2026, v0.3.0, code baseline `e0b7ddb`.** The tables below are a dated assessment, not an automatically updated claim about later commits. Recheck current source/tests before relying on them. Keep module progress local to its folder so several agents can contribute without editing the same central ledger.

| Foundation | Available at this baseline | Remaining boundary |
|---|---|---|
| Catalogue/navigation | 56 routes, Continuous/Discrete, five topics each, search, one-page navigation | No module-specific mathematical functionality follows from a route existing |
| Module lifecycle | Lazy workspace imports, synchronous mount, abort/cleanup, fresh reset/reopen, stale-import protection | Module implementations must use the contract and release their own resources |
| Selected interface | Control Studio, compact header, version/author, Indigo + slate, pole/zero mark, responsive layout | New tools must fit the existing shell and scoped design |
| Equations | Locally bundled MathLive display/input, symbol buttons, Systems keyboard, curated typeset examples for all 56 modules | Syntax feedback does not validate a system; banner edits are previews and do not update a workspace |
| Mathematical backend | Candidate research and API guidance | No general CAS, control toolbox, numerical roots/matrix library, domain parser or plotting abstraction has been adopted as a shared implementation |
| Cloudflare preparation | Static build/configuration, same-origin assets/CSP, successful packaging dry run | No hosted deployment was performed in this baseline |
| Verification | Type check, 42 tests, production build and [GitHub check run](https://github.com/ckbk123/CSDKTD_APP/actions/runs/40838489801) passed | This verifies foundations and equation integration; it does not certify any of the 56 exercise solvers |

At this assessment, **all 56 `workspace.ts` files were blank mounts**. All 56 exercise implementations therefore start at `scaffold`. The mathematical feature goals were accepted; their acceptance is not delivery. There were no module-owned mathematical tests. See each folder's current progress record for changes after this baseline.

## Module stages

| Stage | Meaning and required evidence |
|---|---|
| `scaffold` | Metadata and a mount entry exist; the accepted exercise is not implemented |
| `in-progress` | Some real functionality exists, with implemented and missing requirements listed separately |
| `implemented` | The accepted bounded contract is implemented; independent mathematical fixtures and project/browser checks are recorded; no required exercise work is silently deferred |
| `verified` | An independent technical review checked the implementation against the TASK and evidence; record reviewer, reviewed revision and findings/resolution |

Stages describe delivery, not confidence inferred from code size or test count. Record unresolved dependencies separately; a dependency request does not automatically mean that no other work can proceed. Preserve the existing evidence when returning a module to `in-progress` after a regression or scope change.

An agent may autonomously complete implementation, verification commands and its delivery record. Independent review can be performed by another agent or the integration owner; these stages introduce no extra human approval requirement. Do not invent a review that did not occur.

## What each module record must say

The module owner maintains `src/modules/<id>/STATUS.md` alongside the stable teaching brief in `TASK.md`:

1. **Stage and assessment:** date, assessed code revision when available, and the owned folder (as declared in the linked TASK).
2. **Requirement audit:** concrete TASK requirements mapped to implemented files/tests, missing behavior and next actions. Break apart the mathematical and teaching steps; avoid a single generic "solver done" claim.
3. **Supported behavior:** input grammar, supported order/size, units/conventions and approximation limits. State whether a visual is computed, schematic or sampled.
4. **Verification:** exact commands/results, independently derived fixtures/reference provenance and actual browser scenarios. Include failures and unperformed checks rather than substituting planned checks.
5. **Remaining work/dependencies:** what is absent, the smallest shared API request if needed, and a useful next action.

Update this record in the same change as the feature. If the user's accepted goal changes, synchronize the TASK/atlas through the integration owner; do not quietly rewrite the requirement to fit an incomplete implementation.

## Reassess rather than trust a label

Read the record, then inspect its implementation and tests. Run relevant checks. A pretty equation banner, populated workspace, fixed baseline result, passing catalogue test or old screenshot is insufficient evidence of a working mathematical tool. Correct a stale record and retain useful existing work.

When reviewing an implemented module, check changed inputs and the important failure cases, not just its default example. Verify that derivation, numerical result and plotted behavior agree. Validate every mode/pole required by the task, and verify lifecycle isolation in the real browser. The detailed quality requirements are in [CONTRIBUTING.md](CONTRIBUTING.md), [DEVELOPMENT.md](DEVELOPMENT.md) and [EQUATION_INPUT.md](EQUATION_INPUT.md).
