import type { StatusFila, StatusPedido } from './contracts';

export const statusLabel: Record<StatusPedido, string> = {
  PENDENTE_PAGAMENTO: 'Pendente de pagamento', PAGO: 'Pago', EM_PREPARO: 'Em preparo',
  SAIU_PARA_ENTREGA: 'Saiu para entrega', ENTREGUE: 'Entregue',
  PRONTO_PARA_RETIRADA: 'Pronto para retirada', RETIRADO: 'Retirado',
  EXPIRADO: 'Expirado', CANCELADO: 'Cancelado',
};
export const statusFila: StatusFila[] = [
  'PAGO', 'EM_PREPARO', 'SAIU_PARA_ENTREGA', 'ENTREGUE',
  'PRONTO_PARA_RETIRADA', 'RETIRADO', 'CANCELADO',
];

export function formatDate(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('pt-BR');
}

export function formatCurrency(value: string): string {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—';
}
