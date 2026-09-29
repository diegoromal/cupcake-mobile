import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PerfilUsuario } from '../generated/prisma/enums';
import { AjustarEstoqueDto } from './dto/ajustar-estoque.dto';
import { EstoqueService } from './estoque.service';

@Controller('admin/produtos/:id/estoque')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(PerfilUsuario.ADMIN)
@UsePipes(new ValidationPipe({
  transform: true, whitelist: true, forbidNonWhitelisted: true,
  validationError: { target: false, value: false },
}))
export class EstoqueController {
  constructor(private readonly estoque: EstoqueService) {}

  @Get()
  consultar(@Param('id', new ParseUUIDPipe()) id: string) { return this.estoque.consultar(id); }

  @Patch()
  ajustar(@Param('id', new ParseUUIDPipe()) id: string, @Body() input: AjustarEstoqueDto) {
    return this.estoque.ajustar(id, input.quantidadeDisponivel);
  }

  @Get('movimentacoes')
  historico(@Param('id', new ParseUUIDPipe()) id: string) { return this.estoque.historico(id); }
}
