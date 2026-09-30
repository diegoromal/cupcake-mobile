# Admin Order Detail

## Metadados

- **ID:** `admin.orders.order-detail`
- **Versão:** `v1`
- **Status:** aprovada
- **Perfil:** ADMIN
- **HU principais:** HU-16, HU-17
- **Relacionadas:** HU-19, HU-20
- **Origem visual:** Google Stitch
- **Viewport-base:** 1440 px
- **Referência visual:** `order-detail.png`

---

## Objetivo

Permitir que o administrador consulte as informações necessárias de um pedido e
execute somente a próxima transição válida do fluxo operacional.

A interface deve preservar a sequência de estados definida pelo domínio e não
permitir que etapas sejam ignoradas.

---

## Requisitos funcionais representados

A tela representa:

- retorno à listagem de pedidos;
- identificador do pedido;
- status atual;
- modalidade;
- data/hora de confirmação do pagamento;
- fluxo sequencial de status;
- próxima etapa válida;
- ação operacional correspondente;
- itens do pedido;
- personalizações;
- quantidades;
- valores;
- cliente;
- endereço quando Delivery;
- subtotal;
- frete;
- total;
- forma de pagamento.

---

## Status do pedido

A operação administrativa deve utilizar somente os estados previstos pelo domínio.

Fluxo operacional:

`Pago`
→ `Em preparo`
→ `Saiu para entrega`
→ `Entregue`

Para Retirada, após `Em preparo` o fluxo segue para `Pronto para retirada`
→ `Retirado`.

O Admin executa `Pago` → `Em preparo`, atribui um entregador ao avançar
Delivery para `Saiu para entrega` e confirma a retirada como `Retirado`.
Somente o entregador responsável confirma `Entregue`.

Também existe o estado terminal:

`Cancelado`

Não criar estados intermediários apenas para representação visual.

---

## Regra de sequência

As transições devem seguir obrigatoriamente a sequência prevista.

A interface não deve permitir:

- selecionar qualquer status livremente;
- pular etapas;
- retroceder status sem regra específica;
- marcar como entregue diretamente a partir de Pago;
- oferecer ao Admin a confirmação de entrega reservada ao entregador;
- criar transições alternativas não previstas.

---

## Próxima etapa

A tela deve apresentar somente a próxima ação válida para o estado atual.

### Pedido Pago

Próxima ação:

`Iniciar preparo`

Transição:

`Pago`
→ `Em preparo`

### Pedido Em preparo

Para Delivery, a próxima ação válida é:

`Marcar como saiu para entrega`

Essa transição exige atribuir um entregador.

Para Retirada, a próxima ação válida é marcar o pedido como
`Pronto para retirada`.

### Pedido Saiu para entrega

O Admin acompanha o estado. A confirmação de `Entregue` pertence somente ao
entregador responsável e deve registrar data e hora.

### Pedido Pronto para retirada

O Admin pode confirmar `Retirado`.

### Pedido Entregue ou Retirado

Nenhuma nova transição operacional deve ser oferecida.

---

## Confirmação

Toda alteração de status deve exigir confirmação antes de ser persistida.

A confirmação deve:

- identificar claramente a ação;
- informar o novo estado;
- impedir submissão duplicada;
- aguardar confirmação do sistema;
- não atualizar visualmente o pedido antes de resposta confiável.

---

## Operação em andamento

Enquanto uma transição estiver sendo processada:

- a ação deve ficar desabilitada;
- impedir nova submissão;
- indicar processamento;
- preservar o status atual até confirmação.

---

## Conflito de atualização

O pedido pode ter sido alterado por outra operação desde seu carregamento.

Quando houver conflito:

- não sobrescrever silenciosamente;
- informar que o pedido foi atualizado;
- obter novamente o estado vigente quando apropriado;
- recalcular a próxima ação válida;
- impedir transição incompatível com o novo estado.

---

## Identificação do pedido

O identificador deve corresponder ao pedido real.

`#ORD-1045` presente em `order-detail.png` é massa de demonstração.

---

## Confirmação do pagamento

A data/hora apresentada no topo representa a referência temporal de confirmação
do pagamento quando disponível.

Essa informação é relevante para a organização cronológica dos pedidos conforme
a regra operacional vigente.

O valor demonstrado na referência não constitui dado fixo.

---

## Modalidade

A modalidade deve corresponder ao pedido registrado.

Pode ser:

- Delivery;
- Retirada.

---

## Delivery

Quando a modalidade for Delivery:

- apresentar endereço de destino;
- apresentar frete quando aplicável.

A tela não deve adicionar:

- mapa;
- localização em tempo real;
- rota;
- distância;
- previsão de entrega.

---

## Retirada

Quando a modalidade for Retirada:

- não apresentar endereço de entrega;
- respeitar as regras vigentes de frete;
- não inventar prazo ou instrução operacional adicional.

---

## Dados do cliente

A referência principal apresenta somente o nome do cliente.

A interface deve expor apenas os dados necessários à operação.

Não adicionar sem requisito:

- histórico de compras;
- classificação do cliente;
- origem do canal;
- indicadores comerciais;
- segmentação;
- quantidade de pedidos anteriores.

O nome `Mariana Souza` é massa de demonstração.

---

## Itens do pedido

Cada item pode apresentar:

- quantidade;
- nome;
- personalizações;
- preço correspondente.

Os itens devem refletir o pedido registrado.

A tela administrativa não deve alterar:

- produto;
- quantidade;
- personalizações;

durante a operação de status do pedido.

---

## Personalizações

As personalizações exibidas são aquelas registradas no item.

A interface não deve:

- adicionar novas opções;
- alterar escolhas;
- reinterpretar as regras de personalização.

---

## Resumo financeiro

O resumo pode apresentar:

- subtotal dos itens;
- frete;
- total do pedido;
- forma de pagamento.

A tela não deve recalcular regras comerciais arbitrariamente.

---

## Frete

O valor deve refletir o frete associado ao pedido quando aplicável.

O valor presente na referência é massa de demonstração e não representa tarifa
fixa.

---

## Total do pedido

O total deve corresponder ao valor consolidado do pedido.

A tela não deve adicionar:

- impostos destacados sem requisito;
- taxas extras;
- desconto;
- cashback;
- benefício comercial;
- qualquer valor não registrado no pedido.

---

## Forma de pagamento

A forma apresentada deve corresponder ao pagamento associado ao pedido.

Exemplos previstos:

- Pix;
- Cartão.

Na referência aprovada:

`Pix`

O método não precisa acrescentar `Confirmado`, pois o status do pedido já
representa a situação funcional correspondente.

---

## Entregador

A referência principal mostra um pedido `Pago` e não apresenta a atribuição.
Antes de avançar Delivery para `Saiu para entrega`, o Admin deve atribuir um
entregador conforme a regra do domínio. A implementação dessa etapa deve seguir
o contrato funcional da tarefa correspondente, sem inferir controles do PNG.

Não inferir:

- frota;
- disponibilidade;
- escala;
- localização;
- rota;
- seleção automática.

A confirmação de `Entregue` pertence ao fluxo do entregador responsável.

---

## Pedido cancelado

Quando um pedido estiver em estado `Cancelado`:

- não apresentar próxima etapa operacional;
- não permitir continuidade do fluxo;
- comunicar o estado terminal.

---

## Estados da tela

Além do estado principal representado em `order-detail.png`, a implementação deve
contemplar:

### Operação normal

Pedido carregado e próxima transição válida disponível.

### Confirmação

Antes de persistir alteração de status.

### Ação em andamento

Transição sendo processada e ação desabilitada.

### Conflito

Estado remoto do pedido diverge do estado usado para iniciar a operação.

### Erro

Falha durante consulta ou alteração.

### Pedido finalizado

Pedido `Entregue`, `Retirado` ou `Cancelado`, sem próxima ação operacional.

### Acesso negado

Usuário autenticado sem autorização administrativa.

---

## Erro

Quando ocorrer falha:

- não assumir que a transição ocorreu;
- manter estado conhecido quando possível;
- informar o problema;
- permitir nova tentativa quando seguro;
- evitar duplicação da operação.

---

## Acesso negado

Somente usuários autorizados como ADMIN devem acessar esta tela.

Quando não autorizado:

- não expor dados do pedido;
- não exibir ações administrativas;
- seguir o comportamento de autorização vigente.

---

## Massa de demonstração

São dados demonstrativos em `order-detail.png`:

- identificador do pedido;
- data/hora;
- cliente;
- endereço;
- produtos;
- personalizações;
- quantidades;
- preços;
- frete;
- total;
- forma de pagamento.

Eles representam atributos válidos do domínio, mas não dados fixos.

No PNG, os valores demonstrativos são: itens de `R$ 70,00`, frete de
`R$ 8,50` e total de `R$ 78,50`. Esses valores não são fixos; a implementação
deve refletir os valores consolidados do pedido.

`Confeitaria Admin` no rodapé representa apenas uma identificação visual
demonstrativa do usuário administrativo, não um novo perfil ou papel do domínio.

---

## Regra de veracidade

A tela não deve adicionar, sem requisito correspondente:

- tempo de preparo;
- previsão de entrega;
- mapa;
- rastreamento;
- localização de entregador;
- frota;
- chat;
- observações internas;
- histórico comercial do cliente;
- classificação de cliente;
- métricas;
- impostos não definidos;
- estados adicionais;
- transições alternativas.

---

## Acessibilidade

A implementação deve preservar:

- ordem de leitura coerente;
- estado atual semanticamente identificado;
- próxima etapa claramente distinguível;
- status não dependentes somente de cor;
- confirmação acessível;
- foco visível;
- navegação por teclado;
- contraste adequado;
- feedback acessível durante processamento e erro.

---

## Responsividade

A referência foi aprovada para desktop.

Cenário-base:

- 1280–1440 px.

Também deve ser validada em:

- 768 px;
- 320 px quando aplicável.

Em larguras menores:

- cards podem empilhar;
- áreas laterais devem permanecer acessíveis;
- valores não podem ser cortados;
- ação operacional deve continuar identificável.

---

## Navegação

Fluxo:

`Admin Order List`
→ `Admin Order Detail`

Após uma transição válida, a tela permanece vinculada ao mesmo pedido e deve
refletir seu novo estado.

A navegação completa deve seguir:

`docs/design/NAVIGATION.md`

---

## Referências

A implementação deve observar também:

- `docs/design/DESIGN_SYSTEM.md`
- `docs/design/NAVIGATION.md`
- `docs/design/SCREEN_STATES.md`
- `.ai/DESIGN.md`

Em caso de conflito, requisitos funcionais, modelo de domínio e regras de negócio
prevalecem sobre a referência visual.

A imagem `order-detail.png` representa a composição visual aprovada, mas não cria
novas regras funcionais.
