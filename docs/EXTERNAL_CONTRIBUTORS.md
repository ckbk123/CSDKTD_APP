# Contribute from another computer

Copy [CONTRIBUTOR_PROMPT.txt](CONTRIBUTOR_PROMPT.txt) into a coding-agent workspace. It requests **one finite contribution and then a stop**, without assuming a particular agent provider or the owner's local paths. An explicit module/issue can be supplied, but is optional. The older [WORKER_GOAL.txt](WORKER_GOAL.txt) is a continuous local-worker goal and is not the default for this handoff.

Repository: **https://github.com/ckbk123/CSDKTD_APP.git**. A matching existing checkout may be used; otherwise clone into a new folder. Determine the real root with Git. The owner's `C:\Users\baokh\OneDrive\BKHCM\2026-2027\CSDKTD\CSDKTD APP` and bundled runtime paths are historical local details, not portable setup requirements. Follow package engines and [DEVELOPMENT.md](DEVELOPMENT.md) for a supported Node installation. Use a personal fork if upstream write access is unavailable; do not share credentials or change the owner's remotes.

## Choose work without duplicating a submission

Read current upstream main, module TASK/STATUS, [the review log](COORDINATOR_REVIEW_LOG.md), [the coordinator ledger](COORDINATION.md) and any handoff snapshot. A blank scaffold on main can already have a complete unmerged PR. Search **all open upstream PRs and relevant issues**, including draft PR descriptions, for the module ID before choosing it. Review exact commits rather than treating a previous test count as a permanent certificate.

The `agent-claim.mjs` registry is deliberately local to one Git common directory. An empty registry in a friend's clone does **not** mean that all modules are free. Do not copy local claim tokens into GitHub or treat this helper as a distributed lock.

For an unassigned task, publish a visible reservation before substantial work: make a small owned STATUS audit on a unique branch, push it, and open a **draft upstream PR** titled `WIP <MODULE-ID>: <specific task>`. Its body should name the task, bounded ownership, current findings and the fact that implementation/checks are pending. Recheck upstream immediately after creation. If another earlier active reservation overlaps, preserve your checkpoint, withdraw only your own reservation and choose another eligible task, or stop with the conflict recorded. This is a public coordination convention, not an atomic cross-machine lock; the maintainer's explicit assignment wins. Never close or overwrite someone else's PR. When taking an existing correction, obtain an explicit assignment/permission before taking over its owner branch; a separate regression test proposal may be independently scoped.

If GitHub authentication or public reservation is unavailable, inspect and propose a task, but do not silently launch a duplicate implementation. Report the concrete access gap. A maintainer can assign distinct IDs/issues to friends to remove selection ambiguity.

## Scope, evidence and delivery

Keep the owned `STATUS.md` stage line machine-readable: `- **Stage:** implemented` with no trailing prose. Put remaining gates and qualifications on separate lines. Only independent acceptance can change it to `verified`.

Follow AGENTS and [START_HERE.md](START_HERE.md). Portable contributors read the latest instructions in **their upstream-main checkout**; they are not required to access the owner's primary directory. Public TASK/atlas/research records are available in Git. Original course slides remain outside Git and may be unavailable: preserve inspected/proposed distinctions, use cited public sources when appropriate, and report any source-dependent acceptance gap instead of inventing slide evidence.

Own one `src/modules/<id>/**` tree or an explicitly assigned shared correction. Preserve lazy immutable metadata, stateless shared helpers, per-visit state and abort/disposal behavior. Use existing visual equation and native-number APIs. Check actual mathematical meaning before removing TeX tokens; readable input is part of correctness. Keep the compact Indigo/slate interface and author/version identity. Do not alter dependencies, global configuration, versions, tags, main or hosting under a module assignment.

Run the documented checks and actual-browser gates. Keep the PR draft if the task is partial or a required gate is missing. STATUS/PR must explain exact scope, limits, independently derived fixtures, actual test/build results, browser checks and remaining work. Do not call another person's screenshots a new test. Stop at the configured allowance without inventing a higher budget. Push a recoverable checkpoint and precise handoff if completion is impossible.

Once the checked implementation is pushed, reuse the reservation PR, update its description around final behavior and mark it ready if appropriate. The final response must identify its URL and exact pushed SHA. The maintainer reviews, integrates and increments versions separately. **One submission ends this prompt; further work needs a new assignment.**

The prompt keeps scope, repository context, validation and handoff explicit, following [OpenAI's documented workflow guidance](https://developers.openai.com/cookbook/examples/codex/iterating-development-workflows-with-codex). Its project-specific ownership and stop rules are this repository's conventions, not requirements of any agent product.
