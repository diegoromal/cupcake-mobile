import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { CepService } from './cep.service';
import { CoberturaFreteService } from './cobertura-frete.service';
import { EnderecosController } from './enderecos.controller';
import { EnderecosService } from './enderecos.service';
import { GeocodificacaoService } from './geocodificacao.service';

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [EnderecosController],
  providers: [EnderecosService, CepService, GeocodificacaoService, CoberturaFreteService],
})
export class EnderecosModule {}
