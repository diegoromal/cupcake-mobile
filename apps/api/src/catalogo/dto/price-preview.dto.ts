import { IsArray, IsUUID } from 'class-validator';

export class PricePreviewDto {
  @IsArray()
  @IsUUID('all', { each: true })
  personalizacaoIds!: string[];
}
