# Padrão de Commits

## Objetivo

Manter o histórico Git legível, rastreável e útil para revisão, auditoria, rollback e melhoria contínua.

## Formato

    <tipo>(<escopo>): <descrição>

    Task: D<numero>
    Requirement: HU-<numero>

`Task` e `Requirement` são opcionais quando não existirem.

Nunca invente identificadores apenas para preencher a mensagem.

## Tipos oficiais

- `feat`: nova funcionalidade.
- `fix`: correção de defeito.
- `test`: criação ou alteração de testes.
- `refactor`: alteração interna sem mudança intencional de comportamento.
- `perf`: melhoria de desempenho.
- `security`: melhoria ou correção de segurança.
- `docs`: documentação.
- `build`: build, dependências ou empacotamento.
- `ci`: pipeline e automação de integração ou entrega.
- `chore`: manutenção não coberta pelos tipos anteriores.

## Escopos preferenciais do Cupcake Mobile

`auth`, `user`, `catalog`, `category`, `product`, `customization`, `stock`, `cart`, `address`, `delivery`, `order`, `payment`, `notification`, `report`, `admin`, `mobile`, `api`, `database`, `infra`, `docs`.

O escopo pode ser omitido quando não acrescentar informação.

## Descrição

- Use português.
- Use descrição objetiva no presente, como `implementa`, `corrige`, `adiciona`, `remove` ou `atualiza`.
- Descreva o resultado da alteração, não o processo de edição.
- Seja curto e específico.
- Não termine o assunto com ponto final.

## Atomicidade

Um commit deve representar uma única mudança lógica coerente.

Não misture feature, correção ou refatoração não relacionada no mesmo commit.

O código versionado deve permanecer em estado consistente e verificável.

## Rastreabilidade

Quando a alteração estiver associada a uma tarefa do backlog, informe `Task`.

Quando estiver associada a uma história de usuário, informe também `Requirement`.

Exemplo:

    feat(auth): implementa cadastro de cliente

    Task: D10
    Requirement: HU-01

Alterações de infraestrutura, documentação ou processo podem não possuir uma história de usuário correspondente.

Nesse caso, não invente `Requirement`.

## Breaking change

Use `!` no cabeçalho e descreva a quebra no corpo:

    feat(api)!: altera contrato de criação de pedido

    Task: D48
    Requirement: HU-09

    BREAKING CHANGE: o endpoint agora exige deliveryMethod.

## Bug e causa raiz

Quando a causa raiz for conhecida e agregar rastreabilidade, registre-a no corpo:

    fix(stock): impede reserva acima do estoque disponível

    Task: D50
    Requirement: HU-15

    Root-Cause: validação ocorria fora da transação.

## Exemplos

    feat(auth): implementa cadastro de cliente
    fix(stock): libera reserva de pedido expirado
    test(payment): cobre pagamento recusado
    refactor(order): simplifica validação de transições
    docs(database): atualiza dicionário de dados
    chore: configura estrutura inicial do projeto

## Regras para agentes de IA

- Analise somente alterações efetivamente presentes no diff ou staging.
- Não invente Task, Requirement, causa raiz ou breaking change.
- Não execute `git commit`, `push`, `merge`, `rebase`, `reset` destrutivo ou criação de tag sem solicitação explícita do usuário.
- Ao sugerir commit, retorne somente a mensagem quando o prompt `COMMIT` for usado.
