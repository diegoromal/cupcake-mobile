'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AdminApiError, adminApi } from '@/lib/client/admin-api';
import type { EntregadorAdministrativo, PedidoDetalheAdministrativo, StatusPedido } from '@/lib/contracts';
import { formatCurrency, formatDate, statusLabel } from '@/lib/order-display';

const actions = {
  'iniciar-producao': { label: 'Iniciar produção', confirmation: 'Confirmar início da produção',
    target: 'EM_PREPARO' },
  'saiu-para-entrega': { label: 'Marcar como saiu para entrega', confirmation: 'Confirmar saída para entrega',
    target: 'SAIU_PARA_ENTREGA' },
  'pronto-para-retirada': { label: 'Marcar como pronto para retirada',
    confirmation: 'Confirmar pedido pronto para retirada', target: 'PRONTO_PARA_RETIRADA' },
  'confirmar-retirada': { label: 'Confirmar retirada',
    confirmation: 'Confirmar retirada do pedido', target: 'RETIRADO' },
} as const;
type Action = keyof typeof actions;

type ProgressStep = { status: StatusPedido; phase: 'completed' | 'current' | 'upcoming' };

function progressSteps(order: PedidoDetalheAdministrativo): ProgressStep[] {
  let sequence: StatusPedido[];
  if (order.statusAtual === 'CANCELADO') {
    sequence = ['PENDENTE_PAGAMENTO', 'PAGO', 'CANCELADO'];
  } else if (order.statusAtual === 'EXPIRADO') {
    sequence = ['PENDENTE_PAGAMENTO', 'EXPIRADO'];
  } else if (order.modalidade === 'ENTREGA') {
    sequence = ['PENDENTE_PAGAMENTO', 'PAGO', 'EM_PREPARO', 'SAIU_PARA_ENTREGA', 'ENTREGUE'];
  } else {
    sequence = ['PENDENTE_PAGAMENTO', 'PAGO', 'EM_PREPARO', 'PRONTO_PARA_RETIRADA', 'RETIRADO'];
  }

  const currentIndex = sequence.indexOf(order.statusAtual);
  return sequence.map((status, index) => ({
    status,
    phase: index < currentIndex ? 'completed' : index === currentIndex ? 'current' : 'upcoming',
  }));
}

function nextAction(order: PedidoDetalheAdministrativo, entregadores: EntregadorAdministrativo[]): Action | null {
  if (order.statusAtual === 'PAGO') return 'iniciar-producao';
  if (order.modalidade === 'ENTREGA' && order.statusAtual === 'EM_PREPARO' && entregadores.length > 0) {
    return 'saiu-para-entrega';
  }
  if (order.modalidade !== 'RETIRADA') return null;
  if (order.statusAtual === 'EM_PREPARO') return 'pronto-para-retirada';
  if (order.statusAtual === 'PRONTO_PARA_RETIRADA') return 'confirmar-retirada';
  return null;
}

export default function OrderDetail({ id }: { id: string }) {
  const [order, setOrder] = useState<PedidoDetalheAdministrativo | null>(null);
  const [entregadores, setEntregadores] = useState<EntregadorAdministrativo[]>([]);
  const [entregadorUsuarioId, setEntregadorUsuarioId] = useState('');
  const [loadingEntregadores, setLoadingEntregadores] = useState(false);
  const [entregadoresError, setEntregadoresError] = useState(false);
  const [state, setState] = useState<'loading' | 'ready' | 'missing' | 'denied' | 'error'>('loading');
  const [confirming, setConfirming] = useState<Action | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const returnFocus = useRef(false);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const actionButton = useRef<HTMLButtonElement>(null);
  const loadEntregadores = useCallback(async () => {
    setLoadingEntregadores(true);
    setEntregadoresError(false);
    try {
      setEntregadores(await adminApi<EntregadorAdministrativo[]>('/api/admin/entregadores'));
    } catch {
      setEntregadoresError(true);
    } finally {
      setLoadingEntregadores(false);
    }
  }, []);
  const load = useCallback(async () => {
    setState('loading'); setOrder(null); setConfirming(null); setActionError(null);
    try {
      const pedido = await adminApi<PedidoDetalheAdministrativo>(`/api/admin/pedidos/${id}`);
      setOrder(pedido);
      setState('ready');
      setEntregadores([]); setEntregadorUsuarioId(''); setEntregadoresError(false);
      if (pedido.modalidade === 'ENTREGA' && pedido.statusAtual === 'EM_PREPARO') {
        await loadEntregadores();
      }
    } catch (cause) {
      setState(cause instanceof AdminApiError && cause.status === 404 ? 'missing'
        : cause instanceof AdminApiError && cause.status === 403 ? 'denied' : 'error');
    }
  }, [id, loadEntregadores]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (confirming) confirmationHeading.current?.focus(); }, [confirming]);
  useEffect(() => {
    if (!confirming && returnFocus.current) {
      actionButton.current?.focus();
      returnFocus.current = false;
    }
  }, [confirming]);

  async function submitAction(action: Action) {
    if (inFlight.current || !order || confirming !== action || nextAction(order, entregadores) !== action ||
        (action === 'saiu-para-entrega' && !entregadorUsuarioId)) return;
    inFlight.current = true;
    setSubmitting(true);
    setActionError(null);
    try {
      await adminApi<PedidoDetalheAdministrativo>(
        `/api/admin/pedidos/${id}/${action}`, {
          method: 'PATCH', headers: { 'content-type': 'application/json' },
          body: action === 'saiu-para-entrega' ? JSON.stringify({ entregadorUsuarioId }) : '{}',
        },
      );
      await load();
    } catch (cause) {
      await load();
      if (cause instanceof AdminApiError && cause.status === 409) {
        setActionError('O pedido foi atualizado por outro administrador. Confira o status atual.');
      } else {
        setActionError('Falha ao atualizar o pedido. Confira o status atual antes de tentar novamente.');
      }
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  }

  if (state === 'loading') return <section role="status">Carregando pedido...</section>;
  if (state === 'missing') return <section className="card" role="alert">Pedido não encontrado.</section>;
  if (state === 'denied') return <section className="card" role="alert">
    Acesso negado. Apenas administradores podem consultar pedidos.
  </section>;
  if (state === 'error' || !order) return <section className="card error" role="alert">
    {actionError ?? 'Falha ao carregar pedido.'} <button type="button" onClick={load}>Tentar novamente</button>
  </section>;

  const action = nextAction(order, entregadores);
  const steps = progressSteps(order);
  const currentStepIndex = steps.findIndex((step) => step.phase === 'current');
  const nextStep = steps.find((step) => step.phase === 'upcoming');
  return <section className="order-detail">
    <div className="page-intro">
      <section className="card order-detail-summary" aria-labelledby="order-detail-identification-heading">
        <div className="order-detail-summary-primary">
          <h1 id="order-detail-identification-heading">Pedido {order.identificadorNegocio}</h1>
          <p><span className="badge badge-muted">{statusLabel[order.statusAtual]}</span>
            {' · '}{order.modalidade === 'ENTREGA' ? 'Delivery' : 'Retirada'}</p>
        </div>
        <p className="order-detail-summary-payment">Pagamento confirmado: {formatDate(order.confirmacaoPagamento)}</p>
      </section>
      {order.modalidade === 'ENTREGA' && order.statusAtual === 'EM_PREPARO' &&
        <label htmlFor="delivery-driver">Entregador
          <select id="delivery-driver" value={entregadorUsuarioId}
            onChange={(event) => setEntregadorUsuarioId(event.target.value)}
            disabled={loadingEntregadores || submitting || confirming !== null}>
            <option value="">Selecione um entregador</option>
            {entregadores.map((entregador) => <option key={entregador.id} value={entregador.id}>{entregador.nome}</option>)}
          </select>
        </label>}
      {loadingEntregadores && <p role="status">Carregando entregadores...</p>}
      {entregadoresError && <div role="alert"><p>Não foi possível carregar os entregadores.</p>
        <button type="button" onClick={loadEntregadores} disabled={loadingEntregadores}>
          Tentar carregar novamente
        </button>
      </div>}
      {!loadingEntregadores && !entregadoresError && order.modalidade === 'ENTREGA' &&
        order.statusAtual === 'EM_PREPARO' && entregadores.length === 0 &&
        <p>Nenhum entregador cadastrado.</p>}
      {actionError && <p className="error" role="alert">{actionError}</p>}
    </div>
    <section className="card order-progress" aria-labelledby="order-progress-heading">
      <div className="order-progress-heading">
        <h2 id="order-progress-heading">Operação e próxima etapa</h2>
        <span>Etapa {currentStepIndex + 1} de {steps.length}</span>
      </div>
      <div className="order-progress-scroll" role="region" tabIndex={0}
        aria-label="Etapas do pedido. Use as setas esquerda e direita para navegar."
        onKeyDown={(event) => {
          const direction = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
          if (!direction || event.currentTarget.scrollWidth <= event.currentTarget.clientWidth) return;
          event.preventDefault();
          const distance = Math.max(1, Math.floor(event.currentTarget.clientWidth * 0.8));
          const maxScroll = event.currentTarget.scrollWidth - event.currentTarget.clientWidth;
          event.currentTarget.scrollLeft = Math.max(0, Math.min(maxScroll,
            event.currentTarget.scrollLeft + direction * distance));
        }}>
        <ol className="order-progress-steps" aria-label="Etapas do pedido">
          {steps.map(({ status, phase }, index) => {
          const next = phase === 'upcoming' && status === nextStep?.status;
          const phaseText = phase === 'completed' ? 'Concluída' : phase === 'current' ? 'Atual'
            : next ? 'Próxima' : 'Pendente';
          return <li key={status} className={`order-progress-step is-${phase}`}
          aria-label={`Etapa ${phaseText.toLocaleLowerCase('pt-BR')}: ${statusLabel[status]}`}
          aria-current={phase === 'current' ? 'step' : undefined}>
          <span className="order-progress-marker" aria-hidden="true">{phase === 'completed' ? '✓' : index + 1}</span>
          <span className="order-progress-step-copy">
            <span>{phaseText}</span>
            <strong>{statusLabel[status]}</strong>
          </span>
        </li>;
          })}
        </ol>
      </div>
      {nextStep && <div className="order-progress-next">
        <div><span>Próxima etapa</span><strong>{statusLabel[nextStep.status]}</strong></div>
        {action && <button ref={actionButton} type="button" disabled={submitting || confirming !== null ||
          (action === 'saiu-para-entrega' && !entregadorUsuarioId)}
          onClick={() => { setActionError(null); setConfirming(action); }}>{actions[action].label}</button>}
      </div>}
    </section>
    {confirming && action === confirming && <section className="card" aria-labelledby="confirm-order-heading"
      aria-describedby="confirm-order-description" aria-busy={submitting}>
      <h2 id="confirm-order-heading" ref={confirmationHeading} tabIndex={-1}>
        {actions[confirming].confirmation}
      </h2>
      <p id="confirm-order-description">O pedido {order.identificadorNegocio} passará de
        {' '}{statusLabel[order.statusAtual]} para {statusLabel[actions[confirming].target]}.
        {confirming === 'saiu-para-entrega' && ` Entregador: ${entregadores.find((item) =>
          item.id === entregadorUsuarioId)?.nome ?? ''}.`}</p>
      <div className="actions">
        <button type="button" className="secondary" disabled={submitting} onClick={() => {
          returnFocus.current = true; setConfirming(null);
        }}>Voltar sem alterar</button>
        <button type="button" disabled={submitting} onClick={() => void submitAction(confirming)}>
          {submitting ? 'Salvando alteração...' : actions[confirming].confirmation}
        </button>
      </div>
      {submitting && <p role="status">Atualizando pedido...</p>}
    </section>}
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
          {order.entregador && <p>Entregador: {order.entregador.nome}</p>}
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
