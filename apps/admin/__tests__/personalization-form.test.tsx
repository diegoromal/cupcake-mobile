import { decimalPattern, displayAdjustment, personalizationPayload, validatePersonalization } from '@/lib/personalization-form';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import PersonalizationForm from '@/components/PersonalizationForm';
import { adminApi } from '@/lib/client/admin-api';
const push=jest.fn();jest.mock('next/navigation',()=>({useRouter:()=>({push})}));jest.mock('@/lib/client/admin-api',()=>({adminApi:jest.fn(),AdminApiError:class extends Error{constructor(public status:number,message:string){super(message);}}}));
const mock=adminApi as jest.Mock;
const item={id:'11111111-1111-4111-8111-111111111111',nome:'Cobertura',descricao:null,disponibilidade:true,ajusteValor:'0.00'};
afterEach(()=>{jest.resetAllMocks();});
test('gramática decimal textual completa',()=>{
 for(const value of ['0','0.00','+2.50','-0.05','000000000001.2','1234567890.12'])expect(decimalPattern.test(value)).toBe(true);
 for(const value of ['1,20','1e2','0.123','12345678901','-','1.',' 2.50'])expect(decimalPattern.test(value)).toBe(false);
 expect(validatePersonalization({nome:' ',descricao:null,disponibilidade:false,ajusteValor:'1e2'})).toEqual({nome:'Informe o nome.',ajusteValor:expect.any(String)});
});
test('payload preserva false, null, zero e PATCH parcial',()=>{
 expect(personalizationPayload({nome:' X ',descricao:'',disponibilidade:false,ajusteValor:'0.00'})).toEqual({nome:'X',descricao:null,disponibilidade:false,ajusteValor:'0.00'});
 const original={nome:'X',descricao:null,disponibilidade:true,ajusteValor:'0.00'};
 expect(personalizationPayload({...original,disponibilidade:false},original)).toEqual({disponibilidade:false});
 expect(personalizationPayload({...original,ajusteValor:''},original)).toEqual({ajusteValor:null});
 expect(personalizationPayload(original,original)).toEqual({});
});
test('exibição distingue null e zero e mantém centavos negativos',()=>{
 expect(displayAdjustment(null)).toBe('Não definido');expect(displayAdjustment('0.00')).toBe('R$ 0,00');expect(displayAdjustment('2.50')).toBe('+ R$ 2,50');expect(displayAdjustment('-0.05')).toBe('− R$ 0,05');
});
test('submit inválido foca resumo anunciável e mantém erros específicos associados',()=>{
 render(<PersonalizationForm/>);fireEvent.change(screen.getByLabelText('Ajuste de valor (R$)'),{target:{value:'1e2'}});fireEvent.click(screen.getByRole('button',{name:'Criar personalização'}));
 const summary=screen.getByRole('alert');const name=screen.getByLabelText('Nome');const adjustment=screen.getByLabelText('Ajuste de valor (R$)');
 expect(summary).toHaveFocus();expect(summary).toHaveAttribute('tabindex','-1');expect(name).toHaveAttribute('aria-invalid','true');expect(name).toHaveAttribute('aria-describedby','personalization-name-error');expect(screen.getByText('Informe o nome.')).toHaveAttribute('id','personalization-name-error');
 expect(adjustment).toHaveAttribute('aria-invalid','true');expect(adjustment).toHaveAttribute('aria-describedby','personalization-adjustment-error');expect(screen.getByText(/Use decimal com ponto/)).toHaveAttribute('id','personalization-adjustment-error');
});
test.each([['+2.50','2.50'],['0','0.00'],['1.2','1.20'],['0001.20','1.20'],['-0.05','-0.05'],['',null]])('save confirma ajuste %s como %s e segundo save não envia PATCH',async (typed,savedAdjustment)=>{
 const onSaved=jest.fn();mock.mockResolvedValueOnce({...item,ajusteValor:savedAdjustment});render(<PersonalizationForm personalization={item} onSaved={onSaved}/>);
 fireEvent.change(screen.getByLabelText('Ajuste de valor (R$)'),{target:{value:typed}});fireEvent.click(screen.getByRole('button',{name:'Salvar alterações'}));
 await waitFor(()=>expect(onSaved).toHaveBeenCalledWith({...item,ajusteValor:savedAdjustment}));
 expect(screen.getByLabelText('Ajuste de valor (R$)')).toHaveValue(savedAdjustment??'');
 expect(JSON.parse(mock.mock.calls[0][1].body)).toEqual({ajusteValor:typed||null});
 fireEvent.click(screen.getByRole('button',{name:'Salvar alterações'}));
 expect(screen.getByRole('status')).toHaveTextContent('Nenhuma alteração para salvar');expect(mock).toHaveBeenCalledTimes(1);
});
test('após normalização, disponibilidade, nome e novo ajuste geram PATCHs independentes',async()=>{
 const onSaved=jest.fn();mock.mockResolvedValueOnce({...item,ajusteValor:'2.50'}).mockResolvedValueOnce({...item,ajusteValor:'2.50',disponibilidade:false}).mockResolvedValueOnce({...item,ajusteValor:'2.50',disponibilidade:false,nome:'Cobertura nova'}).mockResolvedValueOnce({...item,ajusteValor:'3.00',disponibilidade:false,nome:'Cobertura nova'});
 render(<PersonalizationForm personalization={item} onSaved={onSaved}/>);
 fireEvent.change(screen.getByLabelText('Ajuste de valor (R$)'),{target:{value:'+2.50'}});fireEvent.click(screen.getByRole('button',{name:'Salvar alterações'}));await waitFor(()=>expect(screen.getByLabelText('Ajuste de valor (R$)')).toHaveValue('2.50'));
 fireEvent.click(screen.getByLabelText('Disponível'));fireEvent.click(screen.getByRole('button',{name:'Salvar alterações'}));await waitFor(()=>expect(mock).toHaveBeenCalledTimes(2));expect(JSON.parse(mock.mock.calls[1][1].body)).toEqual({disponibilidade:false});
 await waitFor(()=>expect(onSaved).toHaveBeenCalledTimes(2));
 fireEvent.change(screen.getByLabelText('Nome'),{target:{value:'Cobertura nova'}});fireEvent.click(screen.getByRole('button',{name:'Salvar alterações'}));await waitFor(()=>expect(mock).toHaveBeenCalledTimes(3));expect(JSON.parse(mock.mock.calls[2][1].body)).toEqual({nome:'Cobertura nova'});
 await waitFor(()=>expect(onSaved).toHaveBeenCalledTimes(3));
 fireEvent.change(screen.getByLabelText('Ajuste de valor (R$)'),{target:{value:'3.00'}});fireEvent.click(screen.getByRole('button',{name:'Salvar alterações'}));await waitFor(()=>expect(mock).toHaveBeenCalledTimes(4));expect(JSON.parse(mock.mock.calls[3][1].body)).toEqual({ajusteValor:'3.00'});
});
