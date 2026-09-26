import { ConflictException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { Prisma } from '../generated/prisma/client';
import { PerfilUsuario } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from './users.service';

describe('UsersService', () => {
  const findUnique = jest.fn();
  const create = jest.fn();
  const prisma = { usuario: { findUnique, create } } as unknown as PrismaService;
  const service = new UsersService(prisma);
  const id = '9b72c770-bc74-4c77-82c7-205c2d91628a';

  beforeEach(() => {
    findUnique.mockReset();
    create.mockReset();
  });

  it.each([
    PerfilUsuario.CLIENTE,
    PerfilUsuario.ADMIN,
    PerfilUsuario.ENTREGADOR,
  ])('localiza usuário com perfil %s sem expor a credencial', async (perfil) => {
    findUnique.mockResolvedValue({ id, perfil });

    const usuario = await service.findById(id);

    expect(usuario).toEqual({ id, perfil });
    expect(usuario).not.toHaveProperty('credencialSenha');
    expect(findUnique).toHaveBeenCalledWith({
      where: { id },
      select: { id: true, perfil: true },
    });
  });

  it('retorna null quando o usuário não existe', async () => {
    findUnique.mockResolvedValue(null);

    await expect(service.findById(id)).resolves.toBeNull();
  });

  it('cria CLIENTE com dados normalizados e hash Argon2id, sem expor a credencial', async () => {
    const senha = ' senha123 ';
    const usuario = {
      id,
      nome: 'Ana Silva',
      email: 'ana@example.com',
      telefone: '11999999999',
      perfil: PerfilUsuario.CLIENTE,
    };
    create.mockResolvedValue(usuario);

    const resultado = await service.createClient({
      nome: '  Ana Silva  ',
      email: '  ANA@EXAMPLE.COM  ',
      telefone: '  11999999999  ',
      senha,
    });

    expect(resultado).toEqual(usuario);
    expect(resultado).not.toHaveProperty('credencialSenha');
    expect(create).toHaveBeenCalledTimes(1);
    const chamada = create.mock.calls[0][0];
    expect(chamada).toEqual({
      data: {
        nome: 'Ana Silva',
        email: 'ana@example.com',
        telefone: '11999999999',
        credencialSenha: expect.any(String),
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
    expect(chamada.data).not.toHaveProperty('senha');
    expect(chamada.data.credencialSenha).not.toBe(senha);
    expect(chamada.data.credencialSenha).toMatch(/^\$argon2id\$/);
    const parametros = chamada.data.credencialSenha.split('$')[3].split(',');
    expect(parametros).toEqual(
      expect.arrayContaining(['m=19456', 't=2', 'p=1']),
    );
    await expect(argon2.verify(chamada.data.credencialSenha, senha)).resolves.toBe(
      true,
    );
    await expect(
      argon2.verify(chamada.data.credencialSenha, senha.trim()),
    ).resolves.toBe(false);
  });

  it('converte conflito UNIQUE de email em ConflictException', async () => {
    create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('unique', {
        code: 'P2002',
        clientVersion: '7.10.0',
        meta: { target: ['email'] },
      }),
    );

    await expect(
      service.createClient({
        nome: 'Ana',
        email: 'ana@example.com',
        telefone: '11999999999',
        senha: 'senha123',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('converte conflito do índice de email do PostgreSQL adapter em ConflictException', async () => {
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

    await expect(
      service.createClient({
        nome: 'Ana',
        email: 'ana@example.com',
        telefone: '11999999999',
        senha: 'senha123',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('propaga falha inesperada de persistência', async () => {
    const falha = new Error('falha de persistência');
    create.mockRejectedValue(falha);

    await expect(
      service.createClient({
        nome: 'Ana',
        email: 'ana@example.com',
        telefone: '11999999999',
        senha: 'senha123',
      }),
    ).rejects.toBe(falha);
  });

  it('não converte conflito UNIQUE de outro campo em conflito de email', async () => {
    const falha = new Prisma.PrismaClientKnownRequestError('unique', {
      code: 'P2002',
      clientVersion: '7.10.0',
      meta: { target: ['id'] },
    });
    create.mockRejectedValue(falha);

    await expect(
      service.createClient({
        nome: 'Ana',
        email: 'ana@example.com',
        telefone: '11999999999',
        senha: 'senha123',
      }),
    ).rejects.toBe(falha);
  });

  it('não converte outro índice do PostgreSQL adapter em conflito de email', async () => {
    const falha = new Prisma.PrismaClientKnownRequestError('unique', {
      code: 'P2002',
      clientVersion: '7.10.0',
      meta: {
        driverAdapterError: {
          name: 'DriverAdapterError',
          cause: {
            kind: 'UniqueConstraintViolation',
            constraint: { index: 'Usuario_pkey' },
            table: 'Usuario',
          },
        },
      },
    });
    create.mockRejectedValue(falha);

    await expect(
      service.createClient({
        nome: 'Ana',
        email: 'ana@example.com',
        telefone: '11999999999',
        senha: 'senha123',
      }),
    ).rejects.toBe(falha);
  });

  it('não converte outro código Prisma mesmo com o índice de email', async () => {
    const falha = new Prisma.PrismaClientKnownRequestError('outro erro', {
      code: 'P2003',
      clientVersion: '7.10.0',
      meta: {
        driverAdapterError: {
          name: 'DriverAdapterError',
          cause: {
            kind: 'UniqueConstraintViolation',
            constraint: { index: 'Usuario_email_key' },
          },
        },
      },
    });
    create.mockRejectedValue(falha);

    await expect(
      service.createClient({
        nome: 'Ana',
        email: 'ana@example.com',
        telefone: '11999999999',
        senha: 'senha123',
      }),
    ).rejects.toBe(falha);
  });
});
