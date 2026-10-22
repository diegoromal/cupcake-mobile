import { randomUUID } from 'node:crypto';
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { classificar, leituraDoCarrinho } from '../carrinho/carrinho.service';
import { calcularCoberturaFrete } from '../enderecos/cobertura-frete.service';
import { Prisma } from '../generated/prisma/client';
import { ModalidadeRecebimento } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { CriarPedidoDto } from './dto/criar-pedido.dto';

const limiteMonetario = new Prisma.Decimal('9999999999.99');

@Injectable()
export class PedidosService {
  constructor(private readonly prisma: PrismaService) {}

  async criar(usuarioId: string, input: CriarPedidoDto) {
    if (input.modalidade === ModalidadeRecebimento.RETIRADA && input.enderecoId !== undefined) {
      throw new BadRequestException('Retirada não aceita endereço.');
    }
    if (input.modalidade === ModalidadeRecebimento.ENTREGA && !input.enderecoId) {
      throw new BadRequestException('Endereço obrigatório para entrega.');
    }

    return this.prisma.$transaction(async (db) => {
      const carrinho = await db.carrinho.findUnique({
        where: { usuarioId }, select: leituraDoCarrinho,
      });
      if (!carrinho) throw new NotFoundException('Carrinho não encontrado.');
      if (carrinho.itens.length === 0) throw new ConflictException('Carrinho vazio.');

      const linhas = carrinho.itens.map((item) => ({ persistido: item, calculado: classificar(item) }));
      if (linhas.some(({ persistido, calculado }) =>
          !Number.isInteger(persistido.quantidade) || persistido.quantidade < 1 ||
          !calculado.item.disponivel || calculado.item.precoUnitario === null ||
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
        endereco = await db.endereco.findFirst({
          where: { id: input.enderecoId, usuarioId },
        });
        if (!endereco) throw new NotFoundException('Endereço não encontrado.');
        const configuracao = await db.configuracaoLojaEntrega.findFirst({
          select: {
            latitudeLoja: true, longitudeLoja: true, raioMaximoAtendimento: true,
            taxaBase: true, valorPorQuilometro: true,
          },
        });
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

      const demanda = new Map<string, { quantidade: number; fisica: number; reservada: number }>();
      for (const { persistido } of linhas) {
        const estoque = persistido.produto.estoque;
        if (!estoque) throw new ConflictException('Estoque indisponível.');
        const anterior = demanda.get(persistido.produtoId);
        demanda.set(persistido.produtoId, {
          quantidade: (anterior?.quantidade ?? 0) + persistido.quantidade,
          fisica: estoque.quantidadeFisica,
          reservada: estoque.quantidadeReservada,
        });
      }
      for (const { quantidade, fisica, reservada } of demanda.values()) {
        if (quantidade > fisica - reservada) {
          throw new ConflictException('Estoque indisponível.');
        }
      }

      const pedido = await db.pedido.create({
        data: {
          identificadorNegocio: `PED-${randomUUID()}`,
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
      for (const [produtoId, { quantidade }] of demanda) {
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
    });
  }
}
