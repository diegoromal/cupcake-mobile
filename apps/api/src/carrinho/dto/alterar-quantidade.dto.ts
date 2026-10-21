import { IsInt, Max, Min } from 'class-validator';

export class AlterarQuantidadeItemDto {
  @IsInt()
  @Min(1)
  @Max(2147483647)
  quantidade!: number;
}
