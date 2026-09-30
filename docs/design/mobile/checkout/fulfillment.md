# Fulfillment

## Metadados

- **ID:** `mobile.checkout.fulfillment`
- **Versão:** `v1`
- **Status:** aprovada
- **Perfil:** CLIENTE
- **HU principais:** HU-07, HU-12
- **Origem visual:** Google Stitch
- **Viewport-base:** 390 dp
- **Referência visual:** `fulfillment.png`

---

## Objetivo

Permitir que o cliente defina como deseja receber o pedido, escolhendo entre
Delivery e Retirada.

Quando Delivery estiver selecionado, a tela deve apresentar o endereço escolhido,
permitir sua alteração e exibir o frete calculado pelo sistema.

Quando Retirada estiver selecionada, a tela deve refletir essa modalidade sem
inventar prazo, benefício ou condição adicional.

---

## Requisitos funcionais representados

A tela representa:

- ação de voltar;
- escolha entre Delivery e Retirada;
- endereço selecionado para Delivery;
- ação para trocar o endereço;
- cálculo de frete;
- valor de frete retornado pelo sistema;
- resumo da modalidade selecionada;
- ação para continuar.

---

## Modalidades

A tela deve permitir ao cliente escolher entre:

- Delivery;
- Retirada.

Somente uma modalidade pode estar ativa por vez.

A interface deve deixar visualmente claro qual modalidade está selecionada.

---

## Delivery

Quando Delivery estiver selecionado:

- deve existir endereço válido selecionado;
- o endereço deve ser apresentado ao cliente;
- deve existir ação para trocar o endereço;
- o frete deve ser calculado pelo sistema;
- o valor calculado deve ser apresentado antes do avanço quando necessário;
- o avanço deve ser bloqueado quando faltarem informações obrigatórias.

A tela não deve apresentar prazo de entrega sem requisito específico e fonte
operacional capaz de sustentar essa informação.

---

## Endereço de entrega

O endereço apresentado em `fulfillment.png` é massa de demonstração.

A implementação real deve exibir o endereço selecionado pelo cliente.

Podem ser apresentados, conforme os dados disponíveis:

- logradouro;
- número;
- complemento;
- bairro;
- cidade;
- estado;
- CEP.

A interface não deve inventar dados ausentes.

---

## Trocar endereço

A ação:

`Trocar endereço`

deve levar ao fluxo apropriado de seleção ou alteração do endereço.

A referência visual não define como esse fluxo será implementado internamente.

A navegação deve seguir o contrato oficial registrado em:

`docs/design/NAVIGATION.md`

---

## Cálculo de frete

Quando Delivery estiver selecionado, o valor de frete deve ser obtido pela regra
vigente do sistema.

A interface deve representar claramente quando o frete estiver:

- sendo calculado;
- calculado com sucesso;
- indisponível por erro;
- impossibilitado por endereço fora da cobertura.

O valor `R$ 8,50` exibido em `fulfillment.png` é apenas massa de demonstração.

Ele não representa:

- tarifa fixa;
- preço mínimo;
- preço máximo;
- tabela comercial permanente;
- promessa de cobrança futura.

---

## Retirada

Quando Retirada estiver selecionada:

- o pedido deve ser identificado como retirada;
- não deve ser exigido endereço de entrega para essa modalidade;
- o frete deve ser zero;
- a tela não deve apresentar prazo de retirada sem requisito correspondente;
- a tela não deve apresentar benefício promocional por escolher retirada.

A indicação de frete zero representa regra funcional, não campanha promocional.

---

## Resumo da modalidade

O bloco de resumo deve confirmar de forma simples a escolha atual.

Para Delivery, pode apresentar:

- modalidade;
- valor de frete calculado.

Para Retirada, deve apresentar:

- modalidade;
- frete igual a zero, quando necessário ao resumo financeiro.

O resumo não deve introduzir informações não sustentadas pelo sistema.

---

## Ação principal

A ação principal da tela é:

`Continuar`

Ela deve permitir avanço apenas quando o estado atual estiver válido.

A ação deve ficar desabilitada quando, por exemplo:

- Delivery estiver selecionado sem endereço válido;
- o endereço estiver fora da cobertura;
- o frete obrigatório ainda estiver sendo calculado;
- o cálculo necessário tiver falhado e ainda não houver valor válido;
- qualquer outra pré-condição funcional necessária não estiver atendida.

A interface não deve permitir múltiplos avanços concorrentes enquanto a ação
estiver sendo processada.

---

## Estados

Além do estado principal representado em `fulfillment.png`, a implementação deve
contemplar os estados abaixo.

### Delivery com endereço válido

Estado principal.

Deve apresentar:

- Delivery selecionado;
- endereço;
- ação para trocar endereço;
- frete calculado;
- botão Continuar disponível.

---

### Delivery sem endereço

Quando não houver endereço selecionado:

- não apresentar endereço fictício;
- informar claramente que um endereço precisa ser informado;
- oferecer ação apropriada para selecionar ou cadastrar endereço;
- manter o avanço desabilitado enquanto necessário.

---

### Endereço inválido

Quando os dados do endereço não puderem ser aceitos:

- informar o problema;
- indicar a necessidade de correção;
- não depender somente de cor;
- impedir avanço enquanto o problema for bloqueante.

A interface não deve inventar a regra que tornou o endereço inválido.

---

### Fora da área de cobertura

Quando o sistema determinar que o endereço não está dentro da cobertura:

- comunicar de forma clara;
- impedir o avanço por Delivery;
- permitir ao cliente alterar o endereço;
- permitir escolher Retirada quando essa opção estiver disponível.

A tela não deve exibir raio, distância ou limite geográfico sem requisito
correspondente.

---

### Cálculo de frete em andamento

Durante o cálculo:

- indicar processamento;
- não apresentar valor antigo como se fosse atual;
- impedir ações concorrentes que possam gerar estado incoerente;
- desabilitar Continuar quando o frete for pré-condição para avanço.

---

### Frete calculado

Quando o cálculo for concluído:

- apresentar o valor retornado pelo sistema;
- atualizar o resumo;
- permitir avanço quando todas as demais condições forem válidas.

---

### Erro no cálculo de frete

Quando houver falha:

- informar que não foi possível calcular o frete;
- não inventar um valor;
- permitir nova tentativa quando apropriado;
- manter o avanço bloqueado se o frete for obrigatório.

A tela não deve assumir automaticamente que o endereço está fora da cobertura
quando o problema for apenas técnico.

---

### Retirada selecionada

Quando Retirada estiver ativa:

- esconder ou despriorizar informações exclusivas de Delivery;
- não exigir endereço de entrega;
- aplicar frete zero;
- permitir avanço quando as demais condições estiverem válidas.

---

### Continuar desabilitado

O estado desabilitado deve ser visualmente perceptível e semanticamente
comunicado.

O motivo do bloqueio deve ser compreensível ao usuário quando necessário.

---

## Massa de demonstração

São dados de demonstração presentes em `fulfillment.png`:

- endereço;
- CEP;
- bairro;
- cidade;
- valor de frete.

Esses dados representam a estrutura da interface e não valores fixos do produto.

---

## Regra de veracidade

A tela não deve apresentar como fato qualquer condição que o sistema não possa
garantir.

Não adicionar, sem requisito correspondente:

- prazo de entrega;
- prazo de retirada;
- frete fixo;
- raio de cobertura;
- distância máxima;
- valor mínimo de compra;
- promoção;
- desconto;
- benefício comercial;
- geolocalização automática;
- cálculo por mapa;
- estimativa operacional;
- qualquer outra promessa não sustentada.

---

## Relação com o carrinho

A modalidade escolhida nesta etapa pode afetar:

- necessidade de endereço;
- cálculo de frete;
- total do pedido.

A implementação deve manter consistência entre os valores apresentados no carrinho,
nesta etapa e nas etapas seguintes.

Valores antigos não devem permanecer visíveis como se fossem atuais após uma
mudança relevante de modalidade ou endereço.

---

## Navegação

Fluxo principal relacionado:

`Cart`
→ `Fulfillment`
→ `Order Review`
→ `Payment`

A tela deve permitir retorno ao carrinho sem inventar uma nova regra de descarte ou
persistência de dados.

A navegação completa deve seguir:

`docs/design/NAVIGATION.md`

---

## Acessibilidade

A implementação deve preservar:

- ordem lógica de leitura;
- identificação clara da modalidade selecionada;
- rótulo acessível para Delivery e Retirada;
- foco apropriado;
- contraste suficiente;
- alvos de toque confortáveis;
- mensagens de erro associadas ao problema correspondente;
- informação não dependente somente de cor;
- suporte a texto ampliado;
- semântica adequada da ação de trocar endereço;
- semântica adequada do botão Continuar.

---

## Responsividade

A referência visual foi aprovada para viewport-base de 390 dp.

A implementação deve ser verificada também em:

- 320 dp;
- 430 dp;
- texto ampliado;
- endereços maiores;
- valores monetários maiores;
- teclado aberto quando houver entrada de dados em fluxos relacionados.

Não podem ficar inacessíveis ou sobrepostos:

- modalidade;
- endereço;
- frete;
- resumo;
- ação principal.

---

## Referências

A implementação deve observar também:

- `docs/design/DESIGN_SYSTEM.md`
- `docs/design/NAVIGATION.md`
- `docs/design/SCREEN_STATES.md`
- `.ai/DESIGN.md`

Em caso de conflito, requisitos funcionais, modelo de domínio e regras de negócio
prevalecem sobre a referência visual.

A imagem `fulfillment.png` representa a composição visual aprovada, mas não cria
novas regras funcionais.
