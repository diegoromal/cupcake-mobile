import { ConflictException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { PerfilUsuario } from '../generated/prisma/enums';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateClientDto } from './dto/create-client.dto';

type LoginState = {
  id: string;
  perfil: PerfilUsuario;
  tentativasLoginInvalidas: number;
  bloqueadoAte: Date | null;
};

const MAX_LOGIN_STATE_RETRIES = 20;
const LOGIN_BLOCK_MILLISECONDS = 15 * 60 * 1000;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findAuthenticationUserByEmail(email: string) {
    return this.prisma.usuario.findUnique({
      where: { email },
      select: {
        id: true,
        perfil: true,
        credencialSenha: true,
        tentativasLoginInvalidas: true,
        bloqueadoAte: true,
      },
    });
  }

  async registerInvalidLogin(initialState: LoginState): Promise<void> {
    await this.transitionLoginState(initialState, false);
  }

  async clearLoginState(initialState: LoginState): Promise<boolean> {
    return this.transitionLoginState(initialState, true);
  }

  private async transitionLoginState(
    initialState: LoginState,
    validPassword: boolean,
  ): Promise<boolean> {
    let state: LoginState | null = initialState;
    for (let attempt = 0; attempt < MAX_LOGIN_STATE_RETRIES; attempt++) {
      if (!state || state.perfil !== PerfilUsuario.CLIENTE) return false;

      const now = new Date();
      if (state.bloqueadoAte && state.bloqueadoAte > now) return false;

      const expired = state.bloqueadoAte !== null;
      const nextCount = expired ? 1 : state.tentativasLoginInvalidas + 1;
      const update = validPassword
        ? { tentativasLoginInvalidas: 0, bloqueadoAte: null }
        : nextCount >= 5
          ? {
              tentativasLoginInvalidas: 5,
              bloqueadoAte: new Date(now.getTime() + LOGIN_BLOCK_MILLISECONDS),
            }
          : expired
            ? { tentativasLoginInvalidas: 1, bloqueadoAte: null }
            : { tentativasLoginInvalidas: { increment: 1 }, bloqueadoAte: null };

      // O estado observado participa do WHERE para serializar falhas e resets concorrentes.
      const result = await this.prisma.usuario.updateMany({
        where: {
          id: state.id,
          perfil: PerfilUsuario.CLIENTE,
          tentativasLoginInvalidas: state.tentativasLoginInvalidas,
          bloqueadoAte: state.bloqueadoAte,
        },
        data: update,
      });
      if (result.count === 1) return true;

      state = await this.prisma.usuario.findUnique({
        where: { id: state.id },
        select: {
          id: true,
          perfil: true,
          tentativasLoginInvalidas: true,
          bloqueadoAte: true,
        },
      });
    }

    throw new ServiceUnavailableException('Não foi possível concluir o login.');
  }

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
