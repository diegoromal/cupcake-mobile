export type Produto = { id: string; categoriaId: string; nome: string; descricao: string | null; precoAtual: string; imagem: string | null; ativo: boolean };
export type Categoria = { id: string; nome: string; descricao: string | null };
export type Personalizacao = { id: string; nome: string; descricao: string | null; disponibilidade: boolean; ajusteValor: string | null };
export type Vinculo = { produtoId: string; personalizacaoId: string };
export type Estoque = { produtoId: string; quantidadeFisica: number; quantidadeReservada: number; quantidadeDisponivel: number };
export type MovimentacaoEstoque = { id: string; produtoId: string; pedidoId: string | null; quantidade: number; motivoOrigem: string; data: string };
