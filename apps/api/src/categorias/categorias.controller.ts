import {
  BadRequestException, Body, Controller, Delete, Get, HttpCode, Param,
  ParseUUIDPipe, Patch, Post, UseGuards, UsePipes, ValidationPipe,
} from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PerfilUsuario } from '../generated/prisma/enums';
import { CategoriasService } from './categorias.service';
import { CreateCategoriaDto } from './dto/create-categoria.dto';
import { UpdateCategoriaDto } from './dto/update-categoria.dto';

@Controller('admin/categorias')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(PerfilUsuario.ADMIN)
@UsePipes(new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
  validationError: { target: false, value: false },
}))
export class CategoriasController {
  constructor(private readonly categorias: CategoriasService) {}

  @Post()
  create(@Body() input: CreateCategoriaDto) {
    return this.categorias.create(input);
  }

  @Get()
  list() {
    return this.categorias.list();
  }

  @Get(':id')
  findById(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.categorias.findById(id);
  }

  @Patch(':id')
  update(@Param('id', new ParseUUIDPipe()) id: string, @Body() input: UpdateCategoriaDto) {
    if (input.nome === undefined && input.descricao === undefined) {
      throw new BadRequestException('Informe ao menos um campo para atualizar.');
    }
    return this.categorias.update(id, input);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.categorias.remove(id);
  }
}
