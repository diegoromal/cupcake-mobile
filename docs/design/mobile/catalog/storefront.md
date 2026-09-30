# Storefront

## Metadados

- **ID:** `mobile.catalog.storefront`
- **Versão:** `v1`
- **Status:** aprovada
- **Perfil:** CLIENTE
- **HU principal:** HU-03
- **Origem visual:** Google Stitch
- **Viewport-base:** 390 dp
- **Referência visual:** `storefront.png`

---

## Objetivo

Apresentar ao cliente os cupcakes disponíveis para compra de forma clara,
atrativa e organizada, permitindo localizar um produto e seguir para sua
visualização detalhada.

---

## Requisitos funcionais representados

A tela representa:

- identificação do cliente autenticado;
- escolha entre Delivery e Retirada;
- organização de produtos por categoria;
- listagem de produtos disponíveis;
- imagem do produto;
- categoria;
- nome;
- descrição resumida;
- preço;
- acesso ao detalhe do produto;
- navegação principal do aplicativo.

A vitrine deve apresentar somente produtos elegíveis para exposição conforme
as regras funcionais vigentes.

A busca e os controles de filtro desenhados no PNG dependem de requisito e
contrato próprios. A organização por categoria prevista na HU-03 não exige
busca. Não ativar destinos da navegação inferior sem fluxo correspondente.

---

## Navegação

### Produto em destaque

A ação:

`Ver produto`

abre o detalhe do produto correspondente.

### Cards de produto

A ação visual presente no card representa navegação para o detalhe do produto.

Ela **não representa inclusão direta no carrinho**.

Fluxo esperado:

`Vitrine → Detalhe do produto → Personalização/quantidade → Carrinho`

---

## Regra de carrinho

A tela Storefront não executa inclusão direta de produtos no carrinho.

A confirmação das condições aplicáveis ao produto ocorre no detalhe,
incluindo quando pertinente:

- disponibilidade;
- personalizações;
- quantidade;
- preço recalculado;
- inclusão no carrinho.

---

## Massa de demonstração

Os seguintes dados apresentados na referência são conteúdo de demonstração:

- nomes dos cupcakes;
- descrições;
- preços;
- categorias;
- imagens.

Esses dados demonstram atributos que existem no domínio.

A implementação real deverá receber o conteúdo correspondente por meio da API.

---

## Regra de veracidade

A tela não deve introduzir:

- promoções não previstas;
- descontos não previstos;
- avaliações;
- favoritos;
- rankings;
- selos promocionais;
- promessas de prazo;
- promessas de ingredientes;
- promessas de fabricação;
- promessas de embalagem;
- benefícios comerciais não documentados;
- funcionalidades não previstas.

A interface deve afirmar apenas aquilo que puder ser sustentado por requisito,
regra de negócio ou funcionalidade implementada.

---

## Estados

Além do estado principal representado em `storefront.png`, a implementação
deve contemplar:

### Loading

Enquanto os produtos são carregados.

Não apresentar estado vazio antes da conclusão da requisição.

### Catálogo vazio

Quando não existirem produtos disponíveis para exposição.

Deve apresentar mensagem clara sem sugerir falha.

### Erro

Quando não for possível obter o catálogo.

Deve:

- informar o problema;
- permitir nova tentativa;
- não apresentar informação antiga como atual sem indicação.

### Sessão expirada

Quando uma operação exigir sessão válida e a autenticação não estiver mais
disponível.

O comportamento deve seguir as regras globais de autenticação.

---

## Acessibilidade

A implementação deve preservar:

- ordem lógica de leitura;
- semântica dos elementos interativos;
- descrição adequada de imagens relevantes;
- contraste suficiente;
- ação principal identificável;
- alvo de toque adequado;
- suporte a ampliação de texto;
- conteúdo não dependente somente de cor.

---

## Responsividade

A referência visual foi aprovada para viewport-base de 390 dp.

A implementação também deverá ser verificada em:

- 320 dp;
- 430 dp;
- texto ampliado;
- diferentes alturas de conteúdo.

Nome, preço e ação de navegação não podem ser cortados de forma que impeça
a compreensão ou uso da tela.

---

## Referência visual

A implementação deve preservar a linguagem visual aprovada em
`storefront.png`, respeitando também:

- `docs/design/DESIGN_SYSTEM.md`;
- `docs/design/NAVIGATION.md`;
- `docs/design/SCREEN_STATES.md`;
- `.ai/DESIGN.md`.

Em caso de conflito, requisitos funcionais e regras de negócio prevalecem
sobre a referência visual.
