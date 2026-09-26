import { PerfilUsuario } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from './users.service';

describe('UsersService', () => {
  const findUnique = jest.fn();
  const prisma = { usuario: { findUnique } } as unknown as PrismaService;
  const service = new UsersService(prisma);
  const id = '9b72c770-bc74-4c77-82c7-205c2d91628a';

  beforeEach(() => {
    findUnique.mockReset();
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
});
