import { strict as assert } from 'node:assert';
import { randomUUID } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import * as argon2 from 'argon2';
import { PrismaClient } from '../src/generated/prisma/client';
import { PerfilUsuario } from '../src/generated/prisma/enums';
import { PrismaService } from '../src/prisma/prisma.service';
import { UsersService } from '../src/users/users.service';

async function main() {
  const url = process.env.D117_TEST_DATABASE_URL;
  if (!url) throw new Error('D117_TEST_DATABASE_URL é obrigatória.');
  const parsed = new URL(url);
  if (!['localhost', '127.0.0.1', '::1'].includes(parsed.hostname) ||
      parsed.pathname !== '/cupcake_d117') {
    throw new Error('O teste D117 só pode usar o banco local cupcake_d117.');
  }

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  const users = new UsersService(prisma as unknown as PrismaService);
  const id = randomUUID();
  const input = {
    nome: 'Teste D117', email: `d117-${id}@example.invalid`,
    telefone: '00000000000', senha: 'senha-teste-D117',
  };
  let createdId: string | undefined;
  try {
    const existing = await prisma.usuario.findFirst({ where: { perfil: PerfilUsuario.ADMIN } });
    if (existing) {
      const count = await prisma.usuario.count({ where: { perfil: PerfilUsuario.ADMIN } });
      assert.equal(await users.provisionFirstAdmin(input), 'already-exists');
      assert.equal(await prisma.usuario.count({ where: { perfil: PerfilUsuario.ADMIN } }), count);
      assert.equal(await prisma.usuario.findUnique({ where: { email: input.email } }), null);
      process.stdout.write('PASS ADMIN pré-existente preservado\n');
      return;
    }

    const results = await Promise.all([
      users.provisionFirstAdmin(input), users.provisionFirstAdmin(input),
    ]);
    assert.deepEqual(results.sort(), ['already-exists', 'created']);
    const admin = await prisma.usuario.findUniqueOrThrow({ where: { email: input.email } });
    createdId = admin.id;
    assert.equal(admin.perfil, PerfilUsuario.ADMIN);
    assert.equal(await prisma.usuario.count({ where: { perfil: PerfilUsuario.ADMIN } }), 1);
    assert(admin.credencialSenha.startsWith('$argon2id$'));
    assert(await argon2.verify(admin.credencialSenha, input.senha));
    assert.equal(await users.provisionFirstAdmin({ ...input, senha: 'outra-senha' }), 'already-exists');
    const unchanged = await prisma.usuario.findUniqueOrThrow({ where: { id: admin.id } });
    assert.equal(unchanged.credencialSenha, admin.credencialSenha);
    process.stdout.write('PASS criação concorrente, idempotência e Argon2id\n');
  } finally {
    if (createdId) await prisma.usuario.deleteMany({ where: { id: createdId } });
    await prisma.$disconnect();
  }
}

main().catch(() => {
  process.stderr.write('Falha no teste PostgreSQL D117.\n');
  process.exitCode = 1;
});
