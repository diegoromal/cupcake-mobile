import { Controller, Get, Param, ParseUUIDPipe, Patch, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import { AuthenticatedRequest } from '../auth/authenticated-user';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PerfilUsuario } from '../generated/prisma/enums';
import { PedidosService } from './pedidos.service';

@Controller('entregador/pedidos')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(PerfilUsuario.ENTREGADOR)
export class EntregadorPedidosController {
  constructor(private readonly pedidos: PedidosService) {}

  @Get()
  listar(@Req() request: AuthenticatedRequest) {
    if (!request.user?.id) throw new UnauthorizedException('Access token inválido.');
    return this.pedidos.listarParaEntregador(request.user.id);
  }

  @Get(':id')
  detalhar(@Req() request: AuthenticatedRequest, @Param('id', new ParseUUIDPipe()) id: string) {
    if (!request.user?.id) throw new UnauthorizedException('Access token inválido.');
    return this.pedidos.detalharParaEntregador(id, request.user.id);
  }

  @Patch(':id/confirmar-entrega')
  confirmarEntrega(@Req() request: AuthenticatedRequest, @Param('id', new ParseUUIDPipe()) id: string) {
    if (!request.user?.id) throw new UnauthorizedException('Access token inválido.');
    return this.pedidos.confirmarEntrega(id, request.user.id);
  }
}
