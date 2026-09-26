import { ConflictException, Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';
import { PerfilUsuario } from '../generated/prisma/enums';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateClientDto } from './dto/create-client.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string) {
    return this.prisma.usuario.findUnique({
      where: { id },
      select: { id: true, perfil: true },
    });
  }

  async createClient(input: CreateClientDto) {
    const nome = input.nome.trim();
    const email = input.email.trim().toLowerCase();
    const telefone = input.telefone.trim();
    const credencialSenha = await argon2.hash(input.senha, {
      type: argon2.argon2id,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    });

    try {
      return await this.prisma.usuario.create({
        data: {
          nome,
          email,
          telefone,
          credencialSenha,
          perfil: PerfilUsuario.CLIENTE,
        },
        select: {
          id: true,
          nome: true,
          email: true,
          telefone: true,
          perfil: true,
        },
      });
    } catch (error) {
      if (this.isEmailUniqueConflict(error)) {
        throw new ConflictException('E-mail já cadastrado.');
      }

      throw error;
    }
  }

  private isEmailUniqueConflict(error: unknown): boolean {
    if (
      !(error instanceof Prisma.PrismaClientKnownRequestError) ||
      error.code !== 'P2002'
    ) {
      return false;
    }

    const target = error.meta?.target;
    if (Array.isArray(target)) {
      return target.includes('email');
    }

    const adapterError = error.meta?.driverAdapterError;
    if (
      typeof adapterError !== 'object' ||
      adapterError === null ||
      !('cause' in adapterError)
    ) {
      return false;
    }

    const cause = adapterError.cause;
    if (
      typeof cause !== 'object' ||
      cause === null ||
      !('kind' in cause) ||
      cause.kind !== 'UniqueConstraintViolation' ||
      !('constraint' in cause)
    ) {
      return false;
    }

    const constraint = cause.constraint;
    return (
      typeof constraint === 'object' &&
      constraint !== null &&
      'index' in constraint &&
      constraint.index === 'Usuario_email_key'
    );
  }
}
