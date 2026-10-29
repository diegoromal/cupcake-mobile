'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { AdminApiError, adminApi } from '@/lib/client/admin-api';
import type { PedidoAdministrativo, StatusFila } from '@/lib/contracts';
import { formatCurrency, formatDate, statusFila, statusLabel } from '@/lib/order-display';

export default function OrderList() {
  const [orders, setOrders] = useState<PedidoAdministrativo[] | null>(null);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFila | ''>('');
  const load = useCallback(async () => {
    setError('');
    setOrders(null);
    try {
      setOrders(await adminApi<PedidoAdministrativo[]>('/api/admin/pedidos'));
    } catch (cause) {
      setError(cause instanceof AdminApiError && cause.status === 403
        ? 'Acesso negado. Apenas administradores podem consultar pedidos.'
        : cause instanceof Error ? cause.message : 'Falha ao carregar pedidos.');
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  const visible = orders?.filter((order) => !statusFilter || order.statusAtual === statusFilter);

  return <section>
    <div className="heading"><div><h1>Pedidos</h1><p>Acompanhe os pedidos da loja.</p></div></div>
    <div className="order-filter">
      <label htmlFor="status-pedido">Status</label>
      <select id="status-pedido" value={statusFilter} disabled={orders === null}
        onChange={(event) => setStatusFilter(event.target.value as StatusFila | '')}>
        <option value="">Todos os status</option>
        {statusFila.map((status) => <option key={status} value={status}>{statusLabel[status]}</option>)}
      </select>
      <button type="button" className="secondary" onClick={() => setStatusFilter('')}
        disabled={!statusFilter}>Limpar filtros</button>
    </div>
    {error && <div className="error" role="alert">{error} <button onClick={load}>Tentar novamente</button></div>}
    {!error && orders === null && <p role="status">Carregando pedidos...</p>}
    {visible !== undefined && <p role="status">{visible.length} {visible.length === 1 ? 'pedido listado' : 'pedidos listados'}</p>}
    {visible?.length === 0 && <div className="card">{statusFilter
      ? 'Nenhum pedido com este status.' : 'Nenhum pedido para acompanhar.'}</div>}
    {!!visible?.length && <>
      <div className="card table-wrap"><table>
        <thead><tr><th scope="col">Pedido</th><th scope="col">Data / Hora</th><th scope="col">Cliente</th><th scope="col">Modalidade</th><th scope="col">Status</th><th scope="col">Total</th><th scope="col">Ação</th></tr></thead>
        <tbody>{visible.map(order => <tr key={order.id}>
          <td><strong>{order.identificadorNegocio}</strong></td>
          <td>{formatDate(order.confirmacaoPagamento)}</td>
          <td>{order.cliente.nome}</td>
          <td>{order.modalidade === 'ENTREGA' ? 'Delivery' : 'Retirada'}</td>
          <td><span className="badge badge-muted">{statusLabel[order.statusAtual]}</span></td>
          <td>{formatCurrency(order.total)}</td>
          <td><Link href={`/pedidos/${order.id}`} aria-label={`Ver detalhes do pedido ${order.identificadorNegocio}`}>Ver detalhes</Link></td>
        </tr>)}</tbody>
      </table></div>
    </>}
  </section>;
}
