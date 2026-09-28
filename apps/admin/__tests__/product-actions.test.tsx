import { render,screen,waitFor } from '@testing-library/react';import userEvent from '@testing-library/user-event';
import ProductForm from '@/components/ProductForm';import DeleteProductButton from '@/components/DeleteProductButton';
import { adminApi,AdminApiError } from '@/lib/client/admin-api';
jest.mock('@/lib/client/admin-api',()=>{const real=jest.requireActual('@/lib/client/admin-api');return {...real,adminApi:jest.fn()};});
const push=jest.fn();jest.mock('next/navigation',()=>({useRouter:()=>({push,replace:jest.fn()})}));
const mock=adminApi as jest.Mock;const category='11111111-1111-4111-8111-111111111111';
const product={id:'p1',categoriaId:category,nome:'Cupcake',descricao:null,precoAtual:'9.90',imagem:null,ativo:true};
beforeEach(()=>{mock.mockReset();push.mockReset();});
test('criação valida e envia somente contrato de Produto com preço string',async()=>{
 const user=userEvent.setup();mock.mockImplementation((path:string)=>path.endsWith('categorias')?Promise.resolve([{id:category,nome:'Doces',descricao:null}]):Promise.resolve({...product,id:'created'}));
 render(<ProductForm/>);await screen.findByRole('option',{name:'Doces'});await user.click(screen.getByRole('button',{name:'Criar produto'}));expect(screen.getByText('Corrija os campos indicados.')).toBeInTheDocument();
 await user.selectOptions(screen.getByLabelText('Categoria'),'11111111-1111-4111-8111-111111111111');await user.type(screen.getByLabelText('Nome'),'Cupcake');await user.type(screen.getByLabelText(/Preço atual/),'12.34');await user.click(screen.getByRole('button',{name:'Criar produto'}));
 await waitFor(()=>expect(push).toHaveBeenCalledWith('/produtos/created'));
 const payload=JSON.parse(mock.mock.calls.find(c=>c[1]?.method==='POST')[1].body);
 expect(payload).toEqual({categoriaId:category,nome:'Cupcake',descricao:null,precoAtual:'12.34',ativo:true});
});
test('edição PATCH parcial inclui ativo e categoria removida bloqueia envio',async()=>{
 const user=userEvent.setup();mock.mockImplementation((path:string)=>path.endsWith('categorias')?Promise.resolve([{id:category,nome:'Doces',descricao:null}]):Promise.resolve({...product,ativo:false}));
 const view=render(<ProductForm product={product}/>);await screen.findByRole('option',{name:'Doces'});await user.click(screen.getByLabelText('Ativo'));await user.click(screen.getByRole('button',{name:'Salvar alterações'}));
 await waitFor(()=>expect(mock.mock.calls.some(c=>c[1]?.method==='PATCH')).toBe(true));expect(JSON.parse(mock.mock.calls.find(c=>c[1]?.method==='PATCH')[1].body)).toEqual({ativo:false});view.unmount();
 mock.mockReset().mockResolvedValue([]);render(<ProductForm product={product}/>);expect(await screen.findByText(/categoria deste produto não está mais disponível/)).toBeInTheDocument();await user.click(screen.getByRole('button',{name:'Salvar alterações'}));expect(mock.mock.calls.some(c=>c[1]?.method==='PATCH')).toBe(false);
});
test('exclusão exige nome, retorna lista em 204 e explica 409',async()=>{
 const user=userEvent.setup();mock.mockRejectedValueOnce(new AdminApiError(409,'Conflito'));
 render(<DeleteProductButton id="p1" name="Cupcake"/>);await user.click(screen.getByRole('button',{name:'Excluir produto'}));
 expect(screen.getByRole('button',{name:'Confirmar exclusão'})).toBeDisabled();await user.type(screen.getByLabelText('Nome do produto'),'Cupcake');await user.click(screen.getByRole('button',{name:'Confirmar exclusão'}));expect(await screen.findByText(/Mantenha ou desative/)).toBeInTheDocument();
 mock.mockResolvedValueOnce(undefined);await user.click(screen.getByRole('button',{name:'Confirmar exclusão'}));await waitFor(()=>expect(push).toHaveBeenCalledWith('/produtos'));
});
test.each([[404,'Produto não existe mais.'],[500,'Falha interna']])('exclusão mantém página em erro %i',async(status,message)=>{
 const user=userEvent.setup();mock.mockRejectedValue(new AdminApiError(status,message));render(<DeleteProductButton id="p1" name="Cupcake"/>);
 await user.click(screen.getByRole('button',{name:'Excluir produto'}));await user.type(screen.getByLabelText('Nome do produto'),'Cupcake');await user.click(screen.getByRole('button',{name:'Confirmar exclusão'}));
 expect(await screen.findByText(message)).toBeInTheDocument();expect(push).not.toHaveBeenCalled();expect(screen.getByRole('button',{name:'Confirmar exclusão'})).toBeEnabled();
});
test('edição 404 informa categoria ou produto removido e mantém formulário',async()=>{
 const user=userEvent.setup();mock.mockImplementation((path:string,options?:RequestInit)=>options?.method==='PATCH'?Promise.reject(new AdminApiError(404,'Não encontrado')):Promise.resolve([{id:category,nome:'Doces',descricao:null}]));
 render(<ProductForm product={product}/>);await screen.findByRole('option',{name:'Doces'});await user.click(screen.getByLabelText('Ativo'));await user.click(screen.getByRole('button',{name:'Salvar alterações'}));
 expect(await screen.findByText(/Produto ou categoria não encontrado/)).toBeInTheDocument();expect(screen.getByLabelText('Nome')).toHaveValue('Cupcake');
});
