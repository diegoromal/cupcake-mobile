'use client';
import { useCallback, useEffect, useState } from 'react';
import { adminApi } from '@/lib/client/admin-api';
import type { Estoque, MovimentacaoEstoque } from '@/lib/contracts';

export default function ProductStock({ id }: { id: string }) {
  const [saldo, setSaldo] = useState<Estoque | null>(null);
  const [historico, setHistorico] = useState<MovimentacaoEstoque[] | null>(null);
  const [alvo, setAlvo] = useState('');
  const [erro, setErro] = useState('');
  const [erroHistorico, setErroHistorico] = useState('');
  const [aviso, setAviso] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [recarregandoHistorico, setRecarregandoHistorico] = useState(false);
  const base = `/api/admin/produtos/${id}/estoque`;

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro('');
    setErroHistorico('');
    try {
      const [novoSaldo, novasMovimentacoes] = await Promise.all([
        adminApi<Estoque>(base), adminApi<MovimentacaoEstoque[]>(`${base}/movimentacoes`),
      ]);
      setSaldo(novoSaldo);
      setHistorico(novasMovimentacoes);
      setAlvo(String(novoSaldo.quantidadeDisponivel));
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Falha ao carregar estoque.');
    } finally { setCarregando(false); }
  }, [base]);

  useEffect(() => { void carregar(); }, [carregar]);

  async function recarregarHistorico() {
    setRecarregandoHistorico(true);
    try {
      setHistorico(await adminApi<MovimentacaoEstoque[]>(`${base}/movimentacoes`));
      setErroHistorico('');
    } catch {
      setErroHistorico('O histórico exibido pode estar desatualizado.');
    } finally { setRecarregandoHistorico(false); }
  }

  async function salvar(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (salvando || recarregandoHistorico) return;
    setErro(''); setAviso('');
    if (!/^(0|[1-9]\d*)$/.test(alvo) || !Number.isSafeInteger(Number(alvo)) || Number(alvo) > 2147483647) {
      setErro('Informe uma quantidade disponível inteira e não negativa.');
      return;
    }
    setSalvando(true);
    try {
      const novoSaldo = await adminApi<Estoque>(base, {
        method: 'PATCH', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ quantidadeDisponivel: Number(alvo) }),
      });
      setSaldo(novoSaldo);
      setAlvo(String(novoSaldo.quantidadeDisponivel));
      setAviso('Ajuste salvo.');
      await recarregarHistorico();
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Falha ao ajustar estoque.');
    } finally { setSalvando(false); }
  }

  return <section className="card stack" aria-labelledby="estoque-titulo">
    <h2 id="estoque-titulo">Estoque</h2>
    {carregando && <p role="status">Carregando estoque...</p>}
    {erro && <p role="alert" className="error">{erro} {!saldo && <button type="button" onClick={() => void carregar()}>Tentar novamente</button>}</p>}
    {saldo && <>
      <p>Físico: {saldo.quantidadeFisica} · Reservado: {saldo.quantidadeReservada} · Disponível: {saldo.quantidadeDisponivel}</p>
      <form className="form" onSubmit={salvar}>
        <label htmlFor="quantidade-disponivel">Quantidade disponível</label>
        <input id="quantidade-disponivel" type="number" min="0" max="2147483647" step="1" required value={alvo} onChange={event => setAlvo(event.target.value)} disabled={salvando || recarregandoHistorico}/>
        <button type="submit" disabled={salvando || recarregandoHistorico}>{salvando ? 'Salvando...' : 'Ajustar estoque'}</button>
      </form>
      {aviso && <p role="status" className="notice">{aviso}</p>}
    </>}
    <h3>Histórico de movimentações</h3>
    {erroHistorico && <p role="alert" className="error">{erroHistorico} <button type="button" disabled={recarregandoHistorico || salvando} onClick={() => void recarregarHistorico()}>{recarregandoHistorico ? 'Recarregando...' : 'Recarregar histórico'}</button></p>}
    {historico?.length === 0 && <p>Nenhuma movimentação registrada.</p>}
    {historico && historico.length > 0 && <div className="table-wrap"><table><thead><tr><th>Data</th><th>Quantidade</th><th>Motivo</th></tr></thead><tbody>
      {historico.map(item => <tr key={item.id}><td>{new Date(item.data).toLocaleString('pt-BR')}</td><td>{item.quantidade > 0 ? `+${item.quantidade}` : item.quantidade}</td><td>{item.motivoOrigem === 'AJUSTE_ADMINISTRATIVO' ? 'Ajuste administrativo' : item.motivoOrigem}</td></tr>)}
    </tbody></table></div>}
  </section>;
}
