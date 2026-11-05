# Auditoria funcional de UX e navegação — Mobile

## Resultado

| Área | Estado | Resultado |
|---|---|---|
| Navegação inferior | Corrigido; validado em runtime | Cardápio abre a vitrine; Carrinho abre o carrinho; Pedidos abre a lista. Os três destinos são distintos. |
| Delivery e Retirada | Corrigido; validado em runtime | As duas escolhas feitas na vitrine seguem pelo carrinho até a etapa de recebimento. Retirada chegou à revisão com frete zero. Delivery chegou à etapa de recebimento e ficou bloqueado para avançar sem endereço cadastrado. |
| Preferências entre sessões | Validado em runtime | Após logout/login da conta sintética, a modalidade voltou sem seleção e o carrinho permaneceu vazio. |
| Busca | Corrigido; validado em runtime | Resultado encontrado, estado sem resultados e limpeza da busca restaurando o catálogo. |
| Detalhe do produto | Corrigido; validado em runtime | Personalização disponível, quantidade, preço unitário de R$ 22,40, subtotal de R$ 44,80 e atalho direto ao carrinho. |
| Carrinho | Corrigido; validado em runtime | Item, personalização, quantidade 2, alteração para 3 e retorno a 2, subtotal, remoção e avanço ao checkout. O ensaio foi removido ao final. |
| Pedidos | Validado em runtime | A lista abriu pelo destino Pedidos. Não há CTA inerte “Ver pedido”. A conta sintética não tinha pedidos. |
| Logout | Validado em runtime | A sessão encerrou e retornou à tela pública de login. |
| Perfil e detalhe do pedido | Não implementado por ausência de tela/contrato | Perfil não existe como tela cliente. A API de pedidos do cliente oferece lista resumida, sem leitura de detalhe por ID; não há rota de detalhe nem CTA correspondente. |
| Revisão de Delivery | Não aplicável nesta sessão | A conta sintética não tinha endereço cadastrado; o checkout bloqueou corretamente o avanço em Delivery. Nenhum endereço ou pedido foi criado para simular esse contrato. |

## Sessão e instalação usadas

- Simulator: iPhone Air, iOS 27.0, 420 × 912 pt.
- Antes do cadastro, o app estava autenticado. O comando `Sair` retornou à tela pública de login, confirmando o encerramento da sessão anterior.
- Cadastro criado pelo formulário normal e confirmado pelo app; login subsequente abriu a vitrine autenticada. Identificador: `ux.navigation.20261105.115658@example.test`.
- Não registrar nem armazenar senha neste relatório.
- A conta foi desconectada, autenticada novamente para verificar reinício de modalidade/carrinho e desconectada ao final. O carrinho do ensaio foi esvaziado antes do último logout.
- A build Debug para simulador foi recompilada neste worktree com `API_BASE_URL=https://api-staging.qosit.cloud` e instalada no iPhone Air. As capturas `02` a `12` e `14` são dessa instalação; `01` registra o primeiro login após o cadastro.

## Conferência do total do carrinho

A execução anterior começou com um item base de Noir Cacau & Framboesa, quantidade 1, a R$ 18,90. O item personalizado adicionado nessa execução tinha preço unitário de R$ 22,40 (base R$ 18,90 + Calda extra de framboesa R$ 3,50), quantidade 2 e subtotal de R$ 44,80. Assim:

```text
R$ 18,90 (item que já estava no carrinho)
+ R$ 44,80 (item novo personalizado, 2 × R$ 22,40)
= R$ 63,70 (total exibido)
```

As evidências `prior-run-01-cart-before-add.png` e `prior-run-02-cart-after-add.png` documentam as linhas anteriores. A soma confere; R$ 63,70 não era o subtotal do item novo.

Na sessão sintética, o carrinho iniciou em R$ 0,00. Um primeiro ensaio mostrou duas linhas personalizadas idênticas após a inclusão; removi a linha excedente. Repeti a inclusão uma vez, aguardando o botão sair de “Adicionando…”, e a API retornou uma única linha: 2 × R$ 22,40 = R$ 44,80. A ocorrência extra não se reproduziu na repetição controlada. Alterar a quantidade no carrinho para 3 produziu R$ 67,20; retornar a 2 restaurou R$ 44,80. Removi o item ao final.

## Evidências runtime

As capturas desta execução ficam em `evidence/ux-navigation/`:

- `01-new-session-storefront.png` — vitrine após o cadastro/login sintético.
- `02-storefront-delivery.png` — Delivery selecionado na vitrine.
- `03-search-found.png`, `04-search-empty.png` — busca com e sem resultado; limpar foi exercitado e restaurou o produto.
- `05-orders-empty.png` — lista sem pedidos e sem CTA “Ver pedido”.
- `06-product-customized.png` — personalização, quantidade 2 e subtotal R$ 44,80.
- `07-cart-item.png` — linha única com quantidade e personalização no carrinho.
- `08-checkout-delivery.png`, `09-checkout-pickup.png`, `10-checkout-review-pickup.png` — modalidades no checkout e revisão real de Retirada.
- `11-new-session-reset.png` — estado da vitrine após logout/login, sem modalidade selecionada.
- `12-storefront-pickup.png` — Retirada selecionada na vitrine e propagada pelo carrinho à etapa de recebimento.
- `14-new-session-cart-empty.png` — carrinho vazio depois de logout/login da conta sintética.
- `prior-run-01-cart-before-add.png`, `prior-run-02-cart-after-add.png` — evidência da composição matemática da execução anterior; não são da sessão sintética atual.

Nenhum pedido ou pagamento foi confirmado. O checkout foi exercitado até a revisão de Retirada. Para avançar Delivery nesta conta seria necessário cadastrar um endereço real suportado pelo backend.

## Limites de produto e contrato

- A API mobile do cliente documenta `GET /pedidos` com dados resumidos; não foi encontrado endpoint autenticado de detalhe por ID. Não implementar agora detalhe ou CTA de pedido.
- Não há tela de Perfil do cliente nesta base; logout permanece no AppBar.
- A modalidade é estado da instância autenticada da vitrine, compartilhado com carrinho e checkout. Ela não é persistida depois de logout.
- O fluxo de pagamento não foi iniciado; não houve pedido ou transação para validar.

## Quality gate

- `flutter analyze`: PASS (`No issues found!`).
- `flutter test`: PASS (253 testes; `All tests passed!`).
- `git diff --check`: PASS.
