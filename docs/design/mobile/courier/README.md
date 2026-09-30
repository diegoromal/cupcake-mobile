# Entregador — Referência de fluxo futuro

## Status

- **Perfil:** ENTREGADOR
- **Escopo D118:** fluxo e restrições em Markdown
- **PNG obrigatório nesta tarefa:** não
- **Detalhamento visual completo:** tarefas futuras D72–D76/D95

## Objetivo

Registrar o fluxo mínimo esperado para o entregador sem antecipar telas ou regras ainda não implementadas.

## Relação com HU

- HU-19;
- HU-20.

## Fluxo conceitual

```text
Autenticação ENTREGADOR
→ Lista de entregas atribuídas
→ Detalhe da entrega
→ Confirmação de entrega
→ Atualização/retorno à lista
```

## Lista de entregas

Deve futuramente representar somente entregas atribuídas e elegíveis segundo o domínio.

Não inventar:

- marketplace de corridas;
- aceitar/rejeitar corrida;
- mapa em tempo real;
- ranking;
- ganhos;
- metas;
- chat;
- roteirização automática;
- localização em background.

Essas capacidades exigem requisitos próprios.

## Detalhe da entrega

Pode documentar, quando sustentado pelo contrato futuro:

- identificação do pedido;
- destino necessário à entrega;
- dados mínimos para execução;
- estado atual;
- ação de confirmação.

Não exibir dados pessoais além do necessário.

## Confirmação de entrega

A confirmação deve:

- exigir ação explícita;
- aguardar resposta;
- impedir submissão duplicada;
- não assumir sucesso antes da API.

O mecanismo exato de comprovação de entrega deve ser definido pela tarefa correspondente.

A D118 não inventa:

- foto obrigatória;
- assinatura;
- código OTP;
- geolocalização;
- biometria.

## Estados mínimos futuros

- loading;
- lista vazia;
- erro;
- entrega carregada;
- confirmando;
- sucesso confirmado;
- conflito;
- sessão expirada;
- acesso negado.

## Segurança e privacidade

- somente ENTREGADOR autorizado;
- não expor dados de outras entregas;
- minimizar dados pessoais;
- não registrar informação sensível no design sem necessidade.

## Navegação

Fluxo futuro deve ser integrado a `../../NAVIGATION.md`.

## Design System

Quando as telas forem detalhadas:

- usar `../../DESIGN_SYSTEM.md`;
- usar padrões Mobile;
- manter alvo de toque mínimo;
- suportar 320–430 dp;
- estados não dependem apenas de cor.

## Regra de evolução

A implementação futura pode exigir revisão deste arquivo.

Qualquer nova capacidade deve ser sustentada por domínio/contrato antes de aparecer no design.
