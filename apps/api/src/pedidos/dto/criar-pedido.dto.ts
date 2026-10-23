import { IsEnum, IsOptional, IsString, IsUUID, Matches, ValidateIf } from 'class-validator';
import { ModalidadeRecebimento } from '../../generated/prisma/enums';

export class CriarPedidoDto {
  @IsEnum(ModalidadeRecebimento)
  modalidade!: ModalidadeRecebimento;

  @ValidateIf((body: CriarPedidoDto) => body.modalidade === ModalidadeRecebimento.ENTREGA || body.enderecoId !== undefined)
  @IsUUID()
  enderecoId?: string;

  @IsOptional()
  @IsUUID()
  tentativaId?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[a-f0-9]{64}$/)
  revisaoId?: string;
}
