import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PerfilUsuario } from '../../generated/prisma/enums';
import { UsersService } from '../../users/users.service';
import { AuthConfig, JWT_ALGORITHM } from '../auth.config';
import { AuthenticatedRequest } from '../authenticated-user';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BEARER_PATTERN = /^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/;

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: AuthConfig,
    private readonly users: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.headers.authorization;
    const authorizationHeaders = request.rawHeaders?.filter(
      (header, index) =>
        index % 2 === 0 && header.toLowerCase() === 'authorization',
    );
    if (authorizationHeaders && authorizationHeaders.length > 1) {
      throw new UnauthorizedException('Access token inválido.');
    }

    const token =
      typeof authorization === 'string'
        ? BEARER_PATTERN.exec(authorization)?.[1]
        : undefined;
    if (!token) {
      throw new UnauthorizedException('Access token inválido.');
    }

    let claims: Record<string, unknown>;
    try {
      claims = await this.jwt.verifyAsync<Record<string, unknown>>(token, {
        secret: this.config.accessSecret,
        algorithms: [JWT_ALGORITHM],
      });
    } catch {
      throw new UnauthorizedException('Access token inválido.');
    }

    if (
      typeof claims !== 'object' ||
      claims === null ||
      claims.type !== 'access' ||
      typeof claims.sub !== 'string' ||
      !UUID_PATTERN.test(claims.sub) ||
      typeof claims.perfil !== 'string' ||
      !Object.values(PerfilUsuario).includes(claims.perfil as PerfilUsuario) ||
      typeof claims.exp !== 'number' ||
      !Number.isInteger(claims.exp) ||
      claims.exp <= Math.floor(Date.now() / 1000)
    ) {
      throw new UnauthorizedException('Access token inválido.');
    }

    const user = await this.users.findById(claims.sub);
    if (!user || user.perfil !== claims.perfil) {
      throw new UnauthorizedException('Access token inválido.');
    }

    request.user = { id: user.id, perfil: user.perfil };
    return true;
  }
}
