import {
  Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Req,
  UnauthorizedException, UseGuards, UsePipes, ValidationPipe,
} from '@nestjs/common';
import { AuthenticatedRequest } from '../auth/authenticated-user';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PerfilUsuario } from '../generated/prisma/enums';
import { CarrinhoService } from './carrinho.service';
import { AdicionarItemCarrinhoDto } from './dto/adicionar-item.dto';
import { AlterarQuantidadeItemDto } from './dto/alterar-quantidade.dto';

@Controller('carrinho')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(PerfilUsuario.CLIENTE)
@UsePipes(new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
  validationError: { target: false, value: false },
}))
export class CarrinhoController {
  constructor(private readonly carrinho: CarrinhoService) {}

  @Get()
  obter(@Req() request: AuthenticatedRequest) {
    const usuarioId = request.user?.id;
    if (!usuarioId) throw new UnauthorizedException('Access token inválido.');
    return this.carrinho.obter(usuarioId);
  }

  @Post('itens')
  adicionar(@Req() request: AuthenticatedRequest, @Body() body: AdicionarItemCarrinhoDto) {
    const usuarioId = request.user?.id;
    if (!usuarioId) throw new UnauthorizedException('Access token inválido.');
    return this.carrinho.adicionar(usuarioId, body);
  }

  @Patch('itens/:itemId')
  alterarQuantidade(
    @Req() request: AuthenticatedRequest,
    @Param('itemId', new ParseUUIDPipe()) itemId: string,
    @Body() body: AlterarQuantidadeItemDto,
  ) {
    const usuarioId = request.user?.id;
    if (!usuarioId) throw new UnauthorizedException('Access token inválido.');
    return this.carrinho.alterarQuantidade(usuarioId, itemId, body.quantidade);
  }

  @Delete('itens/:itemId')
  @HttpCode(204)
  remover(
    @Req() request: AuthenticatedRequest,
    @Param('itemId', new ParseUUIDPipe()) itemId: string,
  ) {
    const usuarioId = request.user?.id;
    if (!usuarioId) throw new UnauthorizedException('Access token inválido.');
    return this.carrinho.removerItem(usuarioId, itemId);
  }
}
