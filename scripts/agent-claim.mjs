#!/usr/bin/env node
// Local coordination only. This helper never modifies a Git ref or working tree.
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const stages = new Set(['scaffold', 'in-progress', 'implemented', 'verified']);
const states = new Set(['active', 'submitted', 'handoff', 'released', 'resolved']);
const modulePattern = /^[CD][RPSFD]\d{2}$/;

function fail(code, message) {
  const error = new Error(message);
  error.code = code;
  throw error;
}

function git(cwd, args) {
  try {
    return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  } catch {
    fail('GIT_CHECK_FAILED', `Git check failed: ${args[0]}`);
  }
}

function identity(value) {
  const result = fs.realpathSync(value);
  return process.platform === 'win32' ? result.toLowerCase() : result;
}

function realDirectory(directory, create = false) {
  if (create) {
    try { fs.mkdirSync(directory); } catch (error) { if (error.code !== 'EEXIST') throw error; }
  }
  const stat = fs.lstatSync(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink()) fail('UNSAFE_REGISTRY', 'Registry paths must be ordinary directories.');
}

function worktrees(cwd) {
  return git(cwd, ['worktree', 'list', '--porcelain', '-z']).split('\0')
    .filter(field => field.startsWith('worktree ')).map(field => field.slice(9));
}

function statusStage(text) {
  const matches = [...text.matchAll(/^\s*(?:-\s*)?\*\*Stage:\*\*\s*(\S+)\s*$/gm)];
  return matches.length === 1 && stages.has(matches[0][1]) ? matches[0][1] : 'unknown';
}

export function discover(cwd = process.cwd()) {
  const commonGitDir = git(cwd, ['rev-parse', '--path-format=absolute', '--git-common-dir']);
  const roots = worktrees(cwd);
  if (!roots.length) fail('NO_PRIMARY_WORKTREE', 'No canonical working checkout was found.');
  const canonicalRoot = path.resolve(roots[0]);
  let primaryBranch;
  try { primaryBranch = execFileSync('git', ['symbolic-ref', '--quiet', '--short', 'HEAD'], { cwd: canonicalRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim(); }
  catch { /* A detached primary checkout still protects main and master. */ }
  const protectedBranches = new Set(['main', 'master', ...(primaryBranch ? [primaryBranch] : [])]);
  const modulesRoot = path.join(canonicalRoot, 'src', 'modules');
  if (!fs.existsSync(modulesRoot)) fail('NO_MODULES', 'The primary checkout has no src/modules directory.');
  const modules = fs.readdirSync(modulesRoot, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && modulePattern.test(entry.name.toUpperCase()))
    .map(entry => {
      const moduleId = entry.name.toUpperCase();
      const folder = path.join(modulesRoot, entry.name);
      let stage = 'unknown';
      let issue;
      try {
        const text = fs.readFileSync(path.join(folder, 'STATUS.md'), 'utf8');
        stage = statusStage(text);
        if (stage === 'unknown') issue = 'Missing, ambiguous or unsupported STATUS stage.';
      } catch { issue = 'STATUS.md could not be read.'; }
      return { moduleId, folder, stage, ...(issue ? { issue } : {}) };
    }).sort((a, b) => a.moduleId.localeCompare(b.moduleId));
  if (new Set(modules.map(module => module.moduleId)).size !== modules.length) {
    fail('DUPLICATE_MODULE', 'Module IDs are not unique.');
  }
  const registryPath = path.join(path.resolve(commonGitDir), 'control-studio-agent-claims');
  if (fs.existsSync(registryPath)) realDirectory(registryPath);
  return { canonicalRoot, commonGitDir: path.resolve(commonGitDir), registryPath, modules, protectedBranches };
}

function registryDirectory(context, name, create = false) {
  if (create) {
    realDirectory(context.registryPath, true);
    realDirectory(path.join(context.registryPath, name), true);
  } else if (fs.existsSync(path.join(context.registryPath, name))) {
    realDirectory(path.join(context.registryPath, name));
  }
  return path.join(context.registryPath, name);
}

function moduleById(context, value) {
  const moduleId = String(value ?? '').toUpperCase();
  if (!modulePattern.test(moduleId)) fail('INVALID_MODULE', 'Supply an existing module ID such as CR01.');
  const module = context.modules.find(item => item.moduleId === moduleId);
  if (!module) fail('INVALID_MODULE', `Unknown module: ${moduleId}`);
  return module;
}

function readReservation(directory, resource = false) {
  if (!fs.existsSync(directory)) return null;
  try {
    realDirectory(directory);
    const file = path.join(directory, 'record.json');
    const stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('Not a regular record.');
    const record = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (record.version !== 1 || !modulePattern.test(record.moduleId) || typeof record.owner !== 'string'
      || !record.owner || typeof record.token !== 'string' || !record.token
      || typeof record.createdAt !== 'string' || typeof record.updatedAt !== 'string'
      || (resource ? record.resource !== 'browser-qa' : !states.has(record.state))) throw new Error('Invalid record.');
    for (const key of ['branch', 'worktree', 'commit', 'integratedCommit', 'reason']) {
      if (record[key] !== undefined && typeof record[key] !== 'string') throw new Error('Invalid field.');
    }
    if (record.reopenHistory !== undefined) {
      const required = ['fromState', 'branch', 'worktree', 'commit', 'submittedAt', 'reopenedAt', 'reason'];
      if (!Array.isArray(record.reopenHistory) || record.reopenHistory.some(entry => !entry || typeof entry !== 'object'
        || !['submitted', 'handoff'].includes(entry.fromState)
        || required.some(key => typeof entry[key] !== 'string' || !entry[key])
        || (entry.handoffReason !== undefined && typeof entry.handoffReason !== 'string')
        || Object.keys(entry).some(key => ![...required, 'handoffReason'].includes(key)))) throw new Error('Invalid reopen history.');
    }
    return record;
  } catch {
    return { state: 'invalid', issue: 'Reservation exists without a valid record; inspect it before recovery.' };
  }
}

function publicRecord(record) {
  if (!record) return null;
  const { token: _token, ...rest } = record;
  return rest;
}

function claimPath(context, moduleId) {
  return path.join(registryDirectory(context, 'claims'), moduleId);
}

function qaPath(context) {
  return path.join(registryDirectory(context, 'resources'), 'browser-qa');
}

function writeRecord(directory, record, initial = false) {
  const destination = path.join(directory, 'record.json');
  const text = `${JSON.stringify(record, null, 2)}\n`;
  if (initial) {
    fs.writeFileSync(destination, text, { flag: 'wx', mode: 0o600 });
    return;
  }
  const temporary = path.join(directory, `record-${randomUUID()}.tmp`);
  try {
    fs.writeFileSync(temporary, text, { flag: 'wx', mode: 0o600 });
    fs.renameSync(temporary, destination);
  } finally {
    // Only this operation's explicitly named temporary file is removed.
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
}

function tokenMatches(expected, supplied) {
  if (typeof supplied !== 'string') return false;
  const a = Buffer.from(expected); const b = Buffer.from(supplied);
  return a.length === b.length && timingSafeEqual(a, b);
}

function ownedRecord(context, moduleId, token) {
  const record = readReservation(claimPath(context, moduleId));
  if (!record || record.state === 'invalid' || record.moduleId !== moduleId) fail('NO_VALID_CLAIM', 'No valid claim exists for this module.');
  if (!tokenMatches(record.token, token)) fail('NOT_OWNER', 'The claim token does not match; no files were changed.');
  return record;
}

function withClaimLock(context, moduleId, token, operation) {
  const directory = claimPath(context, moduleId);
  ownedRecord(context, moduleId, token);
  let lockPath = path.join(directory, '.mutation-lock');
  try { fs.mkdirSync(lockPath); } catch (error) {
    if (error.code === 'EEXIST') fail('CLAIM_BUSY', 'Another operation holds this claim. A crashed lock requires explicit inspection.');
    throw error;
  }
  try {
    return operation(ownedRecord(context, moduleId, token), directory, newPath => { lockPath = path.join(newPath, '.mutation-lock'); });
  } finally {
    try { fs.rmdirSync(lockPath); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
}

function checkedWorktree(context, value) {
  if (typeof value !== 'string' || !path.isAbsolute(value) || !fs.existsSync(value)) fail('INVALID_WORKTREE', 'Use an existing absolute worktree root.');
  const target = identity(value);
  if (target === identity(context.canonicalRoot)) fail('INVALID_WORKTREE', 'Worker edits require an isolated worktree, not the primary checkout.');
  if (!worktrees(context.canonicalRoot).some(root => identity(root) === target)) fail('INVALID_WORKTREE', 'Worktree is not registered in this repository.');
  return fs.realpathSync(value);
}

function validatePatch(context, options, oldRecord) {
  const patch = {};
  if (options.branch !== undefined) {
    if (!options.branch || /\s/.test(options.branch)) fail('INVALID_BRANCH', 'Branch must be a valid local Git branch name.');
    if (context.protectedBranches.has(options.branch)) fail('PROTECTED_BRANCH', 'Workers must use their own branch rather than main, master or the primary checkout branch.');
    git(context.canonicalRoot, ['check-ref-format', '--branch', options.branch]);
    git(context.canonicalRoot, ['check-ref-format', `refs/heads/${options.branch}`]);
    patch.branch = options.branch;
  }
  if (options.worktree !== undefined) {
    patch.worktree = options.worktree;
  }
  if (options.commit !== undefined) {
    if (!/^[a-f0-9]{7,64}$/i.test(options.commit)) fail('INVALID_COMMIT', 'Commit must be an existing hexadecimal commit ID.');
    patch.commit = git(context.canonicalRoot, ['rev-parse', '--verify', `${options.commit}^{commit}`]);
  }
  const next = { ...oldRecord, ...patch };
  if (next.worktree !== undefined) {
    next.worktree = checkedWorktree(context, next.worktree);
    if (options.worktree !== undefined) patch.worktree = next.worktree;
  }
  if (next.worktree && next.branch) {
    const actualBranch = git(next.worktree, ['symbolic-ref', '--quiet', '--short', 'HEAD']);
    if (actualBranch !== next.branch) fail('WORKTREE_BRANCH_MISMATCH', 'The worktree is not checked out on the recorded worker branch.');
  }
  if (next.commit && next.branch) {
    git(context.canonicalRoot, ['rev-parse', '--verify', `refs/heads/${next.branch}^{commit}`]);
    git(context.canonicalRoot, ['merge-base', '--is-ancestor', next.commit, `refs/heads/${next.branch}`]);
  }
  return patch;
}

function assertQaReleased(context, moduleId) {
  const qa = readReservation(qaPath(context), true);
  if (qa?.state === 'invalid' || qa?.moduleId === moduleId) fail('QA_HELD', 'Release this module\'s browser QA reservation first; invalid QA records require inspection.');
}

function archive(context, directory, record, moved) {
  const archiveRoot = registryDirectory(context, 'archive', true);
  const destination = path.join(archiveRoot, `${record.moduleId}-${Date.now()}-${randomUUID()}`);
  writeRecord(directory, record);
  fs.renameSync(directory, destination);
  moved?.(destination);
  return destination;
}

export function runCommand(command, options = {}, cwd = process.cwd()) {
  const context = discover(cwd);
  const base = { ok: true, registryPath: context.registryPath, canonicalRoot: context.canonicalRoot };
  if (command === 'list') {
    return { ...base, modules: context.modules.map(module => {
      const claim = readReservation(claimPath(context, module.moduleId));
      return { ...module, eligible: ['scaffold', 'in-progress'].includes(module.stage) && !claim, claim: publicRecord(claim) };
    }), browserQa: publicRecord(readReservation(qaPath(context), true)) };
  }
  if (command === 'claim') {
    if (typeof options.owner !== 'string' || !options.owner.trim() || options.owner.length > 160 || /[\x00-\x1f]/.test(options.owner)) {
      fail('INVALID_OWNER', 'Provide a unique nonempty owner label of at most 160 characters.');
    }
    const candidates = options.module ? [moduleById(context, options.module)] : [...context.modules]
      .sort((a, b) => (a.stage === 'in-progress' ? 0 : 1) - (b.stage === 'in-progress' ? 0 : 1) || a.moduleId.localeCompare(b.moduleId));
    registryDirectory(context, 'claims', true);
    for (const module of candidates) {
      if (!['scaffold', 'in-progress'].includes(module.stage)) continue;
      const directory = claimPath(context, module.moduleId);
      try { fs.mkdirSync(directory); } catch (error) { if (error.code === 'EEXIST') continue; throw error; }
      const now = new Date().toISOString();
      const record = { version: 1, moduleId: module.moduleId, owner: options.owner.trim(), token: randomUUID(), state: 'active',
        createdAt: now, updatedAt: now, baseCommit: git(context.canonicalRoot, ['rev-parse', 'HEAD']) };
      // An interrupted/failed initialization stays reserved, never silently stolen.
      writeRecord(directory, record, true);
      return { ...base, claimed: true, claim: record, moduleFolder: module.folder };
    }
    return { ...base, claimed: false, reason: 'no-eligible-module', message: 'No unreserved unfinished module is eligible. This does not mean the project is complete.' };
  }
  const module = moduleById(context, options.module);
  return withClaimLock(context, module.moduleId, options.token, (record, directory, moved) => {
    if (command === 'qa-claim') {
      if (!['active', 'submitted', 'handoff'].includes(record.state)) fail('INACTIVE_CLAIM', 'Browser QA requires an active or submitted/handoff module claim.');
      registryDirectory(context, 'resources', true);
      const resource = qaPath(context);
      try { fs.mkdirSync(resource); } catch (error) {
        if (error.code !== 'EEXIST') throw error;
        const holder = readReservation(resource, true);
        const own = holder && holder.state !== 'invalid' && holder.moduleId === module.moduleId && tokenMatches(holder.token, options.token);
        return { ...base, acquired: Boolean(own), reused: Boolean(own), holder: publicRecord(holder), ...(own ? {} : { reason: 'busy' }) };
      }
      const now = new Date().toISOString();
      const holder = { version: 1, resource: 'browser-qa', moduleId: module.moduleId, owner: record.owner, token: record.token, createdAt: now, updatedAt: now };
      writeRecord(resource, holder, true);
      return { ...base, acquired: true, holder: publicRecord(holder) };
    }
    if (command === 'qa-release') {
      const resource = qaPath(context); const holder = readReservation(resource, true);
      if (!holder || holder.state === 'invalid' || holder.moduleId !== module.moduleId || !tokenMatches(holder.token, options.token)) fail('NOT_QA_OWNER', 'This claim does not own a valid browser QA reservation.');
      const archivePath = archive(context, resource, { ...holder, releasedAt: new Date().toISOString() });
      return { ...base, released: true, archivePath };
    }
    if (command === 'reopen') {
      if (!['submitted', 'handoff'].includes(record.state)) fail('INVALID_REOPEN_STATE', 'Only submitted or handed-off work can be reopened for its existing owner.');
      if (typeof options.reason !== 'string' || !options.reason.trim()) fail('REASON_REQUIRED', 'Record the concrete review or recovery reason.');
      assertQaReleased(context, module.moduleId);
      if (!record.branch || !record.worktree || !record.commit) fail('SUBMISSION_REFS_REQUIRED', 'Reopening requires the preserved submission branch, worktree and commit.');
      validatePatch(context, record, {});
      const now = new Date().toISOString();
      const entry = { fromState: record.state, branch: record.branch, worktree: record.worktree, commit: record.commit,
        submittedAt: record.updatedAt, reopenedAt: now, reason: options.reason.trim(),
        ...(record.reason !== undefined ? { handoffReason: record.reason } : {}) };
      const { reason: _previousReason, ...preserved } = record;
      const next = { ...preserved, state: 'active', updatedAt: now, reopenHistory: [...(record.reopenHistory ?? []), entry] };
      // Keep the reservation directory occupied; replacement is atomic under its mutation lock.
      writeRecord(directory, next);
      return { ...base, reopened: true, claim: next };
    }
    if (command === 'resolve') {
      if (!['integrated', 'declined', 'requeue'].includes(options.resolution)) fail('INVALID_RESOLUTION', 'Resolution must be integrated, declined or requeue.');
      if (typeof options.reason !== 'string' || !options.reason.trim()) fail('REASON_REQUIRED', 'Record the explicit integration/recovery reason.');
      assertQaReleased(context, module.moduleId);
      let integratedCommit;
      if (options.resolution === 'integrated') {
        if (!record.commit) fail('COMMIT_REQUIRED', 'An integrated resolution requires a recorded commit.');
        integratedCommit = record.commit;
        if (options['integrated-commit'] !== undefined) {
          if (!/^[a-f0-9]{7,64}$/i.test(options['integrated-commit'])) fail('INVALID_COMMIT', 'Integrated commit must be an existing hexadecimal commit ID.');
          integratedCommit = git(context.canonicalRoot, ['rev-parse', '--verify', `${options['integrated-commit']}^{commit}`]);
        }
        git(context.canonicalRoot, ['merge-base', '--is-ancestor', integratedCommit, 'HEAD']);
        const relativeStatus = path.relative(context.canonicalRoot, path.join(module.folder, 'STATUS.md')).split(path.sep).join('/');
        const stageInHead = statusStage(git(context.canonicalRoot, ['show', `HEAD:${relativeStatus}`]));
        if (!['implemented', 'verified'].includes(stageInHead)) fail('MODULE_NOT_IMPLEMENTED', 'The primary HEAD must record this module as implemented or verified before integrated resolution.');
      } else if (options['integrated-commit'] !== undefined) {
        fail('INVALID_ARGUMENT', '--integrated-commit applies only to an integrated resolution.');
      }
      const archivePath = archive(context, directory, { ...record, state: 'resolved', resolution: options.resolution,
        ...(integratedCommit ? { integratedCommit } : {}), reason: options.reason.trim(), updatedAt: new Date().toISOString() }, moved);
      return { ...base, resolved: true, resolution: options.resolution, archivePath, ...(integratedCommit ? { integratedCommit } : {}) };
    }
    if (command === 'release') {
      assertQaReleased(context, module.moduleId);
      if (record.state !== 'active' || record.branch || record.worktree || record.commit) fail('STARTED_CLAIM', 'Only an unstarted active claim can be released; preserve started work with handoff or explicit resolution.');
      const archivePath = archive(context, directory, { ...record, state: 'released', updatedAt: new Date().toISOString() }, moved);
      return { ...base, released: true, archivePath };
    }
    if (!['update', 'submit', 'handoff'].includes(command)) fail('UNKNOWN_COMMAND', 'Unknown coordination command.');
    if (record.state !== 'active') fail('INACTIVE_CLAIM', 'Only active claims can be updated or submitted.');
    const patch = validatePatch(context, options, record);
    const next = { ...record, ...patch, updatedAt: new Date().toISOString() };
    if (command !== 'update') {
      assertQaReleased(context, module.moduleId);
      if (!next.branch || !next.worktree || !next.commit) fail('SUBMISSION_REFS_REQUIRED', 'Provide a private branch, registered isolated worktree and recorded commit before submission/handoff.');
      // Check stored checkpoints again: a worktree/ref may have changed since update.
      validatePatch(context, next, {});
      if (command === 'handoff' && !['partial', 'blocked'].includes(options.reason)) fail('INVALID_REASON', 'Handoff reason must be partial or blocked; put details in module STATUS.md.');
      next.state = command === 'submit' ? 'submitted' : 'handoff';
      if (command === 'handoff') next.reason = options.reason;
    }
    writeRecord(directory, next);
    return { ...base, claim: next };
  });
}

const allowed = {
  list: [], claim: ['owner', 'module'], update: ['module', 'token', 'branch', 'worktree', 'commit'],
  submit: ['module', 'token', 'branch', 'worktree', 'commit'], handoff: ['module', 'token', 'branch', 'worktree', 'commit', 'reason'],
  reopen: ['module', 'token', 'reason'],
  release: ['module', 'token'], resolve: ['module', 'token', 'resolution', 'reason', 'integrated-commit'], 'qa-claim': ['module', 'token'], 'qa-release': ['module', 'token'],
};

function main() {
  try {
    const [command = 'list', ...args] = process.argv.slice(2);
    if (!Object.hasOwn(allowed, command)) fail('UNKNOWN_COMMAND', `Commands: ${Object.keys(allowed).join(', ')}`);
    const options = {};
    for (let index = 0; index < args.length; index += 2) {
      const key = args[index].startsWith('--') ? args[index].slice(2) : '';
      if (!allowed[command].includes(key) || options[key] !== undefined || args[index + 1] === undefined || args[index + 1].startsWith('--')) fail('INVALID_ARGUMENT', `Unexpected or missing argument: ${args[index]}`);
      options[key] = args[index + 1];
    }
    console.log(JSON.stringify(runCommand(command, options)));
  } catch (error) {
    console.error(JSON.stringify({ ok: false, error: { code: error.code ?? 'COORDINATION_ERROR', message: error.message } }));
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
