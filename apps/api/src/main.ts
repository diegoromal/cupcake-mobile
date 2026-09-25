import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

const DEFAULT_PORT = 3000;

export function resolvePort(value = process.env.PORT): number {
  if (value === undefined || value === '') {
    return DEFAULT_PORT;
  }

  const port = Number(value);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT deve ser um número inteiro entre 1 e 65535.');
  }

  return port;
}

export async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  await app.listen(resolvePort());
}

if (require.main === module) {
  void bootstrap();
}
