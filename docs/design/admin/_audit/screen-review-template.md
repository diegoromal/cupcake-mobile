# Screen Review Template

## Metadados

- **Task:**
- **ID da tela:**
- **Nome:**
- **Área:** Mobile / Admin / Entregador / Outra
- **Rota:**
- **Perfil:**
- **Origem funcional:**
- **Origem visual:**
- **Screenshot anterior:**
- **Referência proposta:**
- **Data da revisão:**
- **Status:** pendente / em revisão / aprovada / rejeitada

## 1. Objetivo da tela

Descrever em uma ou duas frases qual problema funcional a tela resolve.

Não utilizar esta seção para propor novas funcionalidades.

## 2. Fontes funcionais

Registrar quais fontes sustentam o comportamento da tela.

Exemplos:

- HU;
- Dxx;
- contrato da API;
- DTO;
- modelo de domínio;
- ADR;
- testes;
- comportamento implementado;
- documentação funcional.

### Fontes

-

## 3. Função atualmente implementada

Descrever somente capacidades reais.

Perguntas orientadoras:

- O que a tela consulta?
- O que ela cria?
- O que ela altera?
- O que ela exclui?
- Quais operações dependem de confirmação?
- Quais regras de domínio interferem?
- Quais erros possuem tratamento específico?

Não inferir comportamento a partir do layout.

## 4. Rotas e navegação

### Rota atual

-

### Entrada

-

### Saídas possíveis

-

### Retorno

-

### Navegação administrativa/mobile relacionada

-

## 5. Elementos funcionais obrigatórios

Listar tudo que deve permanecer representado.

Exemplos:

- título;
- campos;
- tabela;
- ações;
- status;
- mensagens;
- loading;
- confirmação;
- erro;
- navegação.

### Obrigatórios

-

## 6. Elementos proibidos

Listar explicitamente funcionalidades ou informações que não podem surgir apenas por decisão de design.

Exemplos:

- busca inexistente;
- paginação inexistente;
- cargo inexistente;
- status inexistente;
- métricas;
- promoções;
- estoque;
- notificações;
- promessa de segurança;
- etapas de wizard;
- dados não retornados pela API.

### Proibidos

-

## 7. Massa de demonstração

Identificar quais elementos da referência são apenas dados exemplificativos.

Exemplos:

- nomes;
- preços;
- descrições;
- endereços;
- IDs;
- quantidades;
- datas;
- status utilizados apenas para mostrar estados possíveis.

### Massa

-

A massa demonstrativa nunca deve ser interpretada como valor fixo do domínio.

## 8. Comparação visual com o padrão vigente

### Identidade

- [ ] marca correta
- [ ] paleta correta
- [ ] tipografia correta
- [ ] iconografia coerente
- [ ] ausência de branding inventado
- [ ] ausência de claims não sustentados

#### Observações

-

### Navegação

- [ ] navegação correta para a área
- [ ] seção ativa identificada
- [ ] rotas reais
- [ ] logout quando aplicável
- [ ] retorno coerente
- [ ] nenhum item inexistente
- [ ] nenhum cargo/perfil inventado

#### Observações

-

### Layout

- [ ] grid coerente
- [ ] hierarquia visual
- [ ] espaçamento
- [ ] largura apropriada
- [ ] agrupamento por função
- [ ] ações principais evidentes
- [ ] ações destrutivas separadas

#### Observações

-

### Componentes

- [ ] botões
- [ ] inputs
- [ ] selects
- [ ] textarea
- [ ] switch/checkbox
- [ ] cards
- [ ] tabelas
- [ ] badges
- [ ] mensagens
- [ ] confirmação
- [ ] estados desabilitados

#### Observações

-

## 9. Veracidade

Verificar se cada texto apresentado corresponde a algo sustentado pelo domínio ou contrato.

- [ ] nenhum claim comercial inventado
- [ ] nenhuma promessa de prazo inventada
- [ ] nenhuma promessa de segurança inventada
- [ ] nenhum status inexistente
- [ ] nenhum cargo inexistente
- [ ] nenhuma métrica inexistente
- [ ] nenhuma relação deduzida sem contrato
- [ ] nenhuma causa de erro inventada
- [ ] nenhum comportamento futuro apresentado como atual

### Divergências

-

## 10. Formulários

Quando aplicável:

- [ ] obrigatórios corretos
- [ ] opcionais corretos
- [ ] valores iniciais corretos
- [ ] placeholders não confundidos com valores
- [ ] validação coerente com contrato
- [ ] erro associado ao campo
- [ ] dados preservados após erro
- [ ] submit duplicado bloqueado
- [ ] CTA desabilitado quando necessário
- [ ] nenhuma regra de validação inventada

### Observações

-

## 11. Edição parcial

Quando a tela possuir PATCH:

- [ ] apenas campos alterados são enviados
- [ ] nenhum PATCH vazio
- [ ] estado "nenhuma alteração" representado
- [ ] resposta salva passa a ser nova referência
- [ ] limpeza explícita de campos segue o contrato
- [ ] valores `false`, `0` e `null` não são confundidos

### Observações

-

## 12. Valores especiais

Quando aplicável, revisar separadamente:

### Null

-

### Vazio

-

### Zero

-

### False

-

### Negativo

-

### Decimal

-

Nenhum desses valores deve ser removido ou convertido apenas por ser falsy.

## 13. Operações destrutivas

Quando existir exclusão:

- [ ] ação visualmente separada
- [ ] confirmação necessária
- [ ] confirmação nominal quando exigida
- [ ] cancelamento sem request
- [ ] botão bloqueado enquanto confirmação for inválida
- [ ] DELETE usa ID real do recurso
- [ ] 204 tratado corretamente
- [ ] 404 tratado corretamente
- [ ] 409 tratado corretamente
- [ ] nenhuma exclusão em cascata inventada
- [ ] dados preservados após conflito

### Mensagem de confirmação

-

### Mensagem de conflito

-

## 14. Concorrência

- [ ] submissão duplicada bloqueada
- [ ] salvar bloqueia excluir quando necessário
- [ ] excluir bloqueia salvar quando necessário
- [ ] eventos concorrentes antes da renderização são considerados
- [ ] resposta antiga não sobrescreve estado recente

### Observações

-

## 15. Estados

Marcar apenas estados realmente aplicáveis.

- [ ] Inicial
- [ ] Loading
- [ ] Conteúdo carregado
- [ ] Vazio
- [ ] Formulário inválido
- [ ] Alterações pendentes
- [ ] Nenhuma alteração
- [ ] Salvando
- [ ] Criando
- [ ] Excluindo
- [ ] Confirmação
- [ ] Sucesso
- [ ] 400
- [ ] 401
- [ ] 403
- [ ] 404
- [ ] 409
- [ ] Erro de rede
- [ ] Erro do serviço
- [ ] Sessão expirada
- [ ] Acesso negado
- [ ] Estado específico do domínio

### Estados específicos

-

## 16. Erros e mensagens

Para cada erro relevante, registrar:

| Situação | Mensagem/Comportamento | Preserva dados? | Retry? |
|---|---|---:|---:|
| 400 |  |  |  |
| 401 |  |  |  |
| 403 |  |  |  |
| 404 |  |  |  |
| 409 |  |  |  |
| Rede |  |  |  |
| Serviço |  |  |  |

Mutações de resultado incerto não devem ser repetidas automaticamente.

## 17. Acessibilidade

- [ ] labels associados
- [ ] navegação por teclado
- [ ] foco visível
- [ ] `aria-current` quando aplicável
- [ ] `aria-invalid`
- [ ] `aria-describedby`
- [ ] erros anunciáveis
- [ ] loading anunciável
- [ ] status com texto além de cor
- [ ] ação destrutiva acessível
- [ ] foco correto ao abrir confirmação
- [ ] retorno de foco ao cancelar
- [ ] controles desabilitados perceptíveis além da cor

### Observações

-

## 18. Responsividade

### Desktop 1280–1440

- [ ] composição adequada
- [ ] ações visíveis
- [ ] ausência de sobreposição
- [ ] conteúdo principal utilizável

### 768 px

- [ ] layout adaptado
- [ ] ações acessíveis
- [ ] sem truncamento crítico

### 320 px quando aplicável

- [ ] fluxo principal utilizável
- [ ] campos acessíveis
- [ ] tabela tratada adequadamente
- [ ] nenhuma informação crítica removida silenciosamente

## 19. Comparação com a referência anterior

### O que permanece funcionalmente

-

### O que muda visualmente

-

### O que deixa de ser referência

-

### Dívidas identificadas

-

## 20. Classificação

Selecionar uma:

- [ ] A — Compatível
- [ ] B — Ajuste visual leve
- [ ] C — Revisão visual completa
- [ ] D — Substituir referência

## 21. Decisão

Descrever objetivamente a decisão.

-

## 22. Ajustes solicitados ao Stitch

Registrar somente alterações concretas.

-

## 23. Referência final

### PNG

`docs/design/...`

### Markdown

`docs/design/...`

### Origem

Google Stitch

### Status

- [ ] proposta
- [ ] em revisão
- [ ] aprovada
- [ ] rejeitada

## 24. Relação com implementação

A aprovação desta referência visual:

- [ ] não altera contratos de API
- [ ] não altera regras de domínio
- [ ] não altera autenticação
- [ ] não altera autorização
- [ ] não altera persistência
- [ ] não altera comportamento funcional sem tarefa própria

### Exceções

-

## 25. Critério de aprovação

A referência pode ser aprovada quando:

- conteúdo corresponde ao domínio;
- não existem funcionalidades inventadas;
- estados funcionais essenciais estão documentados;
- composição segue o Design System;
- ações são coerentes;
- acessibilidade está especificada;
- responsividade está especificada;
- comportamento funcional existente foi preservado;
- PNG e Markdown possuem caminhos definidos.

## 26. Resultado

- **Classificação final:**
- **Status:**
- **PNG:**
- **Markdown:**
- **Pendências:**
- **Observações finais:**

-
