import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PerfilUsuario } from '../../generated/prisma/enums';
import { AuthenticatedUser } from '../authenticated-user';
import { Roles } from '../decorators/roles.decorator';
import { RolesGuard } from './roles.guard';

class TestController {
  open() {}

  @Roles(PerfilUsuario.CLIENTE)
  cliente() {}

  @Roles(PerfilUsuario.ADMIN)
  admin() {}

  @Roles(PerfilUsuario.ENTREGADOR)
  entregador() {}
}

describe('RolesGuard', () => {
  const guard = new RolesGuard(new Reflector());
  const id = '9b72c770-bc74-4c77-82c7-205c2d91628a';

  function context(method: keyof TestController, user?: AuthenticatedUser) {
    return {
      getHandler: () => TestController.prototype[method],
      getClass: () => TestController,
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
    } as unknown as ExecutionContext;
  }

  it('permite usuário autenticado quando não há metadata de roles', () => {
    expect(
      guard.canActivate(context('open', { id, perfil: PerfilUsuario.CLIENTE })),
    ).toBe(true);
  });

  it.each([
    ['cliente', PerfilUsuario.CLIENTE],
    ['admin', PerfilUsuario.ADMIN],
    ['entregador', PerfilUsuario.ENTREGADOR],
  ] as const)('permite %s com seu papel', (method, perfil) => {
    expect(guard.canActivate(context(method, { id, perfil }))).toBe(true);
  });

  it.each([
    ['cliente', PerfilUsuario.ADMIN],
    ['admin', PerfilUsuario.CLIENTE],
    ['entregador', PerfilUsuario.CLIENTE],
  ] as const)('nega %s para %s', (method, perfil) => {
    expect(() => guard.canActivate(context(method, { id, perfil }))).toThrow(
      ForbiddenException,
    );
  });

  it.each(['open', 'cliente', 'admin', 'entregador'] as const)(
    'retorna 401 sem usuário autenticado em %s',
    (method) => {
      expect(() => guard.canActivate(context(method))).toThrow(
        UnauthorizedException,
      );
    },
  );
});
