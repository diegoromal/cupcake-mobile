import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PagamentosController } from './pagamentos.controller';
import { PagamentosService } from './pagamentos.service';
import { PagamentoSimuladorService } from './pagamento-simulador.service';

@Module({
  imports: [AuthModule, PrismaModule], controllers: [PagamentosController],
  providers: [PagamentosService, PagamentoSimuladorService],
})
export class PagamentosModule {}
