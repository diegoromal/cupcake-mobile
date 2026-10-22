import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEnderecoDto, normalizarCep } from './dto/create-endereco.dto';

const enderecoSelect = {
  id: true, rua: true, numero: true, bairro: true, cidade: true, cep: true,
  complemento: true, referencia: true, latitude: true, longitude: true,
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

}
