import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEnderecoDto, normalizarCep } from './dto/create-endereco.dto';
import { UpdateEnderecoDto } from './dto/update-endereco.dto';

const enderecoSelect = {
  id: true, rua: true, numero: true, bairro: true, cidade: true, cep: true,
  complemento: true, referencia: true, latitude: true, longitude: true, statusLocalizacao: true,
} as const;

@Injectable()
export class EnderecosService {
  constructor(private readonly prisma: PrismaService) {}

  criar(usuarioId: string, input: CreateEnderecoDto) {
    return this.prisma.endereco.create({
      data: {
        usuarioId, rua: input.rua, numero: input.numero, bairro: input.bairro,
        cidade: input.cidade, cep: normalizarCep(input.cep),
        complemento: input.complemento || null, referencia: input.referencia || null,
      },
      select: enderecoSelect,
    });
  }

  listar(usuarioId: string) {
    return this.prisma.endereco.findMany({ where: { usuarioId }, orderBy: { id: 'asc' }, select: enderecoSelect });
  }

  async atualizar(usuarioId: string, id: string, input: UpdateEnderecoDto) {
    if (Object.keys(input).length === 0) throw new BadRequestException('Informe ao menos um campo.');
    const atual = await this.prisma.endereco.findFirst({ where: { id, usuarioId }, select: enderecoSelect });
    if (!atual) throw new NotFoundException('Endereço não encontrado.');
    const cep = input.cep === undefined ? atual.cep : normalizarCep(input.cep);
    const buscaAlterada = (['rua', 'numero', 'bairro', 'cidade'] as const)
      .some((field) => input[field] !== undefined && input[field] !== atual[field]) || cep !== atual.cep;
    const data: Prisma.EnderecoUpdateManyMutationInput = {
      ...(input.rua !== undefined && { rua: input.rua }),
      ...(input.numero !== undefined && { numero: input.numero }),
      ...(input.bairro !== undefined && { bairro: input.bairro }),
      ...(input.cidade !== undefined && { cidade: input.cidade }),
      ...(input.cep !== undefined && { cep }),
      ...(input.complemento !== undefined && { complemento: input.complemento || null }),
      ...(input.referencia !== undefined && { referencia: input.referencia || null }),
      ...(buscaAlterada && { latitude: null, longitude: null, statusLocalizacao: 'PENDENTE' as const }),
    };
    const updated = await this.prisma.endereco.updateMany({ where: { id, usuarioId }, data });
    if (updated.count !== 1) throw new NotFoundException('Endereço não encontrado.');
    return this.prisma.endereco.findFirst({ where: { id, usuarioId }, select: enderecoSelect });
  }

  async excluir(usuarioId: string, id: string): Promise<void> {
    try {
      const deleted = await this.prisma.endereco.deleteMany({ where: { id, usuarioId } });
      if (deleted.count !== 1) throw new NotFoundException('Endereço não encontrado.');
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
        throw new ConflictException('Endereço em uso.');
      }
      throw error;
    }
  }

}
