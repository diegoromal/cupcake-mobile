import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ConfiguracaoLojaEntregaForm from '@/components/ConfiguracaoLojaEntregaForm';
import { AdminApiError, adminApi } from '@/lib/client/admin-api';

jest.mock('@/lib/client/admin-api',()=>({ adminApi:jest.fn(),AdminApiError:class AdminApiError extends Error { constructor(public status:number,message:string){super(message);} } }));
const mocked=adminApi as jest.Mock;
const config={latitudeLoja:'-25.000000',longitudeLoja:'-49.000000',raioMaximoAtendimento:'10.000',taxaBase:'5.00',valorPorQuilometro:'2.00'};
beforeEach(()=>mocked.mockReset());

test('carrega configuração, valida precisão e envia PUT completo',async()=>{
  mocked.mockResolvedValueOnce(config).mockResolvedValueOnce({...config,taxaBase:'6.00'});
  render(<ConfiguracaoLojaEntregaForm/>);
  expect(await screen.findByDisplayValue('-25.000000')).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Taxa base (R$)'),{target:{value:'1.234'}});
  fireEvent.click(screen.getByRole('button',{name:'Salvar configuração'}));
  expect(await screen.findByRole('alert')).toHaveTextContent('Confira os valores');
  expect(mocked).toHaveBeenCalledTimes(1);
  fireEvent.change(screen.getByLabelText('Taxa base (R$)'),{target:{value:'6.00'}});
  fireEvent.click(screen.getByRole('button',{name:'Salvar configuração'}));
  await waitFor(()=>expect(screen.getByRole('status')).toHaveTextContent('Configuração salva.'));
  expect(mocked.mock.calls[1][1].method).toBe('PUT');
  expect(JSON.parse(mocked.mock.calls[1][1].body)).toEqual({...config,taxaBase:'6.00'});
});

test('404 oferece configuração inicial e erro de rede preserva os valores',async()=>{
  mocked.mockRejectedValueOnce(new AdminApiError(404,'não encontrado')).mockRejectedValueOnce(new Error('Falha de rede'));
  render(<ConfiguracaoLojaEntregaForm/>);
  expect(await screen.findByText('Nenhuma configuração cadastrada.')).toBeInTheDocument();
  for(const [label,value] of [['Latitude da loja','0'],['Longitude da loja','0'],['Raio máximo (km)','0'],['Taxa base (R$)','0'],['Valor por km (R$)','0']]){
    fireEvent.change(screen.getByLabelText(label),{target:{value}});
  }
  fireEvent.click(screen.getByRole('button',{name:'Salvar configuração'}));
  expect(await screen.findByRole('alert')).toHaveTextContent('Falha de rede');
  expect(screen.getByLabelText('Taxa base (R$)')).toHaveValue('0');
});

test('resposta inválida fica como erro, sem confirmar sucesso',async()=>{
  mocked.mockResolvedValueOnce({bad:true});
  render(<ConfiguracaoLojaEntregaForm/>);
  expect(await screen.findByRole('alert')).toHaveTextContent('Resposta inválida da API.');
});
