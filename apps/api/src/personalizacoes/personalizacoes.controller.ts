import {
  BadRequestException, Body, Controller, Delete, Get, HttpCode, Param,
  ParseUUIDPipe, Patch, Post, UseGuards, UsePipes, ValidationPipe,
} from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PerfilUsuario } from '../generated/prisma/enums';
import { CreatePersonalizacaoDto } from './dto/create-personalizacao.dto';
import { UpdatePersonalizacaoDto } from './dto/update-personalizacao.dto';
import { PersonalizacoesService } from './personalizacoes.service';

@Controller('admin/personalizacoes')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(PerfilUsuario.ADMIN)
@UsePipes(new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
  validationError: { target: false, value: false },
}))
export class PersonalizacoesController {
  constructor(private readonly personalizacoes: PersonalizacoesService) {}

  @Post()
  create(@Body() input: CreatePersonalizacaoDto) {
    return this.personalizacoes.create(input);
  }

  @Get()
  list() {
    return this.personalizacoes.list();
  }

  @Get(':id')
  findById(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.personalizacoes.findById(id);
  }

  @Patch(':id')
  update(@Param('id', new ParseUUIDPipe()) id: string, @Body() input: UpdatePersonalizacaoDto) {
    if (input.nome === undefined && input.descricao === undefined &&
        input.disponibilidade === undefined && input.ajusteValor === undefined) {
      throw new BadRequestException('Informe ao menos um campo para atualizar.');
    }
    return this.personalizacoes.update(id, input);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.personalizacoes.remove(id);
  }
}
