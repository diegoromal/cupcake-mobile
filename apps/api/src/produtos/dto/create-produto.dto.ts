import { Transform } from 'class-transformer';
import { IsBoolean, IsDefined, IsNotEmpty, IsString, IsUUID, Matches, ValidateIf } from 'class-validator';

const trim = ({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value;
export const PRECO_PATTERN = /^\d{1,10}(?:\.\d{1,2})?$/;

export class CreateProdutoDto {
  @IsDefined()
  @IsUUID()
  categoriaId!: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  nome!: string;

  @Transform(trim)
  @ValidateIf((_, value: unknown) => value !== undefined && value !== null)
  @IsString()
  descricao?: string | null;

  @IsDefined()
  @IsString()
  @Matches(PRECO_PATTERN)
  precoAtual!: string;

  @ValidateIf((_, value: unknown) => value !== undefined)
  @IsBoolean()
  ativo?: boolean;
}
