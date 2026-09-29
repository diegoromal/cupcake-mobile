import { IsInt, Max, Min } from 'class-validator';

export class AjustarEstoqueDto {
  @IsInt()
  @Min(0)
  @Max(2147483647)
  quantidadeDisponivel!: number;
}
