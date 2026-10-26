import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { CarrinhoModule } from './carrinho/carrinho.module';
import { CategoriasModule } from './categorias/categorias.module';
import { CatalogoModule } from './catalogo/catalogo.module';
import { HealthModule } from './health/health.module';
import { PersonalizacoesModule } from './personalizacoes/personalizacoes.module';
import { ProdutosModule } from './produtos/produtos.module';
import { UsersModule } from './users/users.module';
import { EnderecosModule } from './enderecos/enderecos.module';
import { ConfiguracaoLojaEntregaModule } from './configuracao-loja-entrega/configuracao-loja-entrega.module';
import { PedidosModule } from './pedidos/pedidos.module';
import { PagamentosModule } from './pagamentos/pagamentos.module';
import { NotificacoesModule } from './notificacoes/notificacoes.module';

@Module({
  imports: [HealthModule, UsersModule, AuthModule, CategoriasModule, PersonalizacoesModule, ProdutosModule, CatalogoModule, CarrinhoModule, EnderecosModule, ConfiguracaoLojaEntregaModule, PedidosModule, PagamentosModule, NotificacoesModule],
})
export class AppModule {}
