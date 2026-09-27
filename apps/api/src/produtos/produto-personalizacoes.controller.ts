import {
  Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post,
  UseGuards, UsePipes, ValidationPipe,
} from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PerfilUsuario } from '../generated/prisma/enums';
import { VincularPersonalizacaoDto } from './dto/vincular-personalizacao.dto';
import { ProdutoPersonalizacoesService } from './produto-personalizacoes.service';

@Controller('admin/produtos/:produtoId/personalizacoes')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(PerfilUsuario.ADMIN)
@UsePipes(new ValidationPipe({
  transform: true, whitelist: true, forbidNonWhitelisted: true,
  validationError: { target: false, value: false },
}))
export class ProdutoPersonalizacoesController {
  constructor(private readonly associacoes: ProdutoPersonalizacoesService) {}

  @Get()
  list(@Param('produtoId', new ParseUUIDPipe()) produtoId: string) {
    return this.associacoes.list(produtoId);
  }

  @Post()
  create(@Param('produtoId', new ParseUUIDPipe()) produtoId: string,
    @Body() input: VincularPersonalizacaoDto) {
    return this.associacoes.create(produtoId, input.personalizacaoId);
  }

  @Delete(':personalizacaoId')
  @HttpCode(204)
  remove(@Param('produtoId', new ParseUUIDPipe()) produtoId: string,
    @Param('personalizacaoId', new ParseUUIDPipe()) personalizacaoId: string) {
    return this.associacoes.remove(produtoId, personalizacaoId);
  }
}
