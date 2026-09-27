import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ProdutoPersonalizacoesController } from './produto-personalizacoes.controller';
import { ProdutoPersonalizacoesService } from './produto-personalizacoes.service';
import { ProdutosController } from './produtos.controller';
import { ProdutosService } from './produtos.service';

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [ProdutosController, ProdutoPersonalizacoesController],
  providers: [ProdutosService, ProdutoPersonalizacoesService],
})
export class ProdutosModule {}
