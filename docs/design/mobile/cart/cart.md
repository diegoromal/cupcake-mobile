# Cart

## Metadados

- **ID:** `mobile.cart.cart`
- **Versão:** `v1`
- **Status:** aprovada
- **Perfil:** CLIENTE
- **HU principais:** HU-05, HU-06
- **Relacionadas:** HU-07, HU-12
- **Origem visual:** Google Stitch
- **Viewport-base:** 390 dp
- **Referência visual:** `cart.png`

---

## Objetivo

Permitir que o cliente revise os itens adicionados ao carrinho antes de seguir
para a definição ou confirmação da modalidade de atendimento e das etapas
seguintes do pedido.

A tela deve permitir revisar os produtos escolhidos, personalizações,
quantidades e valores calculados.

---

## Requisitos funcionais representados

A tela representa:

- modalidade Delivery;
- modalidade Retirada;
- endereço selecionado quando aplicável;
- ação para alterar o endereço;
- listagem dos itens selecionados;
- imagem do produto;
- nome do produto;
- personalizações escolhidas;
- preço unitário;
- quantidade;
- subtotal do item;
- alteração de quantidade;
- remoção individual do item;
- subtotal dos itens;
- frete calculado quando aplicável;
- valor total do carrinho;
- ação para continuar o fluxo.

---

## Itens do carrinho

Cada item deve representar os dados efetivamente persistidos ou calculados pelo
sistema.

O item pode apresentar:

- imagem;
- nome do produto;
- personalizações selecionadas;
- preço unitário;
- quantidade;
- subtotal.

As personalizações exibidas são aquelas já escolhidas no detalhe do produto.

A tela não deve permitir que textos visuais criem novas regras de
personalização.

---

## Alteração de quantidade

Os controles `-` e `+` alteram a quantidade do item.

A implementação deve:

- impedir quantidade inválida;
- recalcular o subtotal do item;
- recalcular o subtotal geral;
- recalcular o total;
- verificar disponibilidade conforme as regras vigentes;
- impedir operações concorrentes incoerentes.

Quando uma alteração estiver sendo processada, a interface deve impedir
submissões duplicadas quando necessário.

---

## Remoção de item

O ícone de remoção deve excluir somente o item correspondente.

A tela não possui ação global de "Limpar carrinho".

A remoção deve resultar em:

- atualização da lista;
- atualização do subtotal;
- atualização do frete quando necessário;
- atualização do total.

Quando o último item for removido, a tela deve entrar no estado de carrinho
vazio.

---

## Modalidade

A tela permite distinguir:

- Delivery;
- Retirada.

### Delivery

Quando Delivery estiver selecionado:

- o endereço escolhido deve ser apresentado;
- deve existir ação para alterar o endereço;
- o frete deve ser obtido conforme a regra de cálculo vigente.

### Retirada

Quando Retirada estiver selecionada:

- não deve haver promessa de tempo;
- o frete deve ser zero;
- a interface não deve inventar benefícios adicionais.

A referência visual não define tempos estimados de atendimento.

---

## Endereço

O endereço exibido é massa de demonstração de uma entidade existente no
domínio.

A implementação real deverá apresentar o endereço selecionado pelo cliente.

A ação `Trocar` deve levar ao fluxo apropriado de seleção ou alteração do
endereço.

---

## Valores

O resumo deve apresentar somente valores sustentados pelas regras do sistema.

Pode conter:

- subtotal dos itens;
- frete;
- total.

### Subtotal dos itens

Representa a soma dos subtotais dos itens do carrinho.

### Frete

Quando Delivery estiver selecionado, o valor deve ser calculado pelo sistema.

O valor apresentado em `cart.png` é massa de demonstração e não representa
tarifa fixa.

Quando Retirada estiver selecionada, o frete deve ser zero.

### Total

O total deve refletir:

`subtotal dos itens + frete`

considerando as regras vigentes.

A interface não deve introduzir:

- cupons;
- descontos;
- parcelamento;
- taxas extras;
- benefícios;
- promoções;

sem requisito correspondente.

---

## Ação principal

A ação principal da tela é:

`Continuar`

Ela deve levar à próxima etapa prevista pelo fluxo vigente.

A referência visual não presume regras adicionais além das definidas no
backlog, domínio e navegação oficial.

Quando o carrinho não puder prosseguir, a ação deve ficar desabilitada.

---

## Carrinho vazio

Quando não existirem itens:

- não apresentar resumo financeiro como se houvesse valores;
- informar claramente que o carrinho está vazio;
- oferecer caminho coerente de retorno à vitrine;
- não tratar o estado como erro.

---

## Estoque insuficiente ou item indisponível

Se um item não puder mais ser adquirido nas condições atuais:

- comunicar o problema de forma clara;
- identificar o item afetado;
- não depender somente de cor;
- impedir o avanço enquanto a inconsistência relevante não for resolvida;
- permitir correção da quantidade ou remoção quando aplicável.

A interface não deve prometer reserva de estoque se essa regra não estiver
formalmente definida.

---

## Recalculo

Alterações que afetem valores devem refletir no resumo.

Exemplos:

- quantidade;
- remoção de item;
- modalidade;
- endereço;
- frete.

A tela não deve manter totais visualmente desatualizados como se fossem
válidos.

---

## Massa de demonstração

São dados de demonstração na referência:

- endereço;
- nomes dos produtos;
- imagens;
- personalizações;
- preços;
- quantidades;
- valor de frete.

Esses dados existem apenas para representar a estrutura visual.

Eles não constituem valores fixos ou regras comerciais.

---

## Regra de veracidade

A tela não deve introduzir funcionalidades ou promessas não sustentadas pelo
produto.

Não adicionar, sem requisito correspondente:

- prazo de entrega;
- prazo de retirada;
- cupons;
- descontos;
- parcelamento;
- frete fixo;
- brindes;
- embalagem presente;
- promoções;
- compartilhamento;
- qualquer outro benefício comercial.

---

## Estados

Além do estado principal representado em `cart.png`, a implementação deve
contemplar:

### Carrinho com itens

Estado principal.

### Carrinho vazio

Nenhum item selecionado.

### Recalculo em andamento

Durante alteração de quantidade, remoção ou atualização de valores.

A interface deve evitar operações concorrentes inconsistentes.

### Estoque insuficiente

Quando a quantidade desejada não puder ser atendida.

### Item indisponível

Quando um produto ou condição necessária deixar de estar disponível.

### Erro

Quando uma operação do carrinho falhar.

A interface deve:

- informar o problema;
- preservar estado consistente;
- permitir nova tentativa quando apropriado.

### Continuar desabilitado

A ação principal deve ficar indisponível quando o carrinho não atender às
condições necessárias para seguir no fluxo.

---

## Acessibilidade

A implementação deve preservar:

- ordem lógica de leitura;
- semântica dos controles de quantidade;
- identificação acessível da ação de remoção;
- contraste adequado;
- alvos de toque confortáveis;
- feedback textual para erros;
- informação não dependente somente de cor;
- suporte a texto ampliado.

Ícones sem texto visível devem possuir descrição semântica adequada.

---

## Responsividade

A referência visual foi aprovada para 390 dp.

A implementação deve ser verificada também em:

- 320 dp;
- 430 dp;
- texto ampliado;
- nomes maiores de produtos;
- maior número de personalizações.

As seguintes informações não podem ficar inacessíveis ou sobrepostas:

- quantidade;
- preço;
- subtotal;
- total;
- ação principal.

---

## Navegação

Fluxo relacionado:

`Storefront`
→ `Product Detail`
→ `Cart`
→ próxima etapa do checkout

A navegação completa deve seguir:

- `docs/design/NAVIGATION.md`

---

## Referências

A implementação deve observar também:

- `docs/design/DESIGN_SYSTEM.md`
- `docs/design/NAVIGATION.md`
- `docs/design/SCREEN_STATES.md`
- `.ai/DESIGN.md`

Em caso de conflito, requisitos funcionais e regras de negócio prevalecem sobre
a referência visual.
