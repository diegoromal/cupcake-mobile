# Product Detail

## Metadados

- **ID:** `mobile.catalog.product-detail`
- **Versão:** `v1`
- **Status:** aprovada
- **Perfil:** CLIENTE
- **HU principal:** HU-04
- **Origem visual:** Google Stitch
- **Viewport-base:** 390 dp
- **Referência visual:** `product-detail.png`

---

## Objetivo

Permitir que o cliente visualize as informações detalhadas de um cupcake,
selecione personalizações disponíveis, ajuste a quantidade e adicione o item
ao carrinho com o preço recalculado.

---

## Requisitos funcionais representados

A tela representa:

- retorno à vitrine;
- imagem do produto;
- categoria;
- nome;
- descrição;
- preço base;
- disponibilidade;
- personalizações disponíveis;
- acréscimo de preço por personalização quando aplicável;
- estado selecionado;
- estado indisponível;
- quantidade;
- preço total recalculado;
- inclusão no carrinho.

---

## Disponibilidade

A indicação visual de disponibilidade representa apenas se o produto pode ou
não ser adquirido.

A interface não deve inferir nem exibir quantidade física de estoque sem
requisito específico para isso.

Produto sem estoque deve:

- comunicar indisponibilidade claramente;
- impedir inclusão no carrinho;
- não depender somente de cor para comunicar o estado.

---

## Personalizações

As opções exibidas em `product-detail.png` são exemplos de dados recebidos
da API.

Cada personalização pode representar:

- nome;
- descrição;
- acréscimo de preço;
- disponibilidade;
- estado de seleção.

A interface não deve inferir, sem regra de domínio correspondente:

- categoria fixa de personalização;
- seleção obrigatória;
- seleção exclusiva;
- quantidade mínima ou máxima;
- grupos obrigatórios;
- regras especiais de combinação.

---

## Preço

O preço exibido no topo representa o preço base do produto.

O total apresentado junto à ação principal deve refletir:

- preço base;
- personalizações selecionadas;
- quantidade.

A interface não deve recalcular regras comerciais inexistentes.

---

## Quantidade

O controle de quantidade permite alterar a quantidade do item antes da
inclusão no carrinho.

A implementação deve impedir valores inválidos conforme as regras funcionais
vigentes.

---

## Adicionar ao carrinho

A ação `Adicionar ao carrinho` deve utilizar:

- produto selecionado;
- personalizações selecionadas;
- quantidade;
- preço calculado conforme as regras vigentes.

Durante o envio:

- impedir submissão duplicada;
- indicar visualmente processamento;
- manter estado coerente até resposta da operação.

Após sucesso:

- apresentar confirmação clara;
- não presumir navegação automática para outra tela sem regra definida.

---

## Massa de demonstração

São dados demonstrativos da referência visual:

- nome do cupcake;
- descrição;
- preço;
- categoria;
- imagem;
- nomes das personalizações;
- descrições das personalizações;
- valores adicionais.

Eles demonstram atributos existentes no domínio, mas não constituem dados
fixos do produto.

---

## Estados

Além do estado principal representado em `product-detail.png`, a
implementação deverá contemplar:

### Produto disponível

Permite seleção e inclusão no carrinho.

### Produto sem estoque

Ação de inclusão fica indisponível.

### Personalização selecionada

Estado visual claro e acessível.

### Personalização indisponível

Deve permanecer não interativa e visualmente identificável.

### Inclusão em andamento

Ação principal deve ficar desabilitada para evitar duplicidade.

### Item adicionado

Mostrar confirmação clara da operação concluída.

### Erro

Quando a operação falhar:

- informar o problema;
- preservar o estado possível da tela;
- permitir nova tentativa quando adequado.

---

## Acessibilidade

A implementação deve preservar:

- ordem lógica de leitura;
- semântica dos controles;
- identificação de estados selecionado e indisponível;
- contraste suficiente;
- alvos de toque adequados;
- suporte a texto ampliado;
- informação não dependente somente de cor.

---

## Responsividade

A referência foi aprovada para 390 dp.

A implementação deve ser verificada também em:

- 320 dp;
- 430 dp;
- texto ampliado;
- conteúdo com nomes e descrições maiores.

Preço, quantidade e ação principal não podem ficar inacessíveis ou sobrepostos.

---

## Referências

A implementação deve observar também:

- `docs/design/DESIGN_SYSTEM.md`
- `docs/design/NAVIGATION.md`
- `docs/design/SCREEN_STATES.md`
- `.ai/DESIGN.md`

Em caso de conflito, requisitos funcionais e regras de negócio prevalecem sobre
a referência visual.
