import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { PerfilUsuario } from '../generated/prisma/enums';
import { UsersService } from '../users/users.service';
import {
  ACCESS_TOKEN_TTL,
  AuthConfig,
  JWT_ALGORITHM,
  REFRESH_TOKEN_TTL,
} from './auth.config';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly config: AuthConfig,
  ) {}

  async login(input: LoginDto) {
    const user = await this.users.findAuthenticationUserByEmail(
      input.email.trim().toLowerCase(),
    );
    if (
      !user ||
      user.perfil !== PerfilUsuario.CLIENTE ||
      !(await argon2.verify(user.credencialSenha, input.senha))
    ) {
      throw new UnauthorizedException('Credenciais inválidas.');
    }

    const [accessToken, refreshToken] = await Promise.all([
      this.signToken(user.id, 'access'),
      this.signToken(user.id, 'refresh'),
    ]);
    return { accessToken, refreshToken };
  }

  async refresh(refreshToken: string) {
    let claims: Record<string, unknown>;
    try {
      claims = await this.jwt.verifyAsync<Record<string, unknown>>(refreshToken, {
        secret: this.config.refreshSecret,
        algorithms: [JWT_ALGORITHM],
      });
    } catch {
      throw new UnauthorizedException('Refresh token inválido.');
    }

    if (
      claims.type !== 'refresh' ||
      claims.perfil !== PerfilUsuario.CLIENTE ||
      typeof claims.iat !== 'number' ||
      typeof claims.exp !== 'number' ||
      typeof claims.sub !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        claims.sub,
      )
    ) {
      throw new UnauthorizedException('Refresh token inválido.');
    }

    const user = await this.users.findById(claims.sub);
    if (!user || user.perfil !== PerfilUsuario.CLIENTE) {
      throw new UnauthorizedException('Refresh token inválido.');
    }

    return { accessToken: await this.signToken(user.id, 'access') };
  }

  private signToken(id: string, type: 'access' | 'refresh') {
    return this.jwt.signAsync(
      { sub: id, perfil: PerfilUsuario.CLIENTE, type },
      {
        secret:
          type === 'access'
            ? this.config.accessSecret
            : this.config.refreshSecret,
        algorithm: JWT_ALGORITHM,
        expiresIn: type === 'access' ? ACCESS_TOKEN_TTL : REFRESH_TOKEN_TTL,
      },
    );
  }
}
