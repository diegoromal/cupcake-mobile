import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PedidosController } from './pedidos.controller';
import { PedidosService } from './pedidos.service';
import { ExpiracaoPedidosService } from './expiracao-pedidos.service';
import { LiberacaoReservasService } from './liberacao-reservas.service';

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [PedidosController],
  providers: [PedidosService, ExpiracaoPedidosService, LiberacaoReservasService],
})
export class PedidosModule {}
