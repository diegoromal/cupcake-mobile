import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ConfiguracaoLojaEntregaController } from './configuracao-loja-entrega.controller';
import { ConfiguracaoLojaEntregaService } from './configuracao-loja-entrega.service';

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [ConfiguracaoLojaEntregaController],
  providers: [ConfiguracaoLojaEntregaService],
})
export class ConfiguracaoLojaEntregaModule {}
