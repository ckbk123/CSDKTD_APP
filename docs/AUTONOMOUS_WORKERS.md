# Run independent agents with the same continuous goal

Copy [WORKER_GOAL.txt](WORKER_GOAL.txt) into each local worker chat unchanged. No module ID, agent number or numeric token budget needs editing. Each worker repeatedly selects and delivers tractable unfinished modules, one implementation at a time, with one pull request per module. After PR and claim submission, immediately choose the next eligible module while the coordinator reviews earlier work. An explicit user assignment for one particular module can remain finite. Reading this guide does not start chats, create a goal, change a budget or schedule background work.

## Exact local repository

```text
C:\Users\baokh\OneDrive\BKHCM\2026-2027\CSDKTD\CSDKTD APP
```

Its Git origin is **https://github.com/ckbk123/CSDKTD_APP.git**. The parent `CSDKTD` directory contains course material; it is not the application checkout. Verify the directory, Git root, primary branch `main` and origin before changing anything. If they differ, report the discrepancy rather than repointing a remote, changing primary's branch or creating another clone.

Before each new contribution and each review return, read the **current primary-checkout** `AGENTS.md`, `docs/START_HERE.md`, this guide and `docs/COORDINATION.md`. Preserved worker branches may contain the old one-submission stopping rule. Current primary guides govern coordination; the module TASK remains its accepted exercise contract. Use the current primary claim helper even from an older worker checkout, by absolute script path or by running it from primary without editing primary source.

```powershell
Set-Location -LiteralPath 'C:\Users\baokh\OneDrive\BKHCM\2026-2027\CSDKTD\CSDKTD APP'
git rev-parse --show-toplevel
git branch --show-current
git remote get-url origin
npm run agents:list
```

Use the supported Node/npm toolchain from [DEVELOPMENT.md](DEVELOPMENT.md). On this computer a bundled Node executable was available at `C:\Users\baokh\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe`; check that it exists and use a compatible npm. Prefer runtime discovery if the installed location changes. Do not change global runtime settings to set up a worker.

## Worker loop and ownership

The generic goal authorizes repeatedly choosing and atomically claiming an eligible module, making a fresh isolated worktree and unique branch for that contribution, implementing its full accepted bounded exercise, checking/committing/pushing the branch, creating its PR and submitting its exact tested final revision. Routine PR creation is already authorized; do not ask the user to pick IDs or approve it again. Workers do not merge `main`, change package/lockfile versions or changelog/tags, deploy, rebase submitted branches, edit other modules, change shared packages/APIs without coordination, or spawn agents.

Actively implement only **one module at a time**. Keep earlier submitted claims, branches and worktrees intact for asynchronous review. Multiple submitted contributions and a newer active task do not permit simultaneous implementation in several folders. Keep a private recoverable ledger of each ID, claim, worktree/branch, checkpoint, PR URL and review disposition. Keep tokens outside tracked files. Record the responsible worker chat ID, without tokens, in each owned STATUS so the coordinator can find the chat after its working directory changes.

Finish through implementation and verification. A plan, empty interface, canned default answer or untested numerical plot does not satisfy the goal. The module's TASK remains the acceptance contract; [START_HERE.md](START_HERE.md) explains the product goal and completion criteria. Shared visual equation entry is already available, but a general symbolic/numerical control toolbox is not.

One checked PR and submitted claim are a **contribution milestone, not completion of the continuous goal**. Immediately repeat selection after submission. Earlier review corrections take priority over newer implementation. Integration remains a separate, serialized coordinator responsibility. A hard budget stop or unresolved dependency leaves an honest partial result; it does not make a checkpoint a completed contribution. The finish line and temporary waiting conditions are below.

## Select and reserve work

1. Read current primary guides and [PROJECT_STATUS.md](PROJECT_STATUS.md). Inspect the [module index](AGENT_TASKS.md) and current queue with `npm run agents:list`. Confirm primary is on `main`; the coordinator manages its updates. Never pull, reset or change primary's branch to set up a worker.
2. Compare candidate TASK/STATUS files with actual code/tests. Prefer an unfinished tool with tractable dependencies, or finish an unclaimed partial tool. IDs are catalogue identities, not implementation priority: alphabetical auto-selection starts with controller design and may be a poor first choice. Examples to inspect for relatively self-contained work include DR02 recurrence, DP02 pole mapping and CP03 sinusoidal gain/phase; read their full contracts before choosing.
3. Check the primary working tree for unrelated edits in that candidate folder. Do not take over a folder someone is already editing merely because its claim is missing. Choose another clean candidate or coordinate ownership.
4. Choose a unique owner label, such as `worker-<random UUID>`, and atomically reserve the chosen ID. Use the returned token for later updates. No user choice of ID is required.

```text
node scripts/agent-claim.mjs claim --owner <unique-owner> --module DP02
```

`claim --owner <unique-owner>` without `--module` is a deterministic fallback, preferring unclaimed `in-progress` entries and then `scaffold` entries. It is not a pedagogical priority ranking. If a race loses the selected claim, read the queue and choose another eligible module. A failed claim for one specified ID does not establish that the whole queue is exhausted. The helper never changes Git branches or implementation files.

All commands return JSON. The claim command returns its ownership token; ordinary list output redacts tokens. An `active`, `submitted`, `handoff` or invalid/orphaned reservation prevents another worker from choosing that module. Reservations never expire based only on age. The helper coordinates worktrees sharing one local Git common directory; separate clones, machines and cloud-synchronized copies do not share a reliable distributed lock.

If all unfinished modules are reserved or pending review, this is a **temporary coordination condition**, not proof of a completed backlog. Report the queue and outstanding own reviews, do bounded useful verification/coordination, then await actionable changes without busy polling. Do not steal claims or mark the goal complete. Distinguish this from a genuinely exhausted eligible backlog with all your own reviews resolved; see the finish-line rules below. A single failed claim never establishes either condition.

## Create an isolated worktree and branch

The primary checkout is the source of the committed baseline and live preview. Do not implement in it. **Each new module contribution gets a fresh worktree and unique branch from the latest committed primary `main` captured in its new claim's `baseCommit`.** Never derive the next module from the previous worker branch; that stacks unrelated unmerged modules in its PR. Uncommitted primary edits are excluded. If main advances after claiming, retain the recorded baseline; the following contribution takes a new snapshot. Review corrections instead reuse their original preserved worktree/branch. Do not rebase submitted work to chase main.

Prefer the managed worktree tool when it accepts an exact allowed workspace root. Use primary as `sourceRoot` only when allowed for this chat; a chat attached to parent `CSDKTD` or another linked worktree may be unable to use primary directly. An allowed current linked worktree can be a creation source **only after verifying its origin and common Git directory match primary**, with `ref` set to the exact **new claim's primary `baseCommit`**, never its worker HEAD. Use the returned workspace directory explicitly; managed creation can change the chat's working directory. Managed worktrees start detached, so create a new unique branch there, such as `agents/dp02-<short-random-suffix>`.

If managed creation cannot use an allowed source, a normal `git worktree add -b <unique-branch> <new-absolute-path> <claim-baseCommit>` from an accessible repository location is the fallback. Create it outside primary, such as a unique folder under `%LOCALAPPDATA%\ControlStudio\worktrees`. Do not make a fresh clone, which loses the shared registry. Never overwrite/reset an existing checkout/branch, and preserve all earlier pending worktrees.

Record setup immediately:

```text
node scripts/agent-claim.mjs update --module DP02 --token <token> --branch <unique-branch> --worktree "<absolute-workspace-path>" --commit <baseline-commit>
```

The helper can be called from either the primary checkout or a linked worktree; it resolves the same registry through Git's common directory. Its state is under `control-studio-agent-claims` inside that common Git directory, outside tracked source. Do not copy ownership tokens or registry files into commits or GitHub issues.

These are developer coordination records. They are separate from the student application, which still has no saved exercise/project state.

Install locked dependencies, build, test and run previews **inside the worker's returned workspace**. Do not share another worker's `node_modules` or generated output. Use a free worker preview port, not 8787. Do not kill or rebuild the primary preview to inspect your own branch.

## Implement and checkpoint

Own only `src/modules/<id>/**` for the claimed module, plus its claim metadata. Preserve the shell, routing, identity, shared equation API and lifecycle. Existing shared helpers may be imported; local pure helpers and scoped styles may be added in the owned folder. A shared helper/package request needs a separately coordinated owner, API and consuming exercise. Continue independent implementation and tests while that is resolved.

Make a requirement-to-evidence audit in STATUS, implement the full accepted bounded contract, and verify independently as described in [CONTRIBUTING.md](CONTRIBUTING.md). Record grammar, units, order/size limits, approximation assumptions, changed-input results and useful failure feedback. Never silently reduce the accepted exercise to fit a token allowance.

Checkpoint early and after meaningful milestones:

- Keep STATUS truthful, usually `in-progress` until all required work/checks pass. Record your worker chat ID and branch/worktree for recovery.
- Commit only files in the owned folder. Inspect the staged diff; never stage another worker's files or generated output.
- Update the claim with the current branch, worktree and checkpoint commit. A local checkpoint is recoverable even before push; push your own branch when it provides a useful durable checkpoint.
- Never stash/reset the primary checkout, force-push, remove another worktree, change another worker's claim or merge into `main`.

A hard token limit can stop execution before a final cleanup or handoff. Periodic checkpoints are the recovery mechanism; a prompt cannot guarantee that an agent runs after its budget is exhausted. Respect the chat's configured budget and controls. Do not invent a numerical budget, change it, or spawn extra agents to extend the run.

## Reserve shared browser QA

Compilations, mathematical unit tests and private worktree edits can run independently. Browser viewport/focus controls may be shared by local chats. Reserve browser QA before using the browser, resizing it or capturing module evidence:

```text
node scripts/agent-claim.mjs qa-claim --module DP02 --token <token>
```

If busy, inspect the reported owner and continue independent work. Do not take over its tab, change its viewport, kill its server or repeatedly poll. Retry after another useful checkpoint. Once reserved, use your own tab and worker preview URL, test editing/results/reset/reopen/cleanup and a narrow viewport, restore temporary viewport settings, then release:

```text
node scripts/agent-claim.mjs qa-release --module DP02 --token <token>
```

Browser reservations also have no automatic age expiry. If a chat is interrupted while holding one, the integration owner must verify that the previous work has stopped before recovery. Do not infer this from a timestamp alone.

## One PR and exact submission per module

For completed work, run the module tests, `npm run check`, `npm test`, `npm run build` and relevant browser checks in the worker worktree. Record exact results, supported limits and requirement evidence in STATUS. Mark `implemented` only when the accepted bounded contract is complete. Independent review is a later `verified` record; do not invent one.

1. Inspect the owned diff, commit and push **only the unique worker branch** to the verified origin. Do not include another unmerged module.
2. **Check for an existing PR for this exact branch/module first.** Use connected GitHub tools when sufficient, or `gh pr list --repo ckbk123/CSDKTD_APP --head <branch> --base main --state all --json number,url,state`. Reuse its existing open PR for the contribution and all corrections. Do not create duplicates. If merged/closed, inspect its disposition and coordinate before proceeding; do not silently reopen accepted work or submit a replacement as if new.
3. Create its PR against `main` with a concrete student-facing title and description of the exercise, changed behavior, mathematical limits, actual checks and unresolved issues. The goal authorizes creation. Prefer structured connector arguments. With `gh`, write the exact multiline body to a temporary UTF-8 file outside tracked source, then use `gh pr create --repo ckbk123/CSDKTD_APP --base main --head <branch> --title "Implement DP02 pole mapping exercise" --body-file <absolute-body-file>`. Use a body file when updating descriptions too.
4. **Attach every created PR and every existing PR you work on** with the app's `attach_artifact` tool (`artifact_type: pull_request`, exact URL). Printing a link is not attachment. If the tool is unavailable, preserve the URL and report attachment pending to the coordinator; do not create a replacement PR.
5. Record its PR URL, responsible worker chat ID, branch/worktree and verification evidence in the owned STATUS. Commit/push that delivery record. Ensure the final submitted tree is the verified implementation and update the PR/checks if edits change behavior. The URL can be added after PR creation; the claim must ultimately name the final tested commit including this record.
6. Release QA and verify the final branch/remote/SHA. Submission requires a **clean worktree and index, including nonignored untracked files**, and the recorded tested commit must equal that worktree's current HEAD. Commit and check the final correction and delivery record before submitting; an older checkpoint does not represent later dirty fixes. `DIRTY_WORKTREE` or `SUBMISSION_NOT_HEAD` means preserve the edits, finish the intended commit/checks, then submit that exact HEAD; do not reset work to satisfy the check. Use the current primary helper even if your preserved branch has an older copy:

```text
git push -u origin <unique-worker-branch>
node "C:\Users\baokh\OneDrive\BKHCM\2026-2027\CSDKTD\CSDKTD APP\scripts\agent-claim.mjs" submit --module DP02 --token <token> --branch <unique-worker-branch> --worktree "<absolute-workspace-path>" --commit <tested-final-sha>
```

Leave the submitted reservation and worktree intact. Keep the PR branch stable until the coordinator reopens it for corrections. Record the ID, PR, exact SHA, supported behavior and evidence, then **immediately choose the next eligible module**. Do not issue a goal-complete final after one PR. The coordinator can review asynchronously and version an accepted integration. A submitted claim records delivery/ownership, not mathematical certification.

If push or PR creation fails, preserve the checkpoint and concrete failure, continue independent checks and coordinate an honest handoff. Do not pretend submission succeeded, recreate duplicates after an uncertain outcome, or consume a release number.

## Partial handoff

When work remains and the run must hand off, update STATUS and commit a recoverable checkpoint, then use:

```text
node scripts/agent-claim.mjs handoff --module DP02 --token <token> --branch <unique-worker-branch> --worktree "<absolute-workspace-path>" --commit <checkpoint-commit> --reason partial
```

Use `--reason blocked` for an actual unresolved dependency, with its concrete details in STATUS. Active `update` and partial `handoff` still permit dirty recoverable progress or an older checkpoint; the strict clean/exact-HEAD rule applies to final `submit`. These transitions do not certify uncommitted changes. Follow the goal runtime's budget/blocker rules; a partial handoff is not completion of the accepted exercise. If interrupted too abruptly to hand off, the last `active` record and checkpoint remain for recovery.

An unstarted reservation may be released with `release --module <ID> --token <token>`; releases are archived. Once work/refs have been recorded, use submission/handoff and deliberate integration recovery instead of making partial work disappear from the queue.

## Review returns, integration and recovery

The integration owner inspects `agents:list`, reviews submitted branches and resolves them **one at a time**. It checks the full TASK, mathematical evidence, scope, dependencies and current-main integration, then merges/cherry-picks the intended commits, reruns combined checks, updates review evidence and pushes `main` under the project's authorized delivery scope. Shared API improvements are integrated deliberately rather than independently by every worker.

The current review batch and coordinator-owned versioning rules are in [COORDINATION.md](COORDINATION.md). Workers do not bump package versions or create release tags. The coordinator assigns one patch increment per accepted integration after review and combined checks.

**Coordinator review returns take priority.** Checkpoint the newer active module, update its claim/STATUS honestly, release QA and suspend its implementation. Preserve its reservation/worktree. Read the current primary guides and exact review request. The coordinator can reopen the older contribution's existing reservation without an unclaimed interval:

```text
node scripts/agent-claim.mjs reopen --module DP02 --token <token> --reason "Concrete review defect and required correction"
```

This transition requires `submitted` or `handoff`, valid preserved refs and released browser QA. It retains the same owner, token, branch, worktree and checkpoint, preserves the prior submission/reason in `reopenHistory`, and returns the reservation to `active`. Only the coordinator performs this transition. Do not release/reclaim the module, edit registry JSON or start correction commits on a frozen submitted branch without coordination.

Return to the original preserved worktree and **same PR branch**. Correct the issues, add meaningful regression checks, reverify mathematics/project/browser behavior as relevant, update STATUS and that PR, attach the existing PR, push and resubmit the exact tested corrected SHA. Do not rebase or force-push. Then resume the checkpointed newer module. Several claims can exist while only one implementation context is active. Reopening does not accept the prior submission or consume a release number; never free a reservation merely to return work to its owner.

After an integrated contribution's recorded commit is included in the primary HEAD, the owner archives its reservation:

```text
node scripts/agent-claim.mjs resolve --module DP02 --token <token> --resolution integrated --reason "Reviewed and integrated into primary HEAD"
```

The helper checks commit ancestry and requires the module's committed primary-HEAD STATUS to be `implemented` or `verified`; it does not merge or certify the mathematics. Cherry-picking can produce a different commit ID. In that case pass `--integrated-commit <reviewed-primary-commit>` to `resolve`; the archived record preserves both the original worker commit and the integrated commit. Record the review/equivalence evidence rather than claiming ancestry proves that a cherry-pick is mathematically correct.

For partial/interrupted work, verify that the old chat has stopped, inspect its worktree/branch/checkpoint and preserve any remaining edits. Reuse/continue it only with appropriate ownership; otherwise start a new authorized worktree from the preserved checkpoint. Never treat an old date as permission to delete or reset work. The owner may resolve with `--resolution requeue` and a concrete recovery reason only after arranging how the next worker receives the partial work; auto-claiming from primary HEAD alone does not carry an unmerged partial branch forward. A deliberately declined contribution uses `--resolution declined` with a reason and retains recoverable Git history.

Release any browser reservation before resolving the module claim. Only the integration/recovery owner performs these decisions; ordinary workers never clear someone else's reservation to get another task.

## Waiting and the continuous goal's finish line

Distinguish these conditions before stopping:

- **An eligible unfinished module exists:** choose one and continue, after any earlier correction request. Do not ask for a new assignment after each PR.
- **Everything unfinished is reserved or pending review:** this is temporary, not proof of completion. Record the queue and outstanding own reviews. Do bounded useful verification or prepare actionable dependency information without editing others' work, then await coordination/state changes through bounded event waits. Avoid busy polling, repeated unchanged commentary or an invented waiting budget. Coordinator recovery/review can make work eligible again.
- **No eligible unfinished backlog work remains and all your own reviews have recorded resolved dispositions:** recheck current queue/statuses with the coordinator. Only then can the continuous worker goal succeed. Distinguish accepted integrations, declined/partial work and remaining reservations in the final report. A queue merely held by other workers is the preceding temporary condition, not this finish line.
- **No meaningful progress is possible:** report the concrete blocker and preserved evidence, then obey the runtime's repeated-blocker, budget and pause rules. Exhaustion, pause, interruption or partial handoff is a stopping condition, not success. Do not keep an active goal spinning without useful work or mark it complete to silence it.

The coordinator's batch can finish after all workers have stopped for their actual reasons and every contribution has a recorded disposition. This does not redefine partial worker work as completed mathematics. No worker can continue after its configured allowance; checkpoints make that stop recoverable.

## Scaling and goal behavior

Paste the identical goal into more or fewer **local chats using this repository**, depending on the allowance and machine resources you want to use. The queue prevents duplicate compliant workers; it cannot make all 56 tools independent of missing shared mathematics. Start with a small batch, integrate useful foundations and results, then expand. There is no reliable fixed tokens-to-module or tokens-to-agent conversion.

Workers continue the contribution/review loop within their configured goal lifecycle rather than stopping permanently after one PR. Each module remains an isolated contribution from current primary main. The guide does not create recurring jobs or automatically start another chat; explicit single-module user assignments can still stop after their finite accepted scope is delivered.

The prompt uses the standard `/goal <objective>` form. Its detailed instructions live here so the pasted objective stays short. Goal lifecycle/budget behavior is supplied by Codex, not the repository's claim helper: see [official goal commands](https://learn.chatgpt.com/docs/developer-commands#set-or-view-a-task-goal-with-goal) and [Goals verification/budget guidance](https://developers.openai.com/cookbook/examples/codex/using_goals_in_codex).

## Historical verification at introduction (29 October 2026)

At introduction, `npm run test:agents` passed 22 tests using temporary Git repositories/worktrees, including simultaneous processes, ownership failures, archived release/recovery, private-branch/worktree validation, cherry-pick integration evidence and exclusive browser QA. Helper syntax/application type checks, 42 foundation tests and a build passed. The original finite prompt contained 1,588 characters. The queue then had 56 eligible scaffolds and no real reservations, and the preview returned HTTP 200. These are dated introduction results, not the length/checks of the revised continuous prompt or current module certification.

These checks validate coordination behavior and the unchanged application baseline, not the mathematics of future module contributions. Rerun the relevant checks when the helper changes.
