'use client';
import { useState } from 'react';
import { AdminApiError, adminApi } from '@/lib/client/admin-api';

type ReportOrder = {
  id: string;
  identificadorNegocio: string;
  data: string;
  cliente: string;
  modalidade: 'ENTREGA' | 'RETIRADA';
  statusAtual: 'ENTREGUE' | 'RETIRADO';
  total: string;
};
type SalesReportResult = {
  inicio: string;
  fim: string;
  totalVendido: string;
  quantidadePedidos: number;
  pedidos: ReportOrder[];
};

const integer = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
function formatCurrency(value: string) {
  const [whole, fraction = '00'] = value.split('.');
  return `R$\u00a0${integer.format(BigInt(whole))},${fraction.padEnd(2, '0')}`;
}
const dateTime = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' });
const statusLabel = { ENTREGUE: 'Entregue', RETIRADO: 'Retirado' } as const;
function isSalesReport(value: unknown): value is SalesReportResult {
  if (typeof value !== 'object' || value === null) return false;
  const report = value as Partial<SalesReportResult>;
  return typeof report.inicio === 'string' && typeof report.fim === 'string' &&
    typeof report.totalVendido === 'string' && /^\d+(?:\.\d{2})$/.test(report.totalVendido) &&
    Number.isInteger(report.quantidadePedidos) && Array.isArray(report.pedidos) &&
    report.pedidos.every(order => typeof order.id === 'string' &&
      typeof order.identificadorNegocio === 'string' && typeof order.data === 'string' &&
      !Number.isNaN(Date.parse(order.data)) && typeof order.cliente === 'string' &&
      (order.modalidade === 'ENTREGA' || order.modalidade === 'RETIRADA') &&
      (order.statusAtual === 'ENTREGUE' || order.statusAtual === 'RETIRADO') &&
      typeof order.total === 'string' && /^\d+(?:\.\d{2})$/.test(order.total));
}

export default function SalesReport() {
  const [inicio, setInicio] = useState('');
  const [fim, setFim] = useState('');
  const [report, setReport] = useState<SalesReportResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const invalidPeriod = Boolean(error) && (!inicio || !fim || inicio > fim);

  async function applyPeriod(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!inicio || !fim || inicio > fim) {
      setError('Informe um período válido: a data inicial deve ser anterior ou igual à data final.');
      setReport(null);
      return;
    }
    setBusy(true);
    setError('');
    setReport(null);
    try {
      const query = new URLSearchParams({ inicio, fim });
      const result: unknown = await adminApi(`/api/admin/relatorios/vendas?${query}`);
      if (!isSalesReport(result)) throw new Error('Resposta inválida da API.');
      setReport(result);
    } catch (cause) {
      setError(cause instanceof AdminApiError && cause.status === 403
        ? 'Acesso negado. Apenas administradores podem consultar o relatório.'
        : cause instanceof Error ? cause.message : 'Falha ao carregar o relatório.');
    } finally {
      setBusy(false);
    }
  }

  function exportPdf() {
    if (!report || exporting) return;
    setExporting(true);
    window.setTimeout(() => {
      try {
        window.print();
      } catch {
        setError('Não foi possível preparar o PDF. Tente novamente.');
      } finally {
        setExporting(false);
      }
    }, 0);
  }

  return <section className="sales-report">
    <div className="heading"><div><h1>Relatório de vendas</h1><p>Consulte pedidos entregues e retirados por período.</p></div></div>
    <form className="card report-filters" onSubmit={applyPeriod} noValidate aria-busy={busy}>
      <div><label htmlFor="report-start">Data inicial</label><input id="report-start" type="date" required value={inicio} disabled={busy} aria-invalid={invalidPeriod && (!inicio || inicio > fim)} aria-describedby={invalidPeriod ? 'report-error' : undefined} onChange={event => setInicio(event.target.value)} /></div>
      <div><label htmlFor="report-end">Data final</label><input id="report-end" type="date" required value={fim} disabled={busy} aria-invalid={invalidPeriod && (!fim || inicio > fim)} aria-describedby={invalidPeriod ? 'report-error' : undefined} onChange={event => setFim(event.target.value)} /></div>
      <button type="submit" disabled={busy}>{busy ? 'Consultando…' : 'Aplicar período'}</button>
    </form>
    {error && <p id="report-error" className="error" role="alert">{error}</p>}
    {busy && <p role="status">Carregando relatório…</p>}
    {report && <>
      <p className="applied-period">Período aplicado: <time dateTime={report.inicio}>{report.inicio}</time> a <time dateTime={report.fim}>{report.fim}</time></p>
      <div className="report-summary">
        <article className="card"><h2>Total vendido</h2><p>{formatCurrency(report.totalVendido)}</p></article>
        <article className="card"><h2>Quantidade de pedidos</h2><p>{report.quantidadePedidos}</p></article>
      </div>
      <div className="report-export">
        <button type="button" onClick={exportPdf} disabled={exporting}>
          {exporting ? 'Preparando PDF…' : 'Exportar PDF'}
        </button>
        {exporting && <p role="status">Preparando o relatório para salvar como PDF…</p>}
      </div>
      <h2>Pedidos do período</h2>
      {report.pedidos.length === 0 ? <div className="card">Nenhum pedido finalizado encontrado neste período.</div> :
        <div className="card table-wrap"><table>
          <thead><tr><th scope="col">Pedido</th><th scope="col">Data e hora</th><th scope="col">Cliente</th><th scope="col">Modalidade</th><th scope="col">Status</th><th scope="col">Valor total</th></tr></thead>
          <tbody>{report.pedidos.map(order => <tr key={order.id}>
            <td><strong>{order.identificadorNegocio}</strong></td>
            <td><time dateTime={order.data}>{dateTime.format(new Date(order.data))}</time></td>
            <td>{order.cliente}</td>
            <td>{order.modalidade === 'ENTREGA' ? 'Delivery' : 'Retirada'}</td>
            <td><span className="badge badge-muted">{statusLabel[order.statusAtual]}</span></td>
            <td>{formatCurrency(order.total)}</td>
          </tr>)}</tbody>
        </table></div>}
    </>}
  </section>;
}
