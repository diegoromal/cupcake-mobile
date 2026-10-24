import { Controller, Get, UseGuards } from '@nestjs/common';
import { PerfilUsuario } from '../generated/prisma/enums';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PedidosService } from './pedidos.service';

@Controller('admin/pedidos')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(PerfilUsuario.ADMIN)
export class AdminPedidosController {
  constructor(private readonly pedidos: PedidosService) {}

  @Get()
  listar() {
    return this.pedidos.listarParaAdministracao();
  }
}
