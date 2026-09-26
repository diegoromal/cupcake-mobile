import {
  Controller,
  Get,
  INestApplication,
  Module,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AuthModule } from '../src/auth/auth.module';
import { AuthenticatedRequest } from '../src/auth/authenticated-user';
import { Roles } from '../src/auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../src/auth/guards/roles.guard';
import { PerfilUsuario } from '../src/generated/prisma/enums';
import { PrismaService } from '../src/prisma/prisma.service';

@Controller('test-rbac')
@UseGuards(JwtAuthGuard, RolesGuard)
class TestRbacController {
  @Get('authenticated')
  authenticated(@Req() req: AuthenticatedRequest) {
    return req.user;
  }

  @Get('cliente')
  @Roles(PerfilUsuario.CLIENTE)
  cliente(@Req() req: AuthenticatedRequest) {
    return req.user;
  }

  @Get('admin')
  @Roles(PerfilUsuario.ADMIN)
  admin(@Req() req: AuthenticatedRequest) {
    return req.user;
  }

  @Get('entregador')
  @Roles(PerfilUsuario.ENTREGADOR)
  entregador(@Req() req: AuthenticatedRequest) {
    return req.user;
  }
}

@Module({ imports: [AuthModule], controllers: [TestRbacController] })
class TestRbacModule {}

describe('RBAC em controller exclusivo de teste', () => {
  let app: INestApplication;
  const jwt = new JwtService();
  const findUnique = jest.fn();
  const id = '9b72c770-bc74-4c77-82c7-205c2d91628a';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [TestRbacModule] })
      .overrideProvider(PrismaService)
      .useValue({ usuario: { findUnique } })
      .compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  beforeEach(() => {
    findUnique.mockReset();
    findUnique.mockResolvedValue({ id, perfil: PerfilUsuario.CLIENTE });
  });

  afterAll(async () => {
    await app.close();
  });

  function sign(
    perfil: PerfilUsuario,
    type: 'access' | 'refresh' = 'access',
    secret = process.env.JWT_ACCESS_SECRET,
  ) {
    return jwt.signAsync(
      { sub: id, perfil, type },
      { secret, algorithm: 'HS256', expiresIn: '15m' },
    );
  }

  it('retorna 401 sem token e com token inválido', async () => {
    await request(app.getHttpServer()).get('/test-rbac/authenticated').expect(401);
    await request(app.getHttpServer())
      .get('/test-rbac/authenticated')
      .set('Authorization', 'Bearer a.b.c')
      .expect(401);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('autentica access real e expõe somente id e perfil', async () => {
    const token = await sign(PerfilUsuario.CLIENTE);
    const response = await request(app.getHttpServer())
      .get('/test-rbac/authenticated')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(response.body).toEqual({ id, perfil: PerfilUsuario.CLIENTE });
    expect(findUnique).toHaveBeenCalledWith({
      where: { id },
      select: { id: true, perfil: true },
    });
  });

  it('rejeita refresh real usado como access', async () => {
    const token = await sign(
      PerfilUsuario.CLIENTE,
      'refresh',
      process.env.JWT_REFRESH_SECRET,
    );
    await request(app.getHttpServer())
      .get('/test-rbac/authenticated')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);
  });

  it.each([
    ['cliente', PerfilUsuario.CLIENTE],
    ['admin', PerfilUsuario.ADMIN],
    ['entregador', PerfilUsuario.ENTREGADOR],
  ] as const)('permite %s com access do papel correto', async (path, perfil) => {
    findUnique.mockResolvedValue({ id, perfil });
    const token = await sign(perfil);
    const response = await request(app.getHttpServer())
      .get(`/test-rbac/${path}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(response.body).toEqual({ id, perfil });
  });

  it.each(['cliente', 'admin', 'entregador'] as const)(
    'retorna 403 para perfil incorreto em %s',
    async (path) => {
      const perfil = path === 'cliente' ? PerfilUsuario.ADMIN : PerfilUsuario.CLIENTE;
      findUnique.mockResolvedValue({ id, perfil });
      const token = await sign(perfil);
      await request(app.getHttpServer())
        .get(`/test-rbac/${path}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    },
  );
});
