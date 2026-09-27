import { IsDefined, IsUUID } from 'class-validator';

export class VincularPersonalizacaoDto {
  @IsDefined()
  @IsUUID()
  personalizacaoId!: string;
}
