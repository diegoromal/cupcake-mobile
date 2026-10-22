import { IsEnum, IsUUID, ValidateIf } from 'class-validator';
import { ModalidadeRecebimento } from '../../generated/prisma/enums';

export class CriarPedidoDto {
  @IsEnum(ModalidadeRecebimento)
  modalidade!: ModalidadeRecebimento;

  @ValidateIf((body: CriarPedidoDto) => body.modalidade === ModalidadeRecebimento.ENTREGA || body.enderecoId !== undefined)
  @IsUUID()
  enderecoId?: string;
}
