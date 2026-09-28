import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import CategoryList from '@/components/CategoryList';import CategoryForm from '@/components/CategoryForm';import CategoryDetail from '@/components/CategoryDetail';
import { adminApi, AdminApiError } from '@/lib/client/admin-api';
const push=jest.fn();jest.mock('next/navigation',()=>({useRouter:()=>({push})}));jest.mock('@/lib/client/admin-api',()=>({adminApi:jest.fn(),AdminApiError:class extends Error{constructor(public status:number,message:string){super(message);}}}));
const mock=adminApi as jest.Mock;const item={id:'11111111-1111-4111-8111-111111111111',nome:'Doces',descricao:null};
afterEach(()=>{mock.mockReset();push.mockReset();});
test('lista: loading, vazio, dados, erro e retry',async()=>{
 let resolve!:(value:unknown)=>void;mock.mockImplementationOnce(()=>new Promise(r=>resolve=r));const view=render(<CategoryList/>);expect(screen.getByRole('status')).toHaveTextContent('Carregando');resolve([]);expect(await screen.findByText('Nenhuma categoria cadastrada.')).toBeInTheDocument();view.unmount();
 mock.mockResolvedValueOnce([item]);render(<CategoryList/>);expect(await screen.findByRole('link',{name:'Abrir Doces — 11111111'})).toHaveAttribute('href',`/categorias/${item.id}`);
});
test('categorias com mesmo nome mostram IDs distintos em texto e links acessíveis',async()=>{
 const second={...item,id:'f8e7d6c5-2222-4222-8222-222222222222'};mock.mockResolvedValueOnce([item,second]);render(<CategoryList/>);
 const firstLink=await screen.findByRole('link',{name:'Abrir Doces — 11111111'});const secondLink=screen.getByRole('link',{name:'Abrir Doces — f8e7d6c5'});
 expect(firstLink).toHaveAttribute('href',`/categorias/${item.id}`);expect(secondLink).toHaveAttribute('href',`/categorias/${second.id}`);
 expect(screen.getByText('11111111')).toBeInTheDocument();expect(screen.getByText('f8e7d6c5')).toBeInTheDocument();expect(screen.getAllByRole('link',{name:/Abrir Doces/})).toHaveLength(2);
});
test('erro de rede permite retry',async()=>{mock.mockRejectedValueOnce(new Error('Falha de rede')).mockResolvedValueOnce([]);render(<CategoryList/>);expect(await screen.findByRole('alert')).toHaveTextContent('Falha de rede');fireEvent.click(screen.getByRole('button',{name:'Tentar novamente'}));expect(await screen.findByText('Nenhuma categoria cadastrada.')).toBeInTheDocument();});
test('criação valida foco no resumo, mantém erro associado, trim, null e trava submits simultâneos',async()=>{
 let resolve!:(value:unknown)=>void;mock.mockImplementation(()=>new Promise(r=>resolve=r));render(<CategoryForm/>);fireEvent.click(screen.getByRole('button',{name:'Criar categoria'}));const summary=screen.getByRole('alert');const name=screen.getByLabelText('Nome');expect(summary).toHaveFocus();expect(summary).toHaveAttribute('tabindex','-1');expect(name).toHaveAttribute('aria-invalid','true');expect(name).toHaveAttribute('aria-describedby','category-name-error');expect(screen.getByText('Informe o nome.')).toHaveAttribute('id','category-name-error');
 fireEvent.change(screen.getByLabelText('Nome'),{target:{value:'  Doces  '}});fireEvent.submit(screen.getByRole('button',{name:'Criar categoria'}).closest('form')!);fireEvent.submit(screen.getByRole('button',{name:'Salvando...'}).closest('form')!);expect(mock).toHaveBeenCalledTimes(1);expect(JSON.parse(mock.mock.calls[0][1].body)).toEqual({nome:'Doces',descricao:null});resolve(item);await waitFor(()=>expect(push).toHaveBeenCalledWith(`/categorias/${item.id}`));
});
test('edição PATCH parcial, PATCH vazio e 400/403/404/409',async()=>{
 const view=render(<CategoryForm category={item}/>);fireEvent.click(screen.getByRole('button',{name:'Salvar alterações'}));expect(screen.getByRole('status')).toHaveTextContent('Nenhuma alteração');expect(mock).not.toHaveBeenCalled();view.unmount();
 for(const status of [400,403,404,409]){mock.mockRejectedValueOnce(new AdminApiError(status,'upstream'));const v=render(<CategoryForm category={item}/>);fireEvent.change(screen.getByLabelText('Descrição (opcional)'),{target:{value:'Nova'}});fireEvent.click(screen.getByRole('button',{name:'Salvar alterações'}));await screen.findByRole('alert');expect(JSON.parse(mock.mock.lastCall![1].body)).toEqual({descricao:'Nova'});v.unmount();}
});
test('troca de ID ignora resposta antiga',async()=>{
 let old!:(value:unknown)=>void;mock.mockImplementation((path:string)=>path.endsWith(item.id)?new Promise(r=>old=r):Promise.resolve({...item,id:'22222222-2222-4222-8222-222222222222',nome:'Novo'}));
 const view=render(<CategoryDetail id={item.id}/>);view.rerender(<CategoryDetail id="22222222-2222-4222-8222-222222222222"/>);expect(await screen.findByRole('heading',{name:'Novo',level:1})).toBeInTheDocument();old(item);await waitFor(()=>expect(screen.getByRole('heading',{name:'Novo',level:1})).toBeInTheDocument());
});
test('detalhe: salvar bloqueia excluir, resposta após desmontar não navega',async()=>{
 let finish!:(value:unknown)=>void;mock.mockImplementation((path:string,options?:RequestInit)=>options?.method==='PATCH'?new Promise(r=>finish=r):Promise.resolve(item));
 const view=render(<CategoryDetail id={item.id}/>);await screen.findByRole('heading',{name:'Editar categoria'});
 fireEvent.click(screen.getByRole('button',{name:'Excluir categoria'}));fireEvent.change(screen.getByLabelText('Nome da categoria'),{target:{value:item.nome}});
 fireEvent.change(screen.getByLabelText('Descrição (opcional)'),{target:{value:'Nova'}});fireEvent.click(screen.getByRole('button',{name:'Salvar alterações'}));
 expect(screen.getByRole('button',{name:'Excluindo...'})).toBeDisabled();expect(mock).toHaveBeenCalledTimes(2);
 view.unmount();finish({...item,descricao:'Nova'});await Promise.resolve();expect(push).not.toHaveBeenCalled();
});
