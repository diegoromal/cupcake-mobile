import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Prisma } from '../src/generated/prisma/client';
import { PerfilUsuario } from '../src/generated/prisma/enums';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import request from 'supertest';

describe('Cadastro de cliente', () => {
  let app: INestApplication;
  const create = jest.fn();
  const body = {
    nome: '  Ana Silva  ',
    email: '  ANA@EXAMPLE.COM  ',
    telefone: '  11999999999  ',
    senha: ' senha123 ',
  };
  const id = '9b72c770-bc74-4c77-82c7-205c2d91628a';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({ usuario: { create } })
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
    await app.listen(0);
  });

  beforeEach(() => {
    create.mockReset();
    create.mockImplementation(async ({ data }) => ({
      id,
      nome: data.nome,
      email: data.email,
      telefone: data.telefone,
      perfil: data.perfil,
    }));
  });

  afterAll(async () => {
    await app.close();
  });

  it('retorna 201 com dados públicos do CLIENTE', async () => {
    const response = await request(app.getHttpServer())
      .post('/users')
      .send(body)
      .expect(201);

    expect(response.body).toEqual({
      id,
      nome: 'Ana Silva',
      email: 'ana@example.com',
      telefone: '11999999999',
      perfil: PerfilUsuario.CLIENTE,
    });
    expect(response.body).not.toHaveProperty('senha');
    expect(response.body).not.toHaveProperty('credencialSenha');
    expect(create.mock.calls[0][0].data.perfil).toBe(PerfilUsuario.CLIENTE);
    expect(create.mock.calls[0][0].data.credencialSenha).toMatch(/^\$argon2id\$/);
  });

  it.each([
    ['email inválido', { ...body, email: 'invalido' }],
    ['nome vazio após trim', { ...body, nome: '   ' }],
    ['telefone vazio após trim', { ...body, telefone: '   ' }],
    ['nome ausente', { email: body.email, telefone: body.telefone, senha: body.senha }],
    ['telefone ausente', { nome: body.nome, email: body.email, senha: body.senha }],
    ['senha ausente', { nome: body.nome, email: body.email, telefone: body.telefone }],
    ['senha curta', { ...body, senha: '1234567' }],
    ['campo extra', { ...body, outro: 'valor' }],
    ['perfil enviado', { ...body, perfil: PerfilUsuario.ADMIN }],
  ])('retorna 400 para %s', async (_cenario, entrada) => {
    await request(app.getHttpServer()).post('/users').send(entrada).expect(400);
    expect(create).not.toHaveBeenCalled();
  });

  it('retorna 409 para email duplicado sem expor detalhes do banco', async () => {
    create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('unique', {
        code: 'P2002',
        clientVersion: '7.10.0',
        meta: {
          driverAdapterError: {
            name: 'DriverAdapterError',
            cause: {
              kind: 'UniqueConstraintViolation',
              constraint: { index: 'Usuario_email_key' },
              table: 'Usuario',
            },
          },
        },
      }),
    );

    const response = await request(app.getHttpServer())
      .post('/users')
      .send(body)
      .expect(409);

    expect(response.body.message).toBe('E-mail já cadastrado.');
    expect(JSON.stringify(response.body)).not.toContain('P2002');
    expect(JSON.stringify(response.body)).not.toContain('Usuario_email_key');
  });
});
