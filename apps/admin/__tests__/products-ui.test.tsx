import { render, screen, waitFor } from '@testing-library/react';
import ProductList from '@/components/ProductList';
import { adminApi } from '@/lib/client/admin-api';
jest.mock('@/lib/client/admin-api',()=>({adminApi:jest.fn()}));
const mock=adminApi as jest.Mock;
const product={id:'1',categoriaId:'2',nome:'Cupcake',descricao:null,precoAtual:'9.90',ativo:false,imagem:null};
afterEach(()=>mock.mockReset());
test('loading, vazio e produtos com categoria, status e imagem',async()=>{
 let resolve!: (value:unknown)=>void;mock.mockImplementation((path:string)=>path.endsWith('categorias')?Promise.resolve([{id:'2',nome:'Doces',descricao:null}]):new Promise(r=>{resolve=r;}));
 const view=render(<ProductList/>);expect(screen.getByText('Carregando produtos...')).toBeInTheDocument();
 resolve([]);expect(await screen.findByText('Nenhum produto cadastrado.')).toBeInTheDocument();view.unmount();
 mock.mockImplementation((path:string)=>Promise.resolve(path.endsWith('categorias')?[{id:'2',nome:'Doces',descricao:null}]:[product]));
 render(<ProductList/>);expect(await screen.findByText('Cupcake')).toBeInTheDocument();expect(screen.getByText('Doces')).toBeInTheDocument();expect(screen.getByText('Inativo')).toBeInTheDocument();expect(screen.getByText('Sem imagem')).toBeInTheDocument();
});
test('falha de categorias mantém produtos visíveis',async()=>{
 mock.mockImplementation((path:string)=>path.endsWith('categorias')?Promise.reject(new Error('offline')):Promise.resolve([product]));
 render(<ProductList/>);expect(await screen.findByText('Cupcake')).toBeInTheDocument();await waitFor(()=>expect(screen.getAllByText('Categoria indisponível').length).toBeGreaterThan(0));
});
test('erro da lista permite tentar novamente',async()=>{
 mock.mockImplementation((path:string)=>path.endsWith('categorias')?Promise.resolve([]):Promise.reject(new Error('Falha de rede')));
 render(<ProductList/>);expect(await screen.findByText('Falha de rede')).toBeInTheDocument();expect(screen.getByRole('button',{name:'Tentar novamente'})).toBeInTheDocument();
});
