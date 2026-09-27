import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PersonalizacoesController } from './personalizacoes.controller';
import { PersonalizacoesService } from './personalizacoes.service';

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [PersonalizacoesController],
  providers: [PersonalizacoesService],
})
export class PersonalizacoesModule {}
