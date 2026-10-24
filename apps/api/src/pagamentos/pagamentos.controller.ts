import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Req, Res, UnauthorizedException, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import type { Response } from 'express';
import { AuthenticatedRequest } from '../auth/authenticated-user';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PerfilUsuario } from '../generated/prisma/enums';
import { CriarPagamentoDto } from './dto/criar-pagamento.dto';
import { PagamentosService } from './pagamentos.service';

@Controller('pedidos/:pedidoId/pagamentos')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(PerfilUsuario.CLIENTE)
@UsePipes(new ValidationPipe({
  transform: true, whitelist: true, forbidNonWhitelisted: true,
  validationError: { target: false, value: false },
}))
export class PagamentosController {
  constructor(private readonly pagamentos: PagamentosService) {}

  @Post('pix')
  async iniciarPix(@Req() request: AuthenticatedRequest,
    @Param('pedidoId', new ParseUUIDPipe()) pedidoId: string,
    @Body() body: CriarPagamentoDto, @Res({ passthrough: true }) response: Response) {
    if (!request.user?.id) throw new UnauthorizedException('Access token inválido.');
    const resultado = await this.pagamentos.iniciarPix(request.user.id, pedidoId, body.tentativaId);
    response.status(resultado.criado ? 201 : 200);
    return resultado.pagamento;
  }

  @Get('pix/:tentativaId')
  consultarPix(@Req() request: AuthenticatedRequest,
    @Param('pedidoId', new ParseUUIDPipe()) pedidoId: string,
    @Param('tentativaId', new ParseUUIDPipe()) tentativaId: string) {
    if (!request.user?.id) throw new UnauthorizedException('Access token inválido.');
    return this.pagamentos.consultarPix(request.user.id, pedidoId, tentativaId);
  }

  @Post('cartao')
  async iniciarCartao(@Req() request: AuthenticatedRequest,
    @Param('pedidoId', new ParseUUIDPipe()) pedidoId: string,
    @Body() body: CriarPagamentoDto, @Res({ passthrough: true }) response: Response) {
    if (!request.user?.id) throw new UnauthorizedException('Access token inválido.');
    const resultado = await this.pagamentos.iniciarCartao(request.user.id, pedidoId, body.tentativaId);
    response.status(resultado.criado ? 201 : 200);
    return resultado.pagamento;
  }

  @Get('cartao/:tentativaId')
  consultarCartao(@Req() request: AuthenticatedRequest,
    @Param('pedidoId', new ParseUUIDPipe()) pedidoId: string,
    @Param('tentativaId', new ParseUUIDPipe()) tentativaId: string) {
    if (!request.user?.id) throw new UnauthorizedException('Access token inválido.');
    return this.pagamentos.consultarCartao(request.user.id, pedidoId, tentativaId);
  }
}
