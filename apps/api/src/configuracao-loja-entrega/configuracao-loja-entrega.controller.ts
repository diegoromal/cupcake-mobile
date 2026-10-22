import { Body, Controller, Get, Put, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PerfilUsuario } from '../generated/prisma/enums';
import { ConfiguracaoLojaEntregaService } from './configuracao-loja-entrega.service';
import { SalvarConfiguracaoLojaEntregaDto } from './dto/salvar-configuracao-loja-entrega.dto';

@Controller('admin/configuracao-loja-entrega')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(PerfilUsuario.ADMIN)
@UsePipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true, validationError: { target: false, value: false } }))
export class ConfiguracaoLojaEntregaController {
  constructor(private readonly configuracao: ConfiguracaoLojaEntregaService) {}

  @Get()
  obter() { return this.configuracao.obter(); }

  @Put()
  salvar(@Body() input: SalvarConfiguracaoLojaEntregaDto) { return this.configuracao.salvar(input); }
}
