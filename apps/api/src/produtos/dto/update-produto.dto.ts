import { Transform } from 'class-transformer';
import { IsBoolean, IsNotEmpty, IsString, IsUUID, Matches, ValidateIf } from 'class-validator';
import { PRECO_PATTERN } from './create-produto.dto';

const trim = ({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value;

export class UpdateProdutoDto {
  @ValidateIf((_, value: unknown) => value !== undefined)
  @IsUUID()
  categoriaId?: string;

  @Transform(trim)
  @ValidateIf((_, value: unknown) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  nome?: string;

  @Transform(trim)
  @ValidateIf((_, value: unknown) => value !== undefined && value !== null)
  @IsString()
  descricao?: string | null;

  @ValidateIf((_, value: unknown) => value !== undefined)
  @IsString()
  @Matches(PRECO_PATTERN)
  precoAtual?: string;

  @ValidateIf((_, value: unknown) => value !== undefined)
  @IsBoolean()
  ativo?: boolean;
}
