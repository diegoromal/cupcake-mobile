# Order Detail

## Metadados

- **ID:** `mobile.orders.order-detail`
- **Versão:** `v1`
- **Status:** aprovada
- **Perfil:** CLIENTE
- **HU principal:** HU-10
- **HU relacionadas:** HU-08, HU-09, HU-13
- **Origem visual:** Google Stitch
- **Viewport-base:** 390 dp
- **Referência visual:** `order-detail.png`

---

## Objetivo

Permitir que o cliente consulte as informações de um pedido específico e acompanhe
sua evolução ao longo do fluxo operacional.

A tela deve apresentar o estado real do pedido sem prometer horários, prazos ou
localização que o sistema não possua.

---

## Requisitos funcionais representados

A tela representa:

- ação de voltar;
- identificação do pedido;
- modalidade;
- estado atual;
- acompanhamento sequencial do status;
- endereço quando aplicável;
- itens do pedido;
- personalizações;
- quantidades;
- valores;
- frete;
- total;
- forma de pagamento.

---

## Identificação do pedido

O pedido deve ser identificado pelo valor real fornecido pelo sistema.

O identificador `#4092` presente em `order-detail.png` é massa de demonstração.

---

## Modalidade

A modalidade apresentada deve corresponder ao pedido registrado.

Pode ser:

- Delivery;
- Retirada.

### Delivery

Quando Delivery:

- o endereço de entrega pode ser apresentado;
- o frete correspondente pode constar no resumo.

### Retirada

Quando Retirada:

- não apresentar endereço de entrega;
- não inventar local, horário ou prazo de retirada sem requisito correspondente;
- o frete deve respeitar a regra vigente para retirada.

---

## Estado atual

A tela deve destacar o estado real do pedido.

Na referência aprovada, o estado demonstrativo é:

`Em preparo`

A interface não deve deduzir um estado com base apenas no tempo transcorrido.

---

## Fluxo de status

O acompanhamento deve utilizar somente estados válidos do domínio.

Fluxo principal:

`Pendente de pagamento`
→ `Pago`
→ `Em preparo`
→ `Saiu para entrega`
→ `Entregue`

Para Retirada, depois de `Em preparo` o fluxo segue para
`Pronto para retirada` → `Retirado`.

Somente o entregador responsável confirma `Entregue`; a loja confirma
`Retirado`. O pedido pendente sem pagamento pode passar a `Expirado` após
15 minutos, conforme a regra de domínio.

Também existem os estados terminais:

`Cancelado` e `Expirado`.

Não criar estados adicionais apenas para fins visuais.

---

## Timeline

A timeline deve diferenciar:

- etapas concluídas;
- etapa atual;
- etapas futuras.

A timeline representa estado, não previsão.

Não exibir nela, sem requisito correspondente:

- horário estimado;
- prazo restante;
- previsão de preparo;
- previsão de saída;
- previsão de entrega;
- localização do entregador;
- mensagens operacionais inventadas.

---

## Pedido cancelado

Quando o pedido estiver cancelado:

- apresentar `Cancelado` como estado terminal;
- não mostrar etapas posteriores como concluídas;
- não sugerir continuidade operacional.

---

## Cancelamento pelo cliente

A ação de cancelamento deve aparecer somente quando o pedido estiver elegível
conforme a regra de negócio vigente.

Na regra atualmente consolidada, o cancelamento pelo cliente ocorre apenas no
estado permitido antes do início do preparo.

A referência `order-detail.png` representa um pedido em `Em preparo` e,
portanto, não apresenta ação de cancelamento.

O design não deve ampliar essa regra.

Quando a ação estiver disponível:

- exigir confirmação;
- identificar claramente a consequência;
- impedir submissão duplicada;
- atualizar o pedido somente após confirmação do sistema.

---

## Endereço

Para Delivery, a tela pode apresentar:

- logradouro;
- número;
- complemento;
- bairro;
- cidade;
- estado;
- CEP.

Os dados exibidos em `order-detail.png` são massa de demonstração.

A interface não deve inventar dados ausentes.

---

## Itens do pedido

Cada item pode apresentar:

- imagem;
- nome;
- personalizações selecionadas;
- quantidade;
- preço correspondente.

Os itens apresentados devem refletir o snapshot ou estado válido registrado para
o pedido, conforme a implementação do domínio.

A tela de acompanhamento não deve permitir alterar:

- produto;
- quantidade;
- personalizações.

Essas escolhas pertencem ao fluxo anterior à criação do pedido.

---

## Personalizações

As personalizações exibidas representam as escolhas associadas aos itens do pedido.

A interface não deve:

- adicionar novas opções;
- alterar opções existentes;
- inferir categorias não existentes;
- recalcular arbitrariamente o pedido.

---

## Valores

O resumo pode apresentar:

- subtotal dos itens;
- frete;
- total do pedido;
- forma de pagamento.

Os valores devem refletir o pedido registrado.

A tela não deve recalcular regras comerciais por conta própria.

---

## Frete

Quando aplicável, o frete deve corresponder ao valor associado ao pedido.

O valor exibido no PNG é massa de demonstração.

Não representa tarifa fixa.

---

## Total do pedido

O total deve representar o valor consolidado do pedido.

A tela não deve introduzir:

- descontos inexistentes;
- taxas extras;
- cashback;
- pontos;
- promoções;
- benefícios não registrados.

---

## Forma de pagamento

A forma de pagamento apresentada deve corresponder ao método efetivamente
associado ao pedido.

Exemplos previstos:

- Pix;
- Cartão.

Não é necessário acrescentar textos como `Aprovado` ao método quando o próprio
estado `Pago` já comunica a situação do pedido.

---

## Atualização do pedido

A implementação pode atualizar os dados do pedido quando houver nova informação
válida do sistema.

Durante atualização:

- não apresentar estado futuro como confirmado;
- não substituir silenciosamente informação válida por dados incertos;
- manter coerência entre estado atual e timeline.

---

## Erro de atualização

Quando não for possível atualizar o pedido:

- informar que os dados não puderam ser atualizados;
- não inventar novo estado;
- preservar a última informação válida quando apropriado;
- permitir nova tentativa quando suportado.

A falha de atualização não significa mudança no estado do pedido.

---

## Sessão expirada

Quando a sessão não estiver mais válida:

- não expor dados protegidos indevidamente;
- seguir o fluxo global de autenticação;
- permitir recuperação do acesso conforme as regras vigentes.

---

## Massa de demonstração

São dados demonstrativos em `order-detail.png`:

- número do pedido;
- endereço;
- produtos;
- imagens;
- personalizações;
- quantidades;
- preços;
- frete;
- total;
- forma de pagamento;
- estado `Em preparo`.

Eles representam atributos válidos do domínio, mas não dados fixos.

---

## Regra de veracidade

A tela não deve apresentar, sem requisito correspondente:

- localização do entregador;
- mapa;
- prazo estimado;
- horário previsto;
- contato com entregador;
- chat;
- avaliação;
- gorjeta;
- repetir pedido;
- benefício comercial;
- mensagem operacional inventada.

A interface deve mostrar apenas o que o sistema efetivamente conhece.

---

## Estados

Além do estado principal representado no PNG, a implementação deve contemplar:

### Pendente de pagamento

Pedido criado e ainda sem pagamento confirmado.

### Pago

Pagamento confirmado.

### Em preparo

Pedido em produção.

### Saiu para entrega

Pedido encaminhado para entrega.

### Entregue

Pedido concluído.

### Pronto para retirada

Pedido aguardando retirada na loja.

### Retirado

Retirada confirmada pela loja.

### Expirado

Pedido sem pagamento confirmado após o prazo de reserva.

### Cancelado

Pedido encerrado por cancelamento.

### Erro de atualização

Falha técnica ao obter informação mais recente sem alterar o último estado
confirmado.

### Sessão expirada

Necessidade de nova autenticação para acessar os dados protegidos.

---

## Acessibilidade

A implementação deve preservar:

- leitura sequencial coerente da timeline;
- estado atual anunciado semanticamente;
- estados não dependentes somente de cor;
- associação clara entre item, quantidade e preço;
- contraste suficiente;
- alvos de toque adequados;
- suporte a texto ampliado;
- mensagens de erro compreensíveis.

---

## Responsividade

A referência foi aprovada para viewport-base de 390 dp.

A implementação deve ser verificada também em:

- 320 dp;
- 430 dp;
- texto ampliado;
- nomes maiores de produtos;
- maior quantidade de personalizações;
- endereços maiores;
- valores monetários maiores.

Não podem ficar inacessíveis ou sobrepostos:

- identificador;
- estado;
- timeline;
- itens;
- total.

---

## Navegação

Fluxo principal:

`Order List`
→ `Order Detail`

Também pode ser acessado após pagamento confirmado:

`Payment Result`
→ `Order Detail`

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

A imagem `order-detail.png` representa a composição visual aprovada, mas não
cria novas regras funcionais.
