import { ValidationPipe } from '@nestjs/common';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';
import { PerfilUsuario } from '../generated/prisma/enums';
import { CatalogoController } from './catalogo.controller';
import { CatalogoQueryDto } from './dto/catalogo-query.dto';

describe('CatalogoController contract', () => {
  it('restricts the client catalog controller to CLIENTE', () => {
    expect(Reflect.getMetadata(ROLES_KEY, CatalogoController)).toEqual([
      PerfilUsuario.CLIENTE,
    ]);
  });

  it('transforms documented pagination defaults and rejects invalid or extra query values', async () => {
    const pipe = new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      validationError: { target: false, value: false },
    });
    const metadata = { type: 'query', metatype: CatalogoQueryDto } as const;

    await expect(pipe.transform({}, metadata)).resolves.toMatchObject({
      page: 1,
      limit: 20,
    });
    await expect(
      pipe.transform({ page: '2', limit: '50' }, metadata),
    ).resolves.toMatchObject({ page: 2, limit: 50 });
    await expect(pipe.transform({ page: '0' }, metadata)).rejects.toThrow();
    await expect(pipe.transform({ limit: '51' }, metadata)).rejects.toThrow();
    await expect(
      pipe.transform({ page: '1', extra: 'true' }, metadata),
    ).rejects.toThrow();
    await expect(pipe.transform({ categoriaId: 'invalid' }, metadata)).rejects.toThrow();
    await expect(pipe.transform({ categoriaId: '11111111-1111-4111-8111-111111111111' }, metadata))
      .resolves.toMatchObject({ categoriaId: '11111111-1111-4111-8111-111111111111' });
  });
});
