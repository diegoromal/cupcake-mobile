import { strict as assert } from 'node:assert';
import { execFileSync, execSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve, sep } from 'node:path';
import { ArgumentsHost, INestApplication } from '@nestjs/common';
import { BaseExceptionFilter, NestFactory } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { PrismaPg } from '@prisma/adapter-pg';
import request from 'supertest';
import type { Response } from 'supertest';
import { AppModule } from '../src/app.module';
import { Prisma, PrismaClient } from '../src/generated/prisma/client';
import { ModalidadeRecebimento } from '../src/generated/prisma/enums';

/**
 * D106 — concorrência real de estoque/reserva/pedido.
 *
 * Banco dedicado cupcake_d106 (schema public). Nenhuma escrita fora dele, nenhum
 * DROP/TRUNCATE/recriação. A prova de concorrência é o snapshot de
 * pg_stat_activity/pg_blocking_pids com N PIDs distintos bloqueados pelo mesmo
 * blocker ANTES do release — nunca Promise.all isolado nem duração.
 */

type Sessao = {
  application_name: string;
  pid: number;
  state: string;
  wait_event_type: string | null;
  wait_event: string | null;
  query: string;
  blockers: number[];
};

type Assertion = { label: string; ok: boolean };

type Cenario = {
  id: string;
  /** Cenário lógico do PLAN quando o registro é um ramo (ex.: CON-006 com ramos 6A/6B). */
  cenario?: string;
  /** Rótulo do ramo (ex.: '6A' | '6B'). */
  ramo?: string;
  operacao: string;
  concorrencia: number;
  estoqueInicial: unknown;
  blocker: { pid: number; state: string; locks: unknown[] } | null;
  waiters: Sessao[];
  waitersCount: number;
  distinctPids: number;
  pendingBeforeRelease: boolean | null;
  responses: Array<{ status: number; message: unknown }>;
  db: unknown;
  deadlocksBefore: string;
  deadlocksAfter: string | null;
  assertions: Assertion[];
  veredito: 'PASS' | 'FAIL' | 'INCONCLUSIVO';
  erro?: string;
  errosDeBanco?: Array<{ aplicacao: string; codigo: string | null; mensagem: string }>;
};

const rawEnv = process.env.D106_TEST_DATABASE_URL;
if (!rawEnv) throw new Error('D106 exige D106_TEST_DATABASE_URL para localhost/cupcake_d106.');
const raw: string = rawEnv;
const url = new URL(raw);
if (!['postgres:', 'postgresql:'].includes(url.protocol) ||
    !['localhost', '127.0.0.1'].includes(url.hostname) ||
    (url.port && url.port !== '5432') || url.pathname !== '/cupcake_d106' || url.hash ||
    [...url.searchParams].some(([chave, valor]) => chave !== 'schema' || valor !== 'public')) {
  throw new Error('D106 exige PostgreSQL local dedicado cupcake_d106, schema public.');
}

const runId = `d106_${randomUUID()}`;
const raizRepo = resolve(__dirname, '../../..');
const evidenciaDir = resolve(raizRepo, 'docs/testing/evidence');
const evidenciaRelativa = process.env.D106_EVIDENCE_PATH?.trim();
if (evidenciaRelativa !== undefined && evidenciaRelativa !== '' &&
    (!evidenciaRelativa.endsWith('.json') || evidenciaRelativa.includes('..'))) {
  throw new Error('D106_EVIDENCE_PATH deve ser um caminho .json sem ".." dentro de docs/testing/evidence.');
}
const destinoArtefato = evidenciaRelativa
  ? resolve(raizRepo, evidenciaRelativa)
  : resolve(evidenciaDir, 'D106-exec-concorrencia.json');
if (!destinoArtefato.startsWith(`${evidenciaDir}${sep}`)) {
  throw new Error('D106_EVIDENCE_PATH deve apontar para docs/testing/evidence.');
}
const runLabelBruto = process.env.D106_RUN_LABEL?.trim() || 'canonica';
if (!/^[A-Za-z0-9._-]{1,40}$/.test(runLabelBruto)) {
  throw new Error('D106_RUN_LABEL deve ter 1-40 caracteres [A-Za-z0-9._-].');
}
const runLabel = runLabelBruto;
const condicaoBruta = process.env.D106_CONDICAO?.trim() || 'fixes-aplicados';
if (!/^[A-Za-z0-9._-]{1,60}$/.test(condicaoBruta)) {
  throw new Error('D106_CONDICAO deve ter 1-60 caracteres [A-Za-z0-9._-].');
}
const condicao = condicaoBruta;
const urlBase = new URL(raw);
urlBase.searchParams.set('application_name', runId);
const databaseUrl = urlBase.toString();

process.env.DATABASE_URL = databaseUrl;
process.env.JWT_ACCESS_SECRET = `d106-access-${randomUUID()}`;
process.env.JWT_REFRESH_SECRET = `d106-refresh-${randomUUID()}`;
process.env.EVOLUTION_API_URL = '';
process.env.EVOLUTION_API_KEY = '';
process.env.EVOLUTION_API_INSTANCE = '';
process.env.GEOCODE_MAPS_CO_API_KEY = '';

const LOOPBACK = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);
const fetchOriginal = globalThis.fetch;
let fetchCalls = 0;
const egressTentativas: Array<{ destino: string; origem: string }> = [];
let origemAtual = 'preflight';

const guardaFetch = async (entrada: unknown, init?: unknown): Promise<unknown> => {
  fetchCalls += 1;
  let host = '';
  let destino = '<nao-parseavel>';
  try {
    const alvo = typeof entrada === 'string'
      ? entrada
      : entrada instanceof URL
        ? entrada.toString()
        : typeof (entrada as { url?: unknown })?.url === 'string'
          ? (entrada as { url: string }).url
          : String(entrada);
    const alvoUrl = new URL(alvo);
    host = alvoUrl.hostname;
    destino = `${alvoUrl.protocol}//${alvoUrl.hostname}`;
  } catch {
    destino = '<nao-parseavel>';
  }
  egressTentativas.push({ destino, origem: origemAtual });
  if (!LOOPBACK.has(host)) throw new Error('D106: egress bloqueado pela guarda de fetch.');
  return (fetchOriginal as unknown as (a: unknown, b?: unknown) => Promise<unknown>)(entrada, init);
};
globalThis.fetch = guardaFetch as unknown as typeof fetch;

function mensagemDeErro(erro: unknown): string {
  if (erro instanceof Error) return erro.stack ?? erro.message;
  return String(erro);
}

/** Texto de erro para o artefato: sem stack e sem caminho absoluto (LOW-07). */
function sanitizarErroTexto(erro: unknown): string {
  const bruto = erro instanceof Error ? erro.message : String(erro);
  return bruto
    .replace(/\/Users\/[^\s)"']+/g, '<caminho>')
    .replace(/\/private\/var\/[^\s)"']+/g, '<caminho>')
    .replace(/\/var\/folders\/[^\s)"']+/g, '<caminho>')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Extrai SQLSTATE/mensagem do PostgreSQL de um erro do Nest/Prisma (LOW-07). */
function extrairErroBanco(erro: unknown): { codigo: string | null; mensagem: string } {
  let codigo: string | null = null;
  let mensagem = '';
  const visitados = new Set<object>();
  const visitar = (valor: unknown, profundidade = 0) => {
    if (profundidade > 8 || valor === null || typeof valor !== 'object' ||
        visitados.has(valor as object)) return;
    visitados.add(valor as object);
    const campos = valor as Record<string, unknown>;
    for (const chave of ['sqlstate', 'sqlState', 'originalCode']) {
      const candidato = campos[chave];
      if (typeof candidato === 'string' && /^[0-9A-Z]{5}$/.test(candidato)) codigo ??= candidato;
    }
    if (typeof campos.code === 'string' && /^[0-9A-Z]{5}$/.test(campos.code) &&
        !campos.code.startsWith('P')) {
      codigo ??= campos.code;
    }
    if (!mensagem && typeof campos.message === 'string' && campos.message.trim()) {
      mensagem = campos.message.split('\n')[0];
    }
    for (const filho of Object.values(campos)) visitar(filho, profundidade + 1);
  };
  visitar(erro);
  return { codigo, mensagem: sanitizarErroTexto(mensagem) };
}

function sanitizar(valor: unknown, profundidade = 0): unknown {
  if (profundidade > 5) return '[profundidade]';
  if (Array.isArray(valor)) {
    const cabeca = valor.slice(0, 12).map((item) => sanitizar(item, profundidade + 1));
    return valor.length > 12 ? [...cabeca, `[+${valor.length - 12}]`] : cabeca;
  }
  if (valor !== null && typeof valor === 'object') {
    const saida: Record<string, unknown> = {};
    for (const [chave, conteudo] of Object.entries(valor as Record<string, unknown>)) {
      if (/token|senha|credencial|secret|apikey|authorization/i.test(chave)) {
        saida[chave] = '[redigido]';
        continue;
      }
      saida[chave] = sanitizar(conteudo, profundidade + 1);
    }
    return saida;
  }
  return valor;
}

function lerGit(comando: string): string {
  try { return execSync(comando, { encoding: 'utf8' }).trim(); } catch { return '<indisponivel>'; }
}

function versao(comando: string): string {
  try { return execSync(comando, { encoding: 'utf8' }).trim(); } catch { return '<indisponivel>'; }
}

/**
 * Proveniência da execução (TEST-F02/TEST-F03): HEAD, estado do working tree e hash
 * do diff **restrito aos 3 arquivos do fix de F-04**. O hash é reproduzível com
 * `git diff HEAD -- <3 arquivos> | sha256`; no estado "depois" o valor é
 * `d9aa24d4fa95a3aa4e895325db2130eab423a3262713916dca6ad81e3bb889d4` e no estado
 * "antes" (fix revertido) é o sha256 de um diff vazio.
 */
const ARQUIVOS_FIX_F04 = [
  'apps/api/src/produtos/estoque.service.ts',
  'apps/api/src/pedidos/pedidos.service.ts',
  'apps/api/src/pagamentos/pagamentos.service.ts',
];

function provenienciaGit(): {
  head: string; branch: string; dirty: boolean;
  workingTree: { modificados: string[]; naoRastreados: string[] };
  diffSha256: { algoritmo: 'sha256'; escopo: string; arquivos: string[]; valor: string };
} {
  const gitRepo = (args: string[]): string => {
    try { return execFileSync('git', ['-C', raizRepo, ...args], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }); }
    catch { return ''; }
  };
  const linhas = gitRepo(['status', '--porcelain']).split('\n').filter((linha) => linha.trim() !== '');
  const diffFix = gitRepo(['diff', 'HEAD', '--', ...ARQUIVOS_FIX_F04]);
  return {
    head: gitRepo(['rev-parse', 'HEAD']).trim() || lerGit('git rev-parse HEAD'),
    branch: gitRepo(['rev-parse', '--abbrev-ref', 'HEAD']).trim() || lerGit('git rev-parse --abbrev-ref HEAD'),
    dirty: linhas.length > 0,
    workingTree: {
      modificados: linhas.filter((linha) => !linha.startsWith('??')).map((linha) => linha.slice(3)),
      naoRastreados: linhas.filter((linha) => linha.startsWith('??')).map((linha) => linha.slice(3)),
    },
    diffSha256: {
      algoritmo: 'sha256',
      escopo: 'git diff HEAD -- <3 arquivos do fix de F-04>',
      arquivos: [...ARQUIVOS_FIX_F04],
      valor: createHash('sha256').update(diffFix).digest('hex'),
    },
  };
}

async function main(): Promise<void> {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
  const jwt = new JwtService();

  const categoria = randomUUID();
  const categorias = [categoria];
  const usuarios: string[] = [];
  const produtos: string[] = [];
  const cenarios: Cenario[] = [];
  const checks: { total: number } = { total: 0 };
  const invariantes = new Map<string, Assertion[]>();
  const pending = new Set<Promise<unknown>>();
  const cleanupErrors: string[] = [];
  const errosDeBanco: Array<{
    cenario: string; aplicacao: string; codigo: string | null; mensagem: string;
  }> = [];
  const cleanupPassos: Array<{ passo: number; tabela: string; erro: string | null }> = [];

  const apps: INestApplication[] = [];
  const servidores: unknown[] = [];
  const nomesInstancias = [1, 2, 3, 4, 5].map((n) => `${runId}-n${n}`);

  const adminId = randomUUID();
  const tokens = new Map<string, string>();

  let deadlocksIniciais = '0';
  let deadlocksFinais: string | null = null;
  let pronto = false;
  let erroFatal: string | null = null;

  const ambiente = {
    cwd: process.cwd().endsWith('/apps/api') ? 'apps/api' : 'cwd-fora-de-apps/api',
    database: 'cupcake_d106',
    schema: 'public',
    evolucaoUrlAntesDoCreate: process.env.EVOLUTION_API_URL,
    evolucaoUrlDepoisDoCreate: '',
    geocodeKey: process.env.GEOCODE_MAPS_CO_API_KEY,
  };
  let preflight: unknown = null;

  const track = <T>(promessa: Promise<T>): Promise<T> => {
    pending.add(promessa);
    void promessa.then(() => pending.delete(promessa), () => pending.delete(promessa));
    return promessa;
  };

  const bounded = async <T>(promessa: Promise<T>, rotulo: string, ms = 30000): Promise<T> => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([promessa, new Promise<never>((_, rejeitar) => {
        timer = setTimeout(() => rejeitar(new Error(`Timeout D106: ${rotulo}`)), ms);
      })]);
    } catch (erro) {
      if (erro instanceof Error && erro.message.startsWith('Timeout D106:')) {
        process.stderr.write(`${erro.message}; aguardando a operação original antes da limpeza\n`);
        await Promise.allSettled([promessa]);
      }
      throw erro;
    } finally {
      if (timer) clearTimeout(timer);
    }
  };

  const awaitPending = async () => {
    if (pending.size === 0) return;
    const resultados = await Promise.allSettled([...pending]);
    for (const resultado of resultados) {
      if (resultado.status === 'rejected') {
        // Rejeições de requests concorrentes são esperadas; não contam como erro de cleanup.
        void resultado.reason;
      }
    }
    if (pending.size !== 0) throw new Error(`D106: ${pending.size} operações pendentes antes da limpeza`);
  };

  const cenarioAtual = (): Cenario => {
    const atual = cenarios[cenarios.length - 1];
    if (!atual) throw new Error('Nenhum cenário aberto');
    return atual;
  };

  const eq = (label: string, atual: unknown, esperado: unknown) => {
    let ok = true;
    try { assert.deepEqual(atual, esperado); } catch { ok = false; }
    cenarioAtual().assertions.push({ label, ok });
    checks.total += 1;
    if (!ok) {
      throw new Error(`Assertion D106 falhou [${cenarioAtual().id}] ${label}: ${JSON.stringify(atual)} != ${JSON.stringify(esperado)}`);
    }
  };

  const marcarInvariante = (id: string, label: string, ok: boolean) => {
    const lista = invariantes.get(id) ?? [];
    lista.push({ label, ok });
    invariantes.set(id, lista);
    checks.total += 1;
    if (!ok) process.stderr.write(`Invariante D106 ${id} violada em ${label}\n`);
  };

  const abrirCenario = (dados: Pick<Cenario, 'id' | 'operacao' | 'concorrencia' | 'estoqueInicial'> &
    Pick<Partial<Cenario>, 'cenario' | 'ramo'>): Cenario => {
    const cenario: Cenario = {
      ...dados,
      blocker: null,
      waiters: [],
      waitersCount: 0,
      distinctPids: 0,
      pendingBeforeRelease: null,
      responses: [],
      db: null,
      deadlocksBefore: deadlocksFinais ?? deadlocksIniciais,
      deadlocksAfter: null,
      assertions: [],
      veredito: 'PASS',
    };
    cenarios.push(cenario);
    return cenario;
  };

  const token = (usuarioId: string) => {
    const existente = tokens.get(usuarioId);
    if (existente) return existente;
    const novo = `Bearer ${jwt.sign(
      { sub: usuarioId, perfil: 'CLIENTE', type: 'access' },
      { secret: process.env.JWT_ACCESS_SECRET, algorithm: 'HS256', expiresIn: '15m' },
    )}`;
    tokens.set(usuarioId, novo);
    return novo;
  };

  const lerDeadlocks = async (): Promise<string> => {
    const [linha] = await prisma.$queryRaw<Array<{ deadlocks: bigint }>>`
      SELECT deadlocks FROM pg_stat_database WHERE datname = current_database()`;
    return linha.deadlocks.toString();
  };

  const aguardarWaiters = async (
    nomes: string[], quantidade: number, predicado: (sessao: Sessao) => boolean, limiteMs = 12000,
  ): Promise<Sessao[]> => {
    const limite = Date.now() + limiteMs;
    let ultimas: Sessao[] = [];
    for (;;) {
      ultimas = await prisma.$queryRaw<Sessao[]>`
        SELECT a.application_name, a.pid, a.state, a.wait_event_type, a.wait_event, a.query,
               pg_blocking_pids(a.pid) AS blockers
        FROM pg_stat_activity a
        WHERE a.datname = current_database()
          AND a.application_name IN (${Prisma.join(nomes)})
          AND a.state = 'active' AND a.wait_event_type = 'Lock'`;
      const casadas = ultimas.filter(predicado);
      if (casadas.length >= quantidade && new Set(casadas.map((linha) => linha.pid)).size >= quantidade) {
        return casadas;
      }
      if (Date.now() >= limite) {
        throw new Error(`Timeout D106 aguardando ${quantidade} waiters: ${JSON.stringify(ultimas)}`);
      }
      await new Promise((concluir) => setTimeout(concluir, 50));
    }
  };

  const abrirBloqueio = async (
    segurar: (tx: Prisma.TransactionClient) => Promise<void>, rotulo: string,
  ): Promise<{ pid: number; liberar: () => void; blocker: Promise<unknown> }> => {
    let liberar!: () => void;
    let sinalizar!: (pid: number) => void;
    const prontoLock = new Promise<number>((concluir) => { sinalizar = concluir; });
    const livre = new Promise<void>((concluir) => { liberar = concluir; });
    const blocker = track(prisma.$transaction(async (tx) => {
      await segurar(tx);
      const [{ pid }] = await tx.$queryRaw<Array<{ pid: number }>>`SELECT pg_backend_pid() AS pid`;
      sinalizar(pid);
      await livre;
    }, { timeout: 60000 }));
    void blocker.catch(() => undefined);
    const pid = await bounded(Promise.race([
      prontoLock,
      blocker.then(() => { throw new Error(`Bloqueador encerrou antes do sinal: ${rotulo}`); }),
    ]), rotulo, 5000);
    return { pid, liberar, blocker };
  };

  const locksDoBlocker = async (pid: number) => prisma.$queryRaw<Array<{
    locktype: string; mode: string; granted: boolean; relation: string | null;
  }>>`
    SELECT l.locktype, l.mode, l.granted, c.relname AS relation
    FROM pg_locks l LEFT JOIN pg_class c ON c.oid = l.relation
    WHERE l.pid = ${pid} AND l.locktype = 'relation'
    ORDER BY c.relname NULLS LAST, l.mode`;

  const estadoDoPid = async (pid: number): Promise<string> => {
    const [linha] = await prisma.$queryRaw<Array<{ state: string }>>`
      SELECT state FROM pg_stat_activity WHERE pid = ${pid}`;
    return linha?.state ?? '<ausente>';
  };

  const disputar = async (opcoes: {
    segurar: (tx: Prisma.TransactionClient) => Promise<void>;
    rotulo: string;
    nomes: string[];
    quantidade: number;
    predicado: (sessao: Sessao) => boolean;
    iniciar: (ctx: { pid: number }) => Promise<Array<Promise<Response>>>;
    esperarWaiters?: number;
  }): Promise<{ respostas: Response[]; sessoes: Sessao[]; blockerPid: number }> => {
    const { pid, liberar, blocker } = await abrirBloqueio(opcoes.segurar, opcoes.rotulo);
    const promessas: Array<Promise<Response>> = [];
    let sessoes: Sessao[] = [];
    try {
      const iniciadas = await opcoes.iniciar({ pid });
      promessas.push(...iniciadas);
      sessoes = (await aguardarWaiters(
        opcoes.nomes, opcoes.esperarWaiters ?? opcoes.quantidade, opcoes.predicado,
      )).filter(opcoes.predicado);
      const pids = new Set(sessoes.map((sessao) => sessao.pid));
      const diretos = sessoes.filter((sessao) => sessao.blockers.includes(pid)).length;
      const ancorados = sessoes.filter((sessao) => sessao.blockers.includes(pid) ||
        sessao.blockers.some((bloqueador) => pids.has(bloqueador))).length;
      cenarioAtual().blocker = {
        pid,
        state: await estadoDoPid(pid),
        locks: sanitizar(await locksDoBlocker(pid)) as unknown[],
      };
      cenarioAtual().waiters = sessoes;
      cenarioAtual().waitersCount = sessoes.length;
      cenarioAtual().distinctPids = new Set(sessoes.map((sessao) => sessao.pid)).size;
      cenarioAtual().pendingBeforeRelease = promessas.every((promessa) => pending.has(promessa));
      (cenarioAtual() as Cenario & { bloqueadosDiretamente?: number }).bloqueadosDiretamente = diretos;
      eq('cadeia ancorada no blocker', ancorados, sessoes.length);
      eq('ao menos um waiter bloqueado diretamente pelo blocker', diretos >= 1, true);
    } finally {
      liberar();
      await Promise.allSettled([blocker, ...promessas]);
    }
    const respostas = await bounded(Promise.all(promessas), opcoes.rotulo);
    return { respostas, sessoes, blockerPid: pid };
  };

  const servidor = (indice: number): unknown => servidores[1 + (indice % nomesInstancias.length)];

  const postarPedido = (
    usuarioId: string, revisaoId: string, tentativaId: string, indiceServidor: number,
  ): Promise<Response> => track(Promise.resolve(
    request(servidor(indiceServidor) as never).post('/pedidos')
      .set('Authorization', token(usuarioId))
      .send({ modalidade: ModalidadeRecebimento.RETIRADA, revisaoId, tentativaId }),
  ));

  const ajustarEstoque = (
    produtoId: string, quantidadeDisponivel: number, indiceServidor: number,
  ): Promise<Response> => track(Promise.resolve(
    request(servidor(indiceServidor) as never).patch(`/admin/produtos/${produtoId}/estoque`)
      .set('Authorization', token(adminId))
      .send({ quantidadeDisponivel }),
  ));

  const deletarProduto = (produtoId: string, indiceServidor: number): Promise<Response> =>
    track(Promise.resolve(
      request(servidor(indiceServidor) as never).delete(`/admin/produtos/${produtoId}`)
        .set('Authorization', token(adminId)),
    ));

  const capturarRevisao = async (usuarioId: string, indiceServidor: number): Promise<string> => {
    const resposta = await request(servidor(indiceServidor) as never).post('/pedidos/revisao')
      .set('Authorization', token(usuarioId))
      .send({ modalidade: ModalidadeRecebimento.RETIRADA });
    if (resposta.status !== 201) {
      throw new Error(`Revisão D106 falhou (${resposta.status}): ${JSON.stringify(resposta.body)}`);
    }
    const revisaoId = (resposta.body as { revisaoId?: unknown }).revisaoId;
    if (typeof revisaoId !== 'string' || !/^[a-f0-9]{64}$/.test(revisaoId)) {
      throw new Error(`RevisaoId D106 inválida: ${String(revisaoId)}`);
    }
    return revisaoId;
  };

  const mensagem = (resposta: Response): unknown =>
    (resposta.body as { message?: unknown } | undefined)?.message ?? null;

  const instantaneo = async (produtoId: string, usuariosDoCenario: string[]) => {
    const estoque = await prisma.estoque.findUniqueOrThrow({ where: { produtoId } });
    const pedidos = await prisma.pedido.findMany({
      where: { clienteUsuarioId: { in: usuariosDoCenario } },
      select: { id: true, statusAtual: true, total: true, itens: { select: { quantidade: true, produtoId: true } } },
      orderBy: { id: 'asc' },
    });
    const ids = pedidos.map((pedido) => pedido.id);
    const reservas = await prisma.reservaEstoque.findMany({
      where: { produtoId }, select: { estado: true, quantidade: true, pedidoId: true },
    });
    const porEstado: Record<string, number> = {};
    for (const reserva of reservas) porEstado[reserva.estado] = (porEstado[reserva.estado] ?? 0) + 1;
    const pagamentos = await prisma.pagamento.findMany({
      where: { pedidoId: { in: ids } }, select: { id: true, forma: true, resultado: true },
    });
    const movimentos = await prisma.movimentacaoEstoque.findMany({
      where: { produtoId }, orderBy: { id: 'asc' },
      select: { quantidade: true, motivoOrigem: true, pedidoId: true },
    });
    const historicos = await prisma.historicoStatusPedido.findMany({
      where: { pedidoId: { in: ids } }, select: { statusRegistrado: true },
    });
    return {
      estoque: {
        quantidadeFisica: estoque.quantidadeFisica,
        quantidadeReservada: estoque.quantidadeReservada,
        quantidadeDisponivel: estoque.quantidadeFisica - estoque.quantidadeReservada,
      },
      reservas: { total: reservas.length, porEstado, somaAtiva: reservas.filter((r) => r.estado === 'ATIVA')
        .reduce((soma, r) => soma + r.quantidade, 0) },
      pedidos: pedidos.map((pedido) => ({
        id: pedido.id, statusAtual: pedido.statusAtual,
        itens: pedido.itens.map((item) => ({ produtoId: item.produtoId, quantidade: item.quantidade })),
      })),
      pagamentos,
      movimentacoes: movimentos,
      historicos: historicos.map((linha) => linha.statusRegistrado),
    };
  };

  const criarProduto = async (rotulo: string, fisica: number, reservada = 0): Promise<string> => {
    const produtoId = randomUUID();
    produtos.push(produtoId);
    assert.equal(await prisma.produto.count({ where: { id: produtoId } }), 0, 'fixture de produto nova');
    await prisma.produto.create({ data: {
      id: produtoId, categoriaId: categoria, nome: `d106-${runId}-${rotulo}`, precoAtual: '1.00', ativo: true,
    } });
    await prisma.estoque.create({ data: {
      produtoId, quantidadeFisica: fisica, quantidadeReservada: reservada,
    } });
    return produtoId;
  };

  const criarCliente = async (rotulo: string, produtoId: string, quantidade: number): Promise<string> => {
    const usuarioId = randomUUID();
    usuarios.push(usuarioId);
    assert.equal(await prisma.usuario.count({ where: { id: usuarioId } }), 0, 'fixture de usuário nova');
    await prisma.usuario.create({ data: {
      id: usuarioId, nome: `d106-${runId}-${rotulo}`, email: `d106-${runId}-${rotulo}-${usuarioId}@example.test`,
      telefone: '11900000000', credencialSenha: 'fixture', perfil: 'CLIENTE',
    } });
    await prisma.carrinho.create({ data: {
      usuarioId, itens: { create: [{ produtoId, quantidade }] },
    } });
    return usuarioId;
  };

  const executarCenario = async (
    dados: Pick<Cenario, 'id' | 'operacao' | 'concorrencia' | 'estoqueInicial'> &
      Pick<Partial<Cenario>, 'cenario' | 'ramo'>,
    corpo: (cenario: Cenario) => Promise<void>,
  ): Promise<void> => {
    origemAtual = dados.id;
    const cenario = abrirCenario(dados);
    try {
      await corpo(cenario);
    } catch (erro) {
      cenario.veredito = 'FAIL';
      cenario.erro = sanitizarErroTexto(erro);
      process.stderr.write(`FAIL D106 ${dados.id}: ${mensagemDeErro(erro)}\n`);
    } finally {
      try { await awaitPending(); } catch (erro) {
        cenario.veredito = 'FAIL';
        cenario.erro = `${cenario.erro ?? ''} | ${sanitizarErroTexto(erro)}`;
      }
      cenario.errosDeBanco = errosDeBanco.filter((registro) => registro.cenario === cenario.id);
      cenario.deadlocksAfter = await lerDeadlocks().catch(() => null);
      deadlocksFinais = cenario.deadlocksAfter;
    }
  };

  try {
    // ---------------------------------------------------------------- preflight
    origemAtual = 'preflight';
    const [identidade] = await prisma.$queryRaw<Array<{ database: string; schema: string }>>`
      SELECT current_database() AS database, current_schema() AS schema`;
    assert.equal(identidade.database, 'cupcake_d106');
    assert.equal(identidade.schema, 'public');

    const migrationsEsperadas = readdirSync(resolve(__dirname, '../prisma/migrations'))
      .filter((nome) => /^\d+_/.test(nome));
    const migrationsAplicadas = await prisma.$queryRaw<Array<{
      migration_name: string; finished_at: Date | null; rolled_back_at: Date | null;
    }>>`SELECT migration_name, finished_at, rolled_back_at FROM "_prisma_migrations"`;
    for (const nome of migrationsEsperadas) {
      assert(migrationsAplicadas.some((linha) => linha.migration_name === nome &&
        linha.finished_at !== null && linha.rolled_back_at === null), `Migration pendente: ${nome}`);
    }
    assert.equal(migrationsAplicadas.every((linha) =>
      linha.finished_at !== null || linha.rolled_back_at !== null), true);

    deadlocksIniciais = await lerDeadlocks();
    deadlocksFinais = deadlocksIniciais;

    // Snapshot de contagem antes de criar qualquer fixture (banco dedicado deve iniciar vazio).
    const tabelasPreflight = [
      'Notificacao', 'ReservaEstoque', 'MovimentacaoEstoque', 'Pagamento', 'HistoricoStatusPedido',
      'ItemPedido', 'ItemPedidoPersonalizacaoSnapshot', 'EnderecoEntregaSnapshot', 'Pedido',
      'ItemCarrinhoPersonalizacao', 'ItemCarrinho', 'Carrinho', 'ProdutoPersonalizacao', 'Estoque',
      'Produto', 'Categoria', 'Usuario',
    ];
    const contagensIniciais: Record<string, number> = {};
    for (const tabela of tabelasPreflight) {
      const [linha] = await prisma.$queryRawUnsafe<Array<{ n: bigint }>>(
        `SELECT count(*)::bigint AS n FROM "${tabela}"`,
      );
      contagensIniciais[tabela] = Number(linha.n);
    }
    assert.equal(Object.values(contagensIniciais).every((valor) => valor === 0), true,
      'o banco dedicado cupcake_d106 deve iniciar vazio');

    await prisma.categoria.create({ data: { id: categoria, nome: `d106-${runId}` } });
    pronto = true;

    usuarios.push(adminId);
    await prisma.usuario.create({ data: {
      id: adminId, nome: `d106-${runId}-admin`, email: `d106-${runId}-admin-${adminId}@example.test`,
      telefone: '11900000000', credencialSenha: 'fixture', perfil: 'ADMIN',
    } });
    tokens.set(adminId, `Bearer ${jwt.sign(
      { sub: adminId, perfil: 'ADMIN', type: 'access' },
      { secret: process.env.JWT_ACCESS_SECRET, algorithm: 'HS256', expiresIn: '15m' },
    )}`);

    // LOW-07: captura SQLSTATE/mensagem do PostgreSQL sem caminhos absolutos.
    const anexarFiltroDeErros = (instancia: INestApplication, aplicacao: string) => {
      const filtroPadrao = new BaseExceptionFilter(instancia.getHttpAdapter());
      instancia.useGlobalFilters({
        catch(erro: unknown, host: ArgumentsHost) {
          const detalhe = extrairErroBanco(erro);
          if (detalhe.codigo !== null || /deadlock/i.test(detalhe.mensagem)) {
            errosDeBanco.push({
              cenario: origemAtual,
              aplicacao,
              codigo: detalhe.codigo,
              mensagem: detalhe.mensagem,
            });
          }
          filtroPadrao.catch(erro, host);
        },
      });
    };

    const app = await NestFactory.create(AppModule, { logger: false });
    anexarFiltroDeErros(app, runId);
    apps.push(app);
    await app.listen(0, '127.0.0.1');
    servidores.push(app.getHttpServer());

    // instâncias com application_name distinto para atribuir cada concorrente
    for (const nome of nomesInstancias) {
      const instanciaUrl = new URL(raw);
      instanciaUrl.searchParams.set('application_name', nome);
      process.env.DATABASE_URL = instanciaUrl.toString();
      const instancia = await NestFactory.create(AppModule, { logger: false });
      anexarFiltroDeErros(instancia, nome);
      apps.push(instancia);
      await instancia.listen(0, '127.0.0.1');
      servidores.push(instancia.getHttpServer());
    }
    process.env.DATABASE_URL = databaseUrl;
    ambiente.evolucaoUrlDepoisDoCreate = process.env.EVOLUTION_API_URL ?? '<indefinida>';

    preflight = {
      database: identidade.database,
      schema: identidade.schema,
      migrations: migrationsEsperadas,
      migrationsPendentes: migrationsEsperadas.filter((nome) => !migrationsAplicadas.some((linha) =>
        linha.migration_name === nome && linha.finished_at !== null && linha.rolled_back_at === null)),
      deadlocksIniciais,
      contagensIniciais,
      instancias: 1 + nomesInstancias.length,
      servidores: servidores.length,
    };

    // ---------------------------------------------------------------- CON-001
    await executarCenario({
      id: 'CON-001', operacao: 'POST /pedidos — 5 clientes disputando o último item', concorrencia: 5,
      estoqueInicial: { quantidadeFisica: 1, quantidadeReservada: 0 },
    }, async (cenario) => {
      const produtoId = await criarProduto('s1', 1, 0);
      const clientes = [] as string[];
      for (let i = 0; i < 5; i += 1) clientes.push(await criarCliente(`s1-c${i}`, produtoId, 1));
      const revisoes = [] as string[];
      for (let i = 0; i < 5; i += 1) revisoes.push(await capturarRevisao(clientes[i], i));

      const { respostas, sessoes } = await disputar({
        rotulo: 'CON-001 Produto',
        segurar: (tx) => tx.$queryRaw`SELECT 1 FROM "Produto" WHERE id = ${produtoId}::uuid FOR UPDATE`,
        nomes: nomesInstancias,
        quantidade: 5,
        predicado: (sessao) => sessao.query.includes('FROM "Produto"') &&
          sessao.query.includes('FOR UPDATE'),
        iniciar: async () => clientes.map((cliente, i) =>
          postarPedido(cliente, revisoes[i], randomUUID(), i)),
      });

      eq('waitersCount', sessoes.length, 5);
      eq('distinctPids', new Set(sessoes.map((s) => s.pid)).size, 5);
      eq('pendingBeforeRelease', cenario.pendingBeforeRelease, true);
      eq('todos aguardando Produto', sessoes.every((s) =>
        s.wait_event_type === 'Lock' && s.blockers.length > 0), true);
      cenario.responses = respostas.map((r) => ({ status: r.status, message: mensagem(r) }));
      eq('status', respostas.map((r) => r.status).sort(), [201, 409, 409, 409, 409]);
      eq('mensagens 409', respostas.filter((r) => r.status === 409).map((r) => mensagem(r)),
        Array(4).fill('Estoque indisponível.'));

      const db = await instantaneo(produtoId, clientes);
      cenario.db = sanitizar(db);
      eq('estoque final', db.estoque, { quantidadeFisica: 1, quantidadeReservada: 1, quantidadeDisponivel: 0 });
      eq('pedidos', db.pedidos.length, 1);
      eq('itens do pedido', db.pedidos[0]?.itens, [{ produtoId, quantidade: 1 }]);
      eq('reservas ATIVA', db.reservas.porEstado.ATIVA ?? 0, 1);
      eq('soma reservas ATIVA', db.reservas.somaAtiva, 1);
      eq('movimentações', db.movimentacoes.length, 0);
      eq('pagamentos', db.pagamentos.length, 0);

      marcarInvariante('I3', 'CON-001: 1 reserva por item e somas iguais', db.reservas.somaAtiva === 1);
      marcarInvariante('I4', 'CON-001: Σ reservas ATIVAS ≤ física', db.reservas.somaAtiva <= db.estoque.quantidadeFisica);
      marcarInvariante('I9', 'CON-001: rejeição sem rastro', db.pedidos.length === 1);
    });

    // ---------------------------------------------------------------- CON-002
    await executarCenario({
      id: 'CON-002', operacao: 'POST /pedidos — 5 clientes, estoque 3', concorrencia: 5,
      estoqueInicial: { quantidadeFisica: 3, quantidadeReservada: 0 },
    }, async (cenario) => {
      const produtoId = await criarProduto('s2', 3, 0);
      const clientes: string[] = [];
      for (let i = 0; i < 5; i += 1) clientes.push(await criarCliente(`s2-c${i}`, produtoId, 1));
      const revisoes: string[] = [];
      for (let i = 0; i < 5; i += 1) revisoes.push(await capturarRevisao(clientes[i], i));

      const { respostas, sessoes } = await disputar({
        rotulo: 'CON-002 Produto',
        segurar: (tx) => tx.$queryRaw`SELECT 1 FROM "Produto" WHERE id = ${produtoId}::uuid FOR UPDATE`,
        nomes: nomesInstancias,
        quantidade: 5,
        predicado: (sessao) => sessao.query.includes('FROM "Produto"') &&
          sessao.query.includes('FOR UPDATE'),
        iniciar: async () => clientes.map((cliente, i) =>
          postarPedido(cliente, revisoes[i], randomUUID(), i)),
      });

      eq('waitersCount', sessoes.length, 5);
      eq('distinctPids', new Set(sessoes.map((s) => s.pid)).size, 5);
      eq('pendingBeforeRelease', cenario.pendingBeforeRelease, true);
      cenario.responses = respostas.map((r) => ({ status: r.status, message: mensagem(r) }));
      const db = await instantaneo(produtoId, clientes);
      cenario.db = sanitizar(db);
      eq('status', respostas.map((r) => r.status).sort(), [201, 409, 409, 409, 409]);
      eq('mensagens 409', respostas.filter((r) => r.status === 409).map((r) => mensagem(r)),
        Array(4).fill('Revisão desatualizada. Atualize os valores.'));

      eq('estoque final', db.estoque, { quantidadeFisica: 3, quantidadeReservada: 1, quantidadeDisponivel: 2 });
      eq('pedidos', db.pedidos.length, 1);
      eq('itens do pedido', db.pedidos[0]?.itens, [{ produtoId, quantidade: 1 }]);
      eq('itens de pedido', db.pedidos.reduce((soma, pedido) => soma + pedido.itens.length, 0), 1);
      eq('reservas ATIVA', db.reservas.porEstado.ATIVA ?? 0, 1);
      eq('soma reservas ATIVA', db.reservas.somaAtiva, 1);
      eq('reservas totais (4 rejeições sem reserva)', db.reservas.total, 1);
      eq('movimentações', db.movimentacoes.length, 0);
      eq('pagamentos', db.pagamentos.length, 0);
      marcarInvariante('I4', 'CON-002: Σ reservas ATIVAS ≤ física (limite efetivo = revisão assinada)',
        db.reservas.somaAtiva <= db.estoque.quantidadeFisica);
      marcarInvariante('I9', 'CON-002: 4 rejeições por revisão desatualizada sem rastro',
        db.pedidos.length === 1 && db.reservas.total === 1 && db.movimentacoes.length === 0);
    });

    // ---------------------------------------------------------------- CON-003
    await executarCenario({
      id: 'CON-003', operacao: 'POST /pedidos — 3 clientes, 2 un. cada, estoque 3', concorrencia: 3,
      estoqueInicial: { quantidadeFisica: 3, quantidadeReservada: 0 },
    }, async (cenario) => {
      const produtoId = await criarProduto('s3', 3, 0);
      const clientes: string[] = [];
      for (let i = 0; i < 3; i += 1) clientes.push(await criarCliente(`s3-c${i}`, produtoId, 2));
      const revisoes: string[] = [];
      for (let i = 0; i < 3; i += 1) revisoes.push(await capturarRevisao(clientes[i], i));

      const { respostas, sessoes } = await disputar({
        rotulo: 'CON-003 Produto',
        segurar: (tx) => tx.$queryRaw`SELECT 1 FROM "Produto" WHERE id = ${produtoId}::uuid FOR UPDATE`,
        nomes: nomesInstancias.slice(0, 3),
        quantidade: 3,
        predicado: (sessao) => sessao.query.includes('FROM "Produto"') &&
          sessao.query.includes('FOR UPDATE'),
        iniciar: async () => clientes.map((cliente, i) =>
          postarPedido(cliente, revisoes[i], randomUUID(), i)),
      });

      eq('waitersCount', sessoes.length, 3);
      eq('distinctPids', new Set(sessoes.map((s) => s.pid)).size, 3);
      eq('pendingBeforeRelease', cenario.pendingBeforeRelease, true);
      cenario.responses = respostas.map((r) => ({ status: r.status, message: mensagem(r) }));
      eq('status', respostas.map((r) => r.status).sort(), [201, 409, 409]);
      eq('mensagens 409', respostas.filter((r) => r.status === 409).map((r) => mensagem(r)),
        Array(2).fill('Estoque indisponível.'));

      const db = await instantaneo(produtoId, clientes);
      cenario.db = sanitizar(db);
      eq('estoque final', db.estoque, { quantidadeFisica: 3, quantidadeReservada: 2, quantidadeDisponivel: 1 });
      eq('pedidos', db.pedidos.length, 1);
      eq('itens do pedido', db.pedidos[0]?.itens, [{ produtoId, quantidade: 2 }]);
      eq('reservas ATIVA', db.reservas.porEstado.ATIVA ?? 0, 1);
      eq('soma reservas ATIVA', db.reservas.somaAtiva, 2);
      eq('movimentações', db.movimentacoes.length, 0);
      marcarInvariante('I3', 'CON-003: item qty 2 ↔ reserva qty 2', db.reservas.somaAtiva === 2);
      marcarInvariante('I4', 'CON-003: Σ reservas ATIVAS ≤ física', db.reservas.somaAtiva <= db.estoque.quantidadeFisica);
      marcarInvariante('I9', 'CON-003: rejeição sem rastro', db.pedidos.length === 1);
    });

    // ---------------------------------------------------------------- CON-004
    await executarCenario({
      id: 'CON-004', operacao: 'PATCH estoque (→1) e depois POST /pedidos com revisão antiga (sequencial sob lock)',
      concorrencia: 1, estoqueInicial: { quantidadeFisica: 2, quantidadeReservada: 0 },
    }, async (cenario) => {
      const produtoId = await criarProduto('s4', 2, 0);
      const cliente = await criarCliente('s4-c0', produtoId, 2);
      const revisaoId = await capturarRevisao(cliente, 0);

      const ajuste = await ajustarEstoque(produtoId, 1, 0);
      eq('ajuste status', ajuste.status, 200);
      const pedido = await postarPedido(cliente, revisaoId, randomUUID(), 0);
      cenario.responses = [
        { status: ajuste.status, message: mensagem(ajuste) },
        { status: pedido.status, message: mensagem(pedido) },
      ];
      eq('pedido status', pedido.status, 409);
      eq('pedido mensagem', mensagem(pedido), 'Estoque indisponível.');

      const db = await instantaneo(produtoId, [cliente]);
      cenario.db = sanitizar(db);
      eq('estoque final', db.estoque, { quantidadeFisica: 1, quantidadeReservada: 0, quantidadeDisponivel: 1 });
      eq('pedidos', db.pedidos.length, 0);
      eq('reservas', db.reservas.total, 0);
      eq('movimentações', db.movimentacoes.map((m) => [m.motivoOrigem, m.quantidade]),
        [['AJUSTE_ADMINISTRATIVO', -1]]);
      marcarInvariante('I5', 'CON-004: AJUSTE_ADMINISTRATIVO = Δ física', db.movimentacoes.length === 1 &&
        db.movimentacoes[0].quantidade === -1);
      marcarInvariante('I9', 'CON-004: rejeição sem rastro', db.pedidos.length === 0 && db.reservas.total === 0);
    });

    // ---------------------------------------------------------------- CON-005
    await executarCenario({
      id: 'CON-005', operacao: 'PATCH /admin/produtos/:id/estoque — 3 ajustes simultâneos (4, 7, 9)',
      concorrencia: 3, estoqueInicial: { quantidadeFisica: 10, quantidadeReservada: 0 },
    }, async (cenario) => {
      const produtoId = await criarProduto('s5', 10, 0);
      const cliente = await criarCliente('s5-c0', produtoId, 2);
      const revisaoId = await capturarRevisao(cliente, 0);
      const pedido = await postarPedido(cliente, revisaoId, randomUUID(), 0);
      eq('pedido inicial', pedido.status, 201);
      eq('reservado após pedido', (await prisma.estoque.findUniqueOrThrow({ where: { produtoId } })).quantidadeReservada, 2);

      const { respostas, sessoes } = await disputar({
        rotulo: 'CON-005 Estoque',
        segurar: (tx) => tx.$queryRaw`SELECT "produtoId" FROM "Estoque" WHERE "produtoId" = ${produtoId}::uuid FOR UPDATE`,
        nomes: nomesInstancias.slice(0, 3),
        quantidade: 3,
        // D106: o ajuste agora adquire Produto antes de Estoque; os concorrentes
        // podem estar bloqueados em qualquer uma das duas linhas.
        predicado: (sessao) => (sessao.query.includes('FROM "Estoque"') ||
          sessao.query.includes('FROM "Produto"')) && sessao.query.includes('FOR UPDATE'),
        iniciar: async () => [4, 7, 9].map((valor, i) => ajustarEstoque(produtoId, valor, i)),
      });

      eq('waitersCount', sessoes.length, 3);
      eq('distinctPids', new Set(sessoes.map((s) => s.pid)).size, 3);
      eq('pendingBeforeRelease', cenario.pendingBeforeRelease, true);
      cenario.responses = respostas.map((r) => ({ status: r.status, message: mensagem(r) }));
      eq('status', respostas.map((r) => r.status), [200, 200, 200]);

      const db = await instantaneo(produtoId, [cliente]);
      cenario.db = sanitizar(db);
      eq('reservada preservada', db.estoque.quantidadeReservada, 2);
      eq('disponível ∈ {4,7,9}', [4, 7, 9].includes(db.estoque.quantidadeDisponivel), true);
      eq('física = disponível + 2', db.estoque.quantidadeFisica, db.estoque.quantidadeDisponivel + 2);
      eq('reserva ATIVA intacta', db.reservas.porEstado.ATIVA ?? 0, 1);
      eq('reserva ATIVA qty', db.reservas.somaAtiva, 2);
      const somaAjustes = db.movimentacoes
        .filter((m) => m.motivoOrigem === 'AJUSTE_ADMINISTRATIVO')
        .reduce((soma, m) => soma + m.quantidade, 0);
      eq('3 ajustes registrados', db.movimentacoes.filter((m) => m.motivoOrigem === 'AJUSTE_ADMINISTRATIVO').length, 3);
      eq('Σ ajustes = Δ física', somaAjustes, db.estoque.quantidadeFisica - 10);
      eq('disponível ≥ 0', db.estoque.quantidadeDisponivel >= 0, true);
      marcarInvariante('I5', 'CON-005: Σ AJUSTE_ADMINISTRATIVO = Δ física', somaAjustes === db.estoque.quantidadeFisica - 10);
      marcarInvariante('I2', 'CON-005: reservada = Σ ATIVA', db.estoque.quantidadeReservada === db.reservas.somaAtiva);
    });

    // ---------------------------------------------------------------- CON-006 (ramos forçados 6A / 6B)
    const executarRamoCon006 = async (ramo: '6A' | '6B') => {
      const pedidoPrimeiro = ramo === '6A';
      const sufixo = pedidoPrimeiro ? 's6a' : 's6b';
      await executarCenario({
        id: `CON-006/${ramo}`,
        cenario: 'CON-006',
        ramo,
        operacao: pedidoPrimeiro
          ? 'POST /pedidos (qty 1) enfileirado primeiro no lock Estoque × PATCH estoque (→5) — ramo 6A'
          : 'PATCH estoque (→5) enfileirado primeiro no lock Estoque × POST /pedidos (qty 1) — ramo 6B',
        concorrencia: 2,
        estoqueInicial: { quantidadeFisica: 1, quantidadeReservada: 0 },
      }, async (cenario) => {
        const produtoId = await criarProduto(sufixo, 1, 0);
        const cliente = await criarCliente(`${sufixo}-c0`, produtoId, 1);
        const revisaoId = await capturarRevisao(cliente, 0);
        const nomes = nomesInstancias.slice(0, 2);

        const { pid, liberar, blocker } = await abrirBloqueio(
          (tx) => tx.$queryRaw`SELECT "produtoId" FROM "Estoque" WHERE "produtoId" = ${produtoId}::uuid FOR UPDATE`,
          `CON-006/${ramo} Estoque`,
        );
        const promessas: Array<Promise<Response>> = [];
        try {
          // O primeiro request entra e é confirmado bloqueado antes de o segundo entrar na fila.
          promessas.push(pedidoPrimeiro
            ? postarPedido(cliente, revisaoId, randomUUID(), 0)
            : ajustarEstoque(produtoId, 5, 0));
          await aguardarWaiters(nomes, 1, (sessao) => sessao.query.includes('FROM "Estoque"') &&
            sessao.query.includes('FOR UPDATE') && sessao.blockers.includes(pid));
          promessas.push(pedidoPrimeiro
            ? ajustarEstoque(produtoId, 5, 1)
            : postarPedido(cliente, revisaoId, randomUUID(), 1));
          const sessoes = await aguardarWaiters(nomes, 2, (sessao) =>
            (sessao.query.includes('FROM "Estoque"') || sessao.query.includes('FROM "Produto"')) &&
            sessao.query.includes('FOR UPDATE'));
          const pidsConcorrentes = new Set(sessoes.map((sessao) => sessao.pid));
          const diretos = sessoes.filter((sessao) => sessao.blockers.includes(pid)).length;
          const ancorados = sessoes.filter((sessao) => sessao.blockers.includes(pid) ||
            sessao.blockers.some((bloqueador) => pidsConcorrentes.has(bloqueador))).length;
          cenario.blocker = {
            pid, state: await estadoDoPid(pid),
            locks: sanitizar(await locksDoBlocker(pid)) as unknown[],
          };
          cenario.waiters = sessoes;
          cenario.waitersCount = sessoes.length;
          cenario.distinctPids = new Set(sessoes.map((sessao) => sessao.pid)).size;
          cenario.pendingBeforeRelease = promessas.every((promessa) => pending.has(promessa));
          (cenario as Cenario & { bloqueadosDiretamente?: number }).bloqueadosDiretamente = diretos;
          eq(`${ramo}: cadeia ancorada no blocker`, ancorados, sessoes.length);
          eq(`${ramo}: ao menos um waiter bloqueado diretamente pelo blocker`, diretos >= 1, true);
          eq(`${ramo}: 2 waiters pendentes antes do release`, cenario.pendingBeforeRelease, true);
        } finally {
          liberar();
          await Promise.allSettled([blocker, ...promessas]);
        }
        const respostas = await bounded(Promise.all(promessas), `CON-006/${ramo}`);
        const pedidoResposta = pedidoPrimeiro ? respostas[0] : respostas[1];
        const ajusteResposta = pedidoPrimeiro ? respostas[1] : respostas[0];
        cenario.responses = respostas.map((r) => ({ status: r.status, message: mensagem(r) }));
        eq(`${ramo}: ajuste status`, ajusteResposta.status, 200);

        const db = await instantaneo(produtoId, [cliente]);
        cenario.db = sanitizar(db);
        const ajustes = db.movimentacoes.filter((m) => m.motivoOrigem === 'AJUSTE_ADMINISTRATIVO');
        eq(`${ramo}: 1 AJUSTE_ADMINISTRATIVO`, ajustes.length, 1);
        eq(`${ramo}: sem VENDA_PEDIDO`,
          db.movimentacoes.some((m) => m.motivoOrigem === 'VENDA_PEDIDO'), false);
        // I5 — mesma fórmula de CON-005, parametrizada pela física inicial 1 (vale nos dois ramos).
        const deltaFisica = db.estoque.quantidadeFisica - 1;
        const somaMovimentos = db.movimentacoes.reduce((soma, movimento) => soma + movimento.quantidade, 0);
        eq(`${ramo}: Σ movimentos do produto = Δ física`, somaMovimentos, deltaFisica);
        eq(`${ramo}: quantidade do AJUSTE_ADMINISTRATIVO = Δ física`, ajustes[0]?.quantidade, deltaFisica);
        marcarInvariante('I5', `CON-006/${ramo}: Σ AJUSTE_ADMINISTRATIVO = Δ física`,
          ajustes.length === 1 && somaMovimentos === deltaFisica && ajustes[0]?.quantidade === deltaFisica);
        eq(`${ramo}: disponível ≥ 0`, db.estoque.quantidadeDisponivel >= 0, true);

        if (pedidoPrimeiro) {
          eq(`${ramo}: pedido status`, pedidoResposta.status, 201);
          eq(`${ramo}: Δ física = 5`, deltaFisica, 5);
          eq(`${ramo}: estoque final`, db.estoque,
            { quantidadeFisica: 6, quantidadeReservada: 1, quantidadeDisponivel: 5 });
          eq(`${ramo}: pedidos`, db.pedidos.length, 1);
          eq(`${ramo}: reserva ATIVA`, db.reservas.porEstado.ATIVA ?? 0, 1);
          eq(`${ramo}: soma ATIVA`, db.reservas.somaAtiva, 1);
          eq(`${ramo}: AJUSTE +5`, ajustes[0]?.quantidade, 5);
          marcarInvariante('I1', 'CON-006/6A: 0 ≤ reservada ≤ física',
            db.estoque.quantidadeReservada >= 0 && db.estoque.quantidadeReservada <= db.estoque.quantidadeFisica);
          // I9 é N/A no ramo 6A (não há rejeição) — PLAN §6.
        } else {
          eq(`${ramo}: pedido status`, pedidoResposta.status, 409);
          eq(`${ramo}: mensagem do 409`, mensagem(pedidoResposta),
            'Revisão desatualizada. Atualize os valores.');
          eq(`${ramo}: Δ física = 4`, deltaFisica, 4);
          eq(`${ramo}: estoque final`, db.estoque,
            { quantidadeFisica: 5, quantidadeReservada: 0, quantidadeDisponivel: 5 });
          eq(`${ramo}: pedidos`, db.pedidos.length, 0);
          eq(`${ramo}: itens de pedido`, db.pedidos.reduce((soma, pedido) => soma + pedido.itens.length, 0), 0);
          eq(`${ramo}: reservas`, db.reservas.total, 0);
          eq(`${ramo}: históricos do cliente`, db.historicos.length, 0);
          eq(`${ramo}: AJUSTE +4`, ajustes[0]?.quantidade, 4);
          marcarInvariante('I1', 'CON-006/6B: 0 ≤ reservada ≤ física',
            db.estoque.quantidadeReservada >= 0 && db.estoque.quantidadeReservada <= db.estoque.quantidadeFisica);
          const movimentosDePedido = db.movimentacoes.filter((movimento) =>
            movimento.pedidoId !== null || movimento.motivoOrigem === 'VENDA_PEDIDO');
          marcarInvariante('I9', 'CON-006/6B: 409 sem rastro de pedido (AJUSTE do cenário é esperado)',
            db.pedidos.length === 0 && db.reservas.total === 0 &&
            db.pedidos.reduce((soma, pedido) => soma + pedido.itens.length, 0) === 0 &&
            db.historicos.length === 0 && movimentosDePedido.length === 0);
        }
      });
    };
    await executarRamoCon006('6A');
    await executarRamoCon006('6B');

    // ---------------------------------------------------------------- CON-007
    await executarCenario({
      id: 'CON-007', operacao: 'POST /pedidos com o mesmo tentativaId — 2 requisições do mesmo cliente',
      concorrencia: 2, estoqueInicial: { quantidadeFisica: 5, quantidadeReservada: 0 },
    }, async (cenario) => {
      const produtoId = await criarProduto('s7', 5, 0);
      const cliente = await criarCliente('s7-c0', produtoId, 2);
      const revisaoId = await capturarRevisao(cliente, 0);
      const tentativaId = randomUUID();
      const nomes = nomesInstancias.slice(0, 2);

      const { pid, liberar, blocker } = await abrirBloqueio(
        (tx) => tx.$queryRaw`SELECT id FROM "Carrinho" WHERE "usuarioId" = ${cliente}::uuid FOR UPDATE`,
        'CON-007 Carrinho',
      );
      const promessas: Array<Promise<Response>> = [];
      let sessoes: Sessao[] = [];
      try {
        promessas.push(postarPedido(cliente, revisaoId, tentativaId, 0));
        const primeira = await aguardarWaiters(nomes, 1, (sessao) =>
          sessao.query.includes('FROM "Carrinho"') && sessao.blockers.includes(pid));
        promessas.push(postarPedido(cliente, revisaoId, tentativaId, 1));
        const todas = await aguardarWaiters(nomes, 2, (sessao) =>
          ((sessao.query.includes('FROM "Carrinho"') && sessao.blockers.includes(pid)) ||
            sessao.wait_event === 'advisory'));
        sessoes = todas;
        cenario.blocker = { pid, state: await estadoDoPid(pid), locks: sanitizar(await locksDoBlocker(pid)) as unknown[] };
        cenario.waiters = sessoes;
        cenario.waitersCount = sessoes.length;
        cenario.distinctPids = new Set(sessoes.map((s) => s.pid)).size;
        cenario.pendingBeforeRelease = promessas.every((p) => pending.has(p));
        eq('waiters no carrinho', primeira.filter((s) => s.query.includes('FROM "Carrinho"')).length, 1);
        const waiterCarrinho = sessoes.find((s) => s.query.includes('FROM "Carrinho"'));
        const waiterAdvisory = sessoes.find((s) => s.wait_event === 'advisory');
        eq('waiter no advisory', sessoes.filter((s) => s.wait_event === 'advisory').length, 1);
        assert.ok(waiterCarrinho);
        assert.ok(waiterAdvisory);
        // Mesmo critério de ancoramento de disputar(): blocker direto ou predecessor imediato.
        const pidsConcorrentes = new Set(sessoes.map((s) => s.pid));
        const ancorados = sessoes.filter((sessao) => sessao.blockers.includes(pid) ||
          sessao.blockers.some((bloqueador) => pidsConcorrentes.has(bloqueador))).length;
        const diretos = sessoes.filter((sessao) => sessao.blockers.includes(pid)).length;
        (cenario as Cenario & { bloqueadosDiretamente?: number }).bloqueadosDiretamente = diretos;
        eq('cadeia ancorada no blocker', ancorados, sessoes.length);
        eq('ao menos um waiter bloqueado diretamente pelo blocker', diretos >= 1, true);
        eq('advisory ancorado no blocker ou no predecessor imediato',
          waiterAdvisory.blockers.includes(pid) ||
          (waiterCarrinho !== undefined && waiterAdvisory.blockers.includes(waiterCarrinho.pid)), true);
      } finally {
        liberar();
        await Promise.allSettled([blocker, ...promessas]);
      }
      const respostas = await bounded(Promise.all(promessas), 'CON-007');
      cenario.responses = respostas.map((r) => ({ status: r.status, message: mensagem(r) }));
      eq('status', respostas.map((r) => r.status), [201, 201]);
      const ids = respostas.map((r) => (r.body as { id?: string }).id);
      eq('mesmo pedido', ids[0], ids[1]);

      const db = await instantaneo(produtoId, [cliente]);
      cenario.db = sanitizar(db);
      eq('pedido único', db.pedidos.length, 1);
      eq('estoque final', db.estoque, { quantidadeFisica: 5, quantidadeReservada: 2, quantidadeDisponivel: 3 });
      eq('1 reserva ATIVA', db.reservas.porEstado.ATIVA ?? 0, 1);
      eq('soma ATIVA = qty', db.reservas.somaAtiva, 2);
      eq('itens', db.pedidos[0]?.itens, [{ produtoId, quantidade: 2 }]);
      marcarInvariante('I6', 'CON-007: 1 pedido para o mesmo tentativaId', db.pedidos.length === 1);
      marcarInvariante('I3', 'CON-007: sem reserva duplicada', db.reservas.total === 1 && db.reservas.somaAtiva === 2);
      marcarInvariante('I2', 'CON-007: reservada = Σ ATIVA', db.estoque.quantidadeReservada === db.reservas.somaAtiva);
    });

    // ---------------------------------------------------------------- CON-008
    await executarCenario({
      id: 'CON-008', operacao: 'POST /pedidos/:id/pagamentos/pix com o mesmo tentativaId — 2 requisições',
      concorrencia: 2, estoqueInicial: { quantidadeFisica: 4, quantidadeReservada: 0 },
    }, async (cenario) => {
      const produtoId = await criarProduto('s8', 4, 0);
      const cliente = await criarCliente('s8-c0', produtoId, 2);
      const revisaoId = await capturarRevisao(cliente, 0);
      const pedido = await postarPedido(cliente, revisaoId, randomUUID(), 0);
      eq('pedido criado', pedido.status, 201);
      const pedidoId = (pedido.body as { id: string }).id;
      const base = randomUUID();
      const tentativaId = Number.parseInt(base.slice(-1), 16) % 2 === 0 ? base : `${base.slice(0, -1)}0`;
      const nomes = nomesInstancias.slice(0, 2);

      const { respostas, sessoes } = await disputar({
        rotulo: 'CON-008 Pedido',
        segurar: (tx) => tx.$queryRaw`SELECT 1 FROM "Pedido" WHERE id = ${pedidoId}::uuid FOR UPDATE`,
        nomes,
        quantidade: 2,
        predicado: (sessao) => sessao.query.includes('FROM "Pedido"') &&
          sessao.query.includes('FOR UPDATE'),
        iniciar: async () => [0, 1].map((i) => track(Promise.resolve(
          request(servidor(i) as never).post(`/pedidos/${pedidoId}/pagamentos/pix`)
            .set('Authorization', token(cliente))
            .send({ tentativaId }),
        ))),
      });

      eq('waitersCount', sessoes.length, 2);
      eq('distinctPids', new Set(sessoes.map((s) => s.pid)).size, 2);
      eq('pendingBeforeRelease', cenario.pendingBeforeRelease, true);
      cenario.responses = respostas.map((r) => ({ status: r.status, message: mensagem(r) }));
      eq('status', respostas.map((r) => r.status).sort(), [200, 201]);
      eq('ambos aprovados', respostas.map((r) => (r.body as { resultado?: string }).resultado),
        ['APROVADO', 'APROVADO']);
      eq('mesma tentativa', new Set(respostas.map((r) => (r.body as { tentativaId?: string }).tentativaId)).size, 1);

      const db = await instantaneo(produtoId, [cliente]);
      cenario.db = sanitizar(db);
      eq('pagamento único APROVADO', db.pagamentos.length, 1);
      eq('pagamento resultado', db.pagamentos[0]?.resultado, 'APROVADO');
      eq('estoque final', db.estoque, { quantidadeFisica: 2, quantidadeReservada: 0, quantidadeDisponivel: 2 });
      eq('reserva convertida', db.reservas.porEstado.CONVERTIDA_EM_VENDA ?? 0, 1);
      eq('sem reserva ATIVA', db.reservas.porEstado.ATIVA ?? 0, 0);
      eq('movimento de venda', db.movimentacoes.map((m) => [m.motivoOrigem, m.quantidade]),
        [['VENDA_PEDIDO', -2]]);
      eq('histórico PAGO', db.historicos.filter((s) => s === 'PAGO').length, 1);
      marcarInvariante('I6', 'CON-008: 1 pagamento para o mesmo tentativaId', db.pagamentos.length === 1);
      marcarInvariante('I5', 'CON-008: VENDA_PEDIDO = −qty', db.movimentacoes.length === 1 &&
        db.movimentacoes[0].quantidade === -2);
    });

    // ---------------------------------------------------------------- CON-009
    await executarCenario({
      id: 'CON-009', operacao: 'PATCH /pedidos/:id/cancelar no mesmo pedido pago — 2 requisições',
      concorrencia: 2, estoqueInicial: { quantidadeFisica: 10, quantidadeReservada: 0 },
    }, async (cenario) => {
      const produtoId = await criarProduto('s9', 10, 0);
      const cliente = await criarCliente('s9-c0', produtoId, 2);
      const revisaoId = await capturarRevisao(cliente, 0);
      const pedido = await postarPedido(cliente, revisaoId, randomUUID(), 0);
      eq('pedido criado', pedido.status, 201);
      const pedidoId = (pedido.body as { id: string }).id;

      const base = randomUUID();
      const tentativaId = Number.parseInt(base.slice(-1), 16) % 2 === 0 ? base : `${base.slice(0, -1)}0`;
      const pagamento = await request(servidor(0) as never).post(`/pedidos/${pedidoId}/pagamentos/pix`)
        .set('Authorization', token(cliente)).send({ tentativaId });
      eq('pagamento aprovado', pagamento.status, 201);
      eq('resultado', (pagamento.body as { resultado?: string }).resultado, 'APROVADO');
      const aposPagamento = await prisma.estoque.findUniqueOrThrow({ where: { produtoId } });
      eq('estoque após pagamento', [aposPagamento.quantidadeFisica, aposPagamento.quantidadeReservada], [8, 0]);

      const nomes = nomesInstancias.slice(0, 2);
      const { respostas, sessoes } = await disputar({
        rotulo: 'CON-009 Pedido',
        segurar: (tx) => tx.$queryRaw`SELECT 1 FROM "Pedido" WHERE id = ${pedidoId}::uuid FOR UPDATE`,
        nomes,
        quantidade: 2,
        predicado: (sessao) => sessao.query.includes('FROM "Pedido"') &&
          sessao.query.includes('FOR UPDATE'),
        iniciar: async () => [0, 1].map((i) => track(Promise.resolve(
          request(servidor(i) as never).patch(`/pedidos/${pedidoId}/cancelar`)
            .set('Authorization', token(cliente)),
        ))),
      });

      eq('waitersCount', sessoes.length, 2);
      eq('distinctPids', new Set(sessoes.map((s) => s.pid)).size, 2);
      eq('pendingBeforeRelease', cenario.pendingBeforeRelease, true);
      cenario.responses = respostas.map((r) => ({ status: r.status, message: mensagem(r) }));
      eq('status', respostas.map((r) => r.status).sort(), [200, 409]);
      eq('mensagem do 409', respostas.filter((r) => r.status === 409).map((r) => mensagem(r)),
        ['Pedido não pode ser cancelado neste status.']);

      const db = await instantaneo(produtoId, [cliente]);
      cenario.db = sanitizar(db);
      eq('estoque devolvido 1×', db.estoque, { quantidadeFisica: 10, quantidadeReservada: 0, quantidadeDisponivel: 10 });
      eq('pedido cancelado', db.pedidos[0]?.statusAtual, 'CANCELADO');
      eq('reserva devolvida', db.reservas.porEstado.DEVOLVIDA_POR_CANCELAMENTO ?? 0, 1);
      eq('movimentos', db.movimentacoes.map((m) => [m.motivoOrigem, m.quantidade]).sort(),
        [['CANCELAMENTO_PEDIDO', 2], ['VENDA_PEDIDO', -2]].sort());
      eq('histórico CANCELADO', db.historicos.filter((s) => s === 'CANCELADO').length, 1);
      marcarInvariante('I5', 'CON-009: devolução exatamente 1×', db.movimentacoes.filter((m) =>
        m.motivoOrigem === 'CANCELAMENTO_PEDIDO').length === 1);
    });

    // ---------------------------------------------------------------- CON-010
    // R-01: exclusão de produto (caminho antigo Estoque→Produto) × ajuste
    // (Produto→Estoque). O ajuste é enfileirado primeiro e ambos disputam a linha de
    // Produto; com a ordem global (Produto antes de Estoque) não há ciclo.
    // Com o fix de F-04 revertido o ajuste passa a partir de Estoque, o que muda a
    // premissa do cenário; nesse estado ele é registrado como INCONCLUSIVO.
    if (condicao.includes('f04-revertido')) {
      origemAtual = 'CON-010';
      const cenario = abrirCenario({
        id: 'CON-010',
        operacao: 'PATCH /admin/produtos/:id/estoque (→1) × DELETE /admin/produtos/:id — estoque 0',
        concorrencia: 0,
        estoqueInicial: null,
      });
      cenario.veredito = 'INCONCLUSIVO';
      cenario.erro = 'Não executado: o fix de F-04 está revertido, então o ajuste parte de Estoque e a '
        + 'premissa de ordem global (Produto antes de Estoque) não vale. Prova de R-01: '
        + 'D106-exec-concorrencia-con010-antes.json × execuções com os fixes aplicados.';
      cenario.deadlocksAfter = await lerDeadlocks();
      deadlocksFinais = cenario.deadlocksAfter;
    } else {
    await executarCenario({
      id: 'CON-010',
      operacao: 'PATCH /admin/produtos/:id/estoque (→1) × DELETE /admin/produtos/:id — estoque 0',
      concorrencia: 2,
      estoqueInicial: { quantidadeFisica: 0, quantidadeReservada: 0 },
    }, async (cenario) => {
      const produtoId = await criarProduto('s10', 0, 0);
      const nomes = nomesInstancias.slice(0, 2);
      const { pid, liberar, blocker } = await abrirBloqueio(
        (tx) => tx.$queryRaw`SELECT id FROM "Produto" WHERE id = ${produtoId}::uuid FOR UPDATE`,
        'CON-010 Produto',
      );
      const promessas: Array<Promise<Response>> = [];
      try {
        promessas.push(ajustarEstoque(produtoId, 1, 0));
        await aguardarWaiters(nomes, 1, (sessao) =>
          sessao.query.includes('FROM "Produto"') && sessao.query.includes('FOR UPDATE') &&
          sessao.blockers.includes(pid));
        promessas.push(deletarProduto(produtoId, 1));
        const sessoes = await aguardarWaiters(nomes, 2, (sessao) => {
          const sql = sessao.query.toUpperCase();
          return sql.includes('"PRODUTO"') || sql.includes('FROM "ESTOQUE"');
        });
        const pidsConcorrentes = new Set(sessoes.map((sessao) => sessao.pid));
        const diretos = sessoes.filter((sessao) => sessao.blockers.includes(pid)).length;
        const ancorados = sessoes.filter((sessao) => sessao.blockers.includes(pid) ||
          sessao.blockers.some((bloqueador) => pidsConcorrentes.has(bloqueador))).length;
        cenario.blocker = {
          pid, state: await estadoDoPid(pid),
          locks: sanitizar(await locksDoBlocker(pid)) as unknown[],
        };
        cenario.waiters = sessoes;
        cenario.waitersCount = sessoes.length;
        cenario.distinctPids = new Set(sessoes.map((sessao) => sessao.pid)).size;
        cenario.pendingBeforeRelease = promessas.every((promessa) => pending.has(promessa));
        eq('CON-010: cadeia ancorada no blocker', ancorados, sessoes.length);
        eq('CON-010: ao menos um waiter bloqueado diretamente', diretos >= 1, true);
        eq('CON-010: 2 waiters pendentes antes do release', cenario.pendingBeforeRelease, true);
      } finally {
        liberar();
        await Promise.allSettled([blocker, ...promessas]);
      }
      const respostas = await bounded(Promise.all(promessas), 'CON-010');
      const ajusteResposta = respostas[0];
      const exclusaoResposta = respostas[1];
      const produtoExiste = (await prisma.produto.count({ where: { id: produtoId } })) === 1;
      const estoque = await prisma.estoque.findUnique({ where: { produtoId } });
      const movimentos = await prisma.movimentacaoEstoque.findMany({
        where: { produtoId }, select: { motivoOrigem: true, quantidade: true },
      });
      cenario.responses = respostas.map((r) => ({ status: r.status, message: mensagem(r) }));
      cenario.db = sanitizar({ produtoExiste, estoque, movimentos });
      eq('CON-010: PIDs distintos', cenario.distinctPids, 2);
      eq('CON-010: ajuste 200', ajusteResposta.status, 200);
      eq('CON-010: exclusão 409', exclusaoResposta.status, 409);
      eq('CON-010: mensagem da exclusão', mensagem(exclusaoResposta),
        'Estoque impede exclusão do produto.');
      eq('CON-010: produto preservado', produtoExiste, true);
      eq('CON-010: estoque final', estoque && {
        quantidadeFisica: estoque.quantidadeFisica,
        quantidadeReservada: estoque.quantidadeReservada,
      }, { quantidadeFisica: 1, quantidadeReservada: 0 });
      marcarInvariante('I1', 'CON-010: 0 ≤ reservada ≤ física',
        Boolean(estoque) && estoque!.quantidadeReservada >= 0 &&
        estoque!.quantidadeReservada <= estoque!.quantidadeFisica);
      marcarInvariante('I5', 'CON-010: AJUSTE_ADMINISTRATIVO = Δ física',
        movimentos.filter((m) => m.motivoOrigem === 'AJUSTE_ADMINISTRATIVO')
          .reduce((soma, m) => soma + m.quantidade, 0) === 1);
    });
    }

    // ---------------------------------------------------------------- CTRL-001
    await executarCenario({
      id: 'CTRL-001', operacao: 'mesmos 5 compradores de CON-001 executados em série (controle negativo)',
      concorrencia: 5, estoqueInicial: { quantidadeFisica: 1, quantidadeReservada: 0 },
    }, async (cenario) => {
      const produtoId = await criarProduto('c1', 1, 0);
      const clientes: string[] = [];
      for (let i = 0; i < 5; i += 1) clientes.push(await criarCliente(`c1-c${i}`, produtoId, 1));
      const revisoes: string[] = [];
      for (let i = 0; i < 5; i += 1) revisoes.push(await capturarRevisao(clientes[i], i));

      let maxWaiters = 0;
      let amostrando = true;
      const amostrador = (async () => {
        while (amostrando) {
          const [linha] = await prisma.$queryRaw<Array<{ n: bigint }>>`
            SELECT count(*) AS n FROM pg_stat_activity
            WHERE datname = current_database() AND application_name IN (${Prisma.join(nomesInstancias)})
              AND state = 'active' AND wait_event_type = 'Lock'`;
          const atual = Number(linha.n);
          if (atual > maxWaiters) maxWaiters = atual;
          await new Promise((concluir) => setTimeout(concluir, 20));
        }
      })().catch(() => undefined);

      const respostas: Response[] = [];
      try {
        for (let i = 0; i < 5; i += 1) {
          respostas.push(await postarPedido(clientes[i], revisoes[i], randomUUID(), i));
        }
      } finally {
        amostrando = false;
        await amostrador;
      }

      cenario.responses = respostas.map((r) => ({ status: r.status, message: mensagem(r) }));
      eq('status', respostas.map((r) => r.status).sort(), [201, 409, 409, 409, 409]);
      const db = await instantaneo(produtoId, clientes);
      cenario.db = sanitizar({ ...db, maxSimultaneousWaiters: maxWaiters });
      eq('estado final idêntico a CON-001', db.estoque,
        { quantidadeFisica: 1, quantidadeReservada: 1, quantidadeDisponivel: 0 });
      eq('pedidos', db.pedidos.length, 1);
      eq('maxSimultaneousWaiters', maxWaiters, 0);
      eq('sem blocker', cenario.blocker, null);
      marcarInvariante('I8', 'CTRL-001: estado final igual sem concorrência real', db.pedidos.length === 1 &&
        db.estoque.quantidadeReservada === 1);
    });

    // ---------------------------------------------------------------- invariantes globais
    origemAtual = 'invariantes';
    const todosProdutos = await prisma.estoque.findMany({
      where: { produtoId: { in: produtos } },
      select: { produtoId: true, quantidadeFisica: true, quantidadeReservada: true },
    });
    for (const linha of todosProdutos) {
      marcarInvariante('I1', `I1 ${linha.produtoId}`,
        linha.quantidadeReservada >= 0 && linha.quantidadeReservada <= linha.quantidadeFisica);
      const ativas = await prisma.reservaEstoque.findMany({
        where: { produtoId: linha.produtoId, estado: 'ATIVA' }, select: { quantidade: true },
      });
      marcarInvariante('I2', `I2 ${linha.produtoId}`,
        linha.quantidadeReservada === ativas.reduce((soma, reserva) => soma + reserva.quantidade, 0));
    }

    const deadlocksDepois = await lerDeadlocks();
    deadlocksFinais = deadlocksDepois;
    marcarInvariante('I7', 'deadlocks inalterados', deadlocksDepois === deadlocksIniciais);

    const cenariosComReserva = ['CON-001', 'CON-002', 'CON-003', 'CON-007'];
    for (const id of cenariosComReserva) {
      const cenario = cenarios.find((item) => item.id === id);
      const db = cenario?.db as { pedidos?: Array<{ itens: Array<{ quantidade: number }> }>; reservas?: { somaAtiva: number; total: number } } | null;
      if (!db?.pedidos || !db.reservas) { marcarInvariante('I3', `I3 ${id}`, false); continue; }
      const somaItens = db.pedidos.reduce((soma, pedido) =>
        soma + pedido.itens.reduce((parcial, item) => parcial + item.quantidade, 0), 0);
      marcarInvariante('I3', `I3 ${id}`, somaItens === db.reservas.somaAtiva && db.reservas.total === db.pedidos.length);
    }

    const db008 = cenarios.find((c) => c.id === 'CON-008')?.db as { pagamentos?: unknown[]; movimentacoes?: Array<{ quantidade: number }> } | null;
    marcarInvariante('I6', 'I6 CON-008: 1 pagamento e 1 movimento', (db008?.pagamentos?.length ?? 0) === 1 &&
      (db008?.movimentacoes?.length ?? 0) === 1);

    const db009 = cenarios.find((c) => c.id === 'CON-009')?.db as { movimentacoes?: Array<{ motivoOrigem: string }> } | null;
    marcarInvariante('I8', 'I8 CON-009: cancelamento local coerente',
      (db009?.movimentacoes ?? []).filter((m) => m.motivoOrigem === 'CANCELAMENTO_PEDIDO').length === 1);

    process.stdout.write(`D106 — cenários executados: ${cenarios.length}\n`);
  } catch (erro) {
    erroFatal = sanitizarErroTexto(erro);
    process.stderr.write(`D106 erro fatal: ${erroFatal}\n`);
  } finally {
    globalThis.fetch = fetchOriginal;
    const fetchRestaurado = globalThis.fetch === fetchOriginal;

    // app.close() de todas as instâncias antes do cleanup (drena enviosPendentes)
    for (const [indice, app] of apps.entries()) {
      try { await app.close(); } catch (erro) {
        cleanupErrors.push(`app.close[${indice}]: ${sanitizarErroTexto(erro)}`);
      }
    }

    let pedidoIds: string[] = [];
    if (pronto) {
      try { await awaitPending(); } catch (erro) {
        cleanupErrors.push(`operações pendentes: ${sanitizarErroTexto(erro)}`);
      }
      try {
        pedidoIds = (await prisma.pedido.findMany({
          where: { clienteUsuarioId: { in: usuarios } }, select: { id: true },
        })).map((linha) => linha.id);
      } catch (erro) {
        cleanupErrors.push(`listar pedidos: ${sanitizarErroTexto(erro)}`);
      }
      const passos: Array<[string, () => Promise<unknown>]> = [
        ['Notificacao', () => prisma.notificacao.deleteMany({
          where: { pedidoId: { in: pedidoIds } } })],
        ['ItemPedidoPersonalizacaoSnapshot', () => prisma.itemPedidoPersonalizacaoSnapshot.deleteMany({
          where: { itemPedido: { pedidoId: { in: pedidoIds } } } })],
        ['ReservaEstoque', () => prisma.reservaEstoque.deleteMany({ where: { produtoId: { in: produtos } } })],
        ['MovimentacaoEstoque', () => prisma.movimentacaoEstoque.deleteMany({ where: { produtoId: { in: produtos } } })],
        ['Pagamento', () => prisma.pagamento.deleteMany({
          where: { pedidoId: { in: pedidoIds } } })],
        ['ItemPedido', () => prisma.itemPedido.deleteMany({
          where: { pedidoId: { in: pedidoIds } } })],
        ['EnderecoEntregaSnapshot', () => prisma.enderecoEntregaSnapshot.deleteMany({
          where: { pedidoId: { in: pedidoIds } } })],
        ['HistoricoStatusPedido', () => prisma.historicoStatusPedido.deleteMany({
          where: { pedidoId: { in: pedidoIds } } })],
        ['Pedido', () => prisma.pedido.deleteMany({ where: { id: { in: pedidoIds } } })],
        ['ItemCarrinhoPersonalizacao', () => prisma.itemCarrinhoPersonalizacao.deleteMany({
          where: { itemCarrinho: { carrinho: { usuarioId: { in: usuarios } } } } })],
        ['ItemCarrinho', () => prisma.itemCarrinho.deleteMany({
          where: { carrinho: { usuarioId: { in: usuarios } } } })],
        ['Carrinho', () => prisma.carrinho.deleteMany({ where: { usuarioId: { in: usuarios } } })],
        ['ProdutoPersonalizacao', () => prisma.produtoPersonalizacao.deleteMany({
          where: { produtoId: { in: produtos } } })],
        ['Estoque', () => prisma.estoque.deleteMany({ where: { produtoId: { in: produtos } } })],
        ['Produto', () => prisma.produto.deleteMany({ where: { id: { in: produtos } } })],
        ['Categoria', () => prisma.categoria.deleteMany({ where: { id: { in: categorias } } })],
        ['Usuario', () => prisma.usuario.deleteMany({ where: { id: { in: usuarios } } })],
      ];
      let numero = 0;
      for (const [tabela, acao] of passos) {
        numero += 1;
        try {
          await acao();
          cleanupPassos.push({ passo: numero, tabela, erro: null });
        } catch (erro) {
          const descricao = `${numero}. ${tabela}: ${sanitizarErroTexto(erro)}`;
          cleanupErrors.push(descricao);
          cleanupPassos.push({ passo: numero, tabela, erro: sanitizarErroTexto(erro) });
          process.stderr.write(`Limpeza D106 FAIL ${descricao}\n`);
        }
      }
    }

    // verificação final de zero resíduo, sessões e promises
    let residuos: Record<string, number> = {};
    try {
      residuos = {
        Notificacao: await prisma.notificacao.count({ where: { pedidoId: { in: pedidoIds } } }),
        ItemPedidoPersonalizacaoSnapshot: await prisma.itemPedidoPersonalizacaoSnapshot.count({
          where: { itemPedido: { pedidoId: { in: pedidoIds } } } }),
        ReservaEstoque: await prisma.reservaEstoque.count({ where: { produtoId: { in: produtos } } }),
        MovimentacaoEstoque: await prisma.movimentacaoEstoque.count({ where: { produtoId: { in: produtos } } }),
        Pagamento: await prisma.pagamento.count({ where: { pedidoId: { in: pedidoIds } } }),
        ItemPedido: await prisma.itemPedido.count({ where: { pedidoId: { in: pedidoIds } } }),
        EnderecoEntregaSnapshot: await prisma.enderecoEntregaSnapshot.count({
          where: { pedidoId: { in: pedidoIds } } }),
        HistoricoStatusPedido: await prisma.historicoStatusPedido.count({
          where: { pedidoId: { in: pedidoIds } } }),
        Pedido: await prisma.pedido.count({ where: { clienteUsuarioId: { in: usuarios } } }),
        ItemCarrinhoPersonalizacao: await prisma.itemCarrinhoPersonalizacao.count({
          where: { itemCarrinho: { carrinho: { usuarioId: { in: usuarios } } } } }),
        ItemCarrinho: await prisma.itemCarrinho.count({
          where: { carrinho: { usuarioId: { in: usuarios } } } }),
        Carrinho: await prisma.carrinho.count({ where: { usuarioId: { in: usuarios } } }),
        ProdutoPersonalizacao: await prisma.produtoPersonalizacao.count({ where: { produtoId: { in: produtos } } }),
        Estoque: await prisma.estoque.count({ where: { produtoId: { in: produtos } } }),
        Produto: await prisma.produto.count({ where: { id: { in: produtos } } }),
        Categoria: await prisma.categoria.count({ where: { id: { in: categorias } } }),
        Usuario: await prisma.usuario.count({ where: { id: { in: usuarios } } }),
      };
    } catch (erro) {
      cleanupErrors.push(`verificação de resíduo: ${sanitizarErroTexto(erro)}`);
    }
    const sessoesOrfas = await prisma.$queryRaw<Array<{ n: bigint }>>`
      SELECT count(*) AS n FROM pg_stat_activity
      WHERE application_name IN (${Prisma.join([runId, ...nomesInstancias])})
        AND pid <> pg_backend_pid() AND (state = 'active' OR wait_event_type = 'Lock')`
      .then((linhas) => Number(linhas[0]?.n ?? 0n)).catch(() => -1);
    const promisesPendentes = pending.size;
    const deadlocksFinaisEfetivos = await lerDeadlocks().catch(() => null);

    try { await prisma.$disconnect(); } catch (erro) {
      cleanupErrors.push(`prisma.$disconnect: ${sanitizarErroTexto(erro)}`);
    }

    // ---------------------------------------------------------------- artefato
    const invariantesResumo = [...invariantes].map(([id, lista]) => ({
      id, ok: lista.every((item) => item.ok), checks: lista,
    }));

    const vereditoGeral: 'PASS' | 'FAIL' | 'INCONCLUSIVO' = erroFatal
      ? (cenarios.length === 0 ? 'INCONCLUSIVO' : 'FAIL')
      : (cenarios.every((c) => c.veredito === 'PASS') &&
          invariantesResumo.every((i) => i.ok) &&
          cleanupErrors.length === 0 &&
          Object.values(residuos).every((n) => n === 0) &&
          sessoesOrfas === 0 &&
          promisesPendentes === 0 &&
          egressTentativas.length === 0 &&
          fetchRestaurado &&
          deadlocksFinaisEfetivos === deadlocksIniciais)
        ? 'PASS'
        : 'FAIL';

    const findings: Array<{ id: string; severidade: string; arquivo: string; problema: string; estado: string }> = [];
    if (cenarios.find((c) => c.id === 'CON-002')?.veredito === 'FAIL') {
      findings.push({
        id: 'F-02',
        severidade: 'ALTA',
        arquivo: 'apps/api/test/d106-f04-concorrencia-estoque-postgres.ts (CON-002)',
        problema: 'CON-002 divergiu da expectativa corrigida do PLAN (1×201 + 4×409 "Revisão desatualizada. '
          + 'Atualize os valores."; estado final 3/1/2; 1 pedido; 1 reserva ATIVA). Investigar regressão de contrato '
          + 'ou de ambiente antes de aceitar o resultado.',
        estado: 'aberto — requer análise (não corrigir código de produção na EXEC)',
      });
    }

    for (const ramo of ['6A', '6B']) {
      if (cenarios.find((c) => c.id === `CON-006/${ramo}`)?.veredito === 'FAIL') {
        const registro = cenarios.find((c) => c.id === `CON-006/${ramo}`);
        const deltaDeadlocks = Number(registro?.deadlocksAfter ?? 0) - Number(registro?.deadlocksBefore ?? 0);
        findings.push({
          id: `F-03/${ramo}`,
          severidade: 'ALTA',
          arquivo: `apps/api/test/d106-f04-concorrencia-estoque-postgres.ts (CON-006/${ramo})`,
          problema: `O ramo ${ramo} divergiu da expectativa do PLAN corrigido (ordem imposta pela fila do lock Estoque). `
            + `Respostas observadas: ${JSON.stringify(registro?.responses ?? [])}.`
            + (deltaDeadlocks > 0 ? ` PostgreSQL registrou ${deltaDeadlocks} deadlock(s) neste ramo.` : ''),
          estado: 'consequência de F-04 — sem ação própria; ver F-04/D106',
        });
      }
    }

    for (const ramo of ['6A', '6B']) {
      const registro = cenarios.find((c) => c.id === `CON-006/${ramo}`);
      const deltaDeadlocks = Number(registro?.deadlocksAfter ?? 0) - Number(registro?.deadlocksBefore ?? 0);
      if (deltaDeadlocks > 0) {
        findings.push({
          id: 'F-04',
          severidade: 'ALTA',
          arquivo: 'apps/api/src/produtos/estoque.service.ts L18-40 × apps/api/src/pedidos/pedidos.service.ts L466-477/L588-592',
          problema: 'Deadlock real (SQLSTATE 40P01) entre `PATCH /admin/produtos/:id/estoque` e `POST /pedidos` do mesmo produto, '
            + 'por inversão de ordem de locks: a criação de pedido bloqueia `Produto` FOR UPDATE e depois `Estoque` FOR UPDATE, '
            + 'enquanto o ajuste bloqueia `Estoque` FOR UPDATE e, ao inserir `MovimentacaoEstoque`, adquire FOR KEY SHARE em `Produto` '
            + '(FK `MovimentacaoEstoque.produtoId → Produto.id`). Quando o ajuste obtém o `Estoque` primeiro, forma-se o ciclo; '
            + 'o PostgreSQL aborta uma das transações e a requisição de pedido responde 500 (o ajuste responde 200). '
            + `Ocorrências nesta execução: ${deltaDeadlocks} (CON-006/${ramo}). Dados permanecem consistentes (rollback integral), `
            + 'mas a operação do cliente falha de forma visível sob concorrência.',
          estado: 'encaminhado à D106 (sem patch nesta tarefa)',
        });
      }
    }

    // Consolidado: CON-006 é 1 cenário com 2 ramos forçados (6A/6B); veredito = 6A ∧ 6B.
    const grupos = new Map<string, Cenario[]>();
    for (const cenario of cenarios) {
      const chave = cenario.cenario ?? cenario.id;
      grupos.set(chave, [...(grupos.get(chave) ?? []), cenario]);
    }
    const consolidado = [...grupos].map(([id, lista]) => ({
      cenario: id,
      ramos: lista.map((item) => item.ramo).filter((ramo): ramo is string => Boolean(ramo)),
      registros: lista.length,
      veredito: lista.every((item) => item.veredito === 'PASS') ? 'PASS' : 'FAIL',
    }));

    const proveniencia = provenienciaGit();
    const artefato = {
      tarefa: 'D106 — Testes de concorrência de estoque',
      geradoEm: new Date().toISOString(),
      runLabel,
      runId,
      condicao,
      ...proveniencia,
      comando: 'cd apps/api && D106_TEST_DATABASE_URL="postgresql://<user>:<senha>@localhost:5432/cupcake_d106?schema=public" '
        + `D106_RUN_LABEL="${runLabel}" D106_EVIDENCE_PATH="${evidenciaRelativa || 'docs/testing/evidence/D106-exec-concorrencia.json'}" `
        + 'npm run test:d106:postgres',
      versoes: {
        node: process.version,
        npm: versao('npm --version'),
        'ts-node': versao('npx ts-node --version'),
      },
      banco: { database: 'cupcake_d106', schema: 'public', migrations: 'prisma/migrations (4)' },
      ambiente,
      preflight,
      egress: { tentativas: egressTentativas, fetchCalls, fetchRestaurado },
      cenarios,
      consolidado,
      invariantes: invariantesResumo,
      deadlocks: { antes: deadlocksIniciais, depois: deadlocksFinaisEfetivos },
      correcaoF01: {
        origem: 'EXEC inicial do harness (execução histórica; artefato próprio não preservado)',
        finding: 'F-01 (concorrência) — expectativa de CON-002 inexecutável sob o contrato de revisão assinada (PLAN corrigido e revisado)',
        evidenciaRun1: '1×201 + 4×409 "Revisão desatualizada. Atualize os valores."; 5 waiters/5 PIDs; estado final 3/1/2; 1 pedido; 1 reserva ATIVA qty 1',
        expectativaAntiga: '3×201; 2×409 "Estoque indisponível."; final física 3 / reservada 3 / disponível 0; 3 pedidos; 3 reservas ATIVA',
        expectativaNova: '1×201; 4×409 "Revisão desatualizada. Atualize os valores."; final física 3 / reservada 1 / disponível 2; 1 pedido; 1 reserva ATIVA qty 1; 0 movimentação',
        baseDeContrato: 'assinarRevisao(usuarioId, revisao, saldos) inclui saldos — pedidos.service.ts L665-667; comparação em L608-610 após o teste de overselling',
        concorrenciaPreservada: 'CON-002: barreira no lock "Produto" com 5 concorrentes, 5 PIDs distintos, pendingBeforeRelease=true, nenhuma resposta antes do release',
      },
      correcoesLow: {
        origem: 'Histórico do harness e da documentação. Os itens LOW/OBS abaixo são registros '
          + 'de ciclos anteriores cujos artefatos de origem não foram preservados nesta árvore '
          + '(histórico não verificável); o estado atual é o das assertions executadas nesta rodada.',
        artefatosPreservados: [
          'docs/testing/evidence/D106-exec-concorrencia-antes.json',
          'docs/testing/evidence/D106-exec-concorrencia-con010-antes.json',
          'docs/testing/evidence/D106-exec-concorrencia-depois-1.json',
          'docs/testing/evidence/D106-exec-concorrencia-depois-2.json',
          'docs/testing/evidence/D106-exec-concorrencia-depois-3.json',
          'docs/testing/evidence/D106-exec-concorrencia.json',
        ],
        notaDeProveniencia: 'Execuções intermediárias de ciclos anteriores não geraram artefato próprio preservado '
          + 'e são histórico não verificável. Os artefatos mantidos são os "antes" (F-04 e R-01), as três execuções '
          + '"depois" e a execução canônica independente; todos gravam head, condicao, working tree, diffSha256, '
          + 'runLabel e runId. Procedimento e hashes estão em docs/testing/D106-CONCORRENCIA-VALIDACAO.md.',
        'LOW-01': {
          arquivo: 'apps/api/test/d106-f04-concorrencia-estoque-postgres.ts (CON-006)',
          correcao: 'I5 verificada em CON-006 com a mesma fórmula de CON-005 (Σ movimentos = Δ física), '
            + 'parametrizada pela física inicial 1: Σ movimentos == física_final − 1, quantidade do AJUSTE_ADMINISTRATIVO == Δ física '
            + 'e marcador de invariante I5 emitido.',
          estado: 'corrigido',
        },
        'LOW-02': {
          arquivo: 'apps/api/test/d106-f04-concorrencia-estoque-postgres.ts (CON-007)',
          correcao: 'O waiter advisory passou a ser validado com o mesmo critério de ancoramento de disputar(): '
            + 'pg_blocking_pids contém o blocker do harness OU o predecessor imediato (1º waiter no Carrinho); '
            + 'emitidos "cadeia ancorada no blocker", "ao menos um waiter bloqueado diretamente" e '
            + '"advisory ancorado no blocker ou no predecessor imediato". transactionid/tuple/advisory continuam aceitos.',
          estado: 'corrigido',
        },
        'OBS-01': {
          arquivo: 'apps/api/test/d106-f04-concorrencia-estoque-postgres.ts (I8)',
          correcao: 'Marcador I8 mantido apenas nos cenários com checagem própria (CON-009 e CTRL-001). '
            + 'Generalizar para "todos" exigiria marcação tautológica, sem checagem real.',
          estado: 'registro histórico (não é finding)',
        },
        'LOW-03': {
          arquivo: 'apps/api/test/d106-f04-concorrencia-estoque-postgres.ts (CON-006)',
          correcao: 'Removido o ramo 409 inalcançável do CON-006 monolítico; substituído pelos ramos forçados 6A/6B. '
            + 'A execução original não é preservada (histórico não verificável).',
          estado: 'histórico não verificável; superado por 6A/6B',
        },
        'LOW-04': {
          arquivo: 'apps/api/test/d106-f04-concorrencia-estoque-postgres.ts (CON-006/6A e 6B)',
          correcao: 'CON-006 dividido em dois ramos forçados, com fixtures próprias (s6a/s6b, estoque 1/0, carrinho qty 1): '
            + '6A enfileira o pedido primeiro (pedido 201, ajuste 200, final 6/1/5, AJUSTE +5); 6B enfileira o ajuste primeiro '
            + '(ajuste 200, pedido 409 "Revisão desatualizada. Atualize os valores.", final 5/0/5, 0 pedido/reserva, AJUSTE +4). '
            + 'Ordem imposta pela fila do lock Estoque, 2 waiters/2 PIDs distintos bloqueados antes do release; nenhum ramo aceita '
            + 'o estado do outro.',
          estado: 'corrigido (verificado nas execuções atuais)',
        },
        'LOW-05': {
          arquivo: 'apps/api/test/d106-f04-concorrencia-estoque-postgres.ts (I9)',
          correcao: 'I9 marcada apenas em CON-006/6B (409 sem rastro); N/A em CON-006/6A, que não tem rejeição (verificado por I1/I5).',
          estado: 'corrigido',
        },
        'LOW-06': {
          arquivo: 'apps/api/test/d106-f04-concorrencia-estoque-postgres.ts (I9)',
          correcao: 'I9 em 6B não exige ausência do AJUSTE_ADMINISTRATIVO esperado: exige zero Pedido/ItemPedido/Reserva/Histórico '
            + 'e zero movimentação de venda ou com pedidoId; o ajuste do cenário (+4) é esperado.',
          estado: 'corrigido',
        },
        'OBS-A': {
          arquivo: 'apps/api/test/d106-f04-concorrencia-estoque-postgres.ts (CON-009)',
          correcao: 'Ordem das respostas de CON-009 tratada como variável entre rodadas (conjunto {200, 409}); nenhuma ordem específica é esperada.',
          estado: 'registro histórico (não verificável no artefato original)',
        },
        'OBS-B': {
          arquivo: 'apps/api/test/d106-f04-concorrencia-estoque-postgres.ts',
          correcao: 'Números da rodada passaram a vir do próprio JSON gerado, sem rótulo de rodada fixo no texto.',
          estado: 'registro histórico (não verificável no artefato original)',
        },
        'OBS-C': {
          arquivo: 'apps/api/test/d106-f04-concorrencia-estoque-postgres.ts (cleanup)',
          correcao: 'I10 é verificada pelos critérios de cleanup no vereditoGeral (17/17 passos, resíduos 0, '
            + 'sessões órfãs 0, promises pendentes 0), e não por marcarInvariante — o JSON traz I1–I9.',
          estado: 'corrigido',
        },
        'LOW-07': {
          arquivo: 'apps/api/test/d106-f04-concorrencia-estoque-postgres.ts (evidência)',
          correcao: 'Erros do artefato sanitizados (sem stack/caminhos absolutos) e SQLSTATE do PostgreSQL capturado por instância: '
            + 'cenários com 40P01 registram o código em cenarios[].errosDeBanco; 0 ocorrências de caminhos absolutos no JSON.',
          estado: 'corrigido',
        },
        'LOW-08': {
          arquivo: 'apps/api/test/d106-f04-concorrencia-estoque-postgres.ts (narrativo)',
          correcao: 'Contabilidade da rodada histórica registrada no JSON gerado (assertivas verdadeiras/falsas e consolidado), '
            + 'sem remissão a seções inexistentes.',
          estado: 'histórico não verificável',
        },
        'R-01': {
          arquivo: 'apps/api/src/produtos/produtos.service.ts (remove)',
          correcao: 'Exclusão de produto passou a adquirir Produto FOR UPDATE antes de remover Estoque, alinhada à ordem '
            + 'global; coberto por spec e pelo cenário de concorrência CON-010.',
          estado: 'corrigido',
        },
      },
      findings,
      cleanup: {
        totalPassos: cleanupPassos.length,
        passos: cleanupPassos,
        cleanupErrors,
        residuos,
        sessoesOrfas: sessoesOrfas,
        promisesPendentes,
      },
      erroFatal,
      veredito: vereditoGeral,
    };

    mkdirSync(dirname(destinoArtefato), { recursive: true });
    writeFileSync(destinoArtefato, `${JSON.stringify(artefato, null, 2)}\n`, 'utf8');

    const linhas = [
      `D106 — veredito ${vereditoGeral}`,
      ...cenarios.map((c) => `  ${c.id}: ${c.veredito} (waiters=${c.waitersCount}, pids=${c.distinctPids}, pendingBeforeRelease=${String(c.pendingBeforeRelease)})`),
      `Invariantes: ${invariantesResumo.map((i) => `${i.id}=${i.ok ? 'ok' : 'VIOLADA'}`).join(' ')}`,
      `Cleanup: passos=${cleanupPassos.length} erros=${cleanupErrors.length} residuos=${Object.values(residuos).reduce((a, b) => a + b, 0)} sessoesOrfas=${sessoesOrfas} promises=${promisesPendentes}`,
      `Deadlocks: ${deadlocksIniciais} → ${String(deadlocksFinaisEfetivos)}`,
      `Egress: tentativas=${egressTentativas.length} fetchCalls=${fetchCalls} restaurado=${fetchRestaurado}`,
      `Evidência: ${destinoArtefato}`,
      '',
    ];
    process.stdout.write(linhas.join('\n'));
    if (vereditoGeral !== 'PASS') process.exitCode = 1;
  }
}

main().catch((erro: unknown) => {
  process.stderr.write(`Falha D106 PostgreSQL: ${mensagemDeErro(erro)}\n`);
  process.exitCode = 1;
});
