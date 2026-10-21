import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { CarrinhoController } from './carrinho.controller';
import { CarrinhoService } from './carrinho.service';

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [CarrinhoController],
  providers: [CarrinhoService],
})
export class CarrinhoModule {}
