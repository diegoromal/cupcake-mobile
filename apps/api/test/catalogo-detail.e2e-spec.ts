import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { Prisma } from '../src/generated/prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PerfilUsuario } from '../src/generated/prisma/enums';
import { PrismaService } from '../src/prisma/prisma.service';
import { S3StorageService } from '../src/storage/s3-storage.service';

const id = '11111111-1111-4111-8111-111111111111';
const categoryId = '22222222-2222-4222-8222-222222222222';

describe('Catálogo detalhe HTTP', () => {
  let app: INestApplication;
  const query = jest.fn();
  const user = jest.fn();
  const jwt = new JwtService();
  const token = (perfil: PerfilUsuario) => jwt.signAsync({ sub: id, perfil, type: 'access' }, {
    secret: process.env.JWT_ACCESS_SECRET, algorithm: 'HS256', expiresIn: '15m',
  });
  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService).useValue({
        $queryRaw: query, usuario: { findUnique: user },
      }).overrideProvider(S3StorageService).useValue({ get: jest.fn() }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });
  afterAll(async () => app.close());
  beforeEach(() => {
    jest.clearAllMocks();
    user.mockResolvedValue({ id, perfil: PerfilUsuario.CLIENTE });
    query.mockResolvedValue([{ id, nome: 'Cupcake', descricao: 'Chocolate',
      precoAtual: new Prisma.Decimal('12.30'), categoriaId: categoryId, categoriaNome: 'Doces',
      imagem: null, quantidadeFisica: 20, ativo: true }]);
  });

  it('entrega somente projeção pública ao CLIENTE', async () => {
    const response = await request(app.getHttpServer()).get(`/catalogo/produtos/${id}`)
      .set('Authorization', `Bearer ${await token(PerfilUsuario.CLIENTE)}`).expect(200);
    expect(response.body).toEqual({ id, nome: 'Cupcake', descricao: 'Chocolate',
      precoAtual: '12.30', categoria: { id: categoryId, nome: 'Doces' },
      imagemDisponivel: false, disponivel: true });
  });

  it('valida UUID e protege por autenticação e perfil', async () => {
    await request(app.getHttpServer()).get(`/catalogo/produtos/${id}`).expect(401);
    await request(app.getHttpServer()).get('/catalogo/produtos/invalid')
      .set('Authorization', `Bearer ${await token(PerfilUsuario.CLIENTE)}`).expect(400);
    user.mockResolvedValue({ id, perfil: PerfilUsuario.ADMIN });
    await request(app.getHttpServer()).get(`/catalogo/produtos/${id}`)
      .set('Authorization', `Bearer ${await token(PerfilUsuario.ADMIN)}`).expect(403);
  });

  it('usa 404 neutro para item inexistente ou inelegível', async () => {
    query.mockResolvedValue([]);
    const response = await request(app.getHttpServer()).get(`/catalogo/produtos/${id}`)
      .set('Authorization', `Bearer ${await token(PerfilUsuario.CLIENTE)}`).expect(404);
    expect(response.body.message).toBe('Produto indisponível.');
    expect(response.text).not.toContain('Cupcake');
  });
});
