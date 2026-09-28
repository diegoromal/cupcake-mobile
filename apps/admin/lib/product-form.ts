import type { Produto } from './contracts';
export type ProductFields = Pick<Produto, 'categoriaId'|'nome'|'descricao'|'precoAtual'|'ativo'>;
export const emptyProduct: ProductFields = { categoriaId: '', nome: '', descricao: '', precoAtual: '', ativo: true };
export function validateProduct(value: ProductFields, availableIds: string[]): Record<string,string> {
  const errors: Record<string,string> = {};
  if (!availableIds.includes(value.categoriaId)) errors.categoriaId = 'Selecione uma categoria disponível.';
  if (!value.nome.trim()) errors.nome = 'Informe o nome.';
  if (!/^\d{1,10}(?:\.\d{1,2})?$/.test(value.precoAtual)) errors.precoAtual = 'Use preço decimal com ponto e até duas casas.';
  return errors;
}
export function productPayload(value: ProductFields, original?: ProductFields): Partial<ProductFields> {
  const clean = { ...value, nome: value.nome.trim(), descricao: value.descricao?.trim() || null };
  if (!original) return clean;
  return Object.fromEntries((Object.keys(clean) as (keyof ProductFields)[]).filter(key => clean[key] !== original[key]).map(key => [key, clean[key]])) as Partial<ProductFields>;
}
