import {
  Body, Controller, Get, Post, Req, UnauthorizedException, UseGuards, UsePipes, ValidationPipe,
} from '@nestjs/common';
import { AuthenticatedRequest } from '../auth/authenticated-user';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PerfilUsuario } from '../generated/prisma/enums';
import { CarrinhoService } from './carrinho.service';
import { AdicionarItemCarrinhoDto } from './dto/adicionar-item.dto';

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
}
