# Assets de Design

## Objetivo

Definir como assets visuais aprovados podem ser versionados e utilizados pelo Cupcake Mobile.

## Regra principal

Nenhum asset deve entrar no produto apenas porque apareceu em um protótipo.

Todo asset precisa possuir:

- uso definido;
- origem conhecida;
- licença compatível;
- formato apropriado;
- tamanho razoável;
- relação com uma referência aprovada.

## Formatos

### PNG

Usar para:

- screenshots de referência;
- imagens raster aprovadas.

Screenshots de design não devem ser empacotados como assets da aplicação.

### SVG

Opcional para:

- ícones próprios;
- ilustrações vetoriais aprovadas.

Antes de versionar:

- revisar conteúdo;
- remover metadados desnecessários;
- validar licença;
- validar compatibilidade com Flutter e Web.

### JPEG/WebP

Usar somente quando houver finalidade real de conteúdo ou demonstração aprovada.

## Google Stitch

O Stitch é ferramenta de exploração e geração de referência visual.

Não versionar:

- HTML exportado;
- CSS exportado;
- React gerado;
- Flutter gerado;
- projeto proprietário da ferramenta;
- dependências sugeridas pela ferramenta.

A referência canônica é:

- PNG;
- Markdown.

## Imagens demonstrativas de produtos

Imagens presentes nos protótipos podem ser massa visual de demonstração.

Elas não devem ser assumidas como:

- catálogo real;
- asset licenciado para produção;
- produto cadastrado;
- imagem persistida da API.

Antes de usar uma imagem em runtime, registrar sua origem e licença.

## Ícones

Preferir uma biblioteca consistente com as stacks escolhidas.

Não copiar ícones rasterizados do screenshot quando houver equivalente semântico apropriado.

## Registro de asset

Quando um asset real for adicionado, documentar:

```text
Nome:
Arquivo:
Origem:
Autor:
Licença:
Uso:
Telas:
Observações:
```

## Proibições

Não adicionar:

- imagem sem origem;
- fonte sem licença;
- logo de terceiro sem autorização;
- screenshot como asset de runtime;
- código do Stitch;
- asset meramente decorativo sem função definida.

## Referências

Consultar:

- `../DESIGN_SYSTEM.md`
- `../README.md`
