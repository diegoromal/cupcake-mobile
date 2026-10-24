'use client';
import { useCallback, useEffect, useState } from 'react';
import { AdminApiError, adminApi } from '@/lib/client/admin-api';
import type { PedidoDetalheAdministrativo } from '@/lib/contracts';
import { formatCurrency, formatDate, statusLabel } from '@/lib/order-display';

export default function OrderDetail({ id }: { id: string }) {
  const [order, setOrder] = useState<PedidoDetalheAdministrativo | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'missing' | 'denied' | 'error'>('loading');
  const load = useCallback(async () => {
    setState('loading'); setOrder(null);
    try {
      setOrder(await adminApi<PedidoDetalheAdministrativo>(`/api/admin/pedidos/${id}`));
      setState('ready');
    } catch (cause) {
      setState(cause instanceof AdminApiError && cause.status === 404 ? 'missing'
        : cause instanceof AdminApiError && cause.status === 403 ? 'denied' : 'error');
    }
  }, [id]);
  useEffect(() => { void load(); }, [load]);

  if (state === 'loading') return <section role="status">Carregando pedido...</section>;
  if (state === 'missing') return <section className="card" role="alert">Pedido não encontrado.</section>;
  if (state === 'denied') return <section className="card" role="alert">
    Acesso negado. Apenas administradores podem consultar pedidos.
  </section>;
  if (state === 'error' || !order) return <section className="card error" role="alert">
    Falha ao carregar pedido. <button type="button" onClick={load}>Tentar novamente</button>
  </section>;

  return <section className="order-detail">
    <div className="page-intro">
      <h1>Pedido {order.identificadorNegocio}</h1>
      <p><span className="badge badge-muted">{statusLabel[order.statusAtual]}</span>
        {' · '}{order.modalidade === 'ENTREGA' ? 'Delivery' : 'Retirada'}</p>
      <p>Pagamento confirmado: {formatDate(order.confirmacaoPagamento)}</p>
    </div>
    <div className="order-detail-grid">
      <section className="card order-items" aria-labelledby="order-items-heading">
        <h2 id="order-items-heading">Itens do pedido</h2>
        <ul>{order.itens.map((item) => <li key={item.id}>
          <div><strong>{item.quantidade} × {item.nome}</strong>
            <span>Preço unitário: {formatCurrency(item.precoAplicado)}</span></div>
          <strong>{formatCurrency(item.subtotalAplicado)}</strong>
          {item.personalizacoes.length > 0 && <ul className="order-customizations">
            {item.personalizacoes.map((customization, index) => <li key={index}>
              {customization.nomeAplicado}{customization.ajusteValorAplicado !== null
                ? ` · ${formatCurrency(customization.ajusteValorAplicado)}` : ''}
            </li>)}
          </ul>}
        </li>)}</ul>
      </section>
      <div className="order-detail-side">
        <section className="card" aria-labelledby="order-history-heading">
          <h2 id="order-history-heading">Histórico de alterações</h2>
          {order.historicoStatus.length === 0 ? <p>Nenhuma alteração registrada.</p> :
            <ol>{order.historicoStatus.map((entry) => <li key={entry.id}>
              <strong>{statusLabel[entry.status]}</strong>
              <p>{formatDate(entry.dataHora)}</p>
              {entry.responsavel && <p>Responsável: {entry.responsavel}</p>}
            </li>)}</ol>}
        </section>
        <section className="card" aria-labelledby="order-customer-heading">
          <h2 id="order-customer-heading">Cliente</h2>
          <p>{order.cliente.nome}</p>
          {order.modalidade === 'ENTREGA' && order.enderecoEntregaSnapshot && <>
            <h3>Endereço de entrega</h3>
            <address>{order.enderecoEntregaSnapshot.rua}, {order.enderecoEntregaSnapshot.numero}<br />
              {order.enderecoEntregaSnapshot.bairro} · {order.enderecoEntregaSnapshot.cidade}<br />
              CEP {order.enderecoEntregaSnapshot.cep}
              {order.enderecoEntregaSnapshot.complemento && <><br />{order.enderecoEntregaSnapshot.complemento}</>}
              {order.enderecoEntregaSnapshot.referencia && <><br />Referência: {order.enderecoEntregaSnapshot.referencia}</>}
            </address>
          </>}
        </section>
        <section className="card" aria-labelledby="order-summary-heading">
          <h2 id="order-summary-heading">Resumo financeiro</h2>
          <dl className="order-summary">
            <div><dt>Subtotal</dt><dd>{formatCurrency(order.valorItens)}</dd></div>
            <div><dt>Frete</dt><dd>{formatCurrency(order.freteAplicado)}</dd></div>
            <div><dt>Total</dt><dd><strong>{formatCurrency(order.total)}</strong></dd></div>
            <div><dt>Forma de pagamento</dt><dd>{order.formaPagamento === 'PIX' ? 'Pix'
              : order.formaPagamento === 'CARTAO' ? 'Cartão' : '—'}</dd></div>
          </dl>
        </section>
      </div>
    </div>
  </section>;
}
