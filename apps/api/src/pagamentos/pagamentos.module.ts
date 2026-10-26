import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { NotificacoesModule } from '../notificacoes/notificacoes.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PagamentosController } from './pagamentos.controller';
import { PagamentosService } from './pagamentos.service';
import { PagamentoSimuladorService } from './pagamento-simulador.service';

@Module({
  imports: [AuthModule, PrismaModule, NotificacoesModule], controllers: [PagamentosController],
  providers: [PagamentosService, PagamentoSimuladorService],
})
export class PagamentosModule {}
