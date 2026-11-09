import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, Matches, MaxLength, ValidateIf } from 'class-validator';

const trim = ({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value;

export class UpdateEnderecoDto {
  @Transform(trim) @ValidateIf((_, value) => value !== undefined) @IsString() @IsNotEmpty() @MaxLength(200)
  rua?: string;

  @Transform(trim) @ValidateIf((_, value) => value !== undefined) @IsString() @IsNotEmpty() @MaxLength(30)
  numero?: string;

  @Transform(trim) @ValidateIf((_, value) => value !== undefined) @IsString() @IsNotEmpty() @MaxLength(120)
  bairro?: string;

  @Transform(trim) @ValidateIf((_, value) => value !== undefined) @IsString() @IsNotEmpty() @MaxLength(120)
  cidade?: string;

  @Transform(trim) @ValidateIf((_, value) => value !== undefined) @IsString() @Matches(/^\d{5}-?\d{3}$/)
  cep?: string;

  @Transform(trim) @IsOptional() @IsString() @MaxLength(200)
  complemento?: string | null;

  @Transform(trim) @IsOptional() @IsString() @MaxLength(200)
  referencia?: string | null;
}
