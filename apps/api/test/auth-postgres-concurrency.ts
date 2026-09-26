import { strict as assert } from 'node:assert';
import { randomUUID } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { PerfilUsuario } from '../src/generated/prisma/enums';
import { PrismaService } from '../src/prisma/prisma.service';
import { UsersService } from '../src/users/users.service';

async function main() {
  const url = process.env.D13_TEST_DATABASE_URL;
  if (!url) throw new Error('D13_TEST_DATABASE_URL é obrigatória.');
  const parsed = new URL(url);
  if (!['localhost', '127.0.0.1', '::1'].includes(parsed.hostname) ||
      parsed.pathname !== '/cupcake_d13') {
    throw new Error('O teste D13 só pode usar o banco local cupcake_d13.');
  }

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  const users = new UsersService(prisma as unknown as PrismaService);
  const id = randomUUID();
  const email = `d13-${id}@example.invalid`;
  try {
    await prisma.usuario.create({
      data: {
        id, nome: 'Teste D13', email, telefone: '00000000000',
        credencialSenha: 'hash-de-teste', perfil: PerfilUsuario.CLIENTE,
      },
    });

    const initial = await users.findAuthenticationUserByEmail(email);
    assert(initial);
    await Promise.all(Array.from({ length: 5 }, () => users.registerInvalidLogin(initial)));
    const blocked = await prisma.usuario.findUniqueOrThrow({ where: { id } });
    assert.equal(blocked.tentativasLoginInvalidas, 5);
    assert(blocked.bloqueadoAte && blocked.bloqueadoAte > new Date());

    await prisma.usuario.update({
      where: { id },
      data: { tentativasLoginInvalidas: 4, bloqueadoAte: null },
    });
    const nearLimit = await users.findAuthenticationUserByEmail(email);
    assert(nearLimit);
    const resetSucceeded = await Promise.all([
      users.registerInvalidLogin(nearLimit),
      users.clearLoginState(nearLimit),
    ]).then((results) => results[1]);
    const final = await prisma.usuario.findUniqueOrThrow({ where: { id } });
    if (resetSucceeded) {
      assert.equal(final.tentativasLoginInvalidas, 1);
      assert.equal(final.bloqueadoAte, null);
    } else {
      assert.equal(final.tentativasLoginInvalidas, 5);
      assert(final.bloqueadoAte && final.bloqueadoAte > new Date());
    }
    process.stdout.write('PASS: cinco falhas concorrentes e reset concorrente coerentes\n');
  } finally {
    await prisma.usuario.deleteMany({ where: { id } });
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${String(error)}\n`);
  process.exitCode = 1;
});
