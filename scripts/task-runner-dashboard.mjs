#!/usr/bin/env node
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { calculateMetrics } from './task-runner-metrics.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ASSETS = path.join(ROOT, '.ai/task-runner/dashboard');
const DEFAULT_DATA_DIR = path.join(ROOT, '.ai/task-runner');
const STATIC = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
  ['/style.css', ['style.css', 'text/css; charset=utf-8']],
]);

const object = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const field = (source, key) => source[key] ?? null;
const number = (value) => typeof value === 'number' && Number.isFinite(value) ? value : null;
const minutes = (value) => number(value) === null ? null : value / 60_000;

export function normalizeState(value, now = Date.now()) {
  if (value === null) return null;
  const source = object(value);
  const durations = object(source.durations_ms);
  const elapsed = source.segment_started_at && source.phase_status === 'ACTIVE'
    ? Math.max(0, now - Date.parse(source.segment_started_at)) : 0;
  const activeMs = ['PLAN', 'EXEC', 'TEST', 'REVIEW', 'QUALITY_GATE']
    .reduce((sum, phase) => sum + (number(durations[phase]) ?? 0), 0) + (Number.isFinite(elapsed) ? elapsed : 0);
  const started = Date.parse(source.started_at);
  return {
    task: field(source, 'task'), description: field(source, 'description'), branch: field(source, 'branch'),
    phase: field(source, 'phase'), phase_status: field(source, 'phase_status'),
    delivery_status: field(source, 'delivery_status'), result: field(source, 'result'),
    next_phase: field(source, 'next_phase'), approvals: Array.isArray(source.approvals) ? source.approvals : [],
    started_at: field(source, 'started_at'), phase_started_at: field(source, 'phase_started_at'),
    segment_started_at: field(source, 'segment_started_at'),
    active_minutes: Object.keys(durations).length || source.segment_started_at ? minutes(activeMs) : null,
    cycle_minutes: Number.isFinite(started) ? minutes(Math.max(0, now - started)) : null,
    replans: field(source, 'replans'), fix_loops: field(source, 'fix_loops'),
    critical_findings: field(source, 'critical_findings'), high_findings: field(source, 'high_findings'),
    medium_findings: field(source, 'medium_findings'), low_findings: field(source, 'low_findings'),
    tokens_estimated: field(source, 'tokens_estimated'), commit_sha: field(source, 'commit_sha'),
    pr: field(source, 'pr'), ci_reference: field(source, 'ci_reference'),
    merge_sha: field(source, 'merge_sha'), merged_at: field(source, 'merged_at'),
  };
}

export function normalizeHistory(value) {
  const source = object(value);
  return Object.fromEntries([
    'task', 'description', 'branch', 'started_at', 'finished_at', 'cycle_minutes', 'active_minutes',
    'first_pass', 'fix_loops', 'replans', 'critical_findings', 'high_findings', 'medium_findings',
    'low_findings', 'delivery_status', 'commit_sha', 'pr', 'merged_at', 'merge_sha',
    'tokens_estimated',
  ].map((key) => [key, field(source, key)]));
}

async function readState(filename, now) {
  let content;
  try { content = await fs.readFile(filename, 'utf8'); }
  catch (error) { if (error.code === 'ENOENT') return { status: 'missing', state: null }; throw error; }
  try {
    const parsed = JSON.parse(content);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { status: 'invalid', state: null };
    return { status: 'ok', state: normalizeState(parsed, now()) };
  } catch (error) {
    if (error instanceof SyntaxError) return { status: 'invalid', state: null };
    throw error;
  }
}

async function readHistory(filename, logger) {
  let content;
  try { content = await fs.readFile(filename, 'utf8'); }
  catch (error) { if (error.code === 'ENOENT') return { status: 'missing', entries: [] }; throw error; }
  const rows = [];
  let invalidLines = 0;
  content.split(/\r?\n/).forEach((line, index) => {
    if (!line.trim()) return;
    try {
      const parsed = JSON.parse(line);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new SyntaxError();
      rows.push(normalizeHistory(parsed));
    } catch { invalidLines++; logger.warn(`history.jsonl: linha ${index + 1} inválida; ignorada.`); }
  });
  return invalidLines ? { status: 'partial', entries: rows, invalidLines } : { status: 'ok', entries: rows };
}

export function resolveDashboardConfig({ args = [], env = process.env, cwd = process.cwd() } = {}) {
  let cliDataDir;
  for (let index = 0; index < args.length; index++) {
    if (args[index] !== '--data-dir') throw new Error(`Argumento desconhecido: ${args[index]}`);
    const value = args[++index];
    if (!value || value.startsWith('--')) throw new Error('--data-dir requer um caminho.');
    cliDataDir = value;
  }
  const configured = cliDataDir !== undefined || Boolean(env.TASK_RUNNER_DATA_DIR);
  return {
    runtimeDataDir: path.resolve(cwd, cliDataDir ?? env.TASK_RUNNER_DATA_DIR ?? DEFAULT_DATA_DIR),
    sourceConfigured: configured,
  };
}

function respond(res, status, data, contentType = 'application/json; charset=utf-8', dynamic = true) {
  res.writeHead(status, { 'Content-Type': contentType, ...(dynamic ? { 'Cache-Control': 'no-store' } : {}) });
  res.end(typeof data === 'string' || Buffer.isBuffer(data) ? data : JSON.stringify(data));
}

export function createDashboardServer({ staticAssetsDir = ASSETS, runtimeDataDir = DEFAULT_DATA_DIR,
  sourceConfigured = false, logger = console, now = () => Date.now() } = {}) {
  const stateFile = path.join(path.resolve(runtimeDataDir), 'state.json');
  const historyFile = path.join(path.resolve(runtimeDataDir), 'history.jsonl');
  return http.createServer(async (req, res) => {
    if (req.method !== 'GET') return respond(res, 405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'Método não permitido.' } });
    let pathname;
    try {
      const rawPath = req.url.split('?')[0];
      if (/(?:\.{2}|%2e|%2f|%5c|\\)/i.test(rawPath)) {
        return respond(res, 400, { error: { code: 'INVALID_PATH', message: 'Caminho inválido.' } });
      }
      pathname = new URL(req.url, 'http://localhost').pathname;
      const decoded = decodeURIComponent(pathname);
      if (decoded.includes('..') || decoded.includes('\\') || decoded.includes('\0') || decoded !== pathname) {
        return respond(res, 400, { error: { code: 'INVALID_PATH', message: 'Caminho inválido.' } });
      }
    } catch { return respond(res, 400, { error: { code: 'INVALID_PATH', message: 'Caminho inválido.' } }); }
    try {
      if (STATIC.has(pathname)) {
        const [filename, contentType] = STATIC.get(pathname);
        return respond(res, 200, await fs.readFile(path.join(staticAssetsDir, filename)), contentType, false);
      }
      if (pathname === '/api/health') return respond(res, 200, { status: 'ok', sourceConfigured });
      if (pathname === '/api/state') return respond(res, 200, await readState(stateFile, now));
      if (pathname === '/api/history') return respond(res, 200, await readHistory(historyFile, logger));
      if (pathname === '/api/metrics') {
        const history = await readHistory(historyFile, logger);
        // Only complete numeric records can be aggregated; partial records remain visible in history.
        const measured = history.entries.filter((row) => number(row.cycle_minutes) !== null
          && number(row.active_minutes) !== null && number(row.fix_loops) !== null);
        return respond(res, 200, { status: history.status, metrics: calculateMetrics(measured),
          ...(history.invalidLines ? { invalidLines: history.invalidLines } : {}) });
      }
      return respond(res, 404, { error: { code: 'NOT_FOUND', message: 'Rota não encontrada.' } });
    } catch (error) {
      logger.error(`Dashboard: falha ao atender ${pathname}.`);
      if (pathname === '/api/state') return respond(res, 500, { status: 'error', state: null, error: 'state_read_failed' });
      if (pathname === '/api/history') return respond(res, 500, { status: 'error', entries: [], error: 'history_read_failed' });
      if (pathname === '/api/metrics') return respond(res, 500, { status: 'error', metrics: null, error: 'history_read_failed' });
      return respond(res, 500, { error: { code: 'INTERNAL_ERROR', message: 'Falha ao ler dados do dashboard.' } });
    }
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const host = process.env.TASK_RUNNER_DASHBOARD_HOST || '127.0.0.1';
  const rawPort = process.env.TASK_RUNNER_DASHBOARD_PORT || '4173';
  if (!/^(0|[1-9]\d*)$/.test(rawPort) || Number(rawPort) > 65535) {
    process.stderr.write('TASK_RUNNER_DASHBOARD_PORT inválida.\n');
    process.exitCode = 1;
  } else {
    let config;
    try { config = resolveDashboardConfig({ args: process.argv.slice(2) }); }
    catch (error) { process.stderr.write(`${error.message}\n`); process.exitCode = 1; }
    if (config) {
      const server = createDashboardServer(config);
      server.on('error', () => { process.stderr.write('Falha ao iniciar dashboard.\n'); process.exitCode = 1; });
      server.listen(Number(rawPort), host, () => {
        process.stdout.write(`Task Runner Dashboard: http://${host}:${server.address().port}\n`);
      });
    }
  }
}
