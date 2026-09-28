import { render,screen } from '@testing-library/react';import userEvent from '@testing-library/user-event';
import ProductPersonalizations from '@/components/ProductPersonalizations';import { adminApi } from '@/lib/client/admin-api';
jest.mock('@/lib/client/admin-api',()=>{const real=jest.requireActual('@/lib/client/admin-api');return {...real,adminApi:jest.fn()};});const mock=adminApi as jest.Mock;
test('lista vínculo indisponível e permite desvincular',async()=>{
 const user=userEvent.setup();const item={id:'2',nome:'Cobertura',descricao:null,disponibilidade:false,ajusteValor:'2.50'};
 mock.mockImplementation((path:string,options?:RequestInit)=>options?.method==='DELETE'?Promise.resolve():Promise.resolve([item]));
 render(<ProductPersonalizations id="1"/>);expect(await screen.findByText(/Cobertura/)).toBeInTheDocument();expect(screen.getAllByText(/Indisponível/).length).toBeGreaterThan(0);
 await user.click(screen.getByRole('button',{name:'Desvincular Cobertura'}));expect(mock).toHaveBeenCalledWith('/api/admin/produtos/1/personalizacoes/2',{method:'DELETE'});
});
test('vincula personalização disponível e mostra 409 da API',async()=>{
 const user=userEvent.setup();const item={id:'2',nome:'Granulado',descricao:null,disponibilidade:true,ajusteValor:null};
 mock.mockReset().mockImplementation((path:string,options?:RequestInit)=>options?.method==='POST'?Promise.reject(new Error('Conflito')):Promise.resolve(path.endsWith('/personalizacoes')&&path.includes('/produtos/')?[]:[item]));
 render(<ProductPersonalizations id="1"/>);await screen.findByRole('option',{name:/Granulado/});await user.selectOptions(screen.getByLabelText('Vincular personalização'),'2');await user.click(screen.getByRole('button',{name:'Vincular'}));
 expect(mock.mock.calls.find(c=>c[1]?.method==='POST')[1].body).toBe('{"personalizacaoId":"2"}');expect(await screen.findByText('Conflito')).toBeInTheDocument();
});
