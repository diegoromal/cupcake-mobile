import { Transform } from 'class-transformer';
import { IsBoolean, IsNotEmpty, IsString, Matches, ValidateIf } from 'class-validator';
import { decimalPattern } from './create-personalizacao.dto';

export class UpdatePersonalizacaoDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value)
  @ValidateIf((_, value: unknown) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  nome?: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value)
  @ValidateIf((_, value: unknown) => value !== undefined && value !== null)
  @IsString()
  descricao?: string | null;

  @ValidateIf((_, value: unknown) => value !== undefined)
  @IsBoolean()
  disponibilidade?: boolean;

  @ValidateIf((_, value: unknown) => value !== undefined && value !== null)
  @IsString()
  @Matches(decimalPattern)
  ajusteValor?: string | null;
}
