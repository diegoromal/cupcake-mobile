import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Worker } from 'node:worker_threads';
import { createRunner, main } from './task-runner.mjs';

function fixture(t, options = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'task-runner-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'scripts'));
  fs.writeFileSync(path.join(root, 'scripts/task-checks.json'), JSON.stringify([
    { name: 'diff', command: 'git', args: ['diff', '--check'], cwd: '.' },
    { name: 'lint', command: 'npm', args: ['run', 'lint'], cwd: 'apps/api' },
  ]));
  let time = Date.parse('2026-09-26T12:00:00.000Z');
  let branch = options.branch || 'task/D16-login-entregador';
  let dirty = options.dirty || false;
  let approval = options.approval ?? true;
  let failCheck = options.failCheck || false;
  const calls = [];
  const run = (command, args, cwd) => {
    calls.push({ command, args, cwd });
    if (command === 'git' && args[0] === 'branch') return { status: 0, stdout: `${branch}\n` };
    if (command === 'git' && args[0] === 'status') return { status: 0, stdout: dirty ? ' M file\n' : '' };
    return { status: failCheck && command === 'npm' ? 1 : 0, stdout: '', stderr: '' };
  };
  const make = (confirm = async () => approval) => createRunner({ root, now: () => time, run,
    ...(confirm === null ? {} : { confirm }) });
  return { root, calls, make, advance: (ms) => { time += ms; },
    setTime: (value) => { time = value; }, setBranch: (value) => { branch = value; },
    setDirty: (value) => { dirty = value; }, setApproval: (value) => { approval = value; },
    setFailCheck: (value) => { failCheck = value; } };
}

async function passAndBegin(runner) {
  runner.completePhase('PASS');
  await runner.approve();
  runner.begin();
}

test('start válido, formato inválido, segunda task, branch e árvore suja', (t) => {
  const f = fixture(t);
  const runner = f.make();
  assert.throws(() => runner.start('D1'), /Task inválida/);
  f.setBranch('infra/task-runner');
  assert.throws(() => runner.start('D16'), /Branch divergente/);
  f.setBranch('task/D16-login-entregador');
  f.setDirty(true);
  assert.throws(() => runner.start('D16'), /Working tree/);
  assert.equal(fs.existsSync(path.join(f.root, '.ai/task-runner/active.lock')), false);
  f.setDirty(false);
  const lock = path.join(f.root, '.ai/task-runner/active.lock');
  fs.writeFileSync(lock, 'processo encerrado\n');
  assert.throws(() => runner.start('D16'), /verifique o lock antes de removê-lo manualmente/);
  assert.equal(fs.existsSync(runner.files.stateFile), false);
  assert.equal(fs.existsSync(lock), true);
  fs.unlinkSync(lock);
  assert.match(runner.start('D16'), /Iniciada D16/);
  assert.equal(fs.existsSync(path.join(f.root, '.ai/task-runner/active.lock')), false);
  assert.throws(() => runner.start('D17'), /task ativa/);
  assert.match(runner.status(), /Fase: PLAN/);
  assert.equal(JSON.parse(fs.readFileSync(runner.files.stateFile)).phase_status, 'ACTIVE');
  assert.equal(fs.readdirSync(path.dirname(runner.files.stateFile)).filter((name) => name.includes('.tmp')).length, 0);
});

test('starts concorrentes não podem sobrescrever a task ativa', async (t) => {
  const f = fixture(t);
  const signal = new Int32Array(new SharedArrayBuffer(4));
  const workerCode = `
    const { parentPort, workerData } = require('node:worker_threads');
    (async () => {
      const { createRunner } = await import(workerData.moduleUrl);
      const run = (command, args) => {
        if (args[0] === 'branch') {
          if (workerData.hold) {
            parentPort.postMessage({ type: 'locked' });
            Atomics.wait(new Int32Array(workerData.signal), 0, 0);
          }
          return { status: 0, stdout: 'task/' + workerData.task + '-race\\n' };
        }
        return { status: 0, stdout: '' };
      };
      try {
        const message = createRunner({ root: workerData.root, run }).start(workerData.task);
        parentPort.postMessage({ type: 'result', success: true, message });
      } catch (error) {
        parentPort.postMessage({ type: 'result', success: false, message: error.message });
      }
    })().catch((error) => parentPort.postMessage({ type: 'result', success: false, message: error.message }));
  `;
  const launch = (task, hold) => {
    const worker = new Worker(workerCode, { eval: true, workerData: {
      task, hold, root: f.root, signal: signal.buffer,
      moduleUrl: new URL('./task-runner.mjs', import.meta.url).href,
    } });
    let lockedResolve;
    const locked = new Promise((resolve) => { lockedResolve = resolve; });
    const result = new Promise((resolve, reject) => {
      worker.on('message', (message) => {
        if (message.type === 'locked') lockedResolve();
        if (message.type === 'result') resolve(message);
      });
      worker.on('error', reject);
      worker.on('exit', (code) => { if (code !== 0) reject(new Error(`Worker terminou com código ${code}`)); });
    });
    return { worker, locked, result };
  };
  const first = launch('D16', true);
  try {
    await first.locked;
    const second = launch('D17', false);
    const losing = await second.result;
    assert.equal(losing.success, false);
    assert.match(losing.message, /Outra inicialização está em andamento/);
  } finally {
    Atomics.store(signal, 0, 1);
    Atomics.notify(signal, 0);
  }
  const winning = await first.result;
  assert.equal(winning.success, true);
  const state = JSON.parse(fs.readFileSync(path.join(f.root, '.ai/task-runner/state.json'), 'utf8'));
  assert.equal(state.task, 'D16');
  assert.equal(state.phase, 'PLAN');
  assert.equal(state.phase_status, 'ACTIVE');
  assert.equal(fs.existsSync(path.join(f.root, '.ai/task-runner/history.jsonl')), false);
  assert.equal(fs.existsSync(path.join(f.root, '.ai/task-runner/active.lock')), false);
});

test('aprovação humana, saltos bloqueados e persistência', async (t) => {
  const f = fixture(t);
  const runner = f.make();
  runner.start('D16');
  assert.throws(() => runner.begin(), /aprovada/);
  runner.completePhase('PASS');
  assert.throws(() => runner.completePhase('PASS'), /ACTIVE/);
  await assert.rejects(f.make(async () => false).approve(), /Aprovação negada/);
  await assert.rejects(f.make(null).approve(), /Aprovação negada/);
  assert.equal(JSON.parse(fs.readFileSync(runner.files.stateFile)).phase_status, 'AWAITING_APPROVAL');
  await runner.approve();
  await assert.rejects(runner.approve(), /AWAITING_APPROVAL/);
  assert.equal(f.make().status().includes('Próximo comando: begin'), true);
  runner.begin();
  assert.match(f.make().status(), /Fase: EXEC/);
  f.setBranch('task/D17-outro');
  assert.throws(() => runner.pause(), /Branch divergente/);
});

test('fluxo completo mede tempo ativo, cycle time, findings, first pass e histórico único', async (t) => {
  const f = fixture(t);
  const runner = f.make();
  runner.start('D16');
  f.advance(60_000);
  runner.pause();
  f.advance(120_000);
  runner.resume();
  f.advance(60_000);
  await passAndBegin(runner);
  for (const phase of ['EXEC', 'TEST', 'REVIEW']) {
    assert.match(runner.status(), new RegExp(`Fase: ${phase}`));
    f.advance(60_000);
    await passAndBegin(runner);
  }
  assert.match(runner.status(), /Fase: QUALITY_GATE/);
  f.advance(60_000);
  runner.completePhase('PASS');
  await runner.approve();
  assert.match(runner.status(), /READY_TO_CLOSE/);
  assert.throws(() => runner.begin(), /aprovada/);
  runner.record('findings', ['0', '1', '2', '3']);
  runner.record('tokens', ['1234']);
  assert.throws(() => runner.close('PR_OPEN', 'https://example.test/pr/1'), /fora de ordem/);
  runner.close('COMMITTED', 'abcdef1');
  runner.close('PR_OPEN', 'https://example.test/pr/1');
  runner.close('CI_PASS', 'CI run 42 PASS');
  f.advance(60_000);
  f.setBranch('main');
  const pendingMerge = fs.readFileSync(runner.files.stateFile, 'utf8');
  runner.close('MERGED', '1234567');
  assert.equal(fs.existsSync(runner.files.stateFile), false);
  const rows = fs.readFileSync(runner.files.historyFile, 'utf8').trim().split('\n').map(JSON.parse);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].plan_minutes, 2);
  assert.equal(rows[0].active_minutes, 6);
  assert.equal(rows[0].cycle_minutes, 9);
  assert.equal(rows[0].first_pass, true);
  assert.equal(rows[0].high_findings, 1);
  assert.equal(rows[0].tokens_estimated, 1234);
  assert.equal(rows[0].delivery_status, 'MERGED');
  const interrupted = { ...JSON.parse(pendingMerge), delivery_status: 'MERGED',
    finished_at: rows[0].finished_at, merged_at: rows[0].merged_at };
  fs.writeFileSync(runner.files.stateFile, JSON.stringify(interrupted));
  assert.match(runner.close('MERGED', '1234567'), /encerrada/);
  assert.equal(fs.readFileSync(runner.files.historyFile, 'utf8').trim().split('\n').length, 1);
  assert.throws(() => runner.start('D16'), /já encerrada/);
  assert.equal(fs.readdirSync(path.dirname(runner.files.historyFile)).filter((name) => name.includes('.tmp')).length, 0);
  assert.equal(f.calls.filter((call) => call.command === 'git').every((call) =>
    ['branch', 'status', 'diff'].includes(call.args[0])), true);
});

test('replan e fix loop exigem aprovação e alteram first pass', async (t) => {
  const f = fixture(t);
  const runner = f.make();
  runner.start('D16');
  runner.completePhase('BLOCKED');
  await assert.rejects(runner.approve(), /--to/);
  await runner.approve('PLAN');
  runner.begin();
  assert.equal(JSON.parse(fs.readFileSync(runner.files.stateFile)).replans, 1);
  await passAndBegin(runner);
  await passAndBegin(runner);
  runner.completePhase('FAIL');
  await runner.approve('EXEC');
  runner.begin();
  const state = JSON.parse(fs.readFileSync(runner.files.stateFile));
  assert.equal(state.fix_loops, 1);
  assert.equal(state.phase, 'EXEC');
  assert.equal(state.replans === 0 && state.fix_loops === 0, false);
  await passAndBegin(runner);
  await passAndBegin(runner);
  await passAndBegin(runner);
  runner.completePhase('PASS');
  await runner.approve();
  runner.close('COMMITTED', 'abcdef1');
  runner.close('PR_OPEN', '16');
  runner.close('CI_PASS', 'CI PASS');
  runner.close('MERGED', '1234567');
  const row = JSON.parse(fs.readFileSync(runner.files.historyFile, 'utf8').trim());
  assert.equal(row.first_pass, false);
  assert.equal(row.replans, 1);
  assert.equal(row.fix_loops, 1);
});

test('relógio regressivo bloqueia mudança e pause/resume não conta intervalo pausado', (t) => {
  const f = fixture(t);
  const runner = f.make();
  runner.start('D16');
  f.advance(60_000);
  runner.pause();
  f.advance(600_000);
  assert.match(runner.status(), /Tempo ativo: 1.00 min/);
  runner.resume();
  f.setTime(Date.parse('2026-09-26T12:00:00.000Z'));
  assert.throws(() => runner.completePhase('PASS'), /Relógio regrediu/);
  assert.equal(JSON.parse(fs.readFileSync(runner.files.stateFile)).phase_status, 'ACTIVE');
});

test('checks registram PASS/FAIL e código de saída; nenhum Git mutável', async (t) => {
  const f = fixture(t);
  const runner = f.make();
  runner.start('D16');
  assert.equal((await main(['checks'], runner)).code, 0);
  f.setFailCheck(true);
  assert.equal((await main(['checks'], runner)).code, 1);
  const checks = JSON.parse(fs.readFileSync(runner.files.stateFile)).checks;
  assert.deepEqual(checks.map((check) => check.status), ['PASS', 'PASS', 'PASS', 'FAIL']);
  assert.equal(checks.every((check) => Number.isFinite(check.duration_ms)), true);
  assert.equal(f.calls.filter((call) => call.command === 'git').every((call) =>
    ['branch', 'status', 'diff'].includes(call.args[0])), true);
  fs.writeFileSync(path.join(f.root, 'scripts/task-checks.json'), JSON.stringify([
    { name: 'proibido', command: 'git', args: ['commit', '-m', 'x'], cwd: '.' },
  ]));
  assert.throws(() => runner.checks(), /Check não permitido/);
  assert.equal(f.calls.some((call) => call.command === 'git' && call.args[0] === 'commit'), false);
});

test('checks oficiais incluem Admin e rejeitam argumentos não autorizados', (t) => {
  const f = fixture(t);
  const runner = f.make();
  runner.start('D16');
  fs.copyFileSync(new URL('./task-checks.json', import.meta.url),
    path.join(f.root, 'scripts/task-checks.json'));
  const outcome = runner.checks();
  assert.equal(outcome.passed, true);
  assert.equal(outcome.results.length, 8);
  assert.deepEqual(f.calls.filter((call) => call.cwd === path.join(f.root, 'apps/admin'))
    .map(({ command, args }) => [command, args]), [
    ['npm', ['test']], ['npm', ['run', 'lint']], ['npm', ['run', 'build']],
  ]);

  for (const args of [['run lint'], ['run', 'test:other']]) {
    fs.writeFileSync(path.join(f.root, 'scripts/task-checks.json'), JSON.stringify([
      { name: 'proibido', command: 'npm', args, cwd: 'apps/admin' },
    ]));
    assert.throws(() => runner.checks(), /Check não permitido/);
  }
  assert.equal(f.calls.some((call) => call.args.includes('test:other')
    || call.args.includes('run lint')), false);
});

test('média, mediana, P75 e aviso de amostra pequena', (t) => {
  const f = fixture(t);
  const runner = f.make();
  fs.mkdirSync(path.dirname(runner.files.historyFile), { recursive: true });
  fs.writeFileSync(runner.files.historyFile, [1, 2, 3, 4].map((value) => JSON.stringify({
    task: `D${value + 15}`, cycle_minutes: value * 10, active_minutes: value * 5,
    first_pass: value % 2 === 0, fix_loops: value - 1,
  })).join('\n') + '\n');
  const result = runner.metrics(100);
  assert.match(result, /Tasks concluídas medidas: 4/);
  assert.match(result, /Cycle médio: 25.00 min/);
  assert.match(result, /Mediana: 25.00 min/);
  assert.match(result, /P75: 32.50 min/);
  assert.match(result, /Active médio: 12.50 min/);
  assert.match(result, /First-pass rate: 50.00%/);
  assert.match(result, /Fix loops médios: 1.50/);
  assert.match(result, /Restantes × média: 2500.00 min/);
  assert.match(result, /ESTIMATIVA PRELIMINAR — AMOSTRA INSUFICIENTE/);
});
