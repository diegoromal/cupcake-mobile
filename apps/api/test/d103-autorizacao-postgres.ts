import { strict as assert } from 'node:assert';
import { execSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { request as httpRequest } from 'node:http';
import { dirname, resolve, sep } from 'node:path';
import { INestApplication, ServiceUnavailableException } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { PrismaPg } from '@prisma/adapter-pg';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaClient } from '../src/generated/prisma/client';
import { ModalidadeRecebimento, PerfilUsuario, StatusPedido } from '../src/generated/prisma/enums';
import { EvolutionApiService } from '../src/notificacoes/evolution-api.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { intervaloRelatorioUtc } from '../src/relatorios/horario-relatorio';

/**
 * D103 — testes de segurança/autorização com HTTP real e PostgreSQL dedicado.
 *
 * Banco: cupcake_d103 (schema public). Nenhuma escrita fora do banco dedicado.
 * O `.env` do repositório nunca é lido para escrita nem alterado: o ajuste é só em
 * `process.env` do processo do harness.
 */

type Metodo = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
type Veredito = 'PASS' | 'FAIL' | 'INCONCLUSIVO';

type Evidencia = {
  caso: string;
  requisicao: number;
  categoria: string;
  perfil: string;
  metodo: string;
  rota: string;
  condicao: string;
  fixture: string;
  headers: Record<string, string>;
  momento: string;
  status: number | null;
  message: unknown;
  resposta: unknown;
  estadoAntes: unknown;
  estadoDepois: unknown;
  fonte: string;
  veredito: Veredito;
};

const TABELAS = [
  'Notificacao',
  'ItemPedidoPersonalizacaoSnapshot',
  'ReservaEstoque',
  'MovimentacaoEstoque',
  'Pagamento',
  'HistoricoStatusPedido',
  'ItemPedido',
  'EnderecoEntregaSnapshot',
  'Pedido',
  'ItemCarrinhoPersonalizacao',
  'ItemCarrinho',
  'Carrinho',
  'Endereco',
  'ConfiguracaoLojaEntrega',
  'ProdutoPersonalizacao',
  'Personalizacao',
  'Estoque',
  'Produto',
  'Categoria',
  'Usuario',
] as const;

const CATEGORIA_AUT = 'Autenticação e tokens';
const CATEGORIA_RBC = 'RBAC entre perfis';
const CATEGORIA_ADM = 'Operações administrativas';
const CATEGORIA_OWNC = 'Ownership do CLIENTE';
const CATEGORIA_OWNE = 'Ownership do ENTREGADOR';
const CATEGORIA_ID = 'Acesso direto por ID';

const LOOPBACK = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

const pad3 = (numero: number) => String(numero).padStart(3, '0');
const pad2 = (numero: number) => String(numero).padStart(2, '0');

function mensagemDeErro(erro: unknown): string {
  if (erro instanceof Error) return erro.stack ?? erro.message;
  return String(erro);
}

function comoObjeto(valor: unknown): Record<string, unknown> {
  return valor as Record<string, unknown>;
}

function comoLista(valor: unknown): Array<Record<string, unknown>> {
  return Array.isArray(valor) ? (valor as Array<Record<string, unknown>>) : [];
}

function texto(valor: unknown): string {
  return typeof valor === 'string' ? valor : JSON.stringify(valor);
}

function sanitizar(valor: unknown, profundidade = 0): unknown {
  if (profundidade > 6) return '[profundidade]';
  if (Array.isArray(valor)) {
    const cabeca = valor.slice(0, 10).map((item) => sanitizar(item, profundidade + 1));
    return valor.length > 10 ? [...cabeca, `[+${valor.length - 10} itens]`] : cabeca;
  }
  if (valor !== null && typeof valor === 'object') {
    const saida: Record<string, unknown> = {};
    for (const [chave, conteudo] of Object.entries(valor as Record<string, unknown>)) {
      if (/token|senha|credencial|secret|apikey|api_key|authorization/i.test(chave)) {
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
  try {
    return execSync(comando, { encoding: 'utf8' }).trim();
  } catch {
    return '<indisponivel>';
  }
}

async function main(): Promise<void> {
  const bruto = process.env.D103_TEST_DATABASE_URL;
  if (!bruto) {
    throw new Error('D103 exige D103_TEST_DATABASE_URL para localhost/cupcake_d103.');
  }
  const url = new URL(bruto);
  if (url.hostname !== 'localhost' || url.pathname !== '/cupcake_d103') {
    throw new Error('D103 exige D103_TEST_DATABASE_URL para localhost/cupcake_d103.');
  }
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || url.hash ||
      [...url.searchParams].some(([chave, valor]) => chave !== 'schema' || valor !== 'public')) {
    throw new Error('D103 exige PostgreSQL local dedicado cupcake_d103, schema public.');
  }

  const geradoEm = new Date().toISOString();
  const branch = lerGit('git rev-parse --abbrev-ref HEAD');
  const head = lerGit('git rev-parse HEAD');
  const marker = `D103-${randomUUID()}`;

  const evidencias: Evidencia[] = [];
  const contadorRequisicao = new Map<string, number>();
  const veredictos = new Map<string, Veredito>();
  const causas = new Map<string, string>();
  const verificacoesFinais: Array<{ nome: string; ok: boolean; detalhe: string }> = [];
  const cleanupErrors: string[] = [];
  const cleanupPassos: Array<{ passo: number; tabela: string; erro: string | null }> = [];

  let origemAtual = 'preflight';
  let fetchCalls = 0;
  const egressTentativas: Array<{ destino: string; momento: string; origem: string }> = [];
  const fetchOriginal = globalThis.fetch;

  const guardaFetch = async (entrada: unknown, init?: unknown): Promise<unknown> => {
    fetchCalls += 1;
    let destino = '<nao-parseavel>';
    let host = '';
    try {
      const alvo = typeof entrada === 'string'
        ? entrada
        : entrada instanceof URL
          ? entrada.toString()
          : typeof comoObjeto(entrada).url === 'string'
            ? comoObjeto(entrada).url as string
            : String(entrada);
      const destinoUrl = new URL(alvo);
      host = destinoUrl.hostname;
      destino = `${destinoUrl.protocol}//${destinoUrl.hostname}`;
    } catch {
      destino = '<nao-parseavel>';
    }
    egressTentativas.push({ destino, momento: new Date().toISOString(), origem: origemAtual });
    if (!LOOPBACK.has(host)) {
      throw new Error('D103: egress bloqueado pela guarda de fetch.');
    }
    return (fetchOriginal as unknown as (a: unknown, b?: unknown) => Promise<unknown>)(entrada, init);
  };

  // (i) ambiente do processo — esvaziar (não deletar) antes de qualquer provider.
  process.env.DATABASE_URL = bruto;
  process.env.JWT_ACCESS_SECRET = `d103-access-${randomUUID()}`;
  process.env.JWT_REFRESH_SECRET = `d103-refresh-${randomUUID()}`;
  process.env.EVOLUTION_API_URL = '';
  process.env.EVOLUTION_API_KEY = '';
  process.env.EVOLUTION_API_INSTANCE = '';
  process.env.GEOCODE_MAPS_CO_API_KEY = '';

  const segredoAccess = process.env.JWT_ACCESS_SECRET;
  const segredoRefresh = process.env.JWT_REFRESH_SECRET;

  // Caminho relativo ao repositório: o artefato não registra caminho absoluto da máquina.
  const cwdRelativo = process.cwd().endsWith(`${sep}apps${sep}api`)
    ? 'apps/api'
    : 'cwd-fora-de-apps/api';

  const ambiente = {
    cwd: cwdRelativo,
    database: 'cupcake_d103',
    schema: 'public',
    evolucaoUrlAntesDoCreate: process.env.EVOLUTION_API_URL,
    evolucaoKeyAntesDoCreate: process.env.EVOLUTION_API_KEY,
    evolucaoInstanceAntesDoCreate: process.env.EVOLUTION_API_INSTANCE,
    geocodeKeyAntesDoCreate: process.env.GEOCODE_MAPS_CO_API_KEY,
    evolucaoUrlDepoisDoCreate: '',
    evolucaoKeyDepoisDoCreate: '',
    evolucaoInstanceDepoisDoCreate: '',
    geocodeKeyDepoisDoCreate: '',
    envDoRepositorioAlterado: false,
  };

  const preflight: Record<string, unknown> = {
    currentDatabase: null,
    currentSchema: null,
    migrations: [],
    migrationsPendentes: [],
    contagensIniciais: {} as Record<string, number>,
    configuracaoUnica: null,
    enviarTextoRejeitou: false,
    enviarTextoErro: null,
    fetchCallsNoPreflight: null,
    databaseDoApp: null,
    guardaInstalada: null,
    falha: null,
  };

  const registrar = (dados: Omit<Evidencia, 'requisicao' | 'momento' | 'veredito'>): Evidencia => {
    const numero = (contadorRequisicao.get(dados.caso) ?? 0) + 1;
    contadorRequisicao.set(dados.caso, numero);
    const ev: Evidencia = { ...dados, requisicao: numero, momento: new Date().toISOString(), veredito: 'PASS' };
    evidencias.push(ev);
    return ev;
  };

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: bruto }) });
  const jwt = new JwtService();

  let app: INestApplication | undefined;
  let portaHttp = 0;
  let fixturesCriadas = false;
  let http: unknown;

  const ua = randomUUID();
  const ub = randomUUID();
  const adm = randomUUID();
  const entA = randomUUID();
  const entB = randomUUID();
  const uDel = randomUUID();
  const usuariosParaLimpeza = new Set<string>([ua, ub, adm, entA, entB, uDel]);

  const categoriaId = randomUUID();
  const persId = randomUUID();
  const persAdmId = randomUUID();
  const prodId = randomUUID();
  const prodAdmId = randomUUID();
  const carrinhoAId = randomUUID();
  const carrinhoBId = randomUUID();
  const itemAId = randomUUID();
  const itemBId = randomUUID();
  const endAId = randomUUID();
  const endBId = randomUUID();
  const pedBPend = randomUUID();
  const pedBPago = randomUUID();
  const pedAPagRec = randomUUID();
  const pedEntAConfirm = randomUUID();
  const pedEntAAlheio = randomUUID();
  const pedEntB = randomUUID();
  const pedAdmDeny = randomUUID();
  const pedAdmCtl = randomUUID();
  const tentA = randomUUID();
  const tentRec = randomUUID();
  const pedATent = randomUUID();
  const pagBPix = randomUUID();
  const pagBCard = randomUUID();
  const configId = randomUUID();

  const pedidos = [
    pedBPend, pedBPago, pedAPagRec, pedEntAConfirm, pedEntAAlheio, pedEntB,
    pedAdmDeny, pedAdmCtl, pedATent,
  ];
  const produtos = [prodId, prodAdmId];
  const personalizacoes = [persId, persAdmId];
  const categorias = [categoriaId];
  const configs = [configId];

  const emailAut002 = `${marker.toLowerCase()}-aut002@example.test`;
  const emailAdm028 = `${marker.toLowerCase()}-entregador@example.test`;
  const emailDeny017 = `${marker.toLowerCase()}-deny@example.test`;
  const nomeDeny001 = `${marker} CAT-DENY`;
  const nomeDeny003 = `${marker} PERS-DENY`;
  const nomeDeny005 = `${marker} PROD-DENY`;
  const senhaSintetica = `d103-${randomUUID()}`;

  const assinar = (
    payload: Record<string, unknown>,
    opcoes: { segredo?: string; expiraEm?: '15m' } = {},
  ): string => jwt.sign(payload, {
    secret: opcoes.segredo ?? segredoAccess,
    algorithm: 'HS256',
    ...(opcoes.expiraEm ? { expiresIn: opcoes.expiraEm } : {}),
  });

  const access = (sub: string, perfil: PerfilUsuario) =>
    assinar({ sub, perfil, type: 'access' }, { expiraEm: '15m' });

  const tokensValidos = new Map<string, string>();
  const definirTokens = () => {
    const pares: Array<[string, string, PerfilUsuario]> = [
      ['CLIENTE-A', ua, PerfilUsuario.CLIENTE],
      ['CLIENTE-B', ub, PerfilUsuario.CLIENTE],
      ['ADMIN', adm, PerfilUsuario.ADMIN],
      ['ENTREGADOR-A', entA, PerfilUsuario.ENTREGADOR],
      ['ENTREGADOR-B', entB, PerfilUsuario.ENTREGADOR],
    ];
    for (const [rotulo, sub, perfil] of pares) tokensValidos.set(rotulo, access(sub, perfil));
  };
  const auth = (rotulo: string): string => `Bearer ${tokensValidos.get(rotulo)!}`;

  const construir = (metodo: Metodo, rota: string) => {
    const base = request(http as never);
    switch (metodo) {
      case 'GET': return base.get(rota);
      case 'POST': return base.post(rota);
      case 'PATCH': return base.patch(rota);
      case 'PUT': return base.put(rota);
      case 'DELETE': return base.delete(rota);
    }
  };

  type Resposta = { status: number; body: unknown };

  const enviar = async (opcoes: {
    caso: string;
    categoria: string;
    perfil: string;
    metodo: Metodo;
    rota: string;
    condicao: string;
    fixture: string;
    fonte: string;
    auth?: string;
    headerEvidencia?: string;
    body?: unknown;
    estadoAntes?: unknown;
  }): Promise<{ res: Resposta; ev: Evidencia }> => {
    let teste = construir(opcoes.metodo, opcoes.rota);
    const headers: Record<string, string> = {};
    if (opcoes.auth) {
      teste = teste.set('Authorization', opcoes.auth);
      headers.Authorization = opcoes.headerEvidencia ?? 'Bearer token:<rotulo>';
    } else {
      headers.Authorization = '(ausente)';
    }
    if (opcoes.body !== undefined) teste = teste.send(opcoes.body as never);
    const resposta = (await teste) as unknown as Resposta;
    const ev = registrar({
      caso: opcoes.caso,
      categoria: opcoes.categoria,
      perfil: opcoes.perfil,
      metodo: opcoes.metodo,
      rota: opcoes.rota,
      condicao: opcoes.condicao,
      fixture: opcoes.fixture,
      headers,
      status: resposta.status,
      message: comoObjeto(resposta.body).message ?? null,
      resposta: sanitizar(resposta.body),
      estadoAntes: opcoes.estadoAntes ?? null,
      estadoDepois: null,
      fonte: opcoes.fonte,
    });
    return { res: resposta, ev };
  };

  const esperarErro = (res: Resposta, status: number, mensagem: string) => {
    assert.equal(res.status, status, `status esperado ${status}, obtido ${res.status}: ${JSON.stringify(res.body)}`);
    assert.equal(texto(comoObjeto(res.body).message), mensagem);
    assert.equal(comoObjeto(res.body).statusCode, status);
  };

  const contarTabela = async (tabela: string): Promise<number> => {
    const [linha] = await prisma.$queryRawUnsafe<Array<{ n: bigint }>>(
      `SELECT count(*)::bigint AS n FROM "${tabela}"`,
    );
    return Number(linha.n);
  };

  const contagensGlobais = async (): Promise<Record<string, number>> => {
    const saida: Record<string, number> = {};
    for (const tabela of TABELAS) saida[tabela] = await contarTabela(tabela);
    return saida;
  };

  const verificarAmbienteVazio = (rotulo: string) => {
    assert.equal(process.env.EVOLUTION_API_URL, '', `${rotulo}: EVOLUTION_API_URL deve estar esvaziada`);
    assert.equal(process.env.EVOLUTION_API_KEY, '', `${rotulo}: EVOLUTION_API_KEY deve estar esvaziada`);
    assert.equal(process.env.EVOLUTION_API_INSTANCE, '', `${rotulo}: EVOLUTION_API_INSTANCE deve estar esvaziada`);
    assert.equal(process.env.GEOCODE_MAPS_CO_API_KEY, '', `${rotulo}: GEOCODE_MAPS_CO_API_KEY deve estar esvaziada`);
  };

  const lerConfig = async () => {
    const linha = await prisma.configuracaoLojaEntrega.findFirstOrThrow();
    return {
      id: linha.id,
      latitudeLoja: linha.latitudeLoja.toFixed(6),
      longitudeLoja: linha.longitudeLoja.toFixed(6),
      raioMaximoAtendimento: linha.raioMaximoAtendimento.toFixed(3),
      taxaBase: linha.taxaBase.toFixed(2),
      valorPorQuilometro: linha.valorPorQuilometro.toFixed(2),
    };
  };

  const aguardarNotificacao = async (
    pedidoId: string, evento: StatusPedido, limiteMs = 3000, intervaloMs = 50,
  ): Promise<number> => {
    const limite = Date.now() + limiteMs;
    for (;;) {
      const total = await prisma.notificacao.count({
        where: { pedidoId, eventoStatusOriginador: evento },
      });
      if (total >= 1) return total;
      if (Date.now() >= limite) {
        throw new Error(`D103: Notificacao ${evento} ausente para ${pedidoId} após ${limiteMs}ms`);
      }
      await new Promise((concluir) => setTimeout(concluir, intervaloMs));
    }
  };

  const hojeLocal = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
  const queryRelatorio = `inicio=${hojeLocal}&fim=${hojeLocal}`;

  const configOriginal = {
    latitudeLoja: '-23.5', longitudeLoja: '-46.6', raioMaximoAtendimento: '10',
    taxaBase: '5.00', valorPorQuilometro: '2.00',
  };
  const configAlterada = {
    latitudeLoja: '-22.9', longitudeLoja: '-43.2', raioMaximoAtendimento: '15',
    taxaBase: '7.00', valorPorQuilometro: '3.00',
  };

  // Registro ordenado dos 108 casos (32 + 16 + 28 + 22 + 5 + 5).
  const ordemDosCasos: string[] = [];
  for (let i = 1; i <= 32; i += 1) ordemDosCasos.push(`D103-AUT-${pad3(i)}`);
  for (let i = 1; i <= 16; i += 1) ordemDosCasos.push(`D103-RBC-${pad3(i)}`);
  for (let i = 1; i <= 28; i += 1) ordemDosCasos.push(`D103-ADM-${pad3(i)}`);
  for (let i = 1; i <= 22; i += 1) ordemDosCasos.push(`D103-OWN-C-${pad2(i)}`);
  for (let i = 1; i <= 5; i += 1) ordemDosCasos.push(`D103-OWN-E-${pad2(i)}`);
  for (let i = 1; i <= 5; i += 1) ordemDosCasos.push(`D103-ID-${pad2(i)}`);

  let abortado = false;
  let abortoPor: string | null = null;
  let erroFatal: string | null = null;
  const marcarNaoExecutado = (id: string) => {
    if (veredictos.has(id)) return;
    veredictos.set(id, 'INCONCLUSIVO');
    causas.set(id, `não executado após falha em ${abortoPor ?? 'caso anterior'}`);
  };
  const abortar = (id: string) => {
    abortado = true;
    abortoPor = id;
  };
  const executar = async (id: string, corpo: () => Promise<void>): Promise<void> => {
    origemAtual = id;
    try {
      await corpo();
      veredictos.set(id, 'PASS');
    } catch (erro) {
      veredictos.set(id, 'FAIL');
      causas.set(id, mensagemDeErro(erro));
      process.stderr.write(`FAIL ${id}: ${mensagemDeErro(erro)}\n`);
      throw erro;
    }
  };

  // (ii) guarda de egress
  globalThis.fetch = guardaFetch as unknown as typeof fetch;

  try {
    // (i) confirmação do estado antes do create
    origemAtual = 'preflight';
    verificarAmbienteVazio('antes do NestFactory.create');

    // (iii) criação da aplicação
    app = await NestFactory.create(AppModule, { logger: false });
    await app.listen(0, '127.0.0.1');
    http = app.getHttpServer();
    const endereco = (http as { address(): unknown }).address();
    if (!endereco || typeof endereco !== 'object' || !('port' in endereco)) {
      throw new Error('D103 INCONCLUSIVO: servidor HTTP sem porta atribuída.');
    }
    portaHttp = Number((endereco as { port: number }).port);

    // preflight item 4 (depois do create)
    verificarAmbienteVazio('depois do NestFactory.create');
    ambiente.evolucaoUrlDepoisDoCreate = process.env.EVOLUTION_API_URL ?? '<indefinida>';
    ambiente.evolucaoKeyDepoisDoCreate = process.env.EVOLUTION_API_KEY ?? '<indefinida>';
    ambiente.evolucaoInstanceDepoisDoCreate = process.env.EVOLUTION_API_INSTANCE ?? '<indefinida>';
    ambiente.geocodeKeyDepoisDoCreate = process.env.GEOCODE_MAPS_CO_API_KEY ?? '<indefinida>';

    // preflight item 1
    const [identidade] = await prisma.$queryRaw<Array<{ database: string; schema: string }>>`
      SELECT current_database() AS database, current_schema() AS schema`;
    assert.equal(identidade.database, 'cupcake_d103');
    assert.equal(identidade.schema, 'public');
    preflight.currentDatabase = identidade.database;
    preflight.currentSchema = identidade.schema;

    // preflight item 2
    const esperadas = readdirSync(resolve(__dirname, '../prisma/migrations')).filter((nome) => /^\d+_/.test(nome));
    const aplicadas = await prisma.$queryRawUnsafe<Array<{
      migration_name: string; finished_at: Date | null; rolled_back_at: Date | null;
    }>>('SELECT migration_name, finished_at, rolled_back_at FROM "_prisma_migrations"');
    const pendentes = esperadas.filter((nome) => !aplicadas.some((linha) =>
      linha.migration_name === nome && linha.finished_at !== null && linha.rolled_back_at === null));
    assert.deepEqual(pendentes, []);
    assert.equal(aplicadas.every((linha) => linha.finished_at !== null || linha.rolled_back_at !== null), true);
    preflight.migrations = esperadas;
    preflight.migrationsPendentes = pendentes;

    // preflight item 3
    const iniciais = await contagensGlobais();
    const naoVazias = Object.entries(iniciais).filter(([, valor]) => valor !== 0);
    assert.deepEqual(naoVazias, [], 'preflight exige as 20 tabelas de negócio vazias');
    preflight.contagensIniciais = iniciais;

    // preflight item 5
    let rejeitou = false;
    let tipoErro = '';
    try {
      await new EvolutionApiService().enviarTexto('5511999999999', 'd103-preflight');
    } catch (erro) {
      rejeitou = erro instanceof ServiceUnavailableException;
      tipoErro = erro instanceof Error ? erro.constructor.name : String(erro);
    }
    assert.equal(rejeitou, true, 'preflight: enviarTexto deve rejeitar com ServiceUnavailableException');
    assert.equal(fetchCalls, 0, 'preflight: enviarTexto não pode chamar fetch');
    preflight.enviarTextoRejeitou = rejeitou;
    preflight.enviarTextoErro = tipoErro;
    preflight.fetchCallsNoPreflight = fetchCalls;

    // preflight item 6
    const prismaDoApp = app.get(PrismaService);
    const [bancoDoApp] = await prismaDoApp.$queryRaw<Array<{ database: string }>>`
      SELECT current_database() AS database`;
    assert.equal(bancoDoApp.database, 'cupcake_d103');
    preflight.databaseDoApp = bancoDoApp.database;

    // preflight item 7
    assert.notEqual(globalThis.fetch, fetchOriginal);
    preflight.guardaInstalada = globalThis.fetch !== fetchOriginal;

    // ---------------------------------------------------------------- fixtures
    origemAtual = 'fixtures';
    const argon2 = await import('argon2');
    const senhaHash = await argon2.hash(senhaSintetica, {
      type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1,
    });

    await prisma.usuario.createMany({ data: [
      { id: ua, nome: `${marker} cliente A`, email: `${marker}-a@example.test`, telefone: '11900000001', credencialSenha: senhaHash, perfil: PerfilUsuario.CLIENTE },
      { id: ub, nome: `${marker} cliente B`, email: `${marker}-b@example.test`, telefone: '11900000002', credencialSenha: senhaHash, perfil: PerfilUsuario.CLIENTE },
      { id: adm, nome: `${marker} admin`, email: `${marker}-adm@example.test`, telefone: '11900000003', credencialSenha: senhaHash, perfil: PerfilUsuario.ADMIN },
      { id: entA, nome: `${marker} entregador A`, email: `${marker}-enta@example.test`, telefone: '11900000004', credencialSenha: senhaHash, perfil: PerfilUsuario.ENTREGADOR },
      { id: entB, nome: `${marker} entregador B`, email: `${marker}-entb@example.test`, telefone: '11900000005', credencialSenha: senhaHash, perfil: PerfilUsuario.ENTREGADOR },
      { id: uDel, nome: `${marker} descartavel`, email: `${marker}-del@example.test`, telefone: '11900000006', credencialSenha: senhaHash, perfil: PerfilUsuario.CLIENTE },
    ] });

    await prisma.categoria.create({ data: { id: categoriaId, nome: `${marker} categoria` } });
    await prisma.personalizacao.createMany({ data: [
      { id: persId, nome: `${marker} pers`, ajusteValor: '1.00' },
      { id: persAdmId, nome: `${marker} pers adm`, ajusteValor: '2.00' },
    ] });
    await prisma.produto.createMany({ data: [
      { id: prodId, categoriaId, nome: `${marker} produto`, precoAtual: '10.00', ativo: true },
      { id: prodAdmId, categoriaId, nome: `${marker} produto adm`, precoAtual: '10.00', ativo: true },
    ] });
    await prisma.estoque.createMany({ data: [
      { produtoId: prodId, quantidadeFisica: 10, quantidadeReservada: 0 },
      { produtoId: prodAdmId, quantidadeFisica: 10, quantidadeReservada: 0 },
    ] });
    await prisma.produtoPersonalizacao.create({ data: { produtoId: prodId, personalizacaoId: persId } });

    await prisma.carrinho.createMany({ data: [
      { id: carrinhoAId, usuarioId: ua },
      { id: carrinhoBId, usuarioId: ub },
    ] });
    await prisma.itemCarrinho.createMany({ data: [
      { id: itemAId, carrinhoId: carrinhoAId, produtoId: prodId, quantidade: 2 },
      { id: itemBId, carrinhoId: carrinhoBId, produtoId: prodId, quantidade: 1 },
    ] });

    await prisma.endereco.createMany({ data: [
      { id: endAId, usuarioId: ua, rua: `${marker} rua A`, numero: '1', bairro: 'Centro', cidade: 'Sao Paulo', cep: '01001000' },
      { id: endBId, usuarioId: ub, rua: `${marker} rua B`, numero: '2', bairro: 'Centro', cidade: 'Sao Paulo', cep: '01001001' },
    ] });

    await prisma.configuracaoLojaEntrega.create({ data: {
      id: configId,
      latitudeLoja: configOriginal.latitudeLoja,
      longitudeLoja: configOriginal.longitudeLoja,
      raioMaximoAtendimento: configOriginal.raioMaximoAtendimento,
      taxaBase: configOriginal.taxaBase,
      valorPorQuilometro: configOriginal.valorPorQuilometro,
    } });
    const totalConfig = await prisma.configuracaoLojaEntrega.count();
    assert.equal(totalConfig, 1);
    preflight.configuracaoUnica = totalConfig;

    const agora = new Date();
    const snapshotEnderecoB = {
      rua: `${marker} rua B`, numero: '2', bairro: 'Centro', cidade: 'Sao Paulo', cep: '01001001',
    };
    const criarPedido = async (dados: {
      id: string; identificador: string; cliente: string; modalidade: ModalidadeRecebimento;
      status: StatusPedido; entregador?: string; snapshot?: boolean;
    }) => {
      await prisma.pedido.create({ data: {
        id: dados.id,
        identificadorNegocio: dados.identificador,
        clienteUsuarioId: dados.cliente,
        entregadorUsuarioId: dados.entregador ?? null,
        modalidade: dados.modalidade,
        statusAtual: dados.status,
        valorItens: '10.00',
        freteAplicado: dados.modalidade === ModalidadeRecebimento.ENTREGA ? '2.00' : '0.00',
        total: dados.modalidade === ModalidadeRecebimento.ENTREGA ? '12.00' : '10.00',
        data: agora,
        confirmacaoPagamento: dados.status === StatusPedido.PENDENTE_PAGAMENTO ? null : agora,
        ...(dados.snapshot ? { enderecoEntregaSnapshot: { create: snapshotEnderecoB } } : {}),
      } });
      await prisma.historicoStatusPedido.create({ data: {
        pedidoId: dados.id, statusRegistrado: dados.status, dataHora: agora,
      } });
    };

    await criarPedido({ id: pedBPend, identificador: `${marker}-BPEND`, cliente: ub, modalidade: ModalidadeRecebimento.ENTREGA, status: StatusPedido.PENDENTE_PAGAMENTO, snapshot: true });
    await criarPedido({ id: pedBPago, identificador: `${marker}-BPAGO`, cliente: ub, modalidade: ModalidadeRecebimento.ENTREGA, status: StatusPedido.PAGO, snapshot: true });
    await criarPedido({ id: pedAPagRec, identificador: `${marker}-APAGREC`, cliente: ua, modalidade: ModalidadeRecebimento.RETIRADA, status: StatusPedido.PENDENTE_PAGAMENTO });
    await criarPedido({ id: pedEntAConfirm, identificador: `${marker}-ENTACONF`, cliente: ua, modalidade: ModalidadeRecebimento.ENTREGA, status: StatusPedido.SAIU_PARA_ENTREGA, entregador: entA, snapshot: true });
    await criarPedido({ id: pedEntAAlheio, identificador: `${marker}-ENTAALH`, cliente: ua, modalidade: ModalidadeRecebimento.ENTREGA, status: StatusPedido.SAIU_PARA_ENTREGA, entregador: entA, snapshot: true });
    await criarPedido({ id: pedEntB, identificador: `${marker}-ENTB`, cliente: ua, modalidade: ModalidadeRecebimento.ENTREGA, status: StatusPedido.SAIU_PARA_ENTREGA, entregador: entB, snapshot: true });
    await criarPedido({ id: pedAdmDeny, identificador: `${marker}-ADMDENY`, cliente: ua, modalidade: ModalidadeRecebimento.RETIRADA, status: StatusPedido.PAGO });
    await criarPedido({ id: pedAdmCtl, identificador: `${marker}-ADMCTL`, cliente: ua, modalidade: ModalidadeRecebimento.RETIRADA, status: StatusPedido.PAGO });
    await criarPedido({ id: pedATent, identificador: `PED-${tentA}`, cliente: ua, modalidade: ModalidadeRecebimento.RETIRADA, status: StatusPedido.PENDENTE_PAGAMENTO });

    await prisma.pagamento.createMany({ data: [
      { id: pagBPix, pedidoId: pedBPend, forma: 'PIX', resultado: 'PENDENTE', valorAplicavel: '12.00' },
      { id: pagBCard, pedidoId: pedBPend, forma: 'CARTAO', resultado: 'PENDENTE', valorAplicavel: '12.00' },
      { id: tentRec, pedidoId: pedAPagRec, forma: 'PIX', resultado: 'RECUSADO', valorAplicavel: '10.00', dataTransacao: agora },
    ] });

    await prisma.historicoStatusPedido.createMany({ data: [
      { pedidoId: pedEntAConfirm, statusRegistrado: StatusPedido.SAIU_PARA_ENTREGA, dataHora: agora, responsavelUsuarioId: adm },
      { pedidoId: pedEntAAlheio, statusRegistrado: StatusPedido.SAIU_PARA_ENTREGA, dataHora: agora, responsavelUsuarioId: adm },
      { pedidoId: pedEntB, statusRegistrado: StatusPedido.SAIU_PARA_ENTREGA, dataHora: agora, responsavelUsuarioId: adm },
    ] });

    fixturesCriadas = true;
    definirTokens();
    const tokenDel = access(uDel, PerfilUsuario.CLIENTE);

    // ================================================================ 5.1 AUT (32)
    const casosAutenticacao: Array<[string, () => Promise<void>]> = [
      ['D103-AUT-001', async () => {
        const { res } = await enviar({
          caso: 'D103-AUT-001', categoria: CATEGORIA_AUT, perfil: 'anônimo', metodo: 'GET',
          rota: '/health', condicao: 'sem token', fixture: '-', fonte: 'health.controller.ts',
        });
        assert.equal(res.status, 200);
        assert.deepEqual(comoObjeto(res.body), { status: 'ok' });
      }],
      ['D103-AUT-002', async () => {
        const { res, ev } = await enviar({
          caso: 'D103-AUT-002', categoria: CATEGORIA_AUT, perfil: 'anônimo', metodo: 'POST',
          rota: '/users', condicao: `corpo válido, e-mail ${emailAut002}`, fixture: 'novo usuário',
          fonte: 'users.controller.ts; users.service.ts L154-190',
          body: { nome: `${marker} aut002`, email: emailAut002, telefone: '11900000007', senha: senhaSintetica },
        });
        assert.equal(res.status, 201);
        const corpo = comoObjeto(res.body);
        assert.equal(corpo.perfil, 'CLIENTE');
        assert.equal(corpo.email, emailAut002);
        assert.equal(typeof corpo.id, 'string');
        usuariosParaLimpeza.add(corpo.id as string);
        ev.estadoDepois = { usuarioCriado: corpo.id, perfil: corpo.perfil };
      }],
      ['D103-AUT-003', async () => {
        const alvo = `${marker.toLowerCase()}-aut003@example.test`;
        const antes = await prisma.usuario.count({ where: { email: alvo } });
        const { res, ev } = await enviar({
          caso: 'D103-AUT-003', categoria: CATEGORIA_AUT, perfil: 'anônimo', metodo: 'POST',
          rota: '/users', condicao: 'corpo válido + perfil:"ADMIN"', fixture: 'novo usuário',
          fonte: 'ValidationPipe forbidNonWhitelisted',
          body: { nome: `${marker} aut003`, email: alvo, telefone: '11900000008', senha: senhaSintetica, perfil: 'ADMIN' },
          estadoAntes: { usuariosComEmail: antes },
        });
        assert.equal(res.status, 400);
        const depois = await prisma.usuario.count({ where: { email: alvo } });
        assert.equal(depois, 0);
        ev.estadoDepois = { usuariosComEmail: depois };
      }],
      ['D103-AUT-004', async () => {
        const { res } = await enviar({
          caso: 'D103-AUT-004', categoria: CATEGORIA_AUT, perfil: 'anônimo', metodo: 'POST',
          rota: '/auth/login', condicao: 'e-mail inexistente', fixture: '-',
          fonte: 'auth.service.ts L22-32',
          body: { email: `${marker.toLowerCase()}-inexistente@example.test`, senha: senhaSintetica },
        });
        esperarErro(res, 401, 'Credenciais inválidas.');
        assert.equal(comoObjeto(res.body).accessToken, undefined);
      }],
      ['D103-AUT-005', async () => {
        const { res } = await enviar({
          caso: 'D103-AUT-005', categoria: CATEGORIA_AUT, perfil: 'anônimo', metodo: 'POST',
          rota: '/auth/refresh', condicao: 'refreshToken:"a.b.c"', fixture: '-',
          fonte: 'auth.service.ts L50-59', body: { refreshToken: 'a.b.c' },
        });
        esperarErro(res, 401, 'Refresh token inválido.');
      }],
    ];

    const rotasSemCredencial: Array<[string, string, string]> = [
      ['D103-AUT-006', '/catalogo/produtos', 'catalogo.controller.ts'],
      ['D103-AUT-007', '/carrinho', 'carrinho.controller.ts'],
      ['D103-AUT-008', '/enderecos', 'enderecos.controller.ts'],
      ['D103-AUT-009', '/pedidos', 'pedidos.controller.ts'],
      ['D103-AUT-010', `/pedidos/${pedBPend}/pagamentos/pix/${pagBPix}`, 'pagamentos.controller.ts'],
      ['D103-AUT-011', '/entregador/pedidos', 'entregador-pedidos.controller.ts'],
      ['D103-AUT-012', '/admin/categorias', 'categorias.controller.ts'],
      ['D103-AUT-013', '/admin/personalizacoes', 'personalizacoes.controller.ts'],
      ['D103-AUT-014', '/admin/produtos', 'produtos.controller.ts'],
      ['D103-AUT-015', `/admin/produtos/${prodId}/estoque`, 'estoque.controller.ts'],
      ['D103-AUT-016', `/admin/produtos/${prodId}/personalizacoes`, 'produto-personalizacoes.controller.ts'],
      ['D103-AUT-017', '/admin/configuracao-loja-entrega', 'configuracao-loja-entrega.controller.ts'],
      ['D103-AUT-018', '/admin/relatorios/vendas', 'relatorios.controller.ts'],
      ['D103-AUT-019', '/admin/pedidos', 'admin-pedidos.controller.ts'],
      ['D103-AUT-020', '/admin/entregadores', 'admin-entregadores.controller.ts'],
    ];
    for (const [id, rota, fonte] of rotasSemCredencial) {
      casosAutenticacao.push([id, async () => {
        const { res } = await enviar({
          caso: id, categoria: CATEGORIA_AUT, perfil: 'anônimo', metodo: 'GET', rota,
          condicao: 'sem header Authorization', fixture: '-', fonte,
        });
        esperarErro(res, 401, 'Access token inválido.');
        assert.equal(comoObjeto(res.body).itens, undefined);
        assert.equal(comoObjeto(res.body).items, undefined);
      }]);
    }

    const tokenValidoA = tokensValidos.get('CLIENTE-A')!;
    const segundosAgora = Math.floor(Date.now() / 1000);
    const tokenSegredoErrado = assinar(
      { sub: ua, perfil: PerfilUsuario.CLIENTE, type: 'access' },
      { segredo: `d103-outro-${randomUUID()}`, expiraEm: '15m' },
    );
    const tokenPerfilDivergente = assinar(
      { sub: ua, perfil: PerfilUsuario.ADMIN, type: 'access' }, { expiraEm: '15m' },
    );
    const tokenTipoRefresh = assinar({
      sub: ua, perfil: PerfilUsuario.CLIENTE, type: 'refresh',
      iat: segundosAgora - 10, exp: segundosAgora + 3600,
    });
    const tokenSemExp = assinar({ sub: ua, perfil: PerfilUsuario.CLIENTE, type: 'access' });
    const tokenExpiradoCliente = assinar({
      sub: ua, perfil: PerfilUsuario.CLIENTE, type: 'access', exp: segundosAgora - 60,
    });
    const tokenExpiradoEntregador = assinar({
      sub: entA, perfil: PerfilUsuario.ENTREGADOR, type: 'access', exp: segundosAgora - 60,
    });
    const tokenExpiradoAdmin = assinar({
      sub: adm, perfil: PerfilUsuario.ADMIN, type: 'access', exp: segundosAgora - 60,
    });
    const refreshExpirado = assinar({
      sub: ua, perfil: PerfilUsuario.CLIENTE, type: 'refresh',
      iat: segundosAgora - 3600, exp: segundosAgora - 60,
    }, { segredo: segredoRefresh });

    const casosInvalidos: Array<{
      id: string; perfil: string; rota: string; condicao: string;
      header: string; headerEvidencia: string; fonte: string;
    }> = [
      { id: 'D103-AUT-021', perfil: 'CLIENTE', rota: '/carrinho', condicao: 'Bearer a.b.c', header: 'Bearer a.b.c', headerEvidencia: 'Bearer a.b.c', fonte: 'jwt-auth.guard.ts L35-41' },
      { id: 'D103-AUT-022', perfil: 'CLIENTE', rota: '/carrinho', condicao: 'JWT HS256 assinado com segredo diferente', header: `Bearer ${tokenSegredoErrado}`, headerEvidencia: 'Bearer token:segredo-diferente', fonte: 'jwt-auth.guard.ts L43-51' },
      { id: 'D103-AUT-023', perfil: 'CLIENTE', rota: '/carrinho', condicao: 'Authorization: Basic …', header: 'Basic YWJjOjEyMw==', headerEvidencia: 'Basic <credencial>', fonte: 'BEARER_PATTERN L14' },
      { id: 'D103-AUT-025', perfil: 'CLIENTE', rota: '/carrinho', condicao: 'JWT com type=refresh usado como access', header: `Bearer ${tokenTipoRefresh}`, headerEvidencia: 'Bearer token:type-refresh', fonte: 'jwt-auth.guard.ts L56' },
      { id: 'D103-AUT-026', perfil: 'CLIENTE-A', rota: '/admin/categorias', condicao: 'access assinado com perfil:"ADMIN" para usuário CLIENTE no banco', header: `Bearer ${tokenPerfilDivergente}`, headerEvidencia: 'Bearer token:perfil-divergente', fonte: 'jwt-auth.guard.ts L68-71' },
      { id: 'D103-AUT-028', perfil: 'CLIENTE', rota: '/carrinho', condicao: 'access sem exp', header: `Bearer ${tokenSemExp}`, headerEvidencia: 'Bearer token:sem-exp', fonte: 'jwt-auth.guard.ts L53-66' },
      { id: 'D103-AUT-029', perfil: 'CLIENTE-A', rota: '/carrinho', condicao: 'exp = agora-60s; assinatura válida', header: `Bearer ${tokenExpiradoCliente}`, headerEvidencia: 'Bearer token:CLIENTE-A-expirado', fonte: 'jwt-auth.guard.ts L53-66' },
      { id: 'D103-AUT-030', perfil: 'ENTREGADOR-A', rota: '/entregador/pedidos', condicao: 'exp = agora-60s; assinatura válida', header: `Bearer ${tokenExpiradoEntregador}`, headerEvidencia: 'Bearer token:ENTREGADOR-A-expirado', fonte: 'jwt-auth.guard.ts L53-66' },
      { id: 'D103-AUT-031', perfil: 'ADMIN', rota: '/admin/categorias', condicao: 'exp = agora-60s; assinatura válida', header: `Bearer ${tokenExpiradoAdmin}`, headerEvidencia: 'Bearer token:ADMIN-expirado', fonte: 'jwt-auth.guard.ts L53-66' },
    ];

    for (const caso of casosInvalidos) {
      casosAutenticacao.push([caso.id, async () => {
        const { res } = await enviar({
          caso: caso.id, categoria: CATEGORIA_AUT, perfil: caso.perfil, metodo: 'GET', rota: caso.rota,
          condicao: caso.condicao, fixture: '-', fonte: caso.fonte,
          auth: caso.header, headerEvidencia: caso.headerEvidencia,
        });
        esperarErro(res, 401, 'Access token inválido.');
      }]);
    }

    casosAutenticacao.push(['D103-AUT-024', async () => {
      const resposta = await new Promise<{ status: number; body: string }>((concluir, rejeitar) => {
        const requisicao = httpRequest({
          hostname: '127.0.0.1', port: portaHttp, path: '/carrinho', method: 'GET',
          headers: { Authorization: [`Bearer ${tokenValidoA}`, `Bearer ${tokenValidoA}`] },
        }, (incoming) => {
          let acumulado = '';
          incoming.setEncoding('utf8');
          incoming.on('data', (pedaco: string) => { acumulado += pedaco; });
          incoming.on('end', () => concluir({ status: incoming.statusCode ?? 0, body: acumulado }));
        });
        requisicao.on('error', rejeitar);
        requisicao.end();
      });
      const corpo = JSON.parse(resposta.body || '{}') as unknown;
      registrar({
        caso: 'D103-AUT-024', categoria: CATEGORIA_AUT, perfil: 'CLIENTE-A', metodo: 'GET',
        rota: '/carrinho', condicao: 'dois headers Authorization válidos (node:http cru)',
        fixture: '-', headers: { Authorization: 'Bearer token:CLIENTE-A (duplicado)' },
        status: resposta.status, message: comoObjeto(corpo).message ?? null,
        resposta: sanitizar(corpo), estadoAntes: null, estadoDepois: null,
        fonte: 'jwt-auth.guard.ts L26-33',
      });
      esperarErro({ status: resposta.status, body: corpo }, 401, 'Access token inválido.');
    }]);

    casosAutenticacao.push(['D103-AUT-027', async () => {
      assert.equal(await prisma.usuario.count({ where: { id: uDel } }), 1);
      await prisma.usuario.delete({ where: { id: uDel } });
      const { res, ev } = await enviar({
        caso: 'D103-AUT-027', categoria: CATEGORIA_AUT, perfil: 'CLIENTE (usuário removido)', metodo: 'GET',
        rota: '/carrinho', condicao: 'access válido de usuário removido do banco (F-DEL apagado no caso)',
        fixture: 'F-DEL', fonte: 'jwt-auth.guard.ts L68-71',
        auth: `Bearer ${tokenDel}`, headerEvidencia: 'Bearer token:F-DEL',
      });
      esperarErro(res, 401, 'Access token inválido.');
      ev.estadoDepois = { usuarioRemovidoExiste: await prisma.usuario.count({ where: { id: uDel } }) };
    }]);

    casosAutenticacao.push(['D103-AUT-032', async () => {
      const { res } = await enviar({
        caso: 'D103-AUT-032', categoria: CATEGORIA_AUT, perfil: 'anônimo', metodo: 'POST',
        rota: '/auth/refresh', condicao: 'refresh com exp no passado e iat numérico', fixture: '-',
        fonte: 'auth.service.ts L50-80', body: { refreshToken: refreshExpirado },
      });
      esperarErro(res, 401, 'Refresh token inválido.');
    }]);

    for (const [id, caso] of casosAutenticacao) {
      if (abortado) { marcarNaoExecutado(id); continue; }
      try { await executar(id, caso); } catch { abortar(id); }
    }

    // ================================================================ 5.2 RBC (16)
    const rbacSimples: Array<[string, string, string, string]> = [
      ['D103-RBC-001', 'ADMIN', '/catalogo/produtos', 'catalogo.controller.ts'],
      ['D103-RBC-002', 'ENTREGADOR-A', '/catalogo/produtos', 'catalogo.controller.ts'],
      ['D103-RBC-003', 'ADMIN', '/carrinho', 'carrinho.controller.ts'],
      ['D103-RBC-004', 'ENTREGADOR-A', '/carrinho', 'carrinho.controller.ts'],
      ['D103-RBC-005', 'ADMIN', '/enderecos', 'enderecos.controller.ts'],
      ['D103-RBC-006', 'ENTREGADOR-A', '/enderecos', 'enderecos.controller.ts'],
      ['D103-RBC-007', 'ADMIN', '/pedidos', 'pedidos.controller.ts'],
      ['D103-RBC-008', 'ENTREGADOR-A', '/pedidos', 'pedidos.controller.ts'],
      ['D103-RBC-009', 'ADMIN', `/pedidos/${pedBPend}/pagamentos/pix/${pagBPix}`, 'pagamentos.controller.ts'],
      ['D103-RBC-010', 'ENTREGADOR-A', `/pedidos/${pedBPend}/pagamentos/pix/${pagBPix}`, 'pagamentos.controller.ts'],
      ['D103-RBC-011', 'CLIENTE-A', '/entregador/pedidos', 'entregador-pedidos.controller.ts'],
      ['D103-RBC-012', 'ADMIN', '/entregador/pedidos', 'entregador-pedidos.controller.ts'],
      ['D103-RBC-013', 'CLIENTE-A', `/entregador/pedidos/${pedEntAAlheio}`, 'entregador-pedidos.controller.ts'],
      ['D103-RBC-014', 'ADMIN', `/entregador/pedidos/${pedEntAAlheio}`, 'entregador-pedidos.controller.ts'],
    ];

    for (const [id, perfil, rota, fonte] of rbacSimples) {
      if (abortado) { marcarNaoExecutado(id); continue; }
      try {
        await executar(id, async () => {
          const { res } = await enviar({
            caso: id, categoria: CATEGORIA_RBC, perfil, metodo: 'GET', rota,
            condicao: `identidade legítima ${perfil} em rota de outro perfil`, fixture: '-', fonte,
            auth: auth(perfil), headerEvidencia: `Bearer token:${perfil}`,
          });
          esperarErro(res, 403, 'Acesso negado.');
          assert.equal(comoObjeto(res.body).itens, undefined);
          assert.equal(comoObjeto(res.body).items, undefined);
          assert.equal(comoObjeto(res.body).pedidos, undefined);
          assert.equal(comoObjeto(res.body).cliente, undefined);
          assert.equal(comoObjeto(res.body).enderecoEntregaSnapshot, undefined);
          assert.equal(Array.isArray(res.body), false);
        });
      } catch { abortar(id); }
    }

    for (const id of ['D103-RBC-015', 'D103-RBC-016']) {
      if (abortado) { marcarNaoExecutado(id); continue; }
      const perfil = id === 'D103-RBC-015' ? 'CLIENTE-A' : 'ADMIN';
      try {
        await executar(id, async () => {
          const antes = await prisma.historicoStatusPedido.count({ where: { pedidoId: pedEntAAlheio } });
          const { res, ev } = await enviar({
            caso: id, categoria: CATEGORIA_RBC, perfil, metodo: 'PATCH',
            rota: `/entregador/pedidos/${pedEntAAlheio}/confirmar-entrega`,
            condicao: 'identidade legítima de outro perfil sobre pedido de ENT-A',
            fixture: 'F-PED-ENT-A-ALHEIO', fonte: 'entregador-pedidos.controller.ts',
            auth: auth(perfil), headerEvidencia: `Bearer token:${perfil}`,
            estadoAntes: { historicos: antes },
          });
          esperarErro(res, 403, 'Acesso negado.');
          const pedido = await prisma.pedido.findUniqueOrThrow({ where: { id: pedEntAAlheio } });
          const depois = await prisma.historicoStatusPedido.count({ where: { pedidoId: pedEntAAlheio } });
          assert.equal(pedido.statusAtual, StatusPedido.SAIU_PARA_ENTREGA);
          assert.equal(depois, antes);
          assert.equal(await prisma.historicoStatusPedido.count({
            where: { pedidoId: pedEntAAlheio, statusRegistrado: StatusPedido.ENTREGUE },
          }), 0);
          ev.estadoDepois = { statusAtual: pedido.statusAtual, historicos: depois };
        });
      } catch { abortar(id); }
    }

    // ================================================================ 5.3 ADM (28)
    const admId = (numero: number) => `D103-ADM-${pad3(numero)}`;
    const casosAdmin: Array<[string, () => Promise<void>]> = [];

    // negações 001..006
    const negacoesCriacao: Array<[number, string, 'categoria' | 'personalizacao' | 'produto']> = [
      [1, 'CLIENTE-A', 'categoria'], [2, 'ENTREGADOR-A', 'categoria'],
      [3, 'CLIENTE-A', 'personalizacao'], [4, 'ENTREGADOR-A', 'personalizacao'],
      [5, 'CLIENTE-A', 'produto'], [6, 'ENTREGADOR-A', 'produto'],
    ];
    for (const [numero, perfil, tipo] of negacoesCriacao) {
      casosAdmin.push([admId(numero), async () => {
        if (tipo === 'categoria') {
          const antes = await prisma.categoria.count({ where: { nome: nomeDeny001 } });
          const { res, ev } = await enviar({
            caso: admId(numero), categoria: CATEGORIA_ADM, perfil, metodo: 'POST', rota: '/admin/categorias',
            condicao: 'payload válido de criação de categoria', fixture: '-',
            fonte: 'categorias.controller.ts', auth: auth(perfil), headerEvidencia: `Bearer token:${perfil}`,
            body: { nome: nomeDeny001, descricao: 'negado' }, estadoAntes: { criadas: antes },
          });
          esperarErro(res, 403, 'Acesso negado.');
          const depois = await prisma.categoria.count({ where: { nome: nomeDeny001 } });
          assert.equal(depois, 0);
          ev.estadoDepois = { criadas: depois };
          return;
        }
        if (tipo === 'personalizacao') {
          const antes = await prisma.personalizacao.count({ where: { nome: nomeDeny003 } });
          const { res, ev } = await enviar({
            caso: admId(numero), categoria: CATEGORIA_ADM, perfil, metodo: 'POST', rota: '/admin/personalizacoes',
            condicao: 'payload válido de personalização', fixture: '-',
            fonte: 'personalizacoes.controller.ts', auth: auth(perfil), headerEvidencia: `Bearer token:${perfil}`,
            body: { nome: nomeDeny003, ajusteValor: '1.00' }, estadoAntes: { criadas: antes },
          });
          esperarErro(res, 403, 'Acesso negado.');
          const depois = await prisma.personalizacao.count({ where: { nome: nomeDeny003 } });
          assert.equal(depois, 0);
          ev.estadoDepois = { criadas: depois };
          return;
        }
        const antes = await prisma.produto.count({ where: { nome: nomeDeny005 } });
        const { res, ev } = await enviar({
          caso: admId(numero), categoria: CATEGORIA_ADM, perfil, metodo: 'POST', rota: '/admin/produtos',
          condicao: 'payload válido de produto (categoria F-CAT)', fixture: 'F-CAT',
          fonte: 'produtos.controller.ts', auth: auth(perfil), headerEvidencia: `Bearer token:${perfil}`,
          body: { categoriaId, nome: nomeDeny005, precoAtual: '10.00', ativo: true },
          estadoAntes: { criados: antes },
        });
        esperarErro(res, 403, 'Acesso negado.');
        const depois = await prisma.produto.count({ where: { nome: nomeDeny005 } });
        assert.equal(depois, 0);
        ev.estadoDepois = { criados: depois };
      }]);
    }

    for (const [numero, perfil] of [[7, 'CLIENTE-A'], [8, 'ENTREGADOR-A']] as Array<[number, string]>) {
      casosAdmin.push([admId(numero), async () => {
        const antes = await prisma.estoque.findUniqueOrThrow({ where: { produtoId: prodId } });
        const movAntes = await prisma.movimentacaoEstoque.count({ where: { produtoId: prodId } });
        const { res, ev } = await enviar({
          caso: admId(numero), categoria: CATEGORIA_ADM, perfil, metodo: 'PATCH',
          rota: `/admin/produtos/${prodId}/estoque`, condicao: 'ajuste válido para disponível 7',
          fixture: 'F-PROD', fonte: 'estoque.controller.ts', auth: auth(perfil), headerEvidencia: `Bearer token:${perfil}`,
          body: { quantidadeDisponivel: 7 },
          estadoAntes: { quantidadeFisica: antes.quantidadeFisica, quantidadeReservada: antes.quantidadeReservada, movimentacoes: movAntes },
        });
        esperarErro(res, 403, 'Acesso negado.');
        const depois = await prisma.estoque.findUniqueOrThrow({ where: { produtoId: prodId } });
        assert.equal(depois.quantidadeFisica, 10);
        assert.equal(depois.quantidadeReservada, 0);
        assert.equal(await prisma.movimentacaoEstoque.count({ where: { produtoId: prodId } }), 0);
        ev.estadoDepois = { quantidadeFisica: depois.quantidadeFisica, quantidadeReservada: depois.quantidadeReservada, movimentacoes: 0 };
      }]);
    }

    for (const [numero, perfil] of [[9, 'CLIENTE-A'], [10, 'ENTREGADOR-A']] as Array<[number, string]>) {
      casosAdmin.push([admId(numero), async () => {
        const antes = await prisma.produtoPersonalizacao.count({
          where: { produtoId: prodAdmId, personalizacaoId: persAdmId },
        });
        const { res, ev } = await enviar({
          caso: admId(numero), categoria: CATEGORIA_ADM, perfil, metodo: 'POST',
          rota: `/admin/produtos/${prodAdmId}/personalizacoes`,
          condicao: 'vínculo válido do par não vinculado F-PROD-ADM ↔ F-PERS-ADM',
          fixture: 'F-PROD-ADM, F-PERS-ADM', fonte: 'produto-personalizacoes.controller.ts',
          auth: auth(perfil), headerEvidencia: `Bearer token:${perfil}`,
          body: { personalizacaoId: persAdmId }, estadoAntes: { vinculosNoPar: antes },
        });
        esperarErro(res, 403, 'Acesso negado.');
        const depois = await prisma.produtoPersonalizacao.count({
          where: { produtoId: prodAdmId, personalizacaoId: persAdmId },
        });
        assert.equal(depois, 0);
        ev.estadoDepois = { vinculosNoPar: depois };
      }]);
    }

    for (const [numero, perfil] of [[11, 'CLIENTE-A'], [12, 'ENTREGADOR-A']] as Array<[number, string]>) {
      casosAdmin.push([admId(numero), async () => {
        const antes = await lerConfig();
        const { res, ev } = await enviar({
          caso: admId(numero), categoria: CATEGORIA_ADM, perfil, metodo: 'PUT',
          rota: '/admin/configuracao-loja-entrega', condicao: 'valores distintos de F-CONFIG',
          fixture: 'F-CONFIG', fonte: 'configuracao-loja-entrega.controller.ts',
          auth: auth(perfil), headerEvidencia: `Bearer token:${perfil}`,
          body: configAlterada, estadoAntes: antes,
        });
        esperarErro(res, 403, 'Acesso negado.');
        const depois = await lerConfig();
        assert.deepEqual(depois, antes);
        ev.estadoDepois = depois;
      }]);
    }

    for (const [numero, perfil] of [[13, 'CLIENTE-A'], [14, 'ENTREGADOR-A']] as Array<[number, string]>) {
      casosAdmin.push([admId(numero), async () => {
        const { res } = await enviar({
          caso: admId(numero), categoria: CATEGORIA_ADM, perfil, metodo: 'GET',
          rota: `/admin/relatorios/vendas?${queryRelatorio}`, condicao: 'intervalo válido do dia atual',
          fixture: '-', fonte: 'relatorios.controller.ts', auth: auth(perfil), headerEvidencia: `Bearer token:${perfil}`,
        });
        esperarErro(res, 403, 'Acesso negado.');
        assert.equal(comoObjeto(res.body).pedidos, undefined);
      }]);
    }

    for (const [numero, perfil] of [[15, 'CLIENTE-A'], [16, 'ENTREGADOR-A']] as Array<[number, string]>) {
      casosAdmin.push([admId(numero), async () => {
        const antesStatus = await prisma.pedido.findUniqueOrThrow({ where: { id: pedAdmDeny } });
        const antesHist = await prisma.historicoStatusPedido.count({ where: { pedidoId: pedAdmDeny } });
        const { res, ev } = await enviar({
          caso: admId(numero), categoria: CATEGORIA_ADM, perfil, metodo: 'PATCH',
          rota: `/admin/pedidos/${pedAdmDeny}/iniciar-producao`, condicao: 'transição válida a partir de PAGO',
          fixture: 'F-PED-ADM-DENY', fonte: 'admin-pedidos.controller.ts',
          auth: auth(perfil), headerEvidencia: `Bearer token:${perfil}`,
          estadoAntes: { statusAtual: antesStatus.statusAtual, historicos: antesHist },
        });
        esperarErro(res, 403, 'Acesso negado.');
        const depoisStatus = await prisma.pedido.findUniqueOrThrow({ where: { id: pedAdmDeny } });
        const depoisHist = await prisma.historicoStatusPedido.count({ where: { pedidoId: pedAdmDeny } });
        assert.equal(depoisStatus.statusAtual, StatusPedido.PAGO);
        assert.equal(depoisHist, antesHist);
        ev.estadoDepois = { statusAtual: depoisStatus.statusAtual, historicos: depoisHist, notificacoes: 'verificadas na drenagem final' };
      }]);
    }

    for (const [numero, perfil] of [[17, 'CLIENTE-A'], [18, 'ENTREGADOR-A']] as Array<[number, string]>) {
      casosAdmin.push([admId(numero), async () => {
        const antes = await prisma.usuario.count({ where: { email: emailDeny017 } });
        const { res, ev } = await enviar({
          caso: admId(numero), categoria: CATEGORIA_ADM, perfil, metodo: 'POST',
          rota: '/admin/entregadores', condicao: `payload válido com e-mail ${emailDeny017}`, fixture: '-',
          fonte: 'admin-entregadores.controller.ts', auth: auth(perfil), headerEvidencia: `Bearer token:${perfil}`,
          body: { nome: `${marker} deny`, email: emailDeny017, telefone: '11900000009', senha: senhaSintetica },
          estadoAntes: { usuariosComEmail: antes },
        });
        esperarErro(res, 403, 'Acesso negado.');
        const depois = await prisma.usuario.count({ where: { email: emailDeny017 } });
        assert.equal(depois, 0);
        ev.estadoDepois = { usuariosComEmail: depois };
      }]);
    }

    // controles autorizados 019..028
    casosAdmin.push(['D103-ADM-019', async () => {
      const { res } = await enviar({
        caso: 'D103-ADM-019', categoria: CATEGORIA_ADM, perfil: 'ADMIN', metodo: 'GET',
        rota: '/admin/categorias', condicao: 'controle autorizado', fixture: 'F-CAT',
        fonte: 'categorias.controller.ts', auth: auth('ADMIN'), headerEvidencia: 'Bearer token:ADMIN',
      });
      assert.equal(res.status, 200);
      assert.equal(comoLista(res.body).some((linha) => linha.id === categoriaId), true);
    }]);

    casosAdmin.push(['D103-ADM-020', async () => {
      const { res } = await enviar({
        caso: 'D103-ADM-020', categoria: CATEGORIA_ADM, perfil: 'ADMIN', metodo: 'GET',
        rota: '/admin/produtos', condicao: 'controle autorizado', fixture: 'F-PROD',
        fonte: 'produtos.controller.ts', auth: auth('ADMIN'), headerEvidencia: 'Bearer token:ADMIN',
      });
      assert.equal(res.status, 200);
      assert.equal(comoLista(res.body).some((linha) => linha.id === prodId), true);
    }]);

    casosAdmin.push(['D103-ADM-021', async () => {
      const { res } = await enviar({
        caso: 'D103-ADM-021', categoria: CATEGORIA_ADM, perfil: 'ADMIN', metodo: 'GET',
        rota: '/admin/pedidos', condicao: 'controle autorizado de listagem', fixture: 'F-PED-ADM-DENY',
        fonte: 'admin-pedidos.controller.ts', auth: auth('ADMIN'), headerEvidencia: 'Bearer token:ADMIN',
      });
      assert.equal(res.status, 200);
      assert.equal(comoLista(res.body).some((linha) => linha.id === pedAdmDeny), true);
    }]);

    casosAdmin.push(['D103-ADM-022', async () => {
      const { res } = await enviar({
        caso: 'D103-ADM-022', categoria: CATEGORIA_ADM, perfil: 'ADMIN', metodo: 'GET',
        rota: `/admin/relatorios/vendas?${queryRelatorio}`, condicao: 'intervalo UTC derivado de data',
        fixture: '-', fonte: 'relatorios.service.ts', auth: auth('ADMIN'), headerEvidencia: 'Bearer token:ADMIN',
      });
      assert.equal(res.status, 200);
      const corpo = comoObjeto(res.body);
      assert.equal(corpo.inicio, hojeLocal);
      assert.equal(corpo.fim, hojeLocal);
      assert.match(texto(corpo.totalVendido), /^\d+\.\d{2}$/);
      const lista = comoLista(corpo.pedidos);
      assert.equal(corpo.quantidadePedidos, lista.length);
      const { inicio, fimExclusivo } = intervaloRelatorioUtc(hojeLocal, hojeLocal);
      for (const pedido of lista) {
        assert.equal(['ENTREGUE', 'RETIRADO'].includes(texto(pedido.statusAtual)), true);
        const data = new Date(texto(pedido.data));
        assert.equal(data.getTime() >= inicio.getTime(), true);
        assert.equal(data.getTime() < fimExclusivo.getTime(), true);
      }
    }]);

    casosAdmin.push(['D103-ADM-023', async () => {
      const egressAntes = egressTentativas.length;
      const { res, ev } = await enviar({
        caso: 'D103-ADM-023', categoria: CATEGORIA_ADM, perfil: 'ADMIN', metodo: 'PATCH',
        rota: `/admin/pedidos/${pedAdmCtl}/iniciar-producao`, condicao: 'transição PAGO → EM_PREPARO',
        fixture: 'F-PED-ADM-CTL', fonte: 'pedidos.service.ts L363-404',
        auth: auth('ADMIN'), headerEvidencia: 'Bearer token:ADMIN',
        estadoAntes: { statusAtual: StatusPedido.PAGO, egressTentativas: egressAntes },
      });
      assert.equal(res.status, 200);
      const corpo = comoObjeto(res.body);
      assert.equal(corpo.statusAtual, StatusPedido.EM_PREPARO);
      const historicos = comoLista(corpo.historicoStatus);
      const registro = historicos.find((linha) => linha.status === StatusPedido.EM_PREPARO);
      assert.ok(registro);
      assert.equal(registro.responsavel, `${marker} admin`);
      assert.equal(egressTentativas.length, egressAntes);
      ev.estadoDepois = { statusAtual: corpo.statusAtual, historicos: historicos.length, egressTentativas: egressTentativas.length };
    }]);

    casosAdmin.push(['D103-ADM-024', async () => {
      const { res } = await enviar({
        caso: 'D103-ADM-024', categoria: CATEGORIA_ADM, perfil: 'ADMIN', metodo: 'GET',
        rota: '/admin/personalizacoes', condicao: 'controle autorizado', fixture: 'F-PERS, F-PERS-ADM',
        fonte: 'personalizacoes.controller.ts', auth: auth('ADMIN'), headerEvidencia: 'Bearer token:ADMIN',
      });
      assert.equal(res.status, 200);
      const ids = comoLista(res.body).map((linha) => linha.id);
      assert.equal(ids.includes(persId), true);
      assert.equal(ids.includes(persAdmId), true);
    }]);

    casosAdmin.push(['D103-ADM-025', async () => {
      const antes = await prisma.estoque.findUniqueOrThrow({ where: { produtoId: prodAdmId } });
      const { res, ev } = await enviar({
        caso: 'D103-ADM-025', categoria: CATEGORIA_ADM, perfil: 'ADMIN', metodo: 'PATCH',
        rota: `/admin/produtos/${prodAdmId}/estoque`, condicao: 'ajuste autorizado para disponível 7',
        fixture: 'F-PROD-ADM', fonte: 'estoque.service.ts L18-40',
        auth: auth('ADMIN'), headerEvidencia: 'Bearer token:ADMIN', body: { quantidadeDisponivel: 7 },
        estadoAntes: { quantidadeFisica: antes.quantidadeFisica, quantidadeReservada: antes.quantidadeReservada },
      });
      assert.equal(res.status, 200);
      const corpo = comoObjeto(res.body);
      assert.equal(corpo.produtoId, prodAdmId);
      assert.equal(corpo.quantidadeFisica, 7);
      assert.equal(corpo.quantidadeReservada, 0);
      assert.equal(corpo.quantidadeDisponivel, 7);
      const movimentos = await prisma.movimentacaoEstoque.findMany({ where: { produtoId: prodAdmId } });
      assert.equal(movimentos.length, 1);
      assert.equal(movimentos[0].motivoOrigem, 'AJUSTE_ADMINISTRATIVO');
      assert.equal(movimentos[0].quantidade, -3);
      assert.equal(movimentos[0].pedidoId, null);
      assert.equal(Number(corpo.quantidadeFisica) - antes.quantidadeFisica, movimentos[0].quantidade);
      ev.estadoDepois = {
        quantidadeFisica: corpo.quantidadeFisica, quantidadeReservada: corpo.quantidadeReservada,
        quantidadeDisponivel: corpo.quantidadeDisponivel, movimentacoes: movimentos.length,
        quantidadeMovimentacao: movimentos[0].quantidade,
      };
    }]);

    casosAdmin.push(['D103-ADM-026', async () => {
      const { res, ev } = await enviar({
        caso: 'D103-ADM-026', categoria: CATEGORIA_ADM, perfil: 'ADMIN', metodo: 'POST',
        rota: `/admin/produtos/${prodAdmId}/personalizacoes`,
        condicao: 'vínculo autorizado do par F-PROD-ADM ↔ F-PERS',
        fixture: 'F-PROD-ADM, F-PERS', fonte: 'produto-personalizacoes.service.ts L22-31',
        auth: auth('ADMIN'), headerEvidencia: 'Bearer token:ADMIN', body: { personalizacaoId: persId },
        estadoAntes: { vinculosNoPar: 0 },
      });
      assert.equal(res.status, 201);
      const corpo = comoObjeto(res.body);
      assert.equal(corpo.produtoId, prodAdmId);
      assert.equal(corpo.personalizacaoId, persId);
      const vinculos = await prisma.produtoPersonalizacao.count({
        where: { produtoId: prodAdmId, personalizacaoId: persId },
      });
      assert.equal(vinculos, 1);
      ev.estadoDepois = { vinculosNoPar: vinculos };
    }]);

    casosAdmin.push(['D103-ADM-027', async () => {
      const antes = await lerConfig();
      const primeira = await enviar({
        caso: 'D103-ADM-027', categoria: CATEGORIA_ADM, perfil: 'ADMIN', metodo: 'PUT',
        rota: '/admin/configuracao-loja-entrega', condicao: '#1 valores alterados', fixture: 'F-CONFIG',
        fonte: 'configuracao-loja-entrega.service.ts L16-38',
        auth: auth('ADMIN'), headerEvidencia: 'Bearer token:ADMIN', body: configAlterada, estadoAntes: antes,
      });
      assert.equal(primeira.res.status, 200);
      const esperadoAlterado = {
        id: configId,
        latitudeLoja: '-22.900000', longitudeLoja: '-43.200000', raioMaximoAtendimento: '15.000',
        taxaBase: '7.00', valorPorQuilometro: '3.00',
      };
      assert.deepEqual(comoObjeto(primeira.res.body), {
        latitudeLoja: esperadoAlterado.latitudeLoja,
        longitudeLoja: esperadoAlterado.longitudeLoja,
        raioMaximoAtendimento: esperadoAlterado.raioMaximoAtendimento,
        taxaBase: esperadoAlterado.taxaBase,
        valorPorQuilometro: esperadoAlterado.valorPorQuilometro,
      });
      const persistido = await lerConfig();
      assert.deepEqual(persistido, esperadoAlterado);
      primeira.ev.estadoDepois = persistido;

      const segunda = await enviar({
        caso: 'D103-ADM-027', categoria: CATEGORIA_ADM, perfil: 'ADMIN', metodo: 'PUT',
        rota: '/admin/configuracao-loja-entrega', condicao: '#2 restauração dos valores originais',
        fixture: 'F-CONFIG', fonte: 'configuracao-loja-entrega.service.ts L16-38',
        auth: auth('ADMIN'), headerEvidencia: 'Bearer token:ADMIN', body: configOriginal, estadoAntes: persistido,
      });
      assert.equal(segunda.res.status, 200);
      const restaurado = await lerConfig();
      assert.deepEqual(restaurado, {
        id: configId,
        latitudeLoja: '-23.500000', longitudeLoja: '-46.600000', raioMaximoAtendimento: '10.000',
        taxaBase: '5.00', valorPorQuilometro: '2.00',
      });
      assert.deepEqual(restaurado, antes);
      segunda.ev.estadoDepois = restaurado;
    }]);

    casosAdmin.push(['D103-ADM-028', async () => {
      const { res, ev } = await enviar({
        caso: 'D103-ADM-028', categoria: CATEGORIA_ADM, perfil: 'ADMIN', metodo: 'POST',
        rota: '/admin/entregadores', condicao: `criação autorizada com e-mail ${emailAdm028}`,
        fixture: 'F-ENT-ADM-EMAIL', fonte: 'admin-entregadores.controller.ts; users.service.ts L154-190',
        auth: auth('ADMIN'), headerEvidencia: 'Bearer token:ADMIN',
        body: { nome: `${marker} entregador adm`, email: emailAdm028, telefone: '11900000010', senha: senhaSintetica },
        estadoAntes: { usuariosComEmail: 0 },
      });
      assert.equal(res.status, 201);
      const corpo = comoObjeto(res.body);
      assert.equal(corpo.perfil, 'ENTREGADOR');
      assert.equal(corpo.email, emailAdm028);
      assert.equal(corpo.credencialSenha, undefined);
      assert.equal(typeof corpo.id, 'string');
      usuariosParaLimpeza.add(corpo.id as string);
      const persistido = await prisma.usuario.findUniqueOrThrow({ where: { id: corpo.id as string } });
      assert.equal(persistido.perfil, PerfilUsuario.ENTREGADOR);
      ev.estadoDepois = { usuarioCriado: corpo.id, perfil: persistido.perfil };
    }]);

    for (const [id, caso] of casosAdmin) {
      if (abortado) { marcarNaoExecutado(id); continue; }
      try { await executar(id, caso); } catch { abortar(id); }
    }

    // ================================================================ 5.4 OWN-C (22)
    const pedidosDeB = [pedBPend, pedBPago];
    const casosOwnCliente: Array<[string, () => Promise<void>]> = [];

    casosOwnCliente.push(['D103-OWN-C-01', async () => {
      const { res } = await enviar({
        caso: 'D103-OWN-C-01', categoria: CATEGORIA_OWNC, perfil: 'CLIENTE-A', metodo: 'GET',
        rota: '/carrinho', condicao: 'listagem do próprio carrinho', fixture: 'F-CART-A/B',
        fonte: 'carrinho.service.ts', auth: auth('CLIENTE-A'), headerEvidencia: 'Bearer token:CLIENTE-A',
      });
      assert.equal(res.status, 200);
      const ids = comoLista(comoObjeto(res.body).itens).map((linha) => linha.id);
      assert.equal(ids.includes(itemAId), true);
      assert.equal(ids.includes(itemBId), false);
    }]);

    casosOwnCliente.push(['D103-OWN-C-02', async () => {
      const antes = await prisma.itemCarrinho.findUniqueOrThrow({ where: { id: itemBId } });
      const { res, ev } = await enviar({
        caso: 'D103-OWN-C-02', categoria: CATEGORIA_OWNC, perfil: 'CLIENTE-A', metodo: 'PATCH',
        rota: `/carrinho/itens/${itemBId}`, condicao: 'quantidade 99 em item de B', fixture: 'F-CART-B',
        fonte: 'carrinho.service.ts L118-131', auth: auth('CLIENTE-A'), headerEvidencia: 'Bearer token:CLIENTE-A',
        body: { quantidade: 99 }, estadoAntes: { quantidade: antes.quantidade },
      });
      esperarErro(res, 404, 'Item não encontrado.');
      const depois = await prisma.itemCarrinho.findUniqueOrThrow({ where: { id: itemBId } });
      assert.equal(depois.quantidade, 1);
      ev.estadoDepois = { quantidade: depois.quantidade };
    }]);

    casosOwnCliente.push(['D103-OWN-C-03', async () => {
      const { res, ev } = await enviar({
        caso: 'D103-OWN-C-03', categoria: CATEGORIA_OWNC, perfil: 'CLIENTE-A', metodo: 'DELETE',
        rota: `/carrinho/itens/${itemBId}`, condicao: 'remoção de item de B', fixture: 'F-CART-B',
        fonte: 'carrinho.service.ts', auth: auth('CLIENTE-A'), headerEvidencia: 'Bearer token:CLIENTE-A',
        estadoAntes: { itemExiste: 1 },
      });
      esperarErro(res, 404, 'Item não encontrado.');
      const existe = await prisma.itemCarrinho.count({ where: { id: itemBId } });
      assert.equal(existe, 1);
      ev.estadoDepois = { itemExiste: existe };
    }]);

    casosOwnCliente.push(['D103-OWN-C-04', async () => {
      const { res } = await enviar({
        caso: 'D103-OWN-C-04', categoria: CATEGORIA_OWNC, perfil: 'CLIENTE-A', metodo: 'GET',
        rota: '/pedidos', condicao: 'listagem de pedidos do próprio cliente', fixture: 'F-PED-B-*',
        fonte: 'pedidos.service.ts L21-38', auth: auth('CLIENTE-A'), headerEvidencia: 'Bearer token:CLIENTE-A',
      });
      assert.equal(res.status, 200);
      const ids = comoLista(res.body).map((linha) => linha.id);
      for (const id of pedidosDeB) assert.equal(ids.includes(id), false);
    }]);

    casosOwnCliente.push(['D103-OWN-C-05', async () => {
      const antesStatus = await prisma.pedido.findUniqueOrThrow({ where: { id: pedBPago } });
      const histAntes = await prisma.historicoStatusPedido.count({ where: { pedidoId: pedBPago } });
      const reservasAntes = await prisma.reservaEstoque.count({ where: { pedidoId: pedBPago } });
      const movAntes = await prisma.movimentacaoEstoque.count({ where: { pedidoId: pedBPago } });
      const { res, ev } = await enviar({
        caso: 'D103-OWN-C-05', categoria: CATEGORIA_OWNC, perfil: 'CLIENTE-A', metodo: 'PATCH',
        rota: `/pedidos/${pedBPago}/cancelar`, condicao: 'cancelamento de pedido de B', fixture: 'F-PED-B-PAGO',
        fonte: 'pedidos.service.ts L252-258', auth: auth('CLIENTE-A'), headerEvidencia: 'Bearer token:CLIENTE-A',
        estadoAntes: { statusAtual: antesStatus.statusAtual, historicos: histAntes, reservas: reservasAntes, movimentacoes: movAntes },
      });
      esperarErro(res, 404, 'Pedido não encontrado.');
      const depois = await prisma.pedido.findUniqueOrThrow({ where: { id: pedBPago } });
      assert.equal(depois.statusAtual, StatusPedido.PAGO);
      assert.equal(await prisma.historicoStatusPedido.count({ where: { pedidoId: pedBPago } }), histAntes);
      assert.equal(await prisma.reservaEstoque.count({ where: { pedidoId: pedBPago } }), reservasAntes);
      assert.equal(await prisma.movimentacaoEstoque.count({ where: { pedidoId: pedBPago } }), movAntes);
      ev.estadoDepois = { statusAtual: depois.statusAtual, historicos: histAntes, reservas: reservasAntes, movimentacoes: movAntes };
    }]);

    casosOwnCliente.push(['D103-OWN-C-06', async () => {
      const { res } = await enviar({
        caso: 'D103-OWN-C-06', categoria: CATEGORIA_OWNC, perfil: 'CLIENTE-A', metodo: 'GET',
        rota: '/enderecos', condicao: 'listagem dos próprios endereços', fixture: 'F-END-A/B',
        fonte: 'enderecos.service.ts', auth: auth('CLIENTE-A'), headerEvidencia: 'Bearer token:CLIENTE-A',
      });
      assert.equal(res.status, 200);
      const ids = comoLista(res.body).map((linha) => linha.id);
      assert.equal(ids.includes(endAId), true);
      assert.equal(ids.includes(endBId), false);
    }]);

    casosOwnCliente.push(['D103-OWN-C-07', async () => {
      const { res, ev } = await enviar({
        caso: 'D103-OWN-C-07', categoria: CATEGORIA_OWNC, perfil: 'CLIENTE-A', metodo: 'POST',
        rota: `/enderecos/${endBId}/geocodificacao`, condicao: 'geocodificação de endereço de B',
        fixture: 'F-END-B', fonte: 'geocodificacao.service.ts L12-17',
        auth: auth('CLIENTE-A'), headerEvidencia: 'Bearer token:CLIENTE-A',
        estadoAntes: { latitude: null, longitude: null },
      });
      esperarErro(res, 404, 'Endereço não encontrado.');
      const depois = await prisma.endereco.findUniqueOrThrow({ where: { id: endBId } });
      assert.equal(depois.latitude, null);
      assert.equal(depois.longitude, null);
      ev.estadoDepois = { latitude: depois.latitude, longitude: depois.longitude };
    }]);

    casosOwnCliente.push(['D103-OWN-C-08', async () => {
      const { res } = await enviar({
        caso: 'D103-OWN-C-08', categoria: CATEGORIA_OWNC, perfil: 'CLIENTE-A', metodo: 'GET',
        rota: `/enderecos/${endBId}/cobertura-frete`, condicao: 'cobertura de endereço de B',
        fixture: 'F-END-B', fonte: 'cobertura-frete.service.ts L21-27',
        auth: auth('CLIENTE-A'), headerEvidencia: 'Bearer token:CLIENTE-A',
      });
      esperarErro(res, 404, 'Endereço não encontrado.');
      assert.equal(comoObjeto(res.body).situacao, undefined);
    }]);

    casosOwnCliente.push(['D103-OWN-C-09', async () => {
      const antes = await prisma.pagamento.count({ where: { pedidoId: pedBPend } });
      const { res, ev } = await enviar({
        caso: 'D103-OWN-C-09', categoria: CATEGORIA_OWNC, perfil: 'CLIENTE-A', metodo: 'POST',
        rota: `/pedidos/${pedBPend}/pagamentos/pix`, condicao: 'nova tentativa em pedido de B',
        fixture: 'F-PED-B-PEND', fonte: 'pagamentos.service.ts L59-69, L76-78',
        auth: auth('CLIENTE-A'), headerEvidencia: 'Bearer token:CLIENTE-A',
        body: { tentativaId: randomUUID() }, estadoAntes: { pagamentos: antes },
      });
      esperarErro(res, 404, 'Pedido não encontrado.');
      const depois = await prisma.pagamento.count({ where: { pedidoId: pedBPend } });
      assert.equal(depois, 2);
      ev.estadoDepois = { pagamentos: depois };
    }]);

    casosOwnCliente.push(['D103-OWN-C-10', async () => {
      const { res } = await enviar({
        caso: 'D103-OWN-C-10', categoria: CATEGORIA_OWNC, perfil: 'CLIENTE-A', metodo: 'GET',
        rota: `/pedidos/${pedBPend}/pagamentos/pix/${pagBPix}`, condicao: 'tentativa existente de B',
        fixture: 'F-PAG-B-PIX', fonte: 'pagamentos.service.ts L229-235',
        auth: auth('CLIENTE-A'), headerEvidencia: 'Bearer token:CLIENTE-A',
      });
      esperarErro(res, 404, 'Tentativa não encontrada.');
      assert.equal(comoObjeto(res.body).tentativaId, undefined);
    }]);

    casosOwnCliente.push(['D103-OWN-C-11', async () => {
      const antes = await prisma.pagamento.count({ where: { pedidoId: pedBPend } });
      const { res, ev } = await enviar({
        caso: 'D103-OWN-C-11', categoria: CATEGORIA_OWNC, perfil: 'CLIENTE-A', metodo: 'POST',
        rota: `/pedidos/${pedBPend}/pagamentos/cartao`, condicao: 'nova tentativa em pedido de B',
        fixture: 'F-PED-B-PEND', fonte: 'pagamentos.service.ts L59-69, L76-78',
        auth: auth('CLIENTE-A'), headerEvidencia: 'Bearer token:CLIENTE-A',
        body: { tentativaId: randomUUID() }, estadoAntes: { pagamentos: antes },
      });
      esperarErro(res, 404, 'Pedido não encontrado.');
      const depois = await prisma.pagamento.count({ where: { pedidoId: pedBPend } });
      assert.equal(depois, 2);
      ev.estadoDepois = { pagamentos: depois };
    }]);

    casosOwnCliente.push(['D103-OWN-C-12', async () => {
      const { res } = await enviar({
        caso: 'D103-OWN-C-12', categoria: CATEGORIA_OWNC, perfil: 'CLIENTE-A', metodo: 'GET',
        rota: `/pedidos/${pedBPend}/pagamentos/cartao/${pagBCard}`, condicao: 'tentativa existente de B',
        fixture: 'F-PAG-B-CARD', fonte: 'pagamentos.service.ts L229-235',
        auth: auth('CLIENTE-A'), headerEvidencia: 'Bearer token:CLIENTE-A',
      });
      esperarErro(res, 404, 'Tentativa não encontrada.');
      assert.equal(comoObjeto(res.body).tentativaId, undefined);
    }]);

    casosOwnCliente.push(['D103-OWN-C-13', async () => {
      const antes = await prisma.pedido.count({ where: { clienteUsuarioId: ub } });
      const { res, ev } = await enviar({
        caso: 'D103-OWN-C-13', categoria: CATEGORIA_OWNC, perfil: 'CLIENTE-B', metodo: 'POST',
        rota: '/pedidos/revisao', condicao: 'revisão ENTREGA com enderecoId de A',
        fixture: 'F-CART-B, F-END-A', fonte: 'pedidos.service.ts L516-526',
        auth: auth('CLIENTE-B'), headerEvidencia: 'Bearer token:CLIENTE-B',
        body: { modalidade: ModalidadeRecebimento.ENTREGA, enderecoId: endAId },
        estadoAntes: { pedidosDeB: antes },
      });
      esperarErro(res, 404, 'Endereço não encontrado.');
      const depois = await prisma.pedido.count({ where: { clienteUsuarioId: ub } });
      assert.equal(depois, antes);
      ev.estadoDepois = { pedidosDeB: depois };
    }]);

    casosOwnCliente.push(['D103-OWN-C-14', async () => {
      const estAntes = await prisma.estoque.findUniqueOrThrow({ where: { produtoId: prodId } });
      const pedidosB = await prisma.pedido.count({ where: { clienteUsuarioId: ub } });
      const revisaoB = await enviar({
        caso: 'D103-OWN-C-14', categoria: CATEGORIA_OWNC, perfil: 'CLIENTE-B', metodo: 'POST',
        rota: '/pedidos/revisao', condicao: 'arranjo: recaptura de revisão assinada por B (RETIRADA)',
        fixture: '-', fonte: 'pedidos.service.ts L660-661',
        auth: auth('CLIENTE-B'), headerEvidencia: 'Bearer token:CLIENTE-B',
        body: { modalidade: ModalidadeRecebimento.RETIRADA },
      });
      assert.equal(revisaoB.res.status, 201);
      const revisaoId = texto(comoObjeto(revisaoB.res.body).revisaoId);
      assert.match(revisaoId, /^[a-f0-9]{64}$/);

      const tentativaC14 = randomUUID();
      const { res, ev } = await enviar({
        caso: 'D103-OWN-C-14', categoria: CATEGORIA_OWNC, perfil: 'CLIENTE-B', metodo: 'POST',
        rota: '/pedidos', condicao: 'caminho persistente com enderecoId de A (abre transação e locks)',
        fixture: 'F-CART-B, F-END-A', fonte: 'pedidos.service.ts L459, L468-477, L518-521',
        auth: auth('CLIENTE-B'), headerEvidencia: 'Bearer token:CLIENTE-B',
        body: { modalidade: ModalidadeRecebimento.ENTREGA, enderecoId: endAId, revisaoId, tentativaId: tentativaC14 },
        estadoAntes: {
          pedidosDeB: pedidosB, estoqueFisico: estAntes.quantidadeFisica,
          estoqueReservado: estAntes.quantidadeReservada,
        },
      });
      esperarErro(res, 404, 'Endereço não encontrado.');

      const estDepois = await prisma.estoque.findUniqueOrThrow({ where: { produtoId: prodId } });
      assert.equal(estDepois.quantidadeFisica, 10);
      assert.equal(estDepois.quantidadeReservada, 0);
      assert.equal(await prisma.pedido.count({ where: { clienteUsuarioId: ub } }), pedidosB);
      assert.equal(await prisma.itemPedido.count({ where: { pedidoId: { in: pedidosDeB } } }), 0);
      assert.equal(await prisma.itemPedidoPersonalizacaoSnapshot.count({
        where: { itemPedido: { pedidoId: { in: pedidosDeB } } },
      }), 0);
      assert.equal(await prisma.reservaEstoque.count({ where: { pedidoId: { in: pedidosDeB } } }), 0);
      assert.equal(await prisma.movimentacaoEstoque.count({ where: { pedidoId: { in: pedidosDeB } } }), 0);
      assert.equal(await prisma.notificacao.count({ where: { pedidoId: { in: pedidosDeB } } }), 0);

      const sondas = await prisma.$transaction(async (tx) => {
        const [advisory] = await tx.$queryRaw<Array<{ ok: boolean }>>`
          SELECT pg_try_advisory_xact_lock(hashtextextended(${`PED-${tentativaC14}`}::text, 0)) AS ok`;
        await tx.$executeRawUnsafe(`SET LOCAL lock_timeout = '1s'`);
        const carrinho = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT id FROM "Carrinho" WHERE "usuarioId" = ${ub}::uuid FOR UPDATE`;
        const itens = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT id FROM "ItemCarrinho" WHERE "carrinhoId" = ${carrinhoBId}::uuid ORDER BY id FOR UPDATE`;
        const produto = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT id FROM "Produto" WHERE id = ${prodId}::uuid FOR UPDATE`;
        return {
          advisoryLivre: advisory.ok === true,
          carrinhoLinhas: carrinho.length,
          itensLinhas: itens.length,
          produtoLinhas: produto.length,
        };
      });
      assert.equal(sondas.advisoryLivre, true);
      assert.equal(sondas.carrinhoLinhas, 1);
      assert.equal(sondas.itensLinhas, 1);
      assert.equal(sondas.produtoLinhas, 1);
      ev.estadoDepois = {
        estoqueFisico: estDepois.quantidadeFisica,
        estoqueReservado: estDepois.quantidadeReservada,
        sondas,
      };
    }]);

    casosOwnCliente.push(['D103-OWN-C-15', async () => {
      const revisaoA = await enviar({
        caso: 'D103-OWN-C-15', categoria: CATEGORIA_OWNC, perfil: 'CLIENTE-A', metodo: 'POST',
        rota: '/pedidos/revisao', condicao: 'arranjo: recaptura imediata da revisão assinada por A (RETIRADA)',
        fixture: '-', fonte: 'pedidos.service.ts L660-661',
        auth: auth('CLIENTE-A'), headerEvidencia: 'Bearer token:CLIENTE-A',
        body: { modalidade: ModalidadeRecebimento.RETIRADA },
      });
      assert.equal(revisaoA.res.status, 201);
      const revisaoId = texto(comoObjeto(revisaoA.res.body).revisaoId);
      assert.match(revisaoId, /^[a-f0-9]{64}$/);

      const antes = await prisma.pedido.count();
      const itemAntes = await prisma.itemCarrinho.findUniqueOrThrow({ where: { id: itemBId } });
      const { res, ev } = await enviar({
        caso: 'D103-OWN-C-15', categoria: CATEGORIA_OWNC, perfil: 'CLIENTE-B', metodo: 'POST',
        rota: '/pedidos', condicao: 'revisão assinada por A reenviada por B',
        fixture: 'revisão A recapturada', fonte: 'pedidos.service.ts L603-605',
        auth: auth('CLIENTE-B'), headerEvidencia: 'Bearer token:CLIENTE-B',
        body: { modalidade: ModalidadeRecebimento.RETIRADA, revisaoId },
        estadoAntes: { pedidos: antes, itemBQuantidade: itemAntes.quantidade },
      });
      esperarErro(res, 409, 'Revisão desatualizada. Atualize os valores.');
      const depois = await prisma.pedido.count();
      const itemDepois = await prisma.itemCarrinho.findUniqueOrThrow({ where: { id: itemBId } });
      assert.equal(depois, antes);
      assert.equal(itemDepois.quantidade, itemAntes.quantidade);
      ev.estadoDepois = { pedidos: depois, itemBQuantidade: itemDepois.quantidade };
    }]);

    casosOwnCliente.push(['D103-OWN-C-16', async () => {
      const revisaoB = await enviar({
        caso: 'D103-OWN-C-16', categoria: CATEGORIA_OWNC, perfil: 'CLIENTE-B', metodo: 'POST',
        rota: '/pedidos/revisao', condicao: 'arranjo: recaptura imediata da revisão assinada por B (RETIRADA)',
        fixture: '-', fonte: 'pedidos.service.ts L660-661',
        auth: auth('CLIENTE-B'), headerEvidencia: 'Bearer token:CLIENTE-B',
        body: { modalidade: ModalidadeRecebimento.RETIRADA },
      });
      assert.equal(revisaoB.res.status, 201);
      const revisaoId = texto(comoObjeto(revisaoB.res.body).revisaoId);
      assert.match(revisaoId, /^[a-f0-9]{64}$/);

      const pedidoAntes = await prisma.pedido.findUniqueOrThrow({ where: { id: pedATent } });
      const { res, ev } = await enviar({
        caso: 'D103-OWN-C-16', categoria: CATEGORIA_OWNC, perfil: 'CLIENTE-B', metodo: 'POST',
        rota: '/pedidos', condicao: 'idempotência de A (PED-<F-TENT-A>, caixa idêntica) por B',
        fixture: 'F-PED-A-TENT', fonte: 'pedidos.service.ts L414-425, L441-446',
        auth: auth('CLIENTE-B'), headerEvidencia: 'Bearer token:CLIENTE-B',
        body: { modalidade: ModalidadeRecebimento.RETIRADA, revisaoId, tentativaId: tentA },
        estadoAntes: { identificador: pedidoAntes.identificadorNegocio, statusAtual: pedidoAntes.statusAtual },
      });
      esperarErro(res, 409, 'Tentativa de confirmação inválida.');
      const depois = await prisma.pedido.findUniqueOrThrow({ where: { id: pedATent } });
      assert.equal(depois.identificadorNegocio, `PED-${tentA}`);
      assert.equal(depois.statusAtual, pedidoAntes.statusAtual);
      assert.equal(await prisma.pedido.count({ where: { clienteUsuarioId: ub } }), 2);
      ev.estadoDepois = { identificador: depois.identificadorNegocio, statusAtual: depois.statusAtual, pedidosDeB: 2 };
    }]);

    casosOwnCliente.push(['D103-OWN-C-17', async () => {
      const { res } = await enviar({
        caso: 'D103-OWN-C-17', categoria: CATEGORIA_OWNC, perfil: 'CLIENTE-A', metodo: 'GET',
        rota: '/catalogo/produtos', condicao: 'controle autorizado de catálogo', fixture: 'F-PROD',
        fonte: 'catalogo.controller.ts', auth: auth('CLIENTE-A'), headerEvidencia: 'Bearer token:CLIENTE-A',
      });
      assert.equal(res.status, 200);
      assert.equal(comoLista(comoObjeto(res.body).items).some((linha) => linha.id === prodId), true);
    }]);

    casosOwnCliente.push(['D103-OWN-C-18', async () => {
      const antes = await prisma.itemCarrinho.findUniqueOrThrow({ where: { id: itemAId } });
      const { res, ev } = await enviar({
        caso: 'D103-OWN-C-18', categoria: CATEGORIA_OWNC, perfil: 'CLIENTE-A', metodo: 'PATCH',
        rota: `/carrinho/itens/${itemAId}`, condicao: 'alteração do próprio item para quantidade 3',
        fixture: 'F-CART-A', fonte: 'carrinho.service.ts', auth: auth('CLIENTE-A'),
        headerEvidencia: 'Bearer token:CLIENTE-A',
        body: { quantidade: 3 }, estadoAntes: { quantidade: antes.quantidade },
      });
      assert.equal(res.status, 200);
      const item = comoLista(comoObjeto(res.body).itens).find((linha) => linha.id === itemAId);
      assert.ok(item);
      assert.equal(item.quantidade, 3);
      const depois = await prisma.itemCarrinho.findUniqueOrThrow({ where: { id: itemAId } });
      assert.equal(depois.quantidade, 3);
      assert.equal((await prisma.itemCarrinho.findUniqueOrThrow({ where: { id: itemBId } })).quantidade, 1);
      ev.estadoDepois = { quantidade: depois.quantidade };
    }]);

    casosOwnCliente.push(['D103-OWN-C-19', async () => {
      const { res } = await enviar({
        caso: 'D103-OWN-C-19', categoria: CATEGORIA_OWNC, perfil: 'CLIENTE-A', metodo: 'GET',
        rota: `/enderecos/${endAId}/cobertura-frete`, condicao: 'controle autorizado de cobertura',
        fixture: 'F-END-A', fonte: 'cobertura-frete.service.ts', auth: auth('CLIENTE-A'),
        headerEvidencia: 'Bearer token:CLIENTE-A',
      });
      assert.equal(res.status, 200);
      assert.equal(comoObjeto(res.body).situacao, 'LOCALIZACAO_INDISPONIVEL');
    }]);

    casosOwnCliente.push(['D103-OWN-C-20', async () => {
      const { res } = await enviar({
        caso: 'D103-OWN-C-20', categoria: CATEGORIA_OWNC, perfil: 'CLIENTE-B', metodo: 'GET',
        rota: `/pedidos/${pedBPend}/pagamentos/pix/${pagBPix}`, condicao: 'dono lendo a própria tentativa',
        fixture: 'F-PAG-B-PIX', fonte: 'pagamentos.service.ts L229-235',
        auth: auth('CLIENTE-B'), headerEvidencia: 'Bearer token:CLIENTE-B',
      });
      assert.equal(res.status, 200);
      const corpo = comoObjeto(res.body);
      assert.equal(corpo.tentativaId, pagBPix);
      assert.equal(corpo.pedidoId, pedBPend);
      assert.equal(corpo.forma, 'PIX');
      assert.equal(corpo.resultado, 'PENDENTE');
    }]);

    casosOwnCliente.push(['D103-OWN-C-21', async () => {
      const { res } = await enviar({
        caso: 'D103-OWN-C-21', categoria: CATEGORIA_OWNC, perfil: 'CLIENTE-B', metodo: 'GET',
        rota: `/pedidos/${pedBPend}/pagamentos/cartao/${pagBCard}`, condicao: 'dono lendo a própria tentativa',
        fixture: 'F-PAG-B-CARD', fonte: 'pagamentos.service.ts L229-235',
        auth: auth('CLIENTE-B'), headerEvidencia: 'Bearer token:CLIENTE-B',
      });
      assert.equal(res.status, 200);
      const corpo = comoObjeto(res.body);
      assert.equal(corpo.tentativaId, pagBCard);
      assert.equal(corpo.forma, 'CARTAO');
      assert.equal(corpo.resultado, 'PENDENTE');
    }]);

    casosOwnCliente.push(['D103-OWN-C-22', async () => {
      const pagamentosAntes = await prisma.pagamento.count({ where: { pedidoId: pedAPagRec } });
      const histAntes = await prisma.historicoStatusPedido.count({ where: { pedidoId: pedAPagRec } });
      const movAntes = await prisma.movimentacaoEstoque.count({ where: { pedidoId: pedAPagRec } });
      const notifAntes = await prisma.notificacao.count({ where: { pedidoId: pedAPagRec } });
      const { res, ev } = await enviar({
        caso: 'D103-OWN-C-22', categoria: CATEGORIA_OWNC, perfil: 'CLIENTE-A', metodo: 'POST',
        rota: `/pedidos/${pedAPagRec}/pagamentos/pix`,
        condicao: 'dono reenviando tentativa já existente e terminal (RECUSADO)',
        fixture: 'F-PED-A-PAG-REC', fonte: 'pagamentos.service.ts L76-83',
        auth: auth('CLIENTE-A'), headerEvidencia: 'Bearer token:CLIENTE-A',
        body: { tentativaId: tentRec },
        estadoAntes: { pagamentos: pagamentosAntes, historicos: histAntes, movimentacoes: movAntes, notificacoes: notifAntes },
      });
      assert.equal(res.status, 200);
      const corpo = comoObjeto(res.body);
      assert.equal(corpo.tentativaId, tentRec);
      assert.equal(corpo.forma, 'PIX');
      assert.equal(corpo.resultado, 'RECUSADO');
      const pagamentosDepois = await prisma.pagamento.count({ where: { pedidoId: pedAPagRec } });
      assert.equal(pagamentosDepois, pagamentosAntes);
      assert.equal((await prisma.pedido.findUniqueOrThrow({ where: { id: pedAPagRec } })).statusAtual, StatusPedido.PENDENTE_PAGAMENTO);
      assert.equal(await prisma.historicoStatusPedido.count({ where: { pedidoId: pedAPagRec } }), histAntes);
      assert.equal(await prisma.movimentacaoEstoque.count({ where: { pedidoId: pedAPagRec } }), movAntes);
      assert.equal(await prisma.notificacao.count({ where: { pedidoId: pedAPagRec } }), notifAntes);
      ev.estadoDepois = { pagamentos: pagamentosDepois, historicos: histAntes, movimentacoes: movAntes, notificacoes: notifAntes };
    }]);

    for (const [id, caso] of casosOwnCliente) {
      if (abortado) { marcarNaoExecutado(id); continue; }
      try { await executar(id, caso); } catch { abortar(id); }
    }

    // ================================================================ 5.5 OWN-E (5)
    const casosEntregador: Array<[string, () => Promise<void>]> = [
      ['D103-OWN-E-01', async () => {
        const { res } = await enviar({
          caso: 'D103-OWN-E-01', categoria: CATEGORIA_OWNE, perfil: 'ENTREGADOR-B', metodo: 'GET',
          rota: '/entregador/pedidos', condicao: 'ENT-B lista apenas os próprios pedidos',
          fixture: 'F-PED-ENT-B, F-PED-ENT-A-*', fonte: 'pedidos.service.ts L40-45',
          auth: auth('ENTREGADOR-B'), headerEvidencia: 'Bearer token:ENTREGADOR-B',
        });
        assert.equal(res.status, 200);
        const ids = comoLista(res.body).map((linha) => linha.id);
        assert.equal(ids.includes(pedEntB), true);
        assert.equal(ids.includes(pedEntAConfirm), false);
        assert.equal(ids.includes(pedEntAAlheio), false);
      }],
      ['D103-OWN-E-02', async () => {
        const { res } = await enviar({
          caso: 'D103-OWN-E-02', categoria: CATEGORIA_OWNE, perfil: 'ENTREGADOR-B', metodo: 'GET',
          rota: `/entregador/pedidos/${pedEntAAlheio}`, condicao: 'pedido de ENT-A',
          fixture: 'F-PED-ENT-A-ALHEIO', fonte: 'pedidos.service.ts L47-64',
          auth: auth('ENTREGADOR-B'), headerEvidencia: 'Bearer token:ENTREGADOR-B',
        });
        esperarErro(res, 404, 'Pedido não encontrado.');
        assert.equal(comoObjeto(res.body).cliente, undefined);
        assert.equal(comoObjeto(res.body).enderecoEntregaSnapshot, undefined);
      }],
      ['D103-OWN-E-03', async () => {
        const antes = await prisma.historicoStatusPedido.count({ where: { pedidoId: pedEntAAlheio } });
        const { res, ev } = await enviar({
          caso: 'D103-OWN-E-03', categoria: CATEGORIA_OWNE, perfil: 'ENTREGADOR-B', metodo: 'PATCH',
          rota: `/entregador/pedidos/${pedEntAAlheio}/confirmar-entrega`, condicao: 'pedido de ENT-A',
          fixture: 'F-PED-ENT-A-ALHEIO', fonte: 'pedidos.service.ts L204-213',
          auth: auth('ENTREGADOR-B'), headerEvidencia: 'Bearer token:ENTREGADOR-B',
          estadoAntes: { historicos: antes },
        });
        esperarErro(res, 404, 'Pedido não encontrado.');
        const depois = await prisma.pedido.findUniqueOrThrow({ where: { id: pedEntAAlheio } });
        assert.equal(depois.statusAtual, StatusPedido.SAIU_PARA_ENTREGA);
        assert.equal(await prisma.historicoStatusPedido.count({
          where: { pedidoId: pedEntAAlheio, statusRegistrado: StatusPedido.ENTREGUE },
        }), 0);
        assert.equal(await prisma.historicoStatusPedido.count({ where: { pedidoId: pedEntAAlheio } }), antes);
        ev.estadoDepois = { statusAtual: depois.statusAtual, historicos: antes };
      }],
      ['D103-OWN-E-04', async () => {
        const { res } = await enviar({
          caso: 'D103-OWN-E-04', categoria: CATEGORIA_OWNE, perfil: 'ENTREGADOR-A', metodo: 'GET',
          rota: `/entregador/pedidos/${pedEntAConfirm}`, condicao: 'controle autorizado do próprio pedido',
          fixture: 'F-PED-ENT-A-CONFIRM', fonte: 'pedidos.service.ts L47-71',
          auth: auth('ENTREGADOR-A'), headerEvidencia: 'Bearer token:ENTREGADOR-A',
        });
        assert.equal(res.status, 200);
        const corpo = comoObjeto(res.body);
        assert.equal(corpo.identificadorNegocio, `${marker}-ENTACONF`);
        assert.equal(typeof comoObjeto(corpo.cliente).nome, 'string');
        assert.equal(typeof comoObjeto(corpo.cliente).telefone, 'string');
        assert.equal(typeof comoObjeto(corpo.enderecoEntregaSnapshot).rua, 'string');
        assert.equal(typeof corpo.dataHoraSaidaParaEntrega, 'string');
      }],
      ['D103-OWN-E-05', async () => {
        const egressAntes = egressTentativas.length;
        const { res, ev } = await enviar({
          caso: 'D103-OWN-E-05', categoria: CATEGORIA_OWNE, perfil: 'ENTREGADOR-A', metodo: 'PATCH',
          rota: `/entregador/pedidos/${pedEntAConfirm}/confirmar-entrega`,
          condicao: 'controle autorizado de confirmação de entrega',
          fixture: 'F-PED-ENT-A-CONFIRM', fonte: 'pedidos.service.ts L204-250; notificacoes.service.ts L32-68',
          auth: auth('ENTREGADOR-A'), headerEvidencia: 'Bearer token:ENTREGADOR-A',
          estadoAntes: { statusAtual: StatusPedido.SAIU_PARA_ENTREGA, notificacoes: 0, egressTentativas: egressAntes },
        });
        assert.equal(res.status, 200);
        assert.equal(comoObjeto(res.body).statusAtual, StatusPedido.ENTREGUE);
        const historico = await prisma.historicoStatusPedido.findFirst({
          where: { pedidoId: pedEntAConfirm, statusRegistrado: StatusPedido.ENTREGUE },
        });
        assert.ok(historico);
        assert.equal(historico.responsavelUsuarioId, entA);
        const total = await aguardarNotificacao(pedEntAConfirm, StatusPedido.ENTREGUE);
        assert.equal(total, 1);
        const notificacao = await prisma.notificacao.findFirstOrThrow({
          where: { pedidoId: pedEntAConfirm, eventoStatusOriginador: StatusPedido.ENTREGUE },
        });
        assert.equal(notificacao.canal, 'WHATSAPP');
        assert.equal(notificacao.resultado, 'FALHA');
        assert.equal(typeof notificacao.destino, 'string');
        assert.notEqual(notificacao.destino.trim(), '');
        assert.equal(egressTentativas.length, egressAntes);
        ev.estadoDepois = {
          statusAtual: StatusPedido.ENTREGUE, historicoEntregue: 1, notificacoes: total,
          notificacaoResultado: notificacao.resultado, egressTentativas: egressTentativas.length,
        };
      }],
    ];

    for (const [id, caso] of casosEntregador) {
      if (abortado) { marcarNaoExecutado(id); continue; }
      try { await executar(id, caso); } catch { abortar(id); }
    }

    // ================================================================ 5.6 ID (5)
    const inexistente = randomUUID();
    const casosPorId: Array<[string, () => Promise<void>]> = [
      ['D103-ID-01', async () => {
        const { res } = await enviar({
          caso: 'D103-ID-01', categoria: CATEGORIA_ID, perfil: 'ENTREGADOR-A', metodo: 'GET',
          rota: `/entregador/pedidos/${inexistente}`, condicao: 'UUID válido sem registro',
          fixture: 'uuid-d103-inexistente', fonte: 'pedidos.service.ts L47-64',
          auth: auth('ENTREGADOR-A'), headerEvidencia: 'Bearer token:ENTREGADOR-A',
        });
        esperarErro(res, 404, 'Pedido não encontrado.');
      }],
      ['D103-ID-02', async () => {
        const { res } = await enviar({
          caso: 'D103-ID-02', categoria: CATEGORIA_ID, perfil: 'CLIENTE-A', metodo: 'PATCH',
          rota: `/pedidos/${inexistente}/cancelar`, condicao: 'UUID válido sem registro',
          fixture: 'uuid-d103-inexistente', fonte: 'pedidos.service.ts L252-258',
          auth: auth('CLIENTE-A'), headerEvidencia: 'Bearer token:CLIENTE-A',
        });
        esperarErro(res, 404, 'Pedido não encontrado.');
        assert.equal(await prisma.historicoStatusPedido.count({ where: { pedidoId: inexistente } }), 0);
      }],
      ['D103-ID-03', async () => {
        const { res } = await enviar({
          caso: 'D103-ID-03', categoria: CATEGORIA_ID, perfil: 'CLIENTE-A', metodo: 'PATCH',
          rota: `/carrinho/itens/${inexistente}`, condicao: 'UUID válido sem registro',
          fixture: 'uuid-d103-inexistente', fonte: 'carrinho.service.ts L118-131',
          auth: auth('CLIENTE-A'), headerEvidencia: 'Bearer token:CLIENTE-A', body: { quantidade: 1 },
        });
        esperarErro(res, 404, 'Item não encontrado.');
      }],
      ['D103-ID-04', async () => {
        const { res } = await enviar({
          caso: 'D103-ID-04', categoria: CATEGORIA_ID, perfil: 'CLIENTE-A', metodo: 'GET',
          rota: `/enderecos/${inexistente}/cobertura-frete`, condicao: 'UUID válido sem registro',
          fixture: 'uuid-d103-inexistente', fonte: 'cobertura-frete.service.ts L21-27',
          auth: auth('CLIENTE-A'), headerEvidencia: 'Bearer token:CLIENTE-A',
        });
        esperarErro(res, 404, 'Endereço não encontrado.');
      }],
      ['D103-ID-05', async () => {
        const { res } = await enviar({
          caso: 'D103-ID-05', categoria: CATEGORIA_ID, perfil: 'ADMIN', metodo: 'GET',
          rota: `/admin/pedidos/${inexistente}`, condicao: 'UUID válido sem registro (ADMIN autorizado)',
          fixture: 'uuid-d103-inexistente', fonte: 'pedidos.service.ts L101-129',
          auth: auth('ADMIN'), headerEvidencia: 'Bearer token:ADMIN',
        });
        esperarErro(res, 404, 'Pedido não encontrado.');
      }],
    ];

    for (const [id, caso] of casosPorId) {
      if (abortado) { marcarNaoExecutado(id); continue; }
      try { await executar(id, caso); } catch { abortar(id); }
    }

    // ---------------------------------------------------------------- drenagem final
    origemAtual = 'drenagem';
    if (app) {
      const aplicacao = app;
      app = undefined;
      await aplicacao.close();
    }

    const notificacoesDeny = await prisma.notificacao.count({ where: { pedidoId: pedAdmDeny } });
    verificacoesFinais.push({
      nome: 'ADM-015/016: nenhuma Notificacao nova para F-PED-ADM-DENY após a drenagem',
      ok: notificacoesDeny === 0,
      detalhe: `Notificacao=${notificacoesDeny}`,
    });
    if (notificacoesDeny !== 0) {
      for (const id of ['D103-ADM-015', 'D103-ADM-016']) {
        if (veredictos.get(id) === 'PASS') {
          veredictos.set(id, 'FAIL');
          causas.set(id, 'Notificacao criada para pedido cuja requisição foi barrada com 403');
        }
      }
    }

    verificacoesFinais.push({
      nome: 'Nenhuma tentativa de egress durante toda a execução',
      ok: egressTentativas.length === 0,
      detalhe: `egressTentativas=${egressTentativas.length}; fetchCalls=${fetchCalls}`,
    });
  } catch (erro) {
    if (!fixturesCriadas) {
      preflight.falha = mensagemDeErro(erro);
    } else {
      erroFatal = mensagemDeErro(erro);
    }
    abortado = true;
    process.stderr.write(`D103 erro: ${mensagemDeErro(erro)}\n`);
  } finally {
    globalThis.fetch = fetchOriginal;
    const fetchRestaurado = globalThis.fetch === fetchOriginal;

    try {
      if (app) await app.close();
    } catch (erro) {
      cleanupErrors.push(`app.close: ${mensagemDeErro(erro)}`);
    }

    if (fixturesCriadas) {
      const usuarios = [...usuariosParaLimpeza];
      const passos: Array<[string, () => Promise<unknown>]> = [
        ['Notificacao', () => prisma.notificacao.deleteMany({ where: { pedidoId: { in: pedidos } } })],
        ['ItemPedidoPersonalizacaoSnapshot', () => prisma.itemPedidoPersonalizacaoSnapshot.deleteMany({
          where: { itemPedido: { pedidoId: { in: pedidos } } },
        })],
        ['ReservaEstoque', () => prisma.reservaEstoque.deleteMany({
          where: { OR: [{ pedidoId: { in: pedidos } }, { produtoId: { in: produtos } }] },
        })],
        ['MovimentacaoEstoque', () => prisma.movimentacaoEstoque.deleteMany({
          where: { OR: [{ pedidoId: { in: pedidos } }, { produtoId: { in: produtos } }] },
        })],
        ['Pagamento', () => prisma.pagamento.deleteMany({ where: { pedidoId: { in: pedidos } } })],
        ['HistoricoStatusPedido', () => prisma.historicoStatusPedido.deleteMany({
          where: { OR: [{ pedidoId: { in: pedidos } }, { responsavelUsuarioId: { in: usuarios } }] },
        })],
        ['ItemPedido', () => prisma.itemPedido.deleteMany({ where: { pedidoId: { in: pedidos } } })],
        ['EnderecoEntregaSnapshot', () => prisma.enderecoEntregaSnapshot.deleteMany({ where: { pedidoId: { in: pedidos } } })],
        ['Pedido', () => prisma.pedido.deleteMany({ where: { id: { in: pedidos } } })],
        ['ItemCarrinhoPersonalizacao', () => prisma.itemCarrinhoPersonalizacao.deleteMany({
          where: { itemCarrinho: { carrinho: { usuarioId: { in: usuarios } } } },
        })],
        ['ItemCarrinho', () => prisma.itemCarrinho.deleteMany({ where: { carrinho: { usuarioId: { in: usuarios } } } })],
        ['Carrinho', () => prisma.carrinho.deleteMany({ where: { usuarioId: { in: usuarios } } })],
        ['Endereco', () => prisma.endereco.deleteMany({ where: { usuarioId: { in: usuarios } } })],
        ['ConfiguracaoLojaEntrega', () => prisma.configuracaoLojaEntrega.deleteMany({ where: { id: { in: configs } } })],
        ['ProdutoPersonalizacao', () => prisma.produtoPersonalizacao.deleteMany({ where: { produtoId: { in: produtos } } })],
        ['Personalizacao', () => prisma.personalizacao.deleteMany({ where: { id: { in: personalizacoes } } })],
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
          const descricao = `${numero}. ${tabela}: ${mensagemDeErro(erro)}`;
          cleanupErrors.push(descricao);
          cleanupPassos.push({ passo: numero, tabela, erro: mensagemDeErro(erro) });
          process.stderr.write(`Limpeza D103 FAIL ${descricao}\n`);
        }
      }
    }

    let contagensFinais: Record<string, number> = {};
    let criterioZeros = false;
    let igualdadePreflight = false;
    try {
      contagensFinais = await contagensGlobais();
      criterioZeros = Object.values(contagensFinais).every((valor) => valor === 0);
      igualdadePreflight = JSON.stringify(contagensFinais) === JSON.stringify(preflight.contagensIniciais);
    } catch (erro) {
      cleanupErrors.push(`contagens finais: ${mensagemDeErro(erro)}`);
    }

    try {
      await prisma.$disconnect();
    } catch (erro) {
      cleanupErrors.push(`prisma.$disconnect: ${mensagemDeErro(erro)}`);
    }

    // ---------------------------------------------------------------- artefatos
    const veredictoDe = (id: string): Veredito => veredictos.get(id) ?? 'INCONCLUSIVO';
    for (const ev of evidencias) ev.veredito = veredictoDe(ev.caso);

    const categoriasDe = (sufixo: string) => ordemDosCasos.filter((id) => id.includes(sufixo));
    const idsPorCategoria: Array<[string, string[]]> = [
      [CATEGORIA_AUT, categoriasDe('-AUT-')],
      [CATEGORIA_RBC, categoriasDe('-RBC-')],
      [CATEGORIA_ADM, categoriasDe('-ADM-')],
      [CATEGORIA_OWNC, categoriasDe('-OWN-C-')],
      [CATEGORIA_OWNE, categoriasDe('-OWN-E-')],
      [CATEGORIA_ID, categoriasDe('-ID-')],
    ];

    const resumoPorCategoria: Record<string, { total: number; pass: number; fail: number; inconclusivo: number }> = {};
    for (const [categoria, ids] of idsPorCategoria) {
      const contagem = { total: ids.length, pass: 0, fail: 0, inconclusivo: 0 };
      for (const id of ids) {
        const veredito = veredictoDe(id);
        if (veredito === 'PASS') contagem.pass += 1;
        else if (veredito === 'FAIL') contagem.fail += 1;
        else contagem.inconclusivo += 1;
      }
      resumoPorCategoria[categoria] = contagem;
    }

    const casos = ordemDosCasos.map((id) => ({
      id,
      categoria: idsPorCategoria.find(([, lista]) => lista.includes(id))?.[0] ?? 'desconhecida',
      veredito: veredictoDe(id),
      ...(causas.has(id) ? { causa: causas.get(id) } : {}),
    }));

    const total = casos.length;
    const pass = casos.filter((caso) => caso.veredito === 'PASS').length;
    const fail = casos.filter((caso) => caso.veredito === 'FAIL').length;
    const inconclusivo = casos.filter((caso) => caso.veredito === 'INCONCLUSIVO').length;

    const criteriosCleanup = {
      cleanupErrorsVazio: cleanupErrors.length === 0,
      contagemZeroNas20Tabelas: criterioZeros,
      igualdadeComSnapshotPreflight: igualdadePreflight,
    };
    const cleanupOk = Object.values(criteriosCleanup).every(Boolean);
    const finalOk = verificacoesFinais.every((verificacao) => verificacao.ok);
    const preflightOk = preflight.falha === null;
    const vereditoGeral: Veredito = !preflightOk || erroFatal !== null
      ? 'INCONCLUSIVO'
      : fail === 0 && inconclusivo === 0 && cleanupOk && finalOk &&
          egressTentativas.length === 0 && fetchRestaurado
        ? 'PASS'
        : 'FAIL';

    const artefato = {
      tarefa: 'D103 — Testes de segurança/autorização',
      geradoEm,
      branch,
      head,
      comando: 'cd apps/api && D103_TEST_DATABASE_URL="postgresql://<user>:<senha>@localhost:<porta>/cupcake_d103?schema=public" npx ts-node test/d103-autorizacao-postgres.ts',
      banco: { database: 'cupcake_d103', schema: 'public', tabelasVerificadas: TABELAS },
      ambiente,
      preflight,
      erroFatal,
      abortoPor,
      egress: {
        tentativas: egressTentativas,
        fetchCalls,
        fetchRestaurado,
        guardaInstalada: preflight.guardaInstalada,
      },
      casos,
      resumo: { total, pass, fail, inconclusivo, porCategoria: resumoPorCategoria },
      requisicoes: evidencias,
      verificacoesFinais,
      cleanup: {
        totalPassos: cleanupPassos.length,
        passos: cleanupPassos,
        cleanupErrors,
        contagensFinais,
        snapshotPreflight: preflight.contagensIniciais,
        criterios: criteriosCleanup,
      },
      veredito: vereditoGeral,
    };

    const destino = resolve(__dirname, '../../../docs/testing/evidence/D103-exec-autorizacao.json');
    mkdirSync(dirname(destino), { recursive: true });
    writeFileSync(destino, `${JSON.stringify(artefato, null, 2)}\n`, 'utf8');

    process.stdout.write([
      `D103 — veredito ${vereditoGeral}`,
      `Casos: ${total} (PASS ${pass} / FAIL ${fail} / INCONCLUSIVO ${inconclusivo})`,
      ...Object.entries(resumoPorCategoria).map(([categoria, contagem]) =>
        `  ${categoria}: ${contagem.total} (PASS ${contagem.pass} / FAIL ${contagem.fail} / INCONCLUSIVO ${contagem.inconclusivo})`),
      `Requisições registradas: ${evidencias.length}`,
      `Cleanup: passos=${cleanupPassos.length} cleanupErrors=${cleanupErrors.length} zeros=${criterioZeros} igualdadePreflight=${igualdadePreflight}`,
      `Egress: tentativas=${egressTentativas.length} fetchCalls=${fetchCalls} fetchRestaurado=${fetchRestaurado}`,
      `Banco do app: ${String(preflight.databaseDoApp)}`,
      `Evidência: ${destino}`,
      '',
    ].join('\n'));

    if (vereditoGeral !== 'PASS') process.exitCode = 1;
  }
}

main().catch((erro: unknown) => {
  process.stderr.write(`Falha D103 PostgreSQL: ${mensagemDeErro(erro)}\n`);
  process.exitCode = 1;
});
