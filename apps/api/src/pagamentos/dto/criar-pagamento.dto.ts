import { IsUUID } from 'class-validator';

export class CriarPagamentoDto {
  @IsUUID()
  tentativaId!: string;
}
