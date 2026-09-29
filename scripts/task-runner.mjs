#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import readline from 'node:readline/promises';
import { calculateMetrics } from './task-runner-metrics.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PHASES = ['PLAN', 'EXEC', 'TEST', 'REVIEW', 'QUALITY_GATE'];
const DELIVERY = ['NONE', 'COMMITTED', 'PR_OPEN', 'CI_PASS', 'MERGED'];
const MINUTE = 60_000;

function defaultRun(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  if (result.error) throw result.error;
  return { status: result.status ?? 1, stdout: result.stdout, stderr: result.stderr };
}

function atomicWrite(filename, contents) {
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  const temporary = `${filename}.${process.pid}.${Math.random().toString(16).slice(2)}.tmp`;
  try {
    const fd = fs.openSync(temporary, 'wx');
    try {
      fs.writeFileSync(fd, contents);
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
    fs.renameSync(temporary, filename);
    const directory = fs.openSync(path.dirname(filename), 'r');
    try { fs.fsyncSync(directory); } finally { fs.closeSync(directory); }
  } finally {
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
}

function readHistory(filename) {
  if (!fs.existsSync(filename)) return [];
  const content = fs.readFileSync(filename, 'utf8');
  return content.trim() ? content.trimEnd().split('\n').map((line) => JSON.parse(line)) : [];
}

function minutes(milliseconds) { return milliseconds / MINUTE; }
function display(value) { return value.toFixed(2); }

export function createRunner({ root = ROOT, now = () => Date.now(), run = defaultRun,
  confirm = async () => {
    if (!process.stdin.isTTY || !process.stdout.isTTY) return false;
    const input = readline.createInterface({ input: process.stdin, output: process.stdout });
    try { return ['y', 'Y'].includes(await input.question('Aprovar próxima fase? [y/N] ')); }
    catch { return false; }
    finally { input.close(); }
  } } = {}) {
  const directory = path.join(root, '.ai/task-runner');
  const stateFile = path.join(directory, 'state.json');
  const historyFile = path.join(directory, 'history.jsonl');
  const startLockFile = path.join(directory, 'active.lock');
  const checksFile = path.join(root, 'scripts/task-checks.json');
  const currentTime = () => {
    const value = now();
    if (!Number.isFinite(value)) throw new Error('Relógio inválido.');
    return value;
  };
  const load = () => fs.existsSync(stateFile) ? JSON.parse(fs.readFileSync(stateFile, 'utf8')) : null;
  const save = (state) => atomicWrite(stateFile, `${JSON.stringify(state, null, 2)}\n`);
  const git = (args) => {
    const result = run('git', args, root);
    if (result.status !== 0) throw new Error(`Falha em git ${args.join(' ')}: ${result.stderr?.trim() || result.status}`);
    return result.stdout.trim();
  };
  const branch = () => git(['branch', '--show-current']);
  const expected = (task) => `task/${task}-*`;
  const assertBranch = (state) => {
    const actual = branch();
    if (actual !== state.branch || !actual.startsWith(`task/${state.task}-`)) {
      throw new Error(`Branch divergente: ${actual || '(detached)'}; esperada ${expected(state.task)} (${state.branch}).`);
    }
  };
  const requireState = () => {
    const state = load();
    if (!state) throw new Error('Nenhuma task ativa.');
    return state;
  };
  const at = (state) => {
    const value = currentTime();
    if (value < Date.parse(state.last_seen_at)) throw new Error('Relógio regrediu; estado não alterado.');
    state.last_seen_at = new Date(value).toISOString();
    return value;
  };
  const stopClock = (state, value) => {
    const start = Date.parse(state.segment_started_at);
    if (value < start) throw new Error('Relógio regrediu; estado não alterado.');
    state.durations_ms[state.phase] += value - start;
    state.segment_started_at = null;
  };
  const activeMs = (state, value) => PHASES.reduce((sum, phase) => sum + state.durations_ms[phase], 0)
    + (state.segment_started_at ? value - Date.parse(state.segment_started_at) : 0);
  const phaseMs = (state, value) => state.durations_ms[state.phase]
    + (state.segment_started_at ? value - Date.parse(state.segment_started_at) : 0);

  const withStartLock = (action) => {
    fs.mkdirSync(directory, { recursive: true });
    let fd;
    try { fd = fs.openSync(startLockFile, 'wx'); }
    catch (error) {
      if (error.code === 'EEXIST') {
        throw new Error(`Outra inicialização está em andamento (${startLockFile}). Se o processo morreu, verifique o lock antes de removê-lo manualmente.`);
      }
      throw error;
    }
    try {
      fs.writeFileSync(fd, `${process.pid}\n`);
      fs.fsyncSync(fd);
      return action();
    } finally {
      try { fs.closeSync(fd); }
      finally { fs.unlinkSync(startLockFile); }
    }
  };

  function start(task) {
    if (!/^D\d{2,}$/.test(task || '')) throw new Error('Task inválida; use Dxx (ex.: D16).');
    return withStartLock(() => {
      if (load()) throw new Error('Já existe uma task ativa.');
      if (readHistory(historyFile).some((row) => row.task === task)) throw new Error('Task já encerrada no histórico.');
      const actual = branch();
      if (!actual.startsWith(`task/${task}-`)) throw new Error(`Branch divergente: ${actual}; esperada ${expected(task)}.`);
      if (git(['status', '--porcelain'])) throw new Error('Working tree deve estar limpa no start.');
      const timestamp = new Date(currentTime()).toISOString();
      const state = {
        task, branch: actual, phase: 'PLAN', phase_status: 'ACTIVE', delivery_status: 'NONE',
        started_at: timestamp, last_seen_at: timestamp, segment_started_at: timestamp,
        durations_ms: Object.fromEntries(PHASES.map((phase) => [phase, 0])),
        result: null, next_phase: null, approvals: [], replans: 0, fix_loops: 0,
        critical_findings: 0, high_findings: 0, medium_findings: 0, low_findings: 0,
        checks: [], commit_sha: null, pr: null, ci_reference: null, merged_at: null,
        tokens_estimated: null,
      };
      save(state);
      return `Iniciada ${task}: PLAN. Prompt: .ai/prompts/PLAN.md`;
    });
  }

  function status() {
    const state = load();
    if (!state) return 'Nenhuma task ativa.';
    const value = currentTime();
    if (value < Date.parse(state.last_seen_at)) throw new Error('Relógio regrediu.');
    const actual = branch();
    const dirty = Boolean(git(['status', '--porcelain']));
    const next = state.delivery_status === 'MERGED' ? 'close merged (retomar gravação do histórico)'
      : state.delivery_status !== 'NONE' || state.phase_status === 'READY_TO_CLOSE' ? 'close <etapa> <evidência>'
      : ({ ACTIVE: 'pause | complete-phase <PASS|FAIL|BLOCKED>', PAUSED: 'resume',
        AWAITING_APPROVAL: 'approve [--to PLAN|EXEC]', APPROVED: 'begin' })[state.phase_status];
    return [
      `Task: ${state.task}`, `Branch esperada: ${expected(state.task)} (${state.branch})`,
      `Branch atual: ${actual}`, `Fase: ${state.phase}`, `Phase status: ${state.phase_status}`,
      `Delivery status: ${state.delivery_status}`, `Started at: ${state.started_at}`,
      `Tempo ativo: ${display(minutes(activeMs(state, value)))} min`,
      `Duração da fase atual: ${display(minutes(phaseMs(state, value)))} min`,
      `Cycle elapsed: ${display(minutes(value - Date.parse(state.started_at)))} min`,
      `Git: ${dirty ? 'dirty' : 'clean'}`, `Próximo comando: ${next}`,
    ].join('\n');
  }

  function completePhase(result) {
    if (!['PASS', 'FAIL', 'BLOCKED'].includes(result)) throw new Error('Informe PASS, FAIL ou BLOCKED.');
    const state = requireState();
    assertBranch(state);
    if (state.phase_status !== 'ACTIVE') throw new Error('complete-phase exige fase ACTIVE.');
    const value = at(state);
    stopClock(state, value);
    state.result = result;
    state.phase_status = 'AWAITING_APPROVAL';
    save(state);
    return `${state.phase}: ${result}; aguardando aprovação humana.`;
  }

  async function approve(destination) {
    const state = requireState();
    assertBranch(state);
    if (state.phase_status !== 'AWAITING_APPROVAL') throw new Error('approve exige AWAITING_APPROVAL.');
    const index = PHASES.indexOf(state.phase);
    if (state.result === 'PASS') {
      if (destination) throw new Error('Retorno só é permitido após FAIL/BLOCKED.');
      destination = PHASES[index + 1] || null;
    } else if (!destination || !['PLAN', 'EXEC'].includes(destination)
      || (destination === 'EXEC' && state.phase === 'PLAN')) {
      throw new Error('Após FAIL/BLOCKED, informe --to PLAN ou --to EXEC quando permitido.');
    }
    if (!(await confirm())) throw new Error('Aprovação negada ou terminal não interativo.');
    const value = at(state);
    state.approvals.push({ phase: state.phase, result: state.result, next_phase: destination,
      approved_at: new Date(value).toISOString() });
    state.next_phase = destination;
    state.phase_status = destination ? 'APPROVED' : 'READY_TO_CLOSE';
    save(state);
    return destination ? `Aprovado; execute begin para ${destination}.` : 'Quality Gate aprovado; READY_TO_CLOSE.';
  }

  function begin() {
    const state = requireState();
    assertBranch(state);
    if (state.phase_status !== 'APPROVED' || !state.next_phase) throw new Error('begin exige próxima fase aprovada.');
    const value = at(state);
    const previous = state.phase;
    const next = state.next_phase;
    if (next === 'PLAN') state.replans++;
    else if (next === 'EXEC' && previous !== 'PLAN') state.fix_loops++;
    state.phase = next;
    state.phase_status = 'ACTIVE';
    state.segment_started_at = new Date(value).toISOString();
    state.next_phase = null;
    state.result = null;
    save(state);
    return `Iniciada ${next}. Prompt: .ai/prompts/${next}.md`;
  }

  function pause() {
    const state = requireState();
    assertBranch(state);
    if (state.phase_status !== 'ACTIVE') throw new Error('pause exige ACTIVE.');
    stopClock(state, at(state));
    state.phase_status = 'PAUSED';
    save(state);
    return `${state.phase} pausada.`;
  }

  function resume() {
    const state = requireState();
    assertBranch(state);
    if (state.phase_status !== 'PAUSED') throw new Error('resume exige PAUSED.');
    state.segment_started_at = new Date(at(state)).toISOString();
    state.phase_status = 'ACTIVE';
    save(state);
    return `${state.phase} retomada.`;
  }

  function checks() {
    const state = requireState();
    assertBranch(state);
    const configured = JSON.parse(fs.readFileSync(checksFile, 'utf8'));
    const allowed = new Set([
      ['git', ['diff', '--check'], '.'],
      ['npm', ['run', 'lint'], 'apps/api'],
      ['npm', ['test'], 'apps/api'],
      ['npm', ['run', 'test:e2e'], 'apps/api'],
      ['npm', ['run', 'build'], 'apps/api'],
      ['npm', ['test'], 'apps/admin'],
      ['npm', ['run', 'lint'], 'apps/admin'],
      ['npm', ['run', 'build'], 'apps/admin'],
    ].map((entry) => JSON.stringify(entry)));
    const results = [];
    for (const check of configured) {
      if (!allowed.has(JSON.stringify([check.command, check.args, check.cwd]))) {
        throw new Error('Check não permitido; use somente os comandos determinísticos aprovados.');
      }
      const started = currentTime();
      let result;
      try { result = run(check.command, check.args, path.resolve(root, check.cwd)); }
      catch (error) { result = { status: 1, stderr: error.message }; }
      const ended = currentTime();
      if (ended < started) throw new Error('Relógio regrediu durante checks.');
      results.push({ name: check.name, command: [check.command, ...check.args],
        status: result.status === 0 ? 'PASS' : 'FAIL', duration_ms: ended - started,
        ran_at: new Date(started).toISOString() });
    }
    at(state);
    state.checks.push(...results);
    save(state);
    return { results, passed: results.every((result) => result.status === 'PASS') };
  }

  function record(kind, values) {
    const state = requireState();
    assertBranch(state);
    if (state.delivery_status === 'MERGED') throw new Error('Task já encerrada.');
    if (kind === 'findings') {
      if (values.length !== 4 || values.some((value) => !/^(0|[1-9]\d*)$/.test(value))) {
        throw new Error('Use record findings CRITICAL HIGH MEDIUM LOW com contagens inteiras.');
      }
      [state.critical_findings, state.high_findings, state.medium_findings, state.low_findings] = values.map(Number);
    } else if (kind === 'tokens') {
      if (values.length !== 1 || !/^(0|[1-9]\d*)$/.test(values[0])) {
        throw new Error('Use record tokens N com estimativa inteira.');
      }
      state.tokens_estimated = Number(values[0]);
    } else throw new Error('Use record findings ou record tokens.');
    at(state);
    save(state);
    return `${kind} registrado.`;
  }

  function close(stage, evidence) {
    const state = requireState();
    if (state.phase_status !== 'READY_TO_CLOSE' || state.phase !== 'QUALITY_GATE') {
      throw new Error('close exige Quality Gate aprovado.');
    }
    const index = DELIVERY.indexOf(stage);
    if (index < 1 || index !== DELIVERY.indexOf(state.delivery_status) + 1) {
      if (stage === 'MERGED' && state.delivery_status === 'MERGED') return finish(state);
      throw new Error('Etapa de fechamento inválida ou fora de ordem.');
    }
    if (!evidence?.trim()) throw new Error('Informe evidência textual.');
    if ((stage === 'COMMITTED' || stage === 'MERGED') && !/^[0-9a-f]{7,40}$/i.test(evidence)) {
      throw new Error('Informe SHA Git de 7 a 40 caracteres.');
    }
    const value = at(state);
    if (stage === 'COMMITTED') state.commit_sha = evidence;
    if (stage === 'PR_OPEN') state.pr = evidence;
    if (stage === 'CI_PASS') state.ci_reference = evidence;
    if (stage === 'MERGED') {
      state.merge_sha = evidence;
      state.merged_at = new Date(value).toISOString();
      state.finished_at = state.merged_at;
    }
    state.delivery_status = stage;
    save(state);
    if (stage === 'MERGED') return finish(state);
    return `${stage} registrado.`;
  }

  function finish(state) {
    const history = readHistory(historyFile);
    if (!history.some((row) => row.task === state.task)) {
      const row = {
        task: state.task, branch: state.branch, started_at: state.started_at,
        finished_at: state.finished_at,
        plan_minutes: minutes(state.durations_ms.PLAN),
        exec_minutes: minutes(state.durations_ms.EXEC),
        test_minutes: minutes(state.durations_ms.TEST),
        review_minutes: minutes(state.durations_ms.REVIEW),
        quality_gate_minutes: minutes(state.durations_ms.QUALITY_GATE),
        active_minutes: minutes(PHASES.reduce((sum, phase) => sum + state.durations_ms[phase], 0)),
        cycle_minutes: minutes(Date.parse(state.finished_at) - Date.parse(state.started_at)),
        replans: state.replans, fix_loops: state.fix_loops,
        critical_findings: state.critical_findings, high_findings: state.high_findings,
        medium_findings: state.medium_findings, low_findings: state.low_findings,
        first_pass: state.replans === 0 && state.fix_loops === 0,
        delivery_status: 'MERGED', commit_sha: state.commit_sha, pr: state.pr,
        merged_at: state.merged_at, merge_sha: state.merge_sha,
        tokens_estimated: state.tokens_estimated, checks: state.checks,
      };
      atomicWrite(historyFile, `${[...history, row].map((entry) => JSON.stringify(entry)).join('\n')}\n`);
    }
    fs.unlinkSync(stateFile);
    return `${state.task} encerrada e registrada no histórico.`;
  }

  function metrics(remaining) {
    const { count, cycle_mean, cycle_median, cycle_p75, active_mean,
      first_pass_rate, fix_loops_mean, insufficient_sample } = calculateMetrics(readHistory(historyFile));
    const lines = [`Tasks concluídas medidas: ${count}`];
    if (!count) lines.push('Sem dados para estimativa.');
    else {
      lines.push(`Cycle médio: ${display(cycle_mean)} min`, `Mediana: ${display(cycle_median)} min`,
        `P75: ${display(cycle_p75)} min`, `Active médio: ${display(active_mean)} min`,
        `First-pass rate: ${display(first_pass_rate)}%`, `Fix loops médios: ${display(fix_loops_mean)}`);
      if (remaining !== undefined) lines.push(`Restantes × média: ${display(remaining * cycle_mean)} min`,
        `Restantes × mediana: ${display(remaining * cycle_median)} min`);
      if (insufficient_sample) lines.push('ESTIMATIVA PRELIMINAR — AMOSTRA INSUFICIENTE');
    }
    return lines.join('\n');
  }

  return { start, status, completePhase, approve, begin, pause, resume, checks, record, close, metrics,
    files: { stateFile, historyFile } };
}

const HELP = `Uso: node scripts/task-runner.mjs <comando> [argumentos]
  start Dxx                  inicia PLAN na branch task/Dxx-*
  status                     mostra estado e tempos
  complete-phase PASS|FAIL|BLOCKED
  approve [--to PLAN|EXEC]   exige confirmação humana interativa
  begin                      inicia a próxima fase aprovada
  pause | resume             controla tempo ativo
  checks                     executa checks configurados
  record findings C H M L | record tokens N
  metrics [--remaining N]    mostra métricas e estimativa
  close committed SHA | pr URL | ci-pass REFERÊNCIA | merged SHA
`;

export async function main(args = process.argv.slice(2), runner = createRunner()) {
  const [command, ...rest] = args;
  if (!command || command === '--help' || command === 'help') return { text: HELP, code: 0 };
  let result;
  switch (command) {
    case 'start': result = runner.start(rest[0]); break;
    case 'status': result = runner.status(); break;
    case 'complete-phase': result = runner.completePhase(rest[0]); break;
    case 'approve':
      if (rest.length && (rest.length !== 2 || rest[0] !== '--to')) {
        throw new Error('Use approve ou approve --to PLAN|EXEC.');
      }
      result = await runner.approve(rest[1]); break;
    case 'begin': result = runner.begin(); break;
    case 'pause': result = runner.pause(); break;
    case 'resume': result = runner.resume(); break;
    case 'checks': {
      const outcome = runner.checks();
      result = outcome.results.map((item) => `${item.name}: ${item.status} (${display(minutes(item.duration_ms))} min)`).join('\n');
      return { text: result, code: outcome.passed ? 0 : 1 };
    }
    case 'record': result = runner.record(rest[0], rest.slice(1)); break;
    case 'metrics': {
      if (rest.length && (rest[0] !== '--remaining' || !/^(0|[1-9]\d*)$/.test(rest[1] || '') || rest.length !== 2)) {
        throw new Error('Use metrics --remaining N, com N inteiro não negativo.');
      }
      result = runner.metrics(rest.length ? Number(rest[1]) : undefined); break;
    }
    case 'close': {
      const stages = { committed: 'COMMITTED', pr: 'PR_OPEN', 'ci-pass': 'CI_PASS', merged: 'MERGED' };
      result = runner.close(stages[rest[0]], rest[1]); break;
    }
    default: throw new Error(`Comando desconhecido: ${command}. Use --help.`);
  }
  return { text: result, code: 0 };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = await main();
    process.stdout.write(`${result.text}\n`);
    process.exitCode = result.code;
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
