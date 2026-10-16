import {
  Controller, Get, Header, Param, ParseUUIDPipe, Query, Res,
  UseGuards, UsePipes, ValidationPipe,
} from '@nestjs/common';
import type { Response } from 'express';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PerfilUsuario } from '../generated/prisma/enums';
import { CatalogoQueryDto } from './dto/catalogo-query.dto';
import { CatalogoService } from './catalogo.service';

@Controller('catalogo/produtos')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(PerfilUsuario.CLIENTE)
@UsePipes(new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
  validationError: { target: false, value: false },
}))
export class CatalogoController {
  constructor(private readonly catalogo: CatalogoService) {}

  @Get()
  list(@Query() query: CatalogoQueryDto) {
    return this.catalogo.list(query.page, query.limit);
  }

  @Get(':id/imagem')
  @Header('Cache-Control', 'private, no-store')
  async image(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Res() response: Response,
  ): Promise<void> {
    const bytes = await this.catalogo.getImage(id);
    response.set({
      'Content-Type': 'image/webp',
      'Content-Length': String(bytes.length),
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    response.end(bytes);
  }
}
