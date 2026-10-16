import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { S3StorageService } from '../storage/s3-storage.service';
import { CatalogoController } from './catalogo.controller';
import { CatalogoService } from './catalogo.service';

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [CatalogoController],
  providers: [CatalogoService, S3StorageService],
})
export class CatalogoModule {}
