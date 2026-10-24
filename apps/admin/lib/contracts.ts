export type Produto = { id: string; categoriaId: string; nome: string; descricao: string | null; precoAtual: string; imagem: string | null; ativo: boolean };
export type Categoria = { id: string; nome: string; descricao: string | null };
export type Personalizacao = { id: string; nome: string; descricao: string | null; disponibilidade: boolean; ajusteValor: string | null };
export type ConfiguracaoLojaEntrega = { latitudeLoja: string; longitudeLoja: string; raioMaximoAtendimento: string; taxaBase: string; valorPorQuilometro: string };
export type Vinculo = { produtoId: string; personalizacaoId: string };
export type Estoque = { produtoId: string; quantidadeFisica: number; quantidadeReservada: number; quantidadeDisponivel: number };
export type MovimentacaoEstoque = { id: string; produtoId: string; pedidoId: string | null; quantidade: number; motivoOrigem: string; data: string };
export type PedidoAdministrativo = {
  id: string;
  identificadorNegocio: string;
  confirmacaoPagamento: string | null;
  cliente: { nome: string };
  modalidade: 'ENTREGA' | 'RETIRADA';
  statusAtual: StatusFila;
  total: string;
};
export type StatusPedido = 'PENDENTE_PAGAMENTO' | 'PAGO' | 'EM_PREPARO' |
  'SAIU_PARA_ENTREGA' | 'ENTREGUE' | 'PRONTO_PARA_RETIRADA' | 'RETIRADO' | 'EXPIRADO' | 'CANCELADO';
export type StatusFila = Exclude<StatusPedido, 'PENDENTE_PAGAMENTO' | 'EXPIRADO'>;
export type PedidoDetalheAdministrativo = {
  id: string; identificadorNegocio: string; confirmacaoPagamento: string | null;
  cliente: { nome: string }; modalidade: 'ENTREGA' | 'RETIRADA'; statusAtual: StatusPedido;
  valorItens: string; freteAplicado: string; total: string; formaPagamento: 'PIX' | 'CARTAO' | null;
  enderecoEntregaSnapshot: { rua: string; numero: string; bairro: string; cidade: string;
    cep: string; complemento: string | null; referencia: string | null } | null;
  itens: Array<{ id: string; nome: string; quantidade: number; precoAplicado: string;
    subtotalAplicado: string; personalizacoes: Array<{ nomeAplicado: string;
      ajusteValorAplicado: string | null }> }>;
};
