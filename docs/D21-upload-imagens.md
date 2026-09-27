# D21 — Upload e armazenamento de imagens de Produto

## Contrato

`POST /admin/produtos/:id/imagem` recebe `multipart/form-data` com exatamente um arquivo no campo `imagem`. Requer ADMIN e responde `200` com `{ "id": "<uuid>", "imagem": "produtos/<produtoId>/<uuid>.webp" }`.

`DELETE /admin/produtos/:id/imagem` requer ADMIN e responde `204` sem corpo, inclusive quando a imagem já é nula. Os dois endpoints retornam 401 sem autenticação, 403 para CLIENTE ou ENTREGADOR, 400 para UUID inválido e 404 para Produto inexistente. Upload inválido retorna 400, entrada maior que 10 MiB retorna 413, concorrência retorna 409 e indisponibilidade de S3 retorna 503. Falhas inesperadas retornam 500 sem detalhes internos.

Os endpoints genéricos de criação e atualização rejeitam `imagem` pelo `ValidationPipe`. As respostas de Produto seguem incluindo `imagem`.

## Validação e processamento

São aceitos JPEG, PNG e WebP estáticos. O MIME declarado deve corresponder ao formato decodificado; filename e extensão são ignorados. SVG, GIF, WebP animado, dados inválidos e imagens incompletas são rejeitados. A entrada tem limite de 10 MiB e 20 megapixels. Sharp valida dimensões, decodifica, aplica orientação EXIF, redimensiona proporcionalmente até 1600 × 1600 sem ampliar, converte para WebP com quality 80 e remove metadata. A saída é validada e limitada a 2 MiB antes de qualquer gravação.

## Storage local

`docker compose --env-file <arquivo-de-ambiente-local> up -d postgres s3mock` inicia Adobe S3Mock 4.11.0 e o bucket privado `cupcake-images` na porta local 9090. A configuração da API usa `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` e `S3_FORCE_PATH_STYLE`. Veja `.env.example`. Configure valores reais somente em ambiente privado. A configuração é validada no primeiro uso do storage. Nenhuma ACL é atribuída por objeto.

Para o teste integrado, crie um banco local isolado `cupcake_d21`, aplique as migrations já existentes nele e execute `D21_TEST_DATABASE_URL=<url-local> npx ts-node test/produto-imagens-storage.ts` em `apps/api`, com as variáveis S3 apontando para o S3Mock. O teste exige o caminho `/cupcake_d21` e host local.

A key é criada pelo servidor como `produtos/<produtoId>/<uuidAleatorio>.webp`. A coluna `Produto.imagem` guarda apenas essa key. Uma referência só é gerenciada se todo o formato for válido e o produtoId coincidir. Referências legadas não geram exclusão de objetos.

## Consistência

Na substituição, a API lê a referência atual, processa o arquivo, grava o novo objeto e usa `updateMany` com condição de `id` e `imagem` previamente lida. Se outra operação venceu, retorna 409 e tenta remover o objeto recém-gravado. Falha de banco após o put também aciona essa compensação e preserva a referência anterior. Após sucesso no banco, a imagem antiga gerenciada é removida. Remoção da imagem usa a mesma condição concorrente e limpa a referência antes de excluir o objeto. Exclusão de Produto remove o objeto gerenciado após a transação do banco.

Falha ao excluir um objeto antigo não restaura o banco. O log estruturado contém somente produtoId, key, etapa e classe/código seguro do erro. O objeto órfão fica elegível para reconciliação.

## Reconciliação manual

Execute `npm run images:reconcile` em `apps/api` com acesso ao banco e ao S3. O script percorre somente `produtos/`, aceita apenas keys gerenciadas com mais de 24 horas, consulta novamente o banco antes de cada exclusão e continua após erros individuais. Objetos referenciados nunca são excluídos. Não há scheduler nesta fase.

## Riscos conhecidos

Storage e PostgreSQL não compartilham transação; uma falha na compensação pode deixar objeto órfão até a próxima reconciliação. A consulta final da reconciliação reduz a janela de corrida, mas não oferece bloqueio distribuído com uploads em andamento. O prazo de 24 horas protege novos uploads durante essa janela.
