import { stdin, stdout, stderr } from 'node:process';
import { StringDecoder } from 'node:string_decoder';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';

function parseArguments(args: string[]) {
  const values: Record<string, string> = {};
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index];
    if (!['--nome', '--email', '--telefone'].includes(key) ||
        !args[index + 1] || key in values) {
      throw new Error('Use --nome, --email e --telefone; forneça a senha pelo stdin.');
    }
    values[key] = args[index + 1];
  }
  if (Object.keys(values).length !== 3) {
    throw new Error('Use --nome, --email e --telefone; forneça a senha pelo stdin.');
  }
  return { nome: values['--nome'], email: values['--email'], telefone: values['--telefone'] };
}

async function readPassword(): Promise<string> {
  if (!stdin.isTTY) {
    const chunks: Buffer[] = [];
    let length = 0;
    for await (const chunk of stdin) {
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      length += bytes.length;
      if (length > 4096) throw new Error('Entrada de senha inválida.');
      chunks.push(bytes);
    }
    return Buffer.concat(chunks).toString('utf8').replace(/\r?\n$/, '');
  }

  if (!stdin.setRawMode) throw new Error('Terminal sem entrada segura.');
  stdout.write('Senha: ');
  stdin.setRawMode(true);
  stdin.resume();
  return new Promise((resolve, reject) => {
    let password = '';
    const decoder = new StringDecoder('utf8');
    const cleanup = () => {
      stdin.off('data', onData);
      stdin.setRawMode(false);
      stdin.pause();
      stdout.write('\n');
    };
    const onData = (chunk: Buffer) => {
      for (const character of decoder.write(chunk)) {
        if (character === '\n' || character === '\r') {
          cleanup();
          resolve(password);
          return;
        }
        if (character === '\u0003' || character === '\u0004') {
          cleanup();
          reject(new Error('Operação cancelada.'));
          return;
        }
        if (character === '\u007f' || character === '\b') {
          password = Array.from(password).slice(0, -1).join('');
        } else if (character >= ' ' && character !== '\u007f') {
          password += character;
          if (Buffer.byteLength(password) > 4096) {
            cleanup();
            reject(new Error('Entrada de senha inválida.'));
            return;
          }
        }
      }
    };
    stdin.on('data', onData);
  });
}

async function main() {
  const input = parseArguments(process.argv.slice(2));
  const senha = await readPassword();
  const prisma = new PrismaService();
  try {
    const result = await new UsersService(prisma).provisionFirstAdmin({ ...input, senha });
    stdout.write(result === 'created' ? 'Primeiro ADMIN criado.\n' : 'ADMIN já existe; nenhuma alteração realizada.\n');
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch(() => {
    stderr.write('Provisionamento não concluído. Verifique os dados e a conexão com o banco.\n');
    process.exitCode = 1;
  });
}
