import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import vm from 'node:vm';
import { createDashboardServer, resolveDashboardConfig } from './task-runner-dashboard.mjs';
import { createRunner } from './task-runner.mjs';

function dashboardView() {
  const elements = new Map();
  const node = () => ({ textContent: '', hidden: false, children: [],
    append(...children) { this.children.push(...children); },
    replaceChildren(...children) { this.children = children; } });
  const context = vm.createContext({
    document: {
      getElementById(id) { if (!elements.has(id)) elements.set(id, node()); return elements.get(id); },
      createElement: node,
    },
    fetch: () => new Promise(() => {}),
    setInterval: () => {},
  });
  vm.runInContext(fs.readFileSync(path.join(import.meta.dirname, '../.ai/task-runner/dashboard/app.js'), 'utf8'), context);
  return { context, elements };
}

test('durações do dashboard usam segundos arredondados e tratam valores inválidos', () => {
  const { context } = dashboardView();
  const cases = [
    [0, '0:00'], [0.5, '0:30'], [1, '1:00'], [5.12, '5:07'],
    [19.37, '19:22'], [20.99, '20:59'], [30.46, '30:28'], [32.60, '32:36'],
    [59.99, '59:59'], [60, '01:00:00'], [61.5, '01:01:30'], [167.43, '02:47:26'],
    [null, '—'], [undefined, '—'], [NaN, '—'], [Infinity, '—'],
  ];
  for (const [value, expected] of cases) {
    context.value = value;
    assert.equal(vm.runInContext('formatDurationMinutes(value)', context), expected);
  }
});

test('cards, métricas e histórico exibem durações sem min', () => {
  const { context, elements } = dashboardView();
  context.state = { active_minutes: 20.99, cycle_minutes: 167.43 };
  vm.runInContext('renderState(state)', context);
  assert.equal(elements.get('active').textContent, '20:59');
  assert.equal(elements.get('cycle').textContent, '02:47:26');
  context.metrics = { count: 1, cycle_mean: 167.43, cycle_median: 30.46,
    cycle_p75: 32.60, active_mean: 19.37, first_pass_rate: 50, fix_loops_mean: 1 };
  vm.runInContext('renderMetrics(metrics)', context);
  assert.deepEqual(elements.get('metrics').children.slice(1, 5).map((card) => card.children[1].textContent),
    ['02:47:26', '30:28', '32:36', '19:22']);
  context.rows = [{ task: 'D16', cycle_minutes: 20.99, active_minutes: 5.12 }];
  vm.runInContext('renderHistory(rows)', context);
  assert.deepEqual(elements.get('history').children[0].children.slice(2, 4).map((cell) => cell.textContent),
    ['20:59', '5:07']);
});

async function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'runner-dashboard-'));
  const data = path.join(root, '.ai/task-runner');
  fs.mkdirSync(data, { recursive: true });
  const logs = [];
  const server = createDashboardServer({ runtimeDataDir: data,
    staticAssetsDir: path.join(import.meta.dirname, '../.ai/task-runner/dashboard'),
    logger: { warn: (message) => logs.push(message), error: (message) => logs.push(message) },
    now: () => Date.parse('2026-09-26T12:10:00Z') });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(root, { recursive: true, force: true });
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  return { data, logs, get: (route, options) => fetch(`${base}${route}`, options), port: server.address().port };
}

test('health, index e assets têm status e tipos corretos', async (t) => {
  const f = await fixture(t);
  for (const [route, type] of [['/', 'text/html'], ['/app.js', 'text/javascript'], ['/style.css', 'text/css']]) {
    const response = await f.get(route);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), new RegExp(type));
    assert.ok((await response.text()).length > 100);
  }
  const health = await f.get('/api/health');
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { status: 'ok', sourceConfigured: false });
  assert.equal(health.headers.get('cache-control'), 'no-store');
});

test('state ausente, válido e JSON inválido', async (t) => {
  const f = await fixture(t);
  assert.deepEqual(await (await f.get('/api/state')).json(), { status: 'missing', state: null });
  fs.writeFileSync(path.join(f.data, 'state.json'), JSON.stringify({
    task: 'D16', phase: 'PLAN', phase_status: 'ACTIVE', started_at: '2026-09-26T12:00:00Z',
    segment_started_at: '2026-09-26T12:05:00Z', durations_ms: { PLAN: 60_000 }, fix_loops: 0,
  }));
  const response = await f.get('/api/state');
  assert.equal(response.status, 200);
  const { status, state } = await response.json();
  assert.equal(status, 'ok');
  assert.equal(state.task, 'D16');
  assert.equal(state.active_minutes, 6);
  assert.equal(state.cycle_minutes, 10);
  assert.equal(state.branch, null);
  fs.writeFileSync(path.join(f.data, 'state.json'), '{bad');
  const invalid = await f.get('/api/state');
  assert.equal(invalid.status, 200);
  assert.deepEqual(await invalid.json(), { status: 'invalid', state: null });
  fs.rmSync(path.join(f.data, 'state.json'));
  fs.mkdirSync(path.join(f.data, 'state.json'));
  const failed = await f.get('/api/state');
  assert.equal(failed.status, 500);
  assert.deepEqual(await failed.json(), { status: 'error', state: null, error: 'state_read_failed' });
});

test('API preserva minutos decimais para histórico e métricas', async (t) => {
  const f = await fixture(t);
  fs.writeFileSync(path.join(f.data, 'history.jsonl'), JSON.stringify({
    task: 'D16', cycle_minutes: 20.99, active_minutes: 19.37, fix_loops: 0,
  }));
  const history = await (await f.get('/api/history')).json();
  assert.equal(history.entries[0].cycle_minutes, 20.99);
  assert.equal(history.entries[0].active_minutes, 19.37);
  const { metrics } = await (await f.get('/api/metrics')).json();
  assert.equal(metrics.cycle_mean, 20.99);
  assert.equal(metrics.cycle_median, 20.99);
  assert.equal(metrics.cycle_p75, 20.99);
  assert.equal(metrics.active_mean, 19.37);
});

test('history ignora linhas vazias e inválidas; metrics equivalem ao runner', async (t) => {
  const f = await fixture(t);
  assert.deepEqual(await (await f.get('/api/history')).json(), { status: 'missing', entries: [] });
  assert.deepEqual(await (await f.get('/api/metrics')).json(), { status: 'missing', metrics: { count: 0, cycle_mean: null,
    cycle_median: null, cycle_p75: null, active_mean: null, first_pass_rate: null,
    fix_loops_mean: null, insufficient_sample: false } });
  assert.equal(fs.existsSync(path.join(f.data, 'history.jsonl')), false);
  const rows = [1, 2, 3, 4].map((value) => ({ task: `D${value + 15}`, branch: `task/D${value + 15}`,
    cycle_minutes: value * 10, active_minutes: value * 5, first_pass: value % 2 === 0,
    fix_loops: value - 1, delivery_status: 'MERGED' }));
  fs.writeFileSync(path.join(f.data, 'history.jsonl'), `${rows.map(JSON.stringify).join('\n')}\n\n{broken\n`);
  const response = await f.get('/api/history');
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).status, 'partial');
  const history = await (await f.get('/api/history')).json();
  assert.equal(history.entries.length, 4);
  assert.equal(history.invalidLines, 1);
  assert.deepEqual(f.logs, ['history.jsonl: linha 6 inválida; ignorada.', 'history.jsonl: linha 6 inválida; ignorada.']);
  const metricsResponse = await f.get('/api/metrics');
  assert.equal(metricsResponse.status, 200);
  const metricsBody = await metricsResponse.json();
  assert.equal(metricsBody.status, 'partial');
  assert.equal(metricsBody.invalidLines, 1);
  const metrics = metricsBody.metrics;
  assert.deepEqual(metrics, { count: 4, cycle_mean: 25, cycle_median: 25, cycle_p75: 32.5,
    active_mean: 12.5, first_pass_rate: 50, fix_loops_mean: 1.5, insufficient_sample: true });
  // The runner's own metrics command reads the same fixture after removing the corrupt line.
  fs.writeFileSync(path.join(f.data, 'history.jsonl'), `${rows.map(JSON.stringify).join('\n')}\n`);
  assert.equal((await (await f.get('/api/history')).json()).status, 'ok');
  const runnerOutput = createRunner({ root: path.dirname(path.dirname(f.data)) }).metrics();
  assert.match(runnerOutput, new RegExp(`Cycle médio: ${metrics.cycle_mean.toFixed(2)} min`));
  assert.match(runnerOutput, new RegExp(`P75: ${metrics.cycle_p75.toFixed(2)} min`));
  assert.match(runnerOutput, new RegExp(`First-pass rate: ${metrics.first_pass_rate.toFixed(2)}%`));
  fs.rmSync(path.join(f.data, 'history.jsonl'));
  fs.mkdirSync(path.join(f.data, 'history.jsonl'));
  const failed = await f.get('/api/history');
  assert.equal(failed.status, 500);
  assert.deepEqual(await failed.json(), { status: 'error', entries: [], error: 'history_read_failed' });
  assert.deepEqual(await (await f.get('/api/metrics')).json(),
    { status: 'error', metrics: null, error: 'history_read_failed' });
});

test('métodos, rotas e traversal são rejeitados', async (t) => {
  const f = await fixture(t);
  const post = await f.get('/api/state', { method: 'POST' });
  assert.equal(post.status, 405);
  assert.equal((await post.json()).error.code, 'METHOD_NOT_ALLOWED');
  assert.equal((await f.get('/unknown')).status, 404);
  const traversal = await new Promise((resolve, reject) => {
    http.get({ hostname: '127.0.0.1', port: f.port, path: '/%2e%2e/scripts/task-runner.mjs' }, (response) => {
      let body = '';
      response.on('data', (chunk) => { body += chunk; });
      response.on('end', () => resolve({ status: response.statusCode, body: JSON.parse(body) }));
    }).on('error', reject);
  });
  assert.equal(traversal.status, 400);
  assert.equal(traversal.body.error.code, 'INVALID_PATH');
});

test('configuração usa default, env e CLI com precedência e caminho absoluto', () => {
  const cwd = path.join(os.tmpdir(), 'dashboard-config-cwd');
  const fallback = resolveDashboardConfig({ args: [], env: {}, cwd });
  assert.equal(fallback.runtimeDataDir, path.resolve(import.meta.dirname, '../.ai/task-runner'));
  assert.equal(fallback.sourceConfigured, false);
  const fromEnv = resolveDashboardConfig({ args: [], env: { TASK_RUNNER_DATA_DIR: 'externo' }, cwd });
  assert.equal(fromEnv.runtimeDataDir, path.join(cwd, 'externo'));
  assert.equal(fromEnv.sourceConfigured, true);
  const fromCli = resolveDashboardConfig({ args: ['--data-dir', 'cli'],
    env: { TASK_RUNNER_DATA_DIR: 'externo' }, cwd });
  assert.equal(fromCli.runtimeDataDir, path.join(cwd, 'cli'));
  assert.equal(resolveDashboardConfig({ args: ['--data-dir', '/tmp/runtime'], env: {}, cwd }).runtimeDataDir,
    '/tmp/runtime');
  assert.throws(() => resolveDashboardConfig({ args: ['--data-dir'], env: {}, cwd }),
    /--data-dir requer um caminho/);
  assert.throws(() => resolveDashboardConfig({ args: ['--data-dir', '--unknown'], env: {}, cwd }),
    /--data-dir requer um caminho/);
});

test('runtime externo independe do cwd, script e assets', async (t) => {
  const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'dashboard-worktrees-'));
  const dashboardTree = path.join(sandbox, 'dashboard-A');
  const runtimeDataDir = path.join(sandbox, 'runtime-B', '.ai', 'task-runner');
  const staticAssetsDir = path.join(dashboardTree, 'assets');
  fs.mkdirSync(staticAssetsDir, { recursive: true });
  fs.mkdirSync(runtimeDataDir, { recursive: true });
  fs.writeFileSync(path.join(staticAssetsDir, 'index.html'), '<h1>Assets da worktree A</h1>');
  fs.writeFileSync(path.join(runtimeDataDir, 'state.json'), JSON.stringify({ task: 'D21', phase: 'EXEC' }));
  fs.writeFileSync(path.join(runtimeDataDir, 'history.jsonl'), JSON.stringify({ task: 'D20', cycle_minutes: 20,
    active_minutes: 10, fix_loops: 0 }));
  const server = createDashboardServer({ staticAssetsDir, runtimeDataDir, sourceConfigured: true });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { await new Promise((resolve) => server.close(resolve)); fs.rmSync(sandbox, { recursive: true, force: true }); });
  const base = `http://127.0.0.1:${server.address().port}`;
  assert.match(await (await fetch(base)).text(), /Assets da worktree A/);
  assert.equal((await (await fetch(`${base}/api/state?dataDir=${encodeURIComponent(dashboardTree)}`)).json()).state.task, 'D21');
  assert.equal((await (await fetch(`${base}/api/history`)).json()).entries[0].task, 'D20');
  assert.deepEqual(await (await fetch(`${base}/api/health`)).json(), { status: 'ok', sourceConfigured: true });
});
