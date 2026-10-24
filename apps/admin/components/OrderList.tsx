'use client';
import { useCallback, useEffect, useState } from 'react';
import { adminApi } from '@/lib/client/admin-api';
import type { PedidoAdministrativo } from '@/lib/contracts';

const statusLabel: Record<PedidoAdministrativo['statusAtual'], string> = {
  PAGO: 'Pago',
  EM_PREPARO: 'Em preparo',
  SAIU_PARA_ENTREGA: 'Saiu para entrega',
  ENTREGUE: 'Entregue',
  PRONTO_PARA_RETIRADA: 'Pronto para retirada',
  RETIRADO: 'Retirado',
  CANCELADO: 'Cancelado',
};

function formatDate(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('pt-BR');
}

function formatCurrency(value: string): string {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—';
}

export default function OrderList() {
  const [orders, setOrders] = useState<PedidoAdministrativo[] | null>(null);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setError('');
    setOrders(null);
    try {
      setOrders(await adminApi<PedidoAdministrativo[]>('/api/admin/pedidos'));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Falha ao carregar pedidos.');
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return <section>
    <div className="heading"><div><h1>Pedidos</h1><p>Acompanhe os pedidos da loja.</p></div></div>
    {error && <div className="error" role="alert">{error} <button onClick={load}>Tentar novamente</button></div>}
    {!error && orders === null && <p role="status">Carregando pedidos...</p>}
    {orders?.length === 0 && <div className="card">Nenhum pedido para acompanhar.</div>}
    {!!orders?.length && <>
      <p role="status">{orders.length} {orders.length === 1 ? 'pedido listado' : 'pedidos listados'}</p>
      <div className="card table-wrap"><table>
        <thead><tr><th scope="col">Pedido</th><th scope="col">Pagamento</th><th scope="col">Cliente</th><th scope="col">Modalidade</th><th scope="col">Status</th><th scope="col">Total</th></tr></thead>
        <tbody>{orders.map(order => <tr key={order.id}>
          <td><strong>{order.identificadorNegocio}</strong></td>
          <td>{formatDate(order.confirmacaoPagamento)}</td>
          <td>{order.cliente.nome}</td>
          <td>{order.modalidade === 'ENTREGA' ? 'Delivery' : 'Retirada'}</td>
          <td><span className="badge badge-muted">{statusLabel[order.statusAtual]}</span></td>
          <td>{formatCurrency(order.total)}</td>
        </tr>)}</tbody>
      </table></div>
    </>}
  </section>;
}
