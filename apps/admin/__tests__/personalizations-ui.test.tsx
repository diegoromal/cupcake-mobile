import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import PersonalizationList from '@/components/PersonalizationList';import PersonalizationForm from '@/components/PersonalizationForm';import PersonalizationDetail from '@/components/PersonalizationDetail';
import { adminApi, AdminApiError } from '@/lib/client/admin-api';
const push=jest.fn();jest.mock('next/navigation',()=>({useRouter:()=>({push})}));jest.mock('@/lib/client/admin-api',()=>({adminApi:jest.fn(),AdminApiError:class extends Error{constructor(public status:number,message:string){super(message);}}}));
const mock=adminApi as jest.Mock;const item={id:'11111111-1111-4111-8111-111111111111',nome:'Cobertura',descricao:null,disponibilidade:true,ajusteValor:'0.00'};
afterEach(()=>{mock.mockReset();push.mockReset();});
test('lista: loading, vazio, ajuste e retry',async()=>{
 let resolve!:(value:unknown)=>void;mock.mockImplementationOnce(()=>new Promise(r=>resolve=r));const v=render(<PersonalizationList/>);expect(screen.getByRole('status')).toHaveTextContent('Carregando');resolve([]);expect(await screen.findByText('Nenhuma personalização cadastrada.')).toBeInTheDocument();v.unmount();mock.mockResolvedValueOnce([item]);render(<PersonalizationList/>);expect(await screen.findByText('R$ 0,00')).toBeInTheDocument();expect(screen.getByText('Disponível')).toBeInTheDocument();
});
test('criação envia false e decimal string; valida ajuste com foco',async()=>{
 let resolve!:(value:unknown)=>void;mock.mockImplementation(()=>new Promise(r=>resolve=r));render(<PersonalizationForm/>);fireEvent.change(screen.getByLabelText('Nome'),{target:{value:'Cobertura'}});fireEvent.change(screen.getByLabelText('Ajuste de valor (R$)'),{target:{value:'1e2'}});fireEvent.click(screen.getByRole('button',{name:'Criar personalização'}));expect(screen.getByRole('alert')).toHaveFocus();expect(screen.getByLabelText('Ajuste de valor (R$)')).toHaveAttribute('aria-invalid','true');expect(screen.getByLabelText('Ajuste de valor (R$)')).toHaveAttribute('aria-describedby','personalization-adjustment-error');expect(mock).not.toHaveBeenCalled();
 fireEvent.change(screen.getByLabelText('Ajuste de valor (R$)'),{target:{value:'-0.05'}});fireEvent.click(screen.getByLabelText('Disponível'));fireEvent.submit(screen.getByRole('button',{name:'Criar personalização'}).closest('form')!);fireEvent.submit(screen.getByRole('button',{name:'Salvando...'}).closest('form')!);expect(mock).toHaveBeenCalledTimes(1);expect(JSON.parse(mock.mock.calls[0][1].body)).toEqual({nome:'Cobertura',descricao:null,disponibilidade:false,ajusteValor:'-0.05'});resolve(item);await waitFor(()=>expect(push).toHaveBeenCalledWith(`/personalizacoes/${item.id}`));
});
test('edição PATCH parcial, zero para null, vazio e erros HTTP',async()=>{
 const v=render(<PersonalizationForm personalization={item}/>);fireEvent.click(screen.getByRole('button',{name:'Salvar alterações'}));expect(screen.getByRole('status')).toHaveTextContent('Nenhuma alteração');v.unmount();
 mock.mockResolvedValueOnce({...item,ajusteValor:null});const edit=render(<PersonalizationForm personalization={item}/>);fireEvent.change(screen.getByLabelText('Ajuste de valor (R$)'),{target:{value:''}});fireEvent.click(screen.getByRole('button',{name:'Salvar alterações'}));await waitFor(()=>expect(mock).toHaveBeenCalled());expect(JSON.parse(mock.mock.calls[0][1].body)).toEqual({ajusteValor:null});edit.unmount();
 for(const status of [400,403,404,409]){mock.mockRejectedValueOnce(new AdminApiError(status,'upstream'));const instance=render(<PersonalizationForm personalization={item}/>);fireEvent.click(screen.getByLabelText('Disponível'));fireEvent.click(screen.getByRole('button',{name:'Salvar alterações'}));await screen.findByRole('alert');expect(JSON.parse(mock.mock.lastCall![1].body)).toEqual({disponibilidade:false});instance.unmount();}
});
test('troca de ID ignora resposta antiga',async()=>{
 let old!:(value:unknown)=>void;mock.mockImplementation((path:string)=>path.endsWith(item.id)?new Promise(r=>old=r):Promise.resolve({...item,id:'22222222-2222-4222-8222-222222222222',nome:'Novo'}));const view=render(<PersonalizationDetail id={item.id}/>);view.rerender(<PersonalizationDetail id="22222222-2222-4222-8222-222222222222"/>);expect(await screen.findByRole('heading',{name:'Novo',level:1})).toBeInTheDocument();old(item);await waitFor(()=>expect(screen.getByRole('heading',{name:'Novo',level:1})).toBeInTheDocument());
});
test('detalhe: excluir bloqueia salvar e resposta tardia não navega',async()=>{
 let finish!:(value:unknown)=>void;mock.mockImplementation((path:string,options?:RequestInit)=>options?.method==='DELETE'?new Promise(r=>finish=r):Promise.resolve(item));
 const view=render(<PersonalizationDetail id={item.id}/>);await screen.findByRole('heading',{name:'Editar personalização'});
 fireEvent.click(screen.getByRole('button',{name:'Excluir personalização'}));fireEvent.change(screen.getByLabelText('Nome da personalização'),{target:{value:item.nome}});
 fireEvent.click(screen.getByRole('button',{name:'Confirmar exclusão'}));expect(screen.getByRole('button',{name:'Salvando...'})).toBeDisabled();
 fireEvent.submit(screen.getByRole('button',{name:'Salvando...'}).closest('form')!);expect(mock).toHaveBeenCalledTimes(2);
 view.unmount();finish(undefined);await Promise.resolve();expect(push).not.toHaveBeenCalled();
});
