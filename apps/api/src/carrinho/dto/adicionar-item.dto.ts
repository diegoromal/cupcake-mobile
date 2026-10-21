import { IsArray, IsDefined, IsInt, IsUUID, Max, Min } from 'class-validator';

export class AdicionarItemCarrinhoDto {
  @IsDefined()
  @IsUUID()
  produtoId!: string;

  @IsInt()
  @Min(1)
  @Max(2147483647)
  quantidade!: number;

  @IsArray()
  @IsUUID('all', { each: true })
  personalizacaoIds!: string[];
}
