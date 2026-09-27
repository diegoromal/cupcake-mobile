import {
  BadRequestException, Body, Controller, Delete, Get, HttpCode, Param,
  ParseUUIDPipe, Patch, Post, UseGuards, UsePipes, ValidationPipe,
} from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PerfilUsuario } from '../generated/prisma/enums';
import { CreateProdutoDto } from './dto/create-produto.dto';
import { UpdateProdutoDto } from './dto/update-produto.dto';
import { ProdutosService } from './produtos.service';

@Controller('admin/produtos')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(PerfilUsuario.ADMIN)
@UsePipes(new ValidationPipe({
  transform: true, whitelist: true, forbidNonWhitelisted: true,
  validationError: { target: false, value: false },
}))
export class ProdutosController {
  constructor(private readonly produtos: ProdutosService) {}

  @Post()
  create(@Body() input: CreateProdutoDto) { return this.produtos.create(input); }

  @Get()
  list() { return this.produtos.list(); }

  @Get(':id')
  findById(@Param('id', new ParseUUIDPipe()) id: string) { return this.produtos.findById(id); }

  @Patch(':id')
  update(@Param('id', new ParseUUIDPipe()) id: string, @Body() input: UpdateProdutoDto) {
    if (Object.values(input).every((value) => value === undefined)) {
      throw new BadRequestException('Informe ao menos um campo para atualizar.');
    }
    return this.produtos.update(id, input);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id', new ParseUUIDPipe()) id: string) { return this.produtos.remove(id); }
}
