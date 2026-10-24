import { IsUUID } from 'class-validator';

export class CriarPixDto {
  @IsUUID()
  tentativaId!: string;
}
