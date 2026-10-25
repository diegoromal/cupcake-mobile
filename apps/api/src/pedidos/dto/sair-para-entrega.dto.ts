import { IsUUID } from 'class-validator';

export class SairParaEntregaDto {
  @IsUUID()
  entregadorUsuarioId!: string;
}
