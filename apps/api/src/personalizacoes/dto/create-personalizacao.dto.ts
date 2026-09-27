import { Transform } from 'class-transformer';
import { IsBoolean, IsNotEmpty, IsString, Matches, ValidateIf } from 'class-validator';

export const decimalPattern = /^[-+]?0*\d{1,10}(?:\.\d{1,2})?$/;

export class CreatePersonalizacaoDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value)
  @IsString()
  @IsNotEmpty()
  nome!: string;

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
