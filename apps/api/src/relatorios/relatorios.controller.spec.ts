import { ValidationPipe } from '@nestjs/common';
import { RelatorioVendasQueryDto } from './dto/relatorio-vendas-query.dto';

const pipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
  validationError: { target: false, value: false },
});
const metadata = { type: 'query' as const, metatype: RelatorioVendasQueryDto, data: '' };

describe('RelatorioVendasQueryDto', () => {
  it('aceita datas de calendário ISO', async () => {
    await expect(pipe.transform({ inicio: '2026-10-01', fim: '2026-10-31' }, metadata)).resolves.toBeInstanceOf(RelatorioVendasQueryDto);
  });

  it.each([
    { inicio: '2026-02-30', fim: '2026-03-01' },
    { inicio: '01-10-2026', fim: '2026-10-31' },
    { inicio: '2026-10-01T00:00:00Z', fim: '2026-10-31' },
    { inicio: '2026-10-01', fim: '2026-10-31', exportar: 'pdf' },
  ])('rejeita query inválida: %o', async (query) => {
    await expect(pipe.transform(query, metadata)).rejects.toHaveProperty('status', 400);
  });
});
