import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Req, UnauthorizedException, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { AuthenticatedRequest } from '../auth/authenticated-user';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PerfilUsuario } from '../generated/prisma/enums';
import { CepService } from './cep.service';
import { CoberturaFreteService } from './cobertura-frete.service';
import { CreateEnderecoDto } from './dto/create-endereco.dto';
import { EnderecosService } from './enderecos.service';
import { GeocodificacaoService } from './geocodificacao.service';

@Controller('enderecos')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(PerfilUsuario.CLIENTE)
@UsePipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true, validationError: { target: false, value: false } }))
export class EnderecosController {
  constructor(
    private readonly enderecos: EnderecosService,
    private readonly cep: CepService,
    private readonly geocodificacao: GeocodificacaoService,
    private readonly coberturaFrete: CoberturaFreteService,
  ) {}

  @Post()
  criar(@Req() request: AuthenticatedRequest, @Body() body: CreateEnderecoDto) {
    return this.enderecos.criar(this.userId(request), body);
  }

  @Get()
  listar(@Req() request: AuthenticatedRequest) {
    return this.enderecos.listar(this.userId(request));
  }

  @Get('cep/:cep')
  consultarCep(@Param('cep') cep: string) {
    return this.cep.consultar(cep);
  }

  @Post(':id/geocodificacao')
  @HttpCode(200)
  geocodificar(@Req() request: AuthenticatedRequest, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.geocodificacao.geocodificar(this.userId(request), id);
  }

  @Get(':id/cobertura-frete')
  consultarCoberturaFrete(@Req() request: AuthenticatedRequest, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.coberturaFrete.consultar(this.userId(request), id);
  }

  private userId(request: AuthenticatedRequest): string {
    if (!request.user?.id) throw new UnauthorizedException('Access token inválido.');
    return request.user.id;
  }
}
