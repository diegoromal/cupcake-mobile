# Design System — Cupcake Mobile

## Objetivo

Consolidar a linguagem visual aprovada na D118 para Mobile Cliente e Admin.

Este documento define papéis semânticos e padrões de composição. Regras de domínio permanecem fora do Design System.

## Princípios

1. **Veracidade:** interface não cria promessas que o domínio não sustenta.
2. **Clareza:** a ação principal deve ser evidente.
3. **Consistência:** o mesmo significado utiliza o mesmo padrão visual.
4. **Acessibilidade:** estado não depende somente de cor.
5. **Progressividade:** telas simples não antecipam complexidade de etapas futuras.
6. **Separação de domínio:** design representa capacidades; não as inventa.

## Linguagem visual

As referências aprovadas convergem para:

- base clara e quente;
- superfícies brancas;
- tons rosados muito claros para campos e áreas auxiliares;
- marrom/bordô como cor principal;
- tipografia serifada para títulos de maior hierarquia;
- tipografia sem serifa para conteúdo operacional;
- cantos arredondados;
- sombras discretas;
- ícones lineares;
- densidade maior no Admin e toque confortável no Mobile.

## Paleta de referência

Os valores abaixo são baseline visual derivado das referências aprovadas e devem ser tratados por tokens semânticos.

| Token | Valor de referência | Uso |
|---|---:|---|
| `color.background` | `#FFF8F6` | fundo principal |
| `color.surface` | `#FFFFFF` | cartões e superfícies |
| `color.surface-soft` | `#FFF1EC` | campos, faixas e blocos suaves |
| `color.primary` | `#8B4513` | CTA principal, navegação ativa, destaques |
| `color.primary-strong` | `#6F2F0A` | títulos/destaques escuros |
| `color.text` | `#2B1B16` | texto principal |
| `color.text-muted` | `#75635D` | texto secundário |
| `color.border` | `#F0DDD5` | divisores e bordas |
| `color.danger` | `#A3262F` | ações destrutivas e erros |
| `color.success` | `#2F7A5A` | sucesso/estado positivo |
| `color.warning` | `#A15C13` | atenção |
| `color.disabled` | `#CDB09C` | estado desabilitado |

Se a implementação já possuir token equivalente, reutilizar o token e preservar o papel semântico.

## Contraste

Meta mínima:

- 4,5:1 para texto comum;
- 3:1 para texto grande;
- 3:1 para componentes e indicadores relevantes.

O contraste deve ser validado na implementação real. Um PNG aprovado não substitui a verificação.

## Tipografia

### Títulos

Usar família serifada compatível com a referência visual.

Função:

- identidade;
- títulos de página;
- títulos de seção de maior hierarquia;
- valores financeiros de destaque quando aprovado na tela.

### Corpo

Usar família sem serifa legível.

Função:

- formulários;
- tabelas;
- navegação;
- mensagens;
- metadados;
- botões.

### Regras

- não usar tamanho como único indicador de hierarquia;
- respeitar ampliação de texto;
- evitar texto excessivamente condensado;
- não truncar informação funcional crítica.

## Espaçamento

Escala recomendada:

```text
4
8
12
16
24
32
48
64
```

Uso:

- 4–8: relações muito próximas;
- 12–16: componentes internos;
- 24–32: grupos e cartões;
- 48–64: separação entre regiões maiores.

Evitar valores arbitrários quando um item da escala resolver.

## Raios

Papéis recomendados:

- controles: 8–12;
- cartões: 12–16;
- badges/chips: raio alto ou pill;
- áreas destrutivas: mesmo sistema de raio, sem estética paralela.

## Elevação

Sombras devem ser discretas.

Usar apenas para:

- separar cartão da base;
- reforçar CTA fixo;
- modal/confirmação;
- navegação quando necessário.

Não usar sombras como decoração dominante.

## Ícones

- preferir ícones lineares simples;
- significado deve permanecer compreensível sem depender só do ícone;
- ações críticas devem possuir rótulo textual;
- não misturar famílias visuais muito diferentes na mesma tela.

## Imagens

### Produto

A imagem é conteúdo do domínio quando disponível.

No Admin, uma imagem persistida não deve ser presumida como renderizável se não houver contrato de leitura. O estado textual `Imagem associada` é válido.

Preview local pode ser mostrado apenas quando existe arquivo local selecionado.

### Assets decorativos

Somente usar assets com origem e licença registradas em `assets/README.md`.

## Botões

### Primário

Uso:

- ação principal da etapa;
- no máximo uma ação primária dominante por região.

### Secundário

Uso:

- voltar;
- cancelar;
- ações auxiliares.

### Destrutivo

Uso:

- exclusão;
- cancelamento irreversível;
- outras operações destrutivas confirmadas pelo domínio.

Deve ser visualmente distinto e exigir confirmação quando aplicável.

### Desabilitado

O estado deve ser perceptível além da mudança de cor e preservar legibilidade.

## Campos

- label persistente;
- placeholder não substitui label;
- obrigatoriedade explícita quando aplicável;
- ajuda curta apenas quando existe regra real;
- mensagem de erro próxima do campo;
- `aria-describedby`/equivalente quando aplicável;
- não inventar limite, máscara ou validação.

## Switch e checkbox

- usar rótulo textual;
- não interpretar `false` como ausência;
- não depender somente da posição/cor para comunicar significado.

## Cards

Usar para agrupar conteúdo funcional relacionado.

Evitar criar cards decorativos com promessas, benefícios ou regras não sustentadas.

## Tabelas

Admin:

- cabeçalhos claros;
- conteúdo textual;
- status com texto;
- ação por linha;
- rolagem horizontal indicada quando necessário;
- não ocultar coluna funcional em responsividade sem alternativa acessível.

## Badges

Usar para estados reais, por exemplo:

- Ativo;
- Inativo;
- Disponível;
- Indisponível;
- Pago;
- Em preparo.

Não criar badge para cargo, módulo, status operacional ou claim não existente.

## Navegação

### Mobile

Bottom navigation apenas quando prevista pela referência aprovada.

Itens devem manter:

- ícone;
- label;
- estado ativo.

### Admin

Sidebar consolidada:

- Pedidos;
- Produtos / Cardápio;
- Categorias;
- Personalizações;
- Relatório de Vendas.

A seção ativa deve ter diferenciação visual e semântica.

## Feedback

Mensagens devem responder:

1. o que ocorreu;
2. o que o usuário pode fazer agora.

Evitar mensagens genéricas quando o domínio possui mensagem específica.

Nunca afirmar sucesso quando o resultado for desconhecido.

## Loading

- indicar processamento;
- preservar contexto;
- não mostrar vazio antes da consulta terminar;
- durante mutação, impedir repetição quando necessário.

## Vazio

Um estado vazio deve:

- explicar ausência de conteúdo;
- oferecer próxima ação quando houver uma ação real;
- não parecer erro.

## Erro

- não depender só de vermelho;
- indicar ação possível;
- preservar dados digitados quando seguro;
- não repetir automaticamente mutação de resultado incerto.

## Confirmação

Ações destrutivas devem possuir confirmação explícita quando especificado.

Quando a regra for confirmação nominal:

- exigir nome exato;
- manter botão desabilitado até correspondência;
- request continua usando ID real do recurso.

## Mobile

- alvo de toque confortável: pelo menos 44×44 dp;
- base de referência: 390 dp;
- validar 320 e 430 dp;
- suportar teclado aberto;
- preservar CTA, preço e total;
- evitar áreas clicáveis pequenas.

## Admin

- base de referência: 1280–1440 px;
- validar 768 px;
- validar 320 px quando aplicável;
- priorizar leitura operacional;
- formulários podem empilhar;
- tabelas podem rolar horizontalmente;
- sidebar deve continuar operável ou possuir adaptação equivalente.

## Acessibilidade

Obrigatório:

- ordem de leitura coerente;
- navegação por teclado no Admin;
- semântica no Flutter;
- foco visível;
- labels;
- mensagens associadas aos campos;
- feedback anunciável;
- texto além de cor para status;
- confirmação acessível;
- ampliação de texto sem corte crítico.

## Linguagem

- pt-BR;
- direta;
- sem jargão técnico para usuário final;
- termos de domínio somente quando úteis;
- evitar promessas;
- evitar marketing em telas operacionais;
- evitar explicar implementação interna.

## Não fazer

Não introduzir apenas por estética:

- dashboard;
- ranking;
- promoções;
- descontos;
- notificações internas;
- cargos;
- gamificação;
- status de loja;
- dados de cozinha;
- produção;
- analytics;
- busca/filtro/paginação não contratados;
- wizard inexistente.

## Relação com as telas

O PNG define composição visual.

O Markdown de cada tela define comportamento.

`SCREEN_STATES.md` define estados transversais.

`NAVIGATION.md` define transições.

Em caso de conflito funcional, a referência visual deve ser revisada.
