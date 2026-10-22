import { IsString, Matches } from 'class-validator';

export class SalvarConfiguracaoLojaEntregaDto {
  @IsString() @Matches(/^-?(?:\d|[1-8]\d|90)(?:\.\d{1,6})?$/)
  latitudeLoja!: string;

  @IsString() @Matches(/^-?(?:\d|[1-9]\d|1[0-7]\d|180)(?:\.\d{1,6})?$/)
  longitudeLoja!: string;

  @IsString() @Matches(/^\d{1,7}(?:\.\d{1,3})?$/)
  raioMaximoAtendimento!: string;

  @IsString() @Matches(/^\d{1,10}(?:\.\d{1,2})?$/)
  taxaBase!: string;

  @IsString() @Matches(/^\d{1,10}(?:\.\d{1,2})?$/)
  valorPorQuilometro!: string;
}
