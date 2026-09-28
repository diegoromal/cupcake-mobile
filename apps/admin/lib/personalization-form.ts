import type { Personalizacao } from './contracts';
export type PersonalizationFields = Pick<Personalizacao, 'nome'|'descricao'|'disponibilidade'|'ajusteValor'>;
export const emptyPersonalization: PersonalizationFields = { nome: '', descricao: '', disponibilidade: true, ajusteValor: null };
export const decimalPattern = /^[-+]?0*\d{1,10}(?:\.\d{1,2})?$/;
export function validatePersonalization(value: PersonalizationFields): Record<string,string> {
  const errors: Record<string,string> = {};
  if (!value.nome.trim()) errors.nome = 'Informe o nome.';
  if (value.ajusteValor !== null && value.ajusteValor !== '' && !decimalPattern.test(value.ajusteValor)) errors.ajusteValor = 'Use decimal com ponto, até dez dígitos inteiros e duas casas.';
  return errors;
}
export function personalizationPayload(value: PersonalizationFields, original?: PersonalizationFields): Partial<PersonalizationFields> {
  const clean = { nome: value.nome.trim(), descricao: value.descricao?.trim() || null, disponibilidade: value.disponibilidade, ajusteValor: value.ajusteValor || null };
  if (!original) return clean;
  return Object.fromEntries((Object.keys(clean) as (keyof PersonalizationFields)[]).filter(key => clean[key] !== original[key]).map(key => [key,clean[key]]));
}
export function displayAdjustment(value: string | null): string {
  if (value === null) return 'Não definido';
  const negative = value.startsWith('-');
  const unsigned = value.replace(/^[-+]/,'');
  const [integer,fraction=''] = unsigned.split('.');
  const normalized = integer.replace(/^0+(?=\d)/,'');
  const zero = /^0+$/.test(normalized) && (!fraction || /^0+$/.test(fraction));
  return `${zero ? '' : negative ? '− ' : '+ '}R$ ${normalized},${fraction.padEnd(2,'0')}`;
}
