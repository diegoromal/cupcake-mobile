import type { Categoria } from './contracts';
export type CategoryFields = Pick<Categoria, 'nome'|'descricao'>;
export const emptyCategory: CategoryFields = { nome: '', descricao: '' };
export function validateCategory(value: CategoryFields): Record<string,string> {
  return value.nome.trim() ? {} : { nome: 'Informe o nome.' };
}
export function categoryPayload(value: CategoryFields, original?: CategoryFields): Partial<CategoryFields> {
  const clean = { nome: value.nome.trim(), descricao: value.descricao?.trim() || null };
  if (!original) return clean;
  return Object.fromEntries((Object.keys(clean) as (keyof CategoryFields)[]).filter(key => clean[key] !== original[key]).map(key => [key,clean[key]]));
}
