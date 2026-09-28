import { categoryPayload, validateCategory } from '@/lib/category-form';
test('nome obrigatório, trim e descrição vazia vira null',()=>{
 expect(validateCategory({nome:'  ',descricao:null})).toEqual({nome:'Informe o nome.'});
 expect(categoryPayload({nome:'  Doces  ',descricao:'  '})).toEqual({nome:'Doces',descricao:null});
});
test('PATCH apenas campos alterados e vazio',()=>{
 const original={nome:'Doces',descricao:null};
 expect(categoryPayload({nome:'Doces',descricao:'Nova'},original)).toEqual({descricao:'Nova'});
 expect(categoryPayload({nome:'Doces',descricao:''},original)).toEqual({});
});
