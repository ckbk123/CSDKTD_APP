import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { discover, runCommand } from './agent-claim.mjs';

const cli = fileURLToPath(new URL('./agent-claim.mjs', import.meta.url));
const fixtures = [];

function git(cwd, ...args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function fixture(stages = { CR01: 'scaffold', CR02: 'scaffold' }) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'control-studio-agent-'));
  fixtures.push(base);
  const root = path.join(base, 'repo'); fs.mkdirSync(root);
  git(root, 'init', '--quiet', '--initial-branch=main');
  for (const [id, stage] of Object.entries(stages)) {
    const folder = path.join(root, 'src', 'modules', id.toLowerCase()); fs.mkdirSync(folder, { recursive: true });
    fs.writeFileSync(path.join(folder, 'STATUS.md'), `# ${id}\n\n- **Stage:** ${stage}\n`);
  }
  git(root, 'add', '.');
  git(root, '-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '--quiet', '-m', 'Fixture baseline');
  return { base, root, context: discover(root) };
}

function claim(root, module, owner = `test-${module}`) {
  const result = runCommand('claim', { owner, ...(module ? { module } : {}) }, root);
  assert.equal(result.claimed, true);
  return result.claim;
}

function recordFile(context, id) {
  return path.join(context.registryPath, 'claims', id, 'record.json');
}

function workerBranch(f, id = 'CR01') {
  const branch = `agents/${id.toLowerCase()}`; const worktree = path.join(f.base, `worktree-${id}`);
  git(f.root, 'worktree', 'add', '--quiet', '-b', branch, worktree, 'HEAD');
  return { branch, worktree, commit: git(worktree, 'rev-parse', 'HEAD') };
}

function workerCommit(f, id = 'CR01') {
  const { branch, worktree } = workerBranch(f, id);
  fs.writeFileSync(path.join(worktree, 'src', 'modules', id.toLowerCase(), 'STATUS.md'), `# ${id}\n\n- **Stage:** implemented\n`);
  git(worktree, 'add', '.');
  git(worktree, '-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '--quiet', '-m', `Fixture ${id} implementation`);
  return { branch, worktree, commit: git(worktree, 'rev-parse', 'HEAD') };
}

function options(record, extra = {}) {
  return { module: record.moduleId, token: record.token, ...extra };
}

function cliResult(cwd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cli, ...args], { cwd, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = ''; let stderr = '';
    child.stdout.on('data', data => { stdout += data; }); child.stderr.on('data', data => { stderr += data; });
    child.on('error', reject);
    child.on('close', code => {
      try { resolve({ code, output: stdout ? JSON.parse(stdout) : undefined, error: stderr ? JSON.parse(stderr) : undefined }); }
      catch { reject(new Error(`Invalid CLI JSON: ${stdout} ${stderr}`)); }
    });
  });
}

afterEach(() => {
  for (const base of fixtures.splice(0)) {
    const target = path.resolve(base); const tempRoot = path.resolve(os.tmpdir());
    // Only this test's freshly created, absolute fixture root can be removed.
    assert.equal(path.dirname(target), tempRoot);
    assert.match(path.basename(target), /^control-studio-agent-/);
    fs.rmSync(target, { recursive: true, force: true });
  }
});

test('reports stages and prefers in-progress without claiming implemented or unknown work', () => {
  const f = fixture({ CR01: 'scaffold', CR02: 'in-progress', CR03: 'implemented', CR04: 'verified', CR05: 'unexpected' });
  const record = claim(f.root);
  assert.equal(record.moduleId, 'CR02');
  const listing = runCommand('list', {}, f.root);
  assert.deepEqual(listing.modules.filter(module => module.eligible).map(module => module.moduleId), ['CR01']);
  assert.equal(listing.modules.find(module => module.moduleId === 'CR05').stage, 'unknown');
  assert.equal('token' in listing.modules.find(module => module.moduleId === 'CR02').claim, false);
  assert.equal(claim(f.root).moduleId, 'CR01');
  assert.equal(runCommand('claim', { owner: 'third' }, f.root).claimed, false);
});

test('simultaneous processes atomically claim different modules', async () => {
  const f = fixture({ CR01: 'scaffold', CR02: 'scaffold', CR03: 'scaffold' });
  const results = await Promise.all([1, 2, 3, 4].map(number => cliResult(f.root, ['claim', '--owner', `worker-${number}`])));
  assert.ok(results.every(result => result.code === 0));
  const taken = results.filter(result => result.output.claimed).map(result => result.output.claim.moduleId);
  assert.deepEqual(taken.sort(), ['CR01', 'CR02', 'CR03']);
  assert.equal(results.filter(result => !result.output.claimed).length, 1);
  assert.ok(results.find(result => !result.output.claimed).output.message.includes('does not mean the project is complete'));
});

test('linked worktrees share the primary checkout status and common registry', () => {
  const f = fixture(); const linked = path.join(f.base, 'linked');
  git(f.root, 'worktree', 'add', '--quiet', '--detach', linked, 'HEAD');
  fs.writeFileSync(path.join(linked, 'src/modules/cr02/STATUS.md'), '- **Stage:** verified\n');
  const rootClaim = claim(f.root, 'CR01'); const linkedClaim = claim(linked, 'CR02');
  assert.equal(rootClaim.moduleId, 'CR01'); assert.equal(linkedClaim.moduleId, 'CR02');
  assert.equal(discover(f.root).registryPath, discover(linked).registryPath);
  assert.equal(discover(linked).canonicalRoot, f.root);
  assert.equal(runCommand('list', {}, linked).modules[1].stage, 'scaffold');
});

test('wrong tokens cannot change, release or resolve a reservation', () => {
  const f = fixture(); const record = claim(f.root, 'CR01');
  const before = fs.readFileSync(recordFile(f.context, 'CR01'), 'utf8');
  for (const command of ['update', 'release', 'resolve']) {
    assert.throws(() => runCommand(command, options(record, { token: 'wrong', resolution: 'requeue', reason: 'test' }), f.root), { code: 'NOT_OWNER' });
    assert.equal(fs.readFileSync(recordFile(f.context, 'CR01'), 'utf8'), before);
  }
});

test('releases only an unstarted claim and preserves an archived record', () => {
  const f = fixture(); const record = claim(f.root, 'CR01');
  const result = runCommand('release', options(record), f.root);
  assert.equal(result.released, true);
  assert.equal(fs.existsSync(recordFile(f.context, 'CR01')), false);
  assert.equal(JSON.parse(fs.readFileSync(path.join(result.archivePath, 'record.json'), 'utf8')).state, 'released');
  assert.equal(fs.existsSync(path.join(result.archivePath, '.mutation-lock')), false);
  assert.notEqual(claim(f.root, 'CR01').token, record.token);
});

test('started claims require handoff or explicit resolution instead of release', () => {
  const f = fixture(); const record = claim(f.root, 'CR01');
  runCommand('update', options(record, { branch: 'agents/cr01' }), f.root);
  assert.throws(() => runCommand('release', options(record), f.root), { code: 'STARTED_CLAIM' });
  const resolved = runCommand('resolve', options(record, { resolution: 'requeue', reason: 'No edits were made; coordinator checked the branch.' }), f.root);
  assert.equal(resolved.resolved, true);
});

test('submitted and handoff work remain reserved across fresh worker attempts', () => {
  for (const command of ['submit', 'handoff']) {
    const f = fixture(); const record = claim(f.root, 'CR01'); const refs = workerCommit(f);
    const result = runCommand(command, options(record, { ...refs, ...(command === 'handoff' ? { reason: 'partial' } : {}) }), f.root);
    assert.equal(result.claim.state, command === 'submit' ? 'submitted' : 'handoff');
    assert.equal(runCommand('claim', { owner: 'later', module: 'CR01' }, f.root).claimed, false);
    assert.equal(claim(f.root).moduleId, 'CR02');
  }
});

test('validates refs, commits and worktree registration before recording a checkpoint', () => {
  const f = fixture(); const record = claim(f.root, 'CR01'); const refs = workerCommit(f);
  const before = fs.readFileSync(recordFile(f.context, 'CR01'), 'utf8');
  assert.throws(() => runCommand('update', options(record, { branch: 'bad branch' }), f.root), { code: 'INVALID_BRANCH' });
  assert.throws(() => runCommand('update', options(record, { commit: 'HEAD;bad' }), f.root), { code: 'INVALID_COMMIT' });
  assert.throws(() => runCommand('update', options(record, { commit: 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef' }), f.root), { code: 'GIT_CHECK_FAILED' });
  assert.throws(() => runCommand('update', options(record, { worktree: f.base }), f.root), { code: 'INVALID_WORKTREE' });
  assert.throws(() => runCommand('update', options(record, { worktree: f.root }), f.root), { code: 'INVALID_WORKTREE' });
  assert.throws(() => runCommand('submit', options(record, { branch: 'main', commit: refs.commit }), f.root), { code: 'PROTECTED_BRANCH' });
  assert.equal(fs.readFileSync(recordFile(f.context, 'CR01'), 'utf8'), before);
  const result = runCommand('update', options(record, refs), f.root);
  assert.equal(result.claim.commit, refs.commit); assert.equal(result.claim.worktree, fs.realpathSync(refs.worktree));
});

test('integration resolution requires the recorded commit in the canonical HEAD', () => {
  const f = fixture(); const record = claim(f.root, 'CR01'); const refs = workerCommit(f);
  runCommand('submit', options(record, refs), f.root);
  assert.throws(() => runCommand('resolve', options(record, { resolution: 'integrated', reason: 'Review passed.' }), f.root), { code: 'GIT_CHECK_FAILED' });
  assert.equal(fs.existsSync(recordFile(f.context, 'CR01')), true);
  git(f.root, 'merge', '--quiet', '--ff-only', refs.branch);
  const result = runCommand('resolve', options(record, { resolution: 'integrated', reason: 'Reviewed and fast-forwarded.' }), f.root);
  assert.equal(result.resolved, true); assert.equal(result.resolution, 'integrated');
  const status = runCommand('list', {}, f.root).modules.find(module => module.moduleId === 'CR01');
  assert.equal(status.stage, 'implemented'); assert.equal(status.eligible, false); assert.equal(status.claim, null);
});

test('integrated resolution checks committed primary status, not an uncommitted status label', () => {
  const f = fixture(); const record = claim(f.root, 'CR01'); const refs = workerBranch(f);
  runCommand('submit', options(record, refs), f.root);
  fs.writeFileSync(path.join(f.root, 'src/modules/cr01/STATUS.md'), '- **Stage:** implemented\n');
  assert.throws(() => runCommand('resolve', options(record, { resolution: 'integrated', reason: 'Only an uncommitted label exists.' }), f.root), { code: 'MODULE_NOT_IMPLEMENTED' });
  assert.equal(fs.existsSync(recordFile(f.context, 'CR01')), true);
});

test('submission revalidates a stored isolated worktree checkpoint', () => {
  const f = fixture(); const record = claim(f.root, 'CR01'); const refs = workerBranch(f);
  runCommand('update', options(record, { branch: refs.branch, commit: refs.commit }), f.root);
  assert.throws(() => runCommand('submit', options(record), f.root), { code: 'SUBMISSION_REFS_REQUIRED' });
  runCommand('update', options(record, { worktree: refs.worktree }), f.root);
  git(f.root, 'worktree', 'remove', refs.worktree);
  assert.throws(() => runCommand('submit', options(record), f.root), { code: 'INVALID_WORKTREE' });
  assert.equal(JSON.parse(fs.readFileSync(recordFile(f.context, 'CR01'), 'utf8')).state, 'active');
});

test('protects primary branches and rejects a worktree on a different branch', () => {
  const f = fixture(); const record = claim(f.root, 'CR01'); const refs = workerBranch(f);
  for (const branch of ['main', 'master']) assert.throws(() => runCommand('update', options(record, { branch }), f.root), { code: 'PROTECTED_BRANCH' });
  git(f.root, 'branch', '-m', 'main', 'instructor');
  assert.throws(() => runCommand('update', options(record, { branch: 'instructor' }), f.root), { code: 'PROTECTED_BRANCH' });
  git(f.root, 'branch', 'different');
  assert.throws(() => runCommand('update', options(record, { worktree: refs.worktree, branch: 'different' }), f.root), { code: 'WORKTREE_BRANCH_MISMATCH' });
});

test('records literal branch names rather than previous-checkout shorthand', () => {
  const f = fixture(); const record = claim(f.root, 'CR01');
  git(f.root, 'switch', '--quiet', '-c', 'previous'); git(f.root, 'switch', '--quiet', 'main');
  assert.equal(git(f.root, 'check-ref-format', '--branch', '@{-1}'), 'previous');
  assert.throws(() => runCommand('update', options(record, { branch: '@{-1}' }), f.root), { code: 'GIT_CHECK_FAILED' });
  assert.equal(JSON.parse(fs.readFileSync(recordFile(f.context, 'CR01'), 'utf8')).branch, undefined);
});

test('cherry-pick resolution preserves the original worker commit and verifies the integrated commit', () => {
  const f = fixture(); const record = claim(f.root, 'CR01'); const refs = workerCommit(f);
  runCommand('submit', options(record, refs), f.root);
  fs.writeFileSync(path.join(f.root, 'unrelated.txt'), 'Another contribution\n');
  git(f.root, 'add', '.');
  git(f.root, '-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '--quiet', '-m', 'Different primary parent');
  git(f.root, '-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'cherry-pick', refs.commit);
  const integratedCommit = git(f.root, 'rev-parse', 'HEAD');
  assert.notEqual(integratedCommit, refs.commit);
  assert.throws(() => runCommand('resolve', options(record, { resolution: 'integrated', reason: 'The original commit is not an ancestor.' }), f.root), { code: 'GIT_CHECK_FAILED' });
  const result = runCommand('resolve', options(record, { resolution: 'integrated', 'integrated-commit': integratedCommit, reason: 'Reviewed equivalent cherry-pick.' }), f.root);
  const archived = JSON.parse(fs.readFileSync(path.join(result.archivePath, 'record.json'), 'utf8'));
  assert.equal(archived.commit, refs.commit); assert.equal(archived.integratedCommit, integratedCommit);
  assert.equal(result.integratedCommit, integratedCommit);
});

test('malformed, missing or old-looking records stay reserved and unknown stages fail closed', () => {
  const f = fixture({ CR01: 'scaffold', CR02: 'scaffold', CR03: 'unknown' });
  fs.mkdirSync(path.join(f.context.registryPath, 'claims', 'CR01'), { recursive: true });
  fs.writeFileSync(recordFile(f.context, 'CR01'), '{broken');
  assert.equal(claim(f.root).moduleId, 'CR02');
  const listing = runCommand('list', {}, f.root);
  assert.equal(listing.modules[0].claim.state, 'invalid'); assert.equal(listing.modules[0].eligible, false);
  assert.throws(() => runCommand('release', { module: 'CR01', token: 'anything' }, f.root), { code: 'NO_VALID_CLAIM' });
  assert.equal(runCommand('claim', { owner: 'new', module: 'CR03' }, f.root).claimed, false);
});

test('an orphaned initialization directory cannot be stolen', () => {
  const f = fixture(); fs.mkdirSync(path.join(f.context.registryPath, 'claims', 'CR01'), { recursive: true });
  assert.equal(runCommand('claim', { owner: 'new', module: 'CR01' }, f.root).claimed, false);
  assert.equal(runCommand('list', {}, f.root).modules[0].claim.state, 'invalid');
});

test('browser QA reservation is exclusive, ownership checked and archived on release', () => {
  const f = fixture(); const a = claim(f.root, 'CR01'); const b = claim(f.root, 'CR02');
  assert.equal(runCommand('qa-claim', options(a), f.root).acquired, true);
  assert.equal(runCommand('qa-claim', options(a), f.root).reused, true);
  const busy = runCommand('qa-claim', options(b), f.root);
  assert.equal(busy.acquired, false); assert.equal(busy.reason, 'busy'); assert.equal(busy.holder.moduleId, 'CR01');
  assert.equal('token' in busy.holder, false);
  assert.throws(() => runCommand('qa-release', options(b), f.root), { code: 'NOT_QA_OWNER' });
  assert.throws(() => runCommand('release', options(a), f.root), { code: 'QA_HELD' });
  assert.throws(() => runCommand('resolve', options(a, { resolution: 'requeue', reason: 'test' }), f.root), { code: 'QA_HELD' });
  const release = runCommand('qa-release', options(a), f.root);
  assert.equal(fs.existsSync(path.join(release.archivePath, 'record.json')), true);
  assert.equal(runCommand('qa-claim', options(b), f.root).acquired, true);
  runCommand('qa-release', options(b), f.root);
  assert.equal(runCommand('list', {}, f.root).browserQa, null);
});

test('QA claims cannot race between different worker processes', async () => {
  const f = fixture(); const a = claim(f.root, 'CR01'); const b = claim(f.root, 'CR02');
  const results = await Promise.all([a, b].map(record => cliResult(f.root, ['qa-claim', '--module', record.moduleId, '--token', record.token])));
  assert.ok(results.every(result => result.code === 0));
  assert.equal(results.filter(result => result.output.acquired).length, 1);
  assert.equal(results.filter(result => result.output.reason === 'busy').length, 1);
});

test('submitted and partial handoffs can reserve browser QA for integration review', () => {
  for (const command of ['submit', 'handoff']) {
    const f = fixture(); const record = claim(f.root, 'CR01'); const refs = workerCommit(f);
    runCommand(command, options(record, { ...refs, ...(command === 'handoff' ? { reason: 'partial' } : {}) }), f.root);
    assert.equal(runCommand('qa-claim', options(record), f.root).acquired, true);
    assert.throws(() => runCommand('resolve', options(record, { resolution: 'declined', reason: 'Review complete.' }), f.root), { code: 'QA_HELD' });
    runCommand('qa-release', options(record), f.root);
    assert.equal(runCommand('resolve', options(record, { resolution: 'declined', reason: 'Preserved the reviewed branch.' }), f.root).resolved, true);
  }
});

test('mutations leave Git refs, tracked files and the index unchanged', () => {
  const f = fixture(); const refs = workerBranch(f); const beforeHead = git(f.root, 'rev-parse', 'HEAD'); const beforeRefs = git(f.root, 'show-ref');
  const record = claim(f.root, 'CR01'); runCommand('update', options(record, refs), f.root);
  runCommand('submit', options(record), f.root);
  assert.equal(git(f.root, 'rev-parse', 'HEAD'), beforeHead); assert.equal(git(f.root, 'show-ref'), beforeRefs);
  assert.equal(git(f.root, 'status', '--porcelain'), '');
});

test('rejects path injection, absent ownership and malformed CLI arguments as JSON', async () => {
  const f = fixture();
  assert.throws(() => runCommand('claim', { owner: 'test', module: '../CR01' }, f.root), { code: 'INVALID_MODULE' });
  assert.throws(() => runCommand('claim', { owner: '', module: 'CR01' }, f.root), { code: 'INVALID_OWNER' });
  const bad = await cliResult(f.root, ['claim', '--owner']);
  assert.equal(bad.code, 1); assert.equal(bad.error.ok, false); assert.equal(bad.error.error.code, 'INVALID_ARGUMENT');
  const unknown = await cliResult(f.root, ['unknown']);
  assert.equal(unknown.code, 1); assert.equal(unknown.error.error.code, 'UNKNOWN_COMMAND');
  const inherited = await cliResult(f.root, ['toString']);
  assert.equal(inherited.code, 1); assert.equal(inherited.error.error.code, 'UNKNOWN_COMMAND');
});

test('does not equate a submitted branch with mathematically verified module status', () => {
  const f = fixture(); const record = claim(f.root, 'CR01'); const refs = workerBranch(f);
  runCommand('submit', options(record, refs), f.root);
  const module = runCommand('list', {}, f.root).modules[0];
  assert.equal(module.claim.state, 'submitted'); assert.equal(module.stage, 'scaffold');
});
