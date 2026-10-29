# Coordinator: current ten-worker batch

The human appointed this chat as review and integration coordinator on **29 October 2026**. This is a finite batch: monitor the ten workers below until they stop, review their contributions, return defects to their owners, and resolve every submission honestly. Do not start replacement workers or take another module under this assignment.

Primary Git checkout:

```text
C:\Users\baokh\OneDrive\BKHCM\2026-2027\CSDKTD\CSDKTD APP
```

Origin: https://github.com/ckbk123/CSDKTD_APP.git. Coordinator chat: `01a182f7-8bce-7fb3-b79d-2ef1b1cfe8dd`, host `local`. The coordinator goal is active; a quiet ten-minute heartbeat named `coordinate-control-studio-workers` is a follow-up in that chat. Pause that heartbeat once the batch is resolved. A human pause takes precedence over both mechanisms.

## Batch registry

All ten were active when this batch was registered. This table records membership, not a live status claim. Use `agents:list`, compact chat snapshots, and each module's STATUS for current evidence. Worktree/branch/checkpoint details live in the shared claim queue; never copy its ownership tokens into this document.

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

The human authorizes the coordinator to message these workers with concrete review/rework instructions and to merge passing contributions. An idle chat is not proof that its accepted exercise is implemented. Preserve partial work and record its actual disposition.

## Review and integration

1. Inspect the exact submitted SHA, TASK, STATUS, full diff and actual implementation. Confirm module ownership, no hidden package/global changes, independent mathematical fixtures, changed/error inputs and declared limits. Review intermediate reasoning and plots as well as final answers. Preliminary review of an active checkpoint is useful but is not acceptance of a later submission.
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

No contribution has been accepted by this coordinator at registration. Add one row per actual decision; include unresolved partials rather than calling the whole batch complete because chats became idle.

| Module | Reviewed source SHA | Decision / release | Evidence or remaining work |
|---|---|---|---|

Completion means all ten chats have stopped and every contribution has a recorded accepted, declined or partial disposition, with no outstanding review/rework action silently dropped. Leave the goal active while useful review, integration or worker progress remains. Once complete, pause the heartbeat and mark the coordinator goal complete.
