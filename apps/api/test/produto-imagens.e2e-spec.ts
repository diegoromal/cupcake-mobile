import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import sharp from 'sharp';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PerfilUsuario } from '../src/generated/prisma/enums';
import { PrismaService } from '../src/prisma/prisma.service';
import { S3StorageService } from '../src/storage/s3-storage.service';

const id = '11111111-1111-4111-8111-111111111111';
const adminId = '99999999-9999-4999-8999-999999999999';
const path = `/admin/produtos/${id}/imagem`;

describe('Imagem de Produto HTTP', () => {
  let app: INestApplication;
  let png: Buffer;
  const findUser = jest.fn();
  const findUnique = jest.fn();
  const updateMany = jest.fn();
  const put = jest.fn();
  const del = jest.fn();
  const jwt = new JwtService();
  const token = (perfil: PerfilUsuario = PerfilUsuario.ADMIN) => jwt.signAsync({ sub: adminId, perfil, type: 'access' }, {
    secret: process.env.JWT_ACCESS_SECRET, algorithm: 'HS256', expiresIn: '15m',
  });
  beforeAll(async () => {
    png = await sharp({ create: { width: 20, height: 10, channels: 3, background: '#f00' } }).png().toBuffer();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService).useValue({
        usuario: { findUnique: findUser }, produto: { findUnique, updateMany },
      }).overrideProvider(S3StorageService).useValue({ put, delete: del }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });
  afterAll(async () => app.close());
  beforeEach(() => {
    jest.clearAllMocks();
    findUser.mockResolvedValue({ id: adminId, perfil: PerfilUsuario.ADMIN });
    findUnique.mockResolvedValue({ imagem: null });
    updateMany.mockResolvedValue({ count: 1 });
    put.mockResolvedValue(undefined);
    del.mockResolvedValue(undefined);
  });
  it('ADMIN envia multipart, recebe key e atualiza referência', async () => {
    const result = await request(app.getHttpServer()).post(path)
      .set('Authorization', `Bearer ${await token()}`).attach('imagem', png, { filename: 'arbitrario.png', contentType: 'image/png' })
      .expect(200);
    expect(result.body).toEqual({ id, imagem: expect.stringMatching(new RegExp(`^produtos/${id}/[0-9a-f-]+\\.webp$`)) });
    expect(updateMany).toHaveBeenCalledWith({ where: { id, imagem: null }, data: { imagem: result.body.imagem } });
    expect(put).toHaveBeenCalledWith(result.body.imagem, expect.any(Buffer));
  });
  it('protege upload e remoção com 401 e 403 para CLIENTE e ENTREGADOR', async () => {
    await request(app.getHttpServer()).post(path).attach('imagem', png, 'x.png').expect(401);
    await request(app.getHttpServer()).delete(path).expect(401);
    for (const perfil of [PerfilUsuario.CLIENTE, PerfilUsuario.ENTREGADOR]) {
      findUser.mockResolvedValue({ id: adminId, perfil });
      await request(app.getHttpServer()).post(path).set('Authorization', `Bearer ${await token(perfil)}`)
        .attach('imagem', png, 'x.png').expect(403);
      await request(app.getHttpServer()).delete(path).set('Authorization', `Bearer ${await token(perfil)}`).expect(403);
    }
  });
  it('UUID inválido e produto ausente', async () => {
    const auth = `Bearer ${await token()}`;
    await request(app.getHttpServer()).post('/admin/produtos/invalid/imagem').set('Authorization', auth)
      .attach('imagem', png, 'x.png').expect(400);
    await request(app.getHttpServer()).delete('/admin/produtos/invalid/imagem').set('Authorization', auth).expect(400);
    findUnique.mockResolvedValue(null);
    await request(app.getHttpServer()).post(path).set('Authorization', auth).attach('imagem', png, 'x.png').expect(404);
    await request(app.getHttpServer()).delete(path).set('Authorization', auth).expect(404);
  });
  it('rejeita ausência, campo incorreto, múltiplos arquivos, conteúdo inválido e MIME spoof', async () => {
    const auth = `Bearer ${await token()}`;
    await request(app.getHttpServer()).post(path).set('Authorization', auth).expect(400);
    await request(app.getHttpServer()).post(path).set('Authorization', auth).attach('foto', png, 'x.png').expect(400);
    await request(app.getHttpServer()).post(path).set('Authorization', auth)
      .attach('imagem', png, 'x.png').attach('imagem', png, 'y.png').expect(400);
    await request(app.getHttpServer()).post(path).set('Authorization', auth)
      .attach('imagem', Buffer.from('random'), { filename: 'x.png', contentType: 'image/png' }).expect(400);
    await request(app.getHttpServer()).post(path).set('Authorization', auth)
      .attach('imagem', png, { filename: 'x.jpg', contentType: 'image/jpeg' }).expect(400);
    await request(app.getHttpServer()).post(path).set('Authorization', auth)
      .field('outro', 'valor').attach('imagem', png, 'x.png').expect(400);
    expect(put).not.toHaveBeenCalled();
  });
  it('limite multipart de 10 MiB retorna 413', async () => {
    await request(app.getHttpServer()).post(path).set('Authorization', `Bearer ${await token()}`)
      .attach('imagem', Buffer.alloc(10 * 1024 * 1024 + 1), { filename: 'x.png', contentType: 'image/png' }).expect(413);
  });
  it('DELETE limpa a referência, retorna 204 e é idempotente', async () => {
    const key = `produtos/${id}/22222222-2222-4222-8222-222222222222.webp`;
    findUnique.mockResolvedValueOnce({ imagem: key }).mockResolvedValueOnce({ imagem: null });
    const auth = `Bearer ${await token()}`;
    await request(app.getHttpServer()).delete(path).set('Authorization', auth).expect(204, '');
    expect(updateMany).toHaveBeenCalledWith({ where: { id, imagem: key }, data: { imagem: null } });
    expect(del).toHaveBeenCalledWith(key);
    await request(app.getHttpServer()).delete(path).set('Authorization', auth).expect(204, '');
    expect(del).toHaveBeenCalledTimes(1);
  });
});
