# Run independent agents with the same goal

Copy [WORKER_GOAL.txt](WORKER_GOAL.txt) into each local agent chat. No module ID, agent number or numeric token budget needs editing. This protocol lets each agent select its own unfinished module and deliver one checked contribution. It does not start agents or consume a goal budget merely by reading the guide.

## Exact local repository

```text
C:\Users\baokh\OneDrive\BKHCM\2026-2027\CSDKTD\CSDKTD APP
```

Its Git origin is **https://github.com/ckbk123/CSDKTD_APP.git**. The parent `CSDKTD` directory contains course material; it is not the application checkout. Verify the directory, Git root and origin before changing anything. If the path is missing or the origin is different, report that discrepancy rather than repointing a remote or creating an unrelated clone.

```powershell
Set-Location -LiteralPath 'C:\Users\baokh\OneDrive\BKHCM\2026-2027\CSDKTD\CSDKTD APP'
git rev-parse --show-toplevel
git remote get-url origin
npm run agents:list
```

Use the supported Node/npm toolchain from [DEVELOPMENT.md](DEVELOPMENT.md). On this computer a bundled Node executable was available at `C:\Users\baokh\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe`; check that it exists and use a compatible npm. Prefer runtime discovery if the installed location changes. Do not change global runtime settings to set up a worker.

## What one worker owns and delivers

The goal authorizes selecting **one** eligible module, creating an isolated worktree and unique branch, implementing its accepted teaching contract, committing its own work and pushing that branch to the verified origin. It does not authorize merging into `main`, deploying, changing other modules, changing shared packages/APIs without coordination, or creating additional agents.

Finish through implementation and verification. A plan, empty interface, canned default answer or untested numerical plot does not satisfy the goal. The module's TASK remains the acceptance contract; [START_HERE.md](START_HERE.md) explains the product goal and completion criteria. Shared visual equation entry is already available, but a general symbolic/numerical control toolbox is not.

Success for this worker means **one implemented, checked, committed and pushed module branch with a submitted claim**. Integration into the application is a separate, serialized responsibility. A hard budget stop or unresolved dependency leaves the module partial; it does not turn a checkpoint into a completed contribution.

## Select and reserve work

1. Read AGENTS, START_HERE and [PROJECT_STATUS.md](PROJECT_STATUS.md). Inspect the [module index](AGENT_TASKS.md) and current queue with `npm run agents:list`.
2. Compare candidate TASK/STATUS files with actual code/tests. Prefer an unfinished tool with tractable dependencies, or finish an unclaimed partial tool. IDs are catalogue identities, not implementation priority: alphabetical auto-selection starts with controller design and may be a poor first choice. Examples to inspect for relatively self-contained work include DR02 recurrence, DP02 pole mapping and CP03 sinusoidal gain/phase; read their full contracts before choosing.
3. Check the primary working tree for unrelated edits in that candidate folder. Do not take over a folder someone is already editing merely because its claim is missing. Choose another clean candidate or coordinate ownership.
4. Choose a unique owner label, such as `worker-<random UUID>`, and atomically reserve the chosen ID. Use the returned token for later updates. No user choice of ID is required.

```text
node scripts/agent-claim.mjs claim --owner <unique-owner> --module DP02
```

`claim --owner <unique-owner>` without `--module` is a deterministic fallback, preferring unclaimed `in-progress` entries and then `scaffold` entries. It is not a pedagogical priority ranking. If a race loses the selected claim, read the queue and choose another eligible module. A failed claim for one specified ID does not establish that the whole queue is exhausted. The helper never changes Git branches or implementation files.

All commands return JSON. The claim command returns its ownership token; ordinary list output redacts tokens. An `active`, `submitted`, `handoff` or invalid/orphaned reservation prevents another worker from choosing that module. Reservations never expire based only on age. The helper coordinates worktrees sharing one local Git common directory; separate clones, machines and cloud-synchronized copies do not share a reliable distributed lock.

If all unfinished modules are reserved, or only completed modules remain, report the queue and finish this worker run with **no eligible work**. Do not claim that the project is complete, steal another worker's claim or poll indefinitely. Useful new work becomes eligible when the integration owner deliberately resolves reservations.

## Create an isolated worktree and branch

The primary checkout is the source of the committed baseline and the live student preview. Do not implement in it. Use the `baseCommit` returned by the claim as the recorded starting revision rather than a later moving HEAD; uncommitted primary edits are not included in a new worktree.

Use Codex's managed worktree tool when available, with this exact primary directory as `sourceRoot` and the recorded commit as `ref`. Reuse only a suitable worktree already owned by this worker. Use the returned workspace path explicitly for subsequent commands. Managed worktrees start detached, so create a unique branch there, for example `agents/dp02-<short-random-suffix>`.

If managed worktree tools are unavailable, a normal `git worktree add -b <unique-branch> <new-absolute-path> <baseline-commit>` is an acceptable fallback. Create it outside the primary checkout, such as a unique folder under `%LOCALAPPDATA%\ControlStudio\worktrees`. Do not use a fresh clone: it would lose the shared claim registry. Never overwrite or reset an existing checkout/branch to make setup succeed.

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

- Keep STATUS truthful, usually `in-progress` until all required work/checks pass.
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

## Submit or preserve a partial result

For completed work, run the module tests, `npm run check`, `npm test`, `npm run build` and relevant browser checks in the worker worktree. Record exact results, supported limits and requirement evidence in STATUS. Mark `implemented` only when the accepted bounded contract is complete. Independent review is a later `verified` record; do not invent one.

Commit the final owned changes, verify the intended origin, and push **only the unique worker branch**, then submit its commit/branch/worktree:

```text
git push -u origin <unique-worker-branch>
node scripts/agent-claim.mjs submit --module DP02 --token <token> --branch <unique-worker-branch> --worktree "<absolute-workspace-path>" --commit <tested-commit>
```

Report the ID, branch, commit, what students can now do, actual checks, limitations and the submitted reservation. Leave the reservation in place so another generic worker does not redo unintegrated work. A submitted claim is a handoff record, not a certificate of mathematical correctness or a merged feature. If push fails, preserve the local commit, record the failure and hand off honestly rather than calling the worker objective successful.

When work remains and the run must hand off, update STATUS and commit a recoverable checkpoint, then use:

```text
node scripts/agent-claim.mjs handoff --module DP02 --token <token> --branch <unique-worker-branch> --worktree "<absolute-workspace-path>" --commit <checkpoint-commit> --reason partial
```

Use `--reason blocked` for an actual unresolved dependency, with its concrete details in STATUS. Follow the goal runtime's budget/blocker rules; a partial handoff is not completion of the accepted exercise. If interrupted too abruptly to hand off, the last `active` record and checkpoint remain for recovery.

An unstarted reservation may be released with `release --module <ID> --token <token>`; releases are archived. Once work/refs have been recorded, use submission/handoff and deliberate integration recovery instead of making partial work disappear from the queue.

## Integration and recovery

The integration owner inspects `agents:list`, reviews submitted branches and resolves them **one at a time**. It checks the full TASK, mathematical evidence, scope, dependencies and current-main integration, then merges/cherry-picks the intended commits, reruns combined checks, updates review evidence and pushes `main` under the project's authorized delivery scope. Shared API improvements are integrated deliberately rather than independently by every worker.

The current review batch and coordinator-owned versioning rules are in [COORDINATION.md](COORDINATION.md). Workers do not bump package versions or create release tags. The coordinator assigns one patch increment per accepted integration after review and combined checks.

When review returns a submitted contribution, the coordinator can reopen its existing reservation without an unclaimed interval:

```text
node scripts/agent-claim.mjs reopen --module DP02 --token <token> --reason "Concrete review defect and required correction"
```

This transition requires `submitted` or `handoff`, valid preserved refs and released browser QA. It retains the same owner, token, branch, worktree and checkpoint, records the prior submission and reason in `reopenHistory`, and changes the reservation back to `active`. Only the coordinator performs this review/recovery transition. The original worker continues in its preserved worktree, updates its checkpoint and submits again after correction and verification. Reopening does not make the prior submission accepted and does not consume a release number. Never free a completed reservation merely to return its work to the same owner.

After an integrated contribution's recorded commit is included in the primary HEAD, the owner archives its reservation:

```text
node scripts/agent-claim.mjs resolve --module DP02 --token <token> --resolution integrated --reason "Reviewed and integrated into primary HEAD"
```

The helper checks commit ancestry and requires the module's committed primary-HEAD STATUS to be `implemented` or `verified`; it does not merge or certify the mathematics. Cherry-picking can produce a different commit ID. In that case pass `--integrated-commit <reviewed-primary-commit>` to `resolve`; the archived record preserves both the original worker commit and the integrated commit. Record the review/equivalence evidence rather than claiming ancestry proves that a cherry-pick is mathematically correct.

For partial/interrupted work, verify that the old chat has stopped, inspect its worktree/branch/checkpoint and preserve any remaining edits. Reuse/continue it only with appropriate ownership; otherwise start a new authorized worktree from the preserved checkpoint. Never treat an old date as permission to delete or reset work. The owner may resolve with `--resolution requeue` and a concrete recovery reason only after arranging how the next worker receives the partial work; auto-claiming from primary HEAD alone does not carry an unmerged partial branch forward. A deliberately declined contribution uses `--resolution declined` with a reason and retains recoverable Git history.

Release any browser reservation before resolving the module claim. Only the integration/recovery owner performs these decisions; ordinary workers never clear someone else's reservation to get another task.

## Scaling and goal behavior

Paste the identical goal into more or fewer **local chats using this repository**, depending on the allowance and machine resources you want to use. The queue prevents duplicate compliant workers; it cannot make all 56 tools independent of missing shared mathematics. Start with a small batch, integrate useful foundations and results, then expand. There is no reliable fixed tokens-to-module or tokens-to-agent conversion.

Each worker stops after one submitted contribution or a documented no-eligible-work outcome; it does not wander through the whole backlog. A fresh use of the same goal can select another module. The guide does not create recurring jobs or automatically start another chat.

The prompt uses the standard `/goal <objective>` form. Its detailed instructions live here so the pasted objective stays short. Goal lifecycle/budget behavior is supplied by Codex, not the repository's claim helper: see [official goal commands](https://learn.chatgpt.com/docs/developer-commands#set-or-view-a-task-goal-with-goal) and [Goals verification/budget guidance](https://developers.openai.com/cookbook/examples/codex/using_goals_in_codex).

## Verification at introduction (29 October 2026)

`npm run test:agents` passed 22 tests using temporary Git repositories/worktrees, including simultaneous processes, ownership failures, archived release/recovery, private-branch/worktree validation, cherry-pick integration evidence and exclusive browser QA. The helper's syntax check, application type check and 42 existing application tests passed. The prompt was checked against this computer's exact Git root/origin and contains 1,588 characters, below the documented goal-objective limit. A read-only queue inspection found 56 eligible scaffolds and no real module or browser reservations; tests did not claim application work or alter its Git refs/index. The existing preview still returned HTTP 200.

These checks validate coordination behavior and the unchanged application baseline, not the mathematics of future module contributions. Rerun the relevant checks when the helper changes.
