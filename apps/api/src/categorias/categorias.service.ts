import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoriaDto } from './dto/create-categoria.dto';
import { UpdateCategoriaDto } from './dto/update-categoria.dto';

const categoriaSelect = { id: true, nome: true, descricao: true } as const;

@Injectable()
export class CategoriasService {
  constructor(private readonly prisma: PrismaService) {}

  create(input: CreateCategoriaDto) {
    return this.prisma.categoria.create({
      data: { nome: input.nome, descricao: input.descricao },
      select: categoriaSelect,
    });
  }

  list() {
    return this.prisma.categoria.findMany({
      orderBy: [{ nome: 'asc' }, { id: 'asc' }],
      select: categoriaSelect,
    });
  }

  async findById(id: string) {
    const categoria = await this.prisma.categoria.findUnique({
      where: { id }, select: categoriaSelect,
    });
    if (!categoria) throw new NotFoundException('Categoria não encontrada.');
    return categoria;
  }

  async update(id: string, input: UpdateCategoriaDto) {
    try {
      return await this.prisma.categoria.update({
        where: { id }, data: input, select: categoriaSelect,
      });
    } catch (error) {
      if (this.isPrismaError(error, 'P2025')) {
        throw new NotFoundException('Categoria não encontrada.');
      }
      throw error;
    }
  }

  async remove(id: string): Promise<void> {
    try {
      await this.prisma.categoria.delete({ where: { id }, select: { id: true } });
    } catch (error) {
      if (this.isPrismaError(error, 'P2025')) {
        throw new NotFoundException('Categoria não encontrada.');
      }
      if (this.isPrismaError(error, 'P2003')) {
        throw new ConflictException('Categoria possui produtos vinculados.');
      }
      throw error;
    }
  }

  private isPrismaError(error: unknown, code: string): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
  }
}
