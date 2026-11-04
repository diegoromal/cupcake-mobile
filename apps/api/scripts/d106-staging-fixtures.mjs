#!/usr/bin/env node
/**
 * D106 — fixtures sintéticas do staging (reset escopado + seed via API real).
 *
 * Executa DENTRO do container `api` do staging (node 22, com `pg`/`argon2` da
 * imagem), ou localmente contra um PostgreSQL dedicado com a API atual.
 *
 * Invariantes de segurança:
 *  - só opera no banco `cupcake_staging`;
 *  - exige `D106_STAGING_CONFIRM=cupcake_staging`;
 *  - recusa se Evolution/WhatsApp estiver configurada;
 *  - sem `D106_APPLY=1` é dry-run (nenhuma escrita, nenhuma mutação via API);
 *  - só usa DELETE escopado em linhas D106 (nunca DROP/TRUNCATE/volume);
 *  - nunca imprime senha/token; o JSON final não contém credenciais.
 *
 * Ver docs/testing/D106-STAGING-AMBIENTE.md para o procedimento completo.
 */
import { createHash, randomUUID } from 'node:crypto';
import * as argon2 from 'argon2';
import pg from 'pg';

const { Client } = pg;

const EMAILS = {
  admin: 'd106-admin@example.test',
  cliente: 'd106-cliente@example.test',
  entregador: 'd106-entregador@example.test',
};
const PREFIXO = 'D106 ';
const AVISO_SENHA = 'senha runtime em arquivo local gitignored (.env.d106-staging.local por padrão)';

const saida = (obj) => process.stdout.write(`${JSON.stringify(obj, null, 2)}\n`);
const log = (msg) => process.stderr.write(`${msg}\n`);
const falhar = (msg) => { throw new Error(msg); };

function lerConfig() {
  const confirm = process.env.D106_STAGING_CONFIRM;
  if (confirm !== 'cupcake_staging') {
    falhar('Defina D106_STAGING_CONFIRM=cupcake_staging para confirmar o alvo.');
  }
  const local = process.env.D106_LOCAL_VALIDATION === '1';
  const bruto = process.env.D106_DATABASE_URL || process.env.DATABASE_URL;
  if (!bruto) falhar('DATABASE_URL (ou D106_DATABASE_URL) é obrigatória.');
  const url = new URL(bruto);
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) falhar('DATABASE_URL deve ser PostgreSQL.');
  if (url.pathname !== '/cupcake_staging') falhar('O banco precisa se chamar cupcake_staging.');
  const hostsOk = local
    ? ['127.0.0.1', 'localhost', 'postgres']
    : ['postgres'];
  if (!hostsOk.includes(url.hostname)) {
    falhar(`Host ${url.hostname} não permitido (${hostsOk.join('/')}).`);
  }
  if (local && !['127.0.0.1', 'localhost'].includes(url.hostname) && url.hostname !== 'postgres') {
    falhar('Modo local exige host 127.0.0.1/localhost.');
  }
  const senha = process.env.D106_DEMO_PASSWORD || '';
  if (!/^[A-Za-z0-9._-]{12,}$/.test(senha)) {
    falhar('D106_DEMO_PASSWORD ausente ou fora de [A-Za-z0-9._-]{12,}.');
  }
  for (const chave of ['EVOLUTION_API_URL', 'EVOLUTION_API_KEY', 'EVOLUTION_API_INSTANCE']) {
    if ((process.env[chave] || '').trim() !== '') {
      falhar(`${chave} está configurada; recusando para não enviar notificação real.`);
    }
  }
  const apiUrl = (process.env.D106_API_URL || 'http://127.0.0.1:3000').replace(/\/+$/, '');
  return {
    databaseUrl: bruto,
    apiUrl,
    senha,
    aplicar: process.env.D106_APPLY === '1',
    local,
    deployedSha: process.env.D106_DEPLOYED_SHA || '<desconhecido>',
    expectedSha: process.env.D106_EXPECTED_SHA || '',
    shaDivergente: false,
  };
}

function conexao(connectionString) {
  const url = new URL(connectionString);
  url.searchParams.delete('schema');
  return new Client({ connectionString: url.toString(), application_name: 'd106-staging-fixtures' });
}

async function api(config, metodo, caminho, { token, corpo } = {}) {
  const headers = { Accept: 'application/json' };
  if (corpo !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const resposta = await fetch(`${config.apiUrl}${caminho}`, {
    method: metodo, headers,
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
    signal: AbortSignal.timeout(30_000),
  });
  const texto = await resposta.text();
  let json = null;
  try { json = texto ? JSON.parse(texto) : null; } catch { json = null; }
  if (!resposta.ok) {
    falhar(`${metodo} ${caminho} -> HTTP ${resposta.status} ${texto.slice(0, 300)}`);
  }
  return json;
}

const IDS = {
  usuariosPorEmail: `SELECT id, email FROM "Usuario" WHERE email = ANY($1::text[])`,
  produtos: `SELECT id FROM "Produto" WHERE nome LIKE $1`,
  categorias: `SELECT id FROM "Categoria" WHERE nome LIKE $1`,
  pedidos: `SELECT id FROM "Pedido" WHERE "clienteUsuarioId" = ANY($1::uuid[])
            OR "entregadorUsuarioId" = ANY($1::uuid[])`,
};

const ORDEM_RESET = (alvos) => [
  ['Notificacao', 'DELETE FROM "Notificacao" WHERE "pedidoId" = ANY($1::uuid[])', [alvos.pedidos]],
  ['ItemPedidoPersonalizacaoSnapshot', `DELETE FROM "ItemPedidoPersonalizacaoSnapshot" WHERE "itemPedidoId" IN
      (SELECT id FROM "ItemPedido" WHERE "pedidoId" = ANY($1::uuid[]))`, [alvos.pedidos]],
  ['ItemPedido', 'DELETE FROM "ItemPedido" WHERE "pedidoId" = ANY($1::uuid[])', [alvos.pedidos]],
  ['EnderecoEntregaSnapshot', 'DELETE FROM "EnderecoEntregaSnapshot" WHERE "pedidoId" = ANY($1::uuid[])', [alvos.pedidos]],
  ['HistoricoStatusPedido', 'DELETE FROM "HistoricoStatusPedido" WHERE "pedidoId" = ANY($1::uuid[])', [alvos.pedidos]],
  ['Pagamento', 'DELETE FROM "Pagamento" WHERE "pedidoId" = ANY($1::uuid[])', [alvos.pedidos]],
  ['ReservaEstoque', 'DELETE FROM "ReservaEstoque" WHERE "pedidoId" = ANY($1::uuid[])', [alvos.pedidos]],
  ['MovimentacaoEstoque', `DELETE FROM "MovimentacaoEstoque" WHERE "pedidoId" = ANY($1::uuid[])
      OR "produtoId" = ANY($2::uuid[])`, [alvos.pedidos, alvos.produtos]],
  ['Pedido', 'DELETE FROM "Pedido" WHERE id = ANY($1::uuid[])', [alvos.pedidos]],
  ['ItemCarrinhoPersonalizacao', `DELETE FROM "ItemCarrinhoPersonalizacao" WHERE "itemCarrinhoId" IN
      (SELECT ic.id FROM "ItemCarrinho" ic JOIN "Carrinho" c ON c.id = ic."carrinhoId"
       WHERE c."usuarioId" = ANY($1::uuid[]))`, [alvos.usuariosIds]],
  ['ItemCarrinho', `DELETE FROM "ItemCarrinho" WHERE "carrinhoId" IN
      (SELECT id FROM "Carrinho" WHERE "usuarioId" = ANY($1::uuid[]))`, [alvos.usuariosIds]],
  ['Carrinho', 'DELETE FROM "Carrinho" WHERE "usuarioId" = ANY($1::uuid[])', [alvos.usuariosIds]],
  ['ProdutoPersonalizacao', 'DELETE FROM "ProdutoPersonalizacao" WHERE "produtoId" = ANY($1::uuid[])', [alvos.produtos]],
  ['Estoque', 'DELETE FROM "Estoque" WHERE "produtoId" = ANY($1::uuid[])', [alvos.produtos]],
  ['Produto', `DELETE FROM "Produto" WHERE id = ANY($1::uuid[]) AND nome LIKE $2`, [alvos.produtos, `${PREFIXO}%`]],
  ['Categoria', `DELETE FROM "Categoria" WHERE id = ANY($1::uuid[]) AND nome LIKE $2`, [alvos.categorias, `${PREFIXO}%`]],
  ['Endereco', 'DELETE FROM "Endereco" WHERE "usuarioId" = ANY($1::uuid[])', [alvos.usuariosIds]],
  ['Usuario', 'DELETE FROM "Usuario" WHERE email = ANY($1::text[])', [Object.values(EMAILS)]],
];

async function contagens(client) {
  const linhas = await client.query(`
    SELECT
      (SELECT count(*) FROM "Usuario") AS usuarios,
      (SELECT count(*) FROM "Produto") AS produtos,
      (SELECT count(*) FROM "Categoria") AS categorias,
      (SELECT count(*) FROM "Pedido") AS pedidos,
      (SELECT count(*) FROM "Estoque") AS estoques,
      (SELECT count(*) FROM "MovimentacaoEstoque") AS movimentos,
      (SELECT count(*) FROM "ConfiguracaoLojaEntrega") AS configuracoes`);
  const row = linhas.rows[0];
  return Object.fromEntries(Object.entries(row).map(([k, v]) => [k, Number(v)]));
}

async function coletarAlvos(client) {
  const emails = Object.values(EMAILS);
  const usuarios = await client.query(IDS.usuariosPorEmail, [emails]);
  const usuariosIds = usuarios.rows.map((r) => r.id);
  const produtos = await client.query(IDS.produtos, [`${PREFIXO}%`]);
  const categorias = await client.query(IDS.categorias, [`${PREFIXO}%`]);
  const pedidos = usuariosIds.length
    ? await client.query(IDS.pedidos, [usuariosIds])
    : { rows: [] };
  return {
    usuarios: usuarios.rows,
    usuariosIds,
    produtos: produtos.rows.map((r) => r.id),
    categorias: categorias.rows.map((r) => r.id),
    pedidos: pedidos.rows.map((r) => r.id),
  };
}

async function reset(client, alvos) {
  const removidos = {};
  await client.query('BEGIN');
  try {
    for (const [tabela, sql, parametros] of ORDEM_RESET(alvos)) {
      const resultado = await client.query(sql, parametros);
      removidos[tabela] = resultado.rowCount;
    }
    await client.query('COMMIT');
  } catch (erro) {
    await client.query('ROLLBACK').catch(() => {});
    throw erro;
  }
  return removidos;
}

async function criarAdminDirect(client, senha) {
  const id = randomUUID();
  const hash = await argon2.hash(senha, {
    type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1,
  });
  await client.query(
    `INSERT INTO "Usuario" (id, nome, email, telefone, "credencialSenha", perfil)
     VALUES ($1, $2, $3, $4, $5, 'ADMIN')`,
    [id, 'D106 Admin', EMAILS.admin, '11900000001', hash],
  );
  return id;
}

async function login(config) {
  const resposta = await api(config, 'POST', '/auth/login', {
    corpo: { email: EMAILS.admin, senha: config.senha },
  });
  if (!resposta?.accessToken) falhar('Login do ADMIN D106 não retornou accessToken.');
  return resposta.accessToken;
}

async function snapshotConfiguracao(client) {
  const { rows } = await client.query(
    `SELECT id, "latitudeLoja"::text AS "latitudeLoja", "longitudeLoja"::text AS "longitudeLoja",
            "raioMaximoAtendimento"::text AS "raioMaximoAtendimento", "taxaBase"::text AS "taxaBase",
            "valorPorQuilometro"::text AS "valorPorQuilometro"
     FROM "ConfiguracaoLojaEntrega" ORDER BY id`,
  );
  return rows;
}

async function restaurarConfiguracao(client, snapshot) {
  await client.query('DELETE FROM "ConfiguracaoLojaEntrega"');
  for (const row of snapshot) {
    await client.query(
      `INSERT INTO "ConfiguracaoLojaEntrega"
        (id, "latitudeLoja", "longitudeLoja", "raioMaximoAtendimento", "taxaBase", "valorPorQuilometro")
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [row.id, row.latitudeLoja, row.longitudeLoja, row.raioMaximoAtendimento, row.taxaBase, row.valorPorQuilometro],
    );
  }
}

async function limparCarrinho(config, token) {
  const carrinho = await api(config, 'GET', '/carrinho', { token });
  for (const item of carrinho?.itens ?? []) {
    await api(config, 'DELETE', `/carrinho/itens/${item.id}`, { token });
  }
  const restante = await api(config, 'GET', '/carrinho', { token });
  return (restante?.itens ?? []).length;
}

async function criarPedidoPago(config, token, { modalidade, enderecoId, sufixo }) {
  const tentativa = `10000000-0000-4000-8000-0000000000${sufixo}`;
  const corpoRevisao = modalidade === 'ENTREGA'
    ? { modalidade, enderecoId }
    : { modalidade: 'RETIRADA' };
  await api(config, 'POST', '/carrinho/itens', {
    token, corpo: { produtoId: config.produtoId, quantidade: 1, personalizacaoIds: [] },
  });
  const revisao = await api(config, 'POST', '/pedidos/revisao', { token, corpo: corpoRevisao });
  const pedido = await api(config, 'POST', '/pedidos', {
    token,
    corpo: modalidade === 'ENTREGA'
      ? { modalidade: 'ENTREGA', enderecoId, revisaoId: revisao.revisaoId, tentativaId: tentativa }
      : { modalidade: 'RETIRADA', revisaoId: revisao.revisaoId, tentativaId: tentativa },
  });
  const pagamento = await api(config, 'POST', `/pedidos/${pedido.id}/pagamentos/pix`, {
    token, corpo: { tentativaId: tentativa },
  });
  if (pagamento?.resultado !== 'APROVADO') {
    falhar(`Pagamento de ${pedido.id} não aprovado: ${pagamento?.resultado}`);
  }
  return pedido.id;
}

async function estadoFinal(client, alvos) {
  const pedidos = await client.query(
    `SELECT p.id, p."identificadorNegocio", p.modalidade, p."statusAtual"::text AS status,
            p."entregadorUsuarioId", coalesce(sum(ip.quantidade), 0)::int AS itens
     FROM "Pedido" p LEFT JOIN "ItemPedido" ip ON ip."pedidoId" = p.id
     WHERE p.id = ANY($1::uuid[]) GROUP BY p.id ORDER BY p.modalidade, p."identificadorNegocio"`,
    [alvos.pedidos],
  );
  const estoques = await client.query(
    `SELECT "quantidadeFisica", "quantidadeReservada" FROM "Estoque" WHERE "produtoId" = ANY($1::uuid[])`,
    [alvos.produtos],
  );
  const carrinhos = await client.query(
    `SELECT c.id, count(ic.id)::int AS itens FROM "Carrinho" c
     LEFT JOIN "ItemCarrinho" ic ON ic."carrinhoId" = c.id
     WHERE c."usuarioId" = ANY($1::uuid[]) GROUP BY c.id`,
    [alvos.usuariosIds],
  );
  const contas = await client.query(
    `SELECT email, perfil::text AS perfil FROM "Usuario" WHERE email = ANY($1::text[]) ORDER BY perfil`,
    [Object.values(EMAILS)],
  );
  return {
    contas: contas.rows,
    pedidos: pedidos.rows.map((p) => ({
      modalidade: p.modalidade,
      status: p.status,
      identificadorNegocio: p.identificadorNegocio,
      itens: Number(p.itens),
      entregadorAtribuido: Boolean(p.entregadorUsuarioId),
    })),
    estoque: estoques.rows.length === 1
      ? { fisica: estoques.rows[0].quantidadeFisica, reservada: estoques.rows[0].quantidadeReservada }
      : estoques.rows,
    itensNoCarrinho: carrinhos.rows.reduce((total, linha) => total + Number(linha.itens), 0),
  };
}

function validarEstado(estado) {
  const problemas = [];
  if (estado.contas.length !== 3) problemas.push(`contas D106: ${estado.contas.length}/3`);
  const o1 = estado.pedidos.find((p) => p.modalidade === 'RETIRADA');
  const o2 = estado.pedidos.find((p) => p.modalidade === 'ENTREGA');
  if (!o1 || o1.status !== 'PAGO') problemas.push('O1 ausente ou fora de PAGO');
  if (!o2 || o2.status !== 'SAIU_PARA_ENTREGA') problemas.push('O2 ausente ou fora de SAIU_PARA_ENTREGA');
  if (o2 && !o2.entregadorAtribuido) problemas.push('O2 sem entregador atribuído');
  if (o1 && o1.itens !== 1) problemas.push('O1 sem exatamente 1 item');
  if (o2 && o2.itens !== 1) problemas.push('O2 sem exatamente 1 item');
  if (estado.itensNoCarrinho !== 0) problemas.push(`carrinho com ${estado.itensNoCarrinho} item(ns)`);
  if (!estado.estoque || estado.estoque.reservada !== 0) problemas.push('reserva de estoque remanescente');
  if (estado.estoque && estado.estoque.fisica !== 48) problemas.push(`estoque ${estado.estoque?.fisica} (esperado 48)`);
  return problemas;
}

async function semear(config, client) {
  await criarAdminDirect(client, config.senha);
  const token = await login(config);

  const entregador = await api(config, 'POST', '/admin/entregadores', {
    token,
    corpo: {
      nome: 'D106 Entregador', email: EMAILS.entregador,
      telefone: '11900000002', senha: config.senha,
    },
  });
  const categoria = await api(config, 'POST', '/admin/categorias', {
    token, corpo: { nome: 'D106 Categoria', descricao: 'Fixture sintetica D106' },
  });
  const produto = await api(config, 'POST', '/admin/produtos', {
    token,
    corpo: {
      categoriaId: categoria.id, nome: 'D106 Cupcake', descricao: 'Fixture sintetica D106',
      precoAtual: '12.50', ativo: true,
    },
  });
  await api(config, 'PATCH', `/admin/produtos/${produto.id}/estoque`, {
    token, corpo: { quantidadeDisponivel: 50 },
  });
  config.produtoId = produto.id;
  await api(config, 'PUT', '/admin/configuracao-loja-entrega', {
    token,
    corpo: {
      latitudeLoja: '-23.561500', longitudeLoja: '-46.655900',
      raioMaximoAtendimento: '50.000', taxaBase: '5.00', valorPorQuilometro: '1.50',
    },
  });

  const cliente = await api(config, 'POST', '/users', {
    corpo: {
      nome: 'D106 Cliente', email: EMAILS.cliente,
      telefone: '11900000003', senha: config.senha,
    },
  });
  const loginCliente = await api(config, 'POST', '/auth/login', {
    corpo: { email: EMAILS.cliente, senha: config.senha },
  });
  const tokenCliente = loginCliente?.accessToken;
  if (!tokenCliente) falhar('Login do CLIENTE D106 não retornou accessToken.');

  const endereco = await api(config, 'POST', '/enderecos', {
    token: tokenCliente,
    corpo: {
      rua: 'Rua D106', numero: '100', bairro: 'Bairro D106', cidade: 'Sao Paulo',
      cep: '01000-000', complemento: 'Apto 1', referencia: 'Proximo a praca D106',
    },
  });
  await client.query(
    `UPDATE "Endereco" SET latitude = -23.562000, longitude = -46.656000 WHERE id = $1::uuid`,
    [endereco.id],
  );

  await limparCarrinho(config, tokenCliente);
  const o1 = await criarPedidoPago(config, tokenCliente, {
    modalidade: 'RETIRADA', sufixo: '02',
  });
  await limparCarrinho(config, tokenCliente);
  const o2 = await criarPedidoPago(config, tokenCliente, {
    modalidade: 'ENTREGA', enderecoId: endereco.id, sufixo: '04',
  });
  await api(config, 'PATCH', `/admin/pedidos/${o2}/iniciar-producao`, { token });
  await api(config, 'PATCH', `/admin/pedidos/${o2}/saiu-para-entrega`, {
    token, corpo: { entregadorUsuarioId: entregador.id },
  });
  const itensLimpos = await limparCarrinho(config, tokenCliente);
  return { entregador, categoria, produto, cliente, endereco, o1, o2, itensLimpos };
}

/**
 * Guarda de SHA (R-02): no staging a variável é obrigatória; se presente e diferente
 * do SHA real, a execução prossegue com aviso registrado (`shaDivergente`), porque o
 * build disponível pode ser anterior ao candidato (D-01 não autorizado). No modo
 * local a exigência só vale com D106_EXIGIR_SHA=1 (usado para testar o guard).
 */
function validarSha(config) {
  const exige = !config.local || process.env.D106_EXIGIR_SHA === '1';
  if (exige && !config.expectedSha) {
    falhar('D106_EXPECTED_SHA é obrigatório no modo staging; informe o SHA real de state/deployed-sha.');
  }
  if (config.expectedSha && config.deployedSha !== config.expectedSha) {
    config.shaDivergente = true;
    log(`AVISO: SHA implantado ${config.deployedSha} difere de D106_EXPECTED_SHA ${config.expectedSha}; `
      + 'prosseguindo com registro (D-01 não autorizado).');
  }
  if (!config.expectedSha) {
    log(`AVISO (modo local): SHA sem D106_EXPECTED_SHA (implantado=${config.deployedSha}).`);
  }
}

async function main() {
  const config = lerConfig();
  validarSha(config);
  const client = conexao(config.databaseUrl);
  await client.connect();
  try {
    const saude = await fetch(`${config.apiUrl}/health`, { signal: AbortSignal.timeout(10_000) })
      .then((r) => r.json()).catch(() => null);
    if (!saude || saude.status !== 'ok') falhar(`API em ${config.apiUrl} não está saudável.`);

    const antes = await coletarAlvos(client);
    const contagensAntes = await contagens(client);

    if (!config.aplicar) {
      saida({
        modo: 'dry-run',
        banco: 'cupcake_staging',
        api: config.apiUrl,
        shaImplantado: config.deployedSha,
        esperadoSha: config.expectedSha || null,
        shaDivergente: config.shaDivergente,
        senhaRuntime: AVISO_SENHA,
        alvosD106Existentes: {
          usuarios: antes.usuarios.map((u) => u.email),
          produtos: antes.produtos.length,
          categorias: antes.categorias.length,
          pedidos: antes.pedidos.length,
        },
        contagensAntes,
        configuracaoEntregaExistente: (await snapshotConfiguracao(client)).length,
        aviso: 'Nenhuma escrita executada. Use --apply para reset+seed.',
      });
      return;
    }

    const snapshot = await snapshotConfiguracao(client);
    const removidos = await reset(client, antes);
    const depoisReset = await contagens(client);

    let seed = null;
    let erroSeed = null;
    try {
      seed = await semear(config, client);
    } catch (erro) {
      erroSeed = erro;
    }
    try {
      await restaurarConfiguracao(client, snapshot);
    } catch (erro) {
      erroSeed = erroSeed ?? erro;
    }
    if (erroSeed) throw erroSeed;

    const { entregador, categoria, produto, cliente, endereco, o1, o2, itensLimpos } = seed;
    const alvos = await coletarAlvos(client);
    const estado = await estadoFinal(client, alvos);
    const problemas = validarEstado(estado);
    if (itensLimpos !== 0) problemas.push(`carrinho com ${itensLimpos} item(ns) após a limpeza final`);
    if (problemas.length) falhar(`Estado final inválido: ${problemas.join('; ')}`);

    saida({
      modo: 'apply',
      banco: 'cupcake_staging',
      api: config.apiUrl,
      shaImplantado: config.deployedSha,
      esperadoSha: config.expectedSha || null,
      shaDivergente: config.shaDivergente,
      senhaRuntime: AVISO_SENHA,
      remocoes: removidos,
      contagensAntes,
      contagensDepoisDoReset: depoisReset,
      configuracaoEntrega: {
        snapshotRestaurado: true,
        registrosRestaurados: snapshot.length,
        observacao: 'A configuração de entrega foi aplicada apenas durante o seed para criar o O2 e restaurada ao estado original.',
      },
      contas: estado.contas,
      ids: {
        categoria: categoria.id, produto: produto.id, endereco: endereco.id,
        cliente: cliente.id, entregador: entregador.id,
        o1PagoRetirada: o1, o2SaiuParaEntrega: o2,
      },
      pedidos: estado.pedidos,
      estoque: estado.estoque,
      itensNoCarrinho: estado.itensNoCarrinho,
      contagensFinais: await contagens(client),
      resumo: createHash('sha256').update(JSON.stringify(estado)).digest('hex').slice(0, 16),
    });
  } finally {
    await client.end().catch(() => {});
  }
}

main().catch((erro) => {
  process.stderr.write(`D106 fixtures: ${erro instanceof Error ? erro.message : String(erro)}\n`);
  process.exitCode = 1;
});
