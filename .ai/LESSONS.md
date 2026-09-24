# Lições Aprendidas

Registro enxuto de problemas recorrentes que devem melhorar o processo.

## Formato

``` text
Data:
Contexto:
Falha:
Causa:
Recorrente? sim/não
Ação preventiva:
Arquivo/regra/teste atualizado:
```

## Regra de promoção

-   Incidente isolado: corrigir e registrar somente se houver valor
    futuro.
-   Padrão recorrente: transformar em regra, teste, quality gate ou
    automação.
-   Regra obsoleta: remover ou simplificar.

## Lições iniciais

### Autorização

Todo endpoint protegido deve possuir autorização explícita por regra
centralizada/guard adequado. Autenticação sozinha não implica
autorização.

### Estado de pedido

Transições de status devem obedecer à máquina de estados; não aceitar
status arbitrário fornecido pelo cliente.

### Estoque

Reserva, confirmação de venda, expiração e cancelamento devem preservar
invariantes de estoque e utilizar transação quando houver risco de
concorrência.

## Rastreabilidade entre backlog e commit

**Contexto:** D01 — Fundação do Monorepo.

**Problema:** o commit de conclusão utilizava `Task: D01`, enquanto o backlog ainda utilizava `01` e permanecia com a tarefa pendente.

**Causa:** o fluxo não exigia explicitamente a atualização do backlog antes do commit.

**Melhoria:** padronizar os desafios como `D01...D116` e exigir que a conclusão da tarefa seja registrada no backlog antes do commit correspondente.

**Prevenção:** o quality gate deve verificar critérios de aceite, evidências, status do backlog e correspondência do `Task ID` antes do commit.
