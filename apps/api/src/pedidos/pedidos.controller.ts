import { BadRequestException, Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Req, UnauthorizedException, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { AuthenticatedRequest } from '../auth/authenticated-user';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ModalidadeRecebimento, PerfilUsuario } from '../generated/prisma/enums';
import { CriarPedidoDto } from './dto/criar-pedido.dto';
import { PedidosService } from './pedidos.service';

@Controller('pedidos')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(PerfilUsuario.CLIENTE)
@UsePipes(new ValidationPipe({
  transform: true, whitelist: true, forbidNonWhitelisted: true,
  validationError: { target: false, value: false },
}))
export class PedidosController {
  constructor(private readonly pedidos: PedidosService) {}

  @Get()
  listar(@Req() request: AuthenticatedRequest) {
    if (!request.user?.id) throw new UnauthorizedException('Access token inválido.');
    return this.pedidos.listarParaCliente(request.user.id);
  }

  @Patch(':id/cancelar')
  cancelar(@Req() request: AuthenticatedRequest, @Param('id', new ParseUUIDPipe()) id: string) {
    if (!request.user?.id) throw new UnauthorizedException('Access token inválido.');
    return this.pedidos.cancelarComoCliente(id, request.user.id);
  }

  @Post('revisao')
  revisar(@Req() request: AuthenticatedRequest, @Body() body: CriarPedidoDto) {
    if (!request.user?.id) throw new UnauthorizedException('Access token inválido.');
    if (body.modalidade === ModalidadeRecebimento.RETIRADA && body.enderecoId !== undefined) {
      throw new BadRequestException('Retirada não aceita endereço.');
    }
    if (body.modalidade === ModalidadeRecebimento.ENTREGA && !body.enderecoId) {
      throw new BadRequestException('Endereço obrigatório para entrega.');
    }
    return this.pedidos.revisar(request.user.id, body);
  }

  @Post()
  criar(@Req() request: AuthenticatedRequest, @Body() body: CriarPedidoDto) {
    if (!request.user?.id) throw new UnauthorizedException('Access token inválido.');
    if (!body.revisaoId) throw new BadRequestException('Referência da revisão obrigatória.');
    if (body.modalidade === ModalidadeRecebimento.RETIRADA && body.enderecoId !== undefined) {
      throw new BadRequestException('Retirada não aceita endereço.');
    }
    return this.pedidos.criar(request.user.id, body);
  }
}
