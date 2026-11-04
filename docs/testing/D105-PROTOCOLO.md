# D105 — Protocolo de teste de usabilidade

## 1. Objetivo

Observar se uma pessoa consegue compreender e concluir as tarefas principais dos perfis **CLIENTE**, **ADMIN** e **ENTREGADOR** sem intervenção do moderador e sem sair do fluxo esperado.

Este protocolo é um instrumento de observação. Ele não autoriza correções, alterações de produto ou criação de requisitos. Problemas observados viram findings para triagem da D106.

## 2. Papéis

| Papel | Responsabilidade |
|---|---|
| Moderador | Apresenta o consentimento, lê as tarefas, observa, registra e não ajuda. |
| Participante | Executa as tarefas com o próprio conhecimento, sem receber um passo a passo. |
| Observador auxiliar (opcional) | Registra tempo/hesitações e confirma que o moderador não induziu. Não interfere. |

O moderador não pode ser o participante da mesma sessão. Um participante pode executar um perfil por sessão; se a mesma pessoa executar mais de um perfil, registrar o viés e não tratar como três participantes independentes.

## 3. Participantes

- O gate mínimo exige **3 sessões, uma por perfil**.
- Preferir **3 pessoas distintas** e sem conhecimento prévio dos caminhos do produto.
- Se a mesma pessoa cobrir mais de um perfil, registrar o código reutilizado e o viés; o relatório não pode afirmar “3 participantes independentes”.
- Não coletar nome, e-mail, telefone, endereço ou qualquer dado pessoal.
- Identificar o participante apenas por código: `P01`, `P02`, `P03` etc.
- Registrar o perfil, a data, o ambiente/HEAD e o viés conhecido (por exemplo, “colega da equipe”).
- A participação é voluntária e pode ser interrompida a qualquer momento.

## 4. Consentimento informado

### 4.1 Texto para leitura

> Convidamos você a participar de um teste de usabilidade do Cupcake Mobile. O objetivo é observar como as telas e os fluxos funcionam para melhorar o produto. Não estamos avaliando você: não existe resposta certa ou errada.
>
> A sessão deve durar cerca de 20 a 30 minutos. Você pode interromper a qualquer momento, sem justificativa. Não registraremos seu nome, e-mail, telefone ou qualquer dado pessoal; você será identificado apenas por um código.
>
> Durante a sessão, o moderador não poderá ajudar com os caminhos, para não influenciar o resultado. Se você pedir ajuda, ele poderá apenas responder de forma neutra.
>
> Com sua autorização, poderemos gravar a tela e/ou o áudio para análise. A gravação será usada somente para extrair observações anonimizadas e será descartada de forma segura depois. Se você não autorizar, registraremos apenas anotações.
>
> Nenhuma senha, token, credencial ou dado de outra pessoa será registrado. O ambiente usa dados sintéticos.
>
> Você aceita participar? Você autoriza gravação de tela? Você autoriza gravação de áudio?

### 4.2 Registro de consentimento

| Campo | Valor |
|---|---|
| Código do participante | `P__` |
| Perfil da sessão | CLIENTE / ADMIN / ENTREGADOR |
| Data e horário | |
| Participação voluntária | ( ) Sim |
| Autorização para gravação de tela | ( ) Sim ( ) Não |
| Autorização para gravação de áudio | ( ) Sim ( ) Não |
| Autorização para anotações anonimizadas | ( ) Sim |
| Participante informado sobre interrupção livre | ( ) Sim |
| Participante informado sobre ausência de dados pessoais | ( ) Sim |
| Moderador (código/iniciais) | |
| Observações | |

Não colher assinatura, nome ou documento. O registro acima é suficiente para o consentimento e preserva o anonimato.

## 5. Regras do moderador

1. Ler a tarefa exatamente como está no roteiro, sem acrescentar caminhos, nomes de botões ou telas.
2. Não apontar, não clicar, não digitar e não sugerir atalhos.
3. Se o participante pedir ajuda, responder de forma neutra:
   - “O que você faria agora?”
   - “Continue como achar melhor.”
   - “Não tenho como ajudar nesse ponto; siga com sua interpretação.”
4. Intervir somente se:
   - houver risco de dano ou exposição de dados;
   - o ambiente falhar tecnicamente;
   - o participante pedir para encerrar.
5. Registrar toda intervenção e todo pedido de ajuda.
6. Não corrigir o produto, não alterar dados e não “consertar” o fluxo durante a sessão.
7. Não induzir a interpretação “certa” de uma mensagem.
8. Não tratar opinião como requisito.
9. Encerrar a sessão no tempo previsto ou antes, se houver desconforto.

### 5.1 Estado inicial por perfil

O estado inicial deve ser idêntico para todos os participantes do mesmo perfil e registrado no formulário. Sessões que começam em estados diferentes não são comparáveis.

| Perfil | Estado inicial | O que o participante recebe |
|---|---|---|
| CLIENTE | App aberto e já autenticado como C01, na Vitrine; carrinho vazio; histórico com pelo menos um pedido sintético; nenhuma compra em andamento. | O dispositivo, já na Vitrine. Não entregar caminho para produto, carrinho ou pedidos. |
| ADMIN | Navegador aberto na **raiz** `http://localhost:3001/`, sem sessão; o sistema redireciona para o login. | A raiz do sistema e um cartão com e-mail/senha sintéticos. Não entregar `/login`, `/pedidos` ou o menu. |
| ENTREGADOR | App aberto e já autenticado como E01, na Área do entregador; uma entrega `SAIU_PARA_ENTREGA` atribuída; nenhuma confirmação em andamento. | O dispositivo, já na Área do entregador. Não entregar caminho para a lista/detalhe. |

Se o moderador preferir observar o login Mobile, isso deve ser registrado como etapa adicional e não como parte da tarefa 1. O login do Admin faz parte da tarefa 1 porque “acessar a área administrativa” é objetivo explícito do perfil.

Antes de cada sessão, confirmar: sessão/Keychain limpos, carrinho vazio, fixtures recriadas, nenhuma outra sessão aberta e nenhum pedido em andamento.

## 6. Roteiro de tarefas

As tarefas abaixo são lidas em sequência. O moderador pode repetir a frase, mas não pode acrescentar pistas.

### 6.1 CLIENTE

1. **Localizar produto:** “Encontre um cupcake disponível para compra.”
2. **Comprar:** “Faça uma compra, escolhendo como deseja receber.”
3. **Consultar pedidos:** “Consulte os pedidos da sua conta.”

### 6.2 ADMIN

1. **Acessar a área administrativa:** “A partir do acesso ao sistema, encontre e entre na área administrativa.”
2. **Localizar pedido:** “Encontre um pedido da loja.”
3. **Ação administrativa:** “Execute uma ação administrativa válida para esse pedido.”

### 6.3 ENTREGADOR

1. **Localizar entrega:** “Encontre uma entrega atribuída a você.”
2. **Consultar informações:** “Consulte as informações necessárias para realizar essa entrega.”
3. **Confirmar entrega:** “Confirme a entrega.”

### 6.4 Observações para o moderador

- Não dizer “use o filtro”, “clique em Meus pedidos”, “vá em Pedidos”, “use o menu lateral” ou equivalente.
- Se o participante perguntar “é aqui?”, responder de forma neutra e registrar a dúvida.
- Se o pagamento simulado for recusado, não interferir; observar se o participante entende e tenta novamente.
- Se o ambiente falhar (API fora, banco, rede), registrar como bloqueio técnico e não como falha do participante.

## 7. Instrumento de observação

Preencher uma linha por tarefa, por sessão.

| Campo | Registro |
|---|---|
| Código da sessão | `S__` |
| Código do participante | `P__` |
| Perfil | CLIENTE / ADMIN / ENTREGADOR |
| Data/hora | |
| Ambiente/HEAD | |
| Tarefa | 1 / 2 / 3 |
| Resultado | Concluiu / Concluiu com dificuldade / Não concluiu / Abandonou / Bloqueado pelo ambiente |
| Tempo aproximado | |
| Pedidos de ajuda | Nenhum / Neutro / Intervenção |
| Erros cometidos | |
| Hesitações | |
| Dificuldade de descoberta | |
| Interpretação de mensagens | |
| Abandono/interrupção | |
| Comportamento inesperado | |
| Evidência | Nota / minuto / captura autorizada |
| Observação do moderador | |

### 7.1 Escala de resultado

| Resultado | Definição |
|---|---|
| **Concluiu** | Concluiu a tarefa sem ajuda e sem sair do fluxo esperado. |
| **Concluiu com dificuldade** | Concluiu, mas com hesitação, erro recuperável, retorno de tela ou dúvida relevante. |
| **Não concluiu** | Não chegou ao objetivo dentro do tempo/escopo da tarefa. |
| **Abandonou** | Interrompeu voluntariamente ou desistiu. |
| **Bloqueado pelo ambiente** | Não foi possível avaliar por falha técnica/ambiente; não é falha do participante. |

## 8. Debrief

Após as tarefas, perguntar sem induzir:

1. “O que foi mais difícil?”
2. “Algo não ficou claro?”
3. “Se você pudesse mudar uma coisa, o que seria?”
4. “Você já tinha usado este sistema antes?”

Registrar as respostas como **opinião/observação**, não automaticamente como finding.

## 9. Anonimização e proteção de dados

- Usar apenas códigos `P01`, `P02`, `P03`.
- Não registrar senha, token, cookie, header `Authorization`, e-mail, telefone, endereço real ou dado de outra pessoa.
- Capturas/gravações somente com consentimento.
- Se uma captura contiver acidentalmente um dado sensível, descartá-la e registrar apenas a observação.
- Armazenar gravações fora do repositório, em local temporário protegido.
- Após a extração das observações, descartar a gravação de forma segura.
- O repositório recebe apenas o registro anonimizado.

## 10. Encerramento da sessão

Checklist:

- [ ] Consentimento registrado.
- [ ] Tarefas e observações preenchidas.
- [ ] Debrief registrado.
- [ ] Logout no app e no Admin.
- [ ] Sessões/tokens temporários encerrados.
- [ ] Capturas/gravações sensíveis descartadas ou protegidas.
- [ ] Ambiente/fixtures da sessão descartados ou recriados para a próxima.
- [ ] Nenhum dado pessoal no registro final.

## 11. O que não fazer

- Não ajudar o participante a concluir.
- Não corrigir o produto durante a sessão.
- Não alterar código para “fazer o teste passar”.
- Não inventar resultado, participante ou observação.
- Não usar dados reais, senhas reais ou tokens reais.
- Não transformar opinião em requisito.
- Não testar rota não implementada.
- Não executar commit, push ou merge nesta etapa.
