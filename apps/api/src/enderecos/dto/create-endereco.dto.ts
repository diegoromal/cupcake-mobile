import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value;

export const normalizarCep = (cep: string): string => cep.replace('-', '');
export const cepValido = (cep: string): boolean => /^\d{5}-?\d{3}$/.test(cep);

export class CreateEnderecoDto {
  @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(200)
  rua!: string;

  @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(30)
  numero!: string;

  @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(120)
  bairro!: string;

  @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(120)
  cidade!: string;

  @Transform(trim) @IsString() @Matches(/^\d{5}-?\d{3}$/)
  cep!: string;

  @Transform(trim) @IsOptional() @IsString() @MaxLength(200)
  complemento?: string | null;

  @Transform(trim) @IsOptional() @IsString() @MaxLength(200)
  referencia?: string | null;
}
