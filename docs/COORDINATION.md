# Coordinator: continuous work by ten workers

The human appointed this chat as review and integration coordinator on **29 October 2026**. The subsequent human amendment explicitly replaces the one-module worker limit: each of the ten workers repeatedly claims unfinished work, opens a separate PR per completed module, and continues onto another module within its existing allowance. Monitor them until they actually stop, review their contributions, return defects to their owners, and resolve every submission honestly. Do not start replacement workers, change budgets or take an implementation module under this coordinator assignment.

Primary Git checkout:

```text
C:\Users\baokh\OneDrive\BKHCM\2026-2027\CSDKTD\CSDKTD APP
```

Origin: https://github.com/ckbk123/CSDKTD_APP.git. Coordinator chat: `01a182f7-8bce-7fb3-b79d-2ef1b1cfe8dd`, host `local`. The coordinator goal is active; a quiet ten-minute heartbeat named `coordinate-control-studio-workers` is a follow-up in that chat. Pause that heartbeat once the batch is resolved. A human pause takes precedence over both mechanisms.

## Batch registry

All ten were active when registered. This table records the original membership and initial assignments, not a permanent one-module limit or a live status claim. Follow the same chat IDs as they move to new modules; use `agents:list`, compact chat snapshots, PRs, and each module's STATUS for current evidence. Worktree/branch/checkpoint details live in the shared claim queue; never copy its ownership tokens into this document.

| Module | Worker chat ID (host `local`) | Expected branch |
|---|---|---|
| CP03 | `01a186d2-12d1-77e3-a08c-f9c72e0f3867` | `codex/cp03-sinusoidal-01a186d2` |
| CS01 | `01a18701-1ec8-7073-a23f-e744d40a5355` | `codex/cs01-pole-stability-01a18701` |
| DF01 | `01a18701-3f40-7572-9a49-7dc0103c9161` | `codex/df01-sampled-quality-01a18701` |
| DP01 | `01a18700-cc48-7482-ba96-f9aab107f802` | `codex/dp01-sequences-f802` |
| DP02 | `01a186d1-a367-78f1-98f5-e1cf147ef306` | `codex/dp02-pole-mapping-01a186d1` |
| DR01 | `01a186d1-e192-7e11-a9da-294fb7ec7b78` | `codex/dr01-z-transforms-7e78` |
| DR02 | `01a186d2-0050-7de0-aa3f-c6616623f222` | `codex/dr02-01a186d2` |
| DS01 | `01a186d1-f1f0-7393-88e7-377fbac7299a` | `codex/ds01-unit-circle-7b29f0e3` |
| DS02 | `01a18700-78e9-7a80-af1b-4436e25b10ff` | `codex/ds02-jury-01a18700` |
| DS03 | `01a186d2-2175-7122-ad9f-c01694059c6c` | `codex/ds03-bilinear-2175` |

The human authorizes the coordinator to message these workers with concrete review/rework instructions and to merge passing contributions. Each ready module has its own PR; workers attach created PRs to their chats and record the URL in module STATUS. After PR/claim submission, the worker immediately chooses another eligible module on a new branch/worktree from latest primary main. It preserves earlier submitted work for asynchronous review. Review returns take priority over starting further implementation; checkpoint the newer task before returning to the original worktree/PR. An idle chat is not proof that its accepted exercise is implemented. Preserve partial work and record its actual disposition.

## Review and integration

1. Inspect the module's PR, exact submitted SHA, TASK, STATUS, full diff and actual implementation. Attach every PR this coordinator works on to this chat. Confirm module ownership, no hidden package/global changes, independent mathematical fixtures, changed/error inputs and declared limits. Review intermediate reasoning and plots as well as final answers. Preliminary review of an active checkpoint is useful but is not acceptance of a later submission. Reuse an existing module PR when returning corrections; do not open duplicate PRs for rework.
2. Return actionable defects with a reproduction and expected behavior. Preserve the owner's worktree, branch and claim; never steal a reservation or infer abandonment from its age. For a submitted/handoff reservation, use the coordinator's `reopen` transition with the existing token and concrete reason rather than releasing and racing to reclaim it. The owner must use the updated helper from current main (it can be invoked by absolute path) while continuing in its existing worktree. A returned submission remains unmerged until rechecked. Review against the final resubmitted SHA, including changes since the earlier review.
3. Integrate one frozen contribution at a time in an isolated integration worktree based on current `main`. Preserve the worker's Git history. Run type checks, module and combined application tests, coordination-helper tests and the production build. Inspect relevant browser behavior under the shared QA reservation; do not interrupt a worker's active browser session.
4. Record independent review findings/resolution in the module STATUS. Mark `verified` only with actual evidence. Apply the version policy below, then commit the complete integration/release. Fast-forward primary `main` only to a reviewed and passing result. Verify the remote before pushing `main` and the corresponding version tag. Do not force-push or deploy.
5. Keep the student preview on port **8787** working and showing the accepted build. Worker/integration previews use their own ports. Resolve the module claim only after its reviewed commit is included in primary HEAD and the module's committed STATUS supports integration. Preserve the original source SHA and record any integration SHA mapping.

Use [AUTONOMOUS_WORKERS.md](AUTONOMOUS_WORKERS.md) for claim ownership and recovery rules. Never edit registry JSON by hand. Do not remove worker worktrees during this batch; they remain recoverable for review and repair.

## Version policy

The coordinator alone owns `package.json`, the two root version fields in `package-lock.json`, [CHANGELOG.md](../CHANGELOG.md), and release tags. The visible header already reads the package version automatically.

- Start from `0.3.0`. Each accepted module integration gets the next **patch** version: `0.3.1`, `0.3.2`, and so on, in acceptance order rather than worker start order. A separately integrated user-visible correction also receives a patch increment.
- Checkpoints, unmerged work, rejected submissions, rework attempts and documentation-only coordination updates do not consume a release number. Do not allocate a version to a worker in advance or bump versions in worker branches.
- Update package and lockfile versions together without changing dependency resolutions. Record the module, student-facing behavior, original submitted SHA, important mathematical bounds and actual validation in the changelog. Preserve historical baseline assessments as dated evidence.
- Create an annotated `v<version>` Git tag at the complete reviewed release commit, after checks pass. Do not overwrite a tag. Push the reviewed main commit and tag, preferably atomically, and confirm the remote/CI result. A Git release version does not imply a Cloudflare deployment.
- Old branches may remain based on `0.3.0`; merge their owned files/history instead of replacing the current checkout or copying stale package files. Check combined behavior after every accepted contribution.

## Disposition ledger

[Independent review checkpoints](COORDINATOR_REVIEW_LOG.md) preserve preliminary findings and returned corrections; a checkpoint is not final acceptance.

No contribution had been accepted at registration. Add one row per actual decision, including later modules delivered by the same workers; include unresolved partials rather than calling the work complete because chats became idle.

| Module | PR / reviewed source SHA | Decision / release | Evidence or remaining work |
|---|---|---|---|
| DS03 | [PR #2](https://github.com/ckbk123/CSDKTD_APP/pull/2), `9c39403f72273a65c608f58b134a1a291bc84b38` | Accepted / 0.3.1 | Independent final math/source review, 83 combined application tests, 28 coordination tests, type/build and coordinator production-browser integration checks pass. [Detailed review](../src/modules/ds03/STATUS.md#independent-coordinator-review--29-october-2026). |
| DP01 | [PR #6](https://github.com/ckbk123/CSDKTD_APP/pull/6), `cccba1dc6f0d0469afd9923d3f058220fa5c2a2c` | Accepted / 0.3.2 | Independent final review, all 134 combined application tests, type/build and coordinator production-browser checks pass. [Detailed review](../src/modules/dp01/STATUS.md#independent-coordinator-review--29-october-2026). |
| DS02 | [PR #4](https://github.com/ckbk123/CSDKTD_APP/pull/4), `d394a81d46ae3602284e8f6f4d2a9e4dd2d8c964` | Accepted / 0.3.3 | Exact-row/interval/root and keyboard/browser checks pass; 203 combined tests/type/build pass. Includes independently reviewed shared native-number correction in DP01/DS03. [Detailed review](../src/modules/ds02/STATUS.md#independent-coordinator-review--29-october-2026). |
| CS01 | [PR #8](https://github.com/ckbk123/CSDKTD_APP/pull/8), `75d3528d20f62d082a3151d6a734a4fe237589bd` | Accepted / 0.3.4 | Exact classification/cancellation and independent state-response review, 254 combined tests, 32 coordination tests, type/build and coordinator production-browser checks pass. Shared native reader adaptation has 11 regressions. [Detailed review](../src/modules/cs01/STATUS.md#independent-coordinator-review--29-october-2026). |
| DP01 / DS02 / DS03 correction | Coordinator correction from `ecf398eb8dc32376e994a458e3bff3b666ce118a`; original module histories retained | Accepted / 0.3.5 | Displayed mixed-number and hidden-grouping corrections; 344 tests/type/build, 69 independent probes and actual editor/browser checks pass. [Detailed review](COORDINATOR_REVIEW_LOG.md#visual-notation-correction--035). |
| DS01 | [PR #10](https://github.com/ckbk123/CSDKTD_APP/pull/10), `c88acd370dd27f527f5478a048a6c908321f7177` | Accepted / 0.3.6 | Independent pole/Jordan/realization review; 440 combined tests/type/build and coordinator production checks pass. Native reader adaptation has four regressions. [Detailed review](../src/modules/ds01/STATUS.md#independent-coordinator-review--29-october-2026). |

This amendment supersedes the original native goal's first-batch stopping interpretation. Do not stop coordination when the first ten modules are delivered: follow the same workers' next claims and PRs. Completion means all ten chats have actually stopped and every submitted contribution has a recorded accepted, declined or honestly partial disposition, with no outstanding review/rework action silently dropped. A budget stop preserves unfinished work and is not implementation success. If candidates are temporarily all claimed or pending review, resolve review/rework and let workers resume eligible work rather than declaring the 56-tool backlog complete. Leave the coordinator goal active while useful review, integration or worker progress remains. Once the human-authorized coordination is complete, pause the heartbeat and mark the coordinator goal complete with the actual backlog state.
