import { fireEvent, render, screen } from '@testing-library/react';
import { adminApi, AdminApiError } from '@/lib/client/admin-api';
import CategoryForm from '@/components/CategoryForm';
import PersonalizationForm from '@/components/PersonalizationForm';

jest.mock('next/navigation',()=>({useRouter:()=>({push:jest.fn()})}));
const originalFetch=global.fetch;
afterEach(()=>{global.fetch=originalFetch;});
function rejectWith(message: unknown) {
 global.fetch=jest.fn().mockResolvedValue({ok:false,status:400,json:async()=>({statusCode:400,message})} as Response);
}

test('adminApi preserva message string e transforma array Nest em texto seguro',async()=>{
 rejectWith('  Nome inválido  ');
 await expect(adminApi('/api/admin/categorias')).rejects.toMatchObject({status:400,message:'Nome inválido',detail:true});
 rejectWith(['nome should not be empty',{},null,' ',42,'ajusteValor must match ...']);
 await expect(adminApi('/api/admin/personalizacoes')).rejects.toMatchObject({status:400,message:'nome should not be empty; ajusteValor must match ...',detail:true});
});

test('adminApi usa fallback quando o array não contém strings úteis',async()=>{
 rejectWith([{},null,42,'  ']);
 await expect(adminApi('/api/admin/categorias')).rejects.toMatchObject({status:400,message:'API respondeu 400.',detail:false});
 rejectWith({internal:'error'});
 await expect(adminApi('/api/admin/categorias')).rejects.toBeInstanceOf(AdminApiError);
});

test('Categoria mostra detalhe 400 de array Nest sem objetos',async()=>{
 rejectWith(['nome should not be empty',{},'ajusteValor must match ...']);
 render(<CategoryForm category={{id:'c1',nome:'Doces',descricao:null}}/>);
 fireEvent.change(screen.getByLabelText('Nome'),{target:{value:'Novo nome'}});fireEvent.click(screen.getByRole('button',{name:'Salvar alterações'}));
 const alert=await screen.findByRole('alert');expect(alert).toHaveTextContent('Dados inválidos: nome should not be empty; ajusteValor must match ...');expect(alert).not.toHaveTextContent('[object Object]');
});

test('Personalização mostra detalhe 400 e mantém fallback genérico',async()=>{
 rejectWith(['nome should not be empty',{},'ajusteValor must match ...']);
 const item={id:'p1',nome:'Cobertura',descricao:null,disponibilidade:true,ajusteValor:'0.00'};
 const view=render(<PersonalizationForm personalization={item}/>);
 fireEvent.change(screen.getByLabelText('Nome'),{target:{value:'Novo nome'}});fireEvent.click(screen.getByRole('button',{name:'Salvar alterações'}));
 const alert=await screen.findByRole('alert');expect(alert).toHaveTextContent('Dados inválidos: nome should not be empty; ajusteValor must match ...');expect(alert).not.toHaveTextContent('[object Object]');
 view.unmount();rejectWith([{},' ']);render(<PersonalizationForm personalization={item}/>);
 fireEvent.change(screen.getByLabelText('Nome'),{target:{value:'Novo nome'}});fireEvent.click(screen.getByRole('button',{name:'Salvar alterações'}));
 expect(await screen.findByRole('alert')).toHaveTextContent('Dados inválidos. Confira os campos.');
});
