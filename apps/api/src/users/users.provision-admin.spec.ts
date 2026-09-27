import * as argon2 from 'argon2';
import { PerfilUsuario } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from './users.service';

describe('provisionamento do primeiro ADMIN', () => {
  const queryRaw = jest.fn();
  const findFirst = jest.fn();
  const create = jest.fn();
  const transaction = jest.fn(async (callback) => callback({
    $queryRaw: queryRaw, usuario: { findFirst, create },
  }));
  const service = new UsersService({ $transaction: transaction } as unknown as PrismaService);
  const input = {
    nome: '  Administradora  ', email: '  ADMIN@EXAMPLE.COM  ',
    telefone: '  11999999999  ', senha: ' senha123 ',
  };

  beforeEach(() => {
    queryRaw.mockReset().mockResolvedValue([]);
    findFirst.mockReset().mockResolvedValue(null);
    create.mockReset().mockResolvedValue({ id: 'id' });
    transaction.mockClear();
  });

  it('cria somente ADMIN com hash Argon2id e retorno sem credencial', async () => {
    await expect(service.provisionFirstAdmin(input)).resolves.toBe('created');
    expect(queryRaw).toHaveBeenCalledTimes(1);
    expect(findFirst).toHaveBeenCalledWith({
      where: { perfil: PerfilUsuario.ADMIN }, select: { id: true },
    });
    const call = create.mock.calls[0][0];
    expect(call.select).toEqual({ id: true });
    expect(call.data).toMatchObject({
      nome: 'Administradora', email: 'admin@example.com',
      telefone: '11999999999', perfil: PerfilUsuario.ADMIN,
    });
    expect(call.data.credencialSenha).toMatch(/^\$argon2id\$/);
    expect(call.data.credencialSenha.split('$')[3].split(',')).toEqual(
      expect.arrayContaining(['m=19456', 't=2', 'p=1']),
    );
    await expect(argon2.verify(call.data.credencialSenha, input.senha)).resolves.toBe(true);
  });

  it('é idempotente quando já existe ADMIN, sem mudar senha', async () => {
    findFirst.mockResolvedValue({ id: 'existing' });
    await expect(service.provisionFirstAdmin(input)).resolves.toBe('already-exists');
    expect(create).not.toHaveBeenCalled();
  });

  it.each([
    { ...input, nome: '   ' },
    { ...input, email: 'inválido' },
    { ...input, telefone: '' },
    { ...input, senha: '1234567' },
  ])('rejeita entrada inválida antes da transação', async (invalid) => {
    await expect(service.provisionFirstAdmin(invalid)).rejects.toThrow('Dados do administrador inválidos.');
    expect(transaction).not.toHaveBeenCalled();
  });
});
