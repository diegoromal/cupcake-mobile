# Admin Order List

## Metadados

- **ID:** `admin.orders.order-list`
- **Versão:** `v1`
- **Status:** aprovada
- **Perfil:** ADMIN
- **HU principais:** HU-16, HU-17
- **Origem visual:** Google Stitch
- **Viewport-base:** 1440 px
- **Referência visual:** `order-list.png`

---

## Objetivo

Permitir que o administrador visualize os pedidos relevantes à operação da loja,
identifique seu estado atual e acesse o detalhe de cada pedido.

A tela deve apoiar o fluxo operacional sem introduzir métricas, monitoramentos ou
estados não previstos pelo domínio.

---

## Requisitos funcionais representados

A tela representa:

- navegação administrativa;
- título `Pedidos`;
- filtro por status;
- ação para limpar filtros;
- listagem tabular;
- identificador do pedido;
- data/hora;
- cliente;
- modalidade;
- status;
- valor total;
- ação `Ver detalhes`;
- contagem da listagem atual.

Busca, filtro por modalidade e paginação aparecem no PNG, mas não são
requisitos confirmados para a futura listagem. Só devem ser implementados
quando a tarefa e o contrato funcional os sustentarem.

---

## Pedidos exibidos

A listagem operacional deve considerar os pedidos compatíveis com o fluxo
administrativo vigente.

A referência principal utiliza:

- Pago;
- Em preparo;
- Saiu para entrega;
- Entregue;
- Cancelado.

`Pendente de pagamento` não aparece na referência principal da fila operacional
de produção.

Pedidos de Retirada também podem estar `Pronto para retirada` ou `Retirado`,
embora esses estados não apareçam no PNG principal.

---

## Status

A interface deve utilizar somente estados sustentados pelo domínio.

Estados operacionais representáveis:

- Pago;
- Em preparo;
- Saiu para entrega;
- Entregue;
- Pronto para retirada;
- Retirado;
- Cancelado.

Não criar estados visuais adicionais.

`Entregue` pertence a Delivery; `Retirado` pertence a Retirada. A linha de
Retirada marcada `Entregue` no PNG é uma inconsistência demonstrativa e deve
usar o status real do pedido na implementação.

O significado não deve depender somente de cor.

---

## Ordenação

A operação deve respeitar a regra vigente de organização cronológica por
confirmação de pagamento.

A interface pode permitir ordenação por data quando suportada.

A referência não cria regras alternativas de prioridade.

---

## Busca

Se for contratada, a busca poderá utilizar atributos disponíveis no domínio,
como:

- identificador do pedido;
- cliente.

Não adicionar busca por atributos não existentes.

---

## Filtro por status

O filtro por status é sustentado pela HU-17.

Ele deve utilizar somente estados válidos.

---

## Filtro por modalidade

Se for contratado, o filtro por modalidade poderá utilizar:

- Delivery;
- Retirada.

A interface não deve inventar outras modalidades.

---

## Limpar filtros

A ação de limpar filtros deve apenas restaurar a listagem sem os filtros ativos.

Ela não deve:

- alterar pedidos;
- mudar status;
- apagar dados;
- redefinir ordenação operacional além do comportamento previsto.

---

## Tabela

A tabela deve apresentar:

- identificador;
- data/hora;
- cliente;
- modalidade;
- status;
- valor total;
- ação.

A densidade visual deve priorizar leitura rápida e operação administrativa.

---

## Identificador do pedido

O identificador deve corresponder ao pedido real.

Os valores exibidos em `order-list.png` são massa de demonstração.

---

## Data e hora

A coluna de data/hora deve refletir o dado relevante para a ordenação vigente.

Quando a regra utilizada for confirmação de pagamento, a interface deve usar essa
referência temporal.

---

## Cliente

A listagem pode apresentar o nome do cliente associado ao pedido.

A tela não deve expor dados pessoais além do necessário para a operação.

---

## Modalidade

A modalidade pode ser:

- Delivery;
- Retirada.

---

## Valor total

O valor total deve refletir o valor consolidado do pedido.

A listagem não deve recalcular preços.

---

## Ação `Ver detalhes`

A ação deve abrir o detalhe operacional do pedido correspondente.

Fluxo:

`Admin Order List`
→ `Admin Order Detail`

A listagem não deve executar transições de status diretamente sem requisito
específico.

---

## Contagem da listagem

A informação:

`6 pedidos listados`

representa apenas a quantidade de registros atualmente apresentada.

Ela não constitui:

- KPI;
- indicador de desempenho;
- métrica histórica;
- meta operacional.

---

## Paginação

A paginação visual do PNG não define um contrato de consulta. Se for contratada,
deve ser implementada sem perder pedidos nem alterar a contagem real.

Ela não cria regra de negócio.

Deve preservar:

- filtros;
- busca;
- ordenação;
- consistência da listagem.

---

## Estados

Além do estado principal representado em `order-list.png`, a implementação deve
contemplar:

### Lista com pedidos

Estado principal.

### Loading

Enquanto os pedidos estão sendo carregados:

- indicar processamento;
- não apresentar estado vazio prematuramente;
- evitar ações sobre dados ainda não confirmados.

### Lista vazia

Quando não houver pedidos compatíveis:

- informar ausência de resultados;
- não tratar como erro;
- considerar filtros ativos antes de afirmar ausência global de pedidos.

### Erro

Quando não for possível obter a listagem:

- informar a falha;
- permitir nova tentativa quando apropriado;
- não apresentar dados inválidos como atuais.

### Acesso negado

Quando o usuário autenticado não possuir permissão ADMIN:

- não exibir dados administrativos;
- informar falta de permissão;
- preservar o comportamento de autorização vigente.

---

## Navegação administrativa

A referência utiliza:

- Pedidos;
- Produtos / Cardápio.

`Pedidos` deve aparecer como seção ativa.

A navegação real deve respeitar as rotas administrativas existentes.

---

## Identificação administrativa

A interface pode apresentar a identificação do usuário autenticado de forma neutra.

Não inventar papéis como:

- Operador Chefe;
- Gerente;
- Cozinha Operante;

sem regra correspondente.

---

## Massa de demonstração

São dados de demonstração em `order-list.png`:

- números dos pedidos;
- nomes dos clientes;
- datas;
- modalidades;
- status;
- valores;
- quantidade de registros.

Esses dados representam atributos reais do domínio, mas não dados fixos.

---

## Regra de veracidade

A tela não deve adicionar, sem requisito correspondente:

- operação em tempo real;
- presença de equipe;
- status de cozinha;
- previsão de preparo;
- previsão de entrega;
- gráficos;
- KPIs;
- métricas gerenciais;
- mapa;
- monitoramento;
- papéis administrativos inventados;
- estados de pedido não previstos.

---

## Acessibilidade

A implementação deve preservar:

- cabeçalhos de tabela semanticamente identificados;
- associação entre linha e ação;
- status compreensíveis sem depender somente de cor;
- navegação por teclado;
- foco visível;
- contraste adequado;
- campos e filtros corretamente rotulados;
- feedback acessível para loading e erro.

---

## Responsividade

A referência visual foi aprovada para desktop.

Cenário-base:

- 1280–1440 px.

Também deve ser validada em:

- 768 px;
- 320 px quando aplicável.

Em larguras menores:

- filtros podem empilhar;
- tabela pode utilizar rolagem horizontal indicada;
- ações devem permanecer acessíveis;
- nenhuma coluna crítica pode desaparecer silenciosamente.

---

## Navegação

Fluxo principal:

`Admin`
→ `Pedidos`
→ `Admin Order List`
→ `Admin Order Detail`

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
