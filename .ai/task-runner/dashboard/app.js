const $ = (id) => document.getElementById(id);
const phases = ['PLAN', 'EXEC', 'TEST', 'REVIEW', 'QUALITY_GATE'];
const delivery = ['COMMITTED', 'PR_OPEN', 'CI_PASS', 'MERGED'];
const phaseLabels = ['PLAN', 'EXEC', 'TEST', 'REVIEW', 'QUALITY GATE'];
const deliveryLabels = ['COMMIT', 'PR', 'CI', 'MERGE'];
const dash = (value) => value === null || value === undefined || value === '' ? '—' : String(value);
const numeric = (value) => typeof value === 'number' && Number.isFinite(value) ? value : null;
const duration = (value) => numeric(value) === null ? '—' : `${value.toFixed(2)} min`;
const date = (value) => value && !Number.isNaN(Date.parse(value)) ? new Date(value).toLocaleString('pt-BR') : '—';
const short = (value) => value ? String(value).slice(0, 8) : '—';
let lastUpdate = null;
let latestState = null;
let latestHistory = [];
let hasValidState = false;
let hasValidHistory = false;
let hasValidMetrics = false;

function set(id, value) { $(id).textContent = dash(value); }
function stage(container, labels, states) {
  $(container).replaceChildren(...labels.map((label, index) => {
    const item = document.createElement('div');
    item.className = `stage ${states[index]}`;
    const icon = { done: '✓', current: '●', pending: '○', failed: '!', unknown: '?' }[states[index]];
    item.textContent = `${icon} ${label}`;
    item.title = { done: 'Concluído', current: 'Atual', pending: 'Pendente', failed: 'Falhou ou bloqueado', unknown: 'Sem dados' }[states[index]];
    return item;
  }));
}

function renderState(state) {
  latestState = state;
  set('task', state?.task || 'Nenhuma task ativa');
  const historyDescription = latestHistory.find((row) => row.task === state?.task)?.description;
  set('description', state ? state.description || historyDescription || 'Descrição indisponível no estado.' : 'Aguardando estado do runner.');
  set('branch', state?.branch);
  const overall = state?.delivery_status && state.delivery_status !== 'NONE'
    ? state.delivery_status : state?.phase_status;
  set('overall', overall || 'Sem estado');
  set('phase-status', state?.phase ? `${state.phase} · ${state.phase_status || '—'}` : '—');
  set('active', duration(state?.active_minutes));
  set('cycle', duration(state?.cycle_minutes));
  set('started', date(state?.started_at));
  $('phase-start-label').textContent = state?.phase_started_at ? 'Início da fase' : 'Início do segmento ativo';
  set('phase-started', date(state?.phase_started_at || state?.segment_started_at));
  set('fix-loops', state?.fix_loops);
  set('replans', state?.replans);
  set('tokens', state?.tokens_estimated);
  set('first-pass-current', numeric(state?.replans) !== null && numeric(state?.fix_loops) !== null
    ? (state.replans === 0 && state.fix_loops === 0 ? 'Sim, até agora' : 'Não') : null);
  $('findings').replaceChildren(...['critical', 'high', 'medium', 'low'].map((level, index) => {
    const chip = document.createElement('span');
    chip.className = 'finding';
    chip.textContent = `${['C', 'H', 'M', 'L'][index]} ${dash(state?.[`${level}_findings`])}`;
    return chip;
  }));
  const current = phases.indexOf(state?.phase);
  stage('pipeline', phaseLabels, phases.map((phase, index) => {
    if (current < 0) return 'unknown';
    if (index > current) return 'pending';
    if (index < current) return state.approvals?.some((entry) => entry.phase === phase && entry.result === 'PASS') ? 'done' : 'unknown';
    return ['FAIL', 'BLOCKED'].includes(state.result) ? 'failed' : 'current';
  }));
  const reached = delivery.indexOf(state?.delivery_status);
  stage('delivery', deliveryLabels, delivery.map((_, index) => {
    if (reached < 0) return state ? 'pending' : 'unknown';
    return index <= reached ? 'done' : 'pending';
  }));
  set('commit', short(state?.commit_sha));
  set('pr', state?.pr);
  set('ci', state?.ci_reference);
  set('merge', short(state?.merge_sha));
}

function renderMetrics(data) {
  const entries = [
    ['Tasks concluídas', data.count], ['Cycle médio', duration(data.cycle_mean)],
    ['Mediana', duration(data.cycle_median)], ['P75', duration(data.cycle_p75)],
    ['Active médio', duration(data.active_mean)],
    ['First-pass', numeric(data.first_pass_rate) === null ? '—' : `${data.first_pass_rate.toFixed(2)}%`],
    ['Fix loops médios', numeric(data.fix_loops_mean) === null ? '—' : data.fix_loops_mean.toFixed(2)],
  ];
  $('metrics').replaceChildren(...entries.map(([label, value]) => {
    const card = document.createElement('div');
    card.className = 'metric';
    const name = document.createElement('span'); name.textContent = label;
    const figure = document.createElement('strong'); figure.textContent = dash(value);
    card.append(name, figure);
    return card;
  }));
  $('sample-warning').hidden = !data.insufficient_sample;
}

function renderHistory(rows, emptyMessage = 'Nenhuma task concluída.') {
  latestHistory = rows;
  set('history-count', `${rows.length} registro${rows.length === 1 ? '' : 's'}`);
  const sorted = [...rows].sort((a, b) => (Date.parse(b.finished_at) || 0) - (Date.parse(a.finished_at) || 0));
  $('history').replaceChildren(...(sorted.length ? sorted.map((row) => {
    const tr = document.createElement('tr');
    const values = [row.task, row.branch, duration(row.cycle_minutes), duration(row.active_minutes),
      row.first_pass === null ? '—' : row.first_pass ? 'Sim' : 'Não', row.fix_loops,
      ['critical', 'high', 'medium', 'low'].map((level) => dash(row[`${level}_findings`])).join(' / '),
      row.delivery_status, [short(row.commit_sha), short(row.merge_sha)].join(' / ')];
    values.forEach((value) => { const td = document.createElement('td'); td.textContent = dash(value); tr.append(td); });
    return tr;
  }) : [(() => { const tr = document.createElement('tr'); const td = document.createElement('td');
    td.colSpan = 9; td.className = 'empty'; td.textContent = emptyMessage; tr.append(td); return tr; })()]));
  if (latestState) renderState(latestState);
}

async function refresh() {
  const endpoints = ['health', 'state', 'history', 'metrics'];
  const results = await Promise.allSettled(endpoints.map(async (name) => {
    const response = await fetch(`/api/${name}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(name);
    return response.json();
  }));
  const [health, state, history, metrics] = results.map((result) => result.status === 'fulfilled' ? result.value : null);
  if (health) set('runtime-source', health.sourceConfigured
    ? 'Origem do runtime: diretório configurado' : 'Origem do runtime: worktree do dashboard');
  if (state?.status === 'ok') { renderState(state.state); hasValidState = true; }
  else if (!hasValidState && state) {
    renderState(null);
    if (state.status === 'missing') set('task', 'Runtime do task-runner não encontrado.');
    if (state.status === 'invalid') set('task', 'Estado do task-runner inválido.');
  }
  if (history?.status === 'ok' || history?.status === 'partial') {
    renderHistory(history.entries); hasValidHistory = true;
  } else if (history?.status === 'missing' && !hasValidHistory) {
    renderHistory([], 'Runtime do task-runner não encontrado.');
  }
  if (metrics && metrics.status !== 'missing') { renderMetrics(metrics.metrics); hasValidMetrics = true; }
  const failed = results.some((result) => result.status === 'rejected');
  $('api-error').hidden = !failed;
  if (failed && !hasValidState && !state) set('task', 'Não foi possível atualizar o dashboard.');
  $('stale').hidden = !((failed && (hasValidState || hasValidHistory || hasValidMetrics))
    || (hasValidState && ['missing', 'invalid'].includes(state?.status))
    || (hasValidHistory && history?.status === 'missing')
    || (hasValidMetrics && metrics?.status === 'missing'));
  const messages = [];
  if (failed) messages.push('Não foi possível atualizar o dashboard.');
  if (state?.status === 'missing' || history?.status === 'missing') messages.push('Runtime do task-runner não encontrado.');
  if (state?.status === 'invalid') messages.push('Estado do task-runner inválido.');
  if (history?.status === 'partial') messages.push(`Histórico parcial: ${history.invalidLines} linha(s) inválida(s).`);
  if (history?.status === 'ok' && history.entries.length === 0) messages.push('Histórico disponível, sem tasks concluídas.');
  $('source-status').textContent = messages.join(' ');
  $('source-status').hidden = messages.length === 0;
  if (!failed) lastUpdate = Date.now();
}

function tick() {
  set('updated', lastUpdate === null ? 'Aguardando dados…' : `Atualizado há ${Math.floor((Date.now() - lastUpdate) / 1000)} s`);
}

renderState(null);
refresh().finally(tick);
setInterval(() => { refresh().finally(tick); }, 3000);
setInterval(tick, 1000);
