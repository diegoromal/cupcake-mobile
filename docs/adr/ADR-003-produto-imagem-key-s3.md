# ADR-003 — Referência por key S3 em Produto.imagem

Status: aceito na D21.

## Decisão

`Produto.imagem` persiste somente uma key gerada pelo servidor: `produtos/<produtoId>/<uuid>.webp`. URL, endpoint, bucket, credenciais e ACL não são persistidos. A coluna existente permanece sem alteração de schema.

## Motivação

A referência não depende do endereço do storage, do domínio de entrega ou da forma de acesso. Isso permite trocar endpoint ou estratégia de leitura sem regravar Produtos. O bucket permanece privado e só os endpoints específicos da D21 podem alterar a coluna.

## Consequências

A API precisa resolver a key com configuração externa para operações de storage. Exclusão de objeto ocorre depois da mudança no banco e falhas são registradas para reconciliação. Referências legadas não são tratadas como objetos próprios da D21.
