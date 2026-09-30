# Sales Report

## Metadados

- **ID:** `admin.reports.sales-report`
- **Versão:** `v1`
- **Status:** aprovada
- **Perfil:** ADMIN
- **HU principal:** HU-18
- **Origem visual:** Google Stitch
- **Viewport-base:** 1440 px
- **Referência visual:** `sales-report.png`

---

## Objetivo

Permitir que o administrador consulte o resultado de vendas de um período
selecionado e exporte os dados nos formatos suportados.

A tela deve apresentar somente informações sustentadas pelo domínio e pelas
regras vigentes de relatório.

---

## Requisitos funcionais representados

A tela representa:

- navegação administrativa;
- título `Relatório de vendas`;
- data inicial;
- data final;
- ação `Aplicar período`;
- período aplicado;
- total vendido;
- quantidade de pedidos;
- listagem dos pedidos que compõem o relatório;
- exportação em PDF;
- exportação em CSV.

A apresentação de apenas parte dos pedidos no PNG não define paginação. A
implementação deve garantir acesso aos pedidos que compõem o relatório; qualquer
paginação depende do contrato da tarefa futura.

---

## Período

O relatório deve permitir consulta por intervalo de datas.

A interface deve solicitar:

- data inicial;
- data final.

O período aplicado deve corresponder aos valores utilizados na consulta exibida.

A referência visual utiliza datas demonstrativas.

---

## Validação do período

O período deve ser considerado inválido quando não atender às regras funcionais
vigentes.

Exemplos de situações que podem exigir validação:

- data inicial ausente;
- data final ausente;
- intervalo inconsistente.

A interface não deve corrigir silenciosamente um período inválido.

Quando inválido:

- informar claramente o problema;
- impedir consulta inconsistente;
- permitir correção.

---

## Pedidos elegíveis

O relatório deve considerar somente pedidos finalizados elegíveis conforme o
domínio consolidado.

Estados considerados:

- `Entregue`;
- `Retirado`.

Não devem compor os totais desta referência:

- Pendente de pagamento;
- Pago;
- Em preparo;
- Saiu para entrega;
- Pronto para retirada;
- Cancelado;
- Expirado.

A implementação deve seguir o estado real do domínio vigente.

---

## Total vendido

O valor apresentado em `Total vendido` deve representar a soma dos valores dos
pedidos elegíveis dentro do período aplicado.

A tela não deve utilizar pedidos não elegíveis no cálculo.

O valor presente em `sales-report.png` é massa de demonstração.

---

## Quantidade de pedidos

A quantidade deve representar o número de pedidos elegíveis considerados no
relatório para o período aplicado.

Essa informação não representa:

- meta;
- KPI adicional;
- projeção;
- média;
- comparação histórica.

---

## Pedidos do período

A listagem deve representar os pedidos que compõem os totais apresentados.

Pode conter:

- identificador;
- data/hora;
- cliente;
- modalidade;
- status;
- valor total.

Os valores da tabela e os cartões de resumo devem ser coerentes entre si.

---

## Status na listagem

Os exemplos visuais devem usar somente:

- Entregue;
- Retirado.

A modalidade associada deve continuar representando:

- Delivery;
- Retirada.

Não inferir que toda retirada está concluída apenas pela modalidade; o status real
deve ser `Retirado`.

---

## Cliente

A listagem pode apresentar o nome do cliente quando necessário ao relatório.

A interface não deve adicionar dados pessoais além do necessário.

---

## Modalidade

A modalidade pode ser:

- Delivery;
- Retirada.

Ela não altera sozinha a elegibilidade do pedido para o relatório.

---

## Valor total do pedido

O valor deve corresponder ao valor consolidado do pedido registrado.

O relatório não deve recalcular preços históricos com regras atuais.

---

## Exportação

A tela deve oferecer somente os formatos previstos:

- PDF;
- CSV.

Não adicionar:

- XLS;
- XLSX;
- Google Sheets;
- outros formatos não definidos.

---

## Exportação em andamento

Durante a geração do arquivo:

- indicar processamento;
- evitar múltiplas solicitações concorrentes quando necessário;
- não apresentar exportação como concluída antes da geração real;
- preservar o período e os filtros aplicados.

---

## Exportação concluída

A interface deve indicar sucesso somente após confirmação da geração do arquivo.

A referência visual principal não define mensagem específica de sucesso.

---

## Falha de exportação

Quando a exportação falhar:

- informar o problema;
- não indicar sucesso;
- permitir nova tentativa quando apropriado;
- manter os dados da consulta atual.

---

## Período sem resultados

Quando nenhum pedido elegível existir no período:

- apresentar estado vazio de forma clara;
- não tratar como erro;
- quantidade de pedidos deve refletir zero;
- total vendido deve refletir o valor coerente com ausência de vendas;
- permitir alterar o período.

A interface não deve criar registros fictícios para preencher a tabela.

---

## Loading

Durante a consulta:

- indicar processamento;
- não apresentar valores antigos como se pertencessem ao novo período;
- evitar interação inconsistente quando necessário.

---

## Erro de consulta

Quando não for possível gerar o relatório:

- informar a falha;
- não apresentar totais não confirmados como atuais;
- permitir nova tentativa quando apropriado.

---

## Paginação

O PNG não apresenta controles de paginação. A indicação de registros exibidos
é demonstrativa, não autorização para limitar a consulta. Se a tarefa futura
definir paginação, ela deve preservar:

- período aplicado;
- total vendido;
- quantidade de pedidos;
- consistência dos dados.

A paginação não altera quais pedidos pertencem ao relatório.

---

## Massa de demonstração

São dados demonstrativos em `sales-report.png`:

- período;
- identificadores;
- clientes;
- modalidades;
- status;
- valores;
- quantidade de pedidos;
- total vendido.

Esses dados representam a estrutura do relatório e não números reais do produto.

---

## Regra de veracidade

A tela não deve adicionar, sem requisito correspondente:

- ticket médio;
- lucro;
- margem;
- custos;
- impostos;
- metas;
- comparação com período anterior;
- ranking de produtos;
- ranking de clientes;
- previsão de vendas;
- projeções;
- gráficos;
- dashboard;
- métricas derivadas não definidas.

---

## Estados

Além do estado principal representado em `sales-report.png`, a implementação deve
contemplar:

### Período válido com resultados

Estado principal da referência.

### Loading

Consulta em andamento.

### Sem resultados

Nenhum pedido elegível no período.

### Período inválido

Consulta não pode ser executada até correção.

### Erro

Falha na geração ou consulta.

### Exportação em andamento

PDF ou CSV sendo preparado.

### Acesso negado

Usuário sem autorização administrativa não deve acessar os dados.

---

## Acessibilidade

A implementação deve preservar:

- campos de período corretamente rotulados;
- mensagens de validação associadas aos campos;
- navegação por teclado;
- foco visível;
- cabeçalhos de tabela semanticamente identificados;
- status não dependentes somente de cor;
- contraste adequado;
- feedback acessível durante loading e exportação.

---

## Responsividade

A referência foi aprovada para desktop.

Cenário-base:

- 1280–1440 px.

Também deve ser validada em:

- 768 px;
- 320 px quando aplicável.

Em larguras menores:

- filtros podem empilhar;
- botões de exportação devem permanecer acessíveis;
- tabela pode usar rolagem horizontal indicada;
- totais não devem desaparecer ou ficar sobrepostos.

---

## Navegação

Fluxo principal:

`Admin`
→ `Relatório de vendas`

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

A imagem `sales-report.png` representa a composição visual aprovada, mas não cria
novas regras funcionais.
