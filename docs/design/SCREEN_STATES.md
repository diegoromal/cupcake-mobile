# Estados de Tela — Cupcake Mobile

## Objetivo

Definir o contrato visual e comportamental dos estados recorrentes nas referências da D118.

Nem todo estado se aplica a toda tela.

## Princípios

- Loading não deve parecer vazio.
- Erro não deve parecer ausência de dados.
- Sucesso só pode ser afirmado após confirmação.
- Estado desconhecido deve permanecer desconhecido.
- Erros não dependem apenas de cor.
- Mutações pendentes bloqueiam repetição quando necessário.
- Dados digitados devem ser preservados em falhas recuperáveis.
- `401` e `403` possuem significados distintos.
- `null`, zero e `false` não são equivalentes.

## Loading

Usar quando dados estão sendo consultados ou uma operação está em andamento.

Regras:

- manter contexto da tela;
- anunciar processamento;
- não apresentar vazio prematuramente;
- impedir ação concorrente incompatível.

## Vazio

Usar apenas após consulta concluída e coleção realmente vazia.

Deve:

- explicar a ausência;
- oferecer ação de criação quando real;
- não ser apresentado como erro.

## Erro

Deve:

- explicar o que falhou;
- indicar próxima ação quando possível;
- preservar dados locais;
- evitar retentativa automática de mutação incerta.

## Sucesso

Somente após resposta confirmada.

Em criação:

- usar ID retornado;
- navegar conforme fluxo.

Em edição:

- resposta passa a ser nova referência persistida.

Em exclusão:

- `204` permite retorno à lista.

## Desabilitado

Deve ser perceptível visualmente e semanticamente.

Usar quando:

- formulário inválido;
- operação já está pendente;
- confirmação ainda não é válida;
- regra funcional impede ação.

## Confirmação

Usar em operação destrutiva ou quando o contrato exigir confirmação.

Confirmação nominal:

- exigir nome exato;
- manter a ação destrutiva bloqueada até a correspondência exata;
- cancelamento não dispara `DELETE`;
- o `DELETE` usa o ID real do recurso.

Na exclusão de Produto, o texto exigido é o nome exato do produto.

## Autenticação

### Visitante

Pode acessar apenas fluxos públicos permitidos.

### Cliente autenticado

Pode acessar o fluxo protegido de cliente.

### Sessão expirada

Deve voltar ao fluxo de autenticação.

### Perfil sem acesso

Apresentar acesso negado.

Admin:

- `401`: autenticação;
- `403`: acesso somente a administradores.

## Mobile — matriz

| Tela | Loading | Vazio | Erro | Sucesso | Desabilitado | Confirmação | Auth |
|---|---|---|---|---|---|---|---|
| `customer-sign-up` | envio | N/A | validação/API | cadastro | submit | N/A | visitante |
| `customer-login` | autenticando | N/A | credenciais/bloqueio | login | submit | N/A | visitante |
| `storefront` | catálogo | catálogo vazio | retry | conteúdo | ações quando necessário | N/A | conforme contrato |
| `product-detail` | produto | N/A | indisponível/estoque/API | item adicionado | incluir | N/A | conforme contrato |
| `cart` | recálculo | carrinho vazio | estoque/API | total atualizado | avançar | remoção quando aplicável | cliente |
| `fulfillment` | frete | N/A | endereço/cobertura/API | modalidade válida | continuar | N/A | cliente |
| `order-review` | criando | N/A | disponibilidade/API | pedido criado | confirmar | N/A | cliente |
| `payment` | processando | N/A | recusa/API | confirmado | pagar | N/A | cliente |
| `payment-result` | consulta | N/A | resultado desconhecido | aprovado/recusado confirmado | ações conforme estado | N/A | cliente |
| `order-list` | lista | sem pedidos | retry | lista | N/A | N/A | cliente |
| `order-detail` | atualização | N/A | API | estado atualizado | ações | cancelamento elegível | cliente |

## Admin legado — matriz

| Tela | Loading | Vazio | Erro | Sucesso | Desabilitado | Confirmação |
|---|---|---|---|---|---|---|
| `admin.auth.login` | autenticação | N/A | 401/403/rede | sessão | entrar | N/A |
| `product-list` | produtos/categorias | lista vazia | total/parcial | lista | N/A | N/A |
| `product-create` | categorias/envio | N/A | validação/API | criado | criar | N/A |
| `product-detail` | produto/dados auxiliares | N/A | 404/409/upload/API | salvo/ações | salvar/mutações | desvínculo/imagem/exclusão |
| `category-list` | lista | sem categorias | retry | lista | N/A | N/A |
| `category-create` | envio | N/A | validação/API | criada | criar | N/A |
| `category-detail` | consulta/salvar | N/A | 404/409/API | salva/excluída | salvar/excluir | nominal |
| `personalization-list` | lista | sem personalizações | retry | lista | N/A | N/A |
| `personalization-create` | envio | N/A | validação/API | criada | criar | N/A |
| `personalization-detail` | consulta/salvar | N/A | 404/409/API | salva/excluída | salvar/excluir | nominal |

## Produtos — estados específicos

### Falha parcial de categorias

Na lista de produtos:

- produtos continuam visíveis;
- categoria pode aparecer como `Categoria indisponível`;
- oferecer `Tentar novamente`;
- não transformar em erro global.

### Imagem

Estados:

- sem imagem;
- imagem associada;
- arquivo local selecionado;
- enviando;
- sucesso;
- erro.

Não exibir porcentagem sem suporte real.

### Estoque

Estados:

- saldo carregando;
- saldo disponível;
- ajustando;
- histórico carregando;
- erro de saldo;
- erro de histórico;
- ajuste rejeitado.

Não permitir saldo inválido.

## Categoria — estados específicos

### Nenhuma alteração

- mensagem `Nenhuma alteração para salvar`;
- salvar desabilitado;
- nenhum PATCH.

### Conflito de exclusão

Mensagem:

`Esta categoria está em uso por produtos e não pode ser excluída.`

Após 409:

- permanecer;
- preservar dados;
- liberar controles.

## Personalização — estados específicos

### Disponibilidade

`true` e `false` são valores reais.

### Ajuste

Representações:

| Persistido | Exibição |
|---|---|
| `null` | `Não definido` |
| `"0.00"` | `R$ 0,00` |
| `"2.50"` | `+ R$ 2,50` |
| `"-0.05"` | `− R$ 0,05` |

### Conflito de exclusão

Mensagem:

`Esta personalização está em uso e não pode ser excluída. Você pode alterar sua disponibilidade.`

Não atribuir a causa a Produto, Carrinho ou outra relação específica.

## Pagamento

### Processando

- bloquear nova tentativa simultânea;
- não afirmar resultado antecipadamente.

### Recusado

Somente apresentar recusa quando confirmada.

Se o pedido continuar pendente e elegível, oferecer nova tentativa.

### Resultado desconhecido

Se houver falha de consulta ou ambiguidade:

- não apresentar aprovado;
- não apresentar recusado;
- informar que o resultado não pôde ser confirmado;
- oferecer ação segura conforme contrato futuro.

## Concorrência

Para mutações sobre o mesmo recurso:

- uma pendente bloqueia outra incompatível;
- clique duplo não gera duas requests;
- mudança de estado deve impedir evento concorrente imediato;
- resposta obsoleta não deve sobrescrever referência mais nova.

## Acessibilidade dos estados

- loading anunciável;
- erro com `role="alert"` ou equivalente;
- sucesso/status anunciável quando necessário;
- foco no resumo de erro em formulário;
- status textual além de cor;
- confirmação operável por teclado;
- foco no campo de confirmação;
- retorno de foco ao cancelar.
