import { BadRequestException, ConflictException, NotFoundException, ValidationPipe } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { UpdateEnderecoDto } from './dto/update-endereco.dto';
import { EnderecosService } from './enderecos.service';

const endereco = {
  id: 'endereco', usuarioId: 'cliente', rua: 'Rua A', numero: '12', bairro: 'Centro',
  cidade: 'Curitiba', cep: '80000000', complemento: null, referencia: null,
  latitude: new Prisma.Decimal('-25.000000'), longitude: new Prisma.Decimal('-49.000000'),
  statusLocalizacao: 'LOCALIZADO',
};

describe('EnderecosService', () => {
  const findFirst = jest.fn();
  const updateMany = jest.fn();
  const deleteMany = jest.fn();
  const service = new EnderecosService({ endereco: { findFirst, updateMany, deleteMany } } as never);

  beforeEach(() => {
    findFirst.mockReset().mockResolvedValue(endereco);
    updateMany.mockReset().mockResolvedValue({ count: 1 });
    deleteMany.mockReset().mockResolvedValue({ count: 1 });
  });

  it('PATCH parcial estrito valida tipos e proíbe campo desconhecido', async () => {
    const pipe = new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true });
    const metadata = { type: 'body' as const, metatype: UpdateEnderecoDto };
    await expect(pipe.transform({ complemento: ' A ' }, metadata)).resolves.toMatchObject({ complemento: 'A' });
    await expect(pipe.transform({ rua: null }, metadata)).rejects.toBeInstanceOf(BadRequestException);
    await expect(pipe.transform({ latitude: '1' }, metadata)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('complemento e referência isolados preservam coordenadas e status', async () => {
    await service.atualizar('cliente', 'endereco', { complemento: 'A', referencia: null });
    expect(updateMany).toHaveBeenCalledWith({ where: { id: 'endereco', usuarioId: 'cliente' },
      data: { complemento: 'A', referencia: null } });
  });

  it('alterar campo de busca limpa coordenadas e volta a PENDENTE; CEP é normalizado', async () => {
    await service.atualizar('cliente', 'endereco', { bairro: 'Outro', cep: '81000-000' });
    expect(updateMany).toHaveBeenCalledWith({ where: { id: 'endereco', usuarioId: 'cliente' },
      data: { bairro: 'Outro', cep: '81000000', latitude: null, longitude: null,
        statusLocalizacao: 'PENDENTE' } });
  });

  it('reenviar a mesma busca não invalida localização', async () => {
    await service.atualizar('cliente', 'endereco', { rua: 'Rua A', cep: '80000-000' });
    expect(updateMany).toHaveBeenCalledWith({ where: { id: 'endereco', usuarioId: 'cliente' },
      data: { rua: 'Rua A', cep: '80000000' } });
  });

  it('PATCH vazio rejeita; endereço alheio/ausente dá 404 neutro', async () => {
    await expect(service.atualizar('cliente', 'endereco', {})).rejects.toBeInstanceOf(BadRequestException);
    findFirst.mockResolvedValueOnce(null);
    await expect(service.atualizar('outro', 'endereco', { rua: 'Outra' }))
      .rejects.toBeInstanceOf(NotFoundException);
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('DELETE remove somente endereço do dono sem acessar snapshot independente', async () => {
    await service.excluir('cliente', 'endereco');
    expect(deleteMany).toHaveBeenCalledWith({ where: { id: 'endereco', usuarioId: 'cliente' } });
    expect(findFirst).not.toHaveBeenCalled();
  });

  it('DELETE alheio/ausente dá 404 e FK impeditiva dá 409', async () => {
    deleteMany.mockResolvedValueOnce({ count: 0 });
    await expect(service.excluir('outro', 'endereco')).rejects.toBeInstanceOf(NotFoundException);
    deleteMany.mockRejectedValueOnce(new Prisma.PrismaClientKnownRequestError(
      'fk', { code: 'P2003', clientVersion: '7.10.0' },
    ));
    await expect(service.excluir('cliente', 'endereco')).rejects.toBeInstanceOf(ConflictException);
  });
});
