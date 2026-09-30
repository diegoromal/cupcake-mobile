# Admin Product Detail

## Metadados

- **ID:** `admin.catalog.product-detail`
- **Versão:** `v1`
- **Status:** aprovada
- **Perfil:** ADMIN
- **Rota atual:** `/produtos/[id]`
- **HU principais:** HU-14, HU-15
- **Origem visual:** Google Stitch
- **Origem funcional:** D22 + D24
- **Viewport-base:** 1440 px
- **Referência visual:** `product-detail.png`

---

## Objetivo

Permitir que o administrador consulte e edite um produto existente, gerencie sua
imagem, vínculos de personalização, estoque e histórico de movimentações.

Esta referência substitui visualmente a tela administrativa anterior sem alterar
os contratos funcionais existentes.

---

## Requisitos funcionais representados

A tela representa:

- retorno à lista de produtos;
- identificação do produto;
- status ativo/inativo;
- edição dos dados básicos;
- gerenciamento de imagem;
- gerenciamento de personalizações;
- consulta e ajuste de estoque;
- histórico de movimentações;
- exclusão do produto.

---

## Dados básicos

A seção apresenta:

- Nome do Produto;
- Categoria;
- Preço de Venda;
- Descrição;
- Ativo.

Os campos devem refletir os dados persistidos.

---

## Edição

A edição deve enviar somente os campos alterados.

Quando nenhuma alteração existir:

- não enviar PATCH vazio;
- manter `Salvar alterações` desabilitado;
- informar visualmente que não há alterações pendentes.

Durante salvamento:

- impedir submissão duplicada;
- desabilitar operações concorrentes quando necessário;
- preservar dados locais em caso de erro.

---

## Categoria

A categoria deve corresponder a uma categoria existente.

Quando a categoria associada deixar de estar disponível:

- informar a indisponibilidade;
- não inventar outra categoria;
- exigir seleção válida antes de salvar alteração relacionada.

A tela não permite criar categorias.

---

## Ativo

O controle `Ativo` representa o atributo funcional existente do produto.

Não constitui:

- promoção;
- prioridade;
- destaque;
- campanha.

---

## Imagem do produto

A seção deve representar:

- ausência ou presença de imagem associada;
- seleção de novo arquivo;
- substituição;
- remoção.

Formatos suportados conforme contrato vigente:

- JPEG;
- PNG;
- WebP.

Limite de entrada:

- até 10 MiB.

---

## Limitação da imagem persistida

A implementação vigente armazena a imagem como chave privada.

Não existe contrato público de leitura que garanta renderização da imagem já
salva ao reabrir a tela.

Por isso:

- a referência persistida é representada por `Imagem associada`;
- não se deve assumir que a imagem persistida pode ser exibida diretamente;
- preview visual pode existir apenas para arquivo selecionado localmente na sessão,
  identificado como preview local.

---

## Upload

Durante upload:

- indicar processamento;
- impedir envio duplicado;
- não mostrar porcentagem quando não houver suporte real;
- preservar o produto existente em caso de falha.

A falha do upload não deve recriar o produto.

---

## Remoção de imagem

A remoção deve:

- exigir confirmação quando aplicável;
- aguardar resposta da API;
- atualizar o estado somente após sucesso.

---

## Personalizações

A seção apresenta:

- personalizações vinculadas;
- personalizações disponíveis;
- status;
- ajuste de valor;
- vincular;
- desvincular.

---

## Personalizações vinculadas

Cada vínculo pode apresentar:

- nome;
- disponibilidade;
- ajuste de valor;
- ação de desvincular.

Estados:

- Disponível;
- Indisponível.

Uma personalização indisponível pode permanecer vinculada.

A indisponibilidade não deve ser interpretada como falta de estoque físico.

---

## Vincular personalização

A tela deve permitir selecionar uma personalização existente e criar o vínculo.

Não deve:

- cadastrar personalização;
- alterar seus dados;
- criar duplicidade.

Duplicidade deve ser tratada conforme resposta de domínio.

---

## Desvincular personalização

A ação deve:

- exigir confirmação;
- impedir submissão concorrente;
- atualizar a lista somente após sucesso;
- tratar 404/409 conforme contrato vigente.

---

## Estoque

A seção de estoque apresenta:

- quantidade física;
- quantidade reservada;
- quantidade disponível, derivada de `quantidadeFisica - quantidadeReservada`;
- ação `Ajustar estoque`.

O saldo físico e o reservado são quantidades distintas. A disponibilidade é
derivada e não possui coluna própria.

O ajuste informa a quantidade disponível desejada (`quantidadeDisponivel`). A
API recalcula o físico preservando a quantidade reservada. Não permitir valores
negativos nem assumir novo saldo antes da confirmação da API.

---

## Ajuste de estoque

Durante o ajuste:

- impedir submissões duplicadas;
- manter coerência entre saldo e histórico;
- aguardar confirmação antes de assumir novo saldo.

---

## Histórico de movimentações

O histórico apresenta somente os campos retornados pelo contrato:

- `data`;
- `quantidade` (variação positiva ou negativa);
- `motivoOrigem`.

O contrato também retorna `id`, `produtoId` e `pedidoId`; esses campos técnicos
não precisam ser apresentados como colunas. O contrato não retorna tipo de
movimentação nem saldo resultante. Embora `product-detail.png` apresente
“saldo resultante”, essa informação não está disponível no contrato atual e
uma implementação futura não deve tratá-la como dado retornado ou calculável
a partir de cada registro do histórico.

Não adicionar colunas para:

- responsável;
- dados adicionais de pedidos,

sem contrato correspondente.

---

## Exclusão do produto

A ação `Excluir produto` deve ser visualmente destrutiva e separada das demais
operações.

A exclusão:

- exige confirmação nominal: o usuário deve digitar o nome exato do produto;
- mantém o botão de exclusão bloqueado até que o texto corresponda exatamente
  ao nome do produto;
- ao cancelar, fecha a confirmação sem enviar `DELETE`;
- envia `DELETE` usando o ID real do produto, não o nome digitado;
- pode retornar 204 em sucesso;
- pode retornar 404 se o produto já não existir;
- pode retornar 409 quando relações ou estoque bloquearem a operação;
- não deve remover vínculos automaticamente para forçar a exclusão.

Após 409, a tela deve continuar disponível.

---

## Estados

A implementação deve contemplar:

### Carregando

Produto ainda não disponível.

### Produto carregado

Estado principal.

### Alterações pendentes

Existem diferenças locais ainda não persistidas.

### Nenhuma alteração

PATCH não deve ser enviado.

### Salvando

Mutação em andamento.

### Produto inexistente

404 do produto.

### Categoria indisponível

Categoria associada não pode ser resolvida.

### Upload em andamento

Imagem sendo enviada.

### Erro de imagem

Falha em upload, substituição ou remoção.

### Vínculo em andamento

Operação de personalização sendo processada.

### Conflito

409 da operação.

### Estoque em atualização

Ajuste em andamento.

### Erro

Falha técnica ou de domínio.

### Sessão expirada

Retorno ao login conforme fluxo vigente.

### Acesso negado

Usuário sem perfil ADMIN.

---

## Navegação administrativa

A referência utiliza:

- Pedidos;
- Produtos / Cardápio;
- Categorias;
- Personalizações;
- Relatório de Vendas.

`Produtos / Cardápio` aparece como seção ativa.

---

## Identificação administrativa

`Confeitaria Admin` é apenas identificação visual demonstrativa.

Não representa novo papel ou cargo.

---

## Regra de veracidade

A tela não deve adicionar, sem requisito correspondente:

- múltiplas imagens;
- galeria;
- porcentagem de upload;
- SKU;
- código de barras;
- descontos;
- custo;
- métricas;
- vendas;
- avaliações;
- tags;
- SEO;
- ingredientes;
- dados de cozinha;
- dados de pedido;
- operador responsável;
- qualquer outra funcionalidade não implementada.

---

## Acessibilidade

A implementação deve preservar:

- labels persistentes;
- foco visível;
- navegação por teclado;
- estados textuais;
- confirmação acessível;
- erros anunciáveis;
- controles desabilitados durante mutação;
- status não dependentes somente de cor.

---

## Responsividade

A referência foi aprovada para desktop.

Cenário-base:

- 1280–1440 px.

Também deve ser validada em:

- 768 px;
- 320 px quando aplicável.

Em larguras menores:

- seções podem empilhar;
- ações devem permanecer acessíveis;
- tabelas podem usar rolagem horizontal indicada.

---

## Relação com a implementação legada

A rota `/produtos/[id]` já existia antes da consolidação visual da D118.

Esta referência:

- substitui a direção visual anterior;
- preserva contratos D22/D24;
- não altera API;
- não altera regras de estoque;
- não altera regras de imagem;
- não altera vínculos;
- não altera exclusão.

Capturas anteriores permanecem como evidência histórica.

---

## Navegação

Fluxo principal:

`Admin Product List`
→ `Admin Product Detail`

A partir desta tela, operações permanecem vinculadas ao mesmo produto.

A navegação completa deve seguir:

`docs/design/NAVIGATION.md`

---

## Referências

A implementação deve observar também:

- `docs/design/DESIGN_SYSTEM.md`
- `docs/design/NAVIGATION.md`
- `docs/design/SCREEN_STATES.md`
- `docs/design/admin/_audit/legacy-audit.md`
- `.ai/DESIGN.md`

Em caso de conflito, contratos vigentes, modelo de domínio e regras de negócio
prevalecem sobre a referência visual.

A imagem `product-detail.png` representa a composição visual aprovada, mas não
cria novas regras funcionais.
