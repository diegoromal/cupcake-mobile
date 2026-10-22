import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { CepService } from './cep.service';
import { EnderecosController } from './enderecos.controller';
import { EnderecosService } from './enderecos.service';
import { GeocodificacaoService } from './geocodificacao.service';

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [EnderecosController],
  providers: [EnderecosService, CepService, GeocodificacaoService],
})
export class EnderecosModule {}
