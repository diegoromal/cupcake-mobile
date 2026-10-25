import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Req, UnauthorizedException, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { AuthenticatedRequest } from '../auth/authenticated-user';
import { PerfilUsuario } from '../generated/prisma/enums';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PedidosService } from './pedidos.service';
import { SairParaEntregaDto } from './dto/sair-para-entrega.dto';

@Controller('admin/pedidos')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(PerfilUsuario.ADMIN)
export class AdminPedidosController {
  constructor(private readonly pedidos: PedidosService) {}

  @Get()
  listar() {
    return this.pedidos.listarParaAdministracao();
  }

  @Get(':id')
  detalhar(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.pedidos.detalharParaAdministracao(id);
  }

  @Patch(':id/iniciar-producao')
  iniciarProducao(@Req() request: AuthenticatedRequest, @Param('id', new ParseUUIDPipe()) id: string) {
    if (!request.user?.id) throw new UnauthorizedException('Access token inválido.');
    return this.pedidos.iniciarProducao(id, request.user.id);
  }

  @Patch(':id/saiu-para-entrega')
  @UsePipes(new ValidationPipe({
    transform: true, whitelist: true, forbidNonWhitelisted: true,
    validationError: { target: false, value: false },
  }))
  sairParaEntrega(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: SairParaEntregaDto,
  ) {
    if (!request.user?.id) throw new UnauthorizedException('Access token inválido.');
    return this.pedidos.sairParaEntrega(id, input.entregadorUsuarioId, request.user.id);
  }

  @Patch(':id/pronto-para-retirada')
  marcarProntoParaRetirada(@Req() request: AuthenticatedRequest, @Param('id', new ParseUUIDPipe()) id: string) {
    if (!request.user?.id) throw new UnauthorizedException('Access token inválido.');
    return this.pedidos.marcarProntoParaRetirada(id, request.user.id);
  }

  @Patch(':id/confirmar-retirada')
  confirmarRetirada(@Req() request: AuthenticatedRequest, @Param('id', new ParseUUIDPipe()) id: string) {
    if (!request.user?.id) throw new UnauthorizedException('Access token inválido.');
    return this.pedidos.confirmarRetirada(id, request.user.id);
  }
}
