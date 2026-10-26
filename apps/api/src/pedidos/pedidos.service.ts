import { createHash, randomUUID } from 'node:crypto';
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { classificar, leituraDoCarrinho } from '../carrinho/carrinho.service';
import { calcularCoberturaFrete } from '../enderecos/cobertura-frete.service';
import { Prisma } from '../generated/prisma/client';
import { ModalidadeRecebimento, PerfilUsuario, StatusPedido } from '../generated/prisma/enums';
import { NotificacoesService, EventoStatusPedido } from '../notificacoes/notificacoes.service';
import { PrismaService } from '../prisma/prisma.service';
import { CriarPedidoDto } from './dto/criar-pedido.dto';
import { TransicaoPedidoInvalidaError, validarTransicaoPedido } from './maquina-estados-pedido';

const limiteMonetario = new Prisma.Decimal('9999999999.99');

@Injectable()
export class PedidosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificacoes: NotificacoesService,
  ) {}

  async listarParaCliente(clienteUsuarioId: string) {
    const pedidos = await this.prisma.pedido.findMany({
      where: { clienteUsuarioId },
      select: {
        id: true,
        identificadorNegocio: true,
        data: true,
        modalidade: true,
        total: true,
        statusAtual: true,
      },
      orderBy: [{ data: 'desc' }, { id: 'desc' }],
    });
    return pedidos.map((pedido) => ({
      ...pedido,
      total: pedido.total.toFixed(2),
    }));
  }

  listarParaEntregador(entregadorUsuarioId: string) {
    return this.prisma.pedido.findMany({
      where: { entregadorUsuarioId, modalidade: ModalidadeRecebimento.ENTREGA },
      select: { id: true, identificadorNegocio: true, statusAtual: true },
    });
  }

  async detalharParaEntregador(id: string, entregadorUsuarioId: string) {
    const pedido = await this.prisma.pedido.findFirst({
      where: { id, entregadorUsuarioId, modalidade: ModalidadeRecebimento.ENTREGA },
      select: {
        identificadorNegocio: true,
        cliente: { select: { nome: true, telefone: true } },
        enderecoEntregaSnapshot: { select: {
          rua: true, numero: true, bairro: true, cidade: true, cep: true,
          complemento: true, referencia: true,
        } },
        historicosStatus: {
          where: { statusRegistrado: StatusPedido.SAIU_PARA_ENTREGA },
          orderBy: [{ dataHora: 'desc' }, { id: 'desc' }], take: 1,
          select: { dataHora: true },
        },
      },
    });
    if (!pedido) throw new NotFoundException('Pedido não encontrado.');
    return {
      identificadorNegocio: pedido.identificadorNegocio,
      cliente: pedido.cliente,
      enderecoEntregaSnapshot: pedido.enderecoEntregaSnapshot,
      dataHoraSaidaParaEntrega: pedido.historicosStatus[0]?.dataHora ?? null,
    };
  }

  listarParaAdministracao() {
    return this.prisma.pedido.findMany({
      where: {
        statusAtual: {
          in: [
            StatusPedido.PAGO,
            StatusPedido.EM_PREPARO,
            StatusPedido.SAIU_PARA_ENTREGA,
            StatusPedido.ENTREGUE,
            StatusPedido.PRONTO_PARA_RETIRADA,
            StatusPedido.RETIRADO,
            StatusPedido.CANCELADO,
          ],
        },
      },
      select: {
        id: true,
        identificadorNegocio: true,
        confirmacaoPagamento: true,
        cliente: { select: { nome: true } },
        modalidade: true,
        statusAtual: true,
        total: true,
      },
      orderBy: [{ confirmacaoPagamento: { sort: 'asc', nulls: 'last' } }, { id: 'asc' }],
    });
  }

  async detalharParaAdministracao(id: string) {
    const pedido = await this.prisma.pedido.findUnique({
      where: { id },
      select: {
        id: true, identificadorNegocio: true, confirmacaoPagamento: true,
        cliente: { select: { nome: true } }, entregador: { select: { id: true, nome: true } },
        modalidade: true, statusAtual: true,
        valorItens: true, freteAplicado: true, total: true,
        enderecoEntregaSnapshot: { select: {
          rua: true, numero: true, bairro: true, cidade: true, cep: true,
          complemento: true, referencia: true,
        } },
        itens: { orderBy: { id: 'asc' }, select: {
          id: true, quantidade: true, precoAplicado: true, subtotalAplicado: true,
          produto: { select: { nome: true } },
          personalizacoes: { orderBy: { id: 'asc' }, select: {
            nomeAplicado: true, ajusteValorAplicado: true,
          } },
        } },
        pagamentos: { where: { resultado: 'APROVADO' },
          orderBy: [{ dataTransacao: 'desc' }, { id: 'desc' }], take: 1,
          select: { forma: true } },
        historicosStatus: { orderBy: [{ dataHora: 'asc' }, { id: 'asc' }], select: {
          id: true, statusRegistrado: true, dataHora: true,
          responsavel: { select: { nome: true } },
        } },
      },
    });
    if (!pedido) throw new NotFoundException('Pedido não encontrado.');
    return {
      id: pedido.id, identificadorNegocio: pedido.identificadorNegocio,
      confirmacaoPagamento: pedido.confirmacaoPagamento,
      cliente: pedido.cliente, entregador: pedido.entregador,
      modalidade: pedido.modalidade, statusAtual: pedido.statusAtual,
      valorItens: pedido.valorItens.toFixed(2), freteAplicado: pedido.freteAplicado.toFixed(2),
      total: pedido.total.toFixed(2),
      enderecoEntregaSnapshot: pedido.modalidade === ModalidadeRecebimento.ENTREGA
        ? pedido.enderecoEntregaSnapshot : null,
      formaPagamento: pedido.pagamentos[0]?.forma ?? null,
      historicoStatus: pedido.historicosStatus.map((historico) => ({
        id: historico.id, status: historico.statusRegistrado,
        dataHora: historico.dataHora, responsavel: historico.responsavel?.nome ?? null,
      })),
      itens: pedido.itens.map((item) => ({
        id: item.id, nome: item.produto.nome, quantidade: item.quantidade,
        precoAplicado: item.precoAplicado.toFixed(2),
        subtotalAplicado: item.subtotalAplicado.toFixed(2),
        personalizacoes: item.personalizacoes.map((personalizacao) => ({
          nomeAplicado: personalizacao.nomeAplicado,
          ajusteValorAplicado: personalizacao.ajusteValorAplicado?.toFixed(2) ?? null,
        })),
      })),
    };
  }

  async iniciarProducao(id: string, responsavelUsuarioId: string) {
    return this.transicionarPorAdministracao(
      id, responsavelUsuarioId, StatusPedido.EM_PREPARO, 'Pedido não pode iniciar a produção neste status.',
    );
  }

  async sairParaEntrega(id: string, entregadorUsuarioId: string, responsavelUsuarioId: string) {
    const evento = await this.prisma.$transaction(async (db): Promise<EventoStatusPedido> => {
      const [pedido] = await db.$queryRaw<Array<{
        statusAtual: StatusPedido; modalidade: ModalidadeRecebimento;
        identificadorNegocio: string; telefone: string;
      }>>`SELECT p."statusAtual", p.modalidade, p."identificadorNegocio", u.telefone
        FROM "Pedido" p JOIN "Usuario" u ON u.id = p."clienteUsuarioId"
        WHERE p.id = ${id}::uuid FOR UPDATE OF p`;
      if (!pedido) throw new NotFoundException('Pedido não encontrado.');
      if (pedido.statusAtual !== StatusPedido.EM_PREPARO ||
          pedido.modalidade !== ModalidadeRecebimento.ENTREGA) {
        throw new ConflictException('Pedido não pode sair para entrega neste status.');
      }

      const entregadores = await db.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM "Usuario"
        WHERE id = ${entregadorUsuarioId}::uuid AND perfil = ${PerfilUsuario.ENTREGADOR}::"PerfilUsuario"
        FOR SHARE`;
      if (!entregadores.length) throw new NotFoundException('Entregador não encontrado.');

      const [{ agora }] = await db.$queryRaw<Array<{ agora: Date }>>`
        SELECT clock_timestamp() AS agora`;
      const atualizado = await db.pedido.updateMany({
        where: { id, statusAtual: StatusPedido.EM_PREPARO, modalidade: ModalidadeRecebimento.ENTREGA },
        data: { entregadorUsuarioId, statusAtual: StatusPedido.SAIU_PARA_ENTREGA },
      });
      if (atualizado.count !== 1) {
        throw new ConflictException('Pedido alterado durante a saída para entrega.');
      }
      await db.historicoStatusPedido.create({ data: {
        pedidoId: id, statusRegistrado: StatusPedido.SAIU_PARA_ENTREGA, dataHora: agora,
        responsavelUsuarioId,
      } });
      return {
        pedidoId: id, identificadorNegocio: pedido.identificadorNegocio,
        telefone: pedido.telefone, status: StatusPedido.SAIU_PARA_ENTREGA,
      };
    });
    this.notificacoes.agendarStatusPedido(evento);
    return this.detalharParaAdministracao(id);
  }

  async confirmarEntrega(id: string, entregadorUsuarioId: string) {
    const transicao = await this.prisma.$transaction(async (db) => {
      const [pedido] = await db.$queryRaw<Array<{
        statusAtual: StatusPedido; modalidade: ModalidadeRecebimento;
        identificadorNegocio: string; telefone: string;
      }>>`SELECT p."statusAtual", p.modalidade, p."identificadorNegocio", u.telefone
          FROM "Pedido" p JOIN "Usuario" u ON u.id = p."clienteUsuarioId"
          WHERE p.id = ${id}::uuid AND p."entregadorUsuarioId" = ${entregadorUsuarioId}::uuid
          FOR UPDATE OF p`;
      if (!pedido) throw new NotFoundException('Pedido não encontrado.');

      try {
        validarTransicaoPedido(pedido.statusAtual, StatusPedido.ENTREGUE, pedido.modalidade);
      } catch (error) {
        if (error instanceof TransicaoPedidoInvalidaError) {
          throw new ConflictException('Pedido não pode ser confirmado como entregue neste status.');
        }
        throw error;
      }

      const [{ agora }] = await db.$queryRaw<Array<{ agora: Date }>>`
        SELECT clock_timestamp() AS agora`;
      const atualizado = await db.pedido.updateMany({
        where: {
          id, entregadorUsuarioId, modalidade: ModalidadeRecebimento.ENTREGA,
          statusAtual: StatusPedido.SAIU_PARA_ENTREGA,
        },
        data: { statusAtual: StatusPedido.ENTREGUE },
      });
      if (atualizado.count !== 1) {
        throw new ConflictException('Pedido alterado durante a confirmação da entrega.');
      }
      await db.historicoStatusPedido.create({ data: {
        pedidoId: id, statusRegistrado: StatusPedido.ENTREGUE,
        dataHora: agora, responsavelUsuarioId: entregadorUsuarioId,
      } });
      return {
        resultado: { statusAtual: StatusPedido.ENTREGUE, dataHora: agora },
        evento: {
          pedidoId: id, identificadorNegocio: pedido.identificadorNegocio,
          telefone: pedido.telefone, status: StatusPedido.ENTREGUE,
        } satisfies EventoStatusPedido,
      };
    });
    this.notificacoes.agendarStatusPedido(transicao.evento);
    return transicao.resultado;
  }

  async cancelarComoCliente(id: string, clienteUsuarioId: string) {
    await this.prisma.$transaction(async (db) => {
      const [pedido] = await db.$queryRaw<Array<{ statusAtual: StatusPedido }>>`
        SELECT "statusAtual" FROM "Pedido"
        WHERE id = ${id}::uuid AND "clienteUsuarioId" = ${clienteUsuarioId}::uuid
        FOR UPDATE`;
      if (!pedido) throw new NotFoundException('Pedido não encontrado.');

      try {
        validarTransicaoPedido(pedido.statusAtual, StatusPedido.CANCELADO);
      } catch (error) {
        if (error instanceof TransicaoPedidoInvalidaError) {
          throw new ConflictException('Pedido não pode ser cancelado neste status.');
        }
        throw error;
      }

      const candidatas = await db.$queryRaw<Array<{
        id: string; produtoId: string; estado: string;
      }>>`
        SELECT id, "produtoId", estado::text AS estado FROM "ReservaEstoque"
        WHERE "pedidoId" = ${id}::uuid
        ORDER BY "produtoId", id`;
      if (!candidatas.length) {
        throw new ConflictException('Pedido pago sem reserva convertida para devolução.');
      }
      if (candidatas.some((reserva) => reserva.estado !== 'CONVERTIDA_EM_VENDA')) {
        throw new ConflictException('Pedido pago possui reserva em estado incompatível.');
      }

      for (const produtoId of [...new Set(candidatas.map((reserva) => reserva.produtoId))].sort()) {
        const [estoque] = await db.$queryRaw<Array<{ produtoId: string }>>`
          SELECT "produtoId" FROM "Estoque" WHERE "produtoId" = ${produtoId}::uuid FOR UPDATE`;
        if (!estoque) throw new ConflictException('Estoque indisponível para devolver o pedido.');
      }

      const reservas = await db.$queryRaw<Array<{
        id: string; produtoId: string; quantidade: number; estado: string;
      }>>`
        SELECT id, "produtoId", quantidade, estado::text AS estado FROM "ReservaEstoque"
        WHERE "pedidoId" = ${id}::uuid
        ORDER BY "produtoId", id FOR UPDATE`;
      if (reservas.length !== candidatas.length || reservas.some((reserva, index) =>
        reserva.id !== candidatas[index].id || reserva.produtoId !== candidatas[index].produtoId ||
        reserva.estado !== candidatas[index].estado || reserva.estado !== 'CONVERTIDA_EM_VENDA' ||
        !Number.isSafeInteger(reserva.quantidade) || reserva.quantidade <= 0)) {
        throw new ConflictException('Reservas alteradas durante o cancelamento.');
      }

      const totais = new Map<string, number>();
      for (const reserva of reservas) {
        totais.set(reserva.produtoId, (totais.get(reserva.produtoId) ?? 0) + reserva.quantidade);
      }
      if ([...totais.values()].some((quantidade) => !Number.isSafeInteger(quantidade))) {
        throw new ConflictException('Quantidade de estoque inválida para devolução.');
      }
      const [{ agora }] = await db.$queryRaw<Array<{ agora: Date }>>`
        SELECT clock_timestamp() AS agora`;
      for (const produtoId of [...totais.keys()].sort()) {
        const quantidade = totais.get(produtoId)!;
        const atualizado = await db.estoque.updateMany({
          where: { produtoId, quantidadeFisica: { lte: 2_147_483_647 - quantidade } },
          data: { quantidadeFisica: { increment: quantidade } },
        });
        if (atualizado.count !== 1) {
          throw new ConflictException('Saldo de estoque inconsistente para devolução.');
        }
      }

      for (const reserva of reservas) {
        const devolvida = await db.reservaEstoque.updateMany({
          where: { id: reserva.id, pedidoId: id, estado: 'CONVERTIDA_EM_VENDA' },
          data: { estado: 'DEVOLVIDA_POR_CANCELAMENTO' },
        });
        if (devolvida.count !== 1) {
          throw new ConflictException('Reserva alterada durante o cancelamento.');
        }
        await db.movimentacaoEstoque.create({ data: {
          produtoId: reserva.produtoId, pedidoId: id, quantidade: reserva.quantidade,
          motivoOrigem: 'CANCELAMENTO_PEDIDO', data: agora,
        } });
      }

      const atualizado = await db.pedido.updateMany({
        where: { id, clienteUsuarioId, statusAtual: pedido.statusAtual },
        data: { statusAtual: StatusPedido.CANCELADO },
      });
      if (atualizado.count !== 1) {
        throw new ConflictException('Pedido alterado durante o cancelamento.');
      }
      await db.historicoStatusPedido.create({ data: {
        pedidoId: id, statusRegistrado: StatusPedido.CANCELADO, dataHora: agora,
        responsavelUsuarioId: clienteUsuarioId,
      } });
    });
    return { id, statusAtual: StatusPedido.CANCELADO };
  }

  async marcarProntoParaRetirada(id: string, responsavelUsuarioId: string) {
    return this.transicionarPorAdministracao(
      id, responsavelUsuarioId, StatusPedido.PRONTO_PARA_RETIRADA,
      'Pedido não pode ser marcado pronto para retirada neste status.',
    );
  }

  async confirmarRetirada(id: string, responsavelUsuarioId: string) {
    return this.transicionarPorAdministracao(
      id, responsavelUsuarioId, StatusPedido.RETIRADO, 'Pedido não pode ser retirado neste status.',
    );
  }

  private async transicionarPorAdministracao(
    id: string, responsavelUsuarioId: string, proximo: StatusPedido, mensagemInvalida: string,
  ) {
    const evento = await this.prisma.$transaction(async (db): Promise<EventoStatusPedido> => {
      const [pedido] = await db.$queryRaw<Array<{
        statusAtual: StatusPedido; modalidade: ModalidadeRecebimento;
        identificadorNegocio: string; telefone: string;
      }>>`SELECT p."statusAtual", p.modalidade, p."identificadorNegocio", u.telefone
          FROM "Pedido" p JOIN "Usuario" u ON u.id = p."clienteUsuarioId"
          WHERE p.id = ${id}::uuid FOR UPDATE OF p`;
      if (!pedido) throw new NotFoundException('Pedido não encontrado.');

      try {
        validarTransicaoPedido(pedido.statusAtual, proximo, pedido.modalidade);
      } catch (error) {
        if (error instanceof TransicaoPedidoInvalidaError) {
          throw new ConflictException(mensagemInvalida);
        }
        throw error;
      }

      const [{ agora }] = await db.$queryRaw<Array<{ agora: Date }>>`
        SELECT clock_timestamp() AS agora`;
      const atualizado = await db.pedido.updateMany({
        where: { id, statusAtual: pedido.statusAtual },
        data: { statusAtual: proximo },
      });
      if (atualizado.count !== 1) {
        throw new ConflictException('Pedido alterado durante a atualização do status.');
      }
      await db.historicoStatusPedido.create({ data: {
        pedidoId: id, statusRegistrado: proximo, dataHora: agora,
        responsavelUsuarioId,
      } });
      return {
        pedidoId: id, identificadorNegocio: pedido.identificadorNegocio,
        telefone: pedido.telefone, status: proximo,
      };
    });
    this.notificacoes.agendarStatusPedido(evento);
    return this.detalharParaAdministracao(id);
  }

  async revisar(usuarioId: string, input: CriarPedidoDto) {
    return this.processar(usuarioId, input, false);
  }

  async criar(usuarioId: string, input: CriarPedidoDto) {
    if (input.tentativaId && !input.revisaoId) {
      throw new BadRequestException('Referência da revisão obrigatória.');
    }
    const prefixo = input.tentativaId ? `PED-${input.tentativaId}` : null;
    const identificador = prefixo
      ? `${prefixo}-${createHash('sha256').update(JSON.stringify({
          modalidade: input.modalidade, enderecoId: input.enderecoId ?? null,
          revisaoId: input.revisaoId,
        })).digest('hex')}` : `PED-${randomUUID()}`;
    if (input.tentativaId) {
      const anterior = await this.prisma.pedido.findFirst({
        where: { identificadorNegocio: { startsWith: prefixo! } },
        include: { enderecoEntregaSnapshot: true, itens: { include: { personalizacoes: true } } },
      });
      if (anterior) return this.repeticao(anterior, usuarioId, identificador);
    }
    try {
      return await this.processar(usuarioId, input, true, identificador);
    } catch (error) {
      if (input.tentativaId && error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const anterior = await this.prisma.pedido.findFirst({
          where: { identificadorNegocio: { startsWith: prefixo! } },
          include: { enderecoEntregaSnapshot: true, itens: { include: { personalizacoes: true } } },
        });
        if (anterior) return this.repeticao(anterior, usuarioId, identificador);
      }
      throw error;
    }
  }

  private repeticao(pedido: Parameters<PedidosService['apresentar']>[0], usuarioId: string, identificador: string) {
    if (pedido.clienteUsuarioId !== usuarioId || pedido.identificadorNegocio !== identificador) {
      throw new ConflictException('Tentativa de confirmação inválida.');
    }
    return this.apresentar(pedido);
  }

  private async processar(usuarioId: string, input: CriarPedidoDto, persistir: boolean,
    identificador?: string) {
    if (input.modalidade === ModalidadeRecebimento.RETIRADA && input.enderecoId !== undefined) {
      throw new BadRequestException('Retirada não aceita endereço.');
    }
    if (input.modalidade === ModalidadeRecebimento.ENTREGA && !input.enderecoId) {
      throw new BadRequestException('Endereço obrigatório para entrega.');
    }

    return this.prisma.$transaction(async (db) => {
      if (persistir && input.tentativaId) {
        await db.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`PED-${input.tentativaId}`}, 0))::text AS locked`;
        const anterior = await db.pedido.findFirst({
          where: { identificadorNegocio: { startsWith: `PED-${input.tentativaId}` } },
          include: { enderecoEntregaSnapshot: true, itens: { include: { personalizacoes: true } } },
        });
        if (anterior) return this.repeticao(anterior, usuarioId, identificador!);
      }
      if (persistir) {
        // O pai impede novos itens; as linhas filhas impedem alterações e remoções durante a confirmação.
        const [carrinhoBloqueado] = await db.$queryRaw<Array<{ id: string }>>`
          SELECT id FROM "Carrinho" WHERE "usuarioId" = ${usuarioId}::uuid FOR UPDATE`;
        if (!carrinhoBloqueado) throw new NotFoundException('Carrinho não encontrado.');
        const itensBloqueados = await db.$queryRaw<Array<{ id: string; produtoId: string }>>`
          SELECT id, "produtoId" FROM "ItemCarrinho" WHERE "carrinhoId" = ${carrinhoBloqueado.id}::uuid
          ORDER BY id FOR UPDATE`;
        if (!itensBloqueados.length) throw new ConflictException('Carrinho vazio.');
        for (const produtoId of [...new Set(itensBloqueados.map((item) => item.produtoId))].sort()) {
          await db.$queryRaw`SELECT id FROM "Produto" WHERE id = ${produtoId}::uuid FOR UPDATE`;
        }
        const selecoes = await db.$queryRaw<Array<{ itemCarrinhoId: string; personalizacaoId: string }>>`
          SELECT "itemCarrinhoId", "personalizacaoId" FROM "ItemCarrinhoPersonalizacao"
          WHERE "itemCarrinhoId" IN (SELECT id FROM "ItemCarrinho"
            WHERE "carrinhoId" = ${carrinhoBloqueado.id}::uuid)
          ORDER BY "itemCarrinhoId", "personalizacaoId" FOR UPDATE`;
        const produtoPorItem = new Map(itensBloqueados.map((item) => [item.id, item.produtoId]));
        for (const { produtoId, personalizacaoId } of selecoes.map((selecao) => ({
          produtoId: produtoPorItem.get(selecao.itemCarrinhoId)!,
          personalizacaoId: selecao.personalizacaoId,
        })).sort((a, b) => a.produtoId.localeCompare(b.produtoId) ||
          a.personalizacaoId.localeCompare(b.personalizacaoId))) {
          await db.$queryRaw`SELECT "produtoId" FROM "ProdutoPersonalizacao"
            WHERE "produtoId" = ${produtoId}::uuid AND "personalizacaoId" = ${personalizacaoId}::uuid FOR UPDATE`;
        }
      }
      const carrinho = await db.carrinho.findUnique({
        where: { usuarioId }, select: leituraDoCarrinho,
      });
      if (!carrinho) throw new NotFoundException('Carrinho não encontrado.');
      if (carrinho.itens.length === 0) throw new ConflictException('Carrinho vazio.');

      const linhas = carrinho.itens.map((item) => ({ persistido: item, calculado: classificar(item) }));
      if (linhas.some(({ persistido, calculado }) =>
          !Number.isInteger(persistido.quantidade) || persistido.quantidade < 1 ||
          calculado.item.precoUnitario === null ||
          calculado.valor === null || !calculado.valor.isFinite() ||
          calculado.valor.greaterThan(limiteMonetario) ||
          new Prisma.Decimal(calculado.item.precoUnitario).greaterThan(limiteMonetario))) {
        throw new ConflictException('Carrinho contém item indisponível ou inválido.');
      }
      const valorItens = linhas.reduce((total, { calculado }) => total.plus(calculado.valor!),
        new Prisma.Decimal(0));
      if (valorItens.greaterThan(limiteMonetario)) {
        throw new ConflictException('Total dos itens inválido.');
      }

      let freteAplicado = new Prisma.Decimal(0);
      let endereco: Awaited<ReturnType<typeof db.endereco.findFirst>> = null;
      if (input.modalidade === ModalidadeRecebimento.ENTREGA) {
        if (persistir) {
          const [enderecoBloqueado] = await db.$queryRaw<Array<{ id: string }>>`
            SELECT id FROM "Endereco" WHERE id = ${input.enderecoId}::uuid
            AND "usuarioId" = ${usuarioId}::uuid FOR UPDATE`;
          if (!enderecoBloqueado) throw new NotFoundException('Endereço não encontrado.');
        }
        endereco = await db.endereco.findFirst({
          where: { id: input.enderecoId, usuarioId },
        });
        if (!endereco) throw new NotFoundException('Endereço não encontrado.');
        const configuracaoSelect = {
            latitudeLoja: true, longitudeLoja: true, raioMaximoAtendimento: true,
            taxaBase: true, valorPorQuilometro: true,
        } as const;
        const configuracao = await db.configuracaoLojaEntrega.findFirst({ select: configuracaoSelect });
        const cobertura = calcularCoberturaFrete(endereco, configuracao);
        if (cobertura.situacao !== 'ATENDIDO' || cobertura.frete === null) {
          throw new ConflictException('Endereço indisponível para entrega.');
        }
        freteAplicado = new Prisma.Decimal(cobertura.frete);
      }
      const total = valorItens.plus(freteAplicado);
      if (!total.isFinite() || total.greaterThan(limiteMonetario)) {
        throw new ConflictException('Total do pedido inválido.');
      }

      const demanda = new Map<string, number>();
      for (const { persistido } of linhas) {
        if (!persistido.produto.estoque) throw new ConflictException('Estoque indisponível.');
        demanda.set(persistido.produtoId,
          (demanda.get(persistido.produtoId) ?? 0) + persistido.quantidade);
      }
      const produtos = [...demanda.keys()].sort();
      const itensRevisao = linhas.map(({ persistido, calculado }) => ({
        produtoId: persistido.produtoId,
        nome: persistido.produto.nome,
        quantidade: persistido.quantidade,
        precoAplicado: calculado.item.precoUnitario!,
        subtotalAplicado: calculado.valor!.toFixed(2),
        personalizacoes: persistido.personalizacoes.map(({ personalizacao }) => ({
          identificacaoPersonalizacaoAplicada: personalizacao.id,
          nomeAplicado: personalizacao.nome,
          ajusteValorAplicado: personalizacao.ajusteValor?.toFixed(2) ?? null,
        })),
      }));
      const enderecoRevisao = endereco && {
        rua: endereco.rua, numero: endereco.numero, bairro: endereco.bairro,
        cidade: endereco.cidade, cep: endereco.cep,
        complemento: endereco.complemento, referencia: endereco.referencia,
      };
      const revisao = {
        modalidade: input.modalidade, enderecoId: input.enderecoId ?? null,
        enderecoEntregaSnapshot: enderecoRevisao,
        itens: itensRevisao,
        valorItens: valorItens.toFixed(2), freteAplicado: freteAplicado.toFixed(2),
        total: total.toFixed(2),
      };
      const saldos: Array<{ produtoId: string; disponivel: number }> = [];
      if (!persistir) {
        for (const produtoId of produtos) {
          const saldo = linhas.find(({ persistido }) => persistido.produtoId === produtoId)!
            .persistido.produto.estoque!;
          const disponivel = saldo.quantidadeFisica - saldo.quantidadeReservada;
          if (demanda.get(produtoId)! > disponivel) {
            throw new ConflictException('Estoque indisponível.');
          }
          saldos.push({ produtoId, disponivel });
        }
        return { ...revisao, revisaoId: this.assinarRevisao(usuarioId, revisao, saldos) };
      }
      // Uma linha por vez, sempre em ordem, evita inversão de locks entre pedidos.
      for (const produtoId of produtos) {
        const [linha] = await db.$queryRaw<Array<{ produtoId: string }>>`
          SELECT "produtoId" FROM "Estoque" WHERE "produtoId" = ${produtoId}::uuid FOR UPDATE`;
        if (!linha) throw new ConflictException('Estoque indisponível.');
      }
      // Todas as leituras definitivas ocorrem depois da aquisição dos locks.
      for (const produtoId of produtos) {
        const saldo = await db.estoque.findUnique({
          where: { produtoId }, select: { quantidadeFisica: true, quantidadeReservada: true },
        });
        if (!saldo || demanda.get(produtoId)! > saldo.quantidadeFisica - saldo.quantidadeReservada) {
          throw new ConflictException('Estoque indisponível.');
        }
        saldos.push({ produtoId, disponivel: saldo.quantidadeFisica - saldo.quantidadeReservada });
      }
      if (input.revisaoId && input.revisaoId !== this.assinarRevisao(usuarioId, revisao, saldos)) {
        throw new ConflictException('Revisão desatualizada. Atualize os valores.');
      }

      const pedido = await db.pedido.create({
        data: {
          identificadorNegocio: identificador!,
          clienteUsuarioId: usuarioId,
          modalidade: input.modalidade,
          valorItens,
          freteAplicado,
          total,
          ...(endereco && { enderecoEntregaSnapshot: { create: {
            rua: endereco.rua, numero: endereco.numero, bairro: endereco.bairro,
            cidade: endereco.cidade, cep: endereco.cep,
            complemento: endereco.complemento, referencia: endereco.referencia,
          } } }),
          itens: { create: linhas.map(({ persistido, calculado }) => ({
            produtoId: persistido.produtoId,
            quantidade: persistido.quantidade,
            precoAplicado: new Prisma.Decimal(calculado.item.precoUnitario!),
            subtotalAplicado: calculado.valor!,
            personalizacoes: { create: persistido.personalizacoes.map(({ personalizacao }) => ({
              identificacaoPersonalizacaoAplicada: personalizacao.id,
              nomeAplicado: personalizacao.nome,
              ajusteValorAplicado: personalizacao.ajusteValor,
            })) },
          })) },
        },
        include: {
          enderecoEntregaSnapshot: true,
          itens: { include: { personalizacoes: true } },
        },
      });
      await db.historicoStatusPedido.create({ data: {
        pedidoId: pedido.id, statusRegistrado: pedido.statusAtual, dataHora: pedido.data,
      } });
      for (const produtoId of produtos) {
        const quantidade = demanda.get(produtoId)!;
        await db.estoque.update({ where: { produtoId }, data: {
          quantidadeReservada: { increment: quantidade },
        } });
      }
      const momentoExpiracaoValidade = new Date(pedido.data.getTime() + 15 * 60 * 1000);
      for (const item of pedido.itens) {
        await db.reservaEstoque.create({ data: {
          pedidoId: pedido.id,
          produtoId: item.produtoId,
          quantidade: item.quantidade,
          estado: 'ATIVA',
          momentoExpiracaoValidade,
        } });
      }
      return this.apresentar(pedido);
    });
  }

  private assinarRevisao(usuarioId: string, revisao: object, saldos: Array<{ produtoId: string; disponivel: number }>) {
    return createHash('sha256').update(JSON.stringify({ usuarioId, revisao, saldos })).digest('hex');
  }

  private apresentar(pedido: {
    id: string; identificadorNegocio: string; clienteUsuarioId: string;
    modalidade: ModalidadeRecebimento; statusAtual: string;
    valorItens: Prisma.Decimal; freteAplicado: Prisma.Decimal; total: Prisma.Decimal;
    enderecoEntregaSnapshot: {
      rua: string; numero: string; bairro: string; cidade: string; cep: string;
      complemento: string | null; referencia: string | null;
    } | null;
    itens: Array<{
      produtoId: string; quantidade: number; precoAplicado: Prisma.Decimal;
      subtotalAplicado: Prisma.Decimal;
      personalizacoes: Array<{
        identificacaoPersonalizacaoAplicada: string; nomeAplicado: string;
        ajusteValorAplicado: Prisma.Decimal | null;
      }>;
    }>;
  }) {
    return {
        id: pedido.id,
        identificadorNegocio: pedido.identificadorNegocio,
        modalidade: pedido.modalidade,
        statusAtual: pedido.statusAtual,
        valorItens: pedido.valorItens.toFixed(2),
        freteAplicado: pedido.freteAplicado.toFixed(2),
        total: pedido.total.toFixed(2),
        enderecoEntregaSnapshot: pedido.enderecoEntregaSnapshot && {
          rua: pedido.enderecoEntregaSnapshot.rua,
          numero: pedido.enderecoEntregaSnapshot.numero,
          bairro: pedido.enderecoEntregaSnapshot.bairro,
          cidade: pedido.enderecoEntregaSnapshot.cidade,
          cep: pedido.enderecoEntregaSnapshot.cep,
          complemento: pedido.enderecoEntregaSnapshot.complemento,
          referencia: pedido.enderecoEntregaSnapshot.referencia,
        },
        itens: pedido.itens.map((item) => ({
          produtoId: item.produtoId,
          quantidade: item.quantidade,
          precoAplicado: item.precoAplicado.toFixed(2),
          subtotalAplicado: item.subtotalAplicado.toFixed(2),
          personalizacoes: item.personalizacoes.map((snapshot) => ({
            identificacaoPersonalizacaoAplicada: snapshot.identificacaoPersonalizacaoAplicada,
            nomeAplicado: snapshot.nomeAplicado,
            ajusteValorAplicado: snapshot.ajusteValorAplicado?.toFixed(2) ?? null,
          })),
        })),
      };
  }
}
