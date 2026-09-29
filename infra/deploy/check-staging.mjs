#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

const mode = process.argv[2] ?? 'internal';
const compose = process.env.STAGING_COMPOSE ?? 'compose.staging.yaml';
const envFile = process.env.STAGING_ENV_FILE ?? '/home/deploy/cupcake-staging/.env';
function runScript(service, script) {
  const result = spawnSync('docker', ['compose', '--env-file', envFile, '-f', compose, 'exec', '-T', service, 'node', script], { stdio: 'pipe', encoding: 'utf8', timeout: 30000, env: process.env });
  if (result.status !== 0 || result.error) throw new Error(`${service}: ${script} falhou`);
}
function run(service, code) {
  const result = spawnSync('docker', ['compose', '--env-file', envFile, '-f', compose, 'exec', '-T', service, 'node', '-e', code], { stdio: 'pipe', encoding: 'utf8', timeout: 30000, env: process.env });
  if (result.status !== 0 || result.error) throw new Error(`${service}: check falhou`);
}
async function publicCheck() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch('https://app-staging.qosit.cloud/login', { signal: controller.signal, redirect: 'manual' });
    if (response.status !== 200) throw new Error(`URL pública: HTTP ${response.status}`);
  } finally { clearTimeout(timer); }
}
try {
  if (mode === 'public') await publicCheck();
  else if (mode === 'internal') {
    const db = spawnSync('docker', ['compose', '--env-file', envFile, '-f', compose, 'exec', '-T', 'postgres', 'sh', '-c', 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"'], { stdio: 'pipe', timeout: 30000, env: process.env });
    if (db.status !== 0 || db.error) throw new Error('PostgreSQL indisponível');
    runScript('api', 'scripts/check-runtime-db.cjs');
    run('api', "fetch('http://127.0.0.1:3000/health',{signal:AbortSignal.timeout(5000)}).then(async r=>{if(r.status!==200||(await r.json()).status!=='ok')process.exit(1)}).catch(()=>process.exit(1))");
    run('admin', "fetch('http://127.0.0.1:3001/login',{signal:AbortSignal.timeout(5000)}).then(r=>{if(r.status!==200)process.exit(1)}).catch(()=>process.exit(1))");
  } else if (mode === 'storage') {
    runScript('api', 'scripts/check-storage.cjs');
  } else throw new Error('Modo inválido');
  console.log(`${mode}: ok`);
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Check falhou');
  process.exitCode = 1;
}
