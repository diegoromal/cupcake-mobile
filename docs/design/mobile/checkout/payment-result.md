# Payment Result

## Metadados

- **ID:** `mobile.checkout.payment-result`
- **Versão:** `v1`
- **Status:** aprovada
- **Perfil:** CLIENTE
- **HU principal:** HU-08
- **Relacionadas:** HU-09, HU-10
- **Origem visual:** Google Stitch
- **Viewport-base:** 390 dp
- **Referência visual:** `payment-result.png`

---

## Objetivo

Informar ao cliente o resultado conhecido da tentativa de pagamento e oferecer
a próxima ação coerente com o estado atual do pedido.

A tela deve diferenciar claramente:

- pagamento aprovado;
- pagamento recusado;
- resultado não confirmado.

A interface não deve inferir um resultado financeiro sem confirmação do sistema.

---

## Estado principal da referência

O arquivo `payment-result.png` representa o estado:

`Pagamento aprovado`

Nesse estado:

- o pagamento foi confirmado pelo sistema;
- o pedido correspondente deve estar identificado;
- o status apresentado pode ser `Pago`, quando coerente com o domínio;
- o total do pedido deve ser exibido;
- a forma de pagamento confirmada pode ser apresentada;
- deve existir acesso ao pedido.

---

## Pagamento aprovado

Quando houver confirmação confiável de aprovação:

- apresentar mensagem clara de sucesso;
- identificar o pedido;
- apresentar o total;
- apresentar a forma de pagamento;
- informar que o pagamento foi vinculado ao pedido;
- permitir acesso ao detalhe do pedido.

A tela não deve afirmar que:

- o pedido já está em preparo;
- o pedido já saiu para entrega;
- existe prazo específico de produção;
- existe prazo específico de entrega;
- existe prazo específico de retirada.

Esses estados pertencem ao fluxo posterior do pedido.

---

## Identificação do pedido

A tela pode apresentar:

- identificador do pedido;
- status vigente;
- total;
- forma de pagamento.

O identificador `#4092` presente na referência é massa de demonstração.

---

## Status `Pago`

O status `Pago` deve representar o estado funcional real do pedido após
confirmação de pagamento.

A interface não deve utilizar esse status antes de confirmação confiável.

---

## Forma de pagamento

A forma de pagamento apresentada deve corresponder ao método efetivamente
confirmado pelo sistema.

Exemplos previstos:

- Pix;
- Cartão.

A tela não deve inferir método de pagamento a partir de seleção anterior se a
operação final tiver resultado diferente ou desconhecido.

---

## Ação principal

A ação principal é:

`Ver pedido`

Ela deve levar ao detalhe/acompanhamento do pedido correspondente.

Fluxo esperado:

`Payment Result`
→ `Order Detail`

---

## Ação secundária

A ação secundária é:

`Voltar para o início`

Ela deve retornar à navegação principal do cliente sem alterar o estado do
pedido.

---

## Pagamento recusado

Quando houver resposta confiável indicando recusa:

- apresentar claramente que o pagamento não foi aprovado;
- não utilizar status `Pago`;
- manter o pedido no estado apropriado para pagamento pendente;
- permitir nova tentativa quando a regra vigente permitir;
- utilizar o mesmo pedido;
- não criar outro pedido silenciosamente.

Uma ação possível é:

`Tentar novamente`

A navegação deve retornar ao fluxo de pagamento do mesmo pedido.

---

## Resultado não confirmado

Quando ocorrer falha técnica ou não for possível confirmar o resultado:

- não apresentar `Pagamento aprovado`;
- não apresentar `Pagamento recusado`;
- não utilizar status `Pago`;
- informar que não foi possível confirmar o resultado;
- permitir consultar/verificar novamente quando suportado;
- evitar estimular uma nova tentativa antes de verificar o estado vigente.

Esse estado deve reduzir o risco de pagamento duplicado.

---

## Diferença entre recusa e resultado desconhecido

### Recusa

Existe confirmação confiável de que o pagamento não foi aprovado.

### Resultado desconhecido

Não há informação suficiente para afirmar aprovação ou recusa.

Esses estados não devem compartilhar a mesma mensagem.

---

## Nova tentativa

Quando a regra vigente permitir nova tentativa:

- reutilizar o pedido existente;
- retornar ao fluxo de pagamento;
- não criar um novo pedido;
- não iniciar nova cobrança enquanto outra tentativa ainda estiver em estado
  incerto.

---

## Mensagem de confirmação

A referência aprovada utiliza:

`O pagamento foi confirmado e vinculado ao seu pedido.`

Essa mensagem indica apenas:

- confirmação do pagamento;
- associação ao pedido.

Ela não implica:

- preparo iniciado;
- prazo;
- entrega;
- emissão obrigatória de comprovante;
- benefício comercial.

---

## Massa de demonstração

São dados demonstrativos em `payment-result.png`:

- pedido `#4092`;
- valor `R$ 70,80`;
- forma de pagamento Pix.

Esses dados não constituem valores fixos do produto.

---

## Regra de veracidade

A tela não deve apresentar, sem fonte normativa:

- prazo de preparo;
- prazo de entrega;
- prazo de retirada;
- cashback;
- pontos;
- desconto;
- promoção;
- comprovante obrigatório;
- compartilhamento;
- avaliação;
- benefício comercial;
- status posterior não confirmado.

---

## Estados

Além do estado principal representado no PNG, a implementação deve contemplar:

### Pagamento aprovado

- confirmação clara;
- status coerente;
- acesso ao pedido.

### Pagamento recusado

- informar recusa;
- não marcar pedido como pago;
- permitir nova tentativa quando aplicável.

### Resultado não confirmado

- não afirmar aprovação;
- não afirmar recusa;
- permitir consulta/atualização quando suportado.

---

## Acessibilidade

A implementação deve preservar:

- feedback textual além do ícone;
- contraste adequado;
- identificação semântica do resultado;
- leitura clara do pedido e valor;
- botões com rótulos explícitos;
- suporte a texto ampliado;
- resultado não dependente somente de cor ou símbolo.

---

## Responsividade

A referência foi aprovada para viewport-base de 390 dp.

A implementação deve ser verificada também em:

- 320 dp;
- 430 dp;
- texto ampliado;
- identificadores maiores;
- valores monetários maiores;
- mensagens de resultado maiores.

Não podem ficar inacessíveis ou sobrepostos:

- resultado;
- identificação do pedido;
- total;
- forma de pagamento;
- ações.

---

## Navegação

Fluxo de sucesso:

`Payment`
→ `Payment Result`
→ `Order Detail`

Fluxo de nova tentativa:

`Payment Result`
→ `Payment`

quando permitido.

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

A imagem `payment-result.png` representa a composição visual aprovada, mas não
cria novas regras funcionais.
