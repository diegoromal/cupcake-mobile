import { fireEvent, render, screen } from '@testing-library/react';import userEvent from '@testing-library/user-event';
import ProductImage from '@/components/ProductImage';import { adminApi } from '@/lib/client/admin-api';
jest.mock('@/lib/client/admin-api',()=>{const real=jest.requireActual('@/lib/client/admin-api');return {...real,adminApi:jest.fn()};});const mock=adminApi as jest.Mock;
beforeEach(()=>{mock.mockReset();URL.createObjectURL=jest.fn(()=>'blob:preview');URL.revokeObjectURL=jest.fn();});
test('tipo, preview, upload multipart e revoke',async()=>{
 const user=userEvent.setup();mock.mockResolvedValue({imagem:'private-key'});const onChange=jest.fn();const view=render(<ProductImage id="1" image={null} onChange={onChange}/>);
 fireEvent.change(screen.getByLabelText(/Selecionar imagem/),{target:{files:[new File(['x'],'bad.gif',{type:'image/gif'})]}});expect(screen.getByText('Use JPEG, PNG ou WebP.')).toBeInTheDocument();
 fireEvent.change(screen.getByLabelText(/Selecionar imagem/),{target:{files:[new File(['abc'],'ok.png',{type:'image/png'})]}});expect(await screen.findByAltText('Prévia local da imagem selecionada')).toBeInTheDocument();
 await user.click(screen.getByRole('button',{name:'Enviar imagem'}));expect(mock.mock.calls[0][1].body.get('imagem').name).toBe('ok.png');expect(onChange).toHaveBeenCalledWith('private-key');view.unmount();expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview');
});
test('limite inicial de 10 MiB impede upload',()=>{
 const view=render(<ProductImage id="1" image={null} onChange={jest.fn()}/>);
 fireEvent.change(screen.getByLabelText(/Selecionar imagem/),{target:{files:[new File([new Uint8Array(10*1024*1024+1)],'large.png',{type:'image/png'})]}});
 expect(screen.getByText('Imagem deve ter até 10 MiB.')).toBeInTheDocument();expect(screen.getByRole('button',{name:'Enviar imagem'})).toBeDisabled();view.unmount();
});
test.each([[400,'Imagem inválida.'],[409,'Imagem alterada por outra operação.'],[413,'Imagem excede o limite.'],[503,'Armazenamento indisponível.']])('upload explica erro %i',async(status,text)=>{
 const user=userEvent.setup();const {AdminApiError}=jest.requireActual('@/lib/client/admin-api');mock.mockRejectedValue(new AdminApiError(status,'API falhou'));
 render(<ProductImage id="1" image={null} onChange={jest.fn()}/>);
 fireEvent.change(screen.getByLabelText(/Selecionar imagem/),{target:{files:[new File(['abc'],'ok.png',{type:'image/png'})]}});
 await user.click(screen.getByRole('button',{name:'Enviar imagem'}));expect(await screen.findByText(new RegExp(text.slice(0,12)))).toBeInTheDocument();
});
test('remoção aceita 204 e limpa preview local',async()=>{
 const user=userEvent.setup();mock.mockResolvedValue(undefined);const onChange=jest.fn();render(<ProductImage id="1" image="private-key" onChange={onChange}/>);
 fireEvent.change(screen.getByLabelText(/Selecionar imagem/),{target:{files:[new File(['abc'],'ok.png',{type:'image/png'})]}});
 expect(await screen.findByAltText('Prévia local da imagem selecionada')).toBeInTheDocument();
 await user.click(screen.getByRole('button',{name:'Remover imagem'}));expect(onChange).toHaveBeenCalledWith(null);expect(URL.revokeObjectURL).toHaveBeenCalled();
});
