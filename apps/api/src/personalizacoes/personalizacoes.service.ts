import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePersonalizacaoDto } from './dto/create-personalizacao.dto';
import { UpdatePersonalizacaoDto } from './dto/update-personalizacao.dto';

const personalizacaoSelect = {
  id: true, nome: true, descricao: true, disponibilidade: true, ajusteValor: true,
} as const;

type PersonalizacaoRow = {
  id: string;
  nome: string;
  descricao: string | null;
  disponibilidade: boolean;
  ajusteValor: Prisma.Decimal | null;
};

function response(row: PersonalizacaoRow) {
  return { ...row, ajusteValor: row.ajusteValor?.toFixed(2) ?? null };
}

@Injectable()
export class PersonalizacoesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreatePersonalizacaoDto) {
    const row = await this.prisma.personalizacao.create({
      data: {
        nome: input.nome,
        descricao: input.descricao,
        disponibilidade: input.disponibilidade ?? true,
        ajusteValor: input.ajusteValor === undefined || input.ajusteValor === null
          ? input.ajusteValor : new Prisma.Decimal(input.ajusteValor),
      },
      select: personalizacaoSelect,
    });
    return response(row);
  }

  async list() {
    const rows = await this.prisma.personalizacao.findMany({
      orderBy: [{ nome: 'asc' }, { id: 'asc' }],
      select: personalizacaoSelect,
    });
    return rows.map(response);
  }

  async findById(id: string) {
    const row = await this.prisma.personalizacao.findUnique({
      where: { id }, select: personalizacaoSelect,
    });
    if (!row) throw new NotFoundException('Personalização não encontrada.');
    return response(row);
  }

  async update(id: string, input: UpdatePersonalizacaoDto) {
    try {
      const row = await this.prisma.personalizacao.update({
        where: { id },
        data: {
          nome: input.nome,
          descricao: input.descricao,
          disponibilidade: input.disponibilidade,
          ajusteValor: input.ajusteValor === undefined || input.ajusteValor === null
            ? input.ajusteValor : new Prisma.Decimal(input.ajusteValor),
        },
        select: personalizacaoSelect,
      });
      return response(row);
    } catch (error) {
      if (this.isPrismaError(error, 'P2025')) {
        throw new NotFoundException('Personalização não encontrada.');
      }
      throw error;
    }
  }

  async remove(id: string): Promise<void> {
    try {
      await this.prisma.personalizacao.delete({ where: { id }, select: { id: true } });
    } catch (error) {
      if (this.isPrismaError(error, 'P2025')) {
        throw new NotFoundException('Personalização não encontrada.');
      }
      if (this.isPrismaError(error, 'P2003')) {
        throw new ConflictException('Personalização possui vínculos protegidos.');
      }
      throw error;
    }
  }

  private isPrismaError(error: unknown, code: string): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
  }
}
