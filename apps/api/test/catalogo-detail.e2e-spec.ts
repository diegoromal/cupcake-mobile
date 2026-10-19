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
    query.mockImplementation((sql: Prisma.Sql) => sql.strings.join('').includes('ProdutoPersonalizacao')
      ? Promise.resolve([]) : Promise.resolve([{ id, nome: 'Cupcake', descricao: 'Chocolate',
      precoAtual: new Prisma.Decimal('12.30'), categoriaId: categoryId, categoriaNome: 'Doces',
      imagem: null, quantidadeFisica: 20, ativo: true }]));
  });

  it('entrega somente projeção pública ao CLIENTE', async () => {
    const response = await request(app.getHttpServer()).get(`/catalogo/produtos/${id}`)
      .set('Authorization', `Bearer ${await token(PerfilUsuario.CLIENTE)}`).expect(200);
    expect(response.body).toEqual({ id, nome: 'Cupcake', descricao: 'Chocolate',
      precoAtual: '12.30', categoria: { id: categoryId, nome: 'Doces' },
      imagemDisponivel: false, disponivel: true, personalizacoes: [] });
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

  it('valida prévia, autenticação, perfil e seleção sem aceitar preço do cliente', async () => {
    const url = `/catalogo/produtos/${id}/preco`;
    await request(app.getHttpServer()).post(url).send({ personalizacaoIds: [] }).expect(401);
    user.mockResolvedValue({ id, perfil: PerfilUsuario.ADMIN });
    await request(app.getHttpServer()).post(url)
      .set('Authorization', `Bearer ${await token(PerfilUsuario.ADMIN)}`)
      .send({ personalizacaoIds: [] }).expect(403);
    user.mockResolvedValue({ id, perfil: PerfilUsuario.CLIENTE });
    const bearer = `Bearer ${await token(PerfilUsuario.CLIENTE)}`;
    await request(app.getHttpServer()).post(url).set('Authorization', bearer)
      .send({ personalizacaoIds: ['invalid'] }).expect(400);
    await request(app.getHttpServer()).post(url).set('Authorization', bearer)
      .send({ personalizacaoIds: [], precoUnitario: '0.01' }).expect(400);
    const result = await request(app.getHttpServer()).post(url).set('Authorization', bearer)
      .send({ personalizacaoIds: [] }).expect(200);
    expect(result.body).toEqual({ precoUnitario: '12.30' });
    query.mockResolvedValueOnce([]);
    await request(app.getHttpServer()).post(url).set('Authorization', bearer)
      .send({ personalizacaoIds: [] }).expect(404);
  });
});
