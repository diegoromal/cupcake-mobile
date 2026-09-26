import { Body, Controller, Post, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { PerfilUsuario } from '../generated/prisma/enums';
import { CreateEntregadorDto } from '../users/dto/create-entregador.dto';
import { UsersService } from '../users/users.service';
import { Roles } from './decorators/roles.decorator';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';

@Controller('admin/entregadores')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(PerfilUsuario.ADMIN)
export class AdminEntregadoresController {
  constructor(private readonly users: UsersService) {}

  @Post()
  @UsePipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      validationError: { target: false, value: false },
    }),
  )
  create(@Body() input: CreateEntregadorDto) {
    return this.users.createEntregador(input);
  }
}
