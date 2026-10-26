import { Module } from '@nestjs/common';
import { EvolutionApiService } from './evolution-api.service';

@Module({
  providers: [EvolutionApiService],
  exports: [EvolutionApiService],
})
export class NotificacoesModule {}
