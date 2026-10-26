import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { EvolutionApiService } from './evolution-api.service';
import { NotificacoesService } from './notificacoes.service';

@Module({
  imports: [PrismaModule],
  providers: [EvolutionApiService, NotificacoesService],
  exports: [EvolutionApiService, NotificacoesService],
})
export class NotificacoesModule {}
