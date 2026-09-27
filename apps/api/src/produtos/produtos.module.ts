import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ProdutoPersonalizacoesController } from './produto-personalizacoes.controller';
import { ProdutoPersonalizacoesService } from './produto-personalizacoes.service';
import { ProdutosController } from './produtos.controller';
import { ProdutosService } from './produtos.service';
import { ProdutoImagensService } from './produto-imagens.service';
import { S3StorageService } from '../storage/s3-storage.service';

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [ProdutosController, ProdutoPersonalizacoesController],
  providers: [ProdutosService, ProdutoPersonalizacoesService, ProdutoImagensService, S3StorageService],
})
export class ProdutosModule {}
