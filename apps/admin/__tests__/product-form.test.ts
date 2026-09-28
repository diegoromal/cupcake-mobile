import { emptyProduct, productPayload, validateProduct } from '@/lib/product-form';
const category='11111111-1111-4111-8111-111111111111';
test('valida categoria, nome e preço sem arredondamento',()=>{
  expect(validateProduct(emptyProduct,[])).toHaveProperty('categoriaId');
  expect(validateProduct({...emptyProduct,categoriaId:category,nome:'Bolo',precoAtual:'12.34'},[category])).toEqual({});
  expect(validateProduct({...emptyProduct,categoriaId:category,nome:'Bolo',precoAtual:'12.345'},[category])).toHaveProperty('precoAtual');
});
test('criação envia somente campos de Produto e edição envia somente diferença',()=>{
 const value={categoriaId:category,nome:' Bolo ',descricao:'',precoAtual:'12.34',ativo:true};
 expect(productPayload(value)).toEqual({categoriaId:category,nome:'Bolo',descricao:null,precoAtual:'12.34',ativo:true});
 expect(productPayload({...value,ativo:false},{...value,nome:'Bolo',descricao:null})).toEqual({ativo:false});
 expect(JSON.stringify(productPayload(value))).not.toContain('imagem');
});
