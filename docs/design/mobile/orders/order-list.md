# Order List

## Metadados

- **ID:** `mobile.orders.order-list`
- **Versão:** `v1`
- **Status:** aprovada
- **Perfil:** CLIENTE
- **HU principal:** HU-10
- **Origem visual:** Google Stitch
- **Viewport-base:** 390 dp
- **Referência visual:** `order-list.png`

---

## Objetivo

Permitir que o cliente visualize os pedidos associados à sua conta e acesse
o detalhe de cada pedido para acompanhamento.

A tela deve apresentar somente pedidos pertencentes ao cliente autenticado.

---

## Requisitos funcionais representados

A tela representa:

- título `Meus Pedidos`;
- lista de pedidos do cliente;
- identificador do pedido;
- data do pedido;
- modalidade;
- valor total;
- status atual;
- ação `Ver pedido`;
- navegação principal do aplicativo.

---

## Pedido

Cada card deve representar um pedido individual.

Pode apresentar:

- identificador;
- data;
- modalidade;
- total;
- status;
- ação de acesso ao detalhe.

A lista não deve apresentar todo o conteúdo do pedido.

Itens, personalizações, endereço, histórico e ações específicas pertencem ao
detalhe do pedido.

---

## Identificador

O identificador apresentado deve corresponder ao pedido real.

Os números exibidos em `order-list.png` são massa de demonstração.

---

## Data

A data deve representar a informação válida associada ao pedido.

A formatação deve respeitar a localização do aplicativo.

A interface não deve inferir datas ausentes.

---

## Modalidade

A modalidade pode ser:

- Delivery;
- Retirada.

A interface deve apresentar a modalidade efetivamente associada ao pedido.

---

## Valor total

O total exibido deve corresponder ao valor final válido do pedido.

A lista não deve recalcular valores.

---

## Status

A tela deve utilizar somente estados previstos pelo domínio.

Estados permitidos:

- Pendente de pagamento;
- Pago;
- Em preparo;
- Saiu para entrega;
- Entregue;
- Pronto para retirada;
- Retirado;
- Expirado;
- Cancelado.

Não criar novos status visuais ou funcionais.

`Saiu para entrega` e `Entregue` pertencem a Delivery; `Pronto para retirada`
e `Retirado` pertencem a Retirada. `Expirado` encerra o pedido pendente de
pagamento após o prazo definido pelo domínio.

A representação visual pode utilizar:

- texto;
- ícone;
- badge;
- cor semântica.

O significado não pode depender somente de cor.

---

## Ação `Ver pedido`

Cada card deve oferecer acesso ao detalhe do pedido correspondente.

Fluxo:

`Order List`
→ `Order Detail`

A ação não deve:

- repetir pedido;
- alterar status;
- iniciar pagamento automaticamente;
- cancelar pedido diretamente;
- criar nova operação comercial.

Essas ações devem ocorrer somente nos fluxos apropriados.

---

## Ordenação

A referência visual não estabelece uma regra nova de ordenação.

A implementação deve seguir a regra funcional definida para consulta dos pedidos.

Caso a regra vigente seja cronológica, a lista deve refletir os dados fornecidos
pela API.

---

## Sessão

A tela é vinculada ao cliente autenticado.

A implementação deve garantir que:

- apenas pedidos do cliente autenticado sejam exibidos;
- pedidos de outros usuários nunca sejam apresentados;
- sessão expirada seja tratada adequadamente;
- ausência de autenticação não resulte em exposição de dados.

---

## Estados

Além do estado principal representado em `order-list.png`, a implementação deve
contemplar:

### Lista com pedidos

Estado principal da referência visual.

---

### Loading

Durante o carregamento:

- indicar processamento;
- não apresentar lista vazia prematuramente;
- evitar interação com dados ainda não confirmados.

---

### Lista vazia

Quando o cliente não possuir pedidos:

- informar que ainda não existem pedidos;
- não tratar como erro;
- oferecer caminho coerente para retornar ao início ou cardápio.

A tela não deve criar conteúdo fictício para preencher o estado vazio.

---

### Erro

Quando não for possível carregar os pedidos:

- informar o problema;
- não exibir dados inválidos como atuais;
- permitir nova tentativa quando apropriado.

---

### Sessão expirada

Quando a sessão deixar de ser válida:

- não apresentar dados protegidos;
- informar necessidade de autenticação quando necessário;
- seguir o fluxo global de autenticação.

---

## Navegação inferior

A referência aprovada utiliza:

- Início;
- Cardápio;
- Pedidos;
- Perfil.

A opção `Pedidos` deve estar identificada como seção atual.

A navegação inferior não deve incluir funcionalidades inexistentes.

---

## Massa de demonstração

São dados demonstrativos em `order-list.png`:

- números dos pedidos;
- datas;
- modalidades;
- valores;
- combinação de status.

Eles representam atributos reais do domínio, mas não dados fixos do produto.

---

## Regra de veracidade

A tela não deve adicionar, sem requisito correspondente:

- avaliação;
- repetir pedido;
- rastreamento em mapa;
- prazo estimado;
- desconto;
- cashback;
- pontos;
- favoritos;
- filtros não definidos;
- promoção;
- funcionalidade comercial adicional.

---

## Acessibilidade

A implementação deve preservar:

- ordem lógica da lista;
- associação entre pedido, status e valor;
- badges com texto compreensível;
- informação não dependente somente de cor;
- ação `Ver pedido` acessível;
- contraste adequado;
- alvos de toque confortáveis;
- suporte a texto ampliado;
- navegação inferior semanticamente identificada.

---

## Responsividade

A referência foi aprovada para viewport-base de 390 dp.

A implementação deve ser verificada também em:

- 320 dp;
- 430 dp;
- texto ampliado;
- identificadores maiores;
- valores monetários maiores;
- maior quantidade de pedidos.

Os cards devem preservar acesso a:

- identificador;
- status;
- modalidade;
- total;
- ação principal.

---

## Navegação

Fluxo principal:

`Início`
→ `Pedidos`
→ `Order List`
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

A imagem `order-list.png` representa a composição visual aprovada, mas não cria
novas regras funcionais.
