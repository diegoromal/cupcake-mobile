#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const [mode, state, root, ...args] = process.argv.slice(2);
const names = ['compose.staging.yaml', 'release.env', 'deployed-sequence', 'previous-sha', 'deployed-sha'];
const targets = [path.join(root, names[0]), ...names.slice(1).map(n => path.join(state, n))];
const journalPath = path.join(state, 'deploy-transaction.json');
const ledger = path.join(state, 'deployments.jsonl');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const hex = s => typeof s === 'string' && /^[0-9a-f]{64}$/.test(s);
const sha = s => typeof s === 'string' && /^[0-9a-f]{40}$/.test(s);
const same = (a, b) => a === null ? b === null : b !== null && a.equals(b);
function validateLocations() {
  if (path.resolve(state) !== path.resolve(root, 'state')) throw Error('diretório de state inválido; recovery manual necessário');
  for (const p of [root, state]) {
    if (!fs.lstatSync(p).isDirectory()) throw Error('diretório de recovery inválido; recovery manual necessário');
  }
}
function statFile(p) {
  try {
    const st = fs.lstatSync(p);
    if (!st.isFile()) throw Error(`tipo de arquivo inválido: ${path.basename(p)}; recovery manual necessário`);
    return st;
  } catch (e) { if (e.code === 'ENOENT') return null; throw e; }
}
function read(p) { return statFile(p) ? fs.readFileSync(p) : null; }
function syncDir(p) { const fd = fs.openSync(p, 'r'); try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); } }
function write(p, bytes) { const fd = fs.openSync(p, 'wx', 0o600); try { fs.writeFileSync(fd, bytes); fs.fsyncSync(fd); } finally { fs.closeSync(fd); } syncDir(path.dirname(p)); }
function replace(p, bytes) { const tmp = `${p}.write.${process.pid}`; write(tmp, bytes); fs.renameSync(tmp, p); syncDir(path.dirname(p)); }
function save(j) { replace(journalPath, Buffer.from(JSON.stringify(j) + '\n')); }
function crash(phase) { if (process.env.STAGING_TEST_CRASH === phase) process.kill(process.pid, 'SIGKILL'); }
function removeIfPresent(p) { if (statFile(p)) fs.unlinkSync(p); }
function artifacts(id) {
  return {
    prepared: targets.map(p => `${p}.prepared.${id}`),
    backups: targets.map(p => `${p}.backup.${id}`),
    linePath: path.join(state, `.deployments-line.${id}`),
  };
}
function decode(s) {
  if (s === null) return null;
  if (typeof s !== 'string' || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(s)) throw Error('journal inválido; recovery manual necessário');
  return Buffer.from(s, 'base64');
}
function validateJournal(j) {
  const invalid = () => { throw Error('journal inválido; recovery manual necessário'); };
  if (!j || typeof j !== 'object' || Array.isArray(j) || j.version !== 2 ||
      typeof j.id !== 'string' || !/^\d+-[0-9a-f]{16}$/.test(j.id) || !sha(j.sha) ||
      typeof j.previousSha !== 'string' || (j.previousSha !== '' && !sha(j.previousSha)) ||
      (j.previousSequence !== null && typeof j.previousSequence !== 'string') ||
      typeof j.targetSequence !== 'string' || typeof j.timestamp !== 'string' ||
      !['prepared', 'published-0', 'published-1', 'published-2', 'published-3', 'success-appended', 'committed', 'restored'].includes(j.phase) ||
      !Array.isArray(j.prepared) || j.prepared.length !== 5 || !Array.isArray(j.backups) || j.backups.length !== 5 ||
      !Array.isArray(j.backupMeta) || j.backupMeta.length !== 5 || !Array.isArray(j.expected) || j.expected.length !== 5 ||
      !Number.isSafeInteger(j.logSize) || j.logSize < 0 || typeof j.logExisted !== 'boolean' || !hex(j.logPrefixHash) ||
      (!j.logExisted && (j.logSize !== 0 || j.logPrefixHash !== hash(Buffer.alloc(0)))) ||
      typeof j.successAppended !== 'boolean') invalid();
  const expectedPaths = artifacts(j.id);
  if (j.linePath !== expectedPaths.linePath || j.prepared.some((p, i) => p !== expectedPaths.prepared[i]) ||
      j.backups.some((p, i) => p !== expectedPaths.backups[i])) invalid();
  for (let i = 0; i < 5; i++) {
    const m = j.backupMeta[i];
    if (!m || typeof m !== 'object' || Array.isArray(m) || m.path !== j.backups[i] || m.name !== names[i] || typeof m.existed !== 'boolean' ||
        (m.existed ? !Number.isSafeInteger(m.size) || m.size < 0 || !hex(m.sha256) : m.size !== null || m.sha256 !== null)) invalid();
    decode(j.expected[i]);
  }
  if (j.expected[4] === null || !same(decode(j.expected[4]), Buffer.from(`${j.sha}\n`)) ||
      typeof j.lineBase64 !== 'string' || decode(j.lineBase64) === null) invalid();
  statFile(journalPath);
  for (const p of [...targets, ledger, j.linePath, ...j.prepared, ...j.backups]) statFile(p);
}
function validateBackups(j) {
  const contents = [];
  for (const m of j.backupMeta) {
    const bytes = read(m.path);
    if (m.existed ? bytes === null || bytes.length !== m.size || hash(bytes) !== m.sha256 : bytes !== null)
      throw Error(`backup inválido ou corrompido: ${m.name}; preservar journal e backups`);
    contents.push(bytes);
  }
  return contents;
}
function validLedger() {
  const data = read(ledger);
  if (data === null || data.length === 0) return;
  const s = data.toString('utf8');
  if (!s.endsWith('\n')) throw Error('histórico JSONL incompleto');
  for (const line of s.slice(0, -1).split('\n')) { if (!line) throw Error('linha vazia no histórico'); JSON.parse(line); }
}
function validateFinal(j, kind) {
  for (let i = 0; i < 5; i++) {
    const actual = read(targets[i]);
    if (kind === 'restored') {
      const m = j.backupMeta[i];
      if (m.existed ? actual === null || actual.length !== m.size || hash(actual) !== m.sha256 : actual !== null)
        throw Error(`estado restaurado divergente: ${names[i]}; recovery manual necessário`);
    } else if (!same(actual, decode(j.expected[i]))) throw Error(`commit incompleto: ${names[i]}; recovery manual necessário`);
  }
  const data = read(ledger);
  if (kind === 'restored') {
    if (j.logExisted ? data === null || data.length !== j.logSize || hash(data) !== j.logPrefixHash : data !== null)
      throw Error('histórico restaurado divergente; recovery manual necessário');
  } else {
    const line = decode(j.lineBase64);
    if (data === null || data.length !== j.logSize + line.length || hash(data.subarray(0, j.logSize)) !== j.logPrefixHash ||
        !data.subarray(j.logSize).equals(line)) throw Error('histórico inconsistente após marker; recovery manual necessário');
  }
  validLedger();
}
function cleanup(j) {
  const paths = [...j.prepared, ...j.backups, j.linePath];
  crash('cleanup-before');
  for (let i = 0; i < paths.length; i++) {
    removeIfPresent(paths[i]);
    syncDir(path.dirname(paths[i]));
    crash(`cleanup-after-${i + 1}`);
    if (i === 0) crash('cleanup-partial');
  }
  crash('cleanup-after-all');
  fs.unlinkSync(journalPath);
  syncDir(state);
}
function restore(j) {
  // Finish every check before the first target or ledger mutation. Keep the validated bytes in memory.
  const originals = validateBackups(j);
  const ledgerBytes = read(ledger);
  if (j.logExisted && ledgerBytes === null) throw Error('histórico ausente; recovery manual necessário');
  const now = ledgerBytes ?? Buffer.alloc(0);
  const line = read(j.linePath);
  if (now.length < j.logSize) throw Error('histórico reduzido; recovery manual necessário');
  if (hash(now.subarray(0, j.logSize)) !== j.logPrefixHash || line === null || !line.equals(decode(j.lineBase64)) ||
      now.length - j.logSize > line.length || !line.subarray(0, now.length - j.logSize).equals(now.subarray(j.logSize)))
    throw Error('histórico divergente; recovery manual necessário');
  for (let i = 0; i < 5; i++) {
    const current = read(targets[i]);
    if (current !== null && !same(current, originals[i]) && !same(current, read(j.prepared[i])) && !same(current, decode(j.expected[i])))
      throw Error(`estado divergente: ${names[i]}; recovery manual necessário`);
  }
  for (let i = 0; i < 5; i++) {
    if (originals[i] !== null) replace(targets[i], originals[i]);
    else removeIfPresent(targets[i]);
  }
  if (statFile(ledger)) { const fd = fs.openSync(ledger, 'r+'); try { fs.ftruncateSync(fd, j.logSize); fs.fsyncSync(fd); } finally { fs.closeSync(fd); } }
  if (!j.logExisted) removeIfPresent(ledger);
  syncDir(root); syncDir(state);
  validateFinal(j, 'restored');
  j.phase = 'restored'; save(j);
  crash('restore-complete');
  cleanup(j);
  console.log(`transaction ${j.id}: estado anterior restaurado`);
}
function recover() {
  if (!statFile(journalPath)) return;
  let j;
  try { j = JSON.parse(fs.readFileSync(journalPath, 'utf8')); }
  catch { throw Error('journal inválido; recovery manual necessário'); }
  validateJournal(j);
  if (j.phase === 'restored' || j.phase === 'committed') {
    validateFinal(j, j.phase);
    cleanup(j);
    return;
  }
  if (read(targets[4])?.toString().trim() === j.sha &&
      !(j.previousSha === j.sha && j.phase !== 'success-appended')) {
    validateFinal(j, 'committed');
    j.phase = 'committed'; save(j);
    cleanup(j);
    console.log(`transaction ${j.id}: commit confirmado`);
  } else restore(j);
}
function finalize() {
  const [compose, candidateSha, previous, sequence, apiImage, opsImage, adminImage, apiDigest, opsDigest, adminDigest, migration, action] = args;
  if (statFile(journalPath)) throw Error('journal pendente');
  if (action !== '--rollback' && read(targets[4])?.toString().trim() === candidateSha) return;
  if ((read(targets[4])?.toString().trim() ?? '') !== previous) throw Error('marker alterado durante deploy');
  validLedger();
  const id = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
  const { prepared, backups, linePath } = artifacts(id);
  const originals = targets.map(read);
  const logBefore = read(ledger) ?? Buffer.alloc(0);
  const values = [read(compose), Buffer.from(`API_IMAGE=${apiImage}\nOPS_IMAGE=${opsImage}\nADMIN_IMAGE=${adminImage}\nAPI_DIGEST=${apiDigest}\nOPS_DIGEST=${opsDigest}\nADMIN_DIGEST=${adminDigest}\n`), Buffer.from(`${sequence}\n`), previous ? Buffer.from(`${previous}\n`) : null, Buffer.from(`${candidateSha}\n`)];
  if (values[0] === null) throw Error('compose ausente');
  const row = { timestamp: new Date().toISOString(), sha: candidateSha, previousSha: previous, apiDigest, opsDigest, adminDigest, migration, health: 'internal/storage/public passed', result: action === '--rollback' ? 'rollback' : 'success' };
  const line = Buffer.from(JSON.stringify(row) + '\n');
  try {
    for (let i = 0; i < 5; i++) {
      if (originals[i] !== null) write(backups[i], originals[i]);
      if (values[i] !== null) write(prepared[i], values[i]);
    }
    write(linePath, line);
  } catch (e) {
    for (const p of [...prepared, ...backups, linePath]) removeIfPresent(p);
    throw e;
  }
  // Hash the durable backup bytes themselves before the journal can authorize a commit.
  const backupMeta = backups.map((p, i) => {
    const bytes = read(p);
    if (!same(bytes, originals[i])) throw Error(`backup inválido: ${names[i]}`);
    return { path: p, name: names[i], existed: bytes !== null, size: bytes?.length ?? null, sha256: bytes === null ? null : hash(bytes) };
  });
  const j = { version: 2, id, sha: candidateSha, previousSha: previous, previousSequence: originals[2]?.toString().trim() ?? null, targetSequence: sequence, phase: 'prepared', timestamp: new Date().toISOString(), prepared, backups, backupMeta, expected: values.map(v => v?.toString('base64') ?? null), linePath, logSize: logBefore.length, logExisted: statFile(ledger) !== null, logPrefixHash: hash(logBefore), successAppended: false, lineBase64: line.toString('base64') };
  save(j); crash('prepared');
  let markerPublished = false;
  try {
    for (let i = 0; i < 4; i++) {
      if (values[i] === null) removeIfPresent(targets[i]);
      else fs.renameSync(prepared[i], targets[i]);
      syncDir(path.dirname(targets[i]));
      j.phase = `published-${i}`; save(j); crash(['compose', 'release-env', 'sequence', 'previous-sha'][i]);
    }
    const fd = fs.openSync(ledger, 'a', 0o600);
    try { if (process.env.STAGING_TEST_CRASH === 'partial-append') { fs.writeSync(fd, line.subarray(0, 12)); fs.fsyncSync(fd); process.kill(process.pid, 'SIGKILL'); } for (let offset = 0; offset < line.length;) offset += fs.writeSync(fd, line, offset, line.length - offset); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
    syncDir(state); j.successAppended = true; j.phase = 'success-appended'; save(j); crash('append'); crash('before-marker');
    fs.renameSync(prepared[4], targets[4]); syncDir(state); markerPublished = true; crash('after-marker');
    validateFinal(j, 'committed');
    j.phase = 'committed'; save(j); crash('cleanup');
    try { cleanup(j); } catch (e) { console.warn(`transaction ${id}: commit confirmado; limpeza pendente: ${e.message}`); }
  } catch (e) {
    try { recover(); } catch (recoveryError) { throw Error(`${e.message}; recovery falhou: ${recoveryError.message}; preservar journal e backups`); }
    if (markerPublished) { console.warn(`transaction ${id}: commit confirmado após erro: ${e.message}`); return; }
    throw e;
  }
}
try {
  validateLocations();
  if (mode === 'recover') recover();
  else if (mode === 'finalize') finalize();
  else throw Error('modo inválido');
} catch (e) { console.error(`transaction: ${e.message}`); process.exitCode = 1; }
